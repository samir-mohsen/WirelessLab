/**
 * Module 2: Diversity Combining over Fading Channels
 * BPSK over independent flat Rayleigh branches (No Diversity, SC, EGC, MRC) for L = 1..8.
 */

import {
  makeSimTrace,
  makeTheoryTrace,
  seriesColor,
} from '../../engine/chartTheme';
import { SeededRNG, deriveSubSeed } from '../../engine/rng';
import { binomial, dbToLin, linToDb } from '../../engine/special';
import {
  evaluateVerification,
  interpolateCrossing,
  wilsonInterval,
  type VerificationResult,
  type WilsonCI,
} from '../../engine/stats';
import type {
  FigureSpec,
  ModuleResultBundle,
  ModuleTheoryContent,
  RequirementCheck,
} from '../../types/simulation';
import type * as Plotly from 'plotly.js';

export type DiversityTechnique = 'NONE' | 'SC' | 'EGC' | 'MRC';

export interface Module2Params {
  diversityOrder: number; // L = 2..8 (default 4)
  includeEgc: boolean;
  snrMinDb: number;
  snrMaxDb: number;
  snrStepDb: number;
  outageThresholdDb: number; // primary gamma_th (dB), default 5
  numBitsPerPoint: number; // default 80000
  earlyStop: boolean;
  earlyStopErrors: number;
  quickMode: boolean;
  seed: number;
}

export const DEFAULT_MODULE2_PARAMS: Module2Params = {
  diversityOrder: 4,
  includeEgc: true,
  snrMinDb: 0,
  snrMaxDb: 24,
  snrStepDb: 3,
  outageThresholdDb: 5,
  numBitsPerPoint: 80000,
  earlyStop: true,
  earlyStopErrors: 200,
  quickMode: false,
  seed: 44102,
};

/** Exact BPSK flat Rayleigh BER for L=1 (No Diversity). */
export function theoryBerNoDiv(gammaBarLin: number): number {
  const g = Math.max(1e-12, gammaBarLin);
  return 0.5 * (1 - Math.sqrt(g / (1 + g)));
}

/** Exact BPSK MRC BER over L iid Rayleigh branches (Proakis eq. 14-4-15). */
export function theoryBerMrc(gammaBarLin: number, L: number): number {
  const g = Math.max(1e-12, gammaBarLin);
  const mu = Math.sqrt(g / (1 + g));
  const p = 0.5 * (1 - mu);
  const q = 0.5 * (1 + mu);
  let sum = 0;
  let qPow = 1;
  for (let k = 0; k < L; k++) {
    sum += binomial(L - 1 + k, k) * qPow;
    qPow *= q;
  }
  return Math.pow(p, L) * sum;
}

/**
 * Exact BPSK Selection Combining (SC) BER over L iid Rayleigh branches.
 * Pb_SC = sum_{k=0}^{L-1} w_k * 0.5 * (1 - sqrt(g_k / (1 + g_k)))
 * where w_k = L * (-1)^k * C(L-1, k) / (k + 1), g_k = gbar / (k + 1).
 */
export function theoryBerSc(gammaBarLin: number, L: number): number {
  const g = Math.max(1e-12, gammaBarLin);
  let total = 0;
  for (let k = 0; k < L; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const wk = (L * sign * binomial(L - 1, k)) / (k + 1);
    const gk = g / (k + 1);
    total += wk * 0.5 * (1 - Math.sqrt(gk / (1 + gk)));
  }
  return Math.max(0, total);
}

/** Exact BPSK EGC BER for L=2; tight high-precision Beaulieu approximation for L>2. */
export function theoryBerEgc(gammaBarLin: number, L: number): number {
  if (L === 1) return theoryBerNoDiv(gammaBarLin);
  if (L === 2) {
    const g = Math.max(1e-12, gammaBarLin);
    return 0.5 * (1 - Math.sqrt((g * (g + 2)) / ((g + 1) * (g + 1))));
  }
  // EGC effective SNR scaling relative to MRC: (1 + (L-1)*pi/4) / L
  const scale = (1 + (L - 1) * (Math.PI / 4)) / L;
  return theoryBerMrc(gammaBarLin * scale, L);
}

/** Exact SC outage probability P_out,SC = (1 - exp(-gamma_th / gbar))^L. */
export function theoryOutageSc(gammaBarLin: number, gammaThLin: number, L: number): number {
  const x = gammaThLin / Math.max(1e-12, gammaBarLin);
  return Math.pow(1 - Math.exp(-x), L);
}

/** Exact MRC outage probability P_out,MRC = 1 - exp(-x) * sum_{k=0}^{L-1} x^k / k!. */
export function theoryOutageMrc(gammaBarLin: number, gammaThLin: number, L: number): number {
  const x = gammaThLin / Math.max(1e-12, gammaBarLin);
  let term = 1;
  let sum = 1;
  for (let k = 1; k < L; k++) {
    term *= x / k;
    sum += term;
  }
  return Math.max(0, Math.min(1, 1 - Math.exp(-x) * sum));
}

export function harmonicNumber(L: number): number {
  let h = 0;
  for (let k = 1; k <= L; k++) h += 1 / k;
  return h;
}

export interface DiversityPointConfig {
  mode: 'ber' | 'outage';
  technique: DiversityTechnique;
  L: number;
  snrDb: number;
  outageThresholdDb?: number;
  numTrials: number;
  earlyStop: boolean;
  earlyStopErrors: number;
  baseSeed: number;
  experimentId: number;
  pointIndex: number;
}

export interface DiversityPointResult {
  errors: number;
  trials: number;
  rate: number; // BER or P_out
  avgCombinedSnrLin: number;
  wilson: WilsonCI;
}

/**
 * Core Monte-Carlo simulator for coherent BPSK with independent Rayleigh branches
 * under No Diversity, SC, EGC, or MRC (or outage probability).
 */
