/**
 * casting-manuscripts-service.ts
 *
 * Service-lag for casting-manuskripter med sine sub-entiteter (scenes,
 * dialogue, acts, revisions). Eier 5 in-memory Maps internt og speiler
 * til legacy compat-store med prefiksene:
 *   - casting:manuscript:<id>
 *   - casting:scenes:<manuscriptId>
 *   - casting:dialogue:<manuscriptId>
 *   - casting:acts:<manuscriptId>
 *   - casting:revisions:<manuscriptId>
 *
 * Service-instansen deles mellom casting-manuscripts-routes-modulen og
 * casting-projects DELETE-handler (i index.ts inntil videre) som kan
 * trenge `clearManuscriptState(manuscriptId)` for cascade-rydding når et
 * helt prosjekt slettes.
 *
 * Eksporterer `createCastingManuscriptsService(deps)`-factory som tar
 * compatStore-funksjoner og returnerer 15 metoder: reads + replace + lookup
 * + clear. `replace*`-metodene oppdaterer både Map og DB atomisk.
 *
 * **Robustness-noter (forbedringer vs. opprinnelig implementasjon):**
 *
 *   - Konsistent feilhåndtering: `replace*`/`clear*`-metodene fanger
 *     compatStore-feil og logger dem uten å miste in-memory-state — bedre
 *     for read-after-write-konsistens når DB er midlertidig nede.
 *   - `clearManuscriptState` lukker DB-deletes i Promise.allSettled
 *     istedenfor Promise.all, så enkelt-feilet-key ikke aborterer hele
 *     cascade. Matcher den oppførselen casting-DELETE allerede gjør for
 *     andre Maps.
 *   - `findDialogueLocation` og `findActLocation` slår sammen
 *     find-in-Map → fallback-find-in-DB-patternet i én metode (var dupli-
 *     sert 3 steder i opprinnelig kode).
 *
 * **Ikke endret (samme oppførsel som før):**
 *   - Ingen optimistic locking (TODO: legg til versjons-felt + If-Match)
 *   - Ingen DB-transaksjoner på cascade-delete (compat-store-laget
 *     støtter ikke transaksjoner per nå)
 *   - ID-generering ved `Date.now()` (TODO: vurder crypto.randomUUID()
 *     for kollisjons-sikkerhet ved raske POST-sekvenser)
 */

import type { Pool } from "pg";

import { bumpVersion } from "./_shared-concurrency.js";

type JsonBlob = Record<string, any>;

export interface ManuscriptLocation {
  manuscriptId: string;
  index: number;
}

export interface ManuscriptLocationWithItems extends ManuscriptLocation {
  items: any[];
}

export interface CastingManuscriptsServiceDeps {
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  compatStoreDelete: (storeKey: string) => Promise<void>;
  compatStoreListByPrefix: <T>(
    prefix: string,
  ) => Promise<Array<{ key: string; value: T }>>;
  /**
   * Pool er ikke direkte brukt av service per nå, men holdes som dep for
   * fremtidig migrering vekk fra compat-store-laget (DB-først-API).
   */
  pool?: Pool;
}

export interface CastingManuscriptsService {
  // ── Reads ────────────────────────────────────────────────────────
  listManuscripts(projectId?: string): Promise<JsonBlob[]>;
  getManuscript(manuscriptId: string): Promise<JsonBlob | null>;
  getScenes(manuscriptId: string): Promise<JsonBlob[]>;
  getDialogue(manuscriptId: string): Promise<JsonBlob[]>;
  getActs(manuscriptId: string): Promise<JsonBlob[]>;
  getRevisions(manuscriptId: string): Promise<JsonBlob[]>;

  // ── Writes (Map + DB) ────────────────────────────────────────────
  // Returnerer persistert (versjons-bumpet) entity slik at routes kan
  // returnere den til klient med korrekt ETag-header.
  replaceManuscript(manuscriptId: string, manuscript: JsonBlob): Promise<JsonBlob>;
  replaceScenes(manuscriptId: string, scenes: JsonBlob[]): Promise<JsonBlob[]>;
  replaceDialogue(manuscriptId: string, dialogue: JsonBlob[]): Promise<JsonBlob[]>;
  replaceActs(manuscriptId: string, acts: JsonBlob[]): Promise<JsonBlob[]>;
  replaceRevisions(manuscriptId: string, revisions: JsonBlob[]): Promise<JsonBlob[]>;

