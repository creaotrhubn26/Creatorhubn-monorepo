import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  marketingIntelligenceFeedbackSchema,
  validateMarketingIntelligenceOutput,
} from "./leadgrid-discovery-intelligence-contract.js";
import {
  buildMarketingEvidenceCatalog,
  executeMarketingDiscoverySkill,
  type CandidateEvidenceRow,
} from "./leadgrid-discovery-intelligence-service.js";

function candidate(
  id: string,
  name: string,
  overrides: Partial<CandidateEvidenceRow> = {},
): CandidateEvidenceRow {
  return {
    id,
    name,
    city: "Oslo",
    organization_number: `99999999${id}`,
    source_uri: `https://data.brreg.no/enhetsregisteret/api/enheter/99999999${id}`,
    nace_code: "62.010",
    nace_description: "Programmeringstjenester",
    employee_count: 12,
    registered_in_vat_register: true,
    observation_origin: "provider_observation",
    observation_observed_at: "2026-09-01T08:00:00.000Z",
    observation_captured_at: "2026-09-01T08:00:00.000Z",
    fit_score: 82,
    fit_coverage: 0.8,
    data_quality_score: 75,
    data_quality_coverage: 0.7,
    evidence: [
      {
        factor: "industry",
        label: "Bransjematch",
        value: "Programmeringstjenester",
        source: "Brønnøysundregistrene",
        ref: "brreg.nace_code",
      },
      {
        factor: "email",
        label: "E-post",
        value: "person@example.no",
        source: "candidate",
        ref: "contact.email",
      },
      {
        factor: "signal",
        label: "Dokumentert signal",
        value: "skjult.person@example.no",
        source: "candidate",
        ref: "discovery.signal",
      },
      {
        factor: "signal",
        label: "Dokumentert signal",
        value: "+47 979 59 294",
        source: "candidate",
        ref: "discovery.signal",
      },
    ],
    ...overrides,
  } as CandidateEvidenceRow;
}

describe("marketing.discovery_intelligence skill", () => {
  const rows = [
    candidate("1", "Nordlys AS"),
    candidate("2", "Fjord Data AS", { city: "Bergen", fit_score: 76 }),
    candidate("3", "Varde System AS", { fit_score: 68 }),
    candidate("4", "Kyst Teknologi AS", {
      nace_code: "73.110",
      nace_description: "Reklamebyråer",
      employee_count: null,
      fit_score: 71,
    }),
  ];

  it("builds stable source references and removes contact PII", () => {
    const first = buildMarketingEvidenceCatalog(rows);
    const second = buildMarketingEvidenceCatalog(rows);
    expect(second.catalog).toEqual(first.catalog);
    expect(first.catalog[0].id).toBe("E001");
    expect(
      first.catalog.some(
        (item) => item.source_ref === "discovery.industry_distribution",
      ),
    ).toBe(true);
    expect(JSON.stringify(first.catalog)).not.toContain("person@example.no");
    expect(JSON.stringify(first.catalog)).not.toContain(
      "skjult.person@example.no",
    );
    expect(JSON.stringify(first.catalog)).not.toContain("+47 979 59 294");
    expect(first.coverage).toBeGreaterThan(0.5);
  });

  it("labels legacy snapshots as approximate and reduces confidence coverage", () => {
    const direct = buildMarketingEvidenceCatalog(rows);
    const mixed = buildMarketingEvidenceCatalog([
      candidate("1", "Nordlys AS", {
        observation_origin: "legacy_backfill_current_canonical",
        observation_observed_at: null,
        observation_captured_at: "2026-09-06T08:00:00.000Z",
      }),
      ...rows.slice(1),
    ]);
    expect(mixed.coverage).toBeLessThan(direct.coverage);
    expect(mixed.gaps.join(" ")).toContain("tilbakefylt");
    expect(
      mixed.catalog.some((item) =>
        item.source.includes("approksimert historikk"),
      ),
    ).toBe(true);
    expect(
      mixed.catalog.some(
        (item) => item.source_ref === "discovery.observation_origin",
      ),
    ).toBe(true);
  });

  it("emits facts, inferences and testable hypotheses with valid citations", () => {
    const bundle = buildMarketingEvidenceCatalog(rows);
    const result = executeMarketingDiscoverySkill(rows, bundle);
    const allowed = new Set(bundle.catalog.map((item) => item.id));
    expect(result.insights.length).toBeGreaterThanOrEqual(3);
    expect(result.insights.some((item) => item.claim_type === "fact")).toBe(
      true,
    );
    expect(
      result.insights.some((item) => item.claim_type === "inference"),
    ).toBe(true);
    expect(result.insights.some((item) => item.experiment?.metric)).toBe(true);
    for (const insight of result.insights) {
      expect(insight.evidence_refs.length).toBeGreaterThan(0);
      expect(
        insight.evidence_refs.every((reference) => allowed.has(reference)),
      ).toBe(true);
    }
  });

  it("rejects any output that cites evidence outside the catalog", () => {
    const bundle = buildMarketingEvidenceCatalog(rows);
    const result = executeMarketingDiscoverySkill(rows, bundle);
    const invalid = structuredClone(result);
    invalid.insights[0].evidence_refs = ["E999"];
    expect(() =>
      validateMarketingIntelligenceOutput(
        invalid,
        new Set(bundle.catalog.map((item) => item.id)),
      ),
    ).toThrow(/Ukjent evidansereferanse/);
  });

  it("requires a reason when a marketer rejects an insight", () => {
    expect(() =>
      marketingIntelligenceFeedbackSchema.parse({
        decision: "reject",
      }),
    ).toThrow();
  });

  it("requires at least one changed field for a correction", () => {
    expect(() =>
      marketingIntelligenceFeedbackSchema.parse({
        decision: "correct",
        correction: {},
      }),
    ).toThrow();
  });
});

describe("Discovery marketing intelligence migration", () => {
  const migration = readFileSync(
    new URL(
      "../migrations/0521_leadgrid_discovery_marketing_intelligence.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("creates tenant-safe report, insight and append-only feedback tables", () => {
    for (const table of [
      "leadgrid_discovery_intelligence_reports",
      "leadgrid_discovery_intelligence_insights",
      "leadgrid_discovery_intelligence_feedback",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, run_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, report_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, report_id, insight_id)",
    );
    expect(migration).toContain("ux_discovery_intelligence_report_idempotency");
    expect(migration).toContain(
      "ux_discovery_intelligence_feedback_idempotency",
    );
    expect(migration).not.toMatch(
      /UPDATE\s+leadgrid_discovery_intelligence_feedback/i,
    );
  });

  it("grants the established Discovery surface and insight permissions to marketing roles", () => {
    for (const role of [
      "markedssjef",
      "markedskoordinator",
      "seo_spesialist",
      "content_ansvarlig",
      "performance_marketer",
      "markedsanalytiker",
    ]) {
      expect(migration).toContain(`('${role}', 'lead_research.run')`);
      expect(migration).toContain(
        `('${role}', 'marketing.discovery_insights.view')`,
      );
    }
    expect(migration).toContain("marketing.discovery_insights.run");
    expect(migration).toContain("marketing.discovery_insights.review");
  });
});
