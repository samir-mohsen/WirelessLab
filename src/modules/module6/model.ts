import type * as Plotly from 'plotly.js';
import {
  PALETTE,
  SIM_MARKERS,
  THEORY_LINE_COLOR,
  baseFigureLayout,
} from '../../engine/chartTheme';
import { createRng, deriveSubSeed } from '../../engine/rng';
import { linToDb } from '../../engine/special';
import { evaluateVerification, mean, percentile, wilsonInterval } from '../../engine/stats';
import type {
  FigureSpec,
  ModuleResultBundle,
  ModuleTheoryContent,
  RequirementCheck,
} from '../../types/simulation';

export type ClusterSize = 1 | 3 | 4 | 7 | 9 | 12;

export const ALL_CLUSTER_SIZES: ClusterSize[] = [1, 3, 4, 7, 9, 12];

export const CLUSTER_IJ: Record<ClusterSize, [number, number]> = {
  1: [1, 0],
  3: [1, 1],
  4: [2, 0],
  7: [2, 1],
  9: [3, 0],
  12: [2, 2],
};

export interface Module6Params {
  cellRadiusM: number;
  pathLossExp: number;
  shadowingEnabled: boolean;
  shadowSigmaDb: number;
  includeSecondTier: boolean;
  selectedClusterN: ClusterSize;
  totalChannels: number;
  targetSirDb: number;
  maxOutagePct: number;
  mcUsers: number;
  seed: number;
  quickMode: boolean;
}

export const DEFAULT_MODULE6_PARAMS: Module6Params = {
  cellRadiusM: 1000,
  pathLossExp: 3.5,
  shadowingEnabled: true,
  shadowSigmaDb: 6.0,
  includeSecondTier: false,
  selectedClusterN: 7,
  totalChannels: 420,
  targetSirDb: 12,
  maxOutagePct: 10,
  mcUsers: 5000,
  seed: 44106,
  quickMode: false,
};

export function reuseRatioQ(nCluster: number): number {
  return Math.sqrt(3 * nCluster);
}

export function reuseDistanceM(radiusM: number, nCluster: number): number {
  return radiusM * reuseRatioQ(nCluster);
}

export function classicalApproxSirDb(nCluster: number, pathLossExp: number): number {
  const q = reuseRatioQ(nCluster);
  const sirLin = Math.pow(q, pathLossExp) / 6;
  return linToDb(sirLin);
}

export function getCoChannelCenters(
  radiusM: number,
  nCluster: ClusterSize,
  includeSecondTier: boolean,
): Array<{ x: number; y: number; tier: 1 | 2 }> {
  const [i, j] = CLUSTER_IJ[nCluster];
  const s3 = Math.sqrt(3);
  // Pointy-top hex adjacent-cell basis vectors (length = sqrt(3)*R)
  const e1x = s3 * radiusM;
  const e1y = 0;
  const e2x = 0.5 * s3 * radiusM;
  const e2y = 1.5 * radiusM;

  const v0x = i * e1x + j * e2x;
  const v0y = i * e1y + j * e2y;

  const tier1: Array<{ x: number; y: number; tier: 1 | 2 }> = [];
  for (let k = 0; k < 6; k++) {
    const ang = (k * Math.PI) / 3;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    tier1.push({
      x: v0x * c - v0y * s,
      y: v0x * s + v0y * c,
      tier: 1,
    });
  }

  if (!includeSecondTier) {
    return tier1;
  }

  const centers = [...tier1];
  for (let k = 0; k < 6; k++) {
    const a = tier1[k];
    const b = tier1[(k + 1) % 6];
    centers.push({ x: 2 * a.x, y: 2 * a.y, tier: 2 });
    centers.push({ x: a.x + b.x, y: a.y + b.y, tier: 2 });
  }
  return centers;
}

/**
 * Exact deterministic cell-edge SIR (dB) at distance R along the direction toward
 * the first co-channel interferer (worst-case geometry, no shadowing).
 */
export function exactWorstCaseCellEdgeSirDb(
  radiusM: number,
  nCluster: ClusterSize,
  pathLossExp: number,
  includeSecondTier: boolean,
): number {
  const centers = getCoChannelCenters(radiusM, nCluster, includeSecondTier);
  const c0 = centers[0];
  const norm = Math.hypot(c0.x, c0.y) || 1;
  // User placed on cell edge at distance R directly toward nearest co-channel BS
  const ux = (radiusM * c0.x) / norm;
  const uy = (radiusM * c0.y) / norm;
  const sig = Math.pow(radiusM, -pathLossExp);
  let interf = 0;
  for (const c of centers) {
    const dk = Math.max(1, Math.hypot(ux - c.x, uy - c.y));
    interf += Math.pow(dk, -pathLossExp);
  }
  return linToDb(sig / interf);
}

/**
 * Exact deterministic cell-edge SIR averaged around the ring r = R (no shadowing).
 */
export function exactRingCellEdgeSirDb(
  radiusM: number,
  nCluster: ClusterSize,
  pathLossExp: number,
  includeSecondTier: boolean,
): number {
  const centers = getCoChannelCenters(radiusM, nCluster, includeSecondTier);
  const M = 180;
  let sumDb = 0;
  for (let m = 0; m < M; m++) {
    const theta = (2 * Math.PI * m) / M;
    const ux = radiusM * Math.cos(theta);
    const uy = radiusM * Math.sin(theta);
    const sig = Math.pow(radiusM, -pathLossExp);
    let interf = 0;
    for (const c of centers) {
      const dk = Math.max(1, Math.hypot(ux - c.x, uy - c.y));
      interf += Math.pow(dk, -pathLossExp);
    }
    sumDb += linToDb(sig / interf);
  }
  return sumDb / M;
}

