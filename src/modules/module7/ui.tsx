import React from 'react';
import { Info } from 'lucide-react';
import type { MimoPreset, Module7Params } from './model';

interface Props {
  params: Module7Params;
  onChange: (next: Module7Params) => void;
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

export const Module7ParamsPanel: React.FC<Props> = ({ params, onChange, disabled }) => {
  const upd = <K extends keyof Module7Params>(k: K, v: Module7Params[K]) => onChange({ ...params, [k]: v });

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          MIMO Array &amp; Correlation
        </h3>

        <div>
          <LabelRow
            label="Extra Antenna Config (Fig. 1)"
            tip="Additional Nt x Nr configuration plotted alongside 1x1, 2x2, and 4x4."
            value={params.customConfig}
          />
          <select
            aria-label="Extra MIMO Configuration"
            disabled={disabled}
            value={params.customConfig}
            onChange={(e) => upd('customConfig', e.target.value as MimoPreset)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
          >
            {(['1x2', '2x1', '4x2', '8x8', '2x2', '4x4'] as MimoPreset[]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <LabelRow
            label="Fixed SNR (Figs 3–4)"
            tip="Operating SNR for antenna bar chart and 10% outage capacity CDF."
            value={`${params.fixedSnrDb} dB`}
          />
          <input
            aria-label="Fixed SNR dB"
            type="range"
            min={0}
            max={30}
            step={1}
            disabled={disabled}
            value={params.fixedSnrDb}
            onChange={(e) => upd('fixedSnrDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <LabelRow
            label="Custom Tx Correlation (r_t)"
            tip="Exponential transmit antenna correlation R_t[i,j] = r_t^|i-j|."
            value={params.corrTx.toFixed(2)}
          />
          <input
            aria-label="Transmit correlation"
            type="range"
            min={0}
            max={0.99}
            step={0.01}
            disabled={disabled}
            value={params.corrTx}
            onChange={(e) => upd('corrTx', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <LabelRow
            label="Custom Rx Correlation (r_r)"
            tip="Exponential receive antenna correlation R_r[i,j] = r_r^|i-j|."
            value={params.corrRx.toFixed(2)}
          />
          <input
            aria-label="Receive correlation"
            type="range"
            min={0}
            max={0.99}
            step={0.01}
            disabled={disabled}
            value={params.corrRx}
            onChange={(e) => upd('corrRx', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          SNR Range &amp; Monte-Carlo
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Min dB</label>
            <input
              aria-label="Minimum SNR"
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
              aria-label="Maximum SNR"
              type="number"
              min={10}
              max={40}
              disabled={disabled}
              value={params.snrMaxDb}
              onChange={(e) => upd('snrMaxDb', Math.max(params.snrMinDb + 5, Number(e.target.value) || 30))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Step dB</label>
            <input
              aria-label="SNR Step"
              type="number"
              min={2}
              max={10}
              disabled={disabled}
              value={params.snrStepDb}
              onChange={(e) => upd('snrStepDb', Math.max(2, Math.min(10, Number(e.target.value) || 5)))}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <LabelRow
            label="Channel Realizations"
            tip="Monte-Carlo Rayleigh channel matrices averaged per point (course target >= 10,000)."
            value={params.numRealizations.toLocaleString()}
          />
          <input
            aria-label="Channel Realizations"
            type="range"
            min={2000}
            max={25000}
            step={1000}
            disabled={disabled}
            value={params.numRealizations}
            onChange={(e) => upd('numRealizations', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <LabelRow label="Random Seed" tip="Deterministic PRNG seed." />
          <input
            aria-label="Random Seed"
            type="number"
            disabled={disabled}
            value={params.seed}
            onChange={(e) => upd('seed', Math.max(1, Math.floor(Number(e.target.value) || 44107)))}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono tabular-nums"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.quickMode}
            onChange={(e) => upd('quickMode', e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300">
            Quick mode (30% realizations)
          </span>
        </label>
      </section>
    </div>
  );
};
