/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import { runModule4Task, type Module4Task, type Module4TaskOutput } from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module4Task>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = runModule4Task(payload);
    const response: WorkerTaskResponse<Module4TaskOutput> = { taskId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module4TaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
