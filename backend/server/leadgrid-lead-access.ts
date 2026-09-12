import type { Pool } from "pg";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export interface LeadgridAccessibleLead {
  id: string;
  organizationId: string;
  projectId: string;
}

interface LeadScopeRow {
  id: string;
  organization_id: string;
  project_id: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a lead through its persisted organization/project tuple.
 *
 * Request-supplied tenant fields, ownership and assignment are deliberately
 * ignored. A Leadgrid lead is accessible only while its non-null customer
 * project is active and the caller can access that exact project. Every
 * denial returns null so callers can answer with one indistinguishable 404.
 */
export async function loadAccessibleLeadgridLead(
  pool: Pick<Pool, "query">,
  input: { leadId: string; userId: string },
): Promise<LeadgridAccessibleLead | null> {
  const leadId = input.leadId.trim();
  const userId = input.userId.trim();
  if (!UUID_PATTERN.test(leadId) || !userId) return null;

  const result = await pool.query<LeadScopeRow>(
    `SELECT c.id::text,
            c.organization_id::text,
            c.project_id::text
       FROM crm_customers c
      WHERE c.id = $1::uuid
        AND c.organization_id IS NOT NULL
        AND c.project_id IS NOT NULL
        AND c.archived_at IS NULL
      LIMIT 1`,
    [leadId],
  );
  const lead = result.rows[0];
  if (!lead?.organization_id || !lead.project_id) return null;

  const project = await loadAccessibleLeadgridProject(
    pool,
    lead.project_id,
    userId,
  );
  if (
    !project ||
    project.id !== lead.project_id ||
    project.organizationId !== lead.organization_id
  ) {
    return null;
  }

  return {
    id: lead.id,
    organizationId: lead.organization_id,
    projectId: lead.project_id,
  };
}
