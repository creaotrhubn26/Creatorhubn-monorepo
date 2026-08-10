import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EGRESS_WARN_FRACTION,
  accountEgress,
  platformMargin,
  productionCosts,
  rolloutStatus,
} from "./admin-storage-status-service.js";
import type { BucketStatus } from "./b2-bucket-registry.js";
import type { B2RoleStatus } from "./b2-key-registry.js";

const GIB = 1024 * 1024 * 1024;

const ENV_KEYS = ["STORAGE_COST_NOK_PER_USD"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.STORAGE_COST_NOK_PER_USD = "10";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const role = (name: string, configured: boolean, shared: boolean): B2RoleStatus =>
  ({
    role: name,
    purpose: "",
    requiredCapabilities: [],
    envVars: { id: "", secret: "" },
    configured,
    usingSharedFallback: shared,
    keyIdSuffix: configured ? "1234" : null,
  }) as unknown as B2RoleStatus;

const bucket = (name: string, b: string | null, shared: boolean): BucketStatus =>
  ({
    storageClass: name,
    purpose: "",
    immutable: false,
    envVar: "",
    suggestedBucket: "",
    bucket: b,
    usingSharedFallback: shared,
  }) as unknown as BucketStatus;

describe("rolloutStatus", () => {
  it("melder ferdig bare når både nøkler og bøtter er på plass", () => {
    // Halve jobben gir ingen isolasjon: egne nøkler mot én felles bøtte
    // betyr fortsatt at hver nøkkel når alt.
    const done = rolloutStatus(
      [role("capture-read", true, false)],
      [bucket("originals", "trr-prod-originals", false)],
    );
    expect(done.complete).toBe(true);

    const halfway = rolloutStatus(
      [role("capture-read", true, false)],
      [bucket("originals", "felles", true)],
    );
    expect(halfway.complete).toBe(false);
  });

  it("navngir det som fortsatt deler", () => {
    const s = rolloutStatus(
      [role("capture-read", true, false), role("archive", true, true)],
      [bucket("originals", "felles", true)],
    );
    expect(s.keyRolesSharingFallback).toEqual(["archive"]);
    expect(s.bucketClassesSharingFallback).toEqual(["originals"]);
    expect(s.keyRolesScoped).toBe(1);
  });

  it("melder ikke ferdig når B2 ikke er konfigurert", () => {
    // En tom liste roller som deler nøkkel er ikke det samme som at alle
    // har sin egen. «Ferdig» her ville vært direkte misvisende.
    const s = rolloutStatus([role("capture-read", false, false)], [bucket("originals", null, false)]);
    expect(s.configured).toBe(false);
    expect(s.complete).toBe(false);
  });

  it("teller totalen selv om ingenting er konfigurert", () => {
    const s = rolloutStatus(
      [role("a", false, false), role("b", false, false)],
      [bucket("x", null, false)],
    );
    expect(s.keyRolesTotal).toBe(2);
    expect(s.bucketClassesTotal).toBe(1);
    expect(s.keyRolesScoped).toBe(0);
  });
});

describe("productionCosts", () => {
  const prod = (id: string, over: Partial<Record<string, number>> = {}) => ({
    projectId: id,
    projectName: id,
    billingUserId: "produsent",
    usedBytes: 0,
    b2Bytes: 0,
    r2Bytes: 0,
    streamBytes: 0,
    filesystemBytes: 0,
    fileCount: 1,
    ...over,
  });

  it("regner på backend-fordelingen, ikke på totalen", () => {
    // Stream koster mange ganger mer per GB enn B2. To produksjoner med
    // like mange GB er derfor ikke like dyre, og en beregning på
    // usedBytes alene ville vist dem som det.
    const { productions } = productionCosts([
      prod("dailies", { usedBytes: 100 * GIB, b2Bytes: 100 * GIB }),
      prod("selftape", { usedBytes: 100 * GIB, streamBytes: 100 * GIB }),
    ]);
    const dailies = productions.find((p) => p.projectId === "dailies")!;
    const selftape = productions.find((p) => p.projectId === "selftape")!;
    expect(selftape.monthlyCostNok).toBeGreaterThan(dailies.monthlyCostNok);
  });

  it("regner filesystem som gratis — det er en fast kostnad", () => {
    const { totalMonthlyCostNok } = productionCosts([
      prod("disk", { usedBytes: 500 * GIB, filesystemBytes: 500 * GIB }),
    ]);
    expect(totalMonthlyCostNok).toBe(0);
  });

  it("summerer kostnaden på tvers av produksjonene", () => {
    const { totalMonthlyCostNok, productions } = productionCosts([
      prod("a", { usedBytes: 100 * GIB, b2Bytes: 100 * GIB }),
      prod("b", { usedBytes: 100 * GIB, b2Bytes: 100 * GIB }),
    ]);
    expect(totalMonthlyCostNok).toBeCloseTo(
      productions.reduce((s, p) => s + p.monthlyCostNok, 0),
      6,
    );
  });

  it("gir andeler som summerer til én", () => {
    const { productions } = productionCosts([
      prod("a", { usedBytes: 30 * GIB, b2Bytes: 30 * GIB }),
      prod("b", { usedBytes: 70 * GIB, b2Bytes: 70 * GIB }),
    ]);
    expect(productions.reduce((s, p) => s + p.shareOfTotal, 0)).toBeCloseTo(1, 6);
  });

  it("gir null andel i stedet for NaN når alt er tomt", () => {
    // NaN forplanter seg gjennom hver graf den havner i.
    const { productions } = productionCosts([prod("tom")]);
    expect(productions[0].shareOfTotal).toBe(0);
    expect(Number.isNaN(productions[0].shareOfTotal)).toBe(false);
  });

  it("håndterer en tom liste", () => {
    expect(productionCosts([])).toEqual({
      productions: [],
      totalMonthlyCostNok: 0,
    });
  });
});

describe("accountEgress", () => {
  const acct = (over: Partial<Record<string, unknown>> = {}) => ({
    userId: "u1",
    email: "u1@example.com",
    storedBytes: 10 * GIB,
    egressBytes: 0,
    backend: "b2" as const,
    ...over,
  });

  it("lar kvoten vokse med lagret mengde", () => {
    // 3x lagret. Den store kunden får hente mer uten at den lille straffes.
    const [liten, stor] = accountEgress([
      acct({ storedBytes: 1 * GIB, egressBytes: 5 * GIB }),
      acct({ storedBytes: 100 * GIB, egressBytes: 5 * GIB }),
    ]);
    expect(liten.overageBytes).toBeGreaterThan(0);
    expect(stor.overageBytes).toBe(0);
  });

  it("varsler før kostnaden slår inn, ikke etter", () => {
    // Ved 1.0 har regningen allerede begynt å løpe.
    const [row] = accountEgress([
      acct({ storedBytes: 10 * GIB, egressBytes: 24 * GIB }),
    ]);
    expect(row.usedFraction).toBeCloseTo(0.8, 6);
    expect(row.approachingLimit).toBe(true);
    expect(row.overageBytes).toBe(0);
  });

  it("varsler ikke under terskelen", () => {
    const [row] = accountEgress([
      acct({ storedBytes: 10 * GIB, egressBytes: 10 * GIB }),
    ]);
    expect(row.usedFraction).toBeLessThan(EGRESS_WARN_FRACTION);
    expect(row.approachingLimit).toBe(false);
  });

  it("regner kostnaden på det som ligger over kvoten", () => {
    const [row] = accountEgress([
      acct({ storedBytes: 10 * GIB, egressBytes: 50 * GIB }),
    ]);
    expect(row.overageBytes).toBe(20 * GIB);
    expect(row.egressCostNok).toBeGreaterThan(0);
  });

  it("varsler ikke en konto uten lagring, men regner alt som kostbart", () => {
    // Uten lagring finnes ingen kvote. usedFraction er udefinert, ikke 0 —
    // og et varsel om «80 % brukt» av ingenting ville vært støy.
    const [row] = accountEgress([acct({ storedBytes: 0, egressBytes: 5 * GIB })]);
    expect(row.usedFraction).toBeNull();
    expect(row.approachingLimit).toBe(false);
    expect(row.overageBytes).toBe(5 * GIB);
  });

  it("gir aldri egress-kostnad på R2 — der er den gratis", () => {
    const [row] = accountEgress([
      acct({ backend: "r2" as const, storedBytes: 1 * GIB, egressBytes: 500 * GIB }),
    ]);
    expect(row.egressCostNok).toBe(0);
    expect(row.overageBytes).toBe(0);
  });

  it("beholder e-post og id så raden kan følges opp", () => {
    const [row] = accountEgress([acct()]);
    expect(row.userId).toBe("u1");
    expect(row.email).toBe("u1@example.com");
  });
});

describe("platformMargin", () => {
  it("viser negativ margin når inntekten mangler", () => {
    // Oversikten kjenner ikke Stripe-inntekten. Å gjette et tall ville
    // vært verre enn å vise at det mangler.
    const m = platformMargin([{ backend: "b2", storedBytes: 1000 * GIB }], 0);
    expect(m.marginNok).toBeLessThan(0);
    expect(m.marginFraction).toBeNull();
  });

  it("regner margin når inntekten er kjent", () => {
    const m = platformMargin([{ backend: "b2", storedBytes: 100 * GIB }], 100);
    expect(m.costNok).toBeCloseTo(6, 6);
    expect(m.marginFraction).toBeCloseTo(0.94, 6);
  });
});
