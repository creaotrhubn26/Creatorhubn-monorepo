import { describe, expect, it } from "vitest";
import {
  extractPolygons,
  pointInRing,
  pointInPolygon,
  pointInGeometry,
  haversineKm,
  isTerritoryActive,
  matchesAdminUnits,
  matchesPolygon,
  matchesCircle,
  leadMatchesTerritory,
  pointMatchesTerritory,
  pickBestTerritory,
  detectAdminOverlaps,
  resolveLeadTerritories,
  computeCoverage,
  summarizeManagerStats,
  type TerritoryRow,
  type LeadGeo,
  type CoverageLead,
  type ManagerMember,
} from "../leadgrid-territory-service";

// Et kvadrat rundt Oslo: lng 10..11, lat 59..60. GeoJSON = [lng, lat].
const OSLO_SQUARE = {
  type: "Polygon",
  coordinates: [[[10, 59], [11, 59], [11, 60], [10, 60], [10, 59]]],
};

function territory(over: Partial<TerritoryRow> = {}): TerritoryRow {
  return {
    id: over.id ?? "t1",
    organizationId: "org1",
    name: over.name ?? "Oslo",
    assignedUserId: over.assignedUserId ?? "seller-a",
    salesTeamId: over.salesTeamId ?? null,
    geometry: over.geometry ?? null,
    municipalities: over.municipalities ?? [],
    postalCodes: over.postalCodes ?? [],
    centerLat: over.centerLat ?? null,
    centerLng: over.centerLng ?? null,
    radiusM: over.radiusM ?? null,
    priority: over.priority ?? 100,
    active: over.active ?? true,
    effectiveFrom: over.effectiveFrom ?? null,
    effectiveTo: over.effectiveTo ?? null,
  };
}

function lead(over: Partial<LeadGeo> = {}): LeadGeo {
  return {
    latitude: over.latitude ?? null,
    longitude: over.longitude ?? null,
    postalCode: over.postalCode ?? null,
    municipalityCode: over.municipalityCode ?? null,
  };
}

describe("extractPolygons", () => {
  it("trekker ut Polygon", () => {
    expect(extractPolygons(OSLO_SQUARE)).toHaveLength(1);
  });
  it("pakker ut Feature og FeatureCollection", () => {
    const feat = { type: "Feature", geometry: OSLO_SQUARE, properties: {} };
    expect(extractPolygons(feat)).toHaveLength(1);
    const fc = { type: "FeatureCollection", features: [feat, feat] };
    expect(extractPolygons(fc)).toHaveLength(2);
  });
  it("håndterer MultiPolygon", () => {
    const mp = { type: "MultiPolygon", coordinates: [OSLO_SQUARE.coordinates, OSLO_SQUARE.coordinates] };
    expect(extractPolygons(mp)).toHaveLength(2);
  });
  it("returnerer tom liste for ugyldig/ukjent input", () => {
    expect(extractPolygons(null)).toEqual([]);
    expect(extractPolygons({ type: "Point", coordinates: [10, 59] })).toEqual([]);
    expect(extractPolygons("nope")).toEqual([]);
  });
});

describe("pointInRing / pointInPolygon", () => {
  const ring = OSLO_SQUARE.coordinates[0];
  it("punkt i midten er innenfor", () => {
    expect(pointInRing(59.5, 10.5, ring)).toBe(true);
  });
  it("punkt utenfor er utenfor", () => {
    expect(pointInRing(58.0, 10.5, ring)).toBe(false);
    expect(pointInRing(59.5, 12.0, ring)).toBe(false);
  });
  it("respekterer hull (donut)", () => {
    const outer = [[10, 59], [11, 59], [11, 60], [10, 60], [10, 59]];
    const hole = [[10.4, 59.4], [10.6, 59.4], [10.6, 59.6], [10.4, 59.6], [10.4, 59.4]];
    const polygon = [outer, hole];
    expect(pointInPolygon(59.5, 10.5, polygon)).toBe(false); // i hullet
    expect(pointInPolygon(59.1, 10.1, polygon)).toBe(true);  // utenfor hullet, innenfor ytre
  });
});

