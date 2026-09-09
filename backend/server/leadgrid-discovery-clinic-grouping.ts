export type DiscoveryEntityKind = "clinic" | "practitioner" | "unknown";
export type DiscoveryClassificationConfidence = "high" | "medium" | "low";
export type DiscoveryClinicLeadRole =
  | "clinic_account"
  | "practitioner_contact"
  | "independent_practice"
  | "ambiguous";

export interface DiscoveryDentalEntityInput {
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  organizationFormCode?: string | null;
  naceCode?: string | null;
  naceDescription?: string | null;
  employeeCount?: number | null;
  website?: string | null;
}

export interface DiscoveryEntityClassification {
  kind: DiscoveryEntityKind;
  confidence: DiscoveryClassificationConfidence;
  evidence: string[];
  normalizedLocationKey: string | null;
}

export interface DiscoveryClinicGroupCandidate {
  id: string;
  name: string;
  organizationNumber: string | null;
  entityKind: DiscoveryEntityKind;
  entityConfidence: DiscoveryClassificationConfidence;
  normalizedLocationKey: string | null;
  address: string | null;
  websiteUrl: string | null;
  status: string;
  importedLeadId: string | null;
}

export interface DiscoveryClinicPractitioner {
  candidate_id: string;
  name: string;
  organization_number: string | null;
  relationship_confidence: "high" | "medium";
  evidence: string[];
}

export interface DiscoveryClinicGroup {
  role: DiscoveryClinicLeadRole;
  clinic_candidate_id: string | null;
  clinic_name: string | null;
  clinic_lead_id: string | null;
  relationship_confidence: "high" | "medium" | null;
  evidence: string[];
  practitioners: DiscoveryClinicPractitioner[];
}

const CLINIC_NAME_PATTERN =
  /\b(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT|ODONTOLOGISK\s+KLINIKK|KLINIKKDRIFT|TANNLEGE\s+TEAM)\b/u;
const CLINIC_ADDRESS_PATTERN =
  /\b(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT)\b/u;
const DENTAL_NAME_PATTERN = /\b(TANN|DENTAL|ODONTOLOG)\w*/u;
const PRACTITIONER_NAME_PATTERN = /^TANNLEGE(?:\s+DR\.?)?\s+/u;

function normalizedText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleUpperCase("nb-NO")
    .replaceAll("Æ", "A")
    .replaceAll("Ø", "O")
    .replaceAll("Å", "A")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactLocationPart(value: string | null | undefined): string {
  return normalizedText(value).replaceAll(" ", "").toLocaleLowerCase("nb-NO");
}

function streetAddressPart(address: string | null | undefined): string | null {
  const parts = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const street = [...parts].reverse().find((part) => /\d/u.test(part));
  if (street && /^(POSTBOKS|PB)\b/iu.test(street)) return null;
  if (street) return street;
  const fallback = (address ?? "").trim();
  return /\d/u.test(fallback) && !/^(POSTBOKS|PB)\b/iu.test(fallback)
    ? fallback
    : null;
}

/**
 * Conservative physical-location identity used only for clinic grouping.
 * A street number is mandatory; city-only or post-box addresses are never
 * grouped. The last numbered address segment lets
 * "Storgata Tannklinikk, Storgata 39" match "Storgata 39".
 */
