/**
 * Fakturamodulen mot ekte Postgres: kladd → utstedelse (nummerserie, KID,
 * automatisk bokføring) → innbetalingsmatching → betalt → kreditnota.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { approveMatch, suggestMatches } from '../src/bank/matching.js';
import type { Db } from '../src/db/pool.js';
import {
  createCreditNote,
  createInvoiceDraft,
  generateKid,
  isValidKid,
  issueInvoice,
} from '../src/invoicing/service.js';
import { generalLedger, incomeStatement, subledger } from '../src/ledger/reports.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { buildVatReport } from '../src/vat/engine.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
let customerId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'faktura@example.com', 'Fakturatester');
  const org = await createOrganization(db, {
    name: 'Fakturatest ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;
  customerId = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, email, created_by)
     VALUES ($1,$2,'Bryllupsparet Hansen','hansen@example.com',$3)`,
    [customerId, orgId, userId],
  );
});

afterAll(async () => {
  await db.end();
});

describe('KID (MOD10)', () => {
  it('genererer gyldig kontrollsiffer', () => {
    const kid = generateKid('42', 1n);
    expect(kid).toMatch(/^42\d{8}$/);
    expect(isValidKid(kid)).toBe(true);
  });
  it('avviser manipulert KID', () => {
    const kid = generateKid('42', 7n);
    const tampered = kid.slice(0, -1) + ((Number(kid.at(-1)) + 1) % 10);
    expect(isValidKid(tampered)).toBe(false);
  });
});

describe('Faktura: kladd → utstedelse → betaling → kreditnota', () => {
  let invoiceId: string;
  let kid: string;

  it('kladd beregner mva eksakt per linje (inkl. brøkantall)', async () => {
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-10',
      dueDate: '2025-11-24',
      lines: [
        {
          description: 'Bryllupsfotografering',
          quantityThousandths: 1000n, // 1 stk
          unitPriceMinor: 2400000n, // 24 000,00 eks. mva
          vatCode: '3',
        },
        {
          description: 'Ekstra timer redigering',
          quantityThousandths: 2500n, // 2,5 timer
          unitPriceMinor: 120000n, // 1 200,00/t
          vatCode: '3',
        },
      ],
    });
    invoiceId = draft.id;
    // 24 000 + 2,5×1 200 = 27 000 netto; mva 25 % = 6 750; brutto 33 750.
    expect(draft.netMinor).toBe(2700000n);
    expect(draft.vatMinor).toBe(675000n);
    expect(draft.grossMinor).toBe(3375000n);
  });

  it('avviser inngående mva-kode og ikke-inntektskonto', async () => {
    await expect(
      createInvoiceDraft(db, rules, {
        organizationId: orgId,
        actor: actor(),
        customerId,
        lines: [
          { description: 'x', quantityThousandths: 1000n, unitPriceMinor: 100n, vatCode: '1' },
        ],
      }),
    ).rejects.toThrow(/ikke en utgående kode/);
    await expect(
      createInvoiceDraft(db, rules, {
        organizationId: orgId,
        actor: actor(),
        customerId,
        lines: [
          {
            description: 'x',
            quantityThousandths: 1000n,
            unitPriceMinor: 100n,
            vatCode: '3',
            revenueAccount: '6551',
          },
        ],
      }),
    ).rejects.toThrow(/ikke en inntektskonto/);
  });

  it('utstedelse gir nummer 1, gyldig KID og balansert bokføring', async () => {
    const issued = await issueInvoice(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId,
    });
    expect(issued.invoiceNumber).toBe(1n);
    expect(isValidKid(issued.kid)).toBe(true);
    kid = issued.kid;

    const lines = await generalLedger(db, { organizationId: orgId });
    const entryLines = lines.filter((l) => l.entryId === issued.journalEntryId);
    const byAccount = Object.fromEntries(
      entryLines.map((l) => [l.accountNumber, l.debitMinor - l.creditMinor]),
    );
    expect(byAccount['1500']).toBe(3375000n); // kundefordring brutto
    expect(byAccount['3000']).toBe(-2700000n); // inntekt netto
    expect(byAccount['2700']).toBe(-675000n); // utgående mva

    // Utstedelse er idempotent: samme nummer, samme bilag, ingen dobbel bokføring.
    const again = await issueInvoice(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId,
    });
    expect(again.invoiceNumber).toBe(1n);
    expect(again.journalEntryId).toBe(issued.journalEntryId);
  });

  it('nummerserien er fortløpende uten hull', async () => {
    const draft2 = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-12',
      lines: [
        { description: 'Fotoprint', quantityThousandths: 1000n, unitPriceMinor: 50000n, vatCode: '3' },
      ],
    });
    const issued2 = await issueInvoice(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId: draft2.id,
    });
    expect(issued2.invoiceNumber).toBe(2n);
  });

  it('utstedt faktura kan ikke endres direkte i databasen (trigger)', async () => {
    await expect(
      db.query(`UPDATE invoices SET gross_minor = 1 WHERE id = $1`, [invoiceId]),
    ).rejects.toThrow(/kan ikke endres/);
    await expect(db.query(`DELETE FROM invoices WHERE id = $1`, [invoiceId])).rejects.toThrow(
      /kan ikke slettes/,
    );
  });

  it('MVA-rapporten viser utgående mva fra fakturaene', async () => {
    const report = await buildVatReport(db, orgId, '2025-11-01', '2025-11-30');
    const code3 = report.lines.find((l) => l.vatCode === '3');
    expect(code3?.baseMinor).toBe(2750000n); // 27 000 + 500
    expect(code3?.vatMinor).toBe(687500n);
    expect(report.outputVatMinor).toBe(687500n);
    expect(report.netPayableMinor).toBe(687500n); // ingen inngående i denne testen
  });

  it('innbetaling med KID matches, bokføres og markerer fakturaen betalt', async () => {
    const bankAccountId = await createBankAccount(db, {
      organizationId: orgId,
      actor: actor(),
      name: 'Driftskonto',
      ibanOrAccount: '15032512345',
    });
    await importBankTransactions(db, {
      organizationId: orgId,
      actor: actor(),
      bankAccountId,
      transactions: [
        {
          externalId: 'in-001',
          bookedDate: '2025-11-20',
          amountMinor: 3375000n,
          description: 'Innbetaling',
          counterparty: 'HANSEN',
          kid,
        },
      ],
    });
    const suggestions = await suggestMatches(db, { organizationId: orgId });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.direction).toBe('incoming');
    expect(suggestions[0]!.matchType).toBe('exact');
    expect(suggestions[0]!.explanation).toContain('KID');

    const before = await subledger(db, orgId, 'customers');
    expect(before[0]!.balanceMinor).toBe(3437500n); // begge fakturaer utestående (33 750 + 625)

    const entry = await approveMatch(db, {
      organizationId: orgId,
      actor: actor(),
      matchId: suggestions[0]!.matchId,
    });
    expect(entry.status).toBe('posted');

    const after = await subledger(db, orgId, 'customers');
    expect(after[0]!.balanceMinor).toBe(62500n); // kun faktura 2 (625,00 kr brutto) igjen

    const inv = await db.query(`SELECT status, paid_minor FROM invoices WHERE id = $1`, [invoiceId]);
    expect(inv.rows[0].status).toBe('paid');
    expect(inv.rows[0].paid_minor).toBe('3375000');
  });

  it('kreditnota reverserer inntekt, mva og reskontro — og kan ikke gjentas', async () => {
    // Krediter faktura 2 (fortsatt utestående).
    const inv2 = await db.query(
      `SELECT id FROM invoices WHERE organization_id = $1 AND invoice_number = 2`,
      [orgId],
    );
    const credit = await createCreditNote(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId: inv2.rows[0].id,
      reason: 'Print ble aldri levert',
    });
    expect(credit.creditNoteNumber).toBe(3n);

    const after = await subledger(db, orgId, 'customers');
    expect(after[0]!.balanceMinor).toBe(0n); // alt oppgjort

    const pnl = await incomeStatement(db, { organizationId: orgId });
    expect(pnl.revenueMinor).toBe(2700000n); // kun den betalte fakturaen står igjen

    const inv2After = await db.query(`SELECT status FROM invoices WHERE id = $1`, [inv2.rows[0].id]);
    expect(inv2After.rows[0].status).toBe('credited');

    await expect(
      createCreditNote(db, rules, {
        organizationId: orgId,
        actor: actor(),
        invoiceId: inv2.rows[0].id,
        reason: 'igjen',
      }),
    ).rejects.toThrow(/Kun utstedte|allerede kreditert/);
  });
});
