/**
 * hubspot-client.ts — uttak fra HubSpot CRM for migrering til Leadgrid.
 *
 * Leser bare. Autentiserer med en Service Key som kunden lager selv
 * («Authorization: Bearer»), uten app-review hos HubSpot. HubSpot har flyttet
 * private apps til «Legacy Apps» og peker på Service Keys for single-account
 * API-tilgang; begge sender samme Bearer-header.
 *
 * Tre ting denne fila finnes for, og som fikstur-tester dekker:
 *   1. Paginering. HubSpot gir maks 100 per side og en after-cursor.
 *   2. Rate-limit. Burst per app er 100 kall/10 s på Free og Starter, 190 på
 *      Professional og Enterprise, og daglige grenser deles med alle andre
 *      apper i kundens konto. Vi bremser selv i stedet for å gå på 429.
 *   3. Feil som betyr noe for kunden. Et 401 er feil token, et 403 er et
 *      manglende scope — begge skal si hva kunden må gjøre, ikke bare koden.
 *
 * Kilder og versjonsnote: docs/evidence/2026-09-hubspot-migration-import.yaml
 */

import type { HubSpotObject, HubSpotOwner, HubSpotPipeline } from "./hubspot-migration-fixtures.js";

/** Datostemplet objekt-API. Bump sammen med evidensfilas version_scope. */
export const HUBSPOT_API_VERSION = "2026-03";
export const HUBSPOT_API_BASE = "https://api.hubapi.com";

/** HubSpot gir maks 100 per side og maks 100 id-er per batch-kall. */
export const HUBSPOT_PAGE_SIZE = 100;
export const HUBSPOT_BATCH_SIZE = 100;

/** Burst-grense per app, per 10 sekunder. Se usage-guidelines. */
export const BURST_WINDOW_MS = 10_000;
export const BURST_LIMIT_FREE = 100;
export const BURST_LIMIT_PRO = 190;

export type HubSpotFailureReason =
  | "invalid_token"
  | "missing_scope"
  | "rate_limited"
  | "not_found"
  | "hubspot_unavailable"
  | "unexpected";

export class HubSpotRequestError extends Error {
  readonly reason: HubSpotFailureReason;
  readonly status: number;
  /** Norsk setning ment for kunden, ikke for loggen. */
  readonly userMessage: string;

  constructor(reason: HubSpotFailureReason, status: number, userMessage: string, detail?: string) {
    super(detail ? `${reason} (${status}): ${detail}` : `${reason} (${status})`);
    this.name = "HubSpotRequestError";
    this.reason = reason;
    this.status = status;
    this.userMessage = userMessage;
  }
}

function describeFailure(status: number, body: string): HubSpotRequestError {
  if (status === 401) {
    return new HubSpotRequestError(
      "invalid_token",
      status,
      "HubSpot godtok ikke nøkkelen. Lag en ny Service Key i HubSpot og lim den inn på nytt.",
      body,
    );
  }
  if (status === 403) {
    return new HubSpotRequestError(
      "missing_scope",
      status,
      "Nøkkelen mangler lesetilgang til denne datatypen. Åpne Service Key-en i HubSpot og huk av lesescopet. Merk at et nytt scope kan bruke opptil et minutt før det virker.",
      body,
    );
  }
  if (status === 404) {
    return new HubSpotRequestError("not_found", status, "Fant ikke dataene i HubSpot.", body);
  }
  if (status === 429) {
    return new HubSpotRequestError(
      "rate_limited",
      status,
      "HubSpot bremset oss. Migreringen fortsetter av seg selv om litt.",
      body,
    );
  }
  if (status >= 500) {
    return new HubSpotRequestError(
      "hubspot_unavailable",
      status,
      "HubSpot svarer ikke akkurat nå. Migreringen prøver igjen automatisk.",
      body,
    );
  }
  return new HubSpotRequestError("unexpected", status, "Uventet svar fra HubSpot.", body);
}

export interface HubSpotClientOptions {
  accessToken: string;
  /** Burst-grense. Sett BURST_LIMIT_PRO for Professional/Enterprise-kontoer. */
  burstLimit?: number;
  /** Hvor mange ganger et 429 eller 5xx forsøkes på nytt før vi gir opp. */
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface HubSpotClientStats {
  requests: number;
  retries: number;
  throttleWaitMs: number;
}

interface PageResponse<T> {
  results: T[];
  paging?: { next?: { after?: string } };
}

export interface HubSpotClient {
  /** Henter alle sider av en objekttype og gir dem samlet. */
  listAll(objectType: string, properties: string[]): Promise<HubSpotObject[]>;
  /** Assosiasjoner fra en objekttype til en annen, i batcher på 100. */
  listAssociations(
    fromType: string,
    toType: string,
    fromIds: string[],
  ): Promise<Record<string, Array<{ toObjectId: string; associationTypes: Array<{ category: string; typeId: number; label: string | null }> }>>>;
  listOwners(): Promise<HubSpotOwner[]>;
  listPipelines(objectType: string): Promise<HubSpotPipeline[]>;
  stats(): HubSpotClientStats;
}

export function createHubSpotClient(options: HubSpotClientOptions): HubSpotClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const burstLimit = options.burstLimit ?? BURST_LIMIT_FREE;
  const maxRetries = options.maxRetries ?? 3;

