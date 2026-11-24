import React, { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Play,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  ALL_MODULE_IDS,
  runAllGoldenRegressionsAsync,
  runModuleGoldenRegression,
  type ModuleRegressionReport,
  type SuiteRegressionReport,
} from '../engine/golden';
import { generateRegressionPdfBlob } from '../export/pdfExporter';
import { getModuleDescriptor } from '../modules/registry';
import { downloadBlobFile } from '../store/projectStore';
import type { ModuleId } from '../types/simulation';

interface RegressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusModuleId?: ModuleId | null;
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 0.001 || a >= 10000) return v.toExponential(4);
  return v.toFixed(5);
}

export const RegressionModal: React.FC<RegressionModalProps> = ({
  isOpen,
  onClose,
  focusModuleId = null,
}) => {
  const [running, setRunning] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [moduleReports, setModuleReports] = useState<ModuleRegressionReport[]>([]);
  const [suiteSummary, setSuiteSummary] = useState<SuiteRegressionReport | null>(null);

  if (!isOpen) return null;

  const handleRunAll = async () => {
    setRunning(true);
    setModuleReports([]);
    setSuiteSummary(null);
    setProgressText('Starting golden regression across all 8 modules...');
    try {
      const summary = await runAllGoldenRegressionsAsync((rep, idx, total) => {
        setModuleReports((prev) => [...prev, rep]);
        const desc = getModuleDescriptor(rep.moduleId);
        setProgressText(
          `Checked ${idx}/${total}: Module ${desc.number} (${desc.shortTitle}) — ${rep.passed ? 'PASS' : 'FAIL'}`,
        );
      });
      setSuiteSummary(summary);
      setProgressText(
        `Completed ${summary.passedModules}/${summary.totalModules} modules (${summary.passedMetrics}/${summary.totalMetrics} metrics) in ${(summary.totalElapsedMs / 1000).toFixed(2)}s.`,
      );
    } finally {
      setRunning(false);
    }
  };

  const handleRunSingle = (modId: ModuleId) => {
    setRunning(true);
    setSuiteSummary(null);
    setProgressText(`Checking Module ${getModuleDescriptor(modId).number}...`);
    setTimeout(() => {
      try {
        const rep = runModuleGoldenRegression(modId);
        setModuleReports([rep]);
        setProgressText(
          `Module ${getModuleDescriptor(modId).number}: ${rep.passed ? 'PASS' : 'FAIL'} — max drift ${(rep.maxRelDrift * 100).toFixed(4)}% (${Math.round(rep.elapsedMs)} ms).`,
        );
      } finally {
        setRunning(false);
      }
    }, 16);
  };

  const handleDownloadPdf = () => {
    const blob = generateRegressionPdfBlob(moduleReports, suiteSummary);
    downloadBlobFile(
      `wirelesslab_ece441_regression_${new Date().toISOString().slice(0, 10)}.pdf`,
      blob,
    );
  };

  const allRows = moduleReports.flatMap((m) => m.rows);
  const allPassed =
    moduleReports.length > 0 && moduleReports.every((m) => m.passed);
  const totalPassedMetrics = allRows.filter((r) => r.passed).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Golden-Results Regression Check"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Golden-Results Regression Check (Deterministic Baseline Verification)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close regression check dialog"
            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5">
            <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Verify zero numerical drift across deterministic seeds &amp; analytical models
              </div>
              <div>
                Executes default-parameter seeded benchmarks for each module and compares against stored <span className="font-mono">goldenResults.json</span> baselines.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {focusModuleId && (
                <button
                  type="button"
                  disabled={running}
                  onClick={() => handleRunSingle(focusModuleId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Check Module {getModuleDescriptor(focusModuleId).number} Only
                </button>
              )}
              <button
                type="button"
                disabled={running}
                onClick={() => void handleRunAll()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {running ? 'Running Checks...' : 'Run All 8 Modules'}
              </button>
            </div>
          </div>

          {/* Quick per-module status strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {ALL_MODULE_IDS.map((id) => {
              const desc = getModuleDescriptor(id);
              const rep = moduleReports.find((r) => r.moduleId === id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={running}
                  onClick={() => handleRunSingle(id)}
                  title={`Run golden regression for Module ${desc.number}: ${desc.shortTitle}`}
                  className={`rounded border p-2 text-left transition-colors ${
                    rep
                      ? rep.passed
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      M{desc.number}
                    </span>
                    {rep ? (
                      rep.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {desc.shortTitle}
                  </div>
                </button>
              );
            })}
          </div>

          {progressText && (
            <div
              className={`rounded-md border px-3.5 py-2 text-xs font-mono flex items-center justify-between gap-2 ${
                moduleReports.length > 0 && !running
                  ? allPassed
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                    : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                  : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
              }`}
            >
              <span>{progressText}</span>
              {moduleReports.length > 0 && !running && (
                <span className="font-semibold">
                  {allPassed ? 'ALL PASS' : 'DRIFT DETECTED'} ({totalPassedMetrics}/{allRows.length})
                </span>
              )}
            </div>
          )}

          {allRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <th className="py-2 px-3 font-semibold">Module</th>
                    <th className="py-2 px-3 font-semibold">Golden Metric</th>
                    <th className="py-2 px-3 font-semibold text-right">Golden</th>
                    <th className="py-2 px-3 font-semibold text-right">Actual</th>
                    <th className="py-2 px-3 font-semibold text-right">Drift %</th>
                    <th className="py-2 px-3 font-semibold text-right">Tol.</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
                  {allRows.map((row, idx) => (
                    <tr key={`${row.moduleId}-${row.key}-${idx}`} className="text-slate-800 dark:text-slate-200">
                      <td className="py-1.5 px-3 font-semibold">
                        M{getModuleDescriptor(row.moduleId).number}
                      </td>
                      <td className="py-1.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                        {row.label}
                        {row.unit ? ` (${row.unit})` : ''}
                      </td>
                      <td className="py-1.5 px-3 text-right">{fmtNum(row.golden)}</td>
                      <td className="py-1.5 px-3 text-right">{fmtNum(row.actual)}</td>
                      <td className="py-1.5 px-3 text-right">
                        {Number.isFinite(row.relDrift)
                          ? `${(row.relDrift * 100).toFixed(4)}%`
                          : 'Inf'}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-500">
                        &le;{(row.relTolerance * 100).toFixed(2)}%
                      </td>
                      <td className="py-1.5 px-3 font-sans">
                        {row.passed ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            PASS
                          </span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-400 font-semibold">
                            FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Baseline: src/engine/goldenResults.json (40 metrics across 8 modules)
          </div>
          <div className="flex items-center gap-2">
            {moduleReports.length > 0 && (
              <button
                type="button"
                data-testid="export-regression-pdf-btn"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Export PDF Report
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
