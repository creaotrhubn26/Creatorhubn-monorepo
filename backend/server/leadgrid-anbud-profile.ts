export interface LeadgridAnbudWatchTemplate {
  key: string;
  name: string;
  query: {
    q: string | null;
    location: string | null;
    cpv: string;
  };
}

export interface LeadgridAnbudProfileTemplate {
  template_key: string;
  template_version: number;
  name: string;
  description: string;
  cpv_codes: string[];
  keywords: string[];
  exclusion_terms: string[];
  suggested_watches: LeadgridAnbudWatchTemplate[];
  requires_admin_confirmation: true;
}

/**
 * Product-side procurement profile for Tidum. CPV describes what the buyer
 * procures, not which industry the buyer operates in. Keeping 85000000 out is
 * deliberate: that broad code finds procurements of health/social services,
 * while Tidum sells workforce, scheduling and documentation software.
 *
 * Codes are from the EU Common Procurement Vocabulary (CPV 2008):
 * - 48450000 Time accounting or human resources software package
 * - 72212450 Time accounting or human resources software development services
 * - 48332000 Scheduling software package
 * - 48311000 Document management software package
 * - 48311100 Document management system
 */
export const TIDUM_ANBUD_PROFILE: LeadgridAnbudProfileTemplate = {
  template_key: "tidum.procurement",
  template_version: 1,
  name: "Tidum – arbeidstid, turnus og dokumentasjon",
  description:
    "Offentlige anskaffelser av arbeidstids-, HR-, turnus- og dokumentasjonsprogramvare. Omsorgstjenester som leveranse er eksplisitt utelatt.",
  cpv_codes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
  keywords: [
    "arbeidstid",
    "timeføring",
    "turnus",
    "bemanningsplanlegging",
    "digital dokumentasjon",
    "HR-system",
  ],
  exclusion_terms: [
    "kjøp av omsorgsplasser",
    "brukerstyrt personlig assistanse",
    "vikarbyrå",
    "bemanningstjenester",
    "tjenestekonsesjon",
  ],
  suggested_watches: [
    {
      key: "tidum.time_hr_software",
      name: "Tidum · Arbeidstid og HR-programvare",
      query: { q: null, location: null, cpv: "48450000,72212450" },
    },
    {
      key: "tidum.scheduling",
      name: "Tidum · Turnus og planlegging",
      query: { q: "turnus", location: null, cpv: "48332000,48450000" },
    },
    {
      key: "tidum.documentation",
      name: "Tidum · Digital dokumentasjon",
      query: { q: "dokumentasjon", location: null, cpv: "48311000,48311100" },
    },
  ],
  requires_admin_confirmation: true,
};

export function recommendedAnbudProfileForDomain(
  domain: string | null | undefined,
): LeadgridAnbudProfileTemplate | null {
  const normalized = String(domain ?? "")
    .trim()
    .toLocaleLowerCase("nb-NO")
    .replace(/^www\./, "");
  return normalized === "tidum.no" ? TIDUM_ANBUD_PROFILE : null;
}
