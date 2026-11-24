import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { VerificationResult } from '../engine/stats';

interface VerificationViewProps {
  verification: VerificationResult | null;
  onRunSelfTest: () => void;
  onOpenRegression?: () => void;
  isRunning: boolean;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  if (v < 0.001 || v >= 1000) return v.toExponential(3);
  return v.toFixed(5);
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  verification,
  onRunSelfTest,
  onOpenRegression,
  isRunning,
}) => {
  if (!verification) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center max-w-2xl">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Verification Not Run Yet
        </h3>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Run the module or click Self-test to compare simulated Monte-Carlo points against closed-form analytical theory.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={isRunning}
            onClick={onRunSelfTest}
            className="px-4 py-2 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
          >
            Run Quick Self-Test
          </button>
          {onOpenRegression && (
            <button
              type="button"
              onClick={onOpenRegression}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Golden Regression Check
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {verification.passed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {verification.passed ? 'Verification PASSED' : 'Verification FAILED'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {verification.summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Max Rel. Error</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {Number.isFinite(verification.maxRelError)
                ? `${(verification.maxRelError * 100).toFixed(2)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Threshold</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              &le; {(verification.threshold * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Reliable Points</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {verification.pointsUsed} / {verification.totalPoints}
            </div>
          </div>
          {onOpenRegression && (
            <button
              type="button"
              onClick={onOpenRegression}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 font-sans text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Regression Check
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <th className="py-2.5 px-3 font-semibold">Case / Point</th>
              <th className="py-2.5 px-3 font-semibold text-right">Simulated</th>
              <th className="py-2.5 px-3 font-semibold text-right">Theory</th>
              <th className="py-2.5 px-3 font-semibold text-right">Rel. Error (%)</th>
              <th className="py-2.5 px-3 font-semibold text-right">Errors / Trials</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
            {verification.rows.map((row, idx) => (
              <tr
                key={idx}
                className={
                  row.included
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }
              >
                <td className="py-2 px-3 font-sans">{row.label}</td>
                <td className="py-2 px-3 text-right">{fmt(row.simulated)}</td>
                <td className="py-2 px-3 text-right">{fmt(row.theory)}</td>
                <td className="py-2 px-3 text-right">
                  {Number.isFinite(row.relError) ? `${(row.relError * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2 px-3 text-right">
                  {row.errorsCount.toLocaleString()} / {row.trialsCount.toLocaleString()}
                </td>
                <td className="py-2 px-3 font-sans">
                  {!row.included ? (
                    <span>Skipped (low errors)</span>
                  ) : row.relError <= verification.threshold ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      ✓ Pass
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 font-medium">
                      ✕ Exceeds threshold
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
