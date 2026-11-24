import type { ModuleDescriptor, ModuleId } from '../types/simulation';

export const MODULES: ModuleDescriptor[] = [
  {
    id: 'module1',
    number: 1,
    title: 'Wireless Propagation & Cellular Coverage',
    shortTitle: 'Propagation & Coverage',
    oneLineIdea:
      'FSPL, log-distance shadowing, 900 MHz vs 3.5 GHz link budgets, and cell-edge outage radius.',
    milestone: 3,
    implemented: true,
    requiredResultsSummary: [
      'Received Power vs Distance (900 MHz & 3.5 GHz)',
      'Path Loss gap annotation (11.8 dB)',
      'Effect of path-loss exponent n',
      'Coverage/Outage vs analytical Q-function',
      'Environment comparison & cell radius table',
    ],
  },
  {
    id: 'module2',
    number: 2,
    title: 'Diversity Combining over Fading Channels',
    shortTitle: 'Diversity Combining',
    oneLineIdea:
      'Coherent BPSK over Rayleigh branches comparing No Diversity, SC, EGC, and MRC up to L=8.',
    milestone: 2,
    implemented: true,
    requiredResultsSummary: [
      'BER vs SNR for No Div / SC / MRC + theory',
      'Fixed L=2 and L=4 technique comparison',
      'Diversity order slope (L = 1, 2, 4, 8)',
      'Outage probability vs average SNR',
      'Complexity vs gain comparison table',
    ],
  },
  {
    id: 'module3',
    number: 3,
    title: 'OFDM Performance over Multipath Channels',
    shortTitle: 'OFDM & Cyclic Prefix',
    oneLineIdea:
      'True linear-convolution ISI study of Cyclic Prefix length, PDP, efficiency trade-off, and ZF vs MMSE.',
    milestone: 1,
    implemented: true,
    requiredResultsSummary: [
      'Channel PDP and |H[k]| frequency response',
      'Verification: AWGN & Rayleigh closed forms',
      'BER vs Eb/N0 (No CP, Short, Sufficient, Long)',
      'BER vs max excess delay L-1',
      'Efficiency & CP energy trade-off (U-curve)',
      'ZF vs MMSE (QPSK & 16-QAM)',
      'Equalized constellations',
    ],
  },
  {
    id: 'module4',
    number: 4,
    title: 'DSSS Performance under Interference',
    shortTitle: 'DSSS & Interference',
    oneLineIdea:
      'LFSR m-sequence & Gold code spreading against narrowband jamming and processing gain analysis.',
    milestone: 4,
    implemented: true,
    requiredResultsSummary: [
      'BER vs Eb/N0 with and without interference',
      'BER vs jammer power J/S (dB)',
      'Effect of spreading factor SF',
      'Measured vs theoretical processing gain',
      'Conventional BPSK vs DSSS + PSD spectrum',
    ],
  },
  {
    id: 'module5',
    number: 5,
    title: 'CDMA Near-Far Problem & Power Control',
    shortTitle: 'CDMA Power Control',
    oneLineIdea:
      'Multiuser uplink DS-CDMA under unequal powers, ideal vs imperfect power control, and user capacity.',
    milestone: 4,
    implemented: true,
    requiredResultsSummary: [
      'BER vs near-far ratio (dB)',
      'Effect of active user count K',
      'SIR before and after power control',
      'BER & max supportable users with/without PC',
      'Effect of spreading factor on MAI',
    ],
  },
  {
    id: 'module6',
    number: 6,
    title: 'Cellular Frequency Reuse & Co-Channel Interference',
    shortTitle: 'Frequency Reuse & CCI',
    oneLineIdea:
      'Hexagonal cluster geometry (N = 1..12), first/second-tier CCI, SIR CDFs, and reuse-capacity trade-off.',
    milestone: 3,
    implemented: true,
    requiredResultsSummary: [
      'Reuse distance D and q = D/R vs cluster size N',
      'SIR vs N (analytic vs Monte-Carlo)',
      'SIR CDF/histogram by user position',
      'Outage probability vs N and SIR threshold',
      'Reuse efficiency vs CCI & hex cell heatmap',
    ],
  },
  {
    id: 'module7',
    number: 7,
    title: 'SISO vs MIMO Capacity & Performance',
    shortTitle: 'SISO vs MIMO Capacity',
    oneLineIdea:
      'Ergodic & 10% outage capacity for 1x1 to 8x8 Rayleigh MIMO, multiplexing slope, and Kronecker correlation.',
    milestone: 2,
    implemented: true,
    requiredResultsSummary: [
      'Ergodic capacity vs SNR (1x1, 2x2, 4x4)',
      'High-SNR slope min(Nt,Nr) annotation',
      'Antenna count & SIMO/MISO vs MIMO breakdown',
      'Spectral efficiency & 10% outage capacity CDF',
      'Kronecker spatial correlation capacity loss',
    ],
  },
  {
    id: 'module8',
    number: 8,
    title: 'TDMA vs OFDMA Multiuser Resource Allocation',
    shortTitle: 'TDMA vs OFDMA',
    oneLineIdea:
      'Multiuser diversity, Max-Sum-Rate, Proportional Fair, and Max-Min scheduling with Jain fairness Pareto analysis.',
    milestone: 5,
    implemented: true,
    requiredResultsSummary: [
      'System throughput vs SNR (TDMA / OFDMA)',
      'Per-user data rates grouped comparison',
      'TDMA vs OFDMA percentage throughput gain',
      'Jain fairness index vs SNR & policy',
      'Spectral efficiency vs fairness Pareto plot',
    ],
  },
];

export function getModuleDescriptor(id: ModuleId): ModuleDescriptor {
  const found = MODULES.find((m) => m.id === id);
  if (!found) {
    throw new Error(`Unknown module id: ${id}`);
  }
  return found;
}
