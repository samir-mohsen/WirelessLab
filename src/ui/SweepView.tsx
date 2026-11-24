import React, { useEffect, useRef, useState } from 'react';
import { Grid, Play, Square } from 'lucide-react';
import { MODULE_SWEEPS, run2DSweep, type SweepResult } from '../engine/sweep';
import type { ModuleId } from '../types/simulation';
import { PlotlyChart } from './PlotlyChart';

interface SweepViewProps {
  moduleId: ModuleId;
  params: Record<string, unknown>;
  isDark: boolean;
}

export const SweepView: React.FC<SweepViewProps> = ({ moduleId, params, isDark }) => {
  const defs = MODULE_SWEEPS[moduleId] ?? [];
  const [selectedId, setSelectedId] = useState<string>(defs[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; etaSec: number } | null>(
    null,
  );
  const [result, setResult] = useState<SweepResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSelectedId(defs[0]?.id ?? '');
    setResult(null);
    setErrorMsg(null);
  }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDef = defs.find((d) => d.id === selectedId) ?? defs[0];

  const handleRun = async () => {
    if (!activeDef || running) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setErrorMsg(null);
    setProgress({ done: 0, total: activeDef.xValues.length * activeDef.yValues.length, etaSec: 0 });
    try {
      const res = await run2DSweep(
        activeDef,
        params,
        (done, total, etaSec) => setProgress({ done, total, etaSec }),
        ctrl.signal,
      );
      setResult(res);
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
      setProgress(null);
    }
  };

  if (!activeDef) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                2D Parameter Sweep &amp; Contour Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select two parameters to generate a Plotly heatmap with overlaid iso-metric contours.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              disabled={running}
              value={activeDef.id}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setResult(null);
              }}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs max-w-md"
            >
              {defs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={running}
              onClick={() => void handleRun()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Run 2D Sweep
            </button>

            {running && (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-medium"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            )}
          </div>
        </div>

        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <span>
                Computing grid cell {progress.done} / {progress.total}
              </span>
              <span>
                {Math.round((progress.done / Math.max(progress.total, 1)) * 100)}% · ETA{' '}
                {progress.etaSec.toFixed(1)}s
              </span>
            </div>
            <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <PlotlyChart
              figure={{
                id: `sweep_${moduleId}_${activeDef.id}`,
                title: activeDef.label,
                shortTitle: '2D Sweep',
                traces: result.traces,
                layout: { ...result.layout, height: 430 },
                keyFindings: [result.summary],
                table: { headers: [], rows: [] },
              }}
              isDark={isDark}
            />
          </div>
          <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-3.5 text-xs text-slate-800 dark:text-slate-200">
            <div className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
              Computed 2D Sweep Finding
            </div>
            <p className="font-mono text-[11px] leading-relaxed">{result.summary}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 p-10 text-center text-xs text-slate-500 dark:text-slate-400">
          Click <strong className="text-slate-700 dark:text-slate-200">Run 2D Sweep</strong> above
          to compute the {activeDef.xValues.length} × {activeDef.yValues.length} heatmap &amp;
          contour surface using your current module parameters.
        </div>
      )}
    </div>
  );
};
