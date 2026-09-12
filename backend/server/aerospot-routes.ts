/**
 * aerospot-routes.ts
 *
 * Backend for AeroSpot — flyfoto-appen for plane spotters.
 *
 * Endepunkter:
 *   GET  /api/aerospot/flights?south&west&north&east   (OpenSky-proxy, 10s cache)
 *   GET  /api/aerospot/flights/:id                     (én flight fra siste sweep)
 *   GET  /api/aerospot/weather?lat&lon                 (MET Norway-proxy, 10 min cache)
 *   GET  /api/aerospot/camera/:ip/settings             (Canon CCAPI shooting-settings, read-only)
 *   GET  /api/aerospot/logbook                         (brukerens loggbok)
 *   POST /api/aerospot/logbook                         (ny entry)
 *   PATCH /api/aerospot/logbook/:id                    (oppdater rating/notes/favorite)
 *   DELETE /api/aerospot/logbook/:id                   (slett — privacy by design)
 *   GET  /api/aerospot/alerts | POST | DELETE /:id     (varsler)
 *
 * Flight-provideren er abstrahert bak fetchOpenSkyStates() så leverandør
 * kan byttes uten å endre route-kontrakten mot frontend.
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { CcapiError, getCcapiClient } from "./ccapi-client.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface AerospotRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

// ── Enkel TTL-cache ─────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_MAX_ENTRIES = 500;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  cache.delete(key);
  return null;
}
function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // Cap: kast eldste entries (Map er insertion-ordered) så offentlige
  // endpoints ikke kan blåse opp minnet med unike nøkler.
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ── OpenSky ─────────────────────────────────────────────────────────

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

const M_TO_FT = 3.28084;
const MS_TO_KT = 1.94384;

/** OpenSky state-vector: posisjonsindekser per API-doc */
type OpenSkyState = [
  string, // 0 icao24
  string | null, // 1 callsign
  string, // 2 origin_country
  number | null, // 3 time_position
  number, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude m
  boolean, // 8 on_ground
  number | null, // 9 velocity m/s
  number | null, // 10 true_track
  number | null, // 11 vertical_rate m/s
  ...unknown[],
];

