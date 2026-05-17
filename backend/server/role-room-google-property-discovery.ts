/**
 * Google property/location/channel-discovery — driver dropdown-velgere
 * i Datakilder-fanen så markedsføreren slipper å skrive inn 9-sifrede
 * property-IDs manuelt.
 *
 * Krever at brukeren har koblet Google med utvidet KPI-scope (analytics
 * .readonly, business.manage, webmasters.readonly, yt-analytics.readonly).
 *
 * Hver discovery-funksjon er separat slik at vi kan diagnostisere hvilken
 * scope som mangler hvis brukeren har autorisert noen men ikke alle.
 * Returnerer { items: [...], error?: string } — tomt items + error gir
 * UI en handlingsbar melding ("scope manglende → re-autoriser").
 */

import type { Pool } from "pg";

export interface PropertyCandidate {
  id: string;
  label: string;
  /** Ekstra metadata vi viser i dropdown for kontekst (timezone, currency, etc.) */
  meta?: Record<string, string>;
}

export interface DiscoveryResult<T = PropertyCandidate> {
  items: T[];
  error: string | null;
  /** Når vi vet API-et trenger spesifikt scope, surface det her. */
  missingScope?: string;
}

async function loadGoogleAccessToken(pool: Pool, userId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ access_token_encrypted: string | null }>(
      `SELECT access_token_encrypted
         FROM role_room_google_connections
        WHERE user_id = $1
        ORDER BY COALESCE(last_refreshed_at, expiry_date, now()) DESC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.access_token_encrypted ?? null;
  } catch {
    return null;
  }
}

/** Mappet feil-respons til en bruker-handlingsbar tekst. */
function describeApiError(status: number, body: string): { error: string; missingScope?: string } {
  if (status === 401) {
    return { error: "Token utløpt — re-autoriser Google." };
  }
  if (status === 403) {
    // Google returnerer 403 ved manglende scope OG ved manglende API-aktivering
    if (/insufficient.*scope|insufficientPermissions|PERMISSION_DENIED/i.test(body)) {
      return { error: "Ditt Google-token mangler nødvendig scope. Re-autoriser for å gi tilgang.", missingScope: "yes" };
    }
    if (/SERVICE_DISABLED|API has not been used/i.test(body)) {
      return { error: "Google API er ikke aktivert for prosjektet. Gå til Google Cloud Console og aktiver API'et." };
    }
    return { error: `Google API nektet tilgang: ${body.slice(0, 200)}` };
  }
  if (status === 429) {
    return { error: "Quota oversteget — vent et minutt og prøv igjen." };
  }
  return { error: `Google API HTTP ${status}: ${body.slice(0, 200)}` };
}

// ─────────────────────────────────────────────────────────────────────
// GA4 — Admin API list-properties
// ─────────────────────────────────────────────────────────────────────

/** GA4 Properties tilgjengelig for brukeren. Bruker Admin API (ikke Data API)
 *  — Admin API lister account-summaries som inneholder propertyDetails. */
export async function listGoogleAnalyticsProperties(pool: Pool, userId: string): Promise<DiscoveryResult> {
  const token = await loadGoogleAccessToken(pool, userId);
  if (!token) {
    return { items: [], error: "Google er ikke koblet for denne brukeren." };
  }
  try {
    const url = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200";
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { items: [], ...describeApiError(resp.status, body) };
    }
    const data = await resp.json() as { accountSummaries?: Array<{ displayName?: string; propertySummaries?: Array<{ property?: string; displayName?: string; propertyType?: string }> }> };
    const items: PropertyCandidate[] = [];
    for (const acc of data.accountSummaries ?? []) {
      const accName = acc.displayName ?? "Ukjent konto";
      for (const prop of acc.propertySummaries ?? []) {
        // property er "properties/123456789" — frontend trenger bare tallet
        const idMatch = /properties\/(\d+)/.exec(prop.property ?? "");
        if (!idMatch) continue;
        const propertyId = idMatch[1];
        items.push({
          id: propertyId,
          label: `${prop.displayName ?? "Property"} (${accName})`,
          meta: {
            type: prop.propertyType ?? "GA4",
            fullPath: prop.property ?? "",
          },
        });
      }
    }
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Google Business Profile — list accounts + locations
// ─────────────────────────────────────────────────────────────────────

export async function listGoogleBusinessLocations(pool: Pool, userId: string): Promise<DiscoveryResult> {
  const token = await loadGoogleAccessToken(pool, userId);
  if (!token) return { items: [], error: "Google er ikke koblet." };
  try {
    // Først liste accounts (My Business Account Management API)
    const accountsResp = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!accountsResp.ok) {
      const body = await accountsResp.text().catch(() => "");
      return { items: [], ...describeApiError(accountsResp.status, body) };
    }
    const accountsData = await accountsResp.json() as { accounts?: Array<{ name?: string; accountName?: string }> };
    const items: PropertyCandidate[] = [];
    // For hver account, list locations (Business Information API)
    for (const acc of accountsData.accounts ?? []) {
      const accName = acc.name; // "accounts/12345"
      if (!accName) continue;
      try {
        const locResp = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accName}/locations?readMask=name,title,storefrontAddress`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
        );
        if (!locResp.ok) continue;
        const locData = await locResp.json() as { locations?: Array<{ name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string } }> };
        for (const loc of locData.locations ?? []) {
          if (!loc.name) continue;
          const address = [
            ...(loc.storefrontAddress?.addressLines ?? []),
            loc.storefrontAddress?.locality,
          ].filter(Boolean).join(", ");
          items.push({
            id: loc.name, // f.eks. "locations/789"
            label: address ? `${loc.title ?? "Lokasjon"} — ${address}` : (loc.title ?? "Ukjent lokasjon"),
            meta: { account: acc.accountName ?? accName },
          });
        }
      } catch {
        // Hopp over én account hvis location-fetch feiler — fortsett med resten
      }
    }
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Search Console — list sites
// ─────────────────────────────────────────────────────────────────────

