/**
 * wedding-walkthrough-routes.ts
 *
 * Pre-bryllup walkthrough-sjekkliste (Slice 9X.36).
 *
 * Endpoints:
 *   GET  /api/wedding/:weddingId/walkthrough         — full status
 *   POST /api/wedding/:weddingId/walkthrough/:itemKey — markér manuell sjekk
 *
 * Status-objektet inneholder to lister:
 *   - autoChecks: beregnes on-the-fly fra eksisterende data
 *   - manualChecks: Stine markerer ferdig selv (lagres i wedding_walkthrough_items)
 *
 * Hver sjekk har: key, label, description, status (ok/warn/fail/done/pending),
 * actionLink (relativ URL Stine kan navigere til for å fikse).
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingWalkthroughRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

const MANUAL_ITEMS: Array<{ key: string; label: string; description: string }> = [
  { key: "batteries_charged", label: "Batterier ladet", description: "Alle kamera-, blits- og backup-batterier 100%" },
  { key: "memory_cards_formatted", label: "Minnekort formatert", description: "Alle SD/CF/CFexpress nullstilt og verifisert" },
  { key: "backup_storage_ready", label: "Backup-disk pakket", description: "Ekstern SSD/harddisk i kamerasekken med ledig plass" },
  { key: "equipment_packed", label: "Utstyr pakket", description: "Kameraer, linser, blits, stativ i sekken iht. utstyrsliste på event" },
  { key: "couple_confirmed_timeline", label: "Brudeparet bekreftet timeline", description: "Maria/Anders har sett ferdig timeline og bekreftet" },
  { key: "route_drive_tested", label: "Rute testkjørt", description: "Kjørt rute mellom kjent-ukjente venues (Google Maps gir realistisk trafikk-tid)" },
  { key: "weather_briefed", label: "Værvarsel sjekket og kommunisert", description: "Sjekket yr.no for bryllup-dato, varslet brudeparet ved regn-risiko" },
];

interface CheckResult {
  key: string;
  label: string;
  description?: string;
  status: "ok" | "warn" | "fail" | "done" | "pending" | "na";
  detail?: string;
  actionLink?: string;
  actionLabel?: string;
}

// Slice 9X.37 — Plan-B-status for værsensitive lokasjoner.
// Henter primary-locations som er flagget weather_dependent, sjekker om
// hver har minst én alternativ. Hvis værvarsel er dårlig, hever vi til fail
// hvis noen primær mangler plan B.
async function checkPlanBReadiness(
  pool: any,
  weddingId: string,
  weatherIsWet: boolean,
): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT
        p.id AS primary_id, p.label AS primary_label, p.weather_dependent,
        (SELECT COUNT(*)::int FROM wedding_locations a
           WHERE a.alternative_for_location_id = p.id) AS alt_count
       FROM wedding_locations p
       WHERE p.wedding_id = $1 AND p.alternative_for_location_id IS NULL`,
    [weddingId],
  );
  const weatherSensitive = r.rows.filter((row: any) => row.weather_dependent);
  if (weatherSensitive.length === 0) {
    return {
      key: "plan_b",
      label: "Plan B for værsensitive lokasjoner",
      status: "na",
      detail: "Ingen lokasjoner markert som værsensitive (utendørs seremoni, strand-shoot etc.).",
    };
  }
  const missing = weatherSensitive.filter((row: any) => row.alt_count === 0);
  if (missing.length === 0) {
    return {
      key: "plan_b",
      label: "Plan B klart",
      status: "ok",
      detail: `${weatherSensitive.length} værsensitiv${weatherSensitive.length === 1 ? "" : "e"} lokasjon${weatherSensitive.length === 1 ? "" : "er"} har plan B.`,
    };
  }
  const labels = missing.map((m: any) => m.primary_label).join(", ");
  return {
    key: "plan_b",
    label: "Plan B mangler",
    status: weatherIsWet ? "fail" : "warn",
    detail: weatherIsWet
      ? `Regn ventet, og disse mangler plan B: ${labels}. Brudeparet må legge til en innendørs-alternativ NÅ.`
      : `Disse lokasjonene er værsensitive uten plan B: ${labels}. Ikke kritisk så lenge værvarselet holder.`,
    actionLabel: "Åpne klient-form",
  };
}

async function checkVenuesHaveAddress(pool: any, weddingId: string): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN address IS NOT NULL AND address <> '' THEN 1 ELSE 0 END)::int AS with_addr
       FROM wedding_locations WHERE wedding_id = $1`,
    [weddingId],
  );
  const { total, with_addr } = r.rows[0] || { total: 0, with_addr: 0 };
  if (total === 0) {
    return {
      key: "venues_exist",
      label: "Lokasjoner registrert",
      status: "fail",
      detail: "Ingen lokasjoner registrert ennå. Brudeparet må fylle ut wedding-skjemaet.",
    };
  }
  if (with_addr < total) {
    return {
      key: "venues_exist",
      label: "Lokasjoner har adresse",
      status: "warn",
      detail: `${with_addr} av ${total} lokasjoner har full adresse.`,
    };
  }
  return { key: "venues_exist", label: "Lokasjoner registrert", status: "ok", detail: `${total} lokasjoner med adresse.` };
}

async function checkVenuesInCatalog(pool: any, weddingId: string): Promise<CheckResult> {
  const locs = await pool.query(
    `SELECT label, address FROM wedding_locations WHERE wedding_id = $1`,
    [weddingId],
  );
  if (locs.rowCount === 0) {
    return {
      key: "venues_in_catalog",
      label: "Venue-info kjent",
      status: "na",
      detail: "Ingen lokasjoner å sjekke.",
    };
  }
  let matched = 0;
  let requiresBooking = 0;
  for (const l of locs.rows) {
    const q = (l.label || l.address || "").trim();
    if (!q) continue;
    try {
      const m = await pool.query(
        `SELECT requires_booking FROM photo_venues
           WHERE is_active = TRUE
             AND (LOWER(name) % LOWER($1) OR name ILIKE '%' || $1 || '%')
           ORDER BY similarity(LOWER(name), LOWER($1)) DESC NULLS LAST LIMIT 1`,
        [q],
      );
      if ((m.rowCount ?? 0) > 0) {
        matched++;
        if (m.rows[0].requires_booking) requiresBooking++;
      }
    } catch {
      // pg_trgm mangler — bruker simplere LIKE
      const m = await pool.query(
        `SELECT requires_booking FROM photo_venues
           WHERE is_active = TRUE AND name ILIKE '%' || $1 || '%' LIMIT 1`,
        [q],
      );
      if ((m.rowCount ?? 0) > 0) {
        matched++;
        if (m.rows[0].requires_booking) requiresBooking++;
      }
    }
  }
  if (matched === 0) {
    return {
      key: "venues_in_catalog",
      label: "Venue-info i katalog",
      status: "warn",
      detail: "Ingen av lokasjonene er i Creatorhubn-katalogen. Verifiser åpningstider/regler manuelt.",
    };
  }
  if (requiresBooking > 0) {
    return {
      key: "venues_in_catalog",
      label: "Venue-info i katalog",
      status: "warn",
      detail: `${requiresBooking} venue${requiresBooking === 1 ? "" : "r"} krever booking på forhånd. Sjekk at det er bekreftet.`,
    };
  }
  return {
    key: "venues_in_catalog",
    label: "Venue-info i katalog",
    status: "ok",
    detail: `${matched} av ${locs.rowCount} lokasjoner er i katalogen.`,
  };
}

async function checkTimelineEvents(pool: any, weddingId: string): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN location_id IS NOT NULL THEN 1 ELSE 0 END)::int AS with_loc
       FROM wedding_timeline_events WHERE wedding_id = $1`,
    [weddingId],
  );
  const { total, with_loc } = r.rows[0] || { total: 0, with_loc: 0 };
  if (total === 0) {
    return {
      key: "timeline_events",
      label: "Timeline-events",
      status: "fail",
      detail: "Ingen events på timeline. Bruk 'Foreslå events' med culture-template.",
      actionLabel: "Åpne timeline",
    };
  }
  if (total < 5) {
    return {
      key: "timeline_events",
      label: "Timeline-events",
      status: "warn",
      detail: `Kun ${total} events. Typisk bryllup har 8-15. Sjekk om noe mangler.`,
    };
  }
  if (with_loc < total) {
    return {
      key: "timeline_events",
      label: "Events har lokasjon",
      status: "warn",
      detail: `${with_loc} av ${total} events er knyttet til en lokasjon.`,
    };
  }
  return { key: "timeline_events", label: "Timeline-events", status: "ok", detail: `${total} events alle med lokasjon.` };
}

async function checkVipContacts(pool: any, weddingId: string): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN is_must_capture THEN 1 ELSE 0 END)::int AS vip,
            SUM(CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 ELSE 0 END)::int AS with_phone
       FROM wedding_contacts WHERE wedding_id = $1`,
    [weddingId],
  );
  const { total, vip, with_phone } = r.rows[0] || { total: 0, vip: 0, with_phone: 0 };
  if (total === 0) {
    return {
      key: "vip_contacts",
      label: "Viktige kontakter",
      status: "fail",
      detail: "Ingen VIP-kontakter registrert. Brudeparet må legge til foreldre/forlovere.",
    };
  }
  if (vip === 0) {
    return {
      key: "vip_contacts",
      label: "Viktige kontakter",
      status: "warn",
      detail: `${total} kontakter, men ingen markert som "må-fanges". Marker minst brudens/brudgommens foreldre.`,
    };
  }
  if (with_phone < vip) {
    return {
      key: "vip_contacts",
      label: "VIP har telefon",
      status: "warn",
      detail: `${with_phone} av ${vip} VIP har telefon. Tap-to-call fungerer ikke uten.`,
    };
  }
  return { key: "vip_contacts", label: "VIP-kontakter klare", status: "ok", detail: `${vip} VIP med telefon.` };
}

async function checkMileageReady(pool: any, weddingId: string, photographerId: string): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT id, total_payout_kr FROM wedding_mileage_reports
       WHERE wedding_id = $1 AND photographer_id = $2 LIMIT 1`,
    [weddingId, photographerId],
  );
  if (r.rowCount === 0) {
    return {
      key: "mileage_ready",
      label: "Kjøregodtgjørelse beregnet",
      status: "warn",
      detail: "Ikke beregnet ennå. Gjør det før bryllupet så du har estimat for retur.",
      actionLabel: "Beregn nå",
    };
  }
  const sum = parseFloat(r.rows[0].total_payout_kr);
  return { key: "mileage_ready", label: "Kjøregodtgjørelse klar", status: "ok", detail: `Estimat: ${sum.toFixed(0)} kr` };
}

async function checkVehicleRegistered(pool: any, photographerId: string): Promise<CheckResult> {
  const r = await pool.query(
    `SELECT license_plate, fuel_type FROM user_vehicles
       WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`,
    [photographerId],
  );
  if (r.rowCount === 0) {
    return {
      key: "vehicle_registered",
      label: "Bil registrert",
      status: "fail",
      detail: "Ingen bil registrert. Kreves for kjøregodtgjørelse og bom-estimat.",
      actionLabel: "Registrer skilt",
    };
  }
  return { key: "vehicle_registered", label: "Bil registrert", status: "ok", detail: `${r.rows[0].license_plate}` };
}

// Norske byer → koordinater (samme mapping som /api/.../weather i index.ts).
// Brukes for å hente met.no-varsel for primary wedding-location.
const NORWEGIAN_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  oslo: { lat: 59.9139, lon: 10.7522 },
  bergen: { lat: 60.3913, lon: 5.3221 },
  trondheim: { lat: 63.4305, lon: 10.3951 },
  stavanger: { lat: 58.97, lon: 5.7331 },
  kristiansand: { lat: 58.1599, lon: 8.0182 },
  drammen: { lat: 59.7439, lon: 10.2045 },
  fredrikstad: { lat: 59.2181, lon: 10.9298 },
  "tromsø": { lat: 69.6496, lon: 18.956 },
  tromso: { lat: 69.6496, lon: 18.956 },
  sandnes: { lat: 58.852, lon: 5.7357 },
  sarpsborg: { lat: 59.2839, lon: 11.1097 },
  lørenskog: { lat: 59.9114, lon: 11.0319 },
  lorenskog: { lat: 59.9114, lon: 11.0319 },
};

interface MetForecast {
  symbolCode: string;
  airTemperature: number | null;
  precipitationMm: number | null;
}

async function fetchMetForecastForDate(
  lat: number,
  lon: number,
  isoDate: string,
): Promise<MetForecast | null> {
  try {
    const res = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "CreatorHubNorge/1.0 (https://creatorhub.no; contact@creatorhub.no)",
        },
      },
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    const timeseries: any[] = json?.properties?.timeseries || [];
    // Velg time-entry nærmest 12:00 på bryllup-dato
    let best: any = null;
    let bestDelta = Infinity;
    for (const entry of timeseries) {
      const t: string = entry.time;
      if (!t.startsWith(isoDate)) continue;
      const hour = parseInt(t.split("T")[1].split(":")[0], 10);
      const delta = Math.abs(hour - 12);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = entry;
      }
    }
    if (!best) return null;
    const instant = best.data?.instant?.details || {};
    const next6h = best.data?.next_6_hours;
    return {
      symbolCode: next6h?.summary?.symbol_code || best.data?.next_1_hours?.summary?.symbol_code || "unknown",
      airTemperature: typeof instant.air_temperature === "number" ? instant.air_temperature : null,
      precipitationMm:
        typeof next6h?.details?.precipitation_amount === "number"
          ? next6h.details.precipitation_amount
          : null,
    };
  } catch {
    return null;
  }
}

const SYMBOL_LABELS: Record<string, string> = {
  clearsky_day: "Klart",
  fair_day: "Lettskyet",
  partlycloudy_day: "Delvis skyet",
  cloudy: "Skyet",
  rainshowers_day: "Regnbyger",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  snow: "Snø",
  fog: "Tåke",
  thunderstorm: "Tordenvær",
};

function labelForSymbol(code: string): string {
  if (!code) return "Ukjent";
  const trimmed = code.replace(/_(day|night|polartwilight)$/, "");
  return SYMBOL_LABELS[code] || SYMBOL_LABELS[`${trimmed}_day`] || trimmed.replace(/_/g, " ");
}

async function checkWeatherForecast(pool: any, weddingId: string): Promise<CheckResult> {
  const w = await pool.query(
    `SELECT wedding_date FROM wedding_timelines WHERE id = $1 LIMIT 1`,
    [weddingId],
  );
  const wd = w.rows[0]?.wedding_date;
  if (!wd) return { key: "weather", label: "Værvarsel", status: "na", detail: "Bryllup-dato ikke satt." };
  const weddingDateIso = new Date(wd).toISOString().slice(0, 10);
  const daysAhead = Math.ceil((new Date(weddingDateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysAhead < 0) {
    return { key: "weather", label: "Værvarsel", status: "na", detail: "Bryllupet er allerede gjennomført." };
  }
  if (daysAhead > 9) {
    return {
      key: "weather",
      label: "Værvarsel (yr.no)",
      status: "na",
      detail: `Bryllup om ${daysAhead} dager — yr.no har data først 9 dager før.`,
    };
  }

  // Finn primary location (første registrerte, eller ceremony-koordinater hvis vi har dem)
  const loc = await pool.query(
    `SELECT city, address, label FROM wedding_locations
       WHERE wedding_id = $1 ORDER BY sort_order, created_at LIMIT 1`,
    [weddingId],
  );
  const city = (loc.rows[0]?.city || "").trim().toLowerCase();
  const coords = NORWEGIAN_CITY_COORDS[city] || NORWEGIAN_CITY_COORDS.oslo;
  const fallbackUsed = !NORWEGIAN_CITY_COORDS[city];

  const forecast = await fetchMetForecastForDate(coords.lat, coords.lon, weddingDateIso);
  if (!forecast) {
    return {
      key: "weather",
      label: "Værvarsel (yr.no)",
      status: "warn",
      detail: "Kunne ikke hente fra yr.no. Sjekk manuelt.",
      actionLabel: "Åpne yr.no",
      actionLink: `https://www.yr.no/nb/v%C3%A6rvarsel/dagsvarsel/2-${encodeURIComponent(city || "oslo")}`,
    };
  }

  const symbolLabel = labelForSymbol(forecast.symbolCode);
  const rainRisk = (forecast.precipitationMm ?? 0) >= 0.5;
  const tempStr = forecast.airTemperature != null ? `${Math.round(forecast.airTemperature)}°C` : "—";
  const precipStr = forecast.precipitationMm != null && forecast.precipitationMm > 0
    ? `, ${forecast.precipitationMm.toFixed(1)} mm`
    : "";
  const locDetail = fallbackUsed ? " (Oslo som fallback)" : "";

  return {
    key: "weather",
    label: "Værvarsel (yr.no)",
    status: rainRisk ? "warn" : "ok",
    detail: `${symbolLabel}, ${tempStr}${precipStr}${locDetail}. ${rainRisk ? "Vurder regnplan + brief brudepar." : "Tørt — utendørs-shots er trygge."}`,
    actionLabel: "Åpne yr.no",
    actionLink: `https://www.yr.no/nb/v%C3%A6rvarsel/dagsvarsel/2-${encodeURIComponent(city || "oslo")}`,
  };
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_walkthrough_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id VARCHAR(64) NOT NULL,
      photographer_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'done', 'na')),
      checked_at TIMESTAMPTZ,
      checked_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_walkthrough_unique
       ON wedding_walkthrough_items (wedding_id, photographer_id, item_key)`,
  );
}

export function setupWeddingWalkthroughRoutes(deps: WeddingWalkthroughRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/walkthrough ────────────────────
  app.get("/api/wedding/:weddingId/walkthrough", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const weddingId = req.params.weddingId;

      const [
        venuesAddr,
        venuesCatalog,
        timeline,
        vipContacts,
        vehicle,
        mileage,
        weather,
        manualR,
      ] = await Promise.all([
        checkVenuesHaveAddress(pool, weddingId),
        checkVenuesInCatalog(pool, weddingId),
        checkTimelineEvents(pool, weddingId),
        checkVipContacts(pool, weddingId),
        checkVehicleRegistered(pool, uid),
        checkMileageReady(pool, weddingId, uid),
        checkWeatherForecast(pool, weddingId),
        pool.query(
          `SELECT item_key, status, checked_at, notes
             FROM wedding_walkthrough_items
             WHERE wedding_id = $1 AND photographer_id = $2`,
          [weddingId, uid],
        ),
      ]);

      // Plan-B-sjekken trenger vær-status, derfor seriell etter weather
      const planB = await checkPlanBReadiness(pool, weddingId, weather.status === "warn");

      const autoChecks: CheckResult[] = [
        venuesAddr,
        venuesCatalog,
        timeline,
        vipContacts,
        vehicle,
        mileage,
        weather,
        planB,
      ];

      const manualMap = new Map<string, any>();
      for (const row of manualR.rows) {
        manualMap.set(row.item_key, row);
      }
      const manualChecks: CheckResult[] = MANUAL_ITEMS.map((m) => {
        const found = manualMap.get(m.key);
        const status = (found?.status as any) || "pending";
        return {
          key: m.key,
          label: m.label,
          description: m.description,
          status: status === "done" ? "done" : status === "na" ? "na" : "pending",
          detail: found?.checked_at ? `Markert ${new Date(found.checked_at).toLocaleString("nb-NO")}` : undefined,
        };
      });

      const allChecks = [...autoChecks, ...manualChecks];
      const total = allChecks.length;
      const okCount = allChecks.filter((c) => c.status === "ok" || c.status === "done" || c.status === "na").length;
      const failCount = allChecks.filter((c) => c.status === "fail").length;

      res.json({
        weddingId,
        readyPct: Math.round((okCount / total) * 100),
        criticalIssues: failCount,
        autoChecks,
        manualChecks,
      });
    } catch (err) {
      console.error("GET /walkthrough:", err);
      res.status(500).json({ error: "Kunne ikke generere sjekkliste" });
    }
  });

  // ─── POST /api/wedding/:weddingId/walkthrough/:itemKey ─────────
  app.post("/api/wedding/:weddingId/walkthrough/:itemKey", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const status = String(req.body?.status || "done");
      if (!["pending", "done", "na"].includes(status)) {
        return res.status(400).json({ error: "Ugyldig status" });
      }
      const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 500) : null;
      const r = await pool.query(
        `INSERT INTO wedding_walkthrough_items
           (wedding_id, photographer_id, item_key, status, checked_at, checked_by, notes)
         VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'pending' THEN NULL ELSE NOW() END, $2, $5)
         ON CONFLICT (wedding_id, photographer_id, item_key) DO UPDATE SET
           status = EXCLUDED.status,
           checked_at = CASE WHEN EXCLUDED.status = 'pending' THEN NULL ELSE NOW() END,
           checked_by = EXCLUDED.checked_by,
           notes = COALESCE(EXCLUDED.notes, wedding_walkthrough_items.notes),
           updated_at = NOW()
         RETURNING *`,
        [req.params.weddingId, uid, req.params.itemKey, status, notes],
      );
      res.json({ item: r.rows[0] });
    } catch (err) {
      console.error("POST /walkthrough/:itemKey:", err);
      res.status(500).json({ error: "Kunne ikke lagre sjekk" });
    }
  });
}
