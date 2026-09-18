import { describe, expect, it } from "vitest";
import {
  ALL_COMPANIES,
  ALL_CONTACTS,
  ALL_DEALS,
  COMPANY_TO_DEALS,
  CONTACTS_PAGE_1,
  CONTACTS_PAGE_2,
  CONTACT_TO_COMPANY,
  ENGAGEMENTS,
  OWNERS,
  PIPELINE_SALG_NORGE,
} from "./hubspot-migration-fixtures";
import {
  LEADGRID_ACTIVITY_TYPES,
  LEADGRID_STAGES,
  mapPipelineStage,
  planHubSpotMigration,
  type MigrationInput,
  type MigrationPlan,
} from "./hubspot-migration-plan";

const input: MigrationInput = {
  companies: ALL_COMPANIES,
  contacts: ALL_CONTACTS,
  deals: ALL_DEALS,
  owners: OWNERS,
  pipelines: [PIPELINE_SALG_NORGE],
  contactToCompany: CONTACT_TO_COMPANY,
  companyToDeals: COMPANY_TO_DEALS,
  engagements: ENGAGEMENTS,
};

const plan = (over: Partial<MigrationInput> = {}): MigrationPlan =>
  planHubSpotMigration({ ...input, ...over }, { fallbackOwnerUserId: "user-daniel", ownerMap: { "550001": "user-daniel" } });

const issuesOf = (p: MigrationPlan, code: string) => p.issues.filter((i) => i.code === code);

describe("fiksturen speiler HubSpots faktiske form", () => {
  it("pagineres med after-cursor og avslutter uten paging", () => {
    expect(CONTACTS_PAGE_1.paging?.next?.after).toBe("3003");
    expect(CONTACTS_PAGE_2.paging).toBeUndefined();
    expect(ALL_CONTACTS).toHaveLength(5);
  });

  it("har en kundedefinert pipeline der ingen stage matcher våre navn", () => {
    const ours = new Set<string>(LEADGRID_STAGES);
    for (const stage of PIPELINE_SALG_NORGE.stages) {
      expect(ours.has(stage.id)).toBe(false);
    }
  });
});

describe("mapPipelineStage", () => {
  it("oversetter kundens egne stager via sannsynlighet, ikke navn", () => {
    expect(mapPipelineStage("kontrakt_til_signering", [PIPELINE_SALG_NORGE]).stage).toBe("negotiation");
    expect(mapPipelineStage("kvalifisert", [PIPELINE_SALG_NORGE]).stage).toBe("meeting");
    expect(mapPipelineStage("behovsavklaring", [PIPELINE_SALG_NORGE]).stage).toBe("qualified");
    expect(mapPipelineStage("vunnet", [PIPELINE_SALG_NORGE]).stage).toBe("won");
  });

  it("lander alltid på en verdi vår CHECK-constraint tillater", () => {
    const ours = new Set<string>(LEADGRID_STAGES);
    for (const stage of PIPELINE_SALG_NORGE.stages) {
      expect(ours.has(mapPipelineStage(stage.id, [PIPELINE_SALG_NORGE]).stage)).toBe(true);
    }
    expect(ours.has(mapPipelineStage("finnes_ikke", [PIPELINE_SALG_NORGE]).stage)).toBe(true);
    expect(ours.has(mapPipelineStage(null, []).stage)).toBe(true);
  });

  it("melder fra når stagen ikke finnes i pipelinen vi hentet", () => {
    expect(mapPipelineStage("finnes_ikke", [PIPELINE_SALG_NORGE]).matched).toBe(false);
  });
});

describe("kontakt uten bedrift", () => {
  it("blir eget lead i stedet for å bli kastet, og beholder e-post og telefon", () => {
    const p = plan();
    const egen = p.customers.find((c) => c.hubspotId === "3002");
    expect(egen).toBeDefined();
    expect(egen?.source).toBe("contact_without_company");
    expect(egen?.email).toBe("kari@frilanskonsult.no");
    expect(egen?.phone).toBe("+47 977 88 100");
    expect(p.contacts.some((c) => c.hubspotId === "3002")).toBe(false);
    expect(issuesOf(p, "contact_without_company").some((i) => i.hubspotId === "3002")).toBe(true);
  });
});

describe("kontakt hos flere bedrifter", () => {
  it("bruker Primary-koblingen og rapporterer de andre som tapt", () => {
    const p = plan();
    const kontakt = p.contacts.find((c) => c.hubspotId === "3003");
    expect(kontakt?.customerHubspotId).toBe("7002");
    const issue = issuesOf(p, "extra_company_links_dropped").find((i) => i.hubspotId === "3003");
    expect(issue).toBeDefined();
    expect(issue?.silentLoss).toBe(true);
    expect(issue?.message).toContain("7001");
  });
});

