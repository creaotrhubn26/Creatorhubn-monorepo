/**
 * useTakes.ts
 *
 * React-hook for casting_takes. Henter takes per scene, eksponerer
 * upload/update/delete-handlere, og refetcher etter mutasjoner.
 *
 * Status-polling: når en take er i 'queued' eller 'processing',
 * poller vi hvert 3. sekund for status-oppdateringer. Stopper
 * automatisk når alle er 'analyzed' eller 'failed'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listTakesForScene,
  listTakesForProject,
  uploadTake as uploadTakeApi,
  updateTake as updateTakeApi,
  deleteTake as deleteTakeApi,
  type CastingTake,
  type UploadTakeOptions,
} from '../services/takesClient';

export interface UseTakesResult {
  takes: CastingTake[];
  loading: boolean;
  error: Error | null;
  upload: (opts: Omit<UploadTakeOptions, 'projectId' | 'sceneId'>) => Promise<CastingTake>;
  update: (takeId: string, patch: Parameters<typeof updateTakeApi>[1]) => Promise<void>;
  remove: (takeId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3000;

export function useTakes(
  projectId: string | null | undefined,
  sceneId: string | null | undefined,
): UseTakesResult {
  const [takes, setTakes] = useState<CastingTake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setTakes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = sceneId
        ? await listTakesForScene(sceneId)
        : await listTakesForProject(projectId);
      setTakes(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, sceneId]);

  // Initial load + ved scene-bytte
  useEffect(() => {
    void load();
  }, [load]);

  // Polling: hvis noen takes er pending/queued/processing, refetch hvert 3s
  useEffect(() => {
    const hasPending = takes.some((t) =>
      t.processingStatus === 'pending' ||
      t.processingStatus === 'queued' ||
      t.processingStatus === 'processing',
    );

    if (!hasPending) {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    pollTimerRef.current = setTimeout(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [takes, load]);

  const upload = useCallback(
    async (opts: Omit<UploadTakeOptions, 'projectId' | 'sceneId'>) => {
      if (!projectId) {
        throw new Error('projectId mangler');
      }
      const take = await uploadTakeApi({
        projectId,
        sceneId: sceneId ?? undefined,
        ...opts,
      });
      // Optimistic add — refetch tar over
      setTakes((current) => [take, ...current.filter((t) => t.id !== take.id)]);
      return take;
    },
    [projectId, sceneId],
  );

  const update = useCallback(
    async (takeId: string, patch: Parameters<typeof updateTakeApi>[1]) => {
      const updated = await updateTakeApi(takeId, patch);
      setTakes((current) => current.map((t) => (t.id === takeId ? updated : t)));
    },
    [],
  );

  const remove = useCallback(async (takeId: string) => {
    setTakes((current) => current.filter((t) => t.id !== takeId));
    try {
      await deleteTakeApi(takeId);
    } catch (err) {
      // Rull tilbake ved feil
      await load();
      throw err;
    }
  }, [load]);

  return { takes, loading, error, upload, update, remove, refetch: load };
}