describe("pointInGeometry", () => {
  it("true for punkt i polygon", () => {
    expect(pointInGeometry(59.5, 10.5, OSLO_SQUARE)).toBe(true);
  });
  it("false for punkt utenfor", () => {
    expect(pointInGeometry(63.4, 10.4, OSLO_SQUARE)).toBe(false); // Trondheim
  });
});

describe("haversineKm", () => {
  it("0 for samme punkt", () => {
    expect(haversineKm(59.9, 10.7, 59.9, 10.7)).toBeCloseTo(0, 5);
  });
  it("Oslo–Bergen ~ 300–320 km", () => {
    const d = haversineKm(59.9139, 10.7522, 60.3913, 5.3221);
    expect(d).toBeGreaterThan(290);
    expect(d).toBeLessThan(320);
  });
});

describe("isTerritoryActive", () => {
  const now = new Date("2026-06-22T12:00:00Z");
  it("inaktiv når active=false", () => {
    expect(isTerritoryActive(territory({ active: false }), now)).toBe(false);
  });
  it("inaktiv før effective_from", () => {
    expect(isTerritoryActive(territory({ effectiveFrom: new Date("2026-07-01") }), now)).toBe(false);
  });
  it("inaktiv etter effective_to", () => {
    expect(isTerritoryActive(territory({ effectiveTo: new Date("2026-06-01") }), now)).toBe(false);
  });
  it("aktiv innenfor vinduet", () => {
    expect(isTerritoryActive(territory({
      effectiveFrom: new Date("2026-06-01"), effectiveTo: new Date("2026-07-01"),
    }), now)).toBe(true);
  });
});

describe("matchesAdminUnits", () => {
  it("matcher postnummer", () => {
    const t = territory({ postalCodes: ["0150", "0151"] });
    expect(matchesAdminUnits(lead({ postalCode: "0150" }), t)).toBe(true);
    expect(matchesAdminUnits(lead({ postalCode: "5003" }), t)).toBe(false);
  });
  it("matcher kommunenummer", () => {
    const t = territory({ municipalities: ["0301"] }); // Oslo
    expect(matchesAdminUnits(lead({ municipalityCode: "0301" }), t)).toBe(true);
    expect(matchesAdminUnits(lead({ municipalityCode: "4601" }), t)).toBe(false);
  });
});

describe("matchesPolygon / leadMatchesTerritory (kombinasjon)", () => {
  it("polygon-match krever lat/lng", () => {
    const t = territory({ geometry: OSLO_SQUARE });
    expect(matchesPolygon(lead({ latitude: 59.5, longitude: 10.5 }), t)).toBe(true);
    expect(matchesPolygon(lead({ latitude: null, longitude: null }), t)).toBe(false);
  });
  it("kombinasjon: treffer på polygon ELLER admin-enhet", () => {
    const t = territory({ geometry: OSLO_SQUARE, postalCodes: ["5003"] });
    // Utenfor polygon, men matchende postnummer:
    expect(leadMatchesTerritory(lead({ latitude: 63.4, longitude: 10.4, postalCode: "5003" }), t)).toBe(true);
    // I polygon, ingen admin-match:
    expect(leadMatchesTerritory(lead({ latitude: 59.5, longitude: 10.5 }), t)).toBe(true);
    // Verken polygon eller admin:
    expect(leadMatchesTerritory(lead({ latitude: 63.4, longitude: 10.4, postalCode: "9000" }), t)).toBe(false);
  });
  it("pointMatchesTerritory bruker kun polygon", () => {
    const t = territory({ geometry: OSLO_SQUARE });
    expect(pointMatchesTerritory(59.5, 10.5, t)).toBe(true);
    expect(pointMatchesTerritory(63.4, 10.4, t)).toBe(false);
    expect(pointMatchesTerritory(59.5, 10.5, territory({ geometry: null }))).toBe(false);
  });
});

