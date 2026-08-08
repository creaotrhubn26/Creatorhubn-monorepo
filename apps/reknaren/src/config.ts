import type { MaskinportenConfig } from './integrations/maskinporten.js';
import type { BootstrapOrgConfig } from './ops/bootstrap.js';
import { parseAllowlist } from './api/magic-link.js';
import type { OrganizationForm, VatRegistrationStatus } from './rules/types.js';

/**
 * Produktkonfigurasjon. Produktnavnet er BEVISST ikke hardkodet i domenemodellen —
 * det er ren presentasjon og kan endres uten kodeendring i domenet.
 */
export interface ProductConfig {
  productName: string;
  environment: 'development' | 'test' | 'production';
  databaseUrl: string;
  port: number;
  /** Katalog for lokalt objektlager (dokumentinnhold). */
  storageDir: string;
  /**
   * Lovdata API-nøkkel (X-API-Key). Kreves for per-paragraf lovtekst-oppslag.
   * Uten den rapporteres Lovdata-integrasjonen ærlig som ikke aktiv; åpne
   * NLOD-bulkdatasett er uansett tilgjengelig uten nøkkel.
   */
  lovdataApiKey?: string | undefined;
  /**
   * Maskinporten-legitimasjon for Skatteetatens «granted»-API-er (MVA-melding-
   * innsending). Udefinert = integrasjonen rapporteres ærlig som ikke aktiv.
   */
  maskinporten?: MaskinportenConfig | undefined;
  /** Sentry DSN for feilovervåking. Udefinert = feilovervåking ikke aktiv. */
  sentryDsn?: string | undefined;
  /** Release-tag til Sentry (f.eks. git-sha), valgfri. */
  sentryRelease?: string | undefined;
  /**
   * Stripe secret key (helst RESTRICTED, kun lese-tilgang) for inntektssynk:
   * betalende kunder registreres i regnskapet. Udefinert = synk ikke aktiv.
   */
  stripeSecretKey?: string | undefined;
  /** Resend API-nøkkel for utgående e-post (påminnelser). Udefinert = sending inaktiv. */
  resendApiKey?: string | undefined;
  /** Avsenderadresse for påminnelser (f.eks. 'faktura@creatorhubn.com'). */
  reminderFrom?: string | undefined;
  /** SMTP (f.eks. Gmail). Har forrang over Resend når bruker+passord finnes. */
  smtpHost?: string | undefined;
  smtpPort?: number | undefined;
  smtpUser?: string | undefined;
  smtpPassword?: string | undefined;
  /** Domene for virksomhetenes bilag-adresse (videresend kvitteringer hit). */
  inboundDomain: string;
  /** Delt hemmelighet for den generiske inn-e-post-webhooken. Udefinert = 503. */
  inboundSecret?: string | undefined;
  /** Svix-signeringshemmelighet for Resend inn-e-post-webhook. Udefinert = 503. */
  resendWebhookSecret?: string | undefined;
  /**
   * Hemmelig token for hodeløse cron-jobber (f.eks. Stripe-synk). Udefinert =
   * cron-endepunktene svarer 503 (ikke konfigurert).
   */
  cronSecret?: string | undefined;
  /**
   * Organisasjonen hodeløse jobber opererer på (Creatorhubs egne bøker). Bygges
   * kun når org.nr + navn finnes i env. Udefinert = ingen bootstrap.
   */
  bootstrapOrg?: BootstrapOrgConfig | undefined;
  /** Tillatte innloggings-e-poster (magisk lenke), fra REKNAREN_ALLOWED_EMAILS. */
  allowedEmails: string[];
  /** Basis-URL for magiske lenker (REKNAREN_APP_URL). */
  appBaseUrl?: string | undefined;
  /** Anthropic API-nøkkel for AI-bilagslesing. Udefinert = AI-uttrekk ikke aktivt. */
  anthropicApiKey?: string | undefined;
  /** Claude-modell for bilagslesing (default claude-sonnet-4-6). */
  aiModel: string;
  /**
   * GoCardless Bank Account Data (PSD2/open banking) for automatisk bank-feed.
   * Bygges kun når BEGGE hemmeligheter finnes. Udefinert = feed ikke aktiv
   * (manuell CSV-import fungerer uansett).
   */
  bankFeed?: { secretId: string; secretKey: string } | undefined;
  /**
   * Enable Banking (nordisk PSD2-aggregator) — alternativ bank-feed. Bygges kun når
   * BEGGE finnes. Har forrang over GoCardless når konfigurert.
   */
  bankFeedEnable?: { applicationId: string; privateKeyPem: string } | undefined;
  /**
   * ID-porten OIDC for mva-melding (validering/innsending). Bygges når
   * IDPORTEN_CLIENT_ID + nøkkel finnes (nøkkel/kid kan gjenbrukes fra Maskinporten).
   * redirectUri utledes av appBaseUrl (/idporten/callback).
   */
  idporten?: { env: 'test' | 'prod'; clientId: string; keyId: string; privateKeyPem: string; scopes: string; redirectUri: string } | undefined;
}

const ORG_FORMS: OrganizationForm[] = ['ENK', 'AS', 'ANS', 'DA', 'SA', 'NUF'];

