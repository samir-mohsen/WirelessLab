import React from 'react';
import {
  getUserSnrOffsetsDb,
  type Module8Params,
  type OfdmaChannelModel,
} from './model';

interface Module8ParamsPanelProps {
  params: Module8Params;
  onChange: (next: Module8Params) => void;
  disabled: boolean;
}

export const Module8ParamsPanel: React.FC<Module8ParamsPanelProps> = ({
  params,
  onChange,
  disabled,
}) => {
  const set = <K extends keyof Module8Params>(key: K, val: Module8Params[K]) =>
    onChange({ ...params, [key]: val });

  const userSnrs = getUserSnrOffsetsDb(params.numUsersK, params.snrSpreadDb).map((off) =>
    (params.refMeanSnrDb + off).toFixed(0),
  );

  return (
    <div className="space-y-4 text-xs">
      {/* Multiuser & Spectrum */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Multiuser &amp; Spectrum
        </h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Users K</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">{params.numUsersK}</span>
          </div>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            disabled={disabled}
            value={params.numUsersK}
            onChange={(e) => set('numUsersK', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Bandwidth (MHz)</span>
            <input
              type="number"
              min={1.4}
              max={100}
              step={5}
              disabled={disabled}
              value={params.bandwidthMHz}
              onChange={(e) => set('bandwidthMHz', Math.max(1, Number(e.target.value) || 20))}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Subcarriers N_sc</span>
            <select
              disabled={disabled}
              value={params.nSubcarriers}
              onChange={(e) => set('nSubcarriers', Number(e.target.value) as 64 | 256)}
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            >
              <option value={64}>64</option>
              <option value={256}>256</option>
            </select>
          </label>
        </div>
      </section>

      {/* User SNR Profile */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          User SNR Profile
        </h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Operating Mean SNR</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.refMeanSnrDb} dB
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={24}
            step={2}
            disabled={disabled}
            value={params.refMeanSnrDb}
            onChange={(e) => set('refMeanSnrDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium" title="SNR gap between strongest and weakest user">
              User SNR Spread
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {params.snrSpreadDb} dB
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={2}
            disabled={disabled}
            value={params.snrSpreadDb}
            onChange={(e) => set('snrSpreadDb', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="p-2 rounded bg-slate-100 dark:bg-slate-800/70 font-mono text-[11px] text-slate-700 dark:text-slate-300">
          User SNRs: [{userSnrs.join(', ')}] dB
        </div>
      </section>

      {/* Fading & Power Allocation */}
      <section className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Channel &amp; Power Policy
        </h3>
        <label className="space-y-1 block">
          <span className="text-slate-700 dark:text-slate-300 font-medium block">Fading Model</span>
          <select
            disabled={disabled}
            value={params.channelModel}
            onChange={(e) => set('channelModel', e.target.value as OfdmaChannelModel)}
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="multipath_fft">Frequency-Selective Multipath (FFT)</option>
            <option value="iid_subcarrier">Independent Rayleigh per Subcarrier</option>
          </select>
        </label>

        {params.channelModel === 'multipath_fft' && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Multipath Taps L</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">{params.channelTaps}</span>
            </div>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              disabled={disabled}
              value={params.channelTaps}
              onChange={(e) => set('channelTaps', Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}

        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={params.waterFilling}
            onChange={(e) => set('waterFilling', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">Enable Water-Filling on Max-Sum-Rate</span>
        </label>
      </section>

      {/* Simulation */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Simulation Control
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium block">Fading Frames</span>
            <input
              type="number"
              min={500}
              max={10000}
              step={500}
              disabled={disabled}
              value={params.realizations}
              onChange={(e) =>
                set('realizations', Math.max(500, Math.min(10000, Number(e.target.value) || 2000)))
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
              onChange={(e) => set('seed', Number(e.target.value) || 44108)}
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
