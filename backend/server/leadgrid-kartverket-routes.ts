/**
 * leadgrid-kartverket-routes.ts
 *
 * Kartverket / Geonorge-integrasjon for Leadgrid — supplerer
 * `external-data-routes.ts` (som allerede har forward-geocode/stedsnavn)
 * med endepunktene Leadgrid trenger:
 *
 *   GET /api/leadgrid/kartverket/reverse?lat=&lon=&radius=
 *       — reverse-geocoding (koordinat → norsk offisiell adresse + kommune)
 *
 *   GET /api/leadgrid/kartverket/kommune/:kommunenr
 *       — kommune-info (navn, fylke, admin-senter, folketall om tilgjengelig)
 *
 *   GET /api/leadgrid/kartverket/kommune/:kommunenr/omrade
 *       — kommune-grense som GeoJSON polygon (til Team-områder på kartet)
 *
 * Alle endepunkter er lese-only og upstream-cachet (60s TTL) — Geonorge
 * er gratis men vi vil ikke DDoS-e dem ved mange samtidige map-tap.
 *
 * Prefix: /api/leadgrid/kartverket/*
 * Auth:   requireUserSession (samme mønster som resten av leadgrid/*)
 *
 * Kilder (offisielt, gratis, ingen API-nøkkel):
 *   https://ws.geonorge.no/adresser/v1/punktsok
 *   https://ws.geonorge.no/kommuneinfo/v1/kommuner/{kommunenr}
 *   https://ws.geonorge.no/kommuneinfo/v1/kommuner/{kommunenr}/omrade
 */

import type { Express, Request, Response } from "express";

// ─── enkel LRU-cache (in-memory, 60s TTL, maks 500 nøkler) ──────────
// Vi cacher reverse-geocode + kommune-info fordi Leadgrid ellers ville
// spurt samme koordinat 10-50 ganger/dag når selgere sitter på kontoret.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; body: unknown }>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

function cacheSet(key: string, body: unknown) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { at: Date.now(), body });
}

// Dørsalg-adresser er nær-statiske. Egen stale-while-revalidate-cache gjør
// kartpanorering og retur til et nabolag øyeblikkelig uten å gjøre den korte
// reverse-geocode-cachen mindre presis.
const ADRESSE_CACHE_FRESH_TTL_MS = 10 * 60 * 1000;
const ADRESSE_CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const ADRESSE_CACHE_MAX = 300;
const ADRESSE_UPSTREAM_TIMEOUT_MS = 7_000;

type KartverketAdressePunkt = {
  adressetekst: string;
  postnummer: string;
  poststed: string;
  lat: number;
  lon: number;
};

type KartverketAdressePage = {
  total: number;
  side: number;
  page_size: number;
  has_more: boolean;
  adresser: KartverketAdressePunkt[];
};

type AdresseCacheState = "hit" | "miss" | "coalesced" | "stale";
type AdresseCacheEntry = { at: number; body: KartverketAdressePage };

const adresseCache = new Map<string, AdresseCacheEntry>();
const adresseInFlight = new Map<string, Promise<KartverketAdressePage>>();

function adresseCacheLookup(
  key: string,
): { body: KartverketAdressePage; fresh: boolean } | null {
  const entry = adresseCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.at;
  if (age > ADRESSE_CACHE_STALE_TTL_MS) {
    adresseCache.delete(key);
    return null;
  }
  // Flytt nylig brukt nøkkel bakerst slik at Map faktisk oppfører seg som LRU.
  adresseCache.delete(key);
  adresseCache.set(key, entry);
  return { body: entry.body, fresh: age <= ADRESSE_CACHE_FRESH_TTL_MS };
}

function adresseCacheSet(key: string, body: KartverketAdressePage): void {
  if (adresseCache.has(key)) adresseCache.delete(key);
  while (adresseCache.size >= ADRESSE_CACHE_MAX) {
    const oldest = adresseCache.keys().next().value as string | undefined;
    if (!oldest) break;
    adresseCache.delete(oldest);
  }
  adresseCache.set(key, { at: Date.now(), body });
}

