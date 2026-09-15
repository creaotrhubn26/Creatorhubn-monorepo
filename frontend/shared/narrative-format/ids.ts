/**
 * Id-håndtering mellom våre prefiksede ider (`nel_<uuid>`) og Arcweave.
 *
 * Eksport: prefikset strippes (Arcweave-plugins forventer uuid-lignende ider);
 * ved kollisjon på tvers av samlinger beholdes hele originalen — eksporten er
 * deterministisk for samme graf. Import: nye prefiksede ider fra en
 * injiserbar fabrikk (deterministisk i tester).
 */

export const ID_PREFIXES = {
  board: 'nbd',
  element: 'nel',
  connection: 'ncn',
  component: 'ncp',
  attribute: 'nat',
  variable: 'nvr',
  asset: 'nas',
  condition: 'cond',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

const PREFIX_RE = /^[a-z]{2,5}_(.+)$/;

export interface IdMapper {
  /** Stabil eksport-id for en intern id. */
  map: (internalId: string) => string;
  /** Alle registrerte mappinger (intern → eksport). */
  entries: () => Array<[string, string]>;
}

export function createExportIdMapper(): IdMapper {
  const forward = new Map<string, string>();
  const used = new Set<string>();
  return {
    map(internalId) {
      const existing = forward.get(internalId);
      if (existing) return existing;
      const m = PREFIX_RE.exec(internalId);
      let candidate = m ? m[1] : internalId;
      if (used.has(candidate)) candidate = internalId;
      if (used.has(candidate)) {
        let n = 2;
        while (used.has(`${candidate}-${n}`)) n += 1;
        candidate = `${candidate}-${n}`;
      }
      used.add(candidate);
      forward.set(internalId, candidate);
      return candidate;
    },
    entries: () => [...forward.entries()],
  };
}

/**
 * Id-fabrikk. `sourceId` er kildens id (f.eks. Arcweave-id) når importen kjenner den,
 * så en fabrikk kan velge å bevare den (runtime-pakken gjør det).
 */
export type IdFactory = (kind: IdKind, sourceId?: string) => string;

function randomUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback (eldre miljøer): ikke kryptografisk, men unik nok for import-ider.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const defaultIdFactory: IdFactory = (kind) => `${ID_PREFIXES[kind]}_${randomUuid()}`;

/** Deterministisk fabrikk for tester/snapshots. */
export function createSequentialIdFactory(): IdFactory {
  const counters = new Map<IdKind, number>();
  return (kind) => {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    return `${ID_PREFIXES[kind]}_${String(n).padStart(4, '0')}`;
  };
}

/** Deterministisk mappe-id fra sti (eksport av mappetrær). */
export function folderIdForPath(path: string, used: Set<string>): string {
  const slug = path
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\//g, '--')
    .replace(/^-+|-+$/g, '');
  let candidate = `folder-${slug || 'root'}`;
  if (used.has(candidate)) {
    let n = 2;
    while (used.has(`${candidate}-${n}`)) n += 1;
    candidate = `${candidate}-${n}`;
  }
  used.add(candidate);
  return candidate;
}
