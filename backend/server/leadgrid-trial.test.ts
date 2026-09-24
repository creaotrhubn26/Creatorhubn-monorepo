import { describe, expect, it, vi } from "vitest";

import {
  evaluateTrial,
  startTrialOnFirstDiscovery,
  TRIAL_DAYS,
} from "./leadgrid-trial.js";

const nå = new Date("2026-09-24T12:00:00Z");
const om = (dager: number) => new Date(nå.getTime() + dager * 86_400_000);

const tom = {
  plan: "trial",
  stripe_subscription_id: null,
  trial_started_at: null,
  trial_ends_at: null,
  trial_hard_expires_at: om(30),
};

describe("evaluateTrial", () => {
  it("lar klokka stå til første Discovery-kjøring", () => {
    const ut = evaluateTrial(tom, nå);
    expect(ut.state).toBe("not_started");
    expect(ut.read_only).toBe(false);
    expect(ut.message).toContain("starter når du kjører ditt første søk");
  });

  it("teller dager når klokka går", () => {
    const ut = evaluateTrial(
      { ...tom, trial_started_at: om(-2), trial_ends_at: om(5) },
      nå,
    );
    expect(ut.state).toBe("active");
    expect(ut.days_left).toBe(5);
  });

  it("sier fra på siste dag", () => {
    const ut = evaluateTrial(
      { ...tom, trial_started_at: om(-6), trial_ends_at: om(1) },
      nå,
    );
    expect(ut.days_left).toBe(1);
    expect(ut.message).toContain("Siste dag");
  });

  it("skrivebeskytter i stedet for å stenge", () => {
    // De skal se leadene sine. Å fjerne dem er fiendtlig, og å skjule dem
    // fjerner det eneste som får noen til å betale.
    const ut = evaluateTrial(
      { ...tom, trial_started_at: om(-8), trial_ends_at: om(-1) },
      nå,
    );
    expect(ut.state).toBe("expired");
    expect(ut.read_only).toBe(true);
    expect(ut.message).toContain("ser leadene dine");
  });

  it("lar yttergrensen slå inn selv om Discovery aldri ble kjørt", () => {
    const ut = evaluateTrial({ ...tom, trial_hard_expires_at: om(-1) }, nå);
    expect(ut.state).toBe("expired");
    expect(ut.read_only).toBe(true);
  });

  it("gir betalende kunder ingen prøvetid å gå tom for", () => {
    const ut = evaluateTrial(
      { ...tom, stripe_subscription_id: "sub_1", trial_ends_at: om(-5) },
      nå,
    );
    expect(ut.state).toBe("paid");
    expect(ut.read_only).toBe(false);
  });

  it("regner en betalt plan som betalende selv uten Stripe-abonnement", () => {
    // Faktura-kunder har ingen subscription-id.
    const ut = evaluateTrial({ ...tom, plan: "vekst", trial_ends_at: om(-5) }, nå);
    expect(ut.state).toBe("paid");
  });

  it("runder opp: en halv dag igjen er fortsatt en dag", () => {
    const ut = evaluateTrial(
      { ...tom, trial_started_at: om(-6), trial_ends_at: new Date(nå.getTime() + 43_200_000) },
      nå,
    );
    expect(ut.days_left).toBe(1);
    expect(ut.read_only).toBe(false);
  });
});

describe("startTrialOnFirstDiscovery", () => {
  it("setter sluttdato sju dager fram", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    const startet = await startTrialOnFirstDiscovery(
      { query } as never,
      "11111111-1111-4111-8111-111111111111",
      nå,
    );
    expect(startet).toBe(true);
    const params = query.mock.calls[0][1] as Date[];
    expect(params[2].getTime() - nå.getTime()).toBe(TRIAL_DAYS * 86_400_000);
  });

  it("forlenger ikke prøvetiden ved kjøring nummer to", async () => {
    // WHERE trial_started_at IS NULL gjør den idempotent. Uten det ville
    // hvert søk nullstilt klokka, og prøvetiden vart evig.
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    expect(
      await startTrialOnFirstDiscovery({ query } as never, "org", nå),
    ).toBe(false);
    expect(String(query.mock.calls[0][0])).toContain("trial_started_at IS NULL");
  });

  it("rører ikke en org som alt betaler", async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    await startTrialOnFirstDiscovery({ query } as never, "org", nå);
    expect(String(query.mock.calls[0][0])).toContain("stripe_subscription_id IS NULL");
  });
});
