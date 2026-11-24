/**
 * Small dense complex matrix library for MIMO capacity, Cholesky correlation, and CDMA decorrelator.
 * Flat row-major Float64Arrays for real and imaginary parts.
 */

import { Complex } from './complex';

export interface ComplexMatrix {
  rows: number;
  cols: number;
  re: Float64Array;
  im: Float64Array;
}

export function matCreate(rows: number, cols: number): ComplexMatrix {
  return {
    rows,
    cols,
    re: new Float64Array(rows * cols),
    im: new Float64Array(rows * cols),
  };
}

export function matIdentity(n: number): ComplexMatrix {
  const m = matCreate(n, n);
  for (let i = 0; i < n; i++) {
    m.re[i * n + i] = 1;
  }
  return m;
}

export function matClone(a: ComplexMatrix): ComplexMatrix {
  return {
    rows: a.rows,
    cols: a.cols,
    re: new Float64Array(a.re),
    im: new Float64Array(a.im),
  };
}

export function matGet(a: ComplexMatrix, r: number, c: number): Complex {
  const idx = r * a.cols + c;
  return { re: a.re[idx], im: a.im[idx] };
}

export function matSet(a: ComplexMatrix, r: number, c: number, re: number, im = 0): void {
  const idx = r * a.cols + c;
  a.re[idx] = re;
  a.im[idx] = im;
}

export function matAdd(a: ComplexMatrix, b: ComplexMatrix): ComplexMatrix {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error('Matrix dimension mismatch in matAdd');
  }
  const out = matCreate(a.rows, a.cols);
  const len = a.re.length;
  for (let i = 0; i < len; i++) {
    out.re[i] = a.re[i] + b.re[i];
    out.im[i] = a.im[i] + b.im[i];
  }
  return out;
}

export function matScale(a: ComplexMatrix, scalar: number): ComplexMatrix {
  const out = matCreate(a.rows, a.cols);
  const len = a.re.length;
  for (let i = 0; i < len; i++) {
    out.re[i] = a.re[i] * scalar;
    out.im[i] = a.im[i] * scalar;
  }
  return out;
}

/** Conjugate transpose A^H. */
export function matConjTranspose(a: ComplexMatrix): ComplexMatrix {
  const out = matCreate(a.cols, a.rows);
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < a.cols; c++) {
      const src = r * a.cols + c;
      const dst = c * a.rows + r;
      out.re[dst] = a.re[src];
      out.im[dst] = -a.im[src];
    }
  }
  return out;
}

/** Matrix multiplication C = A * B. */
export function matMul(a: ComplexMatrix, b: ComplexMatrix, out?: ComplexMatrix): ComplexMatrix {
  if (a.cols !== b.rows) {
    throw new Error(`Matrix dimension mismatch in matMul: (${a.rows}x${a.cols}) * (${b.rows}x${b.cols})`);
  }
  const res = out ?? matCreate(a.rows, b.cols);
  const m = a.rows;
  const kMax = a.cols;
  const n = b.cols;

  for (let i = 0; i < m; i++) {
    const aRow = i * kMax;
    const cRow = i * n;
    for (let j = 0; j < n; j++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let k = 0; k < kMax; k++) {
        const aIdx = aRow + k;
        const bIdx = k * n + j;
        const ar = a.re[aIdx];
        const ai = a.im[aIdx];
        const br = b.re[bIdx];
        const bi = b.im[bIdx];
        sumRe += ar * br - ai * bi;
        sumIm += ar * bi + ai * br;
      }
      res.re[cRow + j] = sumRe;
      res.im[cRow + j] = sumIm;
    }
  }
  return res;
}

/** Compute A * A^H (Nr x Nr Hermitian positive semidefinite). */
export function matMulSelfConjTranspose(a: ComplexMatrix, out?: ComplexMatrix): ComplexMatrix {
  const m = a.rows;
  const kMax = a.cols;
  const res = out ?? matCreate(m, m);
  for (let i = 0; i < m; i++) {
    const rowI = i * kMax;
    for (let j = i; j < m; j++) {
      const rowJ = j * kMax;
      let sumRe = 0;
      let sumIm = 0;
      for (let k = 0; k < kMax; k++) {
        const ar = a.re[rowI + k];
        const ai = a.im[rowI + k];
        const br = a.re[rowJ + k];
        const bi = -a.im[rowJ + k]; // conjugate
        sumRe += ar * br - ai * bi;
        sumIm += ar * bi + ai * br;
      }
      res.re[i * m + j] = sumRe;
      res.im[i * m + j] = sumIm;
      if (i !== j) {
        res.re[j * m + i] = sumRe;
        res.im[j * m + i] = -sumIm;
      }
    }
  }
  return res;
}

/**
 * Complex determinant via LU decomposition with partial pivoting.
 */