describe("matchesCircle", () => {
  // Sirkel: 5 km rundt Oslo sentrum (59.9139, 10.7522).
  const t = territory({ centerLat: 59.9139, centerLng: 10.7522, radiusM: 5000 });
  it("innenfor radius matcher", () => {
    expect(matchesCircle(lead({ latitude: 59.92, longitude: 10.76 }), t)).toBe(true);
  });
  it("utenfor radius matcher ikke", () => {
    expect(matchesCircle(lead({ latitude: 60.3, longitude: 11.1 }), t)).toBe(false);
  });
  it("krever senter + radius + posisjon", () => {
    expect(matchesCircle(lead({ latitude: 59.92, longitude: 10.76 }), territory())).toBe(false);
    expect(matchesCircle(lead({ latitude: null, longitude: null }), t)).toBe(false);
  });
  it("inngår i kombinasjon (leadMatchesTerritory)", () => {
    expect(leadMatchesTerritory(lead({ latitude: 59.92, longitude: 10.76 }), t)).toBe(true);
    expect(pointMatchesTerritory(59.92, 10.76, t)).toBe(true);
    expect(pointMatchesTerritory(60.3, 11.1, t)).toBe(false);
  });
});

describe("pickBestTerritory", () => {
  it("null for tom liste", () => {
    expect(pickBestTerritory([])).toBeNull();
  });
  it("høyest priority vinner", () => {
    const lo = territory({ id: "lo", priority: 50 });
    const hi = territory({ id: "hi", priority: 200 });
    expect(pickBestTerritory([lo, hi])?.id).toBe("hi");
  });
  it("polygon foran ren admin ved lik priority", () => {
    const admin = territory({ id: "admin", priority: 100, geometry: null, postalCodes: ["0150"] });
    const poly = territory({ id: "poly", priority: 100, geometry: OSLO_SQUARE });
    expect(pickBestTerritory([admin, poly])?.id).toBe("poly");
  });
});

describe("detectAdminOverlaps", () => {
  it("finner delt kommune/postnummer", () => {
    const a = territory({ id: "a", municipalities: ["0301"], postalCodes: ["0150"] });
    const b = territory({ id: "b", municipalities: ["0301"] });
    const c = territory({ id: "c", municipalities: ["4601"] });
    const overlaps = detectAdminOverlaps([a, b, c]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].shared).toContain("0301");
  });
  it("ingen overlapp = tom liste", () => {
    const a = territory({ id: "a", municipalities: ["0301"] });
    const b = territory({ id: "b", municipalities: ["4601"] });
    expect(detectAdminOverlaps([a, b])).toEqual([]);
  });
});

describe("computeCoverage", () => {
  const oslo = territory({ id: "oslo", geometry: OSLO_SQUARE, assignedUserId: "a" });
  const byPost = territory({ id: "post", postalCodes: ["0150"], assignedUserId: "b" });
  function cLead(over: Partial<CoverageLead> & { id: string }): CoverageLead {
    return { latitude: null, longitude: null, postalCode: null, municipalityCode: null, ...over };
  }

  it("teller covered/orphan/overlap riktig", () => {
    const leads: CoverageLead[] = [
      cLead({ id: "1", latitude: 59.5, longitude: 10.5 }),               // i oslo-polygon
      cLead({ id: "2", latitude: 59.5, longitude: 10.5, postalCode: "0150" }), // oslo + post = overlap
      cLead({ id: "3", latitude: 63.4, longitude: 10.4 }),               // ingen (Trondheim)
      cLead({ id: "4", postalCode: "9999" }),                            // ingen
    ];
    const r = computeCoverage(leads, [oslo, byPost]);
    expect(r.total).toBe(4);
    expect(r.covered).toBe(2);
    expect(r.orphans).toBe(2);
    expect(r.overlapping).toBe(1);
    expect(r.coveragePct).toBe(50);
    expect(r.orphanLeads.map((l) => l.id).sort()).toEqual(["3", "4"]);
  });

  it("perTerritory teller leads per grid (overlap teller i begge)", () => {
    const leads = [cLead({ id: "1", latitude: 59.5, longitude: 10.5, postalCode: "0150" })];
    const r = computeCoverage(leads, [oslo, byPost]);
    expect(r.perTerritory.find((t) => t.territoryId === "oslo")?.leadCount).toBe(1);
    expect(r.perTerritory.find((t) => t.territoryId === "post")?.leadCount).toBe(1);
  });

  it("tom liste gir 0% dekning uten å kaste", () => {
    const r = computeCoverage([], [oslo]);
    expect(r.total).toBe(0);
    expect(r.coveragePct).toBe(0);
  });

  it("respekterer orphanCap", () => {
    const leads = Array.from({ length: 5 }, (_, i) => cLead({ id: String(i), postalCode: "9999" }));
    const r = computeCoverage(leads, [oslo], { orphanCap: 2 });
    expect(r.orphans).toBe(5);
    expect(r.orphanLeads).toHaveLength(2);
  });
});

