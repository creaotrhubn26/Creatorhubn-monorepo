/**
 * HTTP-API for den vertikale flyten. Autorisasjon håndheves på hvert endepunkt:
 * autentisert bruker → aktivt medlemskap i organisasjonen → rettighet for handlingen.
 * Feil oversettes til HTTP-statuser ved systemgrensen; interne detaljer lekkes ikke.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { hasPermission, PERMISSIONS, ROLES, type Permission } from '../access/permissions.js';
import { getAccountDef, STANDARD_ACCOUNTS } from '../coa/accounts.js';
import { getVatCode, VAT_CODES } from '../coa/vat-codes.js';
import type { Db } from '../db/pool.js';
import { SandboxGmailAdapter } from '../ingestion/gmail/sandbox.js';
import type { GmailPort } from '../ingestion/gmail/port.js';
import { SmartGmailFilter, type EmailClassifier, type EmailSignals } from '../ingestion/gmail/smart-filter.js';
import { lockPeriod, reverseJournalEntry } from '../ledger/engine.js';
import { computeYearEndPlan, executeYearEndClose } from '../ledger/year-end.js';
import { buildNaeringsspesifikasjon } from '../tax/naeringsspesifikasjon.js';
import { SALDO_GROUPS, bookDepreciation, computeDepreciation, createFixedAsset, disposeFixedAsset, listFixedAssets, type SaldoGroup } from '../ledger/depreciation.js';
import {
  balanceSheet,
  generalLedger,
  incomeStatement,
  subledger,
  trialBalance,
  vatRegistrationThreshold,
} from '../ledger/reports.js';
import { runHealthCheck } from '../ledger/health-check.js';
import { detectBookkeepingErrors } from '../ledger/anomalies.js';
import { detectFraudSignals } from '../ledger/fraud-detection.js';
import {
  approvePayment,
  getFraudSettings,
  listPaymentsAwaitingApproval,
  reviewFraudSignal,
  updateFraudSettings,
} from '../ledger/fraud-controls.js';
import {
  approveLearnedRule,
  createLearnedRule,
  createOrganizationGroup,
  detectLearnedRules,
  dismissLearnedRule,
  listLearnedRules,
  updateLearnedRule,
} from '../ledger/learning.js';
import { buildForecast } from '../ledger/planning.js';
import { assessPeriodClose, assessYearClose } from '../ledger/period-close.js';
import { buildTaxAdvisories } from '../ledger/tax-advisor.js';
import { huntDocuments, linkPaymentToDocument, previewPaymentLink } from '../ingestion/document-hunt.js';
import { buildDashboard } from '../ledger/dashboard.js';
import { createAgreement, listAgreements, reviewAgreements } from '../invoicing/agreements.js';
import { buildAiDisclosure } from '../ai/disclosure.js';
import {
  createOrganization,
  ensureUser,
  getMembershipRole,
  getOrganizationProfile,
  updateOrganizationSettings,
} from '../orgs/service.js';
import type { VatRegisterLookup } from '../integrations/brreg.js';
import type { CompanyRegistry } from '../integrations/company-registry.js';
import type { FxRateSource } from '../integrations/fx-rates.js';
import { convertToNok, money } from '../shared/money.js';
import { assessCompanyRisk } from '../ledger/company-risk.js';
import { answerQuestion } from '../ledger/ask.js';
import type { LovdataPort } from '../integrations/lovdata.js';
import { buildMvaMeldingXml, MaskinportenError, validateMvaMeldingWithToken, type VatSubmissionPort } from '../integrations/vat-submission.js';
import type { ErrorMonitor } from '../ops/sentry.js';
import type { StripeReadPort } from '../integrations/stripe.js';
import { syncStripeRevenue } from '../integrations/stripe-sync.js';
import { ensureBootstrapOrg, type BootstrapOrgConfig } from '../ops/bootstrap.js';
import type { EmailPort } from '../integrations/email.js';
import { sendInvoiceReminders } from '../invoicing/reminders.js';
import { aiMarginReport } from '../ops/ai-accounts.js';
import { timingSafeEqual } from 'node:crypto';
import { renderInvoiceDocument } from '../invoicing/document.js';
import { loadInvoiceView } from '../invoicing/view.js';
import { renderInvoicePdf } from '../invoicing/pdf.js';
import { loadInvoiceEhf, renderEhfXml, type PeppolAccessPoint } from '../invoicing/ehf.js';
import { lookupPeppolParticipant } from '../invoicing/peppol-lookup.js';
import { buildPaymentFile, listPayableInvoices, recordPaymentExports } from '../ledger/payments.js';
import { computeDeadlines, type OrgForm } from '../ledger/deadlines.js';
import { IdPortenClient, generatePkce, randomToken } from '../integrations/idporten.js';
import { getStatus as idportenStatus, getValidAccessToken, saveLoginState, saveSession, takeLoginState } from '../integrations/idporten-session.js';
import {
  addOrUpdateMember,
  changeMemberRole,
  hasActiveMembershipByEmail,
  listMembers,
  removeMember,
} from '../orgs/members.js';
import { DeterministicTextExtractor, type DocumentExtractor } from '../pipeline/extract.js';
import {
  approveAndPost,
  ingestFromGmail,
  processIncomingDocument,
  type PipelineDeps,
} from '../pipeline/pipeline.js';
import { DeterministicSuggestionEngine } from '../pipeline/suggest.js';
import { computeDocumentImpact } from '../pipeline/impact.js';
import { createBankAccount, importBankTransactions, parseBankCsv } from '../bank/import.js';
import type { BankFeedProvider } from '../bank/feed.js';
import { approveMatch, rejectMatch, suggestMatches } from '../bank/matching.js';
import { reconciliationStatus } from '../bank/reconciliation.js';
import { bankCategoriesFor, categorizeBankTransaction } from '../bank/categorize.js';
import { createCreditNote, createInvoiceDraft, issueInvoice } from '../invoicing/service.js';
import { createDimension, dimensionResultReport, listDimensions } from '../dimensions/service.js';
import { buildSafTXml } from '../saft/export.js';
import { parseSaft, importSaftOpeningBalance, parseSaftTransactions, replaySaftTransactions } from '../saft/import.js';
import { newId } from '../shared/ids.js';
import type { RuleRegister } from '../rules/register.js';
import type { ObjectStorage } from '../storage/port.js';
import { recordAuditEvent } from '../audit/audit.js';
import { withTransaction } from '../db/pool.js';
import { sha256Hex } from '../documents/service.js';
import { DomainError, NotFoundError, ValidationError } from '../shared/errors.js';
import { buildTaxEstimate } from '../tax/estimate.js';
import { buildVatReport, listVatCodes } from '../vat/engine.js';
import { issueToken, resolveAuthSecret, verifyToken, type AuthTokenPayload } from './auth.js';
import { createMagicToken, isAllowedEmail, verifyMagicToken } from './magic-link.js';
import { createApiKey, listApiKeys, resolveApiKey, revokeApiKey } from '../integrations/api-keys.js';
import {
  createWebhook,
  deleteWebhook,
  deliverPending,
  emitEvent,
  kickDelivery,
  listDeliveries,
  listWebhooks,
  testWebhook,
  WEBHOOK_EVENTS,
} from '../integrations/webhooks.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createReknarenMcpServer } from '../mcp/server.js';
import {
  assessRecurringDue,
  createRecurringFromVendor,
  detectRecurringExpectations,
  recurringHintForVendor,
  resolveRecurring,
} from '../ledger/recurring.js';
import { buildPaymentCalendar } from '../ledger/calendar.js';
import { buildConnectorRegistry } from '../integrations/connectors/registry.js';
import {
  connectConnector,
  disconnectConnector,
  listConnectorStatus,
  syncAllConnectors,
  syncConnector,
  type ConnectorDeps,
} from '../integrations/connectors/sync.js';

/** JSON-serialisering: bigint (øre) blir strenger — aldri flyttall over grensen. */
function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
  orgRole?: string;
  /** Satt når forespørselen er autentisert med en API-nøkkel (åpent integrasjonslag). */
  apiKey?: { keyId: string; organizationId: string; scopes: string[] };
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface ApiDeps {
  db: Db;
  rules: RuleRegister;
  /** Sandbox til ekte OAuth-nøkler er på plass; status rapporteres ærlig. */
  gmailAdapterFactory?: (() => GmailPort) | undefined;
  /** Modus rapportert til klienten: 'imap' (ekte) eller 'sandbox'. */
  gmailMode?: string | undefined;
  /** AI-klassifisering for det smarte bilagsfilteret. Uten nøkkel: heuristikk-only. */
  emailClassifier?: EmailClassifier | undefined;
  /** Objektlager for dokumentinnhold. */
  storage?: ObjectStorage | undefined;
  /** Katalog med bygget web-UI (vite dist). Serveres statisk når satt. */
  webDistDir?: string | undefined;
  /** Uttrekksmotor (OCR eller deterministisk). Default: deterministisk tekstparser. */
  extractor?: DocumentExtractor | undefined;
  /** Faktisk OCR-tilgjengelighet, til ærlig integrasjonsstatus. */
  ocrStatus?: { tesseract: boolean; pdftotext: boolean } | undefined;
  /** Om AI-bilagslesing (Claude) er aktiv (nøkkel konfigurert). */
  aiExtraction?: boolean | undefined;
  /** Claude-modell brukt til bilagslesing (til KI-transparens). */
  aiModel?: string | undefined;
  /** Oppslag mot MVA-registeret (Brreg åpne data). Uten denne er kontrollen utilgjengelig. */
  vatRegister?: VatRegisterLookup | undefined;
  /** Fullt virksomhetsoppslag (Enhetsregisteret) til kunde-/leverandørrisiko. */
  companyRegistry?: CompanyRegistry | undefined;
  /** Automatisk valutakurs (Norges Bank, åpne data). */
  fxRates?: FxRateSource | undefined;
  /**
   * Lovdata API-klient til lovtekst-oppslag. Åpne bulk-datasett fungerer uten
   * nøkkel; per-paragraf lovtekst krever X-API-Key. Status rapporteres ærlig.
   */
  legalText?: LovdataPort | undefined;
  /**
   * MVA-melding-innsending mot Skatteetaten via Maskinporten. Uten legitimasjon
   * er den ikke aktiv; status rapporteres ærlig.
   */
  vatSubmission?: VatSubmissionPort | undefined;
  /** Feilovervåking (Sentry) for uventede serverfeil. Uten denne rapporteres den ærlig som ikke aktiv. */
  errorMonitor?: ErrorMonitor | undefined;
  /** Stripe-lesing (kun LES) for inntektssynk. Uten nøkkel er synk ærlig inaktiv. */
  stripe?: StripeReadPort | undefined;
  /** Bank-feed (PSD2/open banking). Uten aggregator-legitimasjon er feed ærlig inaktiv. */
  bankFeed?: BankFeedProvider | undefined;
  /** PEPPOL-aksesspunkt for EHF-overføring. Uten avtale er sending ærlig inaktiv. */
  peppol?: PeppolAccessPoint | undefined;
  /** ID-porten OIDC for mva-melding (validering/innsending). Inaktiv uten IDPORTEN_*. */
  idporten?: IdPortenClient | undefined;
  /** Hemmelig token for hodeløse cron-jobber. Uten den svarer cron-endepunkter 503. */
  cronSecret?: string | undefined;
  /** Org hodeløse jobber opererer på (Creatorhubs egne bøker). */
  bootstrapOrg?: BootstrapOrgConfig | undefined;
  /** Utgående e-post (betalingspåminnelser). Uten konfig er sending ærlig inaktiv. */
  email?: EmailPort | undefined;
  /** Tillatte innloggings-e-poster (magisk lenke). Tom = magisk innlogging av. */
  allowedEmails?: string[] | undefined;
  /** Basis-URL for magiske lenker (f.eks. https://reknaren-coss.onrender.com). */
  appBaseUrl?: string | undefined;
}

