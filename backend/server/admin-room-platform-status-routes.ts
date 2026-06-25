/**
 * admin-room-platform-status-routes.ts
 *
 * Aggregert sanntidsbilde av plattform-infrastrukturen i Admin Room.
 * Én endpoint, kaller alle leverandører i parallell, returnerer
 * status + key metrics + dashboard-lenker. Driver Plattform-status-
 * seksjonen i RR Økonomi.
 *
 * Endpoint: GET /api/admin-room/platform-status
 *
 * Hver leverandør returnerer 'ok' / 'warning' / 'error' / 'unconfigured'.
 * 'unconfigured' = ENV-variabel mangler — gir UI mulighet til å vise
 * "sett opp"-CTA istedenfor en feilmelding.
 */

import type Stripe from "stripe";
import type { AdminRoomRoutesDeps } from "./_shared";

interface PlatformStatusDeps extends AdminRoomRoutesDeps {
  getRoleRoomStripeClient: () => Stripe | null;
}

type Health = 'ok' | 'warning' | 'error' | 'unconfigured';

interface ProviderStatus {
  provider: string;
  health: Health;
  message: string;
  metrics: Record<string, string | number>;
  dashboardUrl: string;
  lastCheckedAt: string;
}

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkRender(): Promise<ProviderStatus> {
  const base: Omit<ProviderStatus, 'health' | 'message' | 'metrics'> = {
    provider: 'Render',
    dashboardUrl: 'https://dashboard.render.com',
    lastCheckedAt: new Date().toISOString(),
  };
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    return { ...base, health: 'unconfigured', message: 'RENDER_API_KEY ikke satt', metrics: {} };
  }
  try {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const [servicesResp, postgresResp, redisResp] = await Promise.all([
      fetchWithTimeout('https://api.render.com/v1/services?limit=100', { headers }),
      fetchWithTimeout('https://api.render.com/v1/postgres?limit=100', { headers }),
      fetchWithTimeout('https://api.render.com/v1/redis?limit=100', { headers }),
    ]);
    if (!servicesResp.ok) throw new Error(`Render services HTTP ${servicesResp.status}`);
    const services = await servicesResp.json() as Array<{ service: { name: string; suspended?: string; type: string } }>;
    const postgres = postgresResp.ok ? await postgresResp.json() as Array<{ postgres: { name: string; status?: string } }> : [];
    const redis = redisResp.ok ? await redisResp.json() as Array<{ keyValue?: { name: string; status?: string }; redis?: { name: string; status?: string } }> : [];

    const suspendedServices = services.filter((s) => s.service.suspended === 'suspended').length;
    const unavailablePostgres = postgres.filter((p) => p.postgres.status && p.postgres.status !== 'available').length;
    const unavailableRedis = redis.filter((r) => {
      const k = r.keyValue ?? r.redis;
      return k?.status && k.status !== 'available';
    }).length;

    const totalIssues = suspendedServices + unavailablePostgres + unavailableRedis;
    return {
      ...base,
      health: totalIssues > 0 ? 'warning' : 'ok',
      message: totalIssues > 0
        ? `${totalIssues} tjeneste(r) ikke tilgjengelig`
        : `${services.length} services + ${postgres.length} postgres + ${redis.length} redis kjører`,
      metrics: {
        services: services.length,
        postgres: postgres.length,
        redis: redis.length,
        suspended: suspendedServices,
      },
    };
  } catch (err) {
    return { ...base, health: 'error', message: (err as Error).message, metrics: {} };
  }
}

