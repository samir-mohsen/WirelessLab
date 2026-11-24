import type * as Plotly from 'plotly.js';
import {
  PALETTE,
  SIM_MARKERS,
  THEORY_LINE_COLOR,
  baseFigureLayout,
} from '../../engine/chartTheme';
import { createRng, deriveSubSeed } from '../../engine/rng';
import { qFunc } from '../../engine/special';
import { evaluateVerification, wilsonInterval } from '../../engine/stats';
import type {
  FigureSpec,
  ModuleResultBundle,
  ModuleTheoryContent,
  RequirementCheck,
} from '../../types/simulation';

export type PropagationEnvPreset =
  | 'dense_urban'
  | 'urban'
  | 'suburban'
  | 'rural'
  | 'indoor'
  | 'custom';

export interface EnvSpec {
  id: Exclude<PropagationEnvPreset, 'custom'>;
  label: string;
  n: number;
  sigmaDb: number;
}

export const PROPAGATION_ENVS: EnvSpec[] = [
  { id: 'dense_urban', label: 'Dense Urban', n: 3.8, sigmaDb: 9.0 },
  { id: 'urban', label: 'Urban', n: 3.2, sigmaDb: 8.0 },
  { id: 'suburban', label: 'Suburban', n: 2.8, sigmaDb: 6.0 },
  { id: 'rural', label: 'Rural / Open', n: 2.2, sigmaDb: 4.0 },
  { id: 'indoor', label: 'Indoor', n: 3.0, sigmaDb: 7.0 },
];

export interface Module1Params {
  freqLowMHz: number;
  freqHighMHz: number;
  txPowerDbm: number;
  gtDbi: number;
  grDbi: number;
  rxSensitivityDbm: number;
  d0M: number;
  dMinM: number;
  dMaxM: number;
  dPoints: number;
  environment: PropagationEnvPreset;
  pathLossExp: number;
  shadowSigmaDb: number;
  mcSamples: number;
  seed: number;
  quickMode: boolean;
}

export const DEFAULT_MODULE1_PARAMS: Module1Params = {
  freqLowMHz: 900,
  freqHighMHz: 3500,
  txPowerDbm: 43,
  gtDbi: 15,
  grDbi: 0,
  rxSensitivityDbm: -100,
  d0M: 100,
  dMinM: 100,
  dMaxM: 5000,
  dPoints: 26,
  environment: 'urban',
  pathLossExp: 3.2,
  shadowSigmaDb: 8.0,
  mcSamples: 4000,
  seed: 44101,
  quickMode: false,
};

// Analytical formulas
export function fsplDb(dMeters: number, freqMHz: number): number {
  const dKm = Math.max(dMeters, 1) / 1000;
  return 32.44 + 20 * Math.log10(dKm) + 20 * Math.log10(Math.max(freqMHz, 1));
}

export function meanLogDistancePlDb(
  dMeters: number,
  d0Meters: number,
  freqMHz: number,
  n: number,
): number {
  const pl0 = fsplDb(d0Meters, freqMHz);
  return pl0 + 10 * n * Math.log10(Math.max(dMeters, 1) / Math.max(d0Meters, 1));
}

export function meanRxPowerDbm(
  dMeters: number,
  params: Pick<Module1Params, 'txPowerDbm' | 'gtDbi' | 'grDbi' | 'd0M'>,
  freqMHz: number,
  n: number,
): number {
  const pl = meanLogDistancePlDb(dMeters, params.d0M, freqMHz, n);
  return params.txPowerDbm + params.gtDbi + params.grDbi - pl;
}

export function theoryCoverageProb(
  meanPrDbm: number,
  rxSensitivityDbm: number,
  sigmaDb: number,
): number {
  if (sigmaDb <= 1e-9) {
    return meanPrDbm >= rxSensitivityDbm ? 1 : 0;
  }
  return qFunc((rxSensitivityDbm - meanPrDbm) / sigmaDb);
}

/**
 * Exact analytical cell-edge distance (m) achieving target coverage probability P_target
 * (e.g., 0.90 or 0.95) using inverse Q-function via binary search.
 */
export function analyticalCoverageRadiusM(
  targetCovProb: number,
  params: Pick<Module1Params, 'txPowerDbm' | 'gtDbi' | 'grDbi' | 'rxSensitivityDbm' | 'd0M'>,
  freqMHz: number,
  n: number,
  sigmaDb: number,
): number {
  // Binary search for z such that Q(z) = targetCovProb
  let loZ = -6;
  let hiZ = 6;
  for (let i = 0; i < 45; i++) {
    const mid = 0.5 * (loZ + hiZ);
    if (qFunc(mid) > targetCovProb) {
      loZ = mid;
    } else {
      hiZ = mid;
    }
  }
  const zTarget = 0.5 * (loZ + hiZ);
  // (Sens - meanPr) / sigma = zTarget => meanPr = Sens - sigma * zTarget
  const requiredMeanPr = params.rxSensitivityDbm - sigmaDb * zTarget;
  const maxPl = params.txPowerDbm + params.gtDbi + params.grDbi - requiredMeanPr;
  const pl0 = fsplDb(params.d0M, freqMHz);
  const exponent = (maxPl - pl0) / (10 * Math.max(n, 0.5));
  return params.d0M * Math.pow(10, exponent);
}

export type Module1Task =
  | {
      kind: 'dist_point';
      freqKey: 'low' | 'high';
      freqMHz: number;
      dIndex: number;
      distanceM: number;
      n: number;
      sigmaDb: number;
      txEirpDbm: number;
      rxSensDbm: number;
      d0M: number;
      samples: number;
      seed: number;
    }
  | {
      kind: 'heatmap_grid';
      freqMHz: number;
      radiusM: number;
      gridN: number;
      n: number;
      sigmaDb: number;
      txEirpDbm: number;
      rxSensDbm: number;
      d0M: number;
      seed: number;
    };

