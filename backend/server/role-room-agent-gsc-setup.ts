/**
 * role-room-agent-gsc-setup.ts — OAuth-fasen (doc 14, del 3):
 * Search Console-oppsett via API på klientens Google-kobling.
 *
 * Tre steg, alle programmatiske (scopes: siteverification + webmasters):
 *
 *   1. Site Verification API: hent META-token → verifiser domenet
 *   2. Search Console API: legg til site i klientens GSC
 *   3. Search Console API: meld inn sitemap
 *
 * To-fase-flyt når domenet ikke er verifisert ennå: metataggen må ligge
 * i <head> FØR verifisering kan lykkes — da returneres `pending` med
 * taggen som skal deployes, og kjøringen gjentas etterpå (idempotent:
 * allerede-verifisert hopper rett til site + sitemap).
 *
 * Redelighet: verifisering beviser eierskap overfor Google — den gjøres
 * KUN for domener klienten faktisk eier, alltid bak eksplisitt
 * brukerhandling i UI.
 */

const SITE_VERIFICATION_API = "https://www.googleapis.com/siteVerification/v1";
const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3";

export type GscFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: unknown }>;

export interface GscSetupResult {
  siteUrl: string;
  verification: "already_verified" | "verified_now" | "pending";
  /** Metataggen som må i <head> når verification === "pending". */
  verificationMetaTag: string | null;
  siteAdded: boolean;
  sitemapSubmitted: boolean;
  sitemapUrl: string | null;
  warnings: string[];
}

export type GscSetupOutcome =
  | { ok: true; result: GscSetupResult }
  | { ok: false; error: string; needsReauth?: boolean };

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export function buildVerificationMetaTag(token: string): string {
  return `<meta name="google-site-verification" content="${token}" />`;
}

export async function runGscSetup(opts: {
  accessToken: string;
  domain: string;
  sitemapUrl?: string | null;
  fetcher?: GscFetcher;
}): Promise<GscSetupOutcome> {
  const domain = normalizeDomain(opts.domain);
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false, error: "ugyldig_domene" };
  }
  const siteUrl = `https://${domain}/`;
  const fetcher = opts.fetcher ?? defaultGscFetcher;
  const call = (url: string, method: string, body?: unknown) =>
    fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const site = { site: { identifier: siteUrl, type: "SITE" } };
  const warnings: string[] = [];

  // 1a) Er domenet allerede verifisert for denne brukeren?
  const existingRes = await call(
    `${SITE_VERIFICATION_API}/webResource/${encodeURIComponent(siteUrl)}`,
    "GET",
  );
  if (existingRes.status === 401 || existingRes.status === 403) {
    return {
      ok: false,
      error: "Google-koblingen mangler verifiserings-tilgang — koble til Google på nytt (nye tilganger ble lagt til).",
      needsReauth: true,
    };
  }

  let verification: GscSetupResult["verification"];
  let verificationMetaTag: string | null = null;

  if (existingRes.status === 200) {
    verification = "already_verified";
  } else {
    // 1b) Hent META-token. Taggen MÅ være deployet før verify lykkes.
    const tokenRes = await call(`${SITE_VERIFICATION_API}/token`, "POST", {
      ...site,
      verificationMethod: "META",
    });
    if (tokenRes.status !== 200) {
      return { ok: false, error: `Kunne ikke hente verifiserings-token (HTTP ${tokenRes.status})` };
    }
    const token = (tokenRes.json as { token?: string })?.token;
    if (!token) return { ok: false, error: "Tomt verifiserings-token fra Google." };
    verificationMetaTag = buildVerificationMetaTag(token);

    // 1c) Forsøk verifisering — lykkes kun hvis taggen alt ligger ute.
    const verifyRes = await call(
      `${SITE_VERIFICATION_API}/webResource?verificationMethod=META`,
      "POST",
      site,
    );
    if (verifyRes.status === 200) {
      verification = "verified_now";
    } else {
      // Taggen er ikke på siden ennå — ærlig to-fase-svar, ikke feil.
      return {
        ok: true,
        result: {
          siteUrl,
          verification: "pending",
          verificationMetaTag,
          siteAdded: false,
          sitemapSubmitted: false,
          sitemapUrl: null,
          warnings: [
            "Metataggen må ligge i <head> på forsiden før verifisering kan fullføres. Deploy taggen (snippet-generatoren kan ta den med) og kjør dette steget igjen.",
          ],
        },
      };
    }
  }

  // 2) Legg til site i Search Console (idempotent — 204 også når den finnes).
  const addRes = await call(`${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}`, "PUT");
  const siteAdded = addRes.status === 200 || addRes.status === 204;
  if (!siteAdded) warnings.push(`Kunne ikke legge til site i Search Console (HTTP ${addRes.status}).`);

  // 3) Meld inn sitemap (default /sitemap.xml).
  const sitemapUrl = (opts.sitemapUrl?.trim() || `https://${domain}/sitemap.xml`);
  let sitemapSubmitted = false;
  if (siteAdded) {
    const smRes = await call(
      `${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      "PUT",
    );
    sitemapSubmitted = smRes.status === 200 || smRes.status === 204;
    if (!sitemapSubmitted) warnings.push(`Sitemap-innmelding feilet (HTTP ${smRes.status}) — sjekk at ${sitemapUrl} svarer 200.`);
  }

  return {
    ok: true,
    result: { siteUrl, verification, verificationMetaTag, siteAdded, sitemapSubmitted, sitemapUrl, warnings },
  };
}

const defaultGscFetcher: GscFetcher = async (url, init) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
};
