// @ts-nocheck
/**
 * liveSetOutboxService.ts
 * ────────────────────────────────────────────────────────────────────────────
 * MVP offline outbox for Live Set Mode.
 *
 * • Stores failed operations in localStorage under a well-known key.
 * • Automatically retries when the browser comes back online.
 * • Dispatches a custom DOM event `liveset:outbox:flushed` subscribers can
 *   listen to in order to refresh their UI state.
 * • Works standalone — no React dependency — so backend workers can also
 *   import it in plain TS environments.
 *
 * Operation types mirror the productionWorkflowService surface:
 *   roll | cut | circle_take | add_note | setup_complete | adjust_take
 */

import type { ContinuityNote, Take } from './productionWorkflowService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutboxOpType =
  | 'roll'
  | 'cut'
  | 'circle_take'
  | 'add_note'
  | 'setup_complete'
  | 'adjust_take';

export interface OutboxEntry {
  id:            string;
  type:          OutboxOpType;
  payload:       Record<string, unknown>;
  projectId:     string;
  shootingDayId: string;
  timestamp:     string;
  retries:       number;
  /** 'pending' = not yet attempted, 'syncing' = in-flight, 'failed' = gave up */
  status:        'pending' | 'syncing' | 'failed';
}

export type FlushResult = { synced: OutboxEntry[]; failed: OutboxEntry[] };

// Executor signature — caller provides this to flush()
export type OutboxExecutor = (entry: OutboxEntry) => Promise<void>;

// ─── Storage key ─────────────────────────────────────────────────────────────

const OUTBOX_KEY = 'liveset:outbox';
const MAX_RETRIES = 5;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function read(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    // localStorage quota exceeded — drop oldest
    try {
      const trimmed = entries.slice(-50);
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(trimmed));
    } catch { /* give up */ }
  }
}

function dispatch(eventName: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Enqueue a new operation. Returns the created entry. */
export function enqueue(
  type: OutboxOpType,
  payload: Record<string, unknown>,
  projectId: string,
  shootingDayId: string,
): OutboxEntry {
  const entry: OutboxEntry = {
    id:            `obox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    payload,
    projectId,
    shootingDayId,
    timestamp:     new Date().toISOString(),
    retries:       0,
    status:        'pending',
  };
  write([...read(), entry]);
  dispatch('liveset:outbox:enqueued', entry);
  return entry;
}

/** All entries for a given project+day (all statuses). */
export function getEntries(projectId: string, shootingDayId: string): OutboxEntry[] {
  return read().filter(e => e.projectId === projectId && e.shootingDayId === shootingDayId);
}

/** Count of pending/failed entries for a project+day. */
export function pendingCount(projectId: string, shootingDayId: string): number {
  return getEntries(projectId, shootingDayId).filter(e => e.status !== 'syncing').length;
}

/** Remove successfully-confirmed entries for a project+day. */
export function markSynced(ids: string[]): void {
  const all = read().filter(e => !ids.includes(e.id));
  write(all);
  dispatch('liveset:outbox:flushed', { syncedIds: ids });
}

/** Clear all entries regardless of status (e.g. on logout). */
export function clear(): void {
  localStorage.removeItem(OUTBOX_KEY);
  dispatch('liveset:outbox:cleared');
}

/**
 * Attempt to flush all pending/failed entries for a project+day.
 * `executor` should call the live API and throw on failure.
 */
export async function flush(
  projectId: string,
  shootingDayId: string,
  executor: OutboxExecutor,
): Promise<FlushResult> {
  const all = read();
  const relevant = all.filter(
    e => e.projectId === projectId && e.shootingDayId === shootingDayId
      && e.status !== 'syncing',
  );

  const synced: OutboxEntry[] = [];
  const failed: OutboxEntry[] = [];

  for (const entry of relevant) {
    // Mark in-flight
    const updated: OutboxEntry = { ...entry, status: 'syncing' };
    const others = read().filter(e => e.id !== entry.id);
    write([...others, updated]);

    try {
      await executor(updated);
      synced.push(updated);
    } catch {
      const exhausted = entry.retries + 1 >= MAX_RETRIES;
      const retried: OutboxEntry = {
        ...updated,
        retries: entry.retries + 1,
        status:  exhausted ? 'failed' : 'pending',
      };
      write([...read().filter(e => e.id !== entry.id), retried]);
      failed.push(retried);
    }
  }

  // Remove synced
  if (synced.length) markSynced(synced.map(e => e.id));

  dispatch('liveset:outbox:flushed', { synced, failed });
  return { synced, failed };
}

// ─── Auto-flush on network reconnect ─────────────────────────────────────────

let _autoFlushExecutor: OutboxExecutor | null = null;
let _autoFlushProjectId = '';
let _autoFlushDayId = '';

/**
 * Register an executor that will be called automatically when the browser
 * reports it is back online. Call this once during component mount.
 * Pass `null` to deregister.
 */
export function registerAutoFlush(
  projectId: string,
  shootingDayId: string,
  executor: OutboxExecutor | null,
): void {
  _autoFlushExecutor  = executor;
  _autoFlushProjectId = projectId;
  _autoFlushDayId     = shootingDayId;
}

window.addEventListener('online', () => {
  if (_autoFlushExecutor && _autoFlushProjectId) {
    flush(_autoFlushProjectId, _autoFlushDayId, _autoFlushExecutor).catch(() => {});
  }
});

// ─── Helper: build payloads for each op type ─────────────────────────────────

export const OutboxPayload = {
  roll: (sceneId: string, shotId: string) => ({ sceneId, shotId }),

  cut: (
    status: Take['status'],
    takeNumber: number,
    duration: number,
    notes?: string,
    camera?: string,
    lens?: string,
    fps?: number,
    iso?: number,
    ndFilter?: string,
  ) => ({ status, takeNumber, duration, notes, camera, lens, fps, iso, ndFilter }),

  circleTake: (takeId: string, userId: string) => ({ takeId, userId }),

  addNote: (note: ContinuityNote) => ({ ...note }),

  setupComplete: (sceneId: string, shotId: string, userId: string) => ({ sceneId, shotId, userId }),

  adjustTake: (currentTake: number, delta: number) => ({ currentTake, delta }),
};
