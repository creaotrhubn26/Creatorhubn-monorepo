/**
 * Avstemmingsmotor. Deterministiske regler først (KID, beløp+dato, beløp+navn);
 * AI kan senere foreslå i uklare tilfeller bak samme forklaringskrav.
 * Hvert treff har en forklaring brukeren kan vurdere, og ingenting bokføres
 * før et menneske med bokføringsrettighet godkjenner treffet.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { postJournalEntry, type PostedJournalEntry } from '../ledger/engine.js';
import { newId } from '../shared/ids.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export interface MatchSuggestion {
  matchId: string;
  bankTransactionId: string;
  sourceDocumentId: string;
  journalEntryId: string;
  matchType: 'exact' | 'rule';
  explanation: string;
}

/**
 * Foreslår koblinger mellom umatchede utbetalinger og bokførte
 * leverandørfakturaer som ennå ikke er betalingsmatchet.
 */
export async function suggestMatches(
  db: Db,
  params: { organizationId: string; bankAccountId?: string },
): Promise<MatchSuggestion[]> {
  const args: unknown[] = [params.organizationId];
  let accountFilter = '';
  if (params.bankAccountId) {
    args.push(params.bankAccountId);
    accountFilter = ` AND t.bank_account_id = $${args.length}`;
  }
  // Kandidater: umatchet utbetaling × bokført faktura med samme bruttobeløp,
  // uten eksisterende åpent/godkjent forslag på noen av sidene.
  const res = await db.query(
    `SELECT t.id AS tx_id, t.booked_date::TEXT AS booked_date, t.amount_minor, t.kid AS tx_kid,
            t.counterparty, t.description AS tx_description,
            d.id AS doc_id, e.kid AS doc_kid, e.vendor_name, e.invoice_number,
            e.invoice_date::TEXT AS invoice_date, e.due_date::TEXT AS due_date,
            e.gross_minor, j.id AS entry_id, j.entry_number
     FROM bank_transactions t
     JOIN source_documents d
       ON d.organization_id = t.organization_id AND d.status = 'posted'
     JOIN extracted_document_data e ON e.document_id = d.id
     JOIN journal_entries j ON j.source_document_id = d.id AND j.status = 'posted'
     WHERE t.organization_id = $1
       AND t.status = 'unmatched'
       AND t.amount_minor < 0
       AND e.gross_minor = -t.amount_minor${accountFilter}
       AND NOT EXISTS (
         SELECT 1 FROM reconciliation_matches m
         WHERE m.organization_id = t.organization_id
           AND m.status IN ('suggested','approved')
           AND (m.bank_transaction_id = t.id OR m.source_document_id = d.id)
       )
     ORDER BY t.booked_date, t.id`,
    args,
  );

  const suggestions: MatchSuggestion[] = [];
  const usedTx = new Set<string>();
  const usedDoc = new Set<string>();

  // Prioriter KID-treff (sikrest), deretter dato-/navnsregler.
  const kidScore = (r: { tx_kid: string | null; doc_kid: string | null }) =>
    r.tx_kid && r.doc_kid && r.tx_kid === r.doc_kid ? 0 : 1;
  const rows = [...res.rows].sort((a, b) => kidScore(a) - kidScore(b));

  for (const row of rows) {
    if (usedTx.has(row.tx_id) || usedDoc.has(row.doc_id)) continue;
    const amountKr = (BigInt(-row.amount_minor) / 100n).toString();
    let matchType: 'exact' | 'rule' | null = null;
    let explanation = '';

    if (row.tx_kid && row.doc_kid && row.tx_kid === row.doc_kid) {
      matchType = 'exact';
      explanation = `KID ${row.tx_kid} på betalingen er identisk med KID på faktura ${row.invoice_number ?? ''} fra ${row.vendor_name ?? 'ukjent leverandør'}, og beløpet (${amountKr} kr) stemmer.`;
    } else if (withinDateWindow(row.booked_date, row.invoice_date, row.due_date)) {
      matchType = 'rule';
      explanation = `Beløpet (${amountKr} kr) er identisk med faktura ${row.invoice_number ?? ''} fra ${row.vendor_name ?? 'ukjent leverandør'}, og betalingsdatoen ${row.booked_date} ligger i fakturaens betalingsvindu.`;
    } else if (
      row.vendor_name &&
      row.counterparty &&
      normalize(row.counterparty).includes(normalize(row.vendor_name).slice(0, 12))
    ) {
      matchType = 'rule';
      explanation = `Beløpet (${amountKr} kr) stemmer med faktura ${row.invoice_number ?? ''}, og mottakeren «${row.counterparty}» ligner leverandørnavnet «${row.vendor_name}».`;
    }
    if (!matchType) continue;

    const matchId = newId();
    await withTransaction(db, async (client) => {
      await client.query(
        `INSERT INTO reconciliation_matches
           (id, organization_id, bank_transaction_id, journal_entry_id, source_document_id,
            match_type, matched_amount_minor, explanation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          matchId,
          params.organizationId,
          row.tx_id,
          row.entry_id,
          row.doc_id,
          matchType,
          row.amount_minor,
          explanation,
        ],
      );
      await recordAuditEvent(client, {
        organizationId: params.organizationId,
        actor: null,
        action: 'reconciliation_match.suggested',
        entityType: 'reconciliation_match',
        entityId: matchId,
        newValue: { matchType, explanation, bankTransactionId: row.tx_id, documentId: row.doc_id },
      });
    });
    usedTx.add(row.tx_id);
    usedDoc.add(row.doc_id);
    suggestions.push({
      matchId,
      bankTransactionId: row.tx_id,
      sourceDocumentId: row.doc_id,
      journalEntryId: row.entry_id,
      matchType,
      explanation,
    });
  }
  return suggestions;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function withinDateWindow(
  bookedDate: string,
  invoiceDate: string | null,
  dueDate: string | null,
): boolean {
  if (!invoiceDate && !dueDate) return false;
  const from = invoiceDate ?? dueDate!;
  const to = addDays(dueDate ?? invoiceDate!, 10);
  return bookedDate >= from && bookedDate <= to;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Godkjenner et foreslått treff: bokfører betalingen (debet leverandørgjeld,
 * kredit bank) og markerer transaksjonen som matchet. Idempotent per treff.
 */
export async function approveMatch(
  db: Db,
  params: { organizationId: string; actor: Actor; matchId: string },
): Promise<PostedJournalEntry> {
  const match = await db.query(
    `SELECT m.*, t.booked_date::TEXT AS booked_date, t.amount_minor AS tx_amount,
            t.bank_account_id, b.ledger_account_number,
            e.vendor_name, e.invoice_number
     FROM reconciliation_matches m
     JOIN bank_transactions t ON t.id = m.bank_transaction_id
     JOIN bank_accounts b ON b.id = t.bank_account_id
     LEFT JOIN extracted_document_data e ON e.document_id = m.source_document_id
     WHERE m.id = $1 AND m.organization_id = $2`,
    [params.matchId, params.organizationId],
  );
  if (!match.rowCount) throw new NotFoundError('Treffet finnes ikke.');
  const row = match.rows[0];
  if (row.status !== 'suggested') {
    throw new ConflictError(`Treffet er allerede ${row.status === 'approved' ? 'godkjent' : 'avvist'}.`);
  }

  // Finn leverandøren fra fakturaposteringens reskontrolinje (2400).
  const vendorLine = await db.query(
    `SELECT vendor_id FROM journal_lines
     WHERE entry_id = $1 AND account_number = '2400' AND vendor_id IS NOT NULL
     LIMIT 1`,
    [row.journal_entry_id],
  );
  const vendorId: string | undefined = vendorLine.rowCount
    ? vendorLine.rows[0].vendor_id
    : undefined;

  const amount = -BigInt(row.tx_amount); // utbetaling: positivt beløp å føre
  if (amount <= 0n) throw new ValidationError('Kun utbetalinger støttes i denne flyten.');

  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: params.actor,
    entryDate: row.booked_date,
    description: `Betaling av ${row.vendor_name ?? 'leverandørfaktura'}${row.invoice_number ? ` ${row.invoice_number}` : ''}`,
    idempotencyKey: `bank-match:${params.matchId}`,
    lines: [
      { accountNumber: '2400', debitMinor: amount, ...(vendorId ? { vendorId } : {}) },
      { accountNumber: row.ledger_account_number, creditMinor: amount },
    ],
  });

  await withTransaction(db, async (client) => {
    const updated = await client.query(
      `UPDATE reconciliation_matches
       SET status = 'approved', approved_by = $3, approved_at = now()
       WHERE id = $1 AND organization_id = $2 AND status = 'suggested'
       RETURNING id`,
      [params.matchId, params.organizationId, params.actor.userId],
    );
    if (updated.rowCount) {
      await client.query(
        `UPDATE bank_transactions SET status = 'matched' WHERE id = $1 AND organization_id = $2`,
        [row.bank_transaction_id, params.organizationId],
      );
      await recordAuditEvent(client, {
        organizationId: params.organizationId,
        actor: params.actor,
        action: 'reconciliation_match.approved',
        entityType: 'reconciliation_match',
        entityId: params.matchId,
        newValue: { paymentEntryId: entry.id, paymentEntryNumber: entry.entryNumber },
      });
    }
  });
  return entry;
}

export async function rejectMatch(
  db: Db,
  params: { organizationId: string; actor: Actor; matchId: string; reason: string },
): Promise<void> {
  if (!params.reason.trim()) throw new ValidationError('Avvisning krever begrunnelse.');
  await withTransaction(db, async (client) => {
    const updated = await client.query(
      `UPDATE reconciliation_matches SET status = 'rejected'
       WHERE id = $1 AND organization_id = $2 AND status = 'suggested'
       RETURNING bank_transaction_id`,
      [params.matchId, params.organizationId],
    );
    if (!updated.rowCount) {
      throw new NotFoundError('Treffet finnes ikke eller er allerede behandlet.');
    }
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'reconciliation_match.rejected',
      entityType: 'reconciliation_match',
      entityId: params.matchId,
      reason: params.reason,
    });
  });
}
