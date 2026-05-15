/**
 * Standard movement-kategorier for video-annotasjoner — DanceAnnotate-paritet.
 *
 * Hver kategori har:
 *  - id: stabil maskin-id (lagres i annotation.category)
 *  - label: norsk visnings-tekst
 *  - color: hex for chip + timeline-spor
 *  - shortcut: numerisk tastatur-snarvei (1-5)
 *
 * Bruk:
 *   import { DANCE_MOVEMENT_CATEGORIES, categoryById } from './danceMovementCategories';
 *   const cat = categoryById('steps');
 *   <Chip sx={{ bgcolor: cat.color }} label={cat.label} />
 *
 * Listen er bevisst kort. Brukerne kan legge til prosjekt-spesifikke
 * etiketter (Walk, Chassé, …) som annotation.body — kategorien
 * grupperer dem på timeline-sporet.
 */

export interface MovementCategory {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly shortcut: string;
}

export const DANCE_MOVEMENT_CATEGORIES: readonly MovementCategory[] = [
  { id: 'steps', label: 'Steps', color: '#a78bfa', shortcut: '1' },
  { id: 'arms',  label: 'Arms',  color: '#34d399', shortcut: '2' },
  { id: 'body',  label: 'Body',  color: '#fbbf24', shortcut: '3' },
  { id: 'jumps', label: 'Jumps', color: '#60a5fa', shortcut: '4' },
  { id: 'turns', label: 'Turns', color: '#f472b6', shortcut: '5' },
] as const;

const BY_ID: Record<string, MovementCategory> = Object.fromEntries(
  DANCE_MOVEMENT_CATEGORIES.map((c) => [c.id, c]),
);

const BY_SHORTCUT: Record<string, MovementCategory> = Object.fromEntries(
  DANCE_MOVEMENT_CATEGORIES.map((c) => [c.shortcut, c]),
);

export function categoryById(id: string | null | undefined): MovementCategory | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}

export function categoryByShortcut(key: string): MovementCategory | null {
  return BY_SHORTCUT[key] ?? null;
}
