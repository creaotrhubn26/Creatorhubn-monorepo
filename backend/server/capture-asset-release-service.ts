/**
 * capture-asset-release-service.ts
 *
 * Frigjøring av kameramedier — objektet slettes, og bytene trekkes fra
 * begge regnskapene.
 *
 * Hvorfor dette manglet: sletting av en capture-sesjon er en soft delete.
 * Radene merkes, men objektene blir liggende i bøtta og koster fortsatt
 * penger — helt riktig, for de kan gjenopprettes. Konsekvensen var at
 * ingenting noensinne krympet: produksjonsledgeren og kontoens pott kunne
 * bare vokse, og en produksjon som ble avsluttet for to år siden holdt
 * fortsatt på kvoten sin.
 *
 * Denne modulen er den manglende motsatte veien. Den sier ingenting om
 * NÅR noe skal frigjøres — det er en oppbevaringsfrist, og den er en
 * juridisk beslutning, ikke en teknisk. Modulen utfører frigjøringen når
 * noen har bestemt at den skal skje.
 *
 * Rekkefølgen er bevisst: objektet slettes FØR regnskapet trekkes ned.
 * Motsatt vei ville et feilende DELETE gitt en kunde som betaler for noe
 * regnskapet sier er borte — en usynlig kostnad ingen leter etter. Slår
 * det feil denne veien, står bytene igjen i regnskapet og kan prøves på
 * nytt; det er en synlig feil, og den riktige å ha.
 */

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Pool } from "pg";
import { captureStoreHandleForKey } from "./capture-upload-service.js";
import {
  recordProductionUsage,
  type StorageLedgerBackend,
} from "./production-storage-service.js";
import { recordStorageUsage } from "./storage-quota-service.js";

export interface ReleaseInput {
  /** Objektnøkkelen som skal slettes. */
  key: string;
  sizeBytes: number;
  /** Produksjonen bytene ble bokført på, hvis noen. */
  projectId?: string | null;
  /** Kontoen som ble belastet. Trengs for å trekke ned kontoens pott. */
  billingUserId?: string | null;
  /** Hvorfor — havner i revisjonssporet. */
  reason: string;
  relatedResourceId?: string | null;
}

export type ReleaseOutcome =
  | { ok: true; backend: StorageLedgerBackend; freedBytes: number }
  | { ok: false; error: "not_configured" | "delete_failed"; detail?: string };

/**
 * Slett ett objekt og før bytene tilbake.
 *
 * Et objekt som allerede er borte fra lageret regnes som frigjort: da er
 * det regnskapet som ligger etter virkeligheten, og å nekte ville låst
 * bytene inne for godt.
 */
export async function releaseCaptureObject(
  pool: Pool,
  input: ReleaseInput,
): Promise<ReleaseOutcome> {
  const store = captureStoreHandleForKey(input.key);
  if (!store) return { ok: false, error: "not_configured" };

  try {
    await store.client.send(
      new DeleteObjectCommand({ Bucket: store.bucket, Key: input.key }),
    );
  } catch (err) {
    // S3 svarer 204 på DELETE av et objekt som ikke finnes, så en feil
    // her er en ekte feil — nett, rettigheter eller feil bøtte.
    return { ok: false, error: "delete_failed", detail: String(err) };
  }

  const freed = Math.max(0, Math.trunc(input.sizeBytes));
  if (freed === 0) {
    return { ok: true, backend: store.backend, freedBytes: 0 };
  }

  // Begge regnskapene må ned. Produksjonsledgeren for å vise hva som
  // faktisk ligger igjen på prosjektet; kontoledgeren for at potten skal
  // bli ledig igjen. Trakk vi bare den ene, ville kvoten enten aldri
  // frigis eller vise et prosjekt som tommere enn det er.
  if (input.projectId) {
    await recordProductionUsage(pool, {
      projectId: input.projectId,
      actorUserId: null,
      deltaBytes: -freed,
      backend: store.backend,
      reason: input.reason,
      relatedResourceId: input.relatedResourceId ?? input.key,
    });
  }

  if (input.billingUserId) {
    await recordStorageUsage(
      pool,
      input.billingUserId,
      -freed,
      store.backend,
      input.reason,
      input.relatedResourceId ?? input.key,
      { objectKey: input.key, projectId: input.projectId ?? null },
    );
  }

  return { ok: true, backend: store.backend, freedBytes: freed };
}

export interface ReleaseBatchResult {
  released: number;
  freedBytes: number;
  failed: Array<{ key: string; error: string }>;
}

/**
 * Frigjør flere objekter.
 *
 * Serielt og ikke i parallell: dette kjører i bakgrunnen etter en
 * oppbevaringsfrist, ikke mens noen venter. En sletterunde som metter
 * forbindelsen mot lageret ville gått ut over opplastingene fra settet,
 * og de haster faktisk.
 *
 * Én feilet sletting stopper ikke resten. Den rapporteres, og bytene blir
 * stående i regnskapet til neste runde — synlig, ikke tapt.
 */
export async function releaseCaptureObjects(
  pool: Pool,
  inputs: ReleaseInput[],
): Promise<ReleaseBatchResult> {
  const result: ReleaseBatchResult = { released: 0, freedBytes: 0, failed: [] };
  for (const input of inputs) {
    const outcome = await releaseCaptureObject(pool, input);
    if (outcome.ok) {
      result.released += 1;
      result.freedBytes += outcome.freedBytes;
    } else {
      result.failed.push({
        key: input.key,
        error: outcome.detail ? `${outcome.error}: ${outcome.detail}` : outcome.error,
      });
    }
  }
  return result;
}
