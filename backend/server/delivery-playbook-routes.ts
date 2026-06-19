/**
 * delivery-playbook-routes.ts
 *
 * Markedsføreren's oppsett-system. Ett trykk fra "klient ønsker dette"
 * til "klar deliverable med steg-for-steg-plan".
 *
 *   GET    /playbooks                          (marketing.playbooks.view)
 *                                              Liste alle (system + org-spesifikke)
 *
 *   GET    /playbooks/by-need/:need_type       (marketing.playbooks.view)
 *                                              Returnerer playbook for én need-type
 *                                              (org-egen hvis finnes, else system)
 *
 *   POST   /focus-requests/:id/start-delivery  (marketing.deliveries.execute)
 *                                              Skaper project_deliverables-rad
 *                                              fra matchende playbook. Markerer
 *                                              focus_request som in_progress.
 *
 *   GET    /focus-requests                     (marketing.deliveries.execute)
 *                                              Innboks: alle pending+ack
 *                                              focus-requests for min org.
 *
 *   PATCH  /focus-requests/:id                 (marketing.deliveries.execute)
 *                                              Endre status / assigned_user
 *
 *   GET    /deliverables/:id                   (marketing.deliveries.execute)
 *                                              Returnerer playbook-data +
 *                                              current progress_data
 *
 *   PATCH  /deliverables/:id/step              (marketing.deliveries.execute)
 *                                              Marker steg-status (done/blocked)
 *                                              { step_number, status, notes? }
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { notifyClient } from "./client-notification-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface PlaybookStep {
  step: number;
  title: string;
  instructions: string;
  estimated_minutes: number;
  needs_client_input: boolean;
  action_type: string;
}

interface PlaybookRequirement {
  title: string;
  description: string;
  type: string;
}

function getUserId(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return activeSessions.get(auth.slice(7))?.userId ?? null;
}

/** Initial progress_data fra playbook-steps. Hvert steg er 'pending'. */
function buildInitialProgress(
  steps: PlaybookStep[], requirements: PlaybookRequirement[],
): Record<string, unknown> {
  return {
    steps: steps.map((s) => ({
      step: s.step,
      status: "pending",
      completed_at: null,
      completed_by: null,
      notes: null,
    })),
    requirements: requirements.map((r) => ({
      title: r.title,
      received: false,
      received_at: null,
    })),
  };
}

const PLAYBOOK_SELECT = `
  id::text, organization_id::text, need_type, title, description, category,
  requires_from_client, steps, verification, estimated_total_minutes,
  difficulty, is_active, is_system,
  created_at::text, updated_at::text
`;

