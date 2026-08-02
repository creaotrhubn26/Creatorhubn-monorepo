/**
 * leadgrid-entur-routes.ts
 *
 * Entur-integrasjon for Leadgrid — «hvor lett er en bedrift å nå for
 * feltarbeidere, og hvilke transportmuligheter finnes?». Speiler
 * `leadgrid-kartverket-routes.ts` (proxy + in-memory cache + session-gate).
 *
 *   GET /api/leadgrid/entur/reachability?lat=&lon=
 *       — komposit «tilgjengelighets-score» for en lead: nærmeste
 *         holdeplasser + modi, sanntidsavganger, bysykler/elsparkesykler,
 *         og en 0–100 score m/ etikett (Utmerket/God/Grei/Krevende).
 *
 *   GET /api/leadgrid/entur/alternatives?fromLat=&fromLon=&toLat=&toLon=&walkMin=
 *       — «raskere alternativ» under navigering: kollektiv-reise (Journey
 *         Planner trip) + nærmeste elsparkesykkel, hver med anslått ETA,
 *         slik at appen kan foreslå «ta trikken — X min raskere».
 *
 * Alle endepunkter er lese-only, session-gated og upstream-cachet med
 * TTL etter volatilitet (avganger 30s, holdeplasser 5min, mobilitet 60s).
 *
 * Åpne API-er under NLOD — ingen API-nøkkel, men KREVER en `ET-Client-Name`-
 * header (Entur throttler/blokkerer uidentifisert trafikk). Settes via env
 * ENTUR_CLIENT_NAME (default "creatorhubn-leadgrid").
 *
 * Kilder (offisielt, gratis):
 *   https://api.entur.io/journey-planner/v3/graphql   (holdeplasser, avganger, reise)
 *   https://api.entur.io/mobility/v2/graphql          (bysykler, elsparkesykler)
 */

import type { Express, Request, Response } from "express";

const ET_CLIENT_NAME = process.env.ENTUR_CLIENT_NAME || "creatorhubn-leadgrid";
const JOURNEY_PLANNER = "https://api.entur.io/journey-planner/v3/graphql";
const MOBILITY = "https://api.entur.io/mobility/v2/graphql";

// ─── cache m/ per-nøkkel TTL ────────────────────────────────────────
// ALL Entur-trafikk går via denne backenden (aldri klient-direkte), så cache +
// ET-Client-Name + attribusjon er sentralisert. TTL etter data-volatilitet
// (respekter feedens ferskhet):
//   tilgjengelige kjøretøy → KORT (~30-45s, ≈ GBFS-feedens ttl)
//   geofence-soner         → minutter
//   prisplaner             → lengre (valider før visning)
//   kjøretøytyper          → lang
//   operatørmanifest       → periodisk sync
//   lead-koordinater       → lagres permanent på leaded (ikke her)
// PERSONVERN: GBFS `vehicle_id` roteres etter hver tur — vi persisterer den
// ALDRI og bygger ingen historikk pr. sparkesykkel. Vi bruker kun posisjon +
// rekkevidde + rentalUri i øyeblikket, aldri som varig identifikator.
const CACHE_MAX = 800;
const CACHE_TTL_VEHICLES = 40_000; // kjøretøy/avganger — kort
const CACHE_TTL_REACH = 90_000; // lead-kort-sammendrag (avganger holder seg ~friske)
const cache = new Map<string, { at: number; ttl: number; body: unknown }>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

function cacheSet(key: string, body: unknown, ttl: number) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { at: Date.now(), ttl, body });
}

// ─── GraphQL-hjelper (POST + ET-Client-Name) ────────────────────────
async function graphql<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "ET-Client-Name": ET_CLIENT_NAME,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!upstream.ok) return null;
    const json = (await upstream.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      console.warn("[leadgrid-entur] graphql errors:", JSON.stringify(json.errors).slice(0, 300));
    }
    return json.data ?? null;
  } catch (err) {
    console.warn("[leadgrid-entur] graphql failed:", (err as Error).message);
    return null;
  }
}

