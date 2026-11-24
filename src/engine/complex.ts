/**
 * Scalar complex helpers and allocation-free typed-array complex signal utilities.
 */

export interface Complex {
  re: number;
  im: number;
}

export interface ComplexArray {
  re: Float64Array;
  im: Float64Array;
  length: number;
}

export function cMake(re: number, im = 0): Complex {
  return { re, im };
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: NaN, im: NaN };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

export function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

export function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

export function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

export function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

export function cExpI(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

export function cFromPolar(r: number, theta: number): Complex {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

export function createComplexArray(length: number): ComplexArray {
  return {
    re: new Float64Array(length),
    im: new Float64Array(length),
    length,
  };
}

export function zeroComplexArray(arr: ComplexArray): void {
  arr.re.fill(0);
  arr.im.fill(0);
}

export function copyComplexArray(src: ComplexArray, dst: ComplexArray): void {
  dst.re.set(src.re);
  dst.im.set(src.im);
}

/**
 * Linear convolution y = x * h for complex signals.
 * Writes first `outLen` samples (default x.length + h.length - 1) into `out`.
 */
export function linearConvolveComplex(
  xRe: Float64Array,
  xIm: Float64Array,
  xLen: number,
  hRe: Float64Array,
  hIm: Float64Array,
  hLen: number,
  outRe: Float64Array,
  outIm: Float64Array,
  outLen: number = xLen + hLen - 1,
): void {
  for (let n = 0; n < outLen; n++) {
    let sumRe = 0;
    let sumIm = 0;
    const lMax = n < hLen - 1 ? n : hLen - 1;
    const lMin = n >= xLen ? n - xLen + 1 : 0;
    for (let l = lMin; l <= lMax; l++) {
      const xi = n - l;
      const xr = xRe[xi];
      const xm = xIm[xi];
      const hr = hRe[l];
      const hm = hIm[l];
      sumRe += xr * hr - xm * hm;
      sumIm += xr * hm + xm * hr;
    }
    outRe[n] = sumRe;
    outIm[n] = sumIm;
  }
}
