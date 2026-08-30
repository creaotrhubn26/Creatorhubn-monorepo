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
 *   - Hele collection-replace har fortsatt ingen OCC. Per-frame tegnesave
 *     bruker derimot baseUpdatedAt + server-side treveisfletting/409.
 *   - Ingen DB-transaksjoner på cascade-delete (compat-store-laget
 *     støtter ikke transaksjoner per nå)
 *   - ID-generering ved `Date.now()` (TODO: vurder crypto.randomUUID()
 *     for kollisjons-sikkerhet ved raske POST-sekvenser)
 */

import type { Pool } from "pg";

import { bumpVersion } from "./_shared-concurrency.js";
import {
  nativeFrameSourceChangeReason,
  enforceFramePatchAIStaleAuthority,
  preserveCameraMotionEnvelope,
} from "./storyboard-frame-compat.js";
import {
  storyboardPaintoverChanges,
  storyboardPaintoverStateForFrame,
  type StoryboardPaintoverState,
} from "./storyboard-paintover-contract.js";
import {
  applyCameraMotionWriteV1,
  cameraMotionEnvelopePatchV1,
  cameraMotionEnvelopeSnapshotV1,
  cameraMotionFramingFingerprintFromFrameV1,
  revalidateCameraMotionDependencyV1,
  type AppliedCameraMotionWriteV1,
  type ApplyCameraMotionWriteResultV1,
} from "./storyboard-camera-motion.js";
import {
  applyFrameDurationWriteV1,
  makeStoryboardTimingV1Default,
  prepareFrameDurationWriteV1,
  type AppliedFrameDurationV1,
  type FrameDurationWriteErrorCode,
  type StoryboardMediaTimeV1,
} from "./storyboard-shot-duration.js";

type JsonBlob = Record<string, any>;

export interface LockedCompatStoreContext {
  get<T>(storeKey: string): Promise<T | null>;
  setStrict(storeKey: string, storeValue: unknown): Promise<void>;
}

export interface ScenesMutation<T> {
  /** Omit to return a conflict/not-found result without mutating storage. */
  scenes?: JsonBlob[];
  /** Persist the deterministic 25/1 project timing root once. */
  ensureStoryboardTiming?: boolean;
  result: T;
}

export interface FramePatchOptions {
  /** Version and document the editor loaded before making its local change. */
  baseUpdatedAt?: string;
  baseStrokesJSON?: string;
  baseShotFraming?: unknown;
  baseLayerState?: unknown;
  /** Client hint only; the locked service recomputes the actual source diff. */
  sourceDocumentChanged?: boolean;
}

export interface FramePatchResult {
  updatedAt: string;
  /** Stable source token; changes only when drawing/camera source changes. */
  sourceUpdatedAt?: string;
  sourceChanged?: boolean;
  sourceChangeReason?: "shot-framing-changed" | "source-document-changed";
  merged?: boolean;
  strokesJSON?: string;
  conflict?: boolean;
  currentUpdatedAt?: string;
  currentStrokesJSON?: string;
  shotFraming?: unknown;
  layerState?: unknown;
  aiPaintoverState?: StoryboardPaintoverState;
  currentAiPaintoverState?: unknown;
  currentShotFraming?: unknown;
  cameraMotionTrack?: unknown;
  cameraMotionRevision?: number;
  cameraMotionUpdatedAt?: string;
  cameraMotionFingerprint?: string | null;
  cameraMotionBaseFramingFingerprint?: string | null;
  cameraMotionStatus?: string;
  currentLayerState?: unknown;
}
export type FrameCameraMotionPatchResult =
  | ({
      ok: true;
      aiPaintoverState?: StoryboardPaintoverState;
    } & AppliedCameraMotionWriteV1)
  | Extract<ApplyCameraMotionWriteResultV1, { ok: false }>;

export type FrameDurationPatchResult =
  | ({
      ok: true;
      updatedAt: string;
      sourceUpdatedAt?: string;
      cameraMotionTrack?: unknown;
      cameraMotionRevision?: number;
      cameraMotionUpdatedAt?: string;
      cameraMotionFingerprint?: string | null;
      cameraMotionBaseFramingFingerprint?: string | null;
      cameraMotionStatus?: string;
      aiPaintoverState?: StoryboardPaintoverState;
    } & AppliedFrameDurationV1)
  | {
      ok: false;
      error: FrameDurationWriteErrorCode;
      currentShotDuration?: StoryboardMediaTimeV1;
      currentDurationRevision?: number;
    };

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
  // Strict-variant som KASTER ved DB-utilgjengelighet — brukes for
  // tegnedata (scener) så klienten får 503 i stedet for stille minnetap.
  compatStoreSetStrict?: (
    storeKey: string,
    storeValue: unknown,
  ) => Promise<void>;
  /**
   * Cross-process critical section backed by the shared database. Production
   * injects a transaction-scoped advisory lock; tests/legacy deployments may
   * omit it and retain the in-process queue below.
   */
  compatStoreWithKeyLock?: <T>(
    storeKey: string,
    operation: (store: LockedCompatStoreContext) => Promise<T>,
  ) => Promise<T>;
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

