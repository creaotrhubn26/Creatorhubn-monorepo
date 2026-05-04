import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock broadcastUserEvent BEFORE importing the service so the import
// captures our spy. The service calls broadcastUserEvent at three points
// (presence.joined fan-out, catch-up, departure notify) which is exactly
// the surface we want to assert on.
const broadcastSpy = vi.fn();
vi.mock('./realtime-user-events.js', () => ({
  broadcastUserEvent: (userId: string, event: unknown) => broadcastSpy(userId, event),
}));

import {
  markPresent,
  markAbsent,
  peersForSession,
  broadcastToSessionPeers,
} from './capture-presence-service.js';

describe('capture-presence-service', () => {
  beforeEach(() => {
    broadcastSpy.mockReset();
    // Clear any cross-test residue. The module is stateful, so we
    // explicitly empty every session that previous tests touched.
    for (const sessionId of ['s-a', 's-b', 's-iso']) {
      const peers = peersForSession(sessionId);
      for (const peer of peers) {
        markAbsent(sessionId, peer.userId);
      }
    }
    broadcastSpy.mockReset();  // again — markAbsent fires presence.left
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('markPresent creates a new entry and is queryable via peersForSession', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    const peers = peersForSession('s-a');
    expect(peers).toHaveLength(1);
    expect(peers[0].userId).toBe('user-1');
    expect(peers[0].displayName).toBe('Daniel');
    expect(peers[0].joinedAt).toBeLessThanOrEqual(Date.now());
  });

  it('markPresent broadcasts presence.joined to existing peers + catches up the new arrival', () => {
    // First user joins alone — no one to broadcast to.
    markPresent('s-a', 'user-1', 'Daniel');
    expect(broadcastSpy).not.toHaveBeenCalled();

    // Second user joins — user-1 gets a presence.joined for user-2,
    // AND user-2 gets a catch-up presence.joined for user-1 already
    // present.
    markPresent('s-a', 'user-2', 'Anna');
    const calls = broadcastSpy.mock.calls;
    expect(calls).toHaveLength(2);

    // First call: notify user-1 about user-2 joining
    expect(calls[0][0]).toBe('user-1');
    expect(calls[0][1]).toMatchObject({
      kind: 'presence.joined',
      sessionId: 's-a',
      actorUserId: 'user-2',
      displayName: 'Anna',
    });
    // Second call: catch up user-2 about user-1 already present
    expect(calls[1][0]).toBe('user-2');
    expect(calls[1][1]).toMatchObject({
      kind: 'presence.joined',
      sessionId: 's-a',
      actorUserId: 'user-1',
      displayName: 'Daniel',
    });
  });

  it('markPresent re-call from same user is silent (heartbeat semantics)', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    markPresent('s-a', 'user-2', 'Anna');
    broadcastSpy.mockReset();

    // Re-heartbeat from user-2 — must NOT broadcast (would flood WebSocket).
    markPresent('s-a', 'user-2', 'Anna');
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('markAbsent broadcasts presence.left to remaining peers + the leaving user', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    markPresent('s-a', 'user-2', 'Anna');
    broadcastSpy.mockReset();

    markAbsent('s-a', 'user-2');

    // Broadcasts: presence.left fired to remaining peer (user-1) +
    // also to user-2's own account (other devices on their account).
    const calls = broadcastSpy.mock.calls;
    const recipients = calls.map(c => c[0]).sort();
    expect(recipients).toEqual(['user-1', 'user-2']);
    for (const call of calls) {
      expect(call[1]).toMatchObject({
        kind: 'presence.left',
        sessionId: 's-a',
        actorUserId: 'user-2',
      });
    }
  });

  it('markAbsent on unknown user is a silent no-op', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    broadcastSpy.mockReset();

    // Calling absent for a never-present user must not crash and must
    // not broadcast (would mislead peers).
    markAbsent('s-a', 'never-existed');
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('peersForSession isolates per session — no cross-session leakage', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    markPresent('s-b', 'user-2', 'Anna');

    expect(peersForSession('s-a').map(p => p.userId)).toEqual(['user-1']);
    expect(peersForSession('s-b').map(p => p.userId)).toEqual(['user-2']);
    expect(peersForSession('s-iso')).toEqual([]);
  });

  it('peersForSession returns an empty array for an unknown session', () => {
    expect(peersForSession('does-not-exist')).toEqual([]);
  });

  it('broadcastToSessionPeers fans the supplied event to every peer in the session', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    markPresent('s-a', 'user-2', 'Anna');
    markPresent('s-b', 'user-3', 'Bea');  // separate session — must NOT receive
    broadcastSpy.mockReset();

    broadcastToSessionPeers('s-a', {
      kind: 'asset.labels-changed' as const,
      sessionId: 's-a',
      actorUserId: 'user-1',
      assetId: 'asset-x',
      timestamp: new Date().toISOString(),
    });

    const recipients = broadcastSpy.mock.calls.map(c => c[0]).sort();
    expect(recipients).toEqual(['user-1', 'user-2']);
    expect(recipients).not.toContain('user-3');
  });

  it('broadcastToSessionPeers is a no-op when the session has no peers', () => {
    broadcastToSessionPeers('does-not-exist', {
      kind: 'asset.labels-changed' as const,
      sessionId: 'does-not-exist',
      actorUserId: 'user-x',
      assetId: 'asset-x',
      timestamp: new Date().toISOString(),
    });
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('joinedAt persists across heartbeats (lastSeenAt updates, joinedAt does not)', () => {
    markPresent('s-a', 'user-1', 'Daniel');
    const initialJoinedAt = peersForSession('s-a')[0].joinedAt;

    // Wait a measurable beat then re-heartbeat
    return new Promise<void>(resolve => {
      setTimeout(() => {
        markPresent('s-a', 'user-1', 'Daniel');
        const refreshed = peersForSession('s-a')[0];
        expect(refreshed.joinedAt).toBe(initialJoinedAt);
        // lastSeenAt should advance (or be equal) but never go back
        expect(refreshed.lastSeenAt).toBeGreaterThanOrEqual(initialJoinedAt);
        resolve();
      }, 5);
    });
  });
});
