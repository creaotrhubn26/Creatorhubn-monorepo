/**
 * lead-acceptance-routes.ts
 *
 * Super-admin / markedssjef-flow for å håndtere innkommende leads med
 * ferdig auto-research:
 *
 *   GET    /api/superadmin/leads/inbox             → nye leads m/ Claude-score
 *   GET    /api/superadmin/leads/:id/research      → full research-data
 *   POST   /api/superadmin/leads/:id/accept-as-project → konverter til prosjekt
 *   POST   /api/superadmin/leads/:id/reject        → mark som irrelevant
 *   POST   /api/superadmin/leads/:id/retry-research → re-trigg auto-research
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { triggerAutoResearchAsync } from "./lead-auto-research-service.js";
import { notifyClient } from "./client-notification-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function requireSuperAdminOrMarkedssjef(
  pool: Pool, sessions: Map<string, SessionData>,
  req: Request, res: Response,
): Promise<SessionData | null> {
  const s = getSession(req, sessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`, [s.userId],
  );
  if (!["super_admin", "markedssjef", "admin"].includes(r.rows[0]?.role ?? "")) {
    res.status(403).json({ error: "Krever super-admin eller markedssjef" });
    return null;
  }
  return s;
}

export function registerLeadAcceptanceRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // INBOX — leads klar for behandling
  // ============================================================
  app.get("/api/superadmin/leads/inbox", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;

    const r = await pool.query(
      `SELECT l.id::text, l.agency_name, l.contact_name, l.email, l.phone,
              l.org_number, l.website, l.team_size, l.use_case, l.message,
              l.source, l.score_tier, l.created_at::text,
              l.status, l.consent_research_given,
              j.status AS research_status,
              j.claude_summary, j.claude_temperature, j.claude_talking_points,
              j.claude_next_action, j.brreg_data, j.website_scrape_data,
              j.completed_at::text AS research_completed_at
         FROM agency_leads l
         LEFT JOIN lead_research_jobs j ON j.lead_id = l.id
        WHERE l.status IN ('new', 'demo_booked', 'contacted')
          AND l.consent_research_given = TRUE
        ORDER BY
          CASE COALESCE(j.claude_temperature, 'cool')
            WHEN 'hot' THEN 1 WHEN 'warm' THEN 2
            WHEN 'cool' THEN 3 WHEN 'cold' THEN 4 ELSE 5 END,
          l.created_at DESC
        LIMIT 50`,
    );
    res.json({ items: r.rows });
  });

  // ============================================================
  // DETAILS for én lead m/ full research-data
  // ============================================================
  app.get("/api/superadmin/leads/:id/research", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;
    const r = await pool.query(
      `SELECT l.*, j.*
         FROM agency_leads l
         LEFT JOIN lead_research_jobs j ON j.lead_id = l.id
        WHERE l.id = $1`,
      [req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    res.json(r.rows[0]);
  });

  // ============================================================
  // ACCEPT — konverter til prosjekt + crm_customer + portal-token
  // ============================================================
  app.post("/api/superadmin/leads/:id/accept-as-project", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;

    const leadR = await pool.query(
      `SELECT l.id::text, l.agency_name, l.contact_name, l.email, l.phone,
              l.org_number, l.website, l.use_case, l.message,
              j.brreg_data, j.website_scrape_data,
              j.claude_summary, j.claude_temperature, j.claude_talking_points,
              j.claude_next_action
         FROM agency_leads l
         LEFT JOIN lead_research_jobs j ON j.lead_id = l.id
        WHERE l.id = $1`,
      [req.params.id],
    );
    if (leadR.rows.length === 0) return res.status(404).json({ error: "Lead ikke funnet" });
    const lead = leadR.rows[0];

    // Hent admin sin org (markedssjef sin org skal eie prosjektet)
    const orgR = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM organization_members
        WHERE user_id = $1 ORDER BY role = 'owner' DESC LIMIT 1`,
      [s.userId],
    );
    const orgId = req.body?.organization_id ?? orgR.rows[0]?.organization_id;
    if (!orgId) return res.status(400).json({ error: "organization_id mangler" });

    try {
      // 1. Opprett prosjekt (Leadgrid-prosjekt for kunden)
      const projectId = `leadgrid-${lead.id.slice(0, 12)}`;
      await pool.query(
        `INSERT INTO casting_projects (id, organization_id, name, created_at, created_by, metadata)
         VALUES ($1, $2, $3, now(), $4, $5::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [projectId, orgId, lead.agency_name, s.userId,
         JSON.stringify({
           leadgrid_source: "lead_accepted",
           source_lead_id: lead.id,
           claude_temperature: lead.claude_temperature,
         })],
      );

      // 2. Opprett crm_customer (med ev. tildelt teamleder/rep allerede)
      const customerId = (await pool.query<{ id: string }>(
        `SELECT gen_random_uuid() AS id`,
      )).rows[0].id;
      const logoUrl = lead.website_scrape_data?.og_image
                   ?? lead.website_scrape_data?.favicon_url
                   ?? null;

      const assignedTeamLeader = req.body?.assigned_team_leader_id ?? null;
      const assignedRep = req.body?.assigned_rep_id ?? null;
      const assignmentNote = req.body?.assignment_note ?? null;

      await pool.query(
        `INSERT INTO crm_customers
          (id, project_id, name, email, phone, website_url, logo_url,
           status, lead_category, ai_opportunity_score,
           assigned_team_leader_id, assigned_user_id, assigned_by_user_id,
           assigned_at, assignment_note,
           assignment_chain, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11, $12, $13,
                 CASE WHEN $11 IS NOT NULL OR $12 IS NOT NULL THEN now() END,
                 $14, $15::jsonb, now())`,
        [customerId, projectId, lead.agency_name, lead.email, lead.phone,
         lead.website, logoUrl,
         "active",
         lead.claude_temperature,
         lead.claude_temperature === "hot" ? 95
           : lead.claude_temperature === "warm" ? 75
           : lead.claude_temperature === "cool" ? 55 : 35,
         assignedTeamLeader, assignedRep,
         (assignedTeamLeader || assignedRep) ? s.userId : null,
         assignmentNote,
         JSON.stringify([
           ...(assignedTeamLeader ? [{
             type: "team_leader", user_id: assignedTeamLeader,
             by_user_id: s.userId, at: new Date().toISOString(),
             note: assignmentNote, on_accept: true,
           }] : []),
           ...(assignedRep ? [{
             type: "rep", user_id: assignedRep,
             by_user_id: s.userId, at: new Date().toISOString(),
             note: assignmentNote, on_accept: true,
           }] : []),
         ]),
        ],
      );

      // Logg + notification for ev. tildelinger på accept-tidspunktet
      if (assignedTeamLeader || assignedRep) {
        try {
          await pool.query(
            `INSERT INTO lead_assignment_log
               (lead_id, organization_id, from_user_id, to_user_id,
                assigned_by_user_id, reason, meta)
             SELECT $1, $2, NULL, unnest($3::text[]),
                    $4, 'accept_as_project', $5::jsonb`,
            [customerId, orgId,
             [assignedTeamLeader, assignedRep].filter(Boolean),
             s.userId,
             JSON.stringify({ from_lead_id: lead.id })],
          );
          for (const uid of [assignedTeamLeader, assignedRep].filter(Boolean)) {
            await pool.query(
              `INSERT INTO notification_events
                 (user_id, event_type, lead_id, message, created_at)
               VALUES ($1, 'lead_assigned_on_accept', $2::uuid, $3, now())`,
              [uid, customerId,
               `Du har fått tildelt: ${lead.agency_name}`],
            ).catch(() => {});
          }
        } catch (e) {
          console.warn("[accept] assignment-log feilet", e);
        }
      }

      // 3. Opprett portal-token
      const tokenR = await pool.query<{ token: string }>(
        `SELECT encode(gen_random_bytes(16), 'hex') AS token`,
      );
      const portalToken = tokenR.rows[0].token;
      await pool.query(
        `INSERT INTO client_portal_tokens
           (organization_id, project_id, customer_id, token, invited_email,
            invited_name, invited_role, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'client', $7)`,
        [orgId, projectId, customerId, portalToken,
         lead.email, lead.contact_name, s.userId],
      );

      // 4. Sett opp default notification-prefs (e-post på, WA av i start)
      await pool.query(
        `INSERT INTO client_notification_prefs
           (customer_id, contact_name, contact_email, contact_phone,
            notify_email, notify_sms, notify_whatsapp,
            consent_given_at)
         VALUES ($1, $2, $3, $4, TRUE, FALSE, FALSE, now())
         ON CONFLICT (customer_id) DO NOTHING`,
        [customerId, lead.contact_name, lead.email, lead.phone],
      );

      // 5. Legg inn Claude talking-points som "needs" eller signals
      const talkingPoints = lead.claude_talking_points ?? [];
      for (const tp of talkingPoints.slice(0, 5)) {
        await pool.query(
          `INSERT INTO crm_customer_signals
             (customer_id, signal_type, polarity, raw_value, source)
           VALUES ($1, 'claude_insight', 'positive', $2, 'auto_research')
           ON CONFLICT DO NOTHING`,
          [customerId, tp],
        ).catch(() => {});
      }

      // 6. Oppdater agency_leads status
      await pool.query(
        `UPDATE agency_leads SET
           status = 'converted',
           customer_at = now(),
           updated_at = now()
         WHERE id = $1`,
        [lead.id],
      );

      // 7. Send velkomst-e-post m/ portal-token
      try {
        await notifyClient(pool, {
          customerId,
          event: "new_finding",
          customerName: lead.contact_name,
          portalToken,
          findingTitle: "Velkommen til din Leadgrid-portal",
        });
      } catch (e) {
        console.warn("[lead-accept] velkomst-e-post feilet", e);
      }

      res.json({
        ok: true,
        project_id: projectId,
        customer_id: customerId,
        portal_url: `${process.env.LEADGRID_PORTAL_BASE_URL ?? "https://leadgrid.theroleroom.com"}/c/${portalToken}`,
      });
    } catch (e: any) {
      res.status(500).json({ error: "accept_failed", details: e?.message });
    }
  });

  // ============================================================
  // REJECT — avvis lead
  // ============================================================
  app.post("/api/superadmin/leads/:id/reject", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;
    const { reason } = req.body ?? {};
    await pool.query(
      `UPDATE agency_leads SET
         status = 'rejected',
         internal_notes = COALESCE(internal_notes || E'\n', '') || $1,
         updated_at = now()
       WHERE id = $2`,
      [reason ?? "Avvist av admin", req.params.id],
    );
    res.json({ ok: true });
  });

  // ============================================================
  // RETRY RESEARCH
  // ============================================================
  app.post("/api/superadmin/leads/:id/retry-research", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;
    triggerAutoResearchAsync(pool, req.params.id);
    res.json({ ok: true });
  });
}