export function registerDeliveryPlaybookRoutes({
  app, pool, activeSessions,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map";

  // ── GET /playbooks ────────────────────────────────────────────
  app.get(
    `${ROOT}/playbooks`,
    requireLeadMapPermission("marketing.playbooks.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      try {
        // Org-spesifikke overstyrer system-default for samme need_type
        const r = orgId
          ? await pool.query(
              `SELECT ${PLAYBOOK_SELECT}
                 FROM delivery_playbooks
                WHERE is_active = true
                  AND (organization_id = $1 OR organization_id IS NULL)
                ORDER BY
                  CASE WHEN organization_id = $1 THEN 0 ELSE 1 END,
                  need_type`,
              [orgId],
            )
          : await pool.query(
              `SELECT ${PLAYBOOK_SELECT}
                 FROM delivery_playbooks WHERE is_active = true
                ORDER BY is_system DESC, need_type`,
            );
        return res.json({ playbooks: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ── GET /playbooks/by-need/:need_type ─────────────────────────
  app.get(
    `${ROOT}/playbooks/by-need/:need_type`,
    requireLeadMapPermission("marketing.playbooks.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      try {
        // Foretrukket: org-egen. Fallback: system-default.
        const r = await pool.query(
          `SELECT ${PLAYBOOK_SELECT}
             FROM delivery_playbooks
            WHERE need_type = $1 AND is_active = true
              AND ($2::uuid IS NULL OR organization_id = $2 OR organization_id IS NULL)
            ORDER BY
              CASE WHEN organization_id = $2 THEN 0 ELSE 1 END
            LIMIT 1`,
          [req.params.need_type, orgId],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "no_playbook" });
        return res.json({ playbook: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "find_failed", detail: String(err) });
      }
    },
  );

  // ── GET /focus-requests ───────────────────────────────────────
  app.get(
    `${ROOT}/focus-requests`,
    requireLeadMapPermission("marketing.deliveries.execute", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      const statusFilter = typeof req.query.status === "string"
        ? req.query.status : null;

      const conditions: string[] = ["1=1"];
      const params: unknown[] = [];
      if (orgId) {
        params.push(orgId);
        conditions.push(`cfr.organization_id = $${params.length}`);
      }
      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`cfr.status = $${params.length}`);
      }

      try {
        const r = await pool.query(
          `SELECT cfr.id::text, cfr.project_id, cfr.customer_id, cfr.need_type,
                  cfr.client_note, cfr.status, cfr.requested_at::text,
                  cfr.assigned_user_id,
                  cc.name AS customer_name, cc.logo_url AS customer_logo,
                  cc.website_url, cc.lead_category,
                  cp.name AS project_name
             FROM client_focus_requests cfr
             LEFT JOIN crm_customers cc ON cc.id::text = cfr.customer_id
             LEFT JOIN casting_projects cp ON cp.id = cfr.project_id
            WHERE ${conditions.join(" AND ")}
            ORDER BY
              CASE cfr.status
                WHEN 'pending' THEN 1
                WHEN 'acknowledged' THEN 2
                WHEN 'in_progress' THEN 3
                WHEN 'completed' THEN 4
                ELSE 5 END,
              cfr.requested_at DESC
            LIMIT 200`,
          params,
        );
        return res.json({ focus_requests: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "inbox_failed", detail: String(err) });
      }
    },
  );

  // ── POST /focus-requests/:id/start-delivery ──────────────────
  app.post(
    `${ROOT}/focus-requests/:id/start-delivery`,
    requireLeadMapPermission("marketing.deliveries.execute", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });

      try {
        const focusRes = await pool.query<{
          id: string; organization_id: string; project_id: string;
          customer_id: string; need_type: string; status: string;
          client_note: string | null;
        }>(
          `SELECT id::text, organization_id::text, project_id, customer_id,
                  need_type, status, client_note
             FROM client_focus_requests WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (focusRes.rows.length === 0) {
          return res.status(404).json({ error: "focus_request_not_found" });
        }
        const focus = focusRes.rows[0];

        // Finn playbook for denne need_type
        const pbRes = await pool.query<{
          id: string; title: string; description: string | null;
          steps: PlaybookStep[]; requires_from_client: PlaybookRequirement[];
          estimated_total_minutes: number | null;
        }>(
          `SELECT id::text, title, description, steps, requires_from_client,
                  estimated_total_minutes
             FROM delivery_playbooks
            WHERE need_type = $1 AND is_active = true
              AND (organization_id = $2 OR organization_id IS NULL)
            ORDER BY CASE WHEN organization_id = $2 THEN 0 ELSE 1 END
            LIMIT 1`,
          [focus.need_type, focus.organization_id],
        );
        if (pbRes.rows.length === 0) {
          return res.status(400).json({ error: "no_playbook_for_need" });
        }
        const playbook = pbRes.rows[0];
        const progress = buildInitialProgress(
          playbook.steps, playbook.requires_from_client,
        );

        // Skap deliverable
        const delRes = await pool.query<{ id: string }>(
          `INSERT INTO project_deliverables
             (project_id, organization_id, title, description, status,
              related_need_type, playbook_id, focus_request_id,
              progress_data, client_summary, assigned_user_id,
              created_by, started_at, target_date)
           VALUES ($1, $2, $3, $4, 'in_progress',
                   $5, $6, $7, $8::jsonb, $9, $10, $11, now(),
                   (now() + INTERVAL '14 days')::date)
           RETURNING id::text`,
          [
            focus.project_id, focus.organization_id,
            playbook.title, playbook.description, focus.need_type,
            playbook.id, focus.id,
            JSON.stringify(progress),
            `Vi har satt i gang ${playbook.title.toLowerCase()}. Du ser fremgang her etterhvert som hvert steg ferdigstilles.`,
            userId, userId,
          ],
        );

        // Oppdater focus-request til in_progress + assignment
        await pool.query(
          `UPDATE client_focus_requests
              SET status = 'in_progress',
                  acknowledged_at = COALESCE(acknowledged_at, now()),
                  assigned_user_id = COALESCE(assigned_user_id, $2)
            WHERE id = $1`,
          [focus.id, userId],
        );

        return res.status(201).json({
          deliverable_id: delRes.rows[0].id,
          playbook_id: playbook.id,
          steps_count: playbook.steps.length,
          requirements_count: playbook.requires_from_client.length,
          message: `Deliverable opprettet: ${playbook.title}`,
        });
      } catch (err) {
        return res.status(500).json({
          error: "start_failed", detail: String(err).slice(0, 500),
        });
      }
    },
  );

  // ── PATCH /focus-requests/:id ─────────────────────────────────
  app.patch(
    `${ROOT}/focus-requests/:id`,
    requireLeadMapPermission("marketing.deliveries.execute", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const b = req.body as { status?: string; assigned_user_id?: string };
      const updates: string[] = [];
      const params: unknown[] = [];
      if (b.status && ["pending","acknowledged","in_progress","completed","declined"].includes(b.status)) {
        params.push(b.status); updates.push(`status = $${params.length}`);
        if (b.status === "acknowledged") updates.push("acknowledged_at = COALESCE(acknowledged_at, now())");
        if (b.status === "completed") updates.push("completed_at = COALESCE(completed_at, now())");
      }
      if (b.assigned_user_id !== undefined) {
        params.push(b.assigned_user_id);
        updates.push(`assigned_user_id = $${params.length}`);
      }
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      params.push(req.params.id);
      try {
        const r = await pool.query(
          `UPDATE client_focus_requests SET ${updates.join(", ")}
            WHERE id = $${params.length}
            RETURNING id::text, status, assigned_user_id`,
          params,
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ focus_request: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ── GET /deliverables/:id ─────────────────────────────────────
  app.get(
    `${ROOT}/deliverables/:id`,
    requireLeadMapPermission("marketing.deliveries.execute", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `SELECT d.id::text, d.project_id, d.organization_id::text,
                  d.title, d.description, d.status, d.client_summary,
                  d.related_need_type, d.playbook_id::text,
                  d.progress_data, d.target_date::text,
                  d.started_at::text, d.completed_at::text,
                  d.assigned_user_id,
                  pb.title AS playbook_title, pb.steps AS playbook_steps,
                  pb.requires_from_client AS playbook_requirements,
                  pb.verification AS playbook_verification,
                  pb.estimated_total_minutes AS playbook_minutes,
                  pb.difficulty AS playbook_difficulty
             FROM project_deliverables d
             LEFT JOIN delivery_playbooks pb ON pb.id = d.playbook_id
            WHERE d.id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ deliverable: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "load_failed", detail: String(err) });
      }
    },
  );

  // ── PATCH /deliverables/:id/step ──────────────────────────────
  app.patch(
    `${ROOT}/deliverables/:id/step`,
    requireLeadMapPermission("marketing.deliveries.execute", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = req.body as {
        step_number?: number;
        status?: string;        // 'pending' | 'in_progress' | 'done' | 'blocked'
        notes?: string;
        requirement_index?: number;
        received?: boolean;
      };

      try {
        const r = await pool.query<{ progress_data: Record<string, unknown> }>(
          `SELECT progress_data FROM project_deliverables WHERE id = $1`,
          [req.params.id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const progress = r.rows[0].progress_data as {
          steps?: Array<Record<string, unknown>>;
          requirements?: Array<Record<string, unknown>>;
        };

        // Endre step
        if (typeof b.step_number === "number" && b.status) {
          const steps = progress.steps ?? [];
          const idx = steps.findIndex((s) => s.step === b.step_number);
          if (idx >= 0) {
            steps[idx].status = b.status;
            steps[idx].notes = b.notes ?? steps[idx].notes;
            if (b.status === "done") {
              steps[idx].completed_at = new Date().toISOString();
              steps[idx].completed_by = userId;
            }
          }
        }
        // Endre requirement-checkbox
        if (typeof b.requirement_index === "number" && typeof b.received === "boolean") {
          const reqs = progress.requirements ?? [];
          if (reqs[b.requirement_index]) {
            reqs[b.requirement_index].received = b.received;
            reqs[b.requirement_index].received_at = b.received ? new Date().toISOString() : null;
          }
        }

        // Hvis ALLE steg er done → marker deliverable som completed
        const allDone = (progress.steps ?? []).every((s) => s.status === "done");

        const upd = await pool.query(
          `UPDATE project_deliverables
              SET progress_data = $2::jsonb,
                  status = CASE WHEN $3::boolean THEN 'completed' ELSE status END,
                  completed_at = CASE WHEN $3::boolean THEN COALESCE(completed_at, now()) ELSE completed_at END,
                  updated_at = now()
            WHERE id = $1
            RETURNING id::text, status, progress_data, completed_at::text`,
          [req.params.id, JSON.stringify(progress), allDone],
        );

        // Hvis completed → marker tilhørende focus_request som completed +
        //                  send klient-varsel (e-post/SMS/WhatsApp etter prefs)
        if (allDone) {
          await pool.query(
            `UPDATE client_focus_requests
                SET status = 'completed', completed_at = COALESCE(completed_at, now())
              WHERE id = (SELECT focus_request_id FROM project_deliverables WHERE id = $1)`,
            [req.params.id],
          );

          try {
            const dr = await pool.query<{
              customer_id: string | null; title: string;
              portal_token: string | null;
            }>(
              `SELECT pd.customer_id::text, pd.title,
                       (SELECT token FROM client_portal_tokens
                         WHERE customer_id = pd.customer_id
                           AND revoked_at IS NULL
                         ORDER BY created_at DESC LIMIT 1) AS portal_token
                  FROM project_deliverables pd WHERE pd.id = $1`,
              [req.params.id],
            );
            const row = dr.rows[0];
            if (row?.customer_id) {
              await notifyClient(pool, {
                customerId: row.customer_id,
                event: "deliverable_completed",
                deliverableTitle: row.title,
                portalToken: row.portal_token ?? undefined,
              });
            }
          } catch (e) {
            console.error("[delivery-playbook] notifyClient feilet", e);
          }
        }

        return res.json({ deliverable: upd.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "step_update_failed", detail: String(err) });
      }
    },
  );
}
