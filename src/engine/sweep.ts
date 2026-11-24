import type * as Plotly from 'plotly.js';
import { baseFigureLayout } from './chartTheme';
import { dbToLin, expScaledE1, linToDb, qFunc } from './special';
import {
  analyticalCoverageRadiusM,
  meanRxPowerDbm,
  theoryCoverageProb,
  type Module1Params,
} from '../modules/module1/model';
import { theoryBerMrc, theoryBerSc, theoryOutageMrc } from '../modules/module2/model';
import { simulateOfdmPoint, type Module3Params } from '../modules/module3/model';
import { theoryBerDsssGaussian } from '../modules/module4/model';
import { theoryCdmaBerSga } from '../modules/module5/model';
import { classicalApproxSirDb, exactWorstCaseCellEdgeSirDb, type ClusterSize } from '../modules/module6/model';
import { simulateMimoPoint } from '../modules/module7/model';
import { getUserSnrOffsetsDb, runModule8Task, type Module8Params } from '../modules/module8/model';
import type { ModuleId } from '../types/simulation';

export interface SweepDefinition {
  id: string;
  label: string;
  xLabel: string;
  yLabel: string;
  zLabel: string;
  xValues: number[];
  yValues: number[];
  contourValue?: number;
  contourLabel?: string;
  betterDirection: 'higher' | 'lower';
  logZ?: boolean;
  evaluateCell: (x: number, y: number, params: Record<string, unknown>, seed: number) => number;
}

export interface SweepResult {
  definition: SweepDefinition;
  zMatrix: number[][];
  bestPoint: { x: number; y: number; z: number };
  elapsedMs: number;
  traces: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
  summary: string;
}