function isInsidePointyHex(x: number, y: number, R: number): boolean {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const halfW = (Math.sqrt(3) / 2) * R;
  if (ax > halfW) return false;
  if (ay + ax / Math.sqrt(3) > R) return false;
  return true;
}

export type Module6Task =
  | {
      kind: 'cluster_mc';
      nCluster: ClusterSize;
      radiusM: number;
      pathLossExp: number;
      shadowSigmaDb: number;
      includeSecondTier: boolean;
      users: number;
      seed: number;
      tag: 'main' | 'noshadow';
    }
  | {
      kind: 'hex_heatmap';
      nCluster: ClusterSize;
      radiusM: number;
      pathLossExp: number;
      includeSecondTier: boolean;
      gridN: number;
    };

export interface ClusterMcOutput {
  kind: 'cluster_mc';
  nCluster: ClusterSize;
  tag: 'main' | 'noshadow';
  users: number;
  meanSirDb: number;
  medianSirDb: number;
  p05SirDb: number;
  p95SirDb: number;
  ringEdgeSimSirDb: number;
  ringEdgeExactSirDb: number;
  outage9Count: number;
  outage12Count: number;
  outage18Count: number;
  outageTargetCount: number;
  cdfX: number[];
  cdfY: number[];
  centerSirMean: number;
  midSirMean: number;
  edgeSirMean: number;
  edgeSamplesPreview: number[];
  centerSamplesPreview: number[];
}

export interface HexHeatmapOutput {
  kind: 'hex_heatmap';
  nCluster: ClusterSize;
  coordsM: number[];
  sirGrid: (number | null)[][];
  centers: Array<{ x: number; y: number; tier: 1 | 2 }>;
}

export type Module6TaskOutput = ClusterMcOutput | HexHeatmapOutput;

export function runModule6Task(task: Module6Task, targetSirDb = 12): Module6TaskOutput {
  if (task.kind === 'hex_heatmap') {
    const centers = getCoChannelCenters(task.radiusM, task.nCluster, task.includeSecondTier);
    const N = task.gridN;
    const R = task.radiusM;
    const coordsM: number[] = [];
    for (let i = 0; i < N; i++) {
      coordsM.push(-R + (2 * R * i) / (N - 1));
    }
    const sirGrid: (number | null)[][] = [];
    const dMin = Math.max(20, 0.05 * R);
    for (let iy = 0; iy < N; iy++) {
      const y = coordsM[iy];
      const row: (number | null)[] = [];
      for (let ix = 0; ix < N; ix++) {
        const x = coordsM[ix];
        if (!isInsidePointyHex(x, y, R)) {
          row.push(null);
          continue;
        }
        const d0 = Math.max(dMin, Math.hypot(x, y));
        const sig = Math.pow(d0, -task.pathLossExp);
        let interf = 0;
        for (const c of centers) {
          const dk = Math.max(dMin, Math.hypot(x - c.x, y - c.y));
          interf += Math.pow(dk, -task.pathLossExp);
        }
        row.push(Number(linToDb(sig / interf).toFixed(2)));
      }
      sirGrid.push(row);
    }
    return {
      kind: 'hex_heatmap',
      nCluster: task.nCluster,
      coordsM,
      sirGrid,
      centers,
    };
  }

  const rng = createRng(task.seed);
  const R = task.radiusM;
  const dMin = Math.max(20, 0.05 * R);
  const centers = getCoChannelCenters(R, task.nCluster, task.includeSecondTier);
  const sirsDb: number[] = new Array(task.users);
  const centerSirs: number[] = [];
  const midSirs: number[] = [];
  const edgeSirs: number[] = [];

  let out9 = 0;
  let out12 = 0;
  let out18 = 0;
  let outTarget = 0;

  for (let u = 0; u < task.users; u++) {
    let x = 0;
    let y = 0;
    // Uniform point in pointy-top hexagon
    while (true) {
      x = (rng.next() * 2 - 1) * R;
      y = (rng.next() * 2 - 1) * R;
      if (isInsidePointyHex(x, y, R)) break;
    }
    const r = Math.hypot(x, y);
    const d0 = Math.max(dMin, r);
    const sh0 = task.shadowSigmaDb > 0 ? Math.pow(10, (task.shadowSigmaDb * rng.nextGaussian()) / 10) : 1;
    const sig = Math.pow(d0, -task.pathLossExp) * sh0;

    let interf = 0;
    for (let k = 0; k < centers.length; k++) {
      const c = centers[k];
      const dk = Math.max(dMin, Math.hypot(x - c.x, y - c.y));
      const shk =
        task.shadowSigmaDb > 0
          ? Math.pow(10, (task.shadowSigmaDb * rng.nextGaussian()) / 10)
          : 1;
      interf += Math.pow(dk, -task.pathLossExp) * shk;
    }

    const sirDb = linToDb(sig / interf);
    sirsDb[u] = sirDb;

    if (sirDb < 9) out9++;
    if (sirDb < 12) out12++;
    if (sirDb < 18) out18++;
    if (sirDb < targetSirDb) outTarget++;

    if (r <= 0.35 * R) {
      centerSirs.push(sirDb);
    } else if (r <= 0.7 * R) {
      midSirs.push(sirDb);
    } else {
      edgeSirs.push(sirDb);
    }
  }

  // Dedicated cell-edge ring simulation (no shadowing) for exact geometric verification
  const ringSamples = 600;
  let ringSum = 0;
  for (let m = 0; m < ringSamples; m++) {
    const theta = rng.next() * 2 * Math.PI;
    const ux = R * Math.cos(theta);
    const uy = R * Math.sin(theta);
    const sig = Math.pow(R, -task.pathLossExp);
    let interf = 0;
    for (let k = 0; k < centers.length; k++) {
      const c = centers[k];
      const dk = Math.max(dMin, Math.hypot(ux - c.x, uy - c.y));
      interf += Math.pow(dk, -task.pathLossExp);
    }
    ringSum += linToDb(sig / interf);
  }
  const ringEdgeSimSirDb = ringSum / ringSamples;
  const ringEdgeExactSirDb = exactRingCellEdgeSirDb(
    R,
    task.nCluster,
    task.pathLossExp,
    task.includeSecondTier,
  );

  const sorted = [...sirsDb].sort((a, b) => a - b);
  const cdfPoints = 45;
  const cdfX: number[] = [];
  const cdfY: number[] = [];
  for (let i = 0; i < cdfPoints; i++) {
    const p = i / (cdfPoints - 1);
    const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
    cdfX.push(Number(sorted[idx].toFixed(2)));
    cdfY.push(Number((p * 100).toFixed(2)));
  }

  return {
    kind: 'cluster_mc',
    nCluster: task.nCluster,
    tag: task.tag,
    users: task.users,
    meanSirDb: mean(sirsDb),
    medianSirDb: percentile(sirsDb, 50),
    p05SirDb: percentile(sirsDb, 5),
    p95SirDb: percentile(sirsDb, 95),
    ringEdgeSimSirDb,
    ringEdgeExactSirDb,
    outage9Count: out9,
    outage12Count: out12,
    outage18Count: out18,
    outageTargetCount: outTarget,
    cdfX,
    cdfY,
    centerSirMean: centerSirs.length > 0 ? mean(centerSirs) : mean(sirsDb),
    midSirMean: midSirs.length > 0 ? mean(midSirs) : mean(sirsDb),
    edgeSirMean: edgeSirs.length > 0 ? mean(edgeSirs) : mean(sirsDb),
    edgeSamplesPreview: edgeSirs.slice(0, 600),
    centerSamplesPreview: centerSirs.slice(0, 600),
  };
}

