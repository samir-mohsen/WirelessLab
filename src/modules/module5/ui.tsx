import React from 'react';
import type { CdmaCodeType, Module5Params } from './model';
import type { SpreadingFactor } from '../module4/model';

interface Module5ParamsPanelProps {
  params: Module5Params;
  onChange: (next: Module5Params) => void;
  disabled: boolean;
}

const SF_OPTS: Array<Extract<SpreadingFactor, 15 | 31 | 63 | 127>> = [15, 31, 63, 127];

export const Module5ParamsPanel: React.FC<Module5ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const set = <K extends keyof Module5Params>(key: K, val: Module5Params[K]) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="space-y-4 text-xs">
      {/* Multiuser Setup */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          DS-CDMA Uplink Setup
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Spreading Factor</span>
            <select
              disabled={disabled}
              value={params.sf}
              onChange={(e) =>
                set('sf', Number(e.target.value) as Extract<SpreadingFactor, 15 | 31 | 63 | 127>)
              }
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            >
              {SF_OPTS.map((s) => (
                <option key={s} value={s}>
                  SF = {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Code Family</span>
            <select
              disabled={disabled}
              value={params.codeType}
              onChange={(e) => set('codeType', e.target.value as CdmaCodeType)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="gold">Gold Codes</option>
              <option value="random_pn">Random PN</option>
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Active Users K</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">{params.numUsersK}</span>
          </div>
          <input
            type="range"
            min={2}
            max={24}
            step={1}
            disabled={disabled}
            value={params.numUsersK}
            onChange={(e) => set('numUsersK', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      </section>

      {/* Near-Far & Power Control */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Near-Far &amp; Power Control
        </h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Interferer-to-desired received power ratio without power control">
              Near-Far Ratio (dB)
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.nearFarDb} dB
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            disabled={disabled}
            value={params.nearFarDb}
            onChange={(e) => set('nearFarDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Log-normal residual power-control error standard deviation">
              Imperfect PC Error σ_pc
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.pcErrorSigmaDb.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={5.0}
            step={0.5}
            disabled={disabled}
            value={params.pcErrorSigmaDb}
            onChange={(e) => set('pcErrorSigmaDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Operating Eb/N0 (dB)</span>
            <input
              type="number"
              min={2}
              max={14}
              step={1}
              disabled={disabled}
              value={params.ebN0Db}
              onChange={(e) => set('ebN0Db', Number(e.target.value) || 8)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Path-Loss n</span>
            <input
              type="number"
              min={2}
              max={5}
              step={0.1}
              disabled={disabled}
              value={params.pathLossExp}
              onChange={(e) => set('pathLossExp', Number(e.target.value) || 3.5)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.enableDecorrelator}
            onChange={(e) => set('enableDecorrelator', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">Include Decorrelating MUD (R⁻¹)</span>
        </label>
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
              max={60000}
              step={2000}
              disabled={disabled}
              value={params.bitsPerPoint}
              onChange={(e) =>
                set('bitsPerPoint', Math.max(4000, Math.min(60000, Number(e.target.value) || 14000)))
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
              onChange={(e) => set('seed', Number(e.target.value) || 44105)}
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
