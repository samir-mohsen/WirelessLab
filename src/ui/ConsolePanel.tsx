import React from 'react';
import { ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import type { ProgressUpdate } from '../engine/workerPool';
import type { ConsoleEntry } from '../types/simulation';

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClear: () => void;
  progress: ProgressUpdate | null;
  isRunning: boolean;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  entries,
  collapsed,
  onToggleCollapse,
  onClear,
  progress,
  isRunning,
}) => {
  const pct = progress ? Math.round(progress.fraction * 100) : 0;
  const etaText =
    progress && progress.etaMs !== null && progress.etaMs > 200
      ? `ETA ${(progress.etaMs / 1000).toFixed(1)}s`
      : '';

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span>Console</span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            ({entries.length})
          </span>
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-4">
          {isRunning && progress && (
            <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              <span className="truncate max-w-[200px]">{progress.label}</span>
              <div className="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span>{pct}%</span>
              {etaText && <span className="text-slate-500 dark:text-slate-400">{etaText}</span>}
            </div>
          )}

          <button
            type="button"
            onClick={onClear}
            title="Clear console"
            aria-label="Clear console"
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          data-testid="simulation-console"
          className="h-32 overflow-y-auto px-3 py-2 font-mono text-xs space-y-1 bg-slate-50 dark:bg-slate-950"
        >
          {entries.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500">
              Ready. Configure parameters on the left and click Run or Run All Experiments.
            </div>
          ) : (
            entries.map((entry) => {
              const color =
                entry.level === 'error'
                  ? 'text-rose-600 dark:text-rose-400'
                  : entry.level === 'warn'
                    ? 'text-amber-700 dark:text-amber-400'
                    : entry.level === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300';
              return (
                <div key={entry.id} className={`leading-relaxed break-words ${color}`}>
                  <span className="text-slate-400 dark:text-slate-500 mr-2 tabular-nums">
                    [{entry.timestamp}]
                  </span>
                  <span>{entry.message}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