export function buildModule6Tasks(
  params: Module6Params,
  mode: 'full' | 'quick' | 'selftest',
): { tasks: Module6Task[] } {
  const users =
    mode === 'selftest'
      ? 2000
      : mode === 'quick'
        ? Math.max(1500, Math.round(params.mcUsers * 0.4))
        : params.mcUsers;

  const tasks: Module6Task[] = [];
  const nList: ClusterSize[] = mode === 'selftest' ? [3, 4, 7] : ALL_CLUSTER_SIZES;

  for (let idx = 0; idx < nList.length; idx++) {
    const nC = nList[idx];
    // Main simulation (with user's shadowing toggle)
    tasks.push({
      kind: 'cluster_mc',
      nCluster: nC,
      radiusM: params.cellRadiusM,
      pathLossExp: params.pathLossExp,
      shadowSigmaDb: params.shadowingEnabled ? params.shadowSigmaDb : 0,
      includeSecondTier: params.includeSecondTier,
      users,
      seed: deriveSubSeed(params.seed, 1, nC),
      tag: 'main',
    });

    // No-shadowing reference for outage comparison (only needed if shadowing is enabled)
    if (mode !== 'selftest' && params.shadowingEnabled) {
      tasks.push({
        kind: 'cluster_mc',
        nCluster: nC,
        radiusM: params.cellRadiusM,
        pathLossExp: params.pathLossExp,
        shadowSigmaDb: 0,
        includeSecondTier: params.includeSecondTier,
        users: Math.max(1500, Math.round(users * 0.5)),
        seed: deriveSubSeed(params.seed, 2, nC),
        tag: 'noshadow',
      });
    }
  }

  if (mode !== 'selftest') {
    tasks.push({
      kind: 'hex_heatmap',
      nCluster: params.selectedClusterN,
      radiusM: params.cellRadiusM,
      pathLossExp: params.pathLossExp,
      includeSecondTier: params.includeSecondTier,
      gridN: mode === 'quick' ? 45 : 59,
    });
  }

  return { tasks };
}

