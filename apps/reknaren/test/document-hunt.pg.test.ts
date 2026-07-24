/**
 * Smart dokumentjakt: kobler en betaling uten bilag til en sannsynlig faktura vi
 * allerede har hentet inn (Adobe-eksemplet).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { huntDocuments, linkPaymentToDocument } from '../src/ingestion/document-hunt.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const ASOF = '2025-08-01';
const actor = () => ({ userId, role: 'owner' });

async function orphanDoc(orgId: string, vendor: string, dateText: string, grossMinor: bigint): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
     VALUES ($1,$2,'gmail','faktura.pdf','application/pdf',100,$3,$4,'extracted',$5)`,
    [id, orgId, newId(), `k/${id}`, userId],
  );
  await db.query(
    `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, invoice_date, currency, gross_minor)
     VALUES ($1,$2,$3,'supplier_invoice',$4,$5,'NOK',$6)`,
    [newId(), id, orgId, vendor, dateText, grossMinor],
  );
  return id;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'hunt@example.com', 'Jakttester');
});

afterAll(async () => {
  await db.end();
});

describe('huntDocuments', () => {
  it('kobler en betaling uten bilag til en sannsynlig faktura fra e-post', async () => {
    const org = await createOrganization(db, { name: 'Jakt AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [
        { externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' },
        { externalId: 't-kiwi', bookedDate: '2025-07-05', amountMinor: -50000n, description: 'KIWI MINIPRIS' },
      ],
    });
    // Faktura hentet fra e-post (ikke koblet ennå).
    const adobeDoc = await orphanDoc(org.id, 'Adobe Systems Software AS', '2025-07-14', 124900n);
    // Distraksjon: samme leverandørnavn, helt annet beløp → skal ikke matche.
    await orphanDoc(org.id, 'Adobe Systems', '2025-01-02', 9999900n);

    const h = await huntDocuments(db, { organizationId: org.id, asOf: ASOF });
    expect(h.paymentsMissingDoc).toBe(2); // begge uavstemte utbetalinger
    expect(h.gapsWithCandidates).toBe(1); // bare Adobe har en sannsynlig faktura

    const gap = h.gaps[0]!;
    expect(gap.description).toContain('ADOBE');
    expect(gap.amountMinor).toBe(-124900n);
    const top = gap.candidates[0]!;
    expect(top.documentId).toBe(adobeDoc);
    expect(top.score).toBe(100); // beløp + leverandør + dato (3 dager)
    expect(top.reasons.join(' ')).toContain('Samme beløp');
    expect(top.reasons.join(' ')).toContain('matcher');
    expect(top.reasons.join(' ')).toContain('14. juli');
    // Feil-beløp-dokumentet er ikke en kandidat.
    expect(gap.candidates.every((c) => c.grossMinor === 124900n)).toBe(true);
  });

  it('ett-klikks kobling bokfører kostnaden, avstemmer betalingen og lenker alt', async () => {
    const org = await createOrganization(db, { name: 'Koble AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }],
    });
    const doc = await orphanDoc(org.id, 'Adobe Systems Software AS', '2025-07-14', 124900n);

    const hunt = await huntDocuments(db, { organizationId: org.id, asOf: ASOF });
    const txId = hunt.gaps[0]!.transactionId;

    const r = await linkPaymentToDocument(db, rules, { organizationId: org.id, actor: actor(), transactionId: txId, documentId: doc });
    expect(r.entryNumber).toBeGreaterThan(0);
    expect(r.accountNumber).toMatch(/^\d{4}$/);

    // Banktransaksjonen er avstemt.
    const tx = await db.query(`SELECT status FROM bank_transactions WHERE id = $1`, [txId]);
    expect(tx.rows[0].status).toBe('reconciled');
    // Bilaget er bokført og lenket til posteringen.
    const je = await db.query(`SELECT id FROM journal_entries WHERE source_document_id = $1`, [doc]);
    expect(je.rowCount).toBe(1);
    // Posteringen krediterer banken (1920).
    const bankLine = await db.query(`SELECT credit_minor FROM journal_lines WHERE entry_id = $1 AND account_number = '1920'`, [je.rows[0].id]);
    expect(BigInt(bankLine.rows[0].credit_minor)).toBe(124900n);
    // Avstemmingskoblingen finnes.
    const match = await db.query(`SELECT status FROM reconciliation_matches WHERE bank_transaction_id = $1 AND journal_entry_id = $2`, [txId, je.rows[0].id]);
    expect(match.rows[0].status).toBe('approved');

    // Gapet er borte i ny jakt.
    const after = await huntDocuments(db, { organizationId: org.id, asOf: ASOF });
    expect(after.gapsWithCandidates).toBe(0);

    // Idempotent/sikker: ny kobling avvises fordi transaksjonen alt er avstemt.
    await expect(linkPaymentToDocument(db, rules, { organizationId: org.id, actor: actor(), transactionId: txId, documentId: doc })).rejects.toThrow();
  });

  it('betaling uten noen matchende faktura gir ingen kandidat', async () => {
    const org = await createOrganization(db, { name: 'Tom AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 'x', bookedDate: '2025-07-10', amountMinor: -75000n, description: 'REMA 1000' }],
    });
    const h = await huntDocuments(db, { organizationId: org.id, asOf: ASOF });
    expect(h.paymentsMissingDoc).toBe(1);
    expect(h.gapsWithCandidates).toBe(0);
  });
});
