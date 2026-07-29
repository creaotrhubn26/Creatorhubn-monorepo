/**
 * Skattemessige justeringer: broen fra regnskapsmessig til skattemessig resultat.
 * Kostnader uten skattefradrag legges tilbake; fradragsberettigede rører vi ikke.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { computeTaxAdjustments } from '../src/tax/adjustments.js';
import { buildTaxEstimate } from '../src/tax/estimate.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

async function acct(orgId: string, number: string, name: string, type: string) {
  await db.query(
    `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id, account_number) DO UPDATE SET name=EXCLUDED.name`,
    [newId(), orgId, number, name, type],
  );
}
async function post(orgId: string, date: string, lines: { acc: string; d?: bigint; c?: bigint }[]) {
  await postJournalEntry(db, {
    organizationId: orgId, actor: actor(), entryDate: date, description: 'test',
    idempotencyKey: `adj:${date}:${Math.abs(lines.reduce((a, l) => a + Number(l.d ?? l.c ?? 0n), 0))}:${lines[0]!.acc}`,
    lines: lines.map((l) => ({ accountNumber: l.acc, ...(l.d ? { debitMinor: l.d } : {}), ...(l.c ? { creditMinor: l.c } : {}) })),
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'adj@example.com', 'Adj');
});
afterAll(async () => { await db.end(); });

describe('skattemessige justeringer', () => {
  it('legger tilbake kostnader uten skattefradrag (etter kode og navn), ikke fradragsberettigede', async () => {
    const org = await createOrganization(db, { name: 'Justering AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    await acct(org.id, '3000', 'Salgsinntekt', 'revenue');
    await acct(org.id, '6800', 'Kontorrekvisita', 'expense'); // fradragsberettiget
    await acct(org.id, '7799', 'Annen kostnad uten skattefradrag', 'expense'); // kjent kode + navn
    await acct(org.id, '7360', 'Representasjon, ikke fradragsberettiget', 'expense'); // kjent kode
    await acct(org.id, '2400', 'Leverandørgjeld', 'liability');
    // Salg 1000, fradragsberettiget kostnad 400, ikke-fradrag 200 (7799) + 150 (7360)
    await post(org.id, '2026-02-01', [{ acc: '2400', d: 100000n }, { acc: '3000', c: 100000n }]);
    await post(org.id, '2026-02-02', [{ acc: '6800', d: 40000n }, { acc: '2400', c: 40000n }]);
    await post(org.id, '2026-02-03', [{ acc: '7799', d: 20000n }, { acc: '2400', c: 20000n }]);
    await post(org.id, '2026-02-04', [{ acc: '7360', d: 15000n }, { acc: '2400', c: 15000n }]);

    const adj = await computeTaxAdjustments(db, { organizationId: org.id, fromDate: '2026-01-01', toDate: '2026-12-31' });
    const codes = adj.lines.map((l) => l.accountNumber).sort();
    expect(codes).toEqual(['7360', '7799']); // 6800 skal IKKE med
    expect(adj.totalMinor).toBe(35000n); // 200 + 150 kr

    // Regnskapsresultat = 1000 - 400 - 200 - 150 = 250 kr; skattbar = 250 + 350 tilbakeført = 600 kr
    const est = await buildTaxEstimate(db, rules, { organizationId: org.id, orgForm: 'AS', fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(est.accountingResultMinor).toBe(25000n);
    expect(est.taxAdjustmentsMinor).toBe(35000n);
    expect(est.estimatedTaxableResultMinor).toBe(60000n);
    expect(est.taxAdjustments).toHaveLength(2);
    // Skatten beregnes av det HØYERE skattemessige resultatet, ikke regnskapsresultatet.
    expect(est.estimatedTaxMinor).toBeGreaterThan(0n);
  });

  it('ingen justeringer når alt er fradragsberettiget', async () => {
    const org = await createOrganization(db, { name: 'Ren AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    await acct(org.id, '3000', 'Salgsinntekt', 'revenue');
    await acct(org.id, '6800', 'Kontorrekvisita', 'expense');
    await acct(org.id, '2400', 'Leverandørgjeld', 'liability');
    await post(org.id, '2026-03-01', [{ acc: '2400', d: 50000n }, { acc: '3000', c: 50000n }]);
    await post(org.id, '2026-03-02', [{ acc: '6800', d: 10000n }, { acc: '2400', c: 10000n }]);
    const adj = await computeTaxAdjustments(db, { organizationId: org.id, fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(adj.lines).toHaveLength(0);
    expect(adj.totalMinor).toBe(0n);
  });
});
