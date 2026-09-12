/**
 * useAdminPresence — delt hook for «hvem er pålogget akkurat nå».
 *
 * Henter admin-guardet presence fra GET /api/admin/presence/online (poller
 * ~30s) og eksponerer en rask oppslags-API (Map userId→presence + e-post-indeks)
 * slik at både UserManagementPanel (per rad) og Kommunikasjon-panelet kan vise
 * en grønn «pålogget»-prikk uten å duplisere logikk.
 *
 * Degraderer trygt: hvis endepunktet feiler/mangler returnerer den «ingen
 * pålogget» i stedet for å kaste — presence er en berikelse, aldri kritisk.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Tooltip } from '@mui/material';
import { apiRequest } from '../../../lib/queryClient';

export interface OnlinePresence {
  userId: string;
  email: string | null;
  name: string | null;
  lastSeenAt: string | null;
  isIdle: boolean;
  currentRoute: string | null;
}

interface PresenceResponse {
  online: OnlinePresence[];
  onlineCount: number;
  generatedAt: string;
  degraded?: boolean;
}

export interface AdminPresenceLookup {
  /** Antall brukere pålogget akkurat nå. */
  onlineCount: number;
  /** Rå liste over pålogget-presence. */
  online: OnlinePresence[];
  isLoading: boolean;
  /** true hvis brukeren (ID eller e-post) er pålogget akkurat nå. */
  isOnline: (idOrEmail?: string | null) => boolean;
  /** presence-raden for en bruker, eller null. */
  presenceFor: (idOrEmail?: string | null) => OnlinePresence | null;
}

const POLL_MS = 30_000;

export function useAdminPresence(): AdminPresenceLookup {
  const { data, isLoading } = useQuery<PresenceResponse>({
    queryKey: ['/api/admin/presence/online'],
    queryFn: () => apiRequest('/api/admin/presence/online'),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
    // Presence er berikelse — ikke spam retries om backend mangler endepunktet.
    retry: 1,
  });

  const { byId, byEmail, online } = React.useMemo(() => {
    const list = Array.isArray(data?.online) ? data!.online : [];
    const idMap = new Map<string, OnlinePresence>();
    const emailMap = new Map<string, OnlinePresence>();
    for (const p of list) {
      if (p.userId) idMap.set(String(p.userId), p);
      if (p.email) emailMap.set(String(p.email).toLowerCase(), p);
    }
    return { byId: idMap, byEmail: emailMap, online: list };
  }, [data]);

  const presenceFor = React.useCallback(
    (idOrEmail?: string | null): OnlinePresence | null => {
      if (!idOrEmail) return null;
      const key = String(idOrEmail);
      return byId.get(key) || byEmail.get(key.toLowerCase()) || null;
    },
    [byId, byEmail],
  );

  const isOnline = React.useCallback(
    (idOrEmail?: string | null) => presenceFor(idOrEmail) !== null,
    [presenceFor],
  );

  return {
    onlineCount: data?.onlineCount ?? online.length,
    online,
    isLoading,
    isOnline,
    presenceFor,
  };
}

/**
 * OnlineStatusDot — liten status-prikk (grønn = pålogget, grå = frakoblet).
 * Brukes per brukerrad. `online` styres av kalleren (fra useAdminPresence).
 */
export function OnlineStatusDot({
  online,
  size = 10,
  label,
}: {
  online: boolean;
  size?: number;
  label?: string;
}) {
  const title = label ?? (online ? 'Pålogget nå' : 'Frakoblet');
  return (
    <Tooltip title={title} arrow>
      <Box
        component="span"
        aria-label={title}
        role="img"
        sx={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: online ? '#22c55e' : 'rgba(255,255,255,0.28)',
          boxShadow: online ? '0 0 0 3px rgba(34,197,94,0.18)' : 'none',
          transition: 'background-color 0.2s ease',
        }}
      />
    </Tooltip>
  );
}
