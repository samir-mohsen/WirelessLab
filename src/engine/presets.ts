import type { ModuleId } from '../types/simulation';
import { DEFAULT_MODULE1_PARAMS } from '../modules/module1/model';
import { DEFAULT_MODULE2_PARAMS } from '../modules/module2/model';
import { DEFAULT_MODULE3_PARAMS } from '../modules/module3/model';
import { DEFAULT_MODULE4_PARAMS } from '../modules/module4/model';
import { DEFAULT_MODULE5_PARAMS } from '../modules/module5/model';
import { DEFAULT_MODULE6_PARAMS } from '../modules/module6/model';
import { DEFAULT_MODULE7_PARAMS } from '../modules/module7/model';
import { DEFAULT_MODULE8_PARAMS } from '../modules/module8/model';

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  params: Record<string, unknown>;
}

const CUSTOM_PRESETS_KEY = 'wirelesslab_ece441_custom_presets_v1';

export const BUILTIN_PRESETS: Record<ModuleId, ScenarioPreset[]> = {
  module1: [
    {
      id: 'm1_default',
      name: 'Course Default (Urban 900/3500 MHz)',
      description: 'Urban n=3.2, σ=8 dB, Pt=43 dBm, 900 MHz vs 3.5 GHz',
      builtin: true,
      params: { ...DEFAULT_MODULE1_PARAMS },
    },
    {
      id: 'm1_worst',
      name: 'Worst Case (Dense Urban Clutter)',
      description: 'Dense urban n=3.8, σ=9 dB, 28 GHz mmWave vs 3.5 GHz',
      builtin: true,
      params: {
        ...DEFAULT_MODULE1_PARAMS,
        environment: 'dense_urban',
        pathLossExp: 3.8,
        shadowSigmaDb: 9.0,
        freqLowMHz: 3500,
        freqHighMHz: 28000,
        dMaxM: 2500,
      },
    },
    {
      id: 'm1_rural',
      name: 'Typical Rural Macrocell',
      description: 'Rural open n=2.2, σ=4 dB, 700 MHz vs 2100 MHz, 15 km range',
      builtin: true,
      params: {
        ...DEFAULT_MODULE1_PARAMS,
        environment: 'rural',
        pathLossExp: 2.2,
        shadowSigmaDb: 4.0,
        freqLowMHz: 700,
        freqHighMHz: 2100,
        dMaxM: 15000,
      },
    },
  ],
  module2: [
    {
      id: 'm2_default',
      name: 'Course Default (Rayleigh L=4)',
      description: 'Coherent BPSK, L=4 branches, SNR 0..20 dB, 5 dB outage threshold',
      builtin: true,
      params: { ...DEFAULT_MODULE2_PARAMS },
    },
    {
      id: 'm2_worst',
      name: 'Worst Case (Deep Fade, High Outage Threshold)',
      description: 'L=2 branches, strict 10 dB outage threshold, 0..16 dB SNR',
      builtin: true,
      params: {
        ...DEFAULT_MODULE2_PARAMS,
        branchesL: 2,
        outageThresholdDb: 10,
        snrMaxDb: 16,
      },
    },
    {
      id: 'm2_high_order',
      name: 'High-Order Array (L=8 Macro Diversity)',
      description: '8-branch combining showing diminishing diversity returns',
      builtin: true,
      params: {
        ...DEFAULT_MODULE2_PARAMS,
        branchesL: 8,
        outageThresholdDb: 5,
      },
    },
  ],
  module3: [
    {
      id: 'm3_default',
      name: 'Course Default (N=64, QPSK, L=9)',
      description: 'Standard ECE 441 OFDM CP study with 9-tap exponential PDP',
      builtin: true,
      params: { ...DEFAULT_MODULE3_PARAMS },
    },
    {
      id: 'm3_worst',
      name: 'Worst Case (Severe Multipath ISI, 16-QAM)',
      description: 'Long 12-tap channel with short CP=4 and 16-QAM MMSE',
      builtin: true,
      params: {
        ...DEFAULT_MODULE3_PARAMS,
        modulation: '16QAM',
        channelTaps: 12,
        cpLength: 4,
        equalizer: 'MMSE',
      },
    },
    {
      id: 'm3_urban',
      name: 'Typical Urban LTE-Like (N=256, CP=16)',
      description: '256 subcarriers, L=9 taps, CP=16, QPSK ZF',
      builtin: true,
      params: {
        ...DEFAULT_MODULE3_PARAMS,
        nSubcarriers: 256,
        cpLength: 16,
        channelTaps: 9,
        modulation: 'QPSK',
      },
    },
  ],
  module4: [
    {
      id: 'm4_default',
      name: 'Course Default (SF=31, J/S=10 dB Tone)',
      description: 'm-sequence SF=31 under 10 dB narrowband tone jammer',
      builtin: true,
      params: { ...DEFAULT_MODULE4_PARAMS },
    },
    {
      id: 'm4_worst',
      name: 'Worst Case (Hostile Jamming J/S=18 dB)',
      description: 'Strong 18 dB narrowband noise jammer, SF=63 Gold code',
      builtin: true,
      params: {
        ...DEFAULT_MODULE4_PARAMS,
        sf: 63,
        codeType: 'gold',
        jammerType: 'narrowband_noise',
        jammerJsDb: 18,
      },
    },
    {
      id: 'm4_high_gp',
      name: 'High Processing Gain (SF=127)',
      description: '21 dB theoretical processing gain against 14 dB tone jammer',
      builtin: true,
      params: {
        ...DEFAULT_MODULE4_PARAMS,
        sf: 127,
        jammerJsDb: 14,
      },
    },
  ],
  module5: [
    {
      id: 'm5_default',
      name: 'Course Default (K=8, SF=31, NFR=10 dB)',
      description: 'Uplink Gold-code DS-CDMA with σ_pc=1.5 dB & Decorrelator',
      builtin: true,
      params: { ...DEFAULT_MODULE5_PARAMS },
    },
    {
      id: 'm5_worst',
      name: 'Worst Case (Heavy Load K=16, NFR=18 dB)',
      description: 'Severe near-far imbalance and degraded PC σ_pc=3.0 dB',
      builtin: true,
      params: {
        ...DEFAULT_MODULE5_PARAMS,
        numUsersK: 16,
        nearFarDb: 18,
        pcErrorSigmaDb: 3.0,
      },
    },
    {
      id: 'm5_high_sf',
      name: 'High-Capacity Voice (SF=63, Tight PC)',
      description: 'SF=63 with tight 1.0 dB closed-loop power control',
      builtin: true,
      params: {
        ...DEFAULT_MODULE5_PARAMS,
        sf: 63,
        numUsersK: 12,
        pcErrorSigmaDb: 1.0,
      },
    },
  ],
  module6: [
    {
      id: 'm6_default',
      name: 'Course Default (Urban n=3.5, σ=6 dB)',
      description: '1 km hex cells, 420 channels, 12 dB target SIR, 10% outage',
      builtin: true,
      params: { ...DEFAULT_MODULE6_PARAMS },
    },
    {
      id: 'm6_worst',
      name: 'Worst Case (Low n=2.5, 2nd Tier + High σ)',
      description: 'Slow path-loss decay + 18 interferers + σ=8 dB + 18 dB target',
      builtin: true,
      params: {
        ...DEFAULT_MODULE6_PARAMS,
        pathLossExp: 2.5,
        includeSecondTier: true,
        shadowSigmaDb: 8.0,
        targetSirDb: 18,
        selectedClusterN: 9,
      },
    },
    {
      id: 'm6_dense',
      name: 'Dense Urban Microcell (n=4.0, Tight Reuse)',
      description: 'Steep n=4.0 attenuation enabling smaller cluster reuse N=3/4',
      builtin: true,
      params: {
        ...DEFAULT_MODULE6_PARAMS,
        cellRadiusM: 400,
        pathLossExp: 4.0,
        shadowSigmaDb: 5.0,
        selectedClusterN: 3,
      },
    },
  ],
  module7: [
    {
      id: 'm7_default',
      name: 'Course Default (i.i.d. Rayleigh, ρ=0.7)',
      description: '1x1 to 8x8 Rayleigh MIMO, 10k trials, Kronecker ρ=0.7',
      builtin: true,
      params: { ...DEFAULT_MODULE7_PARAMS },
    },
    {
      id: 'm7_worst',
      name: 'Worst Case (Severe Antenna Correlation ρ=0.9)',
      description: 'Compact handset array with high Tx/Rx correlation (r_t=r_r=0.9)',
      builtin: true,
      params: {
        ...DEFAULT_MODULE7_PARAMS,
        corrTx: 0.9,
        corrRx: 0.9,
      },
    },
    {
      id: 'm7_high_snr',
      name: 'High-SNR Multiplexing Regime (0..30 dB)',
      description: 'Extended SNR range highlighting linear min(Nt,Nr) capacity slope',
      builtin: true,
      params: {
        ...DEFAULT_MODULE7_PARAMS,
        snrMinDb: 0,
        snrMaxDb: 30,
        corrTx: 0.5,
        corrRx: 0.5,
      },
    },
  ],
  module8: [
    {
      id: 'm8_default',
      name: 'Course Default (K=4, [25,18,10,3] dB)',
      description: '20 MHz, 64 subcarriers, 6-tap Rayleigh multipath, 2000 frames',
      builtin: true,
      params: { ...DEFAULT_MODULE8_PARAMS },
    },
    {
      id: 'm8_worst',
      name: 'Worst Case (Extreme Near-Far Spread 30 dB, K=6)',
      description: '6 users with 30 dB SNR disparity showing severe Max-Rate starvation',
      builtin: true,
      params: {
        ...DEFAULT_MODULE8_PARAMS,
        numUsersK: 6,
        snrSpreadDb: 30,
        waterFilling: true,
      },
    },
    {
      id: 'm8_wideband',
      name: 'Wideband 5G-Like (256 Subcarriers, K=8)',
      description: '8 users over 256 subcarriers unlocking strong multiuser diversity',
      builtin: true,
      params: {
        ...DEFAULT_MODULE8_PARAMS,
        numUsersK: 8,
        nSubcarriers: 256,
        snrSpreadDb: 16,
      },
    },
  ],
};

