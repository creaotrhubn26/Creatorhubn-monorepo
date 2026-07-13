/**
 * Bokføringsmotoren: ekte dobbelt bokholderi.
 *
 * Invarianter (håndhevet her OG med constraints/triggere i databasen):
 *  - Hver postering balanserer: sum(debet) == sum(kredit), i øre (bigint).
 *  - Bokførte posteringer endres eller slettes aldri; feil rettes med reversering.
 *  - Posteringer i låst periode avvises.
 *  - Idempotens: samme (organisasjon, idempotencyKey) bokføres nøyaktig én gang.
 *  - Audit-hendelse skrives i samme transaksjon som posteringen.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db, DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import {
  NotFoundError,
  PeriodLockedError,
  UnbalancedEntryError,
  ValidationError,
} from '../shared/errors.js';
import { newId } from '../shared/ids.js';
import { getVatCode } from '../coa/vat-codes.js';

export interface JournalLineInput {
  accountNumber: string;
  /** Beløp i øre (NOK). Nøyaktig ett av feltene skal være > 0. */
  debitMinor?: bigint | undefined;
  creditMinor?: bigint | undefined;
  vatCode?: string | undefined;
  description?: string | undefined;
  vendorId?: string | undefined;
  customerId?: string | undefined;
  project?: string | undefined;
  department?: string | undefined;
  /** Original valuta når transaksjonen ikke er i NOK. */
  originalCurrency?: string | undefined;
  originalAmountMinor?: bigint | undefined;
  exchangeRate?: string | undefined;
  exchangeRateSource?: string | undefined;
}

export interface PostJournalEntryInput {
  organizationId: string;
  actor: Actor;
  entryDate: string; // ISO-dato
  description: string;
  lines: JournalLineInput[];
  idempotencyKey: string;
  sourceDocumentId?: string;
}

export interface PostedJournalEntry {
  id: string;
  entryNumber: number;
  organizationId: string;
  entryDate: string;
  status: 'posted' | 'reversed';
  /** true hvis kallet var idempotent gjentak og posteringen allerede fantes. */
  alreadyExisted: boolean;
}

