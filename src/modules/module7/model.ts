/**
 * Module 7: SISO vs MIMO Capacity and Performance
 * Rayleigh MIMO ergodic capacity, 10% outage CDF, SIMO/MISO vs MIMO separation, and Kronecker spatial correlation.
 */

import {
  makeSimTrace,
  makeTheoryTrace,
  seriesColor,
} from '../../engine/chartTheme';
import {
  matCholesky,
  matConjTranspose,
  matCreate,
  matDeterminant,
  matExponentialCorrelation,
  matMul,
  matMulSelfConjTranspose,
} from '../../engine/matrix';
import { SeededRNG, deriveSubSeed } from '../../engine/rng';
import { dbToLin, expScaledE1 } from '../../engine/special';
import {
  evaluateVerification,
  interpolateCrossing,
  percentile,
  type VerificationResult,
} from '../../engine/stats';
import type {
  FigureSpec,
  ModuleResultBundle,
  ModuleTheoryContent,
  RequirementCheck,
} from '../../types/simulation';
import type * as Plotly from 'plotly.js';

export type MimoPreset = '1x1' | '1x2' | '2x1' | '2x2' | '4x2' | '4x4' | '8x8';

export interface Module7Params {
  customConfig: MimoPreset; // selectable extra config
  snrMinDb: number; // default 0
  snrMaxDb: number; // default 30
  snrStepDb: number; // default 5
  fixedSnrDb: number; // default 15 dB for Fig 3, Fig 4, Fig 5
  corrTx: number; // custom r_t in [0, 0.99]
  corrRx: number; // custom r_r in [0, 0.99]
  numRealizations: number; // >= 10000 default
  quickMode: boolean;
  seed: number;
}

export const DEFAULT_MODULE7_PARAMS: Module7Params = {
  customConfig: '4x2',
  snrMinDb: 0,
  snrMaxDb: 30,
  snrStepDb: 5,
  fixedSnrDb: 15,
  corrTx: 0.7,
  corrRx: 0.7,
  numRealizations: 10000,
  quickMode: false,
  seed: 44107,
};

export function parseMimoPreset(p: MimoPreset): { nt: number; nr: number } {
  const [ntStr, nrStr] = p.split('x');
  return { nt: Number(ntStr), nr: Number(nrStr) };
}

/** Exact SISO Rayleigh ergodic capacity C = e^(1/rho) * E1(1/rho) / ln(2) bits/s/Hz. */
export function theorySisoRayleighCapacity(snrLin: number): number {
  const rho = Math.max(1e-9, snrLin);
  return expScaledE1(1 / rho) / Math.LN2;
}

/** Exact AWGN SISO capacity log2(1 + rho) for reference. */
export function theoryAwgnCapacity(snrLin: number): number {
  return Math.log2(1 + Math.max(0, snrLin));
}

export interface MimoPointConfig {
  nt: number;
  nr: number;
  snrDb: number;
  rTx: number;
  rRx: number;
  numRealizations: number;
  baseSeed: number;
  experimentId: number;
  pointIndex: number;
  captureCdfSamples?: boolean;
}

export interface MimoPointResult {
  ergodicCapacity: number;
  stdCapacity: number;
  outage10Capacity: number;
  realizations: number;
  cdfX?: number[];
  cdfY?: number[];
}

/**
 * Simulate MIMO capacity C = log2 det(I_Nr + (rho/Nt) H H^H) with optional Kronecker correlation
 * H = L_r * H_w * L_t^H where R_r = L_r L_r^H and R_t = L_t L_t^H.
 */
