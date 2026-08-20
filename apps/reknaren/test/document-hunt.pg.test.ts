/**
 * Smart dokumentjakt: kobler en betaling uten bilag til en sannsynlig faktura vi
 * allerede har hentet inn (Adobe-eksemplet).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { autoApproveTrustedVendorMatches, bookDocumentAsUtlegg, huntDocuments, linkPaymentToDocument, previewPaymentLink, receiptCandidatesForTransaction, receiptsWithoutPayment } from '../src/ingestion/document-hunt.js';
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

  it('forhåndsvisning viser foreslått konto/MVA uten å bokføre', async () => {
    const org = await createOrganization(db, { name: 'Preview AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }],
    });
    const doc = await orphanDoc(org.id, 'Adobe Systems Software AS', '2025-07-14', 124900n);
    const txId = (await huntDocuments(db, { organizationId: org.id, asOf: ASOF })).gaps[0]!.transactionId;

    const pv = await previewPaymentLink(db, rules, { organizationId: org.id, transactionId: txId, documentId: doc });
    expect(pv.accountNumber).toMatch(/^\d{4}$/);
    expect(pv.accountName.length).toBeGreaterThan(0);
    expect(BigInt(pv.grossMinor)).toBe(124900n);

    // Forhåndsvisning skriver ingenting.
    const tx = await db.query(`SELECT status FROM bank_transactions WHERE id = $1`, [txId]);
    expect(tx.rows[0].status).toBe('unmatched');
    const je = await db.query(`SELECT id FROM journal_entries WHERE source_document_id = $1`, [doc]);
    expect(je.rowCount).toBe(0);
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

describe('receiptCandidatesForTransaction (per bank-linje)', () => {
  it('finner kvitteringen for ÉN betaling; ærlig tomt når ingen match', async () => {
    const org = await createOrganization(db, { name: 'Perlinje AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [
        { externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' },
        { externalId: 't-ukjent', bookedDate: '2025-07-05', amountMinor: -33300n, description: 'VIPPS OLA NORDMANN' },
      ],
    });
    await orphanDoc(org.id, 'Adobe Systems Software AS', '2025-07-14', 124900n);

    const adobeTx = (await db.query(`SELECT id FROM bank_transactions WHERE external_id='t-adobe' AND organization_id=$1`, [org.id])).rows[0].id as string;
    const found = await receiptCandidatesForTransaction(db, { organizationId: org.id, transactionId: adobeTx });
    expect(found.found).toBe(true);
    expect(found.candidates[0]!.vendor).toContain('Adobe');

    const ukjentTx = (await db.query(`SELECT id FROM bank_transactions WHERE external_id='t-ukjent' AND organization_id=$1`, [org.id])).rows[0].id as string;
    const none = await receiptCandidatesForTransaction(db, { organizationId: org.id, transactionId: ukjentTx });
    expect(none.found).toBe(false);
    expect(none.candidates).toHaveLength(0);
  });
});

describe('utlegg — kvittering uten betaling («betalte du privat?»)', () => {
  it('lister bilag uten betaling, og bokfører som utlegg mot eier-konto (ENK: 2060, AS: 2900)', async () => {
    // ENK: utlegg øker egenkapitalen (privatkonto 2060).
    const enk = await createOrganization(db, { name: 'Utlegg ENK', orgForm: 'ENK', vatStatus: 'registered', createdByUserId: userId });
    const enkDoc = await orphanDoc(enk.id, 'Clas Ohlson', '2025-07-10', 49900n);

    const orphans = await receiptsWithoutPayment(db, { organizationId: enk.id });
    expect(orphans.map((o) => o.documentId)).toContain(enkDoc);

    const r = await bookDocumentAsUtlegg(db, rules, { organizationId: enk.id, actor: actor(), documentId: enkDoc });
    expect(r.ownerAccount).toBe('2060');
    expect(r.entryNumber).toBeGreaterThan(0);
    // Bilaget er bokført, og eier-kontoen er kreditert hele beløpet.
    const doc = await db.query(`SELECT status FROM source_documents WHERE id = $1`, [enkDoc]);
    expect(doc.rows[0].status).toBe('posted');
    const cred = await db.query(
      `SELECT l.credit_minor FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
       WHERE je.source_document_id = $1 AND l.account_number = '2060'`,
      [enkDoc],
    );
    expect(cred.rows[0].credit_minor.toString()).toBe('49900');

    // AS: firmaet skylder eier (gjeld 2900).
    const as = await createOrganization(db, { name: 'Utlegg AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const asDoc = await orphanDoc(as.id, 'Clas Ohlson', '2025-07-10', 49900n);
    const r2 = await bookDocumentAsUtlegg(db, rules, { organizationId: as.id, actor: actor(), documentId: asDoc });
    expect(r2.ownerAccount).toBe('2900');
  });

  it('auto-godkjenn kobler høy-konfidens match KUN for betrodde leverandører', async () => {
    const org = await createOrganization(db, { name: 'Auto AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-adobe', bookedDate: '2025-07-17', amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }],
    });
    await orphanDoc(org.id, 'Adobe Systems Software AS', '2025-07-14', 124900n);

    // Uten betrodd leverandør: ingen auto-godkjenning.
    const none = await autoApproveTrustedVendorMatches(db, rules, { organizationId: org.id, actor: actor() });
    expect(none.approved).toBe(0);

    // Merk leverandøren auto-godkjenn → høy-konfidens match kobles automatisk.
    await db.query(
      `INSERT INTO vendors (id, organization_id, name, created_by, auto_approve) VALUES ($1,$2,'Adobe Systems Software AS',$3,true)`,
      [newId(), org.id, userId],
    );
    const r = await autoApproveTrustedVendorMatches(db, rules, { organizationId: org.id, actor: actor() });
    expect(r.approved).toBe(1);
    const tx = await db.query(`SELECT status FROM bank_transactions WHERE external_id='t-adobe' AND organization_id=$1`, [org.id]);
    expect(tx.rows[0].status).toBe('reconciled');
  });

  it('bilag som HAR en matchende betaling regnes ikke som utlegg', async () => {
    const org = await createOrganization(db, { name: 'IkkeUtlegg AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-clas', bookedDate: '2025-07-11', amountMinor: -49900n, description: 'CLAS OHLSON' }],
    });
    await orphanDoc(org.id, 'Clas Ohlson', '2025-07-10', 49900n);
    const orphans = await receiptsWithoutPayment(db, { organizationId: org.id });
    expect(orphans).toHaveLength(0); // har en betaling → dokumentjakt, ikke utlegg
  });
});