function periodOf(isoDate: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new ValidationError(`Ugyldig dato: ${isoDate}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

function validateLines(lines: JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new ValidationError('En postering må ha minst to linjer (debet og kredit).');
  }
  let debitSum = 0n;
  let creditSum = 0n;
  for (const [i, line] of lines.entries()) {
    const debit = line.debitMinor ?? 0n;
    const credit = line.creditMinor ?? 0n;
    if (debit < 0n || credit < 0n) {
      throw new ValidationError(`Linje ${i + 1}: beløp kan ikke være negative.`);
    }
    if ((debit > 0n) === (credit > 0n)) {
      throw new ValidationError(
        `Linje ${i + 1}: nøyaktig ett av debet/kredit må være større enn null.`,
      );
    }
    if (line.vatCode !== undefined && !getVatCode(line.vatCode)) {
      throw new ValidationError(`Linje ${i + 1}: ukjent mva-kode ${line.vatCode}.`);
    }
    if (
      (line.originalCurrency !== undefined) !==
      (line.originalAmountMinor !== undefined && line.exchangeRate !== undefined)
    ) {
      throw new ValidationError(
        `Linje ${i + 1}: originalvaluta krever både beløp, valutakurs og kilde.`,
      );
    }
    debitSum += debit;
    creditSum += credit;
  }
  if (debitSum !== creditSum) {
    throw new UnbalancedEntryError(
      `Posteringen balanserer ikke: debet ${debitSum} øre ≠ kredit ${creditSum} øre.`,
    );
  }
  if (debitSum === 0n) {
    throw new ValidationError('Posteringen kan ikke være på null kroner.');
  }
}

/** Finner eller oppretter regnskapsperioden, og feiler hvis den er låst. */
async function resolveOpenPeriod(
  client: DbClient,
  organizationId: string,
  isoDate: string,
): Promise<string> {
  const { year, month } = periodOf(isoDate);
  const existing = await client.query(
    `SELECT id, status FROM accounting_periods
     WHERE organization_id = $1 AND year = $2 AND month = $3
     FOR UPDATE`,
    [organizationId, year, month],
  );
  if (existing.rowCount) {
    if (existing.rows[0].status === 'locked') {
      throw new PeriodLockedError(
        `Perioden ${year}-${String(month).padStart(2, '0')} er låst. Bruk korrigeringspostering i en åpen periode.`,
      );
    }
    return existing.rows[0].id;
  }
  const id = newId();
  await client.query(
    `INSERT INTO accounting_periods (id, organization_id, year, month) VALUES ($1,$2,$3,$4)`,
    [id, organizationId, year, month],
  );
  return id;
}

async function assertAccountsExist(
  client: DbClient,
  organizationId: string,
  lines: JournalLineInput[],
): Promise<void> {
  const numbers = [...new Set(lines.map((l) => l.accountNumber))];
  const res = await client.query(
    `SELECT account_number FROM ledger_accounts
     WHERE organization_id = $1 AND account_number = ANY($2) AND active`,
    [organizationId, numbers],
  );
  const found = new Set(res.rows.map((r) => r.account_number));
  const missing = numbers.filter((n) => !found.has(n));
  if (missing.length) {
    throw new NotFoundError(
      `Konto(er) finnes ikke i organisasjonens kontoplan: ${missing.join(', ')}`,
    );
  }
}

export async function postJournalEntry(
  db: Db,
  input: PostJournalEntryInput,
): Promise<PostedJournalEntry> {
  validateLines(input.lines);
  if (!input.idempotencyKey.trim()) {
    throw new ValidationError('idempotencyKey er påkrevd for all bokføring.');
  }
  return withTransaction(db, async (client) => {
    // Idempotens: returner eksisterende postering for samme nøkkel.
    const existing = await client.query(
      `SELECT id, entry_number, entry_date, status FROM journal_entries
       WHERE organization_id = $1 AND idempotency_key = $2`,
      [input.organizationId, input.idempotencyKey],
    );
    if (existing.rowCount) {
      const row = existing.rows[0];
      return {
        id: row.id,
        entryNumber: Number(row.entry_number),
        organizationId: input.organizationId,
        entryDate: row.entry_date.toISOString?.().slice(0, 10) ?? String(row.entry_date),
        status: row.status,
        alreadyExisted: true,
      };
    }

    await assertAccountsExist(client, input.organizationId, input.lines);
    const periodId = await resolveOpenPeriod(client, input.organizationId, input.entryDate);

    // Løpende bilagsnummer per organisasjon, uten hull ved samtidighet (radlås).
    const counter = await client.query(
      `INSERT INTO organization_counters (organization_id, next_entry_number)
       VALUES ($1, 2)
       ON CONFLICT (organization_id)
       DO UPDATE SET next_entry_number = organization_counters.next_entry_number + 1
       RETURNING next_entry_number - 1 AS entry_number`,
      [input.organizationId],
    );
    const entryNumber = Number(counter.rows[0].entry_number);

    const entryId = newId();
    await client.query(
      `INSERT INTO journal_entries
         (id, organization_id, entry_number, entry_date, period_id, description,
          source_document_id, idempotency_key, posted_by, posted_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entryId,
        input.organizationId,
        entryNumber,
        input.entryDate,
        periodId,
        input.description,
        input.sourceDocumentId ?? null,
        input.idempotencyKey,
        input.actor.userId,
        input.actor.role,
      ],
    );

    for (const [i, line] of input.lines.entries()) {
      await client.query(
        `INSERT INTO journal_lines
           (id, entry_id, organization_id, line_number, account_number, vat_code,
            debit_minor, credit_minor, original_currency, original_amount_minor,
            exchange_rate, exchange_rate_source, description, vendor_id, customer_id, project, department)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          newId(),
          entryId,
          input.organizationId,
          i + 1,
          line.accountNumber,
          line.vatCode ?? null,
          (line.debitMinor ?? 0n).toString(),
          (line.creditMinor ?? 0n).toString(),
          line.originalCurrency ?? null,
          line.originalAmountMinor?.toString() ?? null,
          line.exchangeRate ?? null,
          line.exchangeRateSource ?? null,
          line.description ?? null,
          line.vendorId ?? null,
          line.customerId ?? null,
          line.project ?? null,
          line.department ?? null,
        ],
      );
    }

    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'journal_entry.posted',
      entityType: 'journal_entry',
      entityId: entryId,
      newValue: {
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        lineCount: input.lines.length,
        sourceDocumentId: input.sourceDocumentId ?? null,
      },
    });

    return {
      id: entryId,
      entryNumber,
      organizationId: input.organizationId,
      entryDate: input.entryDate,
      status: 'posted',
      alreadyExisted: false,
    };
  });
}

export interface ReverseJournalEntryInput {
  organizationId: string;
  actor: Actor;
  entryId: string;
  /** Dato for reverseringen — må ligge i en åpen periode. */
  reversalDate: string;
  reason: string;
}

/**
 * Retter en feil ved å bokføre en motsatt postering og merke originalen
 * som reversert. Historikken beholdes komplett — ingenting slettes.
 */
export async function reverseJournalEntry(
  db: Db,
  input: ReverseJournalEntryInput,
): Promise<PostedJournalEntry> {
  if (!input.reason.trim()) {
    throw new ValidationError('Reversering krever en begrunnelse (revisjonsspor).');
  }
  return withTransaction(db, async (client) => {
    const orig = await client.query(
      `SELECT id, entry_number, status, description FROM journal_entries
       WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [input.entryId, input.organizationId],
    );
    if (!orig.rowCount) throw new NotFoundError('Posteringen finnes ikke.');
    if (orig.rows[0].status === 'reversed') {
      throw new ValidationError('Posteringen er allerede reversert.');
    }

    const lines = await client.query(
      `SELECT * FROM journal_lines WHERE entry_id = $1 ORDER BY line_number`,
      [input.entryId],
    );

    const periodId = await resolveOpenPeriod(client, input.organizationId, input.reversalDate);
    const counter = await client.query(
      `UPDATE organization_counters SET next_entry_number = next_entry_number + 1
       WHERE organization_id = $1
       RETURNING next_entry_number - 1 AS entry_number`,
      [input.organizationId],
    );
    if (!counter.rowCount) throw new NotFoundError('Organisasjonen mangler bilagsteller.');
    const entryNumber = Number(counter.rows[0].entry_number);

    const reversalId = newId();
    await client.query(
      `INSERT INTO journal_entries
         (id, organization_id, entry_number, entry_date, period_id, description,
          idempotency_key, reversal_of, posted_by, posted_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        reversalId,
        input.organizationId,
        entryNumber,
        input.reversalDate,
        periodId,
        `Reversering av bilag ${orig.rows[0].entry_number}: ${input.reason}`,
        `reversal:${input.entryId}`,
        input.entryId,
        input.actor.userId,
        input.actor.role,
      ],
    );

    for (const line of lines.rows) {
      await client.query(
        `INSERT INTO journal_lines
           (id, entry_id, organization_id, line_number, account_number, vat_code,
            debit_minor, credit_minor, original_currency, original_amount_minor,
            exchange_rate, exchange_rate_source, description, vendor_id, customer_id, project, department)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          newId(),
          reversalId,
          input.organizationId,
          line.line_number,
          line.account_number,
          line.vat_code,
          line.credit_minor, // byttet: debet ↔ kredit
          line.debit_minor,
          line.original_currency,
          line.original_amount_minor,
          line.exchange_rate,
          line.exchange_rate_source,
          line.description,
          line.vendor_id,
          line.customer_id,
          line.project,
          line.department,
        ],
      );
    }

    await client.query(`UPDATE journal_entries SET status = 'reversed' WHERE id = $1`, [
      input.entryId,
    ]);

    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'journal_entry.reversed',
      entityType: 'journal_entry',
      entityId: input.entryId,
      reason: input.reason,
      newValue: { reversalEntryId: reversalId, reversalEntryNumber: entryNumber },
    });

    return {
      id: reversalId,
      entryNumber,
      organizationId: input.organizationId,
      entryDate: input.reversalDate,
      status: 'posted',
      alreadyExisted: false,
    };
  });
}

