/**
 * Avtaler / inntektsplaner: fakturaplan, avtalt vs. fakturert (tapt inntekt),
 * kontroll av at avtalen er fakturert, og oppsigelsesfrist-varsel.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createAgreement, reviewAgreements } from '../src/invoicing/agreements.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const ASOF = '2025-06-15';
const actor = () => ({ userId, role: 'owner' });

async function customer(orgId: string, name: string): Promise<string> {
  const id = newId();
  await db.query(`INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,$3,$4)`, [id, orgId, name, userId]);
  return id;
}
async function invoice(orgId: string, custId: string, num: number, date: string, grossMinor: bigint) {
  await db.query(
    `INSERT INTO invoices (id, organization_id, customer_id, invoice_number, invoice_date, gross_minor, paid_minor, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,0,'issued',$7)`,
    [newId(), orgId, custId, num, date, grossMinor.toString(), userId],
  );
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'avtale@example.com', 'Avtaletester');
});

afterAll(async () => {
  await db.end();
});

describe('avtaler', () => {
  it('månedsavtale uten fakturaer → «ikke fakturert», tapt inntekt + fakturaplan', async () => {
    const org = await createOrganization(db, { name: 'Avtale AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const cust = await customer(org.id, 'Storkunde AS');
    await createAgreement(db, {
      organizationId: org.id, actor: actor(), customerId: cust, name: 'Månedlig drift',
      amountMinor: 1000000n, cadence: 'monthly', startDate: '2025-01-01', endDate: '2025-12-31', noticeMonths: 3,
    });

    const r = await reviewAgreements(db, { organizationId: org.id, asOf: ASOF });
    expect(r.reviews).toHaveLength(1);
    const rev = r.reviews[0]!;
    expect(rev.periodsDue).toBe(6); // jan–jun
    expect(rev.expectedInvoicedMinor).toBe(6000000n);
    expect(rev.actualInvoicedMinor).toBe(0n);
    expect(rev.gapMinor).toBe(6000000n); // hele beløpet er tapt/ufakturert
    expect(rev.flags).toContain('ikke_fakturert');
    expect(rev.nextInvoiceDates).toContain('2025-07-01'); // fakturaplan framover
    expect(r.totalGapMinor).toBe(6000000n);
  });

  it('med noen fakturaer → underfakturert med redusert gap', async () => {
    const org = await createOrganization(db, { name: 'Delvis AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const cust = await customer(org.id, 'Delkunde AS');
    await createAgreement(db, {
      organizationId: org.id, actor: actor(), customerId: cust, name: 'Månedlig',
      amountMinor: 1000000n, cadence: 'monthly', startDate: '2025-01-01', noticeMonths: 0,
    });
    // Fakturert tre av seks måneder.
    await invoice(org.id, cust, 1, '2025-01-15', 1000000n);
    await invoice(org.id, cust, 2, '2025-02-15', 1000000n);
    await invoice(org.id, cust, 3, '2025-03-15', 1000000n);

    const rev = (await reviewAgreements(db, { organizationId: org.id, asOf: ASOF })).reviews[0]!;
    expect(rev.actualInvoicedMinor).toBe(3000000n);
    expect(rev.gapMinor).toBe(3000000n); // tre måneder mangler
    expect(rev.flags).toContain('underfakturert');
    expect(rev.flags).not.toContain('ikke_fakturert');
  });

  it('varsler før oppsigelsesfristen', async () => {
    const org = await createOrganization(db, { name: 'Frist AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const cust = await customer(org.id, 'Fristkunde AS');
    // Slutt 31.08, 3 mnd frist → oppsigelsesfrist 31.05. Fra 15.06 er den innen to måneder? Nei — test fra 15.05.
    await createAgreement(db, {
      organizationId: org.id, actor: actor(), customerId: cust, name: 'Årsavtale',
      amountMinor: 5000000n, cadence: 'yearly', startDate: '2024-09-01', endDate: '2025-08-31', noticeMonths: 3,
    });
    const rev = (await reviewAgreements(db, { organizationId: org.id, asOf: '2025-05-15' })).reviews[0]!;
    expect(rev.noticeDeadline).toBe('2025-05-31');
    expect(rev.flags).toContain('oppsigelse_naer');
    // Årsavtale over 12 000 kr → periodiseringsflagg.
    expect(rev.flags).toContain('bor_periodiseres');
  });
});