/** Merkevaret HTML-svar for bank-samtykke-redirecten (/bank/callback). */
function bankCallbackHtml(opts: { ok: boolean; error?: string | undefined; code?: string | undefined }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const GREEN = '#1f4d3a';
  const GOLD = '#b0913b';
  let heading: string;
  let body: string;
  let icon: string;
  if (opts.error) {
    icon = '⚠️';
    heading = 'Samtykket ble ikke fullført';
    body = `Banken avbrøt eller avviste tilgangen${opts.error ? ` (<code>${esc(opts.error)}</code>)` : ''}. Du kan lukke dette vinduet og prøve «Koble bank» på nytt i Reknaren.`;
  } else if (opts.ok) {
    icon = '✅';
    heading = 'Banken er koblet';
    body =
      'Samtykket er registrert. Gå tilbake til <strong>Reknaren</strong> og trykk <strong>«Fullfør kobling»</strong> på bankkontoen — så henter vi transaksjonene. Du kan lukke dette vinduet.';
  } else if (opts.code) {
    icon = '📋';
    heading = 'Nesten i mål';
    body = `Vi klarte ikke å koble svaret til en bankkonto automatisk. Kopiér denne koden inn i «Fullfør kobling» i Reknaren:<br><br><code style="user-select:all;word-break:break-all;background:#f3f0e8;padding:8px 12px;border-radius:8px;display:inline-block">${esc(opts.code)}</code>`;
  } else {
    icon = '❔';
    heading = 'Mangler informasjon fra banken';
    body = 'Redirecten manglet forventet informasjon. Lukk vinduet og prøv «Koble bank» på nytt i Reknaren.';
  }
  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reknaren — bank-kobling</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,'Segoe UI',Roboto,sans-serif; background:${GREEN}; color:#1a1a1a; padding:24px; }
  .card { background:#fff; max-width:460px; width:100%; border-radius:20px; padding:40px 36px;
          box-shadow:0 20px 60px rgba(0,0,0,.25); text-align:center; }
  .mono { width:44px; height:44px; border-radius:12px; background:${GREEN}; color:${GOLD};
          font-weight:800; font-size:24px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:18px; }
  .icon { font-size:40px; margin-bottom:8px; }
  h1 { font-size:22px; margin:6px 0 12px; color:${GREEN}; }
  p { font-size:15px; line-height:1.55; color:#333; margin:0; }
  code { font-family:ui-monospace,Menlo,monospace; font-size:13px; }
  .brand { margin-top:26px; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:${GOLD}; font-weight:700; }
</style></head>
<body><div class="card">
  <div class="mono">R</div>
  <div class="icon">${icon}</div>
  <h1>${heading}</h1>
  <p>${body}</p>
  <div class="brand">Reknaren</div>
</div></body></html>`;
}

/** Nøkkelord som driver Gmail-søket etter bilag (norsk + engelsk). */
const BILAG_KEYWORDS = ['faktura', 'kvittering', 'kreditnota', 'ordrebekreftelse', 'invoice', 'receipt', 'order confirmation'];

export function createApiServer(deps: ApiDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20mb' }));
  const secret = resolveAuthSecret();

  const pipelineDeps: PipelineDeps = {
    db: deps.db,
    rules: deps.rules,
    extractor: deps.extractor ?? new DeterministicTextExtractor(),
    suggestionEngine: new DeterministicSuggestionEngine(),
    storage: deps.storage,
  };

  // ── Autentisering ─────────────────────────────────────────────────────────
  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const payload = token ? verifyToken(token, secret) : null;
    if (!payload) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Gyldig token kreves.' } });
      return;
    }
    req.auth = payload;
    next();
  };

  /** Autorisasjon per organisasjon: medlemskap + rettighet. Hindrer IDOR på tvers av tenants. */
  const requireOrgPermission =
    (permission: Permission) =>
    async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const orgId = req.params.orgId;
        if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ugyldig organisasjons-ID.' } });
          return;
        }
        const role = await getMembershipRole(deps.db, orgId, req.auth!.userId);
        if (!role || !hasPermission(role, permission)) {
          // 404 ved manglende medlemskap: avslører ikke om organisasjonen finnes.
          res.status(role ? 403 : 404).json({
            error: {
              code: role ? 'FORBIDDEN' : 'NOT_FOUND',
              message: role ? 'Du mangler rettighet til denne handlingen.' : 'Ikke funnet.',
            },
          });
          return;
        }
        req.orgRole = role;
        next();
      } catch (err) {
        next(err);
      }
    };

  /**
   * Tilgang til det åpne integrasjonslaget (/api/v1): godtar ENTEN en API-nøkkel
   * (rk_live_…, scopet + tenant-bundet) ELLER en vanlig sesjons-token (m/
   * medlemskap). Begge håndhever det samme rettighetsvokabularet, og
   * organisasjonen i URL-en må matche nøkkelens/​medlemmets org.
   */
  const requireApiAccess =
    (permission: Permission) =>
    async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const orgId = req.params.orgId;
        if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ugyldig organisasjons-ID.' } });
          return;
        }
        const header = req.header('authorization');
        const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
        if (token?.startsWith('rk_')) {
          const resolved = await resolveApiKey(deps.db, token);
          if (!resolved) {
            res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Ugyldig eller tilbakekalt API-nøkkel.' } });
            return;
          }
          if (resolved.organizationId !== orgId) {
            res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
            return;
          }
          if (!resolved.scopes.includes(permission)) {
            res.status(403).json({ error: { code: 'FORBIDDEN', message: `API-nøkkelen mangler scope «${permission}».` } });
            return;
          }
          req.apiKey = resolved;
          next();
          return;
        }
        // Fall tilbake til sesjons-token + medlemskap.
        const payload = token ? verifyToken(token, secret) : null;
        if (!payload) {
          res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Gyldig token eller API-nøkkel kreves.' } });
          return;
        }
        req.auth = payload;
        const role = await getMembershipRole(deps.db, orgId, payload.userId);
        if (!role || !hasPermission(role, permission)) {
          res.status(role ? 403 : 404).json({
            error: { code: role ? 'FORBIDDEN' : 'NOT_FOUND', message: role ? 'Du mangler rettighet.' : 'Ikke funnet.' },
          });
          return;
        }
        req.orgRole = role;
        next();
      } catch (err) {
        next(err);
      }
    };

  // ── Auth (dev) ────────────────────────────────────────────────────────────
  app.post('/api/auth/dev-login', async (req, res, next) => {
    try {
      if ((process.env.NODE_ENV ?? 'development') === 'production') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
        return;
      }
      const body = z
        .object({ email: z.string().email(), displayName: z.string().min(1).max(200) })
        .parse(req.body);
      const userId = await ensureUser(deps.db, body.email, body.displayName);
      const token = issueToken({ userId, email: body.email, issuedAt: Date.now() }, secret);
      res.json({ token, userId });
    } catch (err) {
      next(err);
    }
  });

  // ── Auth (produksjon): passordløs magisk lenke ────────────────────────────
  // Ber om innlogging: sender en signert, tidsbegrenset lenke til e-post PÅ
  // tillatelseslisten. Svarer alltid 200 (lekker ikke hvem som er tillatt).
  app.post('/api/auth/request-magic-link', async (req, res, next) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const allow = deps.allowedEmails ?? [];
      // Innloggingslenke sendes til globalt tillatte adresser ELLER inviterte medlemmer.
      const permitted =
        (allow.length > 0 && isAllowedEmail(email, allow)) || (await hasActiveMembershipByEmail(deps.db, email));
      if (deps.email?.configured && permitted) {
        const token = createMagicToken(email, secret);
        const base = (deps.appBaseUrl ?? '').replace(/\/$/, '');
        const link = `${base}/?magic=${encodeURIComponent(token)}`;
        await deps.email
          .send({
            to: email,
            subject: 'Logg inn i Reknaren',
            text:
              `Klikk for å logge inn i Reknaren (gyldig i 15 minutter):\n\n${link}\n\n` +
              `Har du ikke bedt om dette, kan du se bort fra e-posten.`,
          })
          .catch(() => {}); // ikke lekk sende-status
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Verifiserer en magisk lenke → sikrer bruker + medlemskap i bootstrap-orgen →
  // gir en sesjonstoken.
  app.post('/api/auth/verify-magic-link', async (req, res, next) => {
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      const email = verifyMagicToken(token, secret);
      const allow = deps.allowedEmails ?? [];
      // Gyldig for globalt tillatte adresser ELLER inviterte medlemmer (aktivt medlemskap).
      const permitted =
        !!email &&
        ((allow.length > 0 && isAllowedEmail(email, allow)) || (await hasActiveMembershipByEmail(deps.db, email)));
      if (!permitted) {
        res.status(401).json({ error: { code: 'INVALID_MAGIC', message: 'Ugyldig eller utløpt innloggingslenke.' } });
        return;
      }
      const userId = await ensureUser(deps.db, email, email.split('@')[0] ?? email);
      // Tillatte innloggingsbrukere blir eier av Creatorhubs bøker (bootstrap-org).
      if (deps.bootstrapOrg) {
        const org = await deps.db.query<{ id: string }>(
          `SELECT id FROM organizations WHERE org_number = $1`,
          [deps.bootstrapOrg.orgNumber],
        );
        const orgId = org.rows[0]?.id;
        if (orgId) {
          await deps.db.query(
            `INSERT INTO memberships (id, organization_id, user_id, role, created_by)
             VALUES ($1,$2,$3,'owner',$3)
             ON CONFLICT (organization_id, user_id) DO NOTHING`,
            [newId(), orgId, userId],
          );
        }
      }
      const session = issueToken({ userId, email, issuedAt: Date.now() }, secret);
      res.json({ token: session, userId, email });
    } catch (err) {
      next(err);
    }
  });

  // ── Organisasjoner ───────────────────────────────────────────────────────
  // Virksomhetene den innloggede brukeren er aktivt medlem av — så en returnerende
  // bruker kan VELGE org i stedet for å måtte opprette en ny hver gang.
  app.get('/api/organizations', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const rows = await deps.db.query(
        `SELECT o.id, o.name, o.org_form, o.org_number, m.role
         FROM memberships m JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = $1 AND m.status = 'active'
         ORDER BY o.name`,
        [req.auth!.userId],
      );
      res.json(
        rows.rows.map((r) => ({
          id: r.id,
          name: r.name,
          orgForm: r.org_form,
          orgNumber: r.org_number,
          role: r.role,
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/organizations', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(1).max(200),
          orgNumber: z.string().regex(/^\d{9}$/).optional(),
          orgForm: z.enum(['ENK', 'AS', 'ANS', 'DA', 'SA', 'NUF']),
          vatStatus: z.enum(['registered', 'not_registered', 'pending']),
          streetAddress: z.string().min(1).max(200).optional(),
          postalCode: z.string().regex(/^\d{4}$/).optional(),
          city: z.string().min(1).max(100).optional(),
        })
        .parse(req.body);
      const org = await createOrganization(deps.db, {
        name: body.name,
        orgForm: body.orgForm,
        vatStatus: body.vatStatus,
        createdByUserId: req.auth!.userId,
        ...(body.orgNumber ? { orgNumber: body.orgNumber } : {}),
        ...(body.streetAddress ? { streetAddress: body.streetAddress } : {}),
        ...(body.postalCode ? { postalCode: body.postalCode } : {}),
        ...(body.city ? { city: body.city } : {}),
      });
      res.status(201).json(toJson(org));
    } catch (err) {
      next(err);
    }
  });

  app.get(
    '/api/organizations/:orgId/profile',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        res.json(toJson(await getOrganizationProfile(deps.db, req.params.orgId!)));
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch(
    '/api/organizations/:orgId/settings',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            orgNumber: z.string().regex(/^\d{9}$/).optional(),
            streetAddress: z.string().min(1).max(200).optional(),
            postalCode: z.string().regex(/^\d{4}$/).optional(),
            city: z.string().min(1).max(100).optional(),
            vatStatus: z.enum(['registered', 'not_registered', 'pending']).optional(),
          })
          .parse(req.body);
        const profile = await updateOrganizationSettings(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ...(body.orgNumber ? { orgNumber: body.orgNumber } : {}),
          ...(body.streetAddress ? { streetAddress: body.streetAddress } : {}),
          ...(body.postalCode ? { postalCode: body.postalCode } : {}),
          ...(body.city ? { city: body.city } : {}),
          ...(body.vatStatus ? { vatStatus: body.vatStatus } : {}),
        });
        res.json(toJson(profile));
      } catch (err) {
        next(err);
      }
    },
  );

  // Kontroll mot MVA-registeret (Brreg åpne data). Registeret er fasit for om
  // «MVA» kan stå bak org.nr. på salgsdokumenter — lokal status er en påstand.
  app.post(
    '/api/organizations/:orgId/vat-register-check',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.vatRegister) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message: 'Oppslag mot Enhetsregisteret er ikke konfigurert i dette miljøet.',
            },
          });
          return;
        }
        const profile = await getOrganizationProfile(deps.db, req.params.orgId!);
        if (!profile.orgNumber) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Virksomheten mangler organisasjonsnummer — legg det inn først.',
            },
          });
          return;
        }
        const result = await deps.vatRegister.lookup(profile.orgNumber);
        const registered = result.found ? (result.registeredInVatRegister ?? false) : null;
        await withTransaction(deps.db, async (client) => {
          await client.query(
            `UPDATE organizations
             SET vat_register_checked_at = now(), vat_register_registered = $2,
                 updated_at = now(), version = version + 1
             WHERE id = $1`,
            [req.params.orgId, registered],
          );
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'organization.vat_register_checked',
            entityType: 'organization',
            entityId: req.params.orgId!,
            newValue: {
              orgNumber: profile.orgNumber,
              found: result.found,
              registeredInVatRegister: registered,
              source: 'data.brreg.no/enhetsregisteret',
            },
          });
        });
        const mismatch =
          result.found &&
          ((profile.vatStatus === 'registered' && registered === false) ||
            (profile.vatStatus !== 'registered' && registered === true));
        res.json({
          orgNumber: profile.orgNumber,
          found: result.found,
          registryName: result.name ?? null,
          registeredInVatRegister: registered,
          localVatStatus: profile.vatStatus,
          mismatch,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Kodebibliotek ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/code-library/accounts',
    requireAuth,
    requireOrgPermission('reports.view'),
    (_req, res) => {
      res.json(toJson(STANDARD_ACCOUNTS));
    },
  );
  app.get(
    '/api/organizations/:orgId/code-library/vat-codes',
    requireAuth,
    requireOrgPermission('reports.view'),
    (_req, res) => {
      res.json(toJson(listVatCodes()));
    },
  );
  app.get(
    '/api/organizations/:orgId/code-library/accounts/:number',
    requireAuth,
    requireOrgPermission('reports.view'),
    (req, res) => {
      const def = getAccountDef(req.params.number!);
      if (!def) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ukjent konto.' } });
        return;
      }
      // Informasjonsside for koden (kodemotoren, pkt. 7 i spesifikasjonen).
      res.json(
        toJson({
          ...def,
          infoPage: {
            whatItMeans: def.plainExplanation,
            whenToUse: def.whenToUse,
            whenNotToUse: def.whenNotToUse ?? null,
            examples: def.examples,
            commonVatTreatment: def.commonVatCodes.map((c) => getVatCode(c)?.name ?? c),
            taxDeductible: def.taxDeductible ?? 'n/a',
            mayRequireCapitalization: def.capitalizationCandidate ?? false,
            commonMistakes: def.commonMistakes ?? [],
          },
        }),
      );
    },
  );

  // ── Dokumenter (opplasting/mobil) ────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/documents',
    requireAuth,
    requireOrgPermission('documents.upload'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            filename: z.string().min(1).max(300),
            mimeType: z.string().min(3).max(100),
            contentBase64: z.string().min(1),
            source: z.enum(['upload', 'mobile']).default('upload'),
          })
          .parse(req.body);
        const content = Buffer.from(body.contentBase64, 'base64');
        if (content.length === 0 || content.length > MAX_UPLOAD_BYTES) {
          res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Filen er tom eller for stor (maks 15 MB).' },
          });
          return;
        }
        const vatStatus = await orgVatStatus(deps.db, req.params.orgId!);
        const result = await processIncomingDocument(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          source: body.source,
          filename: body.filename,
          mimeType: body.mimeType,
          content,
          vatStatus,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const params: unknown[] = [req.params.orgId];
        let where = 'organization_id = $1';
        if (status) {
          params.push(status);
          where += ` AND status = $2`;
        }
        const result = await deps.db.query(
          `SELECT id, source, filename, mime_type, sha256, status, duplicate_of, created_at
           FROM source_documents WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
          params,
        );
        res.json(toJson(result.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents/:documentId',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const doc = await deps.db.query(
          `SELECT * FROM source_documents WHERE id = $1 AND organization_id = $2`,
          [req.params.documentId, req.params.orgId],
        );
        if (!doc.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        const extraction = await deps.db.query(
          // invoice_date også som ::text: DATE lest via SELECT * blir et JS Date som
          // under lokal tidssone kan skli en dag ved konvertering. Regeloppslag
          // (satser per dato) skal alltid bruke den rene kalenderdatoen.
          `SELECT *, invoice_date::text AS invoice_date_text
           FROM extracted_document_data WHERE document_id = $1
           ORDER BY extraction_version DESC LIMIT 1`,
          [req.params.documentId],
        );
        // Krav 6: hvem godkjente/endret forslaget (aktørnavn slås opp mot users).
        const suggestions = await deps.db.query(
          `SELECT s.id, s.suggestion, s.engine, s.status, s.created_at,
                  s.decided_by, s.decided_at, s.decision_note,
                  u.display_name AS decided_by_name, u.email AS decided_by_email
           FROM posting_suggestions s
           LEFT JOIN users u ON u.id = s.decided_by
           WHERE s.document_id = $1 ORDER BY s.created_at DESC`,
          [req.params.documentId],
        );
        // «Hvorfor foreslår dere dette?» — forklaring med kilder fra regelregisteret.
        const latest = suggestions.rows[0];
        const org = await deps.db.query(
          `SELECT org_form, vat_status FROM organizations WHERE id = $1`,
          [req.params.orgId],
        );
        const ex = extraction.rows[0];
        // Fremmed valuta: hent Norges Bank-kurs for bilagsdatoen, gjør konsekvensen
        // beregnbar i NOK og la klienten forhåndsutfylle kursen ved bokføring.
        const impIsoDate: string = ex?.invoice_date_text ?? new Date().toISOString().slice(0, 10);
        const rawGross = ex?.gross_minor === null || ex?.gross_minor === undefined ? null : BigInt(ex.gross_minor);
        let impactCurrency: string = ex?.currency ?? 'NOK';
        let impactGrossMinor: bigint | null = rawGross;
        let fxRate: { currency: string; rateDecimal: string; forDate: string; source: string } | null = null;
        if (latest && impactCurrency !== 'NOK' && rawGross !== null && deps.fxRates) {
          fxRate = await deps.fxRates.rate(impactCurrency, impIsoDate);
          if (fxRate) {
            impactGrossMinor = convertToNok(money(rawGross, impactCurrency), fxRate.rateDecimal).minorUnits;
            impactCurrency = 'NOK';
          }
        }
        const explanation = latest
          ? {
              evidence: latest.suggestion.evidence,
              assumptions: latest.suggestion.assumptions,
              missingInformation: latest.suggestion.missingInformation,
              alternatives: latest.suggestion.alternatives,
              confidence: latest.suggestion.confidence,
              rules: (latest.suggestion.ruleReferences as string[]).map((ruleId) => {
                const rule = deps.rules.getRule(ruleId);
                // Punkt 9: hvilken regelversjon som gjaldt på bilagsdatoen.
                let version: number | null = null;
                try {
                  version = deps.rules.getVersionAt(ruleId, ex?.invoice_date_text ?? new Date().toISOString().slice(0, 10)).version;
                } catch {
                  version = null;
                }
                return {
                  ruleId,
                  shortName: rule.shortName,
                  plainExplanation: rule.plainExplanation,
                  version,
                  lastReviewed: rule.lastReviewed,
                  sources: rule.sourceIds.map((sid) => {
                    const s = deps.rules.getSource(sid);
                    return { title: s.title, url: s.url, lastVerified: s.lastVerified };
                  }),
                };
              }),
              // Punkt 9: hvem/hva som gjorde vurderingen — motor og modellversjon.
              assessedBy: {
                suggestionEngine: latest.engine as string,
                extractionEngine: (ex?.extraction_engine as string | undefined) ?? null,
                aiModel: (ex?.extraction_engine as string | undefined)?.startsWith('claude')
                  ? deps.aiModel ?? 'claude-sonnet-4-6'
                  : null,
              },
              // Krav 4: hva forslaget betyr for mva, resultat og skatt — i kroner.
              impact: org.rowCount
                ? computeDocumentImpact(deps.rules, {
                    grossMinor: impactGrossMinor,
                    currency: impactCurrency,
                    vatCode: latest.suggestion.suggestedVatCode,
                    businessUsePercentage: latest.suggestion.businessUsePercentage,
                    capitalization: latest.suggestion.capitalizationAssessment,
                    orgForm: org.rows[0].org_form,
                    isoDate: impIsoDate,
                  })
                : null,
            }
          : null;
        // Krav 7: full historikk for bilaget og forslagene (append-only revisjonslogg).
        const entityIds = [req.params.documentId, ...suggestions.rows.map((s) => s.id)];
        const history = await deps.db.query(
          `SELECT a.action, a.occurred_at, a.reason, a.new_value, a.actor_role,
                  u.display_name AS actor_name, u.email AS actor_email
           FROM audit_events a
           LEFT JOIN users u ON u.id = a.actor_user_id
           WHERE a.organization_id = $1 AND a.entity_id = ANY($2::uuid[])
           ORDER BY a.occurred_at ASC`,
          [req.params.orgId, entityIds],
        );
        res.json(
          toJson({
            document: doc.rows[0],
            extraction: extraction.rows[0] ?? null,
            suggestions: suggestions.rows,
            explanation,
            history: history.rows,
            fxRate,
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Dokumentinnhold: kun for medlemmer med dokumenttilgang, med integritets-
  // kontroll (sha256) og audit-hendelse for hvert uthenting (bilag = sensitivt).
  app.get(
    '/api/organizations/:orgId/documents/:documentId/content',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.storage) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Objektlager er ikke konfigurert.' },
          });
          return;
        }
        const doc = await deps.db.query(
          `SELECT storage_key, sha256, filename, mime_type FROM source_documents
           WHERE id = $1 AND organization_id = $2`,
          [req.params.documentId, req.params.orgId],
        );
        if (!doc.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        const stored = await deps.storage.get(doc.rows[0].storage_key);
        if (!stored) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Innholdet finnes ikke i lageret.' } });
          return;
        }
        if (sha256Hex(stored.content) !== doc.rows[0].sha256) {
          // Integritetsbrudd skal aldri serveres stille.
          res.status(409).json({
            error: { code: 'INTEGRITY_VIOLATION', message: 'Innholdet stemmer ikke med registrert hash. Kontakt administrator.' },
          });
          return;
        }
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'document.content_accessed',
            entityType: 'source_document',
            entityId: req.params.documentId!,
          }),
        );
        res
          .set('Content-Type', doc.rows[0].mime_type)
          .set('Content-Disposition', `inline; filename="${encodeURIComponent(doc.rows[0].filename)}"`)
          .send(stored.content);
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/documents/:documentId/approve',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            suggestionId: z.string().uuid(),
            overrides: z
              .object({
                accountNumber: z.string().regex(/^\d{4}$/).optional(),
                vatCode: z.string().optional(),
                businessUsePercentage: z.number().int().min(0).max(100).optional(),
                project: z.string().min(1).max(30).optional(),
                department: z.string().min(1).max(30).optional(),
              })
              .optional(),
            exchangeRate: z
              .object({ rateDecimal: z.string().regex(/^\d+([.,]\d+)?$/), source: z.string().min(1) })
              .optional(),
            postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const entry = await approveAndPost(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          actorRoleVerified: true,
          documentId: req.params.documentId!,
          suggestionId: body.suggestionId,
          ...(body.overrides ? { overrides: body.overrides } : {}),
          ...(body.exchangeRate ? { exchangeRate: body.exchangeRate } : {}),
          ...(body.postingDate ? { postingDate: body.postingDate } : {}),
        });
        // Åpent integrasjonslag: varsle abonnenter om ny postering.
        await emitEvent(deps.db, {
          organizationId: req.params.orgId!,
          event: 'journal_entry.posted',
          data: { entryId: entry.id, entryNumber: entry.entryNumber, entryDate: entry.entryDate, documentId: req.params.documentId },
        });
        kickDelivery(deps.db);
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Gmail-import (sandbox) ───────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/gmail/import',
    requireAuth,
    requireOrgPermission('integrations.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            labels: z.array(z.string().min(1)).max(20),
            senders: z.array(z.string()).optional(),
            afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            beforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const gmail = (deps.gmailAdapterFactory ?? (() => new SandboxGmailAdapter()))();
        const vatStatus = await orgVatStatus(deps.db, req.params.orgId!);
        const summary = await ingestFromGmail(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          gmail,
          filter: {
            labels: body.labels,
            keywords: ['invoice', 'receipt', 'kvittering', 'faktura', 'kreditnota', 'credit note'],
            ...(body.senders ? { senders: body.senders } : {}),
            ...(body.afterDate ? { afterDate: body.afterDate } : {}),
            ...(body.beforeDate ? { beforeDate: body.beforeDate } : {}),
          },
          vatStatus,
        });
        res.json(toJson({ ...summary, integrationMode: deps.gmailMode ?? 'sandbox' }));
      } catch (err) {
        next(err);
      }
    },
  );

  // Smart skanning: les e-post (IMAP), la det smarte filteret avgjøre hva som er
  // bilag, og returner en KLASSIFISERT liste (import/review/skip) UTEN å bokføre.
  // Mennesket bekrefter hva som faktisk skal hentes inn.
  app.post(
    '/api/organizations/:orgId/gmail/scan',
    requireAuth,
    requireOrgPermission('integrations.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            labels: z.array(z.string().min(1)).min(1).max(20),
            senders: z.array(z.string()).optional(),
            afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const gmail = (deps.gmailAdapterFactory ?? (() => new SandboxGmailAdapter()))();
        const messages = await gmail.searchMessages({
          labels: body.labels,
          keywords: BILAG_KEYWORDS,
          ...(body.senders ? { senders: body.senders } : {}),
          ...(body.afterDate ? { afterDate: body.afterDate } : {}),
        });
        const filter = new SmartGmailFilter(deps.emailClassifier);
        // Vurder inntil 60 e-poster, 6 om gangen (responsiv + sparer AI-kall).
        const capped = messages.slice(0, 60);
        const verdicts: unknown[] = [];
        let skipped = 0;
        for (let i = 0; i < capped.length; i += 6) {
          const batch = capped.slice(i, i + 6);
          const results = await Promise.all(
            batch.map(async (m) => {
              const signals: EmailSignals = {
                from: m.from,
                subject: m.subject,
                snippet: m.snippet,
                attachmentNames: m.attachments.map((a) => a.filename),
                hasPdf: m.attachments.some((a) => a.mimeType === 'application/pdf'),
              };
              const v = await filter.evaluate(signals);
              return { message: m, verdict: v };
            }),
          );
          for (const r of results) {
            if (r.verdict.decision === 'skip') {
              skipped++;
              continue;
            }
            verdicts.push({
              messageId: r.message.messageId,
              from: r.message.from,
              subject: r.message.subject,
              date: r.message.date,
              attachments: r.message.attachments.map((a) => ({ filename: a.filename, mimeType: a.mimeType })),
              decision: r.verdict.decision,
              confidence: r.verdict.confidence,
              documentType: r.verdict.documentType,
              vendorGuess: r.verdict.vendorGuess ?? null,
              reason: r.verdict.reason,
              source: r.verdict.source,
            });
          }
        }
        // import øverst, deretter review; høyest konfidens først.
        verdicts.sort((a, b) => {
          const av = a as { decision: string; confidence: number };
          const bv = b as { decision: string; confidence: number };
          if (av.decision !== bv.decision) return av.decision === 'import' ? -1 : 1;
          return bv.confidence - av.confidence;
        });
        res.json(
          toJson({
            scanned: messages.length,
            candidates: verdicts,
            skipped,
            mode: deps.gmailMode ?? 'sandbox',
            aiFilter: Boolean(deps.emailClassifier?.available),
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Importer KUN de valgte meldingene fra en smart skanning → gjennom bilags-pipelinen.
  app.post(
    '/api/organizations/:orgId/gmail/import-selected',
    requireAuth,
    requireOrgPermission('integrations.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            labels: z.array(z.string().min(1)).min(1).max(20),
            messageIds: z.array(z.string().min(1)).min(1).max(200),
            senders: z.array(z.string()).optional(),
            afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const gmail = (deps.gmailAdapterFactory ?? (() => new SandboxGmailAdapter()))();
        const vatStatus = await orgVatStatus(deps.db, req.params.orgId!);
        const summary = await ingestFromGmail(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          gmail,
          filter: {
            labels: body.labels,
            keywords: BILAG_KEYWORDS,
            ...(body.senders ? { senders: body.senders } : {}),
            ...(body.afterDate ? { afterDate: body.afterDate } : {}),
          },
          vatStatus,
          onlyMessageIds: body.messageIds,
        });
        res.json(toJson({ ...summary, integrationMode: deps.gmailMode ?? 'sandbox' }));
      } catch (err) {
        next(err);
      }
    },
  );

  // Probe-bar helsesjekk for CreatorHub Control Center (og andre overvåkere).
  // Bevisst UTEN auth: kun grove booleans + overordnet status, ingen secrets og
  // ingen mutasjon (SELECT 1). Detaljert integrasjonsstatus ligger auth-gated på
  // /api/integrations/status. 200 = frisk, 503 = database nede (så en HTTP-probe
  // ser den som «down»).
  app.get('/api/health', async (_req, res) => {
    const started = Date.now();
    let dbUp = false;
    let dbDetail = 'ukjent';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        await deps.db.query('SELECT 1');
        dbUp = true;
        dbDetail = `SELECT 1 · ${Date.now() - started} ms`;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      dbDetail = err instanceof Error ? err.message : 'databasefeil';
      deps.errorMonitor?.capture(err);
    }
    const integrations = {
      database: dbUp,
      brreg: Boolean(deps.vatRegister),
      lovdata: Boolean(deps.legalText?.hasApiKey),
      lovdataPublicData: Boolean(deps.legalText),
      ocr: Boolean(deps.ocrStatus?.tesseract),
      aiExtraction: Boolean(deps.aiExtraction),
      mvaSubmission: Boolean(deps.vatSubmission?.active),
      errorMonitoring: Boolean(deps.errorMonitor?.active),
      stripeSync: Boolean(deps.stripe?.hasApiKey),
      bankFeed: Boolean(deps.bankFeed?.configured),
      gmail: false, // alltid sandbox i MVP
    };
    const status = dbUp ? 'ok' : 'down';
    res.status(dbUp ? 200 : 503).json({
      service: 'reknaren',
      status,
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
      database: { up: dbUp, detail: dbDetail },
      integrations,
    });
  });

  // KI-transparens: hvor og hvordan Reknaren bruker kunstig intelligens.
  app.get('/api/ai/disclosure', requireAuth, (_req, res) => {
    res.json(
      buildAiDisclosure({
        aiExtraction: Boolean(deps.aiExtraction),
        aiModel: deps.aiModel ?? 'claude-sonnet-4-6',
        emailScanningActive: deps.gmailMode === 'imap',
      }),
    );
  });

  app.get('/api/integrations/status', requireAuth, (_req, res) => {
    res.json({
      gmail:
        deps.gmailMode === 'imap'
          ? {
              mode: 'imap',
              active: true,
              note: 'Ekte Gmail-lesing via IMAP med app-passord (gmail.readonly-ekvivalent). Skanner kun valgte etiketter; smart filter avgjør hvilke vedlegg som er bilag.',
            }
          : {
              mode: 'sandbox',
              active: false,
              note: 'Gmail kjører mot sandbox-adapter. Ekte lesing krever REKNAREN_SMTP_USER + app-passord (IMAP).',
            },
      bank: deps.bankFeed?.configured
        ? {
            mode: `psd2_${deps.bankFeed.name}`,
            active: true,
            note: `Automatisk bank-feed via ${deps.bankFeed.name} (PSD2). Transaksjoner hentes og kjøres gjennom samme idempotente import + deterministiske matching som CSV. Manuell CSV-import er fortsatt tilgjengelig.`,
          }
        : {
            mode: 'manual_csv',
            active: true,
            note: 'Manuell CSV-import med deterministisk matching. Ingen PSD2-/open banking-tilkobling (sett Enable Banking- eller GoCardless-legitimasjon for automatisk feed).',
          },
      ocr: deps.aiExtraction
        ? { mode: 'ai_claude', active: true, note: 'AI-bilagslesing (Claude vision) aktiv: foto/PDF → strukturerte felt. Sumvalidering + menneskelig godkjenning uendret; avvik går til kontrollkø.' }
        : deps.ocrStatus?.tesseract
          ? { mode: 'tesseract', active: true, note: `Tesseract (nor+eng) for bilder${deps.ocrStatus.pdftotext ? ', pdftotext for PDF' : ''}. Kvalitet avhenger av bildekvalitet — avvik går til kontrollkø.` }
          : { mode: 'deterministic_text', active: false, note: 'Verken AI (REKNAREN_ANTHROPIC_API_KEY) eller tesseract-ocr er tilgjengelig — kun tekstbaserte bilag tolkes.' },
      brreg: deps.vatRegister
        ? { mode: 'open_api', active: true, note: 'Oppslag mot Enhetsregisteret (data.brreg.no) for MVA-registerkontroll. Åpne data, ingen nøkkel.' }
        : { mode: 'not_configured', active: false, note: 'MVA-registerkontroll er ikke konfigurert i dette miljøet.' },
      lovdata: deps.legalText
        ? deps.legalText.hasApiKey
          ? {
              mode: 'api_key',
              active: true,
              note: 'Lovdata API-nøkkel er konfigurert. Per-paragraf lovtekst-oppslag (renderRefID) og åpne NLOD-bulkdatasett er tilgjengelig.',
              openPublicData: true,
            }
          : {
              mode: 'public_data_only',
              // Målet — å hente lovteksten bak en enkelt paragraf — krever nøkkel,
              // så per-paragraf-oppslaget er IKKE aktivt. Det åpne bulk-datasettet
              // (gjeldende-lover.tar.bz2, NLOD 2.0) er derimot tilgjengelig uten nøkkel.
              active: false,
              note: 'Ingen Lovdata API-nøkkel (REKNAREN_LOVDATA_API_KEY). Åpne NLOD-bulkdatasett er tilgjengelig uten nøkkel, men per-paragraf lovtekst-oppslag (renderRefID/lookup) krever X-API-Key og er derfor ikke aktivt.',
              openPublicData: true,
            }
        : { mode: 'not_configured', active: false, note: 'Lovdata-klient er ikke konfigurert i dette miljøet.' },
      ehf: deps.peppol?.configured
        ? {
            mode: 'peppol_access_point',
            active: true,
            note: 'EHF (PEPPOL BIS Billing 3.0) UBL-XML kan genereres OG sendes via konfigurert aksesspunkt.',
          }
        : {
            mode: 'xml_export_only',
            active: true,
            note: 'EHF (PEPPOL BIS Billing 3.0) UBL-XML kan genereres og lastes ned (…/invoices/:id/ehf). Overføring via aksesspunkt er ikke konfigurert — last opp XML-en hos ditt aksesspunkt.',
          },
      altinn: deps.vatSubmission
        ? deps.vatSubmission.active
          ? {
              mode: 'maskinporten',
              active: true,
              note: `MVA-melding-innsending via Maskinporten (${deps.vatSubmission.env}) er konfigurert. Meldinger valideres mot Skatteetatens grensesnittstøtte før innsending.`,
            }
          : {
              // Maskinporten-legitimasjon mangler ⇒ vat.submit-gapet er IKKE lukket.
              // Ingen sandbox utgis for aktiv tilkobling.
              mode: 'awaiting_maskinporten',
              active: false,
              note: 'MVA-melding-innsending er kodet, men ikke aktiv: Maskinporten-legitimasjon (MASKINPORTEN_CLIENT_ID/SCOPE/PRIVATE_KEY/KEY_ID) mangler. MVA-rapporten forblir kladd til dette er på plass.',
            }
        : { mode: 'not_implemented', active: false },
      sentry: deps.errorMonitor
        ? {
            mode: deps.errorMonitor.active ? 'sentry' : 'not_configured',
            active: deps.errorMonitor.active,
            note: deps.errorMonitor.active
              ? 'Feilovervåking aktiv — kun uventede serverfeil (5xx) rapporteres.'
              : 'Feilovervåking ikke aktiv: SENTRY_DSN mangler.',
          }
        : { mode: 'not_configured', active: false, note: 'Feilovervåking ikke konfigurert i dette miljøet.' },
      stripe: deps.stripe
        ? {
            mode: deps.stripe.hasApiKey ? 'read_sync' : 'not_configured',
            active: deps.stripe.hasApiKey,
            note: deps.stripe.hasApiKey
              ? 'Stripe-inntektssynk aktiv (kun lesing). Betalte fakturaer → kunde + UTKAST-salgsfaktura til godkjenning.'
              : 'Stripe-inntektssynk ikke aktiv: REKNAREN_STRIPE_SECRET_KEY mangler.',
          }
        : { mode: 'not_configured', active: false, note: 'Stripe-inntektssynk ikke konfigurert i dette miljøet.' },
      email: deps.email
        ? {
            mode: deps.email.configured ? 'active' : 'not_configured',
            active: deps.email.configured,
            note: deps.email.configured
              ? 'Utgående e-post aktiv (SMTP/Gmail eller Resend) — brukes til betalingspåminnelser.'
              : 'Utgående e-post ikke aktiv: mangler SMTP (REKNAREN_SMTP_USER/PASSWORD) eller Resend + REKNAREN_REMINDER_FROM.',
          }
        : { mode: 'not_configured', active: false, note: 'Utgående e-post ikke konfigurert i dette miljøet.' },
    });
  });

  // Betalingspåminnelser: send purring på forfalte, utstedte fakturaer. (Stripe-
  // abonnement dunes av Stripe selv.) Krever konfigurert e-postsender.
  app.post(
    '/api/organizations/:orgId/invoices/reminders/send',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.email || !deps.email.configured) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message: 'Utgående e-post er ikke konfigurert (REKNAREN_RESEND_API_KEY + REKNAREN_REMINDER_FROM mangler).',
            },
          });
          return;
        }
        const q = z
          .object({
            asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            minDaysBetween: z.number().int().min(1).max(90).optional(),
          })
          .parse(req.body ?? {});
        const summary = await sendInvoiceReminders(deps.db, deps.email, {
          organizationId: req.params.orgId!,
          asOfDate: q.asOf ?? new Date().toISOString().slice(0, 10),
          ...(q.minDaysBetween ? { minDaysBetween: q.minDaysBetween } : {}),
        });
        res.json(toJson(summary));
      } catch (err) {
        next(err);
      }
    },
  );

  // Stripe → regnskap: registrer betalende kunder + utkast-salgsfaktura. Kun LES
  // mot Stripe; utkast bokføres ikke før mennesket utsteder.
  app.post(
    '/api/organizations/:orgId/integrations/stripe/sync',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.stripe || !deps.stripe.hasApiKey) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message: 'Stripe-inntektssynk er ikke konfigurert (REKNAREN_STRIPE_SECRET_KEY mangler).',
            },
          });
          return;
        }
        const q = z
          .object({
            since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            vatCode: z.string().min(1).max(4).optional(),
            revenueAccount: z.string().regex(/^\d{4}$/).optional(),
          })
          .parse(req.body ?? {});
        const summary = await syncStripeRevenue(deps.db, deps.rules, deps.stripe, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ...(q.since ? { sinceUnix: Math.floor(new Date(q.since + 'T00:00:00Z').getTime() / 1000) } : {}),
          ...(q.vatCode ? { vatCode: q.vatCode } : {}),
          ...(q.revenueAccount ? { revenueAccount: q.revenueAccount } : {}),
        });
        res.json(toJson(summary));
      } catch (err) {
        next(err);
      }
    },
  );

  // Detaljer på hva kundene har betalt for: importerte Stripe-betalinger med
  // kunde, beløp, produkt, faktureringsperiode, lenke til Stripe-kvitteringen og
  // de itemiserte utkast-linjene (hva). Kun lesing.
  app.get(
    '/api/organizations/:orgId/integrations/stripe/payments',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT si.stripe_invoice_id, si.stripe_number, si.hosted_invoice_url,
                  si.amount_minor::TEXT AS amount_minor, si.currency, si.source_product,
                  si.status, si.imported_at, si.period_start, si.period_end,
                  si.invoice_id, c.name AS customer_name, c.email AS customer_email,
                  COALESCE((
                    SELECT json_agg(json_build_object(
                             'description', il.description,
                             'netMinor', il.net_minor::TEXT,
                             'product', il.project) ORDER BY il.id)
                    FROM invoice_lines il WHERE il.invoice_id = si.invoice_id
                  ), '[]'::json) AS lines
           FROM stripe_imports si
           LEFT JOIN customers c ON c.id = si.customer_id
           WHERE si.organization_id = $1
           ORDER BY si.imported_at DESC
           LIMIT 500`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  // Hodeløs Stripe-synk for cron/scheduler — token-autentisert (ingen sesjon).
  // Sikrer at Creatorhubs org + system-bruker finnes, og synker betalte Stripe-
  // fakturaer → kunde + utkast-faktura. Løser at prod-appen mangler interaktiv
  // innlogging: automatiske jobber trenger ikke et menneske for å registrere
  // betalende kunder. Utkast bokføres fortsatt ikke før mennesket utsteder.
  app.post('/api/cron/stripe-sync', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      if (!secret || secret.length < 16) {
        res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler eller er for kort.' } });
        return;
      }
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      const a = Buffer.from(secret);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } });
        return;
      }
      if (!deps.stripe || !deps.stripe.hasApiKey) {
        res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'Stripe er ikke konfigurert (REKNAREN_STRIPE_SECRET_KEY mangler).' } });
        return;
      }
      if (!deps.bootstrapOrg) {
        res.status(503).json({ error: { code: 'ORG_NOT_CONFIGURED', message: 'Bootstrap-org er ikke konfigurert (REKNAREN_ORG_NUMBER/REKNAREN_ORG_NAME mangler).' } });
        return;
      }
      const q = z
        .object({
          since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          vatCode: z.string().min(1).max(4).optional(),
          revenueAccount: z.string().regex(/^\d{4}$/).optional(),
        })
        .parse(req.body ?? {});
      const boot = await ensureBootstrapOrg(deps.db, deps.bootstrapOrg);
      const summary = await syncStripeRevenue(deps.db, deps.rules, deps.stripe, {
        organizationId: boot.orgId,
        actor: { userId: boot.userId, role: 'owner' },
        ...(q.since ? { sinceUnix: Math.floor(new Date(q.since + 'T00:00:00Z').getTime() / 1000) } : {}),
        ...(q.vatCode ? { vatCode: q.vatCode } : {}),
        ...(q.revenueAccount ? { revenueAccount: q.revenueAccount } : {}),
      });
      res.json(toJson({ organizationId: boot.orgId, createdOrg: boot.createdOrg, ...summary }));
    } catch (err) {
      next(err);
    }
  });

  // Hodeløs, planlagt e-postskanning — token-autentisert. Sikrer org, skanner Gmail
  // med det smarte filteret, og henter automatisk inn de e-postene filteret er SIKRE
  // på er bilag (til bilagsinnboksen for kontroll — bokfører ingenting selv).
  app.post('/api/cron/gmail-scan', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      if (!secret || secret.length < 16) {
        res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler eller er for kort.' } });
        return;
      }
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      const a = Buffer.from(secret);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } });
        return;
      }
      if (!deps.bootstrapOrg) {
        res.status(503).json({ error: { code: 'ORG_NOT_CONFIGURED', message: 'Bootstrap-org er ikke konfigurert.' } });
        return;
      }
      if (deps.gmailMode !== 'imap') {
        res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'Ekte Gmail (IMAP) er ikke konfigurert.' } });
        return;
      }
      const q = z.object({ labels: z.array(z.string().min(1)).min(1).max(20).optional(), afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
      const labels = q.labels ?? ['INBOX'];
      const boot = await ensureBootstrapOrg(deps.db, deps.bootstrapOrg);
      const gmail = (deps.gmailAdapterFactory ?? (() => new SandboxGmailAdapter()))();
      const messages = await gmail.searchMessages({ labels, keywords: BILAG_KEYWORDS, ...(q.afterDate ? { afterDate: q.afterDate } : {}) });
      const filter = new SmartGmailFilter(deps.emailClassifier);
      const importIds: string[] = [];
      const capped = messages.slice(0, 80);
      for (let i = 0; i < capped.length; i += 8) {
        const batch = capped.slice(i, i + 8);
        const verdicts = await Promise.all(
          batch.map(async (m) => {
            const signals: EmailSignals = {
              from: m.from,
              subject: m.subject,
              snippet: m.snippet,
              attachmentNames: m.attachments.map((att) => att.filename),
              hasPdf: m.attachments.some((att) => att.mimeType === 'application/pdf'),
            };
            return { id: m.messageId, v: await filter.evaluate(signals) };
          }),
        );
        for (const r of verdicts) if (r.v.decision === 'import') importIds.push(r.id);
      }
      const vatStatus = await orgVatStatus(deps.db, boot.orgId);
      const summary =
        importIds.length > 0
          ? await ingestFromGmail(pipelineDeps, {
              organizationId: boot.orgId,
              actor: { userId: boot.userId, role: 'owner' },
              gmail,
              filter: { labels, keywords: BILAG_KEYWORDS, ...(q.afterDate ? { afterDate: q.afterDate } : {}) },
              vatStatus,
              onlyMessageIds: importIds,
            })
          : { scannedMessages: messages.length, importedDocuments: [], connectionState: 'active' as const };
      res.json(
        toJson({
          organizationId: boot.orgId,
          scanned: messages.length,
          confidentBilag: importIds.length,
          importedDocuments: summary.importedDocuments.length,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  // Hodeløs betalingspåminnelse for cron — token-autentisert. Sikrer org, sender
  // purring på forfalte utstedte fakturaer via e-postporten. Ingen sesjon.
  app.post('/api/cron/reminders', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      if (!secret || secret.length < 16) {
        res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler eller er for kort.' } });
        return;
      }
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      const a = Buffer.from(secret);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } });
        return;
      }
      if (!deps.email || !deps.email.configured) {
        res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'Utgående e-post er ikke konfigurert.' } });
        return;
      }
      if (!deps.bootstrapOrg) {
        res.status(503).json({ error: { code: 'ORG_NOT_CONFIGURED', message: 'Bootstrap-org er ikke konfigurert.' } });
        return;
      }
      const q = z
        .object({
          asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          minDaysBetween: z.number().int().min(1).max(90).optional(),
        })
        .parse(req.body ?? {});
      const boot = await ensureBootstrapOrg(deps.db, deps.bootstrapOrg);
      const summary = await sendInvoiceReminders(deps.db, deps.email, {
        organizationId: boot.orgId,
        asOfDate: q.asOf ?? new Date().toISOString().slice(0, 10),
        ...(q.minDaysBetween ? { minDaysBetween: q.minDaysBetween } : {}),
      });
      res.json(toJson(summary));
    } catch (err) {
      next(err);
    }
  });

  // ── Rapporter ────────────────────────────────────────────────────────────
  const reportQuery = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  app.get(
    '/api/organizations/:orgId/reports/trial-balance',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        const rows = await trialBalance(deps.db, {
          organizationId: req.params.orgId!,
          ...(q.from ? { fromDate: q.from } : {}),
          ...(q.to ? { toDate: q.to } : {}),
        });
        res.json(toJson(rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/income-statement',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        res.json(
          toJson(
            await incomeStatement(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/balance-sheet',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        res.json(
          toJson(
            await balanceSheet(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/general-ledger',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery
          .extend({ account: z.string().regex(/^\d{4}$/).optional() })
          .parse(req.query);
        res.json(
          toJson(
            await generalLedger(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.account ? { accountNumber: q.account } : {}),
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/subledger/:kind',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const kind = z.enum(['vendors', 'customers']).parse(req.params.kind);
        res.json(toJson(await subledger(deps.db, req.params.orgId!, kind)));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── MVA og skatt ─────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/vat/report',
    requireAuth,
    requireOrgPermission('vat.view'),
    async (req, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        res.json(toJson(await buildVatReport(deps.db, req.params.orgId!, q.from, q.to)));
      } catch (err) {
        next(err);
      }
    },
  );

  // MVA-registreringsterskel: løpende 12-mnd avgiftspliktig omsetning mot 50 000 kr.
  app.get(
    '/api/organizations/:orgId/vat/threshold',
    requireAuth,
    requireOrgPermission('vat.view'),
    async (req, res, next) => {
      try {
        const q = z
          .object({ asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
          .parse(req.query);
        const asOf = q.asOf ?? new Date().toISOString().slice(0, 10);
        const [threshold, org] = await Promise.all([
          vatRegistrationThreshold(deps.db, { organizationId: req.params.orgId!, asOf }),
          deps.db.query(`SELECT vat_status FROM organizations WHERE id = $1`, [req.params.orgId]),
        ]);
        res.json(
          toJson({
            ...threshold,
            vatStatus: org.rows[0]?.vat_status ?? 'not_registered',
            altinnActive: Boolean(deps.vatSubmission?.active),
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // MVA-meldingen som XML (Skatteetatens format). Alltid tilgjengelig — kan lastes ned
  // og lastes opp manuelt i Altinn, eller sendes automatisk via Maskinporten når aktiv.
  app.get(
    '/api/organizations/:orgId/vat/mva-melding/xml',
    requireAuth,
    requireOrgPermission('vat.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const q = z
          .object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
          .parse(req.query);
        const report = await buildVatReport(deps.db, req.params.orgId!, q.from, q.to);
        const orgNumber = (await deps.db.query(`SELECT org_number FROM organizations WHERE id = $1`, [req.params.orgId])).rows[0]?.org_number as string | undefined;
        if (!orgNumber || !/^\d{9}$/.test(orgNumber)) {
          res.status(400).json({ error: { code: 'ORG_NUMBER_MISSING', message: 'Virksomheten mangler et gyldig organisasjonsnummer (9 sifre) — kreves i mva-meldingen. Fyll inn under Virksomhet.' } });
          return;
        }
        const xml = buildMvaMeldingXml(report, { orgNumber });
        res.setHeader('Content-Disposition', `attachment; filename="mva-melding_${q.from}_${q.to}.xml"`);
        res.type('application/xml').send(xml);
      } catch (err) {
        next(err);
      }
    },
  );

  // Valider MVA-meldingen mot Skatteetatens grensesnittstøtte. Krever et ID-porten-
  // token (pålogget bruker via BankID) — Skatteetatens API godtar ikke Maskinporten.
  app.post(
    '/api/organizations/:orgId/vat/mva-melding/validate',
    requireAuth,
    requireOrgPermission('vat.submit'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.idporten || !deps.idporten.configured) {
          res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'ID-porten er ikke konfigurert. Last ned XML og last opp i Altinn i mellomtiden.' } });
          return;
        }
        const token = await getValidAccessToken(deps.db, deps.idporten, req.params.orgId!);
        if (!token) {
          res.status(401).json({ error: { code: 'IDPORTEN_LOGIN_REQUIRED', message: 'Logg inn hos Skatteetaten (BankID) først.' } });
          return;
        }
        const body = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
        const orgNumber = (await deps.db.query(`SELECT org_number FROM organizations WHERE id = $1`, [req.params.orgId])).rows[0]?.org_number as string | undefined;
        if (!orgNumber || !/^\d{9}$/.test(orgNumber)) {
          res.status(400).json({ error: { code: 'ORG_NUMBER_MISSING', message: 'Virksomheten mangler et gyldig organisasjonsnummer (9 sifre).' } });
          return;
        }
        const report = await buildVatReport(deps.db, req.params.orgId!, body.from, body.to);
        const result = await validateMvaMeldingWithToken({ report, orgNumber, accessToken: token, env: deps.idporten.env });
        res.json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── ID-porten OIDC for mva-melding (BankID-innlogging) ────────────────────
  app.post('/api/organizations/:orgId/idporten/login', requireAuth, requireOrgPermission('vat.submit'), async (req: AuthedRequest, res, next) => {
    try {
      if (!deps.idporten || !deps.idporten.configured) { res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'ID-porten er ikke konfigurert.' } }); return; }
      const state = randomToken();
      const nonce = randomToken();
      const pkce = generatePkce();
      await saveLoginState(deps.db, { state, organizationId: req.params.orgId!, codeVerifier: pkce.verifier, nonce, userId: req.auth!.userId });
      res.json({ authorizeUrl: deps.idporten.buildAuthorizeUrl({ state, nonce, codeChallenge: pkce.challenge }) });
    } catch (err) { next(err); }
  });
  app.get('/api/organizations/:orgId/idporten/status', requireAuth, requireOrgPermission('vat.view'), async (req: AuthedRequest, res, next) => {
    try {
      const status = await idportenStatus(deps.db, req.params.orgId!);
      res.json(toJson({ configured: Boolean(deps.idporten?.configured), env: deps.idporten?.env ?? null, ...status }));
    } catch (err) { next(err); }
  });
  // Redirect-mål etter BankID-innlogging (UAUTENTISERT browser-navigasjon).
  app.get('/idporten/callback', async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const code = typeof q.code === 'string' ? q.code : '';
      const state = typeof q.state === 'string' ? q.state : '';
      const page = (title: string, body: string) => `<!doctype html><html lang="nb"><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:520px;margin:64px auto;text-align:center"><h2>${title}</h2><p>${body}</p><p><a href="/">Tilbake til Reknaren</a></p></body></html>`;
      if (!code || !state || !deps.idporten?.configured) { res.status(400).type('html').send(page('Innlogging feilet', 'Mangler kode/state, eller ID-porten er ikke konfigurert.')); return; }
      const st = await takeLoginState(deps.db, state);
      if (!st) { res.status(400).type('html').send(page('Innlogging utløpt', 'Prøv å logge inn på nytt fra Reknaren.')); return; }
      const tokens = await deps.idporten.exchangeCode({ code, codeVerifier: st.codeVerifier });
      await saveSession(deps.db, st.organizationId, tokens);
      res.type('html').send(page('Logget inn hos Skatteetaten ✓', 'Du kan lukke dette vinduet og gå tilbake til Reknaren for å validere/sende mva-meldingen.'));
    } catch (err) { next(err); }
  });

  // Send inn MVA-meldingen til Skatteetaten (Altinn 3 via Maskinporten).
  app.post(
    '/api/organizations/:orgId/vat/mva-melding/submit',
    requireAuth,
    requireOrgPermission('vat.submit'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.vatSubmission || !deps.vatSubmission.active) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message: 'MVA-melding-innsending er ikke aktivert (Maskinporten-tilgang mangler).',
            },
          });
          return;
        }
        const body = z
          .object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
          .parse(req.body);
        const orgRow = await deps.db.query(`SELECT org_number FROM organizations WHERE id = $1`, [req.params.orgId]);
        const orgNumber = orgRow.rows[0]?.org_number;
        if (!orgNumber) {
          res.status(400).json({ error: { code: 'ORG_NUMBER_MISSING', message: 'Virksomheten mangler organisasjonsnummer — kreves for innsending.' } });
          return;
        }
        const report = await buildVatReport(deps.db, req.params.orgId!, body.from, body.to);
        try {
          const receipt = await deps.vatSubmission.submit(report, { orgNumber });
          await withTransaction(deps.db, (client) =>
            recordAuditEvent(client, {
              organizationId: req.params.orgId!,
              actor: { userId: req.auth!.userId, role: req.orgRole! },
              action: 'vat.mva_melding_submitted',
              entityType: 'organization',
              entityId: req.params.orgId!,
              newValue: { from: body.from, to: body.to, reference: receipt.reference, status: receipt.status },
            }),
          );
          res.status(201).json(toJson(receipt));
        } catch (e) {
          if (e instanceof MaskinportenError) {
            res.status(502).json({ error: { code: 'ALTINN_SUBMISSION_FAILED', message: e.message } });
            return;
          }
          throw e;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  // Regnskapshelse — «har du gjort en feil?». Ren lesing, plain-språk + hurtigknapper.
  app.get(
    '/api/organizations/:orgId/health-check',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(toJson(await runHealthCheck(deps.db, { organizationId: req.params.orgId!, asOf })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Automatisk valutakurs fra Norges Bank for en valuta på en dato.
  app.get(
    '/api/organizations/:orgId/fx-rate',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const currency = String(req.query.currency ?? '').toUpperCase();
        const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
          ? req.query.date
          : new Date().toISOString().slice(0, 10);
        if (!/^[A-Z]{3}$/.test(currency)) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ugyldig valutakode.' } });
          return;
        }
        if (!deps.fxRates) {
          res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'Valutakurs-oppslag er ikke konfigurert.' } });
          return;
        }
        const rate = await deps.fxRates.rate(currency, date);
        if (!rate) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: `Fant ingen kurs for ${currency}.` } });
          return;
        }
        res.json(toJson(rate));
      } catch (err) {
        next(err);
      }
    },
  );

  // «Spør virksomheten» — naturlig-språk-spørsmål, svar forankret i hovedboken.
  app.get(
    '/api/organizations/:orgId/ask',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const question = String(req.query.q ?? '').trim();
        if (!question) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Skriv et spørsmål.' } });
          return;
        }
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(toJson(await answerQuestion(deps.db, deps.rules, { organizationId: req.params.orgId!, question, asOf })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Kunde-/leverandørrisiko — Enhetsregister-oppslag med kildeforklarte signaler.
  app.get(
    '/api/organizations/:orgId/company-risk',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const orgNumber = String(req.query.orgNumber ?? '').replace(/\s/g, '');
        if (!/^\d{9}$/.test(orgNumber)) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Organisasjonsnummer må være 9 sifre.' } });
          return;
        }
        if (!deps.companyRegistry) {
          res.status(503).json({ error: { code: 'INTEGRATION_UNAVAILABLE', message: 'Enhetsregister-oppslag er ikke konfigurert.' } });
          return;
        }
        const profile = await deps.companyRegistry.lookup(orgNumber);
        const asOf = new Date().toISOString().slice(0, 10);
        const invoiceHasVat = req.query.invoiceHasVat === 'true';
        res.json(toJson(assessCompanyRisk(orgNumber, profile, { checkedAt: asOf, invoiceHasVat })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Avtaler / inntektsplaner — CRUD + review (fakturaplan, tapt inntekt, oppsigelse).
  app.get(
    '/api/organizations/:orgId/agreements',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        res.json(toJson(await listAgreements(deps.db, req.params.orgId!)));
      } catch (err) {
        next(err);
      }
    },
  );
  app.post(
    '/api/organizations/:orgId/agreements',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            customerId: z.string().uuid(),
            name: z.string().min(1).max(200),
            amountMinor: z.string(),
            cadence: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
            noticeMonths: z.number().int().min(0).max(24).optional(),
          })
          .parse(req.body);
        const id = await createAgreement(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          customerId: body.customerId,
          name: body.name,
          amountMinor: BigInt(body.amountMinor),
          cadence: body.cadence,
          startDate: body.startDate,
          endDate: body.endDate ?? null,
          ...(body.noticeMonths !== undefined ? { noticeMonths: body.noticeMonths } : {}),
        });
        res.status(201).json({ id });
      } catch (err) {
        next(err);
      }
    },
  );
  app.get(
    '/api/organizations/:orgId/agreements/review',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(toJson(await reviewAgreements(deps.db, { organizationId: req.params.orgId!, asOf })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Oversikt-cockpit — aggregert forside fra alle motorene (samme tall som fanene).
  app.get(
    '/api/organizations/:orgId/dashboard',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const org = (
          await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId])
        ).rows[0];
        if (!org) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Virksomheten finnes ikke.' } });
          return;
        }
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(
          toJson(await buildDashboard(deps.db, deps.rules, { organizationId: req.params.orgId!, orgForm: org.org_form, asOf })),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Smart dokumentjakt — betalinger uten bilag + sannsynlig faktura vi alt har hentet.
  app.get(
    '/api/organizations/:orgId/document-hunt',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(toJson(await huntDocuments(deps.db, { organizationId: req.params.orgId!, asOf })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Forhåndsvisning: hva koblingen vil bokføre (konto/MVA), uten å skrive.
  app.get(
    '/api/organizations/:orgId/document-hunt/link-preview',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const q = z.object({ transactionId: z.string().uuid(), documentId: z.string().uuid() }).parse(req.query);
        res.json(
          toJson(
            await previewPaymentLink(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              transactionId: q.transactionId,
              documentId: q.documentId,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Ett-klikks kobling: bokfør bilaget mot betalingen og avstem transaksjonen.
  app.post(
    '/api/organizations/:orgId/document-hunt/link',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ transactionId: z.string().uuid(), documentId: z.string().uuid() }).parse(req.body);
        const result = await linkPaymentToDocument(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          transactionId: body.transactionId,
          documentId: body.documentId,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // Proaktiv skatte- og MVA-assistent — muligheter, kontrollpunkter og risiko.
  app.get(
    '/api/organizations/:orgId/tax-advisories',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const org = (
          await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId])
        ).rows[0];
        if (!org) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Virksomheten finnes ikke.' } });
          return;
        }
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(
          toJson(
            await buildTaxAdvisories(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              orgForm: org.org_form,
              asOf,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Kontinuerlig regnskapsavslutning — hele året på én linje.
  app.get(
    '/api/organizations/:orgId/period-close/:year',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        res.json(toJson(await assessYearClose(deps.db, deps.rules, { organizationId: req.params.orgId!, year })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Kontinuerlig regnskapsavslutning — hvor klar er måneden til å låses?
  app.get(
    '/api/organizations/:orgId/period-close/:year/:month',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        const month = z.coerce.number().int().min(1).max(12).parse(req.params.month);
        res.json(
          toJson(await assessPeriodClose(deps.db, deps.rules, { organizationId: req.params.orgId!, year, month })),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Planlegger — Reknaren fremover: MVA/skatt/likviditet/fordringer/kostnader/mangler.
  app.get(
    '/api/organizations/:orgId/planning',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const org = (
          await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId])
        ).rows[0];
        if (!org) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Virksomheten finnes ikke.' } });
          return;
        }
        const asOf = new Date().toISOString().slice(0, 10);
        res.json(
          toJson(
            await buildForecast(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              orgForm: org.org_form,
              asOf,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Feil-deteksjon på bokførte bilag — «har du gjort en feil?». Ren lesing.
  app.get(
    '/api/organizations/:orgId/bookkeeping-errors',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const toDate = typeof req.query.to === 'string' ? req.query.to : today;
        // Standard: siste 12 måneder fram til i dag.
        const fromDate =
          typeof req.query.from === 'string'
            ? req.query.from
            : `${Number(toDate.slice(0, 4)) - 1}${toDate.slice(4)}`;
        res.json(
          toJson(
            await detectBookkeepingErrors(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              fromDate,
              toDate,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Avviks- og svindeldeteksjon ────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/fraud-signals',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const toDate = typeof req.query.to === 'string' ? req.query.to : today;
        const fromDate =
          typeof req.query.from === 'string' ? req.query.from : `${Number(toDate.slice(0, 4)) - 1}${toDate.slice(4)}`;
        res.json(
          toJson(
            await detectFraudSignals(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              fromDate,
              toDate,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/fraud-signals/review',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            signalCode: z.string().min(1),
            fingerprint: z.string().min(1),
            verdict: z.enum(['confirmed_fraud', 'false_alarm', 'resolved']),
            note: z.string().max(2000).optional(),
            patterns: z
              .array(
                z.object({
                  type: z.enum(['bank_account', 'vendor_org', 'vendor_name']),
                  value: z.string().min(1),
                  sourceDocumentId: z.string().uuid().optional(),
                }),
              )
              .optional(),
          })
          .parse(req.body);
        const result = await reviewFraudSignal(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          signalCode: body.signalCode,
          fingerprint: body.fingerprint,
          verdict: body.verdict,
          ...(body.note ? { note: body.note } : {}),
          ...(body.patterns ? { patterns: body.patterns } : {}),
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/fraud-settings',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        res.json(toJson(await getFraudSettings(deps.db, req.params.orgId!)));
      } catch (err) {
        next(err);
      }
    },
  );

  app.put(
    '/api/organizations/:orgId/fraud-settings',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            significantThresholdMinor: z.union([z.string(), z.number()]).optional(),
            requiredApprovers: z.number().int().min(1).max(10).optional(),
            businessHoursStart: z.number().int().min(0).max(23).optional(),
            businessHoursEnd: z.number().int().min(1).max(24).optional(),
          })
          .parse(req.body);
        const result = await updateFraudSettings(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ...(body.significantThresholdMinor != null
            ? { significantThresholdMinor: BigInt(body.significantThresholdMinor) }
            : {}),
          ...(body.requiredApprovers != null ? { requiredApprovers: body.requiredApprovers } : {}),
          ...(body.businessHoursStart != null ? { businessHoursStart: body.businessHoursStart } : {}),
          ...(body.businessHoursEnd != null ? { businessHoursEnd: body.businessHoursEnd } : {}),
        });
        res.json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/payments/awaiting-approval',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const toDate = typeof req.query.to === 'string' ? req.query.to : today;
        const fromDate =
          typeof req.query.from === 'string' ? req.query.from : `${Number(toDate.slice(0, 4)) - 1}${toDate.slice(4)}`;
        res.json(
          toJson(
            await listPaymentsAwaitingApproval(deps.db, {
              organizationId: req.params.orgId!,
              fromDate,
              toDate,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/payments/:entryId/approve',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ note: z.string().max(2000).optional() }).parse(req.body ?? {});
        const result = await approvePayment(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          journalEntryId: req.params.entryId!,
          ...(body.note ? { note: body.note } : {}),
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Lærende regnskapsmodell (bedriftens egen praksis) ───────────────────
  app.get(
    '/api/organizations/:orgId/learned-rules',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        res.json(toJson(await listLearnedRules(deps.db, { organizationId: req.params.orgId! })));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/learned-rules/detect',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        res.status(201).json(toJson(await detectLearnedRules(deps.db, { organizationId: req.params.orgId! })));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/learned-rules',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            ruleType: z.enum(['account_mapping', 'project_mapping', 'approver_requirement', 'threshold_approval']),
            subjectType: z.enum(['vendor', 'customer', 'amount']),
            subjectKey: z.string().max(200).nullish(),
            subjectLabel: z.string().min(1).max(200),
            target: z.record(z.unknown()),
            scope: z.enum(['organization', 'group']).optional(),
          })
          .parse(req.body);
        const result = await createLearnedRule(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ruleType: body.ruleType,
          subjectType: body.subjectType,
          subjectLabel: body.subjectLabel,
          target: body.target,
          ...(body.subjectKey != null ? { subjectKey: body.subjectKey } : {}),
          ...(body.scope ? { scope: body.scope } : {}),
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/learned-rules/:ruleId/approve',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        await approveLearnedRule(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ruleId: req.params.ruleId!,
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/learned-rules/:ruleId/dismiss',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        await dismissLearnedRule(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ruleId: req.params.ruleId!,
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch(
    '/api/organizations/:orgId/learned-rules/:ruleId',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ target: z.record(z.unknown()).optional(), scope: z.enum(['organization', 'group']).optional() }).parse(req.body);
        await updateLearnedRule(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          ruleId: req.params.ruleId!,
          ...(body.target ? { target: body.target } : {}),
          ...(body.scope ? { scope: body.scope } : {}),
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/organization-groups',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ name: z.string().min(1).max(200) }).parse(req.body);
        const result = await createOrganizationGroup(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          name: body.name,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // ═══ Åpent integrasjonslag ════════════════════════════════════════════════
  // (1) Forvaltning (sesjon + integrations.manage): API-nøkler + webhooks.
  app.get('/api/organizations/:orgId/api-keys', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await listApiKeys(deps.db, req.params.orgId!)));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/api-keys', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ name: z.string().min(1).max(120), scopes: z.array(z.string()).min(1) }).parse(req.body);
      const result = await createApiKey(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        name: body.name,
        scopes: body.scopes,
      });
      // secret returneres KUN her, denne ene gangen.
      res.status(201).json(toJson(result));
    } catch (err) { next(err); }
  });
  app.delete('/api/organizations/:orgId/api-keys/:keyId', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      await revokeApiKey(deps.db, { organizationId: req.params.orgId!, actor: { userId: req.auth!.userId, role: req.orgRole! }, keyId: req.params.keyId! });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.get('/api/organizations/:orgId/webhooks', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await listWebhooks(deps.db, req.params.orgId!)));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/webhooks', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ url: z.string().url(), events: z.array(z.string()).min(1), description: z.string().max(200).optional() }).parse(req.body);
      const result = await createWebhook(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        url: body.url,
        events: body.events,
        ...(body.description ? { description: body.description } : {}),
      });
      res.status(201).json(toJson(result));
    } catch (err) { next(err); }
  });
  app.delete('/api/organizations/:orgId/webhooks/:webhookId', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      await deleteWebhook(deps.db, { organizationId: req.params.orgId!, actor: { userId: req.auth!.userId, role: req.orgRole! }, webhookId: req.params.webhookId! });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/webhooks/:webhookId/test', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await testWebhook(deps.db, { organizationId: req.params.orgId!, webhookId: req.params.webhookId! })));
    } catch (err) { next(err); }
  });
  app.get('/api/organizations/:orgId/webhook-deliveries', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await listDeliveries(deps.db, req.params.orgId!)));
    } catch (err) { next(err); }
  });

  // (2) Cron: drener/gjenforsøker webhook-leveranser.
  app.post('/api/cron/webhooks-drain', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      if (!secret || secret.length < 16) { res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler.' } }); return; }
      const a = Buffer.from(secret); const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } }); return; }
      res.json(toJson(await deliverPending(deps.db)));
    } catch (err) { next(err); }
  });

  // (3) Offentlig oppdagelse (dokumentasjon): hva laget tilbyr.
  app.get('/api/v1', (_req, res) => {
    res.json({
      name: 'Reknaren åpent integrasjonslag',
      version: '1',
      auth: 'Bearer API-nøkkel (rk_live_…) i Authorization-headeren, eller sesjons-token.',
      scopes: PERMISSIONS,
      events: WEBHOOK_EVENTS,
      formats: { saft: 'SAF-T Financial 1.40', einvoice: 'EHF / PEPPOL BIS Billing 3.0' },
      endpoints: [
        'GET /api/v1/organizations/:orgId/accounts',
        'GET /api/v1/organizations/:orgId/customers',
        'GET /api/v1/organizations/:orgId/suppliers',
        'GET /api/v1/organizations/:orgId/journal-entries?from&to&limit&offset',
        'GET /api/v1/organizations/:orgId/invoices',
        'GET /api/v1/organizations/:orgId/vat-report?from&to',
        'GET /api/v1/organizations/:orgId/saf-t?from&to (SAF-T 1.40 XML)',
      ],
      webhookSignature: 'X-Reknaren-Signature: sha256=<HMAC-SHA256 av råkroppen med endepunktets secret>',
      mcp: 'POST /mcp (Model Context Protocol, Streamable HTTP) med Bearer API-nøkkel — scopede LES-/forslag-verktøy for AI-klienter.',
    });
  });

  // (5) MCP-server (Model Context Protocol) — AI-klienter kobler seg på med en
  // API-nøkkel og får scopede verktøy. Stateless: fersk server per forespørsel.
  const handleMcp = async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      const header = req.header('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      const resolved = token?.startsWith('rk_') ? await resolveApiKey(deps.db, token) : null;
      if (!resolved) {
        res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Gyldig API-nøkkel (rk_live_…) kreves i Authorization-headeren.' }, id: null });
        return;
      }
      const server = createReknarenMcpServer(
        { db: deps.db, rules: deps.rules },
        { organizationId: resolved.organizationId, scopes: resolved.scopes },
      );
      // Stateless: ingen sesjons-ID. SDK-typene krever cast under exactOptionalPropertyTypes.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
      await transport.handleRequest(req as never, res as never, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Intern feil i MCP-serveren.' }, id: null });
      }
      deps.errorMonitor?.capture(err);
    }
  };
  app.post('/mcp', handleMcp);
  app.get('/mcp', handleMcp);
  app.delete('/mcp', handleMcp);

  // (6) Inngående data-connectors: hent transaksjoner/bilag fra eksterne kilder.
  const connectorDeps: ConnectorDeps = {
    db: deps.db,
    storage: deps.storage,
    registry: buildConnectorRegistry({ stripe: deps.stripe }),
  };
  app.get('/api/organizations/:orgId/connectors', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await listConnectorStatus(connectorDeps, req.params.orgId!)));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/connectors/:connectorId/connect', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ config: z.record(z.unknown()).optional() }).parse(req.body ?? {});
      await connectConnector(connectorDeps, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        connectorId: req.params.connectorId!,
        ...(body.config ? { config: body.config } : {}),
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/connectors/:connectorId/sync', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await syncConnector(connectorDeps, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        connectorId: req.params.connectorId!,
      })));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/connectors/:connectorId/disconnect', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      await disconnectConnector(connectorDeps, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        connectorId: req.params.connectorId!,
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.post('/api/cron/connector-sync', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      if (!secret || secret.length < 16) { res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler.' } }); return; }
      const a = Buffer.from(secret); const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } }); return; }
      res.json(toJson(await syncAllConnectors(connectorDeps)));
    } catch (err) { next(err); }
  });

  // ── Abonnements-/forventningsvakt (faste utgifter som uteblir) ───────────
  app.get('/api/organizations/:orgId/recurring', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : today;
      const [due, rules] = await Promise.all([
        assessRecurringDue(deps.db, { organizationId: req.params.orgId!, asOf }),
        listLearnedRules(deps.db, { organizationId: req.params.orgId! }),
      ]);
      const expectations = rules.rules.filter((r) => r.ruleType === 'recurring_expectation');
      res.json(toJson({ ...due, expectations }));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/recurring/detect', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      res.status(201).json(toJson(await detectRecurringExpectations(deps.db, { organizationId: req.params.orgId! })));
    } catch (err) { next(err); }
  });
  // Betalingskalender: betalt (bakover) + forventet (framover) på én tidslinje.
  app.get('/api/organizations/:orgId/payment-calendar', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const org = (await deps.db.query(`SELECT org_form FROM organizations WHERE id=$1`, [req.params.orgId!])).rows[0];
      if (!org) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organisasjonen finnes ikke.' } }); return; }
      const today = new Date().toISOString().slice(0, 10);
      const iso = (d: unknown, fb: string) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fb);
      const defFrom = `${today.slice(0, 4)}-01-01`;
      const defTo = new Date(Date.parse(today + 'T00:00:00Z') + 90 * 86400000).toISOString().slice(0, 10);
      res.json(toJson(await buildPaymentCalendar(deps.db, deps.rules, {
        organizationId: req.params.orgId!,
        orgForm: org.org_form,
        from: iso(req.query.from, defFrom),
        to: iso(req.query.to, defTo),
        asOf: today,
      })));
    } catch (err) { next(err); }
  });
  // Inline-nudge: ser dette bilagets leverandør periodisk ut?
  app.get('/api/organizations/:orgId/vendors/:vendorId/recurring-hint', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await recurringHintForVendor(deps.db, { organizationId: req.params.orgId!, vendorId: req.params.vendorId! })));
    } catch (err) { next(err); }
  });
  // Bekreft nudgen: opprett aktiv fast forventning fra leverandørens historikk.
  app.post('/api/organizations/:orgId/vendors/:vendorId/recurring', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const result = await createRecurringFromVendor(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        vendorId: req.params.vendorId!,
      });
      res.status(201).json(toJson(result));
    } catch (err) { next(err); }
  });
  // Dokument-scopet nudge: løs opp leverandøren for bilaget (postert eller uttrukket) og vurder gjentakelse.
  const resolveDocVendor = async (org: string, documentId: string): Promise<string | null> => {
    const posted = (await deps.db.query(
      `SELECT l.vendor_id::text AS vid FROM journal_entries je JOIN journal_lines l ON l.entry_id=je.id
       WHERE je.organization_id=$1 AND je.source_document_id=$2 AND l.vendor_id IS NOT NULL LIMIT 1`,
      [org, documentId],
    )).rows[0];
    if (posted?.vid) return posted.vid;
    const matched = (await deps.db.query(
      `SELECT v.id::text AS vid FROM extracted_document_data e
       JOIN vendors v ON v.organization_id=e.organization_id
         AND (NULLIF(v.org_number,'')=NULLIF(e.vendor_org_number,'') OR lower(v.name)=lower(e.vendor_name))
       WHERE e.organization_id=$1 AND e.document_id=$2 LIMIT 1`,
      [org, documentId],
    )).rows[0];
    return matched?.vid ?? null;
  };
  app.get('/api/organizations/:orgId/documents/:documentId/recurring-hint', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const vendorId = await resolveDocVendor(req.params.orgId!, req.params.documentId!);
      if (!vendorId) { res.json({ looksRecurring: false, alreadyTracked: false, vendorId: null }); return; }
      const hint = await recurringHintForVendor(deps.db, { organizationId: req.params.orgId!, vendorId });
      res.json(toJson({ ...hint, vendorId }));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/documents/:documentId/recurring', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const vendorId = await resolveDocVendor(req.params.orgId!, req.params.documentId!);
      if (!vendorId) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fant ingen leverandør for bilaget.' } }); return; }
      const result = await createRecurringFromVendor(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        vendorId,
      });
      res.status(201).json(toJson(result));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/recurring/:ruleId/resolve', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({
        period: z.string().regex(/^\d{4}(-\d{2})?$/),
        status: z.enum(['handled', 'snoozed', 'dismissed']),
        snoozeUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        note: z.string().max(500).optional(),
      }).parse(req.body);
      await resolveRecurring(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        ruleId: req.params.ruleId!,
        period: body.period,
        status: body.status,
        ...(body.snoozeUntil ? { snoozeUntil: body.snoozeUntil } : {}),
        ...(body.note ? { note: body.note } : {}),
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  // Nivå 3: hent faktura automatisk der en connector finnes; ellers manuell (Min side).
  app.post('/api/organizations/:orgId/recurring/:ruleId/fetch', requireAuth, requireOrgPermission('integrations.manage'), async (req: AuthedRequest, res, next) => {
    try {
      const rules = await listLearnedRules(deps.db, { organizationId: req.params.orgId! });
      const rule = rules.rules.find((r) => r.id === req.params.ruleId && r.ruleType === 'recurring_expectation');
      if (!rule) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Forventningen finnes ikke.' } }); return; }
      const t = rule.target as { connectorId?: string; minSideUrl?: string };
      if (t.connectorId && connectorDeps.registry[t.connectorId]?.configured()) {
        const result = await syncConnector(connectorDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          connectorId: t.connectorId,
        });
        res.json(toJson({ mode: 'connector', ...result }));
        return;
      }
      // Ingen connector → ærlig: må hentes manuelt fra Min side.
      res.json(toJson({ mode: 'manual', minSideUrl: t.minSideUrl ?? null, message: 'Ingen automatisk kilde — hent fakturaen fra leverandørens «Min side» og last den opp.' }));
    } catch (err) { next(err); }
  });
  // Cron: sjekk forfalte faste utgifter for alle org + varsle abonnenter.
  app.post('/api/cron/recurring-check', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      if (!secret || secret.length < 16) { res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler.' } }); return; }
      const a = Buffer.from(secret); const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } }); return; }
      const today = new Date().toISOString().slice(0, 10);
      const orgs = (await deps.db.query(`SELECT DISTINCT organization_id FROM learned_rules WHERE rule_type='recurring_expectation' AND status='active'`)).rows;
      let notified = 0;
      for (const o of orgs) {
        const due = await assessRecurringDue(deps.db, { organizationId: o.organization_id, asOf: today });
        if (due.overdueCount > 0) {
          await emitEvent(deps.db, { organizationId: o.organization_id, event: 'recurring.due', data: { overdueCount: due.overdueCount, overdueAmountMinor: due.overdueAmountMinor, items: due.items.map((i) => ({ vendor: i.vendor, overdue: i.overdue.length })) } });
          notified++;
        }
      }
      kickDelivery(deps.db);
      res.json(toJson({ orgsChecked: orgs.length, notified }));
    } catch (err) { next(err); }
  });

  // (4) Versjonert LES-API (API-nøkkel eller sesjon).
  app.get('/api/v1/organizations/:orgId/accounts', requireApiAccess('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const rows = (await deps.db.query(`SELECT account_number, name, active FROM ledger_accounts WHERE organization_id = $1 ORDER BY account_number`, [req.params.orgId])).rows;
      res.json(toJson({ accounts: rows.map((r) => ({ accountNumber: r.account_number, name: r.name, active: r.active })) }));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/customers', requireApiAccess('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const rows = (await deps.db.query(`SELECT id, name, org_number, email, status FROM customers WHERE organization_id = $1 ORDER BY name`, [req.params.orgId])).rows;
      res.json(toJson({ customers: rows.map((r) => ({ id: r.id, name: r.name, orgNumber: r.org_number, email: r.email, status: r.status })) }));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/suppliers', requireApiAccess('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const rows = (await deps.db.query(`SELECT id, name, org_number, status FROM vendors WHERE organization_id = $1 ORDER BY name`, [req.params.orgId])).rows;
      res.json(toJson({ suppliers: rows.map((r) => ({ id: r.id, name: r.name, orgNumber: r.org_number, status: r.status })) }));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/journal-entries', requireApiAccess('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const q = z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(req.query);
      const from = q.from ?? '0001-01-01';
      const to = q.to ?? '9999-12-31';
      const entries = (await deps.db.query(
        `SELECT id, entry_number, entry_date::text AS entry_date, description, status
         FROM journal_entries WHERE organization_id = $1 AND entry_date BETWEEN $2 AND $3
         ORDER BY entry_number DESC LIMIT $4 OFFSET $5`,
        [req.params.orgId, from, to, q.limit, q.offset],
      )).rows;
      const ids = entries.map((e) => e.id);
      const lines = ids.length
        ? (await deps.db.query(
            `SELECT entry_id, line_number, account_number, vat_code, debit_minor, credit_minor, description, project, department
             FROM journal_lines WHERE entry_id = ANY($1) ORDER BY entry_id, line_number`, [ids])).rows
        : [];
      const byEntry = new Map<string, unknown[]>();
      for (const l of lines) {
        const arr = byEntry.get(l.entry_id as string) ?? [];
        arr.push({ lineNumber: l.line_number, accountNumber: l.account_number, vatCode: l.vat_code, debitMinor: l.debit_minor, creditMinor: l.credit_minor, description: l.description, project: l.project, department: l.department });
        byEntry.set(l.entry_id as string, arr);
      }
      res.json(toJson({
        entries: entries.map((e) => ({ id: e.id, entryNumber: Number(e.entry_number), entryDate: e.entry_date, description: e.description, status: e.status, lines: byEntry.get(e.id) ?? [] })),
        limit: q.limit, offset: q.offset,
      }));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/invoices', requireApiAccess('invoices.view'), async (req: AuthedRequest, res, next) => {
    try {
      const rows = (await deps.db.query(
        `SELECT id, invoice_number, status, invoice_date::text AS invoice_date, due_date::text AS due_date, currency, gross_minor, customer_id
         FROM invoices WHERE organization_id = $1 ORDER BY invoice_date DESC NULLS LAST LIMIT 500`, [req.params.orgId])).rows;
      res.json(toJson({ invoices: rows.map((r) => ({ id: r.id, invoiceNumber: r.invoice_number, status: r.status, invoiceDate: r.invoice_date, dueDate: r.due_date, currency: r.currency, grossMinor: r.gross_minor, customerId: r.customer_id })) }));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/vat-report', requireApiAccess('vat.view'), async (req: AuthedRequest, res, next) => {
    try {
      const q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
      res.json(toJson(await buildVatReport(deps.db, req.params.orgId!, q.from, q.to)));
    } catch (err) { next(err); }
  });
  app.get('/api/v1/organizations/:orgId/saf-t', requireApiAccess('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
      const xml = await buildSafTXml(deps.db, { organizationId: req.params.orgId!, fromDate: q.from, toDate: q.to });
      res.set('Content-Type', 'application/xml; charset=utf-8').send(xml);
    } catch (err) { next(err); }
  });

  app.get(
    '/api/organizations/:orgId/tax/estimate',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        const org = await deps.db.query(
          `SELECT org_form FROM organizations WHERE id = $1`,
          [req.params.orgId],
        );
        if (!org.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        res.json(
          toJson(
            await buildTaxEstimate(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              orgForm: org.rows[0].org_form,
              fromDate: q.from,
              toDate: q.to,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Kostnadsbærere: prosjekter og avdelinger ─────────────────────────────
  const dimensionKind = z.enum(['project', 'department']);

  app.post(
    '/api/organizations/:orgId/dimensions/:kind',
    requireAuth,
    requireOrgPermission('org.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const kind = dimensionKind.parse(req.params.kind);
        const body = z
          .object({
            code: z.string().min(1).max(30),
            name: z.string().min(1).max(200),
            description: z.string().max(1000).optional(),
          })
          .parse(req.body);
        const created = await createDimension(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          kind,
          code: body.code,
          name: body.name,
          ...(body.description ? { description: body.description } : {}),
        });
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/dimensions/:kind',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const kind = dimensionKind.parse(req.params.kind);
        res.json(toJson(await listDimensions(deps.db, req.params.orgId!, kind)));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/dimension-result',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery
          .extend({ kind: dimensionKind.default('project') })
          .parse(req.query);
        res.json(
          toJson(
            await dimensionResultReport(deps.db, {
              organizationId: req.params.orgId!,
              kind: q.kind,
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // AI-margin: AI-inntekt (fakturert kundene) vs AI-kostnad (betalt leverandører)
  // per produkt — «AI cost forbruk» side ved side. Fra posterte journallinjer.
  app.get(
    '/api/organizations/:orgId/reports/ai-margin',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        res.json(
          toJson(
            await aiMarginReport(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── SAF-T-eksport ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/saf-t',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        const xml = await buildSafTXml(deps.db, {
          organizationId: req.params.orgId!,
          fromDate: q.from,
          toDate: q.to,
        });
        // Eksport av regnskapsdata er en sensitiv hendelse — logges alltid.
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'saf-t.exported',
            entityType: 'organization',
            entityId: req.params.orgId!,
            newValue: { from: q.from, to: q.to, bytes: Buffer.byteLength(xml) },
          }),
        );
        await emitEvent(deps.db, {
          organizationId: req.params.orgId!,
          event: 'saft.exported',
          data: { from: q.from, to: q.to, bytes: Buffer.byteLength(xml) },
        });
        kickDelivery(deps.db);
        res
          .set('Content-Type', 'application/xml; charset=utf-8')
          .set(
            'Content-Disposition',
            `attachment; filename="saf-t_${q.from}_${q.to}.xml"`,
          )
          .send(xml);
      } catch (err) {
        next(err);
      }
    },
  );

  // SAF-T-import (forhåndsvisning): les en SAF-T-fil fra et annet system (Fiken m.fl.)
  // og vis hva som finnes — kontoplan, kunder, leverandører, saldoer + balansekontroll.
  // REN LESING; ingenting bokføres her.
  app.post(
    '/api/organizations/:orgId/saft-import/preview',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ xml: z.string().min(1).max(40_000_000) }).parse(req.body);
        const preview = parseSaft(body.xml);
        res.json(
          toJson({
            company: preview.company,
            companyOrgNumber: preview.companyOrgNumber,
            periodStart: preview.periodStart,
            periodEnd: preview.periodEnd,
            software: preview.software,
            counts: {
              accounts: preview.accounts.length,
              customers: preview.customers.length,
              suppliers: preview.suppliers.length,
            },
            totalDebitMinor: preview.totalDebitMinor,
            totalCreditMinor: preview.totalCreditMinor,
            balanced: preview.balanced,
            // send et utvalg for visning (ikke hele filen)
            accountsSample: preview.accounts.slice(0, 200),
            customers: preview.customers.slice(0, 200),
            suppliers: preview.suppliers.slice(0, 200),
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Bokfør åpningsbalansen fra SAF-T: sikrer kontoplan + kontakter + fører ÉN
  // balansert åpningspostering datert asOfDate. Idempotent på dato.
  app.post(
    '/api/organizations/:orgId/saft-import',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            xml: z.string().min(1).max(40_000_000),
            asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.body);
        const result = await importSaftOpeningBalance(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          xml: body.xml,
          asOfDate: body.asOfDate,
        });
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'saft.opening_balance_imported',
            entityType: 'organization',
            entityId: req.params.orgId!,
            newValue: { asOfDate: body.asOfDate, entryNumber: result.entryNumber, lines: result.openingLines },
          }),
        );
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // Forhåndsvis full transaksjons-replay: antall transaksjoner/linjer + ubalanserte.
  app.post(
    '/api/organizations/:orgId/saft-import/replay/preview',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ xml: z.string().min(1).max(40_000_000) }).parse(req.body);
        const p = parseSaftTransactions(body.xml);
        res.json(
          toJson({
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            transactionCount: p.transactionCount,
            lineCount: p.lineCount,
            unbalancedCount: p.unbalancedCount,
            suppliers: p.suppliers.length,
            customers: p.customers.length,
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Full transaksjons-replay: spill av HVER bokføring fra SAF-T inn i hovedboken.
  // includeOpening=true fører også inngående balanse (bruk kun for tidligste år).
  // Idempotent på Fikens SystemID → trygt å kjøre flere år etter hverandre / om igjen.
  app.post(
    '/api/organizations/:orgId/saft-import/replay',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            xml: z.string().min(1).max(40_000_000),
            includeOpening: z.boolean().optional(),
          })
          .parse(req.body);
        const result = await replaySaftTransactions(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          xml: body.xml,
          includeOpening: body.includeOpening ?? false,
        });
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'saft.transactions_replayed',
            entityType: 'organization',
            entityId: req.params.orgId!,
            newValue: {
              periodStart: result.periodStart,
              periodEnd: result.periodEnd,
              posted: result.transactionsPosted,
              skipped: result.transactionsSkipped,
              includeOpening: body.includeOpening ?? false,
            },
          }),
        );
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // Strømmende replay (SSE): sender framdrift underveis så UI kan vise %,
  // hvilket år, og hvem regnskapet er fra. includeOpening avgjøres automatisk
  // (inngående balanse føres kun når org-en er tom) med mindre den overstyres.
  app.post(
    '/api/organizations/:orgId/saft-import/replay/stream',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res) => {
      const send = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();
      try {
        const body = z.object({ xml: z.string().min(1).max(40_000_000), includeOpening: z.boolean().optional() }).parse(req.body);
        const org = req.params.orgId!;
        const meta = parseSaft(body.xml);
        const hasEntries = ((await deps.db.query(`SELECT 1 FROM journal_entries WHERE organization_id=$1 LIMIT 1`, [org])).rowCount ?? 0) > 0;
        const includeOpening = body.includeOpening ?? !hasEntries;
        send({ phase: 'start', company: meta.company, periodStart: meta.periodStart, periodEnd: meta.periodEnd, software: meta.software, includeOpening });
        let lastSent = 0;
        const result = await replaySaftTransactions(deps.db, {
          organizationId: org,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          xml: body.xml,
          includeOpening,
          onProgress: (posted, total) => {
            // Send ~100 oppdateringer (hvert steg) + alltid siste.
            const step = Math.max(1, Math.floor(total / 100));
            if (posted - lastSent >= step || posted === total) { lastSent = posted; send({ phase: 'posting', posted, total }); }
          },
        });
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: org,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'saft.transactions_replayed',
            entityType: 'organization',
            entityId: org,
            newValue: { periodStart: result.periodStart, periodEnd: result.periodEnd, posted: result.transactionsPosted, skipped: result.transactionsSkipped, includeOpening },
          }),
        );
        send({ phase: 'done', result });
      } catch (err) {
        send({ phase: 'error', message: err instanceof Error ? err.message : 'Ukjent feil under import.' });
      } finally {
        res.end();
      }
    },
  );

  // ── Periodelås og korrigering ────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/periods/:year/:month/lock',
    requireAuth,
    requireOrgPermission('period.lock'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        const month = z.coerce.number().int().min(1).max(12).parse(req.params.month);
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        await lockPeriod(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          year,
          month,
          reason: body.reason,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // Årsavslutning — forhåndsvisning: årsresultat, skatt, forslag til postering, låsestatus.
  app.get(
    '/api/organizations/:orgId/year-end/:year',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        const adjustments =
          typeof req.query.adjustments === 'string' ? BigInt(req.query.adjustments) : 0n;
        const org = (
          await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId])
        ).rows[0];
        if (!org) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Virksomheten finnes ikke.' } });
          return;
        }
        res.json(
          toJson(
            await computeYearEndPlan(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              year,
              orgForm: org.org_form,
              adjustmentsMinor: adjustments,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Næringsspesifikasjon-utkast: resultat + balanse mappet til standardposter.
  app.get(
    '/api/organizations/:orgId/year-end/:year/naeringsspesifikasjon',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        res.json(
          toJson(await buildNaeringsspesifikasjon(deps.db, { organizationId: req.params.orgId!, year })),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Anleggsmiddelregister + saldoavskrivning ────────────────────────────
  app.get('/api/organizations/:orgId/fixed-assets', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson({ groups: SALDO_GROUPS, assets: await listFixedAssets(deps.db, req.params.orgId!) }));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/fixed-assets', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({
        name: z.string().min(1).max(200),
        saldoGroup: z.enum(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']),
        acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        costMinor: z.string().regex(/^\d+$/),
        ledgerAccount: z.string().max(20).optional(),
        notes: z.string().max(500).optional(),
      }).parse(req.body);
      const asset = await createFixedAsset(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        name: body.name,
        saldoGroup: body.saldoGroup as SaldoGroup,
        acquisitionDate: body.acquisitionDate,
        costMinor: BigInt(body.costMinor),
        ...(body.ledgerAccount ? { ledgerAccount: body.ledgerAccount } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      });
      res.status(201).json(toJson(asset));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/fixed-assets/:assetId/dispose', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), proceedsMinor: z.string().regex(/^\d+$/) }).parse(req.body);
      await disposeFixedAsset(deps.db, { organizationId: req.params.orgId!, assetId: req.params.assetId!, disposalDate: body.disposalDate, proceedsMinor: BigInt(body.proceedsMinor) });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.get('/api/organizations/:orgId/fixed-assets/depreciation', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const year = z.coerce.number().int().min(2000).max(2100).parse(req.query.year ?? new Date().getFullYear());
      res.json(toJson(await computeDepreciation(deps.db, { organizationId: req.params.orgId!, year })));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/fixed-assets/depreciation/:year/book', requireAuth, requireOrgPermission('journal.post'), async (req: AuthedRequest, res, next) => {
    try {
      const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
      res.status(201).json(toJson(await bookDepreciation(deps.db, { organizationId: req.params.orgId!, actor: { userId: req.auth!.userId, role: req.orgRole! }, year })));
    } catch (err) { next(err); }
  });

  // Årsavslutning — gjennomfør: bokfør skattekostnad (AS) + lås året. Idempotent.
  app.post(
    '/api/organizations/:orgId/year-end/:year/close',
    requireAuth,
    requireOrgPermission('period.lock'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        const body = z.object({ adjustmentsMinor: z.string().optional() }).parse(req.body ?? {});
        const org = (
          await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId])
        ).rows[0];
        if (!org) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Virksomheten finnes ikke.' } });
          return;
        }
        const receipt = await executeYearEndClose(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          year,
          orgForm: org.org_form,
          ...(body.adjustmentsMinor ? { adjustmentsMinor: BigInt(body.adjustmentsMinor) } : {}),
        });
        res.status(201).json(toJson(receipt));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/journal-entries/:entryId/reverse',
    requireAuth,
    requireOrgPermission('journal.reverse'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            reason: z.string().min(3).max(500),
          })
          .parse(req.body);
        const entry = await reverseJournalEntry(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          entryId: req.params.entryId!,
          reversalDate: body.reversalDate,
          reason: body.reason,
        });
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Teammedlemmer ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/members',
    requireAuth,
    requireOrgPermission('members.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const members = await listMembers(deps.db, req.params.orgId!);
        res.json(members);
      } catch (err) {
        next(err);
      }
    },
  );

  // Inviter/legg til et medlem med rolle. Idempotent på bruker (oppdaterer rolle).
  // Inviterte kan logge inn via magisk lenke selv uten global tillat-liste.
  app.post(
    '/api/organizations/:orgId/members',
    requireAuth,
    requireOrgPermission('members.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            email: z.string().email(),
            role: z.enum(ROLES),
            displayName: z.string().min(1).max(200).optional(),
          })
          .parse(req.body);
        const result = await addOrUpdateMember(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          email: body.email,
          role: body.role,
          ...(body.displayName ? { displayName: body.displayName } : {}),
        });
        res.status(result.created ? 201 : 200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Endre et medlems rolle. Kan ikke degradere den siste eieren.
  app.patch(
    '/api/organizations/:orgId/members/:userId',
    requireAuth,
    requireOrgPermission('members.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ role: z.enum(ROLES) }).parse(req.body);
        await changeMemberRole(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          userId: req.params.userId!,
          role: body.role,
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // Trekk tilbake et medlemskap. Kan ikke fjerne den siste eieren.
  app.delete(
    '/api/organizations/:orgId/members/:userId',
    requireAuth,
    requireOrgPermission('members.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        await removeMember(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          userId: req.params.userId!,
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Salg og faktura ──────────────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/customers',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            name: z.string().min(1).max(200),
            email: z.string().email().optional(),
            orgNumber: z.string().regex(/^\d{9}$/).optional(),
            streetAddress: z.string().min(1).max(200).optional(),
            postalCode: z.string().regex(/^\d{4}$/).optional(),
            city: z.string().min(1).max(100).optional(),
          })
          .parse(req.body);
        const id = newId();
        await withTransaction(deps.db, async (client) => {
          await client.query(
            `INSERT INTO customers
               (id, organization_id, name, email, org_number, street_address, postal_code, city, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              id,
              req.params.orgId,
              body.name,
              body.email ?? null,
              body.orgNumber ?? null,
              body.streetAddress ?? null,
              body.postalCode ?? null,
              body.city ?? null,
              req.auth!.userId,
            ],
          );
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'customer.created',
            entityType: 'customer',
            entityId: id,
            newValue: { name: body.name },
          });
        });
        res.status(201).json({ id });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/customers',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT id, name, email, org_number, street_address, postal_code, city FROM customers
           WHERE organization_id = $1 AND status = 'active' ORDER BY name LIMIT 500`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  const invoiceLineSchema = z.object({
    description: z.string().min(1).max(500),
    /** Antall i tusendeler: 1 stk = 1000. */
    quantityThousandths: z.coerce.bigint().positive(),
    /** Enhetspris i øre, eks. mva. */
    unitPriceMinor: z.coerce.bigint().nonnegative(),
    vatCode: z.string().min(1),
    revenueAccount: z.string().regex(/^\d{4}$/).optional(),
    project: z.string().min(1).max(30).optional(),
  });

  app.post(
    '/api/organizations/:orgId/invoices',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            customerId: z.string().uuid(),
            lines: z.array(invoiceLineSchema).min(1).max(100),
            invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            deliveryPlace: z.string().min(1).max(200).optional(),
          })
          .parse(req.body);
        const draft = await createInvoiceDraft(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          customerId: body.customerId,
          lines: body.lines.map((l) => ({
            description: l.description,
            quantityThousandths: l.quantityThousandths,
            unitPriceMinor: l.unitPriceMinor,
            vatCode: l.vatCode,
            ...(l.revenueAccount ? { revenueAccount: l.revenueAccount } : {}),
            ...(l.project ? { project: l.project } : {}),
          })),
          ...(body.invoiceDate ? { invoiceDate: body.invoiceDate } : {}),
          ...(body.dueDate ? { dueDate: body.dueDate } : {}),
          ...(body.deliveryDate ? { deliveryDate: body.deliveryDate } : {}),
          ...(body.deliveryPlace ? { deliveryPlace: body.deliveryPlace } : {}),
        });
        res.status(201).json(toJson(draft));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/invoices',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT i.id, i.invoice_number, i.kind, i.status, i.invoice_date::TEXT AS invoice_date,
                  i.due_date::TEXT AS due_date, i.kid, i.net_minor, i.vat_minor, i.gross_minor,
                  i.paid_minor, c.name AS customer_name
           FROM invoices i JOIN customers c ON c.id = i.customer_id
           WHERE i.organization_id = $1
           ORDER BY i.created_at DESC LIMIT 300`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/issue',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({ invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
          .parse(req.body ?? {});
        const result = await issueInvoice(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          invoiceId: req.params.invoiceId!,
          ...(body.invoiceDate ? { invoiceDate: body.invoiceDate } : {}),
        });
        // Åpent integrasjonslag: varsle abonnenter om utstedt faktura.
        await emitEvent(deps.db, {
          organizationId: req.params.orgId!,
          event: 'invoice.issued',
          data: { invoiceId: req.params.invoiceId, ...(result as Record<string, unknown>) },
        });
        kickDelivery(deps.db);
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/credit',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        const result = await createCreditNote(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          invoiceId: req.params.invoiceId!,
          reason: body.reason,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // Salgsdokumentet som utskriftsvennlig HTML. Hver gjengivelse auditlogges.
  app.get(
    '/api/organizations/:orgId/invoices/:invoiceId/document',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const doc = await renderInvoiceDocument(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          invoiceId: req.params.invoiceId!,
        });
        await withTransaction(deps.db, async (client) => {
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'invoice.document_rendered',
            entityType: 'invoice',
            entityId: req.params.invoiceId!,
            newValue: { invoiceNumber: doc.invoiceNumber, kind: doc.kind },
          });
        });
        res.type('html').send(doc.html);
      } catch (err) {
        next(err);
      }
    },
  );

  // Salgsdokumentet som EKTE PDF (nedlasting/forhåndsvisning). Samme § 5-1-1-innhold
  // som HTML-visningen — bygget fra den delte modellen. Hver gjengivelse auditlogges.
  app.get(
    '/api/organizations/:orgId/invoices/:invoiceId/pdf',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const view = await loadInvoiceView(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          invoiceId: req.params.invoiceId!,
        });
        const pdf = renderInvoicePdf(view);
        await withTransaction(deps.db, async (client) => {
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'invoice.pdf_rendered',
            entityType: 'invoice',
            entityId: req.params.invoiceId!,
            newValue: { invoiceNumber: view.invoiceNumber, kind: view.kind },
          });
        });
        res.setHeader('Content-Disposition', `inline; filename="${view.title}-${view.invoiceNumber}.pdf"`);
        res.type('application/pdf').send(pdf);
      } catch (err) {
        next(err);
      }
    },
  );

  // Send salgsdokumentet til kunden som e-post med PDF-vedlegg. Krever konfigurert
  // e-postsender OG at mottaker finnes (kundens e-post eller eksplisitt `to`).
  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/send',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.email || !deps.email.configured) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message: 'Utgående e-post er ikke konfigurert (REKNAREN_SMTP_* / REKNAREN_RESEND_API_KEY + REKNAREN_REMINDER_FROM mangler).',
            },
          });
          return;
        }
        const body = z
          .object({
            to: z.string().email().optional(),
            message: z.string().max(4000).optional(),
          })
          .parse(req.body ?? {});
        const view = await loadInvoiceView(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          invoiceId: req.params.invoiceId!,
        });
        const to = body.to ?? view.customerEmail;
        if (!to) {
          res.status(400).json({
            error: {
              code: 'CUSTOMER_EMAIL_MISSING',
              message: 'Kunden mangler e-postadresse. Legg til e-post på kunden, eller oppgi mottaker i «to».',
            },
          });
          return;
        }
        const pdf = renderInvoicePdf(view);
        const subject = `${view.title} ${view.invoiceNumber} fra ${view.orgName}`;
        const text =
          body.message?.trim() ||
          [
            `Hei ${view.customerName},`,
            '',
            `Vedlagt følger ${view.title.toLowerCase()} ${view.invoiceNumber} fra ${view.orgName}.`,
            `${view.grandLabel}: ${view.grossTotal} kr.`,
            '',
            'Med vennlig hilsen',
            view.orgName,
          ].join('\n');
        await deps.email.send({
          to,
          subject,
          text,
          attachments: [
            { filename: `${view.title}-${view.invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' },
          ],
        });
        await withTransaction(deps.db, async (client) => {
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'invoice.sent',
            entityType: 'invoice',
            entityId: req.params.invoiceId!,
            newValue: { to, invoiceNumber: view.invoiceNumber, kind: view.kind },
          });
        });
        res.json({ sent: true, to, invoiceNumber: view.invoiceNumber });
      } catch (err) {
        next(err);
      }
    },
  );

  // EHF / PEPPOL BIS Billing 3.0 — salgsfakturaen som UBL-XML for nedlasting.
  // Kan lastes opp hos et hvilket som helst aksesspunkt eller sendes til offentlig
  // sektor. Bygges deterministisk fra fakturadataene. Auditlogges.
  app.get(
    '/api/organizations/:orgId/invoices/:invoiceId/ehf',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const data = await loadInvoiceEhf(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          invoiceId: req.params.invoiceId!,
        });
        const xml = renderEhfXml(data);
        await withTransaction(deps.db, async (client) => {
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'invoice.ehf_rendered',
            entityType: 'invoice',
            entityId: req.params.invoiceId!,
            newValue: { invoiceNumber: data.invoiceNumber },
          });
        });
        res.setHeader('Content-Disposition', `attachment; filename="EHF-${data.invoiceNumber}.xml"`);
        res.type('application/xml').send(xml);
      } catch (err) {
        next(err);
      }
    },
  );

  // Send EHF-fakturaen via PEPPOL-aksesspunkt. Ærlig 503 uten aksesspunkt-avtale;
  // 400 når mottaker mangler organisasjonsnummer (kreves som PEPPOL-adresse).
  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/ehf/send',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.peppol || !deps.peppol.configured) {
          res.status(503).json({
            error: {
              code: 'INTEGRATION_UNAVAILABLE',
              message:
                'PEPPOL-aksesspunkt er ikke konfigurert. Last ned EHF-XML (…/ehf) og send den via ditt aksesspunkt.',
            },
          });
          return;
        }
        const data = await loadInvoiceEhf(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          invoiceId: req.params.invoiceId!,
        });
        if (!data.buyer.orgNumber) {
          res.status(400).json({
            error: {
              code: 'RECIPIENT_ORG_NUMBER_MISSING',
              message: 'Mottaker mangler organisasjonsnummer — kreves som PEPPOL-adresse for EHF-sending.',
            },
          });
          return;
        }
        const xml = renderEhfXml(data);
        await deps.peppol.send({
          xml,
          recipientOrgNumber: data.buyer.orgNumber,
          invoiceNumber: data.invoiceNumber,
        });
        await withTransaction(deps.db, async (client) => {
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'invoice.ehf_sent',
            entityType: 'invoice',
            entityId: req.params.invoiceId!,
            newValue: { invoiceNumber: data.invoiceNumber, recipient: data.buyer.orgNumber },
          });
        });
        res.json({ sent: true, invoiceNumber: data.invoiceNumber, recipient: data.buyer.orgNumber });
      } catch (err) {
        next(err);
      }
    },
  );

  // PEPPOL/ELMA-oppslag: kan fakturaens mottaker ta imot EHF? Ren lesing mot
  // OpenPeppols offentlige katalog — alltid tilgjengelig (ingen aksesspunkt kreves).
  app.get(
    '/api/organizations/:orgId/invoices/:invoiceId/peppol-capability',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const row = (await deps.db.query(
          `SELECT c.org_number, c.name FROM invoices i JOIN customers c ON c.id = i.customer_id
           WHERE i.id = $1 AND i.organization_id = $2`,
          [req.params.invoiceId, req.params.orgId],
        )).rows[0];
        if (!row) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fakturaen finnes ikke.' } }); return; }
        if (!row.org_number) {
          res.json(toJson({ participantId: null, registered: false, supportsEhfInvoice: false, name: row.name, note: 'Mottaker mangler organisasjonsnummer — kreves for EHF/PEPPOL.' }));
          return;
        }
        res.json(toJson(await lookupPeppolParticipant(String(row.org_number).replace(/\D/g, ''))));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Frister & forpliktelser (lovbestemte frister med nedtelling) ──────────
  app.get('/api/organizations/:orgId/deadlines', requireAuth, requireOrgPermission('reports.view'), async (req: AuthedRequest, res, next) => {
    try {
      const org = (await deps.db.query(`SELECT org_form, vat_status FROM organizations WHERE id=$1`, [req.params.orgId])).rows[0];
      if (!org) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organisasjonen finnes ikke.' } }); return; }
      const asOf = new Date().toISOString().slice(0, 10);
      res.json(toJson(computeDeadlines({ orgForm: org.org_form as OrgForm, vatRegistered: org.vat_status === 'registered', asOf })));
    } catch (err) { next(err); }
  });

  // ── Utbetalingsfil (pain.001) — betal leverandørfakturaer via nettbank ────
  app.get('/api/organizations/:orgId/payments/payable', requireAuth, requireOrgPermission('bank.reconcile'), async (req: AuthedRequest, res, next) => {
    try {
      res.json(toJson(await listPayableInvoices(deps.db, req.params.orgId!)));
    } catch (err) { next(err); }
  });
  app.post('/api/organizations/:orgId/payments/file', requireAuth, requireOrgPermission('bank.reconcile'), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ documentIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
      const org = (await deps.db.query(`SELECT name, org_number FROM organizations WHERE id=$1`, [req.params.orgId])).rows[0];
      if (!org) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organisasjonen finnes ikke.' } }); return; }
      const debtorAccount = (await deps.db.query(`SELECT iban_or_account FROM bank_accounts WHERE organization_id=$1 AND status='active' ORDER BY created_at LIMIT 1`, [req.params.orgId])).rows[0]?.iban_or_account as string | undefined;
      if (!debtorAccount) { res.status(400).json({ error: { code: 'NO_DEBTOR_ACCOUNT', message: 'Sett opp virksomhetens bankkonto (Bank og avstemming) før du lager betalingsfil.' } }); return; }
      const selected = new Set(body.documentIds);
      const payable = (await listPayableInvoices(deps.db, req.params.orgId!)).filter((p) => selected.has(p.documentId) && p.payable && p.bankAccount);
      if (payable.length === 0) { res.status(400).json({ error: { code: 'NOTHING_PAYABLE', message: 'Ingen av de valgte fakturaene har bankkonto å betale til.' } }); return; }
      const now = new Date();
      const msgId = `REKNAREN-${String(req.params.orgId).slice(0, 8)}-${now.getTime()}`;
      const xml = buildPaymentFile({
        debtorName: org.name,
        debtorOrgNumber: org.org_number ? String(org.org_number).replace(/\D/g, '') : null,
        debtorAccount: String(debtorAccount).replace(/\s/g, ''),
        msgId,
        creationDateTime: now.toISOString().slice(0, 19),
        requestedExecutionDate: now.toISOString().slice(0, 10),
        payments: payable.map((p) => ({ endToEndId: p.documentId.slice(0, 30), creditorName: p.vendorName ?? 'Leverandør', creditorAccount: p.bankAccount!, amountMinor: p.amountMinor, currency: p.currency, kid: p.kid, message: p.invoiceNumber })),
      });
      await recordPaymentExports(deps.db, {
        organizationId: req.params.orgId!,
        actor: { userId: req.auth!.userId, role: req.orgRole! },
        messageRef: msgId,
        items: payable.map((p) => ({ documentId: p.documentId, amountMinor: p.amountMinor, creditorAccount: p.bankAccount })),
      });
      await withTransaction(deps.db, (client) => recordAuditEvent(client, { organizationId: req.params.orgId!, actor: { userId: req.auth!.userId, role: req.orgRole! }, action: 'payments.file_exported', entityType: 'organization', entityId: req.params.orgId!, newValue: { count: payable.length, messageRef: msgId } }));
      res.setHeader('Content-Disposition', `attachment; filename="betaling_${now.toISOString().slice(0, 10)}.xml"`);
      res.type('application/xml').send(xml);
    } catch (err) { next(err); }
  });

  // ── Bilagsjournal og posteringslinjer (avansert/regnskapsførervisning) ──
  app.get(
    '/api/organizations/:orgId/journal-entries',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        const params: unknown[] = [req.params.orgId];
        let dateSql = '';
        if (q.from) {
          params.push(q.from);
          dateSql += ` AND e.entry_date >= $${params.length}`;
        }
        if (q.to) {
          params.push(q.to);
          dateSql += ` AND e.entry_date <= $${params.length}`;
        }
        const entries = await deps.db.query(
          `SELECT e.id, e.entry_number, e.entry_date::TEXT AS entry_date, e.description,
                  e.status, e.source_document_id, e.reversal_of, e.posted_by, e.posted_by_role,
                  e.posted_at
           FROM journal_entries e
           WHERE e.organization_id = $1${dateSql}
           ORDER BY e.entry_number DESC
           LIMIT 300`,
          params,
        );
        const ids = entries.rows.map((r) => r.id);
        const lines = ids.length
          ? await deps.db.query(
              `SELECT entry_id, line_number, account_number, vat_code,
                      debit_minor, credit_minor, description, original_currency,
                      original_amount_minor, exchange_rate
               FROM journal_lines WHERE entry_id = ANY($1)
               ORDER BY entry_id, line_number`,
              [ids],
            )
          : { rows: [] };
        const byEntry = new Map<string, unknown[]>();
        for (const line of lines.rows) {
          const list = byEntry.get(line.entry_id) ?? [];
          list.push(line);
          byEntry.set(line.entry_id, list);
        }
        res.json(
          toJson(entries.rows.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] }))),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents/:documentId/journal-entry',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const entry = await deps.db.query(
          `SELECT id, entry_number, entry_date::TEXT AS entry_date, description, status
           FROM journal_entries
           WHERE organization_id = $1 AND source_document_id = $2
           ORDER BY entry_number ASC LIMIT 1`,
          [req.params.orgId, req.params.documentId],
        );
        if (!entry.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dokumentet er ikke bokført.' } });
          return;
        }
        const lines = await deps.db.query(
          `SELECT line_number, account_number, vat_code, debit_minor, credit_minor,
                  description, original_currency, original_amount_minor, exchange_rate, exchange_rate_source
           FROM journal_lines WHERE entry_id = $1 ORDER BY line_number`,
          [entry.rows[0].id],
        );
        res.json(toJson({ ...entry.rows[0], lines: lines.rows }));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Bank og avstemming ───────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/bank-accounts',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT id, name, iban_or_account, ledger_account_number, status,
                  (feed_connection_id IS NOT NULL) AS feed_linked,
                  (feed_pending_code IS NOT NULL) AS feed_pending
           FROM bank_accounts WHERE organization_id = $1 ORDER BY created_at`,
          [req.params.orgId],
        );
        res.json(
          rows.rows.map((r) => ({
            id: r.id,
            name: r.name,
            ibanOrAccount: r.iban_or_account,
            ledgerAccountNumber: r.ledger_account_number,
            status: r.status,
            feedLinked: r.feed_linked,
            feedPending: r.feed_pending,
          })),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank-accounts',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            name: z.string().min(1).max(200),
            ibanOrAccount: z.string().min(8).max(40),
            ledgerAccountNumber: z.string().regex(/^\d{4}$/).optional(),
          })
          .parse(req.body);
        const id = await createBankAccount(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          name: body.name,
          ibanOrAccount: body.ibanOrAccount,
          ...(body.ledgerAccountNumber ? { ledgerAccountNumber: body.ledgerAccountNumber } : {}),
        });
        res.status(201).json({ id });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank-accounts/:bankAccountId/import',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({ csv: z.string().min(1).max(2_000_000) })
          .parse(req.body);
        const transactions = parseBankCsv(body.csv);
        const result = await importBankTransactions(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          bankAccountId: req.params.bankAccountId!,
          transactions,
        });
        // Kjør deterministisk matching rett etter import.
        const suggestions = await suggestMatches(deps.db, {
          organizationId: req.params.orgId!,
          bankAccountId: req.params.bankAccountId!,
        });
        res.status(201).json(toJson({ ...result, suggestions }));
      } catch (err) {
        next(err);
      }
    },
  );

  // Ærlig 503-vakt for alle bank-feed-endepunkt.
  const bankFeedUnavailable = (res: Response): boolean => {
    if (!deps.bankFeed || !deps.bankFeed.configured) {
      res.status(503).json({
        error: {
          code: 'INTEGRATION_UNAVAILABLE',
          message:
            'Bank-feed er ikke konfigurert (REKNAREN_GOCARDLESS_SECRET_ID + REKNAREN_GOCARDLESS_SECRET_KEY mangler). Bruk manuell CSV-import.',
        },
      });
      return true;
    }
    return false;
  };

  // Steg 1 av samtykkeflyten: list banker aggregatoren støtter (default Norge).
  app.get(
    '/api/organizations/:orgId/bank-feed/institutions',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (bankFeedUnavailable(res)) return;
        const country = typeof req.query.country === 'string' ? req.query.country : 'NO';
        res.json(await deps.bankFeed!.listInstitutions(country));
      } catch (err) {
        next(err);
      }
    },
  );

  // Steg 2: start samtykkeflyten mot valgt bank for en konkret bankkonto → lenke
  // brukeren besøker for å logge inn i banken. Requisition-ID lagres på kontoen.
  app.post(
    '/api/organizations/:orgId/bank-accounts/:bankAccountId/feed/connect',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (bankFeedUnavailable(res)) return;
        const body = z
          .object({ institutionId: z.string().min(1).max(200), redirectUrl: z.string().url().optional() })
          .parse(req.body);
        const acct = await deps.db.query(
          `SELECT id FROM bank_accounts WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
          [req.params.bankAccountId, req.params.orgId],
        );
        if (!acct.rowCount) throw new NotFoundError('Bankkontoen finnes ikke eller er frakoblet.');
        const redirectUrl = body.redirectUrl ?? `${(deps.appBaseUrl ?? 'https://ledgerly-coss.onrender.com').replace(/\/$/, '')}/bank/callback`;
        const req_ = await deps.bankFeed!.createRequisition({
          institutionId: body.institutionId,
          redirectUrl,
          reference: `${req.params.orgId}:${req.params.bankAccountId}`,
        });
        await withTransaction(deps.db, async (client) => {
          await client.query(`UPDATE bank_accounts SET feed_requisition_id = $3 WHERE id = $1 AND organization_id = $2`, [
            req.params.bankAccountId,
            req.params.orgId,
            req_.requisitionId,
          ]);
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'bank_feed.requisition_created',
            entityType: 'bank_account',
            entityId: req.params.bankAccountId!,
            newValue: { requisitionId: req_.requisitionId, institutionId: body.institutionId },
          });
        });
        res.status(201).json(req_);
      } catch (err) {
        next(err);
      }
    },
  );

  // Steg 3: etter at brukeren har gitt samtykke i banken — hent konto-ID-ene
  // requisitionen gir tilgang til og lagre den valgte som feed-kobling på kontoen.
  app.post(
    '/api/organizations/:orgId/bank-accounts/:bankAccountId/feed/link',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (bankFeedUnavailable(res)) return;
        const body = z
          .object({
            // GoCardless: requisitionId (server-lagret). Enable Banking: code fra redirect-URL-en.
            requisitionId: z.string().min(1).max(200).optional(),
            code: z.string().min(1).max(2000).optional(),
            accountId: z.string().min(1).max(200).optional(),
          })
          .parse(req.body ?? {});
        const acct = await deps.db.query(
          `SELECT feed_requisition_id, feed_pending_code FROM bank_accounts
           WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
          [req.params.bankAccountId, req.params.orgId],
        );
        if (!acct.rowCount) throw new NotFoundError('Bankkontoen finnes ikke eller er frakoblet.');
        const requisitionId = body.requisitionId ?? acct.rows[0].feed_requisition_id ?? undefined;
        // Code kan komme eksplisitt, ellers fra det /bank/callback mellomlagret.
        const code = body.code ?? acct.rows[0].feed_pending_code ?? undefined;
        if (!requisitionId && !code) {
          throw new ValidationError('Mangler fullførings-token. Fullfør bank-innloggingen (redirect), eller kjør /feed/connect først.');
        }
        const { status, accountIds } = await deps.bankFeed!.completeConsent({
          ...(requisitionId ? { requisitionId } : {}),
          ...(code ? { code } : {}),
        });
        // Velg oppgitt konto, ellers første tilknyttede.
        const chosen = body.accountId && accountIds.includes(body.accountId) ? body.accountId : accountIds[0];
        if (!chosen) {
          // Samtykke ikke fullført enda (status ≠ LN) — meld ærlig tilbake uten å lagre.
          res.status(409).json({
            error: {
              code: 'REQUISITION_NOT_LINKED',
              message: `Samtykket er ikke fullført enda (status ${status}). Fullfør bank-innloggingen og prøv igjen.`,
            },
            status,
            accountIds,
          });
          return;
        }
        await withTransaction(deps.db, async (client) => {
          await client.query(
            `UPDATE bank_accounts SET feed_connection_id = $3, feed_pending_code = NULL
             WHERE id = $1 AND organization_id = $2`,
            [req.params.bankAccountId, req.params.orgId, chosen],
          );
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'bank_feed.account_linked',
            entityType: 'bank_account',
            entityId: req.params.bankAccountId!,
            newValue: { connectionId: chosen },
          });
        });
        res.json({ linked: true, status, connectionId: chosen, accountIds });
      } catch (err) {
        next(err);
      }
    },
  );

  // Steg 4 (og gjentakende): hent transaksjoner fra aggregatoren og kjør dem gjennom
  // samme idempotente import + matching som CSV. `connectionId` = aggregatorens
  // konto-ID; utelates den, brukes den lagrede koblingen fra /feed/link.
  app.post(
    '/api/organizations/:orgId/bank-accounts/:bankAccountId/feed/sync',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (bankFeedUnavailable(res)) return;
        const body = z
          .object({
            connectionId: z.string().min(1).max(200).optional(),
            sinceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body ?? {});
        let connectionId = body.connectionId;
        if (!connectionId) {
          const acct = await deps.db.query(
            `SELECT feed_connection_id FROM bank_accounts WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
            [req.params.bankAccountId, req.params.orgId],
          );
          connectionId = acct.rows[0]?.feed_connection_id ?? undefined;
        }
        if (!connectionId) {
          res.status(400).json({
            error: {
              code: 'FEED_NOT_LINKED',
              message: 'Bankkontoen er ikke koblet til en bank-feed. Kjør /feed/connect + /feed/link, eller oppgi connectionId.',
            },
          });
          return;
        }
        const feed = await deps.bankFeed!.fetchTransactions({
          connectionId,
          ...(body.sinceDate ? { sinceDate: body.sinceDate } : {}),
        });
        const result = await importBankTransactions(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          bankAccountId: req.params.bankAccountId!,
          transactions: feed.transactions,
        });
        const suggestions = await suggestMatches(deps.db, {
          organizationId: req.params.orgId!,
          bankAccountId: req.params.bankAccountId!,
        });
        res.status(201).json(toJson({ ...result, fetched: feed.transactions.length, suggestions }));
      } catch (err) {
        next(err);
      }
    },
  );

  // Automatisk daglig bank-synk: henter nye transaksjoner for ALLE tilkoblede
  // bankkontoer (på tvers av org-er) og kjører dem gjennom samme idempotente
  // import + matchingsforslag som manuell synk. Idempotent på external_id → 30-
  // dagers vindu gir ingen dubletter. Bokfører ALDRI selv (kun forslag).
  app.post('/api/cron/bank-sync', async (req, res, next) => {
    try {
      const secret = deps.cronSecret;
      const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
      if (!secret || secret.length < 16) { res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler.' } }); return; }
      const a = Buffer.from(secret); const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } }); return; }
      if (!deps.bankFeed?.configured) { res.json({ configured: false, message: 'Ingen bank-feed konfigurert.' }); return; }
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const accounts = (await deps.db.query(
        `SELECT id, organization_id, created_by, feed_connection_id FROM bank_accounts
         WHERE feed_connection_id IS NOT NULL AND status = 'active'`,
      )).rows;
      let synced = 0, importedTotal = 0, failed = 0;
      const errors: { bankAccountId: string; message: string }[] = [];
      for (const acct of accounts) {
        try {
          const feed = await deps.bankFeed!.fetchTransactions({ connectionId: acct.feed_connection_id, sinceDate: since });
          const result = await importBankTransactions(deps.db, {
            organizationId: acct.organization_id,
            actor: { userId: acct.created_by, role: 'owner' },
            bankAccountId: acct.id,
            transactions: feed.transactions,
          });
          await suggestMatches(deps.db, { organizationId: acct.organization_id, bankAccountId: acct.id });
          synced++;
          importedTotal += result.imported;
        } catch (err) {
          failed++;
          errors.push({ bankAccountId: acct.id, message: err instanceof Error ? err.message : 'ukjent feil' });
        }
      }
      res.json(toJson({ configured: true, since, accounts: accounts.length, synced, imported: importedTotal, failed, errors: errors.slice(0, 10) }));
    } catch (err) { next(err); }
  });

  // Redirect-mål etter bank-samtykke. UAUTENTISERT (frisk nettlesernavigasjon fra
  // banken uten Bearer-token) — vi kan derfor ikke fullføre koblingen her. I stedet
  // mellomlagrer vi `code` på bankkontoen (nøkkel = `state`=orgId:bankAccountId), og
  // den innloggede brukeren trykker «Fullfør kobling» i Reknaren (POST …/feed/link),
  // som plukker opp den lagrede code-en. Ingen sensitive data vises.
  app.get('/bank/callback', async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const code = typeof q.code === 'string' ? q.code : undefined;
      const state = typeof q.state === 'string' ? q.state : typeof q.ref === 'string' ? q.ref : undefined;
      const error = typeof q.error === 'string' ? q.error : undefined;
      let stored = false;
      if (!error && code && state && /^[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(state)) {
        const [orgId, bankAccountId] = state.split(':');
        // Bare mellomlagre når det finnes en påbegynt samtykkeflyt for kontoen.
        const upd = await deps.db.query(
          `UPDATE bank_accounts SET feed_pending_code = $3
           WHERE id = $2 AND organization_id = $1 AND status = 'active' AND feed_requisition_id IS NOT NULL`,
          [orgId, bankAccountId, code],
        );
        stored = (upd.rowCount ?? 0) > 0;
      }
      // GoCardless-flyten har ingen code (fullføres via lagret requisition) → også ok.
      const ok = !error && (stored || (Boolean(state) && !code));
      res.status(200).type('html').send(bankCallbackHtml({ ok, error, code: stored ? undefined : code }));
    } catch (err) {
      next(err);
    }
  });

  // Bankavstemmings-status — «er du ferdig?». Ren lesing.
  app.get(
    '/api/organizations/:orgId/bank/reconciliation-status',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        res.json(toJson(await reconciliationStatus(deps.db, { organizationId: req.params.orgId! })));
      } catch (err) {
        next(err);
      }
    },
  );

  // Guidede kategorier for kontering av banklinjer uten bilag (avhenger av org.form).
  app.get(
    '/api/organizations/:orgId/bank/categories',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const org = await deps.db.query(`SELECT org_form FROM organizations WHERE id = $1`, [req.params.orgId]);
        const orgForm = org.rows[0]?.org_form ?? 'AS';
        res.json(bankCategoriesFor(orgForm));
      } catch (err) {
        next(err);
      }
    },
  );

  // Konterer én banktransaksjon uten bilag etter valgt kategori (gebyr/rente/skatt/…).
  app.post(
    '/api/organizations/:orgId/bank/transactions/:txId/categorize',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ category: z.string().min(1).max(40) }).parse(req.body);
        const result = await categorizeBankTransaction(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          transactionId: req.params.txId!,
          category: body.category,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/bank/transactions',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req, res, next) => {
      try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const args: unknown[] = [req.params.orgId];
        let where = 'organization_id = $1';
        if (status) {
          args.push(status);
          where += ` AND status = $2`;
        }
        const rows = await deps.db.query(
          `SELECT id, bank_account_id, external_id, booked_date::TEXT AS booked_date,
                  amount_minor, currency, description, counterparty, kid, status
           FROM bank_transactions WHERE ${where}
           ORDER BY booked_date DESC LIMIT 500`,
          args,
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/bank/matches',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT m.id, m.bank_transaction_id, m.journal_entry_id, m.source_document_id,
                  m.match_type, m.matched_amount_minor, m.explanation, m.status, m.created_at
           FROM reconciliation_matches m
           WHERE m.organization_id = $1
           ORDER BY m.created_at DESC LIMIT 200`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank/matches/:matchId/approve',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const entry = await approveMatch(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          matchId: req.params.matchId!,
        });
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank/matches/:matchId/reject',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        await rejectMatch(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          matchId: req.params.matchId!,
          reason: body.reason,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Revisjonslogg ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/audit-events',
    requireAuth,
    requireOrgPermission('audit.view'),
    async (req, res, next) => {
      try {
        const params: unknown[] = [req.params.orgId];
        let entitySql = '';
        if (typeof req.query.entityId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.entityId)) {
          params.push(req.query.entityId);
          entitySql = ` AND entity_id = $${params.length}`;
        }
        const rows = await deps.db.query(
          `SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, reason,
                  previous_value, new_value, occurred_at
           FROM audit_events WHERE organization_id = $1${entitySql}
           ORDER BY occurred_at DESC LIMIT 500`,
          params,
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Web-UI (bygget SPA) ──────────────────────────────────────────────────
  if (deps.webDistDir) {
    app.use(express.static(deps.webDistDir, { index: 'index.html' }));
    // SPA-fallback for alle ikke-API-GET-er.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: deps.webDistDir! });
    });
  }

  // ── Feilhåndtering ved systemgrensen ─────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ugyldig forespørsel.', details: err.issues },
      });
      return;
    }
    if (err instanceof DomainError) {
      const statusByCode: Record<string, number> = {
        VALIDATION_ERROR: 400,
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        CONFLICT: 409,
        PERIOD_LOCKED: 409,
        UNBALANCED_ENTRY: 422,
        DUPLICATE: 409,
      };
      res.status(statusByCode[err.code] ?? 400).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    // Ukjent feil: logg internt (uten sensitivt innhold), rapporter til
    // feilovervåking (kun 5xx), generisk svar ut.
    console.error('Uventet feil:', err instanceof Error ? err.message : err);
    deps.errorMonitor?.capture(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Intern feil.' } });
  });

  return app;
}

async function orgVatStatus(
  db: Db,
  orgId: string,
): Promise<'registered' | 'not_registered' | 'pending'> {
  const res = await db.query(`SELECT vat_status FROM organizations WHERE id = $1`, [orgId]);
  return res.rowCount ? res.rows[0].vat_status : 'not_registered';
}
