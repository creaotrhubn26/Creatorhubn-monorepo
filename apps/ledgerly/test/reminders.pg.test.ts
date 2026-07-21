/**
 * Betalingspåminnelser mot ekte Postgres: forfalte utstedte fakturaer → purring
 * via e-postporten, med logg og «ikke mas»-intervall.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { InMemoryEmailStub } from '../src/integrations/email.js';
import { findOverdueInvoices, sendInvoiceReminders } from '../src/invoicing/reminders.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;

async function customer(name: string, email: string | null): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, email, created_by) VALUES ($1,$2,$3,$4,$5)`,
    [id, orgId, name, email, userId],
  );
  return id;
}

async function issuedInvoice(
  customerId: string,
  opts: { number: number; dueDate: string; grossMinor: number; paidMinor?: number },
): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO invoices
       (id, organization_id, customer_id, invoice_number, kind, invoice_date, due_date,
        currency, net_minor, vat_minor, gross_minor, paid_minor, status, created_by)
     VALUES ($1,$2,$3,$4,'invoice','2026-01-01',$5,'NOK',$6,0,$6,$7,'issued',$8)`,
    [id, orgId, customerId, opts.number, opts.dueDate, opts.grossMinor, opts.paidMinor ?? 0, userId],
  );
  return id;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'purring@example.com', 'Purretester');
  const org = await createOrganization(db, {
    name: 'Creatorhub AS',
    orgForm: 'AS',
    vatStatus: 'not_registered',
    orgNumber: '937518684',
    createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

const opts = (over: Partial<{ asOfDate: string; minDaysBetween: number }> = {}) => ({
  organizationId: orgId,
  asOfDate: over.asOfDate ?? '2026-03-01',
  ...(over.minDaysBetween ? { minDaysBetween: over.minDaysBetween } : {}),
});

describe('Betalingspåminnelser', () => {
  it('finner kun forfalte, utstedte, ikke fullt betalte fakturaer', async () => {
    const kari = await customer('Kari', 'kari@example.com');
    await issuedInvoice(kari, { number: 1, dueDate: '2026-02-01', grossMinor: 100000 }); // forfalt, ubetalt
    await issuedInvoice(kari, { number: 2, dueDate: '2026-04-01', grossMinor: 50000 }); // ikke forfalt
    await issuedInvoice(kari, { number: 3, dueDate: '2026-02-01', grossMinor: 20000, paidMinor: 20000 }); // betalt

    const overdue = await findOverdueInvoices(db, orgId, '2026-03-01');
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.invoiceNumber).toBe('1');
    expect(overdue[0]!.outstandingMinor).toBe(100000n);
  });

  it('sender purring via e-postporten og logger den', async () => {
    const email = new InMemoryEmailStub();
    const r = await sendInvoiceReminders(db, email, opts());
    expect(r.sent).toBe(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('kari@example.com');
    expect(email.sent[0]!.subject).toMatch(/[Pp]åminnelse/);
    expect(email.sent[0]!.text).toContain('1000,00'); // 100000 øre
    const log = await db.query(`SELECT status FROM invoice_reminders WHERE organization_id = $1`, [orgId]);
    expect(log.rowCount).toBe(1);
  });

  it('maser ikke: hopper over faktura purret innen minDaysBetween', async () => {
    const email = new InMemoryEmailStub();
    const r = await sendInvoiceReminders(db, email, opts());
    expect(r.sent).toBe(0);
    expect(r.skippedRecent).toBe(1);
    expect(email.sent).toHaveLength(0);
  });

  it('hopper over forfalte fakturaer uten kunde-e-post', async () => {
    const utenEpost = await customer('Uten e-post', null);
    await issuedInvoice(utenEpost, { number: 4, dueDate: '2026-02-01', grossMinor: 30000 });
    const email = new InMemoryEmailStub();
    const r = await sendInvoiceReminders(db, email, opts());
    expect(r.skippedNoEmail).toBe(1);
  });

  it('uten e-postkonfig kaster (ærlig inaktiv)', async () => {
    const email = new InMemoryEmailStub({ configured: false });
    await expect(sendInvoiceReminders(db, email, opts())).rejects.toThrow();
  });
});
