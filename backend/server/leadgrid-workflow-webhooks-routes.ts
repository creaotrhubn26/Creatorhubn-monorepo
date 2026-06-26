/**
 * leadgrid-workflow-webhooks-routes.ts
 *
 * CRUD for webhook-destinasjoner som workflows kan poste til
 * (post_to_webhook / trigger_zapier actions). Mig 0350.
 *
 * Mount-path: /api/leadgrid/workflows/webhooks/*
 *
 * Endepunkter:
 *   GET    /api/leadgrid/workflows/webhooks            — liste alle dest
 *   POST   /api/leadgrid/workflows/webhooks            — opprett
 *   PATCH  /api/leadgrid/workflows/webhooks/:id        — oppdater
 *   DELETE /api/leadgrid/workflows/webhooks/:id        — soft-delete
 *   POST   /api/leadgrid/workflows/webhooks/:id/test   — test-fyr dummy payload
 *
 * RBAC:
 *   workflows.view              — GET
 *   workflows.manage_webhooks   — POST/PATCH/DELETE/test
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { createHmac } from "node:crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function defaultOrgId(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.body as { organization_id?: string } | undefined)?.organization_id ??
    (req.query?.organization_id as string | undefined);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const id = req.params?.id;
  if (typeof id === "string" && id.length > 0) {
    try {
      const r = await pool.query<{ organization_id: string }>(
        `SELECT organization_id::text
           FROM leadgrid_workflow_webhook_destinations
          WHERE id = $1::uuid LIMIT 1`,
        [id],
      );
      if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
    } catch {
      /* ignore */
    }
  }

  return defaultOrgId(pool, userId);
}

