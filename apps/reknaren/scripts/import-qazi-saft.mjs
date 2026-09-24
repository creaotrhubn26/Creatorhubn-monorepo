/**
 * Importerer Qazi Konsulenttjenester sine Fiken-SAF-T-filer (3 år) til en lokal DB.
 * Bygg først (`npm run build`), pakk ut SAF-T-XML-ene til en mappe, og kjør:
 *   node scripts/import-qazi-saft.mjs <mappe-med-saft-xml>
 * DB velges via DATABASE_URL (default: lokal reknaren_test).
 */
import { createPool } from '../dist/db/pool.js';
import { ensureUser, createOrganization } from '../dist/orgs/service.js';
import { replaySaftTransactions } from '../dist/saft/import.js';
import fs from 'node:fs';

const DIR = process.argv[2] ?? process.env.QK_SAFT_DIR;
if (!DIR) {
  console.error('Bruk: node scripts/import-qazi-saft.mjs <mappe-med-saft-xml>  (eller sett QK_SAFT_DIR)');
  process.exit(1);
}
const db = createPool(process.env.DATABASE_URL ?? 'postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const userId = await ensureUser(db, 'daniel@creatorhubn.com', 'Daniel Qazi');
const org = await createOrganization(db, { name: 'Qazi Konsulenttjenester', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
await db.query(`UPDATE organizations SET org_number='926476122', street_address='Søsterveien 11', postal_code='1474', city='Lørenskog' WHERE id=$1`, [org.id]);
const actor = { userId, role: 'owner' };
for (let i = 0; i < 3; i++) {
  const year = ['2024', '2025', '2026'][i];
  const f = fs.readdirSync(DIR).find((n) => n.includes('-' + year + '-') && n.endsWith('.xml'));
  if (!f) { console.error(`Fant ingen SAF-T-XML for ${year} i ${DIR}`); continue; }
  const xml = fs.readFileSync(DIR + '/' + f, 'utf8');
  const res = await replaySaftTransactions(db, { organizationId: org.id, actor, xml, includeOpening: i === 0 });
  console.log(year, JSON.stringify(res));
}
console.log('ORG_ID=' + org.id);
await db.end();
