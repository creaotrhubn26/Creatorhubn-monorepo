/**
 * useCrossProjectInbox — aggregerer produsent-varsler PÅ TVERS av prosjekter
 * (lukker data-gap #1 fra Planner-design-passet, som Min dag krever).
 *
 * Det finnes ingen cross-prosjekt-endepunkt i backend i dag — vi henter
 * per-prosjekt-varsler parallelt via det eksisterende (og dedup'ede/cachede)
 * producerWorkflowService.getNotifications, tagger hver med prosjektnavn, og
 * slår dem sammen. For en produsent med en håndfull prosjekter er dette rimelig;
 * et samlet backend-endepunkt er en senere optimalisering.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  producerWorkflowService,
  type ProducerProjectNotification,
} from '../services/producerWorkflowService';

export type CrossProjectInboxItem = ProducerProjectNotification & {
  projectId: string;
  projectName: string;
};

type ProjectRef = { id: string; name: string };

function compareIsoDesc(a?: string | null, b?: string | null): number {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return tb - ta;
}

export function useCrossProjectInbox(projects: ProjectRef[], pollIntervalMs = 0) {
  const [items, setItems] = useState<CrossProjectInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Stabil avhengighet: id-liste som streng (unngår ny referanse hver render).
  const projectsKey = projects.map((p) => p.id).join(',');

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (projects.length === 0) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const perProject = await Promise.all(
        projects.map(async (p) => {
          try {
            const notifications = await producerWorkflowService.getNotifications(p.id);
            return notifications.map<CrossProjectInboxItem>((n) => ({
              ...n,
              projectId: p.id,
              projectName: p.name,
            }));
          } catch {
            // Ett prosjekt som feiler skal ikke velte hele innboksen.
            return [] as CrossProjectInboxItem[];
          }
        }),
      );
      if (requestId !== requestIdRef.current) return;
      const merged = perProject
        .flat()
        .filter((n) => !n.resolved_at && !n.archived_at)
        .sort((a, b) => {
          // Forfalls-dato først (de med due_at øverst, eldste due først),
          // deretter nyeste oppdatering.
          if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
          if (a.due_at) return -1;
          if (b.due_at) return 1;
          return compareIsoDesc(a.updated_at, b.updated_at);
        });
      setItems(merged);
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente innboks');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return () => undefined;
    const id = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void load();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [load, pollIntervalMs]);

  const unreadCount = items.filter((n) => !n.read).length;

  return { items, loading, error, reload: load, unreadCount };
}

export default useCrossProjectInbox;
