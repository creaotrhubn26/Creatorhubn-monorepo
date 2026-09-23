import { describe, expect, it } from "vitest";

import { triageCandidates } from "./leadgrid-discovery-triage.js";

function kandidat(
  id: string,
  fit: number | null,
  extra: Partial<{ phone: string | null; email: string | null; excluded: boolean }> = {},
) {
  return {
    id,
    name: id,
    fit_score: fit,
    phone: null,
    email: null,
    excluded: false,
    ...extra,
  } as never;
}

const grense = { minimumFitScore: 70 };

describe("triageCandidates", () => {
  it("gjør to hundre rader om til tre grupper", () => {
    const mange = [
      ...Array.from({ length: 120 }, (_, i) => kandidat(`svak${i}`, 60)),
      ...Array.from({ length: 60 }, (_, i) => kandidat(`klar${i}`, 85, { phone: "1" })),
      ...Array.from({ length: 20 }, (_, i) => kandidat(`uviss${i}`, 80)),
    ];
    const ut = triageCandidates(mange, grense);
    expect(ut.pending_count).toBe(200);
    expect(ut.groups.map((g) => [g.key, g.count])).toEqual([
      ["discard", 120],
      ["ready", 60],
      ["review", 20],
    ]);
  });

  it("lar bare gruppa med entydig grunnlag godkjennes samlet", () => {
    const ut = triageCandidates(
      [
        kandidat("svak", 50),
        kandidat("klar", 85, { phone: "1" }),
        kandidat("uten-kontakt", 85),
      ],
      grense,
    );
    const handling = Object.fromEntries(ut.groups.map((g) => [g.key, g.bulk_action]));
    expect(handling).toEqual({
      discard: "reject",
      ready: "approve",
      // Grunnlaget er ikke likt nok til at ett trykk kan gjelde alle.
      review: null,
    });
  });

  it("navngir konsekvensen av å godkjenne samlet", () => {
    const ut = triageCandidates(
      [kandidat("a", 85, { phone: "1" }), kandidat("b", 90, { email: "b@b.no" })],
      grense,
    );
    const klar = ut.groups.find((g) => g.key === "ready");
    expect(klar?.bulk_consequence).toContain("2 leads");
    expect(klar?.bulk_consequence).toContain("Ingenting sendes");
  });

  it("sier at avvisning kan angres", () => {
    const ut = triageCandidates([kandidat("svak", 40)], grense);
    expect(ut.groups[0].bulk_consequence).toContain("hentes fram igjen");
  });

  it("legger ekskluderte i samme gruppe uansett score", () => {
    // En kandidat som traff en ekskluderingsregel er ikke aktuell selv med
    // topp score.
    const ut = triageCandidates(
      [kandidat("ekskludert", 95, { phone: "1", excluded: true })],
      grense,
    );
    expect(ut.groups[0].key).toBe("discard");
    expect(ut.groups[0].why).toContain("ekskluderingsregel");
  });

  it("regner manglende score som uavklart, ikke som svak", () => {
    // Vi vet ikke — og da skal et menneske se, ikke et filter forkaste.
    const ut = triageCandidates([kandidat("ukjent", null, { phone: "1" })], grense);
    expect(ut.groups[0].key).toBe("review");
    expect(ut.groups[0].why).toContain("mangler score");
  });

  it("viser de best scorende i hver prøve", () => {
    const ut = triageCandidates(
      [
        kandidat("midt", 80, { phone: "1" }),
        kandidat("best", 89, { phone: "1" }),
        kandidat("lavest", 72, { phone: "1" }),
      ],
      grense,
    );
    expect(ut.groups[0].sample.map((s) => s.name)).toEqual(["best", "midt", "lavest"]);
  });

  it("holder prøven kort nok til å leses", () => {
    const ut = triageCandidates(
      Array.from({ length: 40 }, (_, i) => kandidat(`k${i}`, 85, { phone: "1" })),
      grense,
    );
    expect(ut.groups[0].sample).toHaveLength(5);
    expect(ut.groups[0].count).toBe(40);
  });

  it("tar med alle id-ene, ikke bare prøven", () => {
    // Prøven er fem navn for gjenkjennelse; handlingen må gjelde alle.
    const ut = triageCandidates(
      Array.from({ length: 40 }, (_, i) => kandidat(`k${i}`, 85, { phone: "1" })),
      grense,
    );
    expect(ut.groups[0].candidate_ids).toHaveLength(40);
    expect(ut.groups[0].sample).toHaveLength(5);
  });

  it("melder ingen grupper når det ikke er noe å ta stilling til", () => {
    expect(triageCandidates([], grense).groups).toEqual([]);
  });

  it("bruker samme skala som briefen", () => {
    // fit_score og minimum_fit_score er begge 0-100. 60 er under 70.
    const ut = triageCandidates([kandidat("seksti", 60, { phone: "1" })], grense);
    expect(ut.groups[0].key).toBe("discard");
    expect(ut.minimum_fit_score).toBe(70);
  });
});
