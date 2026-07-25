/**
 * Oversikt-cockpit: aggregerer signalene fra alle motorene til én forside.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { buildDashboard } from '../src/ledger/dashboard.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'dashboard@example.com', 'Cockpittester');
});

afterAll(async () => {
  await db.end();
});

describe('buildDashboard', () => {
  it('samler månedsavslutning, likviditet, dokumentjakt, assistent og handlingsliste', async () => {
    const org = await createOrganization(db, { name: 'Cockpit AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2025-07-02', description: 'Salg',
      lines: [
        { accountNumber: '1920', debitMinor: 25000000n },
        { accountNumber: '3000', creditMinor: 20000000n, vatCode: '3' },
        { accountNumber: '2700', creditMinor: 5000000n, vatCode: '3' },
      ],
      idempotencyKey: 'salg',
    });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }],
    });
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'gmail','adobe.pdf','application/pdf',100,$3,$4,'extracted',$5)`,
      [docId, org.id, newId(), `k/${docId}`, userId],
    );
    await db.query(
      `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, invoice_date, currency, gross_minor)
       VALUES ($1,$2,$3,'supplier_invoice','Adobe Systems Software AS','2025-07-14','NOK',124900)`,
      [newId(), docId, org.id],
    );

    const d = await buildDashboard(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: '2025-07-20' });

    expect(d.monthClose.monthName).toBe('Juli');
    expect(d.monthClose.readinessPct).toBeGreaterThanOrEqual(0);
    expect(d.liquidity.cashNowMinor).toBeGreaterThan(0n);
    // Dokumentjakt finner betalingen uten bilag + kandidaten.
    expect(d.documentHunt.paymentsMissingDoc).toBe(1);
    expect(d.documentHunt.gapsWithCandidates).toBe(1);
    expect(d.counts.bankUnmatched).toBe(1);
    // Assistenten har funn (bl.a. restskatt-risiko av overskuddet).
    expect(d.advisories.total).toBeGreaterThan(0);
    expect(Array.isArray(d.followUp)).toBe(true);
  });
});