// ─── DTO-typer (snake_case JSON — iPad dekoder m/ convertFromSnakeCase) ──
interface StopDTO {
  id: string;
  name: string;
  distance_m: number;
  modes: string[];
}
interface DepartureDTO {
  line: string;
  mode: string;
  destination: string;
  expected_time: string;
  in_min: number;
  realtime: boolean;
}
interface ReachabilityDTO {
  score: number | null;
  label: string;
  nearest_stop: (StopDTO & { walk_min: number }) | null;
  stops: StopDTO[];
  departures: DepartureDTO[];
  micromobility: {
    scooters: number;
    bikes: number;
    nearest_m: number | null;
    operators: string[];
  };
  components: { walk: number; freq: number; mode: number; micro: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function reachabilityLabel(score: number): string {
  if (score >= 80) return "Utmerket";
  if (score >= 60) return "God";
  if (score >= 40) return "Grei";
  return "Krevende";
}

// ─── main ───────────────────────────────────────────────────────────
export function registerLeadgridEnturRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // ────────────────────────────────────────────────────────────────
  // GET /reachability?lat=&lon=
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/entur/reachability", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }

    const cacheKey = `reach:${lat.toFixed(5)}:${lon.toFixed(5)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const empty: ReachabilityDTO = {
      score: null,
      label: "Ukjent",
      nearest_stop: null,
      stops: [],
      departures: [],
      micromobility: { scooters: 0, bikes: 0, nearest_m: null, operators: [] },
      components: { walk: 0, freq: 0, mode: 0, micro: 0 },
    };

    try {
      // (a) nærmeste holdeplasser + modi
      const nearestData = await graphql<{
        nearest?: { edges?: Array<{ node?: { distance?: number; place?: any } }> };
      }>(JOURNEY_PLANNER, NEAREST_QUERY, { lat, lon, maxDist: 800 });

      const stops: StopDTO[] = (nearestData?.nearest?.edges ?? [])
        .map((e) => {
          const n = e.node;
          const place = n?.place;
          if (!place?.id) return null;
          const modes = Array.isArray(place.transportMode)
            ? place.transportMode.map(String)
            : place.transportMode
              ? [String(place.transportMode)]
              : [];
          return {
            id: String(place.id),
            name: String(place.name ?? ""),
            distance_m: Math.round(Number(n?.distance ?? 0)),
            modes,
          } as StopDTO;
        })
        .filter((s): s is StopDTO => s !== null)
        .sort((a, b) => a.distance_m - b.distance_m);

      const nearest = stops[0] ?? null;

      // (b) sanntidsavganger for nærmeste holdeplass
      let departures: DepartureDTO[] = [];
      if (nearest) {
        const depData = await graphql<{
          stopPlace?: { estimatedCalls?: any[] };
        }>(JOURNEY_PLANNER, DEPARTURES_QUERY, { id: nearest.id });
        const calls = depData?.stopPlace?.estimatedCalls ?? [];
        departures = calls
          .map((c: any): DepartureDTO | null => {
            const t = c?.expectedDepartureTime;
            if (!t) return null;
            const inMin = Math.max(0, Math.round((new Date(t).getTime() - Date.now()) / 60000));
            const line = c?.serviceJourney?.line ?? {};
            return {
              line: String(line.publicCode ?? ""),
              mode: String(line.transportMode ?? ""),
              destination: String(c?.destinationDisplay?.frontText ?? ""),
              expected_time: String(t),
              in_min: inMin,
              realtime: Boolean(c?.realtime),
            };
          })
          .filter((d): d is DepartureDTO => d !== null);
      }

      // (c) bysykler / elsparkesykler i nærheten
      const mobData = await graphql<{
        vehicles?: any[];
        stations?: any[];
      }>(MOBILITY, MOBILITY_QUERY, { lat, lon });
      const vehicles = mobData?.vehicles ?? [];
      const stations = mobData?.stations ?? [];
      let scooters = 0;
      let bikesFree = 0;
      const operators = new Set<string>();
      let nearestMicroM: number | null = null;
      for (const v of vehicles) {
        if (v?.isReserved || v?.isDisabled) continue; // hopp reserverte/deaktiverte
        const ff = String(v?.vehicleType?.formFactor ?? "").toUpperCase();
        if (ff.includes("SCOOTER")) scooters += 1;
        else if (ff.includes("BICYCLE") || ff.includes("BIKE")) bikesFree += 1;
        const op = v?.system?.operator?.name?.translation?.[0]?.value;
        if (op) operators.add(String(op));
        if (Number.isFinite(v?.lat) && Number.isFinite(v?.lon)) {
          const d = haversineMeters(lat, lon, Number(v.lat), Number(v.lon));
          if (nearestMicroM === null || d < nearestMicroM) nearestMicroM = d;
        }
      }
      let bikesDocked = 0;
      for (const s of stations) bikesDocked += Number(s?.numBikesAvailable ?? 0);
      const bikes = bikesFree + bikesDocked;

      // (d) score
      const distinctModes = new Set(stops.flatMap((s) => s.modes)).size;
      const depsNext60 = departures.filter((d) => d.in_min <= 60).length;
      const walk = nearest ? clamp(40 * (1 - nearest.distance_m / 800), 0, 40) : 0;
      const freq = clamp(depsNext60 * 3, 0, 30);
      const modeScore = Math.min(20, 5 * distinctModes);
      const micro = scooters + bikes > 0 ? 10 : 0;
      const score = Math.round(walk + freq + modeScore + micro);

      const body: ReachabilityDTO = {
        score,
        label: reachabilityLabel(score),
        nearest_stop: nearest
          ? { ...nearest, walk_min: Math.max(1, Math.round(nearest.distance_m / 1.35 / 60)) }
          : null,
        stops: stops.slice(0, 5),
        departures: departures.slice(0, 5),
        micromobility: {
          scooters,
          bikes,
          nearest_m: nearestMicroM,
          operators: Array.from(operators),
        },
        components: {
          walk: Math.round(walk),
          freq: Math.round(freq),
          mode: modeScore,
          micro,
        },
      };
      cacheSet(cacheKey, body, CACHE_TTL_REACH); // lead-kort-sammendrag
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-entur] reachability failed:", (err as Error).message);
      return res.json(empty);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /alternatives?fromLat=&fromLon=&toLat=&toLon=&walkMin=
  //
  // «Raskere alternativ» under navigering. Sammenligner brukerens
  // gjeldende gå-ETA (walkMin) mot kollektiv-reise + elsparkesykkel.
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/entur/alternatives", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const fromLat = Number(req.query.fromLat);
    const fromLon = Number(req.query.fromLon);
    const toLat = Number(req.query.toLat);
    const toLon = Number(req.query.toLon);
    const walkMin = Number(req.query.walkMin);
    if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) {
      return res.status(400).json({ error: "from_and_to_required" });
    }

    const cacheKey = `alt:${fromLat.toFixed(4)}:${fromLon.toFixed(4)}:${toLat.toFixed(4)}:${toLon.toFixed(4)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const alternatives: Array<{
      kind: string; // "transit" | "scooter"
      eta_min: number;
      saved_min: number | null;
      headline: string;
      detail: string;
      distance_m: number | null;
      rental_url?: string | null;
    }> = [];

    try {
      // (1) kollektiv-reise
      const tripData = await graphql<{ trip?: { tripPatterns?: any[] } }>(
        JOURNEY_PLANNER,
        TRIP_QUERY,
        { fromLat, fromLon, toLat, toLon },
      );
      const pattern = tripData?.trip?.tripPatterns?.[0];
      if (pattern) {
        const etaMin = Math.round(Number(pattern.duration ?? 0) / 60);
        const transitLeg = (pattern.legs ?? []).find((l: any) => l?.mode && l.mode !== "foot");
        const lineCode = transitLeg?.line?.publicCode;
        const mode = transitLeg?.mode;
        if (etaMin > 0) {
          const label = mode ? norwegianMode(mode) : "Kollektiv";
          alternatives.push({
            kind: "transit",
            eta_min: etaMin,
            saved_min: Number.isFinite(walkMin) ? Math.round(walkMin - etaMin) : null,
            headline: lineCode ? `Ta ${label} ${lineCode}` : `Ta ${label}`,
            detail: transitLeg?.fromPlace?.name
              ? `Fra ${transitLeg.fromPlace.name}`
              : "Kollektiv-reise",
            distance_m: null,
          });
        }
      }

      // (2) BESTE elsparkesykkel — beregn HELE turen, ikke bare luftlinje.
      //   total = gang-til-kjøretøy + oppstart + kjøretid + gang-fra-parkering
      //           + straff (lav rekkevidde, geofence, ferske data, utilgj.-risiko)
      // Slik kan en sparkesykkel 180 m unna slå én 70 m unna hvis den har bedre
      // rekkevidde / kortere kjørerute / lovlig parkering nær kunden.
      const mobData = await graphql<{ vehicles?: any[] }>(MOBILITY, MOBILITY_QUERY, {
        lat: fromLat,
        lon: fromLon,
      });
      const toDest = haversineMeters(fromLat, fromLon, toLat, toLon);
      const WALK_MPS = 1.35;
      const SCOOTER_MPS = 4.5;
      const STARTUP_S = 45; // låse opp + starte
      const PARK_TO_LEAD_M = 35; // antatt lovlig parkering nær kunden
      let best: {
        totalS: number;
        d: number;
        op: string;
        url: string | null;
      } | null = null;
      for (const v of mobData?.vehicles ?? []) {
        if (v?.isReserved || v?.isDisabled) continue;
        const ff = String(v?.vehicleType?.formFactor ?? "").toUpperCase();
        if (!ff.includes("SCOOTER")) continue;
        if (!Number.isFinite(v?.lat) || !Number.isFinite(v?.lon)) continue;
        const vLat = Number(v.lat);
        const vLon = Number(v.lon);
        const walkToVehM = haversineMeters(fromLat, fromLon, vLat, vLon);
        if (walkToVehM > 500) continue;
        const rideM = haversineMeters(vLat, vLon, toLat, toLon);
        const range = Number(v?.currentRangeMeters ?? Infinity);
        if (Number.isFinite(range) && range < rideM) continue; // klarer ikke turen

        const walkToVehS = walkToVehM / WALK_MPS;
        const rideS = rideM / SCOOTER_MPS;
        const walkFromParkS = PARK_TO_LEAD_M / WALK_MPS;
        // straff: for lite margin på rekkevidden (vær/bakker/kjørestil)
        const lowRangePenaltyS =
          Number.isFinite(range) && range < rideM * 1.3
            ? ((rideM * 1.3 - range) / SCOOTER_MPS) * 2
            : 0;
        // straff: risiko for at kjøretøyet er borte når du kommer fram — skalerer
        // med hvor langt du må gå dit. (Geofence-/ferskhets-straff: TODO når vi
        // henter GBFS geofencing_zones + lastReported.)
        const unavailableRiskS = walkToVehS * 0.1;
        const geofencePenaltyS = 0;
        const staleDataPenaltyS = 0;
        const totalS =
          walkToVehS +
          STARTUP_S +
          rideS +
          walkFromParkS +
          lowRangePenaltyS +
          unavailableRiskS +
          geofencePenaltyS +
          staleDataPenaltyS;
        if (!best || totalS < best.totalS) {
          const uris = v?.rentalUris ?? {};
          best = {
            totalS,
            d: walkToVehM,
            op: String(v?.system?.operator?.name?.translation?.[0]?.value ?? ""),
            url: uris.ios || uris.web || uris.android || null,
          };
        }
      }
      if (best) {
        const etaMin = Math.max(1, Math.round(best.totalS / 60));
        alternatives.push({
          kind: "scooter",
          eta_min: etaMin,
          saved_min: Number.isFinite(walkMin) ? Math.round(walkMin - etaMin) : null,
          headline: best.op
            ? `${best.op}-elsparkesykkel ${best.d} m unna`
            : `Elsparkesykkel ${best.d} m unna`,
          detail: "Hele turen medregnet",
          distance_m: best.d,
          rental_url: best.url,
        });
      }

      // Behold kun alternativer som faktisk er raskere (positiv besparelse),
      // sortert på mest spart tid.
      const faster = alternatives
        .filter((a) => a.saved_min === null || a.saved_min >= 1)
        .sort((a, b) => (b.saved_min ?? 0) - (a.saved_min ?? 0));
      const body = { alternatives: faster };
      cacheSet(cacheKey, body, CACHE_TTL_VEHICLES); // kort — kjøretøy er ferskvare
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-entur] alternatives failed:", (err as Error).message);
      return res.json({ alternatives: [] });
    }
  });
}

