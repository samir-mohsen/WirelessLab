import React from 'react';
import {
  DEFAULT_MODULE1_PARAMS,
  MODULE1_THEORY,
  assembleModule1Results,
  buildModule1Tasks,
  type Module1Params,
  type Module1Task,
  type Module1TaskOutput,
} from './module1/model';
import { Module1Theory } from './module1/theory';
import { Module1ParamsPanel } from './module1/ui';

import {
  DEFAULT_MODULE2_PARAMS,
  MODULE2_THEORY,
  assembleModule2Results,
  buildModule2Tasks,
  type Module2Params,
  type Module2WorkerTask,
  type Module2WorkerTaskOutput,
} from './module2/model';
import { Module2Theory } from './module2/theory';
import { Module2ParamsPanel } from './module2/ui';

import {
  DEFAULT_MODULE3_PARAMS,
  MODULE3_THEORY,
  assembleModule3Results,
  buildModule3Tasks,
  type Module3Params,
  type Module3WorkerTask,
  type Module3WorkerTaskOutput,
} from './module3/model';
import { Module3Theory } from './module3/theory';
import { Module3ParamsPanel } from './module3/ui';

import {
  DEFAULT_MODULE4_PARAMS,
  MODULE4_THEORY,
  assembleModule4Results,
  buildModule4Tasks,
  type Module4Params,
  type Module4Task,
  type Module4TaskOutput,
} from './module4/model';
import { Module4Theory } from './module4/theory';
import { Module4ParamsPanel } from './module4/ui';

import {
  DEFAULT_MODULE5_PARAMS,
  MODULE5_THEORY,
  assembleModule5Results,
  buildModule5Tasks,
  type Module5Params,
  type Module5Task,
  type Module5TaskOutput,
} from './module5/model';
import { Module5Theory } from './module5/theory';
import { Module5ParamsPanel } from './module5/ui';

import {
  DEFAULT_MODULE6_PARAMS,
  MODULE6_THEORY,
  assembleModule6Results,
  buildModule6Tasks,
  type Module6Params,
  type Module6Task,
  type Module6TaskOutput,
} from './module6/model';
import { Module6Theory } from './module6/theory';
import { Module6ParamsPanel } from './module6/ui';

import {
  DEFAULT_MODULE7_PARAMS,
  MODULE7_THEORY,
  assembleModule7Results,
  buildModule7Tasks,
  type Module7Params,
  type Module7WorkerTask,
  type Module7WorkerTaskOutput,
} from './module7/model';
import { Module7Theory } from './module7/theory';
import { Module7ParamsPanel } from './module7/ui';

import {
  DEFAULT_MODULE8_PARAMS,
  MODULE8_THEORY,
  assembleModule8Results,
  buildModule8Tasks,
  type Module8Params,
  type Module8Task,
  type Module8TaskOutput,
} from './module8/model';
import { Module8Theory } from './module8/theory';
import { Module8ParamsPanel } from './module8/ui';

import type {
  ModuleId,
  ModuleResultBundle,
  ModuleTheoryContent,
} from '../types/simulation';

export type AnyParams = Record<string, unknown>;

export interface ModuleAdapter {
  id: ModuleId;
  defaultParams: AnyParams;
  theory: ModuleTheoryContent;
  createWorker: () => Worker;
  buildTasks: (params: AnyParams, mode: 'full' | 'quick' | 'selftest') => unknown[];
  assembleResults: (
    params: AnyParams,
    outputs: unknown[],
    elapsedMs: number,
    selfTestOnly: boolean,
  ) => ModuleResultBundle;
  renderParamsPanel: (
    params: AnyParams,
    onChange: (next: AnyParams) => void,
    disabled: boolean,
  ) => React.ReactNode;
  renderTheory: () => React.ReactNode;
  formatRunStartLog: (params: AnyParams, mode: string, taskCount: number) => string;
}

