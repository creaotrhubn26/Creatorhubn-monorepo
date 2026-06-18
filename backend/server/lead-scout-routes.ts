/**
 * lead-scout-routes.ts
 *
 * Endepunkter for Lead Scout (crawl + Claude-needs-deteksjon):
 *
 *   POST /api/admin-room/lead-map/leads/:id/scout
 *        Kjør crawl + Claude → fyll needs/signals/scores for én lead.
 *        Gated på marketing.scout.run.
 *
 *   GET  /api/admin-room/lead-map/leads/:id/needs-overview
 *        Returnerer { needs[], signals[], scores[], composite, last_run }
 *        for visning på lead-detail / scout-tab.
 *        Gated på marketing.needs.view.
 *
 *   PATCH /api/admin-room/lead-map/needs/:id
 *        Endre priority/status (accept/dismiss/resolve).
 *        Gated på marketing.needs.edit.
 *
 *   POST  /api/admin-room/lead-map/leads/scout-bulk
 *        Kjør scout på flere leads i bakgrunn.
 *        Gated på marketing.scout.run.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { runScoutForLead } from "./lead-scout-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

export function registerLeadScoutRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";

  // ─── POST /leads/:id/scout ─────────────────────────────────────
  app.post(
    `${ROOT}/leads/:id/scout`,
    requireLeadMapPermission("marketing.scout.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      try {
        const leadRes = await pool.query<{
          id: string; name: string; website_url: string | null;
          lead_category: string | null;
        }>(
          `SELECT id::text, name, website_url, lead_category
             FROM crm_customers WHERE id::text = $1 LIMIT 1`,
          [req.params.id],
        );
        if (leadRes.rows.length === 0) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        const lead = leadRes.rows[0];
        const url = (typeof req.body?.url === "string" && req.body.url)
          || lead.website_url;
        if (!url) {
          return res.status(400).json({
            error: "mangler_website_url",
            hint: "Sett lead.website_url eller send 'url' i body",
          });
        }
        const result = await runScoutForLead(pool, {
          customerId: lead.id,
          leadName: lead.name,
          websiteUrl: url,
          industry: lead.lead_category,
          triggeredBy: session.userId,
        });
        return res.status(201).json(result);
      } catch (err) {
        return res.status(500).json({
          error: "scout_failed", detail: String(err).slice(0, 500),
        });
      }
    },
  );

  // ─── GET /leads/:id/needs-overview ─────────────────────────────
  app.get(
    `${ROOT}/leads/:id/needs-overview`,
    requireLeadMapPermission("marketing.needs.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const customerId = req.params.id;
        const [needsRes, signalsRes, scoresRes, lastRunRes] = await Promise.all([
          pool.query(
            `SELECT id::text, need_type, priority, claude_confidence,
                    evidence, evidence_url, status,
                    detected_at::text, updated_at::text
               FROM crm_customer_needs
              WHERE customer_id = $1
                AND status IN ('detected', 'accepted')
              ORDER BY priority DESC, claude_confidence DESC NULLS LAST`,
            [customerId],
          ),
          pool.query(
            `SELECT id::text, signal_type, polarity, raw_value, source,
                    detected_at::text
               FROM crm_customer_signals
              WHERE customer_id = $1
              ORDER BY polarity, signal_type`,
            [customerId],
          ),
          pool.query(
            `SELECT id::text, dimension, raw_value, normalized_0_100,
                    weight, contribution::text AS contribution,
                    source, computed_at::text
               FROM crm_customer_scores
              WHERE customer_id = $1
              ORDER BY contribution DESC NULLS LAST`,
            [customerId],
          ),
          pool.query<{
            id: string; status: string; started_at: string; finished_at: string | null;
            needs_found: number; signals_found: number; scores_computed: number;
            tech_fingerprint: unknown; error_message: string | null;
          }>(
            `SELECT id::text, status, started_at::text, finished_at::text,
                    needs_found, signals_found, scores_computed,
                    tech_fingerprint, error_message
               FROM crm_customer_scout_runs
              WHERE customer_id = $1
              ORDER BY started_at DESC LIMIT 1`,
            [customerId],
          ),
        ]);
        const composite = await pool.query<{ score: string }>(
          `SELECT COALESCE(ROUND(SUM(contribution) / NULLIF(SUM(weight), 0)), 0)::text AS score
             FROM crm_customer_scores WHERE customer_id = $1`,
          [customerId],
        );
        return res.json({
          needs: needsRes.rows,
          signals: signalsRes.rows,
          scores: scoresRes.rows,
          composite_score: Math.round(Number(composite.rows[0]?.score ?? 0)),
          last_run: lastRunRes.rows[0] ?? null,
        });
      } catch (err) {
        return res.status(500).json({
          error: "needs_overview_failed", detail: String(err).slice(0, 500),
        });
      }
    },
  );

  // ─── PATCH /needs/:id ──────────────────────────────────────────
  app.patch(
    `${ROOT}/needs/:id`,
    requireLeadMapPermission("marketing.needs.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (typeof req.body?.priority === "number") {
        const p = Math.max(1, Math.min(5, Math.round(req.body.priority)));
        params.push(p);
        updates.push(`priority = $${params.length}`);
      }
      if (typeof req.body?.status === "string"
          && ["detected", "accepted", "dismissed", "resolved"].includes(req.body.status)) {
        params.push(req.body.status);
        updates.push(`status = $${params.length}`);
        if (req.body.status === "resolved") updates.push("resolved_at = now()");
      }
      if (typeof req.body?.evidence === "string") {
        params.push(req.body.evidence.slice(0, 1000));
        updates.push(`evidence = $${params.length}`);
      }
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      updates.push("updated_at = now()");
      params.push(req.params.id);
      try {
        const r = await pool.query(
          `UPDATE crm_customer_needs SET ${updates.join(", ")}
            WHERE id = $${params.length}
            RETURNING id::text, customer_id, need_type, priority, status, updated_at::text`,
          params,
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "need_not_found" });
        return res.json({ need: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );
}