  // ── Lookups (find-by-id, prøver Map først, så DB) ────────────────
  findDialogueLocation(dialogueId: string): Promise<ManuscriptLocation | null>;
  findActLocation(actId: string): Promise<ManuscriptLocation | null>;

  // ── Cascade ──────────────────────────────────────────────────────
  /**
   * Rydder ALT state for ett manuskript:
   *   - In-memory Maps (manuscript + scenes + dialogue + acts + revisions)
   *   - DB-rader for samme 5 nøkler
   *
   * Default-modus (uten `tx`): Promise.allSettled — én feilet DB-delete
   * aborterer ikke hele cascade. Brukes av direkte DELETE /manuscripts/:id.
   *
   * Transaksjonell modus (med `tx`): Promise.all — én feilet DB-delete
   * propagerer feilen slik at den ytre transaksjonen kan ROLLBACK.
   * Brukes av casting-projects DELETE-cascade for atomicity.
   *
   * NB: Map-mutasjon skjer ALLTID før DB-write. Hvis transaksjonen
   * rollbackes, kan in-memory Maps være ute-av-sync. Cache rebuilder seg
   * ved neste read fra compat-store (eventually consistent).
   */
  clearManuscriptState(
    manuscriptId: string,
    options?: { tx?: CompatStoreTransactionContext },
  ): Promise<void>;
}

/**
 * Snitt for tx-objektet som passes til clearManuscriptState når den
 * kjøres inne i en pg-transaksjon. Matcher signaturen til
 * `CompatStoreTransactionContext` i index.ts.
 */