describe("summarizeManagerStats", () => {
  const osloGrid = territory({ id: "g1", geometry: OSLO_SQUARE, assignedUserId: "u1" });
  const members: ManagerMember[] = [
    { userId: "u1", displayName: "Anna", email: "a@x.no", role: "salgskonsulent", teamName: "Team A", territoryLabel: "Oslo" },
    { userId: "u2", displayName: "Per", email: "p@x.no", role: "promotor", teamName: "Team A", territoryLabel: null },
  ];

  it("fletter brudd, besøk, leads og live-posisjon per selger", () => {
    const stats = summarizeManagerStats(members, {
      breachRows: [
        { user_id: "u1", event_kind: "gps_out_of_grid", count: 2 },
        { user_id: "u1", event_kind: "visit_out_of_grid", count: 1 },
      ],
      visitRows: [{ user_id: "u1", total: 5, out_of_grid: 2 }],
      assignedLeads: [
        { userId: "u1", latitude: 59.5, longitude: 10.5, postalCode: null, municipalityCode: null }, // in grid
        { userId: "u1", latitude: 63.4, longitude: 10.4, postalCode: null, municipalityCode: null }, // ute
      ],
      locations: [{ user_id: "u1", lat: 63.4, lng: 10.4 }], // utenfor Oslo-grid
      territoriesByUser: { u1: [osloGrid] },
    });
    const a = stats.find((s) => s.userId === "u1")!;
    expect(a.breaches).toEqual({ leadAccess: 0, gps: 2, visit: 1, total: 3 });
    expect(a.visits).toEqual({ total: 5, inGrid: 3, outOfGrid: 2 });
    expect(a.leads).toEqual({ total: 2, inGrid: 1, outOfGrid: 1 });
    expect(a.live).toEqual({ lat: 63.4, lng: 10.4, currentlyOutOfGrid: true });
    expect(a.hasGrid).toBe(true);
  });

  it("selger uten grid: ingen håndheving, alt regnes in-grid, aldri «ute nå»", () => {
    const stats = summarizeManagerStats(members, {
      breachRows: [],
      visitRows: [],
      assignedLeads: [{ userId: "u2", latitude: 63.4, longitude: 10.4, postalCode: null, municipalityCode: null }],
      locations: [{ user_id: "u2", lat: 63.4, lng: 10.4 }],
      territoriesByUser: {},
    });
    const p = stats.find((s) => s.userId === "u2")!;
    expect(p.hasGrid).toBe(false);
    expect(p.leads).toEqual({ total: 1, inGrid: 1, outOfGrid: 0 });
    expect(p.live).toEqual({ lat: 63.4, lng: 10.4, currentlyOutOfGrid: false });
  });

  it("returnerer en rad per medlem, også uten data", () => {
    const stats = summarizeManagerStats(members, {
      breachRows: [], visitRows: [], assignedLeads: [], locations: [], territoriesByUser: {},
    });
    expect(stats).toHaveLength(2);
    expect(stats[0].breaches.total).toBe(0);
    expect(stats[0].live).toBeNull();
  });
});

describe("resolveLeadTerritories", () => {
  it("returnerer alle matchende territorier", () => {
    const oslo = territory({ id: "oslo", geometry: OSLO_SQUARE });
    const byPost = territory({ id: "post", postalCodes: ["0150"] });
    const bergen = territory({ id: "bergen", postalCodes: ["5003"] });
    const l = lead({ latitude: 59.5, longitude: 10.5, postalCode: "0150" });
    const matches = resolveLeadTerritories(l, [oslo, byPost, bergen]);
    expect(matches.map((t) => t.id).sort()).toEqual(["oslo", "post"]);
  });
});
