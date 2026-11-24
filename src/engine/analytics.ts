import type * as Plotly from 'plotly.js';
import type { FigureSpec } from '../types/simulation';

export interface CurveDiagnosticItem {
  traceName: string;
  metricLabel: string;
  valueText: string;
  secondaryLabel?: string;
  secondaryText?: string;
  deltaVsBaseline?: string;
}

export interface FigureDiagnosticsSummary {
  kind: 'ber' | 'outage' | 'capacity' | 'generic';
  headline: string;
  items: CurveDiagnosticItem[];
}

/**
 * Solve for x where a monotonic/semi-monotonic curve crosses targetY.
 * Uses log10 interpolation on Y when logY=true (essential for BER / Outage curves).
 */
export function solveXForTargetY(
  xs: number[],
  ys: number[],
  targetY: number,
  logY = true,
): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  if (logY && targetY <= 0) return null;

  const ty = logY ? Math.log10(targetY) : targetY;

  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (!Number.isFinite(x0) || !Number.isFinite(x1) || !Number.isFinite(y0) || !Number.isFinite(y1)) {
      continue;
    }
    if (logY && (y0 <= 0 || y1 <= 0)) continue;

    const ly0 = logY ? Math.log10(y0) : y0;
    const ly1 = logY ? Math.log10(y1) : y1;

    const crosses =
      (ly0 >= ty && ly1 <= ty) || (ly0 <= ty && ly1 >= ty);
    if (!crosses) continue;

    if (Math.abs(ly1 - ly0) < 1e-12) return x0;
    const t = (ty - ly0) / (ly1 - ly0);
    return x0 + t * (x1 - x0);
  }

  // Gentle bounded log-linear extrapolation (<= 2 dB) if final point stops just above target (e.g. 1.05e-3 vs 1e-3)
  if (logY && n >= 2) {
    const x0 = xs[n - 2];
    const x1 = xs[n - 1];
    const y0 = ys[n - 2];
    const y1 = ys[n - 1];
    if (
      Number.isFinite(x0) &&
      Number.isFinite(x1) &&
      Number.isFinite(y0) &&
      Number.isFinite(y1) &&
      y0 > y1 &&
      y1 > targetY &&
      y1 <= targetY * 1.6
    ) {
      const ly0 = Math.log10(y0);
      const ly1 = Math.log10(y1);
      const t = (ty - ly1) / (ly1 - ly0);
      const xEst = x1 + t * (x1 - x0);
      if (Number.isFinite(xEst) && xEst - x1 > 0 && xEst - x1 <= 2.5) {
        return xEst;
      }
    }
  }
  return null;
}

/**
 * Estimate asymptotic diversity order d = -d(log10 BER) / d(SNR_dB / 10)
 * via ordinary least-squares over valid decreasing high-SNR points above the Monte-Carlo floor.
 */
export function estimateDiversityOrder(snrDb: number[], ber: number[]): number | null {
  const n = Math.min(snrDb.length, ber.length);
  const finitePos = ber.filter((b) => Number.isFinite(b) && b > 0);
  if (finitePos.length < 2) return null;
  const minVal = Math.min(...finitePos);
  // Detect repeated clamped zero-error floor (e.g., 1e-5 repeated across high SNRs)
  const floorCount = finitePos.filter((b) => Math.abs(b - minVal) <= minVal * 1e-6).length;
  const hasClampedFloor = floorCount >= 2 && minVal <= 1e-4;

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const s = snrDb[i];
    const b = ber[i];
    if (!Number.isFinite(s) || !Number.isFinite(b)) continue;
    if (hasClampedFloor && b <= minVal * 1.05) continue;
    if (b > 2e-5 && b < 0.08) {
      pts.push({ x: s / 10, y: Math.log10(b) });
    }
  }
  if (pts.length < 2) return null;
  // Use upper portion of valid non-floor points (high-SNR asymptotic tail, at least 3 pts when available)
  const startIdx = pts.length >= 5 ? Math.floor(pts.length / 2) - 1 : 0;
  const tail = pts.slice(startIdx);
  const meanX = tail.reduce((a, p) => a + p.x, 0) / tail.length;
  const meanY = tail.reduce((a, p) => a + p.y, 0) / tail.length;

  let num = 0;
  let den = 0;
  for (const p of tail) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den < 1e-12) return null;
  const slope = -num / den;
  return Number.isFinite(slope) && slope > 0 ? slope : null;
}

