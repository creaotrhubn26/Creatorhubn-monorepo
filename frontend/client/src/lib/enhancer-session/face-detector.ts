/**
 * Tiny concurrency-limited queue for face detection.
 *
 * Face detection hits a backend route that runs on a shared model
 * runtime. Firing it per-image on upload would saturate the runner in a
 * 500-image session, so this queue caps the parallel jobs. When slots
 * are full, incoming jobs wait FIFO.
 *
 * No React dependency — testable in isolation. The hook layer above this
 * (useEnhancerSession) wires the queue to dispatch actions.
 */

export interface FaceDetectorJob<T> {
  key: string;
  run: () => Promise<T>;
}

type PendingResolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export interface FaceDetectionQueue<T> {
  enqueue: (job: FaceDetectorJob<T>) => Promise<T>;
  size: () => number;
  inFlight: () => number;
  cancelPending: (key?: string) => void;
}

export function createFaceDetectionQueue<T>(concurrency = 3): FaceDetectionQueue<T> {
  const queue: Array<{ job: FaceDetectorJob<T>; resolver: PendingResolver<T> }> = [];
  const keyed = new Map<string, Promise<T>>();
  let active = 0;

  async function pump(): Promise<void> {
    while (active < concurrency && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      active += 1;
      (async () => {
        try {
          const result = await next.job.run();
          next.resolver.resolve(result);
        } catch (err) {
          next.resolver.reject(err);
        } finally {
          active -= 1;
          keyed.delete(next.job.key);
          void pump();
        }
      })();
    }
  }

  return {
    enqueue(job) {
      const existing = keyed.get(job.key);
      if (existing) return existing;
      const promise = new Promise<T>((resolve, reject) => {
        queue.push({ job, resolver: { resolve, reject } });
        void pump();
      });
      keyed.set(job.key, promise);
      return promise;
    },
    size() {
      return queue.length + active;
    },
    inFlight() {
      return active;
    },
    cancelPending(key) {
      if (!key) {
        queue.splice(0, queue.length);
        return;
      }
      const idx = queue.findIndex((entry) => entry.job.key === key);
      if (idx >= 0) {
        const [removed] = queue.splice(idx, 1);
        removed.resolver.reject(new Error('face_detection_cancelled'));
        keyed.delete(key);
      }
    },
  };
}
