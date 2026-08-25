import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';
import { newId } from '../dist/shared/ids.js';
const db = createPool('postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const userId = await ensureUser(db, 'ask@reknaren.no', 'Spørdemo');
const org = await createOrganization(db, { name: 'Nordvest Media AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
const actor = { userId, role: 'owner' };
const post = (k, d, lines, doc) => postJournalEntry(db, { organizationId: org.id, actor, entryDate: d, description: k, lines, idempotencyKey: k, ...(doc ? { sourceDocumentId: doc } : {}) });
// Programvare med bilag (Adobe, Figma).
for (const [k, d, name, amt] of [['adobe','2026-03-15','Adobe Creative Cloud',249000n],['figma','2026-05-02','Figma årsplan',180000n],['ms365','2026-06-20','Microsoft 365',120000n]]) {
  const doc = newId();
  await db.query(`INSERT INTO source_documents (id,organization_id,source,filename,mime_type,byte_size,sha256,storage_key,status,created_by) VALUES ($1,$2,'gmail',$3,'application/pdf',100,$4,$5,'posted',$6)`, [doc, org.id, k+'.pdf', newId(), 'k/'+doc, userId]);
  await post(k, d, [{ accountNumber: '6810', debitMinor: amt, vatCode: '1', description: name }, { accountNumber: '1920', creditMinor: amt }], doc);
}
// Salg med MVA.
await post('salg', '2026-07-08', [{ accountNumber: '1920', debitMinor: 12500000n }, { accountNumber: '3000', creditMinor: 10000000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 2500000n, vatCode: '3' }]);
console.log('ORG_ID=' + org.id);
await db.end();
