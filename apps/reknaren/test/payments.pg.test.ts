/**
 * Utbetalingsfil (pain.001): velformet XML med KID/fritekst, og «til betaling»-
 * lista som faller ut når fakturaen er eksportert (ingen dobbeltbetaling).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from '../src/db/pool.js';
import { buildPaymentFile, listPayableInvoices, recordPaymentExports } from '../src/ledger/payments.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'pay@example.com', 'Pay');
});
afterAll(async () => { await db.end(); });

describe('buildPaymentFile (pain.001.001.03)', () => {
  const file = buildPaymentFile({
    debtorName: 'Qazi Fotoreel', debtorOrgNumber: '833038222', debtorAccount: '15060012345',
    msgId: 'REKNAREN-1', creationDateTime: '2026-07-31T12:00:00', requestedExecutionDate: '2026-08-01',
    payments: [
      { endToEndId: 'E1', creditorName: 'Telia Norge AS', creditorAccount: '12345678903', amountMinor: 70000n, currency: 'NOK', kid: '1234567890128', message: null },
      { endToEndId: 'E2', creditorName: 'Adobe', creditorAccount: '98765432109', amountMinor: 30050n, currency: 'NOK', kid: null, message: 'Faktura 42' },
    ],
  });

  it('er velformet XML (xmllint)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pain-'));
    const f = join(dir, 'pain001.xml');
    writeFileSync(f, file, 'utf8');
    execFileSync('xmllint', ['--noout', f]);
  });

  it('har riktig struktur, beløp, KID og fritekst', () => {
    expect(file).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"');
    expect(file).toContain('<NbOfTxs>2</NbOfTxs>');
    expect(file).toContain('<CtrlSum>1000.50</CtrlSum>'); // 700.00 + 300.50
    expect(file).toContain('<InstdAmt Ccy="NOK">700.00</InstdAmt>');
    expect(file).toContain('<Ref>1234567890128</Ref>'); // KID som strukturert referanse
    expect(file).toContain('<Ustrd>Faktura 42</Ustrd>'); // fritekst når ingen KID
    expect(file).toContain('<Othr><Id>12345678903</Id></Othr>'); // kreditors konto (BBAN)
    expect(file).toContain('<ChrgBr>SLEV</ChrgBr>');
  });
});

async function seedInvoice(orgId: string, opts: { vendor: string; account: string | null; kid: string | null; gross: bigint; due: string }) {
  const docId = newId();
  await db.query(
    `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
     VALUES ($1,$2,'upload','f.pdf','application/pdf',100,$3,$4,'posted',$5)`,
    [docId, orgId, newId(), `k/${docId}`, userId],
  );
  await db.query(
    `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, bank_account, kid, gross_minor, due_date)
     VALUES ($1,$2,$3,'supplier_invoice',$4,$5,$6,$7,$8)`,
    [newId(), docId, orgId, opts.vendor, opts.account, opts.kid, opts.gross.toString(), opts.due],
  );
  return docId;
}

describe('til betaling-lista', () => {
  it('lister leverandørfakturaer og fjerner dem etter eksport', async () => {
    const org = await createOrganization(db, { name: 'Betaling AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const d1 = await seedInvoice(org.id, { vendor: 'Telia', account: '12345678903', kid: '1234567890128', gross: 70000n, due: '2026-08-15' });
    await seedInvoice(org.id, { vendor: 'Uten konto AS', account: null, kid: null, gross: 50000n, due: '2026-08-10' });

    const payable = await listPayableInvoices(db, org.id);
    expect(payable).toHaveLength(2);
    expect(payable.find((p) => p.vendorName === 'Telia')!.payable).toBe(true);
    expect(payable.find((p) => p.vendorName === 'Uten konto AS')!.payable).toBe(false); // mangler konto
    // Forfall-sortert: 08-10 før 08-15
    expect(payable[0]!.vendorName).toBe('Uten konto AS');

    await recordPaymentExports(db, { organizationId: org.id, actor: { userId, role: 'owner' }, messageRef: 'REKNAREN-1', items: [{ documentId: d1, amountMinor: 70000n, creditorAccount: '12345678903' }] });
    const after = await listPayableInvoices(db, org.id);
    expect(after.map((p) => p.vendorName)).toEqual(['Uten konto AS']); // Telia falt ut
  });
});