export function matDeterminant(a: ComplexMatrix): Complex {
  if (a.rows !== a.cols) {
    throw new Error('Determinant requires a square matrix');
  }
  const n = a.rows;
  if (n === 1) {
    return { re: a.re[0], im: a.im[0] };
  }
  if (n === 2) {
    // a00*a11 - a01*a10
    const re =
      a.re[0] * a.re[3] - a.im[0] * a.im[3] - (a.re[1] * a.re[2] - a.im[1] * a.im[2]);
    const im =
      a.re[0] * a.im[3] + a.im[0] * a.re[3] - (a.re[1] * a.im[2] + a.im[1] * a.re[2]);
    return { re, im };
  }

  const luRe = new Float64Array(a.re);
  const luIm = new Float64Array(a.im);
  let sign = 1;

  for (let k = 0; k < n; k++) {
    // Partial pivot search
    let pivotRow = k;
    let maxAbs2 = luRe[k * n + k] ** 2 + luIm[k * n + k] ** 2;
    for (let i = k + 1; i < n; i++) {
      const idx = i * n + k;
      const abs2 = luRe[idx] ** 2 + luIm[idx] ** 2;
      if (abs2 > maxAbs2) {
        maxAbs2 = abs2;
        pivotRow = i;
      }
    }

    if (maxAbs2 < 1e-30) {
      return { re: 0, im: 0 };
    }

    if (pivotRow !== k) {
      sign = -sign;
      for (let j = k; j < n; j++) {
        const i1 = k * n + j;
        const i2 = pivotRow * n + j;
        const tr = luRe[i1];
        const ti = luIm[i1];
        luRe[i1] = luRe[i2];
        luIm[i1] = luIm[i2];
        luRe[i2] = tr;
        luIm[i2] = ti;
      }
    }

    const pivRe = luRe[k * n + k];
    const pivIm = luIm[k * n + k];
    const pivAbs2 = pivRe * pivRe + pivIm * pivIm;

    for (let i = k + 1; i < n; i++) {
      const ik = i * n + k;
      const numRe = luRe[ik];
      const numIm = luIm[ik];
      // factor = lu[i,k] / lu[k,k]
      const fRe = (numRe * pivRe + numIm * pivIm) / pivAbs2;
      const fIm = (numIm * pivRe - numRe * pivIm) / pivAbs2;

      for (let j = k + 1; j < n; j++) {
        const ij = i * n + j;
        const kj = k * n + j;
        const kr = luRe[kj];
        const ki = luIm[kj];
        luRe[ij] -= fRe * kr - fIm * ki;
        luIm[ij] -= fRe * ki + fIm * kr;
      }
    }
  }

  let detRe = sign;
  let detIm = 0;
  for (let i = 0; i < n; i++) {
    const dr = luRe[i * n + i];
    const di = luIm[i * n + i];
    const nextRe = detRe * dr - detIm * di;
    const nextIm = detRe * di + detIm * dr;
    detRe = nextRe;
    detIm = nextIm;
  }

  return { re: detRe, im: detIm };
}

/**
 * Cholesky decomposition R = L * L^H for Hermitian positive definite matrix R.
 * Returns lower-triangular matrix L.
 */
export function matCholesky(r: ComplexMatrix): ComplexMatrix {
  if (r.rows !== r.cols) {
    throw new Error('Cholesky requires a square matrix');
  }
  const n = r.rows;
  const L = matCreate(n, n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let k = 0; k < j; k++) {
        const ik = i * n + k;
        const jk = j * n + k;
        // L[i,k] * conj(L[j,k])
        sumRe += L.re[ik] * L.re[jk] + L.im[ik] * L.im[jk];
        sumIm += L.im[ik] * L.re[jk] - L.re[ik] * L.im[jk];
      }

      if (i === j) {
        const diag = r.re[i * n + i] - sumRe;
        L.re[i * n + j] = Math.sqrt(Math.max(diag, 1e-14));
        L.im[i * n + j] = 0;
      } else {
        const ij = i * n + j;
        const ljj = L.re[j * n + j];
        L.re[ij] = (r.re[ij] - sumRe) / ljj;
        L.im[ij] = (r.im[ij] - sumIm) / ljj;
      }
    }
  }

  return L;
}

/** Exponential spatial correlation matrix R[i,j] = rho^|i-j|. */
export function matExponentialCorrelation(n: number, rho: number): ComplexMatrix {
  const clamped = Math.max(0, Math.min(0.9999, rho));
  const R = matCreate(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      R.re[i * n + j] = Math.pow(clamped, Math.abs(i - j));
    }
  }
  return R;
}

/** Real matrix inverse via Gauss-Jordan with partial pivoting (for CDMA decorrelator). */
export function matInverseReal(a: Float64Array, n: number): Float64Array {
  const aug = new Float64Array(n * 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      aug[i * 2 * n + j] = a[i * n + j];
    }
    aug[i * 2 * n + n + i] = 1;
  }

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col * 2 * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(aug[r * 2 * n + col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error('Matrix is singular in matInverseReal');
    }
    if (pivotRow !== col) {
      for (let j = 0; j < 2 * n; j++) {
        const tmp = aug[col * 2 * n + j];
        aug[col * 2 * n + j] = aug[pivotRow * 2 * n + j];
        aug[pivotRow * 2 * n + j] = tmp;
      }
    }
    const piv = aug[col * 2 * n + col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col * 2 * n + j] /= piv;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r * 2 * n + col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[r * 2 * n + j] -= factor * aug[col * 2 * n + j];
      }
    }
  }

  const inv = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i * n + j] = aug[i * 2 * n + n + j];
    }
  }
  return inv;
}