const VALID_DESTINATION_TYPES = new Set([
  "generic",
  "zapier",
  "make",
  "n8n",
  "slack",
  "teams",
]);

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  has_secret: boolean;
  destination_type: string;
  is_active: boolean;
  created_by: string | null;
  last_invoked_at: string | null;
  last_status_code: number | null;
  invocation_count: number;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Record<string, unknown>): WebhookRow {
  return {
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    has_secret: Boolean(r.has_secret),
    destination_type: String(r.destination_type),
    is_active: Boolean(r.is_active),
    created_by: (r.created_by as string | null) ?? null,
    last_invoked_at: (r.last_invoked_at as string | null) ?? null,
    last_status_code: (r.last_status_code as number | null) ?? null,
    invocation_count: Number(r.invocation_count ?? 0),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export function registerLeadgridWorkflowWebhookRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permView = requireLeadMapPermission("workflows.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permManage = requireLeadMapPermission("workflows.manage_webhooks", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });

  // ── GET /api/leadgrid/workflows/webhooks ───────────────────────────
  app.get(
    "/api/leadgrid/workflows/webhooks",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.json({ destinations: [] });
        return;
      }
      try {
        const r = await pool.query(
          `SELECT id::text, name, url,
                  (hmac_secret IS NOT NULL) AS has_secret,
                  destination_type, is_active, created_by,
                  last_invoked_at, last_status_code, invocation_count,
                  created_at, updated_at
             FROM leadgrid_workflow_webhook_destinations
            WHERE organization_id = $1::uuid
            ORDER BY updated_at DESC
            LIMIT 200`,
          [orgId],
        );
        res.json({
          destinations: r.rows.map((row) => mapRow(row as Record<string, unknown>)),
          total: r.rowCount ?? 0,
        });
      } catch (err) {
        console.error("[wf-webhooks GET]", err);
        res.status(500).json({ error: "list_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/workflows/webhooks ──────────────────────────
  app.post(
    "/api/leadgrid/workflows/webhooks",
    permManage,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "ingen_org" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const hmacSecret =
        typeof body.hmac_secret === "string" && body.hmac_secret.length > 0
          ? body.hmac_secret
          : null;
      const destType =
        typeof body.destination_type === "string" ? body.destination_type : "generic";
      const isActive = typeof body.is_active === "boolean" ? body.is_active : true;

      if (!name) {
        res.status(400).json({ error: "name_required" });
        return;
      }
      if (!url || !/^https?:\/\//i.test(url)) {
        res.status(400).json({ error: "url_invalid" });
        return;
      }
      if (!VALID_DESTINATION_TYPES.has(destType)) {
        res.status(400).json({ error: "destination_type_invalid" });
        return;
      }

      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_workflow_webhook_destinations
             (organization_id, name, url, hmac_secret, destination_type,
              is_active, created_by)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
           RETURNING id::text`,
          [orgId, name, url, hmacSecret, destType, isActive, session.userId],
        );
        res.status(201).json({ id: r.rows[0]?.id, status: "created" });
      } catch (err) {
        console.error("[wf-webhooks POST]", err);
        res.status(500).json({ error: "create_failed" });
      }
    },
  );

  // ── PATCH /api/leadgrid/workflows/webhooks/:id ─────────────────────
  app.patch(
    "/api/leadgrid/workflows/webhooks/:id",
    permManage,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (typeof body.name === "string") {
        sets.push(`name = $${p++}`);
        vals.push(body.name.trim());
      }
      if (typeof body.url === "string") {
        if (!/^https?:\/\//i.test(body.url)) {
          res.status(400).json({ error: "url_invalid" });
          return;
        }
        sets.push(`url = $${p++}`);
        vals.push(body.url.trim());
      }
      if (body.hmac_secret !== undefined) {
        // Tom string betyr "fjern secret"
        const secret =
          typeof body.hmac_secret === "string" && body.hmac_secret.length > 0
            ? body.hmac_secret
            : null;
        sets.push(`hmac_secret = $${p++}`);
        vals.push(secret);
      }
      if (typeof body.destination_type === "string") {
        if (!VALID_DESTINATION_TYPES.has(body.destination_type)) {
          res.status(400).json({ error: "destination_type_invalid" });
          return;
        }
        sets.push(`destination_type = $${p++}`);
        vals.push(body.destination_type);
      }
      if (typeof body.is_active === "boolean") {
        sets.push(`is_active = $${p++}`);
        vals.push(body.is_active);
      }

      if (sets.length === 0) {
        res.status(400).json({ error: "no_fields_to_update" });
        return;
      }
      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id);

      try {
        await pool.query(
          `UPDATE leadgrid_workflow_webhook_destinations
              SET ${sets.join(", ")}
            WHERE id = $${p}::uuid`,
          vals,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[wf-webhooks PATCH]", err);
        res.status(500).json({ error: "update_failed" });
      }
    },
  );

  // ── DELETE /api/leadgrid/workflows/webhooks/:id ────────────────────
  // Soft-delete (is_active = false). Hard-delete bryter audit-historikk
  // i workflow_executions som kan referere til destinasjonen.
  app.delete(
    "/api/leadgrid/workflows/webhooks/:id",
    permManage,
    async (req: Request, res: Response): Promise<void> => {
      try {
        await pool.query(
          `UPDATE leadgrid_workflow_webhook_destinations
              SET is_active = FALSE, updated_at = NOW()
            WHERE id = $1::uuid`,
          [req.params.id],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[wf-webhooks DELETE]", err);
        res.status(500).json({ error: "delete_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/workflows/webhooks/:id/test ─────────────────
  // Fyr en test-payload mot destinasjonen UTEN å lage workflow_execution-rad.
  app.post(
    "/api/leadgrid/workflows/webhooks/:id/test",
    permManage,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const r = await pool.query<{
          url: string;
          hmac_secret: string | null;
          destination_type: string;
          is_active: boolean;
        }>(
          `SELECT url, hmac_secret, destination_type, is_active
             FROM leadgrid_workflow_webhook_destinations
            WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        const dest = r.rows[0];
        if (!dest) {
          res.status(404).json({ error: "destination_not_found" });
          return;
        }
        if (!dest.is_active) {
          res.status(400).json({ error: "destination_inactive" });
          return;
        }
        const payload = {
          test: true,
          destination_id: req.params.id,
          destination_type: dest.destination_type,
          triggered_at: new Date().toISOString(),
          message:
            "Dette er en test-payload fra Leadgrid Workflow webhook-konfigurasjon.",
        };
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "Leadgrid-Workflow-Test/0350",
        };
        if (dest.hmac_secret) {
          headers["X-Signature-Sha256"] = createHmac("sha256", dest.hmac_secret)
            .update(JSON.stringify(payload))
            .digest("hex");
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const response = await fetch(dest.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          await pool
            .query(
              `UPDATE leadgrid_workflow_webhook_destinations
                  SET last_invoked_at = NOW(),
                      last_status_code = $2,
                      updated_at = NOW()
                WHERE id = $1::uuid`,
              [req.params.id, response.status],
            )
            .catch(() => {
              /* swallow */
            });
          res.json({
            ok: response.ok,
            http_status: response.status,
            payload,
          });
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        console.error("[wf-webhooks test]", msg);
        res.status(500).json({ error: "test_failed", detail: msg.slice(0, 200) });
      }
    },
  );
}
