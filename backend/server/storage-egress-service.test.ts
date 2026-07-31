import { describe, it, expect } from "vitest";
import { freeEgressStatus } from "./storage-egress-service.js";

const GIB = 1024 * 1024 * 1024;

describe("freeEgressStatus", () => {
  it("lar egress innenfor 3x lagret mengde være gratis", () => {
    const s = freeEgressStatus(10 * GIB, 25 * GIB, 3);
    expect(s.freeAllowanceBytes).toBe(30 * GIB);
    expect(s.overageBytes).toBe(0);
  });

  it("regner ut hvor mye som ligger over kvoten", () => {
    const s = freeEgressStatus(10 * GIB, 50 * GIB, 3);
    expect(s.overageBytes).toBe(20 * GIB);
  });

  it("lar kvoten vokse med lagret mengde", () => {
    // Poenget med et multiplum framfor en fast grense: den store kunden
    // som arkiverer mye får hente mye, uten at den lille straffes.
    const liten = freeEgressStatus(1 * GIB, 5 * GIB, 3);
    const stor = freeEgressStatus(100 * GIB, 5 * GIB, 3);
    expect(liten.overageBytes).toBeGreaterThan(0);
    expect(stor.overageBytes).toBe(0);
  });

  it("gir null gratis når ingenting er lagret", () => {
    // Kvoten følger lagret mengde. Uten lagring finnes den ikke, og alt
    // som hentes koster.
    const s = freeEgressStatus(0, 5 * GIB, 3);
    expect(s.freeAllowanceBytes).toBe(0);
    expect(s.overageBytes).toBe(5 * GIB);
  });

  it("gir null andel — ikke 0 prosent — når det ikke finnes en kvote", () => {
    // 0 ville sett ut som «god plass igjen» i en graf, når svaret er at
    // det ikke finnes noe å bruke av.
    expect(freeEgressStatus(0, 5 * GIB, 3).usedFraction).toBeNull();
  });

  it("regner ingen overage når kvoten er ubegrenset", () => {
    // R2 har fri egress. Infinity som tall ville forplantet seg videre.
    const s = freeEgressStatus(1 * GIB, 500 * GIB, Infinity);
    expect(s.overageBytes).toBe(0);
    expect(s.usedFraction).toBeNull();
  });

  it("fakturerer alt når multiplikatoren er null", () => {
    // Cloudflare Stream har ingen gratiskvote.
    const s = freeEgressStatus(10 * GIB, 4 * GIB, 0);
    expect(s.freeAllowanceBytes).toBe(0);
    expect(s.overageBytes).toBe(4 * GIB);
  });

  it("behandler negative tall som null i stedet for negativ egress", () => {
    const s = freeEgressStatus(-5, -5, 3);
    expect(s.storedBytes).toBe(0);
    expect(s.egressBytes).toBe(0);
    expect(s.overageBytes).toBe(0);
  });

  it("viser andelen brukt så en kunde kan varsles før grensen", () => {
    const s = freeEgressStatus(10 * GIB, 24 * GIB, 3);
    expect(s.usedFraction).toBeCloseTo(0.8, 6);
  });
});
