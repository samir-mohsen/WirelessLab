import type { ModuleId } from '../types/simulation';

export interface ParameterWarning {
  severity: 'warn' | 'error';
  message: string;
}

const VALID_HEX_N = new Set([1, 3, 4, 7, 9, 12, 13, 16, 19, 21, 25, 27, 28]);
const VALID_MSEQ_SF = new Set([1, 7, 15, 31, 63, 127, 255, 511]);

export function getParameterWarnings(
  moduleId: ModuleId,
  params: Record<string, unknown>,
): ParameterWarning[] {
  const warnings: ParameterWarning[] = [];
  const num = (k: string, fallback = 0) => Number(params[k] ?? fallback);

  switch (moduleId) {
    case 'module1': {
      if (num('dMinM') >= num('dMaxM')) {
        warnings.push({ severity: 'error', message: 'd_min must be strictly smaller than d_max.' });
      }
      if (num('freqLowMHz') >= num('freqHighMHz')) {
        warnings.push({
          severity: 'warn',
          message: 'Band 1 frequency is >= Band 2; gap ΔPL will be zero or negative.',
        });
      }
      if (num('pathLossExp') < 2) {
        warnings.push({
          severity: 'warn',
          message: 'Path-loss exponent n < 2 only applies to waveguide/corridor environments.',
        });
      }
      if (num('mcSamples') < 1000) {
        warnings.push({
          severity: 'warn',
          message: 'Fewer than 1,000 MC samples widens Wilson 95% confidence bars on coverage curves.',
        });
      }
      break;
    }

    case 'module2': {
      const L = num('diversityOrder', 4);
      const bits = num('numBitsPerPoint', 80000);
      if (L < 1 || L > 8) {
        warnings.push({ severity: 'error', message: 'Diversity order L must be between 1 and 8.' });
      }
      if (num('snrMinDb') >= num('snrMaxDb')) {
        warnings.push({ severity: 'error', message: 'SNR min must be smaller than SNR max.' });
      }
      if (L >= 4 && num('snrMaxDb') >= 16 && bits < 50000) {
        warnings.push({
          severity: 'warn',
          message: `High-diversity MRC (L=${L}) reaches BER < 1e-4 at high SNR; increase Bits/Point >= 50,000 (rule N >= 100/BER) for low-tail precision.`,
        });
      }
      break;
    }

    case 'module3': {
      const N = num('nSubcarriers', 64);
      const cp = num('cpSufficient', 8);
      const L = num('channelTaps', 9);
      const trials = num('numTrials', 320);
      if (cp >= N) {
        warnings.push({
          severity: 'error',
          message: `Cyclic prefix N_cp (${cp}) >= FFT size N (${N}) is invalid and wastes > 50% symbol energy.`,
        });
      } else if (cp < L - 1) {
        warnings.push({
          severity: 'warn',
          message: `Sufficient N_cp (${cp}) < L - 1 (${L - 1}): residual ISI/ICI will produce an irreducible high-SNR BER floor.`,
        });
      }
      if (trials < 80) {
        warnings.push({
          severity: 'warn',
          message: 'Low channel trial count (< 80) may widen confidence intervals at high Eb/N0.',
        });
      }
      break;
    }

    case 'module4': {
      const sf = num('sf', 31);
      if (!VALID_MSEQ_SF.has(sf)) {
        warnings.push({
          severity: 'error',
          message: `SF = ${sf} is not a valid LFSR m-sequence length (2^m - 1).`,
        });
      }
      const fj = num('jammerFreqNorm', 0.13);
      if (fj <= 0.01 || fj >= 0.49) {
        warnings.push({
          severity: 'warn',
          message: 'Normalized tone frequency f_j/R_c should stay strictly inside (0.01, 0.49) to avoid DC/Nyquist aliasing.',
        });
      }
      if (num('jsMinDb') >= num('jsMaxDb')) {
        warnings.push({ severity: 'error', message: 'J/S min must be strictly less than J/S max.' });
      }
      if (num('bitsPerPoint') < 10000) {
        warnings.push({
          severity: 'warn',
          message: 'Bits/Point < 10,000 limits BER resolution to ~1e-2 (rule N >= 100/BER).',
        });
      }
      break;
    }

    case 'module5': {
      const sf = num('sf', 31);
      const K = num('numUsersK', 8);
      if (K > sf) {
        warnings.push({
          severity: 'warn',
          message: `Active users K (${K}) > SF (${sf}): system is overloaded and Decorrelating MUD matrix R becomes singular.`,
        });
      }
      if (num('nearFarDb') > 10 * Math.log10(Math.max(sf, 1))) {
        warnings.push({
          severity: 'warn',
          message: `Near-Far Ratio (${num('nearFarDb')} dB) exceeds processing gain (${(10 * Math.log10(sf)).toFixed(1)} dB): severe uncontrolled BER collapse expected.`,
        });
      }
      break;
    }

    case 'module6': {
      const N = num('selectedClusterN', 7);
      if (!VALID_HEX_N.has(N)) {
        warnings.push({
          severity: 'error',
          message: `Cluster size N = ${N} does not satisfy the hexagonal lattice constraint N = i² + ij + j².`,
        });
      }
      if (num('mcUsers') < 1500) {
        warnings.push({
          severity: 'warn',
          message: 'Fewer than 1,500 user drops increases variance in 5th-percentile cell-edge SIR.',
        });
      }
      break;
    }

    case 'module7': {
      const rt = num('corrTx', 0.7);
      const rr = num('corrRx', 0.7);
      if (rt >= 0.98 || rr >= 0.98) {
        warnings.push({
          severity: 'warn',
          message: 'Spatial correlation >= 0.98 makes the Kronecker covariance matrix nearly rank-1 (severe multiplexing collapse).',
        });
      }
      if (num('numRealizations', 10000) < 2000) {
        warnings.push({
          severity: 'warn',
          message: 'Fewer than 2,000 channel realizations increases jitter in 10% outage capacity CDF estimates.',
        });
      }
      break;
    }

    case 'module8': {
      const K = num('numUsersK', 4);
      const N = num('nSubcarriers', 64);
      if (K > N) {
        warnings.push({ severity: 'error', message: 'Users K cannot exceed subcarrier count N_sc.' });
      }
      if (num('realizations', 2000) < 1000) {
        warnings.push({
          severity: 'warn',
          message: 'Fewer than 1,000 fading frames may leave Proportional Fair moving averages slightly noisy.',
        });
      }
      break;
    }
  }

  return warnings;
}
