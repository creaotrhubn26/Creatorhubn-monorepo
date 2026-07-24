/**
 * Kontinuerlig regnskapsavslutning: readiness-prosent + dynamisk liste over hva
 * som gjenstår før en måned kan låses.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { assessPeriodClose } from '../src/ledger/period-close.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });
const codes = (a: { items: { code: string }[] }) => a.items.map((i) => i.code);

async function vendor(orgId: string, name: string): Promise<string> {
  const id = newId();
  await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [id, orgId, name, userId]);
  return id;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'close@example.com', 'Avslutningstester');
});

afterAll(async () => {
  await db.end();
});

describe('assessPeriodClose', () => {
  it('ren måned uten aktivitet → 100 % og klar til å låses', async () => {
    const org = await createOrganization(db, { name: 'Ren AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const a = await assessPeriodClose(db, rules, { organizationId: org.id, year: 2025, month: 3 });
    expect(a.readinessPct).toBe(100);
    expect(a.ready).toBe(true);
    expect(a.items).toHaveLength(0);
    expect(a.summary).toContain('Mars');
    expect(a.summary).toContain('klar til å låses');
  });

  it('måned med feil → lavere prosent, dynamisk liste og norsk sammendrag', async () => {
    const org = await createOrganization(db, { name: 'Rot AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    // Åpningssaldo på bank så den ikke går negativt.
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-01-02', description: 'Aksjekapital',
      lines: [{ accountNumber: '1920', debitMinor: 5000000n }, { accountNumber: '2000', creditMinor: 5000000n }],
      idempotencyKey: 'ak',
    });
    // Noen rene salgsbilag (ingen kostnadsdebet → utløser ingen sjekk).
    for (const [k, d] of [['ok1', '2025-03-02'], ['ok2', '2025-03-06'], ['ok3', '2025-03-09'], ['ok4', '2025-03-14'], ['ok5', '2025-03-20']] as const) {
      await postJournalEntry(db, {
        organizationId: org.id, actor: actor(), entryDate: d, description: 'Salg',
        lines: [{ accountNumber: '1920', debitMinor: 500000n }, { accountNumber: '3000', creditMinor: 400000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 100000n, vatCode: '3' }],
        idempotencyKey: k,
      });
    }
    const v = await vendor(org.id, 'Kontor AS');
    // Dobbeltføring: samme leverandør + beløp innen få dager (også uten bilag).
    for (const [k, d] of [['d1', '2025-03-05'], ['d2', '2025-03-08']] as const) {
      await postJournalEntry(db, {
        organizationId: org.id, actor: actor(), entryDate: d, description: 'Innkjøp',
        lines: [{ accountNumber: '6800', debitMinor: 300000n, vatCode: '1', vendorId: v }, { accountNumber: '2400', creditMinor: 300000n, vendorId: v }],
        idempotencyKey: k,
      });
    }
    // Stor forsikring → periodisering.
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-03-10', description: 'Årsforsikring',
      lines: [{ accountNumber: '7500', debitMinor: 1500000n }, { accountNumber: '1920', creditMinor: 1500000n }],
      idempotencyKey: 'fors',
    });
    // Omvendt avgiftsplikt → uvanlig MVA-kode.
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-03-12', description: 'Utenlandsk programvare',
      lines: [{ accountNumber: '6810', debitMinor: 400000n, vatCode: '86' }, { accountNumber: '1920', creditMinor: 400000n }],
      idempotencyKey: 'rc',
    });
    // Leverandørkjøp ført som privat (debet 2060 med leverandør).
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-03-15', description: 'Privat?',
      lines: [{ accountNumber: '2060', debitMinor: 200000n, vendorId: v }, { accountNumber: '1920', creditMinor: 200000n }],
      idempotencyKey: 'priv',
    });

    const a = await assessPeriodClose(db, rules, { organizationId: org.id, year: 2025, month: 3 });
    const c = codes(a);
    expect(c).toContain('dobbeltforing');
    expect(c).toContain('uten_bilag');
    expect(c).toContain('periodisering');
    expect(c).toContain('uvanlig_mva');
    expect(c).toContain('privat_feil');
    // Bank står positivt → ingen negativ-bank-blokker.
    expect(c).not.toContain('negativ_bank');
    expect(a.readinessPct).toBeLessThan(100);
    expect(a.readinessPct).toBeGreaterThan(0);
    expect(a.summary).toMatch(/^Mars er \d+ % ferdig avstemt\./);
  });

  it('negativ bankbeholdning ved månedsslutt gir blokker', async () => {
    const org = await createOrganization(db, { name: 'Minus AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    // Kun uttak, ingen innskudd → bank negativ.
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-03-04', description: 'Kjøp uten dekning',
      lines: [{ accountNumber: '6540', debitMinor: 900000n }, { accountNumber: '1920', creditMinor: 900000n }],
      idempotencyKey: 'neg',
    });
    const a = await assessPeriodClose(db, rules, { organizationId: org.id, year: 2025, month: 3 });
    expect(codes(a)).toContain('negativ_bank');
    expect(a.ready).toBe(false); // blokker
  });
});
