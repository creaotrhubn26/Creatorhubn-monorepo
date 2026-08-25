import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';
import { newId } from '../dist/shared/ids.js';
const db = createPool('postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const userId = await ensureUser(db, 'enk@reknaren.no', 'Kari Design');
const org = await createOrganization(db, { name: 'Kari Design ENK', orgForm: 'ENK', vatStatus: 'registered', createdByUserId: userId });
const actor = { userId, role: 'owner' };
const post = (key, date, lines) => postJournalEntry(db, { organizationId: org.id, actor, entryDate: date, description: key, lines, idempotencyKey: key });
// Salg gjennom året (overskudd → forskuddsskatt).
for (const [k, d] of [['s1','2026-02-10'],['s2','2026-04-10'],['s3','2026-06-10']])
  await post(k, d, [{ accountNumber: '1920', debitMinor: 2000000n }, { accountNumber: '3000', creditMinor: 2000000n, vatCode: '3' }]);
// Utgående mva i inneværende termin (juli).
await post('salg-juli', '2026-07-10', [
  { accountNumber: '1500', debitMinor: 1000000n },
  { accountNumber: '3000', creditMinor: 800000n, vatCode: '3' },
  { accountNumber: '2700', creditMinor: 200000n, vatCode: '3' },
]);
// Fast kostnad: Adobe månedlig.
const adobe = newId();
await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [adobe, org.id, 'Adobe', userId]);
for (const [k, d] of [['a3','2026-03-15'],['a4','2026-04-15'],['a5','2026-05-15'],['a6','2026-06-15']])
  await post(k, d, [{ accountNumber: '6810', debitMinor: 74900n, vatCode: '1', vendorId: adobe }, { accountNumber: '1920', creditMinor: 74900n }]);
// Ubetalt kundefaktura.
const cust = newId();
await db.query(`INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [cust, org.id, 'Byrå Nord AS', userId]);
await db.query(`INSERT INTO invoices (id, organization_id, customer_id, invoice_number, invoice_date, due_date, gross_minor, paid_minor, status, created_by) VALUES ($1,$2,$3,7,'2026-07-12','2026-08-25',1800000,0,'issued',$4)`, [newId(), org.id, cust, userId]);
console.log('ORG_ID=' + org.id);
await db.end();
