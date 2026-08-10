/**
 * Næringsspesifikasjon-utkast mot ekte Postgres: mapper kontoer til standard
 * resultat-/balanseposter og kontrollerer at balansen går opp.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { buildNaeringsspesifikasjon } from '../src/tax/naeringsspesifikasjon.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const YEAR = 2025;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'naering@example.com', 'Næringstester');
});

afterAll(async () => {
  await db.end();
});

describe('buildNaeringsspesifikasjon', () => {
  it('mapper resultat + balanse og balansen går opp', async () => {
    const org = await createOrganization(db, {
      name: 'Spesifikasjon AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    // Aksjekapital 30 000 kr inn på bank.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: `${YEAR}-01-02`,
      description: 'Aksjekapital',
      lines: [
        { accountNumber: '1920', debitMinor: 3000000n },
        { accountNumber: '2000', creditMinor: 3000000n },
      ],
      idempotencyKey: 'ak:1',
    });
    // Salg 10 000 kr.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: `${YEAR}-06-01`,
      description: 'Salg',
      lines: [
        { accountNumber: '1920', debitMinor: 1000000n },
        { accountNumber: '3000', creditMinor: 1000000n, vatCode: '3' },
      ],
      idempotencyKey: 'salg:1',
    });
    // Kostnad 4 000 kr betalt fra bank.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: `${YEAR}-06-02`,
      description: 'Kontorrekvisita',
      lines: [
        { accountNumber: '6800', debitMinor: 400000n, vatCode: '1' },
        { accountNumber: '1920', creditMinor: 400000n },
      ],
      idempotencyKey: 'kost:1',
    });

    const spec = await buildNaeringsspesifikasjon(db, { organizationId: org.id, year: YEAR });

    expect(spec.resultat.driftsinntekter.sumMinor).toBe(1000000n);
    expect(spec.resultat.driftskostnader.sumMinor).toBe(400000n);
    expect(spec.resultat.driftsresultatMinor).toBe(600000n);
    expect(spec.resultat.aarsresultatMinor).toBe(600000n);

    // Eiendeler: 3 000 000 + 1 000 000 − 400 000 = 3 600 000 (alt på bank = omløpsmiddel).
    expect(spec.balanse.sumEiendelerMinor).toBe(3600000n);
    expect(spec.balanse.omlopsmidler.sumMinor).toBe(3600000n);
    expect(spec.balanse.egenkapital.sumMinor).toBe(3000000n); // aksjekapital
    expect(spec.balanse.aarsresultatTilEgenkapitalMinor).toBe(600000n);
    // Balansen går opp: 3 000 000 EK + 600 000 årsresultat = 3 600 000.
    expect(spec.balanse.sumEgenkapitalOgGjeldMinor).toBe(3600000n);
    expect(spec.balanse.balanserer).toBe(true);
    expect(spec.balanse.differanseMinor).toBe(0n);
  });

  it('skiller finansposter og skattekostnad fra driften', async () => {
    const org = await createOrganization(db, {
      name: 'Finans AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    const post = (key: string, date: string, lines: Parameters<typeof postJournalEntry>[1]['lines']) =>
      postJournalEntry(db, { organizationId: org.id, actor: actor(), entryDate: date, description: key, lines, idempotencyKey: key });
    await post('f-ak', `${YEAR}-01-02`, [
      { accountNumber: '1920', debitMinor: 3000000n },
      { accountNumber: '2000', creditMinor: 3000000n },
    ]);
    await post('f-salg', `${YEAR}-06-01`, [
      { accountNumber: '1920', debitMinor: 1000000n },
      { accountNumber: '3000', creditMinor: 1000000n, vatCode: '3' },
    ]);
    await post('f-renteinnt', `${YEAR}-06-02`, [
      { accountNumber: '1920', debitMinor: 5000n },
      { accountNumber: '8050', creditMinor: 5000n },
    ]);
    await post('f-rentekost', `${YEAR}-06-03`, [
      { accountNumber: '8150', debitMinor: 2000n },
      { accountNumber: '1920', creditMinor: 2000n },
    ]);
    await post('f-skatt', `${YEAR}-12-31`, [
      { accountNumber: '8300', debitMinor: 100000n },
      { accountNumber: '2500', creditMinor: 100000n },
    ]);

    const spec = await buildNaeringsspesifikasjon(db, { organizationId: org.id, year: YEAR });
    expect(spec.resultat.driftsinntekter.sumMinor).toBe(1000000n);
    expect(spec.resultat.finansinntekter.sumMinor).toBe(5000n);
    expect(spec.resultat.finanskostnader.sumMinor).toBe(2000n);
    expect(spec.resultat.skattekostnadMinor).toBe(100000n);
    expect(spec.resultat.ordinaertResultatForSkattMinor).toBe(1003000n);
    expect(spec.resultat.aarsresultatMinor).toBe(903000n); // 1 003 000 − 100 000 skatt
    // Betalbar skatt havner i kortsiktig gjeld, ikke i driften.
    expect(spec.balanse.kortsiktigGjeld.sumMinor).toBe(100000n);
    expect(spec.balanse.balanserer).toBe(true);
  });
});
