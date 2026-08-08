/**
 * Aktiverings-status for «Kom i gang»-sjekklisten. Utledes fra ekte data (ett
 * spørrings-rundtur), aldri lagret flagg — så listen forsvinner av seg selv når
 * novisen faktisk har gjort stegene. Målet er raskest mulig vei til første verdi:
 * fra tom konto til første bokførte bilag, med e-post-fangst og MVA på plass.
 */
import type { Db } from '../db/pool.js';
import { inboundEmailFor } from '../ingestion/inbound-email.js';

export interface ActivationStatus {
  /** Organisasjonsnummer utfylt — kreves for MVA-melding og faktura. */
  orgReady: boolean;
  /** Minst én bankkonto koblet/opprettet. */
  hasBank: boolean;
  /** Minst ett bilag mottatt (opplastet, skannet eller videresendt). */
  hasDocument: boolean;
  /** Minst ett bilag inn via e-post (gmail-skann eller videresending). */
  hasEmailDocument: boolean;
  /** Minst én bokføring gjennomført. */
  hasPostedEntry: boolean;
  /** Virksomhetens unike bilag-adresse (videresend kvitteringer hit). */
  inboundEmail: string;
  /** true når mottak av videresendt e-post faktisk er aktivt (webhook konfigurert). */
  inboundActive: boolean;
  /** true når virksomheten er MVA-registrert (da er MVA-steget relevant). */
  mvaRelevant: boolean;
  /** true når det finnes en aktiv ID-porten-sesjon (BankID) for MVA. */
  mvaReady: boolean;
  /** true når alle PÅKREVDE steg er gjort → «Kom i gang» skal ikke vises lenger.
   *  E-post er en oppfordret, men ikke påkrevd, automatisering og blokkerer ikke. */
  complete: boolean;
}

export async function getActivationStatus(
  db: Db,
  organizationId: string,
  opts: { inboundDomain: string; inboundActive: boolean },
): Promise<ActivationStatus> {
  const r = (
    await db.query(
      `SELECT
         (SELECT org_number IS NOT NULL FROM organizations WHERE id = $1) AS org_ready,
         (SELECT vat_status = 'registered' FROM organizations WHERE id = $1) AS mva_relevant,
         EXISTS(SELECT 1 FROM bank_accounts WHERE organization_id = $1) AS has_bank,
         EXISTS(SELECT 1 FROM source_documents WHERE organization_id = $1) AS has_document,
         EXISTS(SELECT 1 FROM source_documents WHERE organization_id = $1 AND source IN ('gmail','forward')) AS has_email_doc,
         EXISTS(SELECT 1 FROM journal_entries WHERE organization_id = $1) AS has_posted,
         EXISTS(SELECT 1 FROM idporten_sessions WHERE organization_id = $1 AND expires_at > now()) AS mva_ready`,
      [organizationId],
    )
  ).rows[0];
  const orgReady = Boolean(r?.org_ready);
  const hasBank = Boolean(r?.has_bank);
  const hasDocument = Boolean(r?.has_document);
  const hasPostedEntry = Boolean(r?.has_posted);
  const mvaRelevant = Boolean(r?.mva_relevant);
  const mvaReady = Boolean(r?.mva_ready);
  return {
    orgReady,
    hasBank,
    hasDocument,
    hasEmailDocument: Boolean(r?.has_email_doc),
    hasPostedEntry,
    inboundEmail: inboundEmailFor(organizationId, opts.inboundDomain),
    inboundActive: opts.inboundActive,
    mvaRelevant,
    mvaReady,
    complete: orgReady && hasBank && hasDocument && hasPostedEntry && (!mvaRelevant || mvaReady),
  };
}
