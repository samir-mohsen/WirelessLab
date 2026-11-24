import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookmarkPlus,
  Calculator,
  CheckCircle2,
  Code2,
  Download,
  Eraser,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Grid,
  HelpCircle,
  History,
  Image as ImageIcon,
  Languages,
  Layers,
  Moon,
  Play,
  Presentation,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
} from 'lucide-react';
import type * as Plotly from 'plotly.js';
import {
  BUILTIN_PRESETS,
  deleteCustomPreset,
  loadCustomPresets,
  saveCustomPreset,
  type ScenarioPreset,
} from '../engine/presets';
import { getParameterWarnings } from '../engine/validity';
import type { ProgressUpdate } from '../engine/workerPool';
import { t, type UiLocale } from '../i18n/translations';
import { exportTableToCSV } from '../store/projectStore';
import type {
  ConsoleEntry,
  FigureSpec,
  ModuleDescriptor,
  ModuleResultBundle,
  RunHistoryEntry,
} from '../types/simulation';
import { ConsolePanel } from './ConsolePanel';
import { FigureTabView } from './FigureTabView';
import { downloadActiveChartPng } from './PlotlyChart';
import { RequirementsChecker } from './RequirementsChecker';
import { SignalLabView } from './SignalLabView';
import { SweepView } from './SweepView';
import { VerificationView } from './VerificationView';
import { VivaView } from './VivaView';

interface ModuleWorkspaceProps {
  descriptor: ModuleDescriptor;
  params: Record<string, unknown>;
  onChangeParams: (next: Record<string, unknown>) => void;
  results: ModuleResultBundle | null;
  runHistory: RunHistoryEntry[];
  onRestoreHistory: (entry: RunHistoryEntry) => void;
  pinnedByFigure: Record<string, { label: string; traces: Plotly.Data[] }>;
  onPinFigure: (fig: FigureSpec) => void;
  onClearPinnedFigure: (figId: string) => void;
  isDark: boolean;
  locale: UiLocale;
  isRunning: boolean;
  progress: ProgressUpdate | null;
  consoleEntries: ConsoleEntry[];
  paramsPanel: React.ReactNode;
  theoryPanel: React.ReactNode;
  onBackHome: () => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onRun: () => void;
  onRunAll: () => void;
  onStop: () => void;
  onResetDefaults: () => void;
  onResetModuleResults: () => void;
  onSelfTest: () => void;
  onExportPython: () => void;
  onExportMatlab: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onOpenPresentation: () => void;
  onOpenReport: () => void;
  onOpenRegression: () => void;
  onOpenCalculator: () => void;
  onOpenHelp: () => void;
  onClearConsole: () => void;
}

type SpecialTab = 'theory' | 'signallab' | 'verify' | 'sweep' | 'viva' | 'requirements';
const SPECIAL_TABS = new Set<string>([
  'theory',
  'signallab',
  'verify',
  'sweep',
  'viva',
  'requirements',
]);

