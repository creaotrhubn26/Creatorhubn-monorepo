/**
 * legacyStorageMigrator — engangs-migrering av sårbare localStorage-keys
 * til versionedStorage-envelope-format.
 *
 * Stabilitetsaudit § 7.2: workspaceState, pinnedProjects og story-logic-keys
 * blir korrupt over tid pga schema-endringer. Vi har createVersionedStorage
 * (Sprint 6.10), men eksisterende lesere i mega-CastingPlannerPanel går
 * gjennom settingsService som er ikke-versjonert.
 *
 * Denne migratoren:
 *   1. Kjøres ÉN gang ved oppstart (idempotent)
 *   2. Leser kjente sårbare keys
 *   3. Sjekker om de allerede har envelope (__v) → hopp over
 *   4. Hvis ikke: wrapper i {__v: 1, data: <original>}
 *   5. Lagrer tilbake — settingsService-lesere fortsetter å fungere fordi
 *      de bare leser .data-felter de allerede vet om (?? null fallback)
 *
 * Etter migrering: nye versjoner kan opp-versjoneres ved å:
 *   - Sjekke om __v < target → migrer steg-for-steg
 *
 * Best-effort: alle feil sluker. Hvis migrering feiler, status quo bevares.
 *
 * Kalles fra main.tsx FØR React rendrer.
 */

const MIGRATION_VERSION_MARKER_KEY = "_legacy-storage-migration-version";
const CURRENT_MIGRATION_VERSION = 1;

interface KeyMigration {
  /** Eksakt localStorage-key (eller prefix hvis prefixMatch=true). */
  key: string;
  /** Hvis true, matcher alle keys som STARTER MED `key`. */
  prefixMatch?: boolean;
  /** Sjekk om verdien allerede har envelope (returnerer true = hopp over). */
  isAlreadyVersioned?: (parsed: unknown) => boolean;
}

const SAFE_KEY_PATTERNS: KeyMigration[] = [
  // CastingPlannerPanel-state (via settingsService med projectId-prefix)
  { key: "role_room_workspace_state", prefixMatch: true },
  { key: "role-room-settings:", prefixMatch: true },

  // Story Logic cache + sync meta
  { key: "story-logic-data:", prefixMatch: true },
  { key: "story-logic-sync-meta:", prefixMatch: true },

  // Producer
  { key: "producer-workflow-state:", prefixMatch: true },

  // Storyboard
  { key: "storyboard-library:", prefixMatch: true },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAlreadyVersionedEnvelope(parsed: unknown): boolean {
  return isObject(parsed) && typeof parsed["__v"] === "number" && "data" in parsed;
}

function safeGetAllLocalStorageKeys(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function keyMatchesPattern(key: string, pattern: KeyMigration): boolean {
  if (pattern.prefixMatch) return key.startsWith(pattern.key);
  return key === pattern.key;
}

export interface MigrationReport {
  inspected: number;
  migrated: number;
  skippedAlreadyVersioned: number;
  skippedCorrupted: number;
}

/**
 * Hovedmigrator. Idempotent — sjekker MIGRATION_VERSION_MARKER_KEY først
 * og gjør ingenting hvis den allerede er på current-versjon.
 */
export function runLegacyStorageMigration(): MigrationReport {
  const report: MigrationReport = {
    inspected: 0,
    migrated: 0,
    skippedAlreadyVersioned: 0,
    skippedCorrupted: 0,
  };

  if (typeof window === "undefined") return report;

  const markerRaw = safeRead(MIGRATION_VERSION_MARKER_KEY);
  const markerVersion = markerRaw ? Number(markerRaw) : 0;
  if (markerVersion >= CURRENT_MIGRATION_VERSION) {
    return report; // Allerede migrert
  }

  const allKeys = safeGetAllLocalStorageKeys();
  for (const key of allKeys) {
    if (!SAFE_KEY_PATTERNS.some((p) => keyMatchesPattern(key, p))) continue;
    report.inspected += 1;

    const raw = safeRead(key);
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      report.skippedCorrupted += 1;
      continue;
    }

    if (isAlreadyVersionedEnvelope(parsed)) {
      report.skippedAlreadyVersioned += 1;
      continue;
    }

    // Wrap i envelope. Settings-lesere som leser `.data`-felt kan
    // fortsette uendret hvis vi beholder original-shape under .data;
    // de som leser hele objektet (få) får ekstra `__v` + `data`-wrapper.
    // For å unngå å bryte eksisterende kode beholder vi BÅDE rå-data
    // (compat) OG envelope. Resultat: legacy-lesere fortsetter å virke,
    // nye lesere kan migrere til versioned-pattern.
    const envelope = { __v: 1, data: parsed, _legacyCompatRaw: parsed };
    safeWrite(key, JSON.stringify(envelope));
    report.migrated += 1;
  }

  safeWrite(MIGRATION_VERSION_MARKER_KEY, String(CURRENT_MIGRATION_VERSION));
  return report;
}