export function loadCustomPresets(moduleId: ModuleId): ScenarioPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Partial<Record<ModuleId, ScenarioPreset[]>>;
    return all[moduleId] ?? [];
  } catch {
    return [];
  }
}

export function saveCustomPreset(
  moduleId: ModuleId,
  name: string,
  params: Record<string, unknown>,
): ScenarioPreset[] {
  const trimmed = name.trim();
  if (!trimmed) return loadCustomPresets(moduleId);
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    const all: Partial<Record<ModuleId, ScenarioPreset[]>> = raw ? JSON.parse(raw) : {};
    const existing = all[moduleId] ?? [];
    const next: ScenarioPreset[] = [
      ...existing.filter((p) => p.name !== trimmed),
      {
        id: `custom_${Date.now()}`,
        name: trimmed,
        description: `Saved ${new Date().toLocaleDateString()}`,
        builtin: false,
        params: { ...params },
      },
    ];
    all[moduleId] = next;
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(all));
    return next;
  } catch {
    return [];
  }
}

export function deleteCustomPreset(moduleId: ModuleId, presetId: string): ScenarioPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Partial<Record<ModuleId, ScenarioPreset[]>>;
    const next = (all[moduleId] ?? []).filter((p) => p.id !== presetId);
    all[moduleId] = next;
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(all));
    return next;
  } catch {
    return [];
  }
}
