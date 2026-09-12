import { useEffect, useRef, useState } from 'react';
import { producerWorkflowService, type ProducerClientPresence } from '../services/producerWorkflowService';

interface UseClientPresenceOptions {
  /** Pollingsintervall (ms) for å hente hvem som er til stede. 0 = av. */
  pollMs?: number;
}

/**
 * Hvilke klienter har klientportalen åpen akkurat nå. Mates av klientportalens
 * heartbeat (`POST /api/client/portal/presence`) og lest via
 * `GET /api/role-room/projects/:id/client-presence`. Pauser når fanen er skjult
 * og henter umiddelbart når produsenten kommer tilbake til fanen.
 */
export function useClientPresence(projectId?: string, options?: UseClientPresenceOptions) {
  const pollMs = options?.pollMs ?? 0;
  const [clients, setClients] = useState<ProducerClientPresence[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!projectId) {
      setClients([]);
      return () => {
        cancelledRef.current = true;
      };
    }

    const load = async () => {
      const result = await producerWorkflowService.getClientPresence(projectId);
      if (!cancelledRef.current) {
        setClients(result);
      }
    };
    void load();

    let timer: number | undefined;
    if (pollMs > 0 && typeof window !== 'undefined') {
      const tick = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        void load();
      };
      timer = window.setInterval(tick, pollMs);
    }

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void load();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelledRef.current = true;
      if (timer) {
        window.clearInterval(timer);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [projectId, pollMs]);

  return {
    clients,
    anyPresent: clients.length > 0,
  };
}
