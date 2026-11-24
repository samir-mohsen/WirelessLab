import type * as Plotly from 'plotly.js';
import { fftUnitaryInPlace, ifftUnitaryInPlace } from './fft';
import {
  matCholesky,
  matCreate,
  matExponentialCorrelation,
  matMul,
  matMulSelfConjTranspose,
} from './matrix';
import { createRng, deriveSubSeed } from './rng';
import { dbToLin, linToDb } from './special';
import { fsplDb, meanRxPowerDbm, type Module1Params } from '../modules/module1/model';
import { getCoChannelCenters, reuseDistanceM, type ClusterSize } from '../modules/module6/model';
import { getUserSnrOffsetsDb } from '../modules/module8/model';
import type { FigureSpec, ModuleId } from '../types/simulation';

export interface SignalLabMetric {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface SignalLabSnapshot {
  moduleId: ModuleId;
  title: string;
  description: string;
  controlLabel: string;
  controlMin: number;
  controlMax: number;
  controlStep: number;
  controlUnit: string;
  controlValue: number;
  metrics: SignalLabMetric[];
  panels: FigureSpec[];
}

export function getDefaultSignalLabControl(
  moduleId: ModuleId,
  params: Record<string, unknown>,
): number {
  switch (moduleId) {
    case 'module1':
      return Number(params.shadowSigmaDb ?? 8);
    case 'module2':
      return 10; // Average branch SNR (dB)
    case 'module3':
      return 16; // Eb/N0 (dB)
    case 'module4':
      return Number(params.jammerJsDb ?? 10);
    case 'module5':
      return Number(params.nearFarDb ?? 12);
    case 'module6':
      return Number(params.selectedClusterN ?? 7);
    case 'module7':
      return Number(params.fixedSnrDb ?? 15);
    case 'module8':
      return Number(params.operatingSnrDb ?? 14);
  }
}

/**
 * Exact eigenvalues of an n x n Hermitian positive-semidefinite matrix via
 * complex-to-real 2n x 2n symmetric embedding + classical Jacobi rotations.
 * Returns the n sorted descending non-negative eigenvalues.
 */
export function hermitianEigenvalues(
  re: Float64Array,
  im: Float64Array,
  n: number,
): number[] {
  if (n === 1) return [Math.max(0, re[0])];

  // Build 2n x 2n real symmetric block matrix: [[Re(A), -Im(A)], [Im(A), Re(A)]]
  // Each eigenvalue of A appears with multiplicity 2.
  const m = 2 * n;
  const B = new Float64Array(m * m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ar = re[i * n + j];
      const ai = im[i * n + j];
      B[i * m + j] = ar;
      B[(i + n) * m + (j + n)] = ar;
      B[i * m + (j + n)] = -ai;
      B[(i + n) * m + j] = ai;
    }
  }

  // Classical cyclic Jacobi sweeps on real symmetric B
  const maxSweeps = 40;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let maxOff = 0;
    for (let p = 0; p < m - 1; p++) {
      for (let q = p + 1; q < m; q++) {
        const bpq = B[p * m + q];
        if (Math.abs(bpq) > maxOff) maxOff = Math.abs(bpq);
        if (Math.abs(bpq) < 1e-13) continue;

        const bpp = B[p * m + p];
        const bqq = B[q * m + q];
        const tau = (bqq - bpp) / (2 * bpq);
        const t =
          tau >= 0
            ? 1 / (tau + Math.sqrt(1 + tau * tau))
            : -1 / (-tau + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        B[p * m + p] = bpp - t * bpq;
        B[q * m + q] = bqq + t * bpq;
        B[p * m + q] = 0;
        B[q * m + p] = 0;

        for (let r = 0; r < m; r++) {
          if (r === p || r === q) continue;
          const brp = B[r * m + p];
          const brq = B[r * m + q];
          const nrp = c * brp - s * brq;
          const nrq = s * brp + c * brq;
          B[r * m + p] = nrp;
          B[p * m + r] = nrp;
          B[r * m + q] = nrq;
          B[q * m + r] = nrq;
        }
      }
    }
    if (maxOff < 1e-12) break;
  }

  const allEigs: number[] = [];
  for (let i = 0; i < m; i++) {
    allEigs.push(Math.max(0, B[i * m + i]));
  }
  allEigs.sort((a, b) => b - a);
  // Deduplicate paired eigenvalues
  const unique: number[] = [];
  for (let i = 0; i < n; i++) {
    unique.push(0.5 * (allEigs[2 * i] + allEigs[2 * i + 1]));
  }
  return unique;
}

/**
 * Exact MIMO Water-Filling power allocation:
 * Maximize sum_i log2(1 + p_i * lambda_i) subject to sum_i p_i = totalPower, p_i >= 0.
 */
export function solveWaterFilling(
  eigenvalues: number[],
  totalPower: number,
): { powers: number[]; waterLevel: number; capacityWf: number; capacityEq: number } {
  const n = eigenvalues.length;
  const active = eigenvalues.map((lam, idx) => ({ lam: Math.max(lam, 1e-12), idx }));
  active.sort((a, b) => b.lam - a.lam);

  let k = active.length;
  let mu = 0;
  while (k > 0) {
    const sumInv = active.slice(0, k).reduce((acc, item) => acc + 1 / item.lam, 0);
    mu = (totalPower + sumInv) / k;
    if (mu - 1 / active[k - 1].lam > 0) break;
    k -= 1;
  }

  const powers = new Array<number>(n).fill(0);
  for (let i = 0; i < k; i++) {
    powers[active[i].idx] = Math.max(0, mu - 1 / active[i].lam);
  }

  const eqPower = totalPower / Math.max(n, 1);
  let capacityWf = 0;
  let capacityEq = 0;
  for (let i = 0; i < n; i++) {
    capacityWf += Math.log2(1 + powers[i] * eigenvalues[i]);
    capacityEq += Math.log2(1 + eqPower * eigenvalues[i]);
  }

  return { powers, waterLevel: mu, capacityWf, capacityEq };
}

/**
 * Generate a rich, real-time single-realization signal/channel inspection snapshot
 * for any of the 8 ECE 441 modules.
 */
