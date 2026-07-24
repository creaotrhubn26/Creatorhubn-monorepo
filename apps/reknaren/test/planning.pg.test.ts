/**
 * Planlegger-motoren mot ekte Postgres: bank, forventet MVA, fordringer,
 * leverandørgjeld og 90-dagers likviditets-tidslinje.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { buildForecast } from '../src/ledger/planning.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const ASOF = '2025-06-15';
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'plan@example.com', 'Planleggingstester');
});

afterAll(async () => {
  await db.end();
});

describe('buildForecast', () => {
  it('samler bank, MVA, fordringer, gjeld og 90-dagers tidslinje', async () => {
    const org = await createOrganization(db, {
      name: 'Prognose AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    // Aksjekapital 30 000 kr inn på bank.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2025-01-02',
      description: 'Aksjekapital',
      lines: [
        { accountNumber: '1920', debitMinor: 3000000n },
        { accountNumber: '2000', creditMinor: 3000000n },
      ],
      idempotencyKey: 'p-ak',
    });
    // Salg med 25 % utgående mva (kundefordring, ikke bank).
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2025-05-20',
      description: 'Salg',
      lines: [
        { accountNumber: '1500', debitMinor: 1250000n },
        { accountNumber: '3000', creditMinor: 1000000n, vatCode: '3' },
        { accountNumber: '2700', creditMinor: 250000n, vatCode: '3' },
      ],
      idempotencyKey: 'p-salg',
    });
    // Leverandørkjøp på kreditt (leverandørgjeld 2400).
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2025-05-25',
      description: 'Innkjøp',
      lines: [
        { accountNumber: '6800', debitMinor: 500000n },
        { accountNumber: '2400', creditMinor: 500000n },
      ],
      idempotencyKey: 'p-kjop',
    });

    // Kundefaktura (utestående, forfall innen 90 dager).
    const custId = newId();
    await db.query(`INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [
      custId,
      org.id,
      'Storkunde AS',
      userId,
    ]);
    await db.query(
      `INSERT INTO invoices (id, organization_id, customer_id, invoice_number, invoice_date, due_date, gross_minor, paid_minor, status, created_by)
       VALUES ($1,$2,$3,1,'2025-05-20','2025-07-01',1250000,0,'issued',$4)`,
      [newId(), org.id, custId, userId],
    );

    // Leverandørbilag med forfall innen horisonten (til tidslinjen).
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'upload','lev.pdf','application/pdf',100,$3,$4,'posted',$5)`,
      [docId, org.id, newId(), `k/${docId}`, userId],
    );
    await db.query(
      `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, currency, gross_minor, due_date)
       VALUES ($1,$2,$3,'supplier_invoice','Leverandøren AS','NOK',500000,'2025-07-20')`,
      [newId(), docId, org.id],
    );

    const f = await buildForecast(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: ASOF });

    // Bank nå = kun aksjekapitalen (salg/kjøp traff fordring/gjeld, ikke bank).
    expect(f.cashNowMinor).toBe(3000000n);
    // Forventet MVA: termin mai–juni, forfall 10. august, å betale 2 500 kr.
    expect(f.forventetMva.fromDate).toBe('2025-05-01');
    expect(f.forventetMva.toDate).toBe('2025-06-30');
    expect(f.forventetMva.dueDate).toBe('2025-08-10');
    expect(f.forventetMva.netPayableMinor).toBe(250000n);
    // Ubetalte fakturaer.
    expect(f.ubetalteFakturaer.totalMinor).toBe(1250000n);
    expect(f.ubetalteFakturaer.count).toBe(1);
    // Leverandørgjeld.
    expect(f.kommendeKostnader.leverandorgjeldMinor).toBe(500000n);
    expect(f.kommendeKostnader.items).toHaveLength(1);
    // Tidslinje: 13 uker; sluttsaldo = 3 000 000 + 1 250 000 − 500 000 − 250 000.
    expect(f.likviditet.timeline).toHaveLength(13);
    expect(f.likviditet.endBalanceMinor).toBe(3500000n);
    // Innbetaling kommer før utbetalingene → aldri under startsaldo, ikke negativ.
    expect(f.likviditet.lowestBalanceMinor).toBe(3000000n);
    expect(f.likviditet.goesNegative).toBe(false);
  });

  it('gjenkjenner faste månedlige kostnader og projiserer dem framover', async () => {
    const org = await createOrganization(db, {
      name: 'Faste AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2025-01-02',
      description: 'Aksjekapital',
      lines: [
        { accountNumber: '1920', debitMinor: 3000000n },
        { accountNumber: '2000', creditMinor: 3000000n },
      ],
      idempotencyKey: 'r-ak',
    });
    const vendorId = newId();
    await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [
      vendorId,
      org.id,
      'Adobe',
      userId,
    ]);
    // Fire månedlige trekk på 249 kr, betalt fra bank.
    for (const [key, date] of [
      ['r1', '2025-02-15'],
      ['r2', '2025-03-15'],
      ['r3', '2025-04-15'],
      ['r4', '2025-05-15'],
    ] as const) {
      await postJournalEntry(db, {
        organizationId: org.id,
        actor: actor(),
        entryDate: date,
        description: 'Adobe abonnement',
        lines: [
          { accountNumber: '6810', debitMinor: 24900n, vatCode: '1', vendorId },
          { accountNumber: '1920', creditMinor: 24900n },
        ],
        idempotencyKey: key,
      });
    }

    const f = await buildForecast(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: ASOF });
    const rec = f.gjentakendeKostnader.find((r) => r.vendor === 'Adobe');
    expect(rec).toBeDefined();
    expect(rec!.cadence).toBe('monthly');
    expect(rec!.amountMinor).toBe(24900n);
    expect(rec!.confidence).toBe('high');
    expect(rec!.nextDates).toHaveLength(3); // ~30-dagers steg: juli/aug/sep innen 90 dager fra 15. juni
    // Tidslinjen trekker fra de tre projiserte forfallene.
    // Bank nå = 3 000 000 − 4×24 900 = 2 900 400; minus 3×24 900 = 2 825 700.
    expect(f.cashNowMinor).toBe(2900400n);
    expect(f.likviditet.endBalanceMinor).toBe(2825700n);
    expect(f.warnings.join(' ')).toContain('anslått');
  });

  it('flagger når prognosen går i minus', async () => {
    const org = await createOrganization(db, {
      name: 'Minus AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    // Lite på bank, stor leverandørgjeld med forfall snart.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2025-01-02',
      description: 'Oppstart',
      lines: [
        { accountNumber: '1920', debitMinor: 100000n },
        { accountNumber: '2000', creditMinor: 100000n },
      ],
      idempotencyKey: 'm-start',
    });
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'upload','stor.pdf','application/pdf',100,$3,$4,'posted',$5)`,
      [docId, org.id, newId(), `k/${docId}`, userId],
    );
    await db.query(
      `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, currency, gross_minor, due_date)
       VALUES ($1,$2,$3,'supplier_invoice','Dyr Leverandør AS','NOK',900000,'2025-07-10')`,
      [newId(), docId, org.id],
    );

    const f = await buildForecast(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: ASOF });
    expect(f.likviditet.goesNegative).toBe(true);
    expect(f.warnings.join(' ')).toContain('minus');
  });
});
