/**
 * Leadgrid bilparkering (fase 1) — Statens vegvesens parkeringsregister.
 *
 * Åpent lese-API (ingen nøkkel): hele registeret (~22k avgiftsbelagte
 * p-områder m/ koordinater) caches i minnet i 24 t; klienten spør med
 * lat/lon og får de nærmeste områdene ved destinasjonen + hvilke
 * parkerings-apper selgeren kan åpne. Registeret har ingen pris (den
 * står på skiltet) — vi viser operatør/kapasitet ærlig og lar
 * operatørens app ta betalingen.
 *
 * Kontrakten matcher ParkingService.swift:
 *   GET /api/leadgrid/parking/nearby?lat&lon&radius&limit
 *     → { areas: [{id,navn,adresse,poststed,operator,lat,lon,
 *                  distanceM,walkMin}], apps: [{name,url}] }
 *   GET /api/leadgrid/parking/:id
 *     → { id,navn,type,paidSpaces,freeSpaces,totalSpaces,
 *         chargingSpaces,accessibleSpaces,parkAndRide }
 *
 * Kilde: parkreg-open.atlas.vegvesen.no (Lese-API v1, åpne data).
 */

import type { Express, Request, Response } from "express";

const KILDE_BASE =
  "https://parkreg-open.atlas.vegvesen.no/ws/no/vegvesen/veg/parkeringsomraade/parkeringsregisteret/v1";
const CACHE_MS = 24 * 60 * 60 * 1000;

/** Parkerings-appene selgere faktisk bruker — åpnes fra lead-kortet. */
const PARKERING_APPER = [
  { name: "EasyPark", url: "https://easypark.no/" },
  { name: "Apcoa Flow", url: "https://apcoaflow.no/" },
  { name: "OnePark", url: "https://onepark.no/" },
];

type Omraade = {
  id: number;
  navn: string;
  adresse: string;
  poststed: string;
  operator: string;
  lat: number;
  lon: number;
};

let cache: Omraade[] = [];
let cachetVed = 0;
let henter: Promise<void> | null = null;

async function oppdaterCache(): Promise<void> {
  const res = await fetch(`${KILDE_BASE}/parkeringsomraade`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`parkeringsregisteret ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  cache = data
    .filter((r) => !r.deaktivert
      && typeof r.breddegrad === "number"
      && typeof r.lengdegrad === "number")
    .map((r) => ({
      id: Number(r.id),
      navn: String(r.navn ?? "Parkering"),
      adresse: String(r.adresse ?? ""),
      poststed: String(r.poststed ?? ""),
      operator: String(r.parkeringstilbyderNavn ?? ""),
      lat: r.breddegrad as number,
      lon: r.lengdegrad as number,
    }));
  cachetVed = Date.now();
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function registerLeadgridParkeringRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}): void {
  const { app, requireUserSession } = deps;

  app.get("/api/leadgrid/parking/nearby", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!isFinite(lat) || !isFinite(lon)) {
        res.status(400).json({ error: "bad_request", message: "lat/lon kreves" });
        return;
      }
      const radius = Math.min(3000, Math.max(100, Number(req.query.radius) || 900));
      const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 4));

      if (Date.now() - cachetVed > CACHE_MS || cache.length === 0) {
        // Én henter om gangen — parallelle kall venter på samme løfte.
        henter = henter ?? oppdaterCache().finally(() => { henter = null; });
        try {
          await henter;
        } catch (e) {
          if (cache.length === 0) {
            console.error("[parking] kilde utilgjengelig:", String(e).slice(0, 120));
            res.status(503).json({ error: "kilde_utilgjengelig" });
            return;
          }
          // Gammel cache finnes → server den (ærlig degradering).
        }
      }

      const areas = cache
        .map((o) => {
          const distanceM = Math.round(haversineM(lat, lon, o.lat, o.lon));
          return { ...o, distanceM, walkMin: Math.max(1, Math.round(distanceM / 80)) };
        })
        .filter((o) => o.distanceM <= radius)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, limit);
      res.json({ areas, apps: PARKERING_APPER });
    } catch (e) {
      console.error("[parking] nearby failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Full detalj (type, plasser, lade/HC) — hentes on-tap fra kilden. */
  app.get("/api/leadgrid/parking/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const r = await fetch(`${KILDE_BASE}/parkeringsomraade/${id}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        res.status(r.status === 404 ? 404 : 502).json({ error: "kilde_feil" });
        return;
      }
      const d = (await r.json()) as Record<string, unknown>;
      const av = (d.aktivVersjon ?? {}) as Record<string, unknown>;
      const paid = Number(av.antallAvgiftsbelagtePlasser ?? 0) || 0;
      const free = Number(av.antallAvgiftsfriePlasser ?? 0) || 0;
      res.json({
        id,
        navn: String(av.navn ?? d.navn ?? "Parkering"),
        type: String(av.typeParkeringsomrade ?? ""),
        paidSpaces: paid,
        freeSpaces: free,
        totalSpaces: paid + free,
        chargingSpaces: Number(av.antallLadeplasser ?? 0) || 0,
        accessibleSpaces: Number(av.antallForflytningshemmede ?? 0) || 0,
        parkAndRide: av.innfartsparkering === true,
      });
    } catch (e) {
      console.error("[parking] detail failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
