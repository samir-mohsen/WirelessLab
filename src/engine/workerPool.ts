/**
 * Browser Web Worker Pool with clean cancellation, ETA reporting, and deterministic task ordering.
 * Uses navigator.hardwareConcurrency - 1 workers by default so the UI never freezes.
 */

export class SimulationCancelledError extends Error {
  constructor(message = 'Simulation cancelled by user') {
    super(message);
    this.name = 'SimulationCancelledError';
  }
}

export interface ProgressUpdate {
  completed: number;
  total: number;
  fraction: number;
  elapsedMs: number;
  etaMs: number | null;
  label: string;
}

export function getDefaultWorkerCount(): number {
  if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') {
    return Math.max(1, Math.min(8, navigator.hardwareConcurrency - 1));
  }
  return 2;
}

export interface WorkerTaskRequest<TPayload> {
  taskId: number;
  payload: TPayload;
}

export interface WorkerTaskResponse<TResult> {
  taskId: number;
  result?: TResult;
  error?: string;
}

/**
 * Execute an array of independent task payloads across a pool of Web Workers.
 * Results are returned in the exact input order of `payloads`, ensuring determinism
 * regardless of worker count or scheduling order.
 */
export async function runWorkerPool<TPayload, TResult>(options: {
  createWorker: () => Worker;
  payloads: TPayload[];
  workerCount?: number;
  signal?: AbortSignal;
  label?: string;
  onProgress?: (update: ProgressUpdate) => void;
}): Promise<TResult[]> {
  const { payloads, createWorker, signal, label = 'Running simulation', onProgress } = options;
  const total = payloads.length;
  if (total === 0) return [];
  if (signal?.aborted) throw new SimulationCancelledError();

  const numWorkers = Math.max(1, Math.min(options.workerCount ?? getDefaultWorkerCount(), total));
  const results = new Array<TResult>(total);
  const startTime = performance.now();

  let nextIdx = 0;
  let completed = 0;
  let settled = false;

  return new Promise<TResult[]>((resolve, reject) => {
    const workers: Worker[] = [];

    const cleanup = () => {
      for (const w of workers) {
        try {
          w.terminate();
        } catch {
          // ignore
        }
      }
      workers.length = 0;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAbort = () => {
      fail(new SimulationCancelledError());
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const emitProgress = () => {
      if (!onProgress) return;
      const elapsedMs = performance.now() - startTime;
      const fraction = completed / total;
      const etaMs =
        completed > 0 && completed < total ? (elapsedMs / completed) * (total - completed) : 0;
      onProgress({ completed, total, fraction, elapsedMs, etaMs, label });
    };

    const dispatchNext = (worker: Worker) => {
      if (settled) return;
      if (nextIdx >= total) return;
      const taskId = nextIdx++;
      const msg: WorkerTaskRequest<TPayload> = {
        taskId,
        payload: payloads[taskId],
      };
      worker.postMessage(msg);
    };

    emitProgress();

    for (let wIdx = 0; wIdx < numWorkers; wIdx++) {
      let worker: Worker;
      try {
        worker = createWorker();
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      workers.push(worker);

      worker.onmessage = (event: MessageEvent<WorkerTaskResponse<TResult>>) => {
        if (settled) return;
        const { taskId, result, error } = event.data;
        if (error) {
          fail(new Error(error));
          return;
        }
        results[taskId] = result as TResult;
        completed++;
        emitProgress();

        if (completed >= total) {
          settled = true;
          cleanup();
          resolve(results);
        } else {
          dispatchNext(worker);
        }
      };

      worker.onerror = (ev) => {
        fail(new Error(ev.message || 'Web Worker execution error'));
      };

      dispatchNext(worker);
    }
  });
}

/**
 * Pure deterministic chunk splitter for unit-testing worker-count invariance in Node/Vitest.
 * Splits `totalTrials` into `numChunks` contiguous ranges [start, end).
 */
export function partitionTrialRange(
  totalTrials: number,
  numChunks: number,
): Array<{ start: number; count: number }> {
  const k = Math.max(1, Math.min(numChunks, totalTrials));
  const chunks: Array<{ start: number; count: number }> = [];
  const base = Math.floor(totalTrials / k);
  const rem = totalTrials % k;
  let offset = 0;
  for (let i = 0; i < k; i++) {
    const count = base + (i < rem ? 1 : 0);
    chunks.push({ start: offset, count });
    offset += count;
  }
  return chunks;
}
