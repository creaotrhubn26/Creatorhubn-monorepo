/**
 * SendGrid Inbound Parse: mottaker-uttrekk (envelope/to) + ruting av vedlegg til
 * rett virksomhet som forward-bilag.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import type { ObjectStorage, StoredObject } from '../src/storage/port.js';
import { inboundEmailFor } from '../src/ingestion/inbound-email.js';
import { ingestSendgridEmail, sendgridRecipient } from '../src/ingestion/sendgrid-inbound.js';
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

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'sg@example.com', 'SendGrid-tester');
  const org = await createOrganization(db, {
    name: 'SendGrid AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004', createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

describe('sendgridRecipient', () => {
  it('foretrekker envelope.to, faller tilbake til to-feltet', () => {
    expect(sendgridRecipient({ envelope: JSON.stringify({ to: ['a@b.no'], from: 'x@y.no' }), to: 'C <c@d.no>' })).toBe('a@b.no');
    expect(sendgridRecipient({ to: 'C <c@d.no>' })).toBe('C <c@d.no>');
    expect(sendgridRecipient({})).toBeNull();
  });
});

describe('ingestSendgridEmail', () => {
  it('ruter vedlegget til rett virksomhet som forward-bilag', async () => {
    const addr = inboundEmailFor(orgId, 'inbound.test');
    const result = await ingestSendgridEmail(db, storage, {
      fields: { envelope: JSON.stringify({ to: [addr], from: 'leverandor@x.no' }), subject: 'Kvittering' },
      files: [
        { field: 'attachment1', filename: 'kvittering.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-1.4 sg') },
        { field: 'attachment2', filename: 'logo.gif', mimeType: 'image/gif', content: Buffer.from('gif') },
      ],
    });
    expect(result.organizationId).toBe(orgId);
    expect(result.ingested).toBe(1); // kun PDF; gif er ikke bilag-MIME
    const rows = await db.query(`SELECT source FROM source_documents WHERE organization_id = $1 AND source = 'forward'`, [orgId]);
    expect(rows.rowCount).toBe(1);
  });
});
