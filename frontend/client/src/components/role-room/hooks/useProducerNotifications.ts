import { useCallback, useEffect, useRef, useState } from 'react';
import {
  producerWorkflowService,
  type ProducerProjectNotification,
  type UpdateProducerNotificationInput,
} from '../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../services/producerWorkflowEvents';

export function useProducerNotifications(projectId?: string, pollIntervalMs = 30000) {
  const [items, setItems] = useState<ProducerProjectNotification[]>([]);
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
      const nextItems = await producerWorkflowService.getNotifications(projectId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente varsler');
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
      if (payload.projectId !== projectId || payload.domain !== 'notifications') {
        return;
      }
      void load();
    });
  }, [load, projectId]);

  useEffect(() => {
    if (!projectId || pollIntervalMs <= 0) {
      return () => undefined;
    }

    const intervalId = window.setInterval(() => {
      // Spar batteri + båndbredde + konsoll-støy når enheten er offline.
      // Polling tar seg opp igjen automatisk på neste tick når
      // navigator.onLine snur tilbake til true.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void load();
    }, pollIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [load, pollIntervalMs, projectId]);

  // SSE-stream (cluster D): near-instant push av nye/oppdaterte varsler.
  // Pollingen over fortsetter som fallback hvis streamen feiler — vi stopper
  // den ikke, men streamen gjør at oppdateringer dukker opp umiddelbart i
  // stedet for ved neste poll-tick.
  useEffect(() => {
    if (!projectId) {
      return () => undefined;
    }
    const stop = producerWorkflowService.streamNotifications(projectId, {
      onNotification: (incoming) => {
        setItems((previous) => {
          const rest = previous.filter((item) => item.id !== incoming.id);
          // Nyeste/oppdaterte først — matcher updated_at-desc-sorteringen.
          return [incoming, ...rest];
        });
      },
    });
    return stop;
  }, [projectId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!projectId) throw new Error('Mangler projectId');
    await producerWorkflowService.markNotificationRead(projectId, notificationId);
    setItems((previous) => previous.map((item) => (
      item.id === notificationId
        ? { ...item, read: true, read_at: new Date().toISOString() }
        : item
    )));
  }, [projectId]);

  const markAllAsRead = useCallback(async () => {
    if (!projectId) throw new Error('Mangler projectId');
    await producerWorkflowService.markAllNotificationsRead(projectId);
    const now = new Date().toISOString();
    setItems((previous) => previous.map((item) => ({
      ...item,
      read: true,
      read_at: now,
    })));
  }, [projectId]);

  const updateNotification = useCallback(async (
    notificationId: string,
    payload: UpdateProducerNotificationInput,
  ) => {
    if (!projectId) throw new Error('Mangler projectId');
    const updated = await producerWorkflowService.updateNotification(projectId, notificationId, payload);
    setItems((previous) => previous.map((item) => (item.id === notificationId ? updated : item)));
    return updated;
  }, [projectId]);

  const archiveNotification = useCallback(async (notificationId: string, archived = true) => {
    return updateNotification(notificationId, { archived });
  }, [updateNotification]);

  const resolveNotification = useCallback(async (notificationId: string, resolved = true) => {
    return updateNotification(notificationId, { resolved });
  }, [updateNotification]);

  return {
    items,
    loading,
    error,
    unreadCount: items.filter((item) => !item.read).length,
    reload: load,
    markAsRead,
    markAllAsRead,
    updateNotification,
    archiveNotification,
    resolveNotification,
  };
}

export default useProducerNotifications;
