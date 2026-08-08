/**
 * Pengevakter i fakturamodulen (fase 2 — funn fra kode-review):
 *  A) negativt per-kode-aggregat (rabattlinje med egen mva-kode) må bokføres
 *     balansert som debet, ikke filtreres bort → ellers ubalanse + utstedt-men-
 *     ubokført faktura med hull i nummerserien.
 *  B) createCreditNote må avvise en kreditnota som kilde (ellers dobbel-kreditering).
 *  C) registerInvoicePayment må ikke la innbetaling overstige brutto.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { withTransaction } from '../src/db/pool.js';
import {
  createCreditNote,
  createInvoiceDraft,
  issueInvoice,
  registerInvoicePayment,
} from '../src/invoicing/service.js';
import { generalLedger } from '../src/ledger/reports.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
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
  userId = await ensureUser(db, 'penger@example.com', 'Pengetester');
  const org = await createOrganization(db, {
    name: 'Pengetest ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    orgNumber: '910000004',
    streetAddress: 'Fotoveien 1',
    postalCode: '0561',
    city: 'Oslo',
    createdByUserId: userId,
  });
  orgId = org.id;
  customerId = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, email, created_by)
     VALUES ($1,$2,'Kunde AS','kunde@example.com',$3)`,
    [customerId, orgId, userId],
  );
});

afterAll(async () => {
  await db.end();
});

describe('A) en 0-kroners linje låser ikke fakturaen ubokført', () => {
  it('utsteder og bokfører balansert når ett per-kode-aggregat blir null', async () => {
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-10',
      lines: [
        // +1 000,00 netto / +250,00 mva (25 %)
        { description: 'Tjeneste', quantityThousandths: 1000n, unitPriceMinor: 100000n, vatCode: '3' },
        // 0 kr med egen mva-kode → isolert null-aggregat på kode 31 (netto 0, mva 0)
        { description: 'Frakt (inkludert)', quantityThousandths: 1000n, unitPriceMinor: 0n, vatCode: '31' },
      ],
    });

    const issued = await issueInvoice(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId: draft.id,
    });
    expect(issued.journalEntryId).toBeTruthy();

    const lines = await generalLedger(db, { organizationId: orgId });
    const entryLines = lines.filter((l) => l.entryId === issued.journalEntryId);
    const debit = entryLines.reduce((s, l) => s + l.debitMinor, 0n);
    const credit = entryLines.reduce((s, l) => s + l.creditMinor, 0n);
    expect(debit).toBe(credit); // balansert
    // Ingen null-linje ble postert (hver linje har nøyaktig én positiv side).
    expect(entryLines.every((l) => (l.debitMinor > 0n) !== (l.creditMinor > 0n))).toBe(true);
    const net2700 = entryLines
      .filter((l) => l.accountNumber === '2700')
      .reduce((s, l) => s + l.creditMinor - l.debitMinor, 0n);
    expect(net2700).toBe(25000n); // kun kode 3: 250,00 kr utgående mva (25 000 øre)

    const inv = await db.query(`SELECT status, journal_entry_id FROM invoices WHERE id = $1`, [draft.id]);
    expect(inv.rows[0].status).toBe('issued');
    expect(inv.rows[0].journal_entry_id).toBe(issued.journalEntryId);
  });
});

describe('B) en kreditnota kan ikke krediteres på nytt', () => {
  it('avviser createCreditNote når kilden er en kreditnota', async () => {
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-11',
      lines: [{ description: 'Foto', quantityThousandths: 1000n, unitPriceMinor: 200000n, vatCode: '3' }],
    });
    await issueInvoice(db, rules, { organizationId: orgId, actor: actor(), invoiceId: draft.id });
    const credit = await createCreditNote(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId: draft.id,
      reason: 'Feil beløp',
    });

    await expect(
      createCreditNote(db, rules, {
        organizationId: orgId,
        actor: actor(),
        invoiceId: credit.creditNoteId,
        reason: 'krediterer kreditnotaen',
      }),
    ).rejects.toThrow();
  });
});

describe('C) innbetaling kan ikke overstige brutto', () => {
  it('avviser overbetaling og lar paid_minor stå på brutto', async () => {
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-12',
      lines: [{ description: 'Print', quantityThousandths: 1000n, unitPriceMinor: 80000n, vatCode: '3' }],
    });
    await issueInvoice(db, rules, { organizationId: orgId, actor: actor(), invoiceId: draft.id });
    const gross = 100000n; // 800 + 200 mva

    await withTransaction(db, (c) =>
      registerInvoicePayment(c, { organizationId: orgId, invoiceId: draft.id, amountMinor: gross }),
    );

    await expect(
      withTransaction(db, (c) =>
        registerInvoicePayment(c, { organizationId: orgId, invoiceId: draft.id, amountMinor: 5000n }),
      ),
    ).rejects.toThrow();

    const inv = await db.query(`SELECT paid_minor FROM invoices WHERE id = $1`, [draft.id]);
    expect(inv.rows[0].paid_minor).toBe(gross.toString());
  });
});
