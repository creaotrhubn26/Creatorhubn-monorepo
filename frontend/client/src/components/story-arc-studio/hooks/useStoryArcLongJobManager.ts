import { useCallback, useEffect, useRef, useState } from 'react';

export type StoryArcLongJobKind = 'sync' | 'scene' | 'face';

interface PersistedServerJob {
  kind: StoryArcLongJobKind;
  serverJobId: string;
  persistedAt: number;
}

interface PersistedLongJobState {
  jobs: Partial<Record<StoryArcLongJobKind, PersistedServerJob>>;
  updatedAt: number;
}

interface JobRuntime {
  controller: AbortController | null;
  cancelHandler: (() => void) | null;
}

interface RunManagedJobOptions<T> {
  kind: StoryArcLongJobKind;
  task: (context: { signal: AbortSignal; attempt: number }) => Promise<T>;
  maxRetries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  onCancel?: () => void;
}

export type PollResult<TProgress, TResult> =
  | { state: 'running'; progress?: TProgress }
  | { state: 'completed'; result: TResult }
  | { state: 'failed'; error?: string };

interface StartPollingJobOptions<TProgress, TResult> {
  kind: StoryArcLongJobKind;
  serverJobId: string;
  poll: (serverJobId: string, signal: AbortSignal) => Promise<PollResult<TProgress, TResult>>;
  intervalMs?: number;
  maxConsecutivePollErrors?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onProgress?: (progress: TProgress | undefined) => void;
  onRetry?: (attempt: number, error: unknown) => void;
  onError?: (error: unknown) => void;
  onCancel?: () => void;
}

const JOB_STORAGE_KEY = 'story-arc-studio:long-jobs:v1';

function readPersistedJobs(): PersistedLongJobState {
  if (typeof window === 'undefined') {
    return { jobs: {}, updatedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(JOB_STORAGE_KEY);
    if (!raw) {
      return { jobs: {}, updatedAt: 0 };
    }
    const parsed = JSON.parse(raw) as PersistedLongJobState;
    if (!parsed || typeof parsed !== 'object') {
      return { jobs: {}, updatedAt: 0 };
    }
    return {
      jobs: parsed.jobs && typeof parsed.jobs === 'object' ? parsed.jobs : {},
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { jobs: {}, updatedAt: 0 };
  }
}

function writePersistedJobs(state: PersistedLongJobState): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write failures.
  }
}

function createAbortError(): Error {
  const error = new Error('Operation cancelled');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function waitWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    };
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

const INITIAL_JOB_RUNNING_STATE: Record<StoryArcLongJobKind, boolean> = {
  sync: false,
  scene: false,
  face: false,
};

function createInitialJobRuntime(): Record<StoryArcLongJobKind, JobRuntime> {
  return {
    sync: { controller: null, cancelHandler: null },
    scene: { controller: null, cancelHandler: null },
    face: { controller: null, cancelHandler: null },
  };
}

