/**
 * «Spør virksomheten»: naturlig-språk-spørsmål rutes til deterministiske svar,
 * forankret i hovedboken, med klikkbare bevis.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { answerQuestion } from '../src/ledger/ask.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
let orgId: string;
const rules = buildNorwegianRuleRegister();
const ASOF = '2025-07-20';
const actor = () => ({ userId, role: 'owner' });
const ask = (q: string) => answerQuestion(db, rules, { organizationId: orgId, question: q, asOf: ASOF });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'ask@example.com', 'Spørretester');
  const org = await createOrganization(db, { name: 'Spør AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
  orgId = org.id;
  const post = (k: string, d: string, lines: Parameters<typeof postJournalEntry>[1]['lines'], sourceDocumentId?: string) =>
    postJournalEntry(db, { organizationId: orgId, actor: actor(), entryDate: d, description: k, lines, idempotencyKey: k, ...(sourceDocumentId ? { sourceDocumentId } : {}) });
  // Programvare (6810).
  const doc = newId();
  await db.query(`INSERT INTO source_documents (id,organization_id,source,filename,mime_type,byte_size,sha256,storage_key,status,created_by) VALUES ($1,$2,'gmail','adobe.pdf','application/pdf',100,$3,$4,'posted',$5)`, [doc, orgId, newId(), 'k/' + doc, userId]);
  await post('Adobe', '2025-03-10', [{ accountNumber: '6810', debitMinor: 500000n, vatCode: '1' }, { accountNumber: '1920', creditMinor: 500000n }], doc);
  // Utland (omvendt avgiftsplikt).
  await post('Utenlandsk sky', '2025-04-01', [{ accountNumber: '6810', debitMinor: 200000n, vatCode: '86' }, { accountNumber: '1920', creditMinor: 200000n }]);
  // Kostnad uten bilag.
  await post('Diverse', '2025-03-20', [{ accountNumber: '6800', debitMinor: 150000n }, { accountNumber: '1920', creditMinor: 150000n }]);
  // Salg juni + juli (for endring + MVA).
  await post('Salg juni', '2025-06-10', [{ accountNumber: '1920', debitMinor: 1000000n }, { accountNumber: '3000', creditMinor: 800000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 200000n, vatCode: '3' }]);
  await post('Salg juli', '2025-07-05', [{ accountNumber: '1500', debitMinor: 1250000n }, { accountNumber: '3000', creditMinor: 1000000n, vatCode: '3' }, { accountNumber: '2700', creditMinor: 250000n, vatCode: '3' }]);
  // Kunde med forfalt faktura.
  const cust = newId();
  await db.query(`INSERT INTO customers (id,organization_id,name,created_by) VALUES ($1,$2,'Sen Betaler AS',$3)`, [cust, orgId, userId]);
  await db.query(`INSERT INTO invoices (id,organization_id,customer_id,invoice_number,invoice_date,due_date,gross_minor,paid_minor,status,created_by) VALUES ($1,$2,$3,1,'2025-05-01','2025-06-01',1250000,0,'issued',$4)`, [newId(), orgId, cust, userId]);
});

afterAll(async () => {
  await db.end();
});

describe('answerQuestion', () => {
  it('programvare-bruk → sum + bilag som bevis', async () => {
    const a = await ask('Hva bruker vi på programvare?');
    expect(a.intent).toBe('software_spend');
    expect(a.headline).toContain('7 000,00'); // 5000 + 2000 kr på 6810
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.evidence[0]!.type).toBe('journal_entry');
  });

  it('utlandskjøp → omvendt avgiftsplikt-bilag', async () => {
    const a = await ask('Hva har vi kjøpt fra utlandet?');
    expect(a.intent).toBe('foreign_purchases');
    expect(a.headline).toContain('1 kjøp');
  });

  it('mangler bilag → kostnadsføringer uten dokument', async () => {
    const a = await ask('Hvilke fakturaer mangler bilag?');
    expect(a.intent).toBe('missing_docs');
    expect(a.evidence.length).toBeGreaterThan(0);
  });

  it('forventet MVA → utgående minus inngående', async () => {
    const a = await ask('Hvor mye MVA må vi sannsynligvis betale?');
    expect(a.intent).toBe('expected_vat');
    expect(a.figures.some((f) => f.label === 'Utgående MVA')).toBe(true);
  });

  it('endring siden forrige måned → resultat-sammenligning', async () => {
    const a = await ask('Hva har endret seg siden forrige måned?');
    expect(a.intent).toBe('month_compare');
    expect(a.figures.some((f) => f.label === 'Endring')).toBe(true);
  });

  it('sene betalere → forfalte fakturaer per kunde', async () => {
    const a = await ask('Hvilke kunder har aldri betalt innen fristen?');
    expect(a.intent).toBe('late_payers');
    expect(a.headline).toContain('forfalte');
    expect(a.evidence[0]!.type).toBe('customer');
    expect(a.evidence[0]!.label).toContain('Sen Betaler AS');
  });

  it('ukjent spørsmål → understood=false + forslag', async () => {
    const a = await ask('Hva er meningen med livet?');
    expect(a.understood).toBe(false);
    expect(a.followUps.length).toBeGreaterThan(0);
  });
});