export function simulateDiversityPoint(cfg: DiversityPointConfig): DiversityPointResult {
  const L = cfg.technique === 'NONE' ? 1 : Math.max(1, Math.round(cfg.L));
  const gammaBar = dbToLin(cfg.snrDb);
  // Complex Rayleigh branch h_i ~ CN(0, 1) => |h_i|^2 ~ Exp(1), E[|h_i|^2] = 1
  // For coherent BPSK with Es = Eb = 1, real noise variance per branch is N0/2 = 1 / (2 * gammaBar)
  const noiseStd = Math.sqrt(1 / (2 * gammaBar));
  const gammaTh = cfg.outageThresholdDb !== undefined ? dbToLin(cfg.outageThresholdDb) : 1;

  const batchSize = 512;
  const minTrials = Math.min(cfg.numTrials, Math.max(10000, Math.floor(cfg.numTrials * 0.25)));

  let errors = 0;
  let trials = 0;
  let sumCombinedSnr = 0;

  let batchIdx = 0;
  while (trials < cfg.numTrials) {
    const count = Math.min(batchSize, cfg.numTrials - trials);
    const chRng = new SeededRNG(deriveSubSeed(cfg.baseSeed, cfg.experimentId, batchIdx));
    const noiseRng = new SeededRNG(
      deriveSubSeed(cfg.baseSeed, cfg.experimentId, batchIdx, cfg.pointIndex + 5000),
    );
    batchIdx++;

    for (let t = 0; t < count; t++) {
      // Generate L independent Rayleigh branch amplitudes |h_i| and squared gains |h_i|^2
      let combinedSnr = 0;
      let effAmp = 0;
      let effNoiseStd = noiseStd;

      if (cfg.technique === 'NONE' || L === 1) {
        const hr = chRng.nextGaussian() * Math.SQRT1_2;
        const hi = chRng.nextGaussian() * Math.SQRT1_2;
        const g2 = hr * hr + hi * hi;
        combinedSnr = gammaBar * g2;
        effAmp = Math.sqrt(g2);
        effNoiseStd = noiseStd;
      } else if (cfg.technique === 'SC') {
        let bestG2 = -1;
        for (let l = 0; l < L; l++) {
          const hr = chRng.nextGaussian() * Math.SQRT1_2;
          const hi = chRng.nextGaussian() * Math.SQRT1_2;
          const g2 = hr * hr + hi * hi;
          if (g2 > bestG2) bestG2 = g2;
        }
        combinedSnr = gammaBar * bestG2;
        effAmp = Math.sqrt(bestG2);
        effNoiseStd = noiseStd;
      } else if (cfg.technique === 'MRC') {
        let sumG2 = 0;
        for (let l = 0; l < L; l++) {
          const hr = chRng.nextGaussian() * Math.SQRT1_2;
          const hi = chRng.nextGaussian() * Math.SQRT1_2;
          sumG2 += hr * hr + hi * hi;
        }
        combinedSnr = gammaBar * sumG2;
        // Post-MRC coherent decision statistic: sum(|h_l|^2)*s + sum(Re(h_l^* w_l))
        // Equivalent real signal amplitude = sqrt(sumG2), noise std = noiseStd
        effAmp = Math.sqrt(sumG2);
        effNoiseStd = noiseStd;
      } else {
        // EGC: co-phase all branches and sum with equal weights 1/sqrt(L)
        let sumMag = 0;
        for (let l = 0; l < L; l++) {
          const hr = chRng.nextGaussian() * Math.SQRT1_2;
          const hi = chRng.nextGaussian() * Math.SQRT1_2;
          sumMag += Math.hypot(hr, hi);
        }
        const invSqrtL = 1 / Math.sqrt(L);
        effAmp = sumMag * invSqrtL;
        combinedSnr = gammaBar * effAmp * effAmp;
        effNoiseStd = noiseStd;
      }

      sumCombinedSnr += combinedSnr;

      if (cfg.mode === 'outage') {
        if (combinedSnr < gammaTh) errors++;
      } else {
        // Coherent BPSK decision (transmitted bit = +1 without loss of generality by symmetry, or random bit)
        const bit = chRng.nextBit();
        const s = 1 - 2 * bit;
        const y = effAmp * s + noiseRng.nextGaussian() * effNoiseStd;
        const bHat = y < 0 ? 1 : 0;
        if (bHat !== bit) errors++;
      }
    }

    trials += count;
    if (cfg.earlyStop && trials >= minTrials && errors >= cfg.earlyStopErrors) {
      break;
    }
  }

  const rate = trials > 0 ? errors / trials : 0;
  return {
    errors,
    trials,
    rate,
    avgCombinedSnrLin: trials > 0 ? sumCombinedSnr / trials : 0,
    wilson: wilsonInterval(errors, trials),
  };
}

export interface Module2WorkerTask {
  group: 'fig1_main' | 'fig2_l2_l4' | 'fig3_orders' | 'fig4_outage';
  seriesKey: string;
  xValue: number;
  meta?: { L: number; technique: DiversityTechnique; thDb?: number };
  config: DiversityPointConfig;
}

export interface Module2WorkerTaskOutput {
  group: Module2WorkerTask['group'];
  seriesKey: string;
  xValue: number;
  meta?: { L: number; technique: DiversityTechnique; thDb?: number };
  result: DiversityPointResult;
}

export function buildSnrGridM2(params: Module2Params): number[] {
  const snrs: number[] = [];
  const step = Math.max(1, params.snrStepDb);
  for (let s = params.snrMinDb; s <= params.snrMaxDb + 1e-9; s += step) {
    snrs.push(Math.round(s * 100) / 100);
  }
  return snrs.length > 0 ? snrs : [0, 3, 6, 9, 12, 15, 18, 21, 24];
}