export interface LockPeriodInput {
  organizationId: string;
  actor: Actor;
  year: number;
  month: number;
  reason: string;
}

export async function lockPeriod(db: Db, input: LockPeriodInput): Promise<void> {
  return withTransaction(db, async (client) => {
    const res = await client.query(
      `UPDATE accounting_periods
       SET status = 'locked', locked_by = $4, locked_at = now(), lock_reason = $5
       WHERE organization_id = $1 AND year = $2 AND month = $3 AND status = 'open'
       RETURNING id`,
      [input.organizationId, input.year, input.month, input.actor.userId, input.reason],
    );
    if (!res.rowCount) {
      // Perioden finnes ikke ennå → opprett den låst, eller den er allerede låst.
      const existing = await client.query(
        `SELECT id FROM accounting_periods WHERE organization_id=$1 AND year=$2 AND month=$3`,
        [input.organizationId, input.year, input.month],
      );
      if (existing.rowCount) {
        throw new ValidationError('Perioden er allerede låst.');
      }
      await client.query(
        `INSERT INTO accounting_periods (id, organization_id, year, month, status, locked_by, locked_at, lock_reason)
         VALUES ($1,$2,$3,$4,'locked',$5,now(),$6)`,
        [newId(), input.organizationId, input.year, input.month, input.actor.userId, input.reason],
      );
    }
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'accounting_period.locked',
      entityType: 'accounting_period',
      reason: input.reason,
      newValue: { year: input.year, month: input.month },
    });
  });
}