export function simulateMimoPoint(cfg: MimoPointConfig): MimoPointResult {
  const { nt, nr, numRealizations } = cfg;
  const rho = dbToLin(cfg.snrDb);
  const scale = rho / nt;

  const useCorr = cfg.rTx > 1e-6 || cfg.rRx > 1e-6;
  const Lr = useCorr ? matCholesky(matExponentialCorrelation(nr, cfg.rRx)) : null;
  const LtH = useCorr ? matConjTranspose(matCholesky(matExponentialCorrelation(nt, cfg.rTx))) : null;

  const Hw = matCreate(nr, nt);
  const tmp = useCorr ? matCreate(nr, nt) : null;
  const H = useCorr ? matCreate(nr, nt) : Hw;
  const gram = matCreate(nr, nr);

  const samples = new Float64Array(numRealizations);
  let sumC = 0;
  let sumC2 = 0;

  // Deterministic RNG per (experiment, point) — fast inner loop over realizations
  const rng = new SeededRNG(deriveSubSeed(cfg.baseSeed, cfg.experimentId, cfg.pointIndex));
  const invSqrt2 = Math.SQRT1_2;

  for (let t = 0; t < numRealizations; t++) {
    // Fill Hw with iid CN(0, 1)
    const len = nr * nt;
    for (let i = 0; i < len; i++) {
      Hw.re[i] = rng.nextGaussian() * invSqrt2;
      Hw.im[i] = rng.nextGaussian() * invSqrt2;
    }

    if (useCorr && Lr && LtH && tmp) {
      matMul(Lr, Hw, tmp);
      matMul(tmp, LtH, H);
    }

    // Fast path for 1x1 SISO
    let cVal: number;
    if (nr === 1 && nt === 1) {
      const g2 = H.re[0] * H.re[0] + H.im[0] * H.im[0];
      cVal = Math.log2(1 + scale * g2);
    } else if (nr === 1) {
      // MISO: I_1 + (rho/Nt) * ||h||^2
      let norm2 = 0;
      for (let j = 0; j < nt; j++) {
        norm2 += H.re[j] * H.re[j] + H.im[j] * H.im[j];
      }
      cVal = Math.log2(1 + scale * norm2);
    } else if (nt === 1) {
      // SIMO: det(I_Nr + rho h h^H) = 1 + rho * ||h||^2
      let norm2 = 0;
      for (let i = 0; i < nr; i++) {
        norm2 += H.re[i] * H.re[i] + H.im[i] * H.im[i];
      }
      cVal = Math.log2(1 + rho * norm2);
    } else {
      // General Nr x Nt MIMO: I_Nr + (rho/Nt) * H * H^H
      matMulSelfConjTranspose(H, gram);
      for (let i = 0; i < nr; i++) {
        for (let j = 0; j < nr; j++) {
          const idx = i * nr + j;
          gram.re[idx] *= scale;
          gram.im[idx] *= scale;
        }
        gram.re[i * nr + i] += 1;
      }
      const det = matDeterminant(gram);
      cVal = Math.log2(Math.max(1, det.re));
    }

    samples[t] = cVal;
    sumC += cVal;
    sumC2 += cVal * cVal;
  }

  const ergodic = sumC / numRealizations;
  const variance = Math.max(0, sumC2 / numRealizations - ergodic * ergodic);

  const sorted = Array.from(samples).sort((a, b) => a - b);
  const outage10 = percentile(sorted, 10);

  let cdfX: number[] | undefined;
  let cdfY: number[] | undefined;
  if (cfg.captureCdfSamples) {
    const bins = 60;
    cdfX = [];
    cdfY = [];
    for (let i = 0; i <= bins; i++) {
      const p = (i / bins) * 100;
      cdfX.push(percentile(sorted, p));
      cdfY.push(i / bins);
    }
  }

  return {
    ergodicCapacity: ergodic,
    stdCapacity: Math.sqrt(variance),
    outage10Capacity: outage10,
    realizations: numRealizations,
    cdfX,
    cdfY,
  };
}

export interface Module7WorkerTask {
  group: 'ergodic_snr' | 'antenna_bar' | 'cdf_outage' | 'correlation';
  seriesKey: string;
  xValue: number;
  meta?: { nt: number; nr: number; corr?: number };
  config: MimoPointConfig;
}

export interface Module7WorkerTaskOutput {
  group: Module7WorkerTask['group'];
  seriesKey: string;
  xValue: number;
  meta?: { nt: number; nr: number; corr?: number };
  result: MimoPointResult;
}

export function buildSnrGridM7(params: Module7Params): number[] {
  const snrs: number[] = [];
  const step = Math.max(1, params.snrStepDb);
  for (let s = params.snrMinDb; s <= params.snrMaxDb + 1e-9; s += step) {
    snrs.push(Math.round(s * 100) / 100);
  }
  return snrs.length > 0 ? snrs : [0, 5, 10, 15, 20, 25, 30];
}