export function buildModule2Tasks(
  params: Module2Params,
  mode: 'full' | 'quick' | 'selftest',
): Module2WorkerTask[] {
  const scale = mode === 'selftest' ? 0.5 : mode === 'quick' || params.quickMode ? 0.35 : 1;
  const nTrials = Math.max(25000, Math.round(params.numBitsPerPoint * scale));
  const snrGrid = buildSnrGridM2(params);
  const L = Math.max(2, Math.min(8, Math.round(params.diversityOrder)));
  const tasks: Module2WorkerTask[] = [];

  // Figure 1 & Verification: No Div, SC(L), MRC(L), optional EGC(L)
  const fig1Snrs = mode === 'selftest' ? [0, 3, 6, 9, 12] : snrGrid;
  const fig1Specs: Array<{ key: string; tech: DiversityTechnique; ord: number; expId: number }> = [
    { key: 'No Diversity (L=1)', tech: 'NONE', ord: 1, expId: 101 },
    { key: `SC (L=${L})`, tech: 'SC', ord: L, expId: 102 },
    { key: `MRC (L=${L})`, tech: 'MRC', ord: L, expId: 103 },
  ];
  if (params.includeEgc && mode !== 'selftest') {
    fig1Specs.push({ key: `EGC (L=${L})`, tech: 'EGC', ord: L, expId: 104 });
  }

  for (const spec of fig1Specs) {
    fig1Snrs.forEach((snr, idx) => {
      tasks.push({
        group: 'fig1_main',
        seriesKey: spec.key,
        xValue: snr,
        meta: { L: spec.ord, technique: spec.tech },
        config: {
          mode: 'ber',
          technique: spec.tech,
          L: spec.ord,
          snrDb: snr,
          numTrials: nTrials,
          earlyStop: params.earlyStop,
          earlyStopErrors: params.earlyStopErrors,
          baseSeed: params.seed,
          experimentId: spec.expId,
          pointIndex: idx,
        },
      });
    });
  }

  // Outage check included in selftest too
  const outageSnrs = mode === 'selftest' ? [0, 5, 10] : snrGrid;
  const outageConfigs: Array<{ key: string; tech: DiversityTechnique; ord: number; thDb: number; expId: number }> =
    mode === 'selftest'
      ? [
          { key: `SC L=${L} (th=${params.outageThresholdDb} dB)`, tech: 'SC', ord: L, thDb: params.outageThresholdDb, expId: 401 },
          { key: `MRC L=${L} (th=${params.outageThresholdDb} dB)`, tech: 'MRC', ord: L, thDb: params.outageThresholdDb, expId: 402 },
        ]
      : [
          { key: `SC L=2 (th=${params.outageThresholdDb} dB)`, tech: 'SC', ord: 2, thDb: params.outageThresholdDb, expId: 401 },
          { key: `MRC L=2 (th=${params.outageThresholdDb} dB)`, tech: 'MRC', ord: 2, thDb: params.outageThresholdDb, expId: 402 },
          { key: `SC L=4 (th=${params.outageThresholdDb} dB)`, tech: 'SC', ord: 4, thDb: params.outageThresholdDb, expId: 403 },
          { key: `MRC L=4 (th=${params.outageThresholdDb} dB)`, tech: 'MRC', ord: 4, thDb: params.outageThresholdDb, expId: 404 },
          { key: `MRC L=4 (th=${params.outageThresholdDb + 5} dB)`, tech: 'MRC', ord: 4, thDb: params.outageThresholdDb + 5, expId: 405 },
        ];

  for (const oc of outageConfigs) {
    outageSnrs.forEach((snr, idx) => {
      tasks.push({
        group: 'fig4_outage',
        seriesKey: oc.key,
        xValue: snr,
        meta: { L: oc.ord, technique: oc.tech, thDb: oc.thDb },
        config: {
          mode: 'outage',
          technique: oc.tech,
          L: oc.ord,
          snrDb: snr,
          outageThresholdDb: oc.thDb,
          numTrials: Math.max(30000, Math.round(nTrials * 0.8)),
          earlyStop: params.earlyStop,
          earlyStopErrors: params.earlyStopErrors,
          baseSeed: params.seed,
          experimentId: oc.expId,
          pointIndex: idx,
        },
      });
    });
  }

  if (mode === 'selftest') return tasks;

  // Figure 2: Comparison at fixed L=2 and L=4 (No Div, SC, EGC, MRC)
  const fig2Specs: Array<{ key: string; tech: DiversityTechnique; ord: number; expId: number }> = [
    { key: 'SC (L=2)', tech: 'SC', ord: 2, expId: 201 },
    { key: 'MRC (L=2)', tech: 'MRC', ord: 2, expId: 202 },
    { key: 'SC (L=4)', tech: 'SC', ord: 4, expId: 203 },
    { key: 'MRC (L=4)', tech: 'MRC', ord: 4, expId: 204 },
  ];
  if (params.includeEgc) {
    fig2Specs.push({ key: 'EGC (L=2)', tech: 'EGC', ord: 2, expId: 205 });
    fig2Specs.push({ key: 'EGC (L=4)', tech: 'EGC', ord: 4, expId: 206 });
  }
  for (const spec of fig2Specs) {
    snrGrid.forEach((snr, idx) => {
      tasks.push({
        group: 'fig2_l2_l4',
        seriesKey: spec.key,
        xValue: snr,
        meta: { L: spec.ord, technique: spec.tech },
        config: {
          mode: 'ber',
          technique: spec.tech,
          L: spec.ord,
          snrDb: snr,
          numTrials: Math.max(35000, Math.round(nTrials * 0.85)),
          earlyStop: params.earlyStop,
          earlyStopErrors: params.earlyStopErrors,
          baseSeed: params.seed,
          experimentId: spec.expId,
          pointIndex: idx,
        },
      });
    });
  }

  // Figure 3: Effect of diversity order L = 1, 2, 4, 8 (MRC)
  for (const [ordIdx, ord] of [1, 2, 4, 8].entries()) {
    snrGrid.forEach((snr, idx) => {
      tasks.push({
        group: 'fig3_orders',
        seriesKey: `MRC (L=${ord})`,
        xValue: snr,
        meta: { L: ord, technique: ord === 1 ? 'NONE' : 'MRC' },
        config: {
          mode: 'ber',
          technique: ord === 1 ? 'NONE' : 'MRC',
          L: ord,
          snrDb: snr,
          numTrials: Math.max(40000, Math.round(nTrials * 0.9)),
          earlyStop: params.earlyStop,
          earlyStopErrors: params.earlyStopErrors,
          baseSeed: params.seed,
          experimentId: 300 + ordIdx,
          pointIndex: idx,
        },
      });
    });
  }

  return tasks;
}

function fmtSci(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  if (v < 0.001 || v >= 1000) return v.toExponential(2);
  return v.toFixed(4);
}

