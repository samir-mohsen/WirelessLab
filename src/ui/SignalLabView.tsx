import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Sliders } from 'lucide-react';
import {
  generateSignalLabSnapshot,
  getDefaultSignalLabControl,
} from '../engine/signalLab';
import type { ModuleId } from '../types/simulation';
import { PlotlyChart } from './PlotlyChart';

interface SignalLabViewProps {
  moduleId: ModuleId;
  params: Record<string, unknown>;
  isDark: boolean;
}

export const SignalLabView: React.FC<SignalLabViewProps> = ({
  moduleId,
  params,
  isDark,
}) => {
  const [realizationIdx, setRealizationIdx] = useState(1);
  const [controlValue, setControlValue] = useState<number>(() =>
    getDefaultSignalLabControl(moduleId, params),
  );

  // Sync operating slider default when switching modules
  useEffect(() => {
    setRealizationIdx(1);
    setControlValue(getDefaultSignalLabControl(moduleId, params));
  }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const snapshot = useMemo(
    () => generateSignalLabSnapshot(moduleId, params, realizationIdx, controlValue),
    [moduleId, params, realizationIdx, controlValue],
  );

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold leading-snug">
                {snapshot.title}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {snapshot.description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRealizationIdx((r) => r + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Draw New Realization (#{realizationIdx})
          </button>
        </div>

        {/* Operating Point Slider + Live Telemetry Readout */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="signal-lab-slider"
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                {snapshot.controlLabel}
              </label>
              <span className="font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                {snapshot.controlValue} {snapshot.controlUnit}
              </span>
            </div>
            <input
              id="signal-lab-slider"
              type="range"
              min={snapshot.controlMin}
              max={snapshot.controlMax}
              step={snapshot.controlStep}
              value={controlValue}
              onChange={(e) => setControlValue(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {snapshot.metrics.map((m, idx) => (
              <div
                key={idx}
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 py-2"
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {m.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1 font-mono tabular-nums">
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {m.value}
                  </span>
                  {m.unit && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {m.unit}
                    </span>
                  )}
                </div>
                {m.note && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {m.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-Time Signal / Channel Panels */}
      <div className="grid grid-cols-1 gap-4">
        {snapshot.panels.map((panel) => (
          <div
            key={panel.id}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2"
          >
            <div className="px-1">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                {panel.title}
              </h3>
            </div>
            <PlotlyChart figure={panel} isDark={isDark} />
            {panel.keyFindings.length > 0 && (
              <p className="px-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                {panel.keyFindings[0]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
