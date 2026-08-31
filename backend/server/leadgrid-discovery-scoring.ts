import { computeScore, type FactorValue } from "./integrations/score-model.js";

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
  modelVersion: "discovery-fit-v3-brreg";
}

const FIT_WEIGHTS: Record<string, number> = {
  industry_relevance: 45,
  geography: 25,
  company_status: 30,
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
  const geoValue =
    input.radiusMeters === null || input.distanceMeters === null
      ? null
      : input.distanceMeters <= input.radiusMeters
        ? Math.max(0.6, 1 - (input.distanceMeters / input.radiusMeters) * 0.4)
        : 0;
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
      missingReason: geoValue === null ? "Ingen målt avstand" : undefined,
      evidence:
        input.distanceMeters === null
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

  const fit = computeScore(fitFactors, FIT_WEIGHTS);
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
    excluded: exclusionMatches.length > 0 || belowMinimum,
    exclusionMatches,
    reasons,
    factors: { fit: fitFactors, dataQuality: dataQualityFactors },
    explanation: {
      fit_contributions: fit.contributions,
      data_quality_contributions: dataQuality.contributions,
      exclusion_matches: exclusionMatches,
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
    modelVersion: "discovery-fit-v3-brreg",
  };
}
