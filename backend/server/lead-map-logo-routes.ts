/**
 * Project-scoped company logo management for Leadgrid leads.
 *
 * Every mutation proves the persisted organization/project/lead tuple. Remote
 * discovery is bounded and delegated to the shared SSRF-safe logo fetcher.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import { fetchBestLogo } from "./lead-logo-fetcher.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
} from "./leadgrid-project-access.js";
import { requestedLeadMapOrganizationId } from "./lead-map-org-scope.js";
import {
  LeadMapProjectScopeError,
  requestedLeadMapProjectId,
  sendLeadMapProjectScopeError,
} from "./lead-map-project-scope.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { assertPublicUrl } from "./ssrf-guard.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_MANUAL_LOGO_URL_LENGTH = 2_048;
const BULK_LIMIT = 20;
const BULK_CONCURRENCY = 4;

function normalizeManualLogoUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_MANUAL_LOGO_URL_LENGTH) return null;
  try {
    const parsed = assertPublicUrl(value);
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  rows: T[],
  concurrency: number,
  work: (row: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(rows.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
      while (cursor < rows.length) {
        const index = cursor++;
        results[index] = await work(rows[index]);
      }
    }),
  );
  return results;
}

export function registerLeadMapLogoRoutes({ app, pool, activeSessions }: Deps): void {
  async function session(req: Request) {
    return getLeadgridSession(req, activeSessions)
      ?? resolveLeadMapSession(req, pool, activeSessions);
  }

  async function leadScope(req: Request, userId: string) {
    const projectId = requestedLeadMapProjectId(req);
    if (!projectId) {
      throw new LeadMapProjectScopeError(400, "project_id_required");
    }
    const lead = await loadAccessibleLeadgridLead(pool, {
      leadId: req.params.id,
      userId,
    });
    const organizationId = requestedLeadMapOrganizationId(req);
    if (
      !lead
      || lead.projectId !== projectId
      || (organizationId && lead.organizationId !== organizationId)
    ) {
      throw new LeadMapProjectScopeError(404, "project_not_found");
    }
    return lead;
  }

  async function projectScope(req: Request, userId: string) {
    const projectId = requestedLeadMapProjectId(req);
    if (!projectId) {
      throw new LeadMapProjectScopeError(400, "project_id_required");
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    const organizationId = requestedLeadMapOrganizationId(req);
    if (!project || (organizationId && project.organizationId !== organizationId)) {
      throw new LeadMapProjectScopeError(404, "project_not_found");
    }
    return project;
  }

  app.post(
    "/api/admin-room/lead-map/leads/:id/fetch-logo",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const scope = await leadScope(req, current.userId);
        const leadResult = await pool.query<{ website_url: string | null }>(
          `SELECT website_url
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
              AND archived_at IS NULL
            LIMIT 1`,
          [scope.id, scope.organizationId, scope.projectId],
        );
        const websiteUrl = leadResult.rows[0]?.website_url?.trim();
        if (!websiteUrl) {
          return res.status(400).json({
            error: "mangler_website",
            message: "Lead-en har ingen website-URL — kan ikke hente logo automatisk",
          });
        }
        const logo = await fetchBestLogo(websiteUrl);
        if (!logo) return res.status(404).json({ error: "ingen_logo_funnet" });
        const updated = await pool.query(
          `UPDATE crm_customers
              SET logo_url = $4,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
              AND website_url = $5
              AND archived_at IS NULL`,
          [scope.id, scope.organizationId, scope.projectId, logo.url, websiteUrl],
        );
        if (!updated.rowCount) {
          return res.status(409).json({ error: "lead_changed_during_logo_fetch" });
        }
        return res.json({
          ok: true,
          logo_url: logo.url,
          source: logo.source,
          size: logo.size ?? null,
        });
      } catch (error) {
        if (sendLeadMapProjectScopeError(error, res)) return;
        if (error instanceof Error && error.message === "unsafe_website_url") {
          return res.status(400).json({ error: "unsafe_website_url" });
        }
        return res.status(502).json({ error: "fetch_failed", detail: "upstream_error" });
      }
    },
  );

  app.patch(
    "/api/admin-room/lead-map/leads/:id/logo",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const logoUrl = normalizeManualLogoUrl(req.body?.logo_url);
      if (!logoUrl) return res.status(400).json({ error: "ugyldig_logo_url" });
      try {
        const scope = await leadScope(req, current.userId);
        const updated = await pool.query(
          `UPDATE crm_customers
              SET logo_url = $4,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
              AND archived_at IS NULL`,
          [scope.id, scope.organizationId, scope.projectId, logoUrl],
        );
        if (!updated.rowCount) return res.status(404).json({ error: "project_not_found" });
        return res.json({ ok: true, logo_url: logoUrl });
      } catch (error) {
        if (sendLeadMapProjectScopeError(error, res)) return;
        return res.status(500).json({ error: "update_failed", detail: "internal_error" });
      }
    },
  );

  app.delete(
    "/api/admin-room/lead-map/leads/:id/logo",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const scope = await leadScope(req, current.userId);
        const updated = await pool.query(
          `UPDATE crm_customers
              SET logo_url = NULL,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
              AND archived_at IS NULL`,
          [scope.id, scope.organizationId, scope.projectId],
        );
        if (!updated.rowCount) return res.status(404).json({ error: "project_not_found" });
        return res.json({ ok: true });
      } catch (error) {
        if (sendLeadMapProjectScopeError(error, res)) return;
        return res.status(500).json({ error: "delete_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/fetch-logos-bulk",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const project = await projectScope(req, current.userId);
        const leadsResult = await pool.query<{ id: string; website_url: string }>(
          `SELECT id::text, website_url
             FROM crm_customers
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND archived_at IS NULL
              AND website_url IS NOT NULL
              AND BTRIM(website_url) <> ''
              AND (logo_url IS NULL OR logo_url = '')
            ORDER BY updated_at DESC, id
            LIMIT $3`,
          [project.organizationId, project.id, BULK_LIMIT],
        );
        const results = await mapWithConcurrency(
          leadsResult.rows,
          BULK_CONCURRENCY,
          async (row) => {
            try {
              const websiteUrl = row.website_url.trim();
              const logo = await fetchBestLogo(websiteUrl);
              if (!logo) return { id: row.id, ok: false, error: "no_logo" };
              const updated = await pool.query(
                `UPDATE crm_customers
                    SET logo_url = $4,
                        updated_at = NOW()
                  WHERE id = $1::uuid
                    AND organization_id = $2::uuid
                    AND project_id = $3
                    AND website_url = $5
                    AND archived_at IS NULL
                    AND (logo_url IS NULL OR logo_url = '')`,
                [row.id, project.organizationId, project.id, logo.url, websiteUrl],
              );
              return updated.rowCount
                ? { id: row.id, ok: true, logo_url: logo.url }
                : { id: row.id, ok: false, error: "stale_lead" };
            } catch {
              return { id: row.id, ok: false, error: "fetch_failed" };
            }
          },
        );
        return res.json({
          ok: true,
          processed: results.length,
          succeeded: results.filter((result) => result.ok).length,
          has_more: leadsResult.rows.length === BULK_LIMIT,
          results,
        });
      } catch (error) {
        if (sendLeadMapProjectScopeError(error, res)) return;
        return res.status(500).json({ error: "bulk_fetch_failed", detail: "internal_error" });
      }
    },
  );
}