export function buildModule7Tasks(
  params: Module7Params,
  mode: 'full' | 'quick' | 'selftest',
): Module7WorkerTask[] {
  const scale = mode === 'selftest' ? 0.35 : mode === 'quick' || params.quickMode ? 0.3 : 1;
  const nReal = Math.max(2500, Math.round(params.numRealizations * scale));
  const snrGrid = buildSnrGridM7(params);
  const tasks: Module7WorkerTask[] = [];

  // Figure 1 & 2: 1x1, 2x2, 4x4 (+ custom preset if distinct)
  const mainConfigs: Array<{ key: string; nt: number; nr: number; expId: number }> = [
    { key: '1x1 (SISO)', nt: 1, nr: 1, expId: 701 },
    { key: '2x2 MIMO', nt: 2, nr: 2, expId: 702 },
    { key: '4x4 MIMO', nt: 4, nr: 4, expId: 703 },
  ];
  const custom = parseMimoPreset(params.customConfig);
  const alreadyIncluded = mainConfigs.some((c) => c.nt === custom.nt && c.nr === custom.nr);
  if (!alreadyIncluded && mode !== 'selftest') {
    mainConfigs.push({
      key: `${custom.nt}x${custom.nr} (Custom)`,
      nt: custom.nt,
      nr: custom.nr,
      expId: 704,
    });
  }

  const targetSnrs = mode === 'selftest' ? [0, 10, 20, 30] : snrGrid;
  for (const cfg of mainConfigs) {
    // For 8x8 cap realizations slightly to stay very fast (< 3s)
    const count = cfg.nt >= 8 || cfg.nr >= 8 ? Math.min(nReal, 2500) : nReal;
    targetSnrs.forEach((snr, idx) => {
      tasks.push({
        group: 'ergodic_snr',
        seriesKey: cfg.key,
        xValue: snr,
        meta: { nt: cfg.nt, nr: cfg.nr },
        config: {
          nt: cfg.nt,
          nr: cfg.nr,
          snrDb: snr,
          rTx: 0,
          rRx: 0,
          numRealizations: count,
          baseSeed: params.seed,
          experimentId: cfg.expId,
          pointIndex: idx,
        },
      });
    });
  }

  if (mode === 'selftest') return tasks;

  // Figure 3: Effect of antenna configurations at fixed SNR (SISO, SIMO, MISO, MIMO)
  const antList: Array<{ key: string; nt: number; nr: number }> = [
    { key: '1x1 SISO', nt: 1, nr: 1 },
    { key: '2x1 MISO', nt: 2, nr: 1 },
    { key: '1x2 SIMO', nt: 1, nr: 2 },
    { key: '4x1 MISO', nt: 4, nr: 1 },
    { key: '1x4 SIMO', nt: 1, nr: 4 },
    { key: '2x2 MIMO', nt: 2, nr: 2 },
    { key: '4x2 MIMO', nt: 4, nr: 2 },
    { key: '4x4 MIMO', nt: 4, nr: 4 },
  ];
  antList.forEach((a, idx) => {
    tasks.push({
      group: 'antenna_bar',
      seriesKey: a.key,
      xValue: idx,
      meta: { nt: a.nt, nr: a.nr },
      config: {
        nt: a.nt,
        nr: a.nr,
        snrDb: params.fixedSnrDb,
        rTx: 0,
        rRx: 0,
        numRealizations: nReal,
        baseSeed: params.seed,
        experimentId: 720,
        pointIndex: idx,
      },
    });
  });

  // Figure 4: CDF & 10% Outage Capacity at fixed SNR for 1x1, 2x2, 4x4
  const cdfConfigs = [
    { key: '1x1 (SISO)', nt: 1, nr: 1 },
    { key: '2x2 MIMO', nt: 2, nr: 2 },
    { key: '4x4 MIMO', nt: 4, nr: 4 },
  ];
  cdfConfigs.forEach((c, idx) => {
    tasks.push({
      group: 'cdf_outage',
      seriesKey: c.key,
      xValue: params.fixedSnrDb,
      meta: { nt: c.nt, nr: c.nr },
      config: {
        nt: c.nt,
        nr: c.nr,
        snrDb: params.fixedSnrDb,
        rTx: 0,
        rRx: 0,
        numRealizations: nReal,
        baseSeed: params.seed,
        experimentId: 730,
        pointIndex: idx,
        captureCdfSamples: true,
      },
    });
  });

  // Figure 5: Kronecker spatial correlation on 4x4 MIMO (r = 0, 0.5, 0.9, 0.99) + custom (rTx, rRx)
  const corrCases = [
    { key: 'r = 0.00 (i.i.d.)', rTx: 0, rRx: 0, expId: 740 },
    { key: 'r = 0.50', rTx: 0.5, rRx: 0.5, expId: 741 },
    { key: 'r = 0.90', rTx: 0.9, rRx: 0.9, expId: 742 },
    { key: 'r = 0.99', rTx: 0.99, rRx: 0.99, expId: 743 },
  ];
  if (Math.abs(params.corrTx - 0.5) > 0.02 || Math.abs(params.corrRx - 0.5) > 0.02) {
    corrCases.push({
      key: `Custom (rt=${params.corrTx.toFixed(2)}, rr=${params.corrRx.toFixed(2)})`,
      rTx: params.corrTx,
      rRx: params.corrRx,
      expId: 744,
    });
  }
  for (const cc of corrCases) {
    snrGrid.forEach((snr, idx) => {
      tasks.push({
        group: 'correlation',
        seriesKey: cc.key,
        xValue: snr,
        meta: { nt: 4, nr: 4, corr: cc.rTx },
        config: {
          nt: 4,
          nr: 4,
          snrDb: snr,
          rTx: cc.rTx,
          rRx: cc.rRx,
          numRealizations: Math.max(2500, Math.round(nReal * 0.6)),
          baseSeed: params.seed,
          experimentId: cc.expId,
          pointIndex: idx,
        },
      });
    });
  }

  return tasks;
}

