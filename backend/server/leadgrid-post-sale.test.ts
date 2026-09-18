/**
 * Post-salg: ingenting skjedde når en avtale ble vunnet.
 *
 * To hull testene her holder på:
 *   - deal.renewal_due måtte bli en ekte trigger, ikke bare en kolonne
 *     ingen ser på. within_days skal begrense, ikke bare pynte.
 *   - migrasjon 0649 skal flytte livssyklusen til 'customer' i databasen,
 *     fordi flere skriveveier setter 'won' og ingen av dem husket det.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { triggerMatches } from "./leadgrid-workflow-engine";
import { validateTrigger } from "./leadgrid-workflow-types";

const baseEvent = {
  pool: null as never,
  organizationId: "org",
  projectId: "proj",
  leadId: "lead",
  actorUserId: null,
};

describe("deal.renewal_due som trigger", () => {
  it("godtas av validatoren, med og uten within_days", () => {
    expect(validateTrigger({ type: "deal.renewal_due" }).ok).toBe(true);
    expect(validateTrigger({ type: "deal.renewal_due", within_days: 14 }).ok).toBe(true);
  });

  it("avviser within_days som ikke er et positivt tall", () => {
    for (const within_days of [-1, "14", NaN]) {
      const r = validateTrigger({ type: "deal.renewal_due", within_days });
      expect(r.ok).toBe(false);
    }
  });

  it("matcher uten within_days uansett hvor langt fram fornyelsen er", () => {
    expect(
      triggerMatches(
        { type: "deal.renewal_due" },
        { ...baseEvent, type: "deal.renewal_due", data: { days_until_renewal: 29 } },
      ),
    ).toBe(true);
  });

  it("matcher bare innenfor within_days", () => {
    const trigger = { type: "deal.renewal_due", within_days: 7 } as const;
    expect(
      triggerMatches(trigger, {
        ...baseEvent,
        type: "deal.renewal_due",
        data: { days_until_renewal: 7 },
      }),
    ).toBe(true);
    expect(
      triggerMatches(trigger, {
        ...baseEvent,
        type: "deal.renewal_due",
        data: { days_until_renewal: 8 },
      }),
    ).toBe(false);
  });

  it("matcher ikke når dager_igjen mangler og within_days er satt", () => {
    expect(
      triggerMatches(
        { type: "deal.renewal_due", within_days: 30 },
        { ...baseEvent, type: "deal.renewal_due", data: {} },
      ),
    ).toBe(false);
  });
});

describe("migrasjon 0649", () => {
  const sql = readFileSync(
    join(__dirname, "../migrations/0649_crm_customers_renewal.sql"),
    "utf8",
  );

  it("flytter livssyklusen i databasen, ikke i én enkelt rute", () => {
    expect(sql).toContain("CREATE TRIGGER trg_crm_customers_apply_won");
    expect(sql).toContain("BEFORE UPDATE ON crm_customers");
    expect(sql).toContain("NEW.lifecycle_stage := 'customer'");
  });

  it("degraderer ikke en evangelist til kunde", () => {
    expect(sql).toContain("IS DISTINCT FROM 'evangelist'");
  });

  it("utleder fornyelsesdato bare fra gjentakende linjer med bindingstid", () => {
    expect(sql).toContain("li.billing_frequency <> 'one_time'");
    expect(sql).toContain("li.term_months IS NOT NULL");
  });

  it("overskriver ikke en fornyelsesdato som er satt manuelt", () => {
    expect(sql).toContain("IF NEW.renewal_date IS NULL THEN");
  });
});