async function checkNeon(): Promise<ProviderStatus> {
  const base: Omit<ProviderStatus, 'health' | 'message' | 'metrics'> = {
    provider: 'Neon',
    dashboardUrl: 'https://console.neon.tech',
    lastCheckedAt: new Date().toISOString(),
  };
  const token = process.env.NEON_API_KEY;
  if (!token) {
    return { ...base, health: 'unconfigured', message: 'NEON_API_KEY ikke satt', metrics: {} };
  }
  try {
    const orgId = process.env.NEON_ORG_ID;
    const url = `https://console.neon.tech/api/v2/projects?limit=100${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ''}`;
    const response = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Neon HTTP ${response.status}`);
    const payload = await response.json() as { projects: Array<{ name: string; cpu_used_sec?: number; active_time?: number; synthetic_storage_size?: number; compute_last_active_at?: string }> };
    const projects = payload.projects ?? [];
    const activeProjects = projects.filter((p) => {
      if (!p.compute_last_active_at) return false;
      const t = Date.parse(p.compute_last_active_at);
      return Number.isFinite(t) && t > Date.now() - 24 * 60 * 60 * 1000;
    }).length;
    const totalCpuHours = Math.round(projects.reduce((acc, p) => acc + (p.cpu_used_sec ?? 0), 0) / 3600);
    const totalStorageMb = Math.round(projects.reduce((acc, p) => acc + (p.synthetic_storage_size ?? 0), 0) / 1024 / 1024);
    return {
      ...base,
      health: 'ok',
      message: `${projects.length} prosjekter, ${activeProjects} aktive siste 24t`,
      metrics: {
        projects: projects.length,
        active24h: activeProjects,
        cpuHoursMonth: totalCpuHours,
        storageMb: totalStorageMb,
      },
    };
  } catch (err) {
    return { ...base, health: 'error', message: (err as Error).message, metrics: {} };
  }
}

async function checkVercel(): Promise<ProviderStatus> {
  const base: Omit<ProviderStatus, 'health' | 'message' | 'metrics'> = {
    provider: 'Vercel',
    dashboardUrl: 'https://vercel.com/dashboard',
    lastCheckedAt: new Date().toISOString(),
  };
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { ...base, health: 'unconfigured', message: 'VERCEL_TOKEN ikke satt', metrics: {} };
  }
  try {
    const teamId = process.env.VERCEL_TEAM_ID;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const [projectsResp, deploymentsResp] = await Promise.all([
      fetchWithTimeout(`https://api.vercel.com/v9/projects${teamQuery}`, { headers }),
      fetchWithTimeout(`https://api.vercel.com/v6/deployments${teamQuery}${teamQuery ? '&' : '?'}limit=10`, { headers }),
    ]);
    if (!projectsResp.ok) throw new Error(`Vercel projects HTTP ${projectsResp.status}`);
    const projectsData = await projectsResp.json() as { projects: Array<{ name: string }> };
    const projects = projectsData.projects ?? [];

    let deployments: Array<{ state?: string; created?: number; readyState?: string }> = [];
    if (deploymentsResp.ok) {
      const depPayload = await deploymentsResp.json() as { deployments?: Array<{ state?: string; created?: number; readyState?: string }> };
      deployments = depPayload.deployments ?? [];
    }
    const recentDeployments = deployments.length;
    const errorDeployments = deployments.filter((d) => d.state === 'ERROR' || d.readyState === 'ERROR').length;
    const buildingDeployments = deployments.filter((d) => d.state === 'BUILDING' || d.readyState === 'BUILDING').length;

    return {
      ...base,
      health: errorDeployments > 0 ? 'warning' : 'ok',
      message: errorDeployments > 0
        ? `${errorDeployments} mislykket deploy(s) sist 10`
        : `${projects.length} prosjekter, ${recentDeployments} deploys sist`,
      metrics: {
        projects: projects.length,
        recentDeployments,
        errors: errorDeployments,
        building: buildingDeployments,
      },
    };
  } catch (err) {
    return { ...base, health: 'error', message: (err as Error).message, metrics: {} };
  }
}

async function checkStripe(stripe: Stripe | null): Promise<ProviderStatus> {
  const base: Omit<ProviderStatus, 'health' | 'message' | 'metrics'> = {
    provider: 'Stripe (Role Room)',
    dashboardUrl: 'https://dashboard.stripe.com',
    lastCheckedAt: new Date().toISOString(),
  };
  if (!stripe) {
    return { ...base, health: 'unconfigured', message: 'Role Room Stripe-konto ikke konfigurert', metrics: {} };
  }
  try {
    const [activeSubs, pastDueSubs, recentInvoices] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100 }),
      stripe.subscriptions.list({ status: 'past_due', limit: 100 }),
      stripe.invoices.list({ status: 'open', limit: 50 }),
    ]);
    const activeCount = activeSubs.data.length;
    const pastDueCount = pastDueSubs.data.length;
    const openInvoices = recentInvoices.data.length;
    return {
      ...base,
      health: pastDueCount > 0 ? 'warning' : 'ok',
      message: pastDueCount > 0
        ? `${pastDueCount} past-due subscription(s), ${openInvoices} åpne fakturaer`
        : `${activeCount} aktive subscriptions`,
      metrics: {
        active: activeCount,
        pastDue: pastDueCount,
        openInvoices,
      },
    };
  } catch (err) {
    return { ...base, health: 'error', message: (err as Error).message, metrics: {} };
  }
}