/**
 * Estimate MIMO high-SNR multiplexing gain r = dC / d(SNR_dB / 3.0103)
 * (bits/s/Hz gained per doubling of linear SNR).
 */
export function estimateMultiplexingGain(snrDb: number[], capacity: number[]): number | null {
  const pts: Array<{ x: number; y: number }> = [];
  const n = Math.min(snrDb.length, capacity.length);
  for (let i = 0; i < n; i++) {
    const s = snrDb[i];
    const c = capacity[i];
    if (Number.isFinite(s) && Number.isFinite(c) && s >= 10) {
      pts.push({ x: s / (10 * Math.log10(2)), y: c });
    }
  }
  if (pts.length < 2) return null;
  const meanX = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const meanY = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den < 1e-12) return null;
  const slope = num / den;
  return Number.isFinite(slope) && slope > 0 ? slope : null;
}

function toNumberArray(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => (typeof v === 'number' ? v : Number(v)));
}

function isTheoryOrPinnedTrace(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('theory') ||
    lower.includes('analytical') ||
    lower.includes('[pinned]') ||
    lower.includes('approx') ||
    lower.includes('target') ||
    lower.includes('threshold')
  );
}

/**
 * Extract quantitative engineering diagnostics automatically from any FigureSpec:
 * - For BER/Outage log-Y vs SNR curves: Required SNR @ 1e-3 (or 1e-2), SNR gain vs first curve, and estimated diversity order.
 * - For Capacity/Throughput vs SNR curves: Peak metric & high-SNR multiplexing slope (bps/Hz per 3 dB).
 * - Returns null for heatmaps, polar/hex maps, or single-point bar summaries where curve-fitting is not applicable.
 */
