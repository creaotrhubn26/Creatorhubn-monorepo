import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  buyoutTermsSchema,
  listExpiringRights,
  BUYOUT_TERRITORIES,
  BUYOUT_MEDIA_CHANNELS,
} from "./role-room-buyout-service.js";

const base = {
  projectId: "p1",
  contractId: "c1",
};

describe("buyoutTermsSchema", () => {
  it("godtar et vanlig tidsbegrenset kjøp", () => {
    const out = buyoutTermsSchema.parse({
      ...base,
      territories: ["norway", "nordics"],
      mediaChannels: ["tv", "online"],
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      fee: 50000,
    });
    expect(out.currency).toBe("NOK");
    expect(out.exclusivity).toBe("none");
    expect(out.unlimited).toBe(false);
  });

  it("avviser territorium utenfor vokabularet", () => {
    expect(() => buyoutTermsSchema.parse({ ...base, territories: ["mars"] })).toThrow();
  });

  it("avviser mediekanal utenfor vokabularet", () => {
    expect(() => buyoutTermsSchema.parse({ ...base, mediaChannels: ["telepati"] })).toThrow();
  });

  it("avviser evigvarende kjøp med sluttdato", () => {
    // De to utelukker hverandre — ellers vet ikke utløpsvarslingen hva den skal tro.
    expect(() =>
      buyoutTermsSchema.parse({ ...base, unlimited: true, endsAt: "2027-01-01" }),
    ).toThrow(/evigvarende/i);
  });

  it("godtar evigvarende kjøp uten sluttdato", () => {
    expect(buyoutTermsSchema.parse({ ...base, unlimited: true }).unlimited).toBe(true);
  });

  it("krever kategori når eksklusiviteten er kategori-basert", () => {
    expect(() => buyoutTermsSchema.parse({ ...base, exclusivity: "category" })).toThrow(/kategori/i);
    expect(
      buyoutTermsSchema.parse({ ...base, exclusivity: "category", exclusivityCategory: "bank/finans" })
        .exclusivityCategory,
    ).toBe("bank/finans");
  });

  it("avviser blank kategori like godt som manglende", () => {
    expect(() =>
      buyoutTermsSchema.parse({ ...base, exclusivity: "category", exclusivityCategory: "   " }),
    ).toThrow(/kategori/i);
  });

  it("avviser opsjonsvilkår uten at opsjon er avtalt", () => {
    expect(() => buyoutTermsSchema.parse({ ...base, renewalNoticeDays: 30 })).toThrow(/opsjon/i);
    expect(() => buyoutTermsSchema.parse({ ...base, renewalFee: 10000 })).toThrow(/opsjon/i);
  });

  it("godtar opsjonsvilkår når opsjon er avtalt", () => {
    const out = buyoutTermsSchema.parse({
      ...base, renewalOption: true, renewalFee: 10000, renewalNoticeDays: 30,
    });
    expect(out.renewalNoticeDays).toBe(30);
  });

  it("avviser omvendt periode", () => {
    expect(() =>
      buyoutTermsSchema.parse({ ...base, startsAt: "2026-12-31", endsAt: "2026-01-01" }),
    ).toThrow(/sluttdato/i);
  });

  it("godtar periode som starter og slutter samme dag", () => {
    expect(() =>
      buyoutTermsSchema.parse({ ...base, startsAt: "2026-05-01", endsAt: "2026-05-01" }),
    ).not.toThrow();
  });

  it("avviser negativt vederlag", () => {
    expect(() => buyoutTermsSchema.parse({ ...base, fee: -1 })).toThrow();
  });

  it("vokabularet matcher det migrering 0446 håndhever", () => {
    // Driver ut av synk her merkes som en constraint-feil i prod, ikke en
    // valideringsfeil — derfor holdes listene bevisst identiske.
    expect([...BUYOUT_TERRITORIES]).toEqual(["norway", "nordics", "europe", "world", "online_only"]);
    expect([...BUYOUT_MEDIA_CHANNELS]).toEqual([
      "tv", "online", "social", "cinema", "print", "ooh", "radio", "instore",
    ]);
  });
});

describe("listExpiringRights", () => {
  const stub = () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    return { pool: { query } as unknown as Pool, query };
  };

  it("utelater evigvarende kjøp", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool);
    expect(query.mock.calls[0][0]).toContain("unlimited = FALSE");
  });

  it("tar med allerede utløpte (de mest akutte)", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool);
    // Øvre grense, ingen nedre — negative days_remaining slipper gjennom.
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("ends_at <=");
    expect(sql).not.toContain("ends_at >= CURRENT_DATE");
  });

  it("bruker 90 dager som standardvindu", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool);
    expect(query.mock.calls[0][1]).toContain("90");
  });

  it("avviser negativt vindu framfor å spørre bakover", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool, { withinDays: -30 });
    expect(query.mock.calls[0][1]).toContain("0");
  });

  it("scoper til prosjekt når det er oppgitt", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool, { projectId: "p1" });
    expect(query.mock.calls[0][0]).toContain("project_id =");
    expect(query.mock.calls[0][1]).toContain("p1");
  });

  it("klipper limit mot et tak", async () => {
    const { pool, query } = stub();
    await listExpiringRights(pool, { limit: 99999 });
    expect(query.mock.calls[0][1]).toContain(1000);
  });
});
