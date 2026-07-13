/**
 * leadgrid-nvdb-routes.ts
 *
 * NVDB (Nasjonal vegdatabank) v4 for Leadgrid — fartsgrense (+ senere
 * enveiskjøring / svingrestriksjon for parkerings-nåbarhet). Speiler
 * Kartverket/Entur/parkering-proxyene.
 *
 *   GET /api/leadgrid/nvdb/near?lat=&lon=&radius=
 *       — fartsgrense nær en koordinat (dominerende km/t + liste), til å vise
 *         fartsgrense-skilt i nav-modus.
 *
 * 🔴 NVDB API Les **V3 er stengt** → V4. Åpent, ingen API-nøkkel, men KREVER
 * `X-Client`-header (env NVDB_CLIENT, default "creatorhubn-leadgrid"). NLOD.
 * Fartsgrenser er nær-statiske → lang cache.
 *
 * Kilde: https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105
 */

import type { Express, Request, Response } from "express";

const NVDB_BASE = "https://nvdbapiles.atlas.vegvesen.no";
const NVDB_CLIENT = process.env.NVDB_CLIENT || "creatorhubn-leadgrid";
const NVDB_CONTACT = process.env.NVDB_KONTAKTPERSON || "";

// fartsgrense = vegobjekttype 105, bomstasjon = 45
const OBJTYPE_FARTSGRENSE = 105;
const OBJTYPE_BOMSTASJON = 45;

// ─── cache (fartsgrenser er nær-statiske → 6t) ─────────────────────
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

function cacheGet(key: string): unknown | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.body;
}
function cacheSet(key: string, body: unknown) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), body });
}

async function nvdbGet(path: string): Promise<any | null> {
  try {
    const headers: Record<string, string> = { "X-Client": NVDB_CLIENT, Accept: "application/json" };
    if (NVDB_CONTACT) headers["X-Kontaktperson"] = NVDB_CONTACT;
    const r = await fetch(`${NVDB_BASE}${path}`, { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.warn("[leadgrid-nvdb] fetch failed:", (err as Error).message);
    return null;
  }
}

export function registerLeadgridNvdbRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // ────────────────────────────────────────────────────────────────
  // GET /near?lat=&lon=&radius=
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/nvdb/near", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusRaw = Number(req.query.radius);
    // radius i meter → grader (grovt). Default ~150 m.
    const radiusM = Number.isFinite(radiusRaw) ? Math.max(30, Math.min(500, radiusRaw)) : 150;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }

    const cacheKey = `fart:${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusM}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const dLat = radiusM / 111_000;
    const dLon = radiusM / (111_000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const bbox = `${(lon - dLon).toFixed(6)},${(lat - dLat).toFixed(6)},${(lon + dLon).toFixed(6)},${(lat + dLat).toFixed(6)}`;

    const empty = { speed_limit: null as number | null, speed_limits: [] as number[], source: "nvdb" };
    try {
      const data = await nvdbGet(
        `/vegobjekter/api/v4/vegobjekter/${OBJTYPE_FARTSGRENSE}` +
          `?kartutsnitt=${bbox}&srid=4326&inkluder=egenskaper&antall=10`,
      );
      const objs: any[] = Array.isArray(data?.objekter) ? data.objekter : [];
      const speeds: number[] = objs
        .map((o) => {
          const e = (o.egenskaper || []).find((x: any) => x?.navn === "Fartsgrense");
          return Number(e?.verdi);
        })
        .filter((v) => Number.isFinite(v));
      if (speeds.length === 0) {
        cacheSet(cacheKey, empty);
        return res.json(empty);
      }
      // dominerende fartsgrense (hyppigst)
      const counts = new Map<number, number>();
      for (const s of speeds) counts.set(s, (counts.get(s) ?? 0) + 1);
      let dominant = speeds[0];
      let best = 0;
      for (const [v, c] of counts) if (c > best) { best = c; dominant = v; }
      const body = {
        speed_limit: dominant,
        speed_limits: Array.from(new Set(speeds)).sort((a, b) => a - b),
        source: "nvdb",
      };
      cacheSet(cacheKey, body);
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-nvdb] near failed:", (err as Error).message);
      return res.json(empty);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GET /tolls?bbox=minLon,minLat,maxLon,maxLat
  //   Bomstasjoner (objtype 45) i et kartutsnitt, med EKTE takster (liten/stor
  //   bil + rushtid). iPad filtrerer til de som ligger på ruta og summerer.
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/nvdb/tolls", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const bbox = String(req.query.bbox || "");
    if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bbox)) {
      return res.status(400).json({ error: "bbox_required" });
    }

    const cacheKey = `toll:${bbox}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const num = (o: any[], navn: string): number | null => {
      const e = (o || []).find((x: any) => x?.navn === navn);
      const v = Number(e?.verdi);
      return Number.isFinite(v) ? v : null;
    };
    const str = (o: any[], navn: string): string | null => {
      const e = (o || []).find((x: any) => x?.navn === navn);
      return e?.verdi != null ? String(e.verdi) : null;
    };
    // NVDB srid=4326 WKT: "POINT Z (lat lon høyde)" → [lat, lon].
    const parseWkt = (wkt: string): { lat: number; lon: number } | null => {
      const m = wkt?.match(/\(([-\d.]+)\s+([-\d.]+)/);
      if (!m) return null;
      const lat = Number(m[1]), lon = Number(m[2]);
      return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
    };

    try {
      const data = await nvdbGet(
        `/vegobjekter/api/v4/vegobjekter/${OBJTYPE_BOMSTASJON}` +
          `?kartutsnitt=${bbox}&srid=4326&inkluder=egenskaper,lokasjon&antall=100`,
      );
      const objs: any[] = Array.isArray(data?.objekter) ? data.objekter : [];
      const stations = objs
        .map((o) => {
          const eg = o.egenskaper || [];
          const geo = parseWkt(o?.lokasjon?.geometri?.wkt || "");
          if (!geo) return null;
          return {
            lat: geo.lat,
            lon: geo.lon,
            operator_name: str(eg, "Navn bomstasjon") ?? str(eg, "Eier"),
            rate_small: num(eg, "Takst liten bil"),
            rate_large: num(eg, "Takst stor bil"),
            rush_small: num(eg, "Rushtidstakst liten bil"),
            rush_large: num(eg, "Rushtidstakst stor bil"),
          };
        })
        .filter(Boolean);
      const body = { stations, source: "nvdb" };
      cacheSet(cacheKey, body);
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-nvdb] tolls failed:", (err as Error).message);
      return res.json({ stations: [], source: "nvdb" });
    }
  });
}
