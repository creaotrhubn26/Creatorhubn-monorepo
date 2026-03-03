import { act, renderHook } from '@testing-library/react';
import { useStoryArcLongJobManager } from '../useStoryArcLongJobManager';

const JOB_STORAGE_KEY = 'story-arc-studio:long-jobs:v1';

describe('useStoryArcLongJobManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('retries managed jobs and succeeds on a later attempt', async () => {
    const { result } = renderHook(() => useStoryArcLongJobManager());
    const onRetry = vi.fn();
    let attempts = 0;
    let promise: Promise<string>;

    act(() => {
      promise = result.current.runManagedJob<string>({
        kind: 'sync',
        maxRetries: 1,
        retryDelayMs: 50,
        onRetry,
        task: async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('Transient failure');
          }
          return 'ok';
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      await promise;
    });

    await expect(promise!).resolves.toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(result.current.runningJobs.sync).toBe(false);
  });

  it('persists polling jobs and clears persisted state on completion', async () => {
    const { result } = renderHook(() => useStoryArcLongJobManager());
    const onProgress = vi.fn();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ state: 'running', progress: { percent: 20 } } as const)
      .mockResolvedValueOnce({ state: 'completed', result: 'done' } as const);

    let promise: Promise<string>;
    act(() => {
      promise = result.current.startPollingJob({
        kind: 'scene',
        serverJobId: 'scene-job-1',
        poll,
        intervalMs: 40,
        onProgress,
      });
    });

    expect(result.current.getPersistedServerJob('scene')?.serverJobId).toBe('scene-job-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await promise;
    });

    await expect(promise!).resolves.toBe('done');
    expect(onProgress).toHaveBeenCalledWith({ percent: 20 });
    expect(result.current.getPersistedServerJob('scene')).toBeNull();
  });

  it('cancels polling jobs and clears persisted state', async () => {
    const { result } = renderHook(() => useStoryArcLongJobManager());
    const onCancel = vi.fn();
    const poll = vi.fn().mockResolvedValue({ state: 'running' } as const);

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.startPollingJob({
        kind: 'face',
        serverJobId: 'face-job-1',
        poll,
        intervalMs: 1_000,
        onCancel,
      });
    });

    expect(result.current.getPersistedServerJob('face')?.serverJobId).toBe('face-job-1');

    await Promise.resolve();
    act(() => {
      result.current.cancelJob('face');
    });

    let cancellationError: unknown;
    await act(async () => {
      try {
        await promise;
      } catch (error) {
        cancellationError = error;
      }
    });

    expect(cancellationError).toMatchObject({ name: 'AbortError' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.getPersistedServerJob('face')).toBeNull();
  });

  it('reads persisted jobs for refresh/crash recovery', () => {
    window.localStorage.setItem(
      JOB_STORAGE_KEY,
      JSON.stringify({
        jobs: {
          sync: {
            kind: 'sync',
            serverJobId: 'sync-job-recovered',
            persistedAt: 1700000000000,
          },
        },
        updatedAt: 1700000000000,
      })
    );

    const { result } = renderHook(() => useStoryArcLongJobManager());

    expect(result.current.getPersistedServerJob('sync')).toEqual({
      kind: 'sync',
      serverJobId: 'sync-job-recovered',
      persistedAt: 1700000000000,
    });
  });
});