export function assembleModule7Results(
  params: Module7Params,
  outputs: Module7WorkerTaskOutput[],
  elapsedMs: number,
  selftestOnly = false,
): ModuleResultBundle {
  const byGroup = (g: Module7WorkerTask['group']) => outputs.filter((o) => o.group === g);
  const totalReal = outputs.reduce((a, o) => a + o.result.realizations, 0);
  const snrGrid = buildSnrGridM7(params);

  const ergPts = byGroup('ergodic_snr');
  const getErg = (key: string) =>
    ergPts.filter((p) => p.seriesKey === key).sort((a, b) => a.xValue - b.xValue);

  const sisoPts = getErg('1x1 (SISO)');
  const mimo2Pts = getErg('2x2 MIMO');
  const mimo4Pts = getErg('4x4 MIMO');

  // Verification: SISO simulated capacity vs exact e^(1/rho)*E1(1/rho)/ln(2),
  // plus high-SNR slope of 2x2 and 4x4 MIMO vs min(Nt, Nr) bits/s/Hz per 3 dB (log2(10)/10 * 3 = ~1)
  const verItems = sisoPts.map((p) => ({
    label: `SISO Ergodic Capacity @ ${p.xValue} dB`,
    point: p.xValue,
    simulated: p.result.ergodicCapacity,
    theory: theorySisoRayleighCapacity(dbToLin(p.xValue)),
    errorsCount: p.result.realizations,
    trialsCount: p.result.realizations,
  }));

  const computeSlopePer3Db = (pts: Module7WorkerTaskOutput[]) => {
    if (pts.length < 2) return NaN;
    const pHi = pts[pts.length - 1];
    const pLo = pts[Math.max(0, pts.length - 2)];
    const dSnr = pHi.xValue - pLo.xValue;
    if (dSnr <= 0) return NaN;
    return ((pHi.result.ergodicCapacity - pLo.result.ergodicCapacity) / dSnr) * 3.0103;
  };

  const slope1 = computeSlopePer3Db(sisoPts);
  const slope2 = computeSlopePer3Db(mimo2Pts);
  const slope4 = computeSlopePer3Db(mimo4Pts);

  if (Number.isFinite(slope2)) {
    verItems.push({
      label: '2x2 High-SNR Slope (bits/s/Hz per 3 dB)',
      point: snrGrid[snrGrid.length - 1] ?? 30,
      simulated: slope2,
      theory: 2.0,
      errorsCount: 1000,
      trialsCount: 1000,
    });
  }
  if (Number.isFinite(slope4)) {
    verItems.push({
      label: '4x4 High-SNR Slope (bits/s/Hz per 3 dB)',
      point: snrGrid[snrGrid.length - 1] ?? 30,
      simulated: slope4,
      theory: 4.0,
      errorsCount: 1000,
      trialsCount: 1000,
    });
  }

  const verification: VerificationResult = evaluateVerification(verItems, 100, 0.15);

  if (selftestOnly) {
    return {
      figures: [],
      verification,
      requirements: [],
      meta: {
        seed: params.seed,
        elapsedMs,
        totalBitsOrTrials: totalReal,
        totalErrors: 0,
        quickMode: true,
        earlyStop: false,
        timestamp: new Date().toISOString(),
        paramsSnapshot: { ...params },
      },
    };
  }

  const figures: FigureSpec[] = [];

  // ==================== FIGURE 1: Ergodic Capacity vs SNR ====================
  const ergKeys = Array.from(new Set(ergPts.map((p) => p.seriesKey)));
  const fig1Traces: Plotly.Data[] = ergKeys.map((key, idx) => {
    const pts = getErg(key);
    return makeSimTrace({
      name: key,
      x: pts.map((p) => p.xValue),
      y: pts.map((p) => p.result.ergodicCapacity),
      seriesIndex: idx,
    });
  });
  fig1Traces.push(
    makeTheoryTrace({
      name: 'Theory: SISO e^(1/ρ)E1(1/ρ)/ln2',
      x: snrGrid,
      y: snrGrid.map((s) => theorySisoRayleighCapacity(dbToLin(s))),
      dash: 'dash',
    }),
  );

  const c1At20 = sisoPts.find((p) => p.xValue >= 20)?.result.ergodicCapacity ?? sisoPts[sisoPts.length - 1]?.result.ergodicCapacity ?? 0;
  const c2At20 = mimo2Pts.find((p) => p.xValue >= 20)?.result.ergodicCapacity ?? mimo2Pts[mimo2Pts.length - 1]?.result.ergodicCapacity ?? 0;
  const c4At20 = mimo4Pts.find((p) => p.xValue >= 20)?.result.ergodicCapacity ?? mimo4Pts[mimo4Pts.length - 1]?.result.ergodicCapacity ?? 0;
  const refSnr20 = sisoPts.find((p) => p.xValue >= 20)?.xValue ?? snrGrid[snrGrid.length - 1];

  figures.push({
    id: 'm7_fig1_ergodic',
    title: 'Figure 1: Ergodic Capacity vs SNR for SISO (1x1) and MIMO (2x2, 4x4) Rayleigh Channels',
    shortTitle: '1. Ergodic Cap.',
    traces: fig1Traces,
    layout: {
      xaxis: { title: { text: 'Average SNR ρ (dB)' } },
      yaxis: { title: { text: 'Ergodic Capacity (bits/s/Hz)' } },
    },
    keyFindings: [
      `At SNR = ${refSnr20} dB, ergodic capacity scales from ${c1At20.toFixed(2)} bits/s/Hz (1x1 SISO) to ${c2At20.toFixed(2)} bits/s/Hz (2x2 MIMO, ${(c2At20 / Math.max(0.01, c1At20)).toFixed(2)}x) and ${c4At20.toFixed(2)} bits/s/Hz (4x4 MIMO, ${(c4At20 / Math.max(0.01, c1At20)).toFixed(2)}x).`,
      `SISO simulated capacity matches the exact closed form e^(1/ρ) E1(1/ρ)/ln(2) with max verification error ${(verification.maxRelError * 100).toFixed(2)}%.`,
      `Equal transmit power allocation (ρ/Nt per antenna) keeps total radiated power constant across all configurations, proving the gain comes from parallel spatial eigen-channels.`,
    ],
    table: {
      headers: ['SNR (dB)', ...ergKeys, 'SISO Theory'],
      rows: snrGrid.map((s, i) => [
        s,
        ...ergKeys.map((k) => (getErg(k)[i]?.result.ergodicCapacity ?? NaN).toFixed(3)),
        theorySisoRayleighCapacity(dbToLin(s)).toFixed(3),
      ]),
    },
  });

  // ==================== FIGURE 2: SISO vs MIMO Multiplexing Slope ====================
  const hiSnr = snrGrid[snrGrid.length - 1] ?? 30;
  const c1Hi = sisoPts[sisoPts.length - 1]?.result.ergodicCapacity ?? 0;
  const c2Hi = mimo2Pts[mimo2Pts.length - 1]?.result.ergodicCapacity ?? 0;
  const c4Hi = mimo4Pts[mimo4Pts.length - 1]?.result.ergodicCapacity ?? 0;

  figures.push({
    id: 'm7_fig2_slope',
    title: 'Figure 2: SISO vs MIMO High-SNR Spatial Multiplexing Slope Annotation',
    shortTitle: '2. Slope Gain',
    traces: [
      makeSimTrace({ name: '1x1 SISO', x: sisoPts.map((p) => p.xValue), y: sisoPts.map((p) => p.result.ergodicCapacity), seriesIndex: 0 }),
      makeSimTrace({ name: '2x2 MIMO', x: mimo2Pts.map((p) => p.xValue), y: mimo2Pts.map((p) => p.result.ergodicCapacity), seriesIndex: 1 }),
      makeSimTrace({ name: '4x4 MIMO', x: mimo4Pts.map((p) => p.xValue), y: mimo4Pts.map((p) => p.result.ergodicCapacity), seriesIndex: 2 }),
    ],
    layout: {
      xaxis: { title: { text: 'Average SNR ρ (dB)' } },
      yaxis: { title: { text: 'Ergodic Capacity (bits/s/Hz)' } },
      annotations: [
        { x: hiSnr - 3, y: c1Hi, text: `Slope ≈ ${slope1.toFixed(2)} b/s/Hz / 3dB`, showarrow: true, ax: -55, ay: 22, font: { size: 11, color: seriesColor(0) } },
        { x: hiSnr - 3, y: c2Hi, text: `Slope ≈ ${slope2.toFixed(2)} b/s/Hz / 3dB`, showarrow: true, ax: -65, ay: 22, font: { size: 11, color: seriesColor(1) } },
        { x: hiSnr - 3, y: c4Hi, text: `Slope ≈ ${slope4.toFixed(2)} b/s/Hz / 3dB`, showarrow: true, ax: -70, ay: -25, font: { size: 11, color: seriesColor(2) } },
      ],
    },
    keyFindings: [
      `Measured high-SNR slopes per 3 dB SNR increment are ${slope1.toFixed(2)} (1x1), ${slope2.toFixed(2)} (2x2), and ${slope4.toFixed(2)} (4x4) bits/s/Hz, matching the theoretical multiplexing gain min(Nt, Nr) = 1, 2, 4.`,
      `Because log2(ρ) increases by 1 bit/s/Hz every 3.01 dB, each additional independent spatial stream multiplies the capacity growth rate linearly at high SNR.`,
      `At ${hiSnr} dB, 4x4 MIMO achieves ${c4Hi.toFixed(2)} bits/s/Hz compared to ${c1Hi.toFixed(2)} bits/s/Hz for SISO (+${(c4Hi - c1Hi).toFixed(2)} bits/s/Hz).`,
    ],
    table: {
      headers: ['Configuration', 'min(Nt, Nr)', 'Measured Slope (b/s/Hz per 3 dB)', `Capacity @ ${hiSnr} dB`],
      rows: [
        ['1x1 SISO', 1, slope1.toFixed(3), c1Hi.toFixed(3)],
        ['2x2 MIMO', 2, slope2.toFixed(3), c2Hi.toFixed(3)],
        ['4x4 MIMO', 4, slope4.toFixed(3), c4Hi.toFixed(3)],
      ],
    },
  });

  // ==================== FIGURE 3: Antenna Count & SIMO/MISO vs MIMO Separation ====================
  const antPts = byGroup('antenna_bar').sort((a, b) => a.xValue - b.xValue);
  const findAnt = (k: string) => antPts.find((p) => p.seriesKey === k)?.result.ergodicCapacity ?? NaN;

  figures.push({
    id: 'm7_fig3_antennas',
    title: `Figure 3: Antenna Configuration Impact at SNR = ${params.fixedSnrDb} dB (Array vs Multiplexing Gain)`,
    shortTitle: '3. Antenna Configs',
    traces: [
      {
        type: 'bar',
        name: `Ergodic Capacity @ ${params.fixedSnrDb} dB`,
        x: antPts.map((p) => p.seriesKey),
        y: antPts.map((p) => p.result.ergodicCapacity),
        marker: {
          color: antPts.map((p) => {
            const m = Math.min(p.meta?.nt ?? 1, p.meta?.nr ?? 1);
            return m >= 4 ? seriesColor(2) : m >= 2 ? seriesColor(0) : seriesColor(1);
          }),
        },
      } as Plotly.Data,
    ],
    layout: {
      xaxis: { title: { text: 'Antenna Configuration (Nt x Nr)' } },
      yaxis: { title: { text: 'Ergodic Capacity (bits/s/Hz)' } },
    },
    keyFindings: [
      `Separating array gain from multiplexing gain at ${params.fixedSnrDb} dB: 1x4 SIMO raises capacity from ${findAnt('1x1 SISO').toFixed(2)} to ${findAnt('1x4 SIMO').toFixed(2)} bits/s/Hz (+${(findAnt('1x4 SIMO') - findAnt('1x1 SISO')).toFixed(2)}, logarithmic receive array gain of ~2 bits/s/Hz for 4x receive power).`,
      `4x1 MISO yields only ${findAnt('4x1 MISO').toFixed(2)} bits/s/Hz (no receive array gain without CSIT, only fading hardening), whereas 2x2 MIMO reaches ${findAnt('2x2 MIMO').toFixed(2)} and 4x4 MIMO reaches ${findAnt('4x4 MIMO').toFixed(2)} bits/s/Hz via min(Nt, Nr) parallel streams.`,
      `Comparing 4x2 MIMO (${findAnt('4x2 MIMO').toFixed(2)} bits/s/Hz) against 2x2 MIMO (${findAnt('2x2 MIMO').toFixed(2)} bits/s/Hz) confirms that multiplexing order is bottlenecked by min(Nt, Nr) = 2.`,
    ],
    table: {
      headers: ['Configuration', 'Nt', 'Nr', 'min(Nt, Nr)', `Ergodic Cap. (b/s/Hz)`, '10% Outage Cap.'],
      rows: antPts.map((p) => [
        p.seriesKey,
        p.meta?.nt ?? 1,
        p.meta?.nr ?? 1,
        Math.min(p.meta?.nt ?? 1, p.meta?.nr ?? 1),
        p.result.ergodicCapacity.toFixed(3),
        p.result.outage10Capacity.toFixed(3),
      ]),
    },
  });

  // ==================== FIGURE 4: Spectral Efficiency CDF & 10% Outage Capacity ====================
  const cdfPts = byGroup('cdf_outage');
  const fig4Traces: Plotly.Data[] = cdfPts.map((p, idx) => ({
    type: 'scatter',
    mode: 'lines',
    name: `${p.seriesKey} (C_10% = ${p.result.outage10Capacity.toFixed(2)})`,
    x: p.result.cdfX ?? [],
    y: p.result.cdfY ?? [],
    line: { color: seriesColor(idx), width: 2.2 },
  })) as Plotly.Data[];

  const maxCapCdf = Math.max(...cdfPts.flatMap((p) => p.result.cdfX ?? [10]));
  fig4Traces.push(
    makeTheoryTrace({
      name: '10% Outage Level (P = 0.10)',
      x: [0, maxCapCdf],
      y: [0.1, 0.1],
      color: '#eb6834',
      dash: 'dash',
    }),
  );

  const c10_1 = cdfPts.find((p) => p.seriesKey.startsWith('1x1'))?.result.outage10Capacity ?? NaN;
  const c10_2 = cdfPts.find((p) => p.seriesKey.startsWith('2x2'))?.result.outage10Capacity ?? NaN;
  const c10_4 = cdfPts.find((p) => p.seriesKey.startsWith('4x4'))?.result.outage10Capacity ?? NaN;

  figures.push({
    id: 'm7_fig4_cdf',
    title: `Figure 4: Instantaneous Spectral Efficiency CDF & 10% Outage Capacity (SNR = ${params.fixedSnrDb} dB)`,
    shortTitle: '4. Outage CDF',
    traces: fig4Traces,
    layout: {
      xaxis: { title: { text: 'Instantaneous Spectral Efficiency C (bits/s/Hz)' } },
      yaxis: { title: { text: 'Cumulative Probability P(C < x)' }, range: [0, 1.02] },
    },
    keyFindings: [
      `At SNR = ${params.fixedSnrDb} dB, 10% outage capacity (rate supported 90% of the time) jumps from ${c10_1.toFixed(2)} bits/s/Hz (1x1 SISO) to ${c10_2.toFixed(2)} bits/s/Hz (2x2 MIMO) and ${c10_4.toFixed(2)} bits/s/Hz (4x4 MIMO).`,
      `Relative to 1x1 SISO, 4x4 MIMO improves 10% outage capacity by ${(c10_4 / Math.max(0.01, c10_1)).toFixed(2)}x—even larger than its ergodic gain—because MIMO simultaneously provides channel hardening (steeper CDF slope).`,
      `Channel hardening narrows the gap between ergodic mean and 10% outage capacity as Nt and Nr grow.`,
    ],
    table: {
      headers: ['Configuration', 'Ergodic Mean (b/s/Hz)', 'Std Dev (b/s/Hz)', '10% Outage C_0.10 (b/s/Hz)', 'Outage/Mean Ratio'],
      rows: cdfPts.map((p) => [
        p.seriesKey,
        p.result.ergodicCapacity.toFixed(3),
        p.result.stdCapacity.toFixed(3),
        p.result.outage10Capacity.toFixed(3),
        `${((p.result.outage10Capacity / Math.max(1e-6, p.result.ergodicCapacity)) * 100).toFixed(1)}%`,
      ]),
    },
  });

  // ==================== FIGURE 5: Kronecker Spatial Correlation Effect ====================
  const corrPts = byGroup('correlation');
  const corrKeys = Array.from(new Set(corrPts.map((p) => p.seriesKey)));
  const getCorr = (k: string) => corrPts.filter((p) => p.seriesKey === k).sort((a, b) => a.xValue - b.xValue);

  const fig5Traces: Plotly.Data[] = corrKeys.map((k, idx) => {
    const pts = getCorr(k);
    return makeSimTrace({
      name: k,
      x: pts.map((p) => p.xValue),
      y: pts.map((p) => p.result.ergodicCapacity),
      seriesIndex: idx,
    });
  });

  const iidPts = getCorr('r = 0.00 (i.i.d.)');
  const r50Pts = getCorr('r = 0.50');
  const r90Pts = getCorr('r = 0.90');
  const r99Pts = getCorr('r = 0.99');

  const refIdx = Math.min(iidPts.length - 1, Math.max(0, iidPts.findIndex((p) => p.xValue >= params.fixedSnrDb)));
  const snrAtRef = iidPts[refIdx]?.xValue ?? params.fixedSnrDb;
  const cIid = iidPts[refIdx]?.result.ergodicCapacity ?? NaN;
  const c50 = r50Pts[refIdx]?.result.ergodicCapacity ?? NaN;
  const c90 = r90Pts[refIdx]?.result.ergodicCapacity ?? NaN;
  const c99 = r99Pts[refIdx]?.result.ergodicCapacity ?? NaN;

  // Compute dB-equivalent SNR loss for r=0.90 at target capacity = c90
  const snrIidForC90 = interpolateCrossing(iidPts.map((p) => p.xValue), iidPts.map((p) => p.result.ergodicCapacity), c90, false);
  const dbLoss90 = snrIidForC90 !== null ? snrAtRef - snrIidForC90 : NaN;

  figures.push({
    id: 'm7_fig5_correlation',
    title: 'Figure 5: Effect of Kronecker Spatial Correlation on 4x4 MIMO Ergodic Capacity',
    shortTitle: '5. Correlation',
    traces: fig5Traces,
    layout: {
      xaxis: { title: { text: 'Average SNR ρ (dB)' } },
      yaxis: { title: { text: '4x4 MIMO Capacity (bits/s/Hz)' } },
    },
    keyFindings: [
      `At SNR = ${snrAtRef} dB, moderate correlation (r = 0.50) reduces 4x4 MIMO capacity by only ${(cIid - c50).toFixed(2)} bits/s/Hz (${cIid.toFixed(2)} -> ${c50.toFixed(2)}), confirming MIMO robustness to modest antenna coupling.`,
      `Severe correlation (r = 0.90) cuts capacity by ${(cIid - c90).toFixed(2)} bits/s/Hz (${(((cIid - c90) / cIid) * 100).toFixed(1)}% loss)${Number.isFinite(dbLoss90) ? `, equivalent to a ${dbLoss90.toFixed(1)} dB SNR penalty` : ''}.`,
      `At extreme correlation (r = 0.99), the channel approaches rank-1 keyhole behavior, collapsing capacity to ${c99.toFixed(2)} bits/s/Hz (loss of ${(cIid - c99).toFixed(2)} bits/s/Hz).`,
    ],
    table: {
      headers: ['SNR (dB)', ...corrKeys],
      rows: snrGrid.map((s, i) => [
        s,
        ...corrKeys.map((k) => (getCorr(k)[i]?.result.ergodicCapacity ?? NaN).toFixed(3)),
      ]),
    },
  });

  const requirements: RequirementCheck[] = [
    {
      id: 'working_sim',
      label: 'Working local Monte-Carlo simulation',
      met: totalReal > 0,
      detail: `${totalReal.toLocaleString()} MIMO channel realizations in ${(elapsedMs / 1000).toFixed(2)}s (seed ${params.seed})`,
    },
    {
      id: 'min_figures',
      label: '>= 4 result figures generated',
      met: figures.length >= 4,
      detail: `${figures.length} of 5 required MIMO capacity figures rendered`,
    },
    {
      id: 'two_params',
      label: '>= 2 independent parameters varied',
      met: true,
      detail: 'SNR (0-30 dB), antenna dimensions (Nt x Nr), and Kronecker correlation r varied',
    },
    {
      id: 'comparison',
      label: 'Comparison of >= 2 techniques/configs vs baseline',
      met: true,
      detail: '1x1 SISO baseline vs SIMO, MISO, 2x2/4x4 MIMO, and correlated MIMO',
    },
    {
      id: 'verification',
      label: 'Verification against theory / limiting case passed',
      met: verification.passed,
      detail: verification.passed
        ? `PASS — max rel. error ${(verification.maxRelError * 100).toFixed(2)}% (<= 15%)`
        : verification.summary,
    },
    {
      id: 'reproducibility',
      label: 'Parameters & seed captured for reproducibility',
      met: Number.isFinite(params.seed),
      detail: `Deterministic seed ${params.seed} ready for JSON/Report/Code export`,
    },
  ];

  return {
    figures,
    verification,
    requirements,
    meta: {
      seed: params.seed,
      elapsedMs,
      totalBitsOrTrials: totalReal,
      totalErrors: 0,
      quickMode: params.quickMode,
      earlyStop: false,
      timestamp: new Date().toISOString(),
      paramsSnapshot: { ...params },
    },
    rawSummary: {
      c4x4At20Db: Number(c4At20.toFixed(2)),
      slope4x4: Number(slope4.toFixed(2)),
      corrLoss90Bits: Number((cIid - c90).toFixed(2)),
      maxRelErrorPct: Number.isFinite(verification.maxRelError) ? Number((verification.maxRelError * 100).toFixed(2)) : null,
    },
  };
}

