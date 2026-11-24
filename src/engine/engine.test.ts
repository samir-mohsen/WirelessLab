import { describe, expect, it } from 'vitest';
import { fft, fftUnitaryInPlace, ifft, ifftUnitaryInPlace } from './fft';
import {
  matCholesky,
  matConjTranspose,
  matDeterminant,
  matExponentialCorrelation,
  matInverseReal,
  matMul,
} from './matrix';
import { SeededRNG, deriveSubSeed } from './rng';
import {
  adaptiveSimpson,
  binomial,
  erfc,
  expIntegralE1,
  expScaledE1,
  logGamma,
  qFunc,
} from './special';
import { interpolateCrossing, jainsFairnessIndex, wilsonInterval } from './stats';
import { partitionTrialRange } from './workerPool';

describe('Core Numerical Engine', () => {
  it('FFT/IFFT round trip and unitary Parseval energy conservation', () => {
    const N = 64;
    const rng = new SeededRNG(12345);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    let energyTime = 0;
    for (let i = 0; i < N; i++) {
      re[i] = rng.nextGaussian();
      im[i] = rng.nextGaussian();
      energyTime += re[i] * re[i] + im[i] * im[i];
    }

    const fwd = fft(re, im);
    const inv = ifft(fwd.re, fwd.im);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(inv.re[i] - re[i])).toBeLessThan(1e-12);
      expect(Math.abs(inv.im[i] - im[i])).toBeLessThan(1e-12);
    }

    // Unitary FFT preserves energy
    const uRe = new Float64Array(re);
    const uIm = new Float64Array(im);
    fftUnitaryInPlace(uRe, uIm);
    let energyFreq = 0;
    for (let i = 0; i < N; i++) {
      energyFreq += uRe[i] * uRe[i] + uIm[i] * uIm[i];
    }
    expect(Math.abs(energyFreq - energyTime)).toBeLessThan(1e-11);

    ifftUnitaryInPlace(uRe, uIm);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(uRe[i] - re[i])).toBeLessThan(1e-12);
      expect(Math.abs(uIm[i] - im[i])).toBeLessThan(1e-12);
    }
  });

  it('Q-function, erfc, logGamma, binomial, Simpson, and E1 accuracy', () => {
    expect(qFunc(0)).toBeCloseTo(0.5, 14);
    expect(qFunc(1)).toBeCloseTo(0.15865525393145707, 12);
    expect(qFunc(3)).toBeCloseTo(0.0013498980316300945, 12);
    expect(qFunc(5)).toBeCloseTo(2.866515718791939e-7, 12);
    expect(erfc(-1) + erfc(1)).toBeCloseTo(2.0, 14);

    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 9); // 5! = 120
    expect(binomial(10, 3)).toBe(120);
    expect(binomial(7, 0)).toBe(1);

    // Integral of sin(x) on [0, pi] = 2
    const integral = adaptiveSimpson(Math.sin, 0, Math.PI, 1e-10);
    expect(integral).toBeCloseTo(2.0, 9);

    // Reference E1(1) = 0.21938393439552027, E1(0.5) = 0.5597735947761608
    expect(expIntegralE1(1.0)).toBeCloseTo(0.21938393439552027, 11);
    expect(expIntegralE1(0.5)).toBeCloseTo(0.5597735947761608, 11);
    // e^1 * E1(1) / ln(2) = SISO Rayleigh capacity at 0 dB (~ 0.86034738 bits/s/Hz)
    const cSiso0dB = expScaledE1(1.0) / Math.LN2;
    expect(cSiso0dB).toBeCloseTo(0.86034738, 6);
  });

  it('Complex matrix Cholesky, LU determinant, and real inverse', () => {
    const R = matExponentialCorrelation(4, 0.7);
    const L = matCholesky(R);
    const LH = matConjTranspose(L);
    const recon = matMul(L, LH);
    for (let i = 0; i < R.re.length; i++) {
      expect(Math.abs(recon.re[i] - R.re[i])).toBeLessThan(1e-12);
      expect(Math.abs(recon.im[i])).toBeLessThan(1e-12);
    }

    // Det of 4x4 exponential correlation matrix is (1 - r^2)^3
    const det = matDeterminant(R);
    const expectedDet = Math.pow(1 - 0.49, 3);
    expect(det.re).toBeCloseTo(expectedDet, 10);
    expect(Math.abs(det.im)).toBeLessThan(1e-12);

    // Real 2x2 inverse check
    const a = new Float64Array([4, 7, 2, 6]);
    const inv = matInverseReal(a, 2);
    expect(inv[0]).toBeCloseTo(0.6, 12);
    expect(inv[1]).toBeCloseTo(-0.7, 12);
    expect(inv[2]).toBeCloseTo(-0.2, 12);
    expect(inv[3]).toBeCloseTo(0.4, 12);
  });

  it('Wilson 95% confidence interval properties and utilities', () => {
    const ci50 = wilsonInterval(50, 100);
    expect(ci50.p).toBe(0.5);
    expect(ci50.lower).toBeGreaterThan(0.39);
    expect(ci50.upper).toBeLessThan(0.61);
    expect(ci50.errMinus).toBeCloseTo(ci50.errPlus, 12);

    const ciZero = wilsonInterval(0, 1000);
    expect(ciZero.lower).toBe(0);
    expect(ciZero.upper).toBeGreaterThan(0);
    expect(ciZero.upper).toBeLessThan(0.01);

    const crossing = interpolateCrossing([0, 5, 10], [1e-1, 1e-2, 1e-3], 1e-2, true);
    expect(crossing).toBeCloseTo(5.0, 10);

    expect(jainsFairnessIndex([10, 10, 10, 10])).toBeCloseTo(1.0, 12);
    expect(jainsFairnessIndex([10, 0, 0, 0])).toBeCloseTo(0.25, 12);
  });

  it('PRNG reproducibility is bit-for-bit identical across 1 vs 4 workers', () => {
    const baseSeed = 987654;
    const totalTrials = 200;

    const runWithWorkers = (workerCount: number) => {
      const chunks = partitionTrialRange(totalTrials, workerCount);
      const outputs = new Float64Array(totalTrials);
      for (const ch of chunks) {
        for (let t = ch.start; t < ch.start + ch.count; t++) {
          const rng = new SeededRNG(deriveSubSeed(baseSeed, 7, t));
          outputs[t] = rng.nextGaussian() + rng.nextFloat();
        }
      }
      return outputs;
    };

    const res1 = runWithWorkers(1);
    const res4 = runWithWorkers(4);
    const res7 = runWithWorkers(7);

    for (let i = 0; i < totalTrials; i++) {
      expect(res4[i]).toBe(res1[i]);
      expect(res7[i]).toBe(res1[i]);
    }
  });
});
