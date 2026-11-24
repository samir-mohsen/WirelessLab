import React from 'react';
import { ALL_CLUSTER_SIZES, type ClusterSize, type Module6Params } from './model';

interface Module6ParamsPanelProps {
  params: Module6Params;
  onChange: (next: Module6Params) => void;
  disabled: boolean;
}

export const Module6ParamsPanel: React.FC<Module6ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const set = <K extends keyof Module6Params>(key: K, val: Module6Params[K]) =>
    onChange({ ...params, [key]: val });

  return (
    <div className="space-y-4 text-xs">
      {/* Geometry & Reuse */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Cellular Geometry
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Hexagon circumradius R in meters">
              Cell Radius R (m)
            </span>
            <input
              type="number"
              min={200}
              max={10000}
              step={100}
              disabled={disabled}
              value={params.cellRadiusM}
              onChange={(e) => set('cellRadiusM', Math.max(200, Number(e.target.value) || 1000))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Cluster size highlighted in Hex SIR Map">
              Map Cluster N
            </span>
            <select
              disabled={disabled}
              value={params.selectedClusterN}
              onChange={(e) => set('selectedClusterN', Number(e.target.value) as ClusterSize)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            >
              {ALL_CLUSTER_SIZES.map((nC) => (
                <option key={nC} value={nC}>
                  N = {nC}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.includeSecondTier}
            onChange={(e) => set('includeSecondTier', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">Include 2nd-tier interferers (+12 BS)</span>
        </label>
      </section>

      {/* Channel & Shadowing */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Propagation &amp; Shadowing
        </h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Path-Loss Exponent n</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.pathLossExp.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={2.0}
            max={5.0}
            step={0.1}
            disabled={disabled}
            value={params.pathLossExp}
            onChange={(e) => set('pathLossExp', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.shadowingEnabled}
            onChange={(e) => set('shadowingEnabled', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">Enable log-normal shadowing</span>
        </label>

        {params.shadowingEnabled && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Shadowing σ (dB)</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {params.shadowSigmaDb.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={0.5}
              disabled={disabled}
              value={params.shadowSigmaDb}
              onChange={(e) => set('shadowSigmaDb', Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </section>

      {/* Capacity & QoS Constraints */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Spectrum &amp; QoS Targets
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Total Channels</span>
            <input
              type="number"
              min={12}
              max={5000}
              step={12}
              disabled={disabled}
              value={params.totalChannels}
              onChange={(e) => set('totalChannels', Math.max(12, Number(e.target.value) || 420))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Target SIR (dB)</span>
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              disabled={disabled}
              value={params.targetSirDb}
              onChange={(e) => set('targetSirDb', Number(e.target.value) || 12)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1 col-span-2">
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Max Allowed Outage (%)</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {params.maxOutagePct}%
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              disabled={disabled}
              value={params.maxOutagePct}
              onChange={(e) => set('maxOutagePct', Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </label>
        </div>
      </section>

      {/* Monte-Carlo */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Simulation Control
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">User Drops / N</span>
            <input
              type="number"
              min={1000}
              max={25000}
              step={500}
              disabled={disabled}
              value={params.mcUsers}
              onChange={(e) =>
                set('mcUsers', Math.max(1000, Math.min(25000, Number(e.target.value) || 5000)))
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
              onChange={(e) => set('seed', Number(e.target.value) || 44106)}
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
