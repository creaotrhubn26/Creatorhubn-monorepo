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

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingLocationAlternativesRoutesDeps {
  app: express.Application;
  pool: any;
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
}

function rowToLocation(r: any): any {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    label: r.label,
    address: r.address,
    postalCode: r.postal_code,
    city: r.city,
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
  };
}

export function setupWeddingLocationAlternativesRoutes(
  deps: WeddingLocationAlternativesRoutesDeps,
): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/locations-with-alternatives ───
  app.get("/api/wedding/:weddingId/locations-with-alternatives", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM wedding_locations WHERE wedding_id = $1 ORDER BY sort_order, created_at`,
        [req.params.weddingId],
      );
      const all = r.rows.map(rowToLocation);
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

  // ─── POST /api/wedding/:weddingId/locations/:primaryId/alternatives ───
  app.post("/api/wedding/:weddingId/locations/:primaryId/alternatives", async (req, res) => {
    try {
      await ensureSchema(pool);
      const { primaryId, weddingId } = req.params;
      const { label, address, postalCode, city, notes, isIndoor } = req.body || {};
      if (!label || !String(label).trim()) {
        return res.status(400).json({ error: "label er påkrevd" });
      }
      // Verifiser at primary tilhører weddingen
      const p = await pool.query(
        `SELECT id FROM wedding_locations WHERE id = $1 AND wedding_id = $2 AND alternative_for_location_id IS NULL`,
        [primaryId, weddingId],
      );
      if (p.rowCount === 0) {
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
    try {
      await ensureSchema(pool);
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
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      const triggeredBy = (req.body?.triggeredBy as string) || (uid ? "photographer" : "couple");
      const { weddingId, altId } = req.params;

      const alt = await pool.query(
        `SELECT * FROM wedding_locations WHERE id = $1 AND wedding_id = $2`,
        [altId, weddingId],
      );
      if (alt.rowCount === 0) return res.status(404).json({ error: "Alternativ finnes ikke" });
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
    try {
      await ensureSchema(pool);
      const { weddingId, altId } = req.params;
      const alt = await pool.query(
        `SELECT alternative_for_location_id FROM wedding_locations WHERE id = $1 AND wedding_id = $2`,
        [altId, weddingId],
      );
      if (alt.rowCount === 0) return res.status(404).json({ error: "Alternativ finnes ikke" });
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
    try {
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
}
