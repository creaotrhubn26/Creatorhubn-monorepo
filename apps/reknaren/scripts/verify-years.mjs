/**
 * Verifiserer skatteanslag (skatt/effektiv/marginal + per-faktura-avsetning) for
 * Qazi Konsulenttjenester per år mot importerte SAF-T-data. Kjør etter import-qazi-saft.mjs.
 * DB velges via DATABASE_URL (default: lokal reknaren_test).
 */
import { createPool } from '../dist/db/pool.js';
import { buildNorwegianRuleRegister } from '../dist/rules/no/rules.js';
import { taxReserveOverview, taxSetAsideForInvoice } from '../dist/tax/reserve.js';
const db = createPool(process.env.DATABASE_URL ?? 'postgres://reknaren:reknaren_dev@127.0.0.1:5432/reknaren_test');
const rules = buildNorwegianRuleRegister();
const ORG=(await db.query("SELECT id FROM organizations WHERE org_number='926476122'")).rows[0].id;
for (const y of ['2024','2025','2026']) {
  const ov = await taxReserveOverview(db, rules, { organizationId: ORG, orgForm: 'ENK', asOf: `${y}-12-31` });
  const s = await taxSetAsideForInvoice(db, rules, { organizationId: ORG, orgForm: 'ENK', asOf: `${y}-12-31`, invoiceNetMinor: 4440000n });
  console.log(`${y}: skatt ${Math.round(Number(ov.estimatedTaxMinor)/100).toLocaleString('no')} | effektiv ${(ov.effectiveRatePer1000/10).toFixed(1)}% | marginal ${(ov.marginalRatePer1000/10).toFixed(1)}% | faktura 44 400 → ${Math.round(Number(s.setAsideMinor)/100).toLocaleString('no')}`);
}
await db.end();
