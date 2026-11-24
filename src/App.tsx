import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Plotly from 'plotly.js';
import {
  SimulationCancelledError,
  runWorkerPool,
  type ProgressUpdate,
} from './engine/workerPool';
import { generateMatlabScript, generatePythonScript } from './export/codeExporter';
import type { UiLocale } from './i18n/translations';
import {
  MODULE_ADAPTERS,
  buildAllDefaultParams,
  type AnyParams,
} from './modules/adapter';
import { MODULES, getModuleDescriptor } from './modules/registry';
import {
  downloadTextFile,
  loadProjectFromLocalStorage,
  loadSavedTheme,
  saveProjectToLocalStorage,
  saveTheme,
} from './store/projectStore';
import type {
  ConsoleEntry,
  FigureSpec,
  ModuleId,
  ModuleResultBundle,
  ProjectStateSnapshot,
  RunHistoryEntry,
} from './types/simulation';
import { AboutModal } from './ui/AboutModal';
import { CalculatorModal } from './ui/CalculatorModal';
import { HomeDashboard, type BatchRunProgress } from './ui/HomeDashboard';
import { ModuleWorkspace } from './ui/ModuleWorkspace';
import { PresentationMode } from './ui/PresentationMode';
import { RegressionModal } from './ui/RegressionModal';
import { ReportModal } from './ui/ReportModal';

const VALID_MODULE_IDS = new Set<string>(MODULES.map((m) => m.id));

function timeStampNow(): string {
  return new Date().toTimeString().slice(0, 8);
}

