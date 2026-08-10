/**
 * Resend inn-e-post: Svix-signaturverifisering + ruting av et email.received-event
 * (henter vedlegg via mocket Resend-API og lagrer dem som forward-bilag).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import type { Db } from '../src/db/pool.js';
import type { ObjectStorage, StoredObject } from '../src/storage/port.js';
import { inboundEmailFor } from '../src/ingestion/inbound-email.js';
import { ingestResendEmail, verifyResendSignature } from '../src/ingestion/resend-inbound.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
let orgId: string;

const mem = new Map<string, StoredObject>();
const storage: ObjectStorage = {
  name: 'mem',
  async put(key, content, mimeType) { mem.set(key, { content, mimeType }); },
  async get(key) { return mem.get(key) ?? null; },
};

function svixSign(secret: string, id: string, ts: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'resend@example.com', 'Resend-tester');
  const org = await createOrganization(db, {
    name: 'Resend AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004', createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

describe('verifyResendSignature', () => {
  const secret = 'whsec_' + Buffer.from('supersecretsigningkey').toString('base64');
  it('godtar en gyldig signatur og avviser tukling', () => {
    const id = 'msg_1'; const ts = '1710000000'; const body = '{"type":"email.received"}';
    const sig = svixSign(secret, id, ts, body);
    expect(verifyResendSignature(secret, { id, timestamp: ts, signature: sig }, body)).toBe(true);
    expect(verifyResendSignature(secret, { id, timestamp: ts, signature: sig }, body + 'x')).toBe(false);
    expect(verifyResendSignature(secret, { id, timestamp: ts, signature: 'v1,feil' }, body)).toBe(false);
    expect(verifyResendSignature(undefined, { id, timestamp: ts, signature: sig }, body)).toBe(false);
  });
});

describe('ingestResendEmail', () => {
  it('henter vedlegg via Resend-API og lagrer PDF som forward-bilag', async () => {
    const addr = inboundEmailFor(orgId, 'inbound.test');
    const pdf = Buffer.from('%PDF-1.4 resend-kvittering');
    const fetchImpl = async (url: string) => {
      if (url.endsWith('/attachments')) {
        return { ok: true, status: 200, json: async () => ({ data: [{ filename: 'kvittering.pdf', content_type: 'application/pdf', download_url: 'https://dl.resend/att1' }] }), arrayBuffer: async () => new ArrayBuffer(0) };
      }
      // download_url
      return { ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) };
    };

    const result = await ingestResendEmail(
      db, storage,
      { apiKey: 're_test', fetchImpl } as Parameters<typeof ingestResendEmail>[2],
      { type: 'email.received', data: { email_id: 'em_1', received_for: [addr], to: ['annet@x.no'] } },
    );
    expect(result.organizationId).toBe(orgId);
    expect(result.ingested).toBe(1);
    const rows = await db.query(`SELECT source FROM source_documents WHERE organization_id = $1 AND source = 'forward'`, [orgId]);
    expect(rows.rowCount).toBe(1);
  });
});