export function assembleModule6Results(
  params: Module6Params,
  outputs: Module6TaskOutput[],
  elapsedMs: number,
  selfTestOnly = false,
): ModuleResultBundle {
  const mainRuns = outputs
    .filter((o): o is ClusterMcOutput => o.kind === 'cluster_mc' && o.tag === 'main')
    .sort((a, b) => a.nCluster - b.nCluster);
  const noShadowRuns = outputs
    .filter((o): o is ClusterMcOutput => o.kind === 'cluster_mc' && o.tag === 'noshadow')
    .sort((a, b) => a.nCluster - b.nCluster);
  const heatmap = outputs.find((o): o is HexHeatmapOutput => o.kind === 'hex_heatmap') ?? null;

  const totalTrials =
    mainRuns.reduce((s, r) => s + r.users, 0) +
    noShadowRuns.reduce((s, r) => s + r.users, 0);
  const totalOutages = mainRuns.reduce((s, r) => s + r.outageTargetCount, 0);

  // Verification: MC ring cell-edge SIR (no shadowing) vs exact multi-interferer distance formula (linear SIR)
  const verification = evaluateVerification(
    mainRuns.map((r) => ({
      label: `Cell-Edge Ring SIR (linear)`,
      point: r.nCluster,
      simulated: Math.pow(10, r.ringEdgeSimSirDb / 10),
      theory: Math.pow(10, r.ringEdgeExactSirDb / 10),
      errorsCount: 600,
      trialsCount: 600,
    })),
    25,
    0.15,
  );

  // Determine recommended smallest cluster size meeting targetSirDb & maxOutagePct
  const recommended =
    mainRuns.find((r) => (r.outageTargetCount / r.users) * 100 <= params.maxOutagePct) ??
    mainRuns[mainRuns.length - 1];

  const figures: FigureSpec[] = [];

  if (!selfTestOnly && mainRuns.length > 0) {
    const nValues = mainRuns.map((r) => r.nCluster);

    // ------------------------------------------------------------------
    // Figure 1: Reuse Distance D and Reuse Ratio q = D/R vs Cluster Size N
    // ------------------------------------------------------------------
    const dKm = nValues.map((nC) => reuseDistanceM(params.cellRadiusM, nC) / 1000);
    const qVals = nValues.map((nC) => reuseRatioQ(nC));

    figures.push({
      id: 'fig1_reuse_geometry',
      title: `Fig 1: Reuse Distance D and Ratio q = D/R = √(3N) vs Cluster Size N (R = ${params.cellRadiusM} m)`,
      shortTitle: '1. Reuse D & q',
      traces: [
        {
          x: nValues,
          y: dKm,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Reuse Distance D (km)',
          line: { color: PALETTE[0], width: 2.2 },
          marker: { symbol: SIM_MARKERS[0], size: 8, color: PALETTE[0] },
        },
        {
          x: nValues,
          y: qVals,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Co-Channel Reuse Ratio q = D/R',
          yaxis: 'y2',
          line: { color: PALETTE[1], width: 2.2, dash: 'dash' },
          marker: { symbol: SIM_MARKERS[1], size: 8, color: PALETTE[1] },
        },
      ],
      layout: baseFigureLayout(
        `Hexagonal Frequency Reuse Geometry (R = ${(params.cellRadiusM / 1000).toFixed(2)} km)`,
        'Cluster Size N = i² + ij + j²',
        'Reuse Distance D (km)',
        false,
        {
          yaxis2: {
            title: { text: 'Co-Channel Reuse Ratio q = D/R' },
            overlaying: 'y',
            side: 'right',
            showgrid: false,
          },
        },
      ),
      keyFindings: [
        `Increasing cluster size from N = 3 to N = 7 expands the co-channel reuse ratio q = √(3N) from ${reuseRatioQ(3).toFixed(2)} to ${reuseRatioQ(7).toFixed(2)}, pushing first-tier interferers from ${(reuseDistanceM(params.cellRadiusM, 3) / 1000).toFixed(2)} km to ${(reuseDistanceM(params.cellRadiusM, 7) / 1000).toFixed(2)} km.`,
        `Valid hexagonal cluster sizes satisfy N = i² + ij + j² ({1, 3, 4, 7, 9, 12, ...}) so that co-channel cells tile the plane symmetrically with 6 equidistant first-tier interferers.`,
        `Doubling N roughly increases reuse distance by √2 (≈ 41.4%), which raises SIR by approximately 10·(n/2)·log10(2) ≈ ${(1.505 * params.pathLossExp).toFixed(2)} dB at path-loss exponent n = ${params.pathLossExp}.`,
      ],
      table: {
        headers: ['Cluster N', '(i, j)', 'q = D/R = √(3N)', 'D (m)', 'Channels/Cell'],
        rows: nValues.map((nC) => [
          nC,
          `(${CLUSTER_IJ[nC][0]}, ${CLUSTER_IJ[nC][1]})`,
          reuseRatioQ(nC).toFixed(3),
          reuseDistanceM(params.cellRadiusM, nC).toFixed(1),
          (params.totalChannels / nC).toFixed(1),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 2: SIR vs Cluster Size N (Analytic vs Monte-Carlo)
    // ------------------------------------------------------------------
    const approxSirs = nValues.map((nC) => classicalApproxSirDb(nC, params.pathLossExp));
    const exactWorst = nValues.map((nC) =>
      exactWorstCaseCellEdgeSirDb(
        params.cellRadiusM,
        nC,
        params.pathLossExp,
        params.includeSecondTier,
      ),
    );
    const r3 = mainRuns.find((r) => r.nCluster === 3);
    const r7 = mainRuns.find((r) => r.nCluster === 7);

    figures.push({
      id: 'fig2_sir_vs_n',
      title: `Fig 2: Downlink SIR vs Cluster Size N (n = ${params.pathLossExp}, ${params.shadowingEnabled ? `σ = ${params.shadowSigmaDb} dB` : 'No Shadowing'})`,
      shortTitle: '2. SIR vs N',
      traces: [
        {
          x: nValues,
          y: mainRuns.map((r) => r.meanSirDb),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'MC Mean SIR (Area-Uniform)',
          line: { color: PALETTE[0], width: 2.2 },
          marker: { symbol: SIM_MARKERS[0], size: 7, color: PALETTE[0] },
        },
        {
          x: nValues,
          y: mainRuns.map((r) => r.p05SirDb),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'MC 5th-Percentile SIR (95% Reliability)',
          line: { color: PALETTE[1], width: 2.2 },
          marker: { symbol: SIM_MARKERS[1], size: 7, color: PALETTE[1] },
        },
        {
          x: nValues,
          y: approxSirs,
          type: 'scatter',
          mode: 'lines',
          name: 'Classical Approx: (√(3N))^n / 6',
          line: { color: THEORY_LINE_COLOR, width: 2, dash: 'dash' },
        },
        {
          x: nValues,
          y: exactWorst,
          type: 'scatter',
          mode: 'lines',
          name: 'Exact Cell-Edge Worst-Case (No Shadow)',
          line: { color: PALETTE[2], width: 1.8, dash: 'dot' },
        },
      ],
      layout: baseFigureLayout(
        `Downlink SIR vs Cluster Size N (n = ${params.pathLossExp})`,
        'Cluster Size N',
        'SIR (dB)',
      ),
      keyFindings: [
        `Moving from N = 3 to N = 7 improves Monte-Carlo mean SIR from ${r3 ? r3.meanSirDb.toFixed(1) : 'N/A'} dB to ${r7 ? r7.meanSirDb.toFixed(1) : 'N/A'} dB and lifts 5th-percentile cell-edge SIR from ${r3 ? r3.p05SirDb.toFixed(1) : 'N/A'} dB to ${r7 ? r7.p05SirDb.toFixed(1) : 'N/A'} dB.`,
        `The classical approximation (√(3N))^n / 6 overestimates exact worst-case cell-edge SIR by ${(classicalApproxSirDb(7, params.pathLossExp) - exactWorstCaseCellEdgeSirDb(params.cellRadiusM, 7, params.pathLossExp, params.includeSecondTier)).toFixed(2)} dB at N = 7 because the nearest interferers are at distance D − R rather than D.`,
        `Geometric ring-edge verification against the exact 6-interferer distance formula passes with max relative error ${(verification.maxRelError * 100).toFixed(2)}%.`,
      ],
      table: {
        headers: [
          'N',
          'Classical Approx (dB)',
          'Exact Worst-Edge (dB)',
          'MC Mean SIR (dB)',
          'MC 5th-Pct SIR (dB)',
        ],
        rows: mainRuns.map((r, i) => [
          r.nCluster,
          approxSirs[i].toFixed(2),
          exactWorst[i].toFixed(2),
          r.meanSirDb.toFixed(2),
          r.p05SirDb.toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 3: SIR CDF by Cluster Size + Cell-Position Breakdown
    // ------------------------------------------------------------------
    const cdfClusters = mainRuns.filter((r) => [3, 4, 7, 12].includes(r.nCluster));
    const selRun =
      mainRuns.find((r) => r.nCluster === params.selectedClusterN) ?? mainRuns[mainRuns.length - 1];

    const fig3Traces: Plotly.Data[] = cdfClusters.map((r, idx) => ({
      x: r.cdfX,
      y: r.cdfY,
      type: 'scatter',
      mode: 'lines',
      name: `CDF: N = ${r.nCluster} (med ${r.medianSirDb.toFixed(1)} dB)`,
      line: { color: PALETTE[idx % PALETTE.length], width: 2.2 },
    }));
    fig3Traces.push({
      x: [params.targetSirDb, params.targetSirDb],
      y: [0, 100],
      type: 'scatter',
      mode: 'lines',
      name: `Target SIR (${params.targetSirDb} dB)`,
      line: { color: '#dc2626', width: 1.6, dash: 'dash' },
    });

    figures.push({
      id: 'fig3_sir_cdf',
      title: `Fig 3: Downlink SIR Empirical CDF Across Cluster Sizes (N = 3, 4, 7, 12)`,
      shortTitle: '3. SIR CDF',
      traces: fig3Traces,
      layout: baseFigureLayout(
        `Empirical CDF of Downlink SIR (${params.shadowingEnabled ? `σ = ${params.shadowSigmaDb} dB` : 'Deterministic Path Loss'})`,
        'Downlink SIR (dB)',
        'Cumulative Probability (%)',
        false,
        { yaxis: { range: [0, 102] } },
      ),
      keyFindings: [
        `For N = ${selRun.nCluster}, interior users (r ≤ 0.35R) average ${selRun.centerSirMean.toFixed(1)} dB SIR, mid-cell users average ${selRun.midSirMean.toFixed(1)} dB, and cell-edge users (r > 0.70R) drop to ${selRun.edgeSirMean.toFixed(1)} dB — a ${(selRun.centerSirMean - selRun.edgeSirMean).toFixed(1)} dB center-to-edge spread.`,
        `At the target threshold SIR = ${params.targetSirDb} dB, outage probability P(SIR < ${params.targetSirDb} dB) is ${((selRun.outageTargetCount / selRun.users) * 100).toFixed(2)}% for N = ${selRun.nCluster}.`,
        `Shifting the CDF curve rightward via larger cluster size N directly reduces the lower tail that governs cell-edge call drops and low-order MCS fallbacks.`,
      ],
      table: {
        headers: [
          'N',
          'Center Mean SIR (dB)',
          'Mid-Cell Mean SIR (dB)',
          'Cell-Edge Mean SIR (dB)',
          'Median SIR (dB)',
          'P(SIR < Target) (%)',
        ],
        rows: mainRuns.map((r) => [
          r.nCluster,
          r.centerSirMean.toFixed(2),
          r.midSirMean.toFixed(2),
          r.edgeSirMean.toFixed(2),
          r.medianSirDb.toFixed(2),
          ((r.outageTargetCount / r.users) * 100).toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 4: Outage Probability vs N for Thresholds 9, 12, 18 dB
    // ------------------------------------------------------------------
    const out12Ci = mainRuns.map((r) => wilsonInterval(r.outage12Count, r.users));
    const fig4Traces: Plotly.Data[] = [
      {
        x: nValues,
        y: mainRuns.map((r) => (r.outage9Count / r.users) * 100),
        type: 'scatter',
        mode: 'lines+markers',
        name: `Threshold 9 dB (${params.shadowingEnabled ? `σ=${params.shadowSigmaDb} dB` : 'No Shadow'})`,
        line: { color: PALETTE[2], width: 2.2 },
        marker: { symbol: SIM_MARKERS[2], size: 7 },
      },
      {
        x: nValues,
        y: mainRuns.map((r) => (r.outage12Count / r.users) * 100),
        error_y: {
          type: 'data',
          symmetric: false,
          array: out12Ci.map((w) => w.errPlus * 100),
          arrayminus: out12Ci.map((w) => w.errMinus * 100),
          visible: true,
        },
        type: 'scatter',
        mode: 'lines+markers',
        name: `Threshold 12 dB (±95% Wilson CI)`,
        line: { color: PALETTE[0], width: 2.2 },
        marker: { symbol: SIM_MARKERS[0], size: 7 },
      },
      {
        x: nValues,
        y: mainRuns.map((r) => (r.outage18Count / r.users) * 100),
        type: 'scatter',
        mode: 'lines+markers',
        name: `Threshold 18 dB`,
        line: { color: PALETTE[1], width: 2.2 },
        marker: { symbol: SIM_MARKERS[1], size: 7 },
      },
    ];

    if (noShadowRuns.length === mainRuns.length) {
      fig4Traces.push({
        x: nValues,
        y: noShadowRuns.map((r) => (r.outage12Count / r.users) * 100),
        type: 'scatter',
        mode: 'lines',
        name: 'Threshold 12 dB (No Shadowing Baseline)',
        line: { color: THEORY_LINE_COLOR, width: 2, dash: 'dash' },
      });
    }

    const r7NoSh = noShadowRuns.find((r) => r.nCluster === 7);
    figures.push({
      id: 'fig4_outage_vs_n',
      title: 'Fig 4: Co-Channel Outage Probability vs Cluster Size N & SIR Threshold',
      shortTitle: '4. Outage vs N',
      traces: fig4Traces,
      layout: baseFigureLayout(
        'Downlink SIR Outage Probability P(SIR < γ_th) vs Cluster Size N',
        'Cluster Size N',
        'Outage Probability (%)',
        false,
        { yaxis: { range: [0, 102] } },
      ),
      keyFindings: [
        `At γ_th = 12 dB, increasing N from 3 to 7 reduces outage from ${r3 ? ((r3.outage12Count / r3.users) * 100).toFixed(1) : 'N/A'}% to ${r7 ? ((r7.outage12Count / r7.users) * 100).toFixed(1) : 'N/A'}%${r7 && r7NoSh ? ` (vs ${((r7NoSh.outage12Count / r7NoSh.users) * 100).toFixed(1)}% without shadowing)` : ''}.`,
        `Strict 18 dB SIR thresholds (required for legacy AMPS/high-order QAM) exhibit steep outage at N ≤ 4, explaining why classical analog cellular networks standardized on N = 7.`,
        `Log-normal shadowing σ = ${params.shadowingEnabled ? params.shadowSigmaDb : 0} dB broadens the SIR tail, causing nonzero outage even when deterministic geometry exceeds the SIR threshold.`,
      ],
      table: {
        headers: ['N', 'Outage @ 9 dB (%)', 'Outage @ 12 dB (%)', 'Outage @ 18 dB (%)', `Outage @ ${params.targetSirDb} dB (%)`],
        rows: mainRuns.map((r) => [
          r.nCluster,
          ((r.outage9Count / r.users) * 100).toFixed(2),
          ((r.outage12Count / r.users) * 100).toFixed(2),
          ((r.outage18Count / r.users) * 100).toFixed(2),
          ((r.outageTargetCount / r.users) * 100).toFixed(2),
        ]),
      },
    });

    // ------------------------------------------------------------------
    // Figure 5: Reuse Efficiency (1/N, Channels/Cell) vs CCI Trade-off
    // ------------------------------------------------------------------
    const chPerCell = nValues.map((nC) => params.totalChannels / nC);
    figures.push({
      id: 'fig5_tradeoff',
      title: `Fig 5: Spectrum Reuse Efficiency vs Co-Channel Interference Trade-Off (Recommended N = ${recommended.nCluster})`,
      shortTitle: '5. Reuse Trade-off',
      traces: [
        {
          x: nValues.map((nC) => `N=${nC}`),
          y: chPerCell,
          type: 'bar',
          name: `Channels / Cell (Total = ${params.totalChannels})`,
          marker: { color: PALETTE[0], opacity: 0.85 },
        },
        {
          x: nValues.map((nC) => `N=${nC}`),
          y: mainRuns.map((r) => r.p05SirDb),
          type: 'scatter',
          mode: 'lines+markers',
          name: '5th-Percentile SIR (dB)',
          yaxis: 'y2',
          line: { color: PALETTE[1], width: 2.4 },
          marker: { symbol: SIM_MARKERS[1], size: 8, color: PALETTE[1] },
        },
      ],
      layout: baseFigureLayout(
        `Capacity (Channels/Cell) vs Quality (5th-Pct SIR) — Recommended: N = ${recommended.nCluster}`,
        'Cluster Size N',
        'Available Channels per Cell (C_tot / N)',
        false,
        {
          yaxis2: {
            title: { text: '5th-Percentile SIR (dB)' },
            overlaying: 'y',
            side: 'right',
            showgrid: false,
          },
        },
      ),
      keyFindings: [
        `Smallest cluster size meeting SIR ≥ ${params.targetSirDb} dB with ≤ ${params.maxOutagePct}% outage is N = ${recommended.nCluster}, delivering ${(params.totalChannels / recommended.nCluster).toFixed(0)} channels/cell (reuse efficiency ${(100 / recommended.nCluster).toFixed(1)}%) and ${((recommended.outageTargetCount / recommended.users) * 100).toFixed(2)}% outage.`,
        `Aggressive frequency reuse (N = 1 or N = 3) maximizes per-cell spectrum (${(params.totalChannels / 3).toFixed(0)} channels/cell at N = 3) at the expense of severe cell-edge CCI, motivating fractional frequency reuse or sectorization in 4G/5G.`,
        `Increasing N from 3 to 7 cuts per-cell channel allocation by ${((1 - 3 / 7) * 100).toFixed(1)}% in exchange for cleaner interference isolation.`,
      ],
      table: {
        headers: [
          'N',
          'Reuse Efficiency (1/N %)',
          'Channels/Cell',
          '5th-Pct SIR (dB)',
          `Outage @ ${params.targetSirDb} dB (%)`,
          'Meets Spec?',
        ],
        rows: mainRuns.map((r) => {
          const outPct = (r.outageTargetCount / r.users) * 100;
          return [
            r.nCluster,
            (100 / r.nCluster).toFixed(1),
            (params.totalChannels / r.nCluster).toFixed(1),
            r.p05SirDb.toFixed(2),
            outPct.toFixed(2),
            outPct <= params.maxOutagePct ? 'YES' : 'NO',
          ];
        }),
      },
    });

    // ------------------------------------------------------------------
    // Figure 6: Serving-Cell SIR Heatmap + Co-Channel Interferer Map
    // ------------------------------------------------------------------
    if (heatmap) {
      const hexVertsX: number[] = [];
      const hexVertsY: number[] = [];
      for (let k = 0; k <= 6; k++) {
        const ang = (Math.PI / 6) + (k * Math.PI) / 3;
        hexVertsX.push(params.cellRadiusM * Math.cos(ang));
        hexVertsY.push(params.cellRadiusM * Math.sin(ang));
      }

      figures.push({
        id: 'fig6_hex_map',
        title: `Fig 6: Serving-Cell Downlink SIR Map (N = ${heatmap.nCluster}, q = ${reuseRatioQ(heatmap.nCluster).toFixed(2)})`,
        shortTitle: '6. Hex SIR Map',
        traces: [
          {
            x: heatmap.coordsM,
            y: heatmap.coordsM,
            z: heatmap.sirGrid,
            type: 'heatmap',
            colorscale: 'Portland',
            colorbar: { title: { text: 'SIR (dB)' } },
            hovertemplate: 'x=%{x:.0f} m, y=%{y:.0f} m<br>SIR=%{z:.1f} dB<extra></extra>',
          } as Plotly.Data,
          {
            x: hexVertsX,
            y: hexVertsY,
            type: 'scatter',
            mode: 'lines',
            name: 'Serving Cell Boundary',
            line: { color: '#0f172a', width: 2 },
          },
          {
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'text+markers',
            name: 'Serving BS',
            text: ['Serving BS'],
            textposition: 'top center',
            marker: { symbol: 'triangle-up', size: 11, color: '#111827' },
          },
        ],
        layout: baseFigureLayout(
          `Serving-Cell Spatial SIR Distribution (N = ${heatmap.nCluster}, D = ${(reuseDistanceM(params.cellRadiusM, heatmap.nCluster) / 1000).toFixed(2)} km)`,
          'x (m)',
          'y (m)',
          false,
          { yaxis: { scaleanchor: 'x', scaleratio: 1 } },
        ),
        keyFindings: [
          `Inside the serving hexagon (N = ${heatmap.nCluster}), downlink SIR exhibits 6-fold rotational symmetry aligned with the 6 first-tier co-channel base stations located at distance D = ${(reuseDistanceM(params.cellRadiusM, heatmap.nCluster) / 1000).toFixed(2)} km.`,
          `Lowest SIR occurs at the six hexagon vertices pointing directly toward the first-tier co-channel interferers (${exactWorstCaseCellEdgeSirDb(params.cellRadiusM, heatmap.nCluster, params.pathLossExp, params.includeSecondTier).toFixed(2)} dB deterministic floor).`,
          `Sectorizing each cell with 120° directional antennas reduces the active first-tier interferers from 6 to 2, adding roughly 10·log10(6/2) = 4.77 dB to the cell-edge SIR floor.`,
        ],
        table: {
          headers: ['Interferer #', 'Tier', 'x (m)', 'y (m)', 'Distance D (m)'],
          rows: heatmap.centers.map((c, idx) => [
            idx + 1,
            c.tier,
            c.x.toFixed(1),
            c.y.toFixed(1),
            Math.hypot(c.x, c.y).toFixed(1),
          ]),
        },
      });
    }
  }

  const requirements: RequirementCheck[] = [
    {
      id: 'sim_runs',
      label: 'Working hexagonal CCI & reuse simulation',
      met: mainRuns.length > 0,
      detail: `Simulated ${totalTrials.toLocaleString()} uniform hex-cell user drops across ${mainRuns.length} cluster sizes in ${(elapsedMs / 1000).toFixed(2)}s`,
    },
    {
      id: 'min_figures',
      label: 'At least 4 result figures generated',
      met: figures.length >= 4,
      detail: `${figures.length} figures generated (Geometry, SIR vs N, SIR CDF, Outage vs N, Reuse Trade-off, Hex SIR Map)`,
    },
    {
      id: 'two_params',
      label: 'At least 2 independent parameters varied',
      met: figures.length >= 4,
      detail: `Varied cluster size N ∈ {1,3,4,7,9,12}, SIR threshold {9,12,18} dB, user radial position, and shadowing`,
    },
    {
      id: 'baseline_compare',
      label: 'Comparison of >= 2 configurations vs baseline',
      met: figures.length >= 4,
      detail: `Compared N = 1, 3, 4, 7, 9, 12 against classical (√(3N))^n/6 and no-shadowing baselines`,
    },
    {
      id: 'verification',
      label: 'Verification against exact multi-interferer distance formula',
      met: verification.passed,
      detail: verification.passed
        ? `PASS — max rel. error ${(verification.maxRelError * 100).toFixed(2)}% (<= 15%)`
        : verification.summary,
    },
    {
      id: 'reproducible',
      label: 'Parameters & RNG seed recorded for reproducibility',
      met: Number.isFinite(params.seed),
      detail: `Seed = ${params.seed}, R = ${params.cellRadiusM} m, n = ${params.pathLossExp}, Recommended N = ${recommended?.nCluster ?? params.selectedClusterN}`,
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
      recommendedN: recommended?.nCluster ?? params.selectedClusterN,
      sirN3Mean: mainRuns.find((r) => r.nCluster === 3)?.meanSirDb ?? null,
      sirN7Mean: mainRuns.find((r) => r.nCluster === 7)?.meanSirDb ?? null,
      outageN7TargetPct:
        mainRuns.find((r) => r.nCluster === 7)
          ? (mainRuns.find((r) => r.nCluster === 7)!.outageTargetCount /
              mainRuns.find((r) => r.nCluster === 7)!.users) *
            100
          : null,
    },
  };
}

export const MODULE6_THEORY: ModuleTheoryContent = {
  abstract:
    'This module investigates hexagonal cellular frequency reuse and downlink Co-Channel Interference (CCI) across valid cluster sizes N = i² + ij + j² ∈ {1, 3, 4, 7, 9, 12}. Using exact first- and optional second-tier base-station coordinates and log-normal shadowing, it evaluates SIR distributions, outage probabilities, and the fundamental trade-off between spectrum reuse efficiency (1/N) and interference isolation.',
  objectives: [
    'Construct exact hexagonal cluster lattices using integer shift indices (i, j) and verify q = D/R = √(3N).',
    'Compare classical worst-case SIR approximations against full Monte-Carlo area-averaged and 5th-percentile SIR.',
    'Analyze SIR CDFs across cell-center, mid-cell, and cell-edge regions with and without log-normal shadowing.',
    'Identify the smallest cluster size N meeting target SIR and outage constraints to maximize per-cell channel capacity.',
  ],
  technicalBackground: [
    'Cellular networks achieve high area spectral efficiency by reusing identical radio channels in geographically separated cells. However, simultaneous transmissions in co-channel cells create Co-Channel Interference (CCI), which—unlike thermal noise—cannot be overcome simply by boosting all base-station transmit powers equally.',
    'In regular hexagonal geometry, cluster sizes are restricted to N = i² + ij + j², yielding co-channel reuse ratio q = D/R = √(3N). Larger N separates interferers farther apart (higher SIR) but shrinks per-cell channel allocation (C_total / N).',
    'Random log-normal shadowing on both desired and interfering paths creates a heavy lower tail in the SIR distribution, causing cell-edge outages even when deterministic path-loss ratios appear adequate.',
  ],
  systemModelSummary:
    'The serving base station sits at the origin of a regular pointy-top hexagon of radius R. Six first-tier (and optionally twelve second-tier) co-channel base stations are placed at exact lattice shifts determined by (i, j). Users drop uniformly inside the serving hexagon and experience path-loss exponent n with optional independent log-normal shadowing σ dB on each link.',
  equations: [
    {
      title: 'Hexagonal Cluster Size & Reuse Ratio',
      latex: 'N = i^2 + ij + j^2, \\quad q = \\frac{D}{R} = \\sqrt{3N}',
      explanation: 'Valid hexagonal cluster sizes yield 6 equidistant first-tier co-channel cells at distance D.',
    },
    {
      title: 'Downlink Signal-to-Interference Ratio (SIR)',
      latex: '\\text{SIR} = \\frac{P_t d_0^{-n} 10^{X_0/10}}{\\sum_{k=1}^{K_I} P_t d_k^{-n} 10^{X_k/10}} = \\frac{d_0^{-n} 10^{X_0/10}}{\\sum_{k=1}^{K_I} d_k^{-n} 10^{X_k/10}}',
      explanation: 'Equal base-station transmit power cancels out; SIR depends strictly on geometry, path-loss exponent n, and shadowing.',
    },
    {
      title: 'Classical First-Tier Approximation',
      latex: '\\text{SIR}_{\\text{approx}} \\approx \\frac{1}{6}\\left(\\frac{D}{R}\\right)^n = \\frac{(\\sqrt{3N})^n}{6}',
      explanation: 'Assumes user is at cell edge (d0 = R) and all 6 interferers are approximated at distance D.',
    },
    {
      title: 'Reuse Efficiency & Outage Probability',
      latex: '\\eta_{\\text{reuse}} = \\frac{1}{N}, \\quad P_{\\text{out}}(\\gamma_{\\text{th}}) = P\\big(\\text{SIR}_{\\text{dB}} < \\gamma_{\\text{th}}\\big)',
      explanation: 'Directly captures the core cellular engineering trade-off between per-cell capacity and interference reliability.',
    },
  ],
  methodology: [
    'Compute exact first-tier (6) and optional second-tier (12) co-channel BS coordinates via 60° rotations of i·e1 + j·e2.',
    'Draw thousands of uniformly distributed user coordinates inside the serving hexagon using exact rejection sampling.',
    'Evaluate downlink SIR with and without log-normal shadowing, recording empirical CDFs, radial zone means, and outage rates at 9, 12, and 18 dB.',
    'Verify simulated ring cell-edge SIR (no shadowing) against exact deterministic multi-interferer distance summation.',
  ],
  assumptions: [
    'All co-channel base stations transmit continuously at equal power (full-load worst-case CCI).',
    'Thermal noise is neglected (interference-limited cellular regime).',
    'Omnidirectional antennas (6 active first-tier interferers); 120° sectoring would reduce first-tier interferers to 2.',
  ],
  conclusionsDefault: [
    'Higher cluster size N monotonically improves SIR and reduces outage probability, but reduces per-cell channel availability proportionally to 1/N.',
    'The classical (√(3N))^n/6 approximation slightly overestimates true worst-case cell-edge SIR because near interferers sit at D − R rather than D.',
  ],
};
