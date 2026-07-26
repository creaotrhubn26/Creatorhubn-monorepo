/**
 * Abonnements-/forventningsvakt mot ekte Postgres: lærer faste kostnader fra
 * historikk (kadens + beløp + kildekanal), oppdager uteblitte forekomster,
 * flagger beløpsavvik, og respekterer menneskets håndtering (håndtert/utsett/
 * avvist). 🔒 Bokfører aldri.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { assessRecurringDue, detectRecurringExpectations, resolveRecurring } from '../src/ledger/recurring.js';
import type { RecurringDueItem } from '../src/ledger/recurring.js';
import { approveLearnedRule, listLearnedRules } from '../src/ledger/learning.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}
async function makeVendor(orgId: string, name: string, orgNr: string) {
  const id = newId();
  await db.query(`INSERT INTO vendors (id, organization_id, name, org_number, created_by) VALUES ($1,$2,$3,$4,$5)`, [id, orgId, name, orgNr, userId]);
  return id;
}
async function postCost(orgId: string, vendorId: string, date: string, amount: bigint, opts: { account?: string; doc?: string } = {}) {
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: date,
    description: 'Fast kostnad',
    idempotencyKey: `rec:${vendorId}:${date}:${amount}`,
    ...(opts.doc ? { sourceDocumentId: opts.doc } : {}),
    lines: [
      { accountNumber: opts.account ?? '6907', debitMinor: amount, vendorId },
      { accountNumber: '2400', creditMinor: amount, vendorId },
    ],
  });
}
async function recExpectation(orgId: string) {
  const rules = await listLearnedRules(db, { organizationId: orgId });
  return rules.rules.find((r) => r.ruleType === 'recurring_expectation');
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'recurring@example.com', 'Vakt');
});
afterAll(async () => {
  await db.end();
});

describe('forventningsvakt', () => {
  it('lærer en fast månedlig kostnad fra historikk, kanal=manuell uten bilag', async () => {
    const org = await newOrg('Fast AS');
    const v = await makeVendor(org.id, 'Telia', '111222333');
    for (const m of ['01', '02', '03', '04', '05', '06']) await postCost(org.id, v, `2025-${m}-05`, 70000n); // 700/mnd, ingen bilag
    const det = await detectRecurringExpectations(db, { organizationId: org.id });
    expect(det.proposed).toBe(1);
    const e = await recExpectation(org.id)!;
    expect(e).toBeDefined();
    expect(e!.subjectLabel).toBe('Telia');
    expect(e!.status).toBe('suggested');
    const t = e!.target as { cadence: string; channel: string; expectedAmountMinor: string };
    expect(t.cadence).toBe('monthly');
    expect(t.channel).toBe('manual'); // ingen bilag → må hentes fra Min side
    expect(t.expectedAmountMinor).toBe('70000');
  });

  it('oppdager uteblitte perioder etter at mønsteret stopper (Telia-scenariet)', async () => {
    const org = await newOrg('Uteblitt AS');
    const v = await makeVendor(org.id, 'Telia', '111');
    for (const m of ['01', '02', '03', '04', '05', '06']) await postCost(org.id, v, `2025-${m}-05`, 70000n);
    await detectRecurringExpectations(db, { organizationId: org.id });
    const e = (await recExpectation(org.id))!;
    await approveLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: e.id });
    // Ingenting bokført etter juni → juli/aug/sep skal være forfalt.
    const due = await assessRecurringDue(db, { organizationId: org.id, asOf: '2025-09-15' });
    const item = due.items.find((i) => i.vendor === 'Telia')!;
    expect(item).toBeDefined();
    const overduePeriods = item.overdue.map((o) => o.period);
    expect(overduePeriods).toContain('2025-07');
    expect(overduePeriods).toContain('2025-08');
    expect(overduePeriods).toContain('2025-09');
    expect(due.overdueCount).toBeGreaterThanOrEqual(3);
    expect(BigInt(due.overdueAmountMinor)).toBeGreaterThanOrEqual(210000n); // 3 × 700
  });

  it('bokført periode teller ikke som forfalt; menneskets håndtering demper', async () => {
    const org = await newOrg('Håndter AS');
    const v = await makeVendor(org.id, 'Telia', '111');
    for (const m of ['01', '02', '03', '04', '05', '06']) await postCost(org.id, v, `2025-${m}-05`, 70000n);
    await detectRecurringExpectations(db, { organizationId: org.id });
    const e = (await recExpectation(org.id))!;
    await approveLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: e.id });
    // Bokfør juli → juli faller ut av forfalt.
    await postCost(org.id, v, '2025-07-05', 70000n);
    let due = await assessRecurringDue(db, { organizationId: org.id, asOf: '2025-09-15' });
    let item: RecurringDueItem | undefined = due.items.find((i) => i.vendor === 'Telia')!;
    expect(item.overdue.map((o) => o.period)).not.toContain('2025-07');
    expect(item.overdue.map((o) => o.period)).toContain('2025-08');
    // Marker august som håndtert → faller ut.
    await resolveRecurring(db, { organizationId: org.id, actor: actor(), ruleId: e.id, period: '2025-08', status: 'handled' });
    due = await assessRecurringDue(db, { organizationId: org.id, asOf: '2025-09-15' });
    item = due.items.find((i) => i.vendor === 'Telia')!;
    expect(item.overdue.map((o) => o.period)).not.toContain('2025-08');
    // Utsett september til oktober → faller ut nå.
    await resolveRecurring(db, { organizationId: org.id, actor: actor(), ruleId: e.id, period: '2025-09', status: 'snoozed', snoozeUntil: '2025-10-01' });
    due = await assessRecurringDue(db, { organizationId: org.id, asOf: '2025-09-15' });
    item = due.items.find((i) => i.vendor === 'Telia');
    expect(item?.overdue.map((o) => o.period) ?? []).not.toContain('2025-09');
  });

  it('beløpsavvik på bokført forekomst flagges', async () => {
    const org = await newOrg('Avvik AS');
    const v = await makeVendor(org.id, 'Telia', '111');
    for (const m of ['01', '02', '03', '04', '05', '06']) await postCost(org.id, v, `2025-${m}-05`, 70000n);
    await detectRecurringExpectations(db, { organizationId: org.id });
    const e = (await recExpectation(org.id))!;
    await approveLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: e.id });
    // Bokfør juli med sterkt avvikende beløp (5000 vs forventet 700).
    await postCost(org.id, v, '2025-07-05', 500000n);
    const due = await assessRecurringDue(db, { organizationId: org.id, asOf: '2025-08-15' });
    const item = due.items.find((i) => i.vendor === 'Telia')!;
    expect(item.anomalies.some((a) => a.period === '2025-07')).toBe(true);
  });

  it('kanal=auto når bilag følger med', async () => {
    const org = await newOrg('Auto AS');
    const v = await makeVendor(org.id, 'Adobe', '999888');
    for (const m of ['01', '02', '03', '04']) {
      const doc = newId();
      await db.query(
        `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
         VALUES ($1,$2,'gmail','a.pdf','application/pdf',100,$3,$4,'posted',$5)`,
        [doc, org.id, newId(), `k/${doc}`, userId],
      );
      await postCost(org.id, v, `2025-${m}-10`, 30000n, { account: '6800', doc });
    }
    await detectRecurringExpectations(db, { organizationId: org.id });
    const e = (await recExpectation(org.id))!;
    expect((e.target as { channel: string }).channel).toBe('auto');
  });
});