export const MODULE_ADAPTERS: Record<ModuleId, ModuleAdapter> = {
  module1: {
    id: 'module1',
    defaultParams: { ...DEFAULT_MODULE1_PARAMS },
    theory: MODULE1_THEORY,
    createWorker: () =>
      new Worker(new URL('./module1/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule1Tasks(p as unknown as Module1Params, mode).tasks,
    assembleResults: (p, out, ms, st) =>
      assembleModule1Results(p as unknown as Module1Params, out as Module1TaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module1ParamsPanel
        params={p as unknown as Module1Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module1Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 1 [${mode.toUpperCase()}] — ${p.freqLowMHz}/${p.freqHighMHz} MHz, n=${p.pathLossExp}, σ=${p.shadowSigmaDb} dB, seed=${p.seed}, tasks=${n}`,
  },

  module2: {
    id: 'module2',
    defaultParams: { ...DEFAULT_MODULE2_PARAMS },
    theory: MODULE2_THEORY,
    createWorker: () =>
      new Worker(new URL('./module2/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule2Tasks(p as unknown as Module2Params, mode),
    assembleResults: (p, out, ms, st) =>
      assembleModule2Results(p as unknown as Module2Params, out as Module2WorkerTaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module2ParamsPanel
        params={p as unknown as Module2Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module2Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 2 [${mode.toUpperCase()}] — L=${p.diversityOrder}, SNR=${p.snrMinDb}..${p.snrMaxDb} dB, th=${p.outageThresholdDb} dB, seed=${p.seed}, tasks=${n}`,
  },

  module3: {
    id: 'module3',
    defaultParams: { ...DEFAULT_MODULE3_PARAMS },
    theory: MODULE3_THEORY,
    createWorker: () =>
      new Worker(new URL('./module3/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule3Tasks(p as unknown as Module3Params, mode).tasks,
    assembleResults: (p, out, ms, st) =>
      assembleModule3Results(
        p as unknown as Module3Params,
        out as Module3WorkerTaskOutput[],
        ms,
        st,
      ),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module3ParamsPanel
        params={p as unknown as Module3Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module3Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 3 [${mode.toUpperCase()}] — mod=${p.modulation}, N=${p.nSubcarriers}, L=${p.channelTaps}, eq=${p.equalizer}, seed=${p.seed}, tasks=${n}`,
  },

  module4: {
    id: 'module4',
    defaultParams: { ...DEFAULT_MODULE4_PARAMS },
    theory: MODULE4_THEORY,
    createWorker: () =>
      new Worker(new URL('./module4/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule4Tasks(p as unknown as Module4Params, mode).tasks,
    assembleResults: (p, out, ms, st) =>
      assembleModule4Results(p as unknown as Module4Params, out as Module4TaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module4ParamsPanel
        params={p as unknown as Module4Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module4Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 4 [${mode.toUpperCase()}] — SF=${p.sf}, code=${p.codeType}, J/S=${p.jammerJsDb} dB, seed=${p.seed}, tasks=${n}`,
  },

  module5: {
    id: 'module5',
    defaultParams: { ...DEFAULT_MODULE5_PARAMS },
    theory: MODULE5_THEORY,
    createWorker: () =>
      new Worker(new URL('./module5/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule5Tasks(p as unknown as Module5Params, mode).tasks,
    assembleResults: (p, out, ms, st) =>
      assembleModule5Results(p as unknown as Module5Params, out as Module5TaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module5ParamsPanel
        params={p as unknown as Module5Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module5Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 5 [${mode.toUpperCase()}] — K=${p.numUsersK}, SF=${p.sf}, NFR=${p.nearFarDb} dB, σ_pc=${p.pcErrorSigmaDb} dB, seed=${p.seed}, tasks=${n}`,
  },

  module6: {
    id: 'module6',
    defaultParams: { ...DEFAULT_MODULE6_PARAMS },
    theory: MODULE6_THEORY,
    createWorker: () =>
      new Worker(new URL('./module6/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => {
      const m6 = p as unknown as Module6Params;
      return buildModule6Tasks(m6, mode).tasks.map((t) => ({
        ...t,
        targetSirDb: m6.targetSirDb,
      }));
    },
    assembleResults: (p, out, ms, st) =>
      assembleModule6Results(p as unknown as Module6Params, out as Module6TaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module6ParamsPanel
        params={p as unknown as Module6Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module6Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 6 [${mode.toUpperCase()}] — R=${p.cellRadiusM} m, n=${p.pathLossExp}, shadow=${p.shadowingEnabled ? `${p.shadowSigmaDb}dB` : 'off'}, seed=${p.seed}, tasks=${n}`,
  },

  module7: {
    id: 'module7',
    defaultParams: { ...DEFAULT_MODULE7_PARAMS },
    theory: MODULE7_THEORY,
    createWorker: () =>
      new Worker(new URL('./module7/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule7Tasks(p as unknown as Module7Params, mode),
    assembleResults: (p, out, ms, st) =>
      assembleModule7Results(p as unknown as Module7Params, out as Module7WorkerTaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module7ParamsPanel
        params={p as unknown as Module7Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module7Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 7 [${mode.toUpperCase()}] — SNR=${p.snrMinDb}..${p.snrMaxDb} dB, trials=${p.numRealizations}, ρ=(${p.corrTx},${p.corrRx}), seed=${p.seed}, tasks=${n}`,
  },

  module8: {
    id: 'module8',
    defaultParams: { ...DEFAULT_MODULE8_PARAMS },
    theory: MODULE8_THEORY,
    createWorker: () =>
      new Worker(new URL('./module8/worker.ts', import.meta.url), { type: 'module' }),
    buildTasks: (p, mode) => buildModule8Tasks(p as unknown as Module8Params, mode).tasks,
    assembleResults: (p, out, ms, st) =>
      assembleModule8Results(p as unknown as Module8Params, out as Module8TaskOutput[], ms, st),
    renderParamsPanel: (p, onChange, disabled) => (
      <Module8ParamsPanel
        params={p as unknown as Module8Params}
        onChange={(next) => onChange({ ...next })}
        disabled={disabled}
      />
    ),
    renderTheory: () => <Module8Theory />,
    formatRunStartLog: (p, mode, n) =>
      `Module 8 [${mode.toUpperCase()}] — K=${p.numUsersK}, B=${p.bandwidthMHz} MHz, N_sc=${p.nSubcarriers}, frames=${p.realizations}, seed=${p.seed}, tasks=${n}`,
  },
};

export function buildAllDefaultParams(): Record<ModuleId, AnyParams> {
  return {
    module1: { ...DEFAULT_MODULE1_PARAMS },
    module2: { ...DEFAULT_MODULE2_PARAMS },
    module3: { ...DEFAULT_MODULE3_PARAMS },
    module4: { ...DEFAULT_MODULE4_PARAMS },
    module5: { ...DEFAULT_MODULE5_PARAMS },
    module6: { ...DEFAULT_MODULE6_PARAMS },
    module7: { ...DEFAULT_MODULE7_PARAMS },
    module8: { ...DEFAULT_MODULE8_PARAMS },
  };
}

// Re-export task types for type hygiene
export type AnyWorkerTask =
  | Module1Task
  | Module2WorkerTask
  | Module3WorkerTask
  | Module4Task
  | Module5Task
  | Module6Task
  | Module7WorkerTask
  | Module8Task;
