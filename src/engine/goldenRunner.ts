import { computeExpectedReferenceValues } from '../export/codeExporter';
import {
  DEFAULT_MODULE1_PARAMS,
  assembleModule1Results,
  buildModule1Tasks,
  runModule1Task,
} from '../modules/module1/model';
import {
  DEFAULT_MODULE2_PARAMS,
  assembleModule2Results,
  buildModule2Tasks,
  simulateDiversityPoint,
  type Module2WorkerTaskOutput,
} from '../modules/module2/model';
import {
  DEFAULT_MODULE3_PARAMS,
  assembleModule3Results,
  buildModule3Tasks,
  simulateOfdmPoint,
  type Module3WorkerTaskOutput,
} from '../modules/module3/model';
import {
  DEFAULT_MODULE4_PARAMS,
  assembleModule4Results,
  buildModule4Tasks,
  runModule4Task,
} from '../modules/module4/model';
import {
  DEFAULT_MODULE5_PARAMS,
  assembleModule5Results,
  buildModule5Tasks,
  runModule5Task,
} from '../modules/module5/model';
import {
  DEFAULT_MODULE6_PARAMS,
  assembleModule6Results,
  buildModule6Tasks,
  runModule6Task,
} from '../modules/module6/model';
import {
  DEFAULT_MODULE7_PARAMS,
  assembleModule7Results,
  buildModule7Tasks,
  simulateMimoPoint,
  type Module7WorkerTaskOutput,
} from '../modules/module7/model';
import {
  DEFAULT_MODULE8_PARAMS,
  assembleModule8Results,
  buildModule8Tasks,
  runModule8Task,
} from '../modules/module8/model';
import type { ModuleId, ModuleResultBundle } from '../types/simulation';

export interface GoldenMetricSample {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Maximum allowed relative drift (e.g., 0.005 = 0.5%) */
  relTolerance: number;
  /** Minimum absolute floor when golden value is near 0 */
  absTolerance: number;
}

export interface ModuleGoldenSnapshot {
  moduleId: ModuleId;
  seed: number;
  verificationPassed: boolean;
  metrics: GoldenMetricSample[];
}

export const ALL_MODULE_IDS: ModuleId[] = [
  'module1',
  'module2',
  'module3',
  'module4',
  'module5',
  'module6',
  'module7',
  'module8',
];

function executeModuleSelfTestSync(moduleId: ModuleId): {
  bundle: ModuleResultBundle;
  defaultParams: Record<string, unknown>;
} {
  const t0 = performance.now();
  switch (moduleId) {
    case 'module1': {
      const p = { ...DEFAULT_MODULE1_PARAMS };
      const tasks = buildModule1Tasks(p, 'selftest').tasks;
      const outputs = tasks.map((t) => runModule1Task(t));
      return {
        bundle: assembleModule1Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module2': {
      const p = { ...DEFAULT_MODULE2_PARAMS };
      const tasks = buildModule2Tasks(p, 'selftest');
      const outputs: Module2WorkerTaskOutput[] = tasks.map((t) => ({
        group: t.group,
        seriesKey: t.seriesKey,
        xValue: t.xValue,
        meta: t.meta,
        result: simulateDiversityPoint(t.config),
      }));
      return {
        bundle: assembleModule2Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module3': {
      const p = { ...DEFAULT_MODULE3_PARAMS };
      const tasks = buildModule3Tasks(p, 'selftest').tasks;
      const outputs: Module3WorkerTaskOutput[] = tasks.map((t) => ({
        group: t.group,
        seriesKey: t.seriesKey,
        xValue: t.xValue,
        result: simulateOfdmPoint(t.config),
      }));
      return {
        bundle: assembleModule3Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module4': {
      const p = { ...DEFAULT_MODULE4_PARAMS };
      const tasks = buildModule4Tasks(p, 'selftest').tasks;
      const outputs = tasks.map((t) => runModule4Task(t));
      return {
        bundle: assembleModule4Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module5': {
      const p = { ...DEFAULT_MODULE5_PARAMS };
      const tasks = buildModule5Tasks(p, 'selftest').tasks;
      const outputs = tasks.map((t) => runModule5Task(t));
      return {
        bundle: assembleModule5Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module6': {
      const p = { ...DEFAULT_MODULE6_PARAMS };
      const tasks = buildModule6Tasks(p, 'selftest').tasks;
      const outputs = tasks.map((t) => runModule6Task(t, p.targetSirDb));
      return {
        bundle: assembleModule6Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module7': {
      const p = { ...DEFAULT_MODULE7_PARAMS };
      const tasks = buildModule7Tasks(p, 'selftest');
      const outputs: Module7WorkerTaskOutput[] = tasks.map((t) => ({
        group: t.group,
        seriesKey: t.seriesKey,
        xValue: t.xValue,
        meta: t.meta,
        result: simulateMimoPoint(t.config),
      }));
      return {
        bundle: assembleModule7Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
    case 'module8': {
      const p = { ...DEFAULT_MODULE8_PARAMS };
      const tasks = buildModule8Tasks(p, 'selftest').tasks;
      const outputs = tasks.map((t) => runModule8Task(t));
      return {
        bundle: assembleModule8Results(p, outputs, performance.now() - t0, true),
        defaultParams: { ...p },
      };
    }
  }
}

/**
 * Execute deterministic default-parameter golden benchmark for a given module.
 * Extracts both deterministic Monte-Carlo simulated points and analytical checkpoints.
 */
export function computeModuleGoldenSnapshot(moduleId: ModuleId): ModuleGoldenSnapshot {
  const { bundle, defaultParams } = executeModuleSelfTestSync(moduleId);
  const metrics: GoldenMetricSample[] = [];

  // 1. Capture first 3 reliable simulated Monte-Carlo verification points (seeded & deterministic)
  const rows = bundle.verification?.rows ?? [];
  const includedRows = rows.filter((r) => r.included);
  const chosenRows = (includedRows.length >= 2 ? includedRows : rows).slice(0, 3);
  chosenRows.forEach((row, idx) => {
    metrics.push({
      key: `SIM_PT_${idx + 1}`,
      label: `Sim: ${row.label}`,
      value: Number(row.simulated.toPrecision(7)),
      unit: '',
      relTolerance: 0.005, // 0.5% tolerance (deterministic PRNG should be 0.000%)
      absTolerance: 1e-6,
    });
  });

  // 2. Capture first 2 analytical reference checkpoints for the default parameters
  const analytical = computeExpectedReferenceValues(moduleId, defaultParams).slice(0, 2);
  analytical.forEach((a) => {
    metrics.push({
      key: `REF_${a.key}`,
      label: a.description,
      value: a.value,
      unit: a.unit,
      relTolerance: 0.001, // 0.1% analytical tolerance
      absTolerance: 1e-6,
    });
  });

  return {
    moduleId,
    seed: Number(defaultParams.seed ?? 0),
    verificationPassed: Boolean(bundle.verification?.passed),
    metrics,
  };
}