export async function listSearchConsoleSites(pool: Pool, userId: string): Promise<DiscoveryResult> {
  const token = await loadGoogleAccessToken(pool, userId);
  if (!token) return { items: [], error: "Google er ikke koblet." };
  try {
    const resp = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites",
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { items: [], ...describeApiError(resp.status, body) };
    }
    const data = await resp.json() as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
    const items: PropertyCandidate[] = (data.siteEntry ?? [])
      // Bare sites brukeren har Full eller Owner-tilgang til
      .filter((s) => s.siteUrl && (s.permissionLevel === "siteOwner" || s.permissionLevel === "siteFullUser"))
      .map((s) => ({
        id: s.siteUrl!,
        label: s.siteUrl!,
        meta: { permission: s.permissionLevel ?? "" },
      }));
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// YouTube — list channels brukeren eier
// ─────────────────────────────────────────────────────────────────────

export async function listYouTubeChannels(pool: Pool, userId: string): Promise<DiscoveryResult> {
  const token = await loadGoogleAccessToken(pool, userId);
  if (!token) return { items: [], error: "Google er ikke koblet." };
  try {
    const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true";
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { items: [], ...describeApiError(resp.status, body) };
    }
    const data = await resp.json() as { items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string }; statistics?: { subscriberCount?: string } }> };
    const items: PropertyCandidate[] = (data.items ?? [])
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id!,
        label: `${c.snippet?.title ?? "Kanal"}${c.snippet?.customUrl ? ` (${c.snippet.customUrl})` : ""}`,
        meta: {
          subscribers: c.statistics?.subscriberCount ?? "0",
        },
      }));
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Unified discovery — én kall, alle kandidater
// ─────────────────────────────────────────────────────────────────────

export async function discoverAllGoogleProperties(
  pool: Pool,
  userId: string,
): Promise<{
  analytics: DiscoveryResult;
  business: DiscoveryResult;
  searchConsole: DiscoveryResult;
  youtube: DiscoveryResult;
}> {
  // Parallel — alle 4 calls kjører samtidig. Hver er ~500ms-2s.
  const [analytics, business, searchConsole, youtube] = await Promise.all([
    listGoogleAnalyticsProperties(pool, userId),
    listGoogleBusinessLocations(pool, userId),
    listSearchConsoleSites(pool, userId),
    listYouTubeChannels(pool, userId),
  ]);
  return { analytics, business, searchConsole, youtube };
}
