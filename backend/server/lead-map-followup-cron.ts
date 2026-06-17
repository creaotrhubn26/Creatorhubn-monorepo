/**
 * lead-map-followup-cron.ts
 *
 * Cron som hver 15. min finner forfalt follow-up og trigger
 * `follow_up_due`-varsel for selger som eier lead-en.
 *
 * Trigget av GitHub Actions cron (cron-trigger-token-mønster):
 *   POST /api/admin-room/lead-map/cron/followup-notifications
 *
 * Throttle: 1 varsel per (recipient, lead) per dag — selv om follow-up
 * stadig er overdue. Telles via notification_events.
 *
 * Suppressed leads:
 *   - lead_status in (won, lost, do_not_contact)
 *   - assigned_user_id IS NULL (ingen å varsle)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { dispatchNotification } from "./lead-map-notification-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

export function registerLeadMapFollowupCronRoutes({ app, pool }: Deps): void {
  app.post(
    "/api/admin-room/lead-map/cron/followup-notifications",
    async (req: Request, res: Response) => {
      // Auth: GitHub-secret matchet mot MIGRATE_TRIGGER_TOKEN
      const triggerHeader = req.headers["x-cron-trigger-token"];
      const presented = typeof triggerHeader === "string"
        ? triggerHeader.trim()
        : "";
      const expected = (process.env.MIGRATE_TRIGGER_TOKEN ?? "").trim();
      if (!expected) {
        return res.status(503).json({ error: "cron_token_not_configured" });
      }
      if (presented !== expected) {
        return res.status(401).json({ error: "ugyldig_token" });
      }

      // Single-flight guard. This run sends APNs notifications, which are NOT
      // idempotent — an overlapping run (a slow run exceeding the 15-min cron
      // interval, or a manual workflow_dispatch / admin poll-now racing the
      // schedule) would double-notify. A pg advisory lock makes overlap a
      // no-op skip rather than a duplicate dispatch.
      const FOLLOWUP_CRON_LOCK = 910_001;
      const lk = await pool.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [FOLLOWUP_CRON_LOCK],
      );
      if (!lk.rows[0]?.locked) {
        return res.json({ ok: true, skipped: true, reason: "another_run_in_progress" });
      }

      try {
        const lockRes = await client.query<{ ok: boolean }>(
          `SELECT pg_try_advisory_lock(hashtext('lead-map-followup-cron')) AS ok`,
        );
        lockHeld = lockRes.rows[0]?.ok === true;
        if (!lockHeld) {
          return res.json({
            ok: true,
            notifications_sent: 0,
            skipped: "overlap_with_running_cron",
          });
        }
        // Finn forfalt follow-up som ikke har fått varsel siste 24t
        const r = await client.query<{
          lead_id: string;
          lead_name: string;
          address: string | null;
          assigned_user_id: string;
          next_follow_up_at: string;
          organization_id: string | null;
        }>(
          `SELECT c.id::text AS lead_id,
                  c.name AS lead_name,
                  c.address,
                  c.assigned_user_id,
                  c.next_follow_up_at::text,
                  cp.organization_id::text
             FROM crm_customers c
             LEFT JOIN casting_projects cp ON cp.id = c.project_id
            WHERE c.assigned_user_id IS NOT NULL
              AND c.next_follow_up_at IS NOT NULL
              AND c.next_follow_up_at < NOW()
              AND c.lead_status NOT IN ('won', 'lost', 'do_not_contact')
              AND NOT EXISTS (
                SELECT 1 FROM notification_events ne
                 WHERE ne.recipient_user_id = c.assigned_user_id
                   AND ne.lead_id = c.id
                   AND ne.event_type = 'follow_up_due'
                   AND ne.created_at > NOW() - INTERVAL '24 hours'
              )
            ORDER BY c.next_follow_up_at ASC
            LIMIT 500`,
        );

        const results: Array<{ leadId: string; userId: string }> = [];
        for (const row of r.rows) {
          const overdueMs = Date.now() - new Date(row.next_follow_up_at).getTime();
          const overdueDays = Math.floor(overdueMs / (24 * 60 * 60 * 1000));
          const timing = overdueDays === 0
            ? "i dag"
            : overdueDays === 1
              ? "1 dag siden"
              : `${overdueDays} dager siden`;
          const addr = row.address ? ` (${row.address})` : "";

          await dispatchNotification({
            pool,
            recipientUserId: row.assigned_user_id,
            organizationId: row.organization_id,
            eventType: "follow_up_due",
            title: `⏰ Forfalt follow-up: ${row.lead_name}`,
            body: `Du skulle fulgt opp ${row.lead_name}${addr} ${timing}. Ta kontakt nå?`,
            leadId: row.lead_id,
            triggeredByUserId: "system",
            deepLink: `https://theroleroom.com/admin-room?lead=${row.lead_id}`,
            meta: { overdue_days: overdueDays },
          });
          results.push({ leadId: row.lead_id, userId: row.assigned_user_id });
        }

        return res.json({
          ok: true,
          notifications_sent: results.length,
          results: results.slice(0, 50), // truncate for response-size
        });
      } catch (err) {
        return res.status(500).json({ error: "cron_failed", detail: String(err) });
      } finally {
        await pool
          .query("SELECT pg_advisory_unlock($1)", [FOLLOWUP_CRON_LOCK])
          .catch(() => undefined);
      }
    },
  );
}