function buildInitialParams(saved: Record<string, Record<string, unknown>> | undefined): Record<ModuleId, AnyParams> {
  const defaults = buildAllDefaultParams();
  for (const mod of MODULES) {
    if (saved && saved[mod.id]) {
      defaults[mod.id] = { ...defaults[mod.id], ...saved[mod.id] };
    }
  }
  return defaults;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadSavedTheme());
  const [locale, setLocale] = useState<UiLocale>('en');
  const [project, setProject] = useState<ProjectStateSnapshot>(() =>
    loadProjectFromLocalStorage(),
  );
  const [allModuleParams, setAllModuleParams] = useState<Record<ModuleId, AnyParams>>(() =>
    buildInitialParams(loadProjectFromLocalStorage().moduleParams),
  );
  const [activeModule, setActiveModule] = useState<ModuleId | null>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const reqMod = sp.get('module');
      if (reqMod && VALID_MODULE_IDS.has(reqMod)) {
        return reqMod as ModuleId;
      }
      if (sp.get('autostart') === '1') {
        return 'module3';
      }
    }
    return null;
  });

  const [runHistory, setRunHistory] = useState<Partial<Record<ModuleId, RunHistoryEntry[]>>>({});
  const [pinnedByFigure, setPinnedByFigure] = useState<
    Record<string, { label: string; traces: Plotly.Data[] }>
  >({});

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchRunProgress | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSuiteMode, setReportSuiteMode] = useState(false);
  const [regressionModalOpen, setRegressionModalOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [aboutState, setAboutState] = useState<{ open: boolean; tab: 'about' | 'help' }>({
    open: false,
    tab: 'about',
  });

  const abortCtrlRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Sync document direction for EN / Arabic RTL mode (E8)
  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  // Autosave project snapshot to localStorage (safely inside try/catch)
  useEffect(() => {
    const nextSnapshot: ProjectStateSnapshot = {
      ...project,
      moduleParams: { ...allModuleParams },
    };
    saveProjectToLocalStorage(nextSnapshot);
  }, [project, allModuleParams]);

  const appendLog = useCallback(
    (level: ConsoleEntry['level'], message: string) => {
      setConsoleEntries((prev) => [
        ...prev.slice(-180),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: timeStampNow(),
          level,
          message,
        },
      ]);
    },
    [],
  );

  const runModule = useCallback(
    async (moduleId: ModuleId, mode: 'full' | 'quick' | 'selftest') => {
      if (isRunning) return;
      const adapter = MODULE_ADAPTERS[moduleId];
      const params = allModuleParams[moduleId];
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;
      setIsRunning(true);

      const t0 = performance.now();
      const effectiveMode =
        mode === 'full' && Boolean(params.quickMode) ? 'quick' : mode;
      const tasks = adapter.buildTasks(params, effectiveMode);

      appendLog('info', adapter.formatRunStartLog(params, effectiveMode, tasks.length));

      try {
        const outputs = await runWorkerPool<unknown, unknown>({
          createWorker: () => adapter.createWorker(),
          payloads: tasks,
          signal: ctrl.signal,
          label:
            effectiveMode === 'selftest'
              ? `${moduleId.toUpperCase()} Self-Test`
              : `${getModuleDescriptor(moduleId).shortTitle} (${tasks.length} tasks)`,
          onProgress: (upd) => setProgress(upd),
        });

        const elapsedMs = performance.now() - t0;

        if (effectiveMode === 'selftest') {
          const selfRes = adapter.assembleResults(params, outputs, elapsedMs, true);
          const v = selfRes.verification;
          appendLog(
            v?.passed ? 'success' : 'error',
            `Self-test finished in ${(elapsedMs / 1000).toFixed(2)}s — ${v?.summary ?? 'Done'} (${selfRes.meta.totalBitsOrTrials.toLocaleString()} trials/bits, seed=${selfRes.meta.seed})`,
          );
          setProject((prev) => {
            const existing = prev.moduleResults[moduleId];
            const updated: ModuleResultBundle =
              existing && v
                ? {
                    ...existing,
                    verification: v,
                    requirements: existing.requirements.map((r) =>
                      r.id === 'verification'
                        ? {
                            ...r,
                            met: v.passed,
                            detail: v.passed
                              ? `PASS — max rel. error ${(v.maxRelError * 100).toFixed(2)}% (<= 15%)`
                              : v.summary,
                          }
                        : r,
                    ),
                  }
                : selfRes;
            return {
              ...prev,
              moduleResults: { ...prev.moduleResults, [moduleId]: updated },
            };
          });
        } else {
          const bundle = adapter.assembleResults(params, outputs, elapsedMs, false);
          setProject((prev) => ({
            ...prev,
            moduleResults: { ...prev.moduleResults, [moduleId]: bundle },
          }));

          // E3: Append to per-module run history
          const entry: RunHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: timeStampNow(),
            seed: bundle.meta.seed,
            elapsedMs,
            mode: effectiveMode,
            figureCount: bundle.figures.length,
            verifyPassed: bundle.verification ? bundle.verification.passed : null,
            params: { ...params },
          };
          setRunHistory((prev) => ({
            ...prev,
            [moduleId]: [entry, ...(prev[moduleId] ?? [])].slice(0, 15),
          }));

          const maxErrStr =
            bundle.verification && Number.isFinite(bundle.verification.maxRelError)
              ? `${(bundle.verification.maxRelError * 100).toFixed(2)}%`
              : 'N/A';
          appendLog(
            'success',
            `Completed ${bundle.figures.length} figures in ${(elapsedMs / 1000).toFixed(2)}s — trials=${bundle.meta.totalBitsOrTrials.toLocaleString()}, errors=${bundle.meta.totalErrors.toLocaleString()}, verify=${bundle.verification?.passed ? 'PASS' : 'CHECK'} (max err ${maxErrStr}), seed=${bundle.meta.seed}`,
          );
        }
      } catch (err) {
        if (err instanceof SimulationCancelledError) {
          appendLog('warn', 'Simulation cancelled cleanly by user.');
        } else {
          appendLog(
            'error',
            `Simulation error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        abortCtrlRef.current = null;
        setIsRunning(false);
        setProgress(null);
      }
    },
    [isRunning, allModuleParams, appendLog],
  );

  const handleStop = useCallback(() => {
    abortCtrlRef.current?.abort();
  }, []);

  // Reset all 8 modules back to Ready (clears simulation results, history, and pinned traces)
  const handleResetAllModules = useCallback(() => {
    if (isRunning) return;
    setProject((prev) => ({
      ...prev,
      moduleResults: {},
    }));
    setRunHistory({});
    setPinnedByFigure({});
    appendLog('info', 'All 8 modules reset back to Ready state.');
  }, [isRunning, appendLog]);

  // Reset a single module back to Ready
  const handleResetSingleModule = useCallback(
    (moduleId: ModuleId) => {
      if (isRunning) return;
      setProject((prev) => {
        const nextResults = { ...prev.moduleResults };
        delete nextResults[moduleId];
        return { ...prev, moduleResults: nextResults };
      });
      setRunHistory((prev) => {
        const next = { ...prev };
        delete next[moduleId];
        return next;
      });
      setPinnedByFigure((prev) => {
        const next: typeof prev = {};
        const prefix = `${moduleId}:`;
        for (const [k, v] of Object.entries(prev)) {
          if (!k.startsWith(prefix)) next[k] = v;
        }
        return next;
      });
      const desc = getModuleDescriptor(moduleId);
      appendLog('info', `Module ${desc.number} (${desc.shortTitle}) cleared back to Ready state.`);
    },
    [isRunning, appendLog],
  );

  // T2.3: Batch Run All 8 Modules sequentially through real Web Workers
  const runAllModulesBatch = useCallback(async () => {
    if (isRunning) return;
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;
    setIsRunning(true);

    const batchStart = performance.now();
    appendLog('info', 'Starting batch run for all 8 ECE 441 simulation modules...');

    try {
      for (let idx = 0; idx < MODULES.length; idx++) {
        if (ctrl.signal.aborted) break;
        const mod = MODULES[idx];
        const adapter = MODULE_ADAPTERS[mod.id];
        const params = allModuleParams[mod.id];
        const effectiveMode = Boolean(params.quickMode) ? 'quick' : 'full';
        const tasks = adapter.buildTasks(params, effectiveMode);

        setBatchProgress({
          currentIdx: idx + 1,
          total: MODULES.length,
          moduleTitle: mod.title,
          elapsedSec: (performance.now() - batchStart) / 1000,
        });

        const t0 = performance.now();
        const outputs = await runWorkerPool<unknown, unknown>({
          createWorker: () => adapter.createWorker(),
          payloads: tasks,
          signal: ctrl.signal,
          label: `Module ${mod.number}: ${mod.shortTitle}`,
          onProgress: (upd) => {
            setProgress(upd);
            setBatchProgress({
              currentIdx: idx + 1,
              total: MODULES.length,
              moduleTitle: mod.title,
              elapsedSec: (performance.now() - batchStart) / 1000,
            });
          },
        });

        const elapsedMs = performance.now() - t0;
        const bundle = adapter.assembleResults(params, outputs, elapsedMs, false);

        setProject((prev) => ({
          ...prev,
          moduleResults: { ...prev.moduleResults, [mod.id]: bundle },
        }));

        const entry: RunHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: timeStampNow(),
          seed: bundle.meta.seed,
          elapsedMs,
          mode: effectiveMode,
          figureCount: bundle.figures.length,
          verifyPassed: bundle.verification ? bundle.verification.passed : null,
          params: { ...params },
        };
        setRunHistory((prev) => ({
          ...prev,
          [mod.id]: [entry, ...(prev[mod.id] ?? [])].slice(0, 15),
        }));
      }

      if (!ctrl.signal.aborted) {
        appendLog(
          'success',
          `Batch complete: all 8 modules simulated in ${((performance.now() - batchStart) / 1000).toFixed(1)}s. Suite PPTX/DOCX/ZIP ready.`,
        );
      }
    } catch (err) {
      if (err instanceof SimulationCancelledError) {
        appendLog('warn', 'Batch run cancelled by user.');
      } else {
        appendLog(
          'error',
          `Batch simulation error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } finally {
      abortCtrlRef.current = null;
      setIsRunning(false);
      setProgress(null);
      setBatchProgress(null);
    }
  }, [isRunning, allModuleParams, appendLog]);

  const handleSaveProjectJson = useCallback(() => {
    const snapshot: ProjectStateSnapshot = {
      ...project,
      savedAt: new Date().toISOString(),
      moduleParams: { ...allModuleParams },
    };
    downloadTextFile(
      `wirelesslab_ece441_project_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json',
    );
    appendLog('info', 'Project saved to JSON file.');
  }, [project, allModuleParams, appendLog]);

  const handleLoadProjectTrigger = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoadProjectFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as Partial<ProjectStateSnapshot>;
          setProject((prev) => ({
            ...prev,
            teamMembers: parsed.teamMembers ?? prev.teamMembers,
            reportReferences: parsed.reportReferences ?? prev.reportReferences,
            discussionNotes: parsed.discussionNotes ?? prev.discussionNotes,
            moduleParams: parsed.moduleParams ?? prev.moduleParams,
            moduleResults: parsed.moduleResults ?? prev.moduleResults,
          }));
          if (parsed.moduleParams) {
            setAllModuleParams(buildInitialParams(parsed.moduleParams));
          }
          appendLog('success', `Loaded project from ${file.name}.`);
        } catch (err) {
          appendLog(
            'error',
            `Failed to load project JSON: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [appendLog],
  );

  // Listen to optional Electron native desktop menu IPC events
  useEffect(() => {
    const desktop = window.wirelessLabDesktop;
    if (!desktop?.onMenuAction) return;
    return desktop.onMenuAction((action) => {
      if (action === 'save-project') handleSaveProjectJson();
      else if (action === 'load-project') handleLoadProjectTrigger();
      else if (action === 'export-report') {
        setReportSuiteMode(!activeModule);
        setReportModalOpen(true);
      } else if (action === 'toggle-theme') {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
      } else if (action === 'about') {
        setAboutState({ open: true, tab: 'about' });
      }
    });
  }, [activeModule, handleSaveProjectJson, handleLoadProjectTrigger]);

  // E3: Pin current figure traces as dotted reference overlay
  const handlePinFigure = useCallback(
    (moduleId: ModuleId, fig: FigureSpec) => {
      const key = `${moduleId}:${fig.id}`;
      const seed = Number(allModuleParams[moduleId]?.seed ?? 0);
      const dottedTraces: Plotly.Data[] = fig.traces
        .filter((tr) => !tr.type || tr.type === 'scatter')
        .slice(0, 4)
        .map((tr) => {
          const sc = tr as Partial<Plotly.PlotData>;
          return {
            ...sc,
            name: `${sc.name ?? 'Ref'} [Pinned]`,
            mode: 'lines',
            opacity: 0.65,
            line: {
              ...(sc.line ?? {}),
              dash: 'dot',
              width: 2,
            },
            error_y: undefined,
          } as Plotly.Data;
        });
      setPinnedByFigure((prev) => ({
        ...prev,
        [key]: {
          label: `Seed ${seed} @ ${timeStampNow()}`,
          traces: dottedTraces,
        },
      }));
      appendLog('info', `Pinned "${fig.shortTitle}" reference curves (seed=${seed}).`);
    },
    [allModuleParams, appendLog],
  );

  const handleClearPinnedFigure = useCallback((key: string) => {
    setPinnedByFigure((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const activeDescriptor = activeModule ? getModuleDescriptor(activeModule) : null;
  const activeBundle = activeModule ? project.moduleResults[activeModule] ?? null : null;
  const activeAdapter = activeModule ? MODULE_ADAPTERS[activeModule] : null;
  const activeParams = activeModule ? allModuleParams[activeModule] : null;

  // Build modules list for ReportModal (single module OR complete Suite Report)
  const reportModules = useMemo(() => {
    const idsToCheck: ModuleId[] = reportSuiteMode
      ? MODULES.map((m) => m.id)
      : activeModule
        ? [activeModule]
        : [];
    const list: Array<{
      descriptor: ReturnType<typeof getModuleDescriptor>;
      theory: (typeof MODULE_ADAPTERS)[ModuleId]['theory'];
      results: ModuleResultBundle;
      params: Record<string, unknown>;
    }> = [];
    for (const id of idsToCheck) {
      const b = project.moduleResults[id];
      if (b && b.figures.length > 0) {
        list.push({
          descriptor: getModuleDescriptor(id),
          theory: MODULE_ADAPTERS[id].theory,
          results: b,
          params: allModuleParams[id],
        });
      }
    }
    return list;
  }, [reportSuiteMode, activeModule, project.moduleResults, allModuleParams]);

  const activeDiscussionKey = reportSuiteMode ? 'suite' : activeModule ?? 'suite';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleLoadProjectFile}
      />

      {!activeModule && (
        <HomeDashboard
          moduleResults={project.moduleResults}
          isDark={theme === 'dark'}
          locale={locale}
          batchProgress={batchProgress}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onToggleLocale={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
          onOpenModule={(id) => setActiveModule(id)}
          onRunAllModules={() => void runAllModulesBatch()}
          onStopBatchRun={handleStop}
          onResetAllModules={handleResetAllModules}
          onResetSingleModule={handleResetSingleModule}
          onOpenCalculator={() => setCalculatorOpen(true)}
          onSaveProject={handleSaveProjectJson}
          onLoadProject={handleLoadProjectTrigger}
          onExportSuiteReport={() => {
            setReportSuiteMode(true);
            setReportModalOpen(true);
          }}
          onOpenRegression={() => setRegressionModalOpen(true)}
          onOpenAbout={(tab) => setAboutState({ open: true, tab })}
        />
      )}

      {activeModule && activeDescriptor && activeAdapter && activeParams && (
        <ModuleWorkspace
          descriptor={activeDescriptor}
          params={activeParams}
          onChangeParams={(next) =>
            setAllModuleParams((prev) => ({ ...prev, [activeModule]: next }))
          }
          results={activeBundle}
          runHistory={runHistory[activeModule] ?? []}
          onRestoreHistory={(entry) => {
            setAllModuleParams((prev) => ({
              ...prev,
              [activeModule]: { ...activeAdapter.defaultParams, ...entry.params },
            }));
            appendLog(
              'info',
              `Restored parameters from ${entry.timestamp} (seed=${entry.seed}).`,
            );
          }}
          pinnedByFigure={pinnedByFigure}
          onPinFigure={(fig) => handlePinFigure(activeModule, fig)}
          onClearPinnedFigure={handleClearPinnedFigure}
          isDark={theme === 'dark'}
          locale={locale}
          isRunning={isRunning}
          progress={progress}
          consoleEntries={consoleEntries}
          paramsPanel={activeAdapter.renderParamsPanel(
            activeParams,
            (next) =>
              setAllModuleParams((prev) => ({ ...prev, [activeModule]: next })),
            isRunning,
          )}
          theoryPanel={activeAdapter.renderTheory()}
          onBackHome={() => setActiveModule(null)}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onToggleLocale={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
          onRun={() =>
            void runModule(
              activeModule,
              Boolean(activeParams.quickMode) ? 'quick' : 'full',
            )
          }
          onRunAll={() => void runModule(activeModule, 'full')}
          onStop={handleStop}
          onResetDefaults={() => {
            setAllModuleParams((prev) => ({
              ...prev,
              [activeModule]: { ...activeAdapter.defaultParams },
            }));
            appendLog('info', `Module ${activeDescriptor.number} parameters reset to defaults.`);
          }}
          onResetModuleResults={() => handleResetSingleModule(activeModule)}
          onSelfTest={() => void runModule(activeModule, 'selftest')}
          onExportPython={() => {
            const { filename, content } = generatePythonScript(activeModule, activeParams);
            downloadTextFile(filename, content, 'text/x-python;charset=utf-8;');
            appendLog('info', `Exported reproducible Python script: ${filename}`);
          }}
          onExportMatlab={() => {
            const { filename, content } = generateMatlabScript(activeModule, activeParams);
            downloadTextFile(filename, content, 'text/plain;charset=utf-8;');
            appendLog('info', `Exported reproducible MATLAB script: ${filename}`);
          }}
          onSaveProject={handleSaveProjectJson}
          onLoadProject={handleLoadProjectTrigger}
          onOpenPresentation={() => setPresentationOpen(true)}
          onOpenReport={() => {
            setReportSuiteMode(false);
            setReportModalOpen(true);
          }}
          onOpenRegression={() => setRegressionModalOpen(true)}
          onOpenCalculator={() => setCalculatorOpen(true)}
          onOpenHelp={() => setAboutState({ open: true, tab: 'help' })}
          onClearConsole={() => setConsoleEntries([])}
        />
      )}

      {/* Presentation Mode Overlay */}
      {presentationOpen && activeDescriptor && activeBundle && activeBundle.figures.length > 0 && (
        <PresentationMode
          moduleTitle={`Module ${activeDescriptor.number}: ${activeDescriptor.title}`}
          figures={activeBundle.figures}
          onClose={() => setPresentationOpen(false)}
        />
      )}

      {/* Report Export Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportTitle={
          reportSuiteMode
            ? 'WirelessLab ECE441 — Complete Simulation Suite Report'
            : activeDescriptor
              ? `Module ${activeDescriptor.number}: ${activeDescriptor.title}`
              : 'WirelessLab ECE441 Report'
        }
        modulesToExport={reportModules}
        teamMembers={project.teamMembers}
        onChangeTeamMembers={(teamMembers) =>
          setProject((prev) => ({ ...prev, teamMembers }))
        }
        references={project.reportReferences}
        onChangeReferences={(reportReferences) =>
          setProject((prev) => ({ ...prev, reportReferences }))
        }
        discussionText={project.discussionNotes[activeDiscussionKey] ?? ''}
        onChangeDiscussionText={(text) =>
          setProject((prev) => ({
            ...prev,
            discussionNotes: { ...prev.discussionNotes, [activeDiscussionKey]: text },
          }))
        }
      />

      {/* Golden-Results Regression Check Modal (T1.4) */}
      <RegressionModal
        isOpen={regressionModalOpen}
        onClose={() => setRegressionModalOpen(false)}
        focusModuleId={activeModule}
      />

      {/* Wireless Engineering Design Calculator Modal (T2.4) */}
      <CalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      {/* About & Help Modal */}
      <AboutModal
        isOpen={aboutState.open}
        initialTab={aboutState.tab}
        onClose={() => setAboutState((s) => ({ ...s, open: false }))}
        teamMembers={project.teamMembers}
        onChangeTeamMembers={(teamMembers) =>
          setProject((prev) => ({ ...prev, teamMembers }))
        }
      />
    </>
  );
}
