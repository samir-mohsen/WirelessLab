/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import { runModule6Task, type Module6Task, type Module6TaskOutput } from './model';

self.onmessage = (
  event: MessageEvent<WorkerTaskRequest<Module6Task & { targetSirDb?: number }>>,
) => {
  const { taskId, payload } = event.data;
  try {
    const result = runModule6Task(payload, payload.targetSirDb ?? 12);
    const response: WorkerTaskResponse<Module6TaskOutput> = { taskId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module6TaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
