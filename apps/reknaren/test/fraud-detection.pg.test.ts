/**
 * Avviks- og svindeldeteksjon mot ekte Postgres. Hver detektor verifiseres med
 * et plantet funn i en isolert org, pluss kontrollene (dom → mønster-minne →
 * gjenkjenning, og flergodkjenning av vesentlige betalinger).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { detectFraudSignals } from '../src/ledger/fraud-detection.js';
import {
  approvePayment,
  getFraudSettings,
  listPaymentsAwaitingApproval,
  reviewFraudSignal,
  updateFraudSettings,
} from '../src/ledger/fraud-controls.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
let user2: string;
const rules = buildNorwegianRuleRegister();
const FROM = '2026-01-01';
const TO = '2026-12-31';
const actor = () => ({ userId, role: 'owner' });
const codes = (s: { code: string }[]) => s.map((x) => x.code);

async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}

interface DocOpts {
  vendorName?: string;
  vendorOrg?: string | null;
  invoiceNumber?: string | null;
  bankAccount?: string | null;
  grossMinor?: bigint | null;
  netMinor?: bigint | null;
  vatMinor?: bigint | null;
  invoiceDate?: string;
  docType?: string;
  status?: string;
  sha?: string;
  createdBy?: string;
}

async function makeDoc(orgId: string, o: DocOpts = {}): Promise<string> {
  const docId = newId();
  await db.query(
    `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
     VALUES ($1,$2,'upload','bilag.pdf','application/pdf',100,$3,$4,$5,$6)`,
    [docId, orgId, o.sha ?? newId(), `k/${docId}`, o.status ?? 'extracted', o.createdBy ?? userId],
  );
  await db.query(
    `INSERT INTO extracted_document_data
       (id, document_id, organization_id, document_type, vendor_name, vendor_org_number, invoice_number, invoice_date,
        bank_account, currency, net_minor, vat_minor, gross_minor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'NOK',$10,$11,$12)`,
    [
      newId(),
      docId,
      orgId,
      o.docType ?? 'supplier_invoice',
      o.vendorName ?? 'Leverandør AS',
      o.vendorOrg ?? null,
      o.invoiceNumber ?? null,
      o.invoiceDate ?? '2026-03-01',
      o.bankAccount ?? null,
      o.netMinor ?? null,
      o.vatMinor ?? null,
      o.grossMinor ?? null,
    ],
  );
  return docId;
}

async function makeVendor(orgId: string, name: string, createdAt?: string): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO vendors (id, organization_id, name, created_by, created_at) VALUES ($1,$2,$3,$4, COALESCE($5::timestamptz, now()))`,
    [id, orgId, name, userId, createdAt ?? null],
  );
  return id;
}

async function postExpense(
  orgId: string,
  amount: bigint,
  opts: { date?: string; vendorId?: string; account?: string; doc?: string; key?: string; postedBy?: string } = {},
) {
  const posted = await postJournalEntry(db, {
    organizationId: orgId,
    actor: { userId: opts.postedBy ?? userId, role: 'owner' },
    entryDate: opts.date ?? '2026-03-01',
    description: 'Kjøp',
    lines: [
      { accountNumber: opts.account ?? '6800', debitMinor: amount, ...(opts.vendorId ? { vendorId: opts.vendorId } : {}) },
      { accountNumber: '2400', creditMinor: amount, ...(opts.vendorId ? { vendorId: opts.vendorId } : {}) },
    ],
    idempotencyKey: opts.key ?? `k:${newId()}`,
    ...(opts.doc ? { sourceDocumentId: opts.doc } : {}),
  });
  return posted;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'svindel@example.com', 'Kontrollør');
  user2 = await ensureUser(db, 'svindel2@example.com', 'Annen Godkjenner');
});

afterAll(async () => {
  await db.end();
});

async function run(orgId: string) {
  return detectFraudSignals(db, rules, { organizationId: orgId, fromDate: FROM, toDate: TO });
}

describe('detectFraudSignals', () => {
  it('duplikat faktura: samme leverandør + fakturanummer på to bilag', async () => {
    const org = await newOrg('Dup AS');
    await makeDoc(org.id, { vendorOrg: '999888777', invoiceNumber: 'INV-42', grossMinor: 250000n });
    await makeDoc(org.id, { vendorOrg: '999888777', invoiceNumber: 'INV-42', grossMinor: 250000n });
    const r = await run(org.id);
    const hit = r.signals.find((s) => s.code === 'duplikat_faktura');
    expect(hit).toBeDefined();
    expect(hit!.evidence.length).toBe(2);
  });

  it('endret kontonummer: samme leverandør, nytt bankkontonummer → critical', async () => {
    const org = await newOrg('Konto AS');
    await makeDoc(org.id, { vendorOrg: '111', bankAccount: '1111.22.33333', invoiceDate: '2026-02-01' });
    await makeDoc(org.id, { vendorOrg: '111', bankAccount: '9999.88.77777', invoiceDate: '2026-03-01' });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'endret_kontonummer');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('critical');
    expect(hit!.detail).toContain('9999.88.77777');
  });

  it('avvikende beløp: faktura 3x median → medium', async () => {
    const org = await newOrg('Avvik AS');
    for (const g of [100000n, 110000n, 90000n]) await makeDoc(org.id, { vendorOrg: '222', grossMinor: g });
    await makeDoc(org.id, { vendorOrg: '222', grossMinor: 900000n, invoiceNumber: 'BIG' });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'avvikende_belop');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('9 000,00');
  });

  it('manipulert kvittering: netto + mva ≠ brutto → high', async () => {
    const org = await newOrg('Manip AS');
    await makeDoc(org.id, { netMinor: 80000n, vatMinor: 20000n, grossMinor: 150000n });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'manipulert_kvittering');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('high');
  });

  it('manipulert kvittering: identisk fil (sha256) på to bilag', async () => {
    const org = await newOrg('Sha AS');
    const sha = newId();
    await makeDoc(org.id, { sha, grossMinor: 100000n });
    await makeDoc(org.id, { sha, grossMinor: 100000n });
    const hits = (await run(org.id)).signals.filter((s) => s.code === 'manipulert_kvittering');
    expect(hits.some((h) => h.title.includes('samme fil'))).toBe(true);
  });

  it('mistenkelig refusjon: kreditnota → medium', async () => {
    const org = await newOrg('Refusjon AS');
    await makeDoc(org.id, { docType: 'credit_note', status: 'posted', grossMinor: 300000n });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'mistenkelig_refusjon');
    expect(hit).toBeDefined();
  });

  it('ny mottaker: fersk leverandør mottar vesentlig beløp', async () => {
    const org = await newOrg('Nymottaker AS');
    const vendor = await makeVendor(org.id, 'Splitter Ny AS', '2026-03-01');
    await postExpense(org.id, 6000000n, { vendorId: vendor, date: '2026-03-02' });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'ny_mottaker');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('Splitter Ny AS');
  });

  it('uvanlig reiseregning: 71xx uten bilag → medium', async () => {
    const org = await newOrg('Reise AS');
    await postExpense(org.id, 500000n, { account: '7140' }); // ingen sourceDocument
    const hit = (await run(org.id)).signals.find((s) => s.code === 'uvanlig_reiseregning');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('uten et vedlagt bilag');
  });

  it('oppdelt kjøp: to kjøp under grensen, sum over → high', async () => {
    const org = await newOrg('Oppdelt AS');
    const vendor = await makeVendor(org.id, 'Struktur AS');
    await postExpense(org.id, 3000000n, { vendorId: vendor, date: '2026-04-01', key: `s1:${org.id}` });
    await postExpense(org.id, 3000000n, { vendorId: vendor, date: '2026-04-03', key: `s2:${org.id}` });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'oppdelt_kjop');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('60 000,00');
  });

  it('egengodkjenning: samme person leverte og bokførte → high', async () => {
    const org = await newOrg('Egen AS');
    const doc = await makeDoc(org.id, { status: 'posted', createdBy: userId });
    await postExpense(org.id, 200000n, { doc, account: '6800', postedBy: userId });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'egengodkjenning');
    expect(hit).toBeDefined();
  });

  it('uvanlig tidspunkt: vesentlig betaling bokført om natten → low', async () => {
    const org = await newOrg('Natt AS');
    // Bokførte bilag er uforanderlige (ingen UPDATE) → seed nattposteringen rått.
    // Post en liten dagpostering først for å opprette regnskapsperioden.
    const seed = await postExpense(org.id, 100n, { account: '6800', date: '2026-03-01' });
    const period = (await db.query(`SELECT period_id FROM journal_entries WHERE id = $1`, [seed.id])).rows[0].period_id;
    const nextNo = Number(
      (await db.query(`SELECT COALESCE(MAX(entry_number),0)+1 AS n FROM journal_entries WHERE organization_id = $1`, [org.id])).rows[0].n,
    );
    const entryId = newId();
    await db.query(
      `INSERT INTO journal_entries
         (id, organization_id, entry_number, entry_date, period_id, description, idempotency_key, status, posted_by, posted_by_role, posted_at)
       VALUES ($1,$2,$3,'2026-03-01',$4,'Nattkjøp',$5,'posted',$6,'owner','2026-03-01 03:30:00+01')`,
      [entryId, org.id, nextNo, period, `night:${entryId}`, userId],
    );
    await db.query(
      `INSERT INTO journal_lines (id, entry_id, organization_id, line_number, account_number, debit_minor, credit_minor)
       VALUES ($1,$2,$3,1,'6800',6000000,0), ($4,$2,$3,2,'2400',0,6000000)`,
      [newId(), entryId, org.id, newId()],
    );
    const hit = (await run(org.id)).signals.find((s) => s.code === 'uvanlig_tidspunkt');
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain('03:30');
  });

  it('krever flergodkjenning: vesentlig betaling uten godkjenning', async () => {
    const org = await newOrg('Flergod AS');
    await postExpense(org.id, 8000000n, { account: '6800' });
    const hit = (await run(org.id)).signals.find((s) => s.code === 'krever_flergodkjenning');
    expect(hit).toBeDefined();
  });

  it('rent doks-regnskap uten avvik → ingen dokumentbaserte varsler', async () => {
    const org = await newOrg('Ren dok AS');
    await makeDoc(org.id, { vendorOrg: '555', invoiceNumber: 'A1', netMinor: 80000n, vatMinor: 20000n, grossMinor: 100000n });
    const r = await run(org.id);
    expect(codes(r.signals)).not.toContain('duplikat_faktura');
    expect(codes(r.signals)).not.toContain('manipulert_kvittering');
    expect(codes(r.signals)).not.toContain('endret_kontonummer');
  });
});

describe('fraud-controls', () => {
  it('falsk alarm demper varselet (flyttes til dismissed)', async () => {
    const org = await newOrg('Demp AS');
    await makeDoc(org.id, { docType: 'credit_note', status: 'posted', grossMinor: 300000n });
    const before = await run(org.id);
    const sig = before.signals.find((s) => s.code === 'mistenkelig_refusjon')!;
    await reviewFraudSignal(db, {
      organizationId: org.id,
      actor: actor(),
      signalCode: sig.code,
      fingerprint: sig.fingerprint,
      verdict: 'false_alarm',
      note: 'Legitim refusjon',
    });
    const after = await run(org.id);
    const same = after.signals.find((s) => s.fingerprint === sig.fingerprint)!;
    expect(same.reviewed?.verdict).toBe('false_alarm');
    expect(after.dismissedCount).toBeGreaterThanOrEqual(1);
  });

  it('bekreftet svindel lærer mønster → nytt bilag matcher tidligere svindelforsøk', async () => {
    const org = await newOrg('Lær AS');
    const badDoc = await makeDoc(org.id, { vendorOrg: '111', bankAccount: '1000.11.11111', invoiceDate: '2026-02-01' });
    await makeDoc(org.id, { vendorOrg: '111', bankAccount: '6666.55.44444', invoiceDate: '2026-03-01' });
    const r1 = await run(org.id);
    const konto = r1.signals.find((s) => s.code === 'endret_kontonummer')!;
    // Bruker bekrefter svindel og lagrer det onde kontonummeret som mønster.
    const res = await reviewFraudSignal(db, {
      organizationId: org.id,
      actor: actor(),
      signalCode: konto.code,
      fingerprint: konto.fingerprint,
      verdict: 'confirmed_fraud',
      patterns: [{ type: 'bank_account', value: '6666.55.44444', sourceDocumentId: badDoc }],
    });
    expect(res.patternsAdded).toBe(1);
    // Et nytt bilag med samme onde kontonummer flagges nå som «ligner svindelforsøk».
    await makeDoc(org.id, { vendorName: 'Ny Fasade AS', bankAccount: '6666.55.44444', invoiceDate: '2026-04-01' });
    const r2 = await run(org.id);
    expect(codes(r2.signals)).toContain('ligner_svindelforsok');
  });

  it('flergodkjenning: en annen kan godkjenne, men ikke den som bokførte', async () => {
    const org = await newOrg('Godkjenn AS');
    // user2 må være medlem for at rollen skal gi mening (ikke påkrevd av approvePayment).
    const p = await postExpense(org.id, 8000000n, { account: '6800', postedBy: userId });
    // Den som bokførte kan IKKE godkjenne selv.
    await expect(
      approvePayment(db, { organizationId: org.id, actor: actor(), journalEntryId: p.id }),
    ).rejects.toThrow();
    // En annen kan.
    const status = await approvePayment(db, {
      organizationId: org.id,
      actor: { userId: user2, role: 'approver' },
      journalEntryId: p.id,
    });
    expect(status.approvals.length).toBe(1);
    // Dobbelt-godkjenning fra samme person avvises.
    await expect(
      approvePayment(db, { organizationId: org.id, actor: { userId: user2, role: 'approver' }, journalEntryId: p.id }),
    ).rejects.toThrow();
  });

  it('awaiting-approval listen krymper etter godkjenning når kravet er 1', async () => {
    const org = await newOrg('Venteliste AS');
    await updateFraudSettings(db, { organizationId: org.id, actor: actor(), requiredApprovers: 1 });
    const p = await postExpense(org.id, 9000000n, { account: '6800', postedBy: userId });
    const before = await listPaymentsAwaitingApproval(db, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(before.items.some((i) => i.journalEntryId === p.id)).toBe(true);
    await approvePayment(db, { organizationId: org.id, actor: { userId: user2, role: 'approver' }, journalEntryId: p.id });
    const after = await listPaymentsAwaitingApproval(db, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(after.items.some((i) => i.journalEntryId === p.id)).toBe(false);
  });

  it('innstillinger: standard er default, oppdatering persisterer', async () => {
    const org = await newOrg('Innstilling AS');
    const def = await getFraudSettings(db, org.id);
    expect(def.isDefault).toBe(true);
    expect(def.significantThresholdMinor).toBe('5000000');
    await updateFraudSettings(db, {
      organizationId: org.id,
      actor: actor(),
      significantThresholdMinor: 10000000n,
      requiredApprovers: 3,
    });
    const now = await getFraudSettings(db, org.id);
    expect(now.isDefault).toBe(false);
    expect(now.significantThresholdMinor).toBe('10000000');
    expect(now.requiredApprovers).toBe(3);
  });
});
