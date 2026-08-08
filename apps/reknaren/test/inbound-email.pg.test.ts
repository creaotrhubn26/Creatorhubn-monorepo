/**
 * Inn-e-post-ruting: virksomhetens avledede bilag-adresse løses tilbake til org,
 * og videresendte vedlegg lagres som `forward`-bilag. Ukjent mottaker rutes ikke.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import type { ObjectStorage, StoredObject } from '../src/storage/port.js';
import {
  inboundEmailFor,
  ingestForwardedEmail,
  parseInboundAlias,
  resolveOrgIdByInbound,
} from '../src/ingestion/inbound-email.js';
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
  userId = await ensureUser(db, 'inn@example.com', 'Inn-tester');
  const org = await createOrganization(db, {
    name: 'Innboks AS',
    orgForm: 'AS',
    vatStatus: 'registered',
    orgNumber: '910000004',
    createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

describe('inbound-email ruting', () => {
  it('adressen er avledet av org-id og parses tilbake', () => {
    const addr = inboundEmailFor(orgId, 'inbound.test');
    expect(addr).toBe(`bilag.${orgId.replace(/-/g, '').slice(0, 8)}@inbound.test`);
    expect(parseInboundAlias(`Innboks AS <${addr}>`)).toBe(orgId.replace(/-/g, '').slice(0, 8));
    expect(parseInboundAlias('noreply@example.com')).toBeNull();
  });

  it('løser rett org, og ukjent adresse gir null', async () => {
    const addr = inboundEmailFor(orgId, 'inbound.test');
    expect(await resolveOrgIdByInbound(db, addr)).toBe(orgId);
    expect(await resolveOrgIdByInbound(db, 'bilag.00000000@inbound.test')).toBeNull();
  });

  it('lagrer et videresendt PDF-vedlegg som forward-bilag; ukjent mime hoppes over', async () => {
    const addr = inboundEmailFor(orgId, 'inbound.test');
    const result = await ingestForwardedEmail(db, storage, {
      recipient: `Regnskap <${addr}>`,
      attachments: [
        { filename: 'kvittering.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-1.4 kvittering') },
        { filename: 'signatur.txt', mimeType: 'text/plain', content: Buffer.from('hei') },
      ],
    });
    expect(result.organizationId).toBe(orgId);
    expect(result.ingested).toBe(1);
    expect(result.skipped).toBe(1);
    const rows = await db.query(
      `SELECT source FROM source_documents WHERE organization_id = $1 AND source = 'forward'`,
      [orgId],
    );
    expect(rows.rowCount).toBe(1);
  });

  it('ukjent mottaker rutes ikke (kaster)', async () => {
    await expect(
      ingestForwardedEmail(db, storage, {
        recipient: 'bilag.00000000@inbound.test',
        attachments: [{ filename: 'x.pdf', mimeType: 'application/pdf', content: Buffer.from('x') }],
      }),
    ).rejects.toThrow(/Ingen virksomhet/);
  });
});
