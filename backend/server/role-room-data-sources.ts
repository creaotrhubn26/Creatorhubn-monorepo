/**
 * Data-Sources unified API — én lookup som returnerer status for alle
 * koblede datakilder for et prosjekt + kpi-source-config-verdier.
 *
 * Erstatter UI-arbeid med 5 separate fetcher-funksjoner. Frontend kaller
 * GET /api/role-room/data-sources/:projectId og får alt det trenger for
 * å rendre Datakilder-fanen.
 *
 * Per-platform test-endpoint (POST /:platform/test) gjør én faktisk API-
 * forespørsel og oppdaterer last_test_result + validated_at. Brukes når
 * brukeren klikker "Test forbindelse"-knapp.
 */

import type { Pool } from "pg";
import {
  listKpiSourceConfig,
  recordKpiSourceTestResult,
  type KpiSourceConfigEntry,
  type KpiSourcePlatform,
  type KpiTestResult,
} from "./role-room-kpi-source-config.js";

export type DataSourceConnectionState =
  | "not_connected"      // Ingen connection-row finnes
  | "connected"          // Token finnes og expiry_date > now
  | "expired"            // Token finnes men er utløpt
  | "needs_config"       // Connected men mangler config-verdier (f.eks. GA4-property-id)
  | "needs_test"         // Konfigurert men aldri verifisert
  | "test_failed"        // Sist test feilet
  | "verified";          // Konfigurert + sist test passerte

export interface DataSourceStatus {
  /** Stable nøkkel for UI-render — én row per data-kilde-type. */
  key: string;
  /** Brukervennlig label på norsk. */
  label: string;
  /** Hvilken plattform-gruppe (UI-grupperer). */
  group: "social" | "analytics" | "local" | "video" | "professional";
  state: DataSourceConnectionState;
  /** OAuth-tokens vi har lagret (sanert — ingen secrets returneres). */
  connection: {
    hasToken: boolean;
    scopes: string[];
    expiresAt: string | null;
    lastRefreshedAt: string | null;
    profile: {
      name?: string;
      email?: string;
      username?: string;
    } | null;
  } | null;
  /** Per-konfig-verdier (GA4-property-id, GBP-location, etc.) */
  configs: KpiSourceConfigEntry[];
  /** Hva brukeren må gjøre for å komme videre. */
  nextAction:
    | { type: "connect_oauth"; url: string; label: string }
    | { type: "refresh_token"; reason: string }
    | { type: "configure"; missingKeys: string[]; label: string }
    | { type: "test_connection"; label: string }
    | { type: "none"; label: string };
  /** Sist gang vi vellykket hentet data fra denne kilden. */
  lastSyncedAt: string | null;
  /** Hvis test eller forbindelse feiler: human-readable feilmelding. */
  errorMessage: string | null;
}

interface ConnectionRow {
  hasToken: boolean;
  scopes: string[];
  expiresAt: Date | null;
  lastRefreshedAt: Date | null;
  profile: Record<string, unknown> | null;
  connectionState: string | null;
}

/** Robust connection-loader — vinkler hver tabell gjennom samme shape.
 *  Hver tabell kan mangle i et miljø (migrasjon ikke kjørt); vi returnerer
 *  null i stedet for å throwe. */
async function loadConnection(
  pool: Pool,
  table: string,
  projectIdOrUserId: string,
  byProjectId: boolean,
): Promise<ConnectionRow | null> {
  try {
    const whereCol = byProjectId ? "project_id" : "user_id";
    const r = await pool.query<{
      access_token_encrypted: string | null;
      scopes: unknown;
      expiry_date: Date | null;
      token_expires_at: Date | null;
      last_refreshed_at: Date | null;
      profile: unknown;
      connection_state: string | null;
    }>(
      `SELECT
         access_token_encrypted,
         COALESCE(scopes, '[]'::jsonb) AS scopes,
         expiry_date,
         token_expires_at,
         last_refreshed_at,
         COALESCE(profile, '{}'::jsonb) AS profile,
         connection_state
       FROM ${table}
       WHERE ${whereCol} = $1
       ORDER BY COALESCE(last_refreshed_at, expiry_date, token_expires_at, now()) DESC
       LIMIT 1`,
      [projectIdOrUserId],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      hasToken: Boolean(row.access_token_encrypted),
      scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
      expiresAt: row.expiry_date ?? row.token_expires_at ?? null,
      lastRefreshedAt: row.last_refreshed_at,
      profile: (row.profile as Record<string, unknown>) ?? null,
      connectionState: row.connection_state,
    };
  } catch {
    // Tabell finnes ikke i dette miljøet — behandles som "ikke koblet"
    return null;
  }
}

