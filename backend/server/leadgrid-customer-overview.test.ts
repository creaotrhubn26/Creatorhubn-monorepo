import { describe, expect, it, vi } from "vitest";

import { customerOverview } from "./leadgrid-customer-overview.js";

const nå = new Date();
const om = (d: number) => new Date(nå.getTime() + d * 86_400_000);

function pool(
  org: Record<string, unknown>,
  avtaler: unknown[] = [],
  rettigheter: unknown[] = [],
  forbruk: Record<string, unknown> = {
    run_count: 0, reserved: 0, candidate_limit: null,
    ai_calls: 0, ai_cost: "0", used_bytes: "0", billable: 0,
  },
) {
  const query = vi.fn(async (sql: string) => {
    const t = String(sql);
    if (t.includes("FROM organizations o")) {
      return {
        rows: [{
          id: "org-1", name: "Neras Direkte AS", org_number: "986330682",
          city: "DRAMMEN", nace_code: "82.200", plan: "trial",
          created_at: om(-3), stripe_subscription_id: null,
          trial_started_at: null, trial_ends_at: null, trial_hard_expires_at: om(27),
          admin_email: "jon@neras.no", members: 1,
          projects: 1, discovery_runs: 0, leads: 0, decisions: 0,
          last_activity_at: null,
          ...org,
        }],
        rowCount: 1,
      };
    }
    if (t.includes("leadgrid_org_agreements")) return { rows: avtaler, rowCount: avtaler.length };
    if (t.includes("leadgrid_org_entitlements")) return { rows: rettigheter, rowCount: rettigheter.length };
    if (t.includes("leadgrid_discovery_monthly_usage")) {
      return { rows: [forbruk], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as never;
}

describe("customerOverview", () => {
  it("flagger GDPR-avvik når de kjører Discovery uten databehandleravtale", async () => {
    // Dette er ikke en påminnelse. Uten DPA behandler vi personopplysninger
    // på kundens vegne uten hjemmel etter artikkel 28.
    const [rad] = await customerOverview(pool({ discovery_runs: 4 }));
    expect(rad.flags.some((f) => f.includes("uten hjemmel"))).toBe(true);
  });

  it("nøyer seg med en påminnelse når de ikke har begynt ennå", async () => {
    const [rad] = await customerOverview(pool({ discovery_runs: 0 }));
    expect(rad.flags).toContain("Databehandleravtale ikke signert.");
    expect(rad.flags.some((f) => f.includes("uten hjemmel"))).toBe(false);
  });

  it("skiller det de har FÅTT fra det de har IVERKSATT", async () => {
    // En rettighet uten bruk er en rettighet ingen har bedt om.
    const [rad] = await customerOverview(
      pool({ discovery_runs: 2, leads: 40, decisions: 0 }, [], [
        { feature: "discovery", state: "on" },
        { feature: "anbud", state: "on" },
      ]),
    );
    expect(rad.services.granted).toEqual(["discovery", "anbud"]);
    expect(rad.services.activated).toEqual(["kundeprosjekt", "discovery", "leads"]);
    expect(rad.services.activated).not.toContain("godkjenning");
  });

  it("ser forskjell på å ha søkt og å ha godkjent noe", async () => {
    const [rad] = await customerOverview(pool({ discovery_runs: 3, decisions: 0 }));
    expect(rad.flags).toContain("Har søkt, men aldri godkjent en kandidat.");
  });

  it("melder når prøveperioden er nær slutten", async () => {
    const [rad] = await customerOverview(
      pool({ trial_started_at: om(-6), trial_ends_at: om(1), discovery_runs: 1, decisions: 1 }),
    );
    expect(rad.flags.some((f) => f.includes("dager igjen"))).toBe(true);
  });

  it("lister signerte avtaler med hvem som signerte", async () => {
    const [rad] = await customerOverview(
      pool({}, [
        { agreement_type: "dpa", signed_at: om(-1), signer_name: "Jon Hillestad" },
      ]),
    );
    expect(rad.agreements.signed[0]).toMatchObject({
      type: "dpa",
      label: "Databehandleravtale",
      signer_name: "Jon Hillestad",
    });
    // Personvernerklæringen mangler også — DPA alene er ikke nok.
    expect(rad.agreements.missing.map((m) => m.type).sort()).toEqual(["loi", "privacy"]);
  });

  it("samler forbruket for måneden", async () => {
    const [rad] = await customerOverview(
      pool({}, [], [], {
        run_count: 6, reserved: 420, candidate_limit: 500,
        ai_calls: 91, ai_cost: "2.75", used_bytes: String(52 * 1_048_576), billable: 12,
      }),
    );
    expect(rad.usage.discovery_runs).toBe(6);
    expect(rad.usage.candidates_reserved).toBe(420);
    expect(rad.usage.ai_cost_usd).toBeCloseTo(2.75);
    expect(rad.usage.storage_mb).toBe(52);
    expect(rad.usage.billable_events).toBe(12);
  });

  it("varsler før kvoten er brukt opp, ikke etter", async () => {
    const [rad] = await customerOverview(
      pool({}, [], [], {
        run_count: 5, reserved: 410, candidate_limit: 500,
        ai_calls: 0, ai_cost: "0", used_bytes: "0", billable: 0,
      }),
    );
    expect(rad.flags.some((flagg) => flagg.includes("410 av 500"))).toBe(true);
  });

  it("sier fra når kvoten faktisk er tom", async () => {
    const [rad] = await customerOverview(
      pool({}, [], [], {
        run_count: 9, reserved: 500, candidate_limit: 500,
        ai_calls: 0, ai_cost: "0", used_bytes: "0", billable: 0,
      }),
    );
    expect(rad.flags.some((flagg) => flagg.includes("brukt opp"))).toBe(true);
  });

  it("krever personvernerklæring i tillegg til DPA og intensjonsavtale", async () => {
    // DPA regulerer KUNDENS data. Personvernerklæringen sier hva vi gjør med
    // opplysninger om brukeren selv. To ulike ting.
    const [rad] = await customerOverview(pool({}));
    expect(rad.agreements.missing.map((m) => m.type).sort()).toEqual(
      ["dpa", "loi", "privacy"],
    );
  });

  it("regner bare rettigheter som er slått på", async () => {
    const [rad] = await customerOverview(
      pool({}, [], [
        { feature: "discovery", state: "on" },
        { feature: "anbud", state: "off" },
      ]),
    );
    expect(rad.services.granted).toEqual(["discovery"]);
  });
});
