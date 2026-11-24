/// <reference lib="webworker" />

import type { WorkerTaskRequest, WorkerTaskResponse } from '../../engine/workerPool';
import { runModule1Task, type Module1Task, type Module1TaskOutput } from './model';

self.onmessage = (event: MessageEvent<WorkerTaskRequest<Module1Task>>) => {
  const { taskId, payload } = event.data;
  try {
    const result = runModule1Task(payload);
    const response: WorkerTaskResponse<Module1TaskOutput> = { taskId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerTaskResponse<Module1TaskOutput> = {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
