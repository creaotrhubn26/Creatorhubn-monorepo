/**
 * Ren reducer for sanntids-presence i Story Graph (testbar uten WebSocket).
 *
 * Nøkkel = clientId (samme bruker i to faner = to markører); avatar-stripen
 * dedupliserer på userId. Egne meldinger ekkoes ikke fra serveren (relay
 * ekskluderer avsender), men vi filtrerer likevel på selfClientId for sikkerhets skyld.
 */

export interface PeerCursor { boardId: string; x: number; y: number }

export interface Peer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  boardId: string | null;
  cursor: PeerCursor | null;
  selection: string[];
  lastSeen: number;
}

export interface PresenceState {
  selfClientId: string | null;
  peers: Record<string, Peer>;
}

export interface PresencePayload { name?: string; color?: string; boardId?: string | null; left?: boolean }

export type PresenceAction =
  | { type: 'connected'; clientId: string }
  | { type: 'snapshot'; peers: Array<{ clientId: string; userId: string; presence: PresencePayload | null }>; now: number }
  | { type: 'presence'; clientId: string; userId: string; payload: PresencePayload; now: number }
  | { type: 'cursor'; clientId: string; userId: string; payload: PeerCursor; now: number }
  | { type: 'selection'; clientId: string; userId: string; payload: { elementIds: string[] }; now: number }
  | { type: 'expire'; now: number; ttlMs: number }
  | { type: 'reset' };

export const INITIAL_PRESENCE: PresenceState = { selfClientId: null, peers: {} };

function upsert(state: PresenceState, clientId: string, userId: string, now: number, patch: Partial<Peer>): PresenceState {
  if (state.selfClientId && clientId === state.selfClientId) return state;
  const prev = state.peers[clientId];
  const next: Peer = {
    clientId, userId,
    name: prev?.name ?? userId,
    color: prev?.color ?? '#a78bfa',
    boardId: prev?.boardId ?? null,
    cursor: prev?.cursor ?? null,
    selection: prev?.selection ?? [],
    lastSeen: now,
    ...patch,
  };
  return { ...state, peers: { ...state.peers, [clientId]: next } };
}

export function presenceReducer(state: PresenceState, action: PresenceAction): PresenceState {
  switch (action.type) {
    case 'connected':
      return { ...state, selfClientId: action.clientId };
    case 'reset':
      return { ...INITIAL_PRESENCE, selfClientId: state.selfClientId };
    case 'snapshot': {
      let next: PresenceState = { ...state, peers: {} };
      for (const p of action.peers) {
        const pr = p.presence ?? {};
        next = upsert(next, p.clientId, p.userId, action.now, {
          name: typeof pr.name === 'string' && pr.name ? pr.name : p.userId,
          color: typeof pr.color === 'string' && pr.color ? pr.color : undefined,
          boardId: typeof pr.boardId === 'string' ? pr.boardId : null,
        });
      }
      return next;
    }
    case 'presence': {
      if (action.payload.left) {
        if (!state.peers[action.clientId]) return state;
        const peers = { ...state.peers };
        delete peers[action.clientId];
        return { ...state, peers };
      }
      const patch: Partial<Peer> = {};
      if (typeof action.payload.name === 'string' && action.payload.name) patch.name = action.payload.name;
      if (typeof action.payload.color === 'string' && action.payload.color) patch.color = action.payload.color;
      if (action.payload.boardId !== undefined) {
        patch.boardId = typeof action.payload.boardId === 'string' ? action.payload.boardId : null;
        // Bytter brett → markøren på det gamle brettet er uinteressant.
        const prev = state.peers[action.clientId];
        if (prev?.cursor && prev.cursor.boardId !== patch.boardId) patch.cursor = null;
      }
      return upsert(state, action.clientId, action.userId, action.now, patch);
    }
    case 'cursor': {
      const { boardId, x, y } = action.payload;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return state;
      return upsert(state, action.clientId, action.userId, action.now, { cursor: { boardId, x, y }, boardId });
    }
    case 'selection': {
      const ids = Array.isArray(action.payload.elementIds) ? action.payload.elementIds.filter((id): id is string => typeof id === 'string').slice(0, 50) : [];
      return upsert(state, action.clientId, action.userId, action.now, { selection: ids });
    }
    case 'expire': {
      const cutoff = action.now - action.ttlMs;
      const stale = Object.values(state.peers).filter((p) => p.lastSeen < cutoff);
      if (stale.length === 0) return state;
      const peers = { ...state.peers };
      for (const p of stale) delete peers[p.clientId];
      return { ...state, peers };
    }
    default:
      return state;
  }
}

/** Én rad per bruker (første klient vinner) — for avatar-stripen. */
export function uniquePeersByUser(state: PresenceState): Peer[] {
  const seen = new Set<string>();
  const out: Peer[] = [];
  for (const p of Object.values(state.peers).sort((a, b) => a.lastSeen - b.lastSeen)) {
    if (seen.has(p.userId)) continue;
    seen.add(p.userId);
    out.push(p);
  }
  return out;
}

/** Markører på et gitt brett (alle klienter). */
export function cursorsOnBoard(state: PresenceState, boardId: string): Peer[] {
  return Object.values(state.peers).filter((p) => p.cursor && p.cursor.boardId === boardId);
}

/** Element-id → farger på peers som har valgt elementet. */
export function selectionColors(state: PresenceState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of Object.values(state.peers)) {
    for (const id of p.selection) (out[id] ??= []).push(p.color);
  }
  return out;
}
