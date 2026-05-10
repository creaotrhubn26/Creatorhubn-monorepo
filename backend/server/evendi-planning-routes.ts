/**
 * evendi-planning-routes.ts
 *
 * Setup-funksjon for /api/evendi/planning/* endpoints — bryllups-
 * planlegging fra brudeparets perspektiv. Bridger Evendi (klient-app
 * for brudepar) med CreatorHub-fotografens prosjekt-tidslinje.
 *
 * 9 endpoints:
 *   - GET    /planning/project/:projectId/couple                    (resolve couple from project, auto-create if missing)
 *   - GET    /planning/:coupleId                                    (alle planlegging-tabeller + schedule for coupleId)
 *   - GET    /planning/:coupleId/schedule                           (schedule_events liste)
 *   - POST   /planning/:coupleId/schedule                           (legg til schedule-event)
 *   - PUT    /planning/:coupleId/schedule/:eventId                  (oppdater)
 *   - DELETE /planning/:coupleId/schedule/:eventId                  (slett)
 *   - POST   /planning/:coupleId/sync-to-timeline/:projectId        (Evendi → fotograf-tidslinje)
 *   - POST   /planning/:coupleId/sync-from-timeline/:projectId      (fotograf-tidslinje → Evendi, reverse)
 *   - GET    /planning/project/:projectId/status                    (sync-status mellom timeline og Evendi)
 *
 * Auth: åpen — coupleId-parameteren validerer mot couple_profiles via
 * resolveCoupleId. Eksisterende oppførsel bevart.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiPlanningRoutes } from "./evendi-planning-routes";
 *
 *   setupEvendiPlanningRoutes({ app, pool, resolveCoupleId });
 *
 * Mode-noter: Evendi er klient-app-bridge (brudepar-side). Ingen Role
 * Room-modes påvirker disse endpoints. Foto/film-vertikalen i
 * CreatorHub er hovedbruker.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface EvendiPlanningRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveCoupleId: (coupleIdParam: string) => Promise<string | null>;
}

export function setupEvendiPlanningRoutes(
  deps: EvendiPlanningRoutesDeps,
): void {
  const { app, pool, resolveCoupleId } = deps;

  // GET /api/evendi/planning/project/:projectId/couple — resolve couple from project
  app.get("/api/evendi/planning/project/:projectId/couple", async (req, res) => {
    try {
      const { projectId } = req.params;
      // Get project client email from legacy.projects
      const proj = await pool.query(
        "SELECT client_email, name, title FROM legacy.projects WHERE id = $1",
        [projectId],
      );
      if (proj.rowCount === 0)
        return res.status(404).json({ error: "Prosjekt ikke funnet" });

      const {
        client_email,
        name: projectName,
        title: projectTitle,
      } = proj.rows[0];
      if (!client_email)
        return res
          .status(404)
          .json({ error: "Prosjektet har ingen klient-epost" });

      // Find or create couple_profile
      let cp = await pool.query(
        "SELECT id, email, display_name FROM couple_profiles WHERE email = $1",
        [client_email],
      );
      if (cp.rowCount === 0) {
        // Auto-create couple_profile from project client info
        const newId = crypto.randomUUID();
        cp = await pool.query(
          `INSERT INTO couple_profiles (id, email, display_name, password, created_at, updated_at)
           VALUES ($1, $2, $3, 'auto_created', NOW(), NOW()) RETURNING id, email, display_name`,
          [newId, client_email, projectName || projectTitle || "Brudepar"],
        );
      }
      res.json({
        coupleId: cp.rows[0].id,
        email: cp.rows[0].email,
        displayName: cp.rows[0].display_name,
        projectId,
      });
    } catch (error) {
      console.error("Error resolving couple from project:", error);
      res.status(500).json({ error: "Kunne ikke finne brudepar" });
    }
  });

  // GET /api/evendi/planning/:coupleId — get all planning progress for a couple
  app.get("/api/evendi/planning/:coupleId", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
      const planningTables = [
        { table: "couple_venue_timelines", category: "venue", label: "Lokale" },
        { table: "couple_cake_timeline", category: "cake", label: "Kake" },
        {
          table: "couple_catering_timeline",
          category: "catering",
          label: "Catering",
        },
        { table: "couple_dress_timeline", category: "dress", label: "Kjole" },
        {
          table: "couple_flower_timeline",
          category: "flower",
          label: "Blomster",
        },
        {
          table: "couple_hair_makeup_timeline",
          category: "hair_makeup",
          label: "Hår & Makeup",
        },
        {
          table: "couple_transport_timeline",
          category: "transport",
          label: "Transport",
        },
      ];

      const results: any[] = [];
      for (const pt of planningTables) {
        try {
          const r = await pool.query(
            `SELECT * FROM ${pt.table} WHERE couple_id = $1`,
            [coupleId],
          );
          if (r.rowCount && r.rowCount > 0) {
            results.push({
              ...r.rows[0],
              category: pt.category,
              label: pt.label,
            });
          } else {
            results.push({
              couple_id: coupleId,
              category: pt.category,
              label: pt.label,
              status: "not_started",
            });
          }
        } catch {
          /* table may not exist */
        }
      }

      // Also fetch schedule events
      try {
        const schedEvts = await pool.query(
          "SELECT * FROM schedule_events WHERE couple_id = $1 ORDER BY sort_order",
          [coupleId],
        );
        results.push({
          category: "schedule",
          label: "Tidsplan",
          events: schedEvts.rows,
        });
      } catch {
        /* table may not exist */
      }

      res.json({ coupleId, planning: results });
    } catch (error) {
      console.error("Error fetching planning data:", error);
      res.status(500).json({ error: "Kunne ikke hente planleggingsdata" });
    }
  });

  // GET /api/evendi/planning/:coupleId/schedule — get day-of schedule events
  app.get("/api/evendi/planning/:coupleId/schedule", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
      const result = await pool.query(
        "SELECT * FROM schedule_events WHERE couple_id = $1 ORDER BY sort_order ASC",
        [coupleId],
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Kunne ikke hente tidsplan" });
    }
  });

  // POST /api/evendi/planning/:coupleId/schedule — add schedule event
  app.post("/api/evendi/planning/:coupleId/schedule", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
      const { time, title, icon, notes, sortOrder } = req.body;
      const id = crypto.randomUUID();

      const result = await pool.query(
        `INSERT INTO schedule_events (id, couple_id, time, title, icon, notes, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
        [
          id,
          coupleId,
          time || "",
          title || "",
          icon || "📍",
          notes || "",
          sortOrder || 0,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error adding schedule event:", error);
      res.status(500).json({ error: "Kunne ikke legge til hendelse" });
    }
  });

  // PUT /api/evendi/planning/:coupleId/schedule/:eventId — update schedule event
  app.put(
    "/api/evendi/planning/:coupleId/schedule/:eventId",
    async (req, res) => {
      try {
        const { eventId } = req.params;
        const data = req.body;
        const updates: string[] = ["updated_at = NOW()"];
        const params: any[] = [];
        let idx = 1;
        if (data.time !== undefined) {
          updates.push(`time = $${idx++}`);
          params.push(data.time);
        }
        if (data.title !== undefined) {
          updates.push(`title = $${idx++}`);
          params.push(data.title);
        }
        if (data.icon !== undefined) {
          updates.push(`icon = $${idx++}`);
          params.push(data.icon);
        }
        if (data.notes !== undefined) {
          updates.push(`notes = $${idx++}`);
          params.push(data.notes);
        }
        if (data.sortOrder !== undefined) {
          updates.push(`sort_order = $${idx++}`);
          params.push(data.sortOrder);
        }
        params.push(eventId);
        const result = await pool.query(
          `UPDATE schedule_events SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
          params,
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Hendelse ikke funnet" });
        res.json(result.rows[0]);
      } catch (error) {
        console.error("Error updating schedule event:", error);
        res.status(500).json({ error: "Kunne ikke oppdatere hendelse" });
      }
    },
  );

  // DELETE /api/evendi/planning/:coupleId/schedule/:eventId
  app.delete(
    "/api/evendi/planning/:coupleId/schedule/:eventId",
    async (req, res) => {
      try {
        const result = await pool.query(
          "DELETE FROM schedule_events WHERE id = $1 RETURNING id",
          [req.params.eventId],
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Hendelse ikke funnet" });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Kunne ikke slette hendelse" });
      }
    },
  );

  // POST /api/evendi/planning/:coupleId/sync-to-timeline/:projectId
  //   Syncs the couple's Evendi schedule_events → photographer's wedding_timeline_events
  app.post(
    "/api/evendi/planning/:coupleId/sync-to-timeline/:projectId",
    async (req, res) => {
      try {
        const coupleId =
          (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
        const { projectId } = req.params;

        // 1. Get the couple's schedule events
        const schedResult = await pool.query(
          "SELECT * FROM schedule_events WHERE couple_id = $1 ORDER BY sort_order",
          [coupleId],
        );

        // 2. Get or create the photographer's timeline for this project
        let tlResult = await pool.query(
          "SELECT id, wedding_date FROM wedding_timelines WHERE project_id = $1 LIMIT 1",
          [projectId],
        );

        if (tlResult.rowCount === 0) {
          return res.status(404).json({
            error: "Ingen tidslinje funnet. Opprett bryllupstidslinje først.",
            hint: "POST /api/wedding/timeline/project/:projectId",
          });
        }

        const timelineId = tlResult.rows[0].id;
        const weddingDate = tlResult.rows[0].wedding_date
          ? new Date(tlResult.rows[0].wedding_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        // 3. Sync each schedule event into wedding_timeline_events
        let synced = 0;
        for (const evt of schedResult.rows) {
          const eventTime =
            evt.time && evt.time.includes(":")
              ? new Date(`${weddingDate}T${evt.time}:00`)
              : new Date();

          // Check if already synced (by matching title)
          const existing = await pool.query(
            "SELECT id FROM wedding_timeline_events WHERE timeline_id = $1 AND title = $2",
            [timelineId, evt.title],
          );

          if (existing.rowCount === 0) {
            await pool.query(
              `INSERT INTO wedding_timeline_events
              (id, timeline_id, title, event_time, duration_minutes, description, location, status, can_client_edit, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 30, $5, '', 'planned', false, NOW(), NOW())`,
              [
                crypto.randomUUID(),
                timelineId,
                evt.title,
                eventTime,
                evt.notes || "",
              ],
            );
            synced++;
          }
        }

        // 4. Update timeline metadata
        await pool.query(
          `UPDATE wedding_timelines SET
          timeline_data = COALESCE(timeline_data, '{}')::jsonb || $1::jsonb,
          updated_at = NOW()
         WHERE id = $2`,
          [
            JSON.stringify({
              wedflowSyncedAt: new Date().toISOString(),
              wedflowCoupleId: coupleId,
              wedflowScheduleCount: schedResult.rowCount,
            }),
            timelineId,
          ],
        );

        console.log(
          `🔄 Synced ${synced} Evendi schedule events → timeline ${timelineId.substring(0, 8)}`,
        );
        res.json({
          synced,
          total: schedResult.rowCount,
          timelineId,
          message: `${synced} nye hendelser synkronisert fra Evendi`,
        });
      } catch (error) {
        console.error("Error syncing Evendi → timeline:", error);
        res.status(500).json({ error: "Kunne ikke synkronisere" });
      }
    },
  );

  // POST /api/evendi/planning/:coupleId/sync-from-timeline/:projectId
  //   Syncs photographer's timeline events → couple's schedule_events (reverse sync)
  app.post(
    "/api/evendi/planning/:coupleId/sync-from-timeline/:projectId",
    async (req, res) => {
      try {
        const coupleId =
          (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
        const { projectId } = req.params;

        // Get timeline events
        const tlResult = await pool.query(
          "SELECT id FROM wedding_timelines WHERE project_id = $1 LIMIT 1",
          [projectId],
        );
        if (tlResult.rowCount === 0) {
          return res.status(404).json({ error: "Tidslinje ikke funnet" });
        }

        const events = await pool.query(
          "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time",
          [tlResult.rows[0].id],
        );

        let synced = 0;
        let sortOrder = 0;
        for (const evt of events.rows) {
          // Check if already exists
          const existing = await pool.query(
            "SELECT id FROM schedule_events WHERE couple_id = $1 AND title = $2",
            [coupleId, evt.title],
          );

          if (existing.rowCount === 0) {
            const eventTime = evt.event_time
              ? new Date(evt.event_time).toTimeString().substring(0, 5)
              : "";
            await pool.query(
              `INSERT INTO schedule_events (id, couple_id, time, title, icon, notes, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, '📸', $5, $6, NOW(), NOW())`,
              [
                crypto.randomUUID(),
                coupleId,
                eventTime,
                evt.title,
                evt.description || "",
                sortOrder++,
              ],
            );
            synced++;
          }
          sortOrder++;
        }

        console.log(
          `🔄 Synced ${synced} timeline events → Evendi schedule for couple ${coupleId}`,
        );
        res.json({
          synced,
          total: events.rowCount,
          message: `${synced} hendelser synkronisert til Evendi`,
        });
      } catch (error) {
        console.error("Error syncing timeline → Evendi:", error);
        res.status(500).json({ error: "Kunne ikke synkronisere" });
      }
    },
  );

  // GET /api/evendi/planning/project/:projectId/status — check sync status between timeline and Evendi
  app.get("/api/evendi/planning/project/:projectId/status", async (req, res) => {
    try {
      const { projectId } = req.params;

      // Get timeline + metadata
      const tl = await pool.query(
        "SELECT * FROM wedding_timelines WHERE project_id = $1 LIMIT 1",
        [projectId],
      );
      if (tl.rowCount === 0) {
        return res.json({
          connected: false,
          message: "Ingen tidslinje koblet til prosjektet",
        });
      }

      const timeline = tl.rows[0];
      const timelineData = timeline.timeline_data || {};
      const evtCount = await pool.query(
        "SELECT count(*) as c FROM wedding_timeline_events WHERE timeline_id = $1",
        [timeline.id],
      );

      // Check for Evendi schedule events if couple is known
      let wedflowScheduleCount = 0;
      if (timelineData.wedflowCoupleId) {
        const sched = await pool.query(
          "SELECT count(*) as c FROM schedule_events WHERE couple_id = $1",
          [timelineData.wedflowCoupleId],
        );
        wedflowScheduleCount = parseInt(sched.rows[0].c);
      }

      res.json({
        connected: true,
        timelineId: timeline.id,
        projectId,
        coupleName: timeline.couple_name,
        weddingDate: timeline.wedding_date,
        venue: timeline.venue,
        timelineEvents: parseInt(evtCount.rows[0].c),
        wedflowCoupleId: timelineData.wedflowCoupleId || null,
        wedflowScheduleCount,
        lastSyncedAt: timelineData.wedflowSyncedAt || null,
        status: timeline.status,
        clientAccessEnabled: timeline.client_access_enabled || false,
      });
    } catch (error) {
      console.error("Error checking sync status:", error);
      res.status(500).json({ error: "Kunne ikke sjekke synkstatus" });
    }
  });
}