export function generateSignalLabSnapshot(
  moduleId: ModuleId,
  params: Record<string, unknown>,
  realizationIdx: number,
  controlValue: number,
): SignalLabSnapshot {
  const baseSeed = Number(params.seed ?? 44100);
  const rng = createRng(
    deriveSubSeed(baseSeed, 900 + Number(moduleId.replace('module', '')), realizationIdx),
  );

  switch (moduleId) {
    // =========================================================================
    // MODULE 1: 2D Spatial Coverage Heatmap with Correlated Log-Normal Shadowing
    // =========================================================================
    case 'module1': {
      const p = params as unknown as Module1Params;
      const fLow = Number(p.freqLowMHz ?? 900);
      const nExp = Number(p.pathLossExp ?? 3.2);
      const sigma = Math.max(0.5, controlValue);
      const sens = Number(p.rxSensitivityDbm ?? -100);
      const maxR = Math.min(3500, Math.max(800, Number(p.dMaxM ?? 2500)));
      const gridN = 33;
      const coords = Array.from({ length: gridN }, (_, i) => -maxR + (2 * maxR * i) / (gridN - 1));

      // Generate mildly spatially correlated shadowing via 3x3 box smoothing of i.i.d. Gaussian field
      const rawField: number[][] = Array.from({ length: gridN }, () =>
        Array.from({ length: gridN }, () => rng.nextGaussian()),
      );
      const zMatrix: number[][] = [];
      let coveredCount = 0;
      let totalInCircle = 0;
      let minPr = Infinity;
      let maxPr = -Infinity;

      for (let iy = 0; iy < gridN; iy++) {
        const row: number[] = [];
        for (let ix = 0; ix < gridN; ix++) {
          // 3x3 local average with variance-preserving scaling
          let acc = 0;
          let cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = iy + dy;
              const nx = ix + dx;
              if (ny >= 0 && ny < gridN && nx >= 0 && nx < gridN) {
                acc += rawField[ny][nx];
                cnt++;
              }
            }
          }
          const shadowDb = (acc / Math.sqrt(cnt)) * sigma;
          const d = Math.max(50, Math.hypot(coords[ix], coords[iy]));
          const pr = meanRxPowerDbm(d, p, fLow, nExp) + shadowDb;
          row.push(Number(pr.toFixed(2)));
          if (d <= maxR) {
            totalInCircle++;
            if (pr >= sens) coveredCount++;
            if (pr < minPr) minPr = pr;
            if (pr > maxPr) maxPr = pr;
          }
        }
        zMatrix.push(row);
      }

      const covPct = (coveredCount / Math.max(totalInCircle, 1)) * 100;
      const fspl1km = fsplDb(1000, fLow);

      return {
        moduleId,
        title: '2D Spatial Log-Normal Shadowing & Cell Coverage Field',
        description: `Real-time 2D received power map P_r(x, y) around a base station at (0, 0) for f = ${fLow} MHz, n = ${nExp}, σ = ${sigma.toFixed(1)} dB. White dashed contour marks receiver sensitivity (${sens} dBm).`,
        controlLabel: 'Shadowing Std Dev (σ)',
        controlMin: 1,
        controlMax: 14,
        controlStep: 0.5,
        controlUnit: 'dB',
        controlValue: sigma,
        metrics: [
          { label: 'Area Coverage', value: covPct.toFixed(1), unit: '%', note: `P_r ≥ ${sens} dBm` },
          { label: 'Area Outage', value: (100 - covPct).toFixed(1), unit: '%' },
          { label: 'FSPL @ 1 km', value: fspl1km.toFixed(2), unit: 'dB' },
          { label: 'Dynamic Range', value: `${minPr.toFixed(0)}..${maxPr.toFixed(0)}`, unit: 'dBm' },
        ],
        panels: [
          {
            id: 'sl_m1_map',
            title: `2D Received Power Map (dBm) — ${fLow} MHz, σ = ${sigma.toFixed(1)} dB`,
            shortTitle: '2D Coverage Map',
            traces: [
              {
                type: 'heatmap',
                x: coords,
                y: coords,
                z: zMatrix,
                colorscale: 'Viridis',
                colorbar: { title: { text: 'P_r (dBm)' } },
                hovertemplate: 'x=%{x:.0f} m<br>y=%{y:.0f} m<br>P_r=%{z:.1f} dBm<extra></extra>',
              } as Plotly.Data,
              {
                type: 'contour',
                x: coords,
                y: coords,
                z: zMatrix,
                contours: {
                  coloring: 'none',
                  start: sens,
                  end: sens,
                  size: 1,
                  showlabels: true,
                },
                line: { color: '#ffffff', width: 2.5, dash: 'dash' },
                showscale: false,
                name: `Sensitivity (${sens} dBm)`,
              } as Plotly.Data,
            ],
            layout: {
              xaxis: { title: { text: 'East-West Distance x (m)' } },
              yaxis: { title: { text: 'North-South Distance y (m)' }, scaleanchor: 'x' },
              height: 440,
            },
            keyFindings: [
              `Correlated log-normal shadowing (σ=${sigma.toFixed(1)} dB) produces isolated coverage islands and deep outage pockets even inside the nominal cell radius.`,
            ],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 2: Multi-Branch Instantaneous Fading Trace & Phasor Combining
    // =========================================================================
    case 'module2': {
      const L = Math.max(2, Math.min(8, Number(params.diversityOrder ?? 4)));
      const avgSnrDb = controlValue;
      const avgSnrLin = dbToLin(avgSnrDb);
      const thDb = Number(params.outageThresholdDb ?? 5);
      const nSnapshots = 80;

      const idxAxis = Array.from({ length: nSnapshots }, (_, i) => i + 1);
      const noDivDb: number[] = [];
      const scDb: number[] = [];
      const egcDb: number[] = [];
      const mrcDb: number[] = [];
      let outNoDiv = 0;
      let outSc = 0;
      let outMrc = 0;

      // Capture branch phasors from snapshot #0 for polar/phasor visualization
      const rawRe: number[] = [];
      const rawIm: number[] = [];
      const coPhasedMag: number[] = [];

      for (let t = 0; t < nSnapshots; t++) {
        let sumPower = 0;
        let sumAmp = 0;
        let maxPower = 0;
        let b0Power = 0;
        for (let l = 0; l < L; l++) {
          const hr = rng.nextGaussian() * Math.SQRT1_2;
          const hi = rng.nextGaussian() * Math.SQRT1_2;
          const pwr = hr * hr + hi * hi;
          if (l === 0) b0Power = pwr;
          sumPower += pwr;
          sumAmp += Math.sqrt(pwr);
          if (pwr > maxPower) maxPower = pwr;
          if (t === 0) {
            rawRe.push(hr);
            rawIm.push(hi);
            coPhasedMag.push(Math.sqrt(pwr));
          }
        }
        const gNoDiv = linToDb(Math.max(avgSnrLin * b0Power, 1e-6));
        const gSc = linToDb(Math.max(avgSnrLin * maxPower, 1e-6));
        const gEgc = linToDb(Math.max((avgSnrLin * sumAmp * sumAmp) / L, 1e-6));
        const gMrc = linToDb(Math.max(avgSnrLin * sumPower, 1e-6));

        noDivDb.push(Number(gNoDiv.toFixed(2)));
        scDb.push(Number(gSc.toFixed(2)));
        egcDb.push(Number(gEgc.toFixed(2)));
        mrcDb.push(Number(gMrc.toFixed(2)));

        if (gNoDiv < thDb) outNoDiv++;
        if (gSc < thDb) outSc++;
        if (gMrc < thDb) outMrc++;
      }

      const meanMrc = mrcDb.reduce((a, b) => a + b, 0) / nSnapshots;
      const minNoDiv = Math.min(...noDivDb);
      const minMrc = Math.min(...mrcDb);

      const phasorTraces: Plotly.Data[] = [];
      for (let l = 0; l < L; l++) {
        phasorTraces.push({
          type: 'scatter',
          mode: 'lines+markers',
          x: [0, rawRe[l]],
          y: [0, rawIm[l]],
          name: `Branch ${l + 1} (|h|=${coPhasedMag[l].toFixed(2)})`,
          line: { width: 2.5 },
          marker: { size: [4, 9] },
        });
      }
      // Co-phased coherent sum vector along real axis
      const coherentSum = coPhasedMag.reduce((a, b) => a + b, 0);
      phasorTraces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: [0, coherentSum],
        y: [0, 0],
        name: `Co-phased Sum (${coherentSum.toFixed(2)})`,
        line: { color: '#059669', width: 3.5, dash: 'dash' },
        marker: { size: [4, 11], symbol: 'diamond' },
      });

      return {
        moduleId,
        title: `Live ${L}-Branch Rayleigh Fading Trace & Co-Phased Branch Vectors`,
        description: `80 independent Rayleigh fading realizations at average branch SNR = ${avgSnrDb.toFixed(0)} dB. Observe how deep single-branch fades drop below the ${thDb} dB outage threshold while MRC keeps combined SNR smooth and elevated.`,
        controlLabel: 'Average Branch SNR',
        controlMin: 0,
        controlMax: 24,
        controlStep: 2,
        controlUnit: 'dB',
        controlValue: avgSnrDb,
        metrics: [
          { label: 'No-Div Deepest Fade', value: minNoDiv.toFixed(1), unit: 'dB' },
          { label: 'MRC Deepest Fade', value: minMrc.toFixed(1), unit: 'dB', note: `+${(minMrc - minNoDiv).toFixed(1)} dB floor lift` },
          { label: 'Mean MRC SNR', value: meanMrc.toFixed(1), unit: 'dB' },
          { label: 'Outage Events', value: `${outMrc} vs ${outNoDiv}`, note: `MRC vs No-Div (< ${thDb} dB)` },
        ],
        panels: [
          {
            id: 'sl_m2_trace',
            title: `Instantaneous Post-Combining SNR Across 80 Fading Snapshots (L = ${L})`,
            shortTitle: 'Fading Trace',
            traces: [
              { type: 'scatter', mode: 'lines', x: idxAxis, y: noDivDb, name: 'No Diversity (Branch 1)', line: { color: '#94a3b8', width: 1.6 } },
              { type: 'scatter', mode: 'lines', x: idxAxis, y: scDb, name: `SC (L=${L})`, line: { color: '#d97706', width: 2 } },
              { type: 'scatter', mode: 'lines', x: idxAxis, y: egcDb, name: `EGC (L=${L})`, line: { color: '#7c3aed', width: 2 } },
              { type: 'scatter', mode: 'lines', x: idxAxis, y: mrcDb, name: `MRC (L=${L})`, line: { color: '#2563eb', width: 2.5 } },
              {
                type: 'scatter',
                mode: 'lines',
                x: [1, nSnapshots],
                y: [thDb, thDb],
                name: `Outage Threshold (${thDb} dB)`,
                line: { color: '#e11d48', width: 1.8, dash: 'dot' },
              },
            ],
            layout: {
              xaxis: { title: { text: 'Fading Realization Index' } },
              yaxis: { title: { text: 'Instantaneous Combined SNR (dB)' } },
              height: 360,
            },
            keyFindings: [`Across 80 snapshots, MRC suffered ${outMrc} outage events vs ${outSc} for SC and ${outNoDiv} for single-branch reception.`],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m2_phasors',
            title: `Snapshot #1 Complex Channel Phasors h_l vs Co-Phased Sum`,
            shortTitle: 'Branch Phasors',
            traces: phasorTraces,
            layout: {
              xaxis: { title: { text: 'In-Phase Re(h_l)' }, zeroline: true },
              yaxis: { title: { text: 'Quadrature Im(h_l)' }, zeroline: true, scaleanchor: 'x' },
              height: 320,
            },
            keyFindings: ['Co-phasing aligns randomly oriented branch phasors along the positive real axis so amplitudes add constructively.'],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 3: Real-Time OFDM Impulse Response, Frequency Response & IQ Constellation
    // =========================================================================
    case 'module3': {
      const N = Number(params.nSubcarriers ?? 64);
      const L = Math.max(2, Number(params.channelTaps ?? 9));
      const cpSuff = Number(params.cpSufficient ?? 8);
      const decay = Number(params.pdpDecay ?? 3.0);
      const mod = String(params.modulation ?? 'QPSK');
      const ebN0Db = controlValue;
      const bitsPerSym = mod === 'BPSK' ? 1 : mod === '16QAM' ? 4 : 2;
      const snrSymLin = dbToLin(ebN0Db) * bitsPerSym;
      const noiseStd = Math.sqrt(1 / (2 * snrSymLin));

      // Generate multipath channel impulse response h[0..L-1]
      const pdp = new Float64Array(L);
      let pdpSum = 0;
      for (let l = 0; l < L; l++) {
        pdp[l] = Math.exp((-decay * l) / Math.max(1, L - 1));
        pdpSum += pdp[l];
      }
      const hRe = new Float64Array(N);
      const hIm = new Float64Array(N);
      const hMag: number[] = [];
      for (let l = 0; l < L; l++) {
        const s = Math.sqrt(pdp[l] / (2 * pdpSum));
        hRe[l] = rng.nextGaussian() * s;
        hIm[l] = rng.nextGaussian() * s;
        hMag.push(Math.hypot(hRe[l], hIm[l]));
      }

      // Compute frequency response H[k] = unnormalized FFT(h)
      const Hre = new Float64Array(hRe);
      const Him = new Float64Array(hIm);
      fftUnitaryInPlace(Hre, Him, N);
      const scaleSqrtN = Math.sqrt(N);
      const HmagDb: number[] = [];
      for (let k = 0; k < N; k++) {
        Hre[k] *= scaleSqrtN;
        Him[k] *= scaleSqrtN;
        HmagDb.push(Number((20 * Math.log10(Math.max(Math.hypot(Hre[k], Him[k]), 1e-4))).toFixed(2)));
      }

      // Helper: transmit 6 consecutive OFDM symbols with linear convolution & collect equalized IQ points
      const runBurst = (cpLen: number) => {
        const rxI: number[] = [];
        const rxQ: number[] = [];
        let errSq = 0;
        let refSq = 0;
        const nSyms = 6;
        const prevTailRe = new Float64Array(L - 1);
        const prevTailIm = new Float64Array(L - 1);

        const qamLevels = [-3, -1, 1, 3];
        const qamNorm = 1 / Math.sqrt(10);

        for (let s = 0; s < nSyms; s++) {
          const xFreqRe = new Float64Array(N);
          const xFreqIm = new Float64Array(N);
          const refRe = new Float64Array(N);
          const refIm = new Float64Array(N);

          for (let k = 0; k < N; k++) {
            if (mod === 'BPSK') {
              refRe[k] = rng.next() < 0.5 ? -1 : 1;
              refIm[k] = 0;
            } else if (mod === '16QAM') {
              refRe[k] = qamLevels[Math.floor(rng.next() * 4)] * qamNorm;
              refIm[k] = qamLevels[Math.floor(rng.next() * 4)] * qamNorm;
            } else {
              refRe[k] = (rng.next() < 0.5 ? -1 : 1) * Math.SQRT1_2;
              refIm[k] = (rng.next() < 0.5 ? -1 : 1) * Math.SQRT1_2;
            }
            xFreqRe[k] = refRe[k];
            xFreqIm[k] = refIm[k];
          }

          ifftUnitaryInPlace(xFreqRe, xFreqIm, N);
          const txLen = N + cpLen;
          const txRe = new Float64Array(txLen);
          const txIm = new Float64Array(txLen);
          for (let i = 0; i < cpLen; i++) {
            txRe[i] = xFreqRe[N - cpLen + i];
            txIm[i] = xFreqIm[N - cpLen + i];
          }
          for (let i = 0; i < N; i++) {
            txRe[cpLen + i] = xFreqRe[i];
            txIm[cpLen + i] = xFreqIm[i];
          }

          // Linear convolution with h[0..L-1] + ISI tail from previous OFDM symbol
          const yConvRe = new Float64Array(txLen + L - 1);
          const yConvIm = new Float64Array(txLen + L - 1);
          for (let i = 0; i < txLen; i++) {
            const tr = txRe[i];
            const ti = txIm[i];
            for (let l = 0; l < L; l++) {
              yConvRe[i + l] += tr * hRe[l] - ti * hIm[l];
              yConvIm[i + l] += tr * hIm[l] + ti * hRe[l];
            }
          }
          for (let l = 0; l < L - 1; l++) {
            yConvRe[l] += prevTailRe[l];
            yConvIm[l] += prevTailIm[l];
            prevTailRe[l] = yConvRe[txLen + l];
            prevTailIm[l] = yConvIm[txLen + l];
          }

          const yRxRe = new Float64Array(N);
          const yRxIm = new Float64Array(N);
          for (let i = 0; i < N; i++) {
            yRxRe[i] = yConvRe[cpLen + i] + rng.nextGaussian() * noiseStd;
            yRxIm[i] = yConvIm[cpLen + i] + rng.nextGaussian() * noiseStd;
          }
          fftUnitaryInPlace(yRxRe, yRxIm, N);

          // Skip symbol 0 so steady-state ISI from previous symbol is active
          if (s >= 1) {
            for (let k = 0; k < N; k++) {
              // MMSE equalization for clean constellation display
              const h2 = Hre[k] * Hre[k] + Him[k] * Him[k];
              const denom = h2 + 1 / snrSymLin;
              const eqRe = (yRxRe[k] * Hre[k] + yRxIm[k] * Him[k]) / denom;
              const eqIm = (yRxIm[k] * Hre[k] - yRxRe[k] * Him[k]) / denom;
              rxI.push(Number(eqRe.toFixed(3)));
              rxQ.push(Number(eqIm.toFixed(3)));
              const eI = eqRe - refRe[k];
              const eQ = eqIm - refIm[k];
              errSq += eI * eI + eQ * eQ;
              refSq += refRe[k] * refRe[k] + refIm[k] * refIm[k];
            }
          }
        }
        const evmPct = Math.sqrt(errSq / Math.max(refSq, 1e-12)) * 100;
        return { rxI, rxQ, evmPct };
      };

      const withCp = runBurst(cpSuff);
      const noCp = runBurst(0);
      const fadeDepthDb = Math.max(...HmagDb) - Math.min(...HmagDb);

      return {
        moduleId,
        title: `Live OFDM Multipath Channel & Equalized ${mod} Constellation`,
        description: `Single ${L}-tap Rayleigh channel realization (N = ${N} subcarriers, E_b/N_0 = ${ebN0Db} dB). Compare the crisp equalized IQ constellation with CP = ${cpSuff} against the ISI/ICI-corrupted No-CP constellation.`,
        controlLabel: 'Operating E_b/N_0',
        controlMin: 4,
        controlMax: 28,
        controlStep: 2,
        controlUnit: 'dB',
        controlValue: ebN0Db,
        metrics: [
          { label: `EVM (CP=${cpSuff})`, value: withCp.evmPct.toFixed(1), unit: '%', note: 'ISI-free MMSE EQ' },
          { label: 'EVM (No CP)', value: noCp.evmPct.toFixed(1), unit: '%', note: `+${(noCp.evmPct - withCp.evmPct).toFixed(1)}% ISI distortion` },
          { label: 'Freq. Fade Depth', value: fadeDepthDb.toFixed(1), unit: 'dB' },
          { label: 'CP Condition', value: cpSuff >= L - 1 ? 'N_cp ≥ L-1' : 'N_cp < L-1', note: `CP=${cpSuff}, L=${L}` },
        ],
        panels: [
          {
            id: 'sl_m3_const',
            title: `Equalized ${mod} IQ Constellation: Sufficient CP (${cpSuff}) vs No CP (0)`,
            shortTitle: 'IQ Constellation',
            traces: [
              {
                type: 'scatter',
                mode: 'markers',
                x: noCp.rxI,
                y: noCp.rxQ,
                name: `No CP (EVM ${noCp.evmPct.toFixed(1)}%)`,
                marker: { color: '#e11d48', size: 5.5, opacity: 0.55 },
              },
              {
                type: 'scatter',
                mode: 'markers',
                x: withCp.rxI,
                y: withCp.rxQ,
                name: `CP = ${cpSuff} (EVM ${withCp.evmPct.toFixed(1)}%)`,
                marker: { color: '#2563eb', size: 6, opacity: 0.85 },
              },
            ],
            layout: {
              xaxis: {
                title: { text: 'In-Phase (I)' },
                range: [-1.8, 1.8],
                constrain: 'domain',
                zeroline: true,
              },
              yaxis: {
                title: { text: 'Quadrature (Q)' },
                range: [-1.8, 1.8],
                scaleanchor: 'x',
                scaleratio: 1,
                constrain: 'domain',
                zeroline: true,
              },
              height: 360,
            },
            keyFindings: [
              `Adding CP = ${cpSuff} samples cuts equalized RMS EVM from ${noCp.evmPct.toFixed(1)}% down to ${withCp.evmPct.toFixed(1)}% on this ${L}-tap channel.`,
            ],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m3_channel',
            title: `Channel Frequency Response |H[k]| (dB) & Impulse Response |h[n]|`,
            shortTitle: 'Channel H[k] & h[n]',
            traces: [
              {
                type: 'scatter',
                mode: 'lines+markers',
                x: Array.from({ length: N }, (_, k) => k),
                y: HmagDb,
                name: '|H[k]| (dB)',
                line: { color: '#0f766e', width: 2 },
                marker: { size: 4 },
              },
              {
                type: 'bar',
                x: Array.from({ length: L }, (_, l) => l),
                y: hMag.map((v) => Number((20 * Math.log10(Math.max(v, 1e-3))).toFixed(2))),
                name: 'Tap Gain |h[n]| (dB)',
                marker: { color: '#d97706', opacity: 0.75 },
              },
            ],
            layout: {
              xaxis: { title: { text: 'Subcarrier Index k / Delay Tap Index n' } },
              yaxis: { title: { text: 'Magnitude (dB)' } },
              height: 320,
            },
            keyFindings: [`Peak-to-null frequency selectivity spans ${fadeDepthDb.toFixed(1)} dB across the ${N} OFDM subcarriers.`],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 4: DSSS Spectrum Spreading / Jammer Suppression & Correlator Output
    // =========================================================================
    case 'module4': {
      const sf = Math.max(7, Number(params.sf ?? 31));
      const ebN0Db = Number(params.fixedEbN0Db ?? 8);
      const jsDb = controlValue;
      const fj = Number(params.jammerFreqNorm ?? 0.13);
      const fftN = 256;

      // Build 256 chip samples: spread BPSK + narrowband tone jammer + AWGN
      const txRe = new Float64Array(fftN);
      const txIm = new Float64Array(fftN);
      const rxRe = new Float64Array(fftN);
      const rxIm = new Float64Array(fftN);
      const despreadRe = new Float64Array(fftN);
      const despreadIm = new Float64Array(fftN);

      const jsLin = dbToLin(jsDb);
      const jamAmp = Math.sqrt(2 * jsLin); // average power = jsLin per chip-normalized signal
      const noiseStd = Math.sqrt(sf / (2 * dbToLin(ebN0Db)));
      const phi = rng.next() * 2 * Math.PI;

      const pnChips = new Float64Array(fftN);
      for (let i = 0; i < fftN; i++) {
        pnChips[i] = rng.next() < 0.5 ? -1 : 1;
        const bit = Math.floor(i / sf) % 2 === 0 ? 1 : -1;
        const sig = bit * pnChips[i];
        const jam = jamAmp * Math.cos(2 * Math.PI * fj * i + phi);
        const rx = sig + jam + rng.nextGaussian() * noiseStd * 0.25;
        txRe[i] = sig;
        rxRe[i] = rx;
        despreadRe[i] = rx * pnChips[i];
      }

      const toPsdDb = (reIn: Float64Array, imIn: Float64Array) => {
        const re = new Float64Array(reIn);
        const im = new Float64Array(imIn);
        fftUnitaryInPlace(re, im, fftN);
        const half = fftN / 2;
        const freqs: number[] = [];
        const psd: number[] = [];
        for (let k = 0; k < half; k++) {
          freqs.push(Number((k / fftN).toFixed(4)));
          const p = re[k] * re[k] + im[k] * im[k];
          psd.push(Number((10 * Math.log10(Math.max(p, 1e-6))).toFixed(2)));
        }
        return { freqs, psd };
      };

      const psdRx = toPsdDb(rxRe, rxIm);
      const psdDesp = toPsdDb(despreadRe, despreadIm);
      const gpDb = 10 * Math.log10(sf);

      // Correlator decision statistics for 240 bits (+1 vs -1)
      const corrPos: number[] = [];
      const corrNeg: number[] = [];
      const chipNoiseStd = Math.sqrt(1 / (2 * dbToLin(ebN0Db)));
      const chipJamAmp = Math.sqrt((2 * jsLin) / sf);
      for (let b = 0; b < 240; b++) {
        const bit = b < 120 ? 1 : -1;
        const p0 = rng.next() * 2 * Math.PI;
        let acc = 0;
        for (let c = 0; c < sf; c++) {
          const pn = rng.next() < 0.5 ? -1 : 1;
          const r = (bit * pn) / Math.sqrt(sf) + chipJamAmp * Math.cos(2 * Math.PI * fj * c + p0) + rng.nextGaussian() * chipNoiseStd;
          acc += r * pn / Math.sqrt(sf);
        }
        if (bit > 0) corrPos.push(Number(acc.toFixed(3)));
        else corrNeg.push(Number(acc.toFixed(3)));
      }
      const effSinrDb = linToDb(1 / (1 / dbToLin(ebN0Db) + jsLin / sf));

      return {
        moduleId,
        title: `DSSS Spectral Despreading & Correlator Decision Separation (SF = ${sf})`,
        description: `At J/S = ${jsDb.toFixed(1)} dB, the narrowband jammer at f_j = ${fj} cycles/chip dominates the received RF spectrum, yet multiplying by the PN code spreads the jammer flat across the band while collapsing the desired signal back to baseband.`,
        controlLabel: 'Jammer-to-Signal Ratio (J/S)',
        controlMin: -5,
        controlMax: 22,
        controlStep: 1,
        controlUnit: 'dB',
        controlValue: jsDb,
        metrics: [
          { label: 'Processing Gain G_p', value: gpDb.toFixed(2), unit: 'dB', note: `10 log₁₀(${sf})` },
          { label: 'Post-Despread SINR', value: effSinrDb.toFixed(2), unit: 'dB' },
          { label: 'Jammer Peak Bin', value: `${Math.max(...psdRx.psd).toFixed(1)}`, unit: 'dB' },
          { label: 'Despread Floor', value: `${(psdDesp.psd.reduce((a, b) => a + b, 0) / psdDesp.psd.length).toFixed(1)}`, unit: 'dB' },
        ],
        panels: [
          {
            id: 'sl_m4_psd',
            title: `Received Spectrum (Spread Signal + Tone Jammer) vs Post-Despread Spectrum`,
            shortTitle: 'Spectrum (PSD)',
            traces: [
              { type: 'scatter', mode: 'lines', x: psdRx.freqs, y: psdRx.psd, name: 'Received (DSSS + Narrowband Jammer)', line: { color: '#e11d48', width: 1.8 } },
              { type: 'scatter', mode: 'lines', x: psdDesp.freqs, y: psdDesp.psd, name: 'After PN Despreading (Jammer Smeared)', line: { color: '#2563eb', width: 2 } },
            ],
            layout: {
              xaxis: { title: { text: 'Normalized Frequency (cycles / chip)' } },
              yaxis: { title: { text: 'Spectral Power (dB)' } },
              height: 340,
            },
            keyFindings: [`PN despreading smears the narrowband tone at f_j=${fj} while providing ${gpDb.toFixed(2)} dB processing gain.`],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m4_hist',
            title: 'Despread Correlator Decision Statistic Distribution (Bit +1 vs Bit -1)',
            shortTitle: 'Correlator Eye',
            traces: [
              { type: 'histogram', x: corrNeg, name: 'Sent Bit -1', opacity: 0.65, marker: { color: '#e11d48' }, nbinsx: 24 } as Plotly.Data,
              { type: 'histogram', x: corrPos, name: 'Sent Bit +1', opacity: 0.65, marker: { color: '#2563eb' }, nbinsx: 24 } as Plotly.Data,
            ],
            layout: {
              barmode: 'overlay',
              xaxis: { title: { text: 'Correlator Soft Decision Output' }, zeroline: true },
              yaxis: { title: { text: 'Bit Count' } },
              height: 300,
            },
            keyFindings: ['Clean separation across the 0 decision boundary persists until J/S approaches Processing Gain G_p.'],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 5: CDMA Multiuser Received Power & Near-Far Decision Collapse
    // =========================================================================
    case 'module5': {
      const sf = Math.max(7, Number(params.sf ?? 31));
      const K = Math.max(2, Math.min(24, Number(params.numUsersK ?? 8)));
      const ebN0Db = Number(params.ebN0Db ?? 8);
      const nfrDb = controlValue;
      const sigmaPc = Number(params.pcErrorSigmaDb ?? 1.5);
      const pRatio = dbToLin(nfrDb);
      const noiseStd = Math.sqrt(1 / (2 * dbToLin(ebN0Db)));

      const userLabels = Array.from({ length: K }, (_, i) => (i === 0 ? 'Desired U1' : `Interf U${i + 1}`));
      const pNoPcDb = userLabels.map((_, i) => (i === 0 ? 0 : nfrDb));
      const pIdealDb = userLabels.map(() => 0);
      const pImperfDb = userLabels.map(() => Number((rng.nextGaussian() * sigmaPc).toFixed(2)));

      const simDecision = (mode: 'nopc' | 'ideal') => {
        const vals: number[] = [];
        for (let b = 0; b < 200; b++) {
          const b0 = 1; // Condition on bit +1 to observe MAI spread directly
          let mai = 0;
          for (let u = 1; u < K; u++) {
            const bu = rng.next() < 0.5 ? -1 : 1;
            const amp = mode === 'ideal' ? 1 : Math.sqrt(pRatio);
            // Random cross-correlation rho ~ N(0, 1/SF)
            const rho = rng.nextGaussian() / Math.sqrt(sf);
            mai += bu * amp * rho;
          }
          vals.push(Number((b0 + mai + rng.nextGaussian() * noiseStd).toFixed(3)));
        }
        return vals;
      };

      const dNoPc = simDecision('nopc');
      const dIdeal = simDecision('ideal');
      const errsNoPc = dNoPc.filter((v) => v < 0).length;
      const errsIdeal = dIdeal.filter((v) => v < 0).length;
      const sirNoPcDb = linToDb(sf / ((K - 1) * pRatio));
      const sirIdealDb = linToDb(sf / (K - 1));

      return {
        moduleId,
        title: `CDMA Uplink Power Profile & Matched-Filter MAI Collapse (K = ${K}, SF = ${sf})`,
        description: `Visualizes received uplink powers at the base station and the desired user's matched-filter output conditioned on Bit = +1 (errors occur whenever output crosses below 0).`,
        controlLabel: 'Near-Far Ratio (P_near / P_far)',
        controlMin: 0,
        controlMax: 24,
        controlStep: 2,
        controlUnit: 'dB',
        controlValue: nfrDb,
        metrics: [
          { label: 'SIR (No PC)', value: sirNoPcDb.toFixed(1), unit: 'dB', note: `${errsNoPc}/200 bit errors` },
          { label: 'SIR (Ideal PC)', value: sirIdealDb.toFixed(1), unit: 'dB', note: `${errsIdeal}/200 bit errors` },
          { label: 'SIR Restored', value: `+${(sirIdealDb - sirNoPcDb).toFixed(1)}`, unit: 'dB' },
          { label: 'Active Users K', value: `${K}`, note: `SF = ${sf}` },
        ],
        panels: [
          {
            id: 'sl_m5_power',
            title: 'Received Uplink Power Profile at Base Station (Relative to Desired User)',
            shortTitle: 'Rx Power Profile',
            traces: [
              { type: 'bar', x: userLabels, y: pNoPcDb, name: `No Power Control (NFR=${nfrDb} dB)`, marker: { color: '#e11d48' } },
              { type: 'bar', x: userLabels, y: pImperfDb, name: `Imperfect PC (σ=${sigmaPc} dB)`, marker: { color: '#d97706' } },
              { type: 'bar', x: userLabels, y: pIdealDb, name: 'Ideal Power Control (0 dB)', marker: { color: '#2563eb' } },
            ],
            layout: {
              barmode: 'group',
              xaxis: { title: { text: 'Active Uplink Users' } },
              yaxis: { title: { text: 'Received Power Relative to Target (dB)' } },
              height: 310,
            },
            keyFindings: ['Without power control, nearby interferers overpower the desired cell-edge user by the full Near-Far Ratio.'],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m5_mai',
            title: 'Matched-Filter Output for Bit = +1 (Values < 0 Cause Bit Errors)',
            shortTitle: 'MAI Distribution',
            traces: [
              { type: 'histogram', x: dNoPc, name: `No PC (${errsNoPc}/200 errors)`, opacity: 0.6, marker: { color: '#e11d48' }, nbinsx: 26 } as Plotly.Data,
              { type: 'histogram', x: dIdeal, name: `Ideal PC (${errsIdeal}/200 errors)`, opacity: 0.7, marker: { color: '#2563eb' }, nbinsx: 22 } as Plotly.Data,
            ],
            layout: {
              barmode: 'overlay',
              xaxis: { title: { text: 'Correlator Decision Statistic (Target = +1.0)' }, zeroline: true },
              yaxis: { title: { text: 'Sample Count' } },
              height: 310,
            },
            keyFindings: [`Ideal power control collapses the MAI variance by ${nfrDb} dB, dropping snapshot errors from ${errsNoPc}/200 to ${errsIdeal}/200.`],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 6: Interactive 2D Hexagonal Cellular Cluster & 300-UE SIR Spatial Map
    // =========================================================================
    case 'module6': {
      const validN: ClusterSize[] = [1, 3, 4, 7, 9, 12];
      const nearestN = validN.reduce((best, cand) =>
        Math.abs(cand - controlValue) < Math.abs(best - controlValue) ? cand : best,
      );
      const R = Number(params.cellRadiusM ?? 1000);
      const nExp = Number(params.pathLossExp ?? 3.5);
      const secondTier = Boolean(params.includeSecondTier);
      const centers = getCoChannelCenters(R, nearestN, secondTier);
      const D = reuseDistanceM(R, nearestN);

      const hexPolygon = (cx: number, cy: number) => {
        const xs: number[] = [];
        const ys: number[] = [];
        for (let k = 0; k <= 6; k++) {
          const ang = (Math.PI / 3) * k + Math.PI / 6;
          xs.push(cx + R * Math.cos(ang));
          ys.push(cy + R * Math.sin(ang));
        }
        return { xs, ys };
      };

      const servingHex = hexPolygon(0, 0);
      const interfererX: number[] = [];
      const interfererY: number[] = [];
      for (const c of centers) {
        const h = hexPolygon(c.x, c.y);
        interfererX.push(...h.xs, Number.NaN);
        interfererY.push(...h.ys, Number.NaN);
      }

      // Drop 280 uniform random UEs inside serving hexagon and compute exact SIR (dB)
      const ueX: number[] = [];
      const ueY: number[] = [];
      const ueSir: number[] = [];
      const targetSir = Number(params.targetSirDb ?? 12);
      let outCount = 0;

      while (ueX.length < 280) {
        const x = (rng.next() * 2 - 1) * R;
        const y = (rng.next() * 2 - 1) * R;
        if (Math.abs(x) <= (Math.sqrt(3) / 2) * R && Math.abs(y) + Math.abs(x) / Math.sqrt(3) <= R) {
          const d0 = Math.max(0.05 * R, Math.hypot(x, y));
          const sig = Math.pow(d0, -nExp);
          let interf = 0;
          for (const c of centers) {
            const dk = Math.max(0.05 * R, Math.hypot(x - c.x, y - c.y));
            interf += Math.pow(dk, -nExp);
          }
          const sirDb = linToDb(sig / interf);
          ueX.push(Number(x.toFixed(1)));
          ueY.push(Number(y.toFixed(1)));
          ueSir.push(Number(sirDb.toFixed(2)));
          if (sirDb < targetSir) outCount++;
        }
      }

      const meanSir = ueSir.reduce((a, b) => a + b, 0) / ueSir.length;
      const minSir = Math.min(...ueSir);

      return {
        moduleId,
        title: `Interactive Hexagonal Reuse Geometry (Cluster N = ${nearestN}, D = ${(D / 1000).toFixed(2)} km)`,
        description: `Exact hexagonal lattice showing the serving cell at (0, 0), ${centers.length} co-channel interferer cells, reuse vector D = R√(3N), and 280 mobile terminals colored by instantaneous SIR (dB).`,
        controlLabel: 'Cluster Size N (snaps to 1,3,4,7,9,12)',
        controlMin: 1,
        controlMax: 12,
        controlStep: 1,
        controlUnit: 'cells',
        controlValue: nearestN,
        metrics: [
          { label: 'Reuse Factor Q', value: Math.sqrt(3 * nearestN).toFixed(2), note: 'Q = D / R = √(3N)' },
          { label: 'Reuse Distance D', value: (D / 1000).toFixed(2), unit: 'km' },
          { label: 'Mean UE SIR', value: meanSir.toFixed(1), unit: 'dB', note: `Min edge ${minSir.toFixed(1)} dB` },
          { label: `SIR < ${targetSir} dB`, value: `${((outCount / ueX.length) * 100).toFixed(1)}`, unit: '%' },
        ],
        panels: [
          {
            id: 'sl_m6_hex',
            title: `2D Co-Channel Cluster Lattice & Mobile SIR Distribution (N = ${nearestN}, n = ${nExp})`,
            shortTitle: 'Hexagonal Cluster Map',
            traces: [
              {
                type: 'scatter',
                mode: 'lines',
                x: interfererX,
                y: interfererY,
                name: `Co-Channel Cells (${centers.length})`,
                line: { color: '#e11d48', width: 1.6 },
              },
              {
                type: 'scatter',
                mode: 'lines',
                x: servingHex.xs,
                y: servingHex.ys,
                name: 'Serving Cell (BS at 0,0)',
                line: { color: '#059669', width: 2.8 },
              },
              {
                type: 'scatter',
                mode: 'markers',
                x: ueX,
                y: ueY,
                name: 'Mobile Users (SIR dB)',
                marker: {
                  size: 6,
                  color: ueSir,
                  colorscale: [
                    [0, '#dc2626'],
                    [0.45, '#f59e0b'],
                    [1, '#16a34a'],
                  ],
                  colorbar: { title: { text: 'SIR (dB)' } },
                  cmin: 0,
                  cmax: 35,
                },
                hovertemplate: 'x=%{x:.0f} m<br>y=%{y:.0f} m<br>SIR=%{marker.color:.1f} dB<extra></extra>',
              },
              {
                type: 'scatter',
                mode: 'lines+markers',
                x: [0, centers[0].x],
                y: [0, centers[0].y],
                name: `Reuse Distance D = ${(D / 1000).toFixed(2)} km`,
                line: { color: '#1d4ed8', width: 2, dash: 'dash' },
                marker: { size: 9, symbol: 'triangle-up', color: '#1d4ed8' },
              },
            ],
            layout: {
              xaxis: { title: { text: 'East-West Coordinate (m)' } },
              yaxis: { title: { text: 'North-South Coordinate (m)' }, scaleanchor: 'x' },
              height: 450,
            },
            keyFindings: [
              `Increasing cluster size N moves co-channel interferers outward as √(3N), rapidly eliminating red low-SIR pockets along the serving cell boundary.`,
            ],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 7: MIMO Channel Eigenmodes (SVD) & Optimal Water-Filling Power Allocation
    // =========================================================================
    case 'module7': {
      const snrDb = controlValue;
      const snrLin = dbToLin(snrDb);
      const rhoTx = Number(params.corrTx ?? 0.5);
      const rhoRx = Number(params.corrRx ?? 0.5);
      const nt = 4;
      const nr = 4;

      const makeH = (rTx: number, rRx: number) => {
        const W = matCreate(nr, nt);
        for (let i = 0; i < W.re.length; i++) {
          W.re[i] = rng.nextGaussian() * Math.SQRT1_2;
          W.im[i] = rng.nextGaussian() * Math.SQRT1_2;
        }
        if (rTx <= 0 && rRx <= 0) return W;
        const Lrx = matCholesky(matExponentialCorrelation(nr, rRx));
        const Ltx = matCholesky(matExponentialCorrelation(nt, rTx));
        // Ltx^T is real symmetric-ish lower->upper
        const LtxH = matCreate(nt, nt);
        for (let r = 0; r < nt; r++) {
          for (let c = 0; c < nt; c++) {
            LtxH.re[r * nt + c] = Ltx.re[c * nt + r];
          }
        }
        return matMul(matMul(Lrx, W), LtxH);
      };

      const Hiid = makeH(0, 0);
      const Hcorr = makeH(rhoTx, rhoRx);
      const gramIid = matMulSelfConjTranspose(Hiid);
      const gramCorr = matMulSelfConjTranspose(Hcorr);

      const eigsIid = hermitianEigenvalues(gramIid.re, gramIid.im, nr);
      const eigsCorr = hermitianEigenvalues(gramCorr.re, gramCorr.im, nr);

      const wfIid = solveWaterFilling(eigsIid, snrLin);
      const wfCorr = solveWaterFilling(eigsCorr, snrLin);

      const condIid = Math.sqrt(eigsIid[0] / Math.max(eigsIid[nr - 1], 1e-9));
      const condCorr = Math.sqrt(eigsCorr[0] / Math.max(eigsCorr[nr - 1], 1e-9));
      const modes = Array.from({ length: nr }, (_, i) => `Eigenmode λ_${i + 1}`);

      return {
        moduleId,
        title: `4×4 MIMO Channel Eigenmodes (SVD) & Optimal Water-Filling (SNR = ${snrDb} dB)`,
        description: `Exact Hermitian eigenvalue decomposition of H·Hᴴ comparing i.i.d. Rayleigh vs Kronecker correlated antennas (ρ_tx=${rhoTx}, ρ_rx=${rhoRx}), alongside CSIT Water-Filling vs Equal-Power stream allocation.`,
        controlLabel: 'Total Transmit SNR (ρ)',
        controlMin: 0,
        controlMax: 30,
        controlStep: 2,
        controlUnit: 'dB',
        controlValue: snrDb,
        metrics: [
          { label: 'i.i.d. Equal-Power C', value: wfIid.capacityEq.toFixed(2), unit: 'bps/Hz' },
          { label: 'i.i.d. Water-Filling C', value: wfIid.capacityWf.toFixed(2), unit: 'bps/Hz', note: `+${(wfIid.capacityWf - wfIid.capacityEq).toFixed(2)} CSIT gain` },
          { label: 'Correlated WF C', value: wfCorr.capacityWf.toFixed(2), unit: 'bps/Hz', note: `ρ=(${rhoTx},${rhoRx})` },
          { label: 'Condition # κ(H)', value: `${condIid.toFixed(1)} vs ${condCorr.toFixed(1)}`, note: 'i.i.d. vs Correlated' },
        ],
        panels: [
          {
            id: 'sl_m7_eigs',
            title: 'Ordered Spatial Eigenmode Gains λ_i = σ_i² (dB): i.i.d. vs Correlated',
            shortTitle: 'SVD Eigenmodes',
            traces: [
              {
                type: 'bar',
                x: modes,
                y: eigsIid.map((v) => Number(linToDb(Math.max(v, 1e-6)).toFixed(2))),
                name: 'i.i.d. Rayleigh (ρ=0)',
                marker: { color: '#2563eb' },
              },
              {
                type: 'bar',
                x: modes,
                y: eigsCorr.map((v) => Number(linToDb(Math.max(v, 1e-6)).toFixed(2))),
                name: `Correlated (ρ_tx=${rhoTx}, ρ_rx=${rhoRx})`,
                marker: { color: '#e11d48' },
              },
            ],
            layout: {
              barmode: 'group',
              xaxis: { title: { text: 'Parallel Spatial Subchannel' } },
              yaxis: { title: { text: 'Eigenmode Power Gain λ_i (dB)' } },
              height: 310,
            },
            keyFindings: [
              `Spatial correlation concentrates power into λ₁ while collapsing weaker subchannels (κ rises from ${condIid.toFixed(1)} to ${condCorr.toFixed(1)}), eroding multiplexing rank.`,
            ],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m7_wf',
            title: 'Optimal Water-Filling vs Equal-Power Allocation Across Spatial Streams (Linear Power)',
            shortTitle: 'Water-Filling',
            traces: [
              {
                type: 'bar',
                x: modes,
                y: wfIid.powers.map((v) => Number(((v / snrLin) * 100).toFixed(1))),
                name: 'Water-Filling (i.i.d.) %',
                marker: { color: '#059669' },
              },
              {
                type: 'bar',
                x: modes,
                y: wfCorr.powers.map((v) => Number(((v / snrLin) * 100).toFixed(1))),
                name: 'Water-Filling (Correlated) %',
                marker: { color: '#d97706' },
              },
              {
                type: 'scatter',
                mode: 'lines',
                x: modes,
                y: modes.map(() => 25),
                name: 'Equal Power (25% / stream)',
                line: { color: '#475569', width: 2, dash: 'dash' },
              },
            ],
            layout: {
              barmode: 'group',
              xaxis: { title: { text: 'Spatial Subchannel' } },
              yaxis: { title: { text: 'Allocated Transmit Power Share (%)' } },
              height: 310,
            },
            keyFindings: [
              `Water-filling pours more power into strong eigenmodes and shuts off deeply faded subchannels, achieving ${wfIid.capacityWf.toFixed(2)} bps/Hz vs ${wfIid.capacityEq.toFixed(2)} bps/Hz equal-power.`,
            ],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }

    // =========================================================================
    // MODULE 8: Live Multiuser Subcarrier Fading & OFDMA Subcarrier Allocation Map
    // =========================================================================
    case 'module8': {
      const K = Math.max(2, Math.min(8, Number(params.numUsersK ?? 4)));
      const B = Number(params.bandwidthMHz ?? 20);
      const Nsc = Math.min(64, Math.max(16, Number(params.nSubcarriers ?? 64)));
      const Bsc = B / Nsc;
      const meanSnrDb = controlValue;
      const spread = Number(params.snrSpreadDb ?? 22);
      const offsets = getUserSnrOffsetsDb(K, spread);

      // Generate instantaneous subcarrier SNRs gamma_{k,n} and rates R_{k,n}
      const rateGrid: number[][] = [];
      const snrGridDb: number[][] = [];
      for (let u = 0; u < K; u++) {
        const gAvg = dbToLin(meanSnrDb + offsets[u]);
        const rRow: number[] = [];
        const sRow: number[] = [];
        for (let n = 0; n < Nsc; n++) {
          const hr = rng.nextGaussian() * Math.SQRT1_2;
          const hi = rng.nextGaussian() * Math.SQRT1_2;
          const instSnr = gAvg * (hr * hr + hi * hi);
          sRow.push(Number(linToDb(Math.max(instSnr, 1e-4)).toFixed(2)));
          rRow.push(Bsc * Math.log2(1 + instSnr));
        }
        rateGrid.push(rRow);
        snrGridDb.push(sRow);
      }

      // Compute winning user index per subcarrier for Max-Sum-Rate vs PF (weighted by 1/meanRate) vs Max-Min
      const maxRateWinners: number[] = [];
      const pfWinners: number[] = [];
      const maxMinWinners: number[] = [];

      const ratesMax = new Array<number>(K).fill(0);
      const ratesPf = new Array<number>(K).fill(0);
      const ratesMaxMin = new Array<number>(K).fill(0);
      const ratesTdma = new Array<number>(K).fill(0);

      const meanUserRates = rateGrid.map((row) => Math.max(row.reduce((a, b) => a + b, 0) / Nsc, 1e-5));

      for (let n = 0; n < Nsc; n++) {
        let bestMax = 0;
        let bestPf = 0;
        for (let u = 1; u < K; u++) {
          if (rateGrid[u][n] > rateGrid[bestMax][n]) bestMax = u;
          if (rateGrid[u][n] / meanUserRates[u] > rateGrid[bestPf][n] / meanUserRates[bestPf]) {
            bestPf = u;
          }
        }
        maxRateWinners.push(bestMax + 1);
        pfWinners.push(bestPf + 1);
        ratesMax[bestMax] += rateGrid[bestMax][n];
        ratesPf[bestPf] += rateGrid[bestPf][n];

        // Greedy Max-Min: assign subcarrier n to user with lowest accumulated rate so far
        let minU = 0;
        for (let u = 1; u < K; u++) {
          if (ratesMaxMin[u] < ratesMaxMin[minU]) minU = u;
        }
        maxMinWinners.push(minU + 1);
        ratesMaxMin[minU] += rateGrid[minU][n];

        for (let u = 0; u < K; u++) {
          ratesTdma[u] += rateGrid[u][n] / K;
        }
      }

      const jain = (arr: number[]) => {
        const s = arr.reduce((a, b) => a + b, 0);
        const s2 = arr.reduce((a, b) => a + b * b, 0);
        return s2 > 0 ? (s * s) / (arr.length * s2) : 0;
      };

      const sumTdma = ratesTdma.reduce((a, b) => a + b, 0);
      const sumMax = ratesMax.reduce((a, b) => a + b, 0);
      const sumPf = ratesPf.reduce((a, b) => a + b, 0);
      const scAxis = Array.from({ length: Nsc }, (_, i) => i + 1);

      return {
        moduleId,
        title: `Live Multiuser OFDMA Subcarrier Resource Grid (K = ${K} Users, N_sc = ${Nsc})`,
        description: `Single Rayleigh frequency-selective frame at mean SNR = ${meanSnrDb} dB. Compares per-subcarrier winner assignment under Max-Sum-Rate (opportunistic), Proportional Fair (normalized fade peaks), and Max-Min scheduling.`,
        controlLabel: 'Mean Multiuser SNR',
        controlMin: 0,
        controlMax: 26,
        controlStep: 2,
        controlUnit: 'dB',
        controlValue: meanSnrDb,
        metrics: [
          { label: 'TDMA Sum Rate', value: sumTdma.toFixed(1), unit: 'Mbps', note: `Jain ${jain(ratesTdma).toFixed(2)}` },
          { label: 'OFDMA PF Rate', value: sumPf.toFixed(1), unit: 'Mbps', note: `Jain ${jain(ratesPf).toFixed(2)}` },
          { label: 'OFDMA Max-Rate', value: sumMax.toFixed(1), unit: 'Mbps', note: `Jain ${jain(ratesMax).toFixed(2)}` },
          { label: 'Multiuser Gain', value: `+${(((sumPf - sumTdma) / Math.max(sumTdma, 0.1)) * 100).toFixed(0)}`, unit: '%', note: 'PF vs TDMA' },
        ],
        panels: [
          {
            id: 'sl_m8_rb',
            title: 'Subcarrier Assignment Matrix (Color = Assigned User ID 1..K)',
            shortTitle: 'Resource Grid',
            traces: [
              {
                type: 'heatmap',
                x: scAxis,
                y: ['OFDMA Max-Min', 'OFDMA Prop. Fair', 'OFDMA Max-Sum-Rate'],
                z: [maxMinWinners, pfWinners, maxRateWinners],
                colorscale: 'Portland',
                zmin: 1,
                zmax: K,
                colorbar: { title: { text: 'User ID' }, dtick: 1 },
                hovertemplate: 'Subcarrier %{x}<br>%{y}<br>Assigned: User %{z}<extra></extra>',
              } as Plotly.Data,
            ],
            layout: {
              xaxis: { title: { text: 'OFDMA Subcarrier Index n' } },
              yaxis: { title: { text: 'Scheduler Policy' } },
              height: 270,
            },
            keyFindings: [
              `Max-Sum-Rate starves weak cell-edge users (Jain=${jain(ratesMax).toFixed(2)}), whereas Proportional Fair serves all ${K} users on their local frequency peaks (Jain=${jain(ratesPf).toFixed(2)}).`,
            ],
            table: { headers: [], rows: [] },
          },
          {
            id: 'sl_m8_snr',
            title: `Instantaneous Subcarrier SNR Profiles Across All ${K} Users (dB)`,
            shortTitle: 'User Channel Profiles',
            traces: snrGridDb.slice(0, 6).map((row, u) => ({
              type: 'scatter',
              mode: 'lines',
              x: scAxis,
              y: row,
              name: `User ${u + 1} (avg ${(meanSnrDb + offsets[u]).toFixed(0)} dB)`,
              line: { width: 1.8 },
            })),
            layout: {
              xaxis: { title: { text: 'OFDMA Subcarrier Index n' } },
              yaxis: { title: { text: 'Instantaneous SNR (dB)' } },
              height: 310,
            },
            keyFindings: ['Independent fading across users ensures that almost every subcarrier has at least one user experiencing a constructive fade peak.'],
            table: { headers: [], rows: [] },
          },
        ],
      };
    }
  }
}
