import { computeScore, type FactorValue } from "./integrations/score-model.js";
import type { DiscoveryWebsiteQualityAssessment } from "./leadgrid-discovery-brreg-provider.js";

export interface DiscoveryScoreInput {
  candidateName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  radiusMeters: number | null;
  naceCode: string | null;
  naceDescription: string | null;
  website: string | null;
  phone: string | null;
  organizationNumber: string | null;
  companyStatus: "active" | "in_liquidation" | "bankrupt" | null;
  industryQueries: string[];
  municipalityNumber?: string | null;
  requiredMunicipalityNumbers?: string[];
  organizationFormCode?: string | null;
  requiredOrganizationForms?: string[];
  employeeCount?: number | null;
  employeeCountKnown?: boolean;
  minimumEmployees?: number | null;
  maximumEmployees?: number | null;
  organizationStructure?: "independent" | "chain" | "unknown";
  requiredOrganizationStructure?: "any" | "independent" | "chain";
  organizationStructureEvidence?: {
    sourceUri: string;
    basis: string;
    relatedOrganizationCount: number | null;
  } | null;
  websiteRequirement?: "any" | "present" | "missing";
  minimumWebsiteQualityScore?: number | null;
  websiteQuality?: DiscoveryWebsiteQualityAssessment | null;
  qualificationTerms?: string[];
  qualificationRequirement?: "preferred" | "required";
  registeredInVatRegister?: boolean;
  registeredInVatRegisterKnown?: boolean;
  requiredVatRegistration?: boolean | null;
  registeredInBusinessRegister?: boolean;
  registeredInBusinessRegisterKnown?: boolean;
  requiredBusinessRegistration?: boolean | null;
  idealCustomer?: string | null;
  exclusionTerms: string[];
  minimumFitScore?: number | null;
  websiteKnown?: boolean;
  phoneKnown?: boolean;
  organizationNumberKnown?: boolean;
}

export interface DiscoveryCandidateScore {
  fitScore: number | null;
  fitCoverage: number;
  dataQualityScore: number | null;
  dataQualityCoverage: number;
  excluded: boolean;
  exclusionMatches: string[];
  reasons: string[];
  factors: { fit: FactorValue[]; dataQuality: FactorValue[] };
  explanation: Record<string, unknown>;
  modelVersion: "discovery-fit-v4-profile-evidence";
}

const FIT_WEIGHTS: Record<string, number> = {
  industry_relevance: 45,
  geography: 25,
  company_status: 30,
};

const PROFILE_FILTER_WEIGHTS: Record<string, number> = {
  organization_form: 15,
  employee_count: 15,
  organization_structure: 12,
  website_presence: 8,
  website_quality: 15,
  vat_registration: 10,
  business_register_registration: 10,
  content_qualification: 20,
};

const QUALITY_WEIGHTS: Record<string, number> = {
  source_identity: 20,
  address: 15,
  location: 20,
  website: 15,
  phone: 10,
  organization_number: 20,
};

function tokens(value: string): string[] {
  return value
    .toLocaleLowerCase("nb-NO")
    .split(/[^a-z0-9æøå]+/)
    .filter((token) => token.length >= 3);
}