function setAdresseCacheHeaders(res: Response, state: AdresseCacheState): void {
  // Responsen er ikke bruker-spesifikk, men endepunktet er autentisert.
  // private lar URLSession gjenbruke siden lokalt uten delt proxy-cache.
  res.setHeader(
    "Cache-Control",
    "private, max-age=300, stale-while-revalidate=3600",
  );
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Leadgrid-Cache", state);
}

async function fetchKartverketAdressePage(input: {
  lat: number;
  lon: number;
  radius: number;
  side: number;
  pageSize: number;
}): Promise<KartverketAdressePage> {
  const params = new URLSearchParams({
    lat: input.lat.toFixed(6),
    lon: input.lon.toFixed(6),
    radius: String(input.radius),
    koordsys: "4258",
    utkoordsys: "4258",
    treffPerSide: String(input.pageSize),
    side: String(input.side),
    asciiKompatibel: "false",
    // Målt 2026-08-31: ca. 58 KB mot 216 KB for 350 Oslo-treff.
    // Metadatafeltene må eksplisitt beholdes, ellers forsvinner totalen.
    filtrer: [
      "metadata.totaltAntallTreff",
      "metadata.side",
      "metadata.treffPerSide",
      "adresser.adressetekst",
      "adresser.postnummer",
      "adresser.poststed",
      "adresser.representasjonspunkt",
    ].join(","),
  });
  const upstream = await fetch(
    `https://ws.geonorge.no/adresser/v1/punktsok?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(ADRESSE_UPSTREAM_TIMEOUT_MS),
    },
  );
  if (!upstream.ok) {
    throw new Error(`kartverket_http_${upstream.status}`);
  }
  const data = (await upstream.json()) as {
    metadata?: {
      totaltAntallTreff?: number;
      side?: number;
      treffPerSide?: number;
    };
    adresser?: Array<{
      adressetekst?: string;
      postnummer?: string;
      poststed?: string;
      representasjonspunkt?: { lat?: number; lon?: number };
    }>;
  };
  const adresser = (data.adresser ?? [])
    .map((address): KartverketAdressePunkt | null => {
      const lat = Number(address.representasjonspunkt?.lat);
      const lon = Number(address.representasjonspunkt?.lon);
      const adressetekst = String(address.adressetekst ?? "").trim();
      if (!adressetekst || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return {
        adressetekst,
        postnummer: String(address.postnummer ?? "").trim(),
        poststed: String(address.poststed ?? "").trim(),
        lat,
        lon,
      };
    })
    .filter((address): address is KartverketAdressePunkt => address !== null);
  const totalRaw = Number(data.metadata?.totaltAntallTreff);
  const total = Number.isFinite(totalRaw)
    ? Math.max(0, Math.trunc(totalRaw))
    : adresser.length;
  return {
    total,
    side: input.side,
    page_size: input.pageSize,
    has_more: (input.side + 1) * input.pageSize < total,
    adresser,
  };
}

function loadAdressePage(
  key: string,
  input: Parameters<typeof fetchKartverketAdressePage>[0],
): { promise: Promise<KartverketAdressePage>; coalesced: boolean } {
  const existing = adresseInFlight.get(key);
  if (existing) return { promise: existing, coalesced: true };
  const promise = fetchKartverketAdressePage(input)
    .then((body) => {
      adresseCacheSet(key, body);
      return body;
    })
    .finally(() => {
      adresseInFlight.delete(key);
    });
  adresseInFlight.set(key, promise);
  return { promise, coalesced: false };
}

// ─── DTOs som klienten (iPad KartverketService) forventer ───────────
export interface KartverketReverseResult {
  address: string; // "Solgården 12"
  formatted: string; // "Solgården 12, 1830 Askim"
  postal_code: string; // "1830"
  city: string; // "Askim"
  municipality: string; // "Askim"
  municipality_number: string; // "3018"
  county: string; // "Viken"
  matrikkel_id: string | null; // knagg til matrikkel-lookup senere
  latitude: number; // Kartverkets representasjonspunkt (kan avvike marginalt)
  longitude: number;
  distance_m: number; // fra søke-punkt
}

export interface KartverketReverseResponse {
  match: KartverketReverseResult | null;
  candidates: KartverketReverseResult[]; // opptil 5 nærmeste
}

export interface KartverketKommune {
  kommunenavn: string;
  kommunenavn_norsk: string; // kan avvike (samisk/nordsamisk)
  kommunenummer: string;
  fylkesnavn: string;
  fylkesnummer: string;
  gyldig_fra: string | null;
  admin_senter: string | null;
}

// Kommune-katalogen (alle ~357 kommuner) endrer seg ~én gang i året —
// egen 24t-cache i stedet for 60s LRU-en.
let kommuneListeCache: { at: number; body: unknown } | null = null;
const KOMMUNE_LISTE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── main ───────────────────────────────────────────────────────────
export function registerLeadgridKartverketRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // ────────────────────────────────────────────────────────────────
  // GET /kommuner
  //
  // Full kommune-katalog (nummer + norsk navn), sortert på navn.
  // Brukes av «Tildel område»-sheeten på iPad som ekte katalog i
  // stedet for mock. 24t cache — Geonorge-listen er nær-statisk.
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/kartverket/kommuner", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    if (kommuneListeCache && Date.now() - kommuneListeCache.at < KOMMUNE_LISTE_TTL_MS) {
      return res.json(kommuneListeCache.body);
    }
    try {
      const upstream = await fetch("https://ws.geonorge.no/kommuneinfo/v1/kommuner", {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) {
        return res.status(502).json({ error: "upstream_failure" });
      }
      const raw = (await upstream.json()) as Array<{
        kommunenummer?: string;
        kommunenavnNorsk?: string;
        kommunenavn?: string;
      }>;
      const kommuner = (Array.isArray(raw) ? raw : [])
        .map((k) => ({
          nummer: String(k.kommunenummer ?? "").trim(),
          navn: String(k.kommunenavnNorsk ?? k.kommunenavn ?? "").trim(),
        }))
        .filter((k) => /^\d{4}$/.test(k.nummer) && k.navn)
        .sort((a, b) => a.navn.localeCompare(b.navn, "no"));
      const body = { kommuner };
      kommuneListeCache = { at: Date.now(), body };
      return res.json(body);
    } catch (err) {
      console.warn(
        "[leadgrid-kartverket] kommune-liste failed:",
        (err as Error).message,
      );
      return res.status(502).json({ error: "upstream_failure" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /reverse?lat=&lon=&radius=
  //
  // Reverse-geocoding via Kartverkets punktsok. `radius` er i meter
  // (default 50m, maks 500m). Returnerer nærmeste offisielle adresse
  // + opp til 5 kandidater (til å vise "mente du" i UI hvis brukeren
  // står mellom to bygninger).
  //
  // Bruker WGS84 (koordsys=4326) siden iOS CoreLocation gir det. Geonorge
  // sitt punktsok forventer nord=lat, ost=lon — samme akse.
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/kartverket/reverse", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusRaw = Number(req.query.radius);
    const radius = Number.isFinite(radiusRaw)
      ? Math.max(1, Math.min(500, radiusRaw))
      : 50;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res
        .status(400)
        .json({ error: "lat_and_lon_required" });
    }

    const cacheKey = `rev:${lat.toFixed(5)}:${lon.toFixed(5)}:${radius}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
      const url =
        `https://ws.geonorge.no/adresser/v1/punktsok` +
        `?radius=${radius}&lat=${lat}&lon=${lon}` +
        `&koordsys=4258&treffPerSide=5`;
      const upstream = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) {
        return res.json({ match: null, candidates: [] });
      }
      const payload = (await upstream.json()) as {
        adresser?: unknown[];
      };
      const rows = Array.isArray(payload?.adresser) ? payload.adresser : [];
      const candidates: KartverketReverseResult[] = rows
        .map((row): KartverketReverseResult | null => {
          const a = row as Record<string, unknown>;
          const pkt = (a.representasjonspunkt ?? {}) as Record<string, unknown>;
          const aLat = Number(pkt.lat);
          const aLon = Number(pkt.lon);
          if (!Number.isFinite(aLat) || !Number.isFinite(aLon)) return null;
          const street = String(a.adressetekst ?? "").trim();
          const postal = String(a.postnummer ?? "").trim();
          const city = String(a.poststed ?? "").trim();
          const municipality = String(a.kommunenavn ?? "").trim();
          const municipalityNr = String(a.kommunenummer ?? "").trim();
          const county = String(a.fylkesnavn ?? "").trim();
          const matrikkelId = a.matrikkelId ? String(a.matrikkelId) : null;
          return {
            address: street,
            formatted: [street, [postal, city].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", "),
            postal_code: postal,
            city,
            municipality,
            municipality_number: municipalityNr,
            county,
            matrikkel_id: matrikkelId,
            latitude: aLat,
            longitude: aLon,
            distance_m: haversineMeters(lat, lon, aLat, aLon),
          };
        })
        .filter((r): r is KartverketReverseResult => r !== null)
        .sort((a, b) => a.distance_m - b.distance_m);

      const body: KartverketReverseResponse = {
        match: candidates[0] ?? null,
        candidates,
      };
      cacheSet(cacheKey, body);
      return res.json(body);
    } catch (err) {
      console.warn(
        "[leadgrid-kartverket] reverse-geocode failed:",
        (err as Error).message,
      );
      return res.json({ match: null, candidates: [] });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /kommune/:kommunenr
  //
  // Info om en kommune (navn, fylke, folketall, admin-senter).
  // Brukes til å pynte Team-områder + auto-fylle kommune-tag på leads.
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/kartverket/kommune/:kommunenr", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const nr = String(req.params.kommunenr || "").trim();
    if (!/^\d{4}$/.test(nr)) {
      return res.status(400).json({ error: "invalid_kommunenr" });
    }

    const cacheKey = `kom:${nr}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
      const upstream = await fetch(
        `https://ws.geonorge.no/kommuneinfo/v1/kommuner/${nr}`,
        { headers: { Accept: "application/json" } },
      );
      if (!upstream.ok) {
        return res.status(404).json({ error: "kommune_not_found" });
      }
      const raw = (await upstream.json()) as Record<string, unknown>;
      const body: KartverketKommune = {
        kommunenavn: String(raw.kommunenavn ?? ""),
        kommunenavn_norsk: String(
          raw.kommunenavnNorsk ?? raw.kommunenavn ?? "",
        ),
        kommunenummer: String(raw.kommunenummer ?? nr),
        fylkesnavn: String(raw.fylkesnavn ?? ""),
        fylkesnummer: String(raw.fylkesnummer ?? ""),
        gyldig_fra: raw.gyldigeFra ? String(raw.gyldigeFra) : null,
        admin_senter: raw.administrasjonssenter
          ? String(raw.administrasjonssenter)
          : null,
      };
      cacheSet(cacheKey, body);
      return res.json(body);
    } catch (err) {
      console.warn(
        "[leadgrid-kartverket] kommune-info failed:",
        (err as Error).message,
      );
      return res.status(502).json({ error: "upstream_failure" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /kommune/:kommunenr/omrade
  //
  // Kommune-grense som GeoJSON polygon. Frontenden legger dette som
  // MKPolygon på kartet i Team-fanen — ekte kommunegrense i stedet for
  // hardkodete polygoner.
  //
  // Utkoordsys 4326 (WGS84, samme som MapKit).
  // ────────────────────────────────────────────────────────────────
  app.get(
    "/api/leadgrid/kartverket/kommune/:kommunenr/omrade",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;

      const nr = String(req.params.kommunenr || "").trim();
      if (!/^\d{4}$/.test(nr)) {
        return res.status(400).json({ error: "invalid_kommunenr" });
      }

      const cacheKey = `kom-omrade:${nr}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json(cached);

      try {
        const upstream = await fetch(
          `https://ws.geonorge.no/kommuneinfo/v1/kommuner/${nr}/omrade?utkoordsys=4326`,
          { headers: { Accept: "application/json" } },
        );
        if (!upstream.ok) {
          return res.status(404).json({ error: "omrade_not_found" });
        }
        const raw = (await upstream.json()) as {
          omrade?: { coordinates?: unknown; type?: string };
        };
        const geom = raw.omrade;
        if (!geom || !geom.coordinates) {
          return res.status(404).json({ error: "no_geometry" });
        }
        // Wrap i GeoJSON Feature slik at MKGeoJSONDecoder på iOS spiser det.
        const feature = {
          type: "Feature",
          geometry: {
            type: geom.type ?? "MultiPolygon",
            coordinates: geom.coordinates,
          },
          properties: { kommunenummer: nr },
        };
        cacheSet(cacheKey, feature);
        return res.json(feature);
      } catch (err) {
        console.warn(
          "[leadgrid-kartverket] kommune-omrade failed:",
          (err as Error).message,
        );
        return res.status(502).json({ error: "upstream_failure" });
      }
    },
  );
}

