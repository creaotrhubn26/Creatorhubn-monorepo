/**
 * Åpent integrasjonslag mot ekte Postgres: API-nøkler (scopet, tilbakekallbar,
 * hashet), webhooks (signert leveranse, retry, leveranselogg) og hendelses-
 * produksjon.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createApiKey, listApiKeys, resolveApiKey, revokeApiKey } from '../src/integrations/api-keys.js';
import {
  createWebhook,
  deleteWebhook,
  deliverPending,
  emitEvent,
  listDeliveries,
  listWebhooks,
  signPayload,
  verifySignature,
} from '../src/integrations/webhooks.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });
async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'integ@example.com', 'Integrasjon');
});
afterAll(async () => {
  await db.end();
});

describe('API-nøkler', () => {
  it('opprettes med scope, vises kun én gang, hashes, og resolver til org+scopes', async () => {
    const org = await newOrg('Nøkkel AS');
    const { apiKey, secret } = await createApiKey(db, { organizationId: org.id, actor: actor(), name: 'Regnskapsintegrasjon', scopes: ['reports.view', 'invoices.view'] });
    expect(secret).toMatch(/^rk_live_[0-9a-f]{64}$/);
    expect(apiKey.keyPrefix.startsWith('rk_live_')).toBe(true);
    // Full nøkkel lagres ALDRI i klartekst.
    const raw = await db.query(`SELECT key_hash FROM api_keys WHERE id = $1`, [apiKey.id]);
    expect(raw.rows[0].key_hash).not.toContain(secret);
    // Resolve gir org + scopes.
    const resolved = await resolveApiKey(db, secret);
    expect(resolved?.organizationId).toBe(org.id);
    expect(resolved?.scopes).toEqual(['reports.view', 'invoices.view']);
  });

  it('avviser ukjent scope og tom scope-liste', async () => {
    const org = await newOrg('Scope AS');
    await expect(createApiKey(db, { organizationId: org.id, actor: actor(), name: 'X', scopes: ['ikke.en.scope'] })).rejects.toThrow();
    await expect(createApiKey(db, { organizationId: org.id, actor: actor(), name: 'X', scopes: [] })).rejects.toThrow();
  });

  it('tilbakekalt nøkkel resolver ikke lenger', async () => {
    const org = await newOrg('Revoke AS');
    const { apiKey, secret } = await createApiKey(db, { organizationId: org.id, actor: actor(), name: 'Midlertidig', scopes: ['reports.view'] });
    expect(await resolveApiKey(db, secret)).not.toBeNull();
    await revokeApiKey(db, { organizationId: org.id, actor: actor(), keyId: apiKey.id });
    expect(await resolveApiKey(db, secret)).toBeNull();
    const keys = await listApiKeys(db, org.id);
    expect(keys.find((k) => k.id === apiKey.id)?.revokedAt).toBeTruthy();
  });

  it('ugyldig nøkkel resolver til null', async () => {
    expect(await resolveApiKey(db, 'rk_live_deadbeef')).toBeNull();
    expect(await resolveApiKey(db, 'ikke-en-nøkkel')).toBeNull();
  });
});

describe('webhooks: signatur', () => {
  it('signPayload + verifySignature er konsistente og avviser tukling', () => {
    const sig = signPayload('whsec_test', '{"a":1}');
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(verifySignature('whsec_test', '{"a":1}', sig)).toBe(true);
    expect(verifySignature('whsec_test', '{"a":2}', sig)).toBe(false);
    expect(verifySignature('feil-secret', '{"a":1}', sig)).toBe(false);
  });
});

describe('webhooks: registrering + hendelser + levering', () => {
  it('krever https', async () => {
    const org = await newOrg('Http AS');
    await expect(createWebhook(db, { organizationId: org.id, actor: actor(), url: 'http://usikker.no/hook', events: ['invoice.issued'] })).rejects.toThrow();
    await expect(createWebhook(db, { organizationId: org.id, actor: actor(), url: 'https://ok.no/h', events: ['ukjent.event'] })).rejects.toThrow();
  });

  it('emit legger pending leveranse kun for abonnenter på hendelsen', async () => {
    const org = await newOrg('Emit AS');
    await createWebhook(db, { organizationId: org.id, actor: actor(), url: 'https://a.example/h', events: ['invoice.issued'] });
    await createWebhook(db, { organizationId: org.id, actor: actor(), url: 'https://b.example/h', events: ['journal_entry.posted'] });
    const n = await emitEvent(db, { organizationId: org.id, event: 'invoice.issued', data: { invoiceId: 'x' } });
    expect(n).toBe(1); // kun A abonnerer
    const deliveries = await listDeliveries(db, org.id);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe('pending');
  });

  it('levering signerer og markerer delivered ved 2xx; retry-planlegges ved feil', async () => {
    const org = await newOrg('Lever AS');
    const { webhook, secret } = await createWebhook(db, { organizationId: org.id, actor: actor(), url: 'https://ok.example/hook', events: ['saft.exported'] });
    await emitEvent(db, { organizationId: org.id, event: 'saft.exported', data: { from: '2026-01-01', to: '2026-12-31' } });

    // Fake fetch som verifiserer signatur og svarer 200.
    let seenSig = '';
    let seenBody = '';
    const okFetch = async (_url: string, init: { headers: Record<string, string>; body: string }) => {
      seenSig = init.headers['x-reknaren-signature'] ?? '';
      seenBody = init.body;
      return { status: 200, text: async () => 'ok' };
    };
    // deliverPending er global (cron-drenering); vi verifiserer DENNE org-ens
    // leveranse, ikke aggregerte tall på tvers av testene.
    const r1 = await deliverPending(db, { fetchImpl: okFetch });
    expect(r1.delivered).toBeGreaterThanOrEqual(1);
    expect(verifySignature(secret, seenBody, seenSig)).toBe(true);
    expect(JSON.parse(seenBody).event).toBe('saft.exported');
    const afterOk = await listDeliveries(db, org.id);
    expect(afterOk[0]!.status).toBe('delivered');

    // Ny hendelse, endepunkt svarer 500 → forblir pending (retry), attempts øker.
    await emitEvent(db, { organizationId: org.id, event: 'saft.exported', data: { n: 2 } });
    const failFetch = async () => ({ status: 500, text: async () => 'boom' });
    await deliverPending(db, { fetchImpl: failFetch });
    const pend = (await listDeliveries(db, org.id)).find((d) => d.attempts === 1 && d.status !== 'delivered');
    expect(pend).toBeDefined();
    expect(pend!.responseStatus).toBe(500);

    await deleteWebhook(db, { organizationId: org.id, actor: actor(), webhookId: webhook.id });
    expect((await listWebhooks(db, org.id)).length).toBe(0);
  });
});
