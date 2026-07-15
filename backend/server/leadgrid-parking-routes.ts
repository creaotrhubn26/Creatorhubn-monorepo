/**
 * leadgrid-parking-routes.ts
 *
 * Bilparkering for feltarbeidere — Statens vegvesens åpne Parkeringsregister
 * (parkeringsområder med vilkårsparkering). Speiler Kartverket/Entur-proxyen:
 * session-gated, upstream-cachet.
 *
 *   GET /api/leadgrid/parking/nearby?lat=&lon=&radius=&limit=
 *       — nærmeste p-områder for en lead: navn, adresse, operatør, gangavstand
 *         + hvilke parkerings-apper man kan bruke («Åpne parkering»).
 *
 *   GET /api/leadgrid/parking/:id
 *       — full detalj for ett område (type, antall plasser, avgift/gratis,
 *         lade-/HC-plasser, innfartsparkering) hentet on-tap.
 *
 * 🔴 Registeret har INGEN geo-spørring — hele lista (22k punkt-records, ~7,6 MB
 * `datafelter=kart`) må hentes og nabosøkes selv. Vi cacher hele lista i minnet
 * i 24t (samme mønster som kartverket sin kommune-liste), og gjør bbox-forfilter
 * + Haversine i JS. Registeret oppdateres sjelden, så 24t er trygt.
 *
 * 🔴 Registeret har INGEN pris/takst (den står på det fysiske skiltet) — vi viser
 * operatør + adresse + kapasitet ærlig, og lar operatørens app håndtere betaling.
 *
 * Åpent, ingen API-nøkkel, NLOD («Inneholder data under NLOD fra Statens
 * vegvesen / Parkeringsregisteret»).
 *
 * Kilde: https://parkreg-open.atlas.vegvesen.no/ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1
 */

import type { Express, Request, Response } from "express";

const PARKREG_BASE =
  "https://parkreg-open.atlas.vegvesen.no/ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1";

// ─── hele-lista-cache (24t) + per-id LRU (30 min) ───────────────────
interface ParkingArea {
  id: number;
  navn: string;
  adresse: string;
  poststed: string;
  operator: string;
  operator_orgnr: string | null;
  lat: number;
  lon: number;
}

let registerCache: { at: number; areas: ParkingArea[] } | null = null;
const REGISTER_TTL_MS = 24 * 60 * 60 * 1000;
let registerLoading: Promise<ParkingArea[]> | null = null;

const detailCache = new Map<string, { at: number; body: unknown }>();
const DETAIL_TTL_MS = 30 * 60_000;
const DETAIL_MAX = 300;

// Parkerings-apper i Norge (åpner appen hvis installert, ellers web/butikk).
// Registeret sier IKKE hvilken app som dekker et lott — vi tilbyr de vanligste.
const PARKING_APPS = [
  { name: "EasyPark", url: "https://www.easypark.no/", android: "net.easypark.android" },
  { name: "Parkly", url: "https://pay.parkly.no/", android: "com.parklyconsumerapplication" },
  { name: "Aimo Park", url: "https://aimopark.no/", android: null },
];

