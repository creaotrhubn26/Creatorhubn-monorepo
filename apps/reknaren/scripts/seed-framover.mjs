/**
 * Seeder et scenario for Framover-demoen (relativt til i dag): bankbeholdning,
 * en ubetalt kundefaktura, et leverandørbilag med forfall, utgående MVA i
 * inneværende termin, og fire månedlige Adobe-trekk (fast kostnad).
 */
import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';
import { newId } from '../dist/shared/ids.js';

const db = createPool('postgres://reknaren:reknaren_dev@localhost:5432/reknaren_test');
const userId = await ensureUser(db, 'framover@reknaren.no', 'Framoverdemo');
const org = await createOrganization(db, {
  name: 'Fjord Media AS',
  orgForm: 'AS',
  vatStatus: 'registered',
  createdByUserId: userId,
});
const actor = { userId, role: 'owner' };
const post = (key, date, lines) =>
  postJournalEntry(db, { organizationId: org.id, actor, entryDate: date, description: key, lines, idempotencyKey: key });

// Bankbeholdning.
await post('Aksjekapital', '2026-01-02', [
  { accountNumber: '1920', debitMinor: 5000000n },
  { accountNumber: '2000', creditMinor: 5000000n },
]);
// Salg med utgående MVA i inneværende termin (juli–august).
await post('Salg juli', '2026-07-10', [
  { accountNumber: '1500', debitMinor: 1250000n },
  { accountNumber: '3000', creditMinor: 1000000n, vatCode: '3' },
  { accountNumber: '2700', creditMinor: 250000n, vatCode: '3' },
]);
// Leverandørkjøp på kreditt.
await post('Innkjøp utstyr', '2026-07-05', [
  { accountNumber: '6540', debitMinor: 800000n },
  { accountNumber: '2400', creditMinor: 800000n },
]);
// Fire månedlige Adobe-trekk (fast kostnad).
const adobe = newId();
await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [
  adobe,
  org.id,
  'Adobe',
  userId,
]);
for (const [key, date] of [
  ['adobe-3', '2026-03-15'],
  ['adobe-4', '2026-04-15'],
  ['adobe-5', '2026-05-15'],
  ['adobe-6', '2026-06-15'],
]) {
  await post(key, date, [
    { accountNumber: '6810', debitMinor: 74900n, vatCode: '1', vendorId: adobe },
    { accountNumber: '1920', creditMinor: 74900n },
  ]);
}

// Ubetalt kundefaktura + et leverandørbilag med forfall.
const custId = newId();
await db.query(`INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [
  custId,
  org.id,
  'Storkunde AS',
  userId,
]);
await db.query(
  `INSERT INTO invoices (id, organization_id, customer_id, invoice_number, invoice_date, due_date, gross_minor, paid_minor, status, created_by)
   VALUES ($1,$2,$3,42,'2026-07-15','2026-08-20',2500000,0,'issued',$4)`,
  [newId(), org.id, custId, userId],
);
const docId = newId();
await db.query(
  `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
   VALUES ($1,$2,'upload','lev.pdf','application/pdf',100,$3,$4,'posted',$5)`,
  [docId, org.id, newId(), `k/${docId}`, userId],
);
await db.query(
  `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, currency, gross_minor, due_date)
   VALUES ($1,$2,$3,'supplier_invoice','Utleie Lokaler AS','NOK',1500000,'2026-09-05')`,
  [newId(), docId, org.id],
);

console.log('ORG_ID=' + org.id);
await db.end();