// ── Lock state ──────────────────────────────────────────────────────
// Eksplisitt lås for manuskript-redigering. Lagres på manuskript-blobben
// (lockedBy + lockedAt) slik at vi unngår dobbeltkilde med SQL-kolonnene.
// Låsen utløper etter MANUSCRIPT_LOCK_TTL_MS uten heartbeat; en utløpt
// lås blokkerer ikke en ny acquire.

export const MANUSCRIPT_LOCK_TTL_MS = 120_000; // 2 minutter

export interface ManuscriptLockState {
  held: boolean; // true iff lockedBy satt OG ikke utløpt
  lockedBy: string | null;
  lockedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

export function computeManuscriptLockState(
  blob: unknown,
  ttlMs: number = MANUSCRIPT_LOCK_TTL_MS,
): ManuscriptLockState {
  if (!blob || typeof blob !== "object") {
    return {
      held: false,
      lockedBy: null,
      lockedAt: null,
      expiresAt: null,
      isExpired: false,
    };
  }
  const b = blob as Record<string, unknown>;
  const lockedBy =
    typeof b.lockedBy === "string" && b.lockedBy ? b.lockedBy : null;
  const lockedAt =
    typeof b.lockedAt === "string" && b.lockedAt ? b.lockedAt : null;
  if (!lockedBy || !lockedAt) {
    return {
      held: false,
      lockedBy: null,
      lockedAt: null,
      expiresAt: null,
      isExpired: false,
    };
  }
  const lockedAtMs = new Date(lockedAt).getTime();
  if (Number.isNaN(lockedAtMs)) {
    return {
      held: false,
      lockedBy,
      lockedAt: null,
      expiresAt: null,
      isExpired: true,
    };
  }
  const expiresMs = lockedAtMs + ttlMs;
  const isExpired = Date.now() >= expiresMs;
  return {
    held: !isExpired,
    lockedBy,
    lockedAt,
    expiresAt: new Date(expiresMs).toISOString(),
    isExpired,
  };
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
  replaceManuscript(
    manuscriptId: string,
    manuscript: JsonBlob,
  ): Promise<JsonBlob>;
  mutateScenes<T>(
    manuscriptId: string,
    mutation: (current: JsonBlob[]) => ScenesMutation<T>,
  ): Promise<T>;
  /**
   * Per-frame patch: merger fields inn i én storyboard-frame og strict-
   * persisterer scenen. Kutter payload (hele scener POSTes ellers per
   * strøk-lagring) og klobber ikke andre frames i samme scene.
   * null → scene/frame ikke funnet.
   */
  patchFrame(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    fields: JsonBlob,
    options?: FramePatchOptions,
  ): Promise<FramePatchResult | null>;
  /** Canonical camera-motion write with an independent server-owned OCC token. */
  patchFrameCameraMotion(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    request: unknown,
  ): Promise<FrameCameraMotionPatchResult | null>;

  /** Canonical rational duration write with server-owned revision OCC. */
  patchFrameDuration(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    request: unknown,
  ): Promise<FrameDurationPatchResult | null>;
  /** Se implementasjonen: bevarer forrige strokes i drawingHistory. */
  withDrawingHistory(existingFrame: unknown, nextFrame: unknown): unknown;
  replaceDialogue(
    manuscriptId: string,
    dialogue: JsonBlob[],
  ): Promise<JsonBlob[]>;
  replaceActs(manuscriptId: string, acts: JsonBlob[]): Promise<JsonBlob[]>;
  replaceRevisions(
    manuscriptId: string,
    revisions: JsonBlob[],
  ): Promise<JsonBlob[]>;

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

  // ── Lock management ──────────────────────────────────────────────
  // Lås-writes bumper IKKE manuskript-versjonen (replaceManuscript
  // brukes ikke), så heartbeat ugyldiggjør ikke klient-ETags.
  acquireLock(
    manuscriptId: string,
    userId: string,
    options?: { force?: boolean },
  ): Promise<
    | { ok: true; lock: ManuscriptLockState }
    | { ok: false; conflict: ManuscriptLockState }
  >;
  releaseLock(
    manuscriptId: string,
    userId: string,
  ): Promise<{ released: boolean; lock: ManuscriptLockState }>;
  heartbeatLock(
    manuscriptId: string,
    userId: string,
  ): Promise<
    | { ok: true; lock: ManuscriptLockState }
    | { ok: false; conflict: ManuscriptLockState }
  >;
  getLock(manuscriptId: string): Promise<ManuscriptLockState>;
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
  const compatStoreSetStrict = deps.compatStoreSetStrict ?? compatStoreSet;

  const legacyManuscripts = new Map<string, JsonBlob>();
  const legacyScenesByManuscript = new Map<string, JsonBlob[]>();
  const legacyDialogueByManuscript = new Map<string, JsonBlob[]>();
  const legacyActsByManuscript = new Map<string, JsonBlob[]>();
  const legacyRevisionsByManuscript = new Map<string, JsonBlob[]>();
  // Fast local queue avoids redundant lock contention inside one worker.
  // Production additionally injects compatStoreWithKeyLock, which serializes
  // the same critical section across every Render worker through PostgreSQL.
  const sceneMutationTails = new Map<string, Promise<void>>();

  async function serializeSceneMutation<T>(
    manuscriptId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = sceneMutationTails.get(manuscriptId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    sceneMutationTails.set(manuscriptId, tail);
    try {
      return await run;
    } finally {
      if (sceneMutationTails.get(manuscriptId) === tail) {
        sceneMutationTails.delete(manuscriptId);
      }
    }
  }

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

  function readManuscriptProjectId(source: any, fallback = ""): string {
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
    const dbRows = await compatStoreListByPrefix<JsonBlob>(
      "casting:manuscript:",
    );
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
  async function bumpManuscriptVersion(
    manuscriptId: string,
    lockedStore?: LockedCompatStoreContext,
    ensureStoryboardTiming = false,
  ): Promise<void> {
    const manuscriptKey = dbLegacyManuscriptKey(manuscriptId);
    const existing = lockedStore
      ? await lockedStore.get<JsonBlob>(manuscriptKey)
      : await getManuscript(manuscriptId);
    if (!existing) return; // ingen manuscript = ingen version å bumpe
    const hasStoryboardTiming = Object.prototype.hasOwnProperty.call(
      existing,
      "storyboardTiming",
    );
    const next = {
      ...existing,
      ...(ensureStoryboardTiming && !hasStoryboardTiming
        ? { storyboardTiming: makeStoryboardTimingV1Default() }
        : {}),
      version: bumpVersion(existing),
    };
    legacyManuscripts.set(manuscriptId, next);
    if (lockedStore) await lockedStore.setStrict(manuscriptKey, next);
    else await compatStoreSet(manuscriptKey, next);
  }

  async function ensureManuscriptStoryboardTiming(
    manuscriptId: string,
    lockedStore?: LockedCompatStoreContext,
  ): Promise<void> {
    const manuscriptKey = dbLegacyManuscriptKey(manuscriptId);
    const existing = lockedStore
      ? await lockedStore.get<JsonBlob>(manuscriptKey)
      : await getManuscript(manuscriptId);
    if (
      !existing ||
      Object.prototype.hasOwnProperty.call(existing, "storyboardTiming")
    ) {
      return;
    }
    const next = {
      ...existing,
      storyboardTiming: makeStoryboardTimingV1Default(),
      version: bumpVersion(existing),
    };
    legacyManuscripts.set(manuscriptId, next);
    if (lockedStore) await lockedStore.setStrict(manuscriptKey, next);
    else await compatStoreSet(manuscriptKey, next);
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

  async function persistScenesUnlocked(
    manuscriptId: string,
    scenes: JsonBlob[],
    lockedStore?: LockedCompatStoreContext,
    ensureStoryboardTiming = false,
  ): Promise<JsonBlob[]> {
    // Strict: feiler DB-skrivingen skal ruta svare 503 — settes derfor i
    // minne-cache FØRST ETTER vellykket persist (ellers ser klienten
    // «lagret» data som forsvinner ved restart).
    const scenesKey = dbLegacyScenesKey(manuscriptId);
    if (lockedStore) await lockedStore.setStrict(scenesKey, scenes);
    else await compatStoreSetStrict(scenesKey, scenes);
    legacyScenesByManuscript.set(manuscriptId, scenes);
    // Bumper manuscript-master-version for sub-entitet-mutasjoner — sikrer
    // at klienter med cached manuscript-bundle invaliderer ved scene-edit.
    await bumpManuscriptVersion(
      manuscriptId,
      lockedStore,
      ensureStoryboardTiming,
    );
    return scenes;
  }

  async function mutateScenes<T>(
    manuscriptId: string,
    mutation: (current: JsonBlob[]) => ScenesMutation<T>,
  ): Promise<T> {
    const scenesKey = dbLegacyScenesKey(manuscriptId);
    return serializeSceneMutation(manuscriptId, () => {
      const operation = async (
        lockedStore?: LockedCompatStoreContext,
      ): Promise<T> => {
        const stored = lockedStore
          ? await lockedStore.get<JsonBlob[]>(scenesKey)
          : await getScenes(manuscriptId);
        const current = Array.isArray(stored) ? stored : [];
        const next = mutation(current);
        if (next.scenes) {
          await persistScenesUnlocked(
            manuscriptId,
            next.scenes,
            lockedStore,
            next.ensureStoryboardTiming,
          );
        } else if (next.ensureStoryboardTiming) {
          await ensureManuscriptStoryboardTiming(manuscriptId, lockedStore);
        }
        return next.result;
      };
      return deps.compatStoreWithKeyLock
        ? deps.compatStoreWithKeyLock(scenesKey, (lockedStore) =>
            operation(lockedStore),
          )
        : operation();
    });
  }

  /**
   * Tegne-historikk: når drawingData.strokes byttes ut, bevares forrige
   * versjon i frame.drawingHistory (nyeste først, cap 3) så synket undo
   * ikke er borte for alltid. Thumbs/underlag holdes utenfor — kun
   * strokes-strengen + tidspunkt.
   */
  function withDrawingHistory(existingFrame: any, nextFrame: any): any {
    const prevStrokes = existingFrame?.drawingData?.strokes;
    const nextStrokes = nextFrame?.drawingData?.strokes;
    if (typeof prevStrokes !== "string" || prevStrokes === nextStrokes) {
      return nextFrame;
    }
    const history = Array.isArray(existingFrame?.drawingHistory)
      ? existingFrame.drawingHistory
      : [];
    return {
      ...nextFrame,
      drawingHistory: [
        { strokes: prevStrokes, updatedAt: existingFrame?.updatedAt ?? null },
        ...history,
      ].slice(0, 3),
    };
  }

  function parseStrokeList(value: unknown): JsonBlob[] | null {
    if (typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((stroke) => stroke && typeof stroke === "object")
        : null;
    } catch {
      return null;
    }
  }

  function canonicalizeJSON(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalizeJSON);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonBlob)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeJSON(entry)]),
    );
  }

  function sameJSONValue(lhs: unknown, rhs: unknown): boolean {
    return (
      JSON.stringify(canonicalizeJSON(lhs)) ===
      JSON.stringify(canonicalizeJSON(rhs))
    );
  }

  function sameShotFraming(lhs: unknown, rhs: unknown): boolean {
    const comparable = (value: unknown): unknown => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return value;
      const result = { ...(value as JsonBlob) };
      // Derived by the server from the transform; never treat it as a human
      // camera edit in the three-way comparison.
      delete result.intentFingerprint;
      return result;
    };
    return sameJSONValue(comparable(lhs), comparable(rhs));
  }

  function sameStroke(lhs: JsonBlob, rhs: JsonBlob): boolean {
    return sameJSONValue(lhs, rhs);
  }

  function mergeSidecar(
    remote: unknown,
    base: unknown,
    local: unknown,
    equals: (lhs: unknown, rhs: unknown) => boolean,
  ): { conflict: boolean; value: unknown; preservedRemote: boolean } {
    const localMatchesBase = equals(local, base);
    // Missing persisted sidecars are legacy defaults. A canonical base sent
    // by the native client represents that same state until a remote writer
    // actually materializes the sidecar.
    const remoteMatchesBase =
      remote === undefined && base !== undefined ? true : equals(remote, base);
    const localMatchesRemote = equals(local, remote);
    if (localMatchesBase) {
      return {
        conflict: false,
        value: remote,
        preservedRemote: !localMatchesRemote,
      };
    }
    if (remoteMatchesBase || localMatchesRemote) {
      return { conflict: false, value: local, preservedRemote: false };
    }
    return { conflict: true, value: remote, preservedRemote: false };
  }

  /** Mirrors native StrokeMerge.threeWay, including deletion tombstones. */
  function mergeStrokeDocuments(
    serverJSON: string,
    baseJSON: string,
    oursJSON: string,
  ): string | null {
    const serverList = parseStrokeList(serverJSON);
    const baseList = parseStrokeList(baseJSON);
    const oursList = parseStrokeList(oursJSON);
    if (!serverList || !baseList || !oursList) return null;
    const byId = (list: JsonBlob[]) =>
      new Map(
        list.flatMap((stroke) =>
          typeof stroke.id === "string" ? [[stroke.id, stroke] as const] : [],
        ),
      );
    const server = byId(serverList);
    const base = byId(baseList);
    const ours = byId(oursList);
    const deleted = new Set<string>();
    for (const id of base.keys()) {
      if (!ours.has(id) || !server.has(id)) deleted.add(id);
    }
    const result: JsonBlob[] = [];
    const emitted = new Set<string>();
    for (const serverStroke of serverList) {
      const id = typeof serverStroke.id === "string" ? serverStroke.id : null;
      if (!id || deleted.has(id) || emitted.has(id)) continue;
      emitted.add(id);
      const oursStroke = ours.get(id);
      const baseStroke = base.get(id);
      result.push(
        oursStroke && baseStroke && !sameStroke(oursStroke, baseStroke)
          ? oursStroke
          : serverStroke,
      );
    }
    for (const oursStroke of oursList) {
      const id = typeof oursStroke.id === "string" ? oursStroke.id : null;
      if (!id || deleted.has(id) || emitted.has(id)) continue;
      emitted.add(id);
      result.push(oursStroke);
    }
    return JSON.stringify(result);
  }

  async function patchFrame(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    fields: JsonBlob,
    options?: FramePatchOptions,
  ): Promise<FramePatchResult | null> {
    return mutateScenes(manuscriptId, (scenes) => {
      const noWrite = (
        result: FramePatchResult | null,
      ): ScenesMutation<FramePatchResult | null> => ({ result });
      const sceneIndex = scenes.findIndex((scene) => scene?.id === sceneId);
      if (sceneIndex < 0) return noWrite(null);
      const scene = scenes[sceneIndex] as any;
      const frames: any[] = Array.isArray(scene.storyboardFrames)
        ? scene.storyboardFrames
        : [];
      const frameIndex = frames.findIndex((frame) => frame?.id === frameId);
      if (frameIndex < 0) return noWrite(null);

      const existingFrame = frames[frameIndex] as JsonBlob;
      const currentUpdatedAt =
        typeof existingFrame.updatedAt === "string"
          ? existingFrame.updatedAt
          : undefined;
      const currentStrokesJSON =
        typeof existingFrame.drawingData?.strokes === "string"
          ? existingFrame.drawingData.strokes
          : undefined;
      const currentShotFraming = existingFrame.shotFraming;
      const currentLayerState = existingFrame.drawingData?.layerState;
      // Defense in depth: generic mutation owns neither motion/timing nor AI
      // adoption/job sidecars, even when an internal caller bypasses routes.
      let nextFields = preserveCameraMotionEnvelope(
        existingFrame,
        enforceFramePatchAIStaleAuthority(fields, false),
      ) as JsonBlob;
      let merged = false;
      const hasUpdatedAtBase = typeof options?.baseUpdatedAt === "string";
      const hasStrokeBase = typeof options?.baseStrokesJSON === "string";
      const hasShotFramingBase = Object.prototype.hasOwnProperty.call(
        options ?? {},
        "baseShotFraming",
      );
      const hasLayerStateBase = Object.prototype.hasOwnProperty.call(
        options ?? {},
        "baseLayerState",
      );
      const hasOptimisticBase =
        hasUpdatedAtBase ||
        hasStrokeBase ||
        hasShotFramingBase ||
        hasLayerStateBase;
      const baseIsStale = hasUpdatedAtBase
        ? currentUpdatedAt !== options?.baseUpdatedAt
        : hasStrokeBase && currentStrokesJSON !== options?.baseStrokesJSON;
      if (baseIsStale && nextFields.drawingData?.strokes !== undefined) {
        const oursJSON = nextFields.drawingData.strokes;
        const mergedJSON =
          currentStrokesJSON &&
          typeof options?.baseStrokesJSON === "string" &&
          typeof oursJSON === "string"
            ? mergeStrokeDocuments(
                currentStrokesJSON,
                options.baseStrokesJSON,
                oursJSON,
              )
            : null;
        if (!mergedJSON) {
          return noWrite({
            updatedAt: currentUpdatedAt ?? "",
            conflict: true,
            currentUpdatedAt,
            currentStrokesJSON,
            currentShotFraming: currentShotFraming ?? null,
            currentLayerState: currentLayerState ?? null,
            currentAiPaintoverState: existingFrame.aiPaintoverState ?? null,
          });
        }
        nextFields = {
          ...nextFields,
          drawingData: { ...nextFields.drawingData, strokes: mergedJSON },
        };
        merged = mergedJSON !== oursJSON;
      }
      // The sidecar base is independently authoritative. Older frames can
      // legitimately lack updatedAt/baseStrokesJSON, so gating this merge on
      // the document token would let those clients overwrite a remote camera
      // edit. Running the three-way comparison when the base is present is a
      // no-op for the common remote==base path and closes that legacy gap.
      if (
        hasShotFramingBase &&
        Object.prototype.hasOwnProperty.call(nextFields, "shotFraming")
      ) {
        const shotMerge = mergeSidecar(
          currentShotFraming,
          options?.baseShotFraming,
          nextFields.shotFraming,
          sameShotFraming,
        );
        if (shotMerge.conflict) {
          return noWrite({
            updatedAt: currentUpdatedAt ?? "",
            conflict: true,
            currentUpdatedAt,
            currentStrokesJSON,
            currentShotFraming: currentShotFraming ?? null,
            currentLayerState: currentLayerState ?? null,
            currentAiPaintoverState: existingFrame.aiPaintoverState ?? null,
          });
        }
        if (shotMerge.value === undefined) delete nextFields.shotFraming;
        else nextFields.shotFraming = shotMerge.value;
        if (shotMerge.preservedRemote) {
          for (const key of ["shotType", "angle", "lensMm"] as const) {
            if (existingFrame[key] === undefined) delete nextFields[key];
            else nextFields[key] = existingFrame[key];
          }
          merged = true;
        }
      }
      if (
        hasLayerStateBase &&
        nextFields.drawingData &&
        Object.prototype.hasOwnProperty.call(
          nextFields.drawingData,
          "layerState",
        )
      ) {
        const layerMerge = mergeSidecar(
          currentLayerState,
          options?.baseLayerState,
          nextFields.drawingData.layerState,
          sameJSONValue,
        );
        if (layerMerge.conflict) {
          return noWrite({
            updatedAt: currentUpdatedAt ?? "",
            conflict: true,
            currentUpdatedAt,
            currentStrokesJSON,
            currentShotFraming: currentShotFraming ?? null,
            currentLayerState: currentLayerState ?? null,
            currentAiPaintoverState: existingFrame.aiPaintoverState ?? null,
          });
        }
        const nextDrawingData = { ...nextFields.drawingData };
        if (layerMerge.value === undefined) delete nextDrawingData.layerState;
        else nextDrawingData.layerState = layerMerge.value;
        nextFields = { ...nextFields, drawingData: nextDrawingData };
        merged = merged || layerMerge.preservedRemote;
      }

      // updatedAt is the OCC token. Force monotonicity even when two writes
      // land inside the same millisecond (Date ISO strings otherwise collide).
      const currentUpdatedAtMs = currentUpdatedAt
        ? Date.parse(currentUpdatedAt)
        : Number.NaN;
      const updatedAt = new Date(
        Math.max(
          Date.now(),
          Number.isFinite(currentUpdatedAtMs) ? currentUpdatedAtMs + 1 : 0,
        ),
      ).toISOString();
      if (
        nextFields.drawingData &&
        typeof nextFields.drawingData === "object"
      ) {
        nextFields = {
          ...nextFields,
          drawingData: {
            ...(existingFrame.drawingData ?? {}),
            ...nextFields.drawingData,
          },
        };
      }
      const mergedFrame = { ...existingFrame, ...nextFields };
      const sourceChangeReason = nativeFrameSourceChangeReason(
        existingFrame,
        mergedFrame,
      );
      const sourceChanged = sourceChangeReason !== null;
      const framingChanged =
        cameraMotionFramingFingerprintFromFrameV1(existingFrame) !==
        cameraMotionFramingFingerprintFromFrameV1(mergedFrame);
      const cameraMotionPatch = framingChanged
        ? revalidateCameraMotionDependencyV1(
            existingFrame,
            mergedFrame,
            "framing",
            updatedAt,
          )
        : {};
      const effectiveMergedFrame = {
        ...mergedFrame,
        ...cameraMotionPatch,
      };
      const paintoverChanges = storyboardPaintoverChanges(
        existingFrame,
        effectiveMergedFrame,
      );
      const aiPaintoverState = storyboardPaintoverStateForFrame(
        existingFrame.aiPaintoverState,
        paintoverChanges,
        effectiveMergedFrame,
      );
      if (Object.keys(cameraMotionPatch).length > 0) {
        aiPaintoverState.videoStale = true;
      }
      nextFields = {
        ...nextFields,
        ...cameraMotionPatch,
        aiPaintoverState,
      };
      if (sourceChanged) {
        nextFields = {
          ...nextFields,
          aiOutputStale: true,
          aiOutputStaleReason: sourceChangeReason,
        };
      }
      const currentSourceUpdatedAt =
        typeof existingFrame.sourceUpdatedAt === "string" &&
        existingFrame.sourceUpdatedAt.trim()
          ? existingFrame.sourceUpdatedAt
          : currentUpdatedAt;
      const sourceUpdatedAt = sourceChanged
        ? updatedAt
        : (currentSourceUpdatedAt ?? updatedAt);
      const nextFrames = frames.slice();
      nextFrames[frameIndex] = withDrawingHistory(existingFrame, {
        ...existingFrame,
        ...nextFields,
        id: frameId,
        updatedAt,
        sourceUpdatedAt,
      });
      const nextScenes = scenes.slice();
      nextScenes[sceneIndex] = {
        ...scene,
        storyboardFrames: nextFrames,
        updatedAt,
      };
      if (!hasOptimisticBase) {
        return {
          scenes: nextScenes,
          result: {
            updatedAt,
            sourceUpdatedAt,
            sourceChanged,
            ...cameraMotionPatch,
            ...(sourceChangeReason ? { sourceChangeReason } : {}),
            aiPaintoverState,
          },
        };
      }
      return {
        scenes: nextScenes,
        result: {
          updatedAt,
          sourceUpdatedAt,
          sourceChanged,
          ...(sourceChangeReason ? { sourceChangeReason } : {}),
          merged,
          strokesJSON: nextFrames[frameIndex]?.drawingData?.strokes,
          shotFraming: nextFrames[frameIndex]?.shotFraming ?? null,
          ...cameraMotionPatch,
          layerState: nextFrames[frameIndex]?.drawingData?.layerState ?? null,
          aiPaintoverState,
        },
      };
    });
  }

  async function patchFrameCameraMotion(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    request: unknown,
  ): Promise<FrameCameraMotionPatchResult | null> {
    return mutateScenes(manuscriptId, (scenes) => {
      const noWrite = (
        result: FrameCameraMotionPatchResult | null,
      ): ScenesMutation<FrameCameraMotionPatchResult | null> => ({ result });
      const sceneIndex = scenes.findIndex((scene) => scene?.id === sceneId);
      if (sceneIndex < 0) return noWrite(null);
      const scene = scenes[sceneIndex] as JsonBlob;
      const frames: JsonBlob[] = Array.isArray(scene.storyboardFrames)
        ? scene.storyboardFrames
        : [];
      const frameIndex = frames.findIndex((frame) => frame?.id === frameId);
      if (frameIndex < 0) return noWrite(null);

      const existingFrame = frames[frameIndex] as JsonBlob;
      const currentUpdatedAt =
        typeof existingFrame.updatedAt === "string"
          ? existingFrame.updatedAt
          : undefined;
      const currentUpdatedAtMs = currentUpdatedAt
        ? Date.parse(currentUpdatedAt)
        : Number.NaN;
      const changedAt = new Date(
        Math.max(
          Date.now(),
          Number.isFinite(currentUpdatedAtMs) ? currentUpdatedAtMs + 1 : 0,
        ),
      ).toISOString();
      const applied = applyCameraMotionWriteV1(
        existingFrame,
        request,
        changedAt,
      );
      if (!applied.ok) return noWrite(applied);
      if (!applied.value.changed) {
        const currentPaintover = existingFrame.aiPaintoverState;
        return noWrite({
          ok: true,
          ...applied.value,
          ...(currentPaintover && typeof currentPaintover === "object"
            && !Array.isArray(currentPaintover)
            && currentPaintover.version === 1
            ? {
                aiPaintoverState:
                  currentPaintover as StoryboardPaintoverState,
              }
            : {}),
        });
      }

      const motionEnvelope = cameraMotionEnvelopePatchV1(applied.value);
      const effectiveFrame = { ...existingFrame, ...motionEnvelope };
      const aiPaintoverState = storyboardPaintoverStateForFrame(
        existingFrame.aiPaintoverState,
        { colorChanged: false, atmosphereChanged: false },
        effectiveFrame,
      );
      // Camera motion is downstream animation intent: it must never invalidate
      // Pencil or paintover source truth, but an existing video is now stale.
      aiPaintoverState.videoStale = true;
      const nextFrames = frames.slice();
      nextFrames[frameIndex] = {
        ...effectiveFrame,
        aiPaintoverState,
        id: frameId,
        updatedAt: applied.value.updatedAt,
        ...(applied.value.sourceUpdatedAt
          ? { sourceUpdatedAt: applied.value.sourceUpdatedAt }
          : {}),
      };
      const nextScenes = scenes.slice();
      nextScenes[sceneIndex] = {
        ...scene,
        storyboardFrames: nextFrames,
        updatedAt: applied.value.updatedAt,
      };
      return {
        scenes: nextScenes,
        result: {
          ok: true,
          ...applied.value,
          aiPaintoverState,
        },
      };
    });
  }

  async function patchFrameDuration(
    manuscriptId: string,
    sceneId: string,
    frameId: string,
    request: unknown,
  ): Promise<FrameDurationPatchResult | null> {
    const prepared = prepareFrameDurationWriteV1(request);
    if (!prepared.ok) return prepared;

    return mutateScenes(manuscriptId, (scenes) => {
      const noWrite = (
        result: FrameDurationPatchResult | null,
      ): ScenesMutation<FrameDurationPatchResult | null> => ({ result });
      const sceneIndex = scenes.findIndex((scene) => scene?.id === sceneId);
      if (sceneIndex < 0) return noWrite(null);
      const scene = scenes[sceneIndex] as JsonBlob;
      const frames: JsonBlob[] = Array.isArray(scene.storyboardFrames)
        ? scene.storyboardFrames
        : [];
      const frameIndex = frames.findIndex((frame) => frame?.id === frameId);
      if (frameIndex < 0) return noWrite(null);

      const existingFrame = frames[frameIndex] as JsonBlob;
      const applied = applyFrameDurationWriteV1(existingFrame, prepared.write);
      if (!applied.ok) return noWrite(applied);

      const currentUpdatedAt =
        typeof existingFrame.updatedAt === "string"
          ? existingFrame.updatedAt
          : undefined;
      const currentSourceUpdatedAt =
        typeof existingFrame.sourceUpdatedAt === "string" &&
        existingFrame.sourceUpdatedAt.trim()
          ? existingFrame.sourceUpdatedAt
          : currentUpdatedAt;
      if (!applied.value.changed) {
        const cameraMotionSidecars =
          cameraMotionEnvelopeSnapshotV1(existingFrame);
        const currentPaintover = existingFrame.aiPaintoverState;
        return {
          ensureStoryboardTiming: true,
          result: {
            ok: true,
            ...applied.value,
            ...cameraMotionSidecars,
            updatedAt: currentUpdatedAt ?? "",
            ...(currentPaintover &&
            typeof currentPaintover === "object" &&
            !Array.isArray(currentPaintover) &&
            currentPaintover.version === 1
              ? {
                  aiPaintoverState:
                    currentPaintover as StoryboardPaintoverState,
                }
              : {}),
            ...(currentSourceUpdatedAt
              ? { sourceUpdatedAt: currentSourceUpdatedAt }
              : {}),
          },
        };
      }

      const currentUpdatedAtMs = currentUpdatedAt
        ? Date.parse(currentUpdatedAt)
        : Number.NaN;
      const updatedAt = new Date(
        Math.max(
          Date.now(),
          Number.isFinite(currentUpdatedAtMs) ? currentUpdatedAtMs + 1 : 0,
        ),
      ).toISOString();
      const durationFrame = {
        ...existingFrame,
        shotDuration: applied.value.shotDuration,
        durationRevision: applied.value.durationRevision,
        duration: applied.value.duration,
        durationSec: applied.value.durationSec,
      };
      const cameraMotionPatch = revalidateCameraMotionDependencyV1(
        existingFrame,
        durationFrame,
        "duration",
        updatedAt,
      );
      const cameraMotionSidecars =
        Object.keys(cameraMotionPatch).length > 0
          ? cameraMotionPatch
          : cameraMotionEnvelopeSnapshotV1(existingFrame);
      const effectiveFrame = { ...durationFrame, ...cameraMotionPatch };
      const aiPaintoverState = storyboardPaintoverStateForFrame(
        existingFrame.aiPaintoverState,
        { colorChanged: false, atmosphereChanged: false },
        effectiveFrame,
      );
      // A completed video is bound to the previous shot length. Duration is
      // not Pencil source truth, but it must invalidate downstream playback.
      aiPaintoverState.videoStale = true;
      const nextFrames = frames.slice();
      nextFrames[frameIndex] = {
        ...effectiveFrame,
        aiPaintoverState,
        id: frameId,
        updatedAt,
        ...(currentSourceUpdatedAt
          ? { sourceUpdatedAt: currentSourceUpdatedAt }
          : {}),
      };
      const nextScenes = scenes.slice();
      nextScenes[sceneIndex] = {
        ...scene,
        storyboardFrames: nextFrames,
        updatedAt,
      };
      return {
        scenes: nextScenes,
        ensureStoryboardTiming: true,
        result: {
          ok: true,
          ...applied.value,
          ...cameraMotionSidecars,
          aiPaintoverState,
          updatedAt,
          ...(currentSourceUpdatedAt
            ? { sourceUpdatedAt: currentSourceUpdatedAt }
            : {}),
        },
      };
    });
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
    return findLocation(
      legacyDialogueByManuscript,
      "casting:dialogue:",
      dialogueId,
    );
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

  // ── Lock management ────────────────────────────────────────────────
  // Skriver direkte til compat-store (omgår replaceManuscript) slik at
  // version-feltet ikke bumpes ved hver heartbeat — ellers ville klient-
  // ETags blitt ugyldiggjort kontinuerlig.

  async function acquireLock(
    manuscriptId: string,
    userId: string,
    options?: { force?: boolean },
  ): Promise<
    | { ok: true; lock: ManuscriptLockState }
    | { ok: false; conflict: ManuscriptLockState }
  > {
    const existing = await getManuscript(manuscriptId);
    if (!existing) {
      return { ok: false, conflict: computeManuscriptLockState(null) };
    }
    const current = computeManuscriptLockState(existing);
    if (
      current.held &&
      current.lockedBy !== userId &&
      options?.force !== true
    ) {
      return { ok: false, conflict: current };
    }
    const now = new Date().toISOString();
    const updated = { ...existing, lockedBy: userId, lockedAt: now };
    legacyManuscripts.set(manuscriptId, updated);
    await compatStoreSet(dbLegacyManuscriptKey(manuscriptId), updated);
    return { ok: true, lock: computeManuscriptLockState(updated) };
  }

  async function releaseLock(
    manuscriptId: string,
    userId: string,
  ): Promise<{ released: boolean; lock: ManuscriptLockState }> {
    const existing = await getManuscript(manuscriptId);
    if (!existing) {
      return { released: false, lock: computeManuscriptLockState(null) };
    }
    const current = computeManuscriptLockState(existing);
    if (!current.lockedBy) {
      return { released: false, lock: current };
    }
    if (current.lockedBy !== userId && !current.isExpired) {
      return { released: false, lock: current };
    }
    const updated = { ...existing, lockedBy: null, lockedAt: null };
    legacyManuscripts.set(manuscriptId, updated);
    await compatStoreSet(dbLegacyManuscriptKey(manuscriptId), updated);
    return { released: true, lock: computeManuscriptLockState(updated) };
  }

  async function heartbeatLock(
    manuscriptId: string,
    userId: string,
  ): Promise<
    | { ok: true; lock: ManuscriptLockState }
    | { ok: false; conflict: ManuscriptLockState }
  > {
    return acquireLock(manuscriptId, userId);
  }

  async function getLock(manuscriptId: string): Promise<ManuscriptLockState> {
    const existing = await getManuscript(manuscriptId);
    return computeManuscriptLockState(existing);
  }

  return {
    listManuscripts,
    getManuscript,
    getScenes,
    getDialogue,
    getActs,
    getRevisions,
    replaceManuscript,
    mutateScenes,
    patchFrame,
    patchFrameCameraMotion,
    patchFrameDuration,
    withDrawingHistory,
    replaceDialogue,
    replaceActs,
    replaceRevisions,
    findDialogueLocation,
    findActLocation,
    clearManuscriptState,
    acquireLock,
    releaseLock,
    heartbeatLock,
    getLock,
  };
}
