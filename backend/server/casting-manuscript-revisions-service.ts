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

export interface CastingManuscriptRevisionsServiceDeps {
  manuscriptsService: CastingManuscriptsService;
}

export interface CastingManuscriptRevisionsService {
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
  ): Promise<RevisionRestoreResult | null>;
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
  ): Promise<RevisionRestoreResult | null> {
    const sourceRevision = await getRevisionById(
      manuscriptId,
      sourceRevisionId,
    );
    if (!sourceRevision) return null;

    const currentManuscript =
      await manuscriptsService.getManuscript(manuscriptId);
    if (!currentManuscript) return null;

    // Bygg restored manuscript-state: ta innhold fra source-revisjonen
    // (metadata-stripped) og merge med eksisterende metadata.
    const sourceContent = stripMetadata(sourceRevision);
    const restoredManuscript = {
      ...currentManuscript,
      ...sourceContent,
      id: manuscriptId,
      restoredFromRevisionId: sourceRevisionId,
      restoredAt: new Date().toISOString(),
    };

    // Opprett audit-trail-markør i revisions-array.
    const markerRevisionId = newEntityId("revision-restore-marker");
    const now = new Date().toISOString();
    const existingRevisions =
      await manuscriptsService.getRevisions(manuscriptId);
    const marker = {
      id: markerRevisionId,
      manuscriptId,
      manuscript_id: manuscriptId,
      kind: "restore_marker",
      restoredFromRevisionId: sourceRevisionId,
      restoredAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await manuscriptsService.replaceRevisions(manuscriptId, [
      ...existingRevisions,
      marker,
    ]);

    // Bumper version via replaceManuscript.
    const persisted =
      await manuscriptsService.replaceManuscript(manuscriptId, restoredManuscript);

    return {
      markerRevisionId,
      manuscript: persisted as Record<string, unknown>,
    };
  }

  return {
    getRevisionById,
    diffRevisions,
    restoreRevision,
  };
}
