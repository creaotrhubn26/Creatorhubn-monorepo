import { useCallback, useEffect, useRef, useState } from 'react';
import {
  producerWorkflowService,
} from '../services/producerWorkflowService';
import type { ProducerClientIntake } from '../models/casting';

export interface UseClientIntakeResult {
  intake: ProducerClientIntake | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  reload: () => Promise<void>;
  /** Merge `patch` into the current intake and persist. Returns the saved intake. */
  save: (patch: Partial<ProducerClientIntake>) => Promise<ProducerClientIntake>;
  /** Publiser/avpubliser briefen til klienten (draft→publiser→synk-grense). */
  publish: (publish?: boolean) => Promise<ProducerClientIntake>;
  publishing: boolean;
}

export function useClientIntake(projectId?: string): UseClientIntakeResult {
  const [intake, setIntake] = useState<ProducerClientIntake | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setIntake(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await producerWorkflowService.getClientIntake(projectId);
      if (requestId !== requestIdRef.current) return;
      setIntake(next ?? {});
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error ? loadError.message : 'Kunne ikke hente klientbrief',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const save = useCallback(
    async (patch: Partial<ProducerClientIntake>): Promise<ProducerClientIntake> => {
      if (!projectId) throw new Error('Mangler projectId');
      setSaving(true);
      setSaveError(null);
      try {
        const next: ProducerClientIntake = { ...(intake ?? {}), ...patch };
        const saved = await producerWorkflowService.updateClientIntake(projectId, next);
        setIntake(saved ?? next);
        return saved ?? next;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Kunne ikke lagre klientbrief';
        setSaveError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [projectId, intake],
  );

  const publish = useCallback(
    async (shouldPublish = true): Promise<ProducerClientIntake> => {
      if (!projectId) throw new Error('Mangler projectId');
      setPublishing(true);
      try {
        const saved = await producerWorkflowService.publishClientIntake(projectId, shouldPublish);
        setIntake(saved);
        return saved;
      } finally {
        setPublishing(false);
      }
    },
    [projectId],
  );

  return { intake, loading, saving, publishing, error, saveError, reload: load, save, publish };
}