function loadBootstrapOrg(env: NodeJS.ProcessEnv): BootstrapOrgConfig | undefined {
  const orgNumber = env.REKNAREN_ORG_NUMBER;
  const name = env.REKNAREN_ORG_NAME;
  if (!orgNumber || !name) return undefined;
  const orgForm = (ORG_FORMS as string[]).includes(env.REKNAREN_ORG_FORM ?? '')
    ? (env.REKNAREN_ORG_FORM as OrganizationForm)
    : 'AS';
  const vatStatus: VatRegistrationStatus =
    env.REKNAREN_ORG_VAT_STATUS === 'registered'
      ? 'registered'
      : env.REKNAREN_ORG_VAT_STATUS === 'pending'
        ? 'pending'
        : 'not_registered';
  return {
    name,
    orgNumber,
    orgForm,
    vatStatus,
    systemUserEmail: env.REKNAREN_SYSTEM_USER_EMAIL ?? 'system@reknaren.local',
    systemUserName: env.REKNAREN_SYSTEM_USER_NAME ?? 'Reknaren System (cron)',
  };
}

/** Bygger Maskinporten-konfig fra env kun når ALLE påkrevde felt finnes. */
function loadMaskinportenConfig(env: NodeJS.ProcessEnv): MaskinportenConfig | undefined {
  const clientId = env.MASKINPORTEN_CLIENT_ID;
  const scope = env.MASKINPORTEN_SCOPE;
  const privateKeyPem = env.MASKINPORTEN_PRIVATE_KEY;
  const keyId = env.MASKINPORTEN_KEY_ID;
  if (!clientId || !scope || !privateKeyPem || !keyId) return undefined;
  return {
    env: env.MASKINPORTEN_ENV === 'prod' ? 'prod' : 'test',
    clientId,
    scope,
    privateKeyPem,
    keyId,
    ...(env.MASKINPORTEN_CONSUMER_ORG ? { consumerOrg: env.MASKINPORTEN_CONSUMER_ORG } : {}),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProductConfig {
  const environment = (env.NODE_ENV ?? 'development') as ProductConfig['environment'];
  const databaseUrl =
    env.DATABASE_URL ??
    (environment === 'production'
      ? (() => {
          throw new Error('DATABASE_URL må settes i produksjon');
        })()
      : 'postgres://reknaren:reknaren_dev@localhost:5432/reknaren_dev');
  return {
    productName: env.PRODUCT_NAME ?? 'Reknaren',
    environment,
    databaseUrl,
    port: Number(env.PORT ?? 4310),
    storageDir: env.REKNAREN_STORAGE_DIR ?? './data/documents',
    lovdataApiKey: env.REKNAREN_LOVDATA_API_KEY,
    maskinporten: loadMaskinportenConfig(env),
    sentryDsn: env.SENTRY_DSN,
    sentryRelease: env.SENTRY_RELEASE,
    stripeSecretKey: env.REKNAREN_STRIPE_SECRET_KEY,
    resendApiKey: env.REKNAREN_RESEND_API_KEY,
    reminderFrom: env.REKNAREN_REMINDER_FROM,
    smtpHost: env.REKNAREN_SMTP_HOST ?? 'smtp.gmail.com',
    smtpPort: Number(env.REKNAREN_SMTP_PORT ?? 465),
    smtpUser: env.REKNAREN_SMTP_USER,
    smtpPassword: env.REKNAREN_SMTP_PASSWORD,
    inboundDomain: env.REKNAREN_INBOUND_DOMAIN ?? 'inbound.reknaren.no',
    inboundSecret: env.REKNAREN_INBOUND_SECRET,
    resendWebhookSecret: env.REKNAREN_RESEND_WEBHOOK_SECRET,
    cronSecret: env.REKNAREN_CRON_SECRET,
    bootstrapOrg: loadBootstrapOrg(env),
    allowedEmails: parseAllowlist(env.REKNAREN_ALLOWED_EMAILS),
    appBaseUrl: env.REKNAREN_APP_URL,
    anthropicApiKey: env.REKNAREN_ANTHROPIC_API_KEY,
    aiModel: env.REKNAREN_AI_MODEL ?? 'claude-sonnet-4-6',
    bankFeed:
      env.REKNAREN_GOCARDLESS_SECRET_ID && env.REKNAREN_GOCARDLESS_SECRET_KEY
        ? { secretId: env.REKNAREN_GOCARDLESS_SECRET_ID, secretKey: env.REKNAREN_GOCARDLESS_SECRET_KEY }
        : undefined,
    bankFeedEnable:
      env.REKNAREN_ENABLEBANKING_APP_ID && env.REKNAREN_ENABLEBANKING_PRIVATE_KEY
        ? {
            applicationId: env.REKNAREN_ENABLEBANKING_APP_ID,
            privateKeyPem: env.REKNAREN_ENABLEBANKING_PRIVATE_KEY,
          }
        : undefined,
    idporten: loadIdPortenConfig(env),
  };
}

/** ID-porten-konfig fra env. Nøkkel/kid kan gjenbrukes fra Maskinporten-oppsettet. */
function loadIdPortenConfig(env: NodeJS.ProcessEnv): ProductConfig['idporten'] {
  const clientId = env.IDPORTEN_CLIENT_ID;
  const privateKeyPem = env.IDPORTEN_PRIVATE_KEY ?? env.MASKINPORTEN_PRIVATE_KEY;
  const keyId = env.IDPORTEN_KEY_ID ?? env.MASKINPORTEN_KEY_ID;
  if (!clientId || !privateKeyPem || !keyId) return undefined;
  const base = (env.REKNAREN_APP_URL ?? 'https://ledgerly-coss.onrender.com').replace(/\/$/, '');
  return {
    env: env.IDPORTEN_ENV === 'test' ? 'test' : 'prod',
    clientId,
    keyId,
    privateKeyPem,
    scopes: env.IDPORTEN_SCOPES ?? 'openid skatteetaten:mvameldingvalidering',
    redirectUri: env.IDPORTEN_REDIRECT_URI ?? `${base}/idporten/callback`,
  };
}