// ─── GraphQL-spørringer ─────────────────────────────────────────────
const NEAREST_QUERY = `
query Nearest($lat: Float!, $lon: Float!, $maxDist: Float!) {
  nearest(latitude: $lat, longitude: $lon, maximumDistance: $maxDist,
          maximumResults: 6, filterByPlaceTypes: [stopPlace]) {
    edges { node { distance place { __typename ... on StopPlace { id name transportMode } } } }
  }
}`;

const DEPARTURES_QUERY = `
query Departures($id: String!) {
  stopPlace(id: $id) {
    id name
    estimatedCalls(timeRange: 7200, numberOfDepartures: 6) {
      expectedDepartureTime
      realtime
      destinationDisplay { frontText }
      serviceJourney { line { publicCode transportMode } }
    }
  }
}`;

const MOBILITY_QUERY = `
query Micromobility($lat: Float!, $lon: Float!) {
  vehicles(lat: $lat, lon: $lon, range: 500, count: 30,
           includeReserved: false, includeDisabled: false) {
    id lat lon
    isReserved
    isDisabled
    currentRangeMeters
    vehicleType { formFactor propulsionType }
    rentalUris { ios android web }
    pricingPlan { id }
    system { operator { name { translation { value } } } }
  }
  stations(lat: $lat, lon: $lon, range: 500) {
    id numBikesAvailable numDocksAvailable
  }
}`;

const TRIP_QUERY = `
query Trip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
  trip(from: { coordinates: { latitude: $fromLat, longitude: $fromLon } },
       to: { coordinates: { latitude: $toLat, longitude: $toLon } },
       numTripPatterns: 1) {
    tripPatterns {
      duration
      walkDistance
      legs { mode fromPlace { name } line { publicCode } }
    }
  }
}`;

// ─── util ───────────────────────────────────────────────────────────
function norwegianMode(mode: string): string {
  switch (String(mode).toLowerCase()) {
    case "bus": return "buss";
    case "tram": return "trikk";
    case "rail": return "tog";
    case "metro": return "T-bane";
    case "water": return "båt";
    case "coach": return "buss";
    default: return "kollektiv";
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) * Math.sin(dφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