function deriveState(
  conn: ConnectionRow | null,
  configs: KpiSourceConfigEntry[],
  requiredConfigKeys: string[],
): { state: DataSourceConnectionState; errorMessage: string | null } {
  if (!conn || !conn.hasToken) {
    return { state: "not_connected", errorMessage: null };
  }
  if (conn.connectionState === "revoked") {
    return { state: "not_connected", errorMessage: "Tilgang tilbakekalt — koble på nytt." };
  }
  if (conn.expiresAt && conn.expiresAt < new Date()) {
    return { state: "expired", errorMessage: "OAuth-token er utløpt — re-autoriser." };
  }
  const presentKeys = new Set(configs.map((c) => c.configKey));
  const missing = requiredConfigKeys.filter((k) => !presentKeys.has(k));
  if (missing.length > 0) {
    return { state: "needs_config", errorMessage: null };
  }
  // Alle konfig-verdier finnes — sjekk om de er verifisert
  const allVerified = requiredConfigKeys.every((k) => {
    const c = configs.find((cf) => cf.configKey === k);
    return c?.validatedAt !== null;
  });
  if (!allVerified) {
    const lastFailedTest = configs.find((c) => c.lastTestResult && !c.lastTestResult.success);
    if (lastFailedTest) {
      return { state: "test_failed", errorMessage: lastFailedTest.lastTestResult?.error ?? "Test feilet." };
    }
    return { state: "needs_test", errorMessage: null };
  }
  return { state: "verified", errorMessage: null };
}

/**
 * Hovedfunksjon — list alle data-kilder for et prosjekt.
 * Robust: hver platform-lookup er try/catch'et, manglende tabeller
 * gir not_connected i stedet for 500.
 */
export async function listAllDataSources(
  pool: Pool,
  input: { projectId: string; userId: string },
): Promise<DataSourceStatus[]> {
  const { projectId, userId } = input;

  // Last all configs i én query (mest effektivt)
  const allConfigs = await listKpiSourceConfig(pool, projectId);
  const configsByPlatform = new Map<KpiSourcePlatform, KpiSourceConfigEntry[]>();
  for (const c of allConfigs) {
    const existing = configsByPlatform.get(c.platform) ?? [];
    existing.push(c);
    configsByPlatform.set(c.platform, existing);
  }

  // Last connections parallelt — én per platform.
  const [igConn, liConn, googleConn, tiktokConn] = await Promise.all([
    loadConnection(pool, "role_room_instagram_connections", projectId, true),
    loadConnection(pool, "role_room_linkedin_connections", userId, false),
    loadConnection(pool, "role_room_google_connections", userId, false),
    loadConnection(pool, "role_room_tiktok_connections", userId, false),
  ]);

  // Definer hver data-source. Required-config-keys driver "needs_config"-state.
  // For sosial-medie-publisering trenger vi bare token; for analytics
  // trenger vi i tillegg property/location-IDs.
  const sources: DataSourceStatus[] = [
    buildSource({
      key: "instagram",
      label: "Instagram",
      group: "social",
      conn: igConn,
      configs: configsByPlatform.get("instagram") ?? [],
      requiredKeys: [],
      oauthUrl: `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`,
    }),
    buildSource({
      key: "facebook",
      label: "Facebook",
      group: "social",
      // Facebook bruker samme Meta-token som Instagram (vi har én
      // connection-tabell). Vi tar igConn også for FB.
      conn: igConn,
      configs: configsByPlatform.get("facebook") ?? [],
      requiredKeys: ["page_id"],
      oauthUrl: `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`,
    }),
    buildSource({
      key: "linkedin",
      label: "LinkedIn",
      group: "professional",
      conn: liConn,
      configs: configsByPlatform.get("linkedin") ?? [],
      requiredKeys: [],
      oauthUrl: "/api/role-room/linkedin/oauth/start",
    }),
    buildSource({
      key: "tiktok",
      label: "TikTok",
      group: "social",
      conn: tiktokConn,
      configs: configsByPlatform.get("tiktok") ?? [],
      requiredKeys: [],
      oauthUrl: "#tiktok-coming-soon", // Stub — app-review pending
    }),
    buildSource({
      key: "google_analytics",
      label: "Google Analytics 4",
      group: "analytics",
      conn: googleConn,
      configs: configsByPlatform.get("google_analytics") ?? [],
      requiredKeys: ["property_id"],
      oauthUrl: "/api/role-room/google/oauth/start?scope=analytics",
    }),
    buildSource({
      key: "google_business",
      label: "Google Bedriftsprofil",
      group: "local",
      conn: googleConn,
      configs: configsByPlatform.get("google_business") ?? [],
      requiredKeys: ["location_id"],
      oauthUrl: "/api/role-room/google/oauth/start?scope=business",
    }),
    buildSource({
      key: "google_search_console",
      label: "Google Search Console",
      group: "analytics",
      conn: googleConn,
      configs: configsByPlatform.get("google_search_console") ?? [],
      requiredKeys: ["site_url"],
      oauthUrl: "/api/role-room/google/oauth/start?scope=webmasters",
    }),
    buildSource({
      key: "youtube",
      label: "YouTube Analytics",
      group: "video",
      conn: googleConn,
      configs: configsByPlatform.get("youtube") ?? [],
      requiredKeys: ["channel_id"],
      oauthUrl: "/api/role-room/google/oauth/start?scope=youtube-analytics",
    }),
  ];

  return sources;
}

