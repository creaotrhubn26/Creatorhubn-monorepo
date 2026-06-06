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
import { danceFlowColors } from './danceFlowTheme';

export interface MovementCategory {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly shortcut: string;
}

export const DANCE_MOVEMENT_CATEGORIES: readonly MovementCategory[] = [
  { id: 'steps', label: 'Steps', color: danceFlowColors.lavender, shortcut: '1' },
  { id: 'arms',  label: 'Arms',  color: danceFlowColors.successPrimary, shortcut: '2' },
  { id: 'body',  label: 'Body',  color: danceFlowColors.gold, shortcut: '3' },
  { id: 'jumps', label: 'Jumps', color: danceFlowColors.infoLight, shortcut: '4' },
  { id: 'turns', label: 'Turns', color: danceFlowColors.pinkAccentLight, shortcut: '5' },
] as const;

const BY_ID: Record<string, MovementCategory> = Object.fromEntries(
  DANCE_MOVEMENT_CATEGORIES.map((c) => [c.id, c]),
);

/**
 * Predefinerte bevegelses-etiketter per kategori (Common Labels-bibliotek).
 * Klikk i UI fyller composer-body med teksten. Listen er en startseed —
 * brukerne kan legge til egne via "Add Label"-knappen.
 */
export const COMMON_LABELS_BY_CATEGORY: Record<string, readonly string[]> = {
  steps: ['Walk', 'Chassé', 'Step', 'Slide', 'Run', 'Kick', 'Stomp'],
  arms:  ['Reach Up', 'Sweep', 'Open', 'Cross', 'Frame', 'Port de Bras'],
  body:  ['Body Roll', 'Contract', 'Arch', 'Body Wave', 'Spiral', 'Tilt'],
  jumps: ['Small Jump', 'Leap', 'Jump', 'Sissone', 'Grand Jeté', 'Sauté'],
  turns: ['Half Turn', 'Full Turn', 'Pirouette', 'Chaîné', 'Fouetté', 'Spotting'],
} as const;

export function commonLabelsFor(categoryId: string | null | undefined): readonly string[] {
  if (!categoryId) return [];
  return COMMON_LABELS_BY_CATEGORY[categoryId] ?? [];
}

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