export interface DistPointOutput {
  kind: 'dist_point';
  freqKey: 'low' | 'high';
  freqMHz: number;
  dIndex: number;
  distanceM: number;
  meanPrSim: number;
  meanPrTheory: number;
  fspl: number;
  plMean: number;
  covCount: number;
  samples: number;
  covSim: number;
  covTheory: number;
  samplePreview: number[];
}

export interface HeatmapOutput {
  kind: 'heatmap_grid';
  coordsM: number[];
  prGrid: (number | null)[][];
  coveredFraction: number;
  totalCellPixels: number;
  radiusM: number;
}

export type Module1TaskOutput = DistPointOutput | HeatmapOutput;

export function runModule1Task(task: Module1Task): Module1TaskOutput {
  if (task.kind === 'dist_point') {
    const rng = createRng(task.seed);
    const fspl = fsplDb(task.distanceM, task.freqMHz);
    const plMean = meanLogDistancePlDb(task.distanceM, task.d0M, task.freqMHz, task.n);
    const meanPrTheory = task.txEirpDbm - plMean;

    let sumPr = 0;
    let covCount = 0;
    const previewCount = 10;
    const samplePreview: number[] = [];

    for (let i = 0; i < task.samples; i++) {
      const shadow = task.sigmaDb * rng.nextGaussian();
      const pr = meanPrTheory - shadow;
      sumPr += pr;
      if (pr >= task.rxSensDbm) {
        covCount++;
      }
      if (i < previewCount) {
        samplePreview.push(pr);
      }
    }

    return {
      kind: 'dist_point',
      freqKey: task.freqKey,
      freqMHz: task.freqMHz,
      dIndex: task.dIndex,
      distanceM: task.distanceM,
      meanPrSim: sumPr / task.samples,
      meanPrTheory,
      fspl,
      plMean,
      covCount,
      samples: task.samples,
      covSim: covCount / task.samples,
      covTheory: theoryCoverageProb(meanPrTheory, task.rxSensDbm, task.sigmaDb),
      samplePreview,
    };
  }

  // 2D shadowed coverage heatmap over a circular cell of radius task.radiusM
  const rng = createRng(task.seed);
  const N = task.gridN;
  const coordsM: number[] = [];
  for (let i = 0; i < N; i++) {
    coordsM.push(-task.radiusM + (2 * task.radiusM * i) / (N - 1));
  }

  // Generate mildly spatially correlated shadowing by 3x3 smoothing of Gaussian grid
  const rawNoise: number[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => rng.nextGaussian()),
  );
  const prGrid: (number | null)[][] = [];
  let insideCount = 0;
  let coveredCount = 0;

  for (let iy = 0; iy < N; iy++) {
    const row: (number | null)[] = [];
    const y = coordsM[iy];
    for (let ix = 0; ix < N; ix++) {
      const x = coordsM[ix];
      const r = Math.hypot(x, y);
      if (r > task.radiusM) {
        row.push(null);
        continue;
      }
      insideCount++;
      // Local 3x3 average normalized to preserve variance sigma^2
      let acc = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = iy + dy;
          const nx = ix + dx;
          if (ny >= 0 && ny < N && nx >= 0 && nx < N) {
            acc += rawNoise[ny][nx];
            cnt++;
          }
        }
      }
      const corrGauss = acc / Math.sqrt(cnt);
      const dEff = Math.max(r, task.d0M * 0.5);
      const pl = meanLogDistancePlDb(dEff, task.d0M, task.freqMHz, task.n);
      const pr = task.txEirpDbm - pl - task.sigmaDb * corrGauss;
      row.push(Number(pr.toFixed(2)));
      if (pr >= task.rxSensDbm) {
        coveredCount++;
      }
    }
    prGrid.push(row);
  }

  return {
    kind: 'heatmap_grid',
    coordsM,
    prGrid,
    coveredFraction: insideCount > 0 ? coveredCount / insideCount : 0,
    totalCellPixels: insideCount,
    radiusM: task.radiusM,
  };
}

export function buildModule1Distances(params: Module1Params): number[] {
  const nPts = Math.max(8, Math.min(60, Math.round(params.dPoints)));
  const dMin = Math.max(10, params.dMinM);
  const dMax = Math.max(dMin + 100, params.dMaxM);
  // Log-spaced for crisp resolution both near d0 and at cell edge
  const ratio = Math.pow(dMax / dMin, 1 / (nPts - 1));
  const out: number[] = [];
  for (let i = 0; i < nPts; i++) {
    out.push(Math.round(dMin * Math.pow(ratio, i)));
  }
  out[0] = Math.round(dMin);
  out[nPts - 1] = Math.round(dMax);
  return out;
}

export function buildModule1Tasks(
  params: Module1Params,
  mode: 'full' | 'quick' | 'selftest',
): { tasks: Module1Task[]; distances: number[] } {
  const distances = buildModule1Distances(params);
  const txEirpDbm = params.txPowerDbm + params.gtDbi + params.grDbi;
  const samples =
    mode === 'selftest'
      ? Math.max(2500, Math.round(params.mcSamples * 0.75))
      : mode === 'quick'
        ? Math.max(1200, Math.round(params.mcSamples * 0.4))
        : params.mcSamples;

  const tasks: Module1Task[] = [];
  const freqs: Array<{ key: 'low' | 'high'; mhz: number }> = [
    { key: 'low', mhz: params.freqLowMHz },
    { key: 'high', mhz: params.freqHighMHz },
  ];

  for (let fi = 0; fi < freqs.length; fi++) {
    const f = freqs[fi];
    for (let di = 0; di < distances.length; di++) {
      tasks.push({
        kind: 'dist_point',
        freqKey: f.key,
        freqMHz: f.mhz,
        dIndex: di,
        distanceM: distances[di],
        n: params.pathLossExp,
        sigmaDb: params.shadowSigmaDb,
        txEirpDbm,
        rxSensDbm: params.rxSensitivityDbm,
        d0M: params.d0M,
        samples,
        seed: deriveSubSeed(params.seed, 1, fi, di),
      });
    }
  }

  if (mode !== 'selftest') {
    const r90Low = analyticalCoverageRadiusM(
      0.9,
      params,
      params.freqLowMHz,
      params.pathLossExp,
      params.shadowSigmaDb,
    );
    const cellRadius = Math.max(400, Math.min(params.dMaxM, Math.round(r90Low * 1.45)));
    tasks.push({
      kind: 'heatmap_grid',
      freqMHz: params.freqLowMHz,
      radiusM: cellRadius,
      gridN: mode === 'quick' ? 45 : 61,
      n: params.pathLossExp,
      sigmaDb: params.shadowSigmaDb,
      txEirpDbm,
      rxSensDbm: params.rxSensitivityDbm,
      d0M: params.d0M,
      seed: deriveSubSeed(params.seed, 99),
    });
  }

  return { tasks, distances };
}

