/**
 * Bankimport. Banktilkoblinger (PSD2/open banking-leverandører) ligger bak
 * dette laget; MVP-et importerer normaliserte transaksjoner (f.eks. fra CSV)
 * idempotent på bankens transaksjons-ID. Import bokfører ALDRI noe selv —
 * matching og godkjenning er egne, kontrollerte steg.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { moneyFromDecimalString } from '../shared/money.js';
import { newId } from '../shared/ids.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';

export interface BankTransactionInput {
  /** Bankens/leverandørens unike ID — idempotensnøkkel for importen. */
  externalId: string;
  bookedDate: string; // ISO
  /** Beløp i øre; negativt = utbetaling, positivt = innbetaling. */
  amountMinor: bigint;
  currency?: string;
  description: string;
  counterparty?: string;
  kid?: string;
}

export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
}

export async function createBankAccount(
  db: Db,
  params: {
    organizationId: string;
    actor: Actor;
    name: string;
    ibanOrAccount: string;
    ledgerAccountNumber?: string;
  },
): Promise<string> {
  if (!/^[A-Z0-9 .]{8,34}$/i.test(params.ibanOrAccount.replace(/\s/g, ''))) {
    throw new ValidationError('Ugyldig konto-/IBAN-nummer.');
  }
  return withTransaction(db, async (client) => {
    const id = newId();
    await client.query(
      `INSERT INTO bank_accounts (id, organization_id, ledger_account_number, iban_or_account, name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        params.organizationId,
        params.ledgerAccountNumber ?? '1920',
        params.ibanOrAccount,
        params.name,
        params.actor.userId,
      ],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'bank_account.created',
      entityType: 'bank_account',
      entityId: id,
      newValue: { name: params.name },
    });
    return id;
  });
}

export async function importBankTransactions(
  db: Db,
  params: {
    organizationId: string;
    actor: Actor;
    bankAccountId: string;
    transactions: BankTransactionInput[];
  },
): Promise<ImportResult> {
  if (params.transactions.length === 0) return { imported: 0, skippedDuplicates: 0 };
  if (params.transactions.length > 10_000) {
    throw new ValidationError('Maks 10 000 transaksjoner per import.');
  }
  return withTransaction(db, async (client) => {
    const account = await client.query(
      `SELECT id FROM bank_accounts WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [params.bankAccountId, params.organizationId],
    );
    if (!account.rowCount) throw new NotFoundError('Bankkontoen finnes ikke eller er frakoblet.');

    let imported = 0;
    let skipped = 0;
    for (const tx of params.transactions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.bookedDate)) {
        throw new ValidationError(`Ugyldig dato på transaksjon ${tx.externalId}: ${tx.bookedDate}`);
      }
      if (tx.amountMinor === 0n) {
        throw new ValidationError(`Transaksjon ${tx.externalId} har nullbeløp.`);
      }
      const res = await client.query(
        `INSERT INTO bank_transactions
           (id, organization_id, bank_account_id, external_id, booked_date, amount_minor,
            currency, description, counterparty, kid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (bank_account_id, external_id) DO NOTHING`,
        [
          newId(),
          params.organizationId,
          params.bankAccountId,
          tx.externalId,
          tx.bookedDate,
          tx.amountMinor.toString(),
          tx.currency ?? 'NOK',
          tx.description,
          tx.counterparty ?? null,
          tx.kid ?? null,
        ],
      );
      if (res.rowCount) imported++;
      else skipped++;
    }
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'bank_transactions.imported',
      entityType: 'bank_account',
      entityId: params.bankAccountId,
      newValue: { imported, skippedDuplicates: skipped },
    });
    return { imported, skippedDuplicates: skipped };
  });
}

/**
 * Enkel CSV-parser for normalisert kontoutskrift:
 * `dato;beskrivelse;beløp;motpart;kid;referanse` (semikolon, norsk desimalkomma).
 * Header-linje er valgfri. Beløp parses eksakt — aldri flyttall.
 */
export function parseBankCsv(csv: string): BankTransactionInput[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: BankTransactionInput[] = [];
  for (const [index, line] of lines.entries()) {
    if (index === 0 && /dato/i.test(line)) continue; // header
    const parts = line.split(';').map((p) => p.trim());
    if (parts.length < 3) {
      throw new ValidationError(`CSV-linje ${index + 1} har for få felter: "${line}"`);
    }
    const [date, description, amount, counterparty, kid, reference] = parts;
    const tx: BankTransactionInput = {
      externalId: reference || `csv:${date}:${index}:${amount}`,
      bookedDate: date!,
      amountMinor: moneyFromDecimalString(amount!, 'NOK').minorUnits,
      description: description!,
    };
    if (counterparty) tx.counterparty = counterparty;
    if (kid) tx.kid = kid;
    result.push(tx);
  }
  return result;
}