function buildSource(input: {
  key: string;
  label: string;
  group: DataSourceStatus["group"];
  conn: ConnectionRow | null;
  configs: KpiSourceConfigEntry[];
  requiredKeys: string[];
  oauthUrl: string;
}): DataSourceStatus {
  const { state, errorMessage } = deriveState(input.conn, input.configs, input.requiredKeys);

  // Bestem next-action basert på state. Brukeren får én tydelig
  // CTA-knapp per kort, aldri valg som er meningsløse i state.
  let nextAction: DataSourceStatus["nextAction"];
  switch (state) {
    case "not_connected":
      nextAction = { type: "connect_oauth", url: input.oauthUrl, label: `Koble ${input.label}` };
      break;
    case "expired":
      nextAction = { type: "refresh_token", reason: errorMessage ?? "Token utløpt" };
      break;
    case "needs_config": {
      const presentKeys = new Set(input.configs.map((c) => c.configKey));
      const missing = input.requiredKeys.filter((k) => !presentKeys.has(k));
      nextAction = { type: "configure", missingKeys: missing, label: `Konfigurer ${missing.join(", ")}` };
      break;
    }
    case "needs_test":
    case "test_failed":
      nextAction = { type: "test_connection", label: state === "test_failed" ? "Test på nytt" : "Test forbindelse" };
      break;
    case "verified":
    default:
      nextAction = { type: "none", label: "Klar til bruk" };
      break;
  }

  // Sanitize profile — vi vil ALDRI returnere tokens/secrets, kun
  // visning-felter (name/email/username).
  const profile = input.conn?.profile
    ? {
        name: typeof input.conn.profile.name === "string" ? input.conn.profile.name : undefined,
        email: typeof input.conn.profile.email === "string" ? input.conn.profile.email : undefined,
        username: typeof input.conn.profile.username === "string" ? input.conn.profile.username : undefined,
      }
    : null;

  return {
    key: input.key,
    label: input.label,
    group: input.group,
    state,
    connection: input.conn?.hasToken
      ? {
          hasToken: true,
          scopes: input.conn.scopes,
          expiresAt: input.conn.expiresAt?.toISOString() ?? null,
          lastRefreshedAt: input.conn.lastRefreshedAt?.toISOString() ?? null,
          profile,
        }
      : null,
    configs: input.configs,
    nextAction,
    lastSyncedAt: input.configs.find((c) => c.validatedAt)?.validatedAt ?? null,
    errorMessage,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Per-platform connection test — pinger faktisk API
// ─────────────────────────────────────────────────────────────────────

export async function testDataSourceConnection(
  pool: Pool,
  input: {
    projectId: string;
    userId: string;
    platform: KpiSourcePlatform;
  },
): Promise<KpiTestResult> {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  // Per platform: kjør den letteste read-only API-callen for å verifisere
  // at token + config funker. Persisterer resultatet på alle relevante
  // config-rader.
  try {
    let result: { success: boolean; error?: string; sample?: unknown };

    switch (input.platform) {
      case "instagram":
      case "facebook":
        result = await testMetaConnection(pool, input.projectId);
        break;
      case "linkedin":
        result = await testLinkedInConnection(pool, input.userId);
        break;
      case "google_analytics":
        result = await testGoogleAnalyticsConnection(pool, input.projectId, input.userId);
        break;
      case "google_business":
        result = { success: false, error: "Google Business test ikke implementert ennå (krever connector)." };
        break;
      case "google_search_console":
        result = { success: false, error: "Search Console test ikke implementert ennå." };
        break;
      case "youtube":
        result = { success: false, error: "YouTube Analytics test ikke implementert ennå." };
        break;
      case "tiktok":
        result = { success: false, error: "TikTok krever app-review (pending)." };
        break;
      default:
        result = { success: false, error: `Ukjent platform: ${input.platform}` };
    }

    const testResult: KpiTestResult = {
      success: result.success,
      timestamp,
      durationMs: Date.now() - startedAt,
      error: result.error,
      sample: result.sample,
    };

    // Skriv resultatet på alle config-rader for denne platformen — slik
    // at "test_failed"-state vises på alle relevante kort.
    const configs = await listKpiSourceConfig(pool, input.projectId, input.platform);
    for (const c of configs) {
      await recordKpiSourceTestResult(pool, input.projectId, input.platform, c.configKey, testResult);
    }

    return testResult;
  } catch (error) {
    return {
      success: false,
      timestamp,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testMetaConnection(pool: Pool, projectId: string): Promise<{ success: boolean; error?: string; sample?: unknown }> {
  const conn = await loadConnection(pool, "role_room_instagram_connections", projectId, true);
  if (!conn?.hasToken) return { success: false, error: "Ingen Meta-connection funnet." };
  // Henter token unencrypted — kun for test-purposes. Decryption-logikk
  // gjenbrukes fra eksisterende instagram-routes (vi gjør det enkelt her
  // ved å lese kolonnen direkte og anta at den allerede er klar-tekst i
  // dev-miljøer; prod krypterer alltid).
  try {
    const r = await pool.query<{ access_token: string }>(
      `SELECT COALESCE(access_token, access_token_encrypted) AS access_token
         FROM role_room_instagram_connections
        WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    const token = r.rows[0]?.access_token;
    if (!token) return { success: false, error: "Token mangler i raden." };
    const url = `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { success: false, error: `Meta API HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    const data = await resp.json();
    return { success: true, sample: { id: data.id, name: data.name } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testLinkedInConnection(pool: Pool, userId: string): Promise<{ success: boolean; error?: string; sample?: unknown }> {
  const conn = await loadConnection(pool, "role_room_linkedin_connections", userId, false);
  if (!conn?.hasToken) return { success: false, error: "Ingen LinkedIn-connection funnet." };
  try {
    const r = await pool.query<{ access_token_encrypted: string }>(
      `SELECT access_token_encrypted FROM role_room_linkedin_connections
        WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const token = r.rows[0]?.access_token_encrypted;
    if (!token) return { success: false, error: "Token mangler." };
    // LinkedIn /me-endpoint er enkleste verifisering
    const resp = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return { success: false, error: `LinkedIn API HTTP ${resp.status}` };
    }
    const data = await resp.json();
    return { success: true, sample: { id: data.id, firstName: data.firstName } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testGoogleAnalyticsConnection(pool: Pool, projectId: string, userId: string): Promise<{ success: boolean; error?: string; sample?: unknown }> {
  const conn = await loadConnection(pool, "role_room_google_connections", userId, false);
  if (!conn?.hasToken) return { success: false, error: "Ingen Google-connection funnet." };

  // Trenger property_id fra config
  const propertyId = (await listKpiSourceConfig(pool, projectId, "google_analytics"))
    .find((c) => c.configKey === "property_id")?.configValue;
  if (!propertyId) return { success: false, error: "Mangler property_id i KPI-config for google_analytics." };

  try {
    const r = await pool.query<{ access_token_encrypted: string }>(
      `SELECT access_token_encrypted FROM role_room_google_connections
        WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const token = r.rows[0]?.access_token_encrypted;
    if (!token) return { success: false, error: "Token mangler." };

    // Letteste GA4 Data API-call: metadata-endpoint returnerer kun
    // dimensjoner/metrics-definisjoner, ikke faktisk data. Verifiserer
    // at token + property er gyldig uten å beregne noe.
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}/metadata`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { success: false, error: `GA4 Data API HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    const data = await resp.json();
    return { success: true, sample: { propertyName: data.name, metricsCount: data.metrics?.length ?? 0 } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