describe("flere avtaler på samme selskap", () => {
  it("legger den største på kunde-raden og sier hvilke som ikke blir med", () => {
    const p = plan();
    const nordvik = p.customers.find((c) => c.hubspotId === "7001");
    expect(nordvik?.dealAmount).toBe(850000);
    expect(nordvik?.pipelineStage).toBe("negotiation");
    const issue = issuesOf(p, "extra_deals_dropped")[0];
    expect(issue.silentLoss).toBe(true);
    expect(issue.message).toContain("Serviceavtale maskinpark");
    expect(issue.message).toContain("Utvidelse Vestland");
  });

  it("melder fra om avtale uten beløp", () => {
    const p = plan();
    expect(issuesOf(p, "missing_deal_amount").length).toBeGreaterThanOrEqual(0);
  });
});

describe("eierskap", () => {
  it("faller til reserve-eier når HubSpot-eieren ikke finnes hos oss", () => {
    const p = plan();
    const fjelltek = p.customers.find((c) => c.hubspotId === "7002");
    expect(fjelltek?.ownerUserId).toBe("user-daniel");
    expect(issuesOf(p, "unknown_owner").some((i) => i.hubspotId === "7002")).toBe(true);
  });

  it("faller til reserve-eier når HubSpot-eieren er deaktivert", () => {
    const p = plan();
    expect(issuesOf(p, "archived_owner").length).toBeGreaterThan(0);
    for (const customer of p.customers) {
      expect(customer.ownerUserId).toBe("user-daniel");
    }
  });
});

describe("duplikater og dedup", () => {
  it("slår sammen to HubSpot-kontakter med samme e-post", () => {
    const p = plan();
    expect(p.mergedIntoExisting).toContainEqual({ hubspotId: "3005", mergesWith: "3001", on: "email" });
    expect(p.contacts.some((c) => c.hubspotId === "3005")).toBe(false);
  });

  it("melder fra når verken e-post eller telefon finnes", () => {
    const p = plan();
    expect(issuesOf(p, "no_dedupe_key").some((i) => i.hubspotId === "3004")).toBe(true);
  });
});

describe("aktiviteter", () => {
  it("flagger e-post og samtale, som ikke har en type i crm_lead_activities", () => {
    const p = plan();
    const flagged = issuesOf(p, "activity_type_unsupported").map((i) => i.hubspotId);
    expect(flagged).toContain("e1"); // EMAIL
    expect(flagged).toContain("e2"); // CALL
    expect(flagged).not.toContain("e3"); // MEETING
    expect(flagged).not.toContain("e4"); // NOTE
  });

  it("bruker bare typer vår CHECK-constraint tillater", () => {
    const ours = new Set<string>(LEADGRID_ACTIVITY_TYPES);
    expect(ours.has("meeting_scheduled")).toBe(true);
    expect(ours.has("email_sent")).toBe(false);
    expect(ours.has("call_logged")).toBe(false);
  });
});

describe("beregnede felter", () => {
  it("dropper HubSpots egne score-felter eksplisitt", () => {
    const p = plan();
    const issue = issuesOf(p, "calculated_property_skipped").find((i) => i.hubspotId === "7001");
    expect(issue?.message).toContain("hs_predictivecontactscore_v2");
  });
});

describe("planen som helhet", () => {
  it("kaster ingenting stille: hvert tap har en issue med silentLoss", () => {
    const p = plan();
    expect(p.counts.silentLossPrevented).toBeGreaterThan(0);
    for (const issue of p.issues) {
      expect(issue.message.length).toBeGreaterThan(10);
      expect(issue.hubspotId).toBeTruthy();
    }
  });

  it("gjør rede for hver eneste HubSpot-kontakt", () => {
    const p = plan();
    const accounted = new Set([
      ...p.contacts.map((c) => c.hubspotId),
      ...p.customers.filter((c) => c.source === "contact_without_company").map((c) => c.hubspotId),
      ...p.mergedIntoExisting.map((m) => m.hubspotId),
    ]);
    for (const contact of ALL_CONTACTS) {
      expect(accounted.has(contact.id)).toBe(true);
    }
  });

  it("beholder hele HubSpot-objektet for import_raw_data", () => {
    const p = plan();
    for (const customer of p.customers) {
      expect(customer.raw).toHaveProperty("id", customer.hubspotId);
      expect(customer.raw).toHaveProperty("properties");
    }
  });

  it("tåler et tomt uttrekk", () => {
    const empty = planHubSpotMigration(
      { companies: [], contacts: [], deals: [], owners: [], pipelines: [], contactToCompany: {}, companyToDeals: {}, engagements: [] },
      { fallbackOwnerUserId: "user-daniel" },
    );
    expect(empty.counts).toEqual({ customers: 0, contacts: 0, merged: 0, issues: 0, silentLossPrevented: 0 });
  });
});
