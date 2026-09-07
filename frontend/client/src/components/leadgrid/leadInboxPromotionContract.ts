export interface LeadgridProjectOption {
  id: string;
  organizationId: string;
  name: string;
}

export interface PromotedLeadReference {
  agencyLeadId: string;
  crmLeadId: string;
  organizationId: string;
  projectId: string;
  created: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildAgencyLeadPromotionBody(projectId: string): {
  projectId: string;
} {
  const normalized = projectId.trim();
  if (!normalized || normalized.length > 255) {
    throw new Error("Velg et gyldig Leadgrid-prosjekt før leadet legges til.");
  }
  return { projectId: normalized };
}

/**
 * Runtime boundary between the agency inbox and Leadgrid CRM.
 *
 * Never fall back to the source agency-lead id. Assignment may only start
 * after the promotion endpoint has returned a persisted CRM UUID in the exact
 * project the operator selected.
 */
export function parseAgencyLeadPromotion(
  payload: unknown,
  expected: { agencyLeadId: string; projectId: string },
): PromotedLeadReference {
  if (!payload || typeof payload !== "object") {
    throw new Error("Serveren returnerte ikke en gyldig Leadgrid-lead.");
  }
  const record = payload as Record<string, unknown>;
  const promotion = record.promotion && typeof record.promotion === "object"
    ? record.promotion as Record<string, unknown>
    : {};
  const agencyLeadId = requiredText(
    promotion.agencyLeadId ?? record.source_lead_id,
  );
  const crmLeadId = requiredText(
    promotion.crmLeadId ?? record.crm_lead_id ?? record.customer_id,
  );
  const organizationId = requiredText(
    promotion.organizationId ?? record.organization_id,
  );
  const projectId = requiredText(
    promotion.projectId ?? record.project_id,
  );

  if (
    agencyLeadId !== expected.agencyLeadId ||
    projectId !== expected.projectId ||
    !crmLeadId ||
    crmLeadId === expected.agencyLeadId ||
    !UUID_PATTERN.test(crmLeadId) ||
    !organizationId ||
    !UUID_PATTERN.test(organizationId)
  ) {
    throw new Error(
      "Leadet ble ikke bekreftet i valgt prosjekt. Tildeling er stoppet.",
    );
  }

  return {
    agencyLeadId,
    crmLeadId,
    organizationId,
    projectId,
    created: promotion.created !== false && record.already_promoted !== true,
  };
}

export function buildAssignableUsersPath(input: {
  role: "team_leader" | "rep";
  crmLeadId: string;
  projectId: string;
}): string {
  const crmLeadId = input.crmLeadId.trim();
  const projectId = input.projectId.trim();
  if (!UUID_PATTERN.test(crmLeadId) || !projectId || projectId.length > 255) {
    throw new Error("Tildeling mangler en gyldig Leadgrid lead-/prosjektkobling.");
  }
  const query = new URLSearchParams({
    role: input.role,
    leadId: crmLeadId,
    projectId,
  });
  return `/api/leadgrid/assignable-users?${query.toString()}`;
}
