/**
 * HTTP-API for den vertikale flyten. Autorisasjon håndheves på hvert endepunkt:
 * autentisert bruker → aktivt medlemskap i organisasjonen → rettighet for handlingen.
 * Feil oversettes til HTTP-statuser ved systemgrensen; interne detaljer lekkes ikke.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { hasPermission, ROLES, type Permission } from '../access/permissions.js';
import { getAccountDef, STANDARD_ACCOUNTS } from '../coa/accounts.js';
import { getVatCode, VAT_CODES } from '../coa/vat-codes.js';
import type { Db } from '../db/pool.js';
import { SandboxGmailAdapter } from '../ingestion/gmail/sandbox.js';
import type { GmailPort } from '../ingestion/gmail/port.js';
import { SmartGmailFilter, type EmailClassifier, type EmailSignals } from '../ingestion/gmail/smart-filter.js';
import { lockPeriod, reverseJournalEntry } from '../ledger/engine.js';
import {
  balanceSheet,
  generalLedger,
  incomeStatement,
  subledger,
  trialBalance,
  vatRegistrationThreshold,
} from '../ledger/reports.js';
import { runHealthCheck } from '../ledger/health-check.js';
import {
  createOrganization,
  ensureUser,
  getMembershipRole,
  getOrganizationProfile,
  updateOrganizationSettings,
} from '../orgs/service.js';
import type { VatRegisterLookup } from '../integrations/brreg.js';
import type { LovdataPort } from '../integrations/lovdata.js';
import type { VatSubmissionPort } from '../integrations/vat-submission.js';
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
import { createBankAccount, importBankTransactions, parseBankCsv } from '../bank/import.js';
import type { BankFeedProvider } from '../bank/feed.js';
import { approveMatch, rejectMatch, suggestMatches } from '../bank/matching.js';
import { reconciliationStatus } from '../bank/reconciliation.js';
import { bankCategoriesFor, categorizeBankTransaction } from '../bank/categorize.js';
import { createCreditNote, createInvoiceDraft, issueInvoice } from '../invoicing/service.js';
import { createDimension, dimensionResultReport, listDimensions } from '../dimensions/service.js';
import { buildSafTXml } from '../saft/export.js';
import { parseSaft } from '../saft/import.js';
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

/** JSON-serialisering: bigint (øre) blir strenger — aldri flyttall over grensen. */
function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
  orgRole?: string;
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
  /** Oppslag mot MVA-registeret (Brreg åpne data). Uten denne er kontrollen utilgjengelig. */
  vatRegister?: VatRegisterLookup | undefined;
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
          `SELECT * FROM extracted_document_data WHERE document_id = $1 ORDER BY extraction_version DESC LIMIT 1`,
          [req.params.documentId],
        );
        const suggestions = await deps.db.query(
          `SELECT id, suggestion, engine, status, created_at FROM posting_suggestions
           WHERE document_id = $1 ORDER BY created_at DESC`,
          [req.params.documentId],
        );
        // «Hvorfor foreslår dere dette?» — forklaring med kilder fra regelregisteret.
        const latest = suggestions.rows[0];
        const explanation = latest
          ? {
              evidence: latest.suggestion.evidence,
              assumptions: latest.suggestion.assumptions,
              missingInformation: latest.suggestion.missingInformation,
              alternatives: latest.suggestion.alternatives,
              confidence: latest.suggestion.confidence,
              rules: (latest.suggestion.ruleReferences as string[]).map((ruleId) => {
                const rule = deps.rules.getRule(ruleId);
                return {
                  ruleId,
                  shortName: rule.shortName,
                  plainExplanation: rule.plainExplanation,
                  sources: rule.sourceIds.map((sid) => {
                    const s = deps.rules.getSource(sid);
                    return { title: s.title, url: s.url, lastVerified: s.lastVerified };
                  }),
                };
              }),
            }
          : null;
        res.json(
          toJson({
            document: doc.rows[0],
            extraction: extraction.rows[0] ?? null,
            suggestions: suggestions.rows,
            explanation,
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
        res.json(toJson({ ...threshold, vatStatus: org.rows[0]?.vat_status ?? 'not_registered' }));
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
