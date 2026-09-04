import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  hashLeadCreationBody,
  LeadCreationValidationError,
  normalizeLeadEmail,
  normalizeLeadPhone,
  normalizeWebsiteDomain,
  parseLeadCreationBody,
  parseLeadDuplicateCheckBody,
  parseLeadCreationIdempotencyKey,
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
      website_url: "https://www.Nordic.example/kontakt",
      google_place_id: "places/nordic",
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
      websiteDomainNormalized: "nordic.example",
      phoneNormalized: "+4722334455",
      emailNormalized: "post@nordic.example",
      googlePlaceId: "places/nordic",
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

it("normaliserer domener og hasher normalisert payload stabilt", () => {
  expect(normalizeWebsiteDomain("HTTPS://WWW.Example.NO:443/path?q=1"))
    .toBe("example.no");
  expect(normalizeWebsiteDomain("example.no/kontakt")).toBe("example.no");
  expect(normalizeWebsiteDomain("ikke en url")).toBeNull();
  expect(normalizeLeadEmail(" Post@Example.NO ")).toBe("post@example.no");
  expect(normalizeLeadPhone("22 33 44 55")).toBe("+4722334455");
  expect(normalizeLeadPhone("0047 22 33 44 55")).toBe("+4722334455");
  expect(normalizeLeadPhone("+46 70 123 45 67")).toBe("+46701234567");

  const first = parseLeadCreationBody({
    name: "Test AS", latitude: 60, longitude: 10,
    website_url: "https://www.example.no",
  });
  const second = parseLeadCreationBody({
    longitude: 10, latitude: 60, name: "Test AS",
    website_url: "https://www.example.no",
  });
  expect(hashLeadCreationBody(first)).toBe(hashLeadCreationBody(second));
});

it("validerer og kan utelate Idempotency-Key bakoverkompatibelt", () => {
  expect(parseLeadCreationIdempotencyKey(
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
  )).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  expect(parseLeadCreationIdempotencyKey(undefined)).toBeNull();
  expectValidationCode(
    () => parseLeadCreationIdempotencyKey("ikke-uuid"),
    "ugyldig_idempotency_key",
  );
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

  it("duplikatsøk tillater at begge koordinatene mangler", () => {
    const body = parseLeadDuplicateCheckBody({
      name: "Test AS",
      email: "post@example.no",
      latitude: null,
      longitude: null,
      location_confidence: "exact",
    });
    expect(body.locationConfidence).toBe("unknown");
    expect(body.latitude).toBe(0);
    expect(body.longitude).toBe(0);
    expect(body.emailNormalized).toBe("post@example.no");
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

describe("migration 0489", () => {
  it("oppretter workspace-scope-de idempotens- og duplikatindekser", () => {
    const sql = readFileSync(
      new URL("../migrations/0489_leadgrid_lead_creation_idempotency.sql", import.meta.url),
      "utf8",
    );

    for (const column of [
      "creation_idempotency_key",
      "creation_request_hash",
      "website_domain_normalized",
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).toContain(
      "ON crm_customers (organization_id, creation_idempotency_key)",
    );
    expect(sql).toContain("organization_id, google_place_id");
    expect(sql).toContain("organization_id, website_domain_normalized");
    expect(sql).toContain("crm_customers_creation_request_hash_format_check");
    expect(sql).toContain("crm_customers_creation_idempotency_pair_check");
  });
});

describe("migration 0506", () => {
  it("normaliserer e-post/telefon og indekserer nærhet per workspace", () => {
    const sql = readFileSync(
      new URL("../migrations/0506_leadgrid_lead_identity_normalization.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS email_normalized");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS phone_normalized");
    expect(sql).toContain("trg_leadgrid_customer_identities");
    expect(sql).toContain("organization_id, email_normalized");
    expect(sql).toContain("organization_id, phone_normalized");
    expect(sql).toContain("organization_id, latitude, longitude");
  });
});
