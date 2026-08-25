import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';
import { newId } from '../dist/shared/ids.js';
const db = createPool('postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const userId = await ensureUser(db, 'close@reknaren.no', 'Avslutningsdemo');
const org = await createOrganization(db, { name: 'Bergen Bygg AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
const actor = { userId, role: 'owner' };
const pad = (n) => String(n).padStart(2, '0');
const post = (key, date, lines) => postJournalEntry(db, { organizationId: org.id, actor, entryDate: date, description: key, lines, idempotencyKey: key });
await post('ak', '2025-01-02', [{ accountNumber: '1920', debitMinor: 20000000n }, { accountNumber: '2000', creditMinor: 20000000n }]);
// 48 rene salgsbilag gjennom mars.
for (let i = 0; i < 48; i++) {
  const d = `2025-03-${pad((i % 27) + 1)}`;
  await post('salg-' + i, d, [
    { accountNumber: '1920', debitMinor: 500000n },
    { accountNumber: '3000', creditMinor: 400000n, vatCode: '3' },
    { accountNumber: '2700', creditMinor: 100000n, vatCode: '3' },
  ]);
}
// Én mulig dobbeltføring (samme leverandør + beløp).
const v = newId();
await db.query(`INSERT INTO vendors (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [v, org.id, 'Byggvarehuset AS', userId]);
for (const [k, d] of [['dup1', '2025-03-11'], ['dup2', '2025-03-13']])
  await post(k, d, [{ accountNumber: '6800', debitMinor: 340000n, vatCode: '1', vendorId: v }, { accountNumber: '2400', creditMinor: 340000n, vendorId: v }]);
// Én stor forsikring → periodisering.
await post('forsikring', '2025-03-05', [{ accountNumber: '7500', debitMinor: 2400000n }, { accountNumber: '1920', creditMinor: 2400000n }]);
// Tre bilag som venter på behandling.
for (let i = 0; i < 3; i++) {
  const id = newId();
  await db.query(
    `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
     VALUES ($1,$2,'upload',$3,'application/pdf',100,$4,$5,'needs_review',$6)`,
    [id, org.id, 'venter-' + i + '.pdf', newId(), 'k/' + id, userId],
  );
}
console.log('ORG_ID=' + org.id);
await db.end();
