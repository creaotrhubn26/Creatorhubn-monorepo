/**
 * sales-leadership-routes.ts
 *
 * Salgsledelse-systemet i Leadgrid — provisjons-konfig, konkurranse-maler,
 * premie-katalog, konkurranser og fulfillment av premier.
 *
 * Prefix: /api/leadgrid/sales-leadership/*
 *
 * Endepunkter (22 totalt):
 *   GET    /commission-config
 *   PUT    /commission-config
 *   GET    /contest-templates
 *   PUT    /contest-templates/:type
 *   GET    /prize-catalog
 *   POST   /prize-catalog
 *   PATCH  /prize-catalog/:id
 *   DELETE /prize-catalog/:id
 *   POST   /prize-catalog/upload-image
 *   GET    /contests?status=
 *   POST   /contests
 *   GET    /contests/:id
 *   PATCH  /contests/:id
 *   POST   /contests/:id/close
 *   DELETE /contests/:id
 *   GET    /awards?status=&org=true|false
 *   POST   /awards/:id/advance
 *   POST   /awards/:id/shipping-address
 *
 * Forutsetter mig 0354 (parallell agent) som lager:
 *   - sales_commission_configs
 *   - sales_contest_templates
 *   - sales_prize_catalog
 *   - sales_contests
 *   - sales_contest_prizes
 *   - sales_contest_participants (snapshot ved close)
 *   - sales_prize_awards (fulfillment-tracker)
 *
 * REGISTRERES IKKE her — wire opp i backend/server/index.ts ved siden av
 * `setupSalesRoutes({...})` (linje ~64508), f.eks:
 *
 *   import { registerSalesLeadershipRoutes } from "./sales-leadership-routes";
 *   registerSalesLeadershipRoutes({ app, pool, requireUserSession });
 *
 * Auth: Bruker eksisterende `requireUserSession`-mønster (returnerer 401
 * automatisk). Org-id utledes via `resolveOrgIdForUser()` som faller til
 * `userId` hvis brukeren ikke er medlem av en enterprise-org (matcher
 * mønster i dance-team-service der teamOrgId === ownerUserId for solo).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import multer from "multer";
import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sendEmail } from "./casting-reminder-sender.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface SalesLeadershipRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

// ─────────────────────────────────────────────────────────────────
// Upload (image til premie-katalog)
// ─────────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const prizeImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const B2_REGION = process.env.B2_REGION || "eu-central-003";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

function getB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  return {
    client: new S3Client({
      region: B2_REGION,
      endpoint: B2_ENDPOINT,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    }),
    bucket,
  };
}

// ─────────────────────────────────────────────────────────────────
// Konstantar
// ─────────────────────────────────────────────────────────────────
const VALID_CONTEST_STATUS = new Set(["active", "ended", "archived"]);
const VALID_AWARD_STATUS = new Set([
  "pending",
  "awaiting_address",
  "ordered",
  "shipped",
  "received",
  "cancelled",
]);
const AWARD_STATUS_ORDER: ReadonlyArray<string> = [
  "pending",
  "awaiting_address",
  "ordered",
  "shipped",
  "received",
];

const DEFAULT_COMMISSION_CONFIG = {
  preset: "balanced",
  active_models: ["base_percentage"] as string[],
  config: {
    base_percentage: { rate: 0.1 },
    accelerators: [],
    spiffs: [],
    splits: { enabled: false },
    quotas: { enabled: false },
  } as Record<string, unknown>,
};

const DEFAULT_CONTEST_TEMPLATES: ReadonlyArray<{
  type: string;
  label: string;
  description: string;
  default_kpi: string;
}> = [
  { type: "weekly_revenue", label: "Ukentlig omsetning", description: "Topp selger på lukket omsetning", default_kpi: "closed_revenue" },
  { type: "monthly_deals", label: "Månedlig deal-volum", description: "Flest lukkede deals", default_kpi: "deals_closed" },
  { type: "discovery_calls", label: "Discovery-samtaler", description: "Flest discovery-møter", default_kpi: "discovery_calls" },
  { type: "demo_count", label: "Demo-konkurranse", description: "Flest demoer holdt", default_kpi: "demos_held" },
  { type: "pipeline_built", label: "Pipeline bygget", description: "Mest pipeline opprettet", default_kpi: "pipeline_value_created" },
];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Returnerer organization_id for innlogget bruker. Faller til userId hvis
 * brukeren ikke er medlem av en enterprise-org (matcher solo-owner-mønster
 * i dance-team-service).
 */