export function extractFigureDiagnostics(figure: FigureSpec): FigureDiagnosticsSummary | null {
  const scatterTraces = figure.traces.filter((tr) => {
    const t = tr as Partial<Plotly.PlotData>;
    return (!t.type || t.type === 'scatter') && Array.isArray(t.x) && Array.isArray(t.y);
  }) as Array<Partial<Plotly.PlotData>>;

  if (scatterTraces.length === 0) return null;

  const yTitle = String(
    typeof figure.layout.yaxis === 'object' && figure.layout.yaxis?.title
      ? typeof figure.layout.yaxis.title === 'string'
        ? figure.layout.yaxis.title
        : figure.layout.yaxis.title.text ?? ''
      : '',
  ).toLowerCase();

  const xTitle = String(
    typeof figure.layout.xaxis === 'object' && figure.layout.xaxis?.title
      ? typeof figure.layout.xaxis.title === 'string'
        ? figure.layout.xaxis.title
        : figure.layout.xaxis.title.text ?? ''
      : '',
  ).toLowerCase();

  const isLogY =
    Boolean(figure.isLogY) ||
    (typeof figure.layout.yaxis === 'object' && figure.layout.yaxis?.type === 'log');

  const isSnrX =
    xTitle.includes('snr') || xTitle.includes('eb/n0') || xTitle.includes('e_b/n_0');

  const primaryCurves = scatterTraces.filter(
    (tr) => tr.name && !isTheoryOrPinnedTrace(String(tr.name)),
  );
  const curves = (primaryCurves.length > 0 ? primaryCurves : scatterTraces).slice(0, 5);

  // Case 1: BER / Outage vs SNR (log-Y)
  if (isLogY && isSnrX && (yTitle.includes('ber') || yTitle.includes('outage') || yTitle.includes('prob'))) {
    const isOutage = yTitle.includes('outage');
    const targetPrimary = isOutage ? 1e-2 : 1e-3;
    const targetFallback = isOutage ? 1e-1 : 1e-2;
    const targetLabelPrimary = isOutage ? 'SNR @ 1% Outage' : 'SNR @ BER=10⁻³';
    const targetLabelFallback = isOutage ? 'SNR @ 10% Outage' : 'SNR @ BER=10⁻²';

    // Determine whether most curves reach primary target; otherwise use fallback target
    const reachedPrimary = curves.filter(
      (c) => solveXForTargetY(toNumberArray(c.x), toNumberArray(c.y), targetPrimary, true) !== null,
    ).length;
    const useTarget = reachedPrimary >= 1 ? targetPrimary : targetFallback;
    const metricLabel = reachedPrimary >= 1 ? targetLabelPrimary : targetLabelFallback;

    let baselineSnr: number | null = null;
    const items: CurveDiagnosticItem[] = curves.map((c, idx) => {
      const xs = toNumberArray(c.x);
      const ys = toNumberArray(c.y);
      const reqSnr = solveXForTargetY(xs, ys, useTarget, true);
      if (idx === 0 && reqSnr !== null) baselineSnr = reqSnr;
      const divSlope = estimateDiversityOrder(xs, ys);
      const delta =
        idx > 0 && reqSnr !== null && baselineSnr !== null
          ? `${baselineSnr - reqSnr >= 0 ? '+' : ''}${(baselineSnr - reqSnr).toFixed(2)} dB gain`
          : undefined;
      return {
        traceName: String(c.name ?? `Curve ${idx + 1}`),
        metricLabel,
        valueText: reqSnr !== null ? `${reqSnr.toFixed(2)} dB` : '> sweep max',
        secondaryLabel: 'Est. Slope d',
        secondaryText: divSlope !== null ? `${divSlope.toFixed(2)}` : '—',
        deltaVsBaseline: delta,
      };
    });

    return {
      kind: isOutage ? 'outage' : 'ber',
      headline: isOutage
        ? 'Automated Outage Threshold & Asymptotic Slope Diagnostics'
        : 'Automated Target-BER SNR Solver & Diversity Order Fit',
      items,
    };
  }

  // Case 2: Capacity / Throughput vs SNR
  if (!isLogY && isSnrX && (yTitle.includes('capacity') || yTitle.includes('throughput') || yTitle.includes('bps'))) {
    const unit = yTitle.includes('mbps') ? 'Mbps' : 'bps/Hz';
    const isSpectralEff = unit === 'bps/Hz';
    let basePeak: number | null = null;

    const items: CurveDiagnosticItem[] = curves.map((c, idx) => {
      const xs = toNumberArray(c.x);
      const ys = toNumberArray(c.y);
      const finiteYs = ys.filter((v) => Number.isFinite(v));
      const peak = finiteYs.length > 0 ? Math.max(...finiteYs) : Number.NaN;
      if (idx === 0 && Number.isFinite(peak)) basePeak = peak;
      const muxGain = isSpectralEff ? estimateMultiplexingGain(xs, ys) : null;
      const ratio =
        idx > 0 && Number.isFinite(peak) && basePeak !== null && basePeak > 0
          ? `${(peak / basePeak).toFixed(2)}× vs base`
          : undefined;

      return {
        traceName: String(c.name ?? `Curve ${idx + 1}`),
        metricLabel: `Peak (${unit})`,
        valueText: Number.isFinite(peak) ? `${peak.toFixed(2)} ${unit}` : '—',
        secondaryLabel: isSpectralEff ? 'Mux Gain r' : 'Mean',
        secondaryText: isSpectralEff
          ? muxGain !== null
            ? `${muxGain.toFixed(2)} bps/Hz/3dB`
            : '—'
          : finiteYs.length > 0
            ? `${(finiteYs.reduce((a, b) => a + b, 0) / finiteYs.length).toFixed(2)} ${unit}`
            : '—',
        deltaVsBaseline: ratio,
      };
    });

    return {
      kind: 'capacity',
      headline: isSpectralEff
        ? 'Automated Peak Spectral Efficiency & Multiplexing Gain Fit'
        : 'Automated Multiuser Throughput Scaling Summary',
      items,
    };
  }

  return null;
}
