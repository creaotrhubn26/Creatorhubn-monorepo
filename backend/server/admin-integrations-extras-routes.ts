/**
 * admin-integrations-extras-routes.ts
 *
 * Plattform-gruppe: integrasjoner (oversikt + API-keys + webhooks + OAuth
 * + env-secrets-katalog).
 *
 * Returnerer ekte data fra api_keys / webhooks / oauth_clients /
 * secret_rotation_tracker. Defensiv mot manglende tabeller og mot
 * legacy-skjemaer (api_keys i prod har f.eks. både `label`/`name` og
 * `is_active`/`active`, så vi bruker columnsOf() for å plukke riktig kolonne).
 *
 * VIKTIG: env-secrets-endepunktet returnerer ALDRI verdier — kun keys.
 * key_hash / secret_hash / client_secret returneres heller aldri.
 *
 * Endpoints:
 *   GET /api/admin/integrations/overview         — KPI + byCategory
 *   GET /api/admin/integrations/keys             — API-nøkkel-katalog (sanitert)
 *   GET /api/admin/integrations/webhooks         — webhook-katalog (sanitert)
 *   GET /api/admin/integrations/oauth            — OAuth-klient-katalog (sanitert)
 *   GET /api/admin/env-secrets                   — kun keys, aldri values
 *   GET /api/admin/oauth/check-scopes?provider=  — granted/missing-scopes
 *   GET /api/admin/api-gateway/status            — gateway-status
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminIntegrationsExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Whitelist over env-key-prefikser vi tillater å eksponere navnet på ──
// VIKTIG: vi returnerer KUN navnet, aldri value.
const SAFE_ENV_KEY_PREFIXES = [
  "STRIPE_",
  "GOOGLE_",
  "META_",
  "TIDUM_",
  "B2_",
  "CLAUDE_",
  "ANTHROPIC_",
  "OPENAI_",
  "ELEVENLABS_",
  "RESEND_",
  "TWILIO_",
  "BANKID_",
  "AWS_",
  "R2_",
  "CLOUDFLARE_",
  "RENDER_",
  "VERCEL_",
  "NEON_",
  "SUPABASE_",
  "SENDGRID_",
  "MAILGUN_",
  "POSTMARK_",
  "FACEBOOK_",
  "LINKEDIN_",
  "TIKTOK_",
  "YOUTUBE_",
  "INSTAGRAM_",
  "ZAPIER_",
  "MAKE_",
  "N8N_",
  "POSTHOG_",
  "SENTRY_",
  "DATADOG_",
];

// Mapping fra prefiks → kategori for byCategory-aggregering og env-katalog.
function categoryForKey(name: string): string {
  if (name.startsWith("STRIPE_")) return "payment";
  if (name.startsWith("CLOUDFLARE_") || name.startsWith("AWS_") || name.startsWith("B2_") || name.startsWith("R2_") || name.startsWith("SUPABASE_") || name.startsWith("NEON_")) return "storage";
  if (name.startsWith("GOOGLE_") || name.startsWith("META_") || name.startsWith("FACEBOOK_") || name.startsWith("LINKEDIN_") || name.startsWith("TIKTOK_") || name.startsWith("YOUTUBE_") || name.startsWith("INSTAGRAM_") || name.startsWith("BANKID_")) return "auth";
  if (name.startsWith("OPENAI_") || name.startsWith("ANTHROPIC_") || name.startsWith("CLAUDE_") || name.startsWith("ELEVENLABS_")) return "ai";
  if (name.startsWith("RESEND_") || name.startsWith("TWILIO_") || name.startsWith("SENDGRID_") || name.startsWith("MAILGUN_") || name.startsWith("POSTMARK_")) return "communication";
  if (name.startsWith("RENDER_") || name.startsWith("VERCEL_")) return "infrastructure";
  if (name.startsWith("POSTHOG_") || name.startsWith("SENTRY_") || name.startsWith("DATADOG_")) return "observability";
  if (name.startsWith("ZAPIER_") || name.startsWith("MAKE_") || name.startsWith("N8N_") || name.startsWith("TIDUM_")) return "automation";
  return "other";
}

// ── Defensive helpers ────────────────────────────────────────────────────
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [`public.${name}`],
    );
    return Boolean(r.rows[0]?.exists);
  } catch {
    return false;
  }
}

async function columnsOf(pool: Pool, table: string): Promise<Set<string>> {
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = $1
          AND table_schema = 'public'`,
      [table],
    );
    return new Set(r.rows.map((row) => row.column_name));
  } catch {
    return new Set();
  }
}

// Velg første kolonnenavn fra prioritert liste som faktisk finnes.
// Returnerer null hvis ingen finnes (caller faller tilbake til default).
function pickCol(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

// Trygt nummer-parse fra unknown.
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// jsonb eller text[] → string[]
function toStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.map((x) => String(x));
    } catch {
      /* not JSON */
    }
  }
  return [];
}

