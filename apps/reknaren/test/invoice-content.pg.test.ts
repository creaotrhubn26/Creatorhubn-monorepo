/**
 * Fakturainnholdskravene (bokføringsforskriften kap. 5) mot ekte Postgres:
 *  - utstedelse krever komplette selgeropplysninger (org.nr. + adresse)
 *  - mva-faktura krever MVA-registrering (mval. § 15-11)
 *  - salgsdokumentet inneholder alle pliktige felter, inkl. «MVA»-suffiks
 *  - kontroll mot MVA-registeret (Brreg) lagres og auditlogges
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { BrregVatRegisterClient, StaticVatRegisterStub } from '../src/integrations/brreg.js';
import { createInvoiceDraft, issueInvoice } from '../src/invoicing/service.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let app: ReturnType<typeof createApiServer>;
let ownerToken: string;
let orgId: string;
let userId: string;
let customerId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

const ORG_NUMBER = '910023764';

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  app = createApiServer({
    db,
    rules,
    vatRegister: new StaticVatRegisterStub({
      [ORG_NUMBER]: { found: true, name: 'INNHOLDSTEST AS', registeredInVatRegister: true },
      '910031678': { found: true, name: 'UREGISTRERT ENK', registeredInVatRegister: false },
      '910039598': { found: true, name: 'AVVIKSTEST AS', registeredInVatRegister: false },
    }),
  });
  const login = await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'innhold@example.com', displayName: 'Innholdstester' })
    .expect(200);
  ownerToken = login.body.token;
  userId = login.body.userId;

  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Innholdstest AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      orgNumber: ORG_NUMBER,
      streetAddress: 'Regnskapsgata 8',
      postalCode: '0155',
      city: 'Oslo',
    })
    .expect(201);
  orgId = org.body.id;

  const customer = await request(app)
    .post(`/api/organizations/${orgId}/customers`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Kjøper & Co AS',
      orgNumber: '923609016',
      streetAddress: 'Kjøpergata 1',
      postalCode: '5011',
      city: 'Bergen',
    })
    .expect(201);
  customerId = customer.body.id;
});

afterAll(async () => {
  await db.end();
});

describe('Håndheving ved utstedelse', () => {
  it('avviser utstedelse når selgeropplysningene er ufullstendige', async () => {
    const bare = await createOrganization(db, {
      name: 'Uten Adresse ENK',
      orgForm: 'ENK',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    const bareCustomer = newId();
    await db.query(
      `INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,'Kunde',$3)`,
      [bareCustomer, bare.id, userId],
    );
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: bare.id,
      actor: actor(),
      customerId: bareCustomer,
      lines: [{ description: 'Tjeneste', quantityThousandths: 1000n, unitPriceMinor: 100000n, vatCode: '3' }],
    });
    await expect(
      issueInvoice(db, rules, { organizationId: bare.id, actor: actor(), invoiceId: draft.id }),
    ).rejects.toThrow(/organisasjonsnummer.*gateadresse.*postnummer/s);
  });

  it('avviser mva-faktura når virksomheten ikke er MVA-registrert', async () => {
    const unregistered = await createOrganization(db, {
      name: 'Uregistrert ENK',
      orgForm: 'ENK',
      vatStatus: 'not_registered',
      orgNumber: '910031678',
      streetAddress: 'Gata 1',
      postalCode: '0182',
      city: 'Oslo',
      createdByUserId: userId,
    });
    const cust = newId();
    await db.query(
      `INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,'Kunde',$3)`,
      [cust, unregistered.id, userId],
    );
    const withVat = await createInvoiceDraft(db, rules, {
      organizationId: unregistered.id,
      actor: actor(),
      customerId: cust,
      lines: [{ description: 'Tjeneste', quantityThousandths: 1000n, unitPriceMinor: 100000n, vatCode: '3' }],
    });
    await expect(
      issueInvoice(db, rules, { organizationId: unregistered.id, actor: actor(), invoiceId: withVat.id }),
    ).rejects.toThrow(/ikke registrert i.*MVA-registeret/s);

    // Uten mva (kode 6, unntatt) er utstedelse lov for uregistrert virksomhet.
    const noVat = await createInvoiceDraft(db, rules, {
      organizationId: unregistered.id,
      actor: actor(),
      customerId: cust,
      lines: [{ description: 'Unntatt tjeneste', quantityThousandths: 1000n, unitPriceMinor: 100000n, vatCode: '6' }],
    });
    const issued = await issueInvoice(db, rules, {
      organizationId: unregistered.id,
      actor: actor(),
      invoiceId: noVat.id,
    });
    expect(issued.invoiceNumber).toBe(1n);
  });
});

describe('Salgsdokumentet (HTML)', () => {
  let invoiceId: string;

  it('kladd er ikke et gyldig salgsdokument', async () => {
    const draft = await request(app)
      .post(`/api/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customerId,
        invoiceDate: '2025-12-01',
        dueDate: '2025-12-15',
        deliveryDate: '2025-11-28',
        deliveryPlace: 'Kundens lokaler, Bergen',
        lines: [
          {
            description: 'Konsulentbistand desember',
            quantityThousandths: '2500',
            unitPriceMinor: '120000',
            vatCode: '3',
          },
          {
            description: 'Undervisning (unntatt mva)',
            quantityThousandths: '1000',
            unitPriceMinor: '500000',
            vatCode: '6',
          },
        ],
      })
      .expect(201);
    invoiceId = draft.body.id;
    await request(app)
      .get(`/api/organizations/${orgId}/invoices/${invoiceId}/document`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('utstedt faktura gjengis med alle pliktige innholdsfelter', async () => {
    await request(app)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const res = await request(app)
      .get(`/api/organizations/${orgId}/invoices/${invoiceId}/document`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    const html = res.text;
    // Selger med adresse og «MVA» bak org.nr. + Foretaksregisteret (AS).
    expect(html).toContain('Innholdstest AS');
    expect(html).toContain('Regnskapsgata 8');
    expect(html).toContain('0155 Oslo');
    expect(html).toContain('Org.nr.: NO 910 023 764 MVA');
    expect(html).toContain('Foretaksregisteret');
    // Kjøper med adresse og org.nr.
    expect(html).toContain('Kjøper &amp; Co AS');
    expect(html).toContain('Kjøpergata 1');
    expect(html).toContain('Org.nr.: 923 609 016');
    // Nummer, datoer, levering, KID.
    expect(html).toMatch(/Fakturanummer<\/td><td>1</);
    expect(html).toContain('2025-12-01');
    expect(html).toContain('Leveringsdato');
    expect(html).toContain('2025-11-28');
    expect(html).toContain('Kundens lokaler, Bergen');
    expect(html).toContain('KID');
    // Linjer og mva per sats: 2,5 t × 1 200 = 3 000 (25 %) + 5 000 unntatt.
    expect(html).toContain('Konsulentbistand desember');
    expect(html).toContain('2,5');
    expect(html).toContain('25 %');
    expect(html).toContain('3 000,00');
    expect(html).toContain('5 000,00');
    expect(html).toContain('750,00'); // mva-beløp
    expect(html).toContain('8 750,00'); // å betale
    expect(html).toContain('fritatt for eller unntatt'); // fotnote for kode 6
    // Gjengivelsen auditlogges.
    const audit = await db.query(
      `SELECT COUNT(*)::INT AS n FROM audit_events
       WHERE organization_id = $1 AND action = 'invoice.document_rendered'`,
      [orgId],
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('kreditnota gjengis med referanse til original', async () => {
    const credit = await request(app)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/credit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Feil i leveransen' })
      .expect(201);
    const list = await request(app)
      .get(`/api/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const creditRow = list.body.find(
      (i: { kind: string }) => i.kind === 'credit_note',
    );
    expect(creditRow).toBeDefined();
    expect(credit.body.creditNoteNumber).toBeDefined();
    const res = await request(app)
      .get(`/api/organizations/${orgId}/invoices/${creditRow.id}/document`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.text).toContain('Kreditnota');
    expect(res.text).toContain('Gjelder faktura');
    expect(res.text).toContain('Til gode');
  });
});

describe('MVA-registerkontroll (Brreg)', () => {
  it('lagrer og rapporterer samsvar med registeret', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/vat-register-check`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.found).toBe(true);
    expect(res.body.registryName).toBe('INNHOLDSTEST AS');
    expect(res.body.registeredInVatRegister).toBe(true);
    expect(res.body.mismatch).toBe(false);

    const org = await db.query(
      `SELECT vat_register_registered, vat_register_checked_at FROM organizations WHERE id = $1`,
      [orgId],
    );
    expect(org.rows[0].vat_register_registered).toBe(true);
    expect(org.rows[0].vat_register_checked_at).not.toBeNull();

    const audit = await db.query(
      `SELECT COUNT(*)::INT AS n FROM audit_events
       WHERE organization_id = $1 AND action = 'organization.vat_register_checked'`,
      [orgId],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it('flagger avvik når lokal status sier registrert men registeret sier nei', async () => {
    await request(app)
      .patch(`/api/organizations/${orgId}/settings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ orgNumber: '910039598' })
      .expect(200);
    const res = await request(app)
      .post(`/api/organizations/${orgId}/vat-register-check`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.registeredInVatRegister).toBe(false);
    expect(res.body.mismatch).toBe(true);
    // Tilbakestill org.nr. for ev. senere tester.
    await request(app)
      .patch(`/api/organizations/${orgId}/settings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ orgNumber: ORG_NUMBER })
      .expect(200);
  });

  it('svarer 422 uten organisasjonsnummer og 503 uten konfigurert integrasjon', async () => {
    const noOrgnr = await createOrganization(db, {
      name: 'Uten Orgnr ENK',
      orgForm: 'ENK',
      vatStatus: 'pending',
      createdByUserId: userId,
    });
    await request(app)
      .post(`/api/organizations/${noOrgnr.id}/vat-register-check`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);

    const bareApp = createApiServer({ db, rules });
    await request(bareApp)
      .post(`/api/organizations/${orgId}/vat-register-check`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(503);
  });
});

describe('BrregVatRegisterClient (enhetstest med injisert fetch)', () => {
  it('tolker funnet enhet, 404 og tjenestefeil', async () => {
    const client = new BrregVatRegisterClient(async (url) => {
      if (url.endsWith('/910023764')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ navn: 'TESTBEDRIFT AS', registrertIMvaregisteret: true }),
        };
      }
      if (url.endsWith('/910031678')) return { status: 404, ok: false, json: async () => ({}) };
      return { status: 503, ok: false, json: async () => ({}) };
    });
    expect(await client.lookup('910023764')).toEqual({
      found: true,
      name: 'TESTBEDRIFT AS',
      registeredInVatRegister: true,
      deleted: false,
    });
    expect(await client.lookup('910031678')).toEqual({ found: false });
    await expect(client.lookup('910039598')).rejects.toThrow(/status 503/);
    await expect(client.lookup('12345')).rejects.toThrow(/9 sifre/);
  });
});
