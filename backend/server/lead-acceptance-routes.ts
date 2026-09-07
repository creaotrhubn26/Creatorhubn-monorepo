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
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { triggerAutoResearchAsync } from "./lead-auto-research-service.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

interface AgencyLeadPromotionRow {
  id: string;
  agency_name: string;
  contact_name: string;
  contact_title: string | null;
  email: string;
  phone: string | null;
  org_number: string | null;
  website: string | null;
  use_case: string | null;
  message: string | null;
  status: string;
  claude_summary: string | null;
  claude_temperature: string | null;
  claude_talking_points: string[] | null;
  claude_next_action: string | null;
  leadgrid_organization_id: string | null;
  leadgrid_project_id: string | null;
  leadgrid_customer_id: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function requestedProjectId(req: Request): string | null {
  const raw = req.body?.projectId ?? req.body?.project_id;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value && value.length <= 255 ? value : null;
}

function requestedOrganizationId(req: Request): string | null {
  const raw = req.body?.organizationId ?? req.body?.organization_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function safeWebsite(value: string | null): {
  url: string | null;
  domain: string | null;
} {
  const raw = value?.trim();
  if (!raw) return { url: null, domain: null };
  try {
    const parsed = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`,
    );
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { url: null, domain: null };
    }
    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    return {
      url: parsed.toString(),
      domain: parsed.hostname.toLowerCase().replace(/^www\./, "") || null,
    };
  } catch {
    return { url: null, domain: null };
  }
}

function normalizedOrganizationNumber(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 9 ? digits : null;
}

function promotionNotes(lead: AgencyLeadPromotionRow): string | null {
  const sections = [
    lead.claude_summary ? `Research: ${lead.claude_summary}` : null,
    lead.use_case ? `Behov: ${lead.use_case}` : null,
    lead.message ? `Henvendelse: ${lead.message}` : null,
    lead.claude_next_action ? `Anbefalt neste steg: ${lead.claude_next_action}` : null,
    ...(lead.claude_talking_points ?? []).slice(0, 5).map(
      (point) => `Samtalepunkt: ${point}`,
    ),
  ].filter((value): value is string => Boolean(value?.trim()));
  return sections.length > 0 ? sections.join("\n\n").slice(0, 20_000) : null;
}

function sendPromotionResponse(
  res: Response,
  input: {
    sourceLeadId: string;
    crmLeadId: string;
    organizationId: string;
    projectId: string;
    created: boolean;
  },
) {
  return res.json({
    ok: true,
    promotion: {
      agencyLeadId: input.sourceLeadId,
      crmLeadId: input.crmLeadId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      created: input.created,
    },
    source_lead_id: input.sourceLeadId,
    customer_id: input.crmLeadId,
    crm_lead_id: input.crmLeadId,
    organization_id: input.organizationId,
    project_id: input.projectId,
    already_promoted: !input.created,
  });
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
  // ACCEPT — promoter kildelead inn i et eksplisitt Leadgrid-prosjekt.
  // Tildeling skjer alltid som et eget steg etter at CRM-ID-en er returnert.
  // ============================================================
  app.post("/api/superadmin/leads/:id/accept-as-project", async (req, res) => {
    const s = await requireSuperAdminOrMarkedssjef(pool, activeSessions, req, res);
    if (!s) return;
    if (!UUID_PATTERN.test(req.params.id ?? "")) {
      return res.status(404).json({ error: "Lead ikke funnet" });
    }

    const projectId = requestedProjectId(req);
    if (!projectId) {
      return res.status(400).json({
        error: "project_id_required",
        message: "Velg et aktivt Leadgrid-prosjekt før leadet legges til.",
      });
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, s.userId);
    if (!project) return res.status(404).json({ error: "project_not_found" });
    const requestOrganizationId = requestedOrganizationId(req);
    if (
      requestOrganizationId &&
      requestOrganizationId !== project.organizationId
    ) {
      return res.status(404).json({ error: "project_not_found" });
    }
    if (
      req.body?.assigned_team_leader_id != null ||
      req.body?.assigned_rep_id != null ||
      req.body?.assignment_note != null
    ) {
      return res.status(400).json({
        error: "assignment_after_promotion_required",
        message: "Promoter leadet først og tildel deretter med returnert CRM-ID.",
      });
    }

    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const leadResult = await client.query<AgencyLeadPromotionRow>(
        `SELECT l.id::text, l.agency_name, l.contact_name, l.contact_title,
                l.email, l.phone, l.org_number, l.website, l.use_case, l.message,
                l.status, l.leadgrid_organization_id::text,
                l.leadgrid_project_id, l.leadgrid_customer_id::text,
                j.claude_summary, j.claude_temperature,
                j.claude_talking_points, j.claude_next_action
           FROM agency_leads l
           LEFT JOIN lead_research_jobs j ON j.lead_id = l.id
          WHERE l.id = $1::uuid
          FOR UPDATE OF l`,
        [req.params.id],
      );
      const lead = leadResult.rows[0];
      if (!lead) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Lead ikke funnet" });
      }

      if (lead.leadgrid_customer_id) {
        if (
          lead.leadgrid_organization_id !== project.organizationId ||
          lead.leadgrid_project_id !== project.id
        ) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "already_promoted_to_another_project",
            project_id: lead.leadgrid_project_id,
          });
        }
        const persisted = await client.query<{ id: string }>(
          `SELECT id::text
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [
            lead.leadgrid_customer_id,
            project.organizationId,
            project.id,
          ],
        );
        if (!persisted.rows[0]) throw new Error("promotion_mapping_corrupt");
        await client.query("COMMIT");
        return sendPromotionResponse(res, {
          sourceLeadId: lead.id,
          crmLeadId: persisted.rows[0].id,
          organizationId: project.organizationId,
          projectId: project.id,
          created: false,
        });
      }

      if (lead.status === "converted") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "legacy_conversion_requires_reconciliation",
        });
      }

      const website = safeWebsite(lead.website);
      const temperature = lead.claude_temperature === "hot"
        ? "hot"
        : lead.claude_temperature === "warm"
          ? "warm"
          : "cold";
      const score = lead.claude_temperature === "hot"
        ? 95
        : lead.claude_temperature === "warm"
          ? 75
          : lead.claude_temperature === "cool"
            ? 55
            : 35;
      const requestHash = createHash("sha256")
        .update(JSON.stringify({
          agencyLeadId: lead.id,
          organizationId: project.organizationId,
          projectId: project.id,
        }))
        .digest("hex");

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO crm_customers (
           id, organization_id, project_id,
           name, company, contact_name, contact_role,
           email, phone, website_url, website_domain_normalized,
           enrichment_org_nr, notes,
           status, lead_status, pipeline_stage,
           lead_category, lead_temperature, ai_opportunity_score,
           lead_source, source, location_confidence, owner_user_id,
           creation_idempotency_key, creation_request_hash,
           created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1::uuid, $2,
           $3, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11,
           'lead', 'unvisited', 'new',
           $12, $13, $14,
           'agency_inbox', 'agency_inbox', 'unknown', $15,
           $16::uuid, $17,
           NOW(), NOW()
         )
         ON CONFLICT (organization_id, creation_idempotency_key)
           WHERE organization_id IS NOT NULL
             AND creation_idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id::text`,
        [
          project.organizationId,
          project.id,
          lead.agency_name,
          lead.contact_name,
          lead.contact_title,
          lead.email,
          lead.phone,
          website.url,
          website.domain,
          normalizedOrganizationNumber(lead.org_number),
          promotionNotes(lead),
          lead.claude_temperature,
          temperature,
          score,
          s.userId,
          lead.id,
          requestHash,
        ],
      );

      let crmLeadId = inserted.rows[0]?.id ?? null;
      let created = Boolean(crmLeadId);
      if (!crmLeadId) {
        const replay = await client.query<{
          id: string;
          organization_id: string;
          project_id: string | null;
        }>(
          `SELECT id::text, organization_id::text, project_id
             FROM crm_customers
            WHERE organization_id = $1::uuid
              AND creation_idempotency_key = $2::uuid
            LIMIT 1`,
          [project.organizationId, lead.id],
        );
        const existing = replay.rows[0];
        if (!existing || existing.project_id !== project.id) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "promotion_idempotency_conflict",
          });
        }
        crmLeadId = existing.id;
        created = false;
      }

      const mapped = await client.query(
        `UPDATE agency_leads
            SET status = 'converted',
                customer_at = COALESCE(customer_at, NOW()),
                leadgrid_organization_id = $2::uuid,
                leadgrid_project_id = $3,
                leadgrid_customer_id = $4::uuid,
                leadgrid_promoted_at = NOW(),
                updated_at = NOW()
          WHERE id = $1::uuid
            AND leadgrid_organization_id IS NULL
            AND leadgrid_project_id IS NULL
            AND leadgrid_customer_id IS NULL
          RETURNING id`,
        [lead.id, project.organizationId, project.id, crmLeadId],
      );
      if (mapped.rowCount !== 1) throw new Error("promotion_mapping_race");

      await client.query(
        `INSERT INTO agency_lead_events (
           lead_id, event_type, actor, details
         ) VALUES (
           $1::uuid, 'leadgrid_promoted', $2, $3::jsonb
         )`,
        [
          lead.id,
          s.email ?? s.userId,
          JSON.stringify({
            organization_id: project.organizationId,
            project_id: project.id,
            crm_lead_id: crmLeadId,
          }),
        ],
      );
      await client.query("COMMIT");
      return sendPromotionResponse(res, {
        sourceLeadId: lead.id,
        crmLeadId,
        organizationId: project.organizationId,
        projectId: project.id,
        created,
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      console.error("[lead-accept] promotion failed", error);
      return res.status(500).json({ error: "accept_failed", details: "internal_error" });
    } finally {
      client?.release();
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
