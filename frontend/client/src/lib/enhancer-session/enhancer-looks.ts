import type { EnhancementSettings } from './module-contract';

/**
 * User-defined "Looks" — named snapshots of a full EnhancementSettings
 * recipe (sliders + HSL + LUT + portrait/subject settings) that a
 * photographer can save once and re-apply across a whole shoot for a
 * consistent signature edit.
 *
 * Persisted client-side in localStorage so it works without a backend
 * round-trip; the shape is intentionally a plain settings snapshot so a
 * future server-backed catalogue can adopt it unchanged.
 */
export interface SavedLook {
  id: string;
  name: string;
  settings: EnhancementSettings;
  createdAt: number;
}

const STORAGE_KEY = 'creatorhub-photo-enhancer-looks';

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to timestamp id */
  }
  return `look-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function loadLooks(): SavedLook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedLook =>
        Boolean(entry) &&
        typeof (entry as SavedLook).id === 'string' &&
        typeof (entry as SavedLook).name === 'string' &&
        Boolean((entry as SavedLook).settings),
    );
  } catch {
    return [];
  }
}

function persist(looks: SavedLook[]): SavedLook[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(looks));
  } catch {
    /* storage full / unavailable — keep the in-memory copy */
  }
  return looks;
}

/** Add (or overwrite, by case-insensitive name) a Look and return the new list. */
export function saveLook(existing: SavedLook[], name: string, settings: EnhancementSettings): SavedLook[] {
  const trimmed = name.trim();
  if (!trimmed) return existing;
  const withoutDuplicate = existing.filter((look) => look.name.toLowerCase() !== trimmed.toLowerCase());
  const next: SavedLook = {
    id: makeId(),
    name: trimmed,
    // Deep-clone so later edits to live settings don't mutate the saved Look.
    settings: JSON.parse(JSON.stringify(settings)) as EnhancementSettings,
    createdAt: Date.now(),
  };
  return persist([next, ...withoutDuplicate]);
}

export function deleteLook(existing: SavedLook[], id: string): SavedLook[] {
  return persist(existing.filter((look) => look.id !== id));
}
