/**
 * leadgrid-vehicle-routes.ts
 *
 * Statens vegvesen Kjøretøyoppslag (Autosys) for Leadgrid — «Min bil»-profil
 * via registreringsnummer. Speiler kartverket/entur/parkering/nvdb-proxyene.
 *
 *   GET /api/leadgrid/vehicle/lookup?plate=EL12345
 *       — tekniske kjøretøydata (drivstoff, merke, modell, klasse) fra
 *         Vegvesens `enkeltoppslag/kjoretoydata`. Brukes til å auto-fylle
 *         «Min bil» så nav skreddersyr POI (lade vs bensin) + kjøregodtgjørelse.
 *
 * 🔒 PERSONVERN: enkeltoppslag/kjoretoydata returnerer KUN tekniske data
 * (ikke eier). Vi plukker likevel eksplisitt ut kun tekniske felt og
 * returnerer ALDRI noe annet — ingen understellsnummer, ingen eier.
 *
 * 🔑 Krever API-nøkkel (header `SVV-Authorization: Apikey <key>`) fra env
 * `VEGVESEN_KJORETOY_APIKEY`. Uten den → 503 (ikke konfigurert). Kjøretøydata
 * er nær-statiske → lang cache.
 *
 * Kilde: https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata
 */

import type { Express, Request, Response } from "express";

const SVV_BASE = "https://akfell-datautlevering.atlas.vegvesen.no";
const SVV_APIKEY = process.env.VEGVESEN_KJORETOY_APIKEY || "";

// ─── cache (kjøretøydata er nær-statiske → 24t, keyet på skilt) ──────
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

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

/** Trekk ut KUN tekniske felt fra Vegvesens kjoretoydata-respons. */
function extractTechnical(data: any): {
  fuel_code: string | null;
  make: string | null;
  model: string | null;
  body_kind: string | null;
} {
  const k = data?.kjoretoydataListe?.[0];
  const teknisk = k?.godkjenning?.tekniskGodkjenning;
  const td = teknisk?.tekniskeData;
  const fuelCode =
    td?.miljodata?.miljoOgdrivstoffGruppe?.[0]?.drivstoffKodeMiljodata?.kodeVerdi ?? null;
  const make = td?.generelt?.merke?.[0]?.merke ?? null;
  const model = td?.generelt?.handelsbetegnelse?.[0] ?? null;
  const bodyKind =
    teknisk?.kjoretoyklassifisering?.beskrivelse ??
    teknisk?.kjoretoyklassifisering?.kjoretoyklasse?.kodeBeskrivelse ??
    null;
  return { fuel_code: fuelCode, make, model, body_kind: bodyKind };
}

export function registerLeadgridVehicleRoutes(deps: {
  app: Express;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, requireUserSession } = deps;

  // ────────────────────────────────────────────────────────────────
  // GET /vehicle/lookup?plate=
  // ────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/vehicle/lookup", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    if (!SVV_APIKEY) {
      return res.status(503).json({ error: "vehicle_lookup_not_configured" });
    }

    const plate = String(req.query.plate || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    // Norske skilt: 2 bokstaver + 5 sifre (+ personlig/EL-varianter). Grov sjekk.
    if (!/^[A-ZÆØÅ0-9]{4,8}$/.test(plate)) {
      return res.status(400).json({ error: "invalid_plate" });
    }

    const cacheKey = `veh:${plate}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
      const r = await fetch(
        `${SVV_BASE}/enkeltoppslag/kjoretoydata?kjennemerke=${encodeURIComponent(plate)}`,
        {
          headers: {
            "SVV-Authorization": `Apikey ${SVV_APIKEY}`,
            Accept: "application/json",
          },
        },
      );

      // 204 = gyldig nøkkel, men ingen bil på skiltet.
      if (r.status === 204) {
        const empty = { found: false, fuel_code: null, make: null, model: null, body_kind: null };
        cacheSet(cacheKey, empty);
        return res.json(empty);
      }
      if (r.status === 401 || r.status === 403) {
        // Nøkkel avvist — logg IKKE nøkkelen.
        console.warn("[leadgrid-vehicle] SVV avviste nøkkel (", r.status, ")");
        return res.status(502).json({ error: "vehicle_lookup_auth_failed" });
      }
      if (!r.ok) {
        return res.status(502).json({ error: "vehicle_lookup_upstream", status: r.status });
      }

      const data = await r.json();
      const tech = extractTechnical(data);
      const body = { found: !!(tech.make || tech.fuel_code), ...tech, source: "vegvesen" };
      cacheSet(cacheKey, body);
      return res.json(body);
    } catch (err) {
      console.warn("[leadgrid-vehicle] lookup failed:", (err as Error).message);
      return res.status(502).json({ error: "vehicle_lookup_failed" });
    }
  });
}
