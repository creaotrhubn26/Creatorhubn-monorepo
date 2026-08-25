/**
 * Seeder et helt regnskapsår (2025) for en AS-demo: aksjekapital, salg og
 * kostnad — så årsavslutningen har ekte tall å regne skatt og disponering av.
 * Skriver ut orgId for nettleser-demoen.
 */
import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';

const db = createPool('postgres://reknaren:reknaren_dev@localhost:5432/reknaren_test');
const userId = await ensureUser(db, 'yeardemo@reknaren.no', 'Årsdemo');
const org = await createOrganization(db, {
  name: 'Nordlys Studio AS',
  orgForm: 'AS',
  vatStatus: 'registered',
  createdByUserId: userId,
});
const actor = { userId, role: 'owner' };
const post = (key, date, lines) =>
  postJournalEntry(db, { organizationId: org.id, actor, entryDate: date, description: key, lines, idempotencyKey: key });

// Aksjekapital 30 000 kr.
await post('Aksjekapital', '2025-01-02', [
  { accountNumber: '1920', debitMinor: 3000000n },
  { accountNumber: '2000', creditMinor: 3000000n },
]);
// Salg 120 000 kr gjennom året.
await post('Salg kvartal 1', '2025-03-20', [
  { accountNumber: '1920', debitMinor: 6000000n },
  { accountNumber: '3000', creditMinor: 6000000n, vatCode: '3' },
]);
await post('Salg kvartal 3', '2025-09-15', [
  { accountNumber: '1920', debitMinor: 6000000n },
  { accountNumber: '3000', creditMinor: 6000000n, vatCode: '3' },
]);
// Kostnader 45 000 kr.
await post('Programvare', '2025-04-01', [
  { accountNumber: '6810', debitMinor: 2500000n, vatCode: '1' },
  { accountNumber: '1920', creditMinor: 2500000n },
]);
await post('Kontorrekvisita', '2025-08-10', [
  { accountNumber: '6800', debitMinor: 2000000n, vatCode: '1' },
  { accountNumber: '1920', creditMinor: 2000000n },
]);

console.log('ORG_ID=' + org.id);
await db.end();