async function fetchOpenSkyStates(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<ApiFlight[]> {
  const url =
    `https://opensky-network.org/api/states/all?lamin=${bounds.south}&lomin=${bounds.west}` +
    `&lamax=${bounds.north}&lomax=${bounds.east}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const body = (await res.json()) as { states: OpenSkyState[] | null };
    return (body.states ?? [])
      .filter((s) => s[5] !== null && s[6] !== null)
      .map((s) => ({
        id: s[0],
        callsign: (s[1] ?? "").trim(),
        latitude: s[6] as number,
        longitude: s[5] as number,
        altitudeFt: Math.round((s[7] ?? 0) * M_TO_FT),
        groundSpeedKt: Math.round((s[9] ?? 0) * MS_TO_KT),
        verticalSpeedFpm: Math.round((s[11] ?? 0) * M_TO_FT * 60),
        headingDeg: Math.round(s[10] ?? 0),
        onGround: s[8],
        lastSeenIso: new Date(s[4] * 1000).toISOString(),
      }));
  } finally {
    clearTimeout(timer);
  }
}

// ── MET Norway ──────────────────────────────────────────────────────

interface MetTimeseries {
  data: {
    instant: {
      details: {
        air_temperature?: number;
        wind_from_direction?: number;
        wind_speed?: number;
        wind_speed_of_gust?: number;
        cloud_area_fraction?: number;
        air_pressure_at_sea_level?: number;
      };
    };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
}

/**
 * METAR fra MET Norway (tafmetar) — gir ekte sikt + observert vind for
 * flyplassen, mer presist enn modellprognosen. Best-effort: null ved feil.
 */
async function fetchMetar(icao: string): Promise<{
  visibilityKm: number;
  windDirectionDeg?: number;
  windSpeedKt?: number;
  gustKt?: number;
} | null> {
  try {
    const res = await fetch(
      `https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=${encodeURIComponent(icao)}`,
      { headers: { "User-Agent": "CreatorHub-AeroSpot/1.0 daniel@creatorhubn.com" } },
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").filter((l) => l.startsWith(icao));
    const metar = lines[lines.length - 1];
    if (!metar) return null;

    // Vind: dddff(Ggg)KT — "06004G14KT". VRB = variabel retning.
    const wind = metar.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
    // Sikt: CAVOK/9999 = ≥10 km, ellers 4-sifret meterverdi som eget token.
    let visibilityKm = 10;
    if (!/\bCAVOK\b/.test(metar)) {
      const vis = metar.match(/\s(\d{4})\s/);
      // 9999 = «10 km eller mer» per METAR-konvensjon
      if (vis) visibilityKm = Number(vis[1]) >= 9999 ? 10 : Number(vis[1]) / 1000;
    }
    return {
      visibilityKm,
      windDirectionDeg: wind && wind[1] !== "VRB" ? Number(wind[1]) : undefined,
      windSpeedKt: wind ? Number(wind[2]) : undefined,
      gustKt: wind?.[3] ? Number(wind[3]) : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchMetWeather(lat: number, lon: number) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "CreatorHub-AeroSpot/1.0 daniel@creatorhubn.com" },
  });
  if (!res.ok) throw new Error(`met.no ${res.status}`);
  const body = (await res.json()) as { properties: { timeseries: MetTimeseries[] } };
  const now = body.properties.timeseries[0];
  const d = now.data.instant.details;
  const next = now.data.next_1_hours;
  return {
    temperatureC: d.air_temperature ?? 0,
    windDirectionDeg: d.wind_from_direction ?? 0,
    windSpeedKt: Math.round((d.wind_speed ?? 0) * MS_TO_KT),
    gustKt: d.wind_speed_of_gust ? Math.round(d.wind_speed_of_gust * MS_TO_KT) : undefined,
    // MET compact har ikke sikt — bruk skydekke-heuristikk. ponytail:
    // bytt til METAR-kilde (f.eks. api.met.no tafmetar) for ekte sikt.
    visibilityKm: (d.cloud_area_fraction ?? 0) > 95 ? 5 : 10,
    cloudCoverPct: Math.round(d.cloud_area_fraction ?? 0),
    precipitationMmH: next?.details?.precipitation_amount ?? 0,
    pressureHpa: Math.round(d.air_pressure_at_sea_level ?? 1013),
    symbol: next?.summary?.symbol_code,
    fetchedAtIso: new Date().toISOString(),
  };
}

// ── Skjema ──────────────────────────────────────────────────────────

async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aerospot_logbook (
      id uuid PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      photo_url text,
      date_iso timestamptz NOT NULL,
      location varchar(255),
      airport_icao varchar(8),
      flight_number varchar(16),
      callsign varchar(16),
      registration varchar(16),
      aircraft_type varchar(64),
      airline varchar(64),
      latitude double precision,
      longitude double precision,
      focal_length_mm integer,
      shutter_speed varchar(16),
      aperture varchar(16),
      iso integer,
      camera_model varchar(64),
      lens_model varchar(96),
      rating integer,
      notes text,
      favorite boolean NOT NULL DEFAULT false,
      rarity varchar(16),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aerospot_logbook_user_idx ON aerospot_logbook (user_id, date_iso DESC);
    CREATE TABLE IF NOT EXISTS aerospot_alerts (
      id uuid PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      kind varchar(24) NOT NULL,
      value varchar(64) NOT NULL,
      airport_icao varchar(8),
      radius_km integer,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aerospot_alerts_user_idx ON aerospot_alerts (user_id);
    CREATE TABLE IF NOT EXISTS aerospot_community_posts (
      id uuid PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      user_name varchar(120),
      thumb_data text,
      aircraft_type varchar(64),
      registration varchar(16),
      airline varchar(64),
      airport_icao varchar(8),
      spot_name varchar(120),
      caption text,
      likes integer NOT NULL DEFAULT 0,
      rarity varchar(16),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aerospot_community_created_idx ON aerospot_community_posts (created_at DESC);
    CREATE INDEX IF NOT EXISTS aerospot_community_airport_idx ON aerospot_community_posts (airport_icao);
    CREATE TABLE IF NOT EXISTS aerospot_community_likes (
      post_id uuid NOT NULL,
      user_id varchar(255) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS aerospot_events (
      id varchar(64) PRIMARY KEY,
      name varchar(160) NOT NULL,
      type varchar(24) NOT NULL,
      venue varchar(160) NOT NULL,
      country varchar(4) NOT NULL,
      airport_icao varchar(8),
      latitude double precision,
      longitude double precision,
      start_date date NOT NULL,
      end_date date NOT NULL,
      description text NOT NULL,
      url text,
      ticket_url text,
      program jsonb,
      aircraft jsonb,
      verified boolean NOT NULL DEFAULT false,
      status varchar(16) NOT NULL DEFAULT 'approved',
      owner_user_id varchar(255),
      ticket_clicks integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aerospot_events_start_idx ON aerospot_events (start_date);
    CREATE INDEX IF NOT EXISTS aerospot_events_country_idx ON aerospot_events (country);
    ALTER TABLE aerospot_events ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
    ALTER TABLE aerospot_events ADD COLUMN IF NOT EXISTS featured_until timestamptz;
    ALTER TABLE aerospot_events ADD COLUMN IF NOT EXISTS venue_map jsonb;
    ALTER TABLE aerospot_events ADD COLUMN IF NOT EXISTS contact_email varchar(160);
    ALTER TABLE aerospot_events ADD COLUMN IF NOT EXISTS contact_phone varchar(40);
  `);
  // Seed kuratert liste ved første oppstart (kun hvis tom)
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM aerospot_events`);
  if ((count.rows[0]?.n ?? 0) === 0) {
    for (const e of CURATED_EVENTS) {
      await pool.query(
        `INSERT INTO aerospot_events
           (id,name,type,venue,country,airport_icao,latitude,longitude,start_date,end_date,description,url,verified,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'approved')
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.name, e.type, e.venue, e.country, e.airportIcao ?? null,
         e.latitude ?? null, e.longitude ?? null, e.startDate, e.endDate, e.description, e.url ?? null],
      );
    }
  }
}

/**
 * Kun private IPv4-adresser (RFC1918) med gyldige oktetter. Link-local
 * (169.254.x — inkl. cloud-metadata) og loopback avvises bevisst.
 */
function isPrivateLanIp(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown, maxLen = 255): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : null;
}

