import { describe, expect, it } from "vitest";
import {
  orderRoute,
  haversineDriveFns,
  matrixDriveFns,
  type RoutePoint,
} from "../leadgrid-route-service";

describe("orderRoute", () => {
  // 3 leads. node 0 = start. Symmetrisk sekund-matrise (4x4).
  // Avstander (sek) fra start(0): L0=node1=300, L1=node2=100, L2=node3=900.
  // Mellom leads: 1-2=200, 1-3=100, 2-3=800.
  const sec = [
    [0, 300, 100, 900],
    [300, 0, 200, 100],
    [100, 200, 0, 800],
    [900, 100, 800, 0],
  ];
  const driveSec = (a: number, b: number) => sec[a][b];
  const driveM = (a: number, b: number) => sec[a][b] * 10;

  it("tom liste gir tom rute", () => {
    const r = orderRoute([], driveSec, driveM);
    expect(r.order).toEqual([]);
    expect(r.totalDriveSec).toBe(0);
  });

  it("starter på høyest prioritet, så nærmeste-nabo", () => {
    // L0 har høyest prioritet → første stopp.
    // Fra L0 (node1): nærmest er L2 (node3, 100) < L1 (node2, 200) → L2.
    // Fra L2 (node3): gjenstår L1 (node2, 800).
    const r = orderRoute([10, 5, 1], driveSec, driveM);
    expect(r.order).toEqual([0, 2, 1]);
    expect(r.legs[0].driveSec).toBe(300); // start→L0
    expect(r.legs[1].driveSec).toBe(100); // L0→L2
    expect(r.legs[2].driveSec).toBe(800); // L2→L1
    expect(r.totalDriveSec).toBe(1200);
    expect(r.totalDistanceM).toBe(12000);
  });

  it("tie i prioritet brytes på korteste kjøretid fra start", () => {
    // Alle lik prioritet → første = nærmest start: L1 (node2, 100).
    const r = orderRoute([1, 1, 1], driveSec, driveM);
    expect(r.order[0]).toBe(1);
  });

  it("besøker alle leads nøyaktig én gang", () => {
    const r = orderRoute([3, 2, 1], driveSec, driveM);
    expect([...r.order].sort()).toEqual([0, 1, 2]);
  });
});

describe("haversineDriveFns", () => {
  const points: RoutePoint[] = [
    { lat: 59.9139, lng: 10.7522 }, // Oslo
    { lat: 59.9239, lng: 10.7622 }, // ~1.3 km unna
  ];
  it("0 mellom samme punkt", () => {
    const fns = haversineDriveFns(points);
    expect(fns.meters(0, 0)).toBe(0);
    expect(fns.seconds(0, 0)).toBe(0);
  });
  it("positiv avstand + tid mellom ulike punkter", () => {
    const fns = haversineDriveFns(points);
    expect(fns.meters(0, 1)).toBeGreaterThan(500);
    expect(fns.seconds(0, 1)).toBeGreaterThan(0);
  });
});

describe("matrixDriveFns", () => {
  const points: RoutePoint[] = [
    { lat: 59.9, lng: 10.7 }, { lat: 60.0, lng: 10.8 },
  ];
  it("bruker matrise når verdi finnes", () => {
    const fns = matrixDriveFns(points, { meters: [[0, 1234], [1234, 0]], seconds: [[0, 99], [99, 0]] });
    expect(fns.meters(0, 1)).toBe(1234);
    expect(fns.seconds(0, 1)).toBe(99);
  });
  it("faller tilbake til haversine ved manglende verdi (-1)", () => {
    const fns = matrixDriveFns(points, { meters: [[0, -1], [-1, 0]], seconds: [[0, -1], [-1, 0]] });
    expect(fns.meters(0, 1)).toBeGreaterThan(0);
    expect(fns.seconds(0, 1)).toBeGreaterThan(0);
  });
  it("null matrise → ren haversine", () => {
    const fns = matrixDriveFns(points, null);
    expect(fns.meters(0, 1)).toBeGreaterThan(0);
  });
});
