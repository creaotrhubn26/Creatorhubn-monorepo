/**
 * role-room-agent-ga4-setup.ts — OAuth-fasen (doc 14, del 3):
 * GA4-oppsett via Admin API på klientens eksisterende Google-kobling.
 *
 * Dette er «systemet setter opp alt»-veien: ingen browser-styring, ingen
 * passord — OAuth-token med analytics.edit gjør jobben programmatisk:
 *
 *   1. Finn (eller opprett) property for domenet — Europe/Oslo, NOK
 *   2. Finn (eller opprett) web-datastrøm → måle-ID (G-…)
 *   3. Sett datalagring til 14 mnd (GA4-default er bare 2)
 *   4. Opprett key events fra event-planen (F3)
 *
 * Grenser (redelighet): en GA4-KONTO kan ikke opprettes via API (krever
 * ToS-aksept i UI) — finnes ingen konto, returneres tydelig feil med
 * henvisning til F4-guiden. Manglende scope → needsReauth (koblingen må
 * fornyes etter scope-utvidelsen).
 *
 * Idempotent: kjøres den igjen gjenbrukes property/stream som matcher
 * domenet, og «finnes allerede»-svar på key events regnes som suksess.
 */

import { buildEventPlan, type BusinessGoal } from "./integrations/analytics-bootstrap.js";

const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";

export type Ga4Fetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: unknown }>;

interface PropertySummary {
  property: string; // "properties/123"
  displayName?: string;
}

interface AccountSummary {
  account: string; // "accounts/456"
  displayName?: string;
  propertySummaries?: PropertySummary[];
}

export interface Ga4SetupResult {
  propertyId: string;
  propertyCreated: boolean;
  measurementId: string | null;
  streamCreated: boolean;
  retentionSet: boolean;
  keyEvents: Array<{ eventName: string; status: "created" | "already_exists" | "failed" }>;
  warnings: string[];
}

export type Ga4SetupOutcome =
  | { ok: true; result: Ga4SetupResult }
  | { ok: false; error: string; needsReauth?: boolean };

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}

/** Match property på displayName (vi navngir properties med domenet). */
export function pickExistingProperty(
  summaries: AccountSummary[],
  domain: string,
): { account: string; property: string } | null {
  const target = normalizeDomain(domain);
  for (const account of summaries) {
    for (const prop of account.propertySummaries ?? []) {
      const name = (prop.displayName ?? "").trim().toLowerCase().replace(/^www\./, "");
      if (name === target || name === `https://${target}`) {
        return { account: account.account, property: prop.property };
      }
    }
  }
  return null;
}