export const MODULE_SWEEPS: Record<ModuleId, SweepDefinition[]> = {
  module1: [
    {
      id: 'm1_dist_n',
      label: 'Distance (m) × Path-Loss Exponent n → Coverage (%)',
      xLabel: 'Distance d (m)',
      yLabel: 'Path-Loss Exponent n',
      zLabel: 'Coverage Probability (%)',
      xValues: [200, 400, 700, 1000, 1500, 2200, 3200, 4500],
      yValues: [2.0, 2.4, 2.8, 3.2, 3.6, 4.0, 4.5],
      contourValue: 90,
      contourLabel: '90% Cell-Edge Coverage',
      betterDirection: 'higher',
      evaluateCell: (d, n, params) => {
        const p = params as unknown as Module1Params;
        const meanPr = meanRxPowerDbm(d, p, p.freqLowMHz ?? 900, n);
        return theoryCoverageProb(meanPr, p.rxSensitivityDbm ?? -100, p.shadowSigmaDb ?? 8) * 100;
      },
    },
    {
      id: 'm1_freq_sigma',
      label: 'Carrier Freq (MHz) × Shadowing σ (dB) → 90% Cell Radius (m)',
      xLabel: 'Carrier Frequency (MHz)',
      yLabel: 'Shadowing σ (dB)',
      zLabel: '90% Coverage Radius (m)',
      xValues: [700, 900, 1800, 2100, 2600, 3500, 5000],
      yValues: [2, 4, 6, 8, 10, 12],
      betterDirection: 'higher',
      evaluateCell: (freq, sigma, params) => {
        const p = params as unknown as Module1Params;
        return analyticalCoverageRadiusM(0.9, p, freq, p.pathLossExp ?? 3.2, sigma);
      },
    },
  ],
  module2: [
    {
      id: 'm2_snr_l_mrc',
      label: 'Average SNR (dB) × Diversity Order L → log10(MRC BER)',
      xLabel: 'Average SNR per Branch (dB)',
      yLabel: 'Diversity Branches L',
      zLabel: 'log10(MRC BER)',
      xValues: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
      yValues: [1, 2, 3, 4, 5, 6, 7, 8],
      contourValue: -3,
      contourLabel: 'BER = 1e-3',
      betterDirection: 'lower',
      evaluateCell: (snr, L) => Math.log10(Math.max(theoryBerMrc(dbToLin(snr), L), 1e-9)),
    },
    {
      id: 'm2_snr_l_outage',
      label: 'Average SNR (dB) × Diversity Order L → MRC Outage (%)',
      xLabel: 'Average SNR per Branch (dB)',
      yLabel: 'Diversity Branches L',
      zLabel: 'MRC Outage Probability (%)',
      xValues: [0, 2, 4, 6, 8, 10, 12, 14, 16],
      yValues: [1, 2, 3, 4, 6, 8],
      contourValue: 1,
      contourLabel: '1% Outage',
      betterDirection: 'lower',
      evaluateCell: (snr, L, params) =>
        theoryOutageMrc(dbToLin(snr), dbToLin(Number(params.outageThresholdDb ?? 5)), L) * 100,
    },
    {
      id: 'm2_snr_l_sc',
      label: 'Average SNR (dB) × Diversity Order L → log10(SC BER)',
      xLabel: 'Average SNR per Branch (dB)',
      yLabel: 'Diversity Branches L',
      zLabel: 'log10(SC BER)',
      xValues: [0, 3, 6, 9, 12, 15, 18],
      yValues: [1, 2, 3, 4, 6, 8],
      contourValue: -3,
      contourLabel: 'BER = 1e-3',
      betterDirection: 'lower',
      evaluateCell: (snr, L) => Math.log10(Math.max(theoryBerSc(dbToLin(snr), L), 1e-9)),
    },
  ],
  module3: [
    {
      id: 'm3_cp_taps',
      label: 'Cyclic Prefix N_cp × Channel Length L → log10(BER @ 18 dB)',
      xLabel: 'Cyclic Prefix Length N_cp (samples)',
      yLabel: 'Channel Multipath Taps L',
      zLabel: 'log10(Simulated OFDM BER)',
      xValues: [0, 2, 4, 6, 8, 10, 12, 16],
      yValues: [1, 3, 5, 7, 9, 11, 13],
      contourValue: -2,
      contourLabel: 'BER = 1e-2',
      betterDirection: 'lower',
      evaluateCell: (cp, L, params, seed) => {
        const p = params as unknown as Module3Params;
        const res = simulateOfdmPoint({
          ebN0Db: 18,
          modulation: p.modulation ?? 'QPSK',
          nSubcarriers: p.nSubcarriers ?? 64,
          nCp: cp,
          channelTaps: L,
          pdpDecay: p.pdpDecay ?? 3.0,
          equalizer: p.equalizer ?? 'MMSE',
          chargeCpEnergy: true,
          awgnOnly: false,
          symbolsPerChannel: 2,
          numTrials: 40,
          earlyStop: true,
          earlyStopErrors: 120,
          baseSeed: seed,
          experimentId: 391,
          snrIndex: 0,
        });
        return Math.log10(Math.max(res.ber, 1e-5));
      },
    },
    {
      id: 'm3_snr_cp',
      label: 'Eb/N0 (dB) × Cyclic Prefix N_cp → log10(BER)',
      xLabel: 'Eb/N0 (dB)',
      yLabel: 'Cyclic Prefix N_cp',
      zLabel: 'log10(OFDM BER)',
      xValues: [0, 4, 8, 12, 16, 20, 24],
      yValues: [0, 2, 4, 6, 8, 12, 16],
      contourValue: -2,
      contourLabel: 'BER = 1e-2',
      betterDirection: 'lower',
      evaluateCell: (eb, cp, params, seed) => {
        const p = params as unknown as Module3Params;
        const res = simulateOfdmPoint({
          ebN0Db: eb,
          modulation: p.modulation ?? 'QPSK',
          nSubcarriers: p.nSubcarriers ?? 64,
          nCp: cp,
          channelTaps: p.channelTaps ?? 9,
          pdpDecay: p.pdpDecay ?? 3.0,
          equalizer: p.equalizer ?? 'MMSE',
          chargeCpEnergy: true,
          awgnOnly: false,
          symbolsPerChannel: 2,
          numTrials: 35,
          earlyStop: true,
          earlyStopErrors: 120,
          baseSeed: seed,
          experimentId: 392,
          snrIndex: 0,
        });
        return Math.log10(Math.max(res.ber, 1e-5));
      },
    },
  ],
  module4: [
    {
      id: 'm4_sf_js',
      label: 'Spreading Factor SF × Jammer J/S (dB) → log10(BER)',
      xLabel: 'Jammer-to-Signal J/S (dB)',
      yLabel: 'Spreading Factor SF',
      zLabel: 'log10(DSSS BER)',
      xValues: [-4, 0, 4, 8, 12, 16, 20],
      yValues: [1, 7, 15, 31, 63, 127, 255],
      contourValue: -2,
      contourLabel: 'BER = 1e-2',
      betterDirection: 'lower',
      evaluateCell: (js, sf, params) =>
        Math.log10(Math.max(theoryBerDsssGaussian(Number(params.fixedEbN0Db ?? 8), js, sf), 1e-8)),
    },
    {
      id: 'm4_eb_js',
      label: 'Eb/N0 (dB) × Jammer J/S (dB) → Effective SINR (dB)',
      xLabel: 'Eb/N0 (dB)',
      yLabel: 'Jammer J/S (dB)',
      zLabel: 'Post-Despread SINR (dB)',
      xValues: [0, 2, 4, 6, 8, 10, 12],
      yValues: [-5, 0, 5, 10, 15, 20],
      contourValue: 6,
      contourLabel: 'SINR = 6 dB',
      betterDirection: 'higher',
      evaluateCell: (eb, js, params) => {
        const sf = Number(params.sf ?? 31);
        const sinr = 1 / (1 / dbToLin(eb) + dbToLin(js) / sf);
        return linToDb(sinr);
      },
    },
  ],
  module5: [
    {
      id: 'm5_k_nfr',
      label: 'Active Users K × Near-Far Ratio (dB) → log10(BER)',
      xLabel: 'Near-Far Ratio (dB)',
      yLabel: 'Active Users K',
      zLabel: 'log10(CDMA BER)',
      xValues: [0, 3, 6, 9, 12, 15, 18],
      yValues: [2, 4, 6, 8, 12, 16, 20],
      contourValue: -2,
      contourLabel: 'BER = 1e-2',
      betterDirection: 'lower',
      evaluateCell: (nfr, K, params) => {
        const sf = Number(params.sf ?? 31);
        const eb = Number(params.ebN0Db ?? 8);
        return Math.log10(Math.max(theoryCdmaBerSga(eb, sf, (K - 1) * dbToLin(nfr)), 1e-8));
      },
    },
    {
      id: 'm5_sf_k',
      label: 'Spreading Factor SF × Active Users K → Ideal-PC log10(BER)',
      xLabel: 'Active Users K',
      yLabel: 'Spreading Factor SF',
      zLabel: 'log10(Ideal-PC BER)',
      xValues: [2, 5, 10, 15, 20, 25, 30],
      yValues: [15, 31, 63, 127],
      contourValue: -2,
      contourLabel: 'BER = 1e-2',
      betterDirection: 'lower',
      evaluateCell: (K, sf, params) =>
        Math.log10(Math.max(theoryCdmaBerSga(Number(params.ebN0Db ?? 8), sf, K - 1), 1e-8)),
    },
  ],
  module6: [
    {
      id: 'm6_n_exp',
      label: 'Cluster Size N × Path-Loss Exponent n → Cell-Edge SIR (dB)',
      xLabel: 'Cluster Size N',
      yLabel: 'Path-Loss Exponent n',
      zLabel: 'Exact Cell-Edge SIR (dB)',
      xValues: [1, 3, 4, 7, 9, 12],
      yValues: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
      contourValue: 12,
      contourLabel: 'SIR = 12 dB',
      betterDirection: 'higher',
      evaluateCell: (nC, nExp, params) =>
        exactWorstCaseCellEdgeSirDb(
          Number(params.cellRadiusM ?? 1000),
          nC as ClusterSize,
          nExp,
          Boolean(params.includeSecondTier),
        ),
    },
    {
      id: 'm6_n_thresh',
      label: 'Cluster Size N × SIR Threshold (dB) → Margin Over Approx SIR (dB)',
      xLabel: 'Cluster Size N',
      yLabel: 'Target SIR Threshold (dB)',
      zLabel: 'SIR Margin (dB)',
      xValues: [1, 3, 4, 7, 9, 12],
      yValues: [6, 9, 12, 15, 18, 21],
      contourValue: 0,
      contourLabel: '0 dB Feasibility Boundary',
      betterDirection: 'higher',
      evaluateCell: (nC, thresh, params) =>
        classicalApproxSirDb(nC, Number(params.pathLossExp ?? 3.5)) - thresh,
    },
  ],
  module7: [
    {
      id: 'm7_snr_corr',
      label: 'SNR (dB) × Spatial Correlation ρ → 4×4 MIMO Capacity (bps/Hz)',
      xLabel: 'SNR (dB)',
      yLabel: 'Kronecker Correlation ρ = r_t = r_r',
      zLabel: 'Ergodic Capacity (bits/s/Hz)',
      xValues: [0, 5, 10, 15, 20, 25],
      yValues: [0, 0.2, 0.4, 0.6, 0.75, 0.85, 0.95],
      contourValue: 15,
      contourLabel: '15 bits/s/Hz',
      betterDirection: 'higher',
      evaluateCell: (snr, rho, _params, seed) => {
        const pt = simulateMimoPoint({
          nt: 4,
          nr: 4,
          snrDb: snr,
          rTx: rho,
          rRx: rho,
          numRealizations: 400,
          baseSeed: seed,
          experimentId: 791,
          pointIndex: 0,
        });
        return pt.ergodicCapacity;
      },
    },
    {
      id: 'm7_snr_ant',
      label: 'SNR (dB) × Square Array Size M×M → Ergodic Capacity (bps/Hz)',
      xLabel: 'SNR (dB)',
      yLabel: 'Array Dimension M (M×M MIMO)',
      zLabel: 'Ergodic Capacity (bits/s/Hz)',
      xValues: [0, 5, 10, 15, 20, 25],
      yValues: [1, 2, 3, 4, 6, 8],
      contourValue: 20,
      contourLabel: '20 bits/s/Hz',
      betterDirection: 'higher',
      evaluateCell: (snr, M, _params, seed) => {
        if (M === 1) {
          return expScaledE1(1 / dbToLin(snr)) / Math.LN2;
        }
        const pt = simulateMimoPoint({
          nt: M,
          nr: M,
          snrDb: snr,
          rTx: 0,
          rRx: 0,
          numRealizations: 300,
          baseSeed: seed,
          experimentId: 792,
          pointIndex: 0,
        });
        return pt.ergodicCapacity;
      },
    },
  ],
  module8: [
    {
      id: 'm8_snr_k',
      label: 'Mean SNR (dB) × Active Users K → OFDMA-PF Gain over TDMA (%)',
      xLabel: 'Mean System SNR (dB)',
      yLabel: 'Active Users K',
      zLabel: 'OFDMA-PF Throughput Gain (%)',
      xValues: [2, 6, 10, 14, 18, 22],
      yValues: [2, 3, 4, 6, 8],
      contourValue: 25,
      contourLabel: '+25% Gain',
      betterDirection: 'higher',
      evaluateCell: (snr, K, params, seed) => {
        const p = params as unknown as Module8Params;
        const out = runModule8Task({
          meanSnrDb: snr,
          numUsersK: K,
          bandwidthMHz: p.bandwidthMHz ?? 20,
          nSubcarriers: 64,
          snrOffsetsDb: getUserSnrOffsetsDb(K, p.snrSpreadDb ?? 22),
          channelModel: 'iid_subcarrier',
          channelTaps: 6,
          waterFilling: false,
          realizations: 180,
          seed,
        });
        return ((out.ofdmaPf.totalMbps - out.tdma.totalMbps) / Math.max(out.tdma.totalMbps, 1e-6)) * 100;
      },
    },
    {
      id: 'm8_snr_spread',
      label: 'Mean SNR (dB) × User SNR Spread (dB) → OFDMA-PF Throughput (Mbps)',
      xLabel: 'Mean System SNR (dB)',
      yLabel: 'User SNR Spread (dB)',
      zLabel: 'OFDMA-PF Throughput (Mbps)',
      xValues: [2, 6, 10, 14, 18, 22],
      yValues: [0, 6, 12, 18, 24, 30],
      betterDirection: 'higher',
      evaluateCell: (snr, spread, params, seed) => {
        const p = params as unknown as Module8Params;
        const K = p.numUsersK ?? 4;
        const out = runModule8Task({
          meanSnrDb: snr,
          numUsersK: K,
          bandwidthMHz: p.bandwidthMHz ?? 20,
          nSubcarriers: 64,
          snrOffsetsDb: getUserSnrOffsetsDb(K, spread),
          channelModel: 'iid_subcarrier',
          channelTaps: 6,
          waterFilling: false,
          realizations: 180,
          seed,
        });
        return out.ofdmaPf.totalMbps;
      },
    },
  ],
};

