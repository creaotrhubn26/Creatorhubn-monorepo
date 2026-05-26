/**
 * admin-room-platform-cost-sync-routes.ts
 *
 * Live-synk fra eksterne leverandører til platform_fixed_costs:
 *   POST /api/admin-room/platform-fixed-costs/refresh/render
 *   POST /api/admin-room/platform-fixed-costs/refresh/neon
 *   POST /api/admin-room/platform-fixed-costs/refresh/vercel
 *
 * Hver route henter live data via leverandørens REST API (Bearer token i ENV),
 * mapper plan til kjent månedspris, og upserts mot platform_fixed_costs med
 * source=<leverandør>, auto_managed=TRUE og external_id satt.
 *
 * Manuelle rader (source='manual') påvirkes ikke. UI kan vise sist-synk-tidspunkt.
 *
 * Pris-tabeller er hardkodet i koden — leverandørene gir ikke plan→pris i API-en.
 * Når Render eller Neon oppdaterer prisene må PRICE-konstantene oppdateres her.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

// Plan-priser per render-tjenestetype. Nøkkel = `${kind}:${plan}`.
const RENDER_PLAN_PRICES_USD: Record<string, number> = {
  // Web services (https://render.com/pricing)
  'service:starter': 7,
  'service:standard': 25,
  'service:pro': 85,
  'service:pro_plus': 175,
  'service:pro_max': 225,
  'service:pro_ultra': 450,
  // Postgres (https://render.com/docs/databases#pricing)
  'postgres:basic_256mb': 6,
  'postgres:basic_1gb': 19,
  'postgres:basic_4gb': 95,
  'postgres:pro': 65,
  'postgres:pro_plus_4gb': 145,
  'postgres:pro_plus_8gb': 245,
  'postgres:pro_plus_16gb': 445,
  'postgres:pro_plus_32gb': 845,
  // Redis / Key-Value (https://render.com/docs/redis#pricing)
  'keyValue:starter': 10,
  'keyValue:pro': 90,
  'keyValue:pro_plus': 240,
};

// Neon plans (https://neon.tech/pricing) — månedlig USD
const NEON_PLAN_PRICES_USD: Record<string, number> = {
  free: 0,
  launch: 19,
  scale: 69,
  business: 700,
};

function renderApiPrice(plan: string | null | undefined, diskSizeGb: number | null | undefined, kind: 'service' | 'postgres' | 'keyValue'): number {
  if (!plan) return 0;
  const planKey = plan.toLowerCase();
  let base = RENDER_PLAN_PRICES_USD[`${kind}:${planKey}`] ?? 0;
  // Postgres-disk over plan-include: $0.25/GB/mnd over 10GB
  if (kind === 'postgres' && diskSizeGb && diskSizeGb > 10) {
    base += (diskSizeGb - 10) * 0.25;
  }
  return base;
}

function inferNeonPlanFromUsage(activeTimeSec: number, cpuUsedSec: number, storageBytes: number): string {
  const cpuHours = cpuUsedSec / 3600;
  const storageGb = storageBytes / 1024 / 1024 / 1024;
  // Free: 191.9 compute-hours, 0.5 GB
  if (cpuHours <= 190 && storageGb <= 0.5) return 'free';
  // Launch: 300 CPU-hours, 10 GB
  if (cpuHours <= 300 && storageGb <= 10) return 'launch';
  // Scale: 750 CPU-hours, 50 GB
  if (cpuHours <= 750 && storageGb <= 50) return 'scale';
  return 'business';
}

async function fetchRenderServices(token: string): Promise<Array<{ id: string; name: string; type: string; plan: string | null; diskSizeGb: number | null }>> {
  // Render REST API: GET /v1/services + GET /v1/postgres + GET /v1/redis
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const out: Array<{ id: string; name: string; type: string; plan: string | null; diskSizeGb: number | null }> = [];

  const servicesResponse = await fetch('https://api.render.com/v1/services?limit=100', { headers });
  if (servicesResponse.ok) {
    const payload = await servicesResponse.json() as Array<{ service: { id: string; name: string; type: string; serviceDetails?: { plan?: string } } }>;
    for (const row of payload) {
      out.push({
        id: row.service.id,
        name: row.service.name,
        type: 'service',
        plan: row.service.serviceDetails?.plan ?? null,
        diskSizeGb: null,
      });
    }
  }

  const postgresResponse = await fetch('https://api.render.com/v1/postgres?limit=100', { headers });
  if (postgresResponse.ok) {
    const payload = await postgresResponse.json() as Array<{ postgres: { id: string; name: string; plan?: string; diskSizeGB?: number } }>;
    for (const row of payload) {
      out.push({
        id: row.postgres.id,
        name: row.postgres.name,
        type: 'postgres',
        plan: row.postgres.plan ?? null,
        diskSizeGb: row.postgres.diskSizeGB ?? null,
      });
    }
  }

  const redisResponse = await fetch('https://api.render.com/v1/redis?limit=100', { headers });
  if (redisResponse.ok) {
    const payload = await redisResponse.json() as Array<{ keyValue?: { id: string; name: string; plan?: string }; redis?: { id: string; name: string; plan?: string } }>;
    for (const row of payload) {
      const r = row.keyValue ?? row.redis;
      if (!r) continue;
      out.push({ id: r.id, name: r.name, type: 'keyValue', plan: r.plan ?? null, diskSizeGb: null });
    }
  }

  return out;
}

interface NeonProjectSummary {
  id: string;
  name: string;
  active_time?: number;
  cpu_used_sec?: number;
  synthetic_storage_size?: number;
}

async function fetchNeonProjects(token: string): Promise<NeonProjectSummary[]> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const response = await fetch('https://console.neon.tech/api/v2/projects?limit=100', { headers });
  if (!response.ok) throw new Error(`Neon API ${response.status}`);
  const payload = await response.json() as { projects: NeonProjectSummary[] };
  return payload.projects ?? [];
}

interface VercelProjectSummary {
  id: string;
  name: string;
}

async function fetchVercelProjects(token: string, teamId?: string): Promise<VercelProjectSummary[]> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const url = `https://api.vercel.com/v9/projects${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Vercel API ${response.status}`);
  const payload = await response.json() as { projects: VercelProjectSummary[] };
  return payload.projects ?? [];
}

export function setupAdminPlatformCostSyncRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  async function upsertPlatformCost(args: {
    userId: string;
    source: 'render' | 'neon' | 'vercel';
    externalId: string;
    name: string;
    vendor: string;
    category: 'ai' | 'hosting' | 'cdn' | 'storage' | 'database' | 'devtool' | 'monitoring' | 'email' | 'other';
    amountUsdMonthly: number;
    notes: string;
  }): Promise<{ created: boolean; row: Record<string, unknown> }> {
    const existing = await pool.query(
      `SELECT id, role_room_share_pct, allocation_method, notes FROM platform_fixed_costs
        WHERE user_id = $1 AND source = $2 AND external_id = $3`,
      [args.userId, args.source, args.externalId],
    );
    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE platform_fixed_costs
            SET name = $1, vendor = $2, category = $3,
                amount_usd_monthly = $4, last_synced_at = NOW(),
                auto_managed = TRUE, active = TRUE,
                notes = COALESCE($5, notes),
                updated_at = NOW()
          WHERE id = $6
          RETURNING *`,
        [args.name, args.vendor, args.category, args.amountUsdMonthly, args.notes, existing.rows[0].id],
      );
      return { created: false, row: result.rows[0] };
    }
    const result = await pool.query(
      `INSERT INTO platform_fixed_costs
         (user_id, name, vendor, category, amount_usd_monthly,
          allocation_method, role_room_share_pct, billing_interval, active,
          source, external_id, last_synced_at, auto_managed, notes)
       VALUES ($1, $2, $3, $4, $5, 'total_platform', 30, 'monthly', TRUE,
               $6, $7, NOW(), TRUE, $8)
       RETURNING *`,
      [args.userId, args.name, args.vendor, args.category, args.amountUsdMonthly, args.source, args.externalId, args.notes],
    );
    return { created: true, row: result.rows[0] };
  }

  app.post("/api/admin-room/platform-fixed-costs/refresh/render", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const token = process.env.RENDER_API_KEY;
    if (!token) {
      res.status(503).json({ error: "RENDER_API_KEY ikke konfigurert. Hent fra dashboard.render.com/u/settings#api-keys og sett som ENV-var." });
      return;
    }
    try {
      const services = await fetchRenderServices(token);
      let created = 0;
      let updated = 0;
      for (const svc of services) {
        const price = renderApiPrice(svc.plan, svc.diskSizeGb, svc.type as 'service' | 'postgres' | 'keyValue');
        const category = svc.type === 'postgres' ? 'database' : svc.type === 'keyValue' ? 'database' : 'hosting';
        const notes = `Render ${svc.type} · plan ${svc.plan ?? '?'}${svc.diskSizeGb ? ` + ${svc.diskSizeGb}GB disk` : ''}`;
        const result = await upsertPlatformCost({
          userId: session.userId,
          source: 'render',
          externalId: svc.id,
          name: `Render — ${svc.name}`,
          vendor: 'Render',
          category,
          amountUsdMonthly: price,
          notes,
        });
        if (result.created) created++; else updated++;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: 'platform_fixed_cost',
        action: 'synced',
        summary: `Render: ${created} nye, ${updated} oppdatert (${services.length} tjenester)`,
      });
      res.json({ ok: true, created, updated, total: services.length });
    } catch (err) {
      console.error("[platform-cost-sync] render error", err);
      res.status(500).json({ error: (err as Error).message || "Render-synk feilet" });
    }
  });

  app.post("/api/admin-room/platform-fixed-costs/refresh/neon", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const token = process.env.NEON_API_KEY;
    if (!token) {
      res.status(503).json({ error: "NEON_API_KEY ikke konfigurert. Hent fra console.neon.tech/app/settings/api-keys og sett som ENV-var." });
      return;
    }
    try {
      const projects = await fetchNeonProjects(token);
      let created = 0;
      let updated = 0;
      for (const proj of projects) {
        const plan = inferNeonPlanFromUsage(proj.active_time ?? 0, proj.cpu_used_sec ?? 0, proj.synthetic_storage_size ?? 0);
        const price = NEON_PLAN_PRICES_USD[plan] ?? 0;
        const cpuHours = Math.round((proj.cpu_used_sec ?? 0) / 3600);
        const storageGb = ((proj.synthetic_storage_size ?? 0) / 1024 / 1024 / 1024).toFixed(2);
        const notes = `Neon ${proj.name} · estimert plan ${plan} · ${cpuHours} CU-h/mnd · ${storageGb} GB lagring`;
        const result = await upsertPlatformCost({
          userId: session.userId,
          source: 'neon',
          externalId: proj.id,
          name: `Neon — ${proj.name}`,
          vendor: 'Neon',
          category: 'database',
          amountUsdMonthly: price,
          notes,
        });
        if (result.created) created++; else updated++;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: 'platform_fixed_cost',
        action: 'synced',
        summary: `Neon: ${created} nye, ${updated} oppdatert (${projects.length} prosjekter)`,
      });
      res.json({ ok: true, created, updated, total: projects.length });
    } catch (err) {
      console.error("[platform-cost-sync] neon error", err);
      res.status(500).json({ error: (err as Error).message || "Neon-synk feilet" });
    }
  });

  app.post("/api/admin-room/platform-fixed-costs/refresh/vercel", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      res.status(503).json({ error: "VERCEL_TOKEN ikke konfigurert. Hent fra vercel.com/account/tokens og sett som ENV-var. Inkluder VERCEL_TEAM_ID hvis prosjektene ligger under et team." });
      return;
    }
    try {
      const projects = await fetchVercelProjects(token, process.env.VERCEL_TEAM_ID);
      // Vercel gir ikke pris per prosjekt — vi oppretter én rad per prosjekt
      // som default ($0) og lar brukeren editere manuelt.
      let created = 0;
      let updated = 0;
      for (const proj of projects) {
        const result = await upsertPlatformCost({
          userId: session.userId,
          source: 'vercel',
          externalId: proj.id,
          name: `Vercel — ${proj.name}`,
          vendor: 'Vercel',
          category: 'hosting',
          amountUsdMonthly: 0,
          notes: `Vercel prosjekt ${proj.id}. Vercel API gir ikke pris per prosjekt — editér beløp manuelt etter dashboard.`,
        });
        if (result.created) created++; else updated++;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: 'platform_fixed_cost',
        action: 'synced',
        summary: `Vercel: ${created} nye, ${updated} oppdatert (${projects.length} prosjekter)`,
      });
      res.json({ ok: true, created, updated, total: projects.length });
    } catch (err) {
      console.error("[platform-cost-sync] vercel error", err);
      res.status(500).json({ error: (err as Error).message || "Vercel-synk feilet" });
    }
  });
}