function rowToEvent(r: Record<string, unknown>) {
  const dateStr = (v: unknown): string => {
    if (v instanceof Date) {
      // pg returnerer date-kolonne som lokal midnatt; bruk lokale deler
      // så vi ikke skifter en dag ved UTC-konvertering.
      const p = (n: number) => String(n).padStart(2, "0");
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
  };
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    venue: r.venue,
    country: r.country,
    airportIcao: r.airport_icao ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    startDate: dateStr(r.start_date),
    endDate: dateStr(r.end_date),
    description: r.description,
    url: r.url ?? undefined,
    ticketUrl: r.ticket_url ?? undefined,
    program: r.program ?? undefined,
    aircraft: r.aircraft ?? undefined,
    verified: Boolean(r.verified),
    featured: Boolean(r.featured) && (!r.featured_until || new Date(r.featured_until as string) > new Date()),
    venueMap: r.venue_map ?? undefined,
    contactEmail: r.contact_email ?? undefined,
    contactPhone: r.contact_phone ?? undefined,
  };
}

function rowToEntry(r: Record<string, unknown>) {
  return {
    id: r.id,
    photoUrl: r.photo_url ?? undefined,
    dateIso: r.date_iso instanceof Date ? r.date_iso.toISOString() : r.date_iso,
    location: r.location ?? undefined,
    airportIcao: r.airport_icao ?? undefined,
    flightNumber: r.flight_number ?? undefined,
    callsign: r.callsign ?? undefined,
    registration: r.registration ?? undefined,
    aircraftType: r.aircraft_type ?? undefined,
    airline: r.airline ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    focalLengthMm: r.focal_length_mm ?? undefined,
    shutterSpeed: r.shutter_speed ?? undefined,
    aperture: r.aperture ?? undefined,
    iso: r.iso ?? undefined,
    cameraModel: r.camera_model ?? undefined,
    lensModel: r.lens_model ?? undefined,
    rating: r.rating ?? undefined,
    notes: r.notes ?? undefined,
    favorite: Boolean(r.favorite),
    rarity: r.rarity ?? undefined,
  };
}

// ── Fly-register: berikelse (militær + special livery) ──────────────

interface AircraftInfo {
  hex: string;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  typecode: string | null;
  operator: string | null;
  isMilitary: boolean;
  isSpecialLivery: boolean;
  liveryName: string | null;
}

// Militære ICAO-typекoder → lesbart typenavn (utvalg). Dekker hullet der
// live-ADS-B ikke gir type for militærfly som faktisk sender.
const MILITARY_TYPES: Record<string, string> = {
  C17: "Boeing C-17 Globemaster III",
  C130: "Lockheed C-130 Hercules",
  C30J: "Lockheed C-130J Super Hercules",
  A400: "Airbus A400M Atlas",
  K35R: "Boeing KC-135 Stratotanker",
  E3TF: "Boeing E-3 Sentry (AWACS)",
  P8: "Boeing P-8 Poseidon",
  F35: "Lockheed Martin F-35 Lightning II",
  F16: "General Dynamics F-16 Fighting Falcon",
  EUFI: "Eurofighter Typhoon",
};

// Kuratert special-livery-register (registrering → livery-navn). Utvides
// manuelt; ADS-B/OpenSky flagger ikke liveries, så dette er eneste kilde.
const SPECIAL_LIVERIES: Record<string, string> = {
  "LN-RKH": "SAS Star Alliance retro",
  "SE-DVT": "Braathens retrojet",
  "LN-NGW": "Norwegian — Roald Amundsen tail",
  "EI-XLN": "Norwegian — Freddie Mercury tail",
  "OY-KBA": "SAS 75-års jubileum",
  "G-XLEB": "British Airways BOAC retro",
  "D-AIMH": "Lufthansa retro 1970s",
};

function enrichKnown(base: AircraftInfo | null, idForFlags: string): AircraftInfo {
  const info: AircraftInfo =
    base ?? {
      hex: /^[0-9a-f]{6}$/.test(idForFlags) ? idForFlags : "",
      registration: /^[0-9a-f]{6}$/.test(idForFlags) ? null : idForFlags.toUpperCase(),
      manufacturer: null,
      model: null,
      typecode: null,
      operator: null,
      isMilitary: false,
      isSpecialLivery: false,
      liveryName: null,
    };

  // Militær-typenavn fra typecode
  const tc = (info.typecode ?? "").toUpperCase();
  if (MILITARY_TYPES[tc]) {
    info.isMilitary = true;
    info.model = MILITARY_TYPES[tc];
    info.manufacturer = info.manufacturer ?? info.model.split(" ")[0];
  }

  // Special livery fra registrering
  const reg = (info.registration ?? "").toUpperCase();
  if (reg && SPECIAL_LIVERIES[reg]) {
    info.isSpecialLivery = true;
    info.liveryName = SPECIAL_LIVERIES[reg];
  }

  return info;
}

// ── Kuratert arrangements-data (flyshow / aviation-events) ──────────

interface AeroEvent {
  id: string;
  name: string;
  type: "airshow" | "flydag" | "spotting" | "museum" | "fly-in";
  venue: string;
  country: string; // ISO-2
  airportIcao?: string;
  latitude?: number;
  longitude?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  description: string;
  url?: string;
}

