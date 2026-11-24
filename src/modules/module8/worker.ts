/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import { runModule8Task, type Module8Task, type Module8TaskOutput } from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module8Task>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = runModule8Task(payload);
    const response: WorkerTaskResponse<Module8TaskOutput> = { taskId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module8TaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
