/**
 * Radix-2 Cooley-Tukey iterative in-place FFT/IFFT with cached bit-reversal and twiddle tables.
 */

interface FFTPlan {
  n: number;
  log2n: number;
  bitRev: Uint32Array;
  cosTable: Float64Array;
  sinTable: Float64Array;
}

const planCache = new Map<number, FFTPlan>();

export function isPowerOfTwo(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

function getPlan(n: number): FFTPlan {
  const existing = planCache.get(n);
  if (existing) return existing;

  if (!isPowerOfTwo(n)) {
    throw new Error(`FFT size must be a power of 2, received ${n}`);
  }

  let log2n = 0;
  for (let t = n; t > 1; t >>= 1) log2n++;

  const bitRev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let rev = 0;
    let x = i;
    for (let b = 0; b < log2n; b++) {
      rev = (rev << 1) | (x & 1);
      x >>= 1;
    }
    bitRev[i] = rev;
  }

  const half = n >> 1;
  const cosTable = new Float64Array(half);
  const sinTable = new Float64Array(half);
  const angleStep = (-2 * Math.PI) / n;
  for (let k = 0; k < half; k++) {
    const angle = angleStep * k;
    cosTable[k] = Math.cos(angle);
    sinTable[k] = Math.sin(angle);
  }

  const plan: FFTPlan = { n, log2n, bitRev, cosTable, sinTable };
  planCache.set(n, plan);
  return plan;
}

/**
 * In-place radix-2 FFT / IFFT core.
 * If inverse=false: X[k] = sum_{n=0}^{N-1} x[n] exp(-j 2pi k n / N)
 * If inverse=true:  x[n] = (1/N) sum_{k=0}^{N-1} X[k] exp(+j 2pi k n / N) (if scale=true)
 */
function transformInPlace(
  re: Float64Array,
  im: Float64Array,
  n: number,
  inverse: boolean,
  scaleFactor: number,
): void {
  if (n === 1) {
    if (scaleFactor !== 1) {
      re[0] *= scaleFactor;
      im[0] *= scaleFactor;
    }
    return;
  }

  const { bitRev, cosTable, sinTable } = getPlan(n);

  // Bit-reversal permutation
  for (let i = 0; i < n; i++) {
    const j = bitRev[i];
    if (j > i) {
      const tr = re[i];
      const ti = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = tr;
      im[j] = ti;
    }
  }

  const sign = inverse ? -1 : 1; // cosTable/sinTable store exp(-j*angle); flip sin for inverse

  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const tableStep = n / size;
    for (let i = 0; i < n; i += size) {
      let tableIdx = 0;
      for (let j = i; j < i + halfSize; j++) {
        const k = j + halfSize;
        const wr = cosTable[tableIdx];
        const wi = sign * sinTable[tableIdx];
        tableIdx += tableStep;

        const kr = re[k];
        const ki = im[k];
        const tr = wr * kr - wi * ki;
        const ti = wr * ki + wi * kr;

        re[k] = re[j] - tr;
        im[k] = im[j] - ti;
        re[j] += tr;
        im[j] += ti;
      }
    }
  }

  if (scaleFactor !== 1) {
    for (let i = 0; i < n; i++) {
      re[i] *= scaleFactor;
      im[i] *= scaleFactor;
    }
  }
}

/** Standard unnormalized forward FFT (in-place). */
export function fftInPlace(re: Float64Array, im: Float64Array, n = re.length): void {
  transformInPlace(re, im, n, false, 1);
}

/** Standard 1/N-scaled inverse FFT (in-place). */
export function ifftInPlace(re: Float64Array, im: Float64Array, n = re.length): void {
  transformInPlace(re, im, n, true, 1 / n);
}

/** Orthonormal forward FFT scaled by 1/sqrt(N) (preserves symbol energy for OFDM). */
export function fftUnitaryInPlace(re: Float64Array, im: Float64Array, n = re.length): void {
  transformInPlace(re, im, n, false, 1 / Math.sqrt(n));
}

/** Orthonormal inverse FFT scaled by 1/sqrt(N) (preserves symbol energy for OFDM). */
export function ifftUnitaryInPlace(re: Float64Array, im: Float64Array, n = re.length): void {
  transformInPlace(re, im, n, true, 1 / Math.sqrt(n));
}

/** Convenience non-destructive FFT returning new typed arrays. */
export function fft(reIn: Float64Array, imIn: Float64Array): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(reIn);
  const im = new Float64Array(imIn);
  fftInPlace(re, im);
  return { re, im };
}

/** Convenience non-destructive IFFT returning new typed arrays. */
export function ifft(reIn: Float64Array, imIn: Float64Array): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(reIn);
  const im = new Float64Array(imIn);
  ifftInPlace(re, im);
  return { re, im };
}
