/**
 * control-center-sentry-client.ts
 *
 * Tynn, server-side lese-klient mot Sentrys web-API for Control Center.
 *
 * VIKTIG skille: `SENTRY_DSN` (i sentry-init.ts) er *ingest*-nøkkelen som
 * SDK-en bruker for å SENDE feil til Sentry. For å LESE issues/stats tilbake
 * trenger vi en egen auth-token med `project:read`/`org:read`-scope. Den
 * holdes server-side (jf. aggregator-beslutningen i byggeplanen — aldri på
 * operatørens maskin).
 *
 *   SENTRY_AUTH_TOKEN   — read-token (Sentry → Settings → Auth Tokens)
 *   SENTRY_ORG          — org-slug
 *   SENTRY_PROJECT      — project-slug
 *   SENTRY_BASE_URL     — valgfri (self-hosted); default https://sentry.io
 *
 * Alt er best-effort: mangler konfig eller feiler kallet, returnerer vi
 * `null`/tom liste slik at cockpiten faller tilbake på `error_log` uten 500
 * (samme "graceful empty"-konvensjon som resten av backenden).
 */

export interface SentryReadConfig {
  authToken: string;
  org: string;
  project: string;
  baseUrl: string;
}

export interface SentryIssue {
  id: string;
  shortId: string | null;
  title: string;
  culprit: string | null;
  level: string | null;
  status: string | null;
  count: number;          // antall events (i valgt periode)
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  permalink: string | null;
}

/** Returnerer lese-konfig hvis alle påkrevde env-vars er satt, ellers null. */
export function getSentryReadConfig(): SentryReadConfig | null {
  const authToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (!authToken || !org || !project) return null;
  const baseUrl = (process.env.SENTRY_BASE_URL?.trim() || "https://sentry.io").replace(/\/+$/, "");
  return { authToken, org, project, baseUrl };
}

export function isSentryReadConfigured(): boolean {
  return getSentryReadConfig() !== null;
}

async function sentryGet<T>(config: SentryReadConfig, path: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/api/0${path}`, {
      headers: {
        Authorization: `Bearer ${config.authToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[control-center/sentry] GET ${path} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[control-center/sentry] GET ${path} feilet:`, (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface RawSentryIssue {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  level?: string;
  status?: string;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  permalink?: string;
}

/**
 * Henter issues for prosjektet. `query` følger Sentrys søkesyntaks
 * (default `is:unresolved`). `statsPeriod` f.eks. "24h", "14d".
 */
export async function fetchSentryIssues(opts: {
  query?: string;
  statsPeriod?: string;
  limit?: number;
} = {}): Promise<SentryIssue[]> {
  const config = getSentryReadConfig();
  if (!config) return [];

  const params = new URLSearchParams({
    query: opts.query ?? "is:unresolved",
    statsPeriod: opts.statsPeriod ?? "24h",
    limit: String(Math.min(opts.limit ?? 50, 100)),
    sort: "freq",
  });
  const raw = await sentryGet<RawSentryIssue[]>(
    config,
    `/projects/${encodeURIComponent(config.org)}/${encodeURIComponent(config.project)}/issues/?${params.toString()}`,
  );
  if (!raw || !Array.isArray(raw)) return [];

  return raw.map((r) => ({
    id: String(r.id),
    shortId: r.shortId ?? null,
    title: r.title ?? "(uten tittel)",
    culprit: r.culprit ?? null,
    level: r.level ?? null,
    status: r.status ?? null,
    count: Number(r.count ?? 0) || 0,
    userCount: Number(r.userCount ?? 0) || 0,
    firstSeen: r.firstSeen ?? null,
    lastSeen: r.lastSeen ?? null,
    permalink: r.permalink ?? null,
  }));
}

export interface SentryCrashFree {
  crashFreeSessionsPct: number | null;
  crashFreeUsersPct: number | null;
}

interface RawSessionsResponse {
  groups?: Array<{
    by?: { "session.status"?: string };
    totals?: Record<string, number>;
  }>;
}

/**
 * Best-effort crash-free-rate over sesjoner (feilrate-kortet). Krever at
 * release-health/sessions er aktivert i prosjektet — hvis ikke, returnerer
 * API-et tomt og vi gir null (kortet viser "—" i stedet for en oppdiktet
 * verdi).
 */
export async function fetchCrashFreeRate(statsPeriod = "24h"): Promise<SentryCrashFree> {
  const config = getSentryReadConfig();
  if (!config) return { crashFreeSessionsPct: null, crashFreeUsersPct: null };

  const params = new URLSearchParams({
    field: "sum(session)",
    groupBy: "session.status",
    statsPeriod,
    project: "-1",
  });
  const raw = await sentryGet<RawSessionsResponse>(
    config,
    `/organizations/${encodeURIComponent(config.org)}/sessions/?${params.toString()}`,
  );
  if (!raw?.groups?.length) return { crashFreeSessionsPct: null, crashFreeUsersPct: null };

  let total = 0;
  let crashed = 0;
  for (const g of raw.groups) {
    const n = Number(g.totals?.["sum(session)"] ?? 0) || 0;
    total += n;
    if (g.by?.["session.status"] === "crashed") crashed += n;
  }
  if (total <= 0) return { crashFreeSessionsPct: null, crashFreeUsersPct: null };
  const pct = (1 - crashed / total) * 100;
  return { crashFreeSessionsPct: Math.round(pct * 100) / 100, crashFreeUsersPct: null };
}
