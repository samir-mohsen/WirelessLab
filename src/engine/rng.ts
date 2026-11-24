/**
 * Deterministic PRNG (xoshiro128**) with SplitMix32 seeding and sub-seed derivation.
 * Guarantees bit-for-bit identical Monte-Carlo realizations regardless of Web Worker count.
 */

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
  };
}

function rotl32(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Derive an independent 32-bit sub-seed from a base seed and arbitrary integer indices
 * (e.g., experiment ID, SNR index, trial index).
 */
export function deriveSubSeed(baseSeed: number, ...indices: number[]): number {
  let h = (baseSeed >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < indices.length; i++) {
    let k = (indices[i] | 0) >>> 0;
    k = Math.imul(k, 0xcc9e2d51) >>> 0;
    k = rotl32(k, 15);
    k = Math.imul(k, 0x1b873593) >>> 0;
    h = (h ^ k) >>> 0;
    h = rotl32(h, 13);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h >>> 0;
}

export class SeededRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private hasSpareGaussian = false;
  private spareGaussian = 0;

  constructor(seed: number) {
    const sm = splitmix32(seed >>> 0);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 0x6d2b79f5;
    }
  }

  /** Returns uniform 32-bit unsigned integer in [0, 2^32 - 1]. */
  nextUint32(): number {
    const result = Math.imul(rotl32(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;

    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl32(this.s3, 11);

    return result;
  }

  /** Returns uniform float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() * 2.3283064365386963e-10; // 1 / 2^32
  }

  /** Returns uniform float in (0, 1). */
  nextOpenFloat(): number {
    return (this.nextUint32() + 0.5) * 2.3283064365386963e-10;
  }

  /** Returns 0 or 1 with equal probability. */
  nextBit(): 0 | 1 {
    return (this.nextUint32() & 1) as 0 | 1;
  }

  /** Returns uniform integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /** Standard real Gaussian N(0, 1) via Box-Muller transform. */
  nextGaussian(): number {
    if (this.hasSpareGaussian) {
      this.hasSpareGaussian = false;
      return this.spareGaussian;
    }
    const u1 = this.nextOpenFloat();
    const u2 = this.nextFloat();
    const r = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    this.spareGaussian = r * Math.sin(theta);
    this.hasSpareGaussian = true;
    return r * Math.cos(theta);
  }

  /**
   * Circularly symmetric complex Gaussian CN(0, variance).
   * Real and imaginary parts each have variance = variance / 2.
   */
  nextComplexGaussian(variance = 1): { re: number; im: number } {
    const u1 = this.nextOpenFloat();
    const u2 = this.nextFloat();
    const scale = Math.sqrt(-variance * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    return {
      re: scale * Math.cos(theta),
      im: scale * Math.sin(theta),
    };
  }

  /** Fill a Float64Array with iid N(0, sigma^2). */
  fillGaussian(out: Float64Array, sigma = 1): void {
    for (let i = 0; i < out.length; i++) {
      out[i] = this.nextGaussian() * sigma;
    }
  }

  /** Fill paired Float64Arrays with iid CN(0, variance). */
  fillComplexGaussian(reOut: Float64Array, imOut: Float64Array, variance = 1): void {
    const n = reOut.length;
    for (let i = 0; i < n; i++) {
      const u1 = this.nextOpenFloat();
      const u2 = this.nextFloat();
      const scale = Math.sqrt(-variance * Math.log(u1));
      const theta = 2.0 * Math.PI * u2;
      reOut[i] = scale * Math.cos(theta);
      imOut[i] = scale * Math.sin(theta);
    }
  }

  /** Alias for nextFloat() returning uniform float in [0, 1). */
  next(): number {
    return this.nextFloat();
  }
}

export function createRng(seed: number): SeededRNG {
  return new SeededRNG(seed);
}

