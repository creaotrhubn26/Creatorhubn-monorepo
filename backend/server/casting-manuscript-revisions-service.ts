/**
 * casting-manuscript-revisions-service.ts
 *
 * Service for versjons-historikk på manuscripts. Adresserer pain point
 * fra Final Draft/Fade In/Celtx-markedet: "lost revisions" og manglende
 * diff/restore-funksjonalitet.
 *
 * Tre operasjoner:
 *   - **getRevisionById**: henter én lagret revisjon
 *   - **diffRevisions**: returnerer JSON Patch (RFC 6902) fra revision A
 *     til revision B — kan brukes av frontend til side-by-side-diff-UI
 *   - **restoreRevision**: bygger nytt manuscript-state fra en gammel
 *     revisjon. Oppretter samtidig en "restore-marker"-revisjon slik at
 *     audit-trailet bevares.
 *
 * Service operér på "revision-body" som vilkårlig JSON. Klienten
 * bestemmer hva som lagres (eksempel: full manuscript-snapshot ved
 * `{ manuscript, scenes, dialogue, acts }`).
 *
 * Bruker `fast-json-patch` (RFC 6902 standard).
 */

// fast-json-patch er CJS-only — importer default-objektet og destrukturer
// `compare` derfra. Direkte named-import-faller på esbuild-bundlet
// ESM-output (Render-bygg). `Operation`-typen er TypeScript-only.
import fastJsonPatch, { type Operation } from "fast-json-patch";
const { compare } = fastJsonPatch;

import type {
  CastingManuscriptsService,
} from "./casting-manuscripts-service.js";
import { newEntityId } from "./_shared-ids.js";

export type JsonPatch = Operation[];

export interface RevisionDiffResult {
  fromRevisionId: string;
  toRevisionId: string;
  patch: JsonPatch;
}

export interface RevisionRestoreResult {
  /** Den nye revisjons-markøren som ble opprettet for audit-trail. */
  markerRevisionId: string;
  /** Restored manuscript body (versjon-bumpet av service-laget). */
  manuscript: Record<string, unknown>;
}

export interface AutomaticSnapshotOptions {
  actorUserId: string;
}

export interface CastingManuscriptRevisionsServiceDeps {
  manuscriptsService: CastingManuscriptsService;
  /** Test seam for deterministic snapshot timestamps. */
  now?: () => Date;
  automaticSnapshotIntervalMs?: number;
  maxAutomaticSnapshots?: number;
}

export interface CastingManuscriptRevisionsService {
  /**
   * Persists the current cloud state before it is replaced. Automatic
   * snapshots are time-bucketed and deduplicated so two-second autosaves do
   * not create an unbounded history.
   */
  captureAutomaticSnapshot(
    manuscriptId: string,
    currentManuscript: Record<string, unknown>,
    options: AutomaticSnapshotOptions,
  ): Promise<Record<string, unknown> | null>;

  /**
   * Henter én revisjon med gitt id. Returnerer null hvis ikke funnet.
   */
  getRevisionById(
    manuscriptId: string,
    revisionId: string,
  ): Promise<Record<string, unknown> | null>;

  /**
   * Returnerer JSON Patch (RFC 6902) som transformerer revision A til
   * revision B. Brukes for side-by-side-diff i frontend.
   *
   * Sammenligner revision-body MINUS metadata-felt (id, createdAt,
   * updatedAt, manuscriptId) — kun innholds-forskjeller returneres.
   */
  diffRevisions(
    manuscriptId: string,
    fromRevisionId: string,
    toRevisionId: string,
  ): Promise<RevisionDiffResult | null>;

  /**
   * Gjenoppretter manuscript-state fra en gammel revisjon. Operasjonen
   * er audit-trail-bevarende:
   *   - Oppretter en NY revisjon-markør som peker på revivified state
   *   - Oppdaterer manuscript-body med innhold fra source-revisjonen
   *   - Bumper manuscript-version (via replaceManuscript)
   *
   * Returnerer null hvis source-revisjonen ikke finnes.
   */
  restoreRevision(
    manuscriptId: string,
    sourceRevisionId: string,
    actorUserId?: string,
  ): Promise<RevisionRestoreResult | null>;
}

