/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import { runModule5Task, type Module5Task, type Module5TaskOutput } from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module5Task>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = runModule5Task(payload);
    const response: WorkerTaskResponse<Module5TaskOutput> = { taskId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module5TaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
