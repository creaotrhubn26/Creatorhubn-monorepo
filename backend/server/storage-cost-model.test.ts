import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  backendCostBasis,
  costForBackendUsage,
  marginForUsage,
  priceForTargetMargin,
} from "./storage-cost-model.js";

const ENV_KEYS = [
  "STORAGE_COST_NOK_PER_USD",
  "STORAGE_COST_B2_PER_GB_MONTH",
  "STORAGE_COST_B2_EGRESS_PER_GB",
  "STORAGE_COST_B2_FREE_EGRESS_MULTIPLIER",
  "STORAGE_COST_R2_PER_GB_MONTH",
  "STORAGE_COST_STREAM_PER_GB_MONTH",
  "STORAGE_COST_STREAM_EGRESS_PER_GB",
] as const;

const GIB = 1024 * 1024 * 1024;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // Fast kurs i testene — ellers ville tallene flyttet seg med env.
  process.env.STORAGE_COST_NOK_PER_USD = "10";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("backendCostBasis", () => {
  it("priser B2 lavere enn R2 per GB", () => {
    // Hele grunnen til å skille backends: den blandede faktoren var
    // regnet på Cloudflare, og overvurderer kostnaden nå som B2 er primær.
    const basis = backendCostBasis();
    expect(basis.b2.storagePerGbMonthUsd).toBeLessThan(
      basis.r2.storagePerGbMonthUsd,
    );
  });

  it("regner filesystem som null — den er en fast kostnad, ikke per fil", () => {
    expect(backendCostBasis().filesystem.storagePerGbMonthUsd).toBe(0);
  });

  it("avviser negativ pris fra env og faller tilbake til defaulten", () => {
    process.env.STORAGE_COST_B2_PER_GB_MONTH = "-5";
    expect(backendCostBasis().b2.storagePerGbMonthUsd).toBe(0.006);
  });

  it("avviser en env-verdi som ikke er et tall", () => {
    process.env.STORAGE_COST_B2_PER_GB_MONTH = "billig";
    expect(backendCostBasis().b2.storagePerGbMonthUsd).toBe(0.006);
  });

  it("godtar null som gyldig pris — en avtale kan ha fri lagring", () => {
    process.env.STORAGE_COST_B2_PER_GB_MONTH = "0";
    expect(backendCostBasis().b2.storagePerGbMonthUsd).toBe(0);
  });
});

describe("costForBackendUsage", () => {
  it("regner lagring per GB per måned", () => {
    const r = costForBackendUsage({ backend: "b2", storedBytes: 100 * GIB });
    // 100 GB · $0.006 · 10 NOK = 6 NOK
    expect(r.storageCostNok).toBeCloseTo(6, 6);
    expect(r.egressCostNok).toBe(0);
  });

  it("lar egress innenfor 3x lagret mengde være gratis på B2", () => {
    const r = costForBackendUsage({
      backend: "b2",
      storedBytes: 10 * GIB,
      egressBytes: 30 * GIB,
    });
    expect(r.billableEgressGb).toBe(0);
    expect(r.egressCostNok).toBe(0);
  });

  it("fakturerer egress over gratiskvantumet", () => {
    // 10 GB lagret gir 30 GB gratis; 50 GB hentet betyr 20 GB å betale.
    const r = costForBackendUsage({
      backend: "b2",
      storedBytes: 10 * GIB,
      egressBytes: 50 * GIB,
    });
    expect(r.billableEgressGb).toBeCloseTo(20, 6);
    expect(r.egressCostNok).toBeCloseTo(20 * 0.01 * 10, 6);
  });

  it("gir null gratis egress når ingenting er lagret", () => {
    // Gratiskvantumet følger lagret mengde. Uten lagring finnes det ikke.
    const r = costForBackendUsage({
      backend: "b2",
      storedBytes: 0,
      egressBytes: 5 * GIB,
    });
    expect(r.freeEgressGb).toBe(0);
    expect(r.billableEgressGb).toBeCloseTo(5, 6);
  });

  it("regner all egress som gratis på R2", () => {
    const r = costForBackendUsage({
      backend: "r2",
      storedBytes: 1 * GIB,
      egressBytes: 500 * GIB,
    });
    expect(r.egressCostNok).toBe(0);
    expect(r.billableEgressGb).toBe(0);
  });

  it("fakturerer all egress på Stream — der finnes ingen gratiskvote", () => {
    const r = costForBackendUsage({
      backend: "cloudflare_stream",
      storedBytes: 10 * GIB,
      egressBytes: 1 * GIB,
    });
    expect(r.freeEgressGb).toBe(0);
    expect(r.billableEgressGb).toBeCloseTo(1, 6);
  });

  it("behandler negative bytes som null i stedet for negativ kostnad", () => {
    const r = costForBackendUsage({ backend: "b2", storedBytes: -500 });
    expect(r.storedGb).toBe(0);
    expect(r.totalCostNok).toBe(0);
  });
});

describe("marginForUsage", () => {
  it("summerer kostnaden på tvers av backends", () => {
    const m = marginForUsage(
      [
        { backend: "b2", storedBytes: 100 * GIB },
        { backend: "cloudflare_stream", storedBytes: 1 * GIB },
      ],
      100,
    );
    // 6 NOK + 1 NOK = 7 NOK
    expect(m.costNok).toBeCloseTo(7, 6);
    expect(m.marginNok).toBeCloseTo(93, 6);
    expect(m.marginFraction).toBeCloseTo(0.93, 6);
  });

  it("gir null margin-andel på null inntekt, ikke 0 prosent", () => {
    // 0 ville sett ut som «vi går i null» i en graf. Udefinert er sant.
    const m = marginForUsage([{ backend: "b2", storedBytes: 10 * GIB }], 0);
    expect(m.marginFraction).toBeNull();
    expect(m.marginNok).toBeLessThan(0);
  });

  it("viser negativ margin når prisen ikke dekker kostnaden", () => {
    const m = marginForUsage([{ backend: "b2", storedBytes: 1000 * GIB }], 10);
    expect(m.marginNok).toBeLessThan(0);
    expect(m.marginFraction).toBeLessThan(0);
  });
});

describe("priceForTargetMargin", () => {
  it("gir prisen som treffer ønsket margin", () => {
    // Kost 0.06 NOK/GB; 70 % margin krever 0.06 / 0.3 = 0.2 NOK/GB.
    expect(priceForTargetMargin("b2", 0.7)).toBeCloseTo(0.2, 6);
  });

  it("gir kostpris ved null margin", () => {
    expect(priceForTargetMargin("b2", 0)).toBeCloseTo(0.06, 6);
  });

  it("nekter 100 prosent margin i stedet for å returnere Infinity", () => {
    // Infinity ville forplantet seg rett inn i en prisliste.
    expect(priceForTargetMargin("b2", 1)).toBeNull();
    expect(priceForTargetMargin("b2", 1.5)).toBeNull();
  });

  it("nekter negativ målmargin", () => {
    expect(priceForTargetMargin("b2", -0.2)).toBeNull();
  });

  it("krever høyere pris for R2 enn for B2 ved samme margin", () => {
    const b2 = priceForTargetMargin("b2", 0.7)!;
    const r2 = priceForTargetMargin("r2", 0.7)!;
    expect(r2).toBeGreaterThan(b2);
  });
});
