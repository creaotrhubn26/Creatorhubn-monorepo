/**
 * role-room-agent-meta-pixel-setup.ts — OAuth-fasen (doc 14, del 3):
 * Meta Pixel via Marketing API på prosjektets eksisterende Meta-kobling
 * (scopene ads_management + business_management er allerede i
 * REQUIRED_SCOPES for Instagram-koblingen).
 *
 *   1. Finn annonsekontoer på brukeren (aktive først)
 *   2. Gjenbruk eksisterende pixel på kontoen, ellers opprett navngitt
 *      etter domenet → pixel-ID rett inn i snippet-generatoren (F2)
 *
 * Policy (doc 14 §1.4): pixelen KOBLES, aldri aktiveres — oppsett og
 * annonse-aktivering er separate beslutninger, og consent-gating
 * (marketing-samtykke) håndteres av snippeten, ikke her.
 *
 * Ærlige grenser: en ANNONSEKONTO kan ikke opprettes via API for
 * vanlige brukere (Business Manager-oppgave) — mangler konto returneres
 * tydelig feil med henvisning. Utløpt token → needsReauth.
 */

const META_GRAPH = "https://graph.facebook.com/v21.0";

export type MetaFetcher = (
  url: string,
  init: { method: string; body?: string },
) => Promise<{ status: number; json: unknown }>;

interface AdAccount {
  id: string; // "act_123"
  name?: string;
  account_status?: number; // 1 = ACTIVE
}

interface AdsPixel {
  id: string;
  name?: string;
}

export interface MetaPixelSetupResult {
  adAccountId: string;
  adAccountName: string | null;
  pixelId: string;
  pixelCreated: boolean;
  warnings: string[];
}

export type MetaPixelSetupOutcome =
  | { ok: true; result: MetaPixelSetupResult }
  | { ok: false; error: string; needsReauth?: boolean };

/** Aktive kontoer først; ellers første. Null når listen er tom. */
export function pickAdAccount(accounts: AdAccount[]): AdAccount | null {
  if (accounts.length === 0) return null;
  return accounts.find((a) => a.account_status === 1) ?? accounts[0];
}

function isAuthError(status: number, json: unknown): boolean {
  if (status === 401) return true;
  const code = (json as { error?: { code?: number } })?.error?.code;
  return code === 190; // OAuthException: token utløpt/ugyldig
}

function metaErrorMessage(json: unknown): string | null {
  return (json as { error?: { message?: string } })?.error?.message ?? null;
}

export async function runMetaPixelSetup(opts: {
  accessToken: string;
  domain: string;
  fetcher?: MetaFetcher;
}): Promise<MetaPixelSetupOutcome> {
  const domain = opts.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false, error: "ugyldig_domene" };
  }
  const fetcher = opts.fetcher ?? defaultMetaFetcher;
  const token = encodeURIComponent(opts.accessToken);

  // 1) Annonsekontoer på brukeren bak koblingen.
  const accountsRes = await fetcher(
    `${META_GRAPH}/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${token}`,
    { method: "GET" },
  );
  if (isAuthError(accountsRes.status, accountsRes.json)) {
    return {
      ok: false,
      error: "Meta-koblingen er utløpt eller mangler tilgang — koble til Meta på nytt i Kontotilgang.",
      needsReauth: true,
    };
  }
  if (accountsRes.status !== 200) {
    return { ok: false, error: metaErrorMessage(accountsRes.json) ?? `adaccounts feilet (HTTP ${accountsRes.status})` };
  }
  const accounts = ((accountsRes.json as { data?: AdAccount[] })?.data ?? []);
  const account = pickAdAccount(accounts);
  if (!account) {
    return {
      ok: false,
      error:
        "Ingen annonsekonto på Meta-brukeren. En annonsekonto opprettes i Business Manager (Innstillinger → Annonsekontoer) — gjør det én gang, så tar API-et resten.",
    };
  }

  const warnings: string[] = [];
  if (account.account_status !== 1) {
    warnings.push(`Annonsekontoen «${account.name ?? account.id}» er ikke aktiv (status ${account.account_status ?? "?"}) — pixelen virker, men annonser krever aktiv konto.`);
  }

  // 2) Gjenbruk eksisterende pixel (normen er én per konto), ellers opprett.
  const pixelsRes = await fetcher(
    `${META_GRAPH}/${account.id}/adspixels?fields=id,name&access_token=${token}`,
    { method: "GET" },
  );
  const pixels = pixelsRes.status === 200 ? ((pixelsRes.json as { data?: AdsPixel[] })?.data ?? []) : [];
  const existing = pixels.find((p) => (p.name ?? "").toLowerCase().includes(domain)) ?? pixels[0] ?? null;

  if (existing) {
    if (!(existing.name ?? "").toLowerCase().includes(domain)) {
      warnings.push(`Gjenbrukte eksisterende pixel «${existing.name ?? existing.id}» — verifiser at den skal brukes for ${domain}.`);
    }
    return {
      ok: true,
      result: {
        adAccountId: account.id,
        adAccountName: account.name ?? null,
        pixelId: existing.id,
        pixelCreated: false,
        warnings,
      },
    };
  }

  const createRes = await fetcher(
    `${META_GRAPH}/${account.id}/adspixels`,
    { method: "POST", body: new URLSearchParams({ name: `${domain} pixel`, access_token: opts.accessToken }).toString() },
  );
  if (isAuthError(createRes.status, createRes.json)) {
    return { ok: false, error: "Meta-koblingen er utløpt — koble til på nytt.", needsReauth: true };
  }
  if (createRes.status !== 200) {
    return { ok: false, error: metaErrorMessage(createRes.json) ?? `Pixel-opprettelse feilet (HTTP ${createRes.status})` };
  }
  const pixelId = (createRes.json as { id?: string })?.id;
  if (!pixelId) return { ok: false, error: "Tomt pixel-svar fra Meta." };

  return {
    ok: true,
    result: {
      adAccountId: account.id,
      adAccountName: account.name ?? null,
      pixelId,
      pixelCreated: true,
      warnings,
    },
  };
}

const defaultMetaFetcher: MetaFetcher = async (url, init) => {
  const response = await fetch(url, {
    method: init.method,
    ...(init.body !== undefined
      ? { body: init.body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
};
