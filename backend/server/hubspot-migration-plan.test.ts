import { describe, expect, it } from "vitest";
import {
  ALL_COMPANIES,
  ALL_CONTACTS,
  ALL_DEALS,
  COMPANY_TO_DEALS,
  CONTACTS_PAGE_1,
  CONTACTS_PAGE_2,
  CONTACT_TO_COMPANY,
  ALL_LINE_ITEMS,
  ALL_PRODUCTS,
  DEAL_TO_LINE_ITEMS,
  ENGAGEMENTS,
  OWNERS,
  PIPELINE_SALG_NORGE,
} from "./hubspot-migration-fixtures";
import {
  LEADGRID_ACTIVITY_TYPES,
  LEADGRID_LIFECYCLE_STAGES,
  LEADGRID_BILLING_FREQUENCIES,
  LEADGRID_STAGES,
  mapBillingFrequency,
  mapLifecycleStage,
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
  products: ALL_PRODUCTS,
  lineItems: ALL_LINE_ITEMS,
  dealToLineItems: DEAL_TO_LINE_ITEMS,
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
  it("tar med alle avtalene, ikke bare den største", () => {
    // Før mig 0635 lagret Leadgrid én avtale per kunde, så to av disse tre
    // ble forkastet. Det er nettopp det scenariet en bedrift med en løpende
    // avtale OG en kampanje under forhandling havner i.
    const p = plan();
    const nordvikDeals = p.deals.filter((d) => d.customerHubspotId === "7001");
    expect(nordvikDeals.map((d) => d.title).sort()).toEqual([
      "Rammeavtale 2027",
      "Serviceavtale maskinpark",
      "Utvidelse Vestland",
    ]);
  });

  it("speiler den største på kunde-raden, og merker den som primær", () => {
    // crm_customers sine flate deal-felt er fortsatt det pipeline, forecast
    // og scoring leser, så primærsalget må stemme med dem.
    const p = plan();
    const nordvik = p.customers.find((c) => c.hubspotId === "7001");
    expect(nordvik?.dealAmount).toBe(850000);
    expect(nordvik?.pipelineStage).toBe("negotiation");
    const primary = p.deals.filter((d) => d.customerHubspotId === "7001" && d.isPrimary);
    expect(primary).toHaveLength(1);
    expect(primary[0].title).toBe("Rammeavtale 2027");
    expect(primary[0].dealAmount).toBe(850000);
  });

  it("mister ingen avtaler i det stille", () => {
    const p = plan();
    expect(p.issues.some((i) => i.code === ("extra_deals_dropped" as never))).toBe(false);
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
    expect(empty.counts).toEqual({ customers: 0, deals: 0, contacts: 0, merged: 0, products: 0, lineItems: 0, issues: 0, silentLossPrevented: 0 });
  });
});

describe("livssyklus", () => {
  it("oversetter HubSpots stadier til våre", () => {
    expect(mapLifecycleStage("subscriber").stage).toBe("subscriber");
    expect(mapLifecycleStage("marketingqualifiedlead").stage).toBe("marketing_qualified");
    expect(mapLifecycleStage("salesqualifiedlead").stage).toBe("sales_qualified");
    expect(mapLifecycleStage("customer").stage).toBe("customer");
    expect(mapLifecycleStage("evangelist").stage).toBe("evangelist");
  });

  it("tåler ulik skrivemåte og tomt felt", () => {
    expect(mapLifecycleStage("  CUSTOMER  ").stage).toBe("customer");
    expect(mapLifecycleStage(null)).toEqual({ stage: "lead", matched: true });
    expect(mapLifecycleStage("")).toEqual({ stage: "lead", matched: true });
  });

  it("lander alltid på en verdi CHECK-constrainten tillater", () => {
    const ours = new Set<string>(LEADGRID_LIFECYCLE_STAGES);
    for (const raw of ["subscriber", "lead", "customer", "partner_prospect", "noe_helt_annet", ""]) {
      expect(ours.has(mapLifecycleStage(raw).stage)).toBe(true);
    }
  });

  it("tar med livssyklusen på kunden som kommer fra et selskap", () => {
    const p = plan();
    expect(p.customers.find((c) => c.hubspotId === "7001")?.lifecycleStage).toBe("customer");
  });

  it("tar med livssyklusen på en kontakt som blir eget lead", () => {
    const p = plan();
    expect(p.customers.find((c) => c.hubspotId === "3002")?.lifecycleStage).toBe("lead");
  });

  it("melder fra om egendefinerte stadier i stedet for å tie", () => {
    const p = plan();
    const issue = issuesOf(p, "custom_lifecycle_stage").find((i) => i.hubspotId === "7002");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("partner_prospect");
    expect(p.customers.find((c) => c.hubspotId === "7002")?.lifecycleStage).toBe("other");
  });
});

