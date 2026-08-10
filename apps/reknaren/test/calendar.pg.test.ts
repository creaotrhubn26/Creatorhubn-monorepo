/**
 * Betalingskalender + inline-nudge: betalt (bakover) + forventet (framover) på
 * én tidslinje, og «dette virker gjentakende — legg til faste utgifter?». 🔒 Leser.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { buildPaymentCalendar } from '../src/ledger/calendar.js';
import { createRecurringFromVendor, recurringHintForVendor } from '../src/ledger/recurring.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import type { RuleRegister } from '../src/rules/register.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
let rules: RuleRegister;
const actor = () => ({ userId, role: 'owner' });

async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}
async function makeVendor(orgId: string, name: string, orgNr: string) {
  const id = newId();
  await db.query(`INSERT INTO vendors (id, organization_id, name, org_number, created_by) VALUES ($1,$2,$3,$4,$5)`, [id, orgId, name, orgNr, userId]);
  return id;
}
async function postCost(orgId: string, vendorId: string, date: string, amount: bigint) {
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: date,
    description: 'Kostnad',
    idempotencyKey: `cal:${vendorId}:${date}:${amount}`,
    lines: [
      { accountNumber: '6800', debitMinor: amount, vendorId },
      { accountNumber: '2400', creditMinor: amount, vendorId },
    ],
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'kalender@example.com', 'Kal');
  rules = buildNorwegianRuleRegister();
});
afterAll(async () => {
  await db.end();
});

describe('betalingskalender', () => {
  it('viser betalte kostnader bakover og forventede faste utgifter framover', async () => {
    const org = await newOrg('Kalender AS');
    const v = await makeVendor(org.id, 'Telia', '111222333');
    for (const m of ['01', '02', '03', '04', '05', '06']) await postCost(org.id, v, `2025-${m}-05`, 70000n);
    // Bekreft som fast utgift → aktiv forventning framover.
    await createRecurringFromVendor(db, { organizationId: org.id, actor: actor(), vendorId: v });
    const cal = await buildPaymentCalendar(db, rules, {
      organizationId: org.id, orgForm: 'AS', from: '2025-01-01', to: '2025-09-30', asOf: '2025-07-15',
    });
    const paid = cal.events.filter((e) => e.kind === 'paid');
    expect(paid.length).toBeGreaterThanOrEqual(6);
    expect(paid.every((e) => e.status === 'paid' && e.direction === 'out')).toBe(true);
    // Framover: forfalte/kommende faste Telia-utgifter etter juni.
    const rec = cal.events.filter((e) => e.kind === 'recurring');
    expect(rec.length).toBeGreaterThanOrEqual(1);
    // Sortert stigende på dato.
    const dates = cal.events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('nudge: leverandør med to månedlige forekomster ser gjentakende ut, og blir sporet etter bekreftelse', async () => {
    const org = await newOrg('Nudge AS');
    const v = (await makeVendor(org.id, 'Adobe', '999888777')) as string;
    await postCost(org.id, v, '2025-01-10', 30000n);
    await postCost(org.id, v, '2025-02-10', 30000n);
    const hint = await recurringHintForVendor(db, { organizationId: org.id, vendorId: v });
    expect(hint.looksRecurring).toBe(true);
    expect(hint.cadence).toBe('monthly');
    expect(hint.alreadyTracked).toBe(false);
    // Bekreft → aktiv forventning; hint melder deretter alreadyTracked.
    const created = await createRecurringFromVendor(db, { organizationId: org.id, actor: actor(), vendorId: v });
    expect(created.ruleId).toBeTruthy();
    const after = await recurringHintForVendor(db, { organizationId: org.id, vendorId: v });
    expect(after.alreadyTracked).toBe(true);
  });

  it('nudge: ukjent/enkelt leverandør ser ikke gjentakende ut', async () => {
    const org = await newOrg('Enkelt AS');
    const v = (await makeVendor(org.id, 'Engangs', '555')) as string;
    await postCost(org.id, v, '2025-03-01', 12345n);
    const hint = await recurringHintForVendor(db, { organizationId: org.id, vendorId: v });
    expect(hint.looksRecurring).toBe(false);
  });
});
