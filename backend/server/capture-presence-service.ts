import { broadcastUserEvent } from './realtime-user-events.js';

/**
 * Phase 5.3 — multi-photographer presence tracking.
 *
 * Maintains an in-memory map of who is currently connected to which
 * capture session. Two iPads tethered to the same shoot (lead +
 * assistant) see each other's presence + label changes in real time
 * via the existing user-scoped WebSocket fanout (`broadcastUserEvent`).
 *
 * Lifecycle:
 *   * `markPresent(sessionId, userId, displayName)` — called from
 *     `POST /api/capture/sessions/:id/presence` when an iPad joins,
 *     and from the WebSocket subscribe path. Idempotent — re-calling
 *     refreshes the heartbeat timestamp + (re-)broadcasts the
 *     `presence.joined` event so a peer that connected mid-stream
 *     gets caught up.
 *   * `markAbsent(sessionId, userId)` — called on explicit leave.
 *     Broadcasts `presence.left`.
 *   * `peersForSession(sessionId)` — read accessor for routes that
 *     need to fan a derived event (e.g. asset.labels-changed) to
 *     everyone present in the session.
 *
 * Stale cleanup: a per-session interval purges entries idle >5 min.
 * Mirrors the `photoEnhancerJobs` cleanup philosophy — anyone whose
 * iPad is asleep effectively "left" so the next iPad isn't told
 * they're still watching.
 *
 * Storage is in-memory; on backend restart the map is empty and
 * iPads re-broadcast presence next time they reconnect via the
 * WebSocket. No DB persistence needed for transient presence.
 */

interface PresenceEntry {
  userId: string;
  displayName: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

const PRESENCE_STALE_MS = 5 * 60 * 1000;

/// sessionId → userId → entry. Two-level map so we can look up "who
/// is in this session" in O(1) without scanning a flat array.
const presenceMap = new Map<string, Map<string, PresenceEntry>>();

let cleanupInterval: NodeJS.Timeout | null = null;

function ensureCleanupRunning(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, peers] of presenceMap.entries()) {
      for (const [userId, entry] of peers.entries()) {
        if (now - entry.lastSeenAt > PRESENCE_STALE_MS) {
          peers.delete(userId);
          // Tell every remaining peer in the session (and the user
          // themselves on other devices) that they're gone.
          notifyPeersOfDeparture(sessionId, peers, userId);
        }
      }
      if (peers.size === 0) {
        presenceMap.delete(sessionId);
      }
    }
  }, 60 * 1000);
  // Don't keep the Node process alive just for this timer.
  cleanupInterval.unref?.();
}

function notifyPeersOfDeparture(
  sessionId: string,
  peers: Map<string, PresenceEntry>,
  leftUserId: string,
): void {
  const event = {
    kind: 'presence.left' as const,
    sessionId,
    actorUserId: leftUserId,
    timestamp: new Date().toISOString(),
  };
  // Fan to everyone still in the session.
  for (const peer of peers.keys()) {
    broadcastUserEvent(peer, event);
  }
  // Also fire to the leaving user themselves so other devices on
  // their account drop the avatar.
  broadcastUserEvent(leftUserId, event);
}

export function markPresent(
  sessionId: string,
  userId: string,
  displayName: string | null,
): void {
  ensureCleanupRunning();
  let peers = presenceMap.get(sessionId);
  if (!peers) {
    peers = new Map();
    presenceMap.set(sessionId, peers);
  }
  const now = Date.now();
  const wasPresent = peers.has(userId);
  peers.set(userId, {
    userId,
    displayName,
    joinedAt: peers.get(userId)?.joinedAt ?? now,
    lastSeenAt: now,
  });

  // Broadcast `presence.joined` to existing peers ONLY when this is
  // a fresh join (re-heartbeats from the same user are silent so we
  // don't flood the WebSocket every time the iPad pings).
  if (!wasPresent) {
    const event = {
      kind: 'presence.joined' as const,
      sessionId,
      actorUserId: userId,
      displayName,
      timestamp: new Date(now).toISOString(),
    };
    for (const peer of peers.keys()) {
      if (peer === userId) continue;
      broadcastUserEvent(peer, event);
    }
    // Also catch up the joining user with the existing roster — they
    // get a `presence.joined` per existing peer so their StatusBar
    // immediately renders avatars for everyone already present.
    for (const peer of peers.values()) {
      if (peer.userId === userId) continue;
      broadcastUserEvent(userId, {
        kind: 'presence.joined',
        sessionId,
        actorUserId: peer.userId,
        displayName: peer.displayName,
        timestamp: new Date(peer.joinedAt).toISOString(),
      });
    }
  }
}

export function markAbsent(sessionId: string, userId: string): void {
  const peers = presenceMap.get(sessionId);
  if (!peers) return;
  if (!peers.has(userId)) return;
  peers.delete(userId);
  notifyPeersOfDeparture(sessionId, peers, userId);
  if (peers.size === 0) {
    presenceMap.delete(sessionId);
  }
}

export function peersForSession(sessionId: string): readonly PresenceEntry[] {
  const peers = presenceMap.get(sessionId);
  if (!peers) return [];
  return [...peers.values()];
}

/// Convenience for routes that need to broadcast a derived event
/// (e.g. asset.labels-changed) to every photographer currently
/// watching the session. The actor's own user IS included so other
/// devices on their account stay in sync; iPad-side dedup gates on
/// the `actorUserId !== self` check, not on bus-level filtering.
export function broadcastToSessionPeers(
  sessionId: string,
  event: Parameters<typeof broadcastUserEvent>[1],
): void {
  const peers = presenceMap.get(sessionId);
  if (!peers || peers.size === 0) return;
  for (const userId of peers.keys()) {
    broadcastUserEvent(userId, event);
  }
}
