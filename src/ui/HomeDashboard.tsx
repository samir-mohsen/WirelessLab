import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  CircleDot,
  FileText,
  FolderOpen,
  HelpCircle,
  Languages,
  Moon,
  Play,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Square,
  Sun,
  X,
} from 'lucide-react';
import { t, type UiLocale } from '../i18n/translations';
import { MODULES } from '../modules/registry';
import type { ModuleId, ModuleResultBundle, ModuleStatus } from '../types/simulation';
import { ModulePreviewIcon } from './ModuleIcons';

export interface BatchRunProgress {
  currentIdx: number;
  total: number;
  moduleTitle: string;
  elapsedSec: number;
}

interface HomeDashboardProps {
  moduleResults: Record<string, ModuleResultBundle | null>;
  isDark: boolean;
  locale: UiLocale;
  batchProgress: BatchRunProgress | null;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onOpenModule: (id: ModuleId) => void;
  onRunAllModules: () => void;
  onStopBatchRun: () => void;
  onResetAllModules: () => void;
  onResetSingleModule: (id: ModuleId) => void;
  onOpenCalculator: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onExportSuiteReport: () => void;
  onOpenRegression: () => void;
  onOpenAbout: (tab: 'about' | 'help') => void;
}

function getModuleStatus(
  id: ModuleId,
  results: Record<string, ModuleResultBundle | null>,
): ModuleStatus {
  const bundle = results[id];
  if (!bundle || bundle.figures.length === 0) return 'ready';
  const allMet =
    bundle.requirements.length > 0 && bundle.requirements.every((r) => r.met);
  return allMet ? 'requirements_met' : 'ready';
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  moduleResults,
  isDark,
  locale,
  batchProgress,
  onToggleTheme,
  onToggleLocale,
  onOpenModule,
  onRunAllModules,
  onStopBatchRun,
  onResetAllModules,
  onResetSingleModule,
  onOpenCalculator,
  onSaveProject,
  onLoadProject,
  onExportSuiteReport,
  onOpenRegression,
  onOpenAbout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const completedCount = MODULES.filter((m) => {
    const b = moduleResults[m.id];
    return b && b.figures.length > 0;
  }).length;

  const metCount = MODULES.filter(
    (m) => getModuleStatus(m.id, moduleResults) === 'requirements_met',
  ).length;

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter((m) => {
      const haystack = [
        `module ${m.number}`,
        `m${m.number}`,
        m.title,
        m.shortTitle,
        m.oneLineIdea,
        ...m.requiredResultsSummary,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar — clean 3-zone header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            {t(locale, 'appTitle')}
          </div>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={onSaveProject}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {t(locale, 'saveProject')}
            </button>
            <button
              type="button"
              onClick={onLoadProject}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {t(locale, 'loadProject')}
            </button>
            <button
              type="button"
              onClick={onExportSuiteReport}
              disabled={completedCount === 0}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              {t(locale, 'suiteReport')}
              {completedCount > 0 ? ` (${completedCount})` : ''}
            </button>
            <button
              type="button"
              onClick={onOpenRegression}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t(locale, 'regressionCheck')}
            </button>
            <button
              type="button"
              onClick={() => onOpenAbout('help')}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {t(locale, 'helpAbout')}
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleLocale}
              aria-label="Toggle UI Language (English / Arabic)"
              title="Switch UI language (English / عربي)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              {locale === 'en' ? 'عربي' : 'EN'}
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-7 space-y-6">
        {/* Course Intro & Summary Strip */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="max-w-2xl space-y-1.5">
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {t(locale, 'subtitle')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Complete 8-Topic Wireless Communications Simulation Suite
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              100% browser-local Web Worker Monte-Carlo engines with deterministic seeds, analytical theory verification, 2D parameter sweeps, Viva Q&amp;A prep, Python/MATLAB export, presentation mode, and 12-section printable reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
            <div>
              <div className="text-slate-400 dark:text-slate-500">Modules Ready</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {MODULES.length} / 8
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <div className="text-slate-400 dark:text-slate-500">Simulated</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {completedCount} / 8
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <div className="text-slate-400 dark:text-slate-500">Reqs Met</div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                {metCount} / 8
              </div>
            </div>
          </div>
        </section>

        {/* Global Search Bar + Suite Batch & Engineering Tools */}
        <section className="space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(locale, 'searchPlaceholder')}
                aria-label="Search simulation modules"
                className="w-full pl-9 pr-8 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {batchProgress ? (
                <button
                  type="button"
                  onClick={onStopBatchRun}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5" />
                  {t(locale, 'stopBatch')}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="run-all-8-btn"
                  onClick={onRunAllModules}
                  title="Execute all 8 simulation modules sequentially via Web Workers for immediate 8/8 Suite Reports"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t(locale, 'runAllModules')}
                </button>
              )}

              {completedCount > 0 && !batchProgress && (
                <button
                  type="button"
                  data-testid="reset-all-labs-btn"
                  onClick={onResetAllModules}
                  title="Clear all simulation results and return all 8 labs back to Ready"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t(locale, 'resetAllLabs')}
                </button>
              )}

              <button
                type="button"
                data-testid="open-calculator-btn"
                onClick={onOpenCalculator}
                title="Open ECE 441 Wireless Engineering Design Calculator (RF Link Budget, OFDM, Erlang-B, dB/BER)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {t(locale, 'designCalc')}
              </button>
            </div>
          </div>

          {batchProgress && (
            <div
              data-testid="batch-progress-banner"
              className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-blue-900 dark:text-blue-200">
                  Running Module {batchProgress.currentIdx} of {batchProgress.total}:{' '}
                  <span className="font-semibold">{batchProgress.moduleTitle}</span>
                </span>
                <span className="font-mono tabular-nums text-blue-700 dark:text-blue-300">
                  {Math.round(((batchProgress.currentIdx - 1) / batchProgress.total) * 100)}% ·{' '}
                  {batchProgress.elapsedSec.toFixed(1)}s elapsed
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-200/80 dark:bg-blue-950 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((batchProgress.currentIdx / batchProgress.total) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex md:hidden flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={onSaveProject}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              Save JSON
            </button>
            <button
              type="button"
              onClick={onLoadProject}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              Load JSON
            </button>
            <button
              type="button"
              onClick={onExportSuiteReport}
              disabled={completedCount === 0}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
            >
              Suite Report
            </button>
            <button
              type="button"
              onClick={onOpenRegression}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {t(locale, 'regressionCheck')}
            </button>
          </div>
        </section>

        {/* 8 Module Cards Grid */}
        <section aria-label="Simulation Modules">
          {filteredModules.length === 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No simulation modules match &ldquo;{searchQuery}&rdquo;. Try searching for OFDM, MIMO, MRC, DSSS, CDMA, FSPL, SIR, or OFDMA.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {filteredModules.map((mod) => {
                const status = getModuleStatus(mod.id, moduleResults);
                const bundle = moduleResults[mod.id];

                const statusLabel =
                  status === 'requirements_met'
                    ? t(locale, 'statusMet')
                    : t(locale, 'statusReady');

                const statusColor =
                  status === 'requirements_met'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-blue-700 dark:text-blue-400';

                const hasRunResults = Boolean(bundle && bundle.figures.length > 0);

                return (
                  <div
                    key={mod.id}
                    data-testid={`module-card-${mod.id}`}
                    className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/80 dark:hover:border-blue-500/80 p-4 flex flex-col justify-between gap-4 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenModule(mod.id)}
                      className="text-left space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Module 0{mod.number}
                        </div>
                        <ModulePreviewIcon
                          id={mod.id}
                          className="w-8 h-8 text-slate-600 dark:text-slate-400 shrink-0"
                        />
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors leading-snug">
                          {mod.title}
                        </h2>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {mod.oneLineIdea}
                        </p>
                      </div>
                    </button>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-medium ${statusColor}`}>
                        {status === 'requirements_met' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <CircleDot className="w-3.5 h-3.5" />
                        )}
                        {statusLabel}
                      </span>

                      <div className="flex items-center gap-2">
                        {hasRunResults && !batchProgress && (
                          <button
                            type="button"
                            data-testid={`reset-card-${mod.id}`}
                            onClick={() => onResetSingleModule(mod.id)}
                            title={`Reset Module ${mod.number} back to Ready`}
                            aria-label={`Reset Module ${mod.number} to Ready`}
                            className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenModule(mod.id)}
                          className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-mono text-[11px]"
                        >
                          {hasRunResults ? `${bundle!.figures.length} figs` : 'Open'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            WirelessLab ECE441 · Delta University for Science and Technology, Faculty of Engineering
          </span>
          <button
            type="button"
            onClick={() => onOpenAbout('about')}
            className="hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 hover:underline"
          >
            Edit Team Roster &amp; About
          </button>
        </div>
      </footer>
    </div>
  );
};
