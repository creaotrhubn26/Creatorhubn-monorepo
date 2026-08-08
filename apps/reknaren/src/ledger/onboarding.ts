/**
 * Aktiverings-status for «Kom i gang»-sjekklisten. Utledes fra ekte data (ett
 * spørrings-rundtur), aldri lagret flagg — så listen forsvinner av seg selv når
 * novisen faktisk har gjort stegene. Målet er raskest mulig vei til første verdi:
 * fra tom konto til første bokførte bilag.
 */
import type { Db } from '../db/pool.js';

export interface ActivationStatus {
  /** Organisasjonsnummer utfylt — kreves for MVA-melding og faktura. */
  orgReady: boolean;
  /** Minst én bankkonto koblet/opprettet. */
  hasBank: boolean;
  /** Minst ett bilag mottatt (opplastet eller skannet). */
  hasDocument: boolean;
  /** Minst én bokføring gjennomført. */
  hasPostedEntry: boolean;
  /** true når alle stegene er gjort → «Kom i gang» skal ikke vises lenger. */
  complete: boolean;
}

export async function getActivationStatus(db: Db, organizationId: string): Promise<ActivationStatus> {
  const r = (
    await db.query(
      `SELECT
         (SELECT org_number IS NOT NULL FROM organizations WHERE id = $1) AS org_ready,
         EXISTS(SELECT 1 FROM bank_accounts WHERE organization_id = $1) AS has_bank,
         EXISTS(SELECT 1 FROM source_documents WHERE organization_id = $1) AS has_document,
         EXISTS(SELECT 1 FROM journal_entries WHERE organization_id = $1) AS has_posted`,
      [organizationId],
    )
  ).rows[0];
  const orgReady = Boolean(r?.org_ready);
  const hasBank = Boolean(r?.has_bank);
  const hasDocument = Boolean(r?.has_document);
  const hasPostedEntry = Boolean(r?.has_posted);
  return {
    orgReady,
    hasBank,
    hasDocument,
    hasPostedEntry,
    complete: orgReady && hasBank && hasDocument && hasPostedEntry,
  };
}