export function useStoryArcLongJobManager() {
  const [runningJobs, setRunningJobs] = useState(INITIAL_JOB_RUNNING_STATE);
  const runtimesRef = useRef<Record<StoryArcLongJobKind, JobRuntime>>(
    createInitialJobRuntime()
  );

  const setJobRunning = useCallback((kind: StoryArcLongJobKind, running: boolean) => {
    setRunningJobs((previous) => {
      if (previous[kind] === running) {
        return previous;
      }
      return {
        ...previous,
        [kind]: running,
      };
    });
  }, []);

  const cancelJob = useCallback((kind: StoryArcLongJobKind) => {
    const runtime = runtimesRef.current[kind];
    if (runtime.cancelHandler) {
      try {
        runtime.cancelHandler();
      } catch {
        // Ignore cancellation handler failures.
      }
    }
    runtime.cancelHandler = null;
    if (runtime.controller) {
      runtime.controller.abort();
    }
    runtime.controller = null;
    setJobRunning(kind, false);
  }, [setJobRunning]);

  const setPersistedServerJob = useCallback(
    (kind: StoryArcLongJobKind, serverJobId: string) => {
      const existing = readPersistedJobs();
      const next: PersistedLongJobState = {
        jobs: {
          ...existing.jobs,
          [kind]: {
            kind,
            serverJobId,
            persistedAt: Date.now(),
          },
        },
        updatedAt: Date.now(),
      };
      writePersistedJobs(next);
    },
    []
  );

  const clearPersistedServerJob = useCallback((kind: StoryArcLongJobKind) => {
    const existing = readPersistedJobs();
    if (!existing.jobs[kind]) {
      return;
    }
    const nextJobs = { ...existing.jobs };
    delete nextJobs[kind];
    writePersistedJobs({
      jobs: nextJobs,
      updatedAt: Date.now(),
    });
  }, []);

  const getPersistedServerJob = useCallback((kind: StoryArcLongJobKind): PersistedServerJob | null => {
    const existing = readPersistedJobs();
    const entry = existing.jobs[kind];
    if (!entry || typeof entry.serverJobId !== 'string' || entry.serverJobId.trim().length === 0) {
      return null;
    }
    return {
      kind,
      serverJobId: entry.serverJobId,
      persistedAt: typeof entry.persistedAt === 'number' ? entry.persistedAt : 0,
    };
  }, []);

  const runManagedJob = useCallback(
    async <T>({
      kind,
      task,
      maxRetries = 0,
      retryDelayMs = 1500,
      onRetry,
      onCancel,
    }: RunManagedJobOptions<T>): Promise<T> => {
      cancelJob(kind);

      const controller = new AbortController();
      runtimesRef.current[kind] = {
        controller,
        cancelHandler: onCancel ?? null,
      };
      setJobRunning(kind, true);

      try {
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          if (controller.signal.aborted) {
            throw createAbortError();
          }
          try {
            const result = await task({ signal: controller.signal, attempt });
            if (controller.signal.aborted) {
              throw createAbortError();
            }
            return result;
          } catch (error) {
            if (controller.signal.aborted || isAbortError(error)) {
              throw createAbortError();
            }

            if (attempt >= maxRetries) {
              throw error;
            }

            onRetry?.(attempt + 1, error);
            await waitWithSignal(retryDelayMs, controller.signal);
          }
        }

        throw new Error('Unexpected managed job termination');
      } finally {
        if (runtimesRef.current[kind].controller === controller) {
          runtimesRef.current[kind] = { controller: null, cancelHandler: null };
        }
        setJobRunning(kind, false);
      }
    },
    [cancelJob, setJobRunning]
  );

  const startPollingJob = useCallback(
    async <TProgress, TResult>({
      kind,
      serverJobId,
      poll,
      intervalMs = 2000,
      maxConsecutivePollErrors = 3,
      maxRetries = 0,
      retryDelayMs = 2000,
      onProgress,
      onRetry,
      onError,
      onCancel,
    }: StartPollingJobOptions<TProgress, TResult>): Promise<TResult> => {
      setPersistedServerJob(kind, serverJobId);

      try {
        const result = await runManagedJob<TResult>({
          kind,
          maxRetries,
          retryDelayMs,
          onRetry,
          onCancel,
          task: async ({ signal }) => {
            let consecutivePollErrors = 0;

            while (!signal.aborted) {
              try {
                const state = await poll(serverJobId, signal);
                if (state.state === 'running') {
                  consecutivePollErrors = 0;
                  onProgress?.(state.progress);
                  await waitWithSignal(intervalMs, signal);
                  continue;
                }

                if (state.state === 'completed') {
                  clearPersistedServerJob(kind);
                  return state.result;
                }

                clearPersistedServerJob(kind);
                throw new Error(state.error || `${kind} job failed`);
              } catch (error) {
                if (signal.aborted || isAbortError(error)) {
                  throw createAbortError();
                }
                consecutivePollErrors += 1;
                if (consecutivePollErrors > maxConsecutivePollErrors) {
                  throw error;
                }
                await waitWithSignal(
                  intervalMs * Math.min(consecutivePollErrors, 3),
                  signal
                );
              }
            }

            throw createAbortError();
          },
        });
        return result;
      } catch (error) {
        if (isAbortError(error)) {
          clearPersistedServerJob(kind);
        }
        if (!isAbortError(error)) {
          onError?.(error);
        }
        throw error;
      }
    },
    [clearPersistedServerJob, runManagedJob, setPersistedServerJob]
  );

  useEffect(() => {
    return () => {
      cancelJob('sync');
      cancelJob('scene');
      cancelJob('face');
    };
  }, [cancelJob]);

  return {
    runningJobs,
    runManagedJob,
    startPollingJob,
    cancelJob,
    getPersistedServerJob,
    clearPersistedServerJob,
  };
}
