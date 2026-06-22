/**
 * leadgrid-route-service.ts
 *
 * "Smart dagsrute": ranger en selgers in-grid leads og bygg en feltrute.
 *
 * Ordningen er en ren, testbar funksjon (orderRoute): start fra leaden med
 * høyest Intelligence-prioritet, deretter nærmeste-nabo på kjøretid. Avstands-
 * /kjøretidsmatrisen hentes fra Google Distance Matrix (fetchGoogleMatrix),
 * med haversine-fallback (haversineDriveFns) når nøkkel/nett mangler.
 *
 * Node-indeksering i orderRoute: node 0 = startpunkt, node i+1 = lead i.
 */

import { haversineKm } from "./leadgrid-territory-service.js";

export interface RoutePoint { lat: number; lng: number }

export interface OrderedLeg {
  leadIndex: number;       // indeks inn i leads-arrayen
  distanceM: number;
  driveSec: number;
}

export interface OrderedRoute {
  order: number[];         // lead-indekser i besøksrekkefølge
  legs: OrderedLeg[];
  totalDistanceM: number;
  totalDriveSec: number;
}

const ASSUMED_KMH = 40;

/** Haversine-baserte avstands-/tidsfunksjoner (fallback uten Google). */
export function haversineDriveFns(points: RoutePoint[]): {
  meters: (a: number, b: number) => number;
  seconds: (a: number, b: number) => number;
} {
  const km = (a: number, b: number) =>
    haversineKm(points[a].lat, points[a].lng, points[b].lat, points[b].lng);
  return {
    meters: (a, b) => Math.round(km(a, b) * 1000),
    seconds: (a, b) => Math.round((km(a, b) / ASSUMED_KMH) * 3600),
  };
}

/**
 * Ordne en rute: node 0 = start, node i+1 = lead i. `priorities[i]` er lead
 * i sin prioritet (høyere = viktigere). Første stopp = høyest prioritet (tie:
 * nærmest start i kjøretid); deretter nærmeste-nabo. Rene funksjoner injiseres
 * for avstand/tid → fullt testbar.
 */
export function orderRoute(
  priorities: number[],
  driveSec: (from: number, to: number) => number,
  driveM: (from: number, to: number) => number,
): OrderedRoute {
  const L = priorities.length;
  if (L === 0) return { order: [], legs: [], totalDistanceM: 0, totalDriveSec: 0 };

  const remaining = new Set<number>();
  for (let i = 0; i < L; i++) remaining.add(i);

  // Første stopp: høyest prioritet, tie-break på korteste kjøretid fra start.
  let first = -1;
  for (const i of remaining) {
    if (
      first === -1 ||
      priorities[i] > priorities[first] ||
      (priorities[i] === priorities[first] && driveSec(0, i + 1) < driveSec(0, first + 1))
    ) {
      first = i;
    }
  }

  const order: number[] = [];
  const legs: OrderedLeg[] = [];
  let currentNode = 0; // start
  let next = first;
  while (next !== -1) {
    order.push(next);
    legs.push({ leadIndex: next, distanceM: driveM(currentNode, next + 1), driveSec: driveSec(currentNode, next + 1) });
    remaining.delete(next);
    currentNode = next + 1;
    // Nærmeste-nabo blant gjenværende.
    next = -1;
    for (const j of remaining) {
      if (next === -1 || driveSec(currentNode, j + 1) < driveSec(currentNode, next + 1)) next = j;
    }
  }

  return {
    order,
    legs,
    totalDistanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    totalDriveSec: legs.reduce((s, l) => s + l.driveSec, 0),
  };
}

/**
 * Hent NxN meter+sekund-matrise fra Google Distance Matrix (best effort).
 * Returnerer null hvis nøkkel mangler, for mange punkter (>25), eller feil —
 * da bruker kalleren haversine-fallback.
 */
export async function fetchGoogleMatrix(
  points: RoutePoint[],
): Promise<{ meters: number[][]; seconds: number[][] } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || points.length < 2 || points.length > 25) return null;
  const coords = points.map((p) => `${p.lat},${p.lng}`).join("|");
  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(coords)}&destinations=${encodeURIComponent(coords)}` +
      `&mode=driving&key=${key}`;
    const res = await fetch(url);
    const json: any = await res.json();
    if (json?.status !== "OK" || !Array.isArray(json.rows)) return null;
    const meters: number[][] = [];
    const seconds: number[][] = [];
    for (let i = 0; i < points.length; i++) {
      meters[i] = [];
      seconds[i] = [];
      for (let j = 0; j < points.length; j++) {
        const el = json.rows[i]?.elements?.[j];
        meters[i][j] = el?.distance?.value ?? -1;
        seconds[i][j] = el?.duration?.value ?? -1;
      }
    }
    return { meters, seconds };
  } catch (err) {
    console.warn("[route] Google Distance Matrix feilet:", err);
    return null;
  }
}

/** Bygg avstands-/tidsfunksjoner fra en Google-matrise, med haversine-fallback per element. */
export function matrixDriveFns(
  points: RoutePoint[],
  matrix: { meters: number[][]; seconds: number[][] } | null,
): {
  meters: (a: number, b: number) => number;
  seconds: (a: number, b: number) => number;
} {
  const hv = haversineDriveFns(points);
  if (!matrix) return hv;
  return {
    meters: (a, b) => (matrix.meters[a]?.[b] >= 0 ? matrix.meters[a][b] : hv.meters(a, b)),
    seconds: (a, b) => (matrix.seconds[a]?.[b] >= 0 ? matrix.seconds[a][b] : hv.seconds(a, b)),
  };
}