const DEFAULT_AUTOMATIC_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_AUTOMATIC_SNAPSHOTS = 24;

const RESTORABLE_MANUSCRIPT_FIELDS = [
  "content",
  "title",
  "subtitle",
  "author",
  "status",
  "format",
  "pageCount",
  "wordCount",
  "coverImage",
  "coverFocalPoint",
  "language",
] as const;

function pickRestorableManuscriptFields(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const nestedSnapshot = value.snapshot && typeof value.snapshot === "object" && !Array.isArray(value.snapshot)
    ? value.snapshot as Record<string, unknown>
    : null;
  const legacyManuscript = value.manuscript && typeof value.manuscript === "object" && !Array.isArray(value.manuscript)
    ? value.manuscript as Record<string, unknown>
    : null;
  const source = nestedSnapshot ?? legacyManuscript ?? value;
  const result: Record<string, unknown> = {};
  for (const field of RESTORABLE_MANUSCRIPT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }
  return result;
}

function revisionTimestamp(value: Record<string, unknown>): number {
  const raw = typeof value.createdAt === "string"
    ? value.createdAt
    : typeof value.created_at === "string"
      ? value.created_at
      : "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Felt som ekskluderes ved diff fordi de er metadata, ikke innhold.
 */
const METADATA_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "manuscriptId",
  "manuscript_id",
  "version",
]);

