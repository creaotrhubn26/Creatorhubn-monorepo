/**
 * API-tester mot ekte Postgres: autentisering, RBAC, tenant-isolasjon,
 * vertikal flyt over HTTP, periodelås og korrigering (scenario 9).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { StaticLovdataStub } from '../src/integrations/lovdata.js';
import { MaskinportenClient } from '../src/integrations/maskinporten.js';
import { SkatteetatenVatSubmissionClient } from '../src/integrations/vat-submission.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let app: ReturnType<typeof createApiServer>;
let ownerToken: string;
let employeeToken: string;
let outsiderToken: string;
let orgId: string;

async function login(email: string, displayName: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/dev-login')
    .send({ email, displayName })
    .expect(200);
  return res.body.token;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  // Modellerer det reelle miljøet uten Lovdata-nøkkel: åpne bulk-datasett finnes,
  // men per-paragraf lovtekst-oppslag er ikke aktivt (rapporteres ærlig).
  app = createApiServer({
    db,
    rules: buildNorwegianRuleRegister(),
    legalText: new StaticLovdataStub({}, [], { hasApiKey: false }),
    // Ingen Maskinporten-legitimasjon: MVA-melding-innsending kodet, men ikke aktiv.
    vatSubmission: new SkatteetatenVatSubmissionClient(new MaskinportenClient(undefined)),
  });
  ownerToken = await login('eier@example.com', 'Eier');
  employeeToken = await login('ansatt@example.com', 'Ansatt');
  outsiderToken = await login('utenfor@example.com', 'Utenforstående');

  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'API Test AS', orgForm: 'AS', vatStatus: 'registered' })
    .expect(201);
  orgId = org.body.id;

  // Legg til ansatt med begrenset rolle.
  const employee = await db.query(`SELECT id FROM users WHERE email = 'ansatt@example.com'`);
  await db.query(
    `INSERT INTO memberships (id, organization_id, user_id, role, created_by)
     VALUES (gen_random_uuid(), $1, $2, 'employee', $2)`,
    [orgId, employee.rows[0].id],
  );
});

afterAll(async () => {
  await db.end();
});

describe('Autentisering og autorisasjon', () => {
  it('avviser kall uten token', async () => {
    await request(app).get(`/api/organizations/${orgId}/documents`).expect(401);
  });

  it('avviser manipulert token', async () => {
    await request(app)
      .get(`/api/organizations/${orgId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}x`)
      .expect(401);
  });

  it('tenant-isolasjon: utenforstående får 404, ikke 403 (ingen eksistenslekkasje)', async () => {
    await request(app)
      .get(`/api/organizations/${orgId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('RBAC: ansatt kan laste opp, men ikke bokføre eller låse periode', async () => {
    await request(app)
      .post(`/api/organizations/${orgId}/documents`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        filename: 'kvittering.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.7\nKvittering\nTotal: NOK 100,00\n%%EOF').toString('base64'),
      })
      .expect(201);
    await request(app)
      .post(`/api/organizations/${orgId}/periods/2025/11/lock`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'test' })
      .expect(403);
  });

  it('ugyldig organisasjons-ID avvises med 400 (ikke SQL-feil)', async () => {
    await request(app)
      .get(`/api/organizations/'; DROP TABLE users;--/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });
});

describe('Vertikal flyt over HTTP', () => {
  let documentId: string;
  let suggestionId: string;
  let entryId: string;

  it('laster opp faktura og får forslag med forklaring', async () => {
    const pdf = [
      '%PDF-1.7',
      'Kamerahuset AS',
      'Org.nr: 923609016',
      'Faktura: A-777',
      'Fakturadato: 2025-11-20',
      'Sony objektiv',
      'Netto: 8 000,00',
      'MVA 25%: 2 000,00',
      'Å betale: NOK 10 000,00',
      '%%EOF',
    ].join('\n');
    const res = await request(app)
      .post(`/api/organizations/${orgId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        filename: 'faktura-a777.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from(pdf).toString('base64'),
      })
      .expect(201);
    expect(res.body.status).toBe('extracted');
    documentId = res.body.documentId;
    suggestionId = res.body.suggestionId;

    const detail = await request(app)
      .get(`/api/organizations/${orgId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    // «Hvorfor foreslår dere dette?» med kilder.
    expect(detail.body.explanation.evidence.length).toBeGreaterThan(0);
    expect(detail.body.explanation.rules.length).toBeGreaterThan(0);
    expect(detail.body.explanation.rules[0].sources[0].url).toMatch(/^https:/);
    expect(detail.body.suggestions[0].suggestion.requiresHumanReview).toBe(true);
  });

  it('godkjenner og bokfører; rapportene oppdateres', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/documents/${documentId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ suggestionId })
      .expect(201);
    entryId = res.body.id;
    expect(res.body.entryNumber).toBe(1);

    const tb = await request(app)
      .get(`/api/organizations/${orgId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const total = tb.body.reduce(
      (acc: [bigint, bigint], row: { debitMinor: string; creditMinor: string }) => [
        acc[0] + BigInt(row.debitMinor),
        acc[1] + BigInt(row.creditMinor),
      ],
      [0n, 0n],
    );
    expect(total[0]).toBe(total[1]);

    const vat = await request(app)
      .get(`/api/organizations/${orgId}/vat/report?from=2025-11-01&to=2025-11-30`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(vat.body.deductibleInputVatMinor).toBe('200000');
  });

  it('Scenario 9: feil i låst periode rettes med kontrollert korrigering', async () => {
    await request(app)
      .post(`/api/organizations/${orgId}/periods/2025/11/lock`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Månedsavslutning november' })
      .expect(204);

    // Direkte reversering inn i den låste perioden avvises…
    await request(app)
      .post(`/api/organizations/${orgId}/journal-entries/${entryId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reversalDate: '2025-11-25', reason: 'Feil beløp' })
      .expect(409);

    // …men korrigering i åpen periode fungerer, med komplett historikk.
    const reversal = await request(app)
      .post(`/api/organizations/${orgId}/journal-entries/${entryId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reversalDate: '2025-12-01', reason: 'Feil beløp — korrigeres i desember' })
      .expect(201);
    expect(reversal.body.status).toBe('posted');

    const audit = await request(app)
      .get(`/api/organizations/${orgId}/audit-events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const actions = audit.body.map((e: { action: string }) => e.action);
    expect(actions).toContain('accounting_period.locked');
    expect(actions).toContain('journal_entry.reversed');
  });

  it('skatteestimat over HTTP viser komponenter og forbehold', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/tax/estimate?from=2025-01-01&to=2025-12-31`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.components[0].ruleId).toBe('no.tax.corporate-rate');
    expect(res.body.notIncluded.length).toBeGreaterThan(0);
    expect(res.body.calculatedAt).toBeDefined();
  });

  it('bilagsjournalen returnerer posteringer med linjer (regnskapsførervisning)', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/journal-entries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // original + reversering
    const entry = res.body.find((e: { entry_number: string }) => Number(e.entry_number) === 1);
    expect(entry.lines.length).toBeGreaterThanOrEqual(3);
    const debit = entry.lines.reduce((a: bigint, l: { debit_minor: string }) => a + BigInt(l.debit_minor), 0n);
    const credit = entry.lines.reduce((a: bigint, l: { credit_minor: string }) => a + BigInt(l.credit_minor), 0n);
    expect(debit).toBe(credit);
    // Ansatt uten rapportrettighet får ikke journalen.
    await request(app)
      .get(`/api/organizations/${orgId}/journal-entries`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('posteringslinjer kan hentes per dokument (avansert visning)', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/documents/${documentId}/journal-entry`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(res.body.entry_number)).toBe(1);
    const accounts = res.body.lines.map((l: { account_number: string }) => l.account_number);
    expect(accounts).toContain('6551');
    expect(accounts).toContain('2710');
    expect(accounts).toContain('2400');
  });

  it('revisjonsloggen kan filtreres per entitet (kontrollspor)', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/audit-events?entityId=${documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const event of res.body) {
      expect(event.entity_id).toBe(documentId);
    }
  });

  it('RBAC: ansatt kan verken se eller opprette fakturaer', async () => {
    await request(app)
      .get(`/api/organizations/${orgId}/invoices`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
    await request(app)
      .post(`/api/organizations/${orgId}/customers`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Snik AS' })
      .expect(403);
  });

  it('helsesjekk for Control Center: probe-bar uten auth, db oppe, ærlige integrasjons-flagg', async () => {
    const res = await request(app).get('/api/health').expect(200); // ingen Authorization-header
    expect(res.body.service).toBe('ledgerly');
    expect(res.body.status).toBe('ok');
    expect(res.body.database.up).toBe(true);
    expect(typeof res.body.uptimeSeconds).toBe('number');
    // Ærlige flagg: uten legitimasjon er disse false (samme sannhet som /status).
    expect(res.body.integrations.lovdata).toBe(false); // ingen API-nøkkel
    expect(res.body.integrations.mvaSubmission).toBe(false); // ingen Maskinporten
    expect(res.body.integrations.errorMonitoring).toBe(false); // ingen SENTRY_DSN
    expect(res.body.integrations.gmail).toBe(false); // sandbox
    // Lovdata-klient er wiret (bulk-data tilgjengelig) selv uten nøkkel.
    expect(res.body.integrations.lovdataPublicData).toBe(true);
  });

  it('integrasjonsstatus er ærlig: Gmail er sandbox, ikke aktiv', async () => {
    const res = await request(app)
      .get('/api/integrations/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.gmail.mode).toBe('sandbox');
    expect(res.body.gmail.active).toBe(false);
    // Lovdata uten nøkkel: åpne bulk-data finnes, men per-paragraf-oppslag
    // (målet) er ikke aktivt — statusen skal si det ærlig, ikke lyve om «aktiv».
    expect(res.body.lovdata.mode).toBe('public_data_only');
    expect(res.body.lovdata.active).toBe(false);
    expect(res.body.lovdata.openPublicData).toBe(true);
    // MVA-melding-innsending er kodet men uten Maskinporten-legitimasjon: ærlig inaktiv.
    expect(res.body.altinn.mode).toBe('awaiting_maskinporten');
    expect(res.body.altinn.active).toBe(false);
    // Feilovervåking: ingen errorMonitor wiret i testen ⇒ ærlig not_configured.
    expect(res.body.sentry.active).toBe(false);
  });

  it('kodebiblioteket forklarer kontoer på vanlig norsk', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/code-library/accounts/6540`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.friendlyName).toBe('Utstyr og mindre inventar');
    expect(res.body.infoPage.whenNotToUse).toContain('30 000');
    expect(res.body.infoPage.commonMistakes.length).toBeGreaterThan(0);
  });

  it('avviser filtyper utenfor tillatt liste (karantene)', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
        contentBase64: Buffer.from('MZ...').toString('base64'),
      })
      .expect(201);
    expect(res.body.status).toBe('quarantined');
  });
});
