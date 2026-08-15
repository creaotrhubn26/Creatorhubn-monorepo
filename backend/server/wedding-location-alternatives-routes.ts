/**
 * wedding-location-alternatives-routes.ts
 *
 * Plan-B-lokasjons-flyt for værsensitive seremonier (Slice 9X.37).
 *
 * Endpoints:
 *   GET  /api/wedding/:weddingId/locations-with-alternatives
 *        — primary locations med nested alternatives + flag for værsensitive
 *   POST /api/wedding/:weddingId/locations/:primaryId/alternatives
 *        — opprett ny alternativ knyttet til primary
 *   PUT  /api/wedding/:weddingId/locations/:locId/weather-flags
 *        — sett isIndoor + weatherDependent på en location (primary eller alt)
 *   POST /api/wedding/:weddingId/locations/:altId/activate
 *        — aktiver plan B: flytt alle timeline-events fra primary til denne alt,
 *          sett activation_status, logger hvem som aktiverte
 *   POST /api/wedding/:weddingId/locations/:altId/deactivate
 *        — angre plan-B-aktivering: flytt events tilbake til primary
 */

import type express from "express";
import { notifyPlanBActivation, notifyPlanBDeactivation } from "./wedding-notifications-helper";
import { broadcastEventToRoom } from "./websocket-chat";
import { sendPushToUser } from "./web-push-routes";
import { canAccessProject } from "./project-team-routes";

/**
 * Authorize the session user against a wedding before mutating its locations /
 * timeline and pushing plan-B events into its `wedding:<id>` realtime room.
 *
 * Mirrors the round-37 WS room predicate (canAccessWeddingRoom, photographer
 * path): the caller must own the wedding_timelines row (user_id / photographer_id)
 * or have team access to the linked project. Fail closed on any error.
 *
 * Prior to this, the endpoints in this file were unauthorized against the
 * wedding: activate/deactivate/alternatives/weather-flags required only *a*
 * logged-in session (IDOR — mutate another couple's locations/timeline and
 * inject spoofed plan_b events into their room), and the two GETs were fully
 * public (leaking location addresses and notification-recipient PII). All are
 * now gated on this predicate. The couple portal is token-based
 * (/api/wedding/client/:token/…) and never held a session, so it never reached
 * these endpoints; this guard adds no regression.
 */
