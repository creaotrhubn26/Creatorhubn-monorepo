import type { MaskinportenConfig } from './integrations/maskinporten.js';

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
      : 'postgres://ledgerly:ledgerly_dev@localhost:5432/ledgerly_dev');
  return {
    productName: env.PRODUCT_NAME ?? 'Ledgerly Norge',
    environment,
    databaseUrl,
    port: Number(env.PORT ?? 4310),
    storageDir: env.LEDGERLY_STORAGE_DIR ?? './data/documents',
    lovdataApiKey: env.LEDGERLY_LOVDATA_API_KEY,
    maskinporten: loadMaskinportenConfig(env),
    sentryDsn: env.SENTRY_DSN,
    sentryRelease: env.SENTRY_RELEASE,
    stripeSecretKey: env.LEDGERLY_STRIPE_SECRET_KEY,
  };
}
