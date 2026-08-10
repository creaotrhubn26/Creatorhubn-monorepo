/**
 * Vertikal flyt mot ekte Postgres: Gmail (sandbox) → uttrekk → validering →
 * duplikat → forslag → godkjenning → bokføring → MVA-rapport → skatteestimat →
 * kontrollspor. Dekker akseptansescenario 1, 2, 3, 5, 7, 8 og 10.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { SandboxGmailAdapter } from '../src/ingestion/gmail/sandbox.js';
import { generalLedger } from '../src/ledger/reports.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { DeterministicTextExtractor } from '../src/pipeline/extract.js';
import {
  approveAndPost,
  ingestFromGmail,
  processIncomingDocument,
  type PipelineDeps,
} from '../src/pipeline/pipeline.js';
import { DeterministicSuggestionEngine } from '../src/pipeline/suggest.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { buildTaxEstimate } from '../src/tax/estimate.js';
import { buildVatReport } from '../src/vat/engine.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let deps: PipelineDeps;
let orgId: string;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'daniel@example.com', 'Daniel');
  const org = await createOrganization(db, {
    name: 'Kreativ Video ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;
  deps = {
    db,
    rules: buildNorwegianRuleRegister(),
    extractor: new DeterministicTextExtractor(),
    suggestionEngine: new DeterministicSuggestionEngine(),
  };
});

afterAll(async () => {
  await db.end();
});

describe('Scenario 1+2+3: Gmail-import med uttrekk, forslag, duplikat og karantene', () => {
  let kamerahusetDocId: string;
  let kamerahusetSuggestionId: string;
  let adobeDocId: string;
  let adobeSuggestionId: string;

  it('importerer kun fra valgt etikett — private e-poster eksponeres aldri', async () => {
    const gmail = new SandboxGmailAdapter();
    const summary = await ingestFromGmail(deps, {
      organizationId: orgId,
      actor: actor(),
      gmail,
      filter: { labels: ['Regnskap'], keywords: ['faktura', 'invoice'] },
      vatStatus: 'registered',
    });
    expect(summary.connectionState).toBe('active');
    // 4 meldinger har Regnskap-etikett; den private (sbx-msg-005) er utenfor.
    expect(summary.scannedMessages).toBe(4);
    const filenames = summary.importedDocuments.map((d) => d.filename);
    expect(filenames).not.toContain('middag.pdf');

    const kamerahuset = summary.importedDocuments.find(
      (d) => d.filename === 'faktura-2024-1042.pdf' && d.status === 'extracted',
    );
    expect(kamerahuset, 'Kamerahuset-fakturaen skal være tolket med forslag').toBeDefined();
    expect(kamerahuset!.suggestionId).toBeDefined();
    kamerahusetDocId = kamerahuset!.documentId;
    kamerahusetSuggestionId = kamerahuset!.suggestionId!;

    // Videresendt kopi av samme faktura → duplikat (annen Gmail-id, samme innhold).
    const duplicate = summary.importedDocuments.find((d) => d.status === 'duplicate');
    expect(duplicate, 'den videresendte kopien skal flagges som duplikat').toBeDefined();

    // Prompt-injection-dokumentet → karantene.
    const quarantined = summary.importedDocuments.find((d) => d.status === 'quarantined');
    expect(quarantined?.filename).toBe('invoice-urgent.pdf');

    const adobe = summary.importedDocuments.find((d) => d.filename === 'adobe-INV-88410021.pdf');
    expect(adobe?.status).toBe('extracted');
    adobeDocId = adobe!.documentId;
    adobeSuggestionId = adobe!.suggestionId!;
  });

  it('uttrekket fant leverandør, org.nr, beløp og KID, og validerte summene', async () => {
    const ext = await db.query(
      `SELECT * FROM extracted_document_data WHERE document_id = $1`,
      [kamerahusetDocId],
    );
    const row = ext.rows[0];
    expect(row.vendor_name).toBe('Kamerahuset AS');
    expect(row.vendor_org_number).toBe('923609016');
    expect(row.invoice_number).toBe('2024-1042');
    expect(row.kid).toBe('004212345678903');
    expect(row.net_minor).toBe('2000000');
    expect(row.vat_minor).toBe('500000');
    expect(row.gross_minor).toBe('2500000');
    expect(row.validation_status).toBe('valid');
  });

  it('ny import av samme Gmail-melding er idempotent (duplikat, ikke ny bokføring)', async () => {
    const gmail = new SandboxGmailAdapter();
    const summary = await ingestFromGmail(deps, {
      organizationId: orgId,
      actor: actor(),
      gmail,
      filter: { labels: ['Regnskap'] },
      vatStatus: 'registered',
    });
    for (const doc of summary.importedDocuments) {
      expect(doc.status).toBe('duplicate');
    }
  });

  it('manuell opplasting av samme faktura (andre bytes, samme fakturanr) → duplikat', async () => {
    const content = Buffer.from(
      `%PDF-1.7\nKamerahuset AS\nOrg.nr: 923609016\nFaktura: 2024-1042\nFakturadato: 2025-11-05\nNetto: 20 000,00\nMVA 25%: 5 000,00\nÅ betale: NOK 25 000,00\nSkannet kopi med litt annen tekst\n%%EOF`,
      'utf8',
    );
    const result = await processIncomingDocument(deps, {
      organizationId: orgId,
      actor: actor(),
      source: 'upload',
      filename: 'skannet-faktura.pdf',
      mimeType: 'application/pdf',
      content,
      vatStatus: 'registered',
    });
    expect(result.status).toBe('duplicate');
  });

  it('Scenario 2: godkjenning bokfører med korrekt mva-splitt og reskontro', async () => {
    const entry = await approveAndPost(deps, {
      organizationId: orgId,
      actor: actor(),
      actorRoleVerified: true,
      documentId: kamerahusetDocId,
      suggestionId: kamerahusetSuggestionId,
    });
    expect(entry.status).toBe('posted');

    const lines = await generalLedger(db, { organizationId: orgId });
    const entryLines = lines.filter((l) => l.entryId === entry.id);
    const byAccount = Object.fromEntries(
      entryLines.map((l) => [l.accountNumber, l.debitMinor - l.creditMinor]),
    );
    expect(byAccount['6551']).toBe(2000000n); // kostnad netto
    expect(byAccount['2710']).toBe(500000n); // inngående mva
    expect(byAccount['2400']).toBe(-2500000n); // leverandørgjeld brutto

    // Dokumentstatus og forslag er oppdatert med kontrollspor.
    const doc = await db.query(`SELECT status FROM source_documents WHERE id = $1`, [kamerahusetDocId]);
    expect(doc.rows[0].status).toBe('posted');
    // Idempotens: nytt forsøk på samme dokument gir samme postering.
    const again = await approveAndPost(deps, {
      organizationId: orgId,
      actor: actor(),
      actorRoleVerified: true,
      documentId: kamerahusetDocId,
      suggestionId: kamerahusetSuggestionId,
    }).catch((e) => e);
    expect(again).toBeInstanceOf(Error); // forslaget er allerede behandlet
  });

  it('utenlandsk tjeneste (EUR) krever valutakurs og bokføres med omvendt avgiftsplikt', async () => {
    await expect(
      approveAndPost(deps, {
        organizationId: orgId,
        actor: actor(),
        actorRoleVerified: true,
        documentId: adobeDocId,
        suggestionId: adobeSuggestionId,
      }),
    ).rejects.toThrow(/valutakurs/i);

    const entry = await approveAndPost(deps, {
      organizationId: orgId,
      actor: actor(),
      actorRoleVerified: true,
      documentId: adobeDocId,
      suggestionId: adobeSuggestionId,
      exchangeRate: { rateDecimal: '11.50', source: 'norges-bank' },
    });
    const lines = await generalLedger(db, { organizationId: orgId });
    const entryLines = lines.filter((l) => l.entryId === entry.id);
    // 66,99 EUR × 11,50 = 770,39 kr; mva 25 % = 192,60 begge veier.
    const byAccount = Object.fromEntries(
      entryLines.map((l) => [l.accountNumber, l.debitMinor - l.creditMinor]),
    );
    expect(byAccount['6810']).toBe(77039n);
    expect(byAccount['2710']).toBe(19260n);
    expect(byAccount['2700']).toBe(-19260n);
    expect(byAccount['2400']).toBe(-77039n);
    // Originalvaluta er bevart på kostnadslinjen.
    const fxLine = entryLines.find((l) => l.accountNumber === '6810');
    const raw = await db.query(
      `SELECT original_currency, original_amount_minor, exchange_rate, exchange_rate_source
       FROM journal_lines WHERE entry_id = $1 AND account_number = '6810'`,
      [entry.id],
    );
    expect(raw.rows[0].original_currency).toBe('EUR');
    expect(raw.rows[0].original_amount_minor).toBe('6699');
    expect(raw.rows[0].exchange_rate).toBe('11.50');
    expect(raw.rows[0].exchange_rate_source).toBe('norges-bank');
    expect(fxLine).toBeDefined();
  });

  it('Scenario 7: MVA-rapporten viser inngående mva og omvendt avgiftsplikt', async () => {
    const report = await buildVatReport(db, orgId, '2025-11-01', '2025-11-30');
    expect(report.status).toBe('draft');
    const code1 = report.lines.find((l) => l.vatCode === '1');
    expect(code1?.baseMinor).toBe(2000000n);
    expect(code1?.vatMinor).toBe(500000n);
    // Kode 86 med full fradragsrett: netto mva-effekt 0 (192,60 − 192,60).
    const code86 = report.lines.find((l) => l.vatCode === '86');
    expect(code86?.vatMinor).toBe(0n);
    expect(report.deductibleInputVatMinor).toBe(500000n);
    // Til gode (kun kjøp bokført): negativt beløp å betale.
    expect(report.netPayableMinor).toBe(-500000n);
  });

  it('Scenario 8: kontrollspor fra postering tilbake til Gmail-meldingen', async () => {
    const trace = await db.query(
      `SELECT e.entry_number, d.filename, d.gmail_message_id, d.sha256, s.engine
       FROM journal_entries e
       JOIN source_documents d ON d.id = e.source_document_id
       JOIN posting_suggestions s ON s.document_id = d.id AND s.status = 'approved'
       WHERE e.organization_id = $1 AND d.id = $2`,
      [orgId, kamerahusetDocId],
    );
    expect(trace.rowCount).toBe(1);
    expect(trace.rows[0].gmail_message_id).toBe('sbx-msg-001');
    expect(trace.rows[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    // …og revisjonsloggen har hele kjeden.
    const audit = await db.query(
      `SELECT action FROM audit_events WHERE organization_id = $1 ORDER BY occurred_at`,
      [orgId],
    );
    const actions = audit.rows.map((r) => r.action);
    expect(actions).toContain('document.received');
    expect(actions).toContain('posting_suggestion.created');
    expect(actions).toContain('document.approved_and_posted');
    expect(actions).toContain('journal_entry.posted');
  });

  it('skatteestimatet bruker regelversjoner og viser usikkerhet', async () => {
    const estimate = await buildTaxEstimate(db, deps.rules, {
      organizationId: orgId,
      orgForm: 'ENK',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
    });
    // Kostnader bokført, ingen inntekter → underskudd → 0 i skatt.
    expect(estimate.accountingResultMinor).toBeLessThan(0n);
    expect(estimate.estimatedTaxMinor).toBe(0n);
    expect(estimate.components.map((c) => c.ruleId)).toContain(
      'no.tax.social-security-self-employed',
    );
    expect(estimate.components.find((c) => c.ruleId === 'no.tax.social-security-self-employed')?.ruleVersion).toBe(2);
    expect(estimate.notIncluded.length).toBeGreaterThan(0);
    expect(estimate.uncertaintyNotes.length).toBeGreaterThan(0);
    expect(estimate.scenarios.map((s) => s.label)).toEqual(['low', 'expected', 'high']);
  });
});

describe('Scenario 10: tilbakekalt token stopper synkronisering kontrollert', () => {
  it('revoked token → sync stopper, ingenting slettes', async () => {
    const before = await db.query(
      `SELECT count(*)::int AS n FROM source_documents WHERE organization_id = $1`,
      [orgId],
    );
    const gmail = new SandboxGmailAdapter();
    gmail.setConnectionState('revoked');
    const summary = await ingestFromGmail(deps, {
      organizationId: orgId,
      actor: actor(),
      gmail,
      filter: { labels: ['Regnskap'] },
      vatStatus: 'registered',
    });
    expect(summary.connectionState).toBe('revoked');
    expect(summary.importedDocuments).toHaveLength(0);
    const after = await db.query(
      `SELECT count(*)::int AS n FROM source_documents WHERE organization_id = $1`,
      [orgId],
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
    // Hendelsen er logget.
    const audit = await db.query(
      `SELECT count(*)::int AS n FROM audit_events
       WHERE organization_id = $1 AND action = 'integration.gmail.sync_stopped'`,
      [orgId],
    );
    expect(audit.rows[0].n).toBeGreaterThan(0);
  });

  it('utløpt token behandles like kontrollert', async () => {
    const gmail = new SandboxGmailAdapter();
    gmail.setConnectionState('expired');
    const summary = await ingestFromGmail(deps, {
      organizationId: orgId,
      actor: actor(),
      gmail,
      filter: { labels: ['Regnskap'] },
      vatStatus: 'registered',
    });
    expect(summary.connectionState).toBe('expired');
  });

  it('tomt etikettvalg skanner ingenting (minste tilgang)', async () => {
    const gmail = new SandboxGmailAdapter();
    const summary = await ingestFromGmail(deps, {
      organizationId: orgId,
      actor: actor(),
      gmail,
      filter: { labels: [] },
      vatStatus: 'registered',
    });
    expect(summary.scannedMessages).toBe(0);
  });
});
