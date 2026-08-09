/**
 * Org-eksponering: rentebærende gjeld (hovedbok) + NACE-bransjekode (Brreg).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticCompanyRegistryStub } from '../src/integrations/company-registry.js';
import { getOrgExposure } from '../src/market/exposure.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
});
afterAll(async () => {
  await db.end();
});

describe('getOrgExposure', () => {
  it('summerer rentebærende gjeld og henter NACE', async () => {
    const userId = await ensureUser(db, 'exp@x.no', 'Eksp');
    const org = await createOrganization(db, {
      name: 'Eksp AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      orgNumber: '910000004',
      createdByUserId: userId,
    });
    // 2240 (gjeld til kredittinstitusjoner) er ikke i standard kontoplan — legg til for testen.
    await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,'2240','Gjeld til kredittinstitusjoner','liability')`,
      [newId(), org.id],
    );
    // Bokfør: bank 300 000 debet, banklån (2240) 300 000 kredit
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: { userId, role: 'owner' },
      entryDate: '2026-08-01',
      description: 'Låneopptak',
      idempotencyKey: 'exposure-test:laan-1',
      lines: [
        { accountNumber: '1920', debitMinor: 30000000n, creditMinor: 0n },
        { accountNumber: '2240', debitMinor: 0n, creditMinor: 30000000n },
      ],
    });
    const registry = new StaticCompanyRegistryStub({
      '910000004': { found: true, orgNumber: '910000004', naceCode: '62.010' },
    });
    const exp = await getOrgExposure(db, registry, org.id);
    expect(exp.interestBearingDebtMinor).toBe(30000000n);
    expect(exp.naceCode).toBe('62.010');
  });
});
