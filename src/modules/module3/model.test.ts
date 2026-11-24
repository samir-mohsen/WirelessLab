import { describe, expect, it } from 'vitest';
import { relativeError } from '../../engine/stats';
import {
  computeDelaySpread,
  computePDP,
  simulateOfdmPoint,
  theoryAwgnBer,
  theoryRayleighBer,
} from './model';

describe('Module 3: OFDM Multipath & Cyclic Prefix Model', () => {
  it('PDP sums to 1 and L=1 has zero delay spread', () => {
    const p1 = computePDP(1, 3.0);
    expect(p1.length).toBe(1);
    expect(p1[0]).toBe(1);
    expect(computeDelaySpread(p1, 20).rmsSamples).toBe(0);

    const p9 = computePDP(9, 3.0);
    const sum = p9.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 12);
    expect(computeDelaySpread(p9, 20).rmsSamples).toBeGreaterThan(1.0);
  });

  it('AWGN limiting case matches Q(sqrt(2*Eb/N0)) within <= 15% relative error', () => {
    for (const snrDb of [0, 3, 6]) {
      const res = simulateOfdmPoint({
        modulation: 'QPSK',
        nSubcarriers: 64,
        nCp: 0,
        channelTaps: 1,
        pdpDecay: 3.0,
        equalizer: 'ZF',
        ebN0Db: snrDb,
        chargeCpEnergy: false,
        awgnOnly: true,
        symbolsPerChannel: 4,
        numTrials: 120,
        earlyStop: false,
        earlyStopErrors: 1000,
        baseSeed: 44103,
        experimentId: 1,
        snrIndex: snrDb,
      });
      const theory = theoryAwgnBer('QPSK', snrDb);
      const err = relativeError(res.ber, theory);
      expect(err).toBeLessThanOrEqual(0.15);
    }
  });

  it('OFDM with sufficient CP (Ncp >= L-1) matches flat Rayleigh theory within <= 15%', () => {
    for (const snrDb of [0, 6, 12]) {
      const res = simulateOfdmPoint({
        modulation: 'QPSK',
        nSubcarriers: 64,
        nCp: 8,
        channelTaps: 9,
        pdpDecay: 3.0,
        equalizer: 'ZF',
        ebN0Db: snrDb,
        chargeCpEnergy: false,
        awgnOnly: false,
        symbolsPerChannel: 4,
        numTrials: 260,
        earlyStop: false,
        earlyStopErrors: 1000,
        baseSeed: 44103,
        experimentId: 2,
        snrIndex: snrDb,
      });
      const theory = theoryRayleighBer('QPSK', snrDb);
      const err = relativeError(res.ber, theory);
      expect(err).toBeLessThanOrEqual(0.15);
    }
  });

  it('No CP exhibits clear ISI error floor compared to Sufficient CP at high SNR', () => {
    const baseCfg = {
      modulation: 'QPSK' as const,
      nSubcarriers: 64,
      channelTaps: 9,
      pdpDecay: 2.5,
      equalizer: 'MMSE' as const,
      ebN0Db: 20,
      chargeCpEnergy: false,
      awgnOnly: false,
      symbolsPerChannel: 4,
      numTrials: 120,
      earlyStop: false,
      earlyStopErrors: 1000,
      baseSeed: 44103,
      experimentId: 3,
      snrIndex: 0,
    };
    const noCp = simulateOfdmPoint({ ...baseCfg, nCp: 0 });
    const suffCp = simulateOfdmPoint({ ...baseCfg, nCp: 8 });
    expect(noCp.ber).toBeGreaterThan(suffCp.ber * 3);
  });

  it('ZF and MMSE give identical BER for QPSK, while MMSE dramatically reduces MSE over ZF for 16-QAM', () => {
    const qpskBase = {
      modulation: 'QPSK' as const,
      nSubcarriers: 64,
      nCp: 8,
      channelTaps: 9,
      pdpDecay: 3.0,
      ebN0Db: 10,
      chargeCpEnergy: false,
      awgnOnly: false,
      symbolsPerChannel: 4,
      numTrials: 80,
      earlyStop: false,
      earlyStopErrors: 1000,
      baseSeed: 44103,
      experimentId: 4,
      snrIndex: 0,
    };
    const qpskZf = simulateOfdmPoint({ ...qpskBase, equalizer: 'ZF' });
    const qpskMmse = simulateOfdmPoint({ ...qpskBase, equalizer: 'MMSE' });
    expect(qpskZf.errors).toBe(qpskMmse.errors);

    const qamBase = { ...qpskBase, modulation: '16QAM' as const, ebN0Db: 12, numTrials: 140 };
    const qamZf = simulateOfdmPoint({ ...qamBase, equalizer: 'ZF' });
    const qamMmse = simulateOfdmPoint({ ...qamBase, equalizer: 'MMSE' });
    expect(qamMmse.mse).toBeLessThan(qamZf.mse * 0.5);
  });
});
