import React from 'react';
import type {
  JammerType,
  Module4Params,
  PnCodeType,
  SpreadingFactor,
} from './model';

interface Module4ParamsPanelProps {
  params: Module4Params;
  onChange: (next: Module4Params) => void;
  disabled: boolean;
}

const SF_OPTIONS: SpreadingFactor[] = [7, 15, 31, 63, 127, 255];

export const Module4ParamsPanel: React.FC<Module4ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const set = <K extends keyof Module4Params>(key: K, val: Module4Params[K]) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="space-y-4 text-xs">
      {/* Spreading Code */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Spreading Configuration
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="PN chips per data bit (L = 2^m - 1)">
              Spreading Factor SF
            </span>
            <select
              disabled={disabled}
              value={params.sf}
              onChange={(e) => set('sf', Number(e.target.value) as SpreadingFactor)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            >
              {SF_OPTIONS.map((sf) => (
                <option key={sf} value={sf}>
                  SF = {sf} ({(10 * Math.log10(sf)).toFixed(1)} dB)
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">PN Code Family</span>
            <select
              disabled={disabled}
              value={params.codeType}
              onChange={(e) => set('codeType', e.target.value as PnCodeType)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="mseq">LFSR m-sequence</option>
              <option value="gold">Gold code</option>
            </select>
          </label>
        </div>
      </section>

      {/* Jammer Model */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Narrowband Jammer
        </h3>
        <label className="space-y-1 block">
          <span className="text-slate-700 dark:text-slate-300 font-medium block">Interferer Type</span>
          <select
            disabled={disabled}
            value={params.jammerType}
            onChange={(e) => set('jammerType', e.target.value as JammerType)}
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="tone">Single-Tone Sinusoid</option>
            <option value="narrowband_noise">Narrowband Filtered Noise</option>
          </select>
        </label>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Jammer-to-Signal power ratio in dB for Fig 1, 5, 6">
              Reference J/S (dB)
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.jammerJsDb} dB
            </span>
          </div>
          <input
            type="range"
            min={-5}
            max={22}
            step={1}
            disabled={disabled}
            value={params.jammerJsDb}
            onChange={(e) => set('jammerJsDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Normalized tone frequency f_j / R_chip">
              Tone Offset f_j / R_c
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.jammerFreqNorm.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.03}
            max={0.45}
            step={0.01}
            disabled={disabled}
            value={params.jammerFreqNorm}
            onChange={(e) => set('jammerFreqNorm', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      </section>

      {/* Sweep Ranges */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Sweep Ranges
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Fixed Eb/N0 (dB)</span>
            <input
              type="number"
              min={2}
              max={14}
              step={1}
              disabled={disabled}
              value={params.fixedEbN0Db}
              onChange={(e) => set('fixedEbN0Db', Number(e.target.value) || 8)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Eb/N0 Max (dB)</span>
            <input
              type="number"
              min={6}
              max={14}
              step={2}
              disabled={disabled}
              value={params.ebN0MaxDb}
              onChange={(e) => set('ebN0MaxDb', Math.max(6, Number(e.target.value) || 10))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">J/S Min (dB)</span>
            <input
              type="number"
              min={-15}
              max={5}
              step={1}
              disabled={disabled}
              value={params.jsMinDb}
              onChange={(e) => set('jsMinDb', Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">J/S Max (dB)</span>
            <input
              type="number"
              min={10}
              max={30}
              step={1}
              disabled={disabled}
              value={params.jsMaxDb}
              onChange={(e) => set('jsMaxDb', Number(e.target.value) || 20)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
        </div>
      </section>

      {/* Simulation */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Simulation Control
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Bits / Point</span>
            <input
              type="number"
              min={4000}
              max={100000}
              step={2000}
              disabled={disabled}
              value={params.bitsPerPoint}
              onChange={(e) =>
                set('bitsPerPoint', Math.max(4000, Math.min(100000, Number(e.target.value) || 20000)))
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">RNG Seed</span>
            <input
              type="number"
              disabled={disabled}
              value={params.seed}
              onChange={(e) => set('seed', Number(e.target.value) || 44104)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.quickMode}
            onChange={(e) => set('quickMode', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">Quick preview mode</span>
        </label>
      </section>
    </div>
  );
};
