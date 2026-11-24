/**
 * High-precision special mathematical functions:
 * erfc, erf, Q-function, logGamma, binomial, adaptive Simpson integration, and E1 exponential integral.
 */

const SQRT2 = Math.SQRT2;
const EULER_GAMMA = 0.57721566490153286061;

/**
 * High-precision complementary error function erfc(x) using Cody's rational Chebyshev approximation.
 * Relative accuracy ~ 1e-15 across the entire IEEE-754 double range.
 */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === Infinity) return 0;
  if (x === -Infinity) return 2;

  const y = Math.abs(x);
  let res: number;

  if (y <= 0.46875) {
    // erf(y) then 1 - erf(y)
    const a = [
      3.1611237438705656, 1.13864154151050156e2, 3.77485237685302021e2,
      3.20937758913846947e3, 1.85777706184603153e-1,
    ];
    const b = [
      2.36012909523441209e1, 2.44024637934444173e2, 1.28261652607737228e3,
      2.84423683343917062e3,
    ];
    const ysq = y * y;
    let xnum = a[4] * ysq;
    let xden = ysq;
    for (let i = 0; i < 3; i++) {
      xnum = (xnum + a[i]) * ysq;
      xden = (xden + b[i]) * ysq;
    }
    const erfVal = (y * (xnum + a[3])) / (xden + b[3]);
    res = x < 0 ? 1 + erfVal : 1 - erfVal;
    return res;
  } else if (y <= 4.0) {
    const c = [
      5.64188496988670089e-1, 8.88314979438837594, 6.61191906371416295e1,
      2.98635138197400131e2, 8.8195222124176909e2, 1.71204761263407058e3,
      2.05107837782607147e3, 1.23033935479799725e3, 2.15311535474403846e-8,
    ];
    const d = [
      1.57449261107098347e1, 1.17693950891312499e2, 5.37181101862009858e2,
      1.62138957456669019e3, 3.29079923573345963e3, 4.36261909014324716e3,
      3.43936767414372164e3, 1.23033935480374942e3,
    ];
    let xnum = c[8] * y;
    let xden = y;
    for (let i = 0; i < 7; i++) {
      xnum = (xnum + c[i]) * y;
      xden = (xden + d[i]) * y;
    }
    res = (xnum + c[7]) / (xden + d[7]);
    const ysq = Math.trunc(y * 16) / 16;
    const del = (y - ysq) * (y + ysq);
    res = Math.exp(-ysq * ysq) * Math.exp(-del) * res;
  } else {
    if (y >= 26.543) {
      res = 0;
    } else {
      const p = [
        3.05326634961232344e-1, 3.60344899949804439e-1, 1.25781726111229246e-1,
        1.60837851487422766e-2, 6.58749161529837803e-4, 1.63153871373020978e-2,
      ];
      const q = [
        2.56852019228982242, 1.87295284992346047, 5.27905102951428412e-1,
        6.05183413124413191e-2, 2.33520497626869185e-3,
      ];
      const ysq = 1 / (y * y);
      let xnum = p[5] * ysq;
      let xden = ysq;
      for (let i = 0; i < 4; i++) {
        xnum = (xnum + p[i]) * ysq;
        xden = (xden + q[i]) * ysq;
      }
      res = (ysq * (xnum + p[4])) / (xden + q[4]);
      res = (0.56418958354775628695 - res) / y;
      const ysq2 = Math.trunc(y * 16) / 16;
      const del = (y - ysq2) * (y + ysq2);
      res = Math.exp(-ysq2 * ysq2) * Math.exp(-del) * res;
    }
  }

  return x < 0 ? 2 - res : res;
}

export function erf(x: number): number {
  return 1 - erfc(x);
}

/** Standard Gaussian tail probability Q(x) = P(Z > x) = 0.5 * erfc(x / sqrt(2)). */
export function qFunc(x: number): number {
  return 0.5 * erfc(x / SQRT2);
}

/** Lanczos approximation for ln(Gamma(z)), z > 0. */
export function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zm1 = z - 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (zm1 + i);
  }
  const t = zm1 + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zm1 + 0.5) * Math.log(t) - t + Math.log(x);
}

export function logBinomial(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  return Math.round(Math.exp(logBinomial(n, k)));
}

/** Adaptive Simpson numerical integration of f on [a, b]. */
export function adaptiveSimpson(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-10,
  maxDepth = 16,
): number {
  const fa = f(a);
  const fb = f(b);
  const m = 0.5 * (a + b);
  const fm = f(m);
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb);

  function recurse(
    left: number,
    right: number,
    fLeft: number,
    fRight: number,
    fMid: number,
    sWhole: number,
    eps: number,
    depth: number,
  ): number {
    const mid = 0.5 * (left + right);
    const lMid = 0.5 * (left + mid);
    const rMid = 0.5 * (mid + right);
    const flm = f(lMid);
    const frm = f(rMid);
    const h = right - left;
    const sLeft = (h / 12) * (fLeft + 4 * flm + fMid);
    const sRight = (h / 12) * (fMid + 4 * frm + fRight);
    const s2 = sLeft + sRight;
    const delta = s2 - sWhole;

    if (depth <= 0 || Math.abs(delta) <= 15 * eps) {
      return s2 + delta / 15;
    }
    return (
      recurse(left, mid, fLeft, fMid, flm, sLeft, eps * 0.5, depth - 1) +
      recurse(mid, right, fMid, fRight, frm, sRight, eps * 0.5, depth - 1)
    );
  }

  return recurse(a, b, fa, fb, fm, whole, tol, maxDepth);
}

/**
 * Exponential integral E1(x) = integral_x^inf (e^-t / t) dt for x > 0.
 * Uses power series for x <= 1 and Lentz continued fraction for x > 1.
 */
export function expIntegralE1(x: number): number {
  if (x <= 0) return Infinity;
  if (x <= 1.0) {
    let sum = 0;
    let term = 1;
    for (let k = 1; k <= 60; k++) {
      term = (-term * x) / k;
      const delta = term / k;
      sum += delta;
      if (Math.abs(delta) < 1e-16 * Math.abs(sum)) break;
    }
    return -EULER_GAMMA - Math.log(x) - sum;
  }

  // Continued fraction: E1(x) = e^-x / (x + 1/(1 + 1/(x + 2/(1 + 2/(x + ...)))))
  const tiny = 1e-30;
  let b = x + 1;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const a = -i * i;
    b += 2;
    d = a * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + a / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x) * h;
}

/**
 * Scaled exponential integral e^x * E1(x) for x > 0.
 * Overflow-safe for large x (low SNR in SISO Rayleigh capacity).
 */
export function expScaledE1(x: number): number {
  if (x <= 0) return Infinity;
  if (x <= 1.0) {
    return Math.exp(x) * expIntegralE1(x);
  }
  const tiny = 1e-30;
  let b = x + 1;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const a = -i * i;
    b += 2;
    d = a * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + a / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

export function dbToLin(db: number): number {
  return Math.pow(10, db / 10);
}

export function linToDb(lin: number): number {
  return 10 * Math.log10(Math.max(lin, 1e-30));
}

export function dbmToWatts(dbm: number): number {
  return Math.pow(10, (dbm - 30) / 10);
}

export function wattsToDbm(watts: number): number {
  return 10 * Math.log10(Math.max(watts, 1e-30)) + 30;
}
