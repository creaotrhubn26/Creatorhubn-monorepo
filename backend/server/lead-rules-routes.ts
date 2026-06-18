/**
 * lead-rules-routes.ts
 *
 * CRUD + manuell test-evaluering for automation-regler (mig 0305 +
 * lead-rules-engine.ts).
 *
 *   GET    /rules                    (marketing.rules.view)
 *   POST   /rules                    (marketing.rules.edit)
 *   PATCH  /rules/:id                (marketing.rules.edit)
 *   DELETE /rules/:id                (marketing.rules.edit)
 *   GET    /rules/:id/runs           (marketing.rules.view) — audit-historikk
 *   POST   /rules/:id/test           (marketing.rules.view) — tørr-evaluer
 *                                    mot én lead (returnerer match/unmatch)
 *   POST   /leads/:id/evaluate-rules (marketing.rules.view) — kjør alle
 *                                    aktive regler mot én lead
 *
 *   POST   /rules/seed-defaults      (marketing.rules.edit) — seede
 *                                    Daniels 4 eksempelregler for en org
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { evaluateCondition, evaluateRulesForLead } from "./lead-rules-engine.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const RULE_SELECT = `
  id::text, organization_id::text, name, description, trigger_on,
  condition, actions, priority, is_active, is_system, throttle_minutes,
  created_at::text, updated_at::text
`;

function getUserId(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return activeSessions.get(auth.slice(7))?.userId ?? null;
}

const DEFAULT_RULES = [
  {
    name: "Interessert lead uten follow-up",
    description: "Når lead-status er 'interested' og det ikke er satt en oppfølgings-dato, be selger sette en.",
    trigger_on: ["lead_update", "status_change", "cron_hourly"],
    condition: {
      all: [
        { field: "lead_status", op: "eq", value: "interested" },
        { field: "next_follow_up_at", op: "is_null" },
      ],
    },
    actions: [
      {
        type: "prompt_user",
        params: { message: "Lead er interessert — sett en oppfølgings-dato." },
      },
    ],
    priority: 10,
    throttle_minutes: 360,
  },
  {
    name: "Høy score + ikke besøkt = høy prioritet",
    description: "AI-score > 80 og lead ikke har vært besøkt → marker som høy prioritet.",
    trigger_on: ["lead_update", "score_change"],
    condition: {
      all: [
        { field: "ai_opportunity_score", op: "gt", value: 80 },
        { field: "lead_status", op: "eq", value: "unvisited" },
      ],
    },
    actions: [
      { type: "set_priority", params: { level: "high" } },
      {
        type: "prompt_user",
        params: { message: "Høyt potensial — prioritér å oppsøke." },
      },
    ],
    priority: 20,
    throttle_minutes: 1440,
  },
  {
    name: "Forslag sendt, 5 dager stille",
    description: "Tilbud sendt for 5 dager siden uten respons → lag oppfølgings-påminnelse.",
    trigger_on: ["cron_daily"],
    condition: {
      all: [
        { field: "lead_status", op: "eq", value: "proposal_sent" },
        { field: "days_since_status_change", op: "gte", value: 5 },
      ],
    },
    actions: [
      {
        type: "create_followup_reminder",
        params: { days: 1, next_action: "Ringe og høre om de fikk lest tilbudet" },
      },
    ],
    priority: 30,
    throttle_minutes: 4320,
  },
  {
    name: "Ikke kontakt — slå av outreach",
    description: "Lead-status = 'do_not_contact' → deaktiver alle ads/SMS/e-post-handlinger.",
    trigger_on: ["lead_update", "status_change"],
    condition: { field: "lead_status", op: "eq", value: "do_not_contact" },
    actions: [
      { type: "disable_outreach", params: { reason: "lead_status=do_not_contact" } },
    ],
    priority: 5,
    throttle_minutes: 0,
  },
];

export function registerLeadRulesRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";

  // GET /rules
  app.get(
    `${ROOT}/rules`,
    requireLeadMapPermission("marketing.rules.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      try {
        const r = orgId
          ? await pool.query(
              `SELECT ${RULE_SELECT}
                 FROM lead_automation_rules
                WHERE organization_id = $1
                ORDER BY priority ASC, name ASC`,
              [orgId],
            )
          : await pool.query(
              `SELECT ${RULE_SELECT}
                 FROM lead_automation_rules ORDER BY priority ASC LIMIT 100`,
            );
        return res.json({ rules: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "rules_list_failed", detail: String(err) });
      }
    },
  );

  // POST /rules
  app.post(
    `${ROOT}/rules`,
    requireLeadMapPermission("marketing.rules.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = req.body as {
        organization_id?: string;
        name?: string;
        description?: string;
        trigger_on?: string[];
        condition?: unknown;
        actions?: unknown[];
        priority?: number;
        throttle_minutes?: number;
      };
      if (!b.organization_id) return res.status(400).json({ error: "organization_id påkrevd" });
      if (!b.name) return res.status(400).json({ error: "name påkrevd" });
      if (!b.condition) return res.status(400).json({ error: "condition påkrevd" });
      if (!Array.isArray(b.actions) || b.actions.length === 0) {
        return res.status(400).json({ error: "actions må være ikke-tom liste" });
      }
      try {
        const r = await pool.query(
          `INSERT INTO lead_automation_rules
             (organization_id, name, description, trigger_on,
              condition, actions, priority, throttle_minutes, created_by)
           VALUES ($1, $2, $3, $4::text[], $5::jsonb, $6::jsonb, $7, $8, $9)
           RETURNING ${RULE_SELECT}`,
          [
            b.organization_id, b.name.slice(0, 160),
            b.description ?? null,
            b.trigger_on ?? ["lead_update"],
            JSON.stringify(b.condition),
            JSON.stringify(b.actions),
            b.priority ?? 100,
            b.throttle_minutes ?? 60,
            userId,
          ],
        );
        return res.status(201).json({ rule: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "rule_create_failed", detail: String(err) });
      }
    },
  );

  // PATCH /rules/:id
  app.patch(
    `${ROOT}/rules/:id`,
    requireLeadMapPermission("marketing.rules.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const b = req.body as Record<string, unknown>;
      const updates: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown, cast?: string) => {
        params.push(val); updates.push(`${col} = $${params.length}${cast ?? ""}`);
      };
      if (typeof b.name === "string") set("name", b.name.slice(0, 160));
      if (b.description !== undefined) set("description", b.description);
      if (Array.isArray(b.trigger_on)) set("trigger_on", b.trigger_on, "::text[]");
      if (b.condition !== undefined) set("condition", JSON.stringify(b.condition), "::jsonb");
      if (Array.isArray(b.actions)) set("actions", JSON.stringify(b.actions), "::jsonb");
      if (typeof b.priority === "number") set("priority", b.priority);
      if (typeof b.is_active === "boolean") set("is_active", b.is_active);
      if (typeof b.throttle_minutes === "number") set("throttle_minutes", b.throttle_minutes);
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      updates.push("updated_at = now()");
      params.push(req.params.id);
      try {
        const r = await pool.query(
          `UPDATE lead_automation_rules SET ${updates.join(", ")}
            WHERE id = $${params.length} AND is_system = false
            RETURNING ${RULE_SELECT}`,
          params,
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "rule_not_found_or_system" });
        return res.json({ rule: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "rule_update_failed", detail: String(err) });
      }
    },
  );

  // DELETE /rules/:id
  app.delete(
    `${ROOT}/rules/:id`,
    requireLeadMapPermission("marketing.rules.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `DELETE FROM lead_automation_rules WHERE id = $1 AND is_system = false RETURNING id`,
          [req.params.id],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "rule_not_found_or_system" });
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "rule_delete_failed", detail: String(err) });
      }
    },
  );

  // GET /rules/:id/runs
  app.get(
    `${ROOT}/rules/:id/runs`,
    requireLeadMapPermission("marketing.rules.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `SELECT id::text, customer_id, triggered_by_event, result,
                  actions_executed, error_message, duration_ms, ran_at::text
             FROM lead_automation_runs
            WHERE rule_id = $1
            ORDER BY ran_at DESC LIMIT 100`,
          [req.params.id],
        );
        return res.json({ runs: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "runs_failed", detail: String(err) });
      }
    },
  );

  // POST /rules/:id/test — tørr-evaluering mot én lead
  app.post(
    `${ROOT}/rules/:id/test`,
    requireLeadMapPermission("marketing.rules.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const customerId = typeof req.body?.customer_id === "string"
        ? req.body.customer_id : null;
      if (!customerId) return res.status(400).json({ error: "customer_id påkrevd" });
      try {
        const ruleRes = await pool.query<{ condition: unknown }>(
          `SELECT condition FROM lead_automation_rules WHERE id = $1`,
          [req.params.id],
        );
        if (ruleRes.rows.length === 0) return res.status(404).json({ error: "rule_not_found" });

        const snapRes = await pool.query<{ row: unknown }>(
          `SELECT to_jsonb(c) AS row
             FROM (
               SELECT id::text, status, lead_status, ai_opportunity_score,
                      next_follow_up_at, last_visit_at, last_contacted_at,
                      owner_user_id, assigned_user_id, custom_fields,
                      EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0
                        AS days_since_status_change,
                      EXTRACT(EPOCH FROM (now() - last_visit_at)) / 86400.0
                        AS days_since_last_visit,
                      EXTRACT(EPOCH FROM (now() - last_contacted_at)) / 86400.0
                        AS days_since_last_contact,
                      (next_follow_up_at IS NOT NULL) AS has_follow_up
                 FROM crm_customers
                WHERE id::text = $1 LIMIT 1
             ) c`,
          [customerId],
        );
        if (snapRes.rows.length === 0) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        const snap = snapRes.rows[0].row as Parameters<typeof evaluateCondition>[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = evaluateCondition(snap, ruleRes.rows[0].condition as any);
        return res.json({ matched, lead_snapshot: snap });
      } catch (err) {
        return res.status(500).json({ error: "test_failed", detail: String(err) });
      }
    },
  );

  // POST /leads/:id/evaluate-rules
  app.post(
    `${ROOT}/leads/:id/evaluate-rules`,
    requireLeadMapPermission("marketing.rules.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const event = typeof req.body?.event === "string"
        ? req.body.event : "lead_update";
      try {
        const result = await evaluateRulesForLead(
          pool, req.params.id,
          event as Parameters<typeof evaluateRulesForLead>[2],
        );
        return res.json(result);
      } catch (err) {
        return res.status(500).json({ error: "evaluate_failed", detail: String(err) });
      }
    },
  );

  // POST /rules/seed-defaults
  app.post(
    `${ROOT}/rules/seed-defaults`,
    requireLeadMapPermission("marketing.rules.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = typeof req.body?.organization_id === "string"
        ? req.body.organization_id : null;
      if (!orgId) return res.status(400).json({ error: "organization_id påkrevd" });
      try {
        const created: string[] = [];
        for (const r of DEFAULT_RULES) {
          const ins = await pool.query<{ id: string }>(
            `INSERT INTO lead_automation_rules
               (organization_id, name, description, trigger_on,
                condition, actions, priority, throttle_minutes,
                is_system, created_by)
             VALUES ($1, $2, $3, $4::text[], $5::jsonb, $6::jsonb, $7, $8, false, $9)
             ON CONFLICT (organization_id, name) DO NOTHING
             RETURNING id::text`,
            [
              orgId, r.name, r.description, r.trigger_on,
              JSON.stringify(r.condition), JSON.stringify(r.actions),
              r.priority, r.throttle_minutes, userId,
            ],
          );
          if (ins.rows[0]) created.push(ins.rows[0].id);
        }
        return res.json({ created_count: created.length, ids: created });
      } catch (err) {
        return res.status(500).json({ error: "seed_failed", detail: String(err) });
      }
    },
  );
}