function stripMetadata(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!METADATA_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export function createCastingManuscriptRevisionsService(
  deps: CastingManuscriptRevisionsServiceDeps,
): CastingManuscriptRevisionsService {
  const { manuscriptsService } = deps;
  const now = deps.now ?? (() => new Date());
  const automaticSnapshotIntervalMs = deps.automaticSnapshotIntervalMs
    ?? DEFAULT_AUTOMATIC_SNAPSHOT_INTERVAL_MS;
  const maxAutomaticSnapshots = Math.max(
    1,
    deps.maxAutomaticSnapshots ?? DEFAULT_MAX_AUTOMATIC_SNAPSHOTS,
  );

  async function captureAutomaticSnapshot(
    manuscriptId: string,
    currentManuscript: Record<string, unknown>,
    options: AutomaticSnapshotOptions,
  ): Promise<Record<string, unknown> | null> {
    const revisions = await manuscriptsService.getRevisions(manuscriptId);
    const automaticRevisions = revisions.filter(
      (revision) => revision?.kind === "automatic_snapshot",
    ) as Record<string, unknown>[];
    const latestAutomatic = automaticRevisions
      .slice()
      .sort((left, right) => revisionTimestamp(right) - revisionTimestamp(left))[0];
    const currentContent = typeof currentManuscript.content === "string"
      ? currentManuscript.content
      : "";

    if (latestAutomatic?.content === currentContent) return null;

    const capturedAt = now();
    if (
      latestAutomatic
      && capturedAt.getTime() - revisionTimestamp(latestAutomatic) < automaticSnapshotIntervalMs
    ) {
      return null;
    }

    const sourceCloudVersion = typeof currentManuscript.version === "number"
      && Number.isFinite(currentManuscript.version)
      ? currentManuscript.version
      : 0;
    const capturedAtIso = capturedAt.toISOString();
    const snapshot = pickRestorableManuscriptFields(currentManuscript);
    const revision: Record<string, unknown> = {
      id: newEntityId("revision-auto"),
      manuscriptId,
      manuscript_id: manuscriptId,
      projectId: currentManuscript.projectId ?? currentManuscript.project_id,
      project_id: currentManuscript.project_id ?? currentManuscript.projectId,
      kind: "automatic_snapshot",
      version: `cloud-${sourceCloudVersion}`,
      sourceCloudVersion,
      changeSummary: `Automatisk sikkerhetskopi av skyversjon ${sourceCloudVersion}`,
      changesSummary: `Automatisk sikkerhetskopi av skyversjon ${sourceCloudVersion}`,
      revisionNotes: "Opprettet automatisk før neste synkroniserte skriveendring.",
      content: currentContent,
      snapshot,
      createdBy: options.actorUserId,
      createdAt: capturedAtIso,
      updatedAt: capturedAtIso,
    };

    const automaticIdsToKeep = new Set(
      automaticRevisions
        .slice()
        .sort((left, right) => revisionTimestamp(right) - revisionTimestamp(left))
        .slice(0, Math.max(0, maxAutomaticSnapshots - 1))
        .map((entry) => entry.id),
    );
    const pruned = revisions.filter((entry) => (
      entry?.kind !== "automatic_snapshot" || automaticIdsToKeep.has(entry.id)
    ));
    await manuscriptsService.replaceRevisions(
      manuscriptId,
      [...pruned, revision],
      { bumpManuscriptVersion: false },
    );
    return revision;
  }

  async function getRevisionById(
    manuscriptId: string,
    revisionId: string,
  ): Promise<Record<string, unknown> | null> {
    const revisions = await manuscriptsService.getRevisions(manuscriptId);
    return (
      (revisions.find((r) => r?.id === revisionId) as
        | Record<string, unknown>
        | undefined) ?? null
    );
  }

  async function diffRevisions(
    manuscriptId: string,
    fromRevisionId: string,
    toRevisionId: string,
  ): Promise<RevisionDiffResult | null> {
    const fromRev = await getRevisionById(manuscriptId, fromRevisionId);
    const toRev = await getRevisionById(manuscriptId, toRevisionId);
    if (!fromRev || !toRev) return null;

    const patch = compare(stripMetadata(fromRev), stripMetadata(toRev));
    return {
      fromRevisionId,
      toRevisionId,
      patch,
    };
  }

  async function restoreRevision(
    manuscriptId: string,
    sourceRevisionId: string,
    actorUserId?: string,
  ): Promise<RevisionRestoreResult | null> {
    const sourceRevision = await getRevisionById(
      manuscriptId,
      sourceRevisionId,
    );
    if (!sourceRevision) return null;

    const currentManuscript =
      await manuscriptsService.getManuscript(manuscriptId);
    if (!currentManuscript) return null;

    // Restore only allow-listed manuscript fields. Revision metadata must
    // never leak into the manuscript body.
    const sourceContent = pickRestorableManuscriptFields(sourceRevision);
    const restoredAt = now().toISOString();
    const restoredManuscript = {
      ...currentManuscript,
      ...sourceContent,
      id: manuscriptId,
      restoredFromRevisionId: sourceRevisionId,
      restoredAt,
    };

    // Preserve the state being replaced so the restore itself is reversible.
    const markerRevisionId = newEntityId("revision-restore-marker");
    const existingRevisions =
      await manuscriptsService.getRevisions(manuscriptId);
    const marker = {
      id: markerRevisionId,
      manuscriptId,
      manuscript_id: manuscriptId,
      projectId: currentManuscript.projectId ?? currentManuscript.project_id,
      project_id: currentManuscript.project_id ?? currentManuscript.projectId,
      kind: "before_restore",
      version: `before-restore-${currentManuscript.version ?? 0}`,
      content: typeof currentManuscript.content === "string" ? currentManuscript.content : "",
      snapshot: pickRestorableManuscriptFields(currentManuscript),
      changeSummary: "Automatisk sikkerhetskopi før gjenoppretting",
      changesSummary: "Automatisk sikkerhetskopi før gjenoppretting",
      restoredFromRevisionId: sourceRevisionId,
      restoredAt,
      createdBy: actorUserId,
      createdAt: restoredAt,
      updatedAt: restoredAt,
    };

    await manuscriptsService.replaceRevisions(
      manuscriptId,
      [...existingRevisions, marker],
      { bumpManuscriptVersion: false },
    );

    // Bumper version via replaceManuscript.
    const persisted =
      await manuscriptsService.replaceManuscript(manuscriptId, restoredManuscript);

    return {
      markerRevisionId,
      manuscript: persisted as Record<string, unknown>,
    };
  }

  return {
    captureAutomaticSnapshot,
    getRevisionById,
    diffRevisions,
    restoreRevision,
  };
}