async function callerOwnsWedding(pool: any, weddingId: string, userId: string): Promise<boolean> {
  if (!userId || !weddingId) return false;
  try {
    const r = await pool.query(
      `SELECT user_id, photographer_id, project_id FROM wedding_timelines WHERE id = $1 OR wedding_id = $1 LIMIT 1`,
      [weddingId],
    );
    const row = r.rows[0];
    if (!row) return false;
    if (row.user_id && String(row.user_id) === userId) return true;
    if (row.photographer_id && String(row.photographer_id) === userId) return true;
    if (row.project_id && (await canAccessProject(pool, userId, String(row.project_id)))) return true;
    return false;
  } catch (e) {
    console.error("[plan-b] callerOwnsWedding error:", e);
    return false;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingLocationAlternativesRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
  getPricingUserId: (req: any) => string;
}

async function ensureSchema(pool: any): Promise<void> {
  // Idempotent — disse blir også applied av migrasjon 0112.
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS alternative_for_location_id UUID`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS is_indoor BOOLEAN`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS weather_dependent BOOLEAN DEFAULT FALSE`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS activation_status TEXT DEFAULT 'standby'`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS activated_by TEXT`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  ).catch(() => undefined);
  await pool.query(
    `ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  ).catch(() => undefined);
  // Crew som er knyttet til en lokasjon (navn + rolle fra crew-katalogen).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS wedding_location_crew (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       location_id UUID NOT NULL REFERENCES wedding_locations(id) ON DELETE CASCADE,
       wedding_id VARCHAR(64) NOT NULL,
       name VARCHAR(255) NOT NULL,
       crew_role VARCHAR(32) DEFAULT 'assistent',
       sort_order INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_location_crew_unique
       ON wedding_location_crew (location_id, name)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wedding_location_crew_wedding
       ON wedding_location_crew (wedding_id)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wedding_location_crew_location
       ON wedding_location_crew (location_id)`,
  ).catch(() => undefined);
  // Check-ins: ett medlem kan være sjekket inn på kun én lokasjon per bryllup
  // (flytting mellom lokasjoner = upsert på (wedding_id, member_name)).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS wedding_location_checkins (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       wedding_id VARCHAR(64) NOT NULL,
       location_id UUID NOT NULL REFERENCES wedding_locations(id) ON DELETE CASCADE,
       member_name VARCHAR(255) NOT NULL,
       member_role VARCHAR(32) DEFAULT 'assistent',
       checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_checkins_member
       ON wedding_location_checkins (wedding_id, member_name)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wedding_checkins_location
       ON wedding_location_checkins (location_id)`,
  ).catch(() => undefined);
  // Live-posisjoner for crew (siste kjente posisjon per medlem).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS wedding_crew_positions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       wedding_id VARCHAR(64) NOT NULL,
       member_name VARCHAR(255) NOT NULL,
       member_role VARCHAR(32) DEFAULT 'assistent',
       lat DOUBLE PRECISION NOT NULL,
       lng DOUBLE PRECISION NOT NULL,
       accuracy_m DOUBLE PRECISION,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_positions_member
       ON wedding_crew_positions (wedding_id, member_name)`,
  ).catch(() => undefined);
}

function rowToLocation(r: any): any {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    label: r.label,
    address: r.address,
    postalCode: r.postal_code,
    city: r.city,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    arrivalTime: r.arrival_time,
    departureTime: r.departure_time,
    notes: r.notes,
    sortOrder: r.sort_order,
    alternativeForLocationId: r.alternative_for_location_id,
    isIndoor: r.is_indoor,
    weatherDependent: !!r.weather_dependent,
    activationStatus: r.activation_status || "standby",
    activatedAt: r.activated_at,
    activatedBy: r.activated_by,
    crew: [],
    checkedIn: false,
    checkedInAt: null,
  };
}

async function loadCrewByLocation(pool: any, weddingId: string): Promise<Map<string, any[]>> {
  const r = await pool.query(
    `SELECT id, location_id, name, crew_role FROM wedding_location_crew
     WHERE wedding_id = $1 ORDER BY sort_order, created_at`,
    [weddingId],
  );
  const byLoc = new Map<string, any[]>();
  for (const row of r.rows) {
    const key = String(row.location_id);
    if (!byLoc.has(key)) byLoc.set(key, []);
    byLoc.get(key)!.push({ id: row.id, name: row.name, crewRole: row.crew_role || "assistent" });
  }
  return byLoc;
}

export function setupWeddingLocationAlternativesRoutes(
  deps: WeddingLocationAlternativesRoutesDeps,
): void {
  const { app, pool, requireUserSession, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/locations-with-alternatives ───
  app.get("/api/wedding/:weddingId/locations-with-alternatives", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      // Authorize the caller against THIS wedding — previously this read was
      // fully public, leaking any couple's location list (addresses, notes).
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const r = await pool.query(
        `SELECT * FROM wedding_locations WHERE wedding_id = $1 ORDER BY sort_order, created_at`,
        [req.params.weddingId],
      );
      const [crewByLoc, checkinsR] = await Promise.all([
        loadCrewByLocation(pool, req.params.weddingId),
        pool.query(
          `SELECT location_id, member_name, member_role, checked_in_at
             FROM wedding_location_checkins
            WHERE wedding_id = $1 AND location_id IN (SELECT id FROM wedding_locations WHERE wedding_id = $1)`,
          [req.params.weddingId],
        ),
      ]);
      const checkedInByLoc = new Map<string, any[]>();
      for (const c of checkinsR.rows) {
        const key = String(c.location_id);
        if (!checkedInByLoc.has(key)) checkedInByLoc.set(key, []);
        checkedInByLoc.get(key)!.push({
          memberName: c.member_name,
          memberRole: c.member_role || "assistent",
          checkedInAt: c.checked_in_at,
        });
      }
      const all = r.rows.map((row: any) => {
        const loc = { ...rowToLocation(row), crew: crewByLoc.get(String(row.id)) || [] };
        const inLoc = checkedInByLoc.get(String(row.id)) || [];
        loc.checkedIn = inLoc.length > 0;
        loc.checkedInAt = inLoc[0]?.checkedInAt ?? null;
        return loc;
      });
      const primaries = all.filter((l: any) => !l.alternativeForLocationId);
      const result = primaries.map((p: any) => ({
        ...p,
        alternatives: all.filter((a: any) => a.alternativeForLocationId === p.id),
      }));
      res.json({ locations: result });
    } catch (err) {
      console.error("GET /locations-with-alternatives:", err);
      res.status(500).json({ error: "Kunne ikke hente lokasjoner" });
    }
  });

  // ─── PUT /api/wedding/:weddingId/locations/:locId ──────────
  // Oppdater adresseinfo på en lokasjon (primary eller alternativ):
  // label, address, postalCode, city, notes. Krever eier/tilgang til bryllupet.
  app.put("/api/wedding/:weddingId/locations/:locId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { weddingId, locId } = req.params;
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const existing = await pool.query(
        `SELECT id FROM wedding_locations WHERE id = $1 AND wedding_id = $2 LIMIT 1`,
        [locId, weddingId],
      );
      if (!existing.rows.length) {
        return res.status(404).json({ error: "Lokasjonen finnes ikke for dette bryllupet" });
      }
      const { label, address, postalCode, city, notes, lat, lng } = req.body || {};
      if (label !== undefined && !String(label).trim()) {
        return res.status(400).json({ error: "label er påkrevd" });
      }
      const upd = await pool.query(
        `UPDATE wedding_locations
         SET label = COALESCE($1, label),
             address = CASE WHEN $2::boolean THEN $3 ELSE address END,
             postal_code = CASE WHEN $4::boolean THEN $5 ELSE postal_code END,
             city = CASE WHEN $6::boolean THEN $7 ELSE city END,
             notes = CASE WHEN $8::boolean THEN $9 ELSE notes END,
             lat = CASE WHEN $10::boolean THEN $11 ELSE lat END,
             lng = CASE WHEN $12::boolean THEN $13 ELSE lng END
         WHERE id = $14 AND wedding_id = $15
         RETURNING *`,
        [
          label !== undefined ? String(label).trim().slice(0, 255) : null,
          address !== undefined,
          address === undefined ? null : (address ?? null),
          postalCode !== undefined,
          postalCode === undefined ? null : (postalCode ?? null),
          city !== undefined,
          city === undefined ? null : (city ?? null),
          notes !== undefined,
          notes === undefined ? null : (notes ?? null),
          lat !== undefined,
          lat === undefined ? null : (typeof lat === "number" && Number.isFinite(lat) ? lat : null),
          lng !== undefined,
          lng === undefined ? null : (typeof lng === "number" && Number.isFinite(lng) ? lng : null),
          locId,
          weddingId,
        ],
      );
      if (!upd.rows.length) return res.status(404).json({ error: "Lokasjonen finnes ikke" });
      res.json({ success: true, location: rowToLocation(upd.rows[0]) });
    } catch (err) {
      console.error("PUT /locations/:locId:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere lokasjonen" });
    }
  });

  // ─── POST /api/wedding/:weddingId/locations/geocode ───
  // Geokoder alle lokasjoner uten koordinater via Kartverket (ws.geonorge.no)
  // og lagrer lat/lng i DB. Idempotent — hopper over lokasjoner som allerede
  // har koordinater. Krever eier/tilgang til bryllupet.
  app.post("/api/wedding/:weddingId/locations/geocode", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { weddingId } = req.params;
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const r = await pool.query(
        `SELECT id, label, address, postal_code, city, lat, lng
           FROM wedding_locations
          WHERE wedding_id = $1 AND lat IS NULL AND lng IS NULL
          ORDER BY sort_order, created_at`,
        [weddingId],
      );
      const missing = r.rows;
      let updated = 0;
      const failed: string[] = [];
      for (const loc of missing) {
        // Adressen i DB kan være én sammenhengende streng
        // («Holmenkollveien 58 0787 Oslo») — ikke legg til duplikat postnr/by.
        const bits: string[] = [];
        const base = String(loc.address || "").trim();
        if (base) {
          bits.push(base);
          const withPost = loc.postal_code ? base.includes(String(loc.postal_code)) : true;
          const withCity = loc.city ? base.toLowerCase().includes(String(loc.city).toLowerCase()) : true;
          if (loc.postal_code && !withPost) bits.push(String(loc.postal_code));
          if (loc.city && !withCity) bits.push(String(loc.city));
        } else {
          if (loc.postal_code) bits.push(String(loc.postal_code));
          if (loc.city) bits.push(String(loc.city));
        }
        const fullAddr = bits.join(", ");
        // Kartverket mislykkes ofte når postnr/by henges på gatenavnet —
        // prøv en fallback-kjede: full adresse → gate alene → by → label.
        // Hvert søk henter 10 treff og filtreres på kommune (unngår feil-pins
        // som «Rådhusplassen 1» i Stavanger når brukeren mente Oslo).
        // Mange rader har kun én sammenhengende adressestreng
        // («Holmenkollveien 58 0787 Oslo») uten postnr/by i egne kolonner —
        // utled dem fra strengen når de mangler, så kommunefilteret virker.
        const postFromStr = (String(loc.address || "").match(/\b\d{4}\b/) || [])[0] || "";
        const textAfterPost = String(loc.address || "").split(postFromStr).pop() || "";
        const cityGuess = String(
          loc.city ||
          (textAfterPost.match(/[a-zA-ZæøåÆØÅ-]+/) || [])[0] ||
          "",
        ).replace(/-+$/, "");
        const cityLower = cityGuess.toLowerCase();
        const accept = (a: any) => {
          const kn = String(a?.kommunenavn || "").toLowerCase();
          const fn = String(a?.fylkesnavn || "").toLowerCase();
          const postMatch = postFromStr && String(a?.postnummer || "") !== "" && String(a?.postnummer) === postFromStr;
          const knMatch = kn !== "" && (kn.includes(cityLower) || cityLower.includes(kn));
          const fnMatch = fn !== "" && (fn.includes(cityLower) || cityLower.includes(fn));
          const cityMatch =
            !cityLower ||
            knMatch ||
            fnMatch ||
            (a?.poststed || "").toLowerCase().includes(cityLower);
          return postMatch || cityMatch;
        };
        const queries: string[] = [fullAddr];
        if (base) queries.push(base);
        if (loc.city) queries.push(String(loc.city));
        if (fullAddr && fullAddr !== loc.label) queries.push(loc.label);
        let hit: any = null;
        for (const q of queries) {
          if (!q) continue;
          try {
            const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(q)}&fuzzy=true&treffPerSide=10`;
            const upstream = await fetch(url, { headers: { Accept: "application/json" } });
            if (!upstream.ok) continue;
            const payload = await upstream.json();
            const hits = Array.isArray(payload?.adresser) ? payload.adresser : [];
            const candidate = hits.find((a: any) => {
              const lat = Number(a?.representasjonspunkt?.lat);
              const lng = Number(a?.representasjonspunkt?.lon);
              return accept(a) && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
            });
            if (candidate) {
              hit = {
                lat: Number(candidate.representasjonspunkt.lat),
                lng: Number(candidate.representasjonspunkt.lon),
                address: `${candidate.adressetekst || ""}, ${candidate.poststed || ""}`.trim(),
                poststed: candidate.poststed || "",
                postnummer: candidate.postnummer || "",
              };
              break;
            }
          } catch (e) {
            console.warn(`[geocode] ${loc.label} query failed:`, e);
          }
        }
        if (!hit) { failed.push(loc.label); continue; }
        // Tilbakefyll postnr/by i egne kolonner hvis de var tomme
        await pool.query(
          `UPDATE wedding_locations
             SET lat = $1, lng = $2,
                 postal_code = COALESCE(postal_code, $4),
                 city = COALESCE(city, $5)
           WHERE id = $3`,
          [hit.lat, hit.lng, loc.id, hit.postnummer || null, hit.poststed || null],
        );
        updated += 1;
      }
      res.json({ success: true, updated, failed, total: missing.length });
    } catch (err) {
      console.error("POST /locations/geocode:", err);
      res.status(500).json({ error: "Kunne ikke geokode lokasjoner" });
    }
  });

  // ─── POST /api/wedding/:weddingId/locations/:primaryId/alternatives ───
  app.post("/api/wedding/:weddingId/locations/:primaryId/alternatives", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { primaryId, weddingId } = req.params;
      // Authorize the caller against THIS wedding before inserting a location.
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const { label, address, postalCode, city, notes, isIndoor } = req.body || {};
      if (!label || !String(label).trim()) {
        return res.status(400).json({ error: "label er påkrevd" });
      }
      // Verifiser at primary tilhører weddingen
      const p = await pool.query(
        `SELECT id FROM wedding_locations WHERE id = $1 AND wedding_id = $2 AND alternative_for_location_id IS NULL`,
        [primaryId, weddingId],
      );
      if (!p.rows.length) {
        return res.status(404).json({ error: "Primary location finnes ikke for dette bryllupet" });
      }
      const ins = await pool.query(
        `INSERT INTO wedding_locations
           (wedding_id, label, address, postal_code, city, notes,
            alternative_for_location_id, is_indoor, weather_dependent,
            activation_status, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, 'standby', 999)
         RETURNING *`,
        [
          weddingId,
          String(label).trim().slice(0, 255),
          address || null,
          postalCode || null,
          city || null,
          notes || null,
          primaryId,
          isIndoor === undefined ? true : Boolean(isIndoor),
        ],
      );
      res.status(201).json({ alternative: rowToLocation(ins.rows[0]) });
    } catch (err) {
      console.error("POST /alternatives:", err);
      res.status(500).json({ error: "Kunne ikke opprette plan B" });
    }
  });

  // ─── PUT /api/wedding/:weddingId/locations/:locId/weather-flags ───
  app.put("/api/wedding/:weddingId/locations/:locId/weather-flags", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      // Authorize the caller against THIS wedding before updating a location.
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const { isIndoor, weatherDependent } = req.body || {};
      const r = await pool.query(
        `UPDATE wedding_locations
           SET is_indoor = COALESCE($1, is_indoor),
               weather_dependent = COALESCE($2, weather_dependent)
           WHERE id = $3 AND wedding_id = $4 RETURNING *`,
        [
          typeof isIndoor === "boolean" ? isIndoor : null,
          typeof weatherDependent === "boolean" ? weatherDependent : null,
          req.params.locId,
          req.params.weddingId,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Location finnes ikke" });
      res.json({ location: rowToLocation(r.rows[0]) });
    } catch (err) {
      console.error("PUT /weather-flags:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere flagg" });
    }
  });

  // ─── POST /api/wedding/:weddingId/locations/:altId/activate ───
  // Plan-B-aktivering: flytt alle wedding_timeline_events.location_id fra
  // primary til denne alternativen. Sett aktivasjons-status.
  app.post("/api/wedding/:weddingId/locations/:altId/activate", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      const { weddingId, altId } = req.params;
      // Authorize the caller against THIS wedding before any mutation/broadcast.
      if (!(await callerOwnsWedding(pool, weddingId, uid))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const triggeredBy = (req.body?.triggeredBy as string) || (uid ? "photographer" : "couple");

      const alt = await pool.query(
        `SELECT * FROM wedding_locations WHERE id = $1 AND wedding_id = $2`,
        [altId, weddingId],
      );
      if (!alt.rows.length) return res.status(404).json({ error: "Alternativ finnes ikke" });
      const altRow = alt.rows[0];
      const primaryId = altRow.alternative_for_location_id;
      if (!primaryId) {
        return res.status(400).json({ error: "Denne lokasjonen er ikke en plan B (mangler alternative_for_location_id)" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // 1. Flytt alle events fra primary til alt
        const evShift = await client.query(
          `UPDATE wedding_timeline_events
             SET location_id = $1, updated_at = NOW()
             WHERE wedding_id = $2 AND location_id = $3
             RETURNING id`,
          [altId, weddingId, primaryId],
        );
        // 2. Sett alt som aktiv
        await client.query(
          `UPDATE wedding_locations
             SET activation_status = 'active', activated_at = NOW(), activated_by = $1, updated_at = NOW()
             WHERE id = $2`,
          [triggeredBy, altId],
        );
        // 3. Markere primary som "stand-down" (har en aktiv plan-B i bruk)
        await client.query(
          `UPDATE wedding_locations
             SET activation_status = 'standby', updated_at = NOW()
             WHERE id = $1`,
          [primaryId],
        );
        // 4. Sørg for at andre alternatives for samme primary er standby
        await client.query(
          `UPDATE wedding_locations
             SET activation_status = 'standby', updated_at = NOW()
             WHERE alternative_for_location_id = $1 AND id <> $2`,
          [primaryId, altId],
        );
        await client.query("COMMIT");

        // Slice 9X.38 — fire-and-forget varsling (ikke blokker response).
        // Failures logges i wedding_notifications, så vi trenger ikke await.
        notifyPlanBActivation(pool, {
          weddingId,
          altId,
          primaryId,
          triggeredBy: triggeredBy === "couple" ? "couple" : "photographer",
        }).catch((err) => console.error("[plan-b] varsling feilet:", err));

        // Slice 9X.39 — real-time push til alle wedding-room-klienter
        broadcastEventToRoom(`wedding:${weddingId}`, {
          type: "plan_b_activated",
          payload: {
            weddingId,
            altId,
            primaryId,
            altLabel: altRow.label,
            altAddress: altRow.address,
            triggeredBy,
            eventsShifted: evShift.rowCount,
          },
          timestamp: new Date().toISOString(),
        });

        // Slice 9X.43 — Web Push til motpartens enheter (app lukket)
        (async () => {
          try {
            const wt = await pool.query(
              `SELECT photographer_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
              [weddingId],
            );
            const photographerId = wt.rows[0]?.photographer_id;
            const pushPayload = {
              title: `🌧️ Plan B aktivert`,
              body: `${triggeredBy === "couple" ? "Brudeparet" : "Fotografen"} flyttet til ${altRow.label}`,
              url: `/photographer/wedding-day/${weddingId}`,
              tag: `plan-b-${weddingId}`,
            };
            // Push til fotograf hvis brudepar trigget, og motsatt
            if (triggeredBy === "couple" && photographerId) {
              await sendPushToUser(pool, photographerId, pushPayload);
            }
            // Brudepar har pseudo-userId 'couple:<token>'. Hent token fra wedding_timelines.
            if (triggeredBy === "photographer") {
              const tokenR = await pool.query(
                `SELECT client_settings->>'accessToken' AS token FROM wedding_timelines WHERE id = $1 LIMIT 1`,
                [weddingId],
              );
              const token = tokenR.rows[0]?.token;
              if (token) {
                await sendPushToUser(pool, `couple:${token}`, pushPayload);
              }
            }
          } catch (err) {
            console.warn("[plan-b] web-push feilet:", err);
          }
        })();

        res.json({
          activated: rowToLocation(altRow),
          eventsShifted: evShift.rowCount,
          triggeredBy,
        });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("POST /activate:", err);
      res.status(500).json({ error: "Kunne ikke aktivere plan B" });
    }
  });

  // ─── POST /api/wedding/:weddingId/locations/:altId/deactivate ───
  app.post("/api/wedding/:weddingId/locations/:altId/deactivate", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { weddingId, altId } = req.params;
      // Authorize the caller against THIS wedding before any mutation/broadcast.
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const alt = await pool.query(
        `SELECT alternative_for_location_id FROM wedding_locations WHERE id = $1 AND wedding_id = $2`,
        [altId, weddingId],
      );
      if (!alt.rows.length) return res.status(404).json({ error: "Alternativ finnes ikke" });
      const primaryId = alt.rows[0].alternative_for_location_id;
      if (!primaryId) return res.status(400).json({ error: "Ikke en plan B" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const evShift = await client.query(
          `UPDATE wedding_timeline_events
             SET location_id = $1, updated_at = NOW()
             WHERE wedding_id = $2 AND location_id = $3
             RETURNING id`,
          [primaryId, weddingId, altId],
        );
        await client.query(
          `UPDATE wedding_locations
             SET activation_status = 'standby', activated_at = NULL, activated_by = NULL, updated_at = NOW()
             WHERE id = $1`,
          [altId],
        );
        await client.query("COMMIT");

        const triggeredBy = (req.body?.triggeredBy as string) || "photographer";
        notifyPlanBDeactivation(pool, {
          weddingId,
          altId,
          primaryId,
          triggeredBy: triggeredBy === "couple" ? "couple" : "photographer",
        }).catch((err) => console.error("[plan-b] deaktiverings-varsling feilet:", err));

        broadcastEventToRoom(`wedding:${weddingId}`, {
          type: "plan_b_deactivated",
          payload: {
            weddingId,
            altId,
            primaryId,
            triggeredBy,
            eventsShiftedBack: evShift.rowCount,
          },
          timestamp: new Date().toISOString(),
        });

        res.json({ eventsShiftedBack: evShift.rowCount });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("POST /deactivate:", err);
      res.status(500).json({ error: "Kunne ikke deaktivere plan B" });
    }
  });

  // ─── GET /api/wedding/:weddingId/notifications ────────────────
  // Logg over varsler sendt for dette bryllupet.
  app.get("/api/wedding/:weddingId/notifications", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      // Authorize the caller against THIS wedding — previously this read was
      // fully public, leaking recipient names / emails / phone numbers (PII).
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const r = await pool.query(
        `SELECT id, notification_type, recipient_type, recipient_name,
                recipient_email, recipient_phone, channel, subject, status,
                provider, error_message, triggered_by, sent_at, created_at
           FROM wedding_notifications
           WHERE wedding_id = $1
           ORDER BY created_at DESC
           LIMIT 100`,
        [req.params.weddingId],
      );
      res.json({
        notifications: r.rows.map((row: any) => ({
          id: row.id,
          notificationType: row.notification_type,
          recipientType: row.recipient_type,
          recipientName: row.recipient_name,
          recipientEmail: row.recipient_email,
          recipientPhone: row.recipient_phone,
          channel: row.channel,
          subject: row.subject,
          status: row.status,
          provider: row.provider,
          errorMessage: row.error_message,
          triggeredBy: row.triggered_by,
          sentAt: row.sent_at,
          createdAt: row.created_at,
        })),
      });
    } catch (err) {
      console.error("GET /notifications:", err);
      res.status(500).json({ error: "Kunne ikke hente varsler" });
    }
  });

  // ─── GET /api/wedding/:weddingId/checkins ───
  // Alle innsjekkinger for bryllupet (crew → lokasjon).
  app.get("/api/wedding/:weddingId/checkins", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const r = await pool.query(
        `SELECT c.location_id, l.label AS location_label, c.member_name, c.member_role, c.checked_in_at
           FROM wedding_location_checkins c
           JOIN wedding_locations l ON l.id = c.location_id
          WHERE c.wedding_id = $1
          ORDER BY c.checked_in_at DESC`,
        [req.params.weddingId],
      );
      res.json({
        checkins: r.rows.map((row: any) => ({
          locationId: row.location_id,
          locationLabel: row.location_label,
          memberName: row.member_name,
          memberRole: row.member_role || "assistent",
          checkedInAt: row.checked_in_at,
        })),
      });
    } catch (err) {
      console.error("GET /checkins:", err);
      res.status(500).json({ error: "Kunne ikke hente innsjekkinger" });
    }
  });

  // ─── POST /api/wedding/:weddingId/checkins ───
  // Sjekk inn et crew-medlem på en lokasjon (upsert — ett sted per medlem).
  // Body: { locationId, memberName, memberRole? }
  app.post("/api/wedding/:weddingId/checkins", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { weddingId } = req.params;
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const { locationId, memberName, memberRole } = req.body || {};
      const name = String(memberName || "").trim();
      if (!name) return res.status(400).json({ error: "memberName er påkrevd" });
      const locR = await pool.query(
        `SELECT id FROM wedding_locations WHERE id = $1 AND wedding_id = $2 LIMIT 1`,
        [String(locationId || ""), weddingId],
      );
      if (!locR.rows.length) return res.status(404).json({ error: "Lokasjonen finnes ikke" });
      await pool.query(
        `INSERT INTO wedding_location_checkins (wedding_id, location_id, member_name, member_role, checked_in_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (wedding_id, member_name)
         DO UPDATE SET location_id = EXCLUDED.location_id,
                       member_role = EXCLUDED.member_role,
                       checked_in_at = NOW()`,
        [weddingId, String(locationId), name.slice(0, 255), String(memberRole || "assistent").slice(0, 32)],
      );
      // Produksjonskartets «Live koordinering» viste en grønn Live-badge, men
      // crew-innsjekk/posisjon oppdaterte seg kun via 15-30s poll — koblet nå
      // inn på samme wedding-room-WS som Plan B-varslene allerede bruker.
      broadcastEventToRoom(`wedding:${weddingId}`, {
        type: "checkin_updated",
        payload: { weddingId, locationId, memberName: name },
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /checkins:", err);
      res.status(500).json({ error: "Kunne ikke lagre innsjekking" });
    }
  });

  // ─── DELETE /api/wedding/:weddingId/checkins ───
  // Angre innsjekking for et medlem. Body: { memberName }
  app.delete("/api/wedding/:weddingId/checkins", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const { memberName } = req.body || {};
      const name = String(memberName || "").trim();
      if (!name) return res.status(400).json({ error: "memberName er påkrevd" });
      await pool.query(
        `DELETE FROM wedding_location_checkins WHERE wedding_id = $1 AND member_name = $2`,
        [req.params.weddingId, name.slice(0, 255)],
      );
      broadcastEventToRoom(`wedding:${req.params.weddingId}`, {
        type: "checkin_updated",
        payload: { weddingId: req.params.weddingId, memberName: name },
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /checkins:", err);
      res.status(500).json({ error: "Kunne ikke angre innsjekking" });
    }
  });

  // ─── GET /api/wedding/:weddingId/positions ───
  // Siste kjente posisjoner for crewet.
  app.get("/api/wedding/:weddingId/positions", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      if (!(await callerOwnsWedding(pool, req.params.weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const r = await pool.query(
        `SELECT member_name, member_role, lat, lng, accuracy_m, updated_at
           FROM wedding_crew_positions
          WHERE wedding_id = $1
          ORDER BY member_name`,
        [req.params.weddingId],
      );
      res.json({
        positions: r.rows.map((row: any) => ({
          memberName: row.member_name,
          memberRole: row.member_role || "assistent",
          lat: Number(row.lat),
          lng: Number(row.lng),
          accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
          updatedAt: row.updated_at,
        })),
      });
    } catch (err) {
      console.error("GET /positions:", err);
      res.status(500).json({ error: "Kunne ikke hente posisjoner" });
    }
  });

  // ─── POST /api/wedding/:weddingId/positions ───
  // Oppdater min posisjon (upsert per medlem). Body:
  // { memberName, memberRole?, lat, lng, accuracyM? }
  app.post("/api/wedding/:weddingId/positions", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { weddingId } = req.params;
      if (!(await callerOwnsWedding(pool, weddingId, getPricingUserId(req)))) {
        return res.status(403).json({ error: "Ingen tilgang til dette bryllupet" });
      }
      const { memberName, memberRole, lat, lng, accuracyM } = req.body || {};
      const name = String(memberName || "").trim();
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (!name) return res.status(400).json({ error: "memberName er påkrevd" });
      if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
        return res.status(400).json({ error: "lat/lng må være tall" });
      }
      await pool.query(
        `INSERT INTO wedding_crew_positions
           (wedding_id, member_name, member_role, lat, lng, accuracy_m, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (wedding_id, member_name)
         DO UPDATE SET lat = EXCLUDED.lat,
                       lng = EXCLUDED.lng,
                       member_role = EXCLUDED.member_role,
                       accuracy_m = EXCLUDED.accuracy_m,
                       updated_at = NOW()`,
        [
          weddingId,
          name.slice(0, 255),
          String(memberRole || "assistent").slice(0, 32),
          numLat,
          numLng,
          Number.isFinite(Number(accuracyM)) ? Number(accuracyM) : null,
        ],
      );
      broadcastEventToRoom(`wedding:${weddingId}`, {
        type: "position_updated",
        payload: { weddingId, memberName: name },
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /positions:", err);
      res.status(500).json({ error: "Kunne ikke lagre posisjon" });
    }
  });

  // ─── DELETE /api/wedding/:weddingId/positions ───
  // Fjern min posisjon (når jeg slutter å dele). Body: { memberName }
  app.delete("/api/wedding/:weddingId/positions", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const { memberName } = req.body || {};
      const name = String(memberName || "").trim();
      if (!name) return res.status(400).json({ error: "memberName er påkrevd" });
      await pool.query(
        `DELETE FROM wedding_crew_positions WHERE wedding_id = $1 AND member_name = $2`,
        [req.params.weddingId, name.slice(0, 255)],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /positions:", err);
      res.status(500).json({ error: "Kunne ikke fjerne posisjon" });
    }
  });
}