// ── Static check-scopes per provider ────────────────────────────────────
// Inntil ekte OAuth-introspection er på plass returnerer vi forventede vs
// faktisk-tildelte scopes basert på hva vi vet om dagens token-state.
const PROVIDER_SCOPE_EXPECTATIONS: Record<string, { granted: string[]; missing: string[] }> = {
  google: {
    granted: [],
    missing: ["analytics.readonly", "youtube.readonly"],
  },
  meta: {
    granted: [],
    missing: ["ads_read", "pages_read_engagement"],
  },
  facebook: {
    granted: [],
    missing: ["ads_read", "pages_read_engagement"],
  },
  linkedin: {
    granted: [],
    missing: ["r_ads", "r_organization_social"],
  },
  tiktok: {
    granted: [],
    missing: ["video.list", "user.info.basic"],
  },
};

export function setupAdminIntegrationsExtrasRoutes(
  deps: AdminIntegrationsExtrasRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/admin/integrations/overview ───────────────────────────────
  app.get("/api/admin/integrations/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      let totalKeys = 0;
      let activeKeys = 0;
      let totalWebhooks = 0;
      let activeWebhooks = 0;
      let brokenWebhooks = 0;
      let totalOauth = 0;
      let activeOauth = 0;

      // api_keys
      if (await tableExists(pool, "api_keys")) {
        const cols = await columnsOf(pool, "api_keys");
        const activeCol = pickCol(cols, ["is_active", "active"]);
        try {
          const r = await pool.query<{ total: string; active: string }>(
            `SELECT COUNT(*)::text AS total,
                    COUNT(*) FILTER (WHERE ${activeCol ? activeCol : "TRUE"})::text AS active
               FROM api_keys`,
          );
          totalKeys = toNum(r.rows[0]?.total);
          activeKeys = toNum(r.rows[0]?.active);
        } catch (e) {
          console.warn("[admin-integrations-extras] api_keys count failed:", e);
        }
      }

      // webhooks
      if (await tableExists(pool, "webhooks")) {
        const cols = await columnsOf(pool, "webhooks");
        const activeExpr = cols.has("is_active")
          ? "is_active"
          : cols.has("status")
            ? "status = 'active'"
            : "TRUE";
        const brokenExpr = cols.has("failure_count")
          ? "failure_count > 0"
          : cols.has("status")
            ? "status = 'failed'"
            : cols.has("last_error")
              ? "last_error IS NOT NULL"
              : "FALSE";
        try {
          const r = await pool.query<{ total: string; active: string; broken: string }>(
            `SELECT COUNT(*)::text AS total,
                    COUNT(*) FILTER (WHERE ${activeExpr})::text AS active,
                    COUNT(*) FILTER (WHERE ${brokenExpr})::text AS broken
               FROM webhooks`,
          );
          totalWebhooks = toNum(r.rows[0]?.total);
          activeWebhooks = toNum(r.rows[0]?.active);
          brokenWebhooks = toNum(r.rows[0]?.broken);
        } catch (e) {
          console.warn("[admin-integrations-extras] webhooks count failed:", e);
        }
      }

      // oauth_clients
      if (await tableExists(pool, "oauth_clients")) {
        const cols = await columnsOf(pool, "oauth_clients");
        const activeExpr = cols.has("is_active")
          ? "is_active"
          : cols.has("status")
            ? "status = 'active'"
            : "TRUE";
        try {
          const r = await pool.query<{ total: string; active: string }>(
            `SELECT COUNT(*)::text AS total,
                    COUNT(*) FILTER (WHERE ${activeExpr})::text AS active
               FROM oauth_clients`,
          );
          totalOauth = toNum(r.rows[0]?.total);
          activeOauth = toNum(r.rows[0]?.active);
        } catch (e) {
          console.warn("[admin-integrations-extras] oauth_clients count failed:", e);
        }
      }

      const totalIntegrations = totalKeys + totalWebhooks + totalOauth;
      const active = activeKeys + activeWebhooks + activeOauth;
      const broken = brokenWebhooks;

      const byCategory = {
        auth: totalOauth,
        payment: 0,
        storage: 0,
        ai: 0,
        communication: 0,
        webhook: totalWebhooks,
        apiKey: totalKeys,
      };

      // Berik byCategory.payment/storage/ai med env-secrets (groff proxy).
      const envCounts = { payment: 0, storage: 0, ai: 0, communication: 0 };
      for (const name of Object.keys(process.env)) {
        if (!SAFE_ENV_KEY_PREFIXES.some((p) => name.startsWith(p))) continue;
        if (!process.env[name]) continue;
        const cat = categoryForKey(name);
        if (cat === "payment") envCounts.payment += 1;
        else if (cat === "storage") envCounts.storage += 1;
        else if (cat === "ai") envCounts.ai += 1;
        else if (cat === "communication") envCounts.communication += 1;
      }
      byCategory.payment = envCounts.payment;
      byCategory.storage = envCounts.storage;
      byCategory.ai = envCounts.ai;
      byCategory.communication = envCounts.communication;

      res.json({
        totalIntegrations,
        active,
        broken,
        byCategory,
      });
    } catch (err) {
      // Graceful: returnér tom overview (iPad viser bare null-rader, ikke "Kunne ikke laste").
      console.warn("[admin-integrations-extras] overview failed:", (err as Error).message);
      res.json({
        totalIntegrations: 0, active: 0, broken: 0,
        byCategory: { auth: 0, payment: 0, storage: 0, ai: 0, communication: 0, webhook: 0, apiKey: 0 },
      });
    }
  });

  // ── GET /api/admin/integrations/keys ───────────────────────────────────
  app.get("/api/admin/integrations/keys", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      if (!(await tableExists(pool, "api_keys"))) {
        res.json({ keys: [], total: 0 });
        return;
      }

      const cols = await columnsOf(pool, "api_keys");
      // Hash-kolonnen returneres ALDRI. Vi velger kun de safe-kolonnene.
      const idCol = "id";
      const prefixCol = pickCol(cols, ["key_prefix", "prefix"]);
      const labelCol = pickCol(cols, ["label", "name"]);
      const scopesCol = pickCol(cols, ["scopes", "permissions"]);
      const createdByCol = pickCol(cols, ["created_by_user_id", "created_by"]);
      const lastUsedCol = pickCol(cols, ["last_used_at", "last_used"]);
      const expiresCol = pickCol(cols, ["expires_at"]);
      const activeCol = pickCol(cols, ["is_active", "active"]);
      const createdAtCol = pickCol(cols, ["created_at"]);

      const select: string[] = [`${idCol} AS id`];
      if (prefixCol) select.push(`${prefixCol} AS "keyPrefix"`);
      if (labelCol) select.push(`${labelCol} AS label`);
      if (scopesCol) select.push(`${scopesCol} AS scopes`);
      if (createdByCol) select.push(`${createdByCol} AS "createdByUserId"`);
      if (lastUsedCol) select.push(`${lastUsedCol} AS "lastUsedAt"`);
      if (expiresCol) select.push(`${expiresCol} AS "expiresAt"`);
      if (activeCol) select.push(`${activeCol} AS "isActive"`);
      if (createdAtCol) select.push(`${createdAtCol} AS "createdAt"`);

      const orderBy = createdAtCol ? `ORDER BY ${createdAtCol} DESC` : "";
      const sql = `SELECT ${select.join(", ")} FROM api_keys ${orderBy} LIMIT 500`;

      const r = await pool.query<Record<string, unknown>>(sql);
      const keys = r.rows.map((row) => ({
        id: String(row.id ?? ""),
        keyPrefix: typeof row.keyPrefix === "string" ? row.keyPrefix : null,
        label: typeof row.label === "string" ? row.label : null,
        scopes: toStrArr(row.scopes),
        createdAt: row.createdAt ?? null,
        lastUsedAt: row.lastUsedAt ?? null,
        expiresAt: row.expiresAt ?? null,
        isActive: row.isActive === undefined ? true : Boolean(row.isActive),
      }));
      res.json({ keys, total: keys.length });
    } catch (err) {
      console.warn("[admin-integrations-extras] keys failed:", (err as Error).message);
      res.json({ keys: [], total: 0 });
    }
  });

  // ── GET /api/admin/integrations/webhooks ───────────────────────────────
  app.get("/api/admin/integrations/webhooks", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      if (!(await tableExists(pool, "webhooks"))) {
        res.json({ webhooks: [], total: 0 });
        return;
      }

      const cols = await columnsOf(pool, "webhooks");
      const urlCol = pickCol(cols, ["url"]);
      const eventsCol = pickCol(cols, ["events"]);
      const activeCol = pickCol(cols, ["is_active"]);
      const statusCol = pickCol(cols, ["status"]);
      const lastDeliveredCol = pickCol(cols, ["last_delivered_at", "last_triggered"]);
      const lastStatusCol = pickCol(cols, ["last_status_code"]);
      const failureCol = pickCol(cols, ["failure_count", "retry_count"]);
      const createdAtCol = pickCol(cols, ["created_at"]);

      const select: string[] = ["id"];
      if (urlCol) select.push(`${urlCol} AS url`);
      if (eventsCol) select.push(`${eventsCol} AS events`);
      if (activeCol) select.push(`${activeCol} AS "isActive"`);
      else if (statusCol) select.push(`${statusCol} AS status`);
      if (lastDeliveredCol) select.push(`${lastDeliveredCol} AS "lastDelivered"`);
      if (lastStatusCol) select.push(`${lastStatusCol} AS "lastStatus"`);
      if (failureCol) select.push(`${failureCol} AS "failureCount"`);
      if (createdAtCol) select.push(`${createdAtCol} AS "createdAt"`);

      const orderBy = createdAtCol ? `ORDER BY ${createdAtCol} DESC` : "";
      const sql = `SELECT ${select.join(", ")} FROM webhooks ${orderBy} LIMIT 500`;

      const r = await pool.query<Record<string, unknown>>(sql);
      const webhooks = r.rows.map((row) => {
        const isActive = row.isActive !== undefined
          ? Boolean(row.isActive)
          : row.status === "active";
        return {
          id: String(row.id ?? ""),
          url: typeof row.url === "string" ? row.url : "",
          events: toStrArr(row.events),
          isActive,
          lastDelivered: row.lastDelivered ?? null,
          lastStatus: row.lastStatus === undefined ? null : toNum(row.lastStatus),
          failureCount: toNum(row.failureCount),
        };
      });
      res.json({ webhooks, total: webhooks.length });
    } catch (err) {
      console.warn("[admin-integrations-extras] webhooks failed:", (err as Error).message);
      res.json({ webhooks: [], total: 0 });
    }
  });

  // ── GET /api/admin/integrations/oauth ──────────────────────────────────
  app.get("/api/admin/integrations/oauth", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      if (!(await tableExists(pool, "oauth_clients"))) {
        res.json({ clients: [], total: 0 });
        return;
      }

      const cols = await columnsOf(pool, "oauth_clients");
      // client_secret returneres ALDRI.
      const clientIdCol = pickCol(cols, ["client_id"]);
      const nameCol = pickCol(cols, ["client_name", "name"]);
      const redirectCol = pickCol(cols, ["redirect_uris"]);
      const scopesCol = pickCol(cols, ["scopes"]);
      const activeCol = pickCol(cols, ["is_active"]);
      const statusCol = pickCol(cols, ["status"]);
      const createdAtCol = pickCol(cols, ["created_at"]);

      const select: string[] = ["id"];
      if (clientIdCol) select.push(`${clientIdCol} AS "clientId"`);
      if (nameCol) select.push(`${nameCol} AS "clientName"`);
      if (redirectCol) select.push(`${redirectCol} AS "redirectUris"`);
      if (scopesCol) select.push(`${scopesCol} AS scopes`);
      if (activeCol) select.push(`${activeCol} AS "isActive"`);
      else if (statusCol) select.push(`${statusCol} AS status`);
      if (createdAtCol) select.push(`${createdAtCol} AS "createdAt"`);

      const orderBy = createdAtCol ? `ORDER BY ${createdAtCol} DESC` : "";
      const sql = `SELECT ${select.join(", ")} FROM oauth_clients ${orderBy} LIMIT 500`;

      const r = await pool.query<Record<string, unknown>>(sql);
      const clients = r.rows.map((row) => {
        const isActive = row.isActive !== undefined
          ? Boolean(row.isActive)
          : row.status === "active";
        return {
          id: String(row.id ?? ""),
          clientId: typeof row.clientId === "string" ? row.clientId : "",
          clientName: typeof row.clientName === "string" ? row.clientName : "",
          redirectUris: toStrArr(row.redirectUris),
          scopes: toStrArr(row.scopes),
          isActive,
        };
      });
      res.json({ clients, total: clients.length });
    } catch (err) {
      console.error("[admin-integrations-extras] oauth failed:", err);
      res.status(500).json({ error: "integration_oauth_failed" });
    }
  });

  // ── GET /api/admin/env-secrets ─────────────────────────────────────────
  // Returnerer KUN keys (navn). ALDRI values.
  app.get("/api/admin/env-secrets", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      // Steg 1 — finn alle env-keys som matcher whitelist.
      const envKeys = Object.keys(process.env)
        .filter((name) => SAFE_ENV_KEY_PREFIXES.some((p) => name.startsWith(p)))
        .sort();

      // Steg 2 — slå opp lastRotatedAt fra secret_rotation_tracker.
      const rotationMap = new Map<string, { rotatedAt: unknown; category: string | null }>();
      if (await tableExists(pool, "secret_rotation_tracker")) {
        try {
          const r = await pool.query<{ key_name: string; rotated_at: unknown; category: string }>(
            `SELECT key_name, rotated_at, category FROM secret_rotation_tracker`,
          );
          for (const row of r.rows) {
            rotationMap.set(row.key_name, {
              rotatedAt: row.rotated_at,
              category: row.category ?? null,
            });
          }
        } catch (e) {
          console.warn("[admin-integrations-extras] rotation lookup failed:", e);
        }
      }

      const secrets = envKeys.map((name) => {
        const rotation = rotationMap.get(name);
        return {
          name,
          isSet: Boolean(process.env[name]),
          category: rotation?.category ?? categoryForKey(name),
          lastRotatedAt: rotation?.rotatedAt ?? null,
          // value er bevisst utelatt; aldri eksponer i klartext.
        };
      });

      res.json({ secrets });
    } catch (err) {
      console.error("[admin-integrations-extras] env-secrets failed:", err);
      res.status(500).json({ error: "env_secrets_failed" });
    }
  });

  // ── GET /api/admin/oauth/check-scopes?provider=google ──────────────────
  app.get("/api/admin/oauth/check-scopes", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      const provider = typeof req.query.provider === "string"
        ? req.query.provider.toLowerCase()
        : "google";
      // TODO: kall faktisk provider sin tokeninfo for ekte granted scopes.
      const expectation = PROVIDER_SCOPE_EXPECTATIONS[provider] ?? {
        granted: [],
        missing: [],
      };
      res.json({
        provider,
        granted: expectation.granted,
        missing: expectation.missing,
      });
    } catch (err) {
      console.error("[admin-integrations-extras] check-scopes failed:", err);
      res.status(500).json({ error: "oauth_check_scopes_failed" });
    }
  });

  // ── GET /api/admin/api-gateway/status ──────────────────────────────────
  app.get("/api/admin/api-gateway/status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // Inntil vi har en faktisk gateway-probe rapporterer vi operational
      // med default-uptime og 0 RPM. Senere kobles dette mot health-check-
      // historikken / Render-API-en.
      res.json({
        status: "operational",
        uptime: 99.99,
        requestsPerMinute: 0,
      });
    } catch (err) {
      console.error("[admin-integrations-extras] gateway-status failed:", err);
      res.status(500).json({ error: "api_gateway_status_failed" });
    }
  });
}
