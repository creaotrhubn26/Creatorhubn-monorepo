import { useCallback, useEffect, useRef } from 'react';

/**
 * useSequencedFetch — race-safe wrapper for overlapping async fetches.
 *
 * Several panels poll/refresh the same endpoint from multiple triggers (filter
 * changes, manual refresh buttons, a 30s auto-poll), so responses can arrive
 * out of order. Without guarding, a slow stale response could overwrite fresh
 * data, or a post-unmount response could trigger a React setState warning.
 *
 * The returned `run` is a stable function (safe in useCallback/useEffect deps).
 * Each `run(fetcher, onResult)` call is tagged with a monotonic seq:
 *   - `onResult` only fires for the *latest* call (stale responses are dropped),
 *   - `onResult` never fires after the component unmounts.
 *
 * The caller still owns all of its state setters — synchronous bookkeeping
 * (e.g. `setLoading(true)`) belongs before `run`, and applying the result
 * (data + clearing `loading`) belongs inside `onResult`:
 *
 *   const sequencedFetch = useSequencedFetch();
 *   const refresh = useCallback(async () => {
 *     setLoading(true);
 *     setError(null);
 *     await sequencedFetch(
 *       () => service.fetchThing(),
 *       (result) => {
 *         if (result.error) setError(result.error);
 *         setData(result.data);
 *         setLoading(false);
 *       },
 *     );
 *   }, [sequencedFetch]);
 */
export function useSequencedFetch(): <T>(
  fetcher: () => Promise<T>,
  onResult: (result: T) => void,
) => Promise<void> {
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  return useCallback(async <T>(
    fetcher: () => Promise<T>,
    onResult: (result: T) => void,
  ): Promise<void> => {
    const seq = ++seqRef.current;
    const result = await fetcher();
    // Discard stale/out-of-order responses and post-unmount updates.
    if (seq !== seqRef.current || !mountedRef.current) return;
    onResult(result);
  }, []);
}

export default useSequencedFetch;