async function resolveOrgIdForUser(
  pool: Pool,
  userId: string,
): Promise<string> {
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    const orgId = r.rows[0]?.organization_id;
    if (orgId) return String(orgId);
  } catch {
    // Tabell mangler eller spørring feilet — fall til userId-modell.
  }
  return userId;
}

function readString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function isAdminLikeRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "admin" || r === "super_admin" || r === "owner" || r === "sales_manager";
}

/** Best-effort notification + email til vinneren ved status-endring. */
async function notifyAwardStatusChange(
  pool: Pool,
  award: {
    id: string;
    winner_user_id: string;
    product_title: string;
    contest_name: string | null;
    status: string;
  },
  extra?: { trackingNumber?: string; notes?: string },
): Promise<void> {
  const title = `Premie-oppdatering: ${award.product_title}`;
  const statusLabel: Record<string, string> = {
    pending: "Registrert",
    awaiting_address: "Venter på leveringsadresse",
    ordered: "Bestilt",
    shipped: "Sendt",
    received: "Mottatt",
    cancelled: "Kansellert",
  };
  const message = [
    award.contest_name ? `Konkurransen «${award.contest_name}» — ${statusLabel[award.status] ?? award.status}.` : `${statusLabel[award.status] ?? award.status}.`,
    extra?.trackingNumber ? `Sporing: ${extra.trackingNumber}` : null,
    extra?.notes ? extra.notes : null,
  ].filter(Boolean).join(" ");

  // In-app notification (best-effort)
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, priority, action_url, action_text, metadata)
       VALUES ($1, 'sales_prize_award', $2, $3, 'normal', $4, 'Se premie', $5::jsonb)`,
      [
        award.winner_user_id,
        title,
        message,
        `/leadgrid/sales-leadership/awards/${award.id}`,
        JSON.stringify({
          award_id: award.id,
          status: award.status,
          tracking_number: extra?.trackingNumber ?? null,
        }),
      ],
    );
  } catch (err) {
    console.warn("[sales-leadership] notification insert failed:", (err as Error).message);
  }

  // E-post (best-effort) — gjenbruker sendEmail fra casting-reminder-sender.
  try {
    const userRow = await pool.query<{ email: string; first_name: string | null }>(
      `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
      [award.winner_user_id],
    ).catch(() => ({ rows: [] as Array<{ email: string; first_name: string | null }> }));
    const email = userRow.rows[0]?.email;
    if (email) {
      await sendEmail({
        to: email,
        subject: title,
        text: message,
        html: `<p>${message}</p>`,
        fromName: "Leadgrid Salgsledelse",
      });
    }
  } catch (err) {
    console.warn("[sales-leadership] email dispatch failed:", (err as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────
export function registerSalesLeadershipRoutes(
  deps: SalesLeadershipRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // ───────────────────────────────────────────────────────────────
  // COMMISSION CONFIG (én per org)
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/sales-leadership/commission-config", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `SELECT preset, active_models, config, updated_at
           FROM sales_commission_configs
          WHERE organization_id = $1
          LIMIT 1`,
        [orgId],
      );
      if (r.rows.length === 0) {
        return res.json({
          organization_id: orgId,
          ...DEFAULT_COMMISSION_CONFIG,
          is_default: true,
        });
      }
      const row = r.rows[0] as Record<string, unknown>;
      return res.json({
        organization_id: orgId,
        preset: row.preset,
        active_models: row.active_models ?? [],
        config: row.config ?? {},
        updated_at: row.updated_at,
        is_default: false,
      });
    } catch (err) {
      console.error("[sales-leadership] commission-config GET failed:", err);
      return res.status(500).json({ error: "commission_config_failed", detail: String((err as Error).message) });
    }
  });

  app.put("/api/leadgrid/sales-leadership/commission-config", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const body = (req.body ?? {}) as {
      preset?: string;
      active_models?: string[];
      config?: Record<string, unknown>;
    };
    const preset = readString(body.preset, "custom");
    const activeModels = Array.isArray(body.active_models) ? body.active_models.filter((s) => typeof s === "string") : [];
    const config = body.config && typeof body.config === "object" ? body.config : {};
    try {
      const r = await pool.query(
        `INSERT INTO sales_commission_configs
           (organization_id, preset, active_models, config, updated_by, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, NOW())
         ON CONFLICT (organization_id) DO UPDATE
           SET preset = EXCLUDED.preset,
               active_models = EXCLUDED.active_models,
               config = EXCLUDED.config,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()
         RETURNING preset, active_models, config, updated_at`,
        [orgId, preset, JSON.stringify(activeModels), JSON.stringify(config), session.userId],
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.json({
        organization_id: orgId,
        preset: row.preset,
        active_models: row.active_models ?? [],
        config: row.config ?? {},
        updated_at: row.updated_at,
      });
    } catch (err) {
      console.error("[sales-leadership] commission-config PUT failed:", err);
      return res.status(500).json({ error: "commission_config_save_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // CONTEST TEMPLATES
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/sales-leadership/contest-templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `SELECT template_type, enabled, defaults, updated_at
           FROM sales_contest_templates
          WHERE organization_id = $1`,
        [orgId],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      const overrides = new Map<string, Record<string, unknown>>();
      for (const row of r.rows) {
        overrides.set(String(row.template_type), row);
      }
      const merged = DEFAULT_CONTEST_TEMPLATES.map((d) => {
        const o = overrides.get(d.type);
        return {
          template_type: d.type,
          label: d.label,
          description: d.description,
          default_kpi: d.default_kpi,
          enabled: o ? Boolean(o.enabled) : true,
          defaults: (o?.defaults as Record<string, unknown> | undefined) ?? {},
          updated_at: o?.updated_at ?? null,
        };
      });
      return res.json({ templates: merged });
    } catch (err) {
      console.error("[sales-leadership] contest-templates GET failed:", err);
      return res.status(500).json({ error: "contest_templates_failed", detail: String((err as Error).message) });
    }
  });

  app.put("/api/leadgrid/sales-leadership/contest-templates/:type", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const type = readString(req.params.type);
    if (!type) return res.status(400).json({ error: "missing_template_type" });
    const body = (req.body ?? {}) as { enabled?: boolean; defaults?: Record<string, unknown> };
    const enabled = body.enabled !== false;
    const defaults = body.defaults && typeof body.defaults === "object" ? body.defaults : {};
    try {
      const r = await pool.query(
        `INSERT INTO sales_contest_templates
           (organization_id, template_type, enabled, defaults, updated_by, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT (organization_id, template_type) DO UPDATE
           SET enabled = EXCLUDED.enabled,
               defaults = EXCLUDED.defaults,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()
         RETURNING template_type, enabled, defaults, updated_at`,
        [orgId, type, enabled, JSON.stringify(defaults), session.userId],
      );
      return res.json(r.rows[0]);
    } catch (err) {
      console.error("[sales-leadership] contest-templates PUT failed:", err);
      return res.status(500).json({ error: "contest_template_save_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PRIZE CATALOG
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/sales-leadership/prize-catalog", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `SELECT id, title, description, category, estimated_value_nok,
                fulfillment_type, image_url, image_b2_key, metadata,
                created_by, created_at, updated_at, archived
           FROM sales_prize_catalog
          WHERE organization_id = $1 AND archived = FALSE
          ORDER BY created_at DESC`,
        [orgId],
      );
      return res.json({ prizes: r.rows });
    } catch (err) {
      console.error("[sales-leadership] prize-catalog GET failed:", err);
      return res.status(500).json({ error: "prize_catalog_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/sales-leadership/prize-catalog", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = readString(body.title);
    if (!title) return res.status(400).json({ error: "missing_title" });
    const description = readString(body.description);
    const category = readString(body.category, "physical");
    const fulfillmentType = readString(body.fulfillment_type, "physical_shipping");
    const value = typeof body.estimated_value_nok === "number" ? body.estimated_value_nok : Number(body.estimated_value_nok ?? 0) || 0;
    const imageUrl = readString(body.image_url) || null;
    const imageKey = readString(body.image_b2_key) || null;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    try {
      const r = await pool.query(
        `INSERT INTO sales_prize_catalog
           (organization_id, title, description, category, estimated_value_nok,
            fulfillment_type, image_url, image_b2_key, metadata, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW(), NOW())
         RETURNING id, title, description, category, estimated_value_nok,
                   fulfillment_type, image_url, image_b2_key, metadata, created_at`,
        [orgId, title, description, category, value, fulfillmentType, imageUrl, imageKey, JSON.stringify(metadata), session.userId],
      );
      return res.status(201).json(r.rows[0]);
    } catch (err) {
      console.error("[sales-leadership] prize-catalog POST failed:", err);
      return res.status(500).json({ error: "prize_create_failed", detail: String((err as Error).message) });
    }
  });

  app.patch("/api/leadgrid/sales-leadership/prize-catalog/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, val: unknown) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (typeof body.title === "string") push("title", body.title);
    if (typeof body.description === "string") push("description", body.description);
    if (typeof body.category === "string") push("category", body.category);
    if (body.estimated_value_nok !== undefined) push("estimated_value_nok", Number(body.estimated_value_nok) || 0);
    if (typeof body.fulfillment_type === "string") push("fulfillment_type", body.fulfillment_type);
    if (body.image_url !== undefined) push("image_url", body.image_url ? String(body.image_url) : null);
    if (body.image_b2_key !== undefined) push("image_b2_key", body.image_b2_key ? String(body.image_b2_key) : null);
    if (body.metadata && typeof body.metadata === "object") {
      vals.push(JSON.stringify(body.metadata));
      sets.push(`metadata = $${vals.length}::jsonb`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "no_fields_to_update" });
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    vals.push(orgId);
    try {
      const r = await pool.query(
        `UPDATE sales_prize_catalog SET ${sets.join(", ")}
          WHERE id = $${vals.length - 1} AND organization_id = $${vals.length}
          RETURNING id, title, description, category, estimated_value_nok,
                    fulfillment_type, image_url, image_b2_key, metadata, updated_at`,
        vals,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (err) {
      console.error("[sales-leadership] prize-catalog PATCH failed:", err);
      return res.status(500).json({ error: "prize_update_failed", detail: String((err as Error).message) });
    }
  });

  app.delete("/api/leadgrid/sales-leadership/prize-catalog/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    try {
      const r = await pool.query(
        `UPDATE sales_prize_catalog
            SET archived = TRUE, updated_at = NOW()
          WHERE id = $1 AND organization_id = $2
          RETURNING id`,
        [id, orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, id });
    } catch (err) {
      console.error("[sales-leadership] prize-catalog DELETE failed:", err);
      return res.status(500).json({ error: "prize_delete_failed", detail: String((err as Error).message) });
    }
  });

  app.post(
    "/api/leadgrid/sales-leadership/prize-catalog/upload-image",
    prizeImageUpload.single("image"),
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const file = (req as any).file as { buffer: Buffer; originalname: string; mimetype: string } | undefined;
      if (!file) return res.status(400).json({ error: "missing_image_field" });
      const ct = file.mimetype || "application/octet-stream";
      if (!ct.startsWith("image/")) {
        return res.status(400).json({ error: "invalid_image_type", detail: ct });
      }
      const config = getB2Client();
      if (!config) return res.status(503).json({ error: "b2_not_configured" });
      const fileId = crypto.randomUUID();
      const safeName = (file.originalname || "prize")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || "prize";
      const b2Key = `sales-leadership/${orgId}/prizes/${fileId}-${safeName}`;
      try {
        await config.client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: b2Key,
            Body: file.buffer,
            ContentType: ct,
          }),
        );
      } catch (err) {
        console.error("[sales-leadership] prize image upload failed:", err);
        return res.status(500).json({ error: "upload_failed", detail: String((err as Error).message) });
      }
      const imageUrl = `${B2_ENDPOINT}/${config.bucket}/${b2Key}`;
      return res.status(201).json({ image_url: imageUrl, image_b2_key: b2Key });
    },
  );

  // ───────────────────────────────────────────────────────────────
  // CONTESTS
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/sales-leadership/contests", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const status = readString(req.query.status, "active");
    if (!VALID_CONTEST_STATUS.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    try {
      const r = await pool.query(
        `SELECT c.id, c.name, c.template_type, c.kpi, c.kpi_config, c.status,
                c.starts_at, c.ends_at, c.closed_at, c.created_by, c.created_at,
                (SELECT COUNT(*) FROM sales_contest_prizes p WHERE p.contest_id = c.id)::int AS prize_count
           FROM sales_contests c
          WHERE c.organization_id = $1 AND c.status = $2
          ORDER BY c.created_at DESC`,
        [orgId, status],
      );
      return res.json({ contests: r.rows });
    } catch (err) {
      console.error("[sales-leadership] contests GET failed:", err);
      return res.status(500).json({ error: "contests_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/sales-leadership/contests", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = readString(body.name);
    const templateType = readString(body.template_type);
    const kpi = readString(body.kpi);
    if (!name || !templateType || !kpi) {
      return res.status(400).json({ error: "name, template_type and kpi are required" });
    }
    const kpiConfig = body.kpi_config && typeof body.kpi_config === "object" ? body.kpi_config : {};
    const endsAt = readString(body.ends_at) || null;
    const startsAt = readString(body.starts_at) || null;
    const prizes = Array.isArray(body.prizes) ? body.prizes : [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const contestRes = await client.query(
        `INSERT INTO sales_contests
           (organization_id, name, template_type, kpi, kpi_config, status,
            starts_at, ends_at, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'active', $6, $7, $8, NOW())
         RETURNING id, name, template_type, kpi, kpi_config, status,
                   starts_at, ends_at, created_at`,
        [orgId, name, templateType, kpi, JSON.stringify(kpiConfig), startsAt, endsAt, session.userId],
      );
      const contest = contestRes.rows[0] as Record<string, unknown>;
      const contestId = String(contest.id);

      for (const raw of prizes) {
        const p = (raw ?? {}) as Record<string, unknown>;
        const rank = Number(p.rank) || 1;
        const product = (p.product ?? {}) as Record<string, unknown>;
        const productId = readString(product.id) || null;
        const productTitle = readString(product.title);
        const productCategory = readString(product.category, "physical");
        const fulfillmentType = readString(product.fulfillment_type, "physical_shipping");
        const valueNok = Number(product.estimated_value_nok ?? 0) || 0;
        await client.query(
          `INSERT INTO sales_contest_prizes
             (contest_id, rank, product_id, product_title, product_category,
              fulfillment_type, estimated_value_nok, product_snapshot, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
          [contestId, rank, productId, productTitle, productCategory, fulfillmentType, valueNok, JSON.stringify(product)],
        );
      }

      await client.query("COMMIT");
      return res.status(201).json({ ...contest, id: contestId });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[sales-leadership] contest create failed:", err);
      return res.status(500).json({ error: "contest_create_failed", detail: String((err as Error).message) });
    } finally {
      client.release();
    }
  });

  app.get("/api/leadgrid/sales-leadership/contests/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    try {
      const contestRes = await pool.query(
        `SELECT id, name, template_type, kpi, kpi_config, status,
                starts_at, ends_at, closed_at, created_by, created_at
           FROM sales_contests
          WHERE id = $1 AND organization_id = $2
          LIMIT 1`,
        [id, orgId],
      );
      if (contestRes.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const contest = contestRes.rows[0];

      const prizesRes = await pool.query(
        `SELECT id, rank, product_id, product_title, product_category,
                fulfillment_type, estimated_value_nok, product_snapshot
           FROM sales_contest_prizes
          WHERE contest_id = $1
          ORDER BY rank ASC`,
        [id],
      );

      const participantsRes = await pool.query(
        `SELECT user_id, score, rank, snapshot_at, user_name, user_email
           FROM sales_contest_participants
          WHERE contest_id = $1
          ORDER BY rank ASC NULLS LAST, score DESC NULLS LAST`,
        [id],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      let winners: Array<Record<string, unknown>> = [];
      let awards: Array<Record<string, unknown>> = [];
      if (contest.status === "ended" || contest.status === "archived") {
        winners = participantsRes.rows.filter((row) => row.rank !== null && row.rank !== undefined);
        const awardRes = await pool.query(
          `SELECT id, winner_user_id, prize_id, rank, status, tracking_number,
                  ordered_at, shipped_at, received_at, notes
             FROM sales_prize_awards
            WHERE contest_id = $1
            ORDER BY rank ASC`,
          [id],
        ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
        awards = awardRes.rows;
      }

      return res.json({
        contest,
        prizes: prizesRes.rows,
        participants: participantsRes.rows,
        winners,
        awards,
      });
    } catch (err) {
      console.error("[sales-leadership] contest detail failed:", err);
      return res.status(500).json({ error: "contest_detail_failed", detail: String((err as Error).message) });
    }
  });

  app.patch("/api/leadgrid/sales-leadership/contests/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    const body = (req.body ?? {}) as { status?: string };
    const status = readString(body.status);
    if (!VALID_CONTEST_STATUS.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    try {
      const r = await pool.query(
        `UPDATE sales_contests
            SET status = $1, updated_at = NOW()
          WHERE id = $2 AND organization_id = $3
          RETURNING id, status`,
        [status, id, orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (err) {
      console.error("[sales-leadership] contest PATCH failed:", err);
      return res.status(500).json({ error: "contest_update_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/sales-leadership/contests/:id/close", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const contestRes = await client.query(
        `SELECT id, name, kpi, status
           FROM sales_contests
          WHERE id = $1 AND organization_id = $2
          FOR UPDATE`,
        [id, orgId],
      );
      if (contestRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "not_found" });
      }
      const contest = contestRes.rows[0] as Record<string, unknown>;
      if (contest.status !== "active") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "contest_not_active", status: contest.status });
      }

      const prizesRes = await client.query(
        `SELECT id, rank, product_id, product_title, product_category, fulfillment_type
           FROM sales_contest_prizes
          WHERE contest_id = $1
          ORDER BY rank ASC`,
        [id],
      );
      const topN = prizesRes.rows.length;

      // Topp N basert på score (deltakerne har allerede score satt via et
      // beregnings-script — vi leser kun her). Hvis ingen participants, lag
      // tom liste men marker likevel som ended.
      const participantsRes = await client.query(
        `SELECT user_id, score, user_name, user_email
           FROM sales_contest_participants
          WHERE contest_id = $1
          ORDER BY score DESC NULLS LAST
          LIMIT $2`,
        [id, topN],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      const winnerRows = participantsRes.rows;

      // Marker rank på participants
      for (let i = 0; i < winnerRows.length; i++) {
        const w = winnerRows[i];
        await client.query(
          `UPDATE sales_contest_participants
              SET rank = $1
            WHERE contest_id = $2 AND user_id = $3`,
          [i + 1, id, w.user_id],
        );
      }

      // Opprett award-rader for hver vinner
      const createdAwards: Array<{ id: string; winner_user_id: string; product_title: string; status: string }> = [];
      for (let i = 0; i < winnerRows.length; i++) {
        const w = winnerRows[i];
        const prize = prizesRes.rows[i];
        if (!prize) break;
        // Default fulfillment per kategori:
        // physical_shipping → awaiting_address (vinner må fylle inn)
        // digital_code / experience_voucher → pending (admin må sette opp)
        const initialStatus = prize.fulfillment_type === "physical_shipping"
          ? "awaiting_address"
          : "pending";
        const awardRes = await client.query(
          `INSERT INTO sales_prize_awards
             (contest_id, prize_id, winner_user_id, rank, status,
              product_title, product_category, fulfillment_type, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id, winner_user_id, product_title, status`,
          [id, prize.id, w.user_id, i + 1, initialStatus, prize.product_title, prize.product_category, prize.fulfillment_type],
        );
        createdAwards.push(awardRes.rows[0] as { id: string; winner_user_id: string; product_title: string; status: string });
      }

      await client.query(
        `UPDATE sales_contests
            SET status = 'ended', closed_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [id],
      );

      await client.query("COMMIT");

      // Best-effort notifications (utenfor transaksjon)
      for (const award of createdAwards) {
        await notifyAwardStatusChange(pool, {
          id: award.id,
          winner_user_id: award.winner_user_id,
          product_title: award.product_title,
          contest_name: typeof contest.name === "string" ? contest.name : null,
          status: award.status,
        });
      }

      return res.json({
        ok: true,
        contest_id: id,
        winners: winnerRows.length,
        awards_created: createdAwards.length,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[sales-leadership] contest close failed:", err);
      return res.status(500).json({ error: "contest_close_failed", detail: String((err as Error).message) });
    } finally {
      client.release();
    }
  });

  app.delete("/api/leadgrid/sales-leadership/contests/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    try {
      const r = await pool.query(
        `UPDATE sales_contests
            SET status = 'archived', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2
          RETURNING id`,
        [id, orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, id });
    } catch (err) {
      console.error("[sales-leadership] contest DELETE failed:", err);
      return res.status(500).json({ error: "contest_delete_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // AWARDS (fulfillment)
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/sales-leadership/awards", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const statusFilter = readString(req.query.status);
    const orgView = readString(req.query.org) === "true";

    if (orgView && !isAdminLikeRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }

    const wheres: string[] = [];
    const vals: unknown[] = [];
    if (orgView) {
      vals.push(orgId);
      wheres.push(`c.organization_id = $${vals.length}`);
    } else {
      vals.push(session.userId);
      wheres.push(`a.winner_user_id = $${vals.length}`);
    }
    if (statusFilter && VALID_AWARD_STATUS.has(statusFilter)) {
      vals.push(statusFilter);
      wheres.push(`a.status = $${vals.length}`);
    }
    try {
      const r = await pool.query(
        `SELECT a.id, a.contest_id, a.prize_id, a.winner_user_id, a.rank,
                a.status, a.product_title, a.product_category, a.fulfillment_type,
                a.tracking_number, a.ordered_at, a.shipped_at, a.received_at,
                a.shipping_address, a.notes, a.created_at, a.updated_at,
                c.name AS contest_name
           FROM sales_prize_awards a
           LEFT JOIN sales_contests c ON c.id = a.contest_id
          WHERE ${wheres.join(" AND ")}
          ORDER BY a.created_at DESC
          LIMIT 200`,
        vals,
      );
      return res.json({ awards: r.rows });
    } catch (err) {
      console.error("[sales-leadership] awards GET failed:", err);
      return res.status(500).json({ error: "awards_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/sales-leadership/awards/:id/advance", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const id = readString(req.params.id);
    const body = (req.body ?? {}) as { tracking_number?: string; notes?: string; target_status?: string };

    try {
      const currentRes = await pool.query(
        `SELECT a.id, a.status, a.winner_user_id, a.product_title, a.fulfillment_type,
                c.name AS contest_name, c.organization_id
           FROM sales_prize_awards a
           LEFT JOIN sales_contests c ON c.id = a.contest_id
          WHERE a.id = $1
          LIMIT 1`,
        [id],
      );
      if (currentRes.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const current = currentRes.rows[0] as Record<string, unknown>;

      // Tilgang: org-admin ELLER vinneren selv (for awaiting_address-flyt).
      const isManager = isAdminLikeRole(session.role) && String(current.organization_id) === orgId;
      const isWinner = String(current.winner_user_id) === session.userId;
      if (!isManager && !isWinner) {
        return res.status(403).json({ error: "forbidden" });
      }

      const currentStatus = String(current.status);
      const targetExplicit = readString(body.target_status);
      let nextStatus: string;
      if (targetExplicit) {
        if (!VALID_AWARD_STATUS.has(targetExplicit)) {
          return res.status(400).json({ error: "invalid_target_status" });
        }
        nextStatus = targetExplicit;
      } else {
        const idx = AWARD_STATUS_ORDER.indexOf(currentStatus);
        if (idx === -1 || idx >= AWARD_STATUS_ORDER.length - 1) {
          return res.status(409).json({ error: "cannot_advance_from_current_status", current: currentStatus });
        }
        nextStatus = AWARD_STATUS_ORDER[idx + 1];
      }

      // Vinneren har kun lov å bekrefte mottak (received) — alt annet er manager.
      if (!isManager && nextStatus !== "received") {
        return res.status(403).json({ error: "winner_can_only_confirm_received" });
      }

      const sets: string[] = [`status = $1`, `updated_at = NOW()`];
      const vals: unknown[] = [nextStatus];
      if (body.tracking_number) {
        vals.push(String(body.tracking_number));
        sets.push(`tracking_number = $${vals.length}`);
      }
      if (body.notes) {
        vals.push(String(body.notes));
        sets.push(`notes = $${vals.length}`);
      }
      if (nextStatus === "ordered") sets.push(`ordered_at = COALESCE(ordered_at, NOW())`);
      if (nextStatus === "shipped") sets.push(`shipped_at = COALESCE(shipped_at, NOW())`);
      if (nextStatus === "received") sets.push(`received_at = COALESCE(received_at, NOW())`);
      vals.push(id);
      const updateRes = await pool.query(
        `UPDATE sales_prize_awards
            SET ${sets.join(", ")}
          WHERE id = $${vals.length}
          RETURNING id, status, tracking_number, ordered_at, shipped_at, received_at`,
        vals,
      );
      const updated = updateRes.rows[0] as Record<string, unknown>;

      // Notify
      await notifyAwardStatusChange(pool, {
        id,
        winner_user_id: String(current.winner_user_id),
        product_title: String(current.product_title),
        contest_name: typeof current.contest_name === "string" ? current.contest_name : null,
        status: String(updated.status),
      }, {
        trackingNumber: body.tracking_number,
        notes: body.notes,
      });

      return res.json(updated);
    } catch (err) {
      console.error("[sales-leadership] award advance failed:", err);
      return res.status(500).json({ error: "award_advance_failed", detail: String((err as Error).message) });
    }
  });

  app.post("/api/leadgrid/sales-leadership/awards/:id/shipping-address", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    const body = (req.body ?? {}) as {
      name?: string;
      street?: string;
      postal?: string;
      city?: string;
      country?: string;
    };
    const name = readString(body.name);
    const street = readString(body.street);
    const postal = readString(body.postal);
    const city = readString(body.city);
    const country = readString(body.country, "NO");
    if (!name || !street || !postal || !city) {
      return res.status(400).json({ error: "name, street, postal and city are required" });
    }
    try {
      const currentRes = await pool.query(
        `SELECT a.id, a.status, a.winner_user_id, a.product_title, a.fulfillment_type,
                c.name AS contest_name
           FROM sales_prize_awards a
           LEFT JOIN sales_contests c ON c.id = a.contest_id
          WHERE a.id = $1
          LIMIT 1`,
        [id],
      );
      if (currentRes.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const current = currentRes.rows[0] as Record<string, unknown>;
      if (String(current.winner_user_id) !== session.userId) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (String(current.fulfillment_type) !== "physical_shipping") {
        return res.status(400).json({ error: "fulfillment_type_does_not_require_address" });
      }

      const address = { name, street, postal, city, country };
      // Når adressen er oppgitt, flytt fra awaiting_address → pending (klar for manager til å bestille)
      const nextStatus = current.status === "awaiting_address" ? "pending" : String(current.status);
      const r = await pool.query(
        `UPDATE sales_prize_awards
            SET shipping_address = $1::jsonb,
                status = $2,
                updated_at = NOW()
          WHERE id = $3
          RETURNING id, status, shipping_address`,
        [JSON.stringify(address), nextStatus, id],
      );

      if (nextStatus !== current.status) {
        await notifyAwardStatusChange(pool, {
          id,
          winner_user_id: String(current.winner_user_id),
          product_title: String(current.product_title),
          contest_name: typeof current.contest_name === "string" ? current.contest_name : null,
          status: nextStatus,
        });
      }
      return res.json(r.rows[0]);
    } catch (err) {
      console.error("[sales-leadership] award shipping-address failed:", err);
      return res.status(500).json({ error: "shipping_address_failed", detail: String((err as Error).message) });
    }
  });
}
