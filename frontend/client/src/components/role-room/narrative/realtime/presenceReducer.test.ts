import { describe, expect, it } from 'vitest';
import { INITIAL_PRESENCE, cursorsOnBoard, presenceReducer, selectionColors, uniquePeersByUser, type PresenceState } from './presenceReducer';

const t0 = 1_000_000;

describe('presenceReducer', () => {
  it('snapshot, presence, cursor, selection og left', () => {
    let s: PresenceState = presenceReducer(INITIAL_PRESENCE, { type: 'connected', clientId: 'me' });
    s = presenceReducer(s, { type: 'snapshot', now: t0, peers: [
      { clientId: 'c1', userId: 'kari', presence: { name: 'Kari', color: '#fbbf24', boardId: 'nbd_1' } },
      { clientId: 'c2', userId: 'ola', presence: null },
    ] });
    expect(Object.keys(s.peers)).toEqual(['c1', 'c2']);
    expect(s.peers.c1).toMatchObject({ name: 'Kari', color: '#fbbf24', boardId: 'nbd_1', cursor: null });
    expect(s.peers.c2.name).toBe('ola');

    s = presenceReducer(s, { type: 'cursor', clientId: 'c1', userId: 'kari', now: t0 + 10, payload: { boardId: 'nbd_1', x: 120, y: 80 } });
    expect(cursorsOnBoard(s, 'nbd_1')).toHaveLength(1);
    expect(cursorsOnBoard(s, 'nbd_2')).toHaveLength(0);
    s = presenceReducer(s, { type: 'cursor', clientId: 'c1', userId: 'kari', now: t0 + 11, payload: { boardId: 'nbd_1', x: Number.NaN, y: 1 } });
    expect(s.peers.c1.cursor).toEqual({ boardId: 'nbd_1', x: 120, y: 80 });

    // Brettbytte nullstiller markør
    s = presenceReducer(s, { type: 'presence', clientId: 'c1', userId: 'kari', now: t0 + 20, payload: { boardId: 'nbd_2' } });
    expect(s.peers.c1.cursor).toBeNull();
    expect(s.peers.c1.boardId).toBe('nbd_2');

    s = presenceReducer(s, { type: 'selection', clientId: 'c2', userId: 'ola', now: t0 + 30, payload: { elementIds: ['nel_1', 'nel_2'] } });
    expect(selectionColors(s)).toEqual({ nel_1: ['#a78bfa'], nel_2: ['#a78bfa'] });

    s = presenceReducer(s, { type: 'presence', clientId: 'c2', userId: 'ola', now: t0 + 40, payload: { left: true } });
    expect(Object.keys(s.peers)).toEqual(['c1']);
  });

  it('ignorerer egne meldinger, dedupliserer per bruker, utløper på TTL', () => {
    let s: PresenceState = presenceReducer(INITIAL_PRESENCE, { type: 'connected', clientId: 'me' });
    s = presenceReducer(s, { type: 'cursor', clientId: 'me', userId: 'u', now: t0, payload: { boardId: 'b', x: 1, y: 1 } });
    expect(s.peers).toEqual({});
    s = presenceReducer(s, { type: 'presence', clientId: 'c1', userId: 'kari', now: t0, payload: { name: 'Kari' } });
    s = presenceReducer(s, { type: 'presence', clientId: 'c1b', userId: 'kari', now: t0 + 1, payload: { name: 'Kari (fane 2)' } });
    s = presenceReducer(s, { type: 'presence', clientId: 'c2', userId: 'ola', now: t0 + 2, payload: { name: 'Ola' } });
    expect(uniquePeersByUser(s).map((p) => p.name)).toEqual(['Kari', 'Ola']);
    s = presenceReducer(s, { type: 'expire', now: t0 + 60_001, ttlMs: 60_000 });
    expect(Object.keys(s.peers)).toEqual(['c1b', 'c2']);
    s = presenceReducer(s, { type: 'reset' });
    expect(s).toEqual({ selfClientId: 'me', peers: {} });
  });
});
