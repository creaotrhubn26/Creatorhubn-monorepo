/**
 * Ekte OCR (Tesseract) mot ekte Postgres: kvitteringsbilde fra «mobilkamera»
 * tolkes, valideres, får forslag og bokføres — og manipulasjonstekst i BILDER
 * fanges av injection-kontrollen på den tolkede teksten.
 *
 * Fixturene i test/fixtures/ er PNG-er rendret fra HTML (se commit-historikk);
 * de er ekte bilder uten tekstlag — teksten finnes kun som piksler.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { isOcrAvailable, OcrExtractor } from '../src/pipeline/ocr.js';
import {
  approveAndPost,
  processIncomingDocument,
  type PipelineDeps,
} from '../src/pipeline/pipeline.js';
import { DeterministicSuggestionEngine } from '../src/pipeline/suggest.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

const FIXTURES = join(process.cwd(), 'test', 'fixtures');
const RECEIPT_PNG = readFileSync(join(FIXTURES, 'kvittering-kamerahuset.png'));
const INJECTION_PNG = readFileSync(join(FIXTURES, 'kvittering-injection.png'));

let db: Db;
let deps: PipelineDeps;
let orgId: string;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  const ocr = await isOcrAvailable();
  if (!ocr.tesseract) {
    throw new Error(
      'tesseract-ocr er ikke installert i testmiljøet (kreves: tesseract-ocr + tesseract-ocr-nor).',
    );
  }
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'ocr@example.com', 'OCR-tester');
  const org = await createOrganization(db, {
    name: 'OCR-test ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;
  deps = {
    db,
    rules: buildNorwegianRuleRegister(),
    extractor: new OcrExtractor(),
    suggestionEngine: new DeterministicSuggestionEngine(),
  };
});

afterAll(async () => {
  await db.end();
});

describe('OCR-uttrekk fra kvitteringsbilde', () => {
  it('leser leverandør, org.nr og beløp fra piksler — og validerer summene', async () => {
    const extractor = new OcrExtractor();
    const data = await extractor.extract(RECEIPT_PNG, 'kvittering.png', 'image/png');
    expect(data.vendorName).toBe('Kamerahuset AS');
    expect(data.vendorOrgNumber).toBe('923609016');
    expect(data.documentType).toBe('receipt');
    expect(data.netMinor).toBe(120000n);
    expect(data.vatMinor).toBe(30000n);
    expect(data.grossMinor).toBe(150000n);
  });

  it('mobilbilde går hele veien: tolket → forslag → godkjent → bokført', async () => {
    const result = await processIncomingDocument(deps, {
      organizationId: orgId,
      actor: actor(),
      source: 'mobile',
      filename: 'IMG_2411.png',
      mimeType: 'image/png',
      content: RECEIPT_PNG,
      vatStatus: 'registered',
    });
    expect(result.status).toBe('extracted');
    expect(result.suggestionId).toBeDefined();

    const entry = await approveAndPost(deps, {
      organizationId: orgId,
      actor: actor(),
      actorRoleVerified: true,
      documentId: result.documentId,
      suggestionId: result.suggestionId!,
    });
    expect(entry.status).toBe('posted');

    const ext = await db.query(
      `SELECT extraction_engine, vendor_name, gross_minor FROM extracted_document_data
       WHERE document_id = $1`,
      [result.documentId],
    );
    expect(ext.rows[0].extraction_engine).toBe('ocr-tesseract');
    expect(ext.rows[0].vendor_name).toBe('Kamerahuset AS');
    expect(ext.rows[0].gross_minor).toBe('150000');
  });

  it('manipulasjonstekst som kun finnes som PIKSLER fanges og karanteneres', async () => {
    const result = await processIncomingDocument(deps, {
      organizationId: orgId,
      actor: actor(),
      source: 'mobile',
      filename: 'IMG_666.png',
      mimeType: 'image/png',
      content: INJECTION_PNG,
      vatStatus: 'registered',
    });
    expect(result.status).toBe('quarantined');
    // Ingenting er lagret som uttrekk, ingenting bokført.
    const ext = await db.query(
      `SELECT count(*)::int AS n FROM extracted_document_data WHERE document_id = $1`,
      [result.documentId],
    );
    expect(ext.rows[0].n).toBe(0);
  });

  it('rawText persisteres aldri i uttrekket', async () => {
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'extracted_document_data'`,
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain('raw_text');
  });
});
