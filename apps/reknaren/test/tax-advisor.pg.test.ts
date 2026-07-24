/**
 * Proaktiv skatte- og MVA-assistent: finner muligheter, kontrollpunkter og risiko
 * løpende — formulert som muligheter, aldri løfter om maks fradrag.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { buildTaxAdvisories } from '../src/ledger/tax-advisor.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const ASOF = '2026-06-15';
const actor = () => ({ userId, role: 'owner' });
const codes = (t: { advisories: { code: string }[] }) => t.advisories.map((a) => a.code);

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'advisor@example.com', 'Assistenttester');
});

afterAll(async () => {
  await db.end();
});

describe('buildTaxAdvisories', () => {
  it('finner et bredt sett av muligheter, kontrollpunkter og risiko', async () => {
    const org = await createOrganization(db, { name: 'Bred AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const post = (k: string, d: string, lines: Parameters<typeof postJournalEntry>[1]['lines']) =>
      postJournalEntry(db, { organizationId: org.id, actor: actor(), entryDate: d, description: k, lines, idempotencyKey: k });

    // Salg med utgående MVA i inneværende termin (mai–juni) → forventet MVA + overskudd.
    await post('salg', '2026-05-10', [
      { accountNumber: '1920', debitMinor: 62500000n },
      { accountNumber: '3000', creditMinor: 50000000n, vatCode: '3' },
      { accountNumber: '2700', creditMinor: 12500000n, vatCode: '3' },
    ]);
    // Telefon 100 % næring (ingen privat andel) → blandet bruk.
    await post('telefon', '2026-03-10', [{ accountNumber: '6900', debitMinor: 200000n, vatCode: '1' }, { accountNumber: '1920', creditMinor: 200000n }]);
    // Representasjon → begrenset fradrag.
    await post('repr', '2026-03-15', [{ accountNumber: '7350', debitMinor: 400000n }, { accountNumber: '1920', creditMinor: 400000n }]);
    // Omvendt avgiftsplikt → utland.
    await post('utland', '2026-04-01', [{ accountNumber: '6810', debitMinor: 500000n, vatCode: '86' }, { accountNumber: '1920', creditMinor: 500000n }]);
    // Kostnad uten bilag.
    await post('nodoc', '2026-03-20', [{ accountNumber: '6800', debitMinor: 150000n }, { accountNumber: '1920', creditMinor: 150000n }]);
    // Stor transaksjon (> 100 000 kr) → regnskapsfører.
    await post('stor', '2026-02-01', [{ accountNumber: '6551', debitMinor: 15000000n, vatCode: '1' }, { accountNumber: '1920', creditMinor: 15000000n }]);

    // Bilag med mva som ikke er fradragsført → mulighet (ubenyttet fradrag).
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'upload','k.pdf','application/pdf',100,$3,$4,'posted',$5)`,
      [docId, org.id, newId(), `k/${docId}`, userId],
    );
    await db.query(
      `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, currency, net_minor, vat_minor, gross_minor)
       VALUES ($1,$2,$3,'receipt','Strøm AS','NOK',80000,20000,100000)`,
      [newId(), docId, org.id],
    );
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: '2026-03-25', description: 'Kjøp uten fradrag',
      lines: [{ accountNumber: '6340', debitMinor: 100000n }, { accountNumber: '1920', creditMinor: 100000n }],
      idempotencyKey: 'glemt', sourceDocumentId: docId,
    });

    const t = await buildTaxAdvisories(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: ASOF });
    const c = codes(t);
    expect(c).toContain('ubenyttet_mva_fradrag'); // mulighet
    expect(c).toContain('blandet_bruk');
    expect(c).toContain('representasjon');
    expect(c).toContain('utland_mva');
    expect(c).toContain('manglende_dok');
    expect(c).toContain('profesjonell_vurdering');
    expect(c).toContain('forventet_mva');
    expect(c).toContain('restskatt_risiko'); // risiko

    // Representasjon har hjemmelsreferanse.
    expect(t.advisories.find((a) => a.code === 'representasjon')!.legalReference).toContain('§');
    // Stor transaksjon markert for regnskapsfører.
    expect(t.advisories.find((a) => a.code === 'profesjonell_vurdering')!.needsProfessional).toBe(true);
    // Sortert: risiko først.
    expect(t.advisories[0]!.kind).toBe('risiko');
    // Ansvarsfraskrivelse: aldri løfte om maks fradrag.
    expect(t.disclaimer.toLowerCase()).toContain('ikke løfter');
  });

  it('ren virksomhet uten flagg → få eller ingen funn, og alltid ansvarsfraskrivelse', async () => {
    const org = await createOrganization(db, { name: 'Ren2 AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const t = await buildTaxAdvisories(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: ASOF });
    expect(t.advisories.every((a) => ['mulighet', 'kontrollpunkt', 'risiko'].includes(a.kind))).toBe(true);
    expect(t.disclaimer).toContain('maksimalt fradrag');
  });
});