  /** Tidspunkt for kallene i det gjeldende 10-sekundersvinduet. */
  const window: number[] = [];
  const stats: HubSpotClientStats = { requests: 0, retries: 0, throttleWaitMs: 0 };

  /** Venter hvis vi er i ferd med å sprenge burst-grensen. */
  async function throttle(): Promise<void> {
    const cutoff = now() - BURST_WINDOW_MS;
    while (window.length > 0 && window[0] <= cutoff) window.shift();
    if (window.length < burstLimit) return;
    const waitMs = window[0] + BURST_WINDOW_MS - now();
    if (waitMs > 0) {
      stats.throttleWaitMs += waitMs;
      await sleep(waitMs);
    }
    const nextCutoff = now() - BURST_WINDOW_MS;
    while (window.length > 0 && window[0] <= nextCutoff) window.shift();
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let attempt = 0;
    for (;;) {
      await throttle();
      window.push(now());
      stats.requests += 1;

      let response: Response;
      try {
        response = await fetchImpl(`${HUBSPOT_API_BASE}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
        });
      } catch (networkError) {
        if (attempt >= maxRetries) {
          throw new HubSpotRequestError(
            "hubspot_unavailable",
            0,
            "Fikk ikke kontakt med HubSpot. Migreringen prøver igjen automatisk.",
            (networkError as Error).message,
          );
        }
        attempt += 1;
        stats.retries += 1;
        await sleep(Math.min(2 ** attempt * 1000, 30_000));
        continue;
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      const retriable = response.status === 429 || response.status >= 500;
      if (retriable && attempt < maxRetries) {
        // HubSpot oppgir ofte hvor lenge vi skal vente. Følg den når den finnes.
        const retryAfter = Number(response.headers?.get?.("Retry-After") ?? "");
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** (attempt + 1) * 1000, 30_000);
        attempt += 1;
        stats.retries += 1;
        await sleep(waitMs);
        continue;
      }

      const body = await response.text().catch(() => "");
      throw describeFailure(response.status, body.slice(0, 500));
    }
  }

  return {
    async listAll(objectType, properties) {
      const collected: HubSpotObject[] = [];
      let after: string | undefined;
      // Vokter mot en cursor som aldri tar slutt.
      const seenCursors = new Set<string>();

      for (;;) {
        const query = new URLSearchParams({ limit: String(HUBSPOT_PAGE_SIZE) });
        if (properties.length > 0) query.set("properties", properties.join(","));
        if (after) query.set("after", after);

        const page = await request<PageResponse<HubSpotObject>>(
          `/crm/objects/${HUBSPOT_API_VERSION}/${encodeURIComponent(objectType)}?${query.toString()}`,
        );
        collected.push(...page.results);

        const next = page.paging?.next?.after;
        if (!next) return collected;
        if (seenCursors.has(next)) {
          throw new HubSpotRequestError(
            "unexpected",
            200,
            "HubSpot ga samme side om igjen. Migreringen stoppet for å unngå en evig runde.",
            `cursor ${next}`,
          );
        }
        seenCursors.add(next);
        after = next;
      }
    },

    async listAssociations(fromType, toType, fromIds) {
      const result: Awaited<ReturnType<HubSpotClient["listAssociations"]>> = {};
      for (let i = 0; i < fromIds.length; i += HUBSPOT_BATCH_SIZE) {
        const batch = fromIds.slice(i, i + HUBSPOT_BATCH_SIZE);
        const payload = await request<{
          results?: Array<{ from: { id: string }; to: Array<{ toObjectId: string; associationTypes: Array<{ category: string; typeId: number; label: string | null }> }> }>;
        }>(
          `/crm/associations/${HUBSPOT_API_VERSION}/${encodeURIComponent(fromType)}/${encodeURIComponent(toType)}/batch/read`,
          { method: "POST", body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }) },
        );
        for (const row of payload.results ?? []) {
          result[row.from.id] = row.to ?? [];
        }
      }
      // Id-er uten treff skal være tomme lister, ikke mangle helt.
      for (const id of fromIds) if (!result[id]) result[id] = [];
      return result;
    },

    async listOwners() {
      const collected: HubSpotOwner[] = [];
      let after: string | undefined;
      for (;;) {
        const query = new URLSearchParams({ limit: String(HUBSPOT_PAGE_SIZE) });
        if (after) query.set("after", after);
        const page = await request<PageResponse<HubSpotOwner>>(`/crm/v3/owners?${query.toString()}`);
        collected.push(...page.results);
        const next = page.paging?.next?.after;
        if (!next) return collected;
        after = next;
      }
    },

    async listPipelines(objectType) {
      const payload = await request<{ results: HubSpotPipeline[] }>(
        `/crm/pipelines/${HUBSPOT_API_VERSION}/${encodeURIComponent(objectType)}`,
      );
      return payload.results ?? [];
    },

    stats() {
      return { ...stats };
    },
  };
}
