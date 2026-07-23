/**
 * Faktura-PDF + utsending mot ekte Postgres:
 *  - GET …/invoices/:id/pdf gir en gyldig PDF (kun utstedte dokumenter)
 *  - POST …/invoices/:id/send legger faktura-PDF som vedlegg og sender til kunden
 *  - ærlig status: 503 uten e-postsender, 400 når mottaker mangler
 *  - utsending auditlogges
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { StaticVatRegisterStub } from '../src/integrations/brreg.js';
import { InMemoryEmailStub } from '../src/integrations/email.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
const rules = buildNorwegianRuleRegister();
const email = new InMemoryEmailStub({ configured: true });
let app: ReturnType<typeof createApiServer>;
let appNoEmail: ReturnType<typeof createApiServer>;
let token: string;
let orgId: string;
let invoiceId: string;
let customerNoEmailId: string;

const ORG_NUMBER = '910023764';

async function issueInvoiceFor(customerId: string): Promise<string> {
  const draft = await request(app)
    .post(`/api/organizations/${orgId}/invoices`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId,
      invoiceDate: '2025-12-01',
      dueDate: '2025-12-15',
      lines: [{ description: 'Rådgivning desember', quantityThousandths: 2500n.toString(), unitPriceMinor: 200000n.toString(), vatCode: '3' }],
    })
    .expect(201);
  await request(app)
    .post(`/api/organizations/${orgId}/invoices/${draft.body.id}/issue`)
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(201);
  return draft.body.id;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  const vatRegister = new StaticVatRegisterStub({
    [ORG_NUMBER]: { found: true, name: 'SENDETEST AS', registeredInVatRegister: true },
  });
  app = createApiServer({ db, rules, vatRegister, email });
  appNoEmail = createApiServer({ db, rules, vatRegister });

  const login = await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'send@example.com', displayName: 'Sendetester' })
    .expect(200);
  token = login.body.token;

  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Sendetest AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      orgNumber: ORG_NUMBER,
      streetAddress: 'Fakturagata 2',
      postalCode: '0155',
      city: 'Oslo',
    })
    .expect(201);
  orgId = org.body.id;

  const customer = await request(app)
    .post(`/api/organizations/${orgId}/customers`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Mottaker AS', orgNumber: '923609016', email: 'mottaker@example.com' })
    .expect(201);
  invoiceId = await issueInvoiceFor(customer.body.id);

  const noEmail = await request(app)
    .post(`/api/organizations/${orgId}/customers`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Uten e-post AS', orgNumber: '910031678' })
    .expect(201);
  customerNoEmailId = noEmail.body.id;
});

afterAll(async () => {
  await db.end();
});

describe('Faktura-PDF', () => {
  it('gir en gyldig PDF for utstedt faktura', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('Faktura-1.pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.toString('latin1')).toContain('%%EOF');
  });
});

describe('Faktura-utsending', () => {
  it('sender faktura til kundens e-post med PDF-vedlegg + auditlogg', async () => {
    const before = email.sent.length;
    const res = await request(app)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body).toMatchObject({ sent: true, to: 'mottaker@example.com', invoiceNumber: '1' });
    expect(email.sent.length).toBe(before + 1);
    const msg = email.sent[email.sent.length - 1]!;
    expect(msg.to).toBe('mottaker@example.com');
    expect(msg.subject).toContain('Faktura 1 fra Sendetest AS');
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments![0]!.contentType).toBe('application/pdf');
    expect(msg.attachments![0]!.content.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const audit = await db.query(
      `SELECT COUNT(*)::int AS n FROM audit_events WHERE action = 'invoice.sent' AND entity_id = $1`,
      [invoiceId],
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('lar avsender overstyre mottaker med «to»', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'regnskap@example.com' })
      .expect(200);
    expect(res.body.to).toBe('regnskap@example.com');
    expect(email.sent[email.sent.length - 1]!.to).toBe('regnskap@example.com');
  });

  it('svarer 400 når kunden mangler e-post og «to» ikke er oppgitt', async () => {
    const inv = await issueInvoiceFor(customerNoEmailId);
    const res = await request(app)
      .post(`/api/organizations/${orgId}/invoices/${inv}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('CUSTOMER_EMAIL_MISSING');
  });

  it('svarer 503 når e-postsender ikke er konfigurert', async () => {
    const res = await request(appNoEmail)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);
    expect(res.body.error.code).toBe('INTEGRATION_UNAVAILABLE');
  });
});

describe('EHF / PEPPOL', () => {
  it('genererer nedlastbar EHF-XML (BIS 3.0) for utstedt faktura', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/invoices/${invoiceId}/ehf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.headers['content-disposition']).toContain('EHF-1.xml');
    expect(res.text).toContain('urn:fdc:peppol.eu:2017:poacc:billing:3.0');
    expect(res.text).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(res.text).toContain('<cbc:EndpointID schemeID="0192">923609016</cbc:EndpointID>'); // mottaker
    expect(res.text).toContain('<cbc:PayableAmount currencyID="NOK">6250.00</cbc:PayableAmount>');
  });

  it('svarer 503 på EHF-sending uten konfigurert aksesspunkt', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/invoices/${invoiceId}/ehf/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);
    expect(res.body.error.code).toBe('INTEGRATION_UNAVAILABLE');
  });
});

describe('MVA-melding', () => {
  it('genererer nedlastbar MVA-melding-XML i Skatteetatens format (alltid tilgjengelig)', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/vat/mva-melding/xml?from=2025-01-01&to=2026-12-31`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('mvaMeldingDto');
    expect(res.text).toContain('<mvaLinjer>');
  });

  it('validering/innsending svarer 503 uten aktivert Maskinporten', async () => {
    const v = await request(app)
      .post(`/api/organizations/${orgId}/vat/mva-melding/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-01-01', to: '2026-12-31' })
      .expect(503);
    expect(v.body.error.code).toBe('INTEGRATION_UNAVAILABLE');
    await request(app)
      .post(`/api/organizations/${orgId}/vat/mva-melding/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-01-01', to: '2026-12-31' })
      .expect(503);
  });
});
