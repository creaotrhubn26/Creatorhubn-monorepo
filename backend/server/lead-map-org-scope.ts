import type { Request } from "express";
import type { Pool } from "pg";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class LeadMapOrganizationScopeError extends Error {
  constructor(
    public readonly status: 400 | 403,
    public readonly code: "invalid_organization_id" | "not_organization_member",
  ) {
    super(code);
    this.name = "LeadMapOrganizationScopeError";
  }
}

export function requestedLeadMapOrganizationId(req: Request): string | null {
  const candidates = [
    req.query.organization_id,
    req.query.organizationId,
    req.body?.organization_id,
    req.body?.organizationId,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Resolve an explicitly selected workspace and prove membership. */
export async function resolveAuthorizedLeadMapOrganization(
  pool: Pool,
  userId: string,
  requestedOrganizationId: string | null,
): Promise<string | null> {
  if (!requestedOrganizationId) return null;
  if (!UUID_PATTERN.test(requestedOrganizationId)) {
    throw new LeadMapOrganizationScopeError(400, "invalid_organization_id");
  }
  const membership = await pool.query(
    `SELECT 1
       FROM organization_members
      WHERE organization_id = $1::uuid AND user_id = $2
      LIMIT 1`,
    [requestedOrganizationId, userId],
  );
  if (!membership.rows.length) {
    throw new LeadMapOrganizationScopeError(403, "not_organization_member");
  }
  return requestedOrganizationId;
}

/**
 * Use the active workspace when supplied. For older clients, derive it from
 * the lead and prove membership; a null result deliberately keeps the legacy
 * owner_user_id path for rows that have not been backfilled yet.
 */
export async function resolveLeadOrganizationScope(
  pool: Pool,
  userId: string,
  leadId: string,
  requestedOrganizationId: string | null,
): Promise<string | null> {
  if (requestedOrganizationId) {
    return resolveAuthorizedLeadMapOrganization(pool, userId, requestedOrganizationId);
  }
  if (!UUID_PATTERN.test(leadId)) return null;
  const lead = await pool.query<{ organization_id: string | null }>(
    `SELECT COALESCE(c.organization_id::text, p.organization_id::text) AS organization_id
       FROM crm_customers c
       LEFT JOIN leadgrid_projects p ON p.id = c.project_id
      WHERE c.id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  const organizationId = lead.rows[0]?.organization_id ?? null;
  return resolveAuthorizedLeadMapOrganization(pool, userId, organizationId);
}

export function sendLeadMapOrganizationScopeError(
  error: unknown,
  res: import("express").Response,
): boolean {
  if (!(error instanceof LeadMapOrganizationScopeError)) return false;
  res.status(error.status).json({ error: error.code });
  return true;
}
