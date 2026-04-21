import { describe, expect, it } from 'vitest';
import { createFaceDetectionQueue } from '../face-detector';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createFaceDetectionQueue', () => {
  it('runs jobs immediately up to the concurrency cap', async () => {
    const queue = createFaceDetectionQueue<number>(2);
    const a = deferred<number>();
    const b = deferred<number>();
    const c = deferred<number>();

    const pA = queue.enqueue({ key: 'a', run: () => a.promise });
    const pB = queue.enqueue({ key: 'b', run: () => b.promise });
    const pC = queue.enqueue({ key: 'c', run: () => c.promise });

    expect(queue.inFlight()).toBe(2);
    a.resolve(1);
    await pA;
    expect(queue.inFlight()).toBe(2);
    b.resolve(2);
    c.resolve(3);
    expect(await Promise.all([pB, pC])).toEqual([2, 3]);
  });

  it('deduplicates by key — same key returns the in-flight promise', async () => {
    const queue = createFaceDetectionQueue<number>(1);
    const slot = deferred<number>();
    let calls = 0;
    const run = () => {
      calls += 1;
      return slot.promise;
    };
    const first = queue.enqueue({ key: 'x', run });
    const second = queue.enqueue({ key: 'x', run });
    expect(first).toBe(second);
    slot.resolve(42);
    expect(await first).toBe(42);
    expect(calls).toBe(1);
  });

  it('processes queued jobs when a slot frees up', async () => {
    const queue = createFaceDetectionQueue<number>(1);
    const a = deferred<number>();
    const bStart = deferred<void>();
    const b = deferred<number>();

    const pA = queue.enqueue({ key: 'a', run: () => a.promise });
    const pB = queue.enqueue({
      key: 'b',
      run: () => {
        bStart.resolve();
        return b.promise;
      },
    });

    // b must not have started yet
    let bStarted = false;
    void bStart.promise.then(() => {
      bStarted = true;
    });
    await Promise.resolve();
    expect(bStarted).toBe(false);

    a.resolve(1);
    await pA;
    await bStart.promise;
    expect(bStarted).toBe(true);
    b.resolve(2);
    expect(await pB).toBe(2);
  });

  it('propagates job errors to the caller', async () => {
    const queue = createFaceDetectionQueue<number>(1);
    await expect(
      queue.enqueue({ key: 'err', run: () => Promise.reject(new Error('boom')) }),
    ).rejects.toThrow('boom');
  });

  it('cancelPending drops queued (not in-flight) jobs', async () => {
    const queue = createFaceDetectionQueue<number>(1);
    const a = deferred<number>();
    const b = deferred<number>();
    const pA = queue.enqueue({ key: 'a', run: () => a.promise });
    const pB = queue.enqueue({ key: 'b', run: () => b.promise });
    queue.cancelPending('b');
    a.resolve(1);
    expect(await pA).toBe(1);
    await expect(pB).rejects.toThrow('face_detection_cancelled');
  });
});