async function loadRegister(): Promise<ParkingArea[]> {
  if (registerCache && Date.now() - registerCache.at < REGISTER_TTL_MS) {
    return registerCache.areas;
  }
  if (registerLoading) return registerLoading;
  registerLoading = (async () => {
    try {
      const upstream = await fetch(`${PARKREG_BASE}/parkeringsomraade?datafelter=kart`, {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) throw new Error(`parkreg ${upstream.status}`);
      const raw = (await upstream.json()) as any[];
      const areas: ParkingArea[] = (Array.isArray(raw) ? raw : [])
        .filter((a) => a && a.deaktivert == null && Number.isFinite(a.breddegrad) && Number.isFinite(a.lengdegrad))
        .map((a) => ({
          id: Number(a.id),
          navn: String(a.navn ?? "").trim(),
          adresse: String(a.adresse ?? "").trim(),
          poststed: String(a.poststed ?? "").trim(),
          operator: String(a.parkeringstilbyderNavn ?? "").trim(),
          operator_orgnr: a.parkeringstilbyderOrganisasjonsnummer
            ? String(a.parkeringstilbyderOrganisasjonsnummer)
            : null,
          lat: Number(a.breddegrad),
          lon: Number(a.lengdegrad),
        }));
      registerCache = { at: Date.now(), areas };
      return areas;
    } finally {
      registerLoading = null;
    }
  })();
  return registerLoading;
}

// ─── main ───────────────────────────────────────────────────────────
export function registerLeadgridParkingRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // ────────────────────────────────────────────────────────────────
  // GET /nearby?lat=&lon=&radius=&limit=
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/parking/nearby", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radius = Number.isFinite(Number(req.query.radius))
      ? Math.max(50, Math.min(5000, Number(req.query.radius)))
      : 900;
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.max(1, Math.min(20, Number(req.query.limit)))
      : 5;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }

    try {
      const areas = await loadRegister();
      // bbox-forfilter (~radius i grader) før Haversine — 22k rows er trivielt.
      const dLat = radius / 111_000;
      const dLon = radius / (111_000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
      const near = areas
        .filter((a) => Math.abs(a.lat - lat) <= dLat && Math.abs(a.lon - lon) <= dLon)
        .map((a) => {
          const d = haversineMeters(lat, lon, a.lat, a.lon);
          return {
            id: a.id,
            navn: a.navn,
            adresse: a.adresse,
            poststed: a.poststed,
            operator: a.operator,
            operator_orgnr: a.operator_orgnr,
            lat: a.lat,
            lon: a.lon,
            distance_m: d,
            walk_min: Math.max(1, Math.round(d / 1.35 / 60)),
          };
        })
        .filter((a) => a.distance_m <= radius)
        .sort((a, b) => a.distance_m - b.distance_m)
        .slice(0, limit);

      return res.json({ areas: near, apps: PARKING_APPS });
    } catch (err) {
      console.warn("[leadgrid-parking] nearby failed:", (err as Error).message);
      return res.json({ areas: [], apps: PARKING_APPS });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /:id  — full detalj (type, plasser, avgift/gratis, lade/HC)
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/parking/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const id = String(req.params.id || "").trim();
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid_id" });

    const hit = detailCache.get(id);
    if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return res.json(hit.body);

    try {
      const upstream = await fetch(`${PARKREG_BASE}/parkeringsomraade/${id}`, {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) return res.status(404).json({ error: "not_found" });
      const raw = (await upstream.json()) as any;
      const v = raw?.aktivVersjon ?? raw ?? {};
      const paid = Number(v.antallAvgiftsbelagtePlasser ?? 0);
      const free = Number(v.antallAvgiftsfriePlasser ?? 0);
      const body = {
        id: Number(raw?.id ?? id),
        navn: String(v.navn ?? ""),
        adresse: String(v.adresse ?? ""),
        operator: String(raw?.parkeringstilbyderNavn ?? v.parkeringstilbyderNavn ?? ""),
        type: String(v.typeParkeringsomrade ?? "IKKE_VALGT"),
        paid_spaces: paid,
        free_spaces: free,
        total_spaces: paid + free,
        charging_spaces: Number(v.antallLadeplasser ?? 0),
        accessible_spaces: Number(v.antallForflytningshemmede ?? 0),
        park_and_ride: v.innfartsparkering === "JA" || v.innfartsparkering === true,
      };
      if (detailCache.size >= DETAIL_MAX) {
        const first = detailCache.keys().next().value;
        if (first) detailCache.delete(first);
      }
      detailCache.set(id, { at: Date.now(), body });
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-parking] detail failed:", (err as Error).message);
      return res.status(502).json({ error: "upstream_failure" });
    }
  });
}

// ─── util ───────────────────────────────────────────────────────────
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
