import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  producerWorkflowService,
  type CreateProducerEconomyItemInput,
  type ProducerEconomyItem,
  type UpdateProducerEconomyItemInput,
} from '../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../services/producerWorkflowEvents';

export function useProducerEconomy(projectId?: string) {
  const [items, setItems] = useState<ProducerEconomyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextItems = await producerWorkflowService.getEconomyItems(projectId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente økonomi');
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
      if (payload.projectId !== projectId || payload.domain !== 'economy') {
        return;
      }
      void load();
    });
  }, [load, projectId]);

  const createItem = useCallback(async (payload: CreateProducerEconomyItemInput) => {
    if (!projectId) throw new Error('Mangler projectId');
    const created = await producerWorkflowService.createEconomyItem(projectId, payload);
    setItems((prev) => [...prev, created]);
    return created;
  }, [projectId]);

  const updateItem = useCallback(
    async (itemId: string, payload: UpdateProducerEconomyItemInput) => {
      if (!projectId) throw new Error('Mangler projectId');
      const updated = await producerWorkflowService.updateEconomyItem(projectId, itemId, payload);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      return updated;
    },
    [projectId],
  );

  const removeItem = useCallback(async (itemId: string) => {
    if (!projectId) throw new Error('Mangler projectId');
    await producerWorkflowService.deleteEconomyItem(projectId, itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, [projectId]);

  const publishItem = useCallback(async (itemId: string, publish = true) => {
    if (!projectId) throw new Error('Mangler projectId');
    const updated = await producerWorkflowService.publishEconomyItem(projectId, itemId, publish);
    setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
    return updated;
  }, [projectId]);

  const totals = useMemo(() => {
    const toNumber = (value: string | number): number => {
      if (typeof value === 'number') return value;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return items.reduce(
      (acc, item) => ({
        estimate: acc.estimate + toNumber(item.estimate),
        approved: acc.approved + toNumber(item.approved),
        actual: acc.actual + toNumber(item.actual),
      }),
      { estimate: 0, approved: 0, actual: 0 },
    );
  }, [items]);

  return {
    items,
    totals,
    loading,
    error,
    reload: load,
    createItem,
    updateItem,
    removeItem,
    publishItem,
  };
}