function exclusions(input: DiscoveryScoreInput): string[] {
  const haystack = [
    input.candidateName,
    input.address,
    input.naceCode,
    input.naceDescription,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("nb-NO");
  return input.exclusionTerms.filter((term) =>
    haystack.includes(term.toLocaleLowerCase("nb-NO")),
  );
}

function lexicalRelevance(input: DiscoveryScoreInput): number | null {
  const candidateTokens = new Set(
    tokens(
      [input.candidateName, input.naceCode, input.naceDescription]
        .filter(Boolean)
        .join(" "),
    ),
  );
  const queryTokens = [
    ...input.industryQueries,
    ...(input.idealCustomer ? [input.idealCustomer] : []),
  ].flatMap(tokens);
  if (queryTokens.length === 0) return null;
  const matches = queryTokens.filter((token) =>
    candidateTokens.has(token),
  ).length;
  // Being returned for the query is real, but weak, evidence even when the
  // provider category has no literal token overlap.
  return matches > 0 ? Math.min(1, 0.65 + matches * 0.15) : 0.55;
}

function qualityFactor(
  key: string,
  present: boolean,
  known: boolean,
  evidence: FactorValue["evidence"] = [],
): FactorValue {
  return {
    key,
    value: present ? 1 : known ? 0 : null,
    missingReason:
      !present && !known
        ? "Feltet er ikke undersøkt av valgte kilder"
        : undefined,
    evidence,
  };
}

export function scoreDiscoveryCandidate(
  input: DiscoveryScoreInput,
): DiscoveryCandidateScore {
  const exclusionMatches = exclusions(input);
  const filterMismatches: string[] = [];
  const unknownFilterEvidence: string[] = [];
  const fitWeights = { ...FIT_WEIGHTS };
  const requiredMunicipalityNumbers = input.requiredMunicipalityNumbers ?? [];
  const geoValue =
    requiredMunicipalityNumbers.length > 0
      ? input.municipalityNumber
        ? requiredMunicipalityNumbers.includes(input.municipalityNumber)
          ? 1
          : 0
        : null
      : input.radiusMeters === null || input.distanceMeters === null
        ? null
        : input.distanceMeters <= input.radiusMeters
          ? Math.max(0.6, 1 - (input.distanceMeters / input.radiusMeters) * 0.4)
          : 0;
  if (requiredMunicipalityNumbers.length > 0 && geoValue === 0) {
    filterMismatches.push("municipality");
  } else if (requiredMunicipalityNumbers.length > 0 && geoValue === null) {
    unknownFilterEvidence.push("municipality");
  }
  const companyValue =
    input.companyStatus === "active"
      ? 1
      : input.companyStatus === "in_liquidation"
        ? 0.15
        : input.companyStatus === "bankrupt"
          ? 0
          : null;

  const fitFactors: FactorValue[] = [
    {
      key: "industry_relevance",
      value: exclusionMatches.length ? 0 : lexicalRelevance(input),
      evidence: [
        {
          ref: "discovery.brief.industry_queries",
          label: "Målsegment",
          value: input.industryQueries.join(", "),
        },
        ...(input.naceCode
          ? [
              {
                ref: "brreg.nace_code",
                label: "Næringskode",
                value: input.naceCode,
              },
            ]
          : []),
        ...(input.idealCustomer
          ? [
              {
                ref: "discovery.brief.ideal_customer",
                label: "Idealkunde",
                value: input.idealCustomer,
              },
            ]
          : []),
      ],
    },
    {
      key: "geography",
      value: geoValue,
      missingReason:
        geoValue === null
          ? requiredMunicipalityNumbers.length > 0
            ? "Kommunenummer mangler i registeradressen"
            : "Ingen målt avstand"
          : undefined,
      evidence:
        requiredMunicipalityNumbers.length > 0
          ? input.municipalityNumber
            ? [
                {
                  ref: "brreg.business_address.municipality_number",
                  label: "Kommunenummer",
                  value: input.municipalityNumber,
                },
              ]
            : []
          : input.distanceMeters === null
            ? []
            : [
                {
                  ref: "geonorge.address_location",
                  label: "Avstand (meter)",
                  value: Math.round(input.distanceMeters),
                },
              ],
    },
    {
      key: "company_status",
      value: companyValue,
      missingReason:
        companyValue === null
          ? "Foretaksstatus er ikke tilgjengelig"
          : undefined,
      evidence: input.companyStatus
        ? [
            {
              ref: "brreg.company_status",
              label: "Foretaksstatus",
              value: input.companyStatus,
            },
          ]
        : [],
    },
  ];

  const appendProfileFactor = (
    key: keyof typeof PROFILE_FILTER_WEIGHTS,
    value: number | null,
    missingReason: string,
    evidence: FactorValue["evidence"],
    hardFilter = true,
  ): void => {
    fitWeights[key] = PROFILE_FILTER_WEIGHTS[key];
    fitFactors.push({
      key,
      value,
      missingReason: value === null ? missingReason : undefined,
      evidence,
    });
    if (value === 0 && hardFilter) filterMismatches.push(key);
    if (value === null) unknownFilterEvidence.push(key);
  };

  const requiredOrganizationForms = input.requiredOrganizationForms ?? [];
  if (requiredOrganizationForms.length > 0) {
    const organizationFormCode =
      input.organizationFormCode?.toUpperCase() ?? null;
    appendProfileFactor(
      "organization_form",
      organizationFormCode
        ? requiredOrganizationForms.includes(organizationFormCode)
          ? 1
          : 0
        : null,
      "Organisasjonsform mangler i registerdata",
      [
        {
          ref: "discovery.brief.organization_forms",
          label: "Tillatte organisasjonsformer",
          value: requiredOrganizationForms.join(", "),
        },
        ...(organizationFormCode
          ? [
              {
                ref: "brreg.organization_form.code",
                label: "Organisasjonsform",
                value: organizationFormCode,
              },
            ]
          : []),
      ],
    );
  }

  if (input.minimumEmployees != null || input.maximumEmployees != null) {
    const employeeCountKnown =
      input.employeeCountKnown === true &&
      input.employeeCount != null &&
      Number.isFinite(input.employeeCount);
    const employeeMatches =
      employeeCountKnown &&
      (input.minimumEmployees == null ||
        (input.employeeCount as number) >= input.minimumEmployees) &&
      (input.maximumEmployees == null ||
        (input.employeeCount as number) <= input.maximumEmployees);
    const requestedRange = [
      input.minimumEmployees == null
        ? null
        : "min " + String(input.minimumEmployees),
      input.maximumEmployees == null
        ? null
        : "maks " + String(input.maximumEmployees),
    ]
      .filter((value): value is string => value !== null)
      .join(", ");
    appendProfileFactor(
      "employee_count",
      employeeCountKnown ? (employeeMatches ? 1 : 0) : null,
      "Antall ansatte er ikke eksplisitt registrert",
      [
        {
          ref: "discovery.brief.employee_count",
          label: "Ønsket antall ansatte",
          value: requestedRange,
        },
        ...(employeeCountKnown
          ? [
              {
                ref: "brreg.employee_count",
                label: "Registrert antall ansatte",
                value: input.employeeCount as number,
              },
            ]
          : []),
      ],
    );
  }

  const requiredStructure = input.requiredOrganizationStructure ?? "any";
  if (requiredStructure !== "any") {
    const observedStructure = input.organizationStructure ?? "unknown";
    const structureKnown = observedStructure !== "unknown";
    appendProfileFactor(
      "organization_structure",
      structureKnown ? (observedStructure === requiredStructure ? 1 : 0) : null,
      "Brreg har ikke eksplisitt evidens om konserntilknytning for virksomheten",
      [
        {
          ref: "discovery.brief.organization_structure",
          label: "Ønsket Brreg-konserntilknytning",
          value: requiredStructure,
        },
        ...(input.organizationStructureEvidence
          ? [
              {
                ref: "brreg.group_structure",
                label: "Brreg-konserntilknytning",
                value:
                  observedStructure === "chain"
                    ? "group_affiliation_observed"
                    : observedStructure === "independent"
                      ? "single_entity_observed"
                      : "unknown",
              },
              {
                ref: "brreg.group_structure.source_uri",
                label: "Kilde",
                value: input.organizationStructureEvidence.sourceUri,
              },
            ]
          : []),
      ],
    );
  }

  const websiteRequirement = input.websiteRequirement ?? "any";
  if (websiteRequirement !== "any") {
    const websiteKnown = Boolean(input.website) || input.websiteKnown === true;
    const hasWebsite = Boolean(input.website);
    appendProfileFactor(
      "website_presence",
      websiteKnown
        ? websiteRequirement === "present"
          ? hasWebsite
            ? 1
            : 0
          : hasWebsite
            ? 0
            : 1
        : null,
      "Nettsidetilstedeværelse er ikke undersøkt",
      [
        {
          ref: "discovery.brief.website_requirement",
          label: "Nettsidekrav",
          value: websiteRequirement,
        },
        ...(websiteKnown
          ? [
              {
                ref: "brreg.website",
                label: "Registrert nettadresse",
                value: input.website ?? "mangler",
              },
            ]
          : []),
      ],
    );
  }

  const minimumWebsiteQualityScore = input.minimumWebsiteQualityScore ?? null;
  if (minimumWebsiteQualityScore !== null) {
    const assessment = input.websiteQuality;
    const qualityKnown =
      assessment?.status === "assessed" &&
      typeof assessment.score === "number" &&
      Number.isFinite(assessment.score);
    const score = qualityKnown ? (assessment?.score as number) : null;
    appendProfileFactor(
      "website_quality",
      score === null
        ? null
        : score >= minimumWebsiteQualityScore
          ? score / 100
          : 0,
      "Nettsidekvalitet kunne ikke vurderes sikkert",
      [
        {
          ref: "discovery.brief.website_quality.minimum_score",
          label: "Minste nettsidekvalitet",
          value: minimumWebsiteQualityScore,
        },
        ...(score !== null && assessment
          ? [
              {
                ref: "discovery.website_quality.score",
                label: "Målt nettsidekvalitet",
                value: score,
              },
              {
                ref: "discovery.website_quality.source_uri",
                label: "Analysert registrert nettadresse",
                value: assessment.sourceUri,
              },
            ]
          : []),
      ],
    );
  }

  const qualificationTerms = input.qualificationTerms ?? [];
  const qualificationMatches =
    input.websiteQuality?.qualification?.matchedTerms ?? [];
  if (qualificationTerms.length > 0) {
    const assessed = input.websiteQuality?.status === "assessed";
    appendProfileFactor(
      "content_qualification",
      assessed
        ? qualificationMatches.length > 0
          ? Math.min(1, 0.7 + qualificationMatches.length * 0.1)
          : 0
        : null,
      "Nettstedets innhold kunne ikke kvalifiseres sikkert",
      [
        {
          ref: "discovery.brief.qualification_terms",
          label: "Kvalifiseringstema",
          value: qualificationTerms.join(", "),
        },
        ...(qualificationMatches.length > 0
          ? [
              {
                ref: "discovery.website_quality.qualification",
                label: "Bekreftet på nettstedet",
                value: qualificationMatches.join(", "),
              },
            ]
          : []),
      ],
      input.qualificationRequirement === "required",
    );
  }

  const appendCommercialSignal = (
    key: "vat_registration" | "business_register_registration",
    required: boolean | null | undefined,
    observed: boolean | undefined,
    known: boolean | undefined,
    briefRef: string,
    sourceRef: string,
    label: string,
  ): void => {
    if (required == null) return;
    appendProfileFactor(
      key,
      known === true && typeof observed === "boolean"
        ? observed === required
          ? 1
          : 0
        : null,
      label + " er ikke eksplisitt oppgitt i registerdata",
      [
        {
          ref: briefRef,
          label: "Krav: " + label,
          value: String(required),
        },
        ...(known === true && typeof observed === "boolean"
          ? [{ ref: sourceRef, label, value: String(observed) }]
          : []),
      ],
    );
  };
  appendCommercialSignal(
    "vat_registration",
    input.requiredVatRegistration,
    input.registeredInVatRegister,
    input.registeredInVatRegisterKnown,
    "discovery.brief.commercial_signals.registered_in_vat_register",
    "brreg.registered_in_vat_register",
    "Registrert i Merverdiavgiftsregisteret",
  );
  appendCommercialSignal(
    "business_register_registration",
    input.requiredBusinessRegistration,
    input.registeredInBusinessRegister,
    input.registeredInBusinessRegisterKnown,
    "discovery.brief.commercial_signals.registered_in_business_register",
    "brreg.registered_in_business_register",
    "Registrert i Foretaksregisteret",
  );

  const dataQualityFactors: FactorValue[] = [
    qualityFactor(
      "source_identity",
      Boolean(input.organizationNumber),
      true,
      input.organizationNumber
        ? [
            {
              ref: "brreg.org_number",
              label: "Registeridentitet",
              value: input.organizationNumber,
            },
          ]
        : [],
    ),
    qualityFactor(
      "address",
      Boolean(input.address),
      true,
      input.address
        ? [
            {
              ref: "brreg.business_address",
              label: "Adresse",
              value: input.address,
            },
          ]
        : [],
    ),
    qualityFactor(
      "location",
      input.latitude !== null && input.longitude !== null,
      true,
    ),
    qualityFactor(
      "website",
      Boolean(input.website),
      Boolean(input.website) || input.websiteKnown === true,
      input.website
        ? [{ ref: "brreg.website", label: "Nettside", value: input.website }]
        : [],
    ),
    qualityFactor(
      "phone",
      Boolean(input.phone),
      Boolean(input.phone) || input.phoneKnown === true,
      input.phone
        ? [{ ref: "brreg.phone", label: "Telefon", value: input.phone }]
        : [],
    ),
    qualityFactor(
      "organization_number",
      Boolean(input.organizationNumber),
      Boolean(input.organizationNumber) ||
        input.organizationNumberKnown === true,
      input.organizationNumber
        ? [
            {
              ref: "brreg.org_number",
              label: "Organisasjonsnummer",
              value: input.organizationNumber,
            },
          ]
        : [],
    ),
  ];

  const fit = computeScore(fitFactors, fitWeights);
  const dataQuality = computeScore(dataQualityFactors, QUALITY_WEIGHTS);
  const belowMinimum =
    fit.score !== null &&
    input.minimumFitScore != null &&
    fit.score < input.minimumFitScore;
  const reasons: string[] = [];
  if (exclusionMatches.length) {
    reasons.push("Treffer ekskluderingen " + exclusionMatches.join(", "));
  }
  if (geoValue !== null && geoValue > 0) {
    reasons.push("Ligger innenfor valgt område");
  }
  if (companyValue === 1) {
    reasons.push("Aktivt foretak bekreftet i Brønnøysundregistrene");
  }
  if (input.website) reasons.push("Har registrert nettsted");
  if (input.organizationNumber) {
    reasons.push("Har bekreftet organisasjonsnummer");
  }
  if (qualificationMatches.length > 0) {
    reasons.push(
      "Nettstedet bekrefter: " + qualificationMatches.join(", "),
    );
  }
  if (filterMismatches.length) {
    reasons.push("Matcher ikke profilfilter: " + filterMismatches.join(", "));
  }
  if (unknownFilterEvidence.length) {
    reasons.push(
      "Mangler sikker evidens for: " + unknownFilterEvidence.join(", "),
    );
  }
  if (belowMinimum) {
    reasons.push(
      `Fit-score ${fit.score} er under valgt minstegrense ${input.minimumFitScore}`,
    );
  }

  return {
    fitScore: fit.score,
    fitCoverage: fit.coverage,
    dataQualityScore: dataQuality.score,
    dataQualityCoverage: dataQuality.coverage,
    excluded:
      exclusionMatches.length > 0 ||
      filterMismatches.length > 0 ||
      belowMinimum,
    exclusionMatches,
    reasons,
    factors: { fit: fitFactors, dataQuality: dataQualityFactors },
    explanation: {
      fit_contributions: fit.contributions,
      data_quality_contributions: dataQuality.contributions,
      exclusion_matches: exclusionMatches,
      filter_mismatches: filterMismatches,
      unknown_filter_evidence: unknownFilterEvidence,
      website_quality: input.websiteQuality
        ? {
            status: input.websiteQuality.status,
            score: input.websiteQuality.score,
            minimum_score: minimumWebsiteQualityScore,
            outcome:
              input.websiteQuality.status !== "assessed" ||
              input.websiteQuality.score === null
                ? "unknown"
                : minimumWebsiteQualityScore !== null &&
                    input.websiteQuality.score < minimumWebsiteQualityScore
                  ? "excluded"
                  : "passed",
            reason: input.websiteQuality.reason,
            evidence: {
              source_uri: input.websiteQuality.sourceUri,
              final_url: input.websiteQuality.finalUrl,
              fetched_at: input.websiteQuality.fetchedAt,
              http_status: input.websiteQuality.httpStatus,
              redirect_count: input.websiteQuality.redirectCount,
              signals: input.websiteQuality.signals,
            },
          }
        : {
            status:
              minimumWebsiteQualityScore === null ? "not_requested" : "unknown",
            score: null,
            minimum_score: minimumWebsiteQualityScore,
            reason:
              minimumWebsiteQualityScore === null
                ? "not_requested"
                : "not_assessed",
          },
      content_qualification:
        qualificationTerms.length > 0
          ? {
              requirement: input.qualificationRequirement ?? "preferred",
              requested_terms: qualificationTerms,
              matched_terms: qualificationMatches,
              outcome:
                input.websiteQuality?.status !== "assessed"
                  ? "unknown"
                  : qualificationMatches.length > 0
                    ? "passed"
                    : input.qualificationRequirement === "required"
                      ? "excluded"
                      : "weak_match",
            }
          : null,
      minimum_fit_threshold:
        input.minimumFitScore == null
          ? null
          : {
              source: "discovery.brief.minimum_fit_score",
              minimum: input.minimumFitScore,
              observed: fit.score,
              outcome: belowMinimum ? "excluded" : "passed",
            },
    },
    modelVersion: "discovery-fit-v4-profile-evidence",
  };
}
