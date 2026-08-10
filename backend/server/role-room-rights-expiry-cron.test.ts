import { describe, it, expect } from "vitest";
import { expiryMessage, thresholdFor } from "./role-room-rights-expiry-cron.js";

describe("thresholdFor", () => {
  it("treffer de faste tersklene", () => {
    expect(thresholdFor(90)).toBe(90);
    expect(thresholdFor(30)).toBe(30);
    expect(thresholdFor(7)).toBe(7);
    expect(thresholdFor(0)).toBe(0);
  });

  it("varsler ikke på dager mellom terskler", () => {
    // Daglig varsel om det samme blir støy, og støy blir slått av.
    expect(thresholdFor(89)).toBeNull();
    expect(thresholdFor(45)).toBeNull();
    expect(thresholdFor(8)).toBeNull();
    expect(thresholdFor(1)).toBeNull();
  });

  it("behandler allerede utløpt som 0-terskelen", () => {
    expect(thresholdFor(-1)).toBe(0);
    expect(thresholdFor(-200)).toBe(0);
  });
});

describe("expiryMessage", () => {
  const base = {
    contract_id: "K-2026-14",
    days_remaining: 30,
    renewal_deadline_passed: false,
    territories: ["norway", "nordics"],
    media_channels: ["tv", "online"],
  };

  it("sier hvor lenge det er igjen", () => {
    const m = expiryMessage(base);
    expect(m.subject).toContain("om 30 dager");
    expect(m.subject).toContain("K-2026-14");
  });

  it("skiller ut allerede utløpt som en sterkere beskjed", () => {
    const m = expiryMessage({ ...base, days_remaining: -5 });
    expect(m.subject).toContain("UTLØPT");
    expect(m.body).toMatch(/kontraktsbrudd/i);
  });

  it("har egen ordlyd for utløp i dag", () => {
    expect(expiryMessage({ ...base, days_remaining: 0 }).subject).toContain("utløper i dag");
  });

  it("tar med omfanget, som er det man må vurdere", () => {
    const m = expiryMessage(base);
    expect(m.body).toContain("norway, nordics");
    expect(m.body).toContain("tv, online");
  });

  it("nevner tapt opsjonsfrist når den er passert", () => {
    const m = expiryMessage({ ...base, renewal_deadline_passed: true });
    expect(m.body).toMatch(/forlengelsesopsjonen er passert/i);
  });

  it("utelater opsjonsmerknaden når fristen står", () => {
    expect(expiryMessage(base).body).not.toMatch(/passert/i);
  });

  it("takler manglende omfang uten å produsere tom linje", () => {
    const m = expiryMessage({ ...base, territories: [], media_channels: [] });
    expect(m.body).not.toContain("Omfang:");
    expect(m.body).not.toContain("\n\n\n");
  });
});
