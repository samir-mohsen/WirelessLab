import React from 'react';
import {
  PROPAGATION_ENVS,
  type Module1Params,
  type PropagationEnvPreset,
} from './model';

interface Module1ParamsPanelProps {
  params: Module1Params;
  onChange: (next: Module1Params) => void;
  disabled: boolean;
}

export const Module1ParamsPanel: React.FC<Module1ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const set = <K extends keyof Module1Params>(key: K, val: Module1Params[K]) =>
    onChange({ ...params, [key]: val });

  const handleEnvChange = (envId: PropagationEnvPreset) => {
    if (envId === 'custom') {
      onChange({ ...params, environment: 'custom' });
      return;
    }
    const spec = PROPAGATION_ENVS.find((e) => e.id === envId);
    if (spec) {
      onChange({
        ...params,
        environment: envId,
        pathLossExp: spec.n,
        shadowSigmaDb: spec.sigmaDb,
      });
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Carrier Bands */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Carrier Frequencies
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span
              className="text-slate-700 dark:text-slate-300 font-medium block"
              title="Lower carrier band for wide-area coverage comparison"
            >
              Band 1 (MHz)
            </span>
            <input
              type="number"
              min={100}
              max={60000}
              step={50}
              disabled={disabled}
              value={params.freqLowMHz}
              onChange={(e) => set('freqLowMHz', Math.max(100, Number(e.target.value) || 900))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span
              className="text-slate-700 dark:text-slate-300 font-medium block"
              title="Higher carrier band (e.g. 3.5 GHz 5G mid-band)"
            >
              Band 2 (MHz)
            </span>
            <input
              type="number"
              min={100}
              max={60000}
              step={50}
              disabled={disabled}
              value={params.freqHighMHz}
              onChange={(e) => set('freqHighMHz', Math.max(100, Number(e.target.value) || 3500))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
        </div>
      </section>

      {/* Link Budget */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Link Budget
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Base station transmit power in dBm">
              Pt (dBm)
            </span>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              disabled={disabled}
              value={params.txPowerDbm}
              onChange={(e) => set('txPowerDbm', Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Receiver minimum sensitivity threshold in dBm">
              Sensitivity (dBm)
            </span>
            <input
              type="number"
              min={-130}
              max={-50}
              step={1}
              disabled={disabled}
              value={params.rxSensitivityDbm}
              onChange={(e) => set('rxSensitivityDbm', Number(e.target.value) || -100)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Transmit antenna gain (dBi)">
              Gt (dBi)
            </span>
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              disabled={disabled}
              value={params.gtDbi}
              onChange={(e) => set('gtDbi', Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block" title="Receive antenna gain (dBi)">
              Gr (dBi)
            </span>
            <input
              type="number"
              min={-5}
              max={20}
              step={1}
              disabled={disabled}
              value={params.grDbi}
              onChange={(e) => set('grDbi', Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
        </div>
      </section>

      {/* Propagation Environment */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Environment &amp; Shadowing
        </h3>
        <label className="space-y-1 block">
          <span className="text-slate-700 dark:text-slate-300 font-medium block">
            Environment Preset
          </span>
          <select
            disabled={disabled}
            value={params.environment}
            onChange={(e) => handleEnvChange(e.target.value as PropagationEnvPreset)}
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            {PROPAGATION_ENVS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.label} (n={env.n}, σ={env.sigmaDb} dB)
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Path-loss exponent n (2 = free space, 3-4 = urban)">
              Path-Loss Exponent n
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.pathLossExp.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={1.8}
            max={5.5}
            step={0.1}
            disabled={disabled}
            value={params.pathLossExp}
            onChange={(e) =>
              onChange({
                ...params,
                environment: 'custom',
                pathLossExp: Number(e.target.value),
              })
            }
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="Log-normal shadowing standard deviation σ in dB">
              Shadowing σ (dB)
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.shadowSigmaDb.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={14}
            step={0.5}
            disabled={disabled}
            value={params.shadowSigmaDb}
            onChange={(e) =>
              onChange({
                ...params,
                environment: 'custom',
                shadowSigmaDb: Number(e.target.value),
              })
            }
            className="w-full accent-blue-600"
          />
        </div>
      </section>

      {/* Distance & Monte-Carlo */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Distance &amp; Simulation
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">d_min (m)</span>
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              disabled={disabled}
              value={params.dMinM}
              onChange={(e) => set('dMinM', Math.max(10, Number(e.target.value) || 100))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">d_max (m)</span>
            <input
              type="number"
              min={500}
              max={30000}
              step={500}
              disabled={disabled}
              value={params.dMaxM}
              onChange={(e) => set('dMaxM', Math.max(500, Number(e.target.value) || 5000))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">MC Samples</span>
            <input
              type="number"
              min={500}
              max={20000}
              step={500}
              disabled={disabled}
              value={params.mcSamples}
              onChange={(e) =>
                set('mcSamples', Math.max(500, Math.min(20000, Number(e.target.value) || 4000)))
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
              onChange={(e) => set('seed', Number(e.target.value) || 44101)}
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
