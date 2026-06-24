/**
 * leadgrid-webhook-rotation-routes.ts
 *
 * Webhook signing-secret-rotering m/ 7-dagers grace-period:
 *   POST /api/leadgrid/webhooks/:id/rotate-secret
 *   POST /api/leadgrid/cron/expire-old-webhook-secrets
 *
 * Bygger på mig 322 (signing_secret_old + signing_secret_rotated_at).
 *
 * Gated på intelligence.run_engine (krever produsent-/admin-rolle —
 * samme tillatelses-nivå som å forvalte API-credentials).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { randomBytes } from "crypto";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit = req.body?.organization_id ?? req.query?.organization_id;
  if (typeof explicit === "string") return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridWebhookRotationRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const perm = requireLeadMapPermission("intelligence.run_engine", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });

  // POST /api/leadgrid/webhooks/:id/rotate-secret
  // Genererer ny secret, lagrer både ny + gammel m/ grace-period 7 dager.
  // Mottaker må starte å verifisere ny secret innen 7 dager.
  app.post(
    "/api/leadgrid/webhooks/:id/rotate-secret",
    perm,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) { res.status(401).json({ error: "Innlogging kreves" }); return; }
      const newSecret = randomBytes(32).toString("hex");
      try {
        const r = await pool.query<{ id: string; signing_secret_old: string | null }>(
          `UPDATE leadgrid_webhook_subscriptions
              SET signing_secret = $1,
                  signing_secret_rotated_at = NOW(),
                  signing_secret_old = signing_secret
            WHERE id = $2::uuid
            RETURNING id::text, signing_secret_old`,
          [newSecret, req.params.id],
        );
        if (r.rowCount === 0) { res.status(404).json({ error: "ikke_funnet" }); return; }
        res.json({
          ok: true,
          new_secret: newSecret,
          grace_period_days: 7,
          message:
            "Oppdater consumer innen 7 dager. Gammel secret aksepteres parallelt.",
        });
      } catch (err) {
        res.status(500).json({ error: "rotate_failed", detail: String(err) });
      }
    },
  );

  // POST /api/leadgrid/cron/expire-old-webhook-secrets
  // Cron-rens: fjerner signing_secret_old etter 7 dager
  app.post(
    "/api/leadgrid/cron/expire-old-webhook-secrets",
    async (req: Request, res: Response) => {
      const expected = process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      const provided = req.headers["x-cron-trigger-token"];
      if (
        !expected ||
        typeof provided !== "string" ||
        provided.length !== expected.length
      ) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }
      const { timingSafeEqual } = await import("crypto");
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }
      try {
        const r = await pool.query(
          `UPDATE leadgrid_webhook_subscriptions
              SET signing_secret_old = NULL
            WHERE signing_secret_old IS NOT NULL
              AND signing_secret_rotated_at < NOW() - INTERVAL '7 days'`,
        );
        res.json({ ok: true, expired: r.rowCount ?? 0 });
      } catch (err) {
        res.status(500).json({ error: "expire_failed", detail: String(err) });
      }
    },
  );
}
