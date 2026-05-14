/**
 * versionedStorage — safe localStorage med eksplisitt schema-versjon og
 * deklarativ migrasjons-kjede.
 *
 * Problem: vi cacher mye state i localStorage (workspaceState, pinnedProjects,
 * sync meta, demo-flags). Når strukturen endres må gamle verdier enten
 * migreres eller forkastes. Uten dette har vi sett:
 *   - parsed JSON.parse-feil → app krasjer ved oppstart
 *   - feltnavn endres → undefined fields → null pointer-fall
 *   - korrupte verdier blir hengende for evig
 *
 * Bruk:
 *   const storage = createVersionedStorage<MyShape>({
 *     key: 'role-room:workspace-state',
 *     version: 3,
 *     migrations: {
 *       1: (v: any) => v,  // initial
 *       2: (v) => ({ ...v, newField: 'default' }),
 *       3: (v) => ({ ...v, anotherField: [] }),
 *     },
 *     defaultValue: { ... },
 *   });
 *   const state = storage.read();
 *   storage.write(state);
 */

export type Migration<V = unknown> = (previous: V) => V;

interface VersionedStorageConfig<T> {
  key: string;
  version: number;
  /** Map fra versjon-nummer → migrasjons-funksjon. Versjon `version` MÅ
   * eksistere. Lavere versjoner kjøres i rekkefølge. */
  migrations: Record<number, Migration>;
  defaultValue: T;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Når true, korrupte verdier fjernes i stedet for å returnere default. */
  pruneInvalid?: boolean;
  /** Logger som kalles ved migrering — nyttig for telemetri. */
  onMigrate?: (info: { key: string; fromVersion: number; toVersion: number }) => void;
}

export interface VersionedStorage<T> {
  read: () => T;
  write: (value: T) => void;
  clear: () => void;
  /** Returnerer lagret versjon eller null hvis ingen verdi. */
  getStoredVersion: () => number | null;
}

interface Envelope<T> {
  __v: number;
  data: T;
}

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return (
    typeof value === 'object'
    && value !== null
    && '__v' in value
    && 'data' in value
    && typeof (value as Envelope<T>).__v === 'number'
  );
}

export function createVersionedStorage<T>(config: VersionedStorageConfig<T>): VersionedStorage<T> {
  const {
    key,
    version,
    migrations,
    defaultValue,
    pruneInvalid = false,
    onMigrate,
  } = config;
  const storage = config.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);

  if (!migrations[version]) {
    throw new Error(`createVersionedStorage: mangler migrasjon for target-versjon ${version}`);
  }

  const safeGet = (): string | null => {
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  };
  const safeSet = (value: string): void => {
    try { storage?.setItem(key, value); } catch { /* ignore */ }
  };
  const safeRemove = (): void => {
    try { storage?.removeItem(key); } catch { /* ignore */ }
  };

  const getStoredVersion = (): number | null => {
    const raw = safeGet();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isEnvelope<T>(parsed)) return parsed.__v;
      // Legacy verdi uten envelope — behandles som versjon 0
      return 0;
    } catch {
      return null;
    }
  };

  const read = (): T => {
    const raw = safeGet();
    if (!raw) return defaultValue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (pruneInvalid) safeRemove();
      return defaultValue;
    }

    let storedVersion: number;
    let dataValue: unknown;

    if (isEnvelope<T>(parsed)) {
      storedVersion = parsed.__v;
      dataValue = parsed.data;
    } else {
      // Legacy data — antar versjon 0, rådata er hele objektet
      storedVersion = 0;
      dataValue = parsed;
    }

    if (storedVersion === version) {
      return dataValue as T;
    }

    if (storedVersion > version) {
      // Lagret data er fra fremtidig schema — vi kan ikke trygt nedgradere
      if (pruneInvalid) safeRemove();
      return defaultValue;
    }

    // Migrér steg-for-steg
    let current = dataValue;
    for (let v = storedVersion + 1; v <= version; v += 1) {
      const migration = migrations[v];
      if (!migration) {
        if (pruneInvalid) safeRemove();
        return defaultValue;
      }
      try {
        current = migration(current);
      } catch {
        if (pruneInvalid) safeRemove();
        return defaultValue;
      }
    }

    onMigrate?.({ key, fromVersion: storedVersion, toVersion: version });

    // Persistér migrert verdi så neste lesing er gratis
    write(current as T);
    return current as T;
  };

  const write = (value: T): void => {
    const envelope: Envelope<T> = { __v: version, data: value };
    safeSet(JSON.stringify(envelope));
  };

  const clear = (): void => {
    safeRemove();
  };

  return { read, write, clear, getStoredVersion };
}