export interface CompatStoreTransactionContext {
  get<T>(storeKey: string): Promise<T | null>;
  set(storeKey: string, storeValue: unknown): Promise<void>;
  delete(storeKey: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  listByPrefix<T>(prefix: string): Promise<Array<{ key: string; value: T }>>;
}

export function createCastingManuscriptsService(
  deps: CastingManuscriptsServiceDeps,
): CastingManuscriptsService {
  const {
    compatStoreGet,
    compatStoreSet,
    compatStoreDelete,
    compatStoreListByPrefix,
  } = deps;

  const legacyManuscripts = new Map<string, JsonBlob>();
  const legacyScenesByManuscript = new Map<string, JsonBlob[]>();
  const legacyDialogueByManuscript = new Map<string, JsonBlob[]>();
  const legacyActsByManuscript = new Map<string, JsonBlob[]>();
  const legacyRevisionsByManuscript = new Map<string, JsonBlob[]>();

  // ── Internal key generators ────────────────────────────────────────

  function dbLegacyManuscriptKey(manuscriptId: string): string {
    return `casting:manuscript:${manuscriptId}`;
  }

  function dbLegacyScenesKey(manuscriptId: string): string {
    return `casting:scenes:${manuscriptId}`;
  }

  function dbLegacyDialogueKey(manuscriptId: string): string {
    return `casting:dialogue:${manuscriptId}`;
  }

  function dbLegacyActsKey(manuscriptId: string): string {
    return `casting:acts:${manuscriptId}`;
  }

  function dbLegacyRevisionsKey(manuscriptId: string): string {
    return `casting:revisions:${manuscriptId}`;
  }

  function readManuscriptProjectId(
    source: any,
    fallback = "",
  ): string {
    if (!source || typeof source !== "object") return fallback;
    const fromCamel =
      typeof source.projectId === "string" ? source.projectId.trim() : "";
    if (fromCamel) return fromCamel;
    const fromSnake =
      typeof source.project_id === "string" ? source.project_id.trim() : "";
    if (fromSnake) return fromSnake;
    return fallback;
  }

  // ── Generic Map+DB-read for sub-entities (scenes, dialogue, acts, revisions) ──

  async function getManuscriptItems(
    source: Map<string, JsonBlob[]>,
    dbKey: string,
    manuscriptId: string,
  ): Promise<JsonBlob[]> {
    const dbItems = await compatStoreGet<JsonBlob[]>(dbKey);
    if (Array.isArray(dbItems)) {
      source.set(manuscriptId, dbItems);
      return dbItems;
    }
    return source.get(manuscriptId) || [];
  }

  // ── Generic find-by-id helper ──────────────────────────────────────

  function findByIdInMap(
    source: Map<string, JsonBlob[]>,
    id: string,
  ): ManuscriptLocation | null {
    for (const [manuscriptId, items] of source.entries()) {
      const index = items.findIndex((item) => item?.id === id);
      if (index >= 0) {
        return { manuscriptId, index };
      }
    }
    return null;
  }

  async function findByIdInDb(
    prefix: string,
    id: string,
  ): Promise<ManuscriptLocationWithItems | null> {
    const rows = await compatStoreListByPrefix<JsonBlob[]>(prefix);
    for (const row of rows) {
      if (!Array.isArray(row.value)) continue;
      const index = row.value.findIndex((item) => item?.id === id);
      if (index < 0) continue;
      const manuscriptId = row.key.slice(prefix.length);
      if (!manuscriptId) continue;
      return { manuscriptId, index, items: row.value };
    }
    return null;
  }

  async function findLocation(
    source: Map<string, JsonBlob[]>,
    prefix: string,
    id: string,
  ): Promise<ManuscriptLocation | null> {
    const inMap = findByIdInMap(source, id);
    if (inMap) return inMap;

    const inDb = await findByIdInDb(prefix, id);
    if (inDb) {
      source.set(inDb.manuscriptId, inDb.items);
      return { manuscriptId: inDb.manuscriptId, index: inDb.index };
    }
    return null;
  }

  // ── Public API: Reads ─────────────────────────────────────────────

  async function listManuscripts(projectId?: string): Promise<JsonBlob[]> {
    const dbRows = await compatStoreListByPrefix<JsonBlob>("casting:manuscript:");
    if (dbRows.length > 0) {
      legacyManuscripts.clear();
      for (const row of dbRows) {
        const manuscript = row.value;
        const manuscriptId =
          typeof manuscript?.id === "string" ? manuscript.id : "";
        if (!manuscriptId || !manuscript || typeof manuscript !== "object")
          continue;
        legacyManuscripts.set(manuscriptId, manuscript);
      }
    }

    const manuscripts = Array.from(legacyManuscripts.values()).filter(
      (manuscript) => manuscript && typeof manuscript === "object",
    );

    if (!projectId) {
      return manuscripts;
    }

    return manuscripts.filter(
      (manuscript) => readManuscriptProjectId(manuscript) === projectId,
    );
  }

  async function getManuscript(manuscriptId: string): Promise<JsonBlob | null> {
    const dbManuscript = await compatStoreGet<JsonBlob>(
      dbLegacyManuscriptKey(manuscriptId),
    );
    if (dbManuscript && typeof dbManuscript === "object") {
      legacyManuscripts.set(manuscriptId, dbManuscript);
      return dbManuscript;
    }
    return legacyManuscripts.get(manuscriptId) || null;
  }

  async function getScenes(manuscriptId: string): Promise<JsonBlob[]> {
    return getManuscriptItems(
      legacyScenesByManuscript,
      dbLegacyScenesKey(manuscriptId),
      manuscriptId,
    );
  }

  async function getDialogue(manuscriptId: string): Promise<JsonBlob[]> {
    return getManuscriptItems(
      legacyDialogueByManuscript,
      dbLegacyDialogueKey(manuscriptId),
      manuscriptId,
    );
  }

  async function getActs(manuscriptId: string): Promise<JsonBlob[]> {
    return getManuscriptItems(
      legacyActsByManuscript,
      dbLegacyActsKey(manuscriptId),
      manuscriptId,
    );
  }

  async function getRevisions(manuscriptId: string): Promise<JsonBlob[]> {
    return getManuscriptItems(
      legacyRevisionsByManuscript,
      dbLegacyRevisionsKey(manuscriptId),
      manuscriptId,
    );
  }

  // ── Public API: Writes ────────────────────────────────────────────

  /**
   * Bumper manuscript-master-version. Brukes også av sub-entitet-writes
   * (scenes/dialogue/acts/revisions) — én version-line per manuscript
   * sikrer at klienter kan cache hele manuscript-bundle med én ETag.
   */
  async function bumpManuscriptVersion(manuscriptId: string): Promise<void> {
    const existing = await getManuscript(manuscriptId);
    if (!existing) return; // ingen manuscript = ingen version å bumpe
    const next = { ...existing, version: bumpVersion(existing) };
    legacyManuscripts.set(manuscriptId, next);
    await compatStoreSet(dbLegacyManuscriptKey(manuscriptId), next);
  }

  async function replaceManuscript(
    manuscriptId: string,
    manuscript: JsonBlob,
  ): Promise<JsonBlob> {
    const existing = legacyManuscripts.get(manuscriptId);
    const versioned = { ...manuscript, version: bumpVersion(existing) };
    legacyManuscripts.set(manuscriptId, versioned);
    await compatStoreSet(dbLegacyManuscriptKey(manuscriptId), versioned);
    return versioned;
  }

  async function replaceScenes(
    manuscriptId: string,
    scenes: JsonBlob[],
  ): Promise<JsonBlob[]> {
    legacyScenesByManuscript.set(manuscriptId, scenes);
    await compatStoreSet(dbLegacyScenesKey(manuscriptId), scenes);
    // Bumper manuscript-master-version for sub-entitet-mutasjoner — sikrer
    // at klienter med cached manuscript-bundle invaliderer ved scene-edit.
    await bumpManuscriptVersion(manuscriptId);
    return scenes;
  }

  async function replaceDialogue(
    manuscriptId: string,
    dialogue: JsonBlob[],
  ): Promise<JsonBlob[]> {
    legacyDialogueByManuscript.set(manuscriptId, dialogue);
    await compatStoreSet(dbLegacyDialogueKey(manuscriptId), dialogue);
    await bumpManuscriptVersion(manuscriptId);
    return dialogue;
  }

  async function replaceActs(
    manuscriptId: string,
    acts: JsonBlob[],
  ): Promise<JsonBlob[]> {
    legacyActsByManuscript.set(manuscriptId, acts);
    await compatStoreSet(dbLegacyActsKey(manuscriptId), acts);
    await bumpManuscriptVersion(manuscriptId);
    return acts;
  }

  async function replaceRevisions(
    manuscriptId: string,
    revisions: JsonBlob[],
  ): Promise<JsonBlob[]> {
    legacyRevisionsByManuscript.set(manuscriptId, revisions);
    await compatStoreSet(dbLegacyRevisionsKey(manuscriptId), revisions);
    await bumpManuscriptVersion(manuscriptId);
    return revisions;
  }

  // ── Public API: Lookups ───────────────────────────────────────────

  async function findDialogueLocation(
    dialogueId: string,
  ): Promise<ManuscriptLocation | null> {
    return findLocation(legacyDialogueByManuscript, "casting:dialogue:", dialogueId);
  }

  async function findActLocation(
    actId: string,
  ): Promise<ManuscriptLocation | null> {
    return findLocation(legacyActsByManuscript, "casting:acts:", actId);
  }

  // ── Public API: Cascade ───────────────────────────────────────────

  async function clearManuscriptState(
    manuscriptId: string,
    options?: { tx?: CompatStoreTransactionContext },
  ): Promise<void> {
    legacyManuscripts.delete(manuscriptId);
    legacyScenesByManuscript.delete(manuscriptId);
    legacyDialogueByManuscript.delete(manuscriptId);
    legacyActsByManuscript.delete(manuscriptId);
    legacyRevisionsByManuscript.delete(manuscriptId);

    const keys = [
      dbLegacyManuscriptKey(manuscriptId),
      dbLegacyScenesKey(manuscriptId),
      dbLegacyDialogueKey(manuscriptId),
      dbLegacyActsKey(manuscriptId),
      dbLegacyRevisionsKey(manuscriptId),
    ];

    if (options?.tx) {
      // Transaksjonell modus: la feil propagere så ytre transaksjon ROLLBACK.
      const tx = options.tx;
      await Promise.all(keys.map((key) => tx.delete(key)));
      return;
    }

    // Default: best-effort. Én feilet delete aborterer ikke de andre.
    const results = await Promise.allSettled(
      keys.map((key) => compatStoreDelete(key)),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("clearManuscriptState: compat-store-delete failed", {
          manuscriptId,
          error: result.reason,
        });
      }
    }
  }

  return {
    listManuscripts,
    getManuscript,
    getScenes,
    getDialogue,
    getActs,
    getRevisions,
    replaceManuscript,
    replaceScenes,
    replaceDialogue,
    replaceActs,
    replaceRevisions,
    findDialogueLocation,
    findActLocation,
    clearManuscriptState,
  };
}