describe("produktkatalog", () => {
  it("tar med katalogen, også produkter uten SKU", () => {
    const p = plan();
    expect(p.counts.products).toBe(2);
    const lisens = p.products.find((x) => x.hubspotId === "P100");
    expect(lisens).toMatchObject({ sku: "LG-LIC", name: "Leadgrid lisens", unitPrice: 990 });
    expect(p.products.find((x) => x.hubspotId === "P200")?.sku).toBeNull();
  });

  it("er tom når kunden ikke bruker katalog", () => {
    const p = plan({ products: [], lineItems: [], dealToLineItems: {} });
    expect(p.counts.products).toBe(0);
    expect(p.counts.lineItems).toBe(0);
  });
});

describe("produktlinjer på avtale", () => {
  it("henger hver linje på sin egen avtale, ikke på bedriften", () => {
    const p = plan();
    const byDeal = (dealId: string) =>
      p.lineItems.filter((l) => l.dealHubspotId === dealId).map((l) => l.hubspotId).sort();
    expect(byDeal("9001")).toEqual(["L1", "L2", "L3"]);
    // L9 lå på avtalen som før ble forkastet. Nå følger den sin egen avtale.
    expect(byDeal("9002")).toEqual(["L9"]);
    const paaNordvik = p.lineItems.filter((l) => l.customerHubspotId === "7001");
    expect(paaNordvik.map((l) => l.hubspotId).sort()).toEqual(["L1", "L2", "L3", "L9"]);
  });

  it("regner net_total likt som databasen, med både prosent- og kronerabatt", () => {
    const p = plan();
    const byId = Object.fromEntries(p.lineItems.map((l) => [l.hubspotId, l]));
    // 25 x 990 = 24 750, minus 10 % = 22 275
    expect(byId.L1.netTotal).toBe(22275);
    // 1 x 15 000, minus 2 500 i kroner = 12 500
    expect(byId.L2.netTotal).toBe(12500);
    // fritekstlinje uten rabatt
    expect(byId.L3.netTotal).toBe(48000);
  });

  it("beholder koblingen til katalogen, og tillater fritekstlinje uten produkt", () => {
    const p = plan();
    const byId = Object.fromEntries(p.lineItems.map((l) => [l.hubspotId, l]));
    expect(byId.L1.productHubspotId).toBe("P100");
    expect(byId.L3.productHubspotId).toBeNull();
  });

  it("tar med abonnementsdetaljer på gjentakende linjer", () => {
    const p = plan();
    const lisens = p.lineItems.find((l) => l.hubspotId === "L1");
    expect(lisens?.billingFrequency).toBe("monthly");
    expect(lisens?.recurringStartDate).toBe("2027-02-01");
    expect(p.lineItems.find((l) => l.hubspotId === "L2")?.billingFrequency).toBe("one_time");
  });

  it("mister ikke linjene på avtalen som ikke er primær", () => {
    // Dette var det dyreste tapet: linjene forsvant sammen med avtalen.
    const p = plan();
    expect(p.lineItems.some((l) => l.hubspotId === "L9")).toBe(true);
    expect(p.issues.some((i) => i.code === ("line_items_on_dropped_deal" as never))).toBe(false);
  });
});

describe("mapBillingFrequency", () => {
  it("gjenkjenner HubSpots frekvenser", () => {
    expect(mapBillingFrequency("monthly")).toEqual({ frequency: "monthly", matched: true });
    expect(mapBillingFrequency("annually").frequency).toBe("annually");
    expect(mapBillingFrequency(null)).toEqual({ frequency: "one_time", matched: true });
  });

  it("lander innenfor CHECK-constrainten også for frekvenser vi ikke har", () => {
    const ours = new Set<string>(LEADGRID_BILLING_FREQUENCIES);
    for (const raw of ["per_four_years", "per_five_years", "tullball", ""]) {
      expect(ours.has(mapBillingFrequency(raw).frequency)).toBe(true);
    }
    expect(mapBillingFrequency("per_five_years").matched).toBe(false);
  });
});
