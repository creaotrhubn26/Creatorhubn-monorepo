/**
 * liveSetPermissionsService.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Pro-tier role-based permission layer for Live Set Mode.
 *
 * Roles follow the Norwegian film production hierarchy:
 *
 *   admin           — full access (DevOps / IT)
 *   showrunner      — read-only view (can export, can't log)
 *   director        — ROLL/CUT + view (cannot circle takes, cannot export)
 *   script_sup      — full take + note logging (circle/print, add notes, export)
 *   ac              — can update camera metadata only
 *   producer        — read-only + export
 *   guest           — read-only, no export
 *
 * Usage:
 *   const can = buildCan('script_sup');
 *   if (can.roll)      { ... }
 *   if (can.circleTake){ ... }
 */

// ─── Role enum ────────────────────────────────────────────────────────────────

export type LiveSetRole =
  | 'admin'
  | 'showrunner'
  | 'director'
  | 'script_sup'
  | 'ac'
  | 'producer'
  | 'guest';

// ─── Permission set ───────────────────────────────────────────────────────────

export interface LiveSetCan {
  /** Start rolling (ROLL button) */
  roll:             boolean;
  /** Call cut (any status — good/circle/print/bad) */
  cut:              boolean;
  /** Circle or Print a take */
  circleTake:       boolean;
  /** Add / edit continuity notes */
  addNote:          boolean;
  /** Adjust current take number (± 1 buttons) */
  adjustTake:       boolean;
  /** Update camera metadata (lens, fps, iso, nd) */
  updateCameraMetadata: boolean;
  /** Mark a setup complete and advance to next */
  completeSetup:    boolean;
  /** View the activity feed and stats */
  viewFeed:         boolean;
  /** Export PDFs / CSVs */
  export:           boolean;
  /** Open settings dialog */
  settings:         boolean;
}

// ─── Permission matrix ────────────────────────────────────────────────────────

const MATRIX: Record<LiveSetRole, LiveSetCan> = {
  admin: {
    roll: true, cut: true, circleTake: true, addNote: true,
    adjustTake: true, updateCameraMetadata: true, completeSetup: true,
    viewFeed: true, export: true, settings: true,
  },
  showrunner: {
    roll: false, cut: false, circleTake: false, addNote: false,
    adjustTake: false, updateCameraMetadata: false, completeSetup: false,
    viewFeed: true, export: true, settings: false,
  },
  director: {
    roll: true, cut: true, circleTake: false, addNote: false,
    adjustTake: true, updateCameraMetadata: false, completeSetup: true,
    viewFeed: true, export: false, settings: true,
  },
  script_sup: {
    roll: false, cut: false, circleTake: true, addNote: true,
    adjustTake: true, updateCameraMetadata: false, completeSetup: false,
    viewFeed: true, export: true, settings: false,
  },
  ac: {
    roll: false, cut: false, circleTake: false, addNote: false,
    adjustTake: false, updateCameraMetadata: true, completeSetup: false,
    viewFeed: true, export: false, settings: false,
  },
  producer: {
    roll: false, cut: false, circleTake: false, addNote: false,
    adjustTake: false, updateCameraMetadata: false, completeSetup: false,
    viewFeed: true, export: true, settings: false,
  },
  guest: {
    roll: false, cut: false, circleTake: false, addNote: false,
    adjustTake: false, updateCameraMetadata: false, completeSetup: false,
    viewFeed: true, export: false, settings: false,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the full permission set for a given role. */
export function buildCan(role: LiveSetRole): LiveSetCan {
  return MATRIX[role] ?? MATRIX.guest;
}

/** True if the role is recognised. */
export function isValidRole(role: string): role is LiveSetRole {
  return role in MATRIX;
}

/** Human-readable Norwegian role label. */
export const ROLE_LABELS: Record<LiveSetRole, string> = {
  admin:       'Administrator',
  showrunner:  'Showrunner',
  director:    'Regissør',
  script_sup:  'Script Supervisor',
  ac:          'Kameraassistent (AC)',
  producer:    'Produsent',
  guest:       'Gjest (lese)',
};

/** Returns a tooltip string explaining why a button is disabled for a role. */
export function disabledReason(
  action: keyof LiveSetCan,
  role: LiveSetRole,
): string | undefined {
  const can = buildCan(role);
  if (can[action]) return undefined;
  return `Tilgangen din (${ROLE_LABELS[role]}) tillater ikke "${String(action)}"`;
}
