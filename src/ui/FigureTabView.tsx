import React, { useMemo, useState } from 'react';
import { Download, Gauge, Pin, PinOff, Table2 } from 'lucide-react';
import type * as Plotly from 'plotly.js';
import { extractFigureDiagnostics } from '../engine/analytics';
import { exportTableToCSV } from '../store/projectStore';
import type { FigureSpec } from '../types/simulation';
import { PlotlyChart } from './PlotlyChart';

interface FigureTabViewProps {
  figure: FigureSpec;
  isDark: boolean;
  pinnedTraces?: Plotly.Data[];
  pinnedLabel?: string;
  onPinCurrent?: () => void;
  onClearPinned?: () => void;
  onPlotElementReady?: (el: HTMLElement | null) => void;
}

export const FigureTabView: React.FC<FigureTabViewProps> = ({
  figure,
  isDark,
  pinnedTraces,
  pinnedLabel,
  onPinCurrent,
  onClearPinned,
  onPlotElementReady,
}) => {
  const [showTable, setShowTable] = useState(false);

  // E3: Overlay pinned reference traces as dotted lines when present
  const displayFigure = useMemo<FigureSpec>(() => {
    if (!pinnedTraces || pinnedTraces.length === 0) return figure;
    return {
      ...figure,
      traces: [...figure.traces, ...pinnedTraces],
    };
  }, [figure, pinnedTraces]);

  const hasPinned = Boolean(pinnedTraces && pinnedTraces.length > 0);
  // Only allow pinning on standard 2D scatter/bar figures (not heatmaps/contours)
  const canPin = figure.traces.some(
    (tr) => !tr.type || tr.type === 'scatter' || tr.type === 'bar',
  );

  // T2.2: Automated Curve-Fitting & Engineering Diagnostics
  const diagnostics = useMemo(() => extractFigureDiagnostics(figure), [figure]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {figure.title}
          </h2>
          {figure.subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {figure.subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canPin && onPinCurrent && (
            <button
              type="button"
              onClick={onPinCurrent}
              title="Pin current curves as a dotted reference overlay for comparing parameter changes"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                hasPinned
                  ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              {hasPinned ? 'Update Pin' : 'Pin Ref'}
            </button>
          )}

          {hasPinned && onClearPinned && (
            <button
              type="button"
              onClick={onClearPinned}
              title="Remove pinned reference overlay"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
            >
              <PinOff className="w-3.5 h-3.5" />
              Clear Pin
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-expanded={showTable}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
              showTable
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            {showTable ? 'Hide data table' : 'Show data table'}
          </button>

          <button
            type="button"
            onClick={() =>
              exportTableToCSV(`${figure.id}.csv`, figure.table.headers, figure.table.rows)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {hasPinned && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-1.5 text-[11px] font-mono text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
          <span>
            Overlaying pinned reference ({pinnedLabel ?? 'previous run'}) as dotted curves. Change parameters &amp; re-run to compare.
          </span>
        </div>
      )}

      {/* Main Plotly Chart Card */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-3">
        <PlotlyChart
          figure={displayFigure}
          isDark={isDark}
          onPlotElementReady={onPlotElementReady}
        />
      </div>

      {/* Optional Data Table */}
      {showTable && (
        <div
          data-testid={`data-table-${figure.id}`}
          className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                {figure.table.headers.map((h, i) => (
                  <th key={i} className="py-2 px-3 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums text-slate-800 dark:text-slate-200">
              {figure.table.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* T2.2: Automated Curve-Fitting & Engineering Diagnostics Strip */}
      {diagnostics && diagnostics.items.length > 0 && (
        <section
          data-testid={`diagnostics-${figure.id}`}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Gauge className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Automated Curve-Fitting Diagnostics</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {diagnostics.headline}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {diagnostics.items.map((item, idx) => (
              <div
                key={`${item.traceName}-${idx}`}
                className="rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3 py-2 space-y-1"
              >
                <div
                  className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate"
                  title={item.traceName}
                >
                  {item.traceName}
                </div>
                <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.metricLabel}
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.valueText}
                  </span>
                </div>
                {(item.secondaryText || item.deltaVsBaseline) && (
                  <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] font-mono tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">
                      {item.secondaryLabel && item.secondaryText
                        ? `${item.secondaryLabel}: ${item.secondaryText}`
                        : ''}
                    </span>
                    {item.deltaVsBaseline && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {item.deltaVsBaseline}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Auto-generated Computed Key Findings Box */}
      <section
        data-testid={`key-findings-${figure.id}`}
        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4"
      >
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
          Key Findings (Computed from Simulation Data)
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {figure.keyFindings.map((finding, idx) => (
            <li key={idx}>{finding}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};
