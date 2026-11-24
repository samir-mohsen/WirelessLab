/**
 * Statistical helpers for Monte-Carlo error analysis, Wilson 95% confidence intervals,
 * curve interpolation, fairness metrics, and automated verification checks.
 */

export interface WilsonCI {
  p: number;
  lower: number;
  upper: number;
  errMinus: number;
  errPlus: number;
}

/**
 * 95% Wilson score confidence interval for binomial proportion (errors / trials).
 * Safe at boundary cases (0 errors or all errors).
 */
export function wilsonInterval(
  errors: number,
  trials: number,
  z = 1.959963984540054,
): WilsonCI {
  if (trials <= 0) {
    return { p: 0, lower: 0, upper: 1, errMinus: 0, errPlus: 1 };
  }
  const p = errors / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denom;
  const halfWidth = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denom;
  const lower = errors <= 0 ? 0 : Math.max(0, center - halfWidth);
  const upper = errors >= trials ? 1 : Math.min(1, center + halfWidth);
  return {
    p,
    lower,
    upper,
    errMinus: Math.max(0, p - lower),
    errPlus: Math.max(0, upper - p),
  };
}

export interface VerificationRow {
  label: string;
  point: number;
  simulated: number;
  theory: number;
  relError: number;
  errorsCount: number;
  trialsCount: number;
  included: boolean;
}

export interface VerificationResult {
  passed: boolean;
  threshold: number;
  maxRelError: number;
  meanRelError: number;
  pointsUsed: number;
  totalPoints: number;
  rows: VerificationRow[];
  summary: string;
}

export function relativeError(sim: number, theory: number): number {
  if (theory === 0) return sim === 0 ? 0 : Infinity;
  return Math.abs(sim - theory) / Math.abs(theory);
}

/**
 * Compare simulated vs theoretical points, using only statistically reliable points
 * (at least `minErrors` observed errors when error count is applicable).
 */
export function evaluateVerification(
  items: Array<{
    label: string;
    point: number;
    simulated: number;
    theory: number;
    errorsCount: number;
    trialsCount: number;
  }>,
  minErrors = 20,
  threshold = 0.15,
): VerificationResult {
  const rows: VerificationRow[] = [];
  let maxRel = 0;
  let sumRel = 0;
  let used = 0;

  for (const item of items) {
    const rel = relativeError(item.simulated, item.theory);
    const included =
      item.errorsCount >= minErrors &&
      Number.isFinite(rel) &&
      item.theory > 0;
    if (included) {
      if (rel > maxRel) maxRel = rel;
      sumRel += rel;
      used++;
    }
    rows.push({
      ...item,
      relError: rel,
      included,
    });
  }

  const meanRel = used > 0 ? sumRel / used : NaN;
  const passed = used > 0 && maxRel <= threshold;
  const summary =
    used === 0
      ? 'Insufficient error counts to verify; increase trials or lower SNR.'
      : passed
        ? `PASS — max relative error ${(maxRel * 100).toFixed(2)}% <= ${(threshold * 100).toFixed(0)}% across ${used} reliable points.`
        : `FAIL — max relative error ${(maxRel * 100).toFixed(2)}% > ${(threshold * 100).toFixed(0)}% across ${used} reliable points.`;

  return {
    passed,
    threshold,
    maxRelError: used > 0 ? maxRel : NaN,
    meanRelError: meanRel,
    pointsUsed: used,
    totalPoints: items.length,
    rows,
    summary,
  };
}

/**
 * Find the x value where y(x) crosses targetY (assuming monotonic-ish curve).
 * Uses log10(y) interpolation when logY=true (ideal for BER curves).
 * Returns null if targetY is not bracketed.
 */
export function interpolateCrossing(
  xs: number[],
  ys: number[],
  targetY: number,
  logY = true,
): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mapY = (v: number) => (logY ? Math.log10(Math.max(v, 1e-15)) : v);
  const ty = mapY(targetY);

  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (y0 <= 0 && logY) continue;
    if (y1 <= 0 && logY) continue;
    const my0 = mapY(y0);
    const my1 = mapY(y1);
    if ((my0 >= ty && my1 <= ty) || (my0 <= ty && my1 >= ty)) {
      if (my1 === my0) return xs[i];
      const t = (ty - my0) / (my1 - my0);
      return xs[i] + t * (xs[i + 1] - xs[i]);
    }
  }
  return null;
}

/** Jain's Fairness Index J = (sum x_k)^2 / (K * sum x_k^2). */
export function jainsFairnessIndex(values: number[]): number {
  const k = values.length;
  if (k === 0) return 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < k; i++) {
    sum += values[i];
    sumSq += values[i] * values[i];
  }
  if (sumSq === 0) return 1;
  return (sum * sum) / (k * sumSq);
}

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s / values.length;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