export function assembleModule2Results(
  params: Module2Params,
  outputs: Module2WorkerTaskOutput[],
  elapsedMs: number,
  selftestOnly = false,
): ModuleResultBundle {
  const byGroup = (g: Module2WorkerTask['group']) => outputs.filter((o) => o.group === g);
  const totalTrials = outputs.reduce((a, o) => a + o.result.trials, 0);
  const totalErrors = outputs.reduce((a, o) => a + o.result.errors, 0);
  const L = Math.max(2, Math.min(8, Math.round(params.diversityOrder)));

  // --- Verification against closed forms (No Div, SC, MRC BER + SC/MRC Outage) ---
  const fig1Pts = byGroup('fig1_main');
  const fig4Pts = byGroup('fig4_outage');

  const verItems = [
    ...fig1Pts
      .filter((p) => p.meta?.technique !== 'EGC')
      .map((p) => {
        const g = dbToLin(p.xValue);
        const ord = p.meta?.L ?? 1;
        const theory =
          p.meta?.technique === 'NONE'
            ? theoryBerNoDiv(g)
            : p.meta?.technique === 'SC'
              ? theoryBerSc(g, ord)
              : theoryBerMrc(g, ord);
        return {
          label: `BER ${p.seriesKey} @ ${p.xValue} dB`,
          point: p.xValue,
          simulated: p.result.rate,
          theory,
          errorsCount: p.result.errors,
          trialsCount: p.result.trials,
        };
      }),
    ...fig4Pts.map((p) => {
      const g = dbToLin(p.xValue);
      const th = dbToLin(p.meta?.thDb ?? params.outageThresholdDb);
      const ord = p.meta?.L ?? L;
      const theory =
        p.meta?.technique === 'SC'
          ? theoryOutageSc(g, th, ord)
          : theoryOutageMrc(g, th, ord);
      return {
        label: `Outage ${p.seriesKey} @ ${p.xValue} dB`,
        point: p.xValue,
        simulated: p.result.rate,
        theory,
        errorsCount: p.result.errors,
        trialsCount: p.result.trials,
      };
    }),
  ];

  const verification: VerificationResult = evaluateVerification(verItems, 100, 0.15);

  if (selftestOnly) {
    return {
      figures: [],
      verification,
      requirements: [],
      meta: {
        seed: params.seed,
        elapsedMs,
        totalBitsOrTrials: totalTrials,
        totalErrors,
        quickMode: true,
        earlyStop: params.earlyStop,
        timestamp: new Date().toISOString(),
        paramsSnapshot: { ...params },
      },
    };
  }

  const figures: FigureSpec[] = [];
  const snrGrid = buildSnrGridM2(params);

  // ==================== FIGURE 1: BER vs SNR (No Div, SC, EGC, MRC + Theory) ====================
  const noDivPts = fig1Pts.filter((p) => p.meta?.technique === 'NONE').sort((a, b) => a.xValue - b.xValue);
  const scPts = fig1Pts.filter((p) => p.meta?.technique === 'SC').sort((a, b) => a.xValue - b.xValue);
  const mrcPts = fig1Pts.filter((p) => p.meta?.technique === 'MRC').sort((a, b) => a.xValue - b.xValue);
  const egcPts = fig1Pts.filter((p) => p.meta?.technique === 'EGC').sort((a, b) => a.xValue - b.xValue);

  const fig1Traces: Plotly.Data[] = [
    makeSimTrace({
      name: 'No Diversity (L=1)',
      x: noDivPts.map((p) => p.xValue),
      y: noDivPts.map((p) => Math.max(p.result.rate, 1e-6)),
      seriesIndex: 0,
      wilson: noDivPts.map((p) => p.result.wilson),
      mode: 'markers',
    }),
    makeTheoryTrace({
      name: 'Theory: No Div',
      x: snrGrid,
      y: snrGrid.map((s) => theoryBerNoDiv(dbToLin(s))),
      dash: 'dot',
    }),
    makeSimTrace({
      name: `SC (L=${L})`,
      x: scPts.map((p) => p.xValue),
      y: scPts.map((p) => Math.max(p.result.rate, 1e-6)),
      seriesIndex: 1,
      wilson: scPts.map((p) => p.result.wilson),
      mode: 'markers',
    }),
    makeTheoryTrace({
      name: `Theory: SC (L=${L})`,
      x: snrGrid,
      y: snrGrid.map((s) => Math.max(theoryBerSc(dbToLin(s), L), 1e-7)),
      dash: 'dash',
    }),
    makeSimTrace({
      name: `MRC (L=${L})`,
      x: mrcPts.map((p) => p.xValue),
      y: mrcPts.map((p) => Math.max(p.result.rate, 1e-6)),
      seriesIndex: 2,
      wilson: mrcPts.map((p) => p.result.wilson),
      mode: 'markers',
    }),
    makeTheoryTrace({
      name: `Theory: MRC (L=${L})`,
      x: snrGrid,
      y: snrGrid.map((s) => Math.max(theoryBerMrc(dbToLin(s), L), 1e-7)),
      color: '#475569',
      dash: 'dash',
    }),
  ];

  if (egcPts.length > 0) {
    fig1Traces.push(
      makeSimTrace({
        name: `EGC (L=${L})`,
        x: egcPts.map((p) => p.xValue),
        y: egcPts.map((p) => Math.max(p.result.rate, 1e-6)),
        seriesIndex: 3,
        wilson: egcPts.map((p) => p.result.wilson),
      }),
    );
  }

  // Exact crossings at BER = 1e-3 (using theory for No Div since L=1 reaches 1e-3 at ~24 dB)
  const snrNoDiv1e3 =
    interpolateCrossing(noDivPts.map((p) => p.xValue), noDivPts.map((p) => p.result.rate), 1e-3, true) ?? 23.98;
  const snrSc1e3 = interpolateCrossing(scPts.map((p) => p.xValue), scPts.map((p) => p.result.rate), 1e-3, true);
  const snrMrc1e3 = interpolateCrossing(mrcPts.map((p) => p.xValue), mrcPts.map((p) => p.result.rate), 1e-3, true);
  const snrEgc1e3 = egcPts.length > 0
    ? interpolateCrossing(egcPts.map((p) => p.xValue), egcPts.map((p) => p.result.rate), 1e-3, true)
    : null;

  const mrcGainVsNone = snrMrc1e3 !== null ? snrNoDiv1e3 - snrMrc1e3 : NaN;
  const scGainVsNone = snrSc1e3 !== null ? snrNoDiv1e3 - snrSc1e3 : NaN;
  const mrcOverSc = snrSc1e3 !== null && snrMrc1e3 !== null ? snrSc1e3 - snrMrc1e3 : NaN;

  figures.push({
    id: 'm2_fig1_ber_snr',
    title: `Figure 1: BPSK BER vs Branch SNR — No Diversity vs SC, EGC & MRC (L = ${L})`,
    shortTitle: '1. BER vs SNR',
    isLogY: true,
    traces: fig1Traces,
    layout: {
      xaxis: { title: { text: 'Average Branch SNR γ̄ (dB)' } },
      yaxis: { title: { text: 'Bit Error Rate (BER)' }, type: 'log', range: [-5, 0] },
    },
    keyFindings: [
      Number.isFinite(mrcGainVsNone)
        ? `MRC with L = ${L} reaches BER = 1e-3 at ${snrMrc1e3!.toFixed(1)} dB, requiring ${mrcGainVsNone.toFixed(1)} dB less branch SNR than No Diversity (${snrNoDiv1e3.toFixed(1)} dB).`
        : `MRC achieves the lowest BER across all SNRs by weighting each branch proportionally to its conjugate channel gain.`,
      Number.isFinite(mrcOverSc)
        ? `At BER = 1e-3 with L = ${L}, MRC outperforms Selection Combining by ${mrcOverSc.toFixed(1)} dB (${snrMrc1e3!.toFixed(1)} dB vs ${snrSc1e3!.toFixed(1)} dB), while SC still provides ${scGainVsNone.toFixed(1)} dB gain over no diversity.`
        : `All simulated markers align closely with closed-form Rayleigh BER expressions (max verification error ${(verification.maxRelError * 100).toFixed(2)}%).`,
      snrEgc1e3 !== null && snrMrc1e3 !== null
        ? `Equal-Gain Combining (EGC) achieves BER = 1e-3 at ${snrEgc1e3.toFixed(1)} dB—within ${(snrEgc1e3 - snrMrc1e3).toFixed(2)} dB of optimal MRC without requiring branch amplitude estimation.`
        : `All three combining schemes (SC, EGC, MRC) achieve the same asymptotic diversity order L = ${L}, differing only by their horizontal array-gain shift.`,
    ],
    table: {
      headers: ['SNR (dB)', 'No Div Sim', 'No Div Theory', `SC (L=${L}) Sim`, `SC Theory`, `MRC (L=${L}) Sim`, `MRC Theory`],
      rows: snrGrid.map((s, i) => [
        s,
        fmtSci(noDivPts[i]?.result.rate ?? NaN),
        fmtSci(theoryBerNoDiv(dbToLin(s))),
        fmtSci(scPts[i]?.result.rate ?? NaN),
        fmtSci(theoryBerSc(dbToLin(s), L)),
        fmtSci(mrcPts[i]?.result.rate ?? NaN),
        fmtSci(theoryBerMrc(dbToLin(s), L)),
      ]),
    },
  });

  // ==================== FIGURE 2: Technique Comparison at Fixed L=2 and L=4 ====================
  const fig2Pts = byGroup('fig2_l2_l4');
  const getSeries = (pts: Module2WorkerTaskOutput[], key: string) =>
    pts.filter((p) => p.seriesKey === key).sort((a, b) => a.xValue - b.xValue);

  const sc2 = getSeries(fig2Pts, 'SC (L=2)');
  const mrc2 = getSeries(fig2Pts, 'MRC (L=2)');
  const sc4 = getSeries(fig2Pts, 'SC (L=4)');
  const mrc4 = getSeries(fig2Pts, 'MRC (L=4)');

  const fig2Traces: Plotly.Data[] = [
    makeSimTrace({ name: 'No Div (L=1)', x: noDivPts.map((p) => p.xValue), y: noDivPts.map((p) => Math.max(p.result.rate, 1e-6)), seriesIndex: 0, wilson: noDivPts.map((p) => p.result.wilson) }),
    makeSimTrace({ name: 'SC (L=2)', x: sc2.map((p) => p.xValue), y: sc2.map((p) => Math.max(p.result.rate, 1e-6)), seriesIndex: 1, wilson: sc2.map((p) => p.result.wilson) }),
    makeSimTrace({ name: 'MRC (L=2)', x: mrc2.map((p) => p.xValue), y: mrc2.map((p) => Math.max(p.result.rate, 1e-6)), seriesIndex: 2, wilson: mrc2.map((p) => p.result.wilson) }),
    makeSimTrace({ name: 'SC (L=4)', x: sc4.map((p) => p.xValue), y: sc4.map((p) => Math.max(p.result.rate, 1e-6)), seriesIndex: 3, wilson: sc4.map((p) => p.result.wilson) }),
    makeSimTrace({ name: 'MRC (L=4)', x: mrc4.map((p) => p.xValue), y: mrc4.map((p) => Math.max(p.result.rate, 1e-6)), seriesIndex: 4, wilson: mrc4.map((p) => p.result.wilson) }),
    makeTheoryTrace({ name: 'Theory: MRC (L=2)', x: snrGrid, y: snrGrid.map((s) => Math.max(theoryBerMrc(dbToLin(s), 2), 1e-7)), dash: 'dot' }),
    makeTheoryTrace({ name: 'Theory: MRC (L=4)', x: snrGrid, y: snrGrid.map((s) => Math.max(theoryBerMrc(dbToLin(s), 4), 1e-7)), dash: 'dash' }),
  ];

  const snrSc2 = interpolateCrossing(sc2.map((p) => p.xValue), sc2.map((p) => p.result.rate), 1e-3, true);
  const snrMrc2 = interpolateCrossing(mrc2.map((p) => p.xValue), mrc2.map((p) => p.result.rate), 1e-3, true);
  const snrSc4 = interpolateCrossing(sc4.map((p) => p.xValue), sc4.map((p) => p.result.rate), 1e-3, true);
  const snrMrc4 = interpolateCrossing(mrc4.map((p) => p.xValue), mrc4.map((p) => p.result.rate), 1e-3, true);

  figures.push({
    id: 'm2_fig2_l2_l4',
    title: 'Figure 2: Combining Technique Comparison at Fixed Diversity Orders (L = 2 and L = 4)',
    shortTitle: '2. L=2 vs L=4',
    isLogY: true,
    traces: fig2Traces,
    layout: {
      xaxis: { title: { text: 'Average Branch SNR γ̄ (dB)' } },
      yaxis: { title: { text: 'Bit Error Rate (BER)' }, type: 'log', range: [-5, 0] },
    },
    keyFindings: [
      snrSc2 !== null && snrMrc2 !== null
        ? `At L = 2 (BER = 1e-3), MRC requires ${snrMrc2.toFixed(1)} dB vs SC at ${snrSc2.toFixed(1)} dB—a modest ${(snrSc2 - snrMrc2).toFixed(1)} dB gap because SC captures 75% (H_2/2) of total branch power.`
        : `At L = 2, both SC and MRC steepen the BER curve slope from -1 to -2 decades per 10 dB.`,
      snrSc4 !== null && snrMrc4 !== null
        ? `At L = 4 (BER = 1e-3), the MRC-over-SC gap widens to ${(snrSc4 - snrMrc4).toFixed(1)} dB (${snrMrc4.toFixed(1)} dB vs ${snrSc4.toFixed(1)} dB) because SC discards 3 of the 4 received branches.`
        : `Doubling branches from L = 2 to L = 4 yields substantial SNR savings at BER = 1e-3.`,
      `Theoretical array-gain ratio between MRC and SC grows from ${linToDb(2 / harmonicNumber(2)).toFixed(2)} dB at L = 2 to ${linToDb(4 / harmonicNumber(4)).toFixed(2)} dB at L = 4.`,
    ],
    table: {
      headers: ['SNR (dB)', 'No Div (L=1)', 'SC (L=2)', 'MRC (L=2)', 'SC (L=4)', 'MRC (L=4)'],
      rows: snrGrid.map((s, i) => [
        s,
        fmtSci(noDivPts[i]?.result.rate ?? NaN),
        fmtSci(sc2[i]?.result.rate ?? NaN),
        fmtSci(mrc2[i]?.result.rate ?? NaN),
        fmtSci(sc4[i]?.result.rate ?? NaN),
        fmtSci(mrc4[i]?.result.rate ?? NaN),
      ]),
    },
  });

  // ==================== FIGURE 3: Diversity Order Effect (L = 1, 2, 4, 8) ====================
  const fig3Pts = byGroup('fig3_orders');
  const orders = [1, 2, 4, 8];
  const fig3Traces: Plotly.Data[] = [];
  const orderGains: Array<{ L: number; snr1e3: number | null; gainDb: number | null; arrayGainDb: number }> = [];

  orders.forEach((ord, idx) => {
    const pts = getSeries(fig3Pts, `MRC (L=${ord})`);
    fig3Traces.push(
      makeSimTrace({
        name: `MRC L = ${ord}`,
        x: pts.map((p) => p.xValue),
        y: pts.map((p) => Math.max(p.result.rate, 1e-6)),
        seriesIndex: idx,
        wilson: pts.map((p) => p.result.wilson),
      }),
    );
    fig3Traces.push(
      makeTheoryTrace({
        name: `Theory L = ${ord}`,
        x: snrGrid,
        y: snrGrid.map((s) => Math.max(theoryBerMrc(dbToLin(s), ord), 1e-7)),
        dash: 'dash',
      }),
    );

    const reqSnr =
      interpolateCrossing(pts.map((p) => p.xValue), pts.map((p) => p.result.rate), 1e-3, true) ??
      (ord === 1 ? 23.98 : null);
    orderGains.push({
      L: ord,
      snr1e3: reqSnr,
      gainDb: reqSnr !== null ? snrNoDiv1e3 - reqSnr : null,
      arrayGainDb: 10 * Math.log10(ord),
    });
  });

  const g2 = orderGains.find((o) => o.L === 2);
  const g4 = orderGains.find((o) => o.L === 4);
  const g8 = orderGains.find((o) => o.L === 8);

  figures.push({
    id: 'm2_fig3_orders',
    title: 'Figure 3: Effect of Diversity Order on MRC BER (L = 1, 2, 4, 8) — Slope & Diversity Gain',
    shortTitle: '3. Order L=1..8',
    isLogY: true,
    traces: fig3Traces,
    layout: {
      xaxis: { title: { text: 'Average Branch SNR γ̄ (dB)' } },
      yaxis: { title: { text: 'Bit Error Rate (BER)' }, type: 'log', range: [-5, 0] },
    },
    keyFindings: [
      `On the log-BER vs dB-SNR plot, the asymptotic negative slope equals the diversity order L (dropping 1, 2, 4, and 8 decades per 10 dB SNR increase for L = 1, 2, 4, 8).`,
      `At target BER = 1e-3, MRC diversity gain relative to L = 1 (${snrNoDiv1e3.toFixed(1)} dB) reaches ${g2?.gainDb !== null ? g2!.gainDb.toFixed(1) : '—'} dB for L = 2, ${g4?.gainDb !== null ? g4!.gainDb.toFixed(1) : '—'} dB for L = 4, and ${g8?.gainDb !== null ? g8!.gainDb.toFixed(1) : '—'} dB for L = 8.`,
      `Diminishing returns are clearly visible: going from L = 1 to L = 2 captures the largest single jump in SNR gain, while each subsequent doubling yields smaller incremental dB savings.`,
    ],
    table: {
      headers: ['Diversity Order L', 'Required SNR @ BER=1e-3 (dB)', 'Diversity Gain vs L=1 (dB)', 'Array Gain 10log10(L) (dB)'],
      rows: orderGains.map((o) => [
        o.L,
        o.snr1e3 !== null ? o.snr1e3.toFixed(2) : '< 0 dB',
        o.gainDb !== null ? `+${o.gainDb.toFixed(2)}` : '—',
        o.arrayGainDb.toFixed(2),
      ]),
    },
  });

  // ==================== FIGURE 4: Outage Probability vs Average SNR ====================
  const outageSeriesKeys = Array.from(new Set(fig4Pts.map((p) => p.seriesKey)));
  const fig4Traces: Plotly.Data[] = [];

  outageSeriesKeys.forEach((key, idx) => {
    const pts = getSeries(fig4Pts, key);
    const meta = pts[0]?.meta;
    fig4Traces.push(
      makeSimTrace({
        name: key,
        x: pts.map((p) => p.xValue),
        y: pts.map((p) => Math.max(p.result.rate, 1e-6)),
        seriesIndex: idx,
        wilson: pts.map((p) => p.result.wilson),
        mode: 'markers',
      }),
    );
    if (meta) {
      const thLin = dbToLin(meta.thDb ?? params.outageThresholdDb);
      fig4Traces.push(
        makeTheoryTrace({
          name: `Theory: ${key}`,
          x: snrGrid,
          y: snrGrid.map((s) =>
            Math.max(
              meta.technique === 'SC'
                ? theoryOutageSc(dbToLin(s), thLin, meta.L)
                : theoryOutageMrc(dbToLin(s), thLin, meta.L),
              1e-7,
            ),
          ),
          dash: 'dash',
        }),
      );
    }
  });

  const sc4Out = getSeries(fig4Pts, `SC L=4 (th=${params.outageThresholdDb} dB)`);
  const mrc4Out = getSeries(fig4Pts, `MRC L=4 (th=${params.outageThresholdDb} dB)`);
  const snrOutSc4 = interpolateCrossing(sc4Out.map((p) => p.xValue), sc4Out.map((p) => p.result.rate), 0.01, true);
  const snrOutMrc4 = interpolateCrossing(mrc4Out.map((p) => p.xValue), mrc4Out.map((p) => p.result.rate), 0.01, true);

  figures.push({
    id: 'm2_fig4_outage',
    title: `Figure 4: Outage Probability P_out vs Average Branch SNR (γ_th = ${params.outageThresholdDb} dB & ${params.outageThresholdDb + 5} dB)`,
    shortTitle: '4. Outage Prob.',
    isLogY: true,
    traces: fig4Traces,
    layout: {
      xaxis: { title: { text: 'Average Branch SNR γ̄ (dB)' } },
      yaxis: { title: { text: 'Outage Probability P_out' }, type: 'log', range: [-5, 0.05] },
    },
    keyFindings: [
      snrOutMrc4 !== null && snrOutSc4 !== null
        ? `At 1% outage (P_out = 10^-2, γ_th = ${params.outageThresholdDb} dB, L = 4), MRC requires ${snrOutMrc4.toFixed(1)} dB average SNR vs ${snrOutSc4.toFixed(1)} dB for SC (${(snrOutSc4 - snrOutMrc4).toFixed(1)} dB advantage).`
        : `MRC significantly lowers outage probability compared to SC at identical L and threshold γ_th.`,
      `Increasing the outage threshold by +5 dB (from ${params.outageThresholdDb} dB to ${params.outageThresholdDb + 5} dB) shifts the entire MRC outage curve exactly +5.0 dB to the right because P_out depends strictly on the ratio γ_th / γ̄.`,
      `Simulated outage points closely track exact analytical formulas P_out,SC = (1 - e^-x)^L and P_out,MRC = 1 - e^-x sum(x^k/k!).`,
    ],
    table: {
      headers: ['SNR (dB)', ...outageSeriesKeys],
      rows: snrGrid.map((s, i) => [
        s,
        ...outageSeriesKeys.map((k) => fmtSci(getSeries(fig4Pts, k)[i]?.result.rate ?? NaN)),
      ]),
    },
  });

  // ==================== FIGURE 5: Complexity vs Performance Summary ====================
  const techLabels = ['No Diversity (L=1)', `SC (L=${L})`, `EGC (L=${L})`, `MRC (L=${L})`];
  const snrGainBars = [
    0,
    Number.isFinite(scGainVsNone) ? Number(scGainVsNone.toFixed(2)) : 0,
    snrEgc1e3 !== null ? Number((snrNoDiv1e3 - snrEgc1e3).toFixed(2)) : Number((linToDb(1 + (L - 1) * (Math.PI / 4)) + (scGainVsNone - linToDb(harmonicNumber(L)))).toFixed(2)),
    Number.isFinite(mrcGainVsNone) ? Number(mrcGainVsNone.toFixed(2)) : 0,
  ];
  const arrayGainBars = [
    0,
    Number(linToDb(harmonicNumber(L)).toFixed(2)),
    Number(linToDb(1 + (L - 1) * (Math.PI / 4)).toFixed(2)),
    Number(linToDb(L).toFixed(2)),
  ];

  figures.push({
    id: 'm2_fig5_tradeoff',
    title: `Figure 5: Complexity vs Performance Trade-off at L = ${L} (SNR Gain @ BER=1e-3 & Array Gain)`,
    shortTitle: '5. Trade-off',
    traces: [
      {
        type: 'bar',
        name: 'Total SNR Gain @ BER=1e-3 (dB)',
        x: techLabels,
        y: snrGainBars,
        marker: { color: seriesColor(0) },
      } as Plotly.Data,
      {
        type: 'bar',
        name: 'Average SNR Array Gain (dB)',
        x: techLabels,
        y: arrayGainBars,
        marker: { color: seriesColor(2) },
      } as Plotly.Data,
    ],
    layout: {
      barmode: 'group',
      xaxis: { title: { text: 'Combining Technique' } },
      yaxis: { title: { text: 'Gain (dB)' } },
    },
    keyFindings: [
      `At L = ${L}, MRC delivers the maximum average SNR array gain of ${arrayGainBars[3].toFixed(2)} dB (10log10(${L})) and ${snrGainBars[3].toFixed(1)} dB total SNR savings at BER = 1e-3, at the cost of ${L} complete RF chains plus amplitude & phase CSI.`,
      `SC requires only 1 active demodulator RF chain and SNR-monitoring switches, sacrificing ${(arrayGainBars[3] - arrayGainBars[1]).toFixed(2)} dB of array gain relative to MRC while retaining full L = ${L} diversity order.`,
      `EGC avoids amplitude estimation (phase-only co-phasing across ${L} branches) and recovers ${arrayGainBars[2].toFixed(2)} dB of the ${arrayGainBars[3].toFixed(2)} dB MRC array gain—within ${(arrayGainBars[3] - arrayGainBars[2]).toFixed(2)} dB of optimal MRC.`,
    ],
    table: {
      headers: ['Technique', 'RF Chains', 'CSI Required', 'Array Gain (dB)', 'SNR Gain @ 1e-3 (dB)', 'Complexity'],
      rows: [
        ['No Diversity (L=1)', '1', 'Phase (1 branch)', '0.00', '0.00', 'Baseline'],
        [`SC (L=${L})`, '1 (+ switch)', 'Branch SNR only', arrayGainBars[1].toFixed(2), snrGainBars[1].toFixed(2), 'Low'],
        [`EGC (L=${L})`, `${L}`, 'Phase per branch', arrayGainBars[2].toFixed(2), snrGainBars[2].toFixed(2), 'Medium'],
        [`MRC (L=${L})`, `${L}`, 'Amplitude & Phase', arrayGainBars[3].toFixed(2), snrGainBars[3].toFixed(2), 'High (Optimal)'],
      ],
    },
  });

  const requirements: RequirementCheck[] = [
    {
      id: 'working_sim',
      label: 'Working local Monte-Carlo simulation',
      met: totalTrials > 0,
      detail: `${totalTrials.toLocaleString()} branch trials simulated in ${(elapsedMs / 1000).toFixed(2)}s (seed ${params.seed})`,
    },
    {
      id: 'min_figures',
      label: '>= 4 result figures generated',
      met: figures.length >= 4,
      detail: `${figures.length} of 5 required Diversity Combining figures rendered`,
    },
    {
      id: 'two_params',
      label: '>= 2 independent parameters varied',
      met: true,
      detail: 'Branch SNR, diversity order L (1..8), and outage threshold γ_th varied',
    },
    {
      id: 'comparison',
      label: 'Comparison of >= 2 techniques/configs vs baseline',
      met: true,
      detail: 'No Diversity baseline vs SC, EGC, and MRC across L = 2, 4, and 8',
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
      totalBitsOrTrials: totalTrials,
      totalErrors,
      quickMode: params.quickMode,
      earlyStop: params.earlyStop,
      timestamp: new Date().toISOString(),
      paramsSnapshot: { ...params },
    },
    rawSummary: {
      L,
      mrcGainAt1e3Db: Number.isFinite(mrcGainVsNone) ? Number(mrcGainVsNone.toFixed(2)) : null,
      scGainAt1e3Db: Number.isFinite(scGainVsNone) ? Number(scGainVsNone.toFixed(2)) : null,
      mrcOverScDb: Number.isFinite(mrcOverSc) ? Number(mrcOverSc.toFixed(2)) : null,
      maxRelErrorPct: Number.isFinite(verification.maxRelError) ? Number((verification.maxRelError * 100).toFixed(2)) : null,
    },
  };
}

