import React from 'react';
import { Info } from 'lucide-react';
import {
  computeDelaySpread,
  computePDP,
  type EqualizerType,
  type ModulationType,
  type Module3Params,
} from './model';

interface Module3ParamsPanelProps {
  params: Module3Params;
  onChange: (next: Module3Params) => void;
  disabled?: boolean;
}

const FieldLabel: React.FC<{ label: string; tooltip: string; valueText?: string }> = ({
  label,
  tooltip,
  valueText,
}) => (
  <div className="flex items-center justify-between gap-2 mb-1">
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
      {label}
      <span
        title={tooltip}
        aria-label={tooltip}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help inline-flex"
      >
        <Info className="w-3.5 h-3.5" />
      </span>
    </span>
    {valueText && (
      <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
        {valueText}
      </span>
    )}
  </div>
);

export const Module3ParamsPanel: React.FC<Module3ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const update = <K extends keyof Module3Params>(key: K, value: Module3Params[K]) => {
    onChange({ ...params, [key]: value });
  };

  const pdp = computePDP(params.channelTaps, params.pdpDecay);
  const ds = computeDelaySpread(pdp, params.sampleRateMHz);

  return (
    <div className="space-y-5 text-sm">
      {/* Section 1: OFDM Waveform */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          OFDM Transceiver
        </h3>

        <div>
          <FieldLabel
            label="Modulation (Gray-coded)"
            tooltip="Constellation mapping per subcarrier. Unit average symbol energy Es = 1."
          />
          <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800/80">
            {(['BPSK', 'QPSK', '16QAM'] as ModulationType[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => update('modulation', m)}
                className={`py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  params.modulation === m
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m === '16QAM' ? '16-QAM' : m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel
            label="Subcarriers (N)"
            tooltip="FFT/IFFT block size (must be a power of 2)."
            valueText={`${params.nSubcarriers}`}
          />
          <select
            aria-label="Subcarriers (N)"
            disabled={disabled}
            value={params.nSubcarriers}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                ...params,
                nSubcarriers: n,
                cpLong: Math.min(params.cpLong, n - 1),
              });
            }}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[32, 64, 128, 256].map((n) => (
              <option key={n} value={n}>
                N = {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel
            label="One-Tap Equalizer"
            tooltip="ZF = Y/H; MMSE = conj(H)Y/(|H|^2 + N0). Identical BER for BPSK/QPSK; MMSE superior for 16-QAM."
          />
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800/80">
            {(['ZF', 'MMSE'] as EqualizerType[]).map((eq) => (
              <button
                key={eq}
                type="button"
                disabled={disabled}
                onClick={() => update('equalizer', eq)}
                className={`py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                  params.equalizer === eq
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.chargeCpEnergy}
            onChange={(e) => update('chargeCpEnergy', e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
            Charge CP energy to E<sub>b</sub>/N<sub>0</sub>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Scales N<sub>0</sub> by (N + N<sub>cp</sub>) / N in Fig. 3
            </span>
          </span>
        </label>
      </section>

      {/* Section 2: Multipath Channel & CP Lengths */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          Multipath Channel &amp; Cyclic Prefix
        </h3>

        <div>
          <FieldLabel
            label="Channel Taps (L)"
            tooltip="Number of Rayleigh multipath taps. Maximum excess delay is L - 1 samples."
            valueText={`L = ${params.channelTaps} (L-1 = ${params.channelTaps - 1})`}
          />
          <div className="flex items-center gap-2">
            <input
              aria-label="Channel Taps (L)"
              type="range"
              min={1}
              max={24}
              step={1}
              disabled={disabled}
              value={params.channelTaps}
              onChange={(e) => {
                const L = Number(e.target.value);
                onChange({
                  ...params,
                  channelTaps: L,
                  cpSufficient: Math.max(0, L - 1),
                  cpShort: Math.max(0, Math.floor((L - 1) / 2)),
                  cpLong: Math.min(params.nSubcarriers - 1, Math.max(L + 4, (L - 1) * 2)),
                });
              }}
              className="flex-1 accent-blue-600"
            />
            <input
              aria-label="Channel Taps numeric"
              type="number"
              min={1}
              max={24}
              disabled={disabled}
              value={params.channelTaps}
              onChange={(e) => {
                const L = Math.max(1, Math.min(24, Number(e.target.value) || 1));
                update('channelTaps', L);
              }}
              className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums text-right"
            />
          </div>
        </div>

        <div>
          <FieldLabel
            label="PDP Decay Factor (α)"
            tooltip="Exponential decay rate p[l] ~ exp(-α l / (L-1)). Larger α concentrates energy in early taps."
            valueText={params.pdpDecay.toFixed(1)}
          />
          <input
            aria-label="PDP Decay Factor"
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            disabled={disabled}
            value={params.pdpDecay}
            onChange={(e) => update('pdpDecay', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <FieldLabel
            label="Sample Rate (MHz)"
            tooltip="Used to convert discrete delay spread into physical nanoseconds."
            valueText={`${params.sampleRateMHz} MHz`}
          />
          <input
            aria-label="Sample Rate (MHz)"
            type="number"
            min={1}
            max={200}
            step={1}
            disabled={disabled}
            value={params.sampleRateMHz}
            onChange={(e) =>
              update('sampleRateMHz', Math.max(1, Math.min(200, Number(e.target.value) || 20)))
            }
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono tabular-nums"
          />
          <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            τ_rms = {ds.rmsSamples.toFixed(2)} samples ({ds.rmsNs.toFixed(1)} ns)
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Short CP
            </label>
            <input
              aria-label="Short CP length"
              type="number"
              min={0}
              max={params.nSubcarriers - 1}
              disabled={disabled}
              value={params.cpShort}
              onChange={(e) =>
                update('cpShort', Math.max(0, Math.min(params.nSubcarriers - 1, Number(e.target.value) || 0)))
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Suff. CP
            </label>
            <input
              aria-label="Sufficient CP length"
              type="number"
              min={0}
              max={params.nSubcarriers - 1}
              disabled={disabled}
              value={params.cpSufficient}
              onChange={(e) =>
                update(
                  'cpSufficient',
                  Math.max(0, Math.min(params.nSubcarriers - 1, Number(e.target.value) || 0)),
                )
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Long CP
            </label>
            <input
              aria-label="Long CP length"
              type="number"
              min={0}
              max={params.nSubcarriers - 1}
              disabled={disabled}
              value={params.cpLong}
              onChange={(e) =>
                update('cpLong', Math.max(0, Math.min(params.nSubcarriers - 1, Number(e.target.value) || 0)))
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Section 3: SNR Sweep & Monte-Carlo Control */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          SNR Sweep &amp; Monte-Carlo
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Min dB
            </label>
            <input
              aria-label="Minimum Eb/N0 dB"
              type="number"
              min={-5}
              max={20}
              disabled={disabled}
              value={params.snrMinDb}
              onChange={(e) => update('snrMinDb', Number(e.target.value))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Max dB
            </label>
            <input
              aria-label="Maximum Eb/N0 dB"
              type="number"
              min={5}
              max={36}
              disabled={disabled}
              value={params.snrMaxDb}
              onChange={(e) =>
                update('snrMaxDb', Math.max(params.snrMinDb + 3, Number(e.target.value) || 24))
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
              Step dB
            </label>
            <input
              aria-label="SNR step dB"
              type="number"
              min={1}
              max={6}
              disabled={disabled}
              value={params.snrStepDb}
              onChange={(e) =>
                update('snrStepDb', Math.max(1, Math.min(6, Number(e.target.value) || 3)))
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <FieldLabel
            label="Fixed Eb/N0 for Delay & CP Sweeps"
            tooltip="SNR operating point used in Figures 4, 5, and 7."
            valueText={`${params.fixedSnrForSweepDb} dB`}
          />
          <input
            aria-label="Fixed Eb/N0 for sweeps"
            type="range"
            min={8}
            max={28}
            step={1}
            disabled={disabled}
            value={params.fixedSnrForSweepDb}
            onChange={(e) => update('fixedSnrForSweepDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <FieldLabel
            label="Channel Trials / Point"
            tooltip="Independent Rayleigh channel blocks per SNR point. Each trial transmits M+1 OFDM symbols."
            valueText={`${params.numTrials}`}
          />
          <div className="flex items-center gap-2">
            <input
              aria-label="Channel Trials per point"
              type="range"
              min={80}
              max={1000}
              step={40}
              disabled={disabled}
              value={params.numTrials}
              onChange={(e) => update('numTrials', Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <input
              aria-label="Channel Trials numeric"
              type="number"
              min={50}
              max={2000}
              disabled={disabled}
              value={params.numTrials}
              onChange={(e) =>
                update('numTrials', Math.max(50, Math.min(2000, Number(e.target.value) || 320)))
              }
              className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums text-right"
            />
          </div>
        </div>

        <div>
          <FieldLabel
            label="Random Seed"
            tooltip="Deterministic 32-bit PRNG seed. Identical results across any number of Web Workers."
          />
          <input
            aria-label="Random Seed"
            type="number"
            disabled={disabled}
            value={params.seed}
            onChange={(e) => update('seed', Math.max(1, Math.floor(Number(e.target.value) || 44103)))}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono tabular-nums"
          />
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={disabled}
              checked={params.earlyStop}
              onChange={(e) => update('earlyStop', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Early stop (&ge; {params.earlyStopErrors} errors &amp; min trials)
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={disabled}
              checked={params.quickMode}
              onChange={(e) => update('quickMode', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Quick mode (30% trials for fast preview)
            </span>
          </label>
        </div>
      </section>
    </div>
  );
};
