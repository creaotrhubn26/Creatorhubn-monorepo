import { describe, expect, it } from "vitest";

import { planTrialReminder, type TrialOrgRow } from "./leadgrid-trial-reminders.js";

const NÅ = new Date("2026-09-24T09:00:00.000Z");

function org(over: Partial<TrialOrgRow> = {}): TrialOrgRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Neras Direkte AS",
    plan: "trial",
    stripe_subscription_id: null,
    trial_started_at: new Date("2026-09-19T09:00:00.000Z"),
    trial_ends_at: new Date("2026-09-26T09:00:00.000Z"),
    trial_hard_expires_at: null,
    trial_reminder_stage: null,
    ...over,
  };
}

describe("planTrialReminder", () => {
  it("varsler to dager før", () => {
    expect(planTrialReminder(org(), NÅ)).toMatchObject({ stage: 2 });
  });

  it("varsler på siste dag", () => {
    const varsel = planTrialReminder(
      org({ trial_ends_at: new Date("2026-09-25T09:00:00.000Z") }),
      NÅ,
    );
    expect(varsel).toMatchObject({ stage: 1, heading: "Siste dag" });
  });

  it("varsler når prøvetiden er ute", () => {
    const varsel = planTrialReminder(
      org({ trial_ends_at: new Date("2026-09-23T09:00:00.000Z") }),
      NÅ,
    );
    expect(varsel).toMatchObject({ stage: 0 });
    expect(varsel?.status.read_only).toBe(true);
  });

  it("tier når det er mer enn to dager igjen", () => {
    expect(
      planTrialReminder(org({ trial_ends_at: new Date("2026-09-29T09:00:00.000Z") }), NÅ),
    ).toBeNull();
  });

  it("sender ikke samme trinn to ganger", () => {
    expect(planTrialReminder(org({ trial_reminder_stage: 2 }), NÅ)).toBeNull();
  });

  it("sender ikke et eldre trinn etter et nyere", () => {
    // Allerede varslet «siste dag». Da skal «to dager igjen» aldri gå ut,
    // uansett hvordan datoene flyttes på etterpå.
    expect(planTrialReminder(org({ trial_reminder_stage: 1 }), NÅ)).toBeNull();
  });

  it("går videre fra to dager til siste dag", () => {
    const varsel = planTrialReminder(
      org({
        trial_reminder_stage: 2,
        trial_ends_at: new Date("2026-09-25T09:00:00.000Z"),
      }),
      NÅ,
    );
    expect(varsel).toMatchObject({ stage: 1 });
  });

  it("varsler aldri en betalende kunde", () => {
    expect(
      planTrialReminder(org({ stripe_subscription_id: "sub_123" }), NÅ),
    ).toBeNull();
  });

  it("varsler ikke den som ikke har startet klokka", () => {
    expect(
      planTrialReminder(org({ trial_started_at: null, trial_ends_at: null }), NÅ),
    ).toBeNull();
  });

  it("varsler når yttergrensen på 30 dager slår inn uten at klokka startet", () => {
    const varsel = planTrialReminder(
      org({
        trial_started_at: null,
        trial_ends_at: null,
        trial_hard_expires_at: new Date("2026-09-23T09:00:00.000Z"),
      }),
      NÅ,
    );
    expect(varsel).toMatchObject({ stage: 0 });
  });
});
