/**
 * leadgrid-workflow-triggers-routes.ts
 *
 * Webhook/event-mottakere som registrerer trigger-events for de 6 nye
 * workflow-triggers (mig 0350):
 *
 *   email.opened          ← /api/leadgrid/events/email/opened
 *   email.link_clicked    ← /api/leadgrid/events/email/link-clicked
 *   meeting.booked        ← /api/leadgrid/events/meetings/booked
 *   meeting.no_show       ← /api/leadgrid/events/meetings/no-show
 *   proposal.opened       ← /api/leadgrid/events/proposals/opened
 *   contract.signed       ← /api/leadgrid/events/contracts/signed
 *
 * Hvert endepunkt:
 *   1) INSERT i sin event-tabell (audit-log)
 *   2) emit workflow-event via publishEvent (fire-and-forget)
 *   3) emit webhook-event til eventuelle integrasjons-abonnementer
 *
 * Auth:
 *   Disse generiske mottakerne krever en vanlig Leadgrid-session og avleder
 *   organization/project fra lead-raden. Offentlige events må ha en egen,
 *   provider-spesifikk signert inngang. Tilbudslenken bruker allerede sitt
 *   sterke public_token i leadgrid-proposals-routes og publiserer direkte.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { publishEvent } from "./leadgrid-workflow-engine.js";
import { emitWebhook } from "./webhook-emitter.js";
import {
  getLeadgridSession,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import {
  loadAccessibleLeadgridLead,
  type LeadgridAccessibleLead,
} from "./leadgrid-lead-access.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function reqStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function reqInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function authorizedEventLead(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  body: Record<string, unknown>,
): Promise<{
  session: LeadgridSession;
  lead: LeadgridAccessibleLead;
} | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  const customerId = reqStr(body.customer_id);
  if (!customerId) {
    res.status(400).json({ error: "customer_id_required" });
    return null;
  }
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: customerId,
    userId: session.userId,
  });
  if (!lead) {
    res.status(404).json({ error: "lead_not_found" });
    return null;
  }
  return { session, lead };
}

export function registerLeadgridWorkflowTriggerRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ─── email.opened ───────────────────────────────────────────────
  // Kalles fra tracking-pixel-img-redirect ELLER backend-mailer-callback.
  // Body: { organization_id?, customer_id?, email_id?, user_agent?, ip_address?, metadata? }
  app.post(
    "/api/leadgrid/events/email/opened",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead } = scope;
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, project_id, customer_id, event_type, email_id,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2, $3::uuid, 'opened', $4, $5, $6::inet, $7::jsonb)`,
          [
            lead.organizationId,
            lead.projectId,
            lead.id,
            reqStr(body.email_id),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            req.ip ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId: lead.organizationId,
          projectId: lead.projectId,
          type: "email.opened",
          leadId: lead.id,
          actorUserId: scope.session.userId,
          data: {
            email_id: reqStr(body.email_id),
            occurred_at: new Date().toISOString(),
          },
        });
        void emitWebhook(
          pool,
          "email.opened",
          {
            lead_id: lead.id,
            project_id: lead.projectId,
            email_id: reqStr(body.email_id),
          },
          lead.organizationId,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[email.opened]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── email.link_clicked ─────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/email/link-clicked",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const linkUrl = reqStr(body.link_url);
      if (!linkUrl) {
        res.status(400).json({ error: "link_url_required" });
        return;
      }
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead } = scope;
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, project_id, customer_id, event_type, email_id, link_url,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2, $3::uuid, 'link_clicked', $4, $5, $6, $7::inet, $8::jsonb)`,
          [
            lead.organizationId,
            lead.projectId,
            lead.id,
            reqStr(body.email_id),
            linkUrl.slice(0, 4000),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            req.ip ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId: lead.organizationId,
          projectId: lead.projectId,
          type: "email.link_clicked",
          leadId: lead.id,
          actorUserId: scope.session.userId,
          data: {
            link_url: linkUrl,
            email_id: reqStr(body.email_id),
          },
        });
        void emitWebhook(
          pool,
          "email.link_clicked",
          {
            lead_id: lead.id,
            project_id: lead.projectId,
            link_url: linkUrl,
          },
          lead.organizationId,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[email.link_clicked]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── meeting.booked ─────────────────────────────────────────────
  // Auth: krever bruker-session (skapes typisk fra UI eller fra Calendly-webhook
  // som har egen service-bearer-token i header).
  app.post(
    "/api/leadgrid/events/meetings/booked",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead, session } = scope;
      void publishEvent({
        pool,
        organizationId: lead.organizationId,
        projectId: lead.projectId,
        type: "meeting.booked",
        leadId: lead.id,
        actorUserId: session.userId,
        data: {
          meeting_id: reqStr(body.meeting_id),
          meeting_type: reqStr(body.meeting_type) ?? "discovery",
          starts_at: reqStr(body.starts_at),
        },
      });
      void emitWebhook(
        pool,
        "meeting.booked",
        {
          lead_id: lead.id,
          project_id: lead.projectId,
          meeting_id: reqStr(body.meeting_id),
          meeting_type: reqStr(body.meeting_type) ?? "discovery",
        },
        lead.organizationId,
      );
      res.json({ ok: true });
    },
  );

  // ─── meeting.no_show ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/meetings/no-show",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const meetingId = reqStr(body.meeting_id);
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead, session } = scope;
      // Best-effort: hvis vi har leadgrid_meetings-rad, sett status
      if (meetingId) {
        try {
          await pool.query(
            `UPDATE leadgrid_meetings
                SET status = 'no_show', updated_at = NOW()
              WHERE id = $1::uuid
                AND organization_id = $2::uuid
                AND project_id = $3
                AND customer_id = $4::uuid`,
            [meetingId, lead.organizationId, lead.projectId, lead.id],
          );
        } catch {
          /* swallow */
        }
      }
      void publishEvent({
        pool,
        organizationId: lead.organizationId,
        projectId: lead.projectId,
        type: "meeting.no_show",
        leadId: lead.id,
        actorUserId: session.userId,
        data: { meeting_id: meetingId },
      });
      void emitWebhook(
        pool,
        "meeting.no_show",
        {
          lead_id: lead.id,
          project_id: lead.projectId,
          meeting_id: meetingId,
        },
        lead.organizationId,
      );
      res.json({ ok: true });
    },
  );

  // ─── proposal.opened ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/proposals/opened",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const proposalId = reqStr(body.proposal_id);
      if (!proposalId) {
        res.status(400).json({ error: "customer_id_and_proposal_id_required" });
        return;
      }
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead, session } = scope;
      try {
        const proposal = await pool.query<{ allowed: boolean }>(
          `SELECT EXISTS (
             SELECT 1
               FROM leadgrid_proposals p
              WHERE p.id::text = $1
                AND p.lead_id = $2::uuid
                AND p.organization_id = $3
           ) AS allowed`,
          [proposalId, lead.id, lead.organizationId],
        );
        if (proposal.rows[0]?.allowed !== true) {
          res.status(404).json({ error: "proposal_not_found" });
          return;
        }
        await pool.query(
          `INSERT INTO leadgrid_proposal_views
             (organization_id, project_id, customer_id, proposal_id,
              view_duration_seconds, pages_viewed, device_type,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9::inet, $10::jsonb)`,
          [
            lead.organizationId,
            lead.projectId,
            lead.id,
            proposalId,
            reqInt(body.view_duration_seconds),
            reqInt(body.pages_viewed),
            reqStr(body.device_type),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            req.ip ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId: lead.organizationId,
          projectId: lead.projectId,
          type: "proposal.opened",
          leadId: lead.id,
          actorUserId: session.userId,
          data: { proposal_id: proposalId },
        });
        void emitWebhook(
          pool,
          "proposal.opened",
          {
            lead_id: lead.id,
            project_id: lead.projectId,
            proposal_id: proposalId,
          },
          lead.organizationId,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[proposal.opened]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── contract.signed ────────────────────────────────────────────
  // Tar imot webhook fra DocuSign / Posten Signering / HelloSign.
  // Provider-spesifikk signing-verifikasjon legges på når vi kobler dem opp.
  app.post(
    "/api/leadgrid/events/contracts/signed",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const contractId = reqStr(body.contract_id);
      if (!contractId) {
        res.status(400).json({ error: "customer_id_and_contract_id_required" });
        return;
      }
      const scope = await authorizedEventLead(
        req, res, pool, activeSessions, body,
      );
      if (!scope) return;
      const { lead, session } = scope;
      const provider = reqStr(body.provider) ?? "manual";
      try {
        await pool.query(
          `INSERT INTO leadgrid_contract_events
             (organization_id, project_id, customer_id, event_type, contract_id,
              signer_email, provider, metadata)
           VALUES ($1::uuid, $2, $3::uuid, 'signed', $4, $5, $6, $7::jsonb)`,
          [
            lead.organizationId,
            lead.projectId,
            lead.id,
            contractId,
            reqStr(body.signer_email),
            provider,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId: lead.organizationId,
          projectId: lead.projectId,
          type: "contract.signed",
          leadId: lead.id,
          actorUserId: session.userId,
          data: {
            contract_id: contractId,
            provider,
            signer_email: reqStr(body.signer_email),
          },
        });
        void emitWebhook(
          pool,
          "contract.signed",
          {
            lead_id: lead.id,
            project_id: lead.projectId,
            contract_id: contractId,
            provider,
          },
          lead.organizationId,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[contract.signed]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );
}
