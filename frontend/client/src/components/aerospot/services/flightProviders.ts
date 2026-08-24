/**
 * aerospot/services/flightProviders.ts
 *
 * FlightDataProvider-abstraksjon: appen binder seg aldri direkte til
 * én flight-API.
 *
 *   MockFlightProvider  — realistisk simulering (ingen API-nøkkel)
 *   HttpFlightProvider  — backend-proxy /api/aerospot/flights (OpenSky)
 *
 * getFlightProvider() velger HTTP med automatisk fallback til mock ved
 * nettverksfeil, så UI alltid har data.
 */

import type { FlightDataProvider, LiveFlight, Rarity } from "../types";
import { classifyRarity } from "./RarityService";
import { OSL } from "../data/osl";

// ── Mock ────────────────────────────────────────────────────────────

interface MockRoute {
  callsign: string;
  flightNumber: string;
  registration: string;
  aircraftType: string;
  aircraftIcao: string;
  airline: string;
  origin: string;
  destination: string;
  /** minutter til landing ved sim-start */
  etaOffsetMin: number;
  approachBearingDeg: number; // retningen flyet kommer FRA ift OSL
  cruiseSpeedKt: number;
}

const MOCK_ROUTES: MockRoute[] = [
  { callsign: "GTI8087", flightNumber: "5Y8087", registration: "N852GT", aircraftType: "Boeing 747-8F", aircraftIcao: "B748", airline: "Atlas Air", origin: "Atlanta", destination: "Oslo", etaOffsetMin: 24, approachBearingDeg: 225, cruiseSpeedKt: 460 },
  { callsign: "UAE161", flightNumber: "EK161", registration: "A6-EVL", aircraftType: "Airbus A380-800", aircraftIcao: "A388", airline: "Emirates", origin: "Dubai", destination: "Oslo", etaOffsetMin: 38, approachBearingDeg: 160, cruiseSpeedKt: 470 },
  { callsign: "SAS1472", flightNumber: "SK1472", registration: "SE-ROJ", aircraftType: "Airbus A320neo", aircraftIcao: "A20N", airline: "SAS", origin: "København", destination: "Oslo", etaOffsetMin: 9, approachBearingDeg: 190, cruiseSpeedKt: 420 },
  { callsign: "NAX1938", flightNumber: "DY1938", registration: "LN-ENM", aircraftType: "Boeing 737-800", aircraftIcao: "B738", airline: "Norwegian", origin: "Alicante", destination: "Oslo", etaOffsetMin: 14, approachBearingDeg: 210, cruiseSpeedKt: 430 },
  { callsign: "ANA203", flightNumber: "NH203", registration: "JA795A", aircraftType: "Boeing 777-300ER", aircraftIcao: "B77W", airline: "ANA", origin: "Tokyo", destination: "Oslo", etaOffsetMin: 55, approachBearingDeg: 70, cruiseSpeedKt: 480 },
  { callsign: "QTR7301", flightNumber: "QR7301", registration: "A7-BGA", aircraftType: "Boeing 777F", aircraftIcao: "B77W", airline: "Qatar Cargo", origin: "Doha", destination: "Oslo", etaOffsetMin: 72, approachBearingDeg: 140, cruiseSpeedKt: 470 },
  { callsign: "WIF612", flightNumber: "WF612", registration: "LN-WEA", aircraftType: "DHC Dash 8-100", aircraftIcao: "DH8A", airline: "Widerøe", origin: "Fagernes", destination: "Oslo", etaOffsetMin: 6, approachBearingDeg: 300, cruiseSpeedKt: 240 },
  { callsign: "SAS465", flightNumber: "SK465", registration: "SE-RUB", aircraftType: "Airbus A320neo", aircraftIcao: "A20N", airline: "SAS", origin: "Stavanger", destination: "Oslo", etaOffsetMin: 18, approachBearingDeg: 245, cruiseSpeedKt: 420 },
];

/** Deterministisk sim: posisjon avledes av klokkeslett, ikke tilfeldighet. */
export class MockFlightProvider implements FlightDataProvider {
  readonly name = "mock";
  private readonly epoch = Date.now();

  async getFlightsInBounds(): Promise<LiveFlight[]> {
    const elapsedMin = ((Date.now() - this.epoch) / 60000) % 90; // loop hver 90. min
    return MOCK_ROUTES.map((r) => this.simulate(r, elapsedMin)).filter(
      (f): f is LiveFlight => f !== null,
    );
  }

