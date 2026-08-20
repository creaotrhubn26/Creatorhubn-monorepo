/**
 * Smart dokumentjakt. Reknaren henter allerede bilag fra flere kilder (e-post,
 * bank-feed, kvitteringsbilder, opplasting). Denne motoren lukker gapet MELLOM
 * kildene: finner betalinger uten bilag og foreslår en sannsynlig faktura vi
 * allerede har hentet inn et annet sted.
 *
 * «Vi fant en betaling til Adobe på 1 249 kr, men mangler faktura. Vi fant en
 *  sannsynlig faktura i e-posten din fra 14. juli. Skal den kobles til betalingen?»
 *
 * REN LESING og forslag — kobling krever menneskelig godkjenning.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { getAccountDef } from '../coa/accounts.js';
import { getVatCode } from '../coa/vat-codes.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { ExtractedData } from '../documents/types.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { postJournalEntry } from '../ledger/engine.js';
import { DeterministicSuggestionEngine } from '../pipeline/suggest.js';
import type { RuleRegister } from '../rules/register.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';
import { splitGrossByVatCode } from '../vat/engine.js';

export interface DocCandidate {
  documentId: string;
  vendor: string | null;
  dateText: string | null;
  grossMinor: bigint;
  score: number;
  reasons: string[];
}

export interface PaymentGap {
  transactionId: string;
  bookedDate: string;
  amountMinor: bigint; // negativt = ut
  description: string;
  counterparty: string | null;
  candidates: DocCandidate[];
}

export interface DocumentHunt {
  asOf: string;
  paymentsMissingDoc: number;
  gapsWithCandidates: number;
  gaps: PaymentGap[];
}

function tokens(s: string | null | undefined): Set<string> {
  return new Set(
    (s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9æøå ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['den', 'til', 'for', 'fra', 'faktura', 'betaling'].includes(t)),
  );
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000));
}

function nbDate(iso: string | null): string {
  if (!iso) return 'ukjent dato';
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const months = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  return `${d}. ${months[m - 1]}`;
}

interface CandidateDoc {
  id: string;
  vendor: string | null;
  dateText: string | null;
  grossMinor: bigint;
}

/** Innhentede bilag som ennå ikke er koblet til en postering (mulige kandidater). */
async function loadUnlinkedDocs(db: Db, org: string): Promise<CandidateDoc[]> {
  const docRes = await db.query(
    `SELECT d.id, ed.vendor_name, ed.invoice_date::TEXT AS invoice_date, ed.gross_minor::TEXT AS gross_minor
     FROM source_documents d
     JOIN LATERAL (
       SELECT vendor_name, invoice_date, gross_minor FROM extracted_document_data
       WHERE document_id = d.id ORDER BY extraction_version DESC LIMIT 1
     ) ed ON true
     WHERE d.organization_id=$1 AND ed.gross_minor IS NOT NULL AND ed.gross_minor > 0
       AND d.status <> 'quarantined'
       AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_document_id = d.id)`,
    [org],
  );
  return docRes.rows.map((r) => ({
    id: r.id as string,
    vendor: (r.vendor_name as string | null) ?? null,
    dateText: (r.invoice_date as string | null) ?? null,
    grossMinor: BigInt(r.gross_minor),
  }));
}

