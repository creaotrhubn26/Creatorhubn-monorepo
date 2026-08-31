export const LEAD_TEMPERATURES = ["cold", "warm", "hot", "ready"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const CREATION_LEAD_STATUSES = [
  "unvisited",
  "visited",
  "interested",
  "meeting_booked",
  "proposal_sent",
  "won",
] as const;
export type CreationLeadStatus = (typeof CREATION_LEAD_STATUSES)[number];

export type LeadCreationBody = {
  name: string;
  company: string;
  contactName: string | null;
  contactRole: string | null;
  organizationNumber: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  industryId: string | null;
  industryLabel: string | null;
  employeeCountEstimate: number | null;
  annualRevenueNokEstimate: number | null;
  notes: string | null;
  leadTemperature: LeadTemperature;
  leadStatus: CreationLeadStatus;
  pipelineStage: string;
  nextFollowUpAt: string | null;
  nextAction: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  locationConfidence: "exact" | "geocoded" | "approximate" | "unknown";
  leadSource: string;
  projectId: string | null;
};

export class LeadCreationValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "LeadCreationValidationError";
  }
}

function recordBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LeadCreationValidationError("ugyldig_payload");
  }
  return raw as Record<string, unknown>;
}

function optionalText(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new LeadCreationValidationError(`ugyldig_${key}`);
  }
  const value = raw.trim();
  if (!value) return null;
  if (value.length > maxLength) {
    throw new LeadCreationValidationError(`for_lang_${key}`);
  }
  return value;
}

function optionalNonNegativeNumber(
  body: Record<string, unknown>,
  key: string,
  integer: boolean,
): number | null {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === "") return null;
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw < 0 ||
    (integer && !Number.isInteger(raw))
  ) {
    throw new LeadCreationValidationError(`ugyldig_${key}`);
  }
  return raw;
}

export function pipelineStageForLeadStatus(status: CreationLeadStatus): string {
  switch (status) {
    case "unvisited": return "new";
    case "visited": return "first_contact";
    case "interested": return "qualified";
    case "meeting_booked": return "meeting";
    case "proposal_sent": return "proposal";
    case "won": return "won";
  }
}

export function parseLeadCreationBody(raw: unknown): LeadCreationBody {
  const body = recordBody(raw);
  const name = optionalText(body, "name", 255);
  if (!name) throw new LeadCreationValidationError("mangler_navn");

  const latitude = body.latitude;
  const longitude = body.longitude;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new LeadCreationValidationError("ugyldig_koordinat");
  }

  const temperatureRaw = optionalText(body, "lead_temperature", 20) ?? "warm";
  if (!(LEAD_TEMPERATURES as readonly string[]).includes(temperatureRaw)) {
    throw new LeadCreationValidationError("ugyldig_temperatur");
  }
  const leadTemperature = temperatureRaw as LeadTemperature;

  const statusRaw = optionalText(body, "lead_status", 40) ?? "unvisited";
  if (!(CREATION_LEAD_STATUSES as readonly string[]).includes(statusRaw)) {
    throw new LeadCreationValidationError("ugyldig_lead_status");
  }
  const leadStatus = statusRaw as CreationLeadStatus;

  const industryId = optionalText(body, "industry_id", 64);
  if (
    industryId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(industryId)
  ) {
    throw new LeadCreationValidationError("ugyldig_industry_id");
  }

  const organizationNumberRaw = optionalText(body, "organization_number", 32);
  const organizationNumber = organizationNumberRaw?.replace(/\s/g, "") ?? null;
  if (organizationNumber && !/^\d{9}$/.test(organizationNumber)) {
    throw new LeadCreationValidationError("ugyldig_organisasjonsnummer");
  }

  const nextAction = optionalText(body, "next_action", 500);
  const nextFollowUpRaw = optionalText(body, "next_follow_up_at", 80);
  let nextFollowUpAt: string | null = null;
  if (nextFollowUpRaw) {
    const parsed = new Date(nextFollowUpRaw);
    if (Number.isNaN(parsed.getTime())) {
      throw new LeadCreationValidationError("ugyldig_oppfolgingstid");
    }
    nextFollowUpAt = parsed.toISOString();
  }
  if (Boolean(nextAction) !== Boolean(nextFollowUpAt)) {
    throw new LeadCreationValidationError("oppfolging_krever_tid_og_handling");
  }

  const confidenceRaw = optionalText(body, "location_confidence", 30) ?? "exact";
  const validConfidences = ["exact", "geocoded", "approximate", "unknown"] as const;
  if (!(validConfidences as readonly string[]).includes(confidenceRaw)) {
    throw new LeadCreationValidationError("ugyldig_lokasjonskvalitet");
  }

  return {
    name,
    company: optionalText(body, "company", 255) ?? name,
    contactName: optionalText(body, "contact_name", 200),
    contactRole: optionalText(body, "contact_role", 160),
    organizationNumber,
    websiteUrl: optionalText(body, "website_url", 2048),
    phone: optionalText(body, "phone", 64),
    email: optionalText(body, "email", 320),
    industryId,
    industryLabel: optionalText(body, "industry_label", 200),
    employeeCountEstimate: optionalNonNegativeNumber(body, "employee_count_estimate", true),
    annualRevenueNokEstimate: optionalNonNegativeNumber(body, "annual_revenue_nok_estimate", false),
    notes: optionalText(body, "notes", 20_000),
    leadTemperature,
    leadStatus,
    pipelineStage: pipelineStageForLeadStatus(leadStatus),
    nextFollowUpAt,
    nextAction,
    latitude,
    longitude,
    address: optionalText(body, "address", 1_000),
    postalCode: optionalText(body, "postal_code", 20),
    city: optionalText(body, "city", 120),
    locationConfidence: confidenceRaw as LeadCreationBody["locationConfidence"],
    leadSource: optionalText(body, "lead_source", 80) ?? "manual_pin_drop",
    projectId: optionalText(body, "project_id", 255),
  };
}