  async getFlightById(id: string): Promise<LiveFlight | null> {
    const all = await this.getFlightsInBounds();
    return all.find((f) => f.id === id) ?? null;
  }

  private simulate(route: MockRoute, elapsedMin: number): LiveFlight | null {
    const minToLanding = route.etaOffsetMin - elapsedMin;
    if (minToLanding < -5) return null; // landet for lenge siden
    const landed = minToLanding <= 0;

    // Avstand fra OSL langs approach-bearing
    const distanceNm = Math.max(0, minToLanding) * (route.cruiseSpeedKt / 60);
    const distKm = distanceNm * 1.852;
    const rad = (route.approachBearingDeg * Math.PI) / 180;
    const lat = OSL.position.lat + (distKm / 111) * Math.cos(rad);
    const lng =
      OSL.position.lng + (distKm / (111 * Math.cos((OSL.position.lat * Math.PI) / 180))) * Math.sin(rad);

    const altitudeFt = landed
      ? 0
      : Math.min(38000, Math.max(800, minToLanding * 1100));
    const speedKt = landed ? 15 : Math.min(route.cruiseSpeedKt, Math.max(140, minToLanding * 40));

    const rarity: Rarity = classifyRarity({ aircraftIcao: route.aircraftIcao, callsign: route.callsign });

    return {
      id: `mock-${route.callsign}`,
      callsign: route.callsign,
      flightNumber: route.flightNumber,
      registration: route.registration,
      aircraftType: route.aircraftType,
      aircraftIcao: route.aircraftIcao,
      airline: route.airline,
      origin: route.origin,
      destination: route.destination,
      latitude: lat,
      longitude: lng,
      altitudeFt: Math.round(altitudeFt),
      groundSpeedKt: Math.round(speedKt),
      verticalSpeedFpm: landed ? 0 : -Math.round(Math.min(1800, altitudeFt / Math.max(1, minToLanding))),
      headingDeg: (route.approachBearingDeg + 180) % 360, // flyr mot OSL
      etaIso: new Date(Date.now() + minToLanding * 60000).toISOString(),
      rarity,
      onGround: landed,
      lastSeenIso: new Date().toISOString(),
    };
  }
}

// ── HTTP (backend-proxy → OpenSky) ──────────────────────────────────

interface ApiFlight {
  id: string;
  callsign: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKt: number;
  verticalSpeedFpm: number;
  headingDeg: number;
  onGround: boolean;
  lastSeenIso: string;
}

export class HttpFlightProvider implements FlightDataProvider {
  readonly name = "opensky";

  async getFlightsInBounds(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }): Promise<LiveFlight[]> {
    const qs = new URLSearchParams({
      south: String(bounds.south),
      west: String(bounds.west),
      north: String(bounds.north),
      east: String(bounds.east),
    });
    const res = await fetch(`/api/aerospot/flights?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`flights fetch failed (${res.status})`);
    const body = (await res.json()) as { flights: ApiFlight[] };
    return body.flights.map((f) => ({
      ...f,
      rarity: classifyRarity({ callsign: f.callsign }),
    }));
  }

  async getFlightById(id: string): Promise<LiveFlight | null> {
    const res = await fetch(`/api/aerospot/flights/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { flight: ApiFlight | null };
    if (!body.flight) return null;
    return { ...body.flight, rarity: classifyRarity({ callsign: body.flight.callsign }) };
  }
}

// ── Factory med fallback ────────────────────────────────────────────

let cachedProvider: FlightDataProvider | null = null;

/**
 * HTTP-provider med automatisk mock-fallback. Fallbacken er per kall —
 * kommer nettet tilbake, brukes live-data igjen.
 */
export function getFlightProvider(): FlightDataProvider {
  if (cachedProvider) return cachedProvider;
  const http = new HttpFlightProvider();
  const mock = new MockFlightProvider();
  cachedProvider = {
    name: "auto",
    async getFlightsInBounds(bounds) {
      try {
        const flights = await http.getFlightsInBounds(bounds);
        return flights.length > 0 ? flights : mock.getFlightsInBounds();
      } catch {
        return mock.getFlightsInBounds();
      }
    },
    async getFlightById(id) {
      if (id.startsWith("mock-")) return mock.getFlightById(id);
      try {
        return await http.getFlightById(id);
      } catch {
        return null;
      }
    },
  };
  return cachedProvider;
}
