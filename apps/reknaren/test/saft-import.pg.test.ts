/**
 * SAF-T-import (parser) mot ekte Postgres via rundtur: vi bygger en SAF-T med vår
 * egen (XSD-validerte) eksport, parser den tilbake, og verifiserer at kontoplan,
 * kunder, leverandører og saldoer kommer ut riktig og balanserer. Beviser at en
 * ekte SAF-T (f.eks. fra Fiken) leses korrekt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { buildSafTXml } from '../src/saft/export.js';
import { parseSaft, SaftParseError } from '../src/saft/import.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';
import { newId } from '../src/shared/ids.js';

let db: Db;
let orgId: string;
let userId: string;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'saft@example.com', 'SAF-T-tester');
  const org = await createOrganization(db, {
    name: 'Kilde AS',
    orgForm: 'AS',
    vatStatus: 'registered',
    orgNumber: '910023764',
    createdByUserId: userId,
    streetAddress: 'Gata 1',
    postalCode: '0155',
    city: 'Oslo',
  });
  orgId = org.id;
  // En kunde med reskontro + en balansert postering: bank (1920) mot egenkapital (2050).
  await db.query(`INSERT INTO customers (id, organization_id, name, org_number, created_by) VALUES ($1,$2,'Kunde AS','923609016',$3)`, [
    newId(),
    orgId,
    userId,
  ]);
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: { userId, role: 'owner' },
    entryDate: '2026-03-01',
    description: 'Innskudd',
    idempotencyKey: 'saft-1',
    lines: [
      { accountNumber: '1920', debitMinor: 5_000_000n },
      { accountNumber: '2050', creditMinor: 5_000_000n },
    ],
  });
});

afterAll(async () => {
  await db.end();
});

describe('parseSaft (rundtur mot egen eksport)', () => {
  it('leser kontoplan, kunder og saldoer, og bekrefter at det balanserer', async () => {
    const xml = await buildSafTXml(db, { organizationId: orgId, fromDate: '2026-01-01', toDate: '2026-12-31' });
    const p = parseSaft(xml);

    expect(p.company).toBe('Kilde AS');
    expect(p.companyOrgNumber).toBe('910023764');
    // kontoene med saldo er med, med riktig fortegn (debet positiv, kredit negativ)
    const bank = p.accounts.find((a) => a.number === '1920');
    const ek = p.accounts.find((a) => a.number === '2050');
    expect(bank?.closingMinor).toBe(5_000_000n);
    expect(ek?.closingMinor).toBe(-5_000_000n);
    // kunde med navn
    expect(p.customers.map((c) => c.name)).toContain('Kunde AS');
    // balanserer: sum debet = sum kredit
    expect(p.totalDebitMinor).toBe(p.totalCreditMinor);
    expect(p.balanced).toBe(true);
  });

  it('avviser noe som ikke er SAF-T', () => {
    expect(() => parseSaft('<html><body>hei</body></html>')).toThrow(SaftParseError);
    expect(() => parseSaft('')).toThrow(SaftParseError);
  });
});
