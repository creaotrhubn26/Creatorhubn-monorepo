import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/node';
import { loadConfig } from '../config.js';
import { initSentry } from '../ops/sentry.js';
import { createPool } from '../db/pool.js';
import { DeterministicTextExtractor } from '../pipeline/extract.js';
import { isOcrAvailable, OcrExtractor } from '../pipeline/ocr.js';
import { ClaudeDocumentExtractor } from '../pipeline/ai-extract.js';
import { buildNorwegianRuleRegister } from '../rules/no/rules.js';
import { BrregVatRegisterClient } from '../integrations/brreg.js';
import { BrregCompanyRegistry } from '../integrations/company-registry.js';
import { NorgesBankFxRates } from '../integrations/fx-rates.js';
import { LovdataApiClient } from '../integrations/lovdata.js';
import { MaskinportenClient } from '../integrations/maskinporten.js';
import { SkatteetatenVatSubmissionClient } from '../integrations/vat-submission.js';
import { StripeApiClient } from '../integrations/stripe.js';
import { ResendEmailClient, SmtpEmailClient } from '../integrations/email.js';
import {
  EnableBankingBankFeedProvider,
  GoCardlessBankFeedProvider,
  UnconfiguredBankFeedProvider,
} from '../bank/feed.js';
import { UnconfiguredPeppolAccessPoint } from '../invoicing/ehf.js';
import { IdPortenClient } from '../integrations/idporten.js';
import { ImapGmailAdapter } from '../ingestion/gmail/imap.js';
import { ClaudeEmailClassifier } from '../ingestion/gmail/smart-filter.js';
import { LocalObjectStorage } from '../storage/local.js';
import { createApiServer } from './server.js';

const config = loadConfig();
// Feilovervåking initialiseres tidligst mulig (fanger også oppstartsfeil).
// No-op uten SENTRY_DSN — status rapporteres ærlig.
const errorMonitor = initSentry(
  { dsn: config.sentryDsn, environment: config.environment, release: config.sentryRelease },
  Sentry,
);
const db = createPool(config.databaseUrl);
const rules = buildNorwegianRuleRegister();
const storage = new LocalObjectStorage(config.storageDir);
const webDistDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
const ocrStatus = await isOcrAvailable();
// Bilagslesing: AI (Claude vision) når nøkkel finnes, ellers Tesseract-OCR, ellers
// deterministisk tekstparser. Alle bak samme port — pipelinen er uendret.
const extractor = config.anthropicApiKey
  ? new ClaudeDocumentExtractor(config.anthropicApiKey, config.aiModel)
  : ocrStatus.tesseract
    ? new OcrExtractor()
    : new DeterministicTextExtractor();
const app = createApiServer({
  db,
  rules,
  storage,
  webDistDir: existsSync(webDistDir) ? webDistDir : undefined,
  extractor,
  ocrStatus,
  aiExtraction: Boolean(config.anthropicApiKey),
  aiModel: config.aiModel,
  anthropicApiKey: config.anthropicApiKey,
  // Åpne data fra Brønnøysundregistrene — ekte klient, ingen nøkkel kreves.
  vatRegister: new BrregVatRegisterClient(),
  // Fullt Enhetsregister-oppslag til kunde-/leverandørrisiko (åpne data).
  companyRegistry: new BrregCompanyRegistry(),
  // Automatisk valutakurs fra Norges Bank (åpne data).
  fxRates: new NorgesBankFxRates(),
  // Lovdata: åpne bulk-datasett uten nøkkel; per-paragraf lovtekst krever
  // X-API-Key (REKNAREN_LOVDATA_API_KEY). Status rapporteres ærlig.
  legalText: new LovdataApiClient(config.lovdataApiKey),
  // MVA-melding-innsending via Maskinporten. Uten MASKINPORTEN_*-legitimasjon
  // er den ikke aktiv (rapporteres ærlig); MVA-rapporten forblir kladd.
  vatSubmission: new SkatteetatenVatSubmissionClient(new MaskinportenClient(config.maskinporten)),
  // Feilovervåking (Sentry). No-op uten SENTRY_DSN.
  errorMonitor,
  // Stripe-inntektssynk (kun LES). Inaktiv uten REKNAREN_STRIPE_SECRET_KEY.
  stripe: new StripeApiClient(config.stripeSecretKey),
  // Bank-feed (PSD2/open banking). Enable Banking har forrang, ellers GoCardless,
  // ellers ærlig inaktiv (manuell CSV-import fungerer uansett).
  bankFeed: config.bankFeedEnable
    ? new EnableBankingBankFeedProvider(config.bankFeedEnable)
    : config.bankFeed
      ? new GoCardlessBankFeedProvider(config.bankFeed)
      : new UnconfiguredBankFeedProvider(),
  // EHF/PEPPOL: XML-generering + nedlasting virker alltid; overføring via
  // aksesspunkt er ikke aktiv uten avtale (ærlig no-op).
  peppol: new UnconfiguredPeppolAccessPoint(),
  // ID-porten OIDC for mva-melding (validering/innsending krever pålogget bruker).
  // Inaktiv uten IDPORTEN_CLIENT_ID + nøkkel.
  idporten: new IdPortenClient(config.idporten),
  // Ekte Gmail-lesing via IMAP (samme app-passord som SMTP). Uten creds → sandbox.
  ...(config.smtpUser && config.smtpPassword
    ? {
        gmailAdapterFactory: () =>
          new ImapGmailAdapter({ user: config.smtpUser as string, password: config.smtpPassword as string }),
        gmailMode: 'imap',
      }
    : {}),
  // Smart bilagsfilter: AI-klassifisering med Claude når nøkkel finnes (Haiku = raskt/
  // billig for sortering), ellers heuristikk-only. Reknaren gjenbruker samme nøkkel.
  emailClassifier: new ClaudeEmailClassifier(config.anthropicApiKey),
  // Hodeløs cron-synk: token + org-bootstrap.
  cronSecret: config.cronSecret,
  bootstrapOrg: config.bootstrapOrg,
  // Passordløs innlogging (magisk lenke) — erstatter dev-login i produksjon.
  allowedEmails: config.allowedEmails,
  appBaseUrl: config.appBaseUrl,
  // Utgående e-post for påminnelser. SMTP (Gmail) har forrang når konfigurert,
  // ellers Resend. Inaktiv uten legitimasjon + avsender.
  email:
    config.smtpUser && config.smtpPassword && config.reminderFrom
      ? new SmtpEmailClient({
          host: config.smtpHost ?? 'smtp.gmail.com',
          port: config.smtpPort ?? 465,
          user: config.smtpUser,
          pass: config.smtpPassword,
          from: config.reminderFrom,
        })
      : new ResendEmailClient(config.resendApiKey, config.reminderFrom),
});
console.log(errorMonitor.active ? 'Sentry: feilovervåking aktiv' : 'Sentry: ikke aktiv (SENTRY_DSN mangler)');
console.log(
  ocrStatus.tesseract
    ? 'OCR: Tesseract aktiv (nor+eng)'
    : 'OCR: tesseract-ocr mangler — kun tekstbaserte dokumenter tolkes',
);

app.listen(config.port, () => {
  console.log(`${config.productName} API lytter på port ${config.port} (${config.environment})`);
});