export function normalizeClinicLocation(input: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string | null {
  const street = streetAddressPart(input.address);
  if (!street) return null;
  const normalizedStreet = compactLocationPart(street);
  const postalCode = compactLocationPart(input.postalCode);
  const city = compactLocationPart(input.city);
  if (!normalizedStreet || (!postalCode && !city)) return null;
  return [normalizedStreet, postalCode, city].join("|");
}

function isDental(input: DiscoveryDentalEntityInput): boolean {
  if (input.naceCode === "86.230") return true;
  return /TANN|DENTAL|ODONTOLOG/u.test(normalizedText(input.naceDescription));
}

export function classifyDiscoveryEntity(
  input: DiscoveryDentalEntityInput,
): DiscoveryEntityClassification {
  const normalizedName = normalizedText(input.name);
  const normalizedAddress = normalizedText(input.address);
  if (!isDental(input)) {
    return {
      kind: "unknown",
      confidence: "low",
      evidence: ["not_dental_specific"],
      normalizedLocationKey: null,
    };
  }
  const normalizedLocationKey = normalizeClinicLocation(input);

  if (CLINIC_NAME_PATTERN.test(normalizedName)) {
    return {
      kind: "clinic",
      confidence: "high",
      evidence: ["public_clinic_name"],
      normalizedLocationKey,
    };
  }

  if (CLINIC_ADDRESS_PATTERN.test(normalizedAddress)) {
    return {
      kind: "practitioner",
      confidence: "high",
      evidence: ["clinic_named_in_registered_address"],
      normalizedLocationKey,
    };
  }

  const organizationForm = normalizedText(input.organizationFormCode);
  if (organizationForm === "ENK") {
    return {
      kind: "practitioner",
      confidence: "high",
      evidence: ["sole_proprietorship_dental_entity"],
      normalizedLocationKey,
    };
  }

  if (PRACTITIONER_NAME_PATTERN.test(normalizedName)) {
    return {
      kind: "practitioner",
      confidence: "medium",
      evidence: ["named_dentist_entity"],
      normalizedLocationKey,
    };
  }

  if (
    DENTAL_NAME_PATTERN.test(normalizedName) &&
    ((input.employeeCount ?? 0) >= 2 || Boolean(input.website))
  ) {
    return {
      kind: "clinic",
      confidence: "medium",
      evidence: [
        (input.employeeCount ?? 0) >= 2
          ? "dental_entity_with_employees"
          : "dental_entity_with_public_website",
      ],
      normalizedLocationKey,
    };
  }

  return {
    kind: "unknown",
    confidence: "low",
    evidence: ["insufficient_clinic_identity_evidence"],
    normalizedLocationKey,
  };
}

function relationshipEvidence(
  practitioner: DiscoveryClinicGroupCandidate,
  clinic: DiscoveryClinicGroupCandidate,
): { confidence: "high" | "medium"; evidence: string[] } {
  const evidence = ["same_normalized_address", "only_clinic_at_location"];
  const registeredAddress = normalizedText(practitioner.address);
  const clinicName = normalizedText(clinic.name);
  const clinicNameWords = clinicName
    .split(" ")
    .filter(
      (word) =>
        word.length >= 5 &&
        !["TANNKLINIKK", "TANNLEGESENTER", "TANNHELSE"].includes(word),
    );
  const clinicNamedInAddress =
    CLINIC_ADDRESS_PATTERN.test(registeredAddress) ||
    clinicNameWords.some((word) => registeredAddress.includes(word));
  if (clinicNamedInAddress)
    evidence.push("clinic_identity_in_registered_address");
  return {
    confidence: clinicNamedInAddress ? "high" : "medium",
    evidence,
  };
}

/**
 * Groups only when one physical location has exactly one clinic candidate.
 * Multiple clinics at the same address are intentionally left ambiguous.
 */
export function buildDiscoveryClinicGroups(
  candidates: DiscoveryClinicGroupCandidate[],
): Map<string, DiscoveryClinicGroup> {
  const byLocation = new Map<string, DiscoveryClinicGroupCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.normalizedLocationKey) continue;
    const current = byLocation.get(candidate.normalizedLocationKey) ?? [];
    current.push(candidate);
    byLocation.set(candidate.normalizedLocationKey, current);
  }

  const result = new Map<string, DiscoveryClinicGroup>();
  for (const candidate of candidates) {
    const locationCandidates = candidate.normalizedLocationKey
      ? (byLocation.get(candidate.normalizedLocationKey) ?? [])
      : [];
    const clinics = locationCandidates.filter(
      (entry) =>
        entry.entityKind === "clinic" &&
        !["rejected", "archived", "failed"].includes(entry.status),
    );

    if (candidate.entityKind === "clinic") {
      const isOnlyClinic =
        clinics.length === 1 && clinics[0]?.id === candidate.id;
      const practitioners = isOnlyClinic
        ? locationCandidates
            .filter(
              (entry) =>
                entry.entityKind === "practitioner" &&
                !["rejected", "archived", "failed", "imported"].includes(
                  entry.status,
                ),
            )
            .map((entry) => {
              const relationship = relationshipEvidence(entry, candidate);
              return {
                candidate_id: entry.id,
                name: entry.name,
                organization_number: entry.organizationNumber,
                relationship_confidence: relationship.confidence,
                evidence: relationship.evidence,
              } satisfies DiscoveryClinicPractitioner;
            })
            .sort((left, right) => left.name.localeCompare(right.name, "nb-NO"))
        : [];
      result.set(candidate.id, {
        role: clinics.length > 1 ? "ambiguous" : "clinic_account",
        clinic_candidate_id: candidate.id,
        clinic_name: candidate.name,
        clinic_lead_id: candidate.importedLeadId,
        relationship_confidence: null,
        evidence:
          clinics.length > 1
            ? ["multiple_clinics_at_location"]
            : ["classified_clinic_account"],
        practitioners,
      });
      continue;
    }

    if (candidate.entityKind === "practitioner" && clinics.length === 1) {
      const clinic = clinics[0] as DiscoveryClinicGroupCandidate;
      const relationship = relationshipEvidence(candidate, clinic);
      result.set(candidate.id, {
        role: "practitioner_contact",
        clinic_candidate_id: clinic.id,
        clinic_name: clinic.name,
        clinic_lead_id: clinic.importedLeadId,
        relationship_confidence: relationship.confidence,
        evidence: relationship.evidence,
        practitioners: [],
      });
      continue;
    }

    result.set(candidate.id, {
      role:
        candidate.entityKind === "practitioner" && clinics.length === 0
          ? "independent_practice"
          : "ambiguous",
      clinic_candidate_id: null,
      clinic_name: null,
      clinic_lead_id: null,
      relationship_confidence: null,
      evidence:
        clinics.length > 1
          ? ["multiple_clinics_at_location"]
          : candidate.normalizedLocationKey
            ? ["no_clinic_candidate_at_location"]
            : ["insufficient_location_evidence"],
      practitioners: [],
    });
  }
  return result;
}