export const ModuleWorkspace: React.FC<ModuleWorkspaceProps> = ({
  descriptor,
  params,
  onChangeParams,
  results,
  runHistory,
  onRestoreHistory,
  pinnedByFigure,
  onPinFigure,
  onClearPinnedFigure,
  isDark,
  locale,
  isRunning,
  progress,
  consoleEntries,
  paramsPanel,
  theoryPanel,
  onBackHome,
  onToggleTheme,
  onToggleLocale,
  onRun,
  onRunAll,
  onStop,
  onResetDefaults,
  onResetModuleResults,
  onSelfTest,
  onExportPython,
  onExportMatlab,
  onSaveProject,
  onLoadProject,
  onOpenPresentation,
  onOpenReport,
  onOpenRegression,
  onOpenCalculator,
  onOpenHelp,
  onClearConsole,
}) => {
  const figures = results?.figures ?? [];
  const [activeTab, setActiveTab] = useState<string>(() => figures[0]?.id ?? 'theory');
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [mobileParamsOpen, setMobileParamsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState<ScenarioPreset[]>(() =>
    loadCustomPresets(descriptor.id),
  );
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const activePlotElRef = useRef<HTMLElement | null>(null);
  const prevFigCountRef = useRef<number>(figures.length);

  // Reset tab & reload custom presets whenever active module changes
  useEffect(() => {
    const initialFigs = results?.figures ?? [];
    setActiveTab(initialFigs[0]?.id ?? 'theory');
    prevFigCountRef.current = initialFigs.length;
    setCustomPresets(loadCustomPresets(descriptor.id));
    setSelectedPresetId('');
    setShowSavePreset(false);
    setHistoryOpen(false);
  }, [descriptor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch to the first figure tab right after a module finishes its first run
  useEffect(() => {
    if (prevFigCountRef.current === 0 && figures.length > 0 && activeTab === 'theory') {
      setActiveTab(figures[0].id);
    }
    prevFigCountRef.current = figures.length;
  }, [figures.length, figures, activeTab]);

  // E8: Keyboard shortcuts — Ctrl/Cmd+Enter runs simulation, Escape stops
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning) onRun();
      } else if (e.key === 'Escape' && isRunning) {
        e.preventDefault();
        onStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning, onRun, onStop]);

  // E2: Combined built-in + custom scenario presets
  const allPresets = useMemo(
    () => [...(BUILTIN_PRESETS[descriptor.id] ?? []), ...customPresets],
    [descriptor.id, customPresets],
  );

  // E7: Real-time parameter validity warnings
  const paramWarnings = useMemo(
    () => getParameterWarnings(descriptor.id, params),
    [descriptor.id, params],
  );
  const hasBlockingError = paramWarnings.some((w) => w.severity === 'error');

  const activeFigure =
    figures.find((f) => f.id === activeTab) ??
    (!SPECIAL_TABS.has(activeTab) ? figures[0] ?? null : null);

  const effectiveTab: string = SPECIAL_TABS.has(activeTab)
    ? activeTab
    : activeFigure
      ? activeFigure.id
      : 'theory';

  const reqsMet = results?.requirements.filter((r) => r.met).length ?? 0;
  const reqsTotal = results?.requirements.length ?? 6;

  const handleExportPng = async () => {
    if (!activeFigure) return;
    await downloadActiveChartPng(activePlotElRef.current, activeFigure);
  };

  const handleExportCsv = () => {
    if (!activeFigure) return;
    exportTableToCSV(
      `${activeFigure.id}.csv`,
      activeFigure.table.headers,
      activeFigure.table.rows,
    );
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = allPresets.find((p) => p.id === presetId);
    if (found) {
      onChangeParams({ ...params, ...found.params });
    }
  };

  const handleSaveCustomPreset = () => {
    if (!presetNameInput.trim()) return;
    const next = saveCustomPreset(descriptor.id, presetNameInput.trim(), params);
    setCustomPresets(next);
    setPresetNameInput('');
    setShowSavePreset(false);
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    const next = deleteCustomPreset(descriptor.id, presetId);
    setCustomPresets(next);
    if (selectedPresetId === presetId) setSelectedPresetId('');
  };

  const progressPct = progress
    ? Math.min(100, Math.round((progress.completed / Math.max(progress.total, 1)) * 100))
    : 0;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top MATLAB-style Command Toolbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shrink-0 relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Home & Module Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackHome}
              aria-label="Back to Home Dashboard"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(locale, 'home')}</span>
            </button>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                Module {descriptor.number}: {descriptor.shortTitle}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                WirelessLab ECE441
                {results ? ` · Seed ${results.meta.seed}` : ''}
              </div>
            </div>
          </div>

          {/* Center/Right: Execution & Export Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileParamsOpen((o) => !o)}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Params
            </button>

            <button
              type="button"
              disabled={isRunning || hasBlockingError}
              onClick={onRun}
              title="Run simulation (Ctrl+Enter)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              {t(locale, 'run')}
            </button>

            <button
              type="button"
              disabled={isRunning || hasBlockingError}
              onClick={onRunAll}
              title="Run full accuracy experiments (all required figures)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-blue-600/40 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              {t(locale, 'runAll')}
            </button>

            <button
              type="button"
              disabled={!isRunning}
              onClick={onStop}
              title="Stop simulation (Esc)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium disabled:opacity-35 transition-colors whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" />
              {t(locale, 'stop')}
            </button>

            <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

            <button
              type="button"
              disabled={isRunning}
              onClick={onResetDefaults}
              title="Reset parameters to defaults"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{t(locale, 'reset')}</span>
            </button>

            <button
              type="button"
              data-testid="reset-module-run-btn"
              disabled={isRunning || figures.length === 0}
              onClick={() => {
                onResetModuleResults();
                setActiveTab('theory');
              }}
              title="Clear this lab's simulation results and return status to Ready"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-35 whitespace-nowrap"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{t(locale, 'resetLab')}</span>
            </button>

            <button
              type="button"
              disabled={isRunning || hasBlockingError}
              onClick={onSelfTest}
              title="Quick verification against analytical theory (PASS if rel. error <= 15%)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {t(locale, 'selfTest')}
            </button>

            {/* E3: Run History popover trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                title="View run history & restore previous parameter sets"
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded border text-xs whitespace-nowrap ${
                  historyOpen
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">{t(locale, 'history')}</span>
                {runHistory.length > 0 && (
                  <span className="font-mono text-[10px] opacity-80">({runHistory.length})</span>
                )}
              </button>

              {historyOpen && (
                <div className="absolute right-0 mt-1.5 w-80 max-h-80 overflow-y-auto z-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Run History ({runHistory.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                  {runHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                      No completed runs recorded for this module yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {runHistory.map((h) => (
                        <div
                          key={h.id}
                          className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div className="font-mono text-slate-700 dark:text-slate-300 min-w-0">
                            <div className="font-semibold">
                              {h.timestamp} · {h.mode.toUpperCase()}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 truncate">
                              Seed {h.seed} · {(h.elapsedMs / 1000).toFixed(2)}s ·{' '}
                              {h.verifyPassed === null
                                ? `${h.figureCount} figs`
                                : h.verifyPassed
                                  ? 'PASS'
                                  : 'CHECK'}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              onRestoreHistory(h);
                              setHistoryOpen(false);
                            }}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium shrink-0 disabled:opacity-40"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!activeFigure}
              onClick={() => void handleExportPng()}
              title="Export active figure as PNG"
              aria-label="Export PNG"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 whitespace-nowrap"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">PNG</span>
            </button>

            <button
              type="button"
              disabled={!activeFigure}
              onClick={handleExportCsv}
              title="Export active figure data table as CSV"
              aria-label="Export CSV"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">CSV</span>
            </button>

            {/* E6: Reproducible Python & MATLAB code export */}
            <button
              type="button"
              onClick={onExportPython}
              title="Export standalone Python (NumPy/SciPy/Matplotlib) script with current parameters & seed"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5" />
              .py
            </button>

            <button
              type="button"
              onClick={onExportMatlab}
              title="Export standalone MATLAB (.m) script with current parameters & seed"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5" />
              .m
            </button>

            <button
              type="button"
              onClick={onSaveProject}
              title="Save project JSON"
              aria-label="Save project JSON"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onLoadProject}
              title="Load project JSON"
              aria-label="Load project JSON"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

            <button
              type="button"
              disabled={figures.length === 0}
              onClick={onOpenPresentation}
              title="Full-screen Presentation Mode (20-25 min timer)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 whitespace-nowrap"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t(locale, 'present')}</span>
            </button>

            <button
              type="button"
              disabled={figures.length === 0}
              onClick={onOpenReport}
              title="Export PowerPoint (.pptx), Word (.docx), Submission Bundle (.zip), HTML & PDF"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t(locale, 'report')}</span>
            </button>

            <button
              type="button"
              onClick={onToggleLocale}
              title="Toggle English / Arabic UI"
              aria-label="Toggle UI Language"
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Languages className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onOpenCalculator}
              aria-label="Wireless Design Calculator"
              title="Wireless Engineering Design Calculator (Link Budget, OFDM, Erlang-B, dB/BER)"
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Calculator className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="Help and About"
              title="Help and About"
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* E8: Sticky top slim progress bar while Web Workers are executing */}
        {isRunning && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-150"
              style={{ width: `${Math.max(6, progressPct)}%` }}
            />
          </div>
        )}
      </header>

      {/* Center Split: Left Parameters Panel + Main Figures/Tabs Stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Parameters Sidebar */}
        <aside
          aria-label="Simulation Parameters"
          className={`${
            mobileParamsOpen
              ? 'fixed inset-y-14 left-0 z-30 w-80 shadow-xl'
              : 'hidden'
          } lg:static lg:block lg:w-[316px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto p-4 space-y-4`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t(locale, 'parameters')}
            </h2>
            <button
              type="button"
              onClick={() => setMobileParamsOpen(false)}
              className="lg:hidden text-xs text-blue-600 dark:text-blue-400"
            >
              Done
            </button>
          </div>

          {/* E2: Scenario Presets Selector + Custom Preset Saver */}
          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="scenario-preset-select"
                className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
              >
                {t(locale, 'presets')}
              </label>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setShowSavePreset((s) => !s)}
                title="Save current parameters as a custom preset"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
              >
                <BookmarkPlus className="w-3 h-3" />
                Save
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                id="scenario-preset-select"
                disabled={isRunning}
                value={selectedPresetId}
                onChange={(e) => handleApplyPreset(e.target.value)}
                className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="">Select scenario preset...</option>
                <optgroup label="Built-in Scenarios">
                  {(BUILTIN_PRESETS[descriptor.id] ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {customPresets.length > 0 && (
                  <optgroup label="Custom Saved">
                    {customPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedPresetId.startsWith('custom_') && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomPreset(selectedPresetId)}
                  aria-label="Delete selected custom preset"
                  className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showSavePreset && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomPreset}
                  className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* E7: Real-Time Parameter Validity Warnings */}
          {paramWarnings.length > 0 && (
            <div className="space-y-1.5">
              {paramWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`rounded-md border p-2 text-[11px] leading-snug flex items-start gap-2 ${
                    w.severity === 'error'
                      ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                      : 'border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {paramsPanel}
        </aside>

        {/* Main Figures & Theory Stage */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Tab Strip */}
          <div
            role="tablist"
            aria-label="Module Views and Figures"
            className="flex items-center gap-1 overflow-x-auto px-3 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 shrink-0"
          >
            {figures.map((fig) => {
              const selected = effectiveTab === fig.id;
              return (
                <button
                  key={fig.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveTab(fig.id)}
                  className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-950 rounded-t'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {fig.shortTitle}
                </button>
              );
            })}

            {figures.length > 0 && (
              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />
            )}

            {(
              [
                { id: 'theory' as SpecialTab, label: t(locale, 'theory') },
                { id: 'signallab' as SpecialTab, label: t(locale, 'signalLab') },
                { id: 'verify' as SpecialTab, label: t(locale, 'verify') },
                { id: 'sweep' as SpecialTab, label: t(locale, 'sweep') },
                { id: 'viva' as SpecialTab, label: t(locale, 'viva') },
                {
                  id: 'requirements' as SpecialTab,
                  label: `${t(locale, 'reqs')} (${reqsMet}/${reqsTotal})`,
                },
              ] as const
            ).map((tabItem) => {
              const selected = effectiveTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tabItem.id)}
                  className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                    selected
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-950 rounded-t'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tabItem.id === 'signallab' && <Activity className="w-3.5 h-3.5 opacity-80" />}
                  {tabItem.id === 'sweep' && <Grid className="w-3 h-3 opacity-80" />}
                  {tabItem.id === 'viva' && <GraduationCap className="w-3.5 h-3.5 opacity-80" />}
                  {tabItem.id === 'requirements' && reqsMet === reqsTotal && results && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {tabItem.label}
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950">
            {/* E8: Clean skeleton state when first run is actively computing */}
            {isRunning && figures.length === 0 && !SPECIAL_TABS.has(effectiveTab) && (
              <div className="space-y-4 animate-pulse">
                <div className="h-5 w-64 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-[420px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center">
                  <span className="text-xs font-mono text-slate-500">
                    Running Web Worker Monte-Carlo simulation ({progressPct}%)...
                  </span>
                </div>
                <div className="h-24 rounded-lg bg-slate-200/70 dark:bg-slate-800/60" />
              </div>
            )}

            {effectiveTab === 'theory' && theoryPanel}

            {effectiveTab === 'signallab' && (
              <SignalLabView moduleId={descriptor.id} params={params} isDark={isDark} />
            )}

            {effectiveTab === 'verify' && (
              <VerificationView
                verification={results?.verification ?? null}
                onRunSelfTest={onSelfTest}
                onOpenRegression={onOpenRegression}
                isRunning={isRunning}
              />
            )}

            {effectiveTab === 'sweep' && (
              <SweepView moduleId={descriptor.id} params={params} isDark={isDark} />
            )}

            {effectiveTab === 'viva' && (
              <VivaView
                moduleId={descriptor.id}
                results={results}
                onJumpToFigure={(figId) => setActiveTab(figId)}
              />
            )}

            {effectiveTab === 'requirements' && (
              <RequirementsChecker
                requirements={results?.requirements ?? []}
                hasRun={Boolean(results && results.figures.length > 0)}
              />
            )}

            {activeFigure && !SPECIAL_TABS.has(effectiveTab) && (
              <FigureTabView
                figure={activeFigure}
                isDark={isDark}
                pinnedTraces={pinnedByFigure[`${descriptor.id}:${activeFigure.id}`]?.traces}
                pinnedLabel={pinnedByFigure[`${descriptor.id}:${activeFigure.id}`]?.label}
                onPinCurrent={() => onPinFigure(activeFigure)}
                onClearPinned={() => onClearPinnedFigure(`${descriptor.id}:${activeFigure.id}`)}
                onPlotElementReady={(el) => {
                  activePlotElRef.current = el;
                }}
              />
            )}

            {figures.length === 0 && !isRunning && !SPECIAL_TABS.has(effectiveTab) && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center max-w-xl mx-auto mt-8">
                <Download className="w-7 h-7 text-blue-600 mx-auto mb-3 opacity-80" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t(locale, 'noResultsTitle')}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {t(locale, 'noResultsBody')}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom Collapsible Console */}
      <ConsolePanel
        entries={consoleEntries}
        collapsed={consoleCollapsed}
        onToggleCollapse={() => setConsoleCollapsed((c) => !c)}
        onClear={onClearConsole}
        progress={progress}
        isRunning={isRunning}
      />
    </div>
  );
};
