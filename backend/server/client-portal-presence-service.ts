/**
 * In-memory klient-tilstedeværelse for Role Room content-producer-flyten.
 *
 * Klientportalen sender en heartbeat mens fanen er åpen
 * (`POST /api/client/portal/presence`), og produsenten poller hvem som er til
 * stede (`GET /api/role-room/projects/:projectId/client-presence`). Det lar
 * Stig se «Helene ser på prosjektet nå» i sanntid.
 *
 * Mønsteret speiler capture-presence-service.ts, men uten WebSocket-broadcast —
 * produsenten poller. Lagringen er in-memory: ved restart tømmes mappen og
 * klientene re-heartbeat'er ved neste ping. Deployen er single-instance
 * (render.yaml `plan: free`), så delt in-memory state er trygt; ved horisontal
 * skalering må dette flyttes til Redis e.l. (eller leses fra
 * `role_room_client_portal_sessions.last_seen_at` som allerede oppdateres).
 */

export interface ClientPresenceEntry {
  email: string;
  name: string | null;
  workspace: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

// Heartbeat sendes hvert ~30. sek; 90 sek stale-vindu tåler ett tapt ping.
const PRESENCE_STALE_MS = 90 * 1000;

/** projectId → emailKey → entry. To-nivå map for O(1)-oppslag per prosjekt. */
const presenceMap = new Map<string, Map<string, ClientPresenceEntry>>();

let cleanupInterval: NodeJS.Timeout | null = null;

function ensureCleanupRunning(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [projectId, clients] of presenceMap.entries()) {
      for (const [key, entry] of clients.entries()) {
        if (now - entry.lastSeenAt > PRESENCE_STALE_MS) {
          clients.delete(key);
        }
      }
      if (clients.size === 0) {
        presenceMap.delete(projectId);
      }
    }
  }, 60 * 1000);
  // Ikke hold Node-prosessen i live bare for denne timeren.
  cleanupInterval.unref?.();
}

export function markClientPresent(
  projectId: string,
  email: string,
  name: string | null,
  workspace?: string | null,
): void {
  const key = (email ?? '').trim().toLowerCase();
  if (!projectId || !key) {
    return;
  }
  ensureCleanupRunning();
  let clients = presenceMap.get(projectId);
  if (!clients) {
    clients = new Map();
    presenceMap.set(projectId, clients);
  }
  const now = Date.now();
  clients.set(key, {
    email: (email ?? '').trim(),
    name: name?.trim() || null,
    workspace: workspace?.trim() || null,
    joinedAt: clients.get(key)?.joinedAt ?? now,
    lastSeenAt: now,
  });
}

export function markClientAbsent(projectId: string, email: string): void {
  const key = (email ?? '').trim().toLowerCase();
  const clients = presenceMap.get(projectId);
  if (!clients) return;
  clients.delete(key);
  if (clients.size === 0) {
    presenceMap.delete(projectId);
  }
}

/** Klienter som har heartbeat'et innen stale-vinduet, nyeste først. */
export function clientsForProject(projectId: string): ClientPresenceEntry[] {
  const clients = presenceMap.get(projectId);
  if (!clients) return [];
  const now = Date.now();
  return Array.from(clients.values())
    .filter((entry) => now - entry.lastSeenAt <= PRESENCE_STALE_MS)
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt);
}