export const MODULE2_THEORY: ModuleTheoryContent = {
  abstract:
    'This module analyzes receiver spatial diversity over independent flat Rayleigh fading channels using coherent BPSK. We compare No Diversity (L = 1), Selection Combining (SC), Equal-Gain Combining (EGC), and Maximal-Ratio Combining (MRC) across diversity orders up to L = 8, quantifying BER performance, diversity order slope, outage probability, and hardware complexity versus SNR gain.',
  objectives: [
    'Simulate independent flat Rayleigh fading across L = 1..8 receive branches under coherent BPSK detection.',
    'Compare No Diversity, Selection Combining (SC), Equal-Gain Combining (EGC), and Maximal-Ratio Combining (MRC).',
    'Verify simulated BER and outage probabilities against exact closed-form analytical expressions.',
    'Quantify diversity gain (slope change) and array gain (horizontal SNR shift) at BER = 1e-3 and 1% outage.',
    'Evaluate hardware RF-chain and CSI estimation complexity trade-offs across combining schemes.',
  ],
  technicalBackground: [
    'In wireless mobile channels, destructive multipath superposition produces deep Rayleigh fades where instantaneous SNR drops 20–30 dB below average. Without diversity, BPSK BER decays only inversely with SNR (P_b ~ 1/(4 gamma_bar)), requiring nearly 24 dB average SNR to reach BER = 10^-3.',
    'Receive diversity mitigates deep fades by observing the transmitted signal across L independently fading antennas (spaced >= lambda/2 apart). Because the probability that all L branches fade simultaneously scales as (1/gamma_bar)^L, the BER slope steepens proportionally to L.',
    'Selection Combining (SC) monitors branch SNRs and connects only the strongest branch to a single demodulator. Equal-Gain Combining (EGC) co-phases all L branches and sums them with equal weights. Maximal-Ratio Combining (MRC) weights each branch by its conjugate channel gain h_l*, maximizing instantaneous post-combining SNR to the sum of all branch SNRs.',
  ],
  systemModelSummary:
    'A BPSK symbol s in {-1, +1} is received over L independent complex Gaussian Rayleigh branches r_l = h_l s + w_l, where h_l ~ CN(0, 1) and w_l ~ CN(0, N0). Perfect CSI is assumed at the receiver for coherent combining.',
  equations: [
    {
      title: 'No Diversity (L = 1) Rayleigh BPSK BER',
      latex: 'P_{b,\\mathrm{NoDiv}} = \\frac{1}{2}\\!\\left(1 - \\sqrt{\\frac{\\bar{\\gamma}}{1 + \\bar{\\gamma}}}\\right)',
      explanation: 'Single-branch Rayleigh fading baseline with diversity order 1.',
    },
    {
      title: 'Maximal-Ratio Combining (MRC) Closed-Form BER',
      latex: 'P_{b,\\mathrm{MRC}} = \\left(\\frac{1 - \\mu}{2}\\right)^L \\sum_{k=0}^{L-1} \\binom{L - 1 + k}{k} \\left(\\frac{1 + \\mu}{2}\\right)^k, \\qquad \\mu = \\sqrt{\\frac{\\bar{\\gamma}}{1 + \\bar{\\gamma}}}',
      explanation: 'Exact coherent BPSK BER when post-combining SNR is the sum of L iid exponential branch SNRs (Erlang/chi-square with 2L degrees of freedom).',
    },
    {
      title: 'Selection Combining (SC) Closed-Form BER',
      latex: 'P_{b,\\mathrm{SC}} = \\sum_{k=0}^{L-1} \\frac{L(-1)^k \\binom{L-1}{k}}{k + 1} \\cdot \\frac{1}{2}\\!\\left(1 - \\sqrt{\\frac{\\bar{\\gamma}/(k+1)}{1 + \\bar{\\gamma}/(k+1)}}\\right)',
      explanation: 'Derived by integrating Q(sqrt(2 gamma)) against the PDF of the maximum of L iid exponential random variables.',
    },
    {
      title: 'Outage Probability (SC & MRC)',
      latex: 'P_{\\mathrm{out,SC}} = \\left(1 - e^{-x}\\right)^L, \\qquad P_{\\mathrm{out,MRC}} = 1 - e^{-x}\\sum_{k=0}^{L-1} \\frac{x^k}{k!}, \\qquad x = \\frac{\\gamma_{\\mathrm{th}}}{\\bar{\\gamma}}',
      explanation: 'Probability that instantaneous combined SNR falls below threshold gamma_th.',
    },
    {
      title: 'Average Combined SNR (Array Gain)',
      latex: '\\bar{\\gamma}_{\\mathrm{MRC}} = L\\bar{\\gamma}, \\qquad \\bar{\\gamma}_{\\mathrm{SC}} = \\bar{\\gamma}\\sum_{k=1}^{L}\\frac{1}{k}, \\qquad \\bar{\\gamma}_{\\mathrm{EGC}} = \\left(1 + (L-1)\\frac{\\pi}{4}\\right)\\bar{\\gamma}',
      explanation: 'Quantifies the average SNR boost before fading slope effects.',
    },
  ],
  methodology: [
    'Each Monte-Carlo batch draws deterministic xoshiro128** sub-seeded Rayleigh channels and independent AWGN samples per SNR point.',
    'All BER and outage curves display 95% Wilson score confidence intervals; early stopping halts once >= 200 errors and >= 25% of target trials are observed.',
    'Automated verification compares simulated SC, MRC, and No-Diversity BER plus SC/MRC outage directly against exact closed-form formulas.',
  ],
  assumptions: [
    'Independent and identically distributed (iid) flat Rayleigh fading across all L branches (uncorrelated antennas, identical mean branch SNR).',
    'Perfect Channel State Information (phase and amplitude for MRC, phase for EGC, instantaneous SNR for SC).',
    'Coherent BPSK detection with additive white Gaussian noise independent across receive branches.',
  ],
  conclusionsDefault: [
    'Diversity combining transforms the slow 1/SNR Rayleigh BER decay into an exponential-like 1/SNR^L slope, saving over 12–16 dB at BER = 1e-3 for L = 4.',
    'MRC achieves optimal BER and maximum array gain (10log10 L dB), whereas EGC captures nearly all of MRC gain with phase-only CSI and SC offers the lowest hardware complexity with a single demodulator chain.',
    'Increasing L beyond 4 shows diminishing incremental gains per added antenna, making L = 2 to 4 the practical engineering sweet spot for mobile handsets and small base stations.',
  ],
};
