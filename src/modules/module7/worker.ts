/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import {
  simulateMimoPoint,
  type Module7WorkerTask,
  type Module7WorkerTaskOutput,
} from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module7WorkerTask>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = simulateMimoPoint(payload.config);
    const out: Module7WorkerTaskOutput = {
      group: payload.group,
      seriesKey: payload.seriesKey,
      xValue: payload.xValue,
      meta: payload.meta,
      result,
    };
    const response: WorkerTaskResponse<Module7WorkerTaskOutput> = { taskId, result: out };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module7WorkerTaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