export async function runGa4Setup(opts: {
  accessToken: string;
  domain: string;
  goals: BusinessGoal[];
  fetcher?: Ga4Fetcher;
}): Promise<Ga4SetupOutcome> {
  const domain = normalizeDomain(opts.domain);
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false, error: "ugyldig_domene" };
  }
  const fetcher = opts.fetcher ?? defaultGa4Fetcher;
  const call = (path: string, method: string, body?: unknown) =>
    fetcher(`${ADMIN_API}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  // 1) Kontooversikt — avdekker samtidig scope-/reauth-problemer tidlig.
  const summariesRes = await call("accountSummaries?pageSize=200", "GET");
  if (summariesRes.status === 401 || summariesRes.status === 403) {
    return {
      ok: false,
      error: "Google-koblingen mangler GA4-admin-tilgang — koble til Google på nytt (nye tilganger ble lagt til).",
      needsReauth: true,
    };
  }
  if (summariesRes.status !== 200) {
    return { ok: false, error: `accountSummaries feilet (HTTP ${summariesRes.status})` };
  }
  const summaries = ((summariesRes.json as { accountSummaries?: AccountSummary[] })?.accountSummaries ?? []);
  if (summaries.length === 0) {
    return {
      ok: false,
      error:
        "Ingen GA4-konto på denne Google-brukeren. En KONTO kan ikke opprettes via API (krever vilkårsaksept i analytics.google.com) — opprett den én gang manuelt (se GA4-guiden), så tar API-et resten.",
    };
  }

  const warnings: string[] = [];

  // 2) Property: gjenbruk match på domenenavn, ellers opprett.
  let propertyId: string;
  let propertyCreated = false;
  const existing = pickExistingProperty(summaries, domain);
  if (existing) {
    propertyId = existing.property;
  } else {
    const createRes = await call("properties", "POST", {
      displayName: domain,
      parent: summaries[0].account,
      timeZone: "Europe/Oslo",
      currencyCode: "NOK",
      industryCategory: "INDUSTRY_CATEGORY_UNSPECIFIED",
    });
    if (createRes.status !== 200) {
      return { ok: false, error: `Kunne ikke opprette property (HTTP ${createRes.status})` };
    }
    propertyId = (createRes.json as { name: string }).name;
    propertyCreated = true;
    if (summaries.length > 1) {
      warnings.push(`Flere GA4-kontoer funnet — property ble lagt under «${summaries[0].displayName ?? summaries[0].account}».`);
    }
  }

  // 3) Web-datastrøm: gjenbruk stream med samme domene, ellers opprett.
  let measurementId: string | null = null;
  let streamCreated = false;
  const streamsRes = await call(`${propertyId}/dataStreams`, "GET");
  const streams = streamsRes.status === 200
    ? ((streamsRes.json as { dataStreams?: Array<{ name: string; type?: string; webStreamData?: { measurementId?: string; defaultUri?: string } }> })?.dataStreams ?? [])
    : [];
  const existingWeb = streams.find(
    (s) => s.type === "WEB_DATA_STREAM" && normalizeDomain(s.webStreamData?.defaultUri ?? "") === domain,
  ) ?? streams.find((s) => s.type === "WEB_DATA_STREAM");
  if (existingWeb) {
    measurementId = existingWeb.webStreamData?.measurementId ?? null;
    if (normalizeDomain(existingWeb.webStreamData?.defaultUri ?? "") !== domain) {
      warnings.push(`Gjenbrukte eksisterende web-strøm (${existingWeb.webStreamData?.defaultUri ?? "?"}) — verifiser at den gjelder ${domain}.`);
    }
  } else {
    const streamRes = await call(`${propertyId}/dataStreams`, "POST", {
      type: "WEB_DATA_STREAM",
      displayName: domain,
      webStreamData: { defaultUri: `https://${domain}` },
    });
    if (streamRes.status !== 200) {
      return { ok: false, error: `Kunne ikke opprette datastrøm (HTTP ${streamRes.status})` };
    }
    measurementId = (streamRes.json as { webStreamData?: { measurementId?: string } })?.webStreamData?.measurementId ?? null;
    streamCreated = true;
  }

  // 4) Datalagring 14 mnd — feil her velter ikke oppsettet (advarsel).
  const retentionRes = await call(
    `${propertyId}/dataRetentionSettings?updateMask=eventDataRetention`,
    "PATCH",
    { eventDataRetention: "FOURTEEN_MONTHS" },
  );
  const retentionSet = retentionRes.status === 200;
  if (!retentionSet) warnings.push(`Datalagring kunne ikke settes til 14 mnd (HTTP ${retentionRes.status}) — sett manuelt i Admin → Data retention.`);

  // 5) Key events fra event-planen. «Finnes allerede» = suksess
  //    (idempotens); purchase er uansett system-låst som key event.
  const keyEvents: Ga4SetupResult["keyEvents"] = [];
  for (const ev of buildEventPlan(opts.goals).filter((e) => e.keyEvent && e.ga4Event !== "purchase")) {
    const keRes = await call(`${propertyId}/keyEvents`, "POST", {
      eventName: ev.ga4Event,
      countingMethod: "ONCE_PER_EVENT",
    });
    keyEvents.push({
      eventName: ev.ga4Event,
      status: keRes.status === 200 ? "created" : keRes.status === 409 ? "already_exists" : "failed",
    });
  }

  return {
    ok: true,
    result: { propertyId, propertyCreated, measurementId, streamCreated, retentionSet, keyEvents, warnings },
  };
}

const defaultGa4Fetcher: Ga4Fetcher = async (url, init) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
};
