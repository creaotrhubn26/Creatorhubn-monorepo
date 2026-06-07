/**
 * google-ads-conversions.ts
 *
 * Frontend-helper som firer Google Ads conversion-events via gtag.
 *
 * Flyt:
 *   1. Henter /api/public/ads-config én gang ved første kall (cached).
 *   2. Hvis enabled — kjører gtag('config', AW-XXX) for å initialisere
 *      Google Ads-konfig (cookie/identifier).
 *   3. Eksposerer fireConversion(action, params) som firer:
 *      gtag('event', 'conversion', { send_to: 'AW-XXX/LABEL', ...params })
 *
 * Aktiveres når disse env-vars settes på backend:
 *   GOOGLE_ADS_CONVERSION_ID   (AW-XXXXXXXXX)
 *   GOOGLE_ADS_LABEL_LEAD      (per action, 11 tegn)
 *   GOOGLE_ADS_LABEL_DEMO
 *   GOOGLE_ADS_LABEL_SIGNUP
 *
 * Uten config = no-op (safe default).
 *
 * Brukes på:
 *   - agency-landing.tsx LeadForm.handleSubmit → fireConversion('lead', ...)
 *   - theroleroom-landing.tsx handleLoginSuccess → fireConversion('signup')
 *
 * Setup: kjør `node backend/scripts/setup-google-ads-conversions.playwright.mjs`
 */

type AdsConfig =
  | { enabled: false }
  | {
      enabled: true;
      conversionId: string;
      labels: {
        lead: string | null;
        demo: string | null;
        signup: string | null;
      };
    };

type ConversionAction = 'lead' | 'demo' | 'signup';

interface ConversionParams {
  /** Beløp i konfigurert valuta — bruk 1 for leads, 0 for andre. */
  value?: number;
  /** ISO 4217. Default 'NOK'. */
  currency?: string;
  /** Optional transaction-ID for dedup. */
  transactionId?: string;
}

let cachedConfigPromise: Promise<AdsConfig> | null = null;

async function loadAdsConfig(): Promise<AdsConfig> {
  if (cachedConfigPromise) return cachedConfigPromise;
  cachedConfigPromise = (async () => {
    try {
      const r = await fetch('/api/public/ads-config', { credentials: 'omit' });
      if (!r.ok) return { enabled: false } as const;
      const cfg = (await r.json()) as AdsConfig;
      if (cfg.enabled && typeof window !== 'undefined' && typeof window.gtag === 'function') {
        // Init Google Ads gtag-config. Trygt å kalle flere ganger — gtag dedup'er.
        window.gtag('config', cfg.conversionId);
      }
      return cfg;
    } catch {
      return { enabled: false } as const;
    }
  })();
  return cachedConfigPromise;
}

/**
 * Fire en Google Ads conversion. No-op hvis ads-config ikke er konfigurert.
 *
 * @param action  'lead' | 'demo' | 'signup'
 * @param params  optional value + currency for verdibasert bidding
 */
export async function fireGoogleAdsConversion(
  action: ConversionAction,
  params?: ConversionParams,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  const cfg = await loadAdsConfig();
  if (!cfg.enabled) return;
  const label = cfg.labels[action];
  if (!label) return;
  window.gtag('event', 'conversion', {
    send_to: `${cfg.conversionId}/${label}`,
    value: params?.value ?? 0,
    currency: params?.currency ?? 'NOK',
    ...(params?.transactionId ? { transaction_id: params.transactionId } : {}),
  });
}

/**
 * Eager-load ads-config ved app-init. Optional — fireGoogleAdsConversion
 * triggrer lazy-load uansett, men eager-init reduserer latens på første
 * conversion ved at gtag-config er kjørt før user-aksjon.
 */
export function initGoogleAdsConversions(): void {
  void loadAdsConfig();
}
