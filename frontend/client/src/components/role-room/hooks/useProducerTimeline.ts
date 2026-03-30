import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  producerWorkflowService,
  type CreateProducerTimelineItemInput,
  type ProducerPhase,
  type ProducerTimelineItem,
  type UpdateProducerTimelineItemInput,
} from '../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../services/producerWorkflowEvents';

const EMPTY_TIMELINE: ProducerTimelineItem[] = [];

export function useProducerTimeline(projectId?: string) {
  const [items, setItems] = useState<ProducerTimelineItem[]>(EMPTY_TIMELINE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setItems(EMPTY_TIMELINE);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextItems = await producerWorkflowService.getTimeline(projectId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente tidslinje');
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

  useEffect(() => {
    if (!projectId) {
      return () => undefined;
    }

    return onProducerWorkflowEvent((payload) => {
      if (payload.projectId !== projectId || payload.domain !== 'timeline') {
        return;
      }
      void load();
    });
  }, [load, projectId]);

  const createItem = useCallback(async (payload: CreateProducerTimelineItemInput) => {
    if (!projectId) throw new Error('Mangler projectId');
    const created = await producerWorkflowService.createTimelineItem(projectId, payload);
    setItems((prev) => [...prev, created]);
    return created;
  }, [projectId]);

  const updateItem = useCallback(
    async (itemId: string, payload: UpdateProducerTimelineItemInput) => {
      if (!projectId) throw new Error('Mangler projectId');
      const updated = await producerWorkflowService.updateTimelineItem(projectId, itemId, payload);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      return updated;
    },
    [projectId],
  );

  const removeItem = useCallback(async (itemId: string) => {
    if (!projectId) throw new Error('Mangler projectId');
    await producerWorkflowService.deleteTimelineItem(projectId, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, [projectId]);

  const groupedByPhase = useMemo<Record<ProducerPhase, ProducerTimelineItem[]>>(() => ({
    preproduction: items.filter((item) => item.phase === 'preproduction'),
    production: items.filter((item) => item.phase === 'production'),
    postproduction: items.filter((item) => item.phase === 'postproduction'),
  }), [items]);

  return {
    items,
    groupedByPhase,
    loading,
    error,
    reload: load,
    createItem,
    updateItem,
    removeItem,
  };
}
