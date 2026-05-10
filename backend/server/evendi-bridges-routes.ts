/**
 * evendi-bridges-routes.ts
 *
 * Setup-funksjon for /api/evendi/* bridge- og delivery-endpoints — kobler
 * Evendi (klient-app for brudepar) med CreatorHub fotograf-systemet på
 * tvers av tradisjoner, foto-shotlist, prosjekt-kontekst, leveranse-
 * tracking osv.
 *
 * 18 endpoints (bridges + delivery):
 *   - GET    /traditions-bridge                                (Evendi tradisjoner → CreatorHub culturalType)
 *   - GET    /photo-shots-bridge                               (couple's photo plan)
 *   - POST   /photo-shots-bridge/push                          (vendor → couple's plan)
 *   - GET    /vendor-project-bridge                            (vendor sees CreatorHub project + timeline)
 *   - GET/POST /timeline-bridge/:timelineId/comments           (kommentarer)
 *   - POST   /timeline-bridge/:timelineId/events               (legg til timeline-event)
 *   - GET    /delivery-project-bridge                          (delivery + project info)
 *   - POST   /delivery-to-showcase-bridge                      (sync delivery → showcase)
 *   - POST   /link-delivery-project                            (koble delivery til project)
 *   - GET    /project-showcase-bridge/:projectId               (project + showcase combo)
 *   - POST   /showcase-create-delivery                         (lag delivery fra showcase)
 *   - POST   /publish-to-website                               (publiser til website)
 *   - GET    /showcase-delivery-status/:showcaseItemId         (status)
 *   - GET    /delivery-access-by-id/:deliveryId                (delivery-detaljer)
 *   - POST   /delivery-track                                   (track event)
 *   - GET    /delivery-tracking/:deliveryId                    (track-historikk)
 *   - POST   /delivery-notify-chat                             (varsle i chat)
 *
 * Inkluderer EVENDI_TO_CREATORHUB_CULTURE-konstant (flyttet med fra
 * index.ts — bare brukt av tradisjons- og resolve-couple-endpoints
 * lokalt).
 *
 * Auth: alle bruker `getVendorFromSession` med tilgangs-sjekk mot
 * `conversations` (vendor ↔ couple).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiBridgesRoutes } from "./evendi-bridges-routes";
 *
 *   setupEvendiBridgesRoutes({
 *     app, pool, getVendorFromSession, broadcastChatEventToUser,
 *   });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { broadcastChatEventToUser } from "./websocket-chat.js";
import { readString } from "./_shared";

interface VendorSession {
  id: string;
  business_name: string;
}

interface SessionLite {
  email: string;
}

export interface EvendiBridgesRoutesDeps {
  app: express.Application;
  pool: Pool;
  getVendorFromSession: (
    req: express.Request,
    res: express.Response,
  ) => Promise<VendorSession | null>;
  getSessionByToken: (token: string) => SessionLite | null;
  normalizeEventType: (value: unknown) => string | null;
}

export function setupEvendiBridgesRoutes(deps: EvendiBridgesRoutesDeps): void {
  const { app, pool, getVendorFromSession, getSessionByToken, normalizeEventType } = deps;

  const EVENDI_TO_CREATORHUB_CULTURE: Record<string, string> = {
    // New synced keys (1:1 mapping)
    norsk: "norsk",
    sikh: "sikh",
    indisk: "indisk",
    pakistansk: "pakistansk",
    tyrkisk: "tyrkisk",
    arabisk: "arabisk",
    somalisk: "somalisk",
    etiopisk: "etiopisk",
    nigeriansk: "nigeriansk",
    muslimsk: "muslimsk",
    libanesisk: "libanesisk",
    filipino: "filipino",
    kinesisk: "kinesisk",
    koreansk: "koreansk",
    thai: "thai",
    iransk: "iransk",
    annet: "annet",
    // Legacy Evendi keys (backward compatibility)
    norway: "norsk",
    hindu: "indisk",
    muslim: "muslimsk",
    jewish: "norsk", // no jødisk in CreatorHub, fallback
    chinese: "kinesisk",
    sweden: "norsk",
    denmark: "norsk",
  };

  // GET /api/evendi/traditions-bridge?coupleId=xxx — get couple's traditions mapped to CreatorHub culturalType
  app.get("/api/evendi/traditions-bridge", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      // Verify vendor has access to this couple via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });
      }

      // Get couple's selected traditions + event type from DB
      const result = await pool.query(
        `
        SELECT id, display_name, wedding_date, selected_traditions, event_type, event_category
        FROM couple_profiles
        WHERE id = $1
      `,
        [coupleId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Parprofil ikke funnet" });
      }

      const profile = result.rows[0];
      const selectedTraditions: string[] = profile.selected_traditions || [];

      // Map all selected traditions to CreatorHub culturalType keys
      const mappedCultures = selectedTraditions.map((t: string) => ({
        evendiKey: t,
        creatorhubKey: EVENDI_TO_CREATORHUB_CULTURE[t] || "annet",
      }));

      // Primary culture = first selected tradition (what drives timeline)
      const primaryCulture =
        mappedCultures.length > 0 ? mappedCultures[0].creatorhubKey : "norsk"; // default

      res.json({
        coupleId: profile.id,
        displayName: profile.display_name,
        weddingDate: profile.wedding_date,
        eventType: profile.event_type || "wedding",
        eventCategory: profile.event_category || "personal",
        selectedTraditions,
        mappedCultures,
        primaryCulturalType: primaryCulture,
        allCulturalTypes: [
          ...new Set(mappedCultures.map((m: any) => m.creatorhubKey)),
        ],
      });
    } catch (error) {
      console.error("Evendi traditions bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente tradisjoner" });
    }
  });

  // ==============================================================
  // PHOTO SHOTS BRIDGE — Fetch couple's photo plan for vendor's shot list
  // ==============================================================
  app.get("/api/evendi/photo-shots-bridge", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      // Verify vendor has access via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });
      }

      // Fetch couple's photo shots from Evendi table
      const result = await pool.query(
        `SELECT id, title, description, category, completed, sort_order, created_at,
                location_name, location_lat, location_lng, location_notes,
                weather_tip, travel_from_venue, image_uri, scouted
         FROM couple_photo_shots
         WHERE couple_id = $1
         ORDER BY sort_order, created_at`,
        [coupleId],
      );

      // Map Evendi categories → CreatorHub scene/shotType
      const CATEGORY_TO_SCENE: Record<string, string> = {
        ceremony: "Ceremony",
        portraits: "Portraits",
        group: "Group Photos",
        details: "Details",
        reception: "Reception",
      };

      const CATEGORY_TO_SHOT_TYPE: Record<string, string> = {
        ceremony: "Wide",
        portraits: "Medium",
        group: "Wide",
        details: "Close-up",
        reception: "Wide",
      };

      const mappedShots = result.rows.map((shot: any) => ({
        id: `evendi-${shot.id}`,
        scene: CATEGORY_TO_SCENE[shot.category] || "Other",
        title: shot.title,
        description: shot.description || "",
        shotType: CATEGORY_TO_SHOT_TYPE[shot.category] || "Wide",
        priority: shot.completed ? "nice_to_have" : "must_have",
        status: shot.completed ? "Completed" : "Planned",
        source: "evendi-couple",
        originalCategory: shot.category,
        sortOrder: shot.sort_order,
        // Location scouting data
        locationName: shot.location_name || null,
        locationLat: shot.location_lat ? parseFloat(shot.location_lat) : null,
        locationLng: shot.location_lng ? parseFloat(shot.location_lng) : null,
        locationNotes: shot.location_notes || null,
        weatherTip: shot.weather_tip || null,
        travelFromVenue: shot.travel_from_venue || null,
        imageUri: shot.image_uri || null,
        scouted: shot.scouted || false,
      }));

      // Get couple info for context
      const coupleResult = await pool.query(
        `SELECT display_name, selected_traditions FROM couple_profiles WHERE id = $1`,
        [coupleId],
      );
      const couple = coupleResult.rows[0] || {};

      res.json({
        coupleId,
        coupleName: couple.display_name || "",
        traditions: couple.selected_traditions || [],
        shots: mappedShots,
        totalShots: mappedShots.length,
        completedShots: mappedShots.filter((s: any) => s.status === "Completed")
          .length,
      });
    } catch (error) {
      console.error("Photo shots bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente parets fotoliste" });
    }
  });

  // ==============================================================
  // PUSH VENDOR SHOTS TO COUPLE — Sync vendor's planned shots back to couple
  // ==============================================================
  app.post("/api/evendi/photo-shots-bridge/push", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId, shots } = req.body;
      if (!coupleId || !Array.isArray(shots)) {
        return res.status(400).json({ error: "coupleId og shots[] er påkrevd" });
      }

      // Verify vendor has access via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });
      }

      // Map CreatorHub shots → Evendi photo_shots format
      const SCENE_TO_CATEGORY: Record<string, string> = {
        Ceremony: "ceremony",
        "Pre-Ceremony": "ceremony",
        "Post-Ceremony": "ceremony",
        Portraits: "portraits",
        "Getting Ready": "portraits",
        "Group Photos": "group",
        "Family Photos": "group",
        Details: "details",
        Reception: "reception",
        "Pre-Wedding": "ceremony",
        "Wedding Day": "ceremony",
      };

      // Clear existing vendor-pushed shots (they have id prefix 'vendor-')
      await pool.query(
        `DELETE FROM couple_photo_shots WHERE couple_id = $1 AND id LIKE 'vendor-%'`,
        [coupleId],
      );

      // Insert vendor shots with location scouting data
      let inserted = 0;
      for (const shot of shots) {
        const category = SCENE_TO_CATEGORY[shot.scene] || "details";
        const id = `vendor-${crypto.randomUUID().slice(0, 8)}`;

        await pool.query(
          `INSERT INTO couple_photo_shots (id, couple_id, title, description, category, completed, sort_order,
           location_name, location_lat, location_lng, location_notes, weather_tip, travel_from_venue, image_uri, scouted,
           created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
          [
            id,
            coupleId,
            `📸 ${shot.title || shot.scene}`,
            shot.description
              ? `Fra fotograf: ${shot.description}`
              : `Planlagt av ${vendor.business_name}`,
            category,
            shot.status === "Completed",
            1000 + inserted, // sort after couple's own shots
            shot.locationName || null,
            shot.locationLat || null,
            shot.locationLng || null,
            shot.locationNotes || null,
            shot.weatherTip || null,
            shot.travelFromVenue || null,
            shot.imageUri || null,
            shot.scouted || false,
          ],
        );
        inserted++;
      }

      res.json({
        success: true,
        message: `${inserted} bilder synkronisert til parets fotoliste`,
        pushedCount: inserted,
      });
    } catch (error) {
      console.error("Push vendor shots error:", error);
      res.status(500).json({ error: "Kunne ikke synkronisere fotolisten" });
    }
  });

  // Lets Evendi vendors see timeline, add comments, manage shots
  // ==============================================================

  // GET /api/evendi/vendor-project-bridge — Vendor sees CreatorHub project + timeline for a couple
  app.get("/api/evendi/vendor-project-bridge", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId)
        return res.status(400).json({ error: "coupleId er påkrevd" });

      // Verify vendor has access to this couple via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length)
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });

      // Get couple email
      const coupleRes = await pool.query(
        "SELECT email, display_name FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      if (!coupleRes.rows.length)
        return res.status(404).json({ error: "Par ikke funnet" });
      const coupleEmail = coupleRes.rows[0].email;
      const coupleName = coupleRes.rows[0].display_name;

      // Find projects linked to this couple's email
      const projectsRes = await pool.query(
        `SELECT id, title, category, status, client_email, metadata, settings, created_at
         FROM legacy.projects
         WHERE LOWER(client_email) = LOWER($1)
         ORDER BY created_at DESC`,
        [coupleEmail],
      );

      // For each project, get timeline + events + comments
      const projects = [];
      for (const proj of projectsRes.rows) {
        const timelineRes = await pool.query(
          `SELECT id, title, wedding_date, venue, couple_name, cultural_type, status,
                  photographer_message, client_notes, client_access_enabled
           FROM wedding_timelines
           WHERE project_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [proj.id],
        );
        const timeline = timelineRes.rows[0] || null;

        let events: any[] = [];
        let comments: any[] = [];
        if (timeline) {
          const eventsRes = await pool.query(
            `SELECT id, title, event_time, duration_minutes, description, location, status, can_client_edit
             FROM wedding_timeline_events
             WHERE timeline_id = $1
             ORDER BY event_time ASC`,
            [timeline.id],
          );
          events = eventsRes.rows;

          const commentsRes = await pool.query(
            `SELECT id, author_type, author_name, message, is_private, created_at
             FROM wedding_timeline_comments
             WHERE timeline_id = $1
             ORDER BY created_at ASC`,
            [timeline.id],
          );
          comments = commentsRes.rows;
        }

        // Get shot list from project metadata
        const shotList = proj.metadata?.shotList || [];
        const memoryCards = proj.metadata?.selectedMemoryCards || [];

        // Get deliveries linked to this project
        const deliveriesRes = await pool.query(
          `SELECT id, title, couple_name, status, access_code, created_at
           FROM deliveries WHERE project_id = $1 AND vendor_id = $2
           ORDER BY created_at DESC`,
          [proj.id, vendor.id],
        );

        // Get showcase items linked to this project
        const showcaseRes = await pool.query(
          `SELECT id, title, category, image_url, is_public, source_type, created_at
           FROM showcase_items WHERE project_id = $1 AND user_id = $2 AND is_active = true
           ORDER BY created_at DESC`,
          [proj.id, vendor.id],
        );

        projects.push({
          id: proj.id,
          title: proj.title,
          category: proj.category,
          status: proj.status,
          createdAt: proj.created_at,
          timeline,
          events,
          comments,
          shotList,
          memoryCards,
          deliveries: deliveriesRes.rows,
          showcaseItems: showcaseRes.rows,
        });
      }

      res.json({
        success: true,
        coupleId,
        coupleName,
        coupleEmail,
        projects,
        conversationId: convCheck.rows[0].id,
      });
    } catch (error) {
      console.error("Vendor project bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente prosjektdata" });
    }
  });

  // GET /api/evendi/timeline-bridge/:timelineId/comments — Get timeline comments
  app.get(
    "/api/evendi/timeline-bridge/:timelineId/comments",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { timelineId } = req.params;

        const result = await pool.query(
          `SELECT id, author_type, author_name, message, is_private, created_at
         FROM wedding_timeline_comments
         WHERE timeline_id = $1
         ORDER BY created_at ASC`,
          [timelineId],
        );

        res.json({ success: true, comments: result.rows });
      } catch (error) {
        console.error("Get timeline comments error:", error);
        res.status(500).json({ error: "Kunne ikke hente kommentarer" });
      }
    },
  );

  // POST /api/evendi/timeline-bridge/:timelineId/comments — Add a comment to the timeline
  app.post(
    "/api/evendi/timeline-bridge/:timelineId/comments",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { timelineId } = req.params;
        const { message, isPrivate } = req.body;

        if (!message || !message.trim()) {
          return res.status(400).json({ error: "Melding er påkrevd" });
        }

        // Verify timeline exists
        const tlCheck = await pool.query(
          "SELECT id FROM wedding_timelines WHERE id = $1",
          [timelineId],
        );
        if (!tlCheck.rows.length)
          return res.status(404).json({ error: "Tidslinje ikke funnet" });

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO wedding_timeline_comments (id, timeline_id, author_type, author_name, message, is_private, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [
            id,
            timelineId,
            "vendor",
            vendor.business_name,
            message.trim(),
            isPrivate || false,
            now,
          ],
        );

        res.json({
          success: true,
          comment: {
            id,
            timeline_id: timelineId,
            author_type: "vendor",
            author_name: vendor.business_name,
            message: message.trim(),
            is_private: isPrivate || false,
            created_at: now,
          },
        });
      } catch (error) {
        console.error("Add timeline comment error:", error);
        res.status(500).json({ error: "Kunne ikke legge til kommentar" });
      }
    },
  );

  // POST /api/evendi/timeline-bridge/:timelineId/events — Vendor adds an event to the timeline
  app.post(
    "/api/evendi/timeline-bridge/:timelineId/events",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { timelineId } = req.params;
        const { title, eventTime, durationMinutes, description, location } =
          req.body;

        if (!title) return res.status(400).json({ error: "Tittel er påkrevd" });

        // Verify timeline exists
        const tlCheck = await pool.query(
          "SELECT id FROM wedding_timelines WHERE id = $1",
          [timelineId],
        );
        if (!tlCheck.rows.length)
          return res.status(404).json({ error: "Tidslinje ikke funnet" });

        const id = crypto.randomUUID();

        await pool.query(
          `INSERT INTO wedding_timeline_events (id, timeline_id, title, event_time, duration_minutes, description, location, status, can_client_edit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', false)`,
          [
            id,
            timelineId,
            title,
            eventTime || null,
            durationMinutes || 30,
            description || "",
            location || "",
          ],
        );

        res.json({
          success: true,
          event: {
            id,
            timeline_id: timelineId,
            title,
            event_time: eventTime,
            duration_minutes: durationMinutes || 30,
            description,
            location,
            status: "planned",
          },
        });
      } catch (error) {
        console.error("Add timeline event error:", error);
        res.status(500).json({ error: "Kunne ikke legge til hendelse" });
      }
    },
  );

  // Links deliveries to projects, timelines, and auto-creates showcase items
  // ==============================================================

  // GET /api/evendi/delivery-project-bridge — Get delivery with linked project/timeline/showcase data
  app.get("/api/evendi/delivery-project-bridge", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId)
        return res.status(400).json({ error: "coupleId er påkrevd" });

      // Verify vendor has access via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length)
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });

      // Get couple info
      const coupleRes = await pool.query(
        "SELECT email, display_name, wedding_date FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      const couple = coupleRes.rows[0] || {};

      // Get project linked to this couple
      const projectRes = await pool.query(
        `SELECT id, title, category, status, metadata, settings, created_at
         FROM legacy.projects
         WHERE LOWER(client_email) = LOWER($1)
         ORDER BY created_at DESC LIMIT 1`,
        [couple.email || ""],
      );
      const project = projectRes.rows[0] || null;

      // Get timeline for project
      let timeline = null;
      let timelineEvents: any[] = [];
      if (project) {
        const tlRes = await pool.query(
          `SELECT id, title, wedding_date, venue, couple_name, cultural_type, status
           FROM wedding_timelines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [project.id],
        );
        timeline = tlRes.rows[0] || null;
        if (timeline) {
          const evRes = await pool.query(
            `SELECT id, title, event_time, duration_minutes, description, location, status
             FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC`,
            [timeline.id],
          );
          timelineEvents = evRes.rows;
        }
      }

      // Get deliveries for this couple/vendor
      const deliveriesRes = await pool.query(
        `SELECT id, couple_name, title, description, status, access_code, wedding_date, project_id, timeline_id, created_at
         FROM deliveries WHERE vendor_id = $1 AND (couple_id = $2 OR LOWER(couple_email) = LOWER($3))
         ORDER BY created_at DESC`,
        [vendor.id, coupleId, couple.email || ""],
      );

      // Get showcase items for this vendor + project
      let showcaseItems: any[] = [];
      if (project) {
        const scRes = await pool.query(
          `SELECT id, title, description, image_url, thumbnail_url, category, is_public, project_id, delivery_id, source_type, created_at
           FROM showcase_items WHERE user_id = $1 AND (project_id = $2 OR delivery_id = ANY($3::varchar[]))
           ORDER BY created_at DESC`,
          [vendor.id, project.id, deliveriesRes.rows.map((d: any) => d.id)],
        );
        showcaseItems = scRes.rows;
      }

      // Get memory card config from project metadata
      const memoryCards = project?.metadata?.selectedMemoryCards || [];
      const memoryCardConfigs = project?.metadata?.memoryCardConfigs || [];

      res.json({
        success: true,
        coupleId,
        coupleName: couple.display_name || "",
        coupleEmail: couple.email || "",
        weddingDate: couple.wedding_date || "",
        project: project
          ? {
              id: project.id,
              title: project.title,
              category: project.category,
              status: project.status,
            }
          : null,
        timeline: timeline ? { ...timeline, events: timelineEvents } : null,
        deliveries: deliveriesRes.rows,
        showcaseItems,
        memoryCards: { cards: memoryCards, configs: memoryCardConfigs },
      });
    } catch (error) {
      console.error("Delivery project bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente bro-data" });
    }
  });

  // POST /api/evendi/delivery-to-showcase-bridge — Auto-create showcase items from delivery items
  app.post(
    "/api/evendi/delivery-to-showcase-bridge",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { deliveryId, projectId, showcaseCategory } = req.body;
        if (!deliveryId)
          return res.status(400).json({ error: "deliveryId er påkrevd" });

        // Verify delivery belongs to vendor
        const delRes = await pool.query(
          "SELECT id, title, couple_name, vendor_id FROM deliveries WHERE id = $1 AND vendor_id = $2",
          [deliveryId, vendor.id],
        );
        if (!delRes.rows.length)
          return res.status(404).json({ error: "Leveranse ikke funnet" });
        const delivery = delRes.rows[0];

        // Resolve vendor.id → users.id (showcase_items has FK to users, not vendors)
        // getVendorFromSession only returns {id, business_name}, so get email from session
        const token = req.headers.authorization?.replace("Bearer ", "");
        const session = token ? getSessionByToken(token) : null;
        const vendorEmail = session?.email || "";
        const userRes = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [vendorEmail],
        );
        if (!userRes.rows.length) {
          return res
            .status(400)
            .json({ error: "Fant ikke bruker for denne vendor-kontoen" });
        }
        const userId = userRes.rows[0].id;

        // Get delivery items (only gallery/video types are showcase-worthy)
        const itemsRes = await pool.query(
          `SELECT id, type, label, url, description FROM delivery_items
         WHERE delivery_id = $1 AND type IN ('gallery', 'video')
         ORDER BY sort_order ASC`,
          [deliveryId],
        );

        if (!itemsRes.rows.length) {
          return res
            .status(400)
            .json({
              error: "Ingen galleri/video-elementer å publisere til showcase",
            });
        }

        const now = new Date().toISOString();
        const created: any[] = [];

        for (const item of itemsRes.rows) {
          const id = crypto.randomUUID();
          const profession =
            item.type === "video" ? "videographer" : "photographer";

          await pool.query(
            `INSERT INTO showcase_items (id, user_id, profession, category, title, description, image_url, thumbnail_url,
           crop_data, is_public, is_active, project_id, delivery_id, source_type, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10, $11, 'delivery', $12::timestamp, $13::timestamp)`,
            [
              id,
              userId,
              profession,
              showcaseCategory || "Bryllup",
              item.label ||
                `${delivery.couple_name} — ${item.type === "video" ? "Video" : "Galleri"}`,
              item.description || `Fra leveranse: ${delivery.title}`,
              item.url,
              item.url,
              JSON.stringify({
                tags: ["bryllup", item.type],
                clientName: delivery.couple_name,
              }),
              projectId || null,
              deliveryId,
              now,
              now,
            ],
          );

          created.push({
            id,
            title: item.label,
            type: item.type,
            sourceType: "delivery",
          });
        }

        console.log(
          `🎨 ${created.length} showcase-elementer opprettet fra leveranse ${deliveryId} av ${vendor.id}`,
        );

        res.json({
          success: true,
          message: `${created.length} elementer publisert til showcase`,
          showcaseItems: created,
        });
      } catch (error) {
        console.error("Delivery to showcase bridge error:", error);
        res.status(500).json({ error: "Kunne ikke publisere til showcase" });
      }
    },
  );

  // POST /api/evendi/link-delivery-project — Link a delivery to a project/timeline/couple
  app.post("/api/evendi/link-delivery-project", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { deliveryId, projectId, timelineId, coupleId } = req.body;
      if (!deliveryId)
        return res.status(400).json({ error: "deliveryId er påkrevd" });

      // Verify delivery belongs to vendor
      const delCheck = await pool.query(
        "SELECT id FROM deliveries WHERE id = $1 AND vendor_id = $2",
        [deliveryId, vendor.id],
      );
      if (!delCheck.rows.length)
        return res.status(404).json({ error: "Leveranse ikke funnet" });

      // Build update
      const updates: string[] = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;

      if (projectId) {
        updates.push(`project_id = $${idx++}`);
        params.push(projectId);
      }
      if (timelineId) {
        updates.push(`timeline_id = $${idx++}`);
        params.push(timelineId);
      }
      if (coupleId) {
        updates.push(`couple_id = $${idx++}`);
        params.push(coupleId);
      }

      if (params.length === 0)
        return res
          .status(400)
          .json({
            error: "Minst én lenke (projectId, timelineId, coupleId) er påkrevd",
          });

      params.push(deliveryId);
      await pool.query(
        `UPDATE deliveries SET ${updates.join(", ")} WHERE id = $${idx}`,
        params,
      );

      // If linking to timeline, add a "Leveranse sendt" event
      if (timelineId) {
        const eventId = crypto.randomUUID();
        await pool
          .query(
            `INSERT INTO wedding_timeline_events (id, timeline_id, title, description, status, can_client_edit)
           VALUES ($1, $2, 'Leveranse sendt', 'Fotograf/videograf har sendt leveranse', 'completed', false)
           ON CONFLICT DO NOTHING`,
            [eventId, timelineId],
          )
          .catch(() => {});
      }

      console.log(
        `🔗 Leveranse ${deliveryId} koblet til prosjekt=${projectId || "-"}, tidslinje=${timelineId || "-"}, par=${coupleId || "-"}`,
      );

      res.json({ success: true, message: "Leveranse koblet til prosjekt" });
    } catch (error) {
      console.error("Link delivery project error:", error);
      res.status(500).json({ error: "Kunne ikke koble leveranse" });
    }
  });

  // GET /api/evendi/project-showcase-bridge/:projectId — Get all showcase + delivery data for a project
  app.get(
    "/api/evendi/project-showcase-bridge/:projectId",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { projectId } = req.params;

        // Get project (user_id is the couple, not the vendor — verify vendor access via deliveries)
        const projRes = await pool.query(
          "SELECT id, title, category, metadata, settings FROM legacy.projects WHERE id = $1",
          [projectId],
        );
        if (!projRes.rows.length)
          return res.status(404).json({ error: "Prosjekt ikke funnet" });
        const project = projRes.rows[0];

        // Resolve vendor → user ID for showcase queries
        const tokenPSB = req.headers.authorization?.replace("Bearer ", "");
        const sessionPSB = tokenPSB ? getSessionByToken(tokenPSB) : null;
        const vendorEmail = sessionPSB?.email || "";
        const userResPSB = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [vendorEmail],
        );
        const userId = userResPSB.rows[0]?.id || vendor.id;

        // Get timeline
        const tlRes = await pool.query(
          `SELECT id, title, wedding_date, venue, couple_name, cultural_type, status
         FROM wedding_timelines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [projectId],
        );
        const timeline = tlRes.rows[0] || null;

        // Get deliveries linked to this project
        const deliveriesRes = await pool.query(
          `SELECT d.id, d.title, d.couple_name, d.status, d.access_code, d.created_at,
                (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = d.id) as item_count
         FROM deliveries d WHERE d.project_id = $1 AND d.vendor_id = $2
         ORDER BY d.created_at DESC`,
          [projectId, vendor.id],
        );

        // Get showcase items linked to this project
        const showcaseRes = await pool.query(
          `SELECT id, title, description, image_url, category, is_public, delivery_id, source_type, created_at
         FROM showcase_items WHERE project_id = $1 AND user_id = $2 AND is_active = true
         ORDER BY created_at DESC`,
          [projectId, userId],
        );

        // Memory card data
        const memoryCards = project.metadata?.selectedMemoryCards || [];
        const memoryCardConfigs = project.metadata?.memoryCardConfigs || [];

        // Project showcase (from project_showcases table)
        const projShowcaseRes = await pool.query(
          "SELECT id, title, status, visibility, settings FROM project_showcases WHERE project_id = $1 LIMIT 1",
          [projectId],
        );

        res.json({
          success: true,
          project: {
            id: project.id,
            title: project.title,
            category: project.category,
          },
          timeline,
          deliveries: deliveriesRes.rows,
          showcaseItems: showcaseRes.rows,
          projectShowcase: projShowcaseRes.rows[0] || null,
          memoryCards: { cards: memoryCards, configs: memoryCardConfigs },
        });
      } catch (error) {
        console.error("Project showcase bridge error:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke hente prosjekt-showcase-data" });
      }
    },
  );

  // ==============================================================

  // POST /api/evendi/showcase-create-delivery — Create an Evendi delivery from showcase item(s)
  // Vendor selects showcase items → creates a new delivery pre-filled with those items
  app.post("/api/evendi/showcase-create-delivery", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const {
        showcaseItemIds,
        coupleId,
        projectId,
        timelineId,
        coupleName,
        coupleEmail,
        weddingDate,
        title,
        description,
        eventType,
      } = req.body;
      if (!showcaseItemIds?.length)
        return res.status(400).json({ error: "Velg minst ett showcase-element" });

      const normalizedEventType = normalizeEventType(eventType);
      if (eventType && !normalizedEventType) {
        return res.status(400).json({ error: "Ugyldig eventType" });
      }

      // Resolve vendor → user ID
      const tokenSCD = req.headers.authorization?.replace("Bearer ", "");
      const sessionSCD = tokenSCD ? getSessionByToken(tokenSCD) : null;
      const vendorEmailSCD = sessionSCD?.email || "";

      // Get the showcase items
      const userResSCD = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [vendorEmailSCD],
      );
      const userId = userResSCD.rows[0]?.id;
      if (!userId)
        return res
          .status(400)
          .json({ error: "Fant ikke bruker for denne vendor-kontoen" });

      const placeholders = showcaseItemIds
        .map((_: string, i: number) => `$${i + 1}`)
        .join(", ");
      const showcaseRes = await pool.query(
        `SELECT id, title, description, image_url, thumbnail_url, category, profession
         FROM showcase_items WHERE id IN (${placeholders}) AND user_id = $${showcaseItemIds.length + 1} AND is_active = true`,
        [...showcaseItemIds, userId],
      );

      if (!showcaseRes.rows.length)
        return res.status(404).json({ error: "Ingen showcase-elementer funnet" });

      // Create delivery in Evendi via deliveries table
      const deliveryId = crypto.randomUUID();
      const accessCode = crypto
        .randomBytes(8)
        .toString("hex")
        .toUpperCase()
        .slice(0, 16);
      const now = new Date().toISOString();

      await pool.query(
        `INSERT INTO deliveries (id, vendor_id, title, description, couple_name, couple_email, wedding_date,
         access_code, status, project_id, timeline_id, couple_id, event_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, 'active', $9, $10, $11, $12, $13::timestamp, $14::timestamp)`,
        [
          deliveryId,
          vendor.id,
          title || `Leveranse fra ${vendor.business_name}`,
          description ||
            `Opprettet fra showcase med ${showcaseRes.rows.length} elementer`,
          coupleName || "Ukjent par",
          coupleEmail || null,
          weddingDate || null,
          accessCode,
          projectId || null,
          timelineId || null,
          coupleId || null,
          normalizedEventType || null,
          now,
          now,
        ],
      );

      // Create delivery items from showcase items
      const deliveryItems: any[] = [];
      for (let i = 0; i < showcaseRes.rows.length; i++) {
        const si = showcaseRes.rows[i];
        const itemId = crypto.randomUUID();
        const itemType = si.profession === "videographer" ? "video" : "gallery";

        await pool.query(
          `INSERT INTO delivery_items (id, delivery_id, type, label, url, description, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamp)`,
          [
            itemId,
            deliveryId,
            itemType,
            si.title,
            si.image_url,
            si.description,
            i + 1,
            now,
          ],
        );

        deliveryItems.push({
          id: itemId,
          type: itemType,
          label: si.title,
          url: si.image_url,
        });
      }

      // If timelineId provided, add a timeline event
      if (timelineId) {
        const eventId = crypto.randomUUID();
        await pool
          .query(
            `INSERT INTO timeline_events (id, timeline_id, title, description, start_time, event_type, status, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::timestamp, $6, $7, true, $8::timestamp, $9::timestamp)`,
            [
              eventId,
              timelineId,
              "📦 Leveranse opprettet fra showcase",
              `Leveranse "${title || "Showcase-leveranse"}" med ${deliveryItems.length} elementer`,
              now,
              "delivery",
              "confirmed",
              now,
              now,
            ],
          )
          .catch(() => {}); // Non-critical
      }

      // Sync access code back to the showcase items
      for (const siId of showcaseItemIds) {
        await pool
          .query(
            "UPDATE showcase_items SET access_code = $1, delivery_id = $2 WHERE id = $3",
            [accessCode, deliveryId, siId],
          )
          .catch(() => {});
      }

      // Sync to project if linked
      if (projectId) {
        await pool
          .query(
            "UPDATE project_creation_with_memory_cards SET delivery_access_code = $1 WHERE project_id = $2",
            [accessCode, projectId],
          )
          .catch(() => {});
      }

      // Auto-send chat notification to couple
      let chatNotified = false;
      let chatConversationId: string | null = null;
      const resolvedCoupleId = coupleId || null;

      if (resolvedCoupleId || coupleEmail) {
        try {
          let targetCoupleId = resolvedCoupleId;
          if (!targetCoupleId && coupleEmail) {
            const cpRes = await pool.query(
              "SELECT id FROM couple_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1",
              [coupleEmail],
            );
            if (cpRes.rows.length) targetCoupleId = cpRes.rows[0].id;
          }
          if (targetCoupleId) {
            // Find or create conversation
            const existsConv = await pool.query(
              "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
              [vendor.id, targetCoupleId],
            );
            if (existsConv.rows.length) {
              chatConversationId = existsConv.rows[0].id;
            } else {
              chatConversationId = crypto.randomUUID();
              await pool.query(
                `INSERT INTO conversations (id, vendor_id, couple_id, status, last_message_at, couple_unread_count, vendor_unread_count, created_at)
                 VALUES ($1, $2, $3, 'active', NOW(), 1, 0, NOW())`,
                [chatConversationId, vendor.id, targetCoupleId],
              );
            }
            // Send message
            const chatBody =
              `📦 Leveransen din er klar!\n\n` +
              `"${title || "Showcase-leveranse"}"\n` +
              `${deliveryItems.length} ${deliveryItems.length === 1 ? "element" : "elementer"} venter på deg.\n\n` +
              `🔑 Tilgangskode: ${accessCode}\n\n` +
              `Åpne Evendi-appen → "Hent leveranse" → Skriv inn koden. 💕`;
            const chatMsgId = crypto.randomUUID();
            await pool.query(
              `INSERT INTO messages (id, conversation_id, sender_type, sender_id, body, created_at)
               VALUES ($1, $2, 'vendor', $3, $4, NOW())`,
              [chatMsgId, chatConversationId, vendor.id, chatBody],
            );
            await pool.query(
              `UPDATE conversations SET last_message_at = NOW(), couple_unread_count = COALESCE(couple_unread_count, 0) + 1
               WHERE id = $1`,
              [chatConversationId],
            );
            await pool.query(
              "UPDATE deliveries SET chat_notified = true WHERE id = $1",
              [deliveryId],
            );
            chatNotified = true;
          }
        } catch (chatErr) {
          console.warn("Auto-chat notification failed (non-critical):", chatErr);
        }
      }

      console.log(
        `📦 Leveranse ${deliveryId} opprettet fra ${showcaseRes.rows.length} showcase-elementer av ${vendor.id} (chat=${chatNotified})`,
      );

      res.json({
        success: true,
        delivery: {
          id: deliveryId,
          accessCode,
          title: title || `Leveranse fra ${vendor.business_name}`,
          eventType: normalizedEventType || null,
          itemCount: deliveryItems.length,
          items: deliveryItems,
        },
        chatNotified,
        chatConversationId,
        message: chatNotified
          ? `Leveranse opprettet med ${deliveryItems.length} elementer. Brudeparet er varslet i chatten. Tilgangskode: ${accessCode}`
          : `Leveranse opprettet med ${deliveryItems.length} elementer. Tilgangskode: ${accessCode}`,
      });
    } catch (error) {
      console.error("Showcase create delivery error:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke opprette leveranse fra showcase" });
    }
  });

  // POST /api/evendi/publish-to-website — Publish showcase item(s) to an external website (e.g. Norwedfilm)
  app.post("/api/evendi/publish-to-website", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const {
        showcaseItemId,
        title,
        slug,
        category,
        description,
        coverImage,
        videoUrl,
        date,
        location,
        featured,
        media, // array of { type, url, thumbnailUrl?, title?, alt?, sortOrder? }
        targetUrl, // the website API endpoint
        apiKey, // the API key for the target website
      } = req.body;

      if (!title || !slug || !category) {
        return res
          .status(400)
          .json({ error: "Mangler påkrevde felter: title, slug, category" });
      }
      if (!targetUrl || !apiKey) {
        return res
          .status(400)
          .json({ error: "Mangler target-konfigurasjon: targetUrl, apiKey" });
      }

      // Build the publish payload matching the Norwedfilm /api/publish schema
      const publishPayload = {
        project: {
          title,
          slug,
          category,
          description: description || null,
          coverImage: coverImage || null,
          videoUrl: videoUrl || null,
          date: date || null,
          location: location || null,
          featured: featured || false,
          published: true,
        },
        media: Array.isArray(media)
          ? media.map((m: any, i: number) => ({
              type: m.type || "image",
              url: m.url,
              thumbnailUrl: m.thumbnailUrl || null,
              title: m.title || null,
              alt: m.alt || null,
              sortOrder: m.sortOrder ?? i,
            }))
          : [],
      };

      // Call the external website's publish endpoint
      const publishResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(publishPayload),
      });

      const publishData = await publishResponse.json();

      if (!publishResponse.ok) {
        console.error("Website publish failed:", publishData);
        return res.status(publishResponse.status).json({
          error: publishData.error || "Publisering til nettside feilet",
        });
      }

      // Optionally mark the showcase item as published
      if (showcaseItemId) {
        try {
          await pool.query(
            `UPDATE showcase_items SET published_to_website = true, website_publish_url = $1, updated_at = NOW() WHERE id = $2 AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER($3) LIMIT 1)`,
            [
              publishData.url ||
                `${targetUrl.replace("/api/publish", "")}/${slug}`,
              showcaseItemId,
              (
                getSessionByToken(
                  req.headers.authorization?.replace("Bearer ", "") || "",
                ) as any
              )?.email,
            ],
          );
        } catch (updateErr) {
          console.warn(
            "Could not update showcase item publish status:",
            updateErr,
          );
        }
      }

      res.json({
        success: true,
        projectId: publishData.projectId,
        projectSlug: publishData.projectSlug,
        url: publishData.url,
        message: `Prosjektet "${title}" er publisert til nettsiden`,
      });
    } catch (error) {
      console.error("Website publish error:", error);
      res.status(500).json({ error: "Kunne ikke publisere til nettside" });
    }
  });

  // GET /api/evendi/showcase-delivery-status/:showcaseItemId — Check if a showcase item has linked deliveries
  app.get(
    "/api/evendi/showcase-delivery-status/:showcaseItemId",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { showcaseItemId } = req.params;

        // Check if this showcase item has been published as a delivery
        const deliveriesRes = await pool.query(
          `SELECT d.id, d.title, d.couple_name, d.access_code, d.status, d.event_type, d.created_at
         FROM deliveries d
         JOIN delivery_items di ON di.delivery_id = d.id
         JOIN showcase_items si ON si.delivery_id = d.id
         WHERE si.id = $1 AND d.vendor_id = $2
         ORDER BY d.created_at DESC`,
          [showcaseItemId, vendor.id],
        );

        // Also check direct delivery_id link on showcase_items
        const directRes = await pool.query(
          `SELECT d.id, d.title, d.couple_name, d.access_code, d.status, d.event_type, d.created_at
         FROM showcase_items si
         JOIN deliveries d ON d.id = si.delivery_id
         WHERE si.id = $1 AND d.vendor_id = $2`,
          [showcaseItemId, vendor.id],
        );

        const allDeliveries = [...deliveriesRes.rows, ...directRes.rows];
        const unique = allDeliveries.filter(
          (d, i, arr) => arr.findIndex((x) => x.id === d.id) === i,
        );

        res.json({
          hasDeliveries: unique.length > 0,
          deliveries: unique,
        });
      } catch (error) {
        console.error("Showcase delivery status error:", error);
        res.status(500).json({ error: "Kunne ikke sjekke leveransestatus" });
      }
    },
  );

  // GET /api/evendi/delivery-access-by-id/:deliveryId — Get delivery by ID (for showcase → delivery access bridge)
  // This allows couples to access delivery directly from showcase without needing an access code
  app.get(
    "/api/evendi/delivery-access-by-id/:deliveryId",
    async (req: any, res: any) => {
      try {
        const { deliveryId } = req.params;

        const delRes = await pool.query(
          `SELECT d.*, v.business_name, v.category_id
         FROM deliveries d
         JOIN vendors v ON v.id = d.vendor_id
         WHERE d.id = $1 AND d.status = 'active'`,
          [deliveryId],
        );

        if (!delRes.rows.length)
          return res.status(404).json({ error: "Leveranse ikke funnet" });
        const delivery = delRes.rows[0];

        const itemsRes = await pool.query(
          `SELECT id, type, label, url, description FROM delivery_items
         WHERE delivery_id = $1 ORDER BY sort_order ASC`,
          [deliveryId],
        );

        res.json({
          delivery: {
            id: delivery.id,
            coupleName: delivery.couple_name,
            title: delivery.title,
            description: delivery.description,
            weddingDate: delivery.wedding_date,
            eventType: delivery.event_type || null,
            accessCode: delivery.access_code,
            items: itemsRes.rows,
          },
          vendor: {
            businessName: delivery.business_name,
            categoryId: delivery.category_id,
          },
        });
      } catch (error) {
        console.error("Delivery access by ID error:", error);
        res.status(500).json({ error: "Kunne ikke hente leveranse" });
      }
    },
  );

  // ==============================================================

  // POST /api/evendi/delivery-track — Track open/download/favorite actions on delivery items
  // Called by both showcase (CreatorHub) and Evendi (DeliveryAccessScreen) when couple interacts
  app.post("/api/evendi/delivery-track", async (req: any, res: any) => {
    try {
      const { deliveryId, deliveryItemId, action, coupleId, accessCode } =
        req.body;
      if (!deliveryId || !action)
        return res.status(400).json({ error: "deliveryId og action er påkrevd" });

      // Valid actions: 'opened', 'downloaded', 'favorited', 'unfavorited', 'shared', 'viewed_item'
      const validActions = [
        "opened",
        "downloaded",
        "favorited",
        "unfavorited",
        "shared",
        "viewed_item",
      ];
      if (!validActions.includes(action))
        return res.status(400).json({ error: "Ugyldig action" });

      // Verify delivery exists
      const delRes = await pool.query(
        "SELECT id, vendor_id, couple_id, access_code FROM deliveries WHERE id = $1",
        [deliveryId],
      );
      if (!delRes.rows.length)
        return res.status(404).json({ error: "Leveranse ikke funnet" });
      const delivery = delRes.rows[0];

      // Verify access — must have valid access code or be the linked couple
      if (accessCode && accessCode !== delivery.access_code) {
        return res.status(403).json({ error: "Ugyldig tilgangskode" });
      }

      const ipAddress = req.headers["x-forwarded-for"] || req.ip || "";
      const userAgent = req.headers["user-agent"] || "";

      // Insert tracking record
      await pool.query(
        `INSERT INTO delivery_tracking (delivery_id, delivery_item_id, couple_id, vendor_id, action, action_detail, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          deliveryId,
          deliveryItemId || null,
          coupleId || delivery.couple_id || null,
          delivery.vendor_id,
          action,
          JSON.stringify({
            accessCode: accessCode || null,
            source: req.body.source || "unknown",
          }),
          ipAddress,
          userAgent,
        ],
      );

      // Update delivery-level counters
      if (action === "opened") {
        await pool.query(
          `UPDATE deliveries SET open_count = COALESCE(open_count, 0) + 1,
           opened_at = COALESCE(opened_at, NOW())
           WHERE id = $1`,
          [deliveryId],
        );
      } else if (action === "downloaded") {
        await pool.query(
          "UPDATE deliveries SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1",
          [deliveryId],
        );
        if (deliveryItemId) {
          await pool.query(
            "UPDATE delivery_items SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1",
            [deliveryItemId],
          );
        }
      } else if (action === "favorited") {
        await pool.query(
          "UPDATE deliveries SET favorite_count = COALESCE(favorite_count, 0) + 1 WHERE id = $1",
          [deliveryId],
        );
        if (deliveryItemId) {
          await pool.query(
            "UPDATE delivery_items SET favorite_count = COALESCE(favorite_count, 0) + 1, favorited_at = NOW() WHERE id = $1",
            [deliveryItemId],
          );
        }
      } else if (action === "unfavorited") {
        await pool.query(
          "UPDATE deliveries SET favorite_count = GREATEST(COALESCE(favorite_count, 0) - 1, 0) WHERE id = $1",
          [deliveryId],
        );
        if (deliveryItemId) {
          await pool.query(
            "UPDATE delivery_items SET favorite_count = GREATEST(COALESCE(favorite_count, 0) - 1, 0), favorited_at = NULL WHERE id = $1",
            [deliveryItemId],
          );
        }
      }

      console.log(
        `📊 Delivery tracking: ${action} on ${deliveryId}${deliveryItemId ? "/" + deliveryItemId : ""}`,
      );
      res.json({ success: true, action });
    } catch (error) {
      console.error("Delivery track error:", error);
      res.status(500).json({ error: "Kunne ikke registrere handling" });
    }
  });

  // GET /api/evendi/delivery-tracking/:deliveryId — Vendor views tracking/confirmation data
  app.get(
    "/api/evendi/delivery-tracking/:deliveryId",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { deliveryId } = req.params;

        // Verify delivery belongs to vendor
        const delRes = await pool.query(
          `SELECT id, title, couple_name, access_code, status, open_count, download_count, favorite_count, opened_at, chat_notified
         FROM deliveries WHERE id = $1 AND vendor_id = $2`,
          [deliveryId, vendor.id],
        );
        if (!delRes.rows.length)
          return res.status(404).json({ error: "Leveranse ikke funnet" });
        const delivery = delRes.rows[0];

        // Get item-level tracking
        const itemsRes = await pool.query(
          `SELECT id, type, label, url, download_count, favorite_count, favorited_at
         FROM delivery_items WHERE delivery_id = $1 ORDER BY sort_order ASC`,
          [deliveryId],
        );

        // Get tracking history (last 50 events)
        const historyRes = await pool.query(
          `SELECT action, delivery_item_id, couple_id, action_detail, created_at
         FROM delivery_tracking WHERE delivery_id = $1
         ORDER BY created_at DESC LIMIT 50`,
          [deliveryId],
        );

        res.json({
          delivery: {
            id: delivery.id,
            title: delivery.title,
            coupleName: delivery.couple_name,
            accessCode: delivery.access_code,
            status: delivery.status,
            openCount: delivery.open_count || 0,
            downloadCount: delivery.download_count || 0,
            favoriteCount: delivery.favorite_count || 0,
            openedAt: delivery.opened_at,
            chatNotified: delivery.chat_notified,
          },
          items: itemsRes.rows.map((item: any) => ({
            id: item.id,
            type: item.type,
            label: item.label,
            downloadCount: item.download_count || 0,
            favoriteCount: item.favorite_count || 0,
            favoritedAt: item.favorited_at,
          })),
          history: historyRes.rows,
        });
      } catch (error) {
        console.error("Delivery tracking fetch error:", error);
        res.status(500).json({ error: "Kunne ikke hente sporingsdata" });
      }
    },
  );

  // POST /api/evendi/delivery-notify-chat — Send chat message to couple that delivery is ready
  // Also syncs the access code across showcase/project if linked
  app.post("/api/evendi/delivery-notify-chat", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { deliveryId, customMessage } = req.body;
      if (!deliveryId)
        return res.status(400).json({ error: "deliveryId er påkrevd" });

      // Get delivery
      const delRes = await pool.query(
        `SELECT id, title, couple_name, couple_id, couple_email, access_code, project_id, chat_notified, vendor_id
         FROM deliveries WHERE id = $1 AND vendor_id = $2`,
        [deliveryId, vendor.id],
      );
      if (!delRes.rows.length)
        return res.status(404).json({ error: "Leveranse ikke funnet" });
      const delivery = delRes.rows[0];

      // Get item count
      const itemCountRes = await pool.query(
        "SELECT COUNT(*) as cnt FROM delivery_items WHERE delivery_id = $1",
        [deliveryId],
      );
      const itemCount = parseInt(itemCountRes.rows[0].cnt);

      // Find or create conversation between vendor and couple
      let conversationId: string | null = null;

      if (delivery.couple_id) {
        // Try to find existing conversation
        const convRes = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, delivery.couple_id],
        );

        if (convRes.rows.length) {
          conversationId = convRes.rows[0].id;
        } else {
          // Create new conversation
          const newConvId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO conversations (id, vendor_id, couple_id, status, last_message_at, couple_unread_count, vendor_unread_count, created_at)
             VALUES ($1, $2, $3, 'active', NOW(), 1, 0, NOW())`,
            [newConvId, vendor.id, delivery.couple_id],
          );
          conversationId = newConvId;
        }
      } else if (delivery.couple_email) {
        // Try to find couple by email → couple_profiles → conversations
        const coupleRes = await pool.query(
          "SELECT id FROM couple_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [delivery.couple_email],
        );
        if (coupleRes.rows.length) {
          const coupleId = coupleRes.rows[0].id;
          const convRes = await pool.query(
            "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
            [vendor.id, coupleId],
          );
          if (convRes.rows.length) {
            conversationId = convRes.rows[0].id;
          } else {
            const newConvId = crypto.randomUUID();
            await pool.query(
              `INSERT INTO conversations (id, vendor_id, couple_id, status, last_message_at, couple_unread_count, vendor_unread_count, created_at)
               VALUES ($1, $2, $3, 'active', NOW(), 1, 0, NOW())`,
              [newConvId, vendor.id, coupleId],
            );
            conversationId = newConvId;
          }
          // Also link couple_id on delivery if not set
          await pool.query(
            "UPDATE deliveries SET couple_id = $1 WHERE id = $2 AND couple_id IS NULL",
            [coupleId, deliveryId],
          );
        }
      }

      // Compose delivery ready message
      const deliveryMessage =
        customMessage ||
        `📦 Leveransen din er klar!\n\n` +
          `"${delivery.title}"\n` +
          `${itemCount} ${itemCount === 1 ? "element" : "elementer"} venter på deg.\n\n` +
          `🔑 Tilgangskode: ${delivery.access_code}\n\n` +
          `Åpne Evendi-appen → "Hent leveranse" → Skriv inn koden for å se og laste ned filene dine. 💕`;

      let messageSent = false;

      if (conversationId) {
        // Send the message
        const msgId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO messages (id, conversation_id, sender_type, sender_id, body, created_at)
           VALUES ($1, $2, 'vendor', $3, $4, NOW())`,
          [msgId, conversationId, vendor.id, deliveryMessage],
        );

        // Update conversation unread count
        await pool.query(
          `UPDATE conversations SET last_message_at = NOW(), couple_unread_count = COALESCE(couple_unread_count, 0) + 1
           WHERE id = $1`,
          [conversationId],
        );

        messageSent = true;
      }

      // Mark delivery as notified
      await pool.query(
        "UPDATE deliveries SET chat_notified = true WHERE id = $1",
        [deliveryId],
      );

      // Sync access code to showcase items linked to this delivery
      await pool.query(
        "UPDATE showcase_items SET access_code = $1 WHERE delivery_id = $2",
        [delivery.access_code, deliveryId],
      );

      // Sync to project_creation_with_memory_cards if project linked
      if (delivery.project_id) {
        await pool
          .query(
            "UPDATE project_creation_with_memory_cards SET delivery_access_code = $1 WHERE project_id = $2",
            [delivery.access_code, delivery.project_id],
          )
          .catch(() => {}); // Non-critical
      }

      console.log(
        `💬 Delivery notification sent for ${deliveryId}: chat=${messageSent}, accessCode=${delivery.access_code}`,
      );

      res.json({
        success: true,
        messageSent,
        conversationId,
        accessCode: delivery.access_code,
        message: messageSent
          ? `Melding sendt til ${delivery.couple_name} i chatten`
          : "Leveransen er merket som varslet, men ingen chat-samtale ble funnet med brudeparet",
      });
    } catch (error) {
      console.error("Delivery notify chat error:", error);
      res.status(500).json({ error: "Kunne ikke sende varsel" });
    }
  });

}
