import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  LeadCreationValidationError,
  parseLeadCreationBody,
  pipelineStageForLeadStatus,
} from "./lead-map-create-contract.js";

function expectValidationCode(run: () => unknown, code: string): void {
  try {
    run();
    throw new Error("forventet valideringsfeil");
  } catch (error) {
    expect(error).toBeInstanceOf(LeadCreationValidationError);
    expect((error as LeadCreationValidationError).code).toBe(code);
  }
}

describe("parseLeadCreationBody", () => {
  it("normaliserer og beholder hele Add Lead-kontrakten", () => {
    const body = parseLeadCreationBody({
      name: "  Nordic Elektro AS  ",
      company: "Nordic Elektro AS",
      contact_name: " Anders Johansen ",
      contact_role: "Daglig leder",
      organization_number: "912 345 678",
      website_url: "https://nordic.example",
      phone: "+47 22 33 44 55",
      email: "post@nordic.example",
      industry_id: "00112233-4455-4677-8899-aabbccddeeff",
      industry_label: "Elektro",
      employee_count_estimate: 25,
      annual_revenue_nok_estimate: 10_000_000,
      notes: "Ring etter frokost",
      lead_temperature: "hot",
      lead_status: "meeting_booked",
      next_follow_up_at: "2026-09-02T08:30:00+02:00",
      next_action: "Bekreft møtedeltakere",
      latitude: 59.9139,
      longitude: 10.7522,
      address: "Storgata 12, 0184 Oslo",
      postal_code: "0184",
      city: "Oslo",
      location_confidence: "geocoded",
      lead_source: "brreg_lookup",
      project_id: "project-1",
    });

    expect(body).toMatchObject({
      name: "Nordic Elektro AS",
      contactName: "Anders Johansen",
      contactRole: "Daglig leder",
      organizationNumber: "912345678",
      employeeCountEstimate: 25,
      annualRevenueNokEstimate: 10_000_000,
      leadTemperature: "hot",
      leadStatus: "meeting_booked",
      pipelineStage: "meeting",
      nextAction: "Bekreft møtedeltakere",
      locationConfidence: "geocoded",
    });
    expect(body.nextFollowUpAt).toBe("2026-09-02T06:30:00.000Z");
  });

  it.each([
    ["unvisited", "new"],
    ["visited", "first_contact"],
    ["interested", "qualified"],
    ["meeting_booked", "meeting"],
    ["proposal_sent", "proposal"],
    ["won", "won"],
  ] as const)("mapper pipelinefasen %s deterministisk", (status, stage) => {
    expect(pipelineStageForLeadStatus(status)).toBe(stage);
  });

  it("avviser tidligere sammenblandede statusverdier", () => {
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 60, longitude: 10, lead_status: "hot",
    }), "ugyldig_lead_status");
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 60, longitude: 10, lead_temperature: "meeting_booked",
    }), "ugyldig_temperatur");
  });

  it("avviser ugyldig org.nr., bransje-id og ufullstendig oppfølging", () => {
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 60, longitude: 10, organization_number: "123",
    }), "ugyldig_organisasjonsnummer");
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 60, longitude: 10, industry_id: "ikke-uuid",
    }), "ugyldig_industry_id");
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 60, longitude: 10, next_action: "Ring",
    }), "oppfolging_krever_tid_og_handling");
  });

  it("avviser koordinater utenfor gyldig område", () => {
    expectValidationCode(() => parseLeadCreationBody({
      name: "Test AS", latitude: 91, longitude: 10,
    }), "ugyldig_koordinat");
  });
});

describe("migration 0485", () => {
  it("oppretter strukturerte felt og org-scope-indeks idempotent", () => {
    const sql = readFileSync(
      new URL("../migrations/0485_leadgrid_add_lead_profile_fields.sql", import.meta.url),
      "utf8",
    );

    for (const column of [
      "contact_name",
      "contact_role",
      "employee_count_estimate",
      "annual_revenue_nok_estimate",
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).toContain("organization_id, enrichment_org_nr");
  });
});
