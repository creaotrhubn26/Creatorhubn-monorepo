import { createPool } from '../dist/db/pool.js';
import { createOrganization, ensureUser } from '../dist/orgs/service.js';
import { postJournalEntry } from '../dist/ledger/engine.js';
import { createBankAccount, importBankTransactions } from '../dist/bank/import.js';
import { newId } from '../dist/shared/ids.js';
const db = createPool('postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const userId = await ensureUser(db, 'cockpit@reknaren.no', 'Cockpitdemo');
const org = await createOrganization(db, { name: 'Fjell & Fjord AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
const actor = { userId, role: 'owner' };
const post = (k, d, lines) => postJournalEntry(db, { organizationId: org.id, actor, entryDate: d, description: k, lines, idempotencyKey: k });
// Salg (bank inn, overskudd, utgående mva i inneværende termin).
await post('salg1', '2026-07-04', [{ accountNumber: '1920', debitMinor: 18750000n }, { accountNumber: '3000', creditMinor: 15000000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 3750000n, vatCode: '3' }]);
await post('salg2', '2026-07-14', [{ accountNumber: '1920', debitMinor: 6250000n }, { accountNumber: '3000', creditMinor: 5000000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 1250000n, vatCode: '3' }]);
// Telefon 100% næring → assistent (blandet bruk).
await post('telefon', '2026-06-10', [{ accountNumber: '6900', debitMinor: 180000n, vatCode: '1' }, { accountNumber: '1920', creditMinor: 180000n }]);
// Bank-utbetaling uten bilag + sannsynlig faktura → dokumentjakt.
const acc = await createBankAccount(db, { organizationId: org.id, actor, name: 'Drift', ibanOrAccount: 'NO9386011117947' });
await importBankTransactions(db, { organizationId: org.id, actor, bankAccountId: acc, transactions: [{ externalId: 'adobe', bookedDate: '2026-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }] });
const docId = newId();
await db.query(`INSERT INTO source_documents (id,organization_id,source,filename,mime_type,byte_size,sha256,storage_key,status,created_by) VALUES ($1,$2,'gmail','adobe.pdf','application/pdf',100,$3,$4,'extracted',$5)`, [docId, org.id, newId(), 'k/'+docId, userId]);
await db.query(`INSERT INTO extracted_document_data (id,document_id,organization_id,document_type,vendor_name,invoice_date,currency,gross_minor) VALUES ($1,$2,$3,'supplier_invoice','Adobe Systems Software AS','2026-07-14','NOK',124900)`, [newId(), docId, org.id]);
// To bilag til behandling → «Å følge opp» + flis.
for (let i = 0; i < 2; i++) { const id = newId(); await db.query(`INSERT INTO source_documents (id,organization_id,source,filename,mime_type,byte_size,sha256,storage_key,status,created_by) VALUES ($1,$2,'upload',$3,'application/pdf',100,$4,$5,'needs_review',$6)`, [id, org.id, 'kvittering-'+i+'.pdf', newId(), 'k/'+id, userId]); }
console.log('ORG_ID=' + org.id);
await db.end();
