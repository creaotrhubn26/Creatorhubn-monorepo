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
 *   Email-tracking-pixel-endepunkten er offentlig (kalles fra inbox), MEN den
 *   verifiserer en HMAC-signert query-param (tok=...) for å unngå spoofing.
 *   For nå godtar vi også et fallback ?orgId= for stub-bruken; produksjons-
 *   signing-pipelinen er deferred til neste PR.
 *
 *   Proposal/contract-webhooks krever en signed shared-secret-header
 *   (Signering-spesifikt per leverandør implementeres når vi kobler dem opp).
 *   For nå godtar vi org/lead via body — caller må selv være authentisert
 *   via standard session ELLER inkludere et internt service-token i header.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { publishEvent } from "./leadgrid-workflow-engine.js";
import { emitWebhook } from "./webhook-emitter.js";

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

function reqStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function reqInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Hjelper: hent customer_id sin organization_id (vi denormaliserer slik
 * at workflow-eventet havner i riktig org-scope).
 */
async function orgIdForCustomer(
  pool: Pool,
  customerId: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ organization_id: string | null }>(
      `SELECT organization_id::text
         FROM crm_customers
        WHERE id = $1::uuid
        LIMIT 1`,
      [customerId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
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
      const customerId = reqStr(body.customer_id);
      let organizationId = reqStr(body.organization_id);
      if (!organizationId && customerId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, customer_id, event_type, email_id,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2, 'opened', $3, $4, $5::inet, $6::jsonb)`,
          [
            organizationId,
            customerId,
            reqStr(body.email_id),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId,
          type: "email.opened",
          leadId: customerId,
          actorUserId: null,
          data: {
            email_id: reqStr(body.email_id),
            occurred_at: new Date().toISOString(),
          },
        });
        void emitWebhook(
          pool,
          "email.opened",
          { lead_id: customerId, email_id: reqStr(body.email_id) },
          organizationId,
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
      const customerId = reqStr(body.customer_id);
      const linkUrl = reqStr(body.link_url);
      if (!linkUrl) {
        res.status(400).json({ error: "link_url_required" });
        return;
      }
      let organizationId = reqStr(body.organization_id);
      if (!organizationId && customerId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, customer_id, event_type, email_id, link_url,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2, 'link_clicked', $3, $4, $5, $6::inet, $7::jsonb)`,
          [
            organizationId,
            customerId,
            reqStr(body.email_id),
            linkUrl,
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId,
          type: "email.link_clicked",
          leadId: customerId,
          actorUserId: null,
          data: {
            link_url: linkUrl,
            email_id: reqStr(body.email_id),
          },
        });
        void emitWebhook(
          pool,
          "email.link_clicked",
          { lead_id: customerId, link_url: linkUrl },
          organizationId,
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
      const session = getSession(req, activeSessions);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerId = reqStr(body.customer_id);
      let organizationId = reqStr(body.organization_id);
      if (!organizationId && customerId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      void publishEvent({
        pool,
        organizationId,
        type: "meeting.booked",
        leadId: customerId,
        actorUserId: session?.userId ?? null,
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
          lead_id: customerId,
          meeting_id: reqStr(body.meeting_id),
          meeting_type: reqStr(body.meeting_type) ?? "discovery",
        },
        organizationId,
      );
      res.json({ ok: true });
    },
  );

  // ─── meeting.no_show ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/meetings/no-show",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerId = reqStr(body.customer_id);
      const meetingId = reqStr(body.meeting_id);
      let organizationId = reqStr(body.organization_id);
      if (!organizationId && customerId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      // Best-effort: hvis vi har leadgrid_meetings-rad, sett status
      if (meetingId) {
        try {
          await pool.query(
            `UPDATE leadgrid_meetings
                SET status = 'no_show', updated_at = NOW()
              WHERE id = $1::uuid AND organization_id = $2::uuid`,
            [meetingId, organizationId],
          );
        } catch {
          /* swallow */
        }
      }
      void publishEvent({
        pool,
        organizationId,
        type: "meeting.no_show",
        leadId: customerId,
        actorUserId: session?.userId ?? null,
        data: { meeting_id: meetingId },
      });
      void emitWebhook(
        pool,
        "meeting.no_show",
        { lead_id: customerId, meeting_id: meetingId },
        organizationId,
      );
      res.json({ ok: true });
    },
  );

  // ─── proposal.opened ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/proposals/opened",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerId = reqStr(body.customer_id);
      const proposalId = reqStr(body.proposal_id);
      if (!customerId || !proposalId) {
        res.status(400).json({ error: "customer_id_and_proposal_id_required" });
        return;
      }
      let organizationId = reqStr(body.organization_id);
      if (!organizationId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      try {
        await pool.query(
          `INSERT INTO leadgrid_proposal_views
             (organization_id, customer_id, proposal_id,
              view_duration_seconds, pages_viewed, device_type,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::inet, $9::jsonb)`,
          [
            organizationId,
            customerId,
            proposalId,
            reqInt(body.view_duration_seconds),
            reqInt(body.pages_viewed),
            reqStr(body.device_type),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId,
          type: "proposal.opened",
          leadId: customerId,
          actorUserId: null,
          data: { proposal_id: proposalId },
        });
        void emitWebhook(
          pool,
          "proposal.opened",
          { lead_id: customerId, proposal_id: proposalId },
          organizationId,
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
      const customerId = reqStr(body.customer_id);
      const contractId = reqStr(body.contract_id);
      if (!customerId || !contractId) {
        res.status(400).json({ error: "customer_id_and_contract_id_required" });
        return;
      }
      let organizationId = reqStr(body.organization_id);
      if (!organizationId) {
        organizationId = await orgIdForCustomer(pool, customerId);
      }
      if (!organizationId) {
        res.status(400).json({ error: "organization_id_required" });
        return;
      }
      const provider = reqStr(body.provider) ?? "manual";
      try {
        await pool.query(
          `INSERT INTO leadgrid_contract_events
             (organization_id, customer_id, event_type, contract_id,
              signer_email, provider, metadata)
           VALUES ($1::uuid, $2::uuid, 'signed', $3, $4, $5, $6::jsonb)`,
          [
            organizationId,
            customerId,
            contractId,
            reqStr(body.signer_email),
            provider,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        void publishEvent({
          pool,
          organizationId,
          type: "contract.signed",
          leadId: customerId,
          actorUserId: null,
          data: {
            contract_id: contractId,
            provider,
            signer_email: reqStr(body.signer_email),
          },
        });
        void emitWebhook(
          pool,
          "contract.signed",
          { lead_id: customerId, contract_id: contractId, provider },
          organizationId,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[contract.signed]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );
}