const ROLE_ROOM_PROFESSIONS = [
  'production', 'photographer', 'content_producer', 'content_creator',
  'dance_studio', 'dance_freelance',
];

interface ActiveUser {
  id: string;
  email: string | null;
  name: string | null;
  profession: string | null;
  lastLoginAt: string;
  minutesAgo: number;
  currentRoute?: string | null;
  isIdle?: boolean | null;
  userAgentShort?: string | null;
}

interface UserPresenceSummary {
  activeNow: number;
  activeLast24h: number;
  activeLast7d: number;
  totalRoleRoomUsers: number;
  recentUsers: ActiveUser[];
}

async function checkUserPresence(pool: AdminRoomRoutesDeps['pool']): Promise<UserPresenceSummary> {
  try {
    return await checkUserPresenceInner(pool);
  } catch (err) {
    // Defensiv: hvis schema mangler (user_presence-tabell, profession-kolonne),
    // returner tomt fallback istedenfor å throw'e Promise.all i kaller.
    console.warn('[platform-status] checkUserPresence failed:', (err as Error).message);
    return {
      activeNow: 0,
      activeLast24h: 0,
      activeLast7d: 0,
      totalRoleRoomUsers: 0,
      recentUsers: [],
    };
  }
}

async function checkUserPresenceInner(pool: AdminRoomRoutesDeps['pool']): Promise<UserPresenceSummary> {
  // Bruker user_presence-heartbeat hvis raden finnes, ellers faller tilbake
  // til users.last_login_at. 90 sek vindu for "aktiv nå" siden klient pinger
  // hvert 30 sek (toleranse for nettverks-jitter + lukket tab-deteksjon).
  const result = await pool.query(
    `WITH presence AS (
       SELECT u.id, u.email, u.first_name, u.last_name, u.profession,
              COALESCE(p.last_seen_at, u.last_login_at) AS last_active_at,
              p.is_idle,
              p.current_route,
              p.user_agent_short,
              CASE WHEN p.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_heartbeat
         FROM users u
         LEFT JOIN user_presence p ON p.user_id = u.id
        WHERE u.profession = ANY($1::text[]) AND u.is_active = TRUE
     )
     SELECT
       COUNT(*) FILTER (WHERE has_heartbeat AND last_active_at > NOW() - INTERVAL '90 seconds' AND NOT is_idle)::int AS active_now,
       COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '24 hours')::int AS active_24h,
       COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '7 days')::int AS active_7d,
       COUNT(*)::int AS total
     FROM presence`,
    [ROLE_ROOM_PROFESSIONS],
  );
  const summary = result.rows[0] ?? {};

  const recent = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.profession,
            COALESCE(p.last_seen_at, u.last_login_at) AS last_active_at,
            EXTRACT(EPOCH FROM (NOW() - COALESCE(p.last_seen_at, u.last_login_at)))/60 AS minutes_ago,
            p.current_route,
            p.is_idle,
            p.user_agent_short
       FROM users u
       LEFT JOIN user_presence p ON p.user_id = u.id
      WHERE u.profession = ANY($1::text[]) AND u.is_active = TRUE
        AND COALESCE(p.last_seen_at, u.last_login_at) IS NOT NULL
      ORDER BY COALESCE(p.last_seen_at, u.last_login_at) DESC
      LIMIT 12`,
    [ROLE_ROOM_PROFESSIONS],
  );

  return {
    activeNow: Number(summary.active_now) || 0,
    activeLast24h: Number(summary.active_24h) || 0,
    activeLast7d: Number(summary.active_7d) || 0,
    totalRoleRoomUsers: Number(summary.total) || 0,
    recentUsers: recent.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
      profession: row.profession,
      lastLoginAt: row.last_active_at,
      minutesAgo: Math.round(Number(row.minutes_ago) || 0),
      currentRoute: row.current_route ?? null,
      isIdle: row.is_idle ?? null,
      userAgentShort: row.user_agent_short ?? null,
    })),
  };
}

async function checkAnthropic(pool: AdminRoomRoutesDeps['pool']): Promise<ProviderStatus> {
  const base: Omit<ProviderStatus, 'health' | 'message' | 'metrics'> = {
    provider: 'Anthropic API',
    dashboardUrl: 'https://console.anthropic.com',
    lastCheckedAt: new Date().toISOString(),
  };
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS calls_24h,
         COALESCE(SUM(cost_usd), 0)::float AS cost_usd_24h,
         COUNT(*) FILTER (WHERE success = FALSE)::int AS errors_24h
       FROM ai_usage_log
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
    );
    const row = result.rows[0] ?? {};
    const errors = Number(row.errors_24h) || 0;
    const calls = Number(row.calls_24h) || 0;
    const errorRate = calls > 0 ? errors / calls : 0;
    return {
      ...base,
      health: errorRate > 0.05 ? 'warning' : 'ok',
      message: errorRate > 0.05
        ? `Forhøyet feilrate: ${(errorRate * 100).toFixed(1)}%`
        : `${calls} kall siste 24t · $${Number(row.cost_usd_24h ?? 0).toFixed(2)}`,
      metrics: {
        calls24h: calls,
        costUsd24h: Number(row.cost_usd_24h ?? 0).toFixed(2),
        errors24h: errors,
      },
    };
  } catch (err) {
    return { ...base, health: 'error', message: (err as Error).message, metrics: {} };
  }
}

export function setupAdminPlatformStatusRoutes(deps: PlatformStatusDeps): void {
  const { app, pool, requireAdminRoomAccess, getRoleRoomStripeClient } = deps;

  app.get("/api/admin-room/platform-status", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const stripeClient = getRoleRoomStripeClient();
      const nowIso = new Date().toISOString();
      const fallbackError = (provider: string, message: string): ProviderStatus => ({
        provider, dashboardUrl: '', lastCheckedAt: nowIso,
        health: 'error', message, metrics: {},
      });
      const results = await Promise.allSettled([
        checkRender(),
        checkNeon(),
        checkVercel(),
        checkStripe(stripeClient),
        checkAnthropic(pool),
        checkUserPresence(pool),
      ]);
      const [renderR, neonR, vercelR, stripeR, anthropicR, presenceR] = results;
      const render    = renderR.status    === 'fulfilled' ? renderR.value    : fallbackError('Render',    String(renderR.reason));
      const neon      = neonR.status      === 'fulfilled' ? neonR.value      : fallbackError('Neon',      String(neonR.reason));
      const vercel    = vercelR.status    === 'fulfilled' ? vercelR.value    : fallbackError('Vercel',    String(vercelR.reason));
      const stripe    = stripeR.status    === 'fulfilled' ? stripeR.value    : fallbackError('Stripe',    String(stripeR.reason));
      const anthropic = anthropicR.status === 'fulfilled' ? anthropicR.value : fallbackError('Anthropic', String(anthropicR.reason));
      const presence: UserPresenceSummary  = presenceR.status === 'fulfilled' ? presenceR.value : {
        activeNow: 0, activeLast24h: 0, activeLast7d: 0, totalRoleRoomUsers: 0, recentUsers: [],
      };

      const providers = [render, neon, vercel, stripe, anthropic];
      const errorCount = providers.filter((p) => p.health === 'error').length;
      const warningCount = providers.filter((p) => p.health === 'warning').length;
      const unconfiguredCount = providers.filter((p) => p.health === 'unconfigured').length;
      const okCount = providers.filter((p) => p.health === 'ok').length;

      res.json({
        overall: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'ok',
        summary: { okCount, warningCount, errorCount, unconfiguredCount },
        providers,
        presence,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Graceful: catch-all → tom platform-status (iPad viser tom providers-liste).
      console.warn("[platform-status] failed:", (err as Error).message);
      res.json({
        overall: "ok",
        summary: { okCount: 0, warningCount: 0, errorCount: 0, unconfiguredCount: 0 },
        providers: [],
        presence: { activeNow: 0, activeLast24h: 0, activeLast7d: 0, totalRoleRoomUsers: 0, recentUsers: [] },
        checkedAt: new Date().toISOString(),
      });
    }
  });
}