const CURATED_EVENTS: AeroEvent[] = [
  {
    id: "kjeller-flydag-2026",
    name: "Kjeller Flydag",
    type: "flydag",
    venue: "Kjeller flyplass",
    country: "NO",
    airportIcao: "ENKJ",
    latitude: 59.9703,
    longitude: 11.0361,
    startDate: "2026-06-14",
    endDate: "2026-06-14",
    description:
      "Norges eldste flyplass i drift. Veteranfly, oppvisninger og nær tilgang " +
      "til flyene på bakken. Klassiker for norske flyfotografer.",
    url: "https://kjellerflyhistoriske.no",
  },
  {
    id: "rygge-airshow-2026",
    name: "Rygge Airshow",
    type: "airshow",
    venue: "Moss lufthavn Rygge",
    country: "NO",
    airportIcao: "ENRY",
    latitude: 59.3789,
    longitude: 10.7856,
    startDate: "2026-08-22",
    endDate: "2026-08-23",
    description:
      "Militær- og sivil oppvisning med Forsvarets deltakelse. Jetfly, " +
      "formasjonsflyging og statisk utstilling.",
  },
  {
    id: "bodo-air-show-2026",
    name: "Bodø Air Show",
    type: "airshow",
    venue: "Bodø lufthavn",
    country: "NO",
    airportIcao: "ENBO",
    latitude: 67.2692,
    longitude: 14.3653,
    startDate: "2026-06-20",
    endDate: "2026-06-21",
    description:
      "Nordlandsk storshow med F-35, F-16-historikk og maritim overvåkning. " +
      "Midnattssol gir unikt lys for fotografer.",
  },
  {
    id: "osl-spotterday-2026",
    name: "OSL Spotterdag",
    type: "spotting",
    venue: "Oslo Gardermoen — Vollen",
    country: "NO",
    airportIcao: "ENGM",
    latitude: 60.169,
    longitude: 11.0655,
    startDate: "2026-09-05",
    endDate: "2026-09-05",
    description:
      "Uformell samling for plane spotters ved Vollen. Del tips, objektiver " +
      "og fang morgentrafikken på 01L sammen.",
  },
  {
    id: "flyhistorisk-museum-sola",
    name: "Flyhistorisk Museum Sola",
    type: "museum",
    venue: "Stavanger lufthavn Sola",
    country: "NO",
    airportIcao: "ENZV",
    latitude: 58.8767,
    longitude: 5.6378,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    description:
      "Fast utstilling av militær- og sivilfly-historie rett ved rullebanen. " +
      "Kombiner museumsbesøk med spotting av Sola-trafikk.",
  },
  {
    id: "notodden-flyshow-2026",
    name: "Notodden Flyshow",
    type: "airshow",
    venue: "Notodden lufthavn",
    country: "NO",
    airportIcao: "ENNO",
    latitude: 59.5657,
    longitude: 9.2121,
    startDate: "2026-06-27",
    endDate: "2026-06-27",
    description:
      "Populært flyshow på Notodden med veteranfly, akrobatikk og oppvisninger. " +
      "God bakketilgang og fotografvennlig innramming mot Heddalsvatnet.",
  },
  {
    id: "eskilstuna-flygdag-2026",
    name: "Eskilstuna Flygdag",
    type: "flydag",
    venue: "Eskilstuna flygplats",
    country: "SE",
    airportIcao: "ESSU",
    latitude: 59.3511,
    longitude: 16.7089,
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    description:
      "En av Sveriges største flygdager. Historiske og moderne fly, " +
      "formasjonsflyging og statisk utstilling — verdt turen over grensa.",
  },
  {
    id: "uppsala-airshow-2026",
    name: "Uppsala Airshow",
    type: "airshow",
    venue: "Uppsala/Ärna flygplats",
    country: "SE",
    airportIcao: "ESCM",
    latitude: 59.8973,
    longitude: 17.5886,
    startDate: "2026-05-30",
    endDate: "2026-05-30",
    description:
      "Svensk militært flyshow med Gripen-oppvisning og Flygvapnets deltakelse.",
  },
  {
    id: "riat-2026",
    name: "Royal International Air Tattoo (RIAT)",
    type: "airshow",
    venue: "RAF Fairford",
    country: "GB",
    airportIcao: "EGVA",
    latitude: 51.6822,
    longitude: -1.79,
    startDate: "2026-07-17",
    endDate: "2026-07-19",
    description:
      "Verdens største militære flyshow. Deltakere fra hele verden — " +
      "verdt reisen for den seriøse aviation-fotografen.",
    url: "https://www.airtattoo.com",
  },
  {
    id: "ila-berlin-2026",
    name: "ILA Berlin Air Show",
    type: "airshow",
    venue: "Berlin Brandenburg (BER)",
    country: "DE",
    airportIcao: "EDDB",
    latitude: 52.3667,
    longitude: 13.5033,
    startDate: "2026-06-03",
    endDate: "2026-06-07",
    description:
      "Stor europeisk luftfartsmesse med flyshow, romfart og forsvarsteknologi.",
  },
];

// ── Setup ───────────────────────────────────────────────────────────