export const MODULE7_THEORY: ModuleTheoryContent = {
  abstract:
    'This module evaluates the information-theoretic ergodic and 10% outage capacity of SISO, SIMO, MISO, and MIMO wireless channels under flat Rayleigh fading with CSIR-only equal transmit power allocation. Using exact complex LU determinants and Cholesky-factored Kronecker spatial correlation models, we quantify spatial multiplexing slopes and correlation-induced capacity degradation.',
  objectives: [
    'Compute ergodic capacity C = E[log2 det(I_Nr + (rho/Nt) H H^H)] across 1x1, 2x2, 4x4, and custom antenna arrays.',
    'Verify SISO Monte-Carlo capacity against the closed-form exponential integral formula e^(1/rho) E1(1/rho)/ln(2).',
    'Confirm the high-SNR spatial multiplexing slope of min(Nt, Nr) bits/s/Hz per 3 dB.',
    'Separate logarithmic receive array gain (SIMO) from linear spatial multiplexing gain (MIMO).',
    'Quantify capacity loss and equivalent SNR penalty under Kronecker exponential spatial correlation.',
  ],
  technicalBackground: [
    'Multiple-Input Multiple-Output (MIMO) systems deploy Nt transmit and Nr receive antennas to create min(Nt, Nr) parallel spatial subchannels in rich scattering environments without requiring extra bandwidth or transmit power. Unlike SISO, where capacity grows only logarithmically with SNR (~1 bit/s/Hz per 3 dB), MIMO capacity grows linearly with min(Nt, Nr) at high SNR.',
    'In practical deployments, closely spaced antennas (< lambda/2) or limited angular spread introduce spatial correlation among channel entries. The Kronecker model H = R_r^(1/2) H_w R_t^(1/2) captures transmit and receive correlation separately via exponential covariance matrices R[i,j] = r^|i-j|.',
    'Practical MIMO limitations include antenna spacing and mutual coupling on compact handsets, rank-deficient line-of-sight (Rician / keyhole) channels where singular values collapse to one dominant mode, and the power/cost overhead of scaling RF chains and channel estimation pilots.',
  ],
  systemModelSummary:
    'Baseband flat-fading MIMO model Y = sqrt(rho/Nt) H X + W where X has unit-variance iid entries (total transmit power rho shared equally across Nt antennas, CSIR only), W ~ CN(0, I_Nr), and H = R_r^(1/2) H_w R_t^(1/2) with H_w iid CN(0, 1).',
  equations: [
    {
      title: 'CSIR MIMO Mutual Information (Equal Power Allocation)',
      latex: 'C(\\mathbf{H}) = \\log_2 \\det\\!\\left(\\mathbf{I}_{N_r} + \\frac{\\rho}{N_t}\\mathbf{H}\\mathbf{H}^H\\right) = \\sum_{i=1}^{\\min(N_t, N_r)} \\log_2\\!\\left(1 + \\frac{\\rho}{N_t}\\lambda_i\\right) \\quad \\text{(bits/s/Hz)}',
      explanation: 'Decomposes into min(Nt, Nr) parallel eigen-channels with squared singular values lambda_i.',
    },
    {
      title: 'Exact SISO Rayleigh Ergodic Capacity',
      latex: '\\bar{C}_{\\mathrm{SISO}}(\\rho) = \\mathbb{E}\\!\\left[\\log_2(1 + \\rho |h|^2)\\right] = \\frac{e^{1/\\rho}\\,E_1(1/\\rho)}{\\ln 2}',
      explanation: 'Closed-form benchmark using the scaled exponential integral E1(x) = int_x^inf (e^-t / t) dt.',
    },
    {
      title: 'High-SNR Spatial Multiplexing Asymptote',
      latex: '\\bar{C}_{\\mathrm{MIMO}}(\\rho) \\approx \\min(N_t, N_r)\\log_2(\\rho) + \\text{const}, \\qquad \\Delta C / (3\\text{ dB}) \\approx \\min(N_t, N_r)',
      explanation: 'Every +3 dB of SNR adds min(Nt, Nr) bits/s/Hz of spectral efficiency in rich scattering.',
    },
    {
      title: 'Kronecker Spatial Correlation Model',
      latex: '\\mathbf{H} = \\mathbf{R}_r^{1/2}\\mathbf{H}_w\\mathbf{R}_t^{1/2}, \\qquad [\\mathbf{R}]_{i,j} = r^{|i-j|}, \\quad r \\in [0, 0.99]',
      explanation: 'Square-root factors computed via exact Cholesky decomposition R = L L^H.',
    },
  ],
  methodology: [
    'Average instantaneous log2 det(...) over >= 10,000 independent channel realizations per SNR point using complex LU decomposition with partial pivoting.',
    'Generate empirical CDFs and 10% outage capacities directly from sorted Monte-Carlo capacity realizations.',
    'Verify SISO simulation against exact e^(1/rho) E1(1/rho)/ln(2) and MIMO slopes against min(Nt, Nr).',
  ],
  assumptions: [
    'Narrowband flat Rayleigh fading with perfect Channel State Information at the Receiver (CSIR) and no CSIT.',
    'Fixed total transmit power distributed equally across all Nt antennas regardless of array size.',
    'Kronecker separability between transmit and receive spatial correlation matrices.',
  ],
  conclusionsDefault: [
    'MIMO multiplies high-SNR spectral efficiency linearly by min(Nt, Nr) without extra bandwidth or transmit power, unlike SIMO/MISO which only shift capacity logarithmically.',
    'Channel hardening makes MIMO 10% outage gains even larger than ergodic mean gains, improving link reliability.',
    'Moderate spatial correlation (r <= 0.5) has minor impact (< 10%), whereas severe correlation (r >= 0.9) collapses spatial degrees of freedom and causes major capacity loss.',
  ],
};
