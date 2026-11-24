/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import {
  simulateDiversityPoint,
  type Module2WorkerTask,
  type Module2WorkerTaskOutput,
} from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module2WorkerTask>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = simulateDiversityPoint(payload.config);
    const out: Module2WorkerTaskOutput = {
      group: payload.group,
      seriesKey: payload.seriesKey,
      xValue: payload.xValue,
      meta: payload.meta,
      result,
    };
    const response: WorkerTaskResponse<Module2WorkerTaskOutput> = { taskId, result: out };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module2WorkerTaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