export function registerAerospotRoutes(deps: AerospotRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  const tablesReady = ensureTables(pool).catch((err) => {
    console.error("aerospot: klarte ikke opprette tabeller:", err);
  });

  // Flights — offentlig lesbart (ingen persondata), cachet 10s per bounds
  app.get("/api/aerospot/flights", async (req, res) => {
    const south = num(req.query.south);
    const west = num(req.query.west);
    const north = num(req.query.north);
    const east = num(req.query.east);
    if (south === null || west === null || north === null || east === null) {
      return res.status(400).json({ error: "south/west/north/east påkrevd" });
    }
    if (
      south < -90 || north > 90 || west < -180 || east > 180 ||
      south >= north || west >= east ||
      north - south > 5 || east - west > 10
    ) {
      return res.status(400).json({ error: "ugyldig bounding box" });
    }
    const key = `flights:${south.toFixed(1)}:${west.toFixed(1)}:${north.toFixed(1)}:${east.toFixed(1)}`;
    const cached = cacheGet<ApiFlight[]>(key);
    if (cached) return res.json({ flights: cached, cached: true });
    try {
      const flights = await fetchOpenSkyStates({ south, west, north, east });
      cacheSet(key, flights, 10_000);
      // Behold også per-id lookup fra siste sweep
      for (const f of flights) cacheSet(`flight:${f.id}`, f, 60_000);
      res.json({ flights, cached: false });
    } catch (err) {
      res.status(502).json({ error: "flight-provider utilgjengelig", detail: String(err) });
    }
  });

  app.get("/api/aerospot/flights/:id", (req, res) => {
    const flight = cacheGet<ApiFlight>(`flight:${req.params.id}`);
    res.json({ flight: flight ?? null });
  });

  // Fly-register: strukturert metadata (type, operatør, registrering) via
  // OpenSky aircraft-database, beriket med militær- og special-livery-flagg.
  // Cachet 7 dager (statiske data). Per ICAO24-hex.
  app.get("/api/aerospot/aircraft/:hex/info", async (req, res) => {
    const hex = String(req.params.hex).trim().toLowerCase().replace(/^mock-/, "");
    if (!/^[0-9a-f]{6}$/.test(hex)) {
      // Ikke gyldig hex (f.eks. mock-callsign) — returner kun flagg fra reg
      return res.json({ info: enrichKnown(null, hex) });
    }
    const key = `info:${hex}`;
    const cached = cacheGet<unknown>(key);
    if (cached !== null) return res.json({ info: cached, cached: true });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      // adsbdb.com — gratis, ingen nøkkel (OpenSkys metadata-endpoint er nedlagt)
      const upstream = await fetch(`https://api.adsbdb.com/v0/aircraft/${hex}`, {
        headers: { "User-Agent": "CreatorHub-AeroSpot/1.0 daniel@creatorhubn.com" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      let base: AircraftInfo | null = null;
      if (upstream.ok) {
        const body = (await upstream.json()) as {
          response?: {
            aircraft?: {
              type?: string;
              icao_type?: string;
              manufacturer?: string;
              registration?: string;
              registered_owner?: string;
            };
          };
        };
        const a = body.response?.aircraft;
        if (a) {
          base = {
            hex,
            registration: a.registration || null,
            manufacturer: a.manufacturer || null,
            model: a.type || null,
            typecode: a.icao_type || null,
            operator: a.registered_owner || null,
            isMilitary: false,
            isSpecialLivery: false,
            liveryName: null,
          };
        }
      }
      const info = enrichKnown(base, base?.registration ?? hex);
      cacheSet(key, info, 7 * 24 * 60 * 60_000);
      res.json({ info });
    } catch {
      res.json({ info: enrichKnown(null, hex) });
    }
  });

  // Flybilde via planespotters.net (gratis, ingen nøkkel) — per ICAO24-hex
  // eller registrering. Cachet 24t. Returnerer thumbnail + fotograf-kreditt.
  app.get("/api/aerospot/aircraft/:id/photo", async (req, res) => {
    const id = String(req.params.id).trim();
    if (!/^[A-Za-z0-9-]{1,12}$/.test(id)) {
      return res.status(400).json({ error: "ugyldig id" });
    }
    const key = `photo:${id.toLowerCase()}`;
    const cached = cacheGet<unknown>(key);
    if (cached !== null) return res.json({ photo: cached, cached: true });
    // Hex = 6 hex-tegn; ellers behandle som registrering
    const isHex = /^[0-9a-fA-F]{6}$/.test(id);
    const url = isHex
      ? `https://api.planespotters.net/pub/photos/hex/${id.toLowerCase()}`
      : `https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(id.toUpperCase())}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const upstream = await fetch(url, {
        headers: { "User-Agent": "CreatorHub-AeroSpot/1.0 daniel@creatorhubn.com" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        cacheSet(key, null, 60 * 60_000);
        return res.json({ photo: null });
      }
      const body = (await upstream.json()) as {
        photos?: Array<{
          thumbnail_large?: { src?: string };
          thumbnail?: { src?: string };
          photographer?: string;
          link?: string;
        }>;
      };
      const first = body.photos?.[0];
      const photo = first
        ? {
            thumbnailUrl: first.thumbnail_large?.src ?? first.thumbnail?.src ?? null,
            photographer: first.photographer ?? null,
            link: first.link ?? null,
          }
        : null;
      cacheSet(key, photo, 24 * 60 * 60_000);
      res.json({ photo });
    } catch (err) {
      res.status(502).json({ error: "bilde-provider utilgjengelig", detail: String(err) });
    }
  });

  // Weather — cachet 10 min per rutenett-celle
  app.get("/api/aerospot/weather", async (req, res) => {
    const lat = num(req.query.lat);
    const lon = num(req.query.lon);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({ error: "lat/lon påkrevd (gyldige koordinater)" });
    }
    // Valgfri ?icao=ENGM: METAR-observasjon overstyrer sikt/vind
    const icaoRaw = typeof req.query.icao === "string" ? req.query.icao.toUpperCase() : "";
    const icao = /^[A-Z]{4}$/.test(icaoRaw) ? icaoRaw : null;
    const key = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}:${icao ?? ""}`;
    const cached = cacheGet<Awaited<ReturnType<typeof fetchMetWeather>>>(key);
    if (cached) return res.json({ weather: cached, cached: true });
    try {
      const weather = await fetchMetWeather(lat, lon);
      if (icao) {
        const metar = await fetchMetar(icao);
        if (metar) {
          weather.visibilityKm = metar.visibilityKm;
          if (metar.windDirectionDeg !== undefined) weather.windDirectionDeg = metar.windDirectionDeg;
          if (metar.windSpeedKt !== undefined) weather.windSpeedKt = metar.windSpeedKt;
          if (metar.gustKt !== undefined) weather.gustKt = metar.gustKt;
        }
      }
      cacheSet(key, weather, 10 * 60_000);
      res.json({ weather, cached: false });
    } catch (err) {
      res.status(502).json({ error: "vær-provider utilgjengelig", detail: String(err) });
    }
  });

  // Skriv anbefalte innstillinger til kameraet (CCAPI PUT). Krever
  // innlogging + privat LAN-IP. Best-effort per setting; returnerer hvilke
  // som lyktes. Canon forventer Norway-verdier fra kameraets ability-liste.
  app.post("/api/aerospot/camera/:ip/settings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ip = req.params.ip;
    if (!isPrivateLanIp(ip)) {
      return res.status(400).json({ error: "ugyldig IP — kun privat LAN-adresse tillatt" });
    }
    const b = req.body ?? {};
    const client = getCcapiClient(ip);
    const results: Record<string, boolean> = {};
    const jobs: Array<[("tv" | "av" | "iso"), string | undefined]> = [
      ["tv", strOrNull(b.shutterSpeed, 16) ?? undefined],
      ["av", strOrNull(b.aperture, 16)?.replace(/^f\/?/i, "") ?? undefined],
      ["iso", strOrNull(b.iso, 16) ?? undefined],
    ];
    for (const [kind, value] of jobs) {
      if (!value) continue;
      try {
        await client.setShootingSetting(kind, value);
        results[kind] = true;
      } catch {
        results[kind] = false;
      }
    }
    const anyOk = Object.values(results).some((v) => v);
    res.status(anyOk ? 200 : 502).json({ results });
  });

  // Kamera shooting-settings (read-only) via eksisterende CCAPI-klient.
  // Krever innlogging + privat LAN-IP (kameraet står på lokalnett) —
  // hindrer SSRF mot offentlige/interne mål.
  app.get("/api/aerospot/camera/:ip/settings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ip = req.params.ip;
    if (!isPrivateLanIp(ip)) {
      return res.status(400).json({ error: "ugyldig IP — kun privat LAN-adresse tillatt" });
    }
    try {
      const client = getCcapiClient(ip);
      const raw = await client.shootingSettings();
      res.json({
        settings: {
          shutterSpeed: raw.tv?.value,
          aperture: raw.av?.value,
          iso: raw.iso?.value,
        },
        raw,
      });
    } catch (err) {
      const status = err instanceof CcapiError && err.kind === "network" ? 504 : 502;
      res.status(status).json({ error: "kamera-settings utilgjengelig", detail: String(err) });
    }
  });

  // ── Arrangementer / flyshow ───────────────────────────────────────
  //
  // Kuratert liste over flyshow/aviation-events (Norge + utvalgte i Europa).
  // ponytail: statisk seed nå; flytt til aerospot_events-tabell med admin-
  // redigering når noen faktisk skal vedlikeholde den. Datoer er ISO.
  app.get("/api/aerospot/events", async (req, res) => {
    await tablesReady;
    const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : null;
    const upcoming = req.query.upcoming === "true" || req.query.upcoming === "1";
    const params: unknown[] = [];
    const conds: string[] = [`status = 'approved'`];
    if (country && /^[A-Z]{2}$/.test(country)) {
      params.push(country);
      conds.push(`country = $${params.length}`);
    }
    if (upcoming) conds.push(`end_date >= CURRENT_DATE`);
    try {
      const result = await pool.query(
        `SELECT * FROM aerospot_events WHERE ${conds.join(" AND ")}
         ORDER BY (featured AND (featured_until IS NULL OR featured_until > now())) DESC,
                  start_date ASC LIMIT 200`,
        params,
      );
      res.json({ events: result.rows.map(rowToEvent) });
    } catch {
      // Fallback til kuratert seed hvis DB feiler
      let events = CURATED_EVENTS;
      if (country) events = events.filter((e) => e.country === country);
      res.json({ events });
    }
  });

  app.get("/api/aerospot/events/:id", async (req, res) => {
    await tablesReady;
    const result = await pool.query(
      `SELECT * FROM aerospot_events WHERE id = $1 AND status = 'approved'`,
      [String(req.params.id)],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    res.json({ event: rowToEvent(result.rows[0]) });
  });

  // Arrangør-innsending: status='pending' til moderasjon, verified=false.
  app.post("/api/aerospot/events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const b = req.body ?? {};
    const name = strOrNull(b.name, 160);
    const venue = strOrNull(b.venue, 160);
    const type = strOrNull(b.type, 24);
    const validTypes = new Set(["airshow", "flydag", "spotting", "museum", "fly-in"]);
    if (!name || !venue || !type || !validTypes.has(type)) {
      return res.status(400).json({ error: "name, venue og gyldig type påkrevd" });
    }
    const start = strOrNull(b.startDate);
    const end = strOrNull(b.endDate) ?? start;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({ error: "startDate (YYYY-MM-DD) påkrevd" });
    }
    const id = `submit-${randomUUID().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO aerospot_events
         (id,name,type,venue,country,airport_icao,latitude,longitude,start_date,end_date,
          description,url,ticket_url,program,aircraft,venue_map,contact_email,contact_phone,verified,status,owner_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,false,'pending',$19)`,
      [
        id, name, type, venue,
        (strOrNull(b.country, 2) ?? "NO").toUpperCase(),
        strOrNull(b.airportIcao, 8),
        num(b.latitude), num(b.longitude),
        start, end,
        strOrNull(b.description, 2000) ?? "",
        strOrNull(b.url, 500), strOrNull(b.ticketUrl, 500),
        b.program ? JSON.stringify(b.program) : null,
        b.aircraft ? JSON.stringify(b.aircraft) : null,
        Array.isArray(b.venueMap) ? JSON.stringify(b.venueMap.slice(0, 40)) : null,
        strOrNull(b.contactEmail, 160), strOrNull(b.contactPhone, 40),
        session.userId,
      ],
    );
    res.status(201).json({ id, status: "pending", message: "Sendt til godkjenning" });
  });

  // ── Moderering (admin) ────────────────────────────────────────────
  const ADMIN_ROLES = new Set(["admin", "super_admin"]);
  function requireAdmin(req: Request, res: Response): SessionUser | null {
    const session = requireUserSession(req, res);
    if (!session) return null;
    if (!ADMIN_ROLES.has(session.role)) {
      res.status(403).json({ error: "krever admin" });
      return null;
    }
    return session;
  }

  app.get("/api/aerospot/admin/events/pending", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await tablesReady;
    const result = await pool.query(
      `SELECT * FROM aerospot_events WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`,
    );
    res.json({ events: result.rows.map(rowToEvent) });
  });

  app.post("/api/aerospot/admin/events/:id/approve", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await tablesReady;
    const verified = req.body?.verified === true;
    const result = await pool.query(
      `UPDATE aerospot_events SET status = 'approved', verified = $2
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [String(req.params.id), verified],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    res.json({ ok: true, verified });
  });

  app.post("/api/aerospot/admin/events/:id/reject", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await tablesReady;
    const result = await pool.query(
      `UPDATE aerospot_events SET status = 'rejected'
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [String(req.params.id)],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    res.json({ ok: true });
  });

  // Fremhevet plassering (betalt): sett featured med utløp (dager).
  app.post("/api/aerospot/admin/events/:id/feature", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await tablesReady;
    const days = num(req.body?.days) ?? 30;
    const feature = req.body?.feature !== false;
    const until = feature ? `now() + interval '${Math.max(1, Math.min(365, days))} days'` : "NULL";
    const result = await pool.query(
      `UPDATE aerospot_events SET featured = $2, featured_until = ${until}
       WHERE id = $1 AND status = 'approved' RETURNING id`,
      [String(req.params.id), feature],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    res.json({ ok: true, featured: feature });
  });

  // Sporet billett-lenke: teller klikk og redirecter til arrangørens salg.
  app.get("/api/aerospot/events/:id/ticket", async (req, res) => {
    await tablesReady;
    const result = await pool.query(
      `UPDATE aerospot_events SET ticket_clicks = ticket_clicks + 1
       WHERE id = $1 AND status = 'approved' RETURNING ticket_url`,
      [String(req.params.id)],
    );
    const url = result.rows[0]?.ticket_url;
    if (!url) return res.status(404).json({ error: "ingen billett-lenke" });
    res.redirect(302, url);
  });

  // ── Loggbok ───────────────────────────────────────────────────────

  app.get("/api/aerospot/logbook", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const result = await pool.query(
      `SELECT * FROM aerospot_logbook WHERE user_id = $1 ORDER BY date_iso DESC LIMIT 1000`,
      [session.userId],
    );
    res.json({ entries: result.rows.map(rowToEntry) });
  });

  app.post("/api/aerospot/logbook", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const b = req.body ?? {};
    const dateIso = strOrNull(b.dateIso) ?? new Date().toISOString();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO aerospot_logbook
         (id, user_id, photo_url, date_iso, location, airport_icao, flight_number,
          callsign, registration, aircraft_type, airline, latitude, longitude,
          focal_length_mm, shutter_speed, aperture, iso, camera_model, lens_model,
          rating, notes, favorite, rarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        id,
        session.userId,
        strOrNull(b.photoUrl, 2000),
        dateIso,
        strOrNull(b.location),
        strOrNull(b.airportIcao),
        strOrNull(b.flightNumber),
        strOrNull(b.callsign),
        strOrNull(b.registration),
        strOrNull(b.aircraftType),
        strOrNull(b.airline),
        num(b.latitude),
        num(b.longitude),
        num(b.focalLengthMm),
        strOrNull(b.shutterSpeed),
        strOrNull(b.aperture),
        num(b.iso),
        strOrNull(b.cameraModel),
        strOrNull(b.lensModel),
        num(b.rating),
        strOrNull(b.notes, 4000),
        b.favorite === true,
        strOrNull(b.rarity),
      ],
    );
    res.status(201).json({ id });
  });

  app.patch("/api/aerospot/logbook/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const b = req.body ?? {};
    const result = await pool.query(
      `UPDATE aerospot_logbook
       SET rating = COALESCE($3, rating),
           notes = COALESCE($4, notes),
           favorite = COALESCE($5, favorite)
       WHERE id = $1::uuid AND user_id = $2
       RETURNING id`,
      [
        req.params.id,
        session.userId,
        num(b.rating),
        strOrNull(b.notes, 4000),
        typeof b.favorite === "boolean" ? b.favorite : null,
      ],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    res.json({ ok: true });
  });

  app.delete("/api/aerospot/logbook/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    await pool.query(`DELETE FROM aerospot_logbook WHERE id = $1::uuid AND user_id = $2`, [
      req.params.id,
      session.userId,
    ]);
    res.json({ ok: true });
  });

  // ── Community / deling ────────────────────────────────────────────
  //
  // Delt feed av spotting-bilder. Lesing er offentlig; posting/liking/
  // sletting krever innlogging. Thumbnail lagres som base64 data-URL
  // (nedskalert på enheten). ponytail: flytt thumb til objektlagring
  // (R2) når volumet vokser — text-kolonnen holder for MVP.

  app.get("/api/aerospot/community", async (req, res) => {
    await tablesReady;
    const airport = typeof req.query.airport === "string" ? req.query.airport.toUpperCase() : null;
    const params: unknown[] = [];
    let where = "";
    if (airport && /^[A-Z]{4}$/.test(airport)) {
      params.push(airport);
      where = `WHERE airport_icao = $1`;
    }
    const result = await pool.query(
      `SELECT * FROM aerospot_community_posts p
       ${where}
       ORDER BY p.created_at DESC LIMIT 100`,
      params,
    );
    res.json({
      posts: result.rows.map((r) => ({
        id: r.id,
        userName: r.user_name ?? "Spotter",
        thumbData: r.thumb_data ?? null,
        aircraftType: r.aircraft_type ?? undefined,
        registration: r.registration ?? undefined,
        airline: r.airline ?? undefined,
        airportIcao: r.airport_icao ?? undefined,
        spotName: r.spot_name ?? undefined,
        caption: r.caption ?? undefined,
        likes: r.likes ?? 0,
        rarity: r.rarity ?? undefined,
        createdAtIso: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
    });
  });

  app.post("/api/aerospot/community", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const b = req.body ?? {};
    // Thumb: data-URL, cap ~200KB base64 (~150KB bilde)
    const thumb = typeof b.thumbData === "string" && b.thumbData.startsWith("data:image")
      ? b.thumbData.slice(0, 280_000)
      : null;
    const id = randomUUID();
    await pool.query(
      `INSERT INTO aerospot_community_posts
         (id, user_id, user_name, thumb_data, aircraft_type, registration, airline,
          airport_icao, spot_name, caption, rarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        session.userId,
        strOrNull(b.userName, 120) ?? session.name ?? "Spotter",
        thumb,
        strOrNull(b.aircraftType),
        strOrNull(b.registration),
        strOrNull(b.airline),
        strOrNull(b.airportIcao),
        strOrNull(b.spotName, 120),
        strOrNull(b.caption, 500),
        strOrNull(b.rarity),
      ],
    );
    res.status(201).json({ id });
  });

  app.post("/api/aerospot/community/:id/like", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    // Toggle: finnes like → fjern, ellers legg til. likes-teller holdes i sync.
    const existing = await pool.query(
      `DELETE FROM aerospot_community_likes WHERE post_id = $1::uuid AND user_id = $2 RETURNING post_id`,
      [req.params.id, session.userId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE aerospot_community_posts SET likes = GREATEST(0, likes - 1) WHERE id = $1::uuid`,
        [req.params.id],
      );
      return res.json({ liked: false });
    }
    await pool.query(
      `INSERT INTO aerospot_community_likes (post_id, user_id) VALUES ($1::uuid, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, session.userId],
    );
    await pool.query(
      `UPDATE aerospot_community_posts SET likes = likes + 1 WHERE id = $1::uuid`,
      [req.params.id],
    );
    res.json({ liked: true });
  });

  app.delete("/api/aerospot/community/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const result = await pool.query(
      `DELETE FROM aerospot_community_posts WHERE id = $1::uuid AND user_id = $2 RETURNING id`,
      [req.params.id, session.userId],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "ikke funnet" });
    await pool.query(`DELETE FROM aerospot_community_likes WHERE post_id = $1::uuid`, [req.params.id]);
    res.json({ ok: true });
  });

  // ── Varsler ───────────────────────────────────────────────────────

  app.get("/api/aerospot/alerts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const result = await pool.query(
      `SELECT * FROM aerospot_alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [session.userId],
    );
    res.json({
      alerts: result.rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        value: r.value,
        airportIcao: r.airport_icao ?? undefined,
        radiusKm: r.radius_km ?? undefined,
        enabled: Boolean(r.enabled),
        createdAtIso: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
    });
  });

  app.post("/api/aerospot/alerts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    const b = req.body ?? {};
    const kind = strOrNull(b.kind);
    const value = strOrNull(b.value);
    const validKinds = new Set(["aircraft_type", "registration", "airline", "rare", "airport", "radius"]);
    if (!kind || !validKinds.has(kind) || !value) {
      return res.status(400).json({ error: "kind + value påkrevd" });
    }
    const id = randomUUID();
    await pool.query(
      `INSERT INTO aerospot_alerts (id, user_id, kind, value, airport_icao, radius_km, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [id, session.userId, kind, value, strOrNull(b.airportIcao), num(b.radiusKm)],
    );
    res.status(201).json({ id });
  });

  app.delete("/api/aerospot/alerts/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await tablesReady;
    await pool.query(`DELETE FROM aerospot_alerts WHERE id = $1::uuid AND user_id = $2`, [
      req.params.id,
      session.userId,
    ]);
    res.json({ ok: true });
  });
}
