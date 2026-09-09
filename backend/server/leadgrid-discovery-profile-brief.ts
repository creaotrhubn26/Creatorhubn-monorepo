import {
  discoveryBriefSchema,
  type DiscoveryBrief,
} from "./leadgrid-discovery-contract.js";

export interface DiscoveryProfileBriefSource {
  target_customer_types: string[];
  city_filters: string[];
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number;
  company_size_min: number | null;
  company_size_max: number | null;
  max_candidates_per_run: number;
  enrichment_count: number;
  brief: Record<string, unknown> | null;
}

export function canonicalDiscoveryProfileBrief(
  row: DiscoveryProfileBriefSource,
): DiscoveryBrief {
  const storedBrief = row.brief ?? {};
  const strings = (value: unknown, maximum: number): string[] =>
    Array.isArray(value)
      ? value.flatMap((entry) => {
          if (typeof entry !== "string") return [];
          const normalized = entry.trim();
          return normalized && normalized.length <= maximum ? [normalized] : [];
        })
      : [];
  const municipalityNumbers = [
    ...new Set(
      strings(storedBrief.municipality_numbers, 4).filter((value) =>
        /^\d{4}$/.test(value),
      ),
    ),
  ];
  const municipalityNames = [
    ...new Set(strings(storedBrief.municipality_names, 120)),
  ];
  const hasMunicipalities =
    municipalityNumbers.length > 0 || municipalityNames.length > 0;
  const latitude =
    row.geography_lat === null ? null : Number(row.geography_lat);
  const longitude =
    row.geography_lng === null ? null : Number(row.geography_lng);
  const geo =
    !hasMunicipalities &&
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
      ? {
          latitude,
          longitude,
          radius_km: row.geography_radius_km,
        }
      : null;
  const storedCity =
    typeof storedBrief.city === "string" && storedBrief.city.trim()
      ? storedBrief.city.trim()
      : null;
  const city =
    hasMunicipalities || geo
      ? null
      : (storedCity ?? row.city_filters[0] ?? null);
  const countryCode =
    !hasMunicipalities && !geo && !city && storedBrief.country_code === "NO"
      ? "NO"
      : !hasMunicipalities && !geo && !city
        ? "NO"
        : null;
  const minimumFitScore =
    typeof storedBrief.minimum_fit_score === "number"
      ? storedBrief.minimum_fit_score
      : Number.NaN;
  const idealCustomer =
    typeof storedBrief.ideal_customer === "string" &&
    storedBrief.ideal_customer.trim()
      ? storedBrief.ideal_customer.trim()
      : null;
  const goal =
    typeof storedBrief.goal === "string" && storedBrief.goal.trim()
      ? storedBrief.goal.trim()
      : null;
  const territoryCode =
    typeof storedBrief.territory_code === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storedBrief.territory_code)
      ? storedBrief.territory_code
      : null;
  const organizationForms = [
    ...new Set(
      strings(storedBrief.organization_forms, 8)
        .map((value) => value.toUpperCase())
        .filter((value) => /^[A-Z0-9]{2,8}$/.test(value)),
    ),
  ].sort();
  const storedEmployeeCount =
    storedBrief.employee_count &&
    typeof storedBrief.employee_count === "object" &&
    !Array.isArray(storedBrief.employee_count)
      ? (storedBrief.employee_count as Record<string, unknown>)
      : {};
  const employeeMinimum =
    typeof storedEmployeeCount.minimum === "number"
      ? storedEmployeeCount.minimum
      : (row.company_size_min ?? null);
  const employeeMaximum =
    typeof storedEmployeeCount.maximum === "number"
      ? storedEmployeeCount.maximum
      : (row.company_size_max ?? null);
  const organizationStructure =
    storedBrief.organization_structure === "independent" ||
    storedBrief.organization_structure === "chain"
      ? storedBrief.organization_structure
      : "any";
  const websiteRequirement =
    storedBrief.website_requirement === "present" ||
    storedBrief.website_requirement === "missing"
      ? storedBrief.website_requirement
      : "any";
  const websiteQuality =
    storedBrief.website_quality &&
    typeof storedBrief.website_quality === "object" &&
    !Array.isArray(storedBrief.website_quality)
      ? (storedBrief.website_quality as Record<string, unknown>)
      : {};
  const minimumWebsiteQualityScore =
    typeof websiteQuality.minimum_score === "number" &&
    Number.isInteger(websiteQuality.minimum_score) &&
    websiteQuality.minimum_score >= 0 &&
    websiteQuality.minimum_score <= 100
      ? websiteQuality.minimum_score
      : null;
  const commercial =
    storedBrief.commercial_signals &&
    typeof storedBrief.commercial_signals === "object" &&
    !Array.isArray(storedBrief.commercial_signals)
      ? (storedBrief.commercial_signals as Record<string, unknown>)
      : {};
  const explicitBoolean = (value: unknown): boolean | null =>
    typeof value === "boolean" ? value : null;

  return discoveryBriefSchema.parse({
    industry_queries: row.target_customer_types,
    organization_name_queries: strings(
      storedBrief.organization_name_queries,
      120,
    ),
    exclusion_terms: strings(storedBrief.exclusion_terms, 80),
    country_code: countryCode,
    city,
    geo,
    territory_code: territoryCode,
    municipality_numbers: municipalityNumbers,
    municipality_names: municipalityNames,
    target_count: row.max_candidates_per_run,
    enrichment_count: row.enrichment_count,
    minimum_fit_score:
      Number.isInteger(minimumFitScore) &&
      minimumFitScore >= 0 &&
      minimumFitScore <= 100
        ? minimumFitScore
        : 50,
    ideal_customer: idealCustomer,
    goal,
    organization_forms: organizationForms,
    employee_count:
      employeeMinimum === null && employeeMaximum === null
        ? null
        : { minimum: employeeMinimum, maximum: employeeMaximum },
    organization_structure: organizationStructure,
    website_requirement: websiteRequirement,
    website_quality: { minimum_score: minimumWebsiteQualityScore },
    commercial_signals: {
      registered_in_vat_register: explicitBoolean(
        commercial.registered_in_vat_register,
      ),
      registered_in_business_register: explicitBoolean(
        commercial.registered_in_business_register,
      ),
    },
  });
}
