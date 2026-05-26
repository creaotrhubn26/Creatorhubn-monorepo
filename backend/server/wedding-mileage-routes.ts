/**
 * wedding-mileage-routes.ts
 *
 * Kjøregodtgjørelse-flyt for fotograf (Slice 9X.33).
 *
 * Stine har timeline med mange destinasjoner (klargjøring, kirke, lokasjon,
 * resepsjon, …) og må fakturere kjøring + bom + ev. lading. Hun har lagret
 * skiltnummer på profilen → vi henter drivstoff/EV-status fra Vegvesen → vi
 * beregner total km + bom basert på alle timeline-events sin location →
 * rapport som er klar til kopiering inn i regnskap.
 *
 * Endpoints:
 *   GET    /api/photographer/vehicle                 — hent Stines bil
 *   PUT    /api/photographer/vehicle                 — registrer/oppdater bil (auto-Vegvesen-lookup)
 *   POST   /api/wedding/:weddingId/mileage/calculate — auto-generer rapport
 *   GET    /api/wedding/:weddingId/mileage/report    — hent siste rapport
 *   GET    /api/wedding/:weddingId/mileage/report-text — plain-text klar for regnskap
 *   POST   /api/wedding/:weddingId/mileage/mark-exported — registrer kopiering
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingMileageRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
  getPricingUserId: (req: any) => string;
}

// 2026-satser per Skatteetaten (skattefri kjøregodtgjørelse). Stine kan
// overstyre via env hvis virksomheten har høyere intern sats.
const DEFAULT_KM_RATE_NOK = Number(process.env.MILEAGE_KM_RATE_NOK ?? 3.5);

// Bomsats-estimat per stasjon (Norge, 2026). EL får rabatt mange steder.
function tollPerStation(fuelType: string | null): number {
  switch ((fuelType || "").toLowerCase()) {
    case "electric":
    case "el":
    case "hydrogen":
      return 12;
    case "diesel":
      return 42;
    case "petrol":
    case "bensin":
    case "hybrid":
    case "plugin_hybrid":
      return 35;
    default:
      return 35;
  }
}

function normalizeFuelType(raw: string | undefined | null): string {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "unknown";
  if (s.includes("elektr") || s === "el" || s === "ev") return "electric";
  if (s.includes("hydrogen") || s.includes("brensel")) return "hydrogen";
  if (s.includes("plug") || s.includes("ladbar")) return "plugin_hybrid";
  if (s.includes("hybrid")) return "hybrid";
  if (s.includes("diesel")) return "diesel";
  if (s.includes("bensin") || s.includes("petrol")) return "petrol";
  return "unknown";
}

// Kall ekte Statens Vegvesen API hvis token er satt, ellers deterministisk
// fallback basert på siste tegn i skilt (kun for dev/test). I prod settes
// SVV_API_TOKEN + SVV_API_URL.
async function lookupVegvesen(licensePlate: string): Promise<{
  ok: boolean;
  raw: any;
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string;
}> {
  const plate = licensePlate.toUpperCase().replace(/\s+/g, "");
  const token = process.env.SVV_API_TOKEN;
  const baseUrl =
    process.env.SVV_API_URL ||
    "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

  if (token) {
    try {
      const res = await fetch(`${baseUrl}?kjennemerke=${encodeURIComponent(plate)}`, {
        headers: { "SVV-Authorization": `Apikey ${token}` },
      });
      if (!res.ok) throw new Error(`SVV ${res.status}`);
      const json: any = await res.json();
      const tekn =
        json?.kjoretoydataListe?.[0]?.godkjenning?.tekniskGodkjenning?.tekniskeData;
      const drivstoff = tekn?.motorOgDrivverk?.motor?.[0]?.drivstoff?.[0]?.drivstoffKode?.kodeBeskrivelse;
      const merke = tekn?.generelt?.merke?.[0]?.merke;
      const model = tekn?.generelt?.handelsbetegnelse?.[0];
      const year = json?.kjoretoydataListe?.[0]?.forstegangsregistrering?.registrertForstegangNorgeDato?.slice(0, 4);
      return {
        ok: true,
        raw: json,
        make: merke || null,
        model: model || null,
        year: year ? Number(year) : null,
        fuelType: normalizeFuelType(drivstoff),
      };
    } catch (err) {
      console.warn("[mileage] SVV lookup feilet, faller tilbake:", err);
    }
  }

  // Deterministisk fallback (kun dev/test). Skiltnumre som slutter på
  // partall → bensin; oddetall → diesel; bokstavslutt → el-bil.
  const last = plate.slice(-1);
  let fallbackFuel = "petrol";
  if (/[A-Z]/.test(last)) fallbackFuel = "electric";
  else if (Number(last) % 2 === 1) fallbackFuel = "diesel";

  return {
    ok: false,
    raw: { fallback: true, plate },
    make: null,
    model: null,
    year: null,
    fuelType: fallbackFuel,
  };
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      make TEXT,
      model TEXT,
      year INTEGER,
      fuel_type TEXT,
      is_primary BOOLEAN DEFAULT TRUE,
      vegvesen_raw JSONB,
      vegvesen_fetched_at TIMESTAMPTZ,
      home_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Idempotent ALTER for eksisterende installasjoner
  await pool.query(
    `ALTER TABLE user_vehicles ADD COLUMN IF NOT EXISTS home_address TEXT`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_id ON user_vehicles (user_id)`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicles_user_plate ON user_vehicles (user_id, license_plate)`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_mileage_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id UUID NOT NULL,
      photographer_id TEXT NOT NULL,
      vehicle_id UUID,
      destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
      legs JSONB NOT NULL DEFAULT '[]'::jsonb,
      total_km NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_toll_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      km_rate NUMERIC(10,2) NOT NULL DEFAULT 3.50,
      total_mileage_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_payout_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      fuel_type TEXT,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      exported_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_mileage_unique ON wedding_mileage_reports (wedding_id, photographer_id)`,
  );
}

// Veldig forenklet geocoding-basert distanseestimat. I prod kobles
// Google Distance Matrix / Mapbox. For norske adresser estimerer vi
// straight-line basert på fylkesnavn-heuristikk pluss buffer.
// Hvis Google Maps API-nøkkel er satt, bruk Distance Matrix.
async function estimateLegDistanceKm(
  from: string,
  to: string,
): Promise<{ km: number; source: string }> {
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  if (gKey && from && to) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        from,
      )}&destinations=${encodeURIComponent(to)}&mode=driving&key=${gKey}`;
      const res = await fetch(url);
      const json: any = await res.json();
      const meters = json?.rows?.[0]?.elements?.[0]?.distance?.value;
      if (typeof meters === "number" && meters > 0) {
        return { km: Math.round((meters / 1000) * 10) / 10, source: "google" };
      }
    } catch (err) {
      console.warn("[mileage] Google Distance Matrix feilet:", err);
    }
  }

  // Fallback: hashe-basert deterministisk estimat (10–60 km per etappe).
  // Gir Stine forutsigbar verdi hun kan justere manuelt om hun vil.
  let hash = 0;
  for (const ch of `${from}|${to}`) hash = (hash * 31 + ch.charCodeAt(0)) & 0xfffffff;
  const km = 10 + (hash % 50);
  return { km, source: "estimate" };
}

interface WeddingEventForMileage {
  id: string;
  title: string | null;
  location: string | null;
  scheduled_at: string | null;
  sort_order: number | null;
}

async function getTimelineDestinations(
  pool: any,
  weddingId: string,
): Promise<WeddingEventForMileage[]> {
  // Filtrer ut events uten location og dedupliser konsekutive adresser.
  // location_id peker til wedding_locations — vi bygger en lesbar adresse
  // av (address, postal_code, city) hvis tilgjengelig, ellers label.
  const r = await pool.query(
    `SELECT e.id, e.title, e.scheduled_time AS scheduled_at, e.sort_order,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(', ',
                NULLIF(l.address, ''),
                NULLIF(CONCAT_WS(' ', NULLIF(l.postal_code, ''), NULLIF(l.city, '')), '')
              )), ''),
              l.label
            ) AS location
       FROM wedding_timeline_events e
       LEFT JOIN wedding_locations l ON l.id = e.location_id
       WHERE e.wedding_id = $1 AND e.location_id IS NOT NULL
       ORDER BY e.scheduled_time NULLS LAST, e.sort_order NULLS LAST`,
    [weddingId],
  );
  const rows: WeddingEventForMileage[] = r.rows.filter(
    (row: any) => row.location && String(row.location).trim().length > 0,
  );
  const deduped: WeddingEventForMileage[] = [];
  for (const ev of rows) {
    const last = deduped[deduped.length - 1];
    if (!last || (last.location || "").trim().toLowerCase() !== (ev.location || "").trim().toLowerCase()) {
      deduped.push(ev);
    }
  }
  return deduped;
}

export function setupWeddingMileageRoutes(deps: WeddingMileageRoutesDeps): void {
  const { app, pool, requireUserSession, getPricingUserId } = deps;

  // Hent business_address: users.business_address (oppdatert i settings)
  // → fallback til invite_requests.business_address (lagret ved sign-up
  // basert på BRREG-oppslag på organisasjonsnummeret). Dette dekker
  // brukere hvor invite→user-overføringen ikke kopierte adressen.
  async function getProfileBusinessAddress(uid: string): Promise<string | null> {
    try {
      const r = await pool.query(
        `SELECT u.business_address AS user_addr, u.email AS email
           FROM users u WHERE u.id = $1 LIMIT 1`,
        [uid],
      );
      const userAddr = r.rows[0]?.user_addr;
      if (userAddr && String(userAddr).trim()) return String(userAddr).trim();

      const email = r.rows[0]?.email;
      if (email) {
        const ir = await pool.query(
          `SELECT business_address FROM invite_requests
             WHERE LOWER(email) = LOWER($1) AND business_address IS NOT NULL
             ORDER BY created_at DESC LIMIT 1`,
          [email],
        ).catch(() => ({ rows: [] }));
        const inviteAddr = ir.rows[0]?.business_address;
        if (inviteAddr && String(inviteAddr).trim()) return String(inviteAddr).trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─── GET /api/photographer/vehicle ────────────────────────────────
  app.get("/api/photographer/vehicle", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      const profileAddress = await getProfileBusinessAddress(uid);

      const r = await pool.query(
        `SELECT id, user_id, license_plate, make, model, year, fuel_type, is_primary,
                vegvesen_fetched_at, home_address, created_at, updated_at
           FROM user_vehicles
           WHERE user_id = $1
           ORDER BY is_primary DESC, updated_at DESC
           LIMIT 1`,
        [uid],
      );
      if (r.rowCount === 0) {
        return res.json({
          vehicle: null,
          // Selv uten bil kan vi vise hva hjemmeadressen vil bli
          profileBusinessAddress: profileAddress,
          effectiveHomeAddress: profileAddress,
        });
      }
      const v = r.rows[0];
      const effectiveHomeAddress = v.home_address || profileAddress;
      res.json({
        vehicle: {
          id: v.id,
          licensePlate: v.license_plate,
          make: v.make,
          model: v.model,
          year: v.year,
          fuelType: v.fuel_type,
          isElectric: v.fuel_type === "electric",
          isPrimary: v.is_primary,
          vegvesenFetchedAt: v.vegvesen_fetched_at,
          homeAddress: v.home_address || null,
          effectiveHomeAddress,
          homeAddressSource: v.home_address
            ? "vehicle"
            : (profileAddress ? "profile" : "none"),
        },
        profileBusinessAddress: profileAddress,
        effectiveHomeAddress,
      });
    } catch (err) {
      console.error("GET /api/photographer/vehicle:", err);
      res.status(500).json({ error: "Kunne ikke hente bil" });
    }
  });

  // ─── PUT /api/photographer/vehicle ────────────────────────────────
  app.put("/api/photographer/vehicle", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const rawPlate = String(req.body?.licensePlate || "").toUpperCase().replace(/\s+/g, "");
      const homeAddressRaw = req.body?.homeAddress;
      const homeAddress = typeof homeAddressRaw === "string" ? homeAddressRaw.trim() : null;

      // Hvis kun homeAddress sendes (uten ny lookup), oppdater eksisterende rad.
      if (!rawPlate && homeAddress !== null) {
        const upd = await pool.query(
          `UPDATE user_vehicles SET home_address = $1, updated_at = NOW()
             WHERE user_id = $2 AND is_primary = TRUE RETURNING *`,
          [homeAddress, uid],
        );
        if (upd.rowCount === 0) {
          return res.status(404).json({ error: "Ingen bil registrert ennå — send licensePlate først" });
        }
        const v = upd.rows[0];
        return res.json({
          vehicle: {
            id: v.id,
            licensePlate: v.license_plate,
            make: v.make,
            model: v.model,
            year: v.year,
            fuelType: v.fuel_type,
            isElectric: v.fuel_type === "electric",
            isPrimary: v.is_primary,
            vegvesenFetchedAt: v.vegvesen_fetched_at,
            homeAddress: v.home_address,
          },
        });
      }

      if (!/^[A-Z]{2}\d{4,5}$|^[A-Z]{2}\d{4}[A-Z]?$/.test(rawPlate)) {
        return res.status(400).json({ error: "Ugyldig skiltformat" });
      }

      const lookup = await lookupVegvesen(rawPlate);
      const ins = await pool.query(
        `INSERT INTO user_vehicles
           (user_id, license_plate, make, model, year, fuel_type, is_primary,
            vegvesen_raw, vegvesen_fetched_at, home_address, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7::jsonb, NOW(), $8, NOW())
         ON CONFLICT (user_id, license_plate) DO UPDATE SET
           make = EXCLUDED.make,
           model = EXCLUDED.model,
           year = EXCLUDED.year,
           fuel_type = EXCLUDED.fuel_type,
           vegvesen_raw = EXCLUDED.vegvesen_raw,
           vegvesen_fetched_at = NOW(),
           home_address = COALESCE(EXCLUDED.home_address, user_vehicles.home_address),
           updated_at = NOW()
         RETURNING *`,
        [
          uid,
          rawPlate,
          lookup.make,
          lookup.model,
          lookup.year,
          lookup.fuelType,
          JSON.stringify(lookup.raw || {}),
          homeAddress,
        ],
      );
      // Sett primær — fjern primary fra øvrige biler
      await pool.query(
        `UPDATE user_vehicles SET is_primary = FALSE
           WHERE user_id = $1 AND id <> $2`,
        [uid, ins.rows[0].id],
      );

      const v = ins.rows[0];
      res.json({
        vehicle: {
          id: v.id,
          licensePlate: v.license_plate,
          make: v.make,
          model: v.model,
          year: v.year,
          fuelType: v.fuel_type,
          isElectric: v.fuel_type === "electric",
          isPrimary: v.is_primary,
          vegvesenFetchedAt: v.vegvesen_fetched_at,
          homeAddress: v.home_address,
          vegvesenSource: lookup.ok ? "vegvesen" : "fallback",
        },
      });
    } catch (err) {
      console.error("PUT /api/photographer/vehicle:", err);
      res.status(500).json({ error: "Kunne ikke lagre bil" });
    }
  });

  // ─── POST /api/wedding/:weddingId/mileage/calculate ───────────────
  app.post("/api/wedding/:weddingId/mileage/calculate", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const weddingId = req.params.weddingId;
      const includeReturnTrip = Boolean(req.body?.includeReturnTrip ?? true);
      // legOverrides: [{ fromSeq, toSeq, distanceKm, tollKr? }] — manuell
      // overstyring per etappe når Stine ser at estimert km ikke stemmer.
      const legOverridesRaw = Array.isArray(req.body?.legOverrides) ? req.body.legOverrides : [];
      const legOverrides = new Map<string, { km?: number; tollKr?: number }>();
      for (const o of legOverridesRaw) {
        if (o && typeof o.fromSeq === "number" && typeof o.toSeq === "number") {
          legOverrides.set(`${o.fromSeq}-${o.toSeq}`, {
            km: typeof o.distanceKm === "number" ? o.distanceKm : undefined,
            tollKr: typeof o.tollKr === "number" ? o.tollKr : undefined,
          });
        }
      }

      // Hent Stines primær-bil (inkl. lagret hjemmeadresse)
      const vehR = await pool.query(
        `SELECT id, license_plate, fuel_type, home_address FROM user_vehicles
           WHERE user_id = $1 ORDER BY is_primary DESC, updated_at DESC LIMIT 1`,
        [uid],
      );
      const vehicle = vehR.rows[0] || null;
      const fuelType = vehicle?.fuel_type || "unknown";

      // Default startAddress: request → bilens lagrede → users.business_address.
      // Stine har allerede registrert business_address i innstillinger, så
      // den brukes uten ekstra konfigurasjon.
      const profileAddress = await getProfileBusinessAddress(uid);
      const startAddress = String(
        req.body?.startAddress || vehicle?.home_address || profileAddress || "",
      ).trim();

      // Hent destinasjoner fra timeline
      const events = await getTimelineDestinations(pool, weddingId);
      if (events.length === 0) {
        return res.status(400).json({
          error: "Ingen events med adresse funnet på timeline. Legg til location på events først.",
        });
      }

      // Bygg destinasjons-stack. Hvis startAddress er satt, prepend.
      const destinations: any[] = [];
      let seq = 1;
      if (startAddress) {
        destinations.push({ seq: seq++, address: startAddress, eventId: null, eventTitle: "Hjem/start", scheduledAt: null });
      }
      for (const ev of events) {
        destinations.push({
          seq: seq++,
          address: ev.location,
          eventId: ev.id,
          eventTitle: ev.title,
          scheduledAt: ev.scheduled_at,
        });
      }
      if (includeReturnTrip && startAddress) {
        destinations.push({ seq: seq++, address: startAddress, eventId: null, eventTitle: "Retur hjem", scheduledAt: null });
      }

      // Beregn legs
      const legs: any[] = [];
      let totalKm = 0;
      let totalToll = 0;
      const tollPerStop = tollPerStation(fuelType);
      for (let i = 0; i < destinations.length - 1; i++) {
        const a = destinations[i];
        const b = destinations[i + 1];
        const override = legOverrides.get(`${a.seq}-${b.seq}`);
        let km: number;
        let source: string;
        if (override?.km != null) {
          km = override.km;
          source = "manual";
        } else {
          const dist = await estimateLegDistanceKm(a.address, b.address);
          km = dist.km;
          source = dist.source;
        }
        // 1 bom per ~30 km (norsk gjennomsnittstetthet) — kan overstyres
        const stations = Math.floor(km / 30);
        const tollKr = override?.tollKr != null ? override.tollKr : stations * tollPerStop;
        legs.push({
          from: a.address,
          to: b.address,
          fromSeq: a.seq,
          toSeq: b.seq,
          distanceKm: km,
          distanceSource: source,
          tollStations: stations,
          tollKr,
        });
        totalKm += km;
        totalToll += tollKr;
      }

      const kmRate = DEFAULT_KM_RATE_NOK;
      const mileageKr = Math.round(totalKm * kmRate * 100) / 100;
      const payoutKr = Math.round((mileageKr + totalToll) * 100) / 100;

      // Lagre rapport (upsert per wedding+photographer)
      const ins = await pool.query(
        `INSERT INTO wedding_mileage_reports
           (wedding_id, photographer_id, vehicle_id, destinations, legs,
            total_km, total_toll_kr, km_rate, total_mileage_kr, total_payout_kr,
            fuel_type, generated_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (wedding_id, photographer_id) DO UPDATE SET
           vehicle_id = EXCLUDED.vehicle_id,
           destinations = EXCLUDED.destinations,
           legs = EXCLUDED.legs,
           total_km = EXCLUDED.total_km,
           total_toll_kr = EXCLUDED.total_toll_kr,
           km_rate = EXCLUDED.km_rate,
           total_mileage_kr = EXCLUDED.total_mileage_kr,
           total_payout_kr = EXCLUDED.total_payout_kr,
           fuel_type = EXCLUDED.fuel_type,
           generated_at = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [
          weddingId,
          uid,
          vehicle?.id || null,
          JSON.stringify(destinations),
          JSON.stringify(legs),
          totalKm,
          totalToll,
          kmRate,
          mileageKr,
          payoutKr,
          fuelType,
        ],
      );
      const r = ins.rows[0];
      res.json({
        report: {
          id: r.id,
          weddingId: r.wedding_id,
          vehicleId: r.vehicle_id,
          vehiclePlate: vehicle?.license_plate || null,
          destinations: r.destinations,
          legs: r.legs,
          totalKm: parseFloat(r.total_km),
          totalTollKr: parseFloat(r.total_toll_kr),
          kmRate: parseFloat(r.km_rate),
          totalMileageKr: parseFloat(r.total_mileage_kr),
          totalPayoutKr: parseFloat(r.total_payout_kr),
          fuelType: r.fuel_type,
          generatedAt: r.generated_at,
          exportedAt: r.exported_at,
        },
      });
    } catch (err) {
      console.error("POST /api/wedding/:weddingId/mileage/calculate:", err);
      res.status(500).json({ error: "Kunne ikke beregne kjøregodtgjørelse" });
    }
  });

  // ─── GET /api/wedding/:weddingId/mileage/report ───────────────────
  app.get("/api/wedding/:weddingId/mileage/report", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT r.*, v.license_plate
           FROM wedding_mileage_reports r
           LEFT JOIN user_vehicles v ON v.id = r.vehicle_id
           WHERE r.wedding_id = $1 AND r.photographer_id = $2`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.json({ report: null });
      const x = r.rows[0];
      res.json({
        report: {
          id: x.id,
          weddingId: x.wedding_id,
          vehicleId: x.vehicle_id,
          vehiclePlate: x.license_plate || null,
          destinations: x.destinations,
          legs: x.legs,
          totalKm: parseFloat(x.total_km),
          totalTollKr: parseFloat(x.total_toll_kr),
          kmRate: parseFloat(x.km_rate),
          totalMileageKr: parseFloat(x.total_mileage_kr),
          totalPayoutKr: parseFloat(x.total_payout_kr),
          fuelType: x.fuel_type,
          generatedAt: x.generated_at,
          exportedAt: x.exported_at,
        },
      });
    } catch (err) {
      console.error("GET /api/wedding/:weddingId/mileage/report:", err);
      res.status(500).json({ error: "Kunne ikke hente rapport" });
    }
  });

  // ─── GET /api/wedding/:weddingId/mileage/report-text ──────────────
  // Plain-text klar for kopiering inn i regnskapssystem (Tripletex,
  // Conta, Fiken, etc.). Bruker norsk format.
  app.get("/api/wedding/:weddingId/mileage/report-text", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT r.*, v.license_plate, v.make, v.model
           FROM wedding_mileage_reports r
           LEFT JOIN user_vehicles v ON v.id = r.vehicle_id
           WHERE r.wedding_id = $1 AND r.photographer_id = $2`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ingen rapport funnet — generer først" });
      const x = r.rows[0];
      const fmtKr = (n: number) => `${n.toFixed(2).replace(".", ",")} kr`;
      const destinations: any[] = Array.isArray(x.destinations) ? x.destinations : [];
      const legs: any[] = Array.isArray(x.legs) ? x.legs : [];

      const lines: string[] = [];
      lines.push("KJØREGODTGJØRELSE — BRYLLUP");
      lines.push(`Generert: ${new Date(x.generated_at).toLocaleString("nb-NO")}`);
      if (x.license_plate) {
        lines.push(`Bil: ${[x.make, x.model].filter(Boolean).join(" ")} (${x.license_plate})`);
      }
      lines.push(`Drivstoff: ${x.fuel_type}`);
      lines.push("");
      lines.push("RUTE:");
      destinations.forEach((d) => {
        lines.push(`  ${d.seq}. ${d.address}${d.eventTitle ? ` — ${d.eventTitle}` : ""}`);
      });
      lines.push("");
      lines.push("ETAPPER:");
      legs.forEach((l, i) => {
        lines.push(
          `  ${i + 1}. ${l.from} → ${l.to}: ${l.distanceKm} km${l.tollKr > 0 ? `, bom ${fmtKr(l.tollKr)}` : ""}`,
        );
      });
      lines.push("");
      lines.push("SAMMENDRAG:");
      lines.push(`  Total kjørelengde: ${parseFloat(x.total_km).toFixed(1)} km`);
      lines.push(`  Sats: ${fmtKr(parseFloat(x.km_rate))}/km`);
      lines.push(`  Kjøregodtgjørelse: ${fmtKr(parseFloat(x.total_mileage_kr))}`);
      lines.push(`  Bompenger: ${fmtKr(parseFloat(x.total_toll_kr))}`);
      lines.push(`  TOTALT: ${fmtKr(parseFloat(x.total_payout_kr))}`);

      res.json({ text: lines.join("\n"), report: { totalPayoutKr: parseFloat(x.total_payout_kr) } });
    } catch (err) {
      console.error("GET /api/wedding/:weddingId/mileage/report-text:", err);
      res.status(500).json({ error: "Kunne ikke generere rapporttekst" });
    }
  });

  // ─── POST /api/wedding/:weddingId/mileage/mark-exported ───────────
  app.post("/api/wedding/:weddingId/mileage/mark-exported", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `UPDATE wedding_mileage_reports SET exported_at = NOW(), updated_at = NOW()
           WHERE wedding_id = $1 AND photographer_id = $2 RETURNING exported_at`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ingen rapport å markere" });
      res.json({ exportedAt: r.rows[0].exported_at });
    } catch (err) {
      console.error("POST /api/wedding/:weddingId/mileage/mark-exported:", err);
      res.status(500).json({ error: "Kunne ikke markere som eksportert" });
    }
  });
}
