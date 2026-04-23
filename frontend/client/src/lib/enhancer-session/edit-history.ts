/**
 * Per-image bounded edit history for undo / redo.
 *
 * Shape:
 *   entries   — ring of EnhancementSettings snapshots, oldest → newest
 *   index     — pointer to the "current" snapshot in entries. Undo moves
 *               the pointer backward; redo moves it forward. Branching
 *               (edits after an undo) truncates every future entry.
 *
 * An empty history has index = -1 and entries = []. The first commit
 * pushes to index 0. Callers should commit after an interactive gesture
 * finishes (slider mouseup, paste, AI apply) rather than on every rAF.
 *
 * All functions are pure and immutable. No mutation of input arrays.
 */

import type {
  EditModuleKey,
  EnhancementSettings,
  PerFaceEnhancementPatch,
} from './module-contract';

export const DEFAULT_HISTORY_CAPACITY = 30;

export interface EditHistoryEntry {
  /** Epoch ms at commit time. UI uses this to show "30s ago". */
  at: number;
  /** Snapshot of the image's settings at commit time. */
  settings: EnhancementSettings;
  /** Snapshot of the image's per-face overrides at commit time.
   *  Captured alongside settings so undo restores full scoped state. */
  perFaceOverrides?: Record<number, PerFaceEnhancementPatch>;
  /** Which modules changed vs. the prior entry — purely informational
   *  (shown in the history panel as a short tag). Never read by the
   *  reducer, so drift here is harmless. */
  changedModules: ReadonlyArray<EditModuleKey>;
  /** Optional short label — "AI-forslag", "Lim inn", "Justering", etc. */
  label?: string;
}

export interface EditHistory {
  entries: EditHistoryEntry[];
  index: number;
  capacity: number;
}

export const EMPTY_HISTORY: EditHistory = {
  entries: [],
  index: -1,
  capacity: DEFAULT_HISTORY_CAPACITY,
};

/**
 * Push a new snapshot onto the history. Truncates any entries after the
 * current pointer (standard undo-then-edit branching semantics). Enforces
 * the ring capacity by dropping the oldest entry when at the cap.
 *
 * Returns the history unchanged if the latest entry's settings are
 * structurally identical to the incoming snapshot (no-op guard).
 */
export function pushHistoryEntry(
  history: EditHistory,
  entry: EditHistoryEntry,
): EditHistory {
  const capacity = history.capacity || DEFAULT_HISTORY_CAPACITY;
  const current = history.entries[history.index];
  if (
    current &&
    settingsShallowEqual(current.settings, entry.settings) &&
    overridesEqual(current.perFaceOverrides, entry.perFaceOverrides)
  ) {
    return history;
  }

  const truncated = history.entries.slice(0, history.index + 1);
  truncated.push(entry);
  if (truncated.length > capacity) {
    truncated.splice(0, truncated.length - capacity);
  }
  return {
    entries: truncated,
    index: truncated.length - 1,
    capacity,
  };
}

export function canUndo(history: EditHistory): boolean {
  return history.index > 0;
}

export function canRedo(history: EditHistory): boolean {
  return history.index >= 0 && history.index < history.entries.length - 1;
}

export function stepUndo(history: EditHistory): { history: EditHistory; snapshot: EditHistoryEntry | null } {
  if (!canUndo(history)) {
    return { history, snapshot: history.entries[history.index] ?? null };
  }
  const next = { ...history, index: history.index - 1 };
  return { history: next, snapshot: next.entries[next.index] };
}

export function stepRedo(history: EditHistory): { history: EditHistory; snapshot: EditHistoryEntry | null } {
  if (!canRedo(history)) {
    return { history, snapshot: history.entries[history.index] ?? null };
  }
  const next = { ...history, index: history.index + 1 };
  return { history: next, snapshot: next.entries[next.index] };
}

export function clearHistory(history: EditHistory, keepCapacity = history.capacity): EditHistory {
  return { entries: [], index: -1, capacity: keepCapacity || DEFAULT_HISTORY_CAPACITY };
}

/** Deep-ish equality across all known settings keys. Walks nested objects
 *  (only hsl today) one level deep. Keeps the reducer's no-op guard cheap
 *  and correct. */
function overridesEqual(
  a: Record<number, PerFaceEnhancementPatch> | undefined,
  b: Record<number, PerFaceEnhancementPatch> | undefined,
): boolean {
  // Treat missing === empty for backwards compatibility with older
  // history entries that were written before per-face state existed.
  const ao = a ?? {};
  const bo = b ?? {};
  const akeys = Object.keys(ao);
  const bkeys = Object.keys(bo);
  if (akeys.length !== bkeys.length) return false;
  for (const key of akeys) {
    const ak = ao[Number(key)];
    const bk = bo[Number(key)];
    if (!bk) return false;
    const sk1 = Object.keys(ak);
    const sk2 = Object.keys(bk);
    if (sk1.length !== sk2.length) return false;
    for (const k of sk1) {
      if ((ak as Record<string, unknown>)[k] !== (bk as Record<string, unknown>)[k]) return false;
    }
  }
  return true;
}

function settingsShallowEqual(a: EnhancementSettings, b: EnhancementSettings): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as Array<keyof EnhancementSettings>;
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (av === bv) continue;
    if (av && bv && typeof av === 'object' && typeof bv === 'object') {
      const ao = av as Record<string, unknown>;
      const bo = bv as Record<string, unknown>;
      const inner = new Set([...Object.keys(ao), ...Object.keys(bo)]);
      for (const k of inner) {
        const aInner = ao[k];
        const bInner = bo[k];
        if (aInner === bInner) continue;
        if (
          aInner && bInner && typeof aInner === 'object' && typeof bInner === 'object' &&
          JSON.stringify(aInner) === JSON.stringify(bInner)
        ) {
          continue;
        }
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}
