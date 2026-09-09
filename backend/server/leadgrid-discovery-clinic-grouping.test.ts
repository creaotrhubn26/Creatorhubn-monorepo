import { describe, expect, it } from "vitest";

import {
  buildDiscoveryClinicGroups,
  classifyDiscoveryEntity,
  normalizeClinicLocation,
  type DiscoveryClinicGroupCandidate,
} from "./leadgrid-discovery-clinic-grouping.js";

function candidate(
  input: Partial<DiscoveryClinicGroupCandidate> &
    Pick<DiscoveryClinicGroupCandidate, "id" | "name" | "entityKind">,
): DiscoveryClinicGroupCandidate {
  return {
    organizationNumber: null,
    entityConfidence: "high",
    normalizedLocationKey: "storgata39|0182|oslo",
    address: "Storgata 39",
    websiteUrl: null,
    status: "review_ready",
    importedLeadId: null,
    ...input,
  };
}

describe("Discovery dental clinic grouping", () => {
  it("normalizes a hosted practitioner address to the physical street", () => {
    expect(
      normalizeClinicLocation({
        address: "Storgata Tannklinikk, Storgata 39",
        postalCode: "0182",
        city: "Oslo",
      }),
    ).toBe("storgata39|0182|oslo");
  });

  it("never groups city-only or post-box-like locations", () => {
    expect(
      normalizeClinicLocation({
        address: "Postboks 10",
        postalCode: "0101",
        city: "Oslo",
      }),
    ).toBeNull();
    expect(
      normalizeClinicLocation({
        address: null,
        postalCode: "0182",
        city: "Oslo",
      }),
    ).toBeNull();
  });

  it("classifies clinic brands before organization form", () => {
    expect(
      classifyDiscoveryEntity({
        name: "Sentrum Tannklinikk",
        address: "Storgata 39",
        postalCode: "0182",
        city: "Oslo",
        organizationFormCode: "ENK",
        naceCode: "86.230",
      }),
    ).toMatchObject({ kind: "clinic", confidence: "high" });
  });

  it("classifies a dental ENK and a named dentist company as practitioners", () => {
    expect(
      classifyDiscoveryEntity({
        name: "Nina Rygh Thoresen",
        organizationFormCode: "ENK",
        naceCode: "86.230",
      }),
    ).toMatchObject({ kind: "practitioner", confidence: "high" });
    expect(
      classifyDiscoveryEntity({
        name: "Tannlege Maria Engelsen AS",
        organizationFormCode: "AS",
        naceCode: "86.230",
      }),
    ).toMatchObject({ kind: "practitioner", confidence: "medium" });
  });

  it("does not apply dental assumptions to other industries", () => {
    expect(
      classifyDiscoveryEntity({
        name: "Sentrum Regnskap AS",
        address: "Storgata 39",
        postalCode: "0182",
        city: "Oslo",
        organizationFormCode: "ENK",
        naceCode: "69.201",
      }),
    ).toMatchObject({
      kind: "unknown",
      confidence: "low",
      normalizedLocationKey: null,
    });
  });

  it("groups practitioners only when exactly one clinic exists at the address", () => {
    const clinic = candidate({
      id: "clinic-a",
      name: "Storgata Tannklinikk AS",
      entityKind: "clinic",
    });
    const dentist = candidate({
      id: "dentist-a",
      name: "Tannlege Kari Nordmann",
      entityKind: "practitioner",
      address: "Storgata Tannklinikk, Storgata 39",
    });
    const groups = buildDiscoveryClinicGroups([clinic, dentist]);

    expect(groups.get("clinic-a")).toMatchObject({
      role: "clinic_account",
      practitioners: [
        { candidate_id: "dentist-a", relationship_confidence: "high" },
      ],
    });
    expect(groups.get("dentist-a")).toMatchObject({
      role: "practitioner_contact",
      clinic_candidate_id: "clinic-a",
      clinic_name: "Storgata Tannklinikk AS",
    });
  });

  it("leaves a shared address with multiple clinics ambiguous", () => {
    const groups = buildDiscoveryClinicGroups([
      candidate({ id: "clinic-a", name: "Klinikk A", entityKind: "clinic" }),
      candidate({ id: "clinic-b", name: "Klinikk B", entityKind: "clinic" }),
      candidate({
        id: "dentist-a",
        name: "Tannlege A",
        entityKind: "practitioner",
      }),
    ]);

    expect(groups.get("dentist-a")).toMatchObject({
      role: "ambiguous",
      evidence: ["multiple_clinics_at_location"],
    });
    expect(groups.get("clinic-a")?.practitioners).toEqual([]);
  });

  it("keeps an ungrouped practitioner as an independent-practice lead", () => {
    const dentist = candidate({
      id: "dentist-a",
      name: "Tannlege A",
      entityKind: "practitioner",
      normalizedLocationKey: "annenvei1|0123|oslo",
    });
    expect(
      buildDiscoveryClinicGroups([dentist]).get("dentist-a"),
    ).toMatchObject({
      role: "independent_practice",
    });
  });
});
