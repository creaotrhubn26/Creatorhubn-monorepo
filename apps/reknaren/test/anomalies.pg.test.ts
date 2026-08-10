/**
 * Feil-deteksjon på bokførte bilag mot ekte Postgres. Hver sjekk verifiseres
 * både positivt (fanger en plantet feil) og negativt (ingen falske treff på et
 * korrekt bilag).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { detectBookkeepingErrors } from '../src/ledger/anomalies.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const FROM = '2026-01-01';
const TO = '2026-12-31';
const actor = () => ({ userId, role: 'owner' });
const codes = (errs: { code: string }[]) => errs.map((e) => e.code);

async function newOrg(name: string, vatStatus: 'registered' | 'not_registered' = 'registered') {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus, createdByUserId: userId });
}

async function makeDocWithVat(orgId: string, vatMinor: bigint, vendor: string): Promise<string> {
  const docId = newId();
  await db.query(
    `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
     VALUES ($1,$2,'upload','bilag.pdf','application/pdf',100,$3,$4,'posted',$5)`,
    [docId, orgId, newId(), `k/${docId}`, userId],
  );
  await db.query(
    `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, currency, net_minor, vat_minor, gross_minor)
     VALUES ($1,$2,$3,'receipt',$4,'NOK',$5,$6,$7)`,
    [newId(), docId, orgId, vendor, 100000n - vatMinor, vatMinor, 100000n],
  );
  return docId;
}

async function makeVendor(orgId: string, name: string): Promise<string> {
  const id = newId();
  await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [
    id,
    orgId,
    name,
    userId,
  ]);
  return id;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'feil@example.com', 'Feiltester');
});

afterAll(async () => {
  await db.end();
});

describe('detectBookkeepingErrors', () => {
  it('rent regnskap → ingen feil', async () => {
    const org = await newOrg('Ren AS');
    const doc = await makeDocWithVat(org.id, 25000n, 'Leverandør AS');
    // Korrekt: kostnad + inngående mva + leverandørgjeld.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-01',
      description: 'Korrekt kjøp',
      lines: [
        { accountNumber: '6800', debitMinor: 80000n, vatCode: '1' },
        { accountNumber: '2710', debitMinor: 20000n, vatCode: '1' },
        { accountNumber: '2400', creditMinor: 100000n },
      ],
      idempotencyKey: `t:${doc}`,
      sourceDocumentId: doc,
    });
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(r.errors).toHaveLength(0);
  });

  it('glemt MVA-fradrag: dokument viser mva, men ingen 2710-linje → warning', async () => {
    const org = await newOrg('Glemt AS');
    const doc = await makeDocWithVat(org.id, 25000n, 'Strømleverandøren AS');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-02',
      description: 'Kjøp uten mva-fradrag',
      lines: [
        { accountNumber: '6340', debitMinor: 100000n }, // hele beløpet som kostnad, ingen 2710
        { accountNumber: '2400', creditMinor: 100000n },
      ],
      idempotencyKey: `t:${doc}`,
      sourceDocumentId: doc,
    });
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    const hit = r.errors.find((e) => e.code === 'glemt_mva_fradrag');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('250,00'); // 25000 øre MVA vist i kroner
    expect(hit!.documentId).toBe(doc);
    expect(hit!.entryNumber).toBeGreaterThan(0);
  });

  it('uregistrert virksomhet → glemt-mva-sjekken gir ingen treff', async () => {
    const org = await newOrg('Uregistrert AS', 'not_registered');
    const doc = await makeDocWithVat(org.id, 25000n, 'Leverandør AS');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-03',
      description: 'Kjøp',
      lines: [
        { accountNumber: '6340', debitMinor: 100000n },
        { accountNumber: '2400', creditMinor: 100000n },
      ],
      idempotencyKey: `t:${doc}`,
      sourceDocumentId: doc,
    });
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(codes(r.errors)).not.toContain('glemt_mva_fradrag');
  });

  it('mulig dobbeltføring: samme leverandør + beløp innen 10 dager → warning', async () => {
    const org = await newOrg('Dobbel AS');
    const vendor = await makeVendor(org.id, 'Kontorrekvisita AS');
    for (const [i, date] of [['a', '2026-04-01'], ['b', '2026-04-05']] as const) {
      await postJournalEntry(db, {
        organizationId: org.id,
        actor: actor(),
        entryDate: date,
        description: `Kjøp ${i}`,
        lines: [
          { accountNumber: '6800', debitMinor: 50000n, vatCode: '1', vendorId: vendor },
          { accountNumber: '2400', creditMinor: 50000n, vendorId: vendor },
        ],
        idempotencyKey: `dup:${i}`,
      });
    }
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    const hit = r.errors.find((e) => e.code === 'mulig_dobbeltforing');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('Kontorrekvisita AS');
    expect(hit!.detail).toContain('500,00');
  });

  it('ulike beløp / samme leverandør → ingen dobbeltføring-treff', async () => {
    const org = await newOrg('Ulik AS');
    const vendor = await makeVendor(org.id, 'Variabel AS');
    for (const [i, amt, date] of [['a', 50000n, '2026-05-01'], ['b', 60000n, '2026-05-03']] as const) {
      await postJournalEntry(db, {
        organizationId: org.id,
        actor: actor(),
        entryDate: date,
        description: `Kjøp ${i}`,
        lines: [
          { accountNumber: '6800', debitMinor: amt, vatCode: '1', vendorId: vendor },
          { accountNumber: '2400', creditMinor: amt, vendorId: vendor },
        ],
        idempotencyKey: `nodup:${i}`,
      });
    }
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(codes(r.errors)).not.toContain('mulig_dobbeltforing');
  });

  it('stort kjøp på aktiveringskandidat-konto → info om aktivering', async () => {
    const org = await newOrg('Aktiver AS');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-06-01',
      description: 'Ny server',
      lines: [
        { accountNumber: '6551', debitMinor: 4000000n, vatCode: '1' }, // 40 000 kr på Datautstyr
        { accountNumber: '2400', creditMinor: 4000000n },
      ],
      idempotencyKey: 'big:1',
    });
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    const hit = r.errors.find((e) => e.code === 'burde_aktiveres');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('Datautstyr');
    expect(hit!.ruleReferences).toContain('no.asset.expense-threshold');
  });

  it('lite kjøp på samme konto → ingen aktiverings-treff', async () => {
    const org = await newOrg('Smått AS');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-06-02',
      description: 'Mus og tastatur',
      lines: [
        { accountNumber: '6551', debitMinor: 90000n, vatCode: '1' }, // 900 kr
        { accountNumber: '2400', creditMinor: 90000n },
      ],
      idempotencyKey: 'small:1',
    });
    const r = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(codes(r.errors)).not.toContain('burde_aktiveres');
  });
});
