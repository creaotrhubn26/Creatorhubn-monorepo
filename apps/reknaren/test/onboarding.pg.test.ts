/**
 * Aktiverings-status utledes fra ekte data (ingen lagret flagg): en fersk org er
 * «ikke i gang», og hvert utført steg slår om sitt eget flagg. MVA-steget er kun
 * relevant for MVA-registrerte.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount } from '../src/bank/import.js';
import { getActivationStatus } from '../src/ledger/onboarding.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });
const OPTS = { inboundDomain: 'inbound.test', inboundActive: false };

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'onb@example.com', 'Onboarder');
});

afterAll(async () => {
  await db.end();
});

describe('getActivationStatus', () => {
  it('fersk org uten org.nr (ikke MVA-registrert) er ikke i gang', async () => {
    const org = await createOrganization(db, {
      name: 'Fersk ENK',
      orgForm: 'ENK',
      vatStatus: 'not_registered',
      createdByUserId: userId,
    });
    const s = await getActivationStatus(db, org.id, OPTS);
    expect(s.orgReady).toBe(false);
    expect(s.hasBank).toBe(false);
    expect(s.hasDocument).toBe(false);
    expect(s.hasEmailDocument).toBe(false);
    expect(s.hasPostedEntry).toBe(false);
    expect(s.mvaRelevant).toBe(false);
    expect(s.mvaReady).toBe(false);
    expect(s.complete).toBe(false);
    expect(s.inboundActive).toBe(false);
    expect(s.inboundEmail).toMatch(/^bilag\.[0-9a-f]{8}@inbound\.test$/);
  });

  it('MVA-registrert org: MVA-steget er relevant og blokkerer complete til ID-porten er koblet', async () => {
    const org = await createOrganization(db, {
      name: 'Delvis AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      orgNumber: '910000004',
      createdByUserId: userId,
    });
    let s = await getActivationStatus(db, org.id, OPTS);
    expect(s.orgReady).toBe(true);
    expect(s.mvaRelevant).toBe(true);
    expect(s.mvaReady).toBe(false);
    expect(s.complete).toBe(false);

    await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    s = await getActivationStatus(db, org.id, OPTS);
    expect(s.hasBank).toBe(true);
    expect(s.hasDocument).toBe(false);
    expect(s.complete).toBe(false); // fortsatt bilag/bokføring/MVA igjen
  });
});
