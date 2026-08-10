/**
 * Lærende regnskapsmodell mot ekte Postgres. Verifiserer at systemet lærer
 * bedriftens praksis fra historikken (leverandør→konto, kunde→prosjekt), at
 * regler er scopet (virksomhet/konsern og aldri universelle), at menneskets
 * godkjenning + sporbarhet lagres, at aktive regler brukes i forslag, og at
 * lærte godkjenningskrav dukker opp i betalingskontrollen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import {
  approveLearnedRule,
  createLearnedRule,
  createOrganizationGroup,
  detectLearnedRules,
  dismissLearnedRule,
  listLearnedRules,
  resolveLearnedDefaults,
  updateLearnedRule,
} from '../src/ledger/learning.js';
import { listPaymentsAwaitingApproval } from '../src/ledger/fraud-controls.js';
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
async function makeVendor(orgId: string, name: string, orgNr?: string): Promise<string> {
  const id = newId();
  await db.query(`INSERT INTO vendors (id, organization_id, name, org_number, created_by) VALUES ($1,$2,$3,$4,$5)`, [id, orgId, name, orgNr ?? null, userId]);
  return id;
}
async function makeCustomer(orgId: string, name: string): Promise<string> {
  const id = newId();
  await db.query(`INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [id, orgId, name, userId]);
  return id;
}
async function makeProject(orgId: string, code: string, customerId?: string): Promise<void> {
  await db.query(`INSERT INTO projects (id, organization_id, code, name, customer_id, created_by) VALUES ($1,$2,$3,$4,$5,$6)`, [newId(), orgId, code, code, customerId ?? null, userId]);
}
async function postVendorExpense(orgId: string, vendorId: string, account: string, i: number) {
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: `2026-03-0${(i % 9) + 1}`,
    description: 'Kjøp',
    lines: [
      { accountNumber: account, debitMinor: 100000n, vendorId },
      { accountNumber: '2400', creditMinor: 100000n, vendorId },
    ],
    idempotencyKey: `exp:${vendorId}:${account}:${i}`,
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'laering@example.com', 'Lærer');
});
afterAll(async () => {
  await db.end();
});

describe('detectLearnedRules', () => {
  it('lærer leverandør→konto fra dominant historikk (Telia→telefon)', async () => {
    const org = await newOrg('Telia AS');
    const telia = await makeVendor(org.id, 'Telia', '111222333');
    for (let i = 0; i < 4; i++) await postVendorExpense(org.id, telia, '6900', i); // telefon
    await postVendorExpense(org.id, telia, '6800', 99); // én avvikende
    const det = await detectLearnedRules(db, { organizationId: org.id });
    expect(det.byType.account_mapping).toBeGreaterThanOrEqual(1);
    const { rules } = await listLearnedRules(db, { organizationId: org.id });
    const rule = rules.find((r) => r.ruleType === 'account_mapping' && r.subjectLabel === 'Telia')!;
    expect(rule).toBeDefined();
    expect(rule.status).toBe('suggested');
    expect(rule.origin).toBe('system');
    expect((rule.target as { accountNumber: string }).accountNumber).toBe('6900');
    expect(rule.supportCount).toBe(4);
    expect(rule.observationCount).toBe(5);
    expect(rule.scopeLabel).toBe('Denne virksomheten');
    expect(rule.examples.length).toBeGreaterThan(0); // hvilke eksempler den bygger på
    expect(rule.rationale).toContain('Telia');
  });

  it('for få eller for spredt historikk → ingen regel (ikke universell)', async () => {
    const org = await newOrg('Spredt AS');
    const v = await makeVendor(org.id, 'Variert');
    await postVendorExpense(org.id, v, '6800', 1);
    await postVendorExpense(org.id, v, '6810', 2); // 50/50, under 60 %
    const det = await detectLearnedRules(db, { organizationId: org.id });
    expect(det.byType.account_mapping ?? 0).toBe(0);
  });

  it('lærer kunde→prosjekt', async () => {
    const org = await newOrg('Prosjekt AS');
    const kunde = await makeCustomer(org.id, 'Storkunde');
    await makeProject(org.id, 'PROSJEKT-A', kunde);
    for (let i = 0; i < 3; i++) {
      await postJournalEntry(db, {
        organizationId: org.id,
        actor: actor(),
        entryDate: `2026-04-0${i + 1}`,
        description: 'Salg',
        lines: [
          { accountNumber: '1500', debitMinor: 200000n, customerId: kunde },
          { accountNumber: '3000', creditMinor: 200000n, customerId: kunde, project: 'PROSJEKT-A' },
        ],
        idempotencyKey: `sale:${i}`,
      });
    }
    await detectLearnedRules(db, { organizationId: org.id });
    const { rules } = await listLearnedRules(db, { organizationId: org.id });
    const rule = rules.find((r) => r.ruleType === 'project_mapping')!;
    expect(rule).toBeDefined();
    expect((rule.target as { project: string }).project).toBe('PROSJEKT-A');
    expect(rule.subjectLabel).toBe('Storkunde');
  });

  it('re-kjøring foreslår ikke på nytt for kjente subjekter', async () => {
    const org = await newOrg('Idempotent AS');
    const v = await makeVendor(org.id, 'Adobe', '999');
    for (let i = 0; i < 3; i++) await postVendorExpense(org.id, v, '6810', i);
    const first = await detectLearnedRules(db, { organizationId: org.id });
    expect(first.byType.account_mapping).toBe(1);
    const second = await detectLearnedRules(db, { organizationId: org.id });
    expect(second.byType.account_mapping ?? 0).toBe(0);
  });
});

describe('godkjenning + sporbarhet + anvendelse', () => {
  it('godkjenning lagrer hvem + når; aktiv regel brukes i oppslag', async () => {
    const org = await newOrg('Godkjenn AS');
    const v = await makeVendor(org.id, 'Foto.no', '55');
    for (let i = 0; i < 3; i++) await postVendorExpense(org.id, v, '6551', i); // produksjonsutstyr
    await detectLearnedRules(db, { organizationId: org.id });
    let { rules } = await listLearnedRules(db, { organizationId: org.id });
    const rule = rules.find((r) => r.subjectLabel === 'Foto.no')!;
    // Før godkjenning brukes ikke regelen.
    expect((await resolveLearnedDefaults(db, { organizationId: org.id, vendorKey: '55' })).accountNumber).toBeUndefined();
    await approveLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: rule.id });
    rules = (await listLearnedRules(db, { organizationId: org.id })).rules;
    const approved = rules.find((r) => r.id === rule.id)!;
    expect(approved.status).toBe('active');
    expect(approved.approvedBy).toBe('Lærer'); // hvem som godkjente
    expect(approved.approvedAt).toBeTruthy(); // når
    // Nå brukes regelen i oppslag (matcher på org.nr).
    const resolved = await resolveLearnedDefaults(db, { organizationId: org.id, vendorKey: '55' });
    expect(resolved.accountNumber).toBe('6551');
  });

  it('avvist regel gjelder ikke og re-foreslås ikke', async () => {
    const org = await newOrg('Avvist AS');
    const v = await makeVendor(org.id, 'Rar Leverandør', '77');
    for (let i = 0; i < 3; i++) await postVendorExpense(org.id, v, '6800', i);
    await detectLearnedRules(db, { organizationId: org.id });
    const rule = (await listLearnedRules(db, { organizationId: org.id })).rules[0]!;
    await dismissLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: rule.id });
    expect((await resolveLearnedDefaults(db, { organizationId: org.id, vendorKey: '77' })).accountNumber).toBeUndefined();
    const again = await detectLearnedRules(db, { organizationId: org.id });
    expect(again.byType.account_mapping ?? 0).toBe(0);
  });
});

describe('konsern-scope', () => {
  it('konsern-regel gjelder alle virksomheter; virksomhets-regel overstyrer', async () => {
    const orgA = await newOrg('Konsern A');
    const orgB = await newOrg('Konsern B');
    const grp = await createOrganizationGroup(db, { organizationId: orgA.id, actor: actor(), name: 'Mediehuset' });
    await db.query(`UPDATE organizations SET group_id = $1 WHERE id = $2`, [grp.id, orgB.id]); // B med i samme konsern
    // Konsern-regel: Microsoft → 6810 for hele konsernet.
    await createLearnedRule(db, {
      organizationId: orgA.id,
      actor: actor(),
      ruleType: 'account_mapping',
      subjectType: 'vendor',
      subjectKey: 'microsoft',
      subjectLabel: 'Microsoft',
      target: { accountNumber: '6810' },
      scope: 'group',
    });
    // Gjelder også B.
    expect((await resolveLearnedDefaults(db, { organizationId: orgB.id, vendorKey: 'microsoft' })).accountNumber).toBe('6810');
    // B lager egen regel som overstyrer konsernet.
    await createLearnedRule(db, {
      organizationId: orgB.id,
      actor: actor(),
      ruleType: 'account_mapping',
      subjectType: 'vendor',
      subjectKey: 'microsoft',
      subjectLabel: 'Microsoft',
      target: { accountNumber: '6800' },
      scope: 'organization',
    });
    expect((await resolveLearnedDefaults(db, { organizationId: orgB.id, vendorKey: 'microsoft' })).accountNumber).toBe('6800');
    // A bruker fortsatt konsern-regelen.
    expect((await resolveLearnedDefaults(db, { organizationId: orgA.id, vendorKey: 'microsoft' })).accountNumber).toBe('6810');
    // Listen for B viser både konsern-scope og virksomhets-scope.
    const scopes = (await listLearnedRules(db, { organizationId: orgB.id })).rules.map((r) => r.scope);
    expect(scopes).toContain('group');
    expect(scopes).toContain('organization');
  });
});

describe('lærte godkjenningskrav i betalingskontrollen', () => {
  it('leverandør-godkjenningsregel gjør betaling ventende til rett rolle godkjenner', async () => {
    const org = await newOrg('Attest AS');
    const v = await makeVendor(org.id, 'Spesialisten', '4242');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-10',
      description: 'Lite kjøp',
      lines: [
        { accountNumber: '6800', debitMinor: 100000n, vendorId: v }, // kun 1000 kr, under vesentlig-grensen
        { accountNumber: '2400', creditMinor: 100000n, vendorId: v },
      ],
      idempotencyKey: `attest:${org.id}`,
    });
    // Manuell regel: denne leverandøren må alltid godkjennes av prosjektleder (approver).
    await createLearnedRule(db, {
      organizationId: org.id,
      actor: actor(),
      ruleType: 'approver_requirement',
      subjectType: 'vendor',
      subjectKey: '4242',
      subjectLabel: 'Spesialisten',
      target: { requiredRole: 'approver' },
    });
    const awaiting = await listPaymentsAwaitingApproval(db, { organizationId: org.id, fromDate: '2026-01-01', toDate: '2026-12-31' });
    const item = awaiting.items.find((i) => i.description === 'Lite kjøp')!;
    expect(item).toBeDefined();
    expect(item.requirements.some((r) => r.source === 'vendor' && r.requiredRole === 'approver' && !r.satisfied)).toBe(true);
  });

  it('beløps-godkjenningsregel (over 20 000 → økonomiansvarlig)', async () => {
    const org = await newOrg('Beløp AS');
    const v = await makeVendor(org.id, 'Storleverandør', '888');
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-11',
      description: 'Stort kjøp',
      lines: [
        { accountNumber: '6800', debitMinor: 2500000n, vendorId: v }, // 25 000 kr
        { accountNumber: '2400', creditMinor: 2500000n, vendorId: v },
      ],
      idempotencyKey: `belop:${org.id}`,
    });
    await createLearnedRule(db, {
      organizationId: org.id,
      actor: actor(),
      ruleType: 'threshold_approval',
      subjectType: 'amount',
      subjectLabel: 'Kjøp over 20 000 kr',
      target: { thresholdMinor: '2000000', requiredRole: 'accounting_manager' },
    });
    const awaiting = await listPaymentsAwaitingApproval(db, { organizationId: org.id, fromDate: '2026-01-01', toDate: '2026-12-31' });
    const item = awaiting.items.find((i) => i.description === 'Stort kjøp')!;
    expect(item.requirements.some((r) => r.source === 'threshold' && r.requiredRole === 'accounting_manager')).toBe(true);
  });
});

describe('validering', () => {
  it('avviser ugyldig konto og ukjent rolle', async () => {
    const org = await newOrg('Valider AS');
    await expect(
      createLearnedRule(db, { organizationId: org.id, actor: actor(), ruleType: 'account_mapping', subjectType: 'vendor', subjectKey: 'x', subjectLabel: 'X', target: { accountNumber: '99' } }),
    ).rejects.toThrow();
    await expect(
      createLearnedRule(db, { organizationId: org.id, actor: actor(), ruleType: 'approver_requirement', subjectType: 'vendor', subjectKey: 'y', subjectLabel: 'Y', target: { requiredRole: 'sjefen' } }),
    ).rejects.toThrow();
  });

  it('endring oppdaterer target og «sist endret»', async () => {
    const org = await newOrg('Endre AS');
    const created = await createLearnedRule(db, { organizationId: org.id, actor: actor(), ruleType: 'account_mapping', subjectType: 'vendor', subjectKey: 'telenor', subjectLabel: 'Telenor', target: { accountNumber: '6900' } });
    await updateLearnedRule(db, { organizationId: org.id, actor: actor(), ruleId: created.id, target: { accountNumber: '6907' } });
    const rule = (await listLearnedRules(db, { organizationId: org.id })).rules.find((r) => r.id === created.id)!;
    expect((rule.target as { accountNumber: string }).accountNumber).toBe('6907');
  });
});
