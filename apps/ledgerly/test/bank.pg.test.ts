/**
 * Scenario 4 (bankmatching) + objektlagring, mot ekte Postgres:
 * import (idempotent) → deterministisk matching med forklaring →
 * godkjenning bokfører betaling og lukker reskontro → avvisning → kontrollspor.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBankAccount, importBankTransactions, parseBankCsv } from '../src/bank/import.js';
import { approveMatch, rejectMatch, suggestMatches } from '../src/bank/matching.js';
import type { Db } from '../src/db/pool.js';
import { subledger } from '../src/ledger/reports.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { DeterministicTextExtractor } from '../src/pipeline/extract.js';
import { approveAndPost, processIncomingDocument, type PipelineDeps } from '../src/pipeline/pipeline.js';
import { DeterministicSuggestionEngine } from '../src/pipeline/suggest.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { LocalObjectStorage } from '../src/storage/local.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let deps: PipelineDeps;
let storage: LocalObjectStorage;
let orgId: string;
let userId: string;
let bankAccountId: string;
let invoiceDocId: string;
const actor = () => ({ userId, role: 'owner' });

const INVOICE_PDF = Buffer.from(
  [
    '%PDF-1.7',
    'Kamerahuset AS',
    'Org.nr: 923609016',
    'Faktura: 2024-1042',
    'Fakturadato: 2025-11-05',
    'Forfall: 2025-11-19',
    'KID: 004212345678903',
    'Netto: 20 000,00',
    'MVA 25%: 5 000,00',
    'Å betale: NOK 25 000,00',
    '%%EOF',
  ].join('\n'),
  'utf8',
);

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'bank@example.com', 'Banktester');
  const org = await createOrganization(db, {
    name: 'Banktest ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;
  storage = new LocalObjectStorage(mkdtempSync(join(tmpdir(), 'ledgerly-storage-')));
  deps = {
    db,
    rules: buildNorwegianRuleRegister(),
    extractor: new DeterministicTextExtractor(),
    suggestionEngine: new DeterministicSuggestionEngine(),
    storage,
  };
  // Bokfør en leverandørfaktura som betalingen skal matches mot.
  const doc = await processIncomingDocument(deps, {
    organizationId: orgId,
    actor: actor(),
    source: 'upload',
    filename: 'faktura-2024-1042.pdf',
    mimeType: 'application/pdf',
    content: INVOICE_PDF,
    vatStatus: 'registered',
  });
  invoiceDocId = doc.documentId;
  await approveAndPost(deps, {
    organizationId: orgId,
    actor: actor(),
    actorRoleVerified: true,
    documentId: doc.documentId,
    suggestionId: doc.suggestionId!,
  });
  bankAccountId = await createBankAccount(db, {
    organizationId: orgId,
    actor: actor(),
    name: 'Driftskonto',
    ibanOrAccount: '15032512345',
  });
});

afterAll(async () => {
  await db.end();
});

describe('Objektlagring', () => {
  it('dokumentinnholdet er lagret og kan hentes med korrekt hash', async () => {
    const row = await db.query(
      `SELECT storage_key, sha256 FROM source_documents WHERE id = $1`,
      [invoiceDocId],
    );
    const stored = await storage.get(row.rows[0].storage_key);
    expect(stored).not.toBeNull();
    expect(stored!.content.equals(INVOICE_PDF)).toBe(true);
    expect(stored!.mimeType).toBe('application/pdf');
  });

  it('ukjent nøkkel gir null, ikke feil', async () => {
    expect(await storage.get('finnes/ikke')).toBeNull();
  });
});

describe('Bankimport', () => {
  it('parser norsk CSV eksakt (desimalkomma, negative beløp)', () => {
    const txs = parseBankCsv(
      [
        'Dato;Beskrivelse;Beløp;Motpart;KID;Referanse',
        '2025-11-18;Nettbank betaling;-25000,00;KAMERAHUSET AS;004212345678903;ref-001',
        '2025-11-20;Kundeinnbetaling;12500,50;;;ref-002',
      ].join('\n'),
    );
    expect(txs).toHaveLength(2);
    expect(txs[0]!.amountMinor).toBe(-2500000n);
    expect(txs[0]!.kid).toBe('004212345678903');
    expect(txs[1]!.amountMinor).toBe(1250050n);
  });

  it('import er idempotent på bankens transaksjons-ID', async () => {
    const txs = parseBankCsv(
      'Dato;Beskrivelse;Beløp;Motpart;KID;Referanse\n2025-11-18;Nettbank betaling;-25000,00;KAMERAHUSET AS;004212345678903;ref-001\n2025-11-21;Gebyr;-49,00;;;ref-003',
    );
    const first = await importBankTransactions(db, {
      organizationId: orgId,
      actor: actor(),
      bankAccountId,
      transactions: txs,
    });
    expect(first.imported).toBe(2);
    const second = await importBankTransactions(db, {
      organizationId: orgId,
      actor: actor(),
      bankAccountId,
      transactions: txs,
    });
    expect(second.imported).toBe(0);
    expect(second.skippedDuplicates).toBe(2);
  });
});

describe('Scenario 4: matching og avstemming', () => {
  let matchId: string;

  it('foreslår KID-treff med forklaring brukeren kan vurdere', async () => {
    const suggestions = await suggestMatches(db, { organizationId: orgId });
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0]!;
    expect(s.matchType).toBe('exact');
    expect(s.explanation).toContain('KID 004212345678903');
    expect(s.explanation).toContain('25000 kr');
    matchId = s.matchId;
  });

  it('kjørt på nytt foreslås ingenting dobbelt', async () => {
    expect(await suggestMatches(db, { organizationId: orgId })).toHaveLength(0);
  });

  it('godkjenning bokfører betalingen og lukker leverandørreskontroen', async () => {
    const before = await subledger(db, orgId, 'vendors');
    expect(before[0]!.balanceMinor).toBe(-2500000n); // skyldig før betaling

    const entry = await approveMatch(db, { organizationId: orgId, actor: actor(), matchId });
    expect(entry.status).toBe('posted');

    const after = await subledger(db, orgId, 'vendors');
    expect(after[0]!.balanceMinor).toBe(0n); // reskontro lukket

    const tx = await db.query(
      `SELECT status FROM bank_transactions WHERE organization_id = $1 AND external_id = 'ref-001'`,
      [orgId],
    );
    expect(tx.rows[0].status).toBe('matched');

    // Idempotent/dobbel godkjenning avvises.
    await expect(
      approveMatch(db, { organizationId: orgId, actor: actor(), matchId }),
    ).rejects.toThrow(/allerede godkjent/);
  });

  it('gebyret uten faktura forblir umatchet (ingen falske treff)', async () => {
    const unmatched = await db.query(
      `SELECT external_id FROM bank_transactions
       WHERE organization_id = $1 AND status = 'unmatched'`,
      [orgId],
    );
    expect(unmatched.rows.map((r) => r.external_id)).toEqual(['ref-003']);
  });

  it('avvisning krever begrunnelse og logges', async () => {
    // Lag et nytt kunstig forslag å avvise: importer en betaling til med samme beløp
    // som en ny faktura, uten KID → regelbasert treff.
    const doc2 = await processIncomingDocument(deps, {
      organizationId: orgId,
      actor: actor(),
      source: 'upload',
      filename: 'faktura-b1.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from(
        '%PDF-1.7\nTelenor ASA\nFaktura: B-1\nFakturadato: 2025-11-10\nForfall: 2025-11-24\nNetto: 800,00\nMVA 25%: 200,00\nÅ betale: NOK 1 000,00\n%%EOF',
        'utf8',
      ),
      vatStatus: 'registered',
    });
    await approveAndPost(deps, {
      organizationId: orgId,
      actor: actor(),
      actorRoleVerified: true,
      documentId: doc2.documentId,
      suggestionId: doc2.suggestionId!,
    });
    await importBankTransactions(db, {
      organizationId: orgId,
      actor: actor(),
      bankAccountId,
      transactions: [
        {
          externalId: 'ref-004',
          bookedDate: '2025-11-22',
          amountMinor: -100000n,
          description: 'Nettbank betaling',
          counterparty: 'TELENOR ASA',
        },
      ],
    });
    const suggestions = await suggestMatches(db, { organizationId: orgId });
    expect(suggestions).toHaveLength(1);
    await expect(
      rejectMatch(db, { organizationId: orgId, actor: actor(), matchId: suggestions[0]!.matchId, reason: ' ' }),
    ).rejects.toThrow(/begrunnelse/);
    await rejectMatch(db, {
      organizationId: orgId,
      actor: actor(),
      matchId: suggestions[0]!.matchId,
      reason: 'Betalingen gjaldt en annen faktura',
    });
    const audit = await db.query(
      `SELECT count(*)::int AS n FROM audit_events
       WHERE organization_id = $1 AND action = 'reconciliation_match.rejected'`,
      [orgId],
    );
    expect(audit.rows[0].n).toBe(1);
  });
});
