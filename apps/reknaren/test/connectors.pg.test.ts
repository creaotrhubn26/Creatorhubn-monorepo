/**
 * Inngående data-connectors mot ekte Postgres: Stripe-charges-adapteren fører
 * enkeltbetalinger inn som bilag i innboksen — idempotent på ekstern id — og
 * er ærlig inaktiv uten nøkkel. Bokfører aldri.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticStripeStub, type StripeChargeRecord } from '../src/integrations/stripe.js';
import { buildConnectorRegistry } from '../src/integrations/connectors/registry.js';
import {
  connectConnector,
  disconnectConnector,
  listConnectorStatus,
  syncConnector,
  type ConnectorDeps,
} from '../src/integrations/connectors/sync.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

const CHARGES: StripeChargeRecord[] = [
  { id: 'ch_1', amountMinor: 50000n, currency: 'NOK', date: '2026-03-01', description: 'Nettbutikk-kjøp', customerName: 'Kari Nordmann', customerEmail: 'kari@example.no', receiptUrl: 'https://stripe/r/1' },
  { id: 'ch_2', amountMinor: 120000n, currency: 'NOK', date: '2026-03-05', description: 'Kurs', customerName: null, customerEmail: 'ola@example.no', receiptUrl: null },
];

function depsWith(charges: StripeChargeRecord[], hasApiKey = true): ConnectorDeps {
  const stripe = new StaticStripeStub([], { hasApiKey, charges });
  return { db, registry: buildConnectorRegistry({ stripe }) };
}

async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'conn@example.com', 'Connector');
});
afterAll(async () => {
  await db.end();
});

describe('data-connectors', () => {
  it('status: konfigurert når nøkkel finnes, ærlig inaktiv uten', async () => {
    const org = await newOrg('Status AS');
    const withKey = await listConnectorStatus(depsWith(CHARGES, true), org.id);
    expect(withKey.find((c) => c.id === 'stripe-charges')?.configured).toBe(true);
    const withoutKey = await listConnectorStatus(depsWith(CHARGES, false), org.id);
    expect(withoutKey.find((c) => c.id === 'stripe-charges')?.configured).toBe(false);
    expect(withKey.find((c) => c.id === 'stripe-charges')?.connected).toBe(false); // ikke koblet ennå
  });

  it('sync fører charges inn som bilag (kilde integration) og er idempotent', async () => {
    const org = await newOrg('Synk AS');
    const deps = depsWith(CHARGES);
    await connectConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    const r1 = await syncConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    expect(r1.imported).toBe(2);
    expect(r1.skipped).toBe(0);

    // To bilag opprettet, kilde 'integration', med uttrekk (beløp/valuta/leverandør).
    const docs = (await db.query(`SELECT id, source, status FROM source_documents WHERE organization_id = $1`, [org.id])).rows;
    expect(docs.length).toBe(2);
    expect(docs.every((d) => d.source === 'integration')).toBe(true);
    const ext = (await db.query(`SELECT gross_minor, currency, vendor_name FROM extracted_document_data WHERE organization_id = $1 ORDER BY gross_minor`, [org.id])).rows;
    expect(ext.map((e) => e.gross_minor)).toEqual(['50000', '120000']);
    expect(ext[0].vendor_name).toBe('Kari Nordmann');

    // 🔒 Ingenting er bokført — connectoren lager kun bilag.
    const entries = (await db.query(`SELECT count(*)::int AS n FROM journal_entries WHERE organization_id = $1`, [org.id])).rows[0];
    expect(entries.n).toBe(0);

    // Re-sync med samme charges → alt hoppes over (idempotent på ekstern id).
    const r2 = await syncConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    expect(r2.imported).toBe(0);
    expect(r2.skipped).toBe(2);
    const docs2 = (await db.query(`SELECT count(*)::int AS n FROM source_documents WHERE organization_id = $1`, [org.id])).rows[0];
    expect(docs2.n).toBe(2); // fortsatt bare 2
  });

  it('ny charge ved neste synk importeres, gamle hoppes over', async () => {
    const org = await newOrg('Ny charge AS');
    const deps1 = depsWith([CHARGES[0]!]);
    await connectConnector(deps1, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    expect((await syncConnector(deps1, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' })).imported).toBe(1);
    // Ny charge dukker opp; connectoren har begge, men bare den nye importeres.
    const deps2 = depsWith(CHARGES);
    deps2.registry = buildConnectorRegistry({ stripe: new StaticStripeStub([], { hasApiKey: true, charges: CHARGES }) });
    const r = await syncConnector({ ...deps1, registry: deps2.registry }, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it('sync uten påkobling feiler; disconnect stopper', async () => {
    const org = await newOrg('Ukoblet AS');
    const deps = depsWith(CHARGES);
    await expect(syncConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' })).rejects.toThrow();
    await connectConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    await disconnectConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    await expect(syncConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' })).rejects.toThrow();
  });

  it('sync uten nøkkel er ærlig avvist', async () => {
    const org = await newOrg('Uten nøkkel AS');
    const deps = depsWith(CHARGES, false);
    await connectConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' });
    await expect(syncConnector(deps, { organizationId: org.id, actor: actor(), connectorId: 'stripe-charges' })).rejects.toThrow();
  });
});