// ─── Dørsalg-modus: husstandsadresser (2026-07-18) ──────────────────
// Kartverkets adresse-API (gratis, alle adresser i Norge m/ koordinat).
// VIKTIG design-regel fra Daniel: dørsalg-modusen er en EGEN modus som
// aldri blandes med bedrifts-leads — dette er en ren proxy uten lagring;
// husstandsadresser skrives ALDRI til crm_customers. Sone-filtrering
// (tettsted/territorium) gjøres on-device m/ TerritoryGeo.
export function registerLeadgridAdresseRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // GET /api/leadgrid/kartverket/adresser/punkt
  // Kartverkets punktsøk er avstandssortert og paginert. Nye klienter bruker
  // page_size=350 for en rask første render; eldre klienter beholder 1000.
  app.get("/api/leadgrid/kartverket/adresser/punkt", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radius = Math.min(
      2000,
      Math.max(50, Math.trunc(Number(req.query.radius) || 500)),
    );
    const pageSizeRaw = Number(req.query.page_size);
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(1000, Math.max(50, Math.trunc(pageSizeRaw)))
      : 1000;
    const sideRaw = Number(req.query.side);
    const maxSide = Math.floor(9_999 / pageSize);
    const side = Number.isFinite(sideRaw)
      ? Math.min(maxSide, Math.max(0, Math.trunc(sideRaw)))
      : 0;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return res.status(400).json({ error: "ugyldig_koordinat" });
    }

    const key = [
      "adr",
      lat.toFixed(4),
      lon.toFixed(4),
      radius,
      side,
      pageSize,
    ].join(":");
    const cached = adresseCacheLookup(key);
    if (cached?.fresh) {
      setAdresseCacheHeaders(res, "hit");
      return res.json(cached.body);
    }

    const input = { lat, lon, radius, side, pageSize };
    if (cached) {
      // Server stale-while-revalidate: feltarbeid får umiddelbart siste kjente
      // adresser selv om Kartverket er tregt akkurat nå.
      setAdresseCacheHeaders(res, "stale");
      const refresh = loadAdressePage(key, input);
      void refresh.promise.catch((error) => {
        console.warn(
          "[kartverket-adresser] bakgrunnsoppfriskning feilet:",
          (error as Error).message,
        );
      });
      return res.json(cached.body);
    }

    const load = loadAdressePage(key, input);
    try {
      const body = await load.promise;
      setAdresseCacheHeaders(res, load.coalesced ? "coalesced" : "miss");
      return res.json(body);
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      console.warn(
        "[kartverket-adresser] punktsok feilet:",
        (error as Error).message,
      );
      return res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? "kartverket_timeout" : "kartverket_utilgjengelig",
      });
    }
  });
}

// ─── util ──────────────────────────────────────────────────────────
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