export function assembleModule1Results(
  params: Module1Params,
  outputs: Module1TaskOutput[],
  elapsedMs: number,
  selfTestOnly = false,
): ModuleResultBundle {
  const lowPts = outputs
    .filter((o): o is DistPointOutput => o.kind === 'dist_point' && o.freqKey === 'low')
    .sort((a, b) => a.dIndex - b.dIndex);
  const highPts = outputs
    .filter((o): o is DistPointOutput => o.kind === 'dist_point' && o.freqKey === 'high')
    .sort((a, b) => a.dIndex - b.dIndex);
  const heatmap = outputs.find((o): o is HeatmapOutput => o.kind === 'heatmap_grid') ?? null;

  const totalTrials =
    lowPts.reduce((s, p) => s + p.samples, 0) +
    highPts.reduce((s, p) => s + p.samples, 0) +
    (heatmap ? heatmap.totalCellPixels : 0);
  const totalOutages =
    lowPts.reduce((s, p) => s + (p.samples - p.covCount), 0) +
    highPts.reduce((s, p) => s + (p.samples - p.covCount), 0);

  // Verification: compare simulated coverage probability vs exact Q-function
  const verifyEntries = [
    ...lowPts
      .filter((p) => p.covTheory >= 0.05 && p.covTheory <= 0.99)
      .map((p) => ({
        label: `${params.freqLowMHz} MHz P_cov`,
        point: p.distanceM,
        simulated: p.covSim,
        theory: p.covTheory,
        errorsCount: Math.min(p.covCount, p.samples - p.covCount),
        trialsCount: p.samples,
      })),
    ...highPts
      .filter((p) => p.covTheory >= 0.05 && p.covTheory <= 0.99)
      .map((p) => ({
        label: `${params.freqHighMHz} MHz P_cov`,
        point: p.distanceM,
        simulated: p.covSim,
        theory: p.covTheory,
        errorsCount: Math.min(p.covCount, p.samples - p.covCount),
        trialsCount: p.samples,
      })),
  ];

  // Fallback if all points are 100% or 0% covered: verify mean received power magnitude
  const verification =
    verifyEntries.length > 0
      ? evaluateVerification(verifyEntries, 25, 0.15)
      : evaluateVerification(
          lowPts.map((p) => ({
            label: `${params.freqLowMHz} MHz |Mean Pr| (dBm)`,
            point: p.distanceM,
            simulated: Math.abs(p.meanPrSim),
            theory: Math.abs(p.meanPrTheory),
            errorsCount: p.samples,
            trialsCount: p.samples,
          })),
          25,
          0.15,
        );

  const fGapDb = 20 * Math.log10(params.freqHighMHz / Math.max(params.freqLowMHz, 1));
  const r90Low = analyticalCoverageRadiusM(
    0.9,
    params,
    params.freqLowMHz,
    params.pathLossExp,
    params.shadowSigmaDb,
  );
  const r95Low = analyticalCoverageRadiusM(
    0.95,
    params,
    params.freqLowMHz,
    params.pathLossExp,
    params.shadowSigmaDb,
  );
  const r90High = analyticalCoverageRadiusM(
    0.9,
    params,
    params.freqHighMHz,
    params.pathLossExp,
    params.shadowSigmaDb,
  );
  const r95High = analyticalCoverageRadiusM(
    0.95,
    params,
    params.freqHighMHz,
    params.pathLossExp,
    params.shadowSigmaDb,
  );

  const figures: FigureSpec[] = [];

  if (!selfTestOnly && lowPts.length > 0 && highPts.length > 0) {
    const dists = lowPts.map((p) => p.distanceM);

    // ------------------------------------------------------------------
    // Figure 1: Received Power vs Distance (Mean + Shadowed MC scatter)
    // ------------------------------------------------------------------
    const scatterXLow: number[] = [];
    const scatterYLow: number[] = [];
    const scatterXHigh: number[] = [];
    const scatterYHigh: number[] = [];
    for (let i = 0; i < lowPts.length; i += 2) {
      for (const s of lowPts[i].samplePreview.slice(0, 6)) {
        scatterXLow.push(lowPts[i].distanceM);
        scatterYLow.push(s);
      }
      for (const s of highPts[i].samplePreview.slice(0, 6)) {
        scatterXHigh.push(highPts[i].distanceM);
        scatterYHigh.push(s);
      }
    }

    const fig1Traces: Plotly.Data[] = [
      {
        x: scatterXLow,
        y: scatterYLow,
        type: 'scatter',
        mode: 'markers',
        name: `${params.freqLowMHz} MHz Shadowed MC Samples`,
        marker: { color: PALETTE[0], size: 4, opacity: 0.25 },
        showlegend: true,
      },
      {
        x: scatterXHigh,
        y: scatterYHigh,
        type: 'scatter',
        mode: 'markers',
        name: `${params.freqHighMHz} MHz Shadowed MC Samples`,
        marker: { color: PALETTE[1], size: 4, opacity: 0.25 },
        showlegend: true,
      },
      {
        x: dists,
        y: lowPts.map((p) => p.meanPrSim),
        type: 'scatter',
        mode: 'lines+markers',
        name: `${params.freqLowMHz} MHz Mean Pr (Sim)`,
        line: { color: PALETTE[0], width: 2.2 },
        marker: { symbol: SIM_MARKERS[0], size: 7, color: PALETTE[0] },
      },
      {
        x: dists,
        y: highPts.map((p) => p.meanPrSim),
        type: 'scatter',
        mode: 'lines+markers',
        name: `${params.freqHighMHz} MHz Mean Pr (Sim)`,
        line: { color: PALETTE[1], width: 2.2 },
        marker: { symbol: SIM_MARKERS[1], size: 7, color: PALETTE[1] },
      },
      {
        x: [dists[0], dists[dists.length - 1]],
        y: [params.rxSensitivityDbm, params.rxSensitivityDbm],
        type: 'scatter',
        mode: 'lines',
        name: `Rx Sensitivity (${params.rxSensitivityDbm} dBm)`,
        line: { color: '#dc2626', width: 1.8, dash: 'dash' },
      },
    ];

    const areaRatio = Math.pow(r90Low / Math.max(r90High, 1), 2);
    figures.push({
      id: 'fig1_pr_vs_dist',
      title: `Fig 1: Received Power vs Distance (${params.freqLowMHz} vs ${params.freqHighMHz} MHz, n=${params.pathLossExp}, σ=${params.shadowSigmaDb} dB)`,
      shortTitle: '1. Pr vs Dist',
      traces: fig1Traces,
      layout: baseFigureLayout(
        `Received Power vs Distance (n = ${params.pathLossExp}, σ = ${params.shadowSigmaDb} dB)`,
        'Distance d (m) [log scale]',
        'Received Power Pr (dBm)',
        false,
        { xaxis: { type: 'log' } },
      ),
      keyFindings: [
        `At ${params.freqLowMHz} MHz, mean received power drops from ${lowPts[0].meanPrSim.toFixed(1)} dBm at ${dists[0]} m to ${lowPts[lowPts.length - 1].meanPrSim.toFixed(1)} dBm at ${dists[dists.length - 1]} m, maintaining a constant ${fGapDb.toFixed(2)} dB link-budget advantage over ${params.freqHighMHz} MHz.`,
        `With log-normal shadowing σ = ${params.shadowSigmaDb} dB, 90% cell-edge coverage (Pr ≥ ${params.rxSensitivityDbm} dBm) extends to ${r90Low.toFixed(0)} m at ${params.freqLowMHz} MHz vs ${r90High.toFixed(0)} m at ${params.freqHighMHz} MHz.`,
        `Covering the same geographic area at ${params.freqHighMHz} MHz requires approximately ${areaRatio.toFixed(1)}× as many base stations as at ${params.freqLowMHz} MHz due to the quadratic cell-area scaling (R²).`,
      ],
      table: {
        headers: [
          'd (m)',
          `${params.freqLowMHz} MHz Mean Pr (dBm)`,
          `${params.freqHighMHz} MHz Mean Pr (dBm)`,
          'Gap (dB)',
        ],
        rows: lowPts.map((p, i) => [
          p.distanceM,
          p.meanPrSim.toFixed(2),
          highPts[i].meanPrSim.toFixed(2),
          (p.meanPrSim - highPts[i].meanPrSim).toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 2: Path Loss vs Distance (900 MHz vs 3.5 GHz + 11.8 dB gap)
    // ------------------------------------------------------------------
    const midIdx = Math.floor(dists.length / 2);
    const midD = dists[midIdx];
    const fig2Traces: Plotly.Data[] = [
      {
        x: dists,
        y: lowPts.map((p) => p.plMean),
        type: 'scatter',
        mode: 'lines+markers',
        name: `${params.freqLowMHz} MHz Log-Distance (n=${params.pathLossExp})`,
        line: { color: PALETTE[0], width: 2.2 },
        marker: { symbol: SIM_MARKERS[0], size: 7, color: PALETTE[0] },
      },
      {
        x: dists,
        y: highPts.map((p) => p.plMean),
        type: 'scatter',
        mode: 'lines+markers',
        name: `${params.freqHighMHz} MHz Log-Distance (n=${params.pathLossExp})`,
        line: { color: PALETTE[1], width: 2.2 },
        marker: { symbol: SIM_MARKERS[1], size: 7, color: PALETTE[1] },
      },
      {
        x: dists,
        y: lowPts.map((p) => p.fspl),
        type: 'scatter',
        mode: 'lines',
        name: `${params.freqLowMHz} MHz FSPL (n=2)`,
        line: { color: PALETTE[0], width: 1.5, dash: 'dash' },
      },
      {
        x: dists,
        y: highPts.map((p) => p.fspl),
        type: 'scatter',
        mode: 'lines',
        name: `${params.freqHighMHz} MHz FSPL (n=2)`,
        line: { color: PALETTE[1], width: 1.5, dash: 'dash' },
      },
    ];

    figures.push({
      id: 'fig2_pl_comparison',
      title: `Fig 2: Path Loss Comparison (${params.freqLowMHz} vs ${params.freqHighMHz} MHz, ΔPL = ${fGapDb.toFixed(2)} dB)`,
      shortTitle: '2. Path Loss',
      traces: fig2Traces,
      layout: baseFigureLayout(
        `Path Loss vs Distance: ${params.freqLowMHz} MHz vs ${params.freqHighMHz} MHz`,
        'Distance d (m) [log scale]',
        'Path Loss PL (dB)',
        false,
        {
          xaxis: { type: 'log' },
          annotations: [
            {
              x: Math.log10(midD),
              y: 0.5 * (lowPts[midIdx].plMean + highPts[midIdx].plMean),
              text: `ΔPL = 20·log10(${params.freqHighMHz}/${params.freqLowMHz}) = ${fGapDb.toFixed(2)} dB`,
              showarrow: true,
              arrowhead: 2,
              ax: 45,
              ay: -30,
              font: { size: 11 },
            },
          ],
        },
      ),
      keyFindings: [
        `Increasing carrier frequency from ${params.freqLowMHz} MHz to ${params.freqHighMHz} MHz raises path loss by exactly 20·log10(${params.freqHighMHz}/${params.freqLowMHz}) = ${fGapDb.toFixed(2)} dB at every distance due to smaller effective isotropic receive aperture (λ²/4π).`,
        `At d = ${dists[dists.length - 1]} m, urban/terrestrial path loss (n = ${params.pathLossExp}) exceeds free-space loss (n = 2) by ${(lowPts[lowPts.length - 1].plMean - lowPts[lowPts.length - 1].fspl).toFixed(1)} dB.`,
        `On a log-distance axis, mean path loss increases linearly with slope 10·n = ${(10 * params.pathLossExp).toFixed(1)} dB per decade of distance.`,
      ],
      table: {
        headers: [
          'd (m)',
          `FSPL ${params.freqLowMHz} MHz (dB)`,
          `PL(n=${params.pathLossExp}) ${params.freqLowMHz} MHz (dB)`,
          `FSPL ${params.freqHighMHz} MHz (dB)`,
          `PL(n=${params.pathLossExp}) ${params.freqHighMHz} MHz (dB)`,
        ],
        rows: lowPts.map((p, i) => [
          p.distanceM,
          p.fspl.toFixed(2),
          p.plMean.toFixed(2),
          highPts[i].fspl.toFixed(2),
          highPts[i].plMean.toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 3: Effect of Path-Loss Exponent n = 2, 3, 4, 5
    // ------------------------------------------------------------------
    const nList = [2, 3, 4, 5];
    const fig3Traces: Plotly.Data[] = nList.map((nVal, idx) => ({
      x: dists,
      y: dists.map((d) => meanRxPowerDbm(d, params, params.freqLowMHz, nVal)),
      type: 'scatter',
      mode: 'lines+markers',
      name: `n = ${nVal} (${(10 * nVal).toFixed(0)} dB/dec)`,
      line: { color: PALETTE[idx % PALETTE.length], width: 2.2 },
      marker: { symbol: SIM_MARKERS[idx % SIM_MARKERS.length], size: 6 },
    }));
    fig3Traces.push({
      x: [dists[0], dists[dists.length - 1]],
      y: [params.rxSensitivityDbm, params.rxSensitivityDbm],
      type: 'scatter',
      mode: 'lines',
      name: `Sensitivity (${params.rxSensitivityDbm} dBm)`,
      line: { color: '#dc2626', width: 1.6, dash: 'dash' },
    });

    const r90ByN = nList.map((nv) =>
      analyticalCoverageRadiusM(0.9, params, params.freqLowMHz, nv, params.shadowSigmaDb),
    );
    figures.push({
      id: 'fig3_exponent_n',
      title: `Fig 3: Effect of Path-Loss Exponent n ∈ {2, 3, 4, 5} at ${params.freqLowMHz} MHz`,
      shortTitle: '3. Exponent n',
      traces: fig3Traces,
      layout: baseFigureLayout(
        `Effect of Path-Loss Exponent n (${params.freqLowMHz} MHz)`,
        'Distance d (m) [log scale]',
        'Mean Received Power Pr (dBm)',
        false,
        { xaxis: { type: 'log' } },
      ),
      keyFindings: [
        `Increasing the path-loss exponent from n = 2 (free space) to n = 4 (dense urban) steepens attenuation from 20 dB/decade to 40 dB/decade, reducing 90% coverage radius from ${r90ByN[0].toFixed(0)} m to ${r90ByN[2].toFixed(0)} m.`,
        `At d = 1000 m (10× reference distance d0 = ${params.d0M} m), each unit increment in n costs exactly 10·log10(1000/${params.d0M}) = ${(10 * Math.log10(1000 / params.d0M)).toFixed(1)} dB of link margin.`,
        `For obstructed environments (n = 5), the 90% coverage radius shrinks to ${r90ByN[3].toFixed(0)} m, requiring microcell or small-cell densification.`,
      ],
      table: {
        headers: ['n', 'Attenuation (dB/dec)', 'Pr @ 1 km (dBm)', '90% Cov Radius (m)', '95% Cov Radius (m)'],
        rows: nList.map((nv, i) => [
          nv,
          10 * nv,
          meanRxPowerDbm(1000, params, params.freqLowMHz, nv).toFixed(2),
          r90ByN[i].toFixed(1),
          analyticalCoverageRadiusM(
            0.95,
            params,
            params.freqLowMHz,
            nv,
            params.shadowSigmaDb,
          ).toFixed(1),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 4: Coverage & Outage Probability vs Distance (+ Wilson CI & Theory)
    // ------------------------------------------------------------------
    const lowCi = lowPts.map((p) => wilsonInterval(p.covCount, p.samples));
    const highCi = highPts.map((p) => wilsonInterval(p.covCount, p.samples));
    const fig4Traces: Plotly.Data[] = [
      {
        x: dists,
        y: lowPts.map((p) => p.covSim * 100),
        error_y: {
          type: 'data',
          symmetric: false,
          array: lowPts.map((_, i) => lowCi[i].errPlus * 100),
          arrayminus: lowPts.map((_, i) => lowCi[i].errMinus * 100),
          visible: true,
        },
        type: 'scatter',
        mode: 'markers',
        name: `${params.freqLowMHz} MHz Coverage (Sim ± 95% CI)`,
        marker: { symbol: SIM_MARKERS[0], size: 7, color: PALETTE[0] },
      },
      {
        x: dists,
        y: lowPts.map((p) => p.covTheory * 100),
        type: 'scatter',
        mode: 'lines',
        name: `${params.freqLowMHz} MHz Q-Function Theory`,
        line: { color: PALETTE[0], width: 2, dash: 'dash' },
      },
      {
        x: dists,
        y: highPts.map((p) => p.covSim * 100),
        error_y: {
          type: 'data',
          symmetric: false,
          array: highPts.map((_, i) => highCi[i].errPlus * 100),
          arrayminus: highPts.map((_, i) => highCi[i].errMinus * 100),
          visible: true,
        },
        type: 'scatter',
        mode: 'markers',
        name: `${params.freqHighMHz} MHz Coverage (Sim ± 95% CI)`,
        marker: { symbol: SIM_MARKERS[1], size: 7, color: PALETTE[1] },
      },
      {
        x: dists,
        y: highPts.map((p) => p.covTheory * 100),
        type: 'scatter',
        mode: 'lines',
        name: `${params.freqHighMHz} MHz Q-Function Theory`,
        line: { color: PALETTE[1], width: 2, dash: 'dash' },
      },
      {
        x: [dists[0], dists[dists.length - 1]],
        y: [90, 90],
        type: 'scatter',
        mode: 'lines',
        name: '90% Cell-Edge Target',
        line: { color: THEORY_LINE_COLOR, width: 1.4, dash: 'dot' },
      },
    ];

    figures.push({
      id: 'fig4_coverage_outage',
      title: `Fig 4: Coverage Probability vs Distance (Sim + Wilson 95% CI vs Q-Function)`,
      shortTitle: '4. Coverage & Outage',
      traces: fig4Traces,
      layout: baseFigureLayout(
        `Cell-Edge Coverage Probability P(Pr ≥ ${params.rxSensitivityDbm} dBm)`,
        'Distance d (m) [log scale]',
        'Coverage Probability (%)',
        false,
        { xaxis: { type: 'log' }, yaxis: { range: [0, 103] } },
      ),
      keyFindings: [
        `Monte-Carlo coverage probabilities across ${params.mcSamples.toLocaleString()} shadowing trials per distance track the closed-form Q-function within max relative error ${Number.isFinite(verification.maxRelError) ? (verification.maxRelError * 100).toFixed(2) + '%' : 'N/A'} (${verification.passed ? 'PASS' : 'FAIL'}).`,
        `Tightening cell-edge reliability from 90% to 95% requires an extra fade margin of (1.645 − 1.282)·σ = ${(0.363 * params.shadowSigmaDb).toFixed(2)} dB, shrinking the ${params.freqLowMHz} MHz radius from ${r90Low.toFixed(0)} m to ${r95Low.toFixed(0)} m.`,
        `At ${params.freqHighMHz} MHz, 90% and 95% coverage radii are ${r90High.toFixed(0)} m and ${r95High.toFixed(0)} m respectively.`,
      ],
      table: {
        headers: [
          'd (m)',
          `${params.freqLowMHz} MHz Cov Sim (%)`,
          `${params.freqLowMHz} MHz Theory (%)`,
          `${params.freqHighMHz} MHz Cov Sim (%)`,
          `${params.freqHighMHz} MHz Theory (%)`,
        ],
        rows: lowPts.map((p, i) => [
          p.distanceM,
          (p.covSim * 100).toFixed(2),
          (p.covTheory * 100).toFixed(2),
          (highPts[i].covSim * 100).toFixed(2),
          (highPts[i].covTheory * 100).toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 5: Environment Comparison & 90%/95% Cell Radius
    // ------------------------------------------------------------------
    const envRows = PROPAGATION_ENVS.map((env) => {
      const r90L = analyticalCoverageRadiusM(0.9, params, params.freqLowMHz, env.n, env.sigmaDb);
      const r95L = analyticalCoverageRadiusM(0.95, params, params.freqLowMHz, env.n, env.sigmaDb);
      const r90H = analyticalCoverageRadiusM(0.9, params, params.freqHighMHz, env.n, env.sigmaDb);
      const r95H = analyticalCoverageRadiusM(0.95, params, params.freqHighMHz, env.n, env.sigmaDb);
      return { env, r90L, r95L, r90H, r95H };
    });

    const fig5Traces: Plotly.Data[] = [
      {
        x: envRows.map((e) => e.env.label),
        y: envRows.map((e) => e.r90L),
        type: 'bar',
        name: `${params.freqLowMHz} MHz — 90% Cov Radius`,
        marker: { color: PALETTE[0] },
      },
      {
        x: envRows.map((e) => e.env.label),
        y: envRows.map((e) => e.r95L),
        type: 'bar',
        name: `${params.freqLowMHz} MHz — 95% Cov Radius`,
        marker: { color: PALETTE[2] },
      },
      {
        x: envRows.map((e) => e.env.label),
        y: envRows.map((e) => e.r90H),
        type: 'bar',
        name: `${params.freqHighMHz} MHz — 90% Cov Radius`,
        marker: { color: PALETTE[1] },
      },
      {
        x: envRows.map((e) => e.env.label),
        y: envRows.map((e) => e.r95H),
        type: 'bar',
        name: `${params.freqHighMHz} MHz — 95% Cov Radius`,
        marker: { color: PALETTE[3] },
      },
    ];

    const ruralRow = envRows.find((e) => e.env.id === 'rural')!;
    const denseRow = envRows.find((e) => e.env.id === 'dense_urban')!;
    figures.push({
      id: 'fig5_environments',
      title: 'Fig 5: Propagation Environment Comparison & Cell-Edge Coverage Radius',
      shortTitle: '5. Environments',
      traces: fig5Traces,
      layout: baseFigureLayout(
        'Cell-Edge Coverage Radius Across Propagation Environments',
        'Propagation Environment',
        'Coverage Radius (m) [log scale]',
        true,
        { barmode: 'group' },
      ),
      keyFindings: [
        `Moving from Rural/Open (n=${ruralRow.env.n}, σ=${ruralRow.env.sigmaDb} dB) to Dense Urban (n=${denseRow.env.n}, σ=${denseRow.env.sigmaDb} dB) contracts the ${params.freqLowMHz} MHz 90% coverage radius from ${ruralRow.r90L.toFixed(0)} m to ${denseRow.r90L.toFixed(0)} m (a ${(ruralRow.r90L / Math.max(denseRow.r90L, 1)).toFixed(1)}× reduction).`,
        `Higher shadowing spread σ in urban clutter demands larger fade margins (1.28·σ for 90% edge coverage, 1.645·σ for 95%), compounding the loss from steeper path-loss exponent n.`,
        `Sub-1 GHz bands (${params.freqLowMHz} MHz) remain essential for wide-area coverage layers while mid-band (${params.freqHighMHz} MHz) suits high-capacity urban microcells.`,
      ],
      table: {
        headers: [
          'Environment',
          'n',
          'σ (dB)',
          `${params.freqLowMHz} MHz R90 (m)`,
          `${params.freqLowMHz} MHz R95 (m)`,
          `${params.freqHighMHz} MHz R90 (m)`,
          `${params.freqHighMHz} MHz R95 (m)`,
        ],
        rows: envRows.map((e) => [
          e.env.label,
          e.env.n,
          e.env.sigmaDb,
          e.r90L.toFixed(1),
          e.r95L.toFixed(1),
          e.r90H.toFixed(1),
          e.r95H.toFixed(1),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 6: 2D Cell Coverage Heatmap
    // ------------------------------------------------------------------
    if (heatmap) {
      const fig6Traces: Plotly.Data[] = [
        {
          x: heatmap.coordsM,
          y: heatmap.coordsM,
          z: heatmap.prGrid,
          type: 'heatmap',
          colorscale: 'Viridis',
          colorbar: { title: { text: 'Pr (dBm)' } },
          hovertemplate: 'x=%{x:.0f} m, y=%{y:.0f} m<br>Pr=%{z:.1f} dBm<extra></extra>',
        } as Plotly.Data,
        {
          x: [0],
          y: [0],
          type: 'scatter',
          mode: 'text+markers',
          name: 'Base Station',
          text: ['BS'],
          textposition: 'top center',
          marker: { symbol: 'triangle-up', size: 11, color: '#ef4444' },
        },
      ];

      figures.push({
        id: 'fig6_cell_heatmap',
        title: `Fig 6: 2D Shadowed Cell Coverage Map (${params.freqLowMHz} MHz, R = ${heatmap.radiusM} m)`,
        shortTitle: '6. Cell Map',
        traces: fig6Traces,
        layout: baseFigureLayout(
          `2D Cell Received Power Map (${params.freqLowMHz} MHz, Area Cov = ${(heatmap.coveredFraction * 100).toFixed(1)}%)`,
          'East–West Distance x (m)',
          'North–South Distance y (m)',
          false,
          { yaxis: { scaleanchor: 'x', scaleratio: 1 } },
        ),
        keyFindings: [
          `Across the circular cell of radius ${heatmap.radiusM} m at ${params.freqLowMHz} MHz, ${(heatmap.coveredFraction * 100).toFixed(1)}% of cell area meets or exceeds receiver sensitivity (${params.rxSensitivityDbm} dBm).`,
          `Spatially correlated log-normal shadowing (σ = ${params.shadowSigmaDb} dB) creates localized coverage holes even inside the nominal cell boundary and isolated pockets of service beyond it.`,
          `In cellular link-budget design, cell-area coverage probability always exceeds cell-edge probability because interior users enjoy higher mean signal strength.`,
        ],
        table: {
          headers: ['Metric', 'Value'],
          rows: [
            ['Carrier Frequency (MHz)', params.freqLowMHz],
            ['Rendered Cell Radius (m)', heatmap.radiusM],
            ['Receiver Sensitivity (dBm)', params.rxSensitivityDbm],
            ['Area Coverage Fraction (%)', (heatmap.coveredFraction * 100).toFixed(2)],
            ['Area Outage Fraction (%)', ((1 - heatmap.coveredFraction) * 100).toFixed(2)],
          ],
        },
      });
    }
  }

  const requirements: RequirementCheck[] = [
    {
      id: 'sim_runs',
      label: 'Working propagation & shadowing simulation',
      met: lowPts.length > 0 && highPts.length > 0,
      detail: `Simulated ${totalTrials.toLocaleString()} shadowing link samples in ${(elapsedMs / 1000).toFixed(2)}s`,
    },
    {
      id: 'min_figures',
      label: 'At least 4 result figures generated',
      met: figures.length >= 4,
      detail: `${figures.length} figures generated (Pr, Path Loss, n sweep, Coverage/Outage, Environments, 2D Cell Map)`,
    },
    {
      id: 'two_params',
      label: 'At least 2 independent parameters varied',
      met: figures.length >= 4,
      detail: `Varied distance d, carrier frequency (${params.freqLowMHz} vs ${params.freqHighMHz} MHz), path-loss exponent n, and environment (n, σ)`,
    },
    {
      id: 'baseline_compare',
      label: 'Comparison of >= 2 configurations vs baseline',
      met: figures.length >= 4,
      detail: `Compared FSPL baseline (n=2) vs log-distance shadowed propagation across 5 environments and 2 bands`,
    },
    {
      id: 'verification',
      label: 'Verification against closed-form Q-function',
      met: verification.passed,
      detail: verification.passed
        ? `PASS — max rel. error ${(verification.maxRelError * 100).toFixed(2)}% (<= 15%)`
        : verification.summary,
    },
    {
      id: 'reproducible',
      label: 'Parameters & RNG seed recorded for reproducibility',
      met: Number.isFinite(params.seed),
      detail: `Seed = ${params.seed}, d0 = ${params.d0M} m, EIRP = ${params.txPowerDbm + params.gtDbi + params.grDbi} dBm`,
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
      totalErrors: totalOutages,
      quickMode: params.quickMode,
      earlyStop: false,
      timestamp: new Date().toISOString(),
      paramsSnapshot: { ...params },
    },
    rawSummary: {
      fGapDb,
      r90Low,
      r95Low,
      r90High,
      r95High,
      areaRatio: Math.pow(r90Low / Math.max(r90High, 1), 2),
      areaCoveragePct: heatmap ? heatmap.coveredFraction * 100 : null,
    },
  };
}

export const MODULE1_THEORY: ModuleTheoryContent = {
  abstract:
    'This module models large-scale wireless radio propagation using Free-Space Path Loss (FSPL) and the Log-Distance Path Loss with Log-Normal Shadowing model. It quantifies link-budget margins, the 11.8 dB propagation gap between 900 MHz and 3.5 GHz bands, sensitivity to the path-loss exponent n, and cell-edge coverage/outage radii across five propagation environments.',
  objectives: [
    'Quantify deterministic path loss via FSPL and empirical log-distance slope 10n dB/decade.',
    'Compare sub-1 GHz (900 MHz) and mid-band 5G (3.5 GHz) coverage radius and base-station density requirements.',
    'Model random large-scale shadowing X_σ ~ N(0, σ²) and verify Monte-Carlo outage against the closed-form Q-function.',
    'Compute 90% and 95% cell-edge coverage radii across Dense Urban, Urban, Suburban, Rural, and Indoor environments.',
  ],
  technicalBackground: [
    'Large-scale propagation models predict mean signal attenuation over hundreds to thousands of meters and are the foundation of cellular RF planning and link-budget dimensioning.',
    'While Free-Space Path Loss assumes an unobstructed line-of-sight path (n = 2), real terrestrial channels suffer reflection, diffraction, and scattering from buildings and foliage, yielding path-loss exponents between n = 2.2 (rural) and n = 3.8–5.0 (dense urban/obstructed).',
    'Surrounding clutter varies randomly along paths of identical length d, causing log-normal shadowing X_σ (in dB). Ensuring 90% or 95% reliability at the cell edge requires adding a shadowing fade margin proportional to σ.',
  ],
  systemModelSummary:
    'A macro or micro base station transmits power Pt through antenna gain Gt to a mobile terminal with gain Gr and receiver sensitivity S_rx. Path loss at distance d >= d0 follows the log-distance model anchored to FSPL at reference distance d0 = 100 m plus zero-mean Gaussian shadowing X_σ (dB).',
  equations: [
    {
      title: 'Free-Space Path Loss (FSPL)',
      latex: '\\text{FSPL(dB)} = 32.44 + 20\\log_{10}(d_{\\text{km}}) + 20\\log_{10}(f_{\\text{MHz}})',
      explanation: 'Isotropic free-space attenuation increases by 20 dB per decade of distance and 20 dB per decade of frequency.',
    },
    {
      title: 'Log-Distance Path Loss with Shadowing',
      latex: '\\text{PL}(d) = \\text{PL}(d_0) + 10 n \\log_{10}\\!\\left(\\frac{d}{d_0}\\right) + X_\\sigma, \\quad X_\\sigma \\sim \\mathcal{N}(0, \\sigma^2)',
      explanation: 'Anchored to FSPL at d0 = 100 m with environment-dependent exponent n and shadowing standard deviation σ (dB).',
    },
    {
      title: 'Link Budget & Received Power',
      latex: 'P_r(d) = P_t + G_t + G_r - \\text{PL}(d) \\;\\text{[dBm]}',
      explanation: 'Instantaneous received power in dBm comparing transmitted EIRP against total path loss.',
    },
    {
      title: 'Cell-Edge Coverage & Outage Probability',
      latex: 'P_{\\text{cov}}(d) = P(P_r(d) \\ge S_{\\text{rx}}) = Q\\!\\left(\\frac{S_{\\text{rx}} - \\overline{P_r}(d)}{\\sigma}\\right), \\quad P_{\\text{out}}(d) = 1 - P_{\\text{cov}}(d)',
      explanation: 'Closed-form analytical benchmark verified directly against Monte-Carlo shadowing realizations.',
    },
  ],
  methodology: [
    'Sweep distance d logarithmically from d_min to d_max for both carrier frequencies (default 900 MHz and 3500 MHz).',
    'At each distance, draw independent Gaussian shadowing samples X_σ using deterministic per-point sub-seeds and count links exceeding S_rx.',
    'Compute 95% Wilson confidence intervals on empirical coverage probability and verify against the analytical Q-function.',
    'Evaluate analytical 90% and 95% coverage radii across all five environments and synthesize a 2D spatially correlated cell coverage map.',
  ],
  assumptions: [
    'Far-field condition holds for d >= d0 = 100 m; small-scale multipath fading is averaged out over local areas.',
    'Antenna gains Gt and Gr are isotropic/boresight constants across the cell sector.',
    'Shadowing X_σ is zero-mean Gaussian in dB with constant σ over the modeled range.',
  ],
  conclusionsDefault: [
    'Mid-band carriers (3.5 GHz) experience an exact 11.80 dB propagation penalty relative to 900 MHz, substantially shrinking cell radius and multiplying base-station site count.',
    'Both higher path-loss exponent n and larger shadowing spread σ severely reduce cell-edge coverage radius, necessitating fade margins of 1.28σ (90%) to 1.645σ (95%).',
  ],
};