export async function run2DSweep(
  def: SweepDefinition,
  params: Record<string, unknown>,
  onProgress: (done: number, total: number, etaSec: number) => void,
  signal: AbortSignal,
): Promise<SweepResult> {
  const t0 = performance.now();
  const rows = def.yValues.length;
  const cols = def.xValues.length;
  const total = rows * cols;
  const zMatrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const baseSeed = Number(params.seed ?? 44100);

  let done = 0;
  let best = {
    x: def.xValues[0],
    y: def.yValues[0],
    z: def.betterDirection === 'higher' ? -Infinity : Infinity,
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (signal.aborted) {
        throw new Error('Sweep cancelled');
      }
      const x = def.xValues[c];
      const y = def.yValues[r];
      const val = def.evaluateCell(x, y, params, baseSeed + r * 997 + c * 31);
      zMatrix[r][c] = Number(val.toFixed(3));
      if (
        (def.betterDirection === 'higher' && val > best.z) ||
        (def.betterDirection === 'lower' && val < best.z)
      ) {
        best = { x, y, z: val };
      }
      done++;
      const elapsed = (performance.now() - t0) / 1000;
      const eta = done > 0 ? (elapsed / done) * (total - done) : 0;
      onProgress(done, total, eta);
      // Yield to UI event loop every 4 cells so progress bar stays buttery smooth
      if (done % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const traces: Plotly.Data[] = [
    {
      x: def.xValues,
      y: def.yValues,
      z: zMatrix,
      type: 'heatmap',
      colorscale: def.betterDirection === 'lower' ? 'Viridis_r' : 'Viridis',
      colorbar: { title: { text: def.zLabel } },
      hovertemplate: `${def.xLabel}: %{x}<br>${def.yLabel}: %{y}<br>${def.zLabel}: %{z:.3f}<extra></extra>`,
    } as Plotly.Data,
    {
      x: def.xValues,
      y: def.yValues,
      z: zMatrix,
      type: 'contour',
      showscale: false,
      contours: {
        coloring: 'none',
        showlabels: true,
        labelfont: { size: 11, color: '#ffffff' },
      },
      line: { color: 'rgba(255,255,255,0.8)', width: 1.5 },
      name: 'Contour',
    } as Plotly.Data,
  ];

  const layout = baseFigureLayout(
    `2D Parameter Sweep: ${def.label}`,
    def.xLabel,
    def.yLabel,
  );

  const summary = `Best operating point in grid: ${def.xLabel} = ${best.x}, ${def.yLabel} = ${best.y} → ${def.zLabel} = ${best.z.toFixed(3)} (evaluated ${total} grid points in ${((performance.now() - t0) / 1000).toFixed(2)}s).`;

  return {
    definition: def,
    zMatrix,
    bestPoint: best,
    elapsedMs: performance.now() - t0,
    traces,
    layout,
    summary,
  };
}
