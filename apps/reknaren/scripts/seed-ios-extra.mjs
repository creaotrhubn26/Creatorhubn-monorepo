import { createPool } from '../dist/db/pool.js';
import { ensureUser } from '../dist/orgs/service.js';
import { buildNorwegianRuleRegister } from '../dist/rules/no/rules.js';
import { createInvoiceDraft, issueInvoice } from '../dist/invoicing/service.js';
import { createFixedAsset } from '../dist/ledger/depreciation.js';
import { newId } from '../dist/shared/ids.js';

const ORG = process.argv[2];
if (!ORG) { console.error('bruk: node seed-ios-extra.mjs <ORG_ID>'); process.exit(1); }
const db = createPool('postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const rules = buildNorwegianRuleRegister();
const userId = await ensureUser(db, 'cockpit@reknaren.no', 'Cockpitdemo');
const actor = { userId, role: 'owner' };

// Kunde + to fakturaer (én sendt, én kladd).
const custId = newId();
await db.query(`INSERT INTO customers (id,organization_id,name,org_number,email,created_by) VALUES ($1,$2,'Nordvik Eiendom AS','912345678','post@nordvik.no',$3)`, [custId, ORG, userId]);
const inv1 = await createInvoiceDraft(db, rules, { organizationId: ORG, actor, customerId: custId, invoiceDate: '2026-07-02', dueDate: '2026-07-16', lines: [{ description: 'Rådgivning juli', quantityThousandths: 10000n, unitPriceMinor: 1500000n, vatCode: '3' }] });
await issueInvoice(db, rules, { organizationId: ORG, actor, invoiceId: inv1.id, invoiceDate: '2026-07-02' });
await createInvoiceDraft(db, rules, { organizationId: ORG, actor, customerId: custId, invoiceDate: '2026-08-01', dueDate: '2026-08-15', lines: [{ description: 'Designpakke', quantityThousandths: 1000n, unitPriceMinor: 4200000n, vatCode: '3' }] });

// Anleggsmidler (over grensa → aktiv, avskrives).
await createFixedAsset(db, { organizationId: ORG, actor, name: 'MacBook Pro 16"', saldoGroup: 'a', acquisitionDate: '2026-02-10', costMinor: 3299000n });
await createFixedAsset(db, { organizationId: ORG, actor, name: 'Varebil (Toyota Proace)', saldoGroup: 'c', acquisitionDate: '2025-11-05', costMinor: 42000000n });

console.log('extra seeded for', ORG);
await db.end();
