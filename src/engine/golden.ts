import type { ModuleId } from '../types/simulation';
import goldenJson from './goldenResults.json';
import {
  ALL_MODULE_IDS,
  computeModuleGoldenSnapshot,
  type GoldenMetricSample,
  type ModuleGoldenSnapshot,
} from './goldenRunner';

export { ALL_MODULE_IDS };

export interface GoldenDriftRow {
  moduleId: ModuleId;
  key: string;
  label: string;
  unit: string;
  golden: number;
  actual: number;
  absDrift: number;
  relDrift: number;
  relTolerance: number;
  passed: boolean;
}

export interface ModuleRegressionReport {
  moduleId: ModuleId;
  seed: number;
  elapsedMs: number;
  passed: boolean;
  verificationPassed: boolean;
  maxRelDrift: number;
  rows: GoldenDriftRow[];
}

export interface SuiteRegressionReport {
  timestamp: string;
  totalElapsedMs: number;
  passedModules: number;
  totalModules: number;
  passedMetrics: number;
  totalMetrics: number;
  maxRelDrift: number;
  allPassed: boolean;
  modules: ModuleRegressionReport[];
}

interface GoldenFileSchema {
  schemaVersion: string;
  generatedAt: string;
  description: string;
  modules: Record<ModuleId, ModuleGoldenSnapshot>;
}

const GOLDEN_DATA = goldenJson as unknown as GoldenFileSchema;

export function getGoldenBaseline(moduleId: ModuleId): ModuleGoldenSnapshot {
  return GOLDEN_DATA.modules[moduleId];
}

export function compareAgainstGolden(
  moduleId: ModuleId,
  actualSnapshot: ModuleGoldenSnapshot,
  elapsedMs: number,
): ModuleRegressionReport {
  const baseline = getGoldenBaseline(moduleId);
  const actualByKey = new Map<string, GoldenMetricSample>(
    actualSnapshot.metrics.map((m) => [m.key, m]),
  );

  const rows: GoldenDriftRow[] = baseline.metrics.map((expected) => {
    const found = actualByKey.get(expected.key);
    const actualVal = found ? found.value : Number.NaN;
    const absDrift = Number.isFinite(actualVal)
      ? Math.abs(actualVal - expected.value)
      : Number.POSITIVE_INFINITY;
    const denom = Math.max(Math.abs(expected.value), expected.absTolerance);
    const relDrift = Number.isFinite(absDrift) ? absDrift / denom : Number.POSITIVE_INFINITY;
    const passed =
      Number.isFinite(actualVal) &&
      (absDrift <= expected.absTolerance || relDrift <= expected.relTolerance);

    return {
      moduleId,
      key: expected.key,
      label: expected.label,
      unit: expected.unit,
      golden: expected.value,
      actual: actualVal,
      absDrift,
      relDrift,
      relTolerance: expected.relTolerance,
      passed,
    };
  });

  const maxRelDrift = rows.reduce(
    (mx, r) => (Number.isFinite(r.relDrift) ? Math.max(mx, r.relDrift) : mx),
    0,
  );
  const passed = actualSnapshot.verificationPassed && rows.every((r) => r.passed);

  return {
    moduleId,
    seed: actualSnapshot.seed,
    elapsedMs,
    passed,
    verificationPassed: actualSnapshot.verificationPassed,
    maxRelDrift,
    rows,
  };
}

/**
 * Run deterministic golden regression check for a single module.
 */
export function runModuleGoldenRegression(moduleId: ModuleId): ModuleRegressionReport {
  const t0 = performance.now();
  const actual = computeModuleGoldenSnapshot(moduleId);
  const elapsedMs = performance.now() - t0;
  return compareAgainstGolden(moduleId, actual, elapsedMs);
}

/**
 * Run golden regression check across all 8 modules synchronously (suitable for Vitest).
 */
export function runAllGoldenRegressions(): SuiteRegressionReport {
  const t0 = performance.now();
  const modules = ALL_MODULE_IDS.map((id) => runModuleGoldenRegression(id));
  return summarizeSuiteRegression(modules, performance.now() - t0);
}

/**
 * Run golden regression check across all 8 modules asynchronously (yielding between modules
 * so browser UI updates progress smoothly without freezing).
 */
export async function runAllGoldenRegressionsAsync(
  onModuleDone?: (report: ModuleRegressionReport, index: number, total: number) => void,
): Promise<SuiteRegressionReport> {
  const t0 = performance.now();
  const reports: ModuleRegressionReport[] = [];
  for (let i = 0; i < ALL_MODULE_IDS.length; i++) {
    const id = ALL_MODULE_IDS[i];
    await new Promise<void>((resolve) => setTimeout(resolve, 12));
    const rep = runModuleGoldenRegression(id);
    reports.push(rep);
    onModuleDone?.(rep, i + 1, ALL_MODULE_IDS.length);
  }
  return summarizeSuiteRegression(reports, performance.now() - t0);
}

function summarizeSuiteRegression(
  modules: ModuleRegressionReport[],
  totalElapsedMs: number,
): SuiteRegressionReport {
  const passedModules = modules.filter((m) => m.passed).length;
  const totalMetrics = modules.reduce((a, m) => a + m.rows.length, 0);
  const passedMetrics = modules.reduce(
    (a, m) => a + m.rows.filter((r) => r.passed).length,
    0,
  );
  const maxRelDrift = modules.reduce((mx, m) => Math.max(mx, m.maxRelDrift), 0);

  return {
    timestamp: new Date().toISOString(),
    totalElapsedMs,
    passedModules,
    totalModules: modules.length,
    passedMetrics,
    totalMetrics,
    maxRelDrift,
    allPassed: passedModules === modules.length && passedMetrics === totalMetrics,
    modules,
  };
}
