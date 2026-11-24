import React from 'react';
import { Info } from 'lucide-react';
import { harmonicNumber, type Module2Params } from './model';
import { linToDb } from '../../engine/special';

interface Props {
  params: Module2Params;
  onChange: (next: Module2Params) => void;
  disabled?: boolean;
}

const LabelRow: React.FC<{ label: string; tip: string; value?: string }> = ({ label, tip, value }) => (
  <div className="flex items-center justify-between gap-2 mb-1">
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
      {label}
      <span title={tip} className="text-slate-400 hover:text-slate-600 cursor-help inline-flex">
        <Info className="w-3.5 h-3.5" />
      </span>
    </span>
    {value && <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">{value}</span>}
  </div>
);

export const Module2ParamsPanel: React.FC<Props> = ({ params, onChange, disabled }) => {
  const upd = <K extends keyof Module2Params>(k: K, v: Module2Params[K]) => onChange({ ...params, [k]: v });

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          Antenna Diversity Configuration
        </h3>

        <div>
          <LabelRow
            label="Diversity Order (L)"
            tip="Number of independent flat Rayleigh receive branches (2 to 8)."
            value={`L = ${params.diversityOrder}`}
          />
          <div className="flex items-center gap-2">
            <input
              aria-label="Diversity Order L"
              type="range"
              min={2}
              max={8}
              step={1}
              disabled={disabled}
              value={params.diversityOrder}
              onChange={(e) => upd('diversityOrder', Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <input
              aria-label="Diversity Order numeric"
              type="number"
              min={2}
              max={8}
              disabled={disabled}
              value={params.diversityOrder}
              onChange={(e) => upd('diversityOrder', Math.max(2, Math.min(8, Number(e.target.value) || 4)))}
              className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums text-right"
            />
          </div>
          <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Array gain: MRC +{linToDb(params.diversityOrder).toFixed(2)} dB · SC +{linToDb(harmonicNumber(params.diversityOrder)).toFixed(2)} dB
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.includeEgc}
            onChange={(e) => upd('includeEgc', e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300">
            Include Equal-Gain Combining (EGC)
          </span>
        </label>

        <div>
          <LabelRow
            label="Outage SNR Threshold (γ_th)"
            tip="Minimum acceptable combined SNR for outage probability analysis (Fig. 4 also plots γ_th + 5 dB)."
            value={`${params.outageThresholdDb} dB`}
          />
          <input
            aria-label="Outage SNR Threshold"
            type="range"
            min={0}
            max={15}
            step={1}
            disabled={disabled}
            value={params.outageThresholdDb}
            onChange={(e) => upd('outageThresholdDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          SNR Sweep &amp; Monte-Carlo
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Min dB</label>
            <input
              aria-label="Minimum SNR dB"
              type="number"
              min={-5}
              max={15}
              disabled={disabled}
              value={params.snrMinDb}
              onChange={(e) => upd('snrMinDb', Number(e.target.value))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Max dB</label>
            <input
              aria-label="Maximum SNR dB"
              type="number"
              min={6}
              max={30}
              disabled={disabled}
              value={params.snrMaxDb}
              onChange={(e) => upd('snrMaxDb', Math.max(params.snrMinDb + 3, Number(e.target.value) || 24))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Step dB</label>
            <input
              aria-label="SNR Step dB"
              type="number"
              min={1}
              max={6}
              disabled={disabled}
              value={params.snrStepDb}
              onChange={(e) => upd('snrStepDb', Math.max(1, Math.min(6, Number(e.target.value) || 3)))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <LabelRow
            label="Bits / Trials per Point"
            tip="Number of independent BPSK symbols / fading trials simulated per SNR point."
            value={params.numBitsPerPoint.toLocaleString()}
          />
          <input
            aria-label="Bits per point"
            type="range"
            min={20000}
            max={250000}
            step={10000}
            disabled={disabled}
            value={params.numBitsPerPoint}
            onChange={(e) => upd('numBitsPerPoint', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <LabelRow label="Random Seed" tip="Deterministic xoshiro128** seed." />
          <input
            aria-label="Random Seed"
            type="number"
            disabled={disabled}
            value={params.seed}
            onChange={(e) => upd('seed', Math.max(1, Math.floor(Number(e.target.value) || 44102)))}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono tabular-nums"
          />
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={disabled}
              checked={params.earlyStop}
              onChange={(e) => upd('earlyStop', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
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
              onChange={(e) => upd('quickMode', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Quick mode (35% trials)
            </span>
          </label>
        </div>
      </section>
    </div>
  );
};