/** Scorer bilag mot én betaling (beløp nødvendig, leverandør + dato styrker). */
function scoreCandidates(
  payment: { amountMinor: bigint; bookedDate: string; description: string; counterparty: string | null },
  docs: CandidateDoc[],
): DocCandidate[] {
  const absAmount = payment.amountMinor < 0n ? -payment.amountMinor : payment.amountMinor;
  const txText = tokens(`${payment.description} ${payment.counterparty ?? ''}`);
  const candidates: DocCandidate[] = [];
  for (const doc of docs) {
    const reasons: string[] = [];
    let score = 0;
    const diff = doc.grossMinor > absAmount ? doc.grossMinor - absAmount : absAmount - doc.grossMinor;
    if (diff === 0n) {
      score += 50;
      reasons.push(`Samme beløp (${formatMinorAsKr(absAmount)} kr)`);
    } else if (diff * 100n <= absAmount * 2n) {
      score += 25;
      reasons.push(`Nesten samme beløp (${formatMinorAsKr(doc.grossMinor)} kr)`);
    } else {
      continue; // beløp for langt unna → ikke en kandidat
    }
    const docTokens = tokens(doc.vendor);
    const overlap = [...docTokens].filter((t) => txText.has(t));
    if (overlap.length > 0) {
      score += 30;
      reasons.push(`Leverandør «${doc.vendor}» matcher betalingsteksten`);
    }
    if (doc.dateText) {
      const dd = daysBetween(doc.dateText, payment.bookedDate);
      if (dd <= 3) {
        score += 20;
        reasons.push(`Fakturadato ${nbDate(doc.dateText)}, ${dd} dag${dd === 1 ? '' : 'er'} fra betalingen`);
      } else if (dd <= 10) {
        score += 10;
        reasons.push(`Fakturadato ${nbDate(doc.dateText)}, innen ti dager fra betalingen`);
      } else if (dd <= 30) {
        score += 5;
        reasons.push(`Fakturadato ${nbDate(doc.dateText)}`);
      }
    }
    if (score >= 50) {
      candidates.push({ documentId: doc.id, vendor: doc.vendor, dateText: doc.dateText, grossMinor: doc.grossMinor, score, reasons });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates;
}

export async function huntDocuments(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<DocumentHunt> {
  const { organizationId: org, asOf } = params;

  // Betalinger uten bilag: uavstemte banktransaksjoner (penger ut).
  const txRes = await db.query(
    `SELECT id, booked_date::TEXT AS booked_date, amount_minor::TEXT AS amount_minor, description, counterparty
     FROM bank_transactions
     WHERE organization_id=$1 AND status='unmatched' AND amount_minor < 0 AND booked_date <= $2
     ORDER BY booked_date DESC`,
    [org, asOf],
  );
  const docs = await loadUnlinkedDocs(db, org);

  const gaps: PaymentGap[] = [];
  for (const tx of txRes.rows) {
    const amount = BigInt(tx.amount_minor);
    const candidates = scoreCandidates(
      { amountMinor: amount, bookedDate: tx.booked_date, description: tx.description, counterparty: (tx.counterparty as string | null) ?? null },
      docs,
    );
    if (candidates.length > 0) {
      gaps.push({
        transactionId: tx.id,
        bookedDate: tx.booked_date,
        amountMinor: amount,
        description: tx.description,
        counterparty: (tx.counterparty as string | null) ?? null,
        candidates: candidates.slice(0, 3),
      });
    }
  }
  gaps.sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0));

  return {
    asOf,
    paymentsMissingDoc: txRes.rowCount ?? 0,
    gapsWithCandidates: gaps.length,
    gaps,
  };
}

/** Kvittering-jakt for ÉN bank-linje — «finn kvitteringen for denne betalingen». */
export async function receiptCandidatesForTransaction(
  db: Db,
  params: { organizationId: string; transactionId: string },
): Promise<{ found: boolean; candidates: DocCandidate[] }> {
  const { organizationId: org, transactionId } = params;
  const txRes = await db.query(
    `SELECT booked_date::TEXT AS booked_date, amount_minor::TEXT AS amount_minor, description, counterparty, status
     FROM bank_transactions WHERE id=$1 AND organization_id=$2`,
    [transactionId, org],
  );
  if (!txRes.rowCount) throw new NotFoundError('Banktransaksjonen finnes ikke.');
  const tx = txRes.rows[0];
  const amount = BigInt(tx.amount_minor);
  if (tx.status !== 'unmatched' || amount >= 0n) {
    // Kobling støtter kun uavstemte utbetalinger; ellers ingen kandidater.
    return { found: false, candidates: [] };
  }
  const docs = await loadUnlinkedDocs(db, org);
  const candidates = scoreCandidates(
    { amountMinor: amount, bookedDate: tx.booked_date, description: tx.description, counterparty: (tx.counterparty as string | null) ?? null },
    docs,
  ).slice(0, 5);
  return { found: candidates.length > 0, candidates };
}

export interface LinkResult {
  entryNumber: number;
  accountNumber: string;
  vatCode: string;
}

export interface LinkPreview {
  accountNumber: string;
  accountName: string;
  vatCode: string;
  vatCodeName: string;
  netMinor: bigint;
  vatMinor: bigint;
  grossMinor: bigint;
  vendor: string | null;
}

interface DerivedBooking {
  bookedDate: string;
  isoDate: string;
  magnitude: bigint;
  accountNumber: string;
  vatCodeStr: string;
  bankAccount: string;
  netMinor: bigint;
  vatMinor: bigint;
  vendor: string | null;
  invoiceNumber: string | null;
  lines: Parameters<typeof postJournalEntry>[1]['lines'];
}

/** Utleder (uten å skrive) hva koblingen vil bokføre: konto, MVA-kode og linjer. */
async function deriveBooking(
  db: Db,
  rules: RuleRegister,
  org: string,
  transactionId: string,
  documentId: string,
): Promise<DerivedBooking> {
  const txRes = await db.query(
    `SELECT t.amount_minor::TEXT AS amount_minor, t.booked_date::TEXT AS booked_date, t.description, t.status,
            ba.ledger_account_number, o.org_form, o.vat_status
     FROM bank_transactions t
     JOIN bank_accounts ba ON ba.id = t.bank_account_id
     JOIN organizations o ON o.id = t.organization_id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [transactionId, org],
  );
  if (!txRes.rowCount) throw new NotFoundError('Banktransaksjonen finnes ikke.');
  const tx = txRes.rows[0];
  if (tx.status !== 'unmatched') throw new ConflictError('Transaksjonen er allerede avstemt.');
  const amount = BigInt(tx.amount_minor);
  if (amount >= 0n) throw new ValidationError('Kobling støtter foreløpig kun utbetalinger.');

  const exRes = await db.query(
    `SELECT vendor_name, vendor_org_number, invoice_number, invoice_date::TEXT AS invoice_date,
            currency, net_minor, vat_minor, gross_minor, document_type, foreign_service
     FROM extracted_document_data WHERE document_id = $1 ORDER BY extraction_version DESC LIMIT 1`,
    [documentId],
  );
  if (!exRes.rowCount) throw new NotFoundError('Bilaget mangler tolkede data.');
  const linked = await db.query(`SELECT 1 FROM journal_entries WHERE source_document_id = $1 LIMIT 1`, [documentId]);
  if (linked.rowCount) throw new ConflictError('Bilaget er allerede bokført.');

  const ex = exRes.rows[0];
  const isoDate = (ex.invoice_date as string | null) ?? String(tx.booked_date);
  const data: ExtractedData = {
    documentType: (ex.document_type as ExtractedData['documentType']) ?? 'unknown',
    ...(ex.vendor_name ? { vendorName: ex.vendor_name as string } : {}),
    ...(ex.vendor_org_number ? { vendorOrgNumber: ex.vendor_org_number as string } : {}),
    ...(ex.currency ? { currency: ex.currency as string } : {}),
    ...(ex.net_minor !== null ? { netMinor: BigInt(ex.net_minor) } : {}),
    ...(ex.vat_minor !== null ? { vatMinor: BigInt(ex.vat_minor) } : {}),
    ...(ex.gross_minor !== null ? { grossMinor: BigInt(ex.gross_minor) } : {}),
    ...(ex.foreign_service === true ? { foreignService: true } : {}),
  };
  const suggestion = await new DeterministicSuggestionEngine().suggest(data, {
    rules,
    vatStatus: tx.vat_status as 'registered' | 'not_registered' | 'pending',
    isoDate,
  });
  const accountNumber = suggestion.suggestedAccountNumber;
  const vatCodeStr = suggestion.suggestedVatCode;
  const vatCode = getVatCode(vatCodeStr);
  const bankAccount = String(tx.ledger_account_number);
  const magnitude = -amount;
  const vendor = (ex.vendor_name as string | null) ?? null;

  const lines: Parameters<typeof postJournalEntry>[1]['lines'] = [];
  let netMinor: bigint;
  let vatMinor: bigint;
  if (vatCode && vatCode.direction === 'input' && vatCode.deductible && !vatCode.reverseCharge) {
    const parts = splitGrossByVatCode(rules, vatCodeStr, magnitude, isoDate);
    netMinor = parts.netMinor;
    vatMinor = parts.vatMinor;
    lines.push({ accountNumber, debitMinor: parts.netMinor, vatCode: vatCodeStr, ...(vendor ? { description: vendor } : {}) });
    if (parts.vatMinor > 0n) lines.push({ accountNumber: '2710', debitMinor: parts.vatMinor, vatCode: vatCodeStr, description: `Inngående mva ${parts.ratePct} %` });
  } else {
    netMinor = magnitude;
    vatMinor = 0n;
    lines.push({ accountNumber, debitMinor: magnitude, ...(vatCode ? { vatCode: vatCodeStr } : {}), ...(vendor ? { description: vendor } : {}) });
  }
  lines.push({ accountNumber: bankAccount, creditMinor: magnitude });

  return {
    bookedDate: String(tx.booked_date),
    isoDate,
    magnitude,
    accountNumber,
    vatCodeStr,
    bankAccount,
    netMinor,
    vatMinor,
    vendor,
    invoiceNumber: (ex.invoice_number as string | null) ?? null,
    lines,
  };
}

/** Forhåndsvisning: hva koblingen vil bokføre, uten å skrive. */
export async function previewPaymentLink(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; transactionId: string; documentId: string },
): Promise<LinkPreview> {
  const b = await deriveBooking(db, rules, params.organizationId, params.transactionId, params.documentId);
  const vat = getVatCode(b.vatCodeStr);
  return {
    accountNumber: b.accountNumber,
    accountName: getAccountDef(b.accountNumber)?.name ?? b.accountNumber,
    vatCode: b.vatCodeStr,
    vatCodeName: vat?.name ?? b.vatCodeStr,
    netMinor: b.netMinor,
    vatMinor: b.vatMinor,
    grossMinor: b.magnitude,
    vendor: b.vendor,
  };
}

/**
 * Ett-klikks kobling: bokfører den manglende kostnaden fra bilaget mot betalingen
 * og avstemmer banktransaksjonen. Konto og MVA-kode utledes deterministisk fra
 * uttrekket (samme forslagsmotor som ellers), krediteres banken (betalingen er
 * allerede ute), og alt lenkes: bilag ↔ postering ↔ banktransaksjon. Reversibelt
 * og revisjonslogget. Idempotent per transaksjon.
 */
export async function linkPaymentToDocument(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; actor: Actor; transactionId: string; documentId: string },
): Promise<LinkResult> {
  const { organizationId: org, actor, transactionId, documentId } = params;
  const b = await deriveBooking(db, rules, org, transactionId, documentId);
  const accountNumber = b.accountNumber;
  const vatCodeStr = b.vatCodeStr;

  const entry = await postJournalEntry(db, {
    organizationId: org,
    actor,
    entryDate: b.bookedDate,
    description: `${b.vendor ?? 'Betaling'}${b.invoiceNumber ? ` — faktura ${b.invoiceNumber}` : ''}`,
    lines: b.lines,
    idempotencyKey: `bank-link:${transactionId}`,
    sourceDocumentId: documentId,
  });
  const magnitude = b.magnitude;

  await withTransaction(db, async (client) => {
    await client.query(`UPDATE bank_transactions SET status = 'reconciled' WHERE id = $1 AND organization_id = $2`, [transactionId, org]);
    await client.query(
      `INSERT INTO reconciliation_matches
         (id, organization_id, bank_transaction_id, journal_entry_id, source_document_id, match_type, matched_amount_minor, explanation, approved_by, approved_at, status)
       VALUES ($1,$2,$3,$4,$5,'manual',$6,$7,$8,now(),'approved')`,
      [newId(), org, transactionId, entry.id, documentId, magnitude.toString(), `Koblet til bilag av bruker (konto ${accountNumber}, mva ${vatCodeStr}).`, actor.userId],
    );
    await client.query(`UPDATE source_documents SET status = 'posted', updated_at = now(), version = version + 1 WHERE id = $1 AND organization_id = $2`, [documentId, org]);
    await recordAuditEvent(client, {
      organizationId: org,
      actor,
      action: 'payment.linked_to_document',
      entityType: 'bank_transaction',
      entityId: transactionId,
      newValue: { documentId, journalEntryId: entry.id, entryNumber: entry.entryNumber, accountNumber, vatCode: vatCodeStr },
    });
  });

  return { entryNumber: entry.entryNumber, accountNumber, vatCode: vatCodeStr };
}

// ── Utlegg: kvittering uten betaling («betalte du privat / med et annet kort?») ──

export interface OrphanReceipt {
  documentId: string;
  vendor: string | null;
  dateText: string | null;
  grossMinor: bigint;
  documentType: string | null;
}

/**
 * Kvitteringer/fakturaer vi har hentet inn, men som IKKE er bokført OG ikke matcher
 * noen betaling i banken. Typisk fordi de ble betalt privat / med et annet kort →
 * kandidater for utlegg. (Bilag som matcher en betaling håndteres av dokumentjakten.)
 */
export async function receiptsWithoutPayment(
  db: Db,
  params: { organizationId: string },
): Promise<OrphanReceipt[]> {
  const org = params.organizationId;
  const docs = await loadUnlinkedDocs(db, org);
  if (docs.length === 0) return [];
  // Uavstemte utbetalinger — for å utelukke bilag som HAR en sannsynlig betaling.
  const payRes = await db.query(
    `SELECT booked_date::TEXT AS booked_date, amount_minor::TEXT AS amount_minor, description, counterparty
     FROM bank_transactions WHERE organization_id=$1 AND status='unmatched' AND amount_minor < 0`,
    [org],
  );
  const payments = payRes.rows.map((r) => ({
    amountMinor: BigInt(r.amount_minor),
    bookedDate: r.booked_date as string,
    description: r.description as string,
    counterparty: (r.counterparty as string | null) ?? null,
  }));
  const typeRes = await db.query(
    `SELECT DISTINCT ON (document_id) document_id, document_type
     FROM extracted_document_data ORDER BY document_id, extraction_version DESC`,
  );
  const docType = new Map<string, string | null>(typeRes.rows.map((r) => [r.document_id as string, (r.document_type as string | null) ?? null]));

  const orphans: OrphanReceipt[] = [];
  for (const doc of docs) {
    const hasPayment = payments.some((p) => scoreCandidates(p, [doc]).length > 0);
    if (hasPayment) continue; // dette er en dokumentjakt-sak, ikke et utlegg
    orphans.push({ documentId: doc.id, vendor: doc.vendor, dateText: doc.dateText, grossMinor: doc.grossMinor, documentType: docType.get(doc.id) ?? null });
  }
  return orphans;
}

interface UtleggBooking {
  accountNumber: string;
  vatCodeStr: string;
  ownerAccount: string;
  netMinor: bigint;
  vatMinor: bigint;
  grossMinor: bigint;
  vendor: string | null;
  invoiceNumber: string | null;
  isoDate: string;
  lines: Parameters<typeof postJournalEntry>[1]['lines'];
}

/** Utleder (uten å skrive) et utlegg: kostnad + evt. mva DEBET, eier-mellomregning KREDIT. */
async function deriveUtlegg(db: Db, rules: RuleRegister, org: string, documentId: string): Promise<UtleggBooking> {
  const orgRes = await db.query(`SELECT org_form, vat_status FROM organizations WHERE id = $1`, [org]);
  if (!orgRes.rowCount) throw new NotFoundError('Virksomheten finnes ikke.');
  const orgForm = String(orgRes.rows[0].org_form);
  const vatStatus = orgRes.rows[0].vat_status as 'registered' | 'not_registered' | 'pending';

  const exRes = await db.query(
    `SELECT vendor_name, vendor_org_number, invoice_number, invoice_date::TEXT AS invoice_date,
            currency, net_minor, vat_minor, gross_minor, document_type, foreign_service
     FROM extracted_document_data WHERE document_id = $1 ORDER BY extraction_version DESC LIMIT 1`,
    [documentId],
  );
  if (!exRes.rowCount) throw new NotFoundError('Bilaget mangler tolkede data.');
  const linked = await db.query(`SELECT 1 FROM journal_entries WHERE source_document_id = $1 LIMIT 1`, [documentId]);
  if (linked.rowCount) throw new ConflictError('Bilaget er allerede bokført.');
  const ex = exRes.rows[0];
  if (ex.gross_minor === null || BigInt(ex.gross_minor) <= 0n) {
    throw new ValidationError('Bilaget mangler et beløp — kan ikke bokføres som utlegg automatisk.');
  }
  const grossMinor = BigInt(ex.gross_minor);
  const isoDate = (ex.invoice_date as string | null) ?? new Date().toISOString().slice(0, 10);

  const data: ExtractedData = {
    documentType: (ex.document_type as ExtractedData['documentType']) ?? 'receipt',
    ...(ex.vendor_name ? { vendorName: ex.vendor_name as string } : {}),
    ...(ex.vendor_org_number ? { vendorOrgNumber: ex.vendor_org_number as string } : {}),
    ...(ex.currency ? { currency: ex.currency as string } : {}),
    ...(ex.net_minor !== null ? { netMinor: BigInt(ex.net_minor) } : {}),
    ...(ex.vat_minor !== null ? { vatMinor: BigInt(ex.vat_minor) } : {}),
    grossMinor,
    ...(ex.foreign_service === true ? { foreignService: true } : {}),
  };
  const suggestion = await new DeterministicSuggestionEngine().suggest(data, { rules, vatStatus, isoDate });
  const accountNumber = suggestion.suggestedAccountNumber;
  const vatCodeStr = suggestion.suggestedVatCode;
  const vatCode = getVatCode(vatCodeStr);
  const vendor = (ex.vendor_name as string | null) ?? null;
  // Motpost: ENK → privatkonto (2060, øker egenkapitalen); AS → gjeld til eier (2900).
  const ownerAccount = orgForm === 'ENK' ? '2060' : '2900';

  const lines: Parameters<typeof postJournalEntry>[1]['lines'] = [];
  let netMinor: bigint;
  let vatMinor: bigint;
  if (vatCode && vatCode.direction === 'input' && vatCode.deductible && !vatCode.reverseCharge) {
    const parts = splitGrossByVatCode(rules, vatCodeStr, grossMinor, isoDate);
    netMinor = parts.netMinor;
    vatMinor = parts.vatMinor;
    lines.push({ accountNumber, debitMinor: parts.netMinor, vatCode: vatCodeStr, ...(vendor ? { description: vendor } : {}) });
    if (parts.vatMinor > 0n) lines.push({ accountNumber: '2710', debitMinor: parts.vatMinor, vatCode: vatCodeStr, description: `Inngående mva ${parts.ratePct} %` });
  } else {
    netMinor = grossMinor;
    vatMinor = 0n;
    lines.push({ accountNumber, debitMinor: grossMinor, ...(vatCode ? { vatCode: vatCodeStr } : {}), ...(vendor ? { description: vendor } : {}) });
  }
  lines.push({ accountNumber: ownerAccount, creditMinor: grossMinor, description: 'Betalt privat (utlegg)' });

  return {
    accountNumber,
    vatCodeStr,
    ownerAccount,
    netMinor,
    vatMinor,
    grossMinor,
    vendor,
    invoiceNumber: (ex.invoice_number as string | null) ?? null,
    isoDate,
    lines,
  };
}

export interface UtleggPreview {
  accountNumber: string;
  accountName: string;
  vatCode: string;
  vatCodeName: string;
  ownerAccount: string;
  ownerAccountName: string;
  netMinor: bigint;
  vatMinor: bigint;
  grossMinor: bigint;
  vendor: string | null;
}

/** Forhåndsvisning av et utlegg — hva det vil bokføre, uten å skrive. */
export async function previewUtlegg(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; documentId: string },
): Promise<UtleggPreview> {
  const b = await deriveUtlegg(db, rules, params.organizationId, params.documentId);
  const vat = getVatCode(b.vatCodeStr);
  return {
    accountNumber: b.accountNumber,
    accountName: getAccountDef(b.accountNumber)?.name ?? b.accountNumber,
    vatCode: b.vatCodeStr,
    vatCodeName: vat?.name ?? b.vatCodeStr,
    ownerAccount: b.ownerAccount,
    ownerAccountName: getAccountDef(b.ownerAccount)?.name ?? b.ownerAccount,
    netMinor: b.netMinor,
    vatMinor: b.vatMinor,
    grossMinor: b.grossMinor,
    vendor: b.vendor,
  };
}

/**
 * Bokfører et bilag som utlegg (betalt privat): kostnad + evt. inngående mva DEBET,
 * eier-mellomregning KREDIT. Ingen bank involvert. Reversibelt og revisjonslogget.
 * Idempotent per bilag.
 */
export async function bookDocumentAsUtlegg(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; actor: Actor; documentId: string },
): Promise<{ entryNumber: number; accountNumber: string; ownerAccount: string; vatCode: string }> {
  const { organizationId: org, actor, documentId } = params;
  const b = await deriveUtlegg(db, rules, org, documentId);

  const entry = await postJournalEntry(db, {
    organizationId: org,
    actor,
    entryDate: b.isoDate,
    description: `Utlegg${b.vendor ? ` — ${b.vendor}` : ''}${b.invoiceNumber ? ` (faktura ${b.invoiceNumber})` : ''} (betalt privat)`,
    lines: b.lines,
    idempotencyKey: `utlegg:${documentId}`,
    sourceDocumentId: documentId,
  });

  await withTransaction(db, async (client) => {
    await client.query(`UPDATE source_documents SET status = 'posted', updated_at = now(), version = version + 1 WHERE id = $1 AND organization_id = $2`, [documentId, org]);
    await recordAuditEvent(client, {
      organizationId: org,
      actor,
      action: 'document.booked_as_utlegg',
      entityType: 'source_document',
      entityId: documentId,
      newValue: { journalEntryId: entry.id, entryNumber: entry.entryNumber, accountNumber: b.accountNumber, ownerAccount: b.ownerAccount, vatCode: b.vatCodeStr },
    });
  });

  return { entryNumber: entry.entryNumber, accountNumber: b.accountNumber, ownerAccount: b.ownerAccount, vatCode: b.vatCodeStr };
}
