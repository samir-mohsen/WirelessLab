/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import {
  simulateOfdmPoint,
  type Module3WorkerTask,
  type Module3WorkerTaskOutput,
} from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module3WorkerTask>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = simulateOfdmPoint(payload.config);
    const out: Module3WorkerTaskOutput = {
      group: payload.group,
      seriesKey: payload.seriesKey,
      xValue: payload.xValue,
      result,
    };
    const response: WorkerTaskResponse<Module3WorkerTaskOutput> = {
      taskId,
      result: out,
    };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module3WorkerTaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
