/**
 * evendi-misc-routes.ts
 *
 * Setup-funksjon for resterende /api/evendi/*-endpoints — bundlet i én
 * fil for å fullføre evendi-clusteret. 16 endpoints fordelt på diverse
 * sub-domener: vendor-categories, products, photo-shots, schedule-events,
 * resolve-couple, unified-access-code, checklist seed/list, budget seed/
 * list, speeches, tables, music, reviews, bookings, analytics summary.
 *
 * Etter denne ekstrakten er hele /api/evendi/*-clusteret (~63 endpoints
 * fordelt på 7 moduler) ekstraktert fra index.ts.
 *
 * Auth: blandet — de fleste bruker `getVendorFromSession`, mens bookings
 * og analytics/summary er åpne (userId fra header/query).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiMiscRoutes } from "./evendi-misc-routes";
 *
 *   setupEvendiMiscRoutes({
 *     app, pool, getVendorFromSession,
 *     fetchEvendiVendorCategories, hasTable, getTableColumns,
 *   });
 *
 * NB: `EVENDI_TO_CREATORHUB_CULTURE` flyttes hit fra index.ts (var
 * duplisert under bridges-extracten); resolve-couple bruker den.
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import {
  readBoolean,
  readNumber,
  readOptionalIsoDate,
  readString,
} from "./_shared";

interface VendorSession {
  id: string;
  business_name: string;
}

interface EvendiVendorCategory {
  id?: string;
  name: string;
  sortOrder?: number | null;
  [key: string]: unknown;
}

export interface EvendiMiscRoutesDeps {
  app: express.Application;
  pool: Pool;
  getVendorFromSession: (
    req: express.Request,
    res: express.Response,
  ) => Promise<VendorSession | null>;
  fetchEvendiVendorCategories: (
    eventType?: string,
  ) => Promise<EvendiVendorCategory[]>;
  hasTable: (tableName: string) => Promise<boolean>;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
}

export function setupEvendiMiscRoutes(deps: EvendiMiscRoutesDeps): void {
  const {
    app,
    pool,
    getVendorFromSession,
    fetchEvendiVendorCategories,
    hasTable,
    getTableColumns,
  } = deps;

  // EVENDI_TO_CREATORHUB_CULTURE — brukt av resolve-couple-endpointet under
  // (samme tabell finnes også i ./evendi-bridges-routes.ts; endre begge ved
  // behov, eller flytt resolve-couple senere til en evendi-misc-modul).
  const EVENDI_TO_CREATORHUB_CULTURE: Record<string, string> = {
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
    jewish: "norsk",
    chinese: "kinesisk",
    sweden: "norsk",
    denmark: "norsk",
  };

  app.get("/api/evendi/vendor-categories", async (req, res) => {
    try {
      const eventType =
        typeof req.query.eventType === "string" ? req.query.eventType : undefined;
      const categories = await fetchEvendiVendorCategories(eventType);
      res.json(categories);
    } catch (error) {
      console.error("[EvendiVendorCategories] Error:", error);
      res.status(502).json({ error: "Kunne ikke hente Evendi-kategorier" });
    }
  });

  // GET /api/evendi/products — List vendor's products (for offer line items)
  app.get("/api/evendi/products", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const result = await pool.query(
        `
        SELECT id, vendor_id, title, description, price, currency, is_active, sort_order, created_at
        FROM vendor_products
        WHERE vendor_id = $1 AND is_active = true
        ORDER BY sort_order, created_at
      `,
        [vendor.id],
      );

      res.json({ products: result.rows });
    } catch (error) {
      console.error("Evendi products error:", error);
      res.status(500).json({ error: "Kunne ikke hente produkter" });
    }
  });

  // ============================================================================
  // EVENDI IMPORTANT PEOPLE & WEDDING TIMELINE BRIDGE
  // Vendor can view important people for couples they're connected to

  // GET /api/evendi/photo-shots?coupleId=xxx — list photo shots for a couple
  app.get("/api/evendi/photo-shots", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til dette parets data" });
      }

      // Check if couple_photo_shots table exists and has data
      const result = await pool.query(
        `
        SELECT id, couple_id, title, description, category, completed, sort_order,
               location_name, location_lat, location_lng, location_notes,
               weather_tip, travel_from_venue, image_uri, scouted,
               created_at
        FROM couple_photo_shots
        WHERE couple_id = $1
        ORDER BY sort_order, created_at
      `,
        [coupleId],
      );

      res.json({ shots: result.rows });
    } catch (error) {
      console.error("Evendi photo shots error:", error);
      res.status(500).json({ error: "Kunne ikke hente fotoliste" });
    }
  });

  // GET /api/evendi/schedule-events?coupleId=xxx — list schedule events from couple
  app.get("/api/evendi/schedule-events", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }

      const result = await pool.query(
        `
        SELECT id, couple_id, title, time, icon, notes, sort_order, created_at
        FROM schedule_events
        WHERE couple_id = $1
        ORDER BY time, sort_order
      `,
        [coupleId],
      );

      res.json({ events: result.rows });
    } catch (error) {
      console.error("Evendi schedule events error:", error);
      res.status(500).json({ error: "Kunne ikke hente dagsplan" });
    }
  });

  // ==============================================================
  // RESOLVE COUPLE — Auto-map selectedClient email → Evendi couple profile
  // ==============================================================
  app.get("/api/evendi/resolve-couple", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const email = ((req.query.email as string) || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "email parameter er påkrevd" });
      }

      // Look up couple_profiles by email
      const result = await pool.query(
        `SELECT id, display_name, email, wedding_date, selected_traditions, expected_guests, event_type, event_category
         FROM couple_profiles WHERE LOWER(email) = $1 LIMIT 1`,
        [email],
      );

      if (!result.rows.length) {
        return res
          .status(404)
          .json({ error: "Ingen parprofil funnet for denne e-posten" });
      }

      const profile = result.rows[0];

      // Map traditions to CreatorHub culturalType
      const traditions: string[] = profile.selected_traditions || [];
      const primaryCulturalType =
        traditions.length > 0
          ? EVENDI_TO_CREATORHUB_CULTURE[traditions[0]] || "annet"
          : "norsk";

      res.json({
        coupleId: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        weddingDate: profile.wedding_date,
        eventType: profile.event_type || "wedding",
        eventCategory: profile.event_category || "personal",
        expectedGuests: profile.expected_guests || 0,
        selectedTraditions: traditions,
        primaryCulturalType,
        allCulturalTypes: [
          ...new Set(
            traditions.map(
              (t: string) => EVENDI_TO_CREATORHUB_CULTURE[t] || "annet",
            ),
          ),
        ],
      });
    } catch (error) {
      console.error("Evendi resolve-couple error:", error);
      res.status(500).json({ error: "Kunne ikke finne parprofil" });
    }
  });

  // ==============================================================
  // DELIVERY TRACKING & CONFIRMATION SYSTEM

  // GET /api/evendi/unified-access-code/:accessCode — Look up delivery by access code from any source
  // Works for showcase, Evendi, or project-memory-cards — unified entry point
  app.get(
    "/api/evendi/unified-access-code/:accessCode",
    async (req: any, res: any) => {
      try {
        const { accessCode } = req.params;
        const normalizedCode = accessCode.replace(/[\s-]/g, "").toUpperCase();

        // Look up delivery by access code
        const delRes = await pool.query(
          `SELECT d.id, d.title, d.couple_name, d.couple_email, d.wedding_date, d.description,
                d.access_code, d.status, d.vendor_id, d.project_id, d.timeline_id, d.couple_id,
                d.open_count, d.download_count, d.favorite_count,
                v.business_name, v.category_id
         FROM deliveries d
         JOIN vendors v ON v.id = d.vendor_id
         WHERE d.access_code = $1 AND d.status = 'active'`,
          [normalizedCode],
        );

        if (!delRes.rows.length)
          return res
            .status(404)
            .json({ error: "Ingen leveranse funnet med denne koden" });
        const delivery = delRes.rows[0];

        // Get items
        const itemsRes = await pool.query(
          `SELECT id, type, label, url, description, download_count, favorite_count, favorited_at
         FROM delivery_items WHERE delivery_id = $1 ORDER BY sort_order ASC`,
          [delivery.id],
        );

        // Get linked showcase items
        const showcaseRes = await pool.query(
          `SELECT id, title, image_url, category, source_type
         FROM showcase_items WHERE delivery_id = $1 AND is_active = true`,
          [delivery.id],
        );

        // Track "opened" event
        await pool.query(
          `INSERT INTO delivery_tracking (delivery_id, couple_id, vendor_id, action, action_detail)
         VALUES ($1, $2, $3, 'opened', $4)`,
          [
            delivery.id,
            delivery.couple_id || null,
            delivery.vendor_id,
            JSON.stringify({
              source: "unified-access-code",
              accessCode: normalizedCode,
            }),
          ],
        );
        await pool.query(
          `UPDATE deliveries SET open_count = COALESCE(open_count, 0) + 1, opened_at = COALESCE(opened_at, NOW())
         WHERE id = $1`,
          [delivery.id],
        );

        res.json({
          delivery: {
            id: delivery.id,
            title: delivery.title,
            coupleName: delivery.couple_name,
            coupleEmail: delivery.couple_email,
            weddingDate: delivery.wedding_date,
            description: delivery.description,
            accessCode: delivery.access_code,
            projectId: delivery.project_id,
            timelineId: delivery.timeline_id,
            openCount: (delivery.open_count || 0) + 1,
            downloadCount: delivery.download_count || 0,
            favoriteCount: delivery.favorite_count || 0,
            items: itemsRes.rows,
          },
          vendor: {
            businessName: delivery.business_name,
            categoryId: delivery.category_id,
          },
          showcaseItems: showcaseRes.rows,
        });
      } catch (error) {
        console.error("Unified access code error:", error);
        res.status(500).json({ error: "Kunne ikke hente leveranse" });
      }
    },
  );

  // ==============================================================
  // SEED TRADITION CHECKLIST ITEMS — Insert tradition-specific tasks
  // ==============================================================
  app.post(
    "/api/evendi/checklist/seed-traditions",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { coupleId } = req.body;
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

        // Get couple's selected traditions
        const coupleResult = await pool.query(
          "SELECT selected_traditions FROM couple_profiles WHERE id = $1",
          [coupleId],
        );
        if (
          !coupleResult.rows.length ||
          !coupleResult.rows[0].selected_traditions?.length
        ) {
          return res
            .status(400)
            .json({ error: "Ingen tradisjoner valgt for dette paret" });
        }

        const selectedTraditions: string[] =
          coupleResult.rows[0].selected_traditions;

        // Import tradition checklist data
        const { TRADITION_CHECKLIST_ITEMS } =
          await import("./tradition-checklists");

        // Get existing task titles to avoid duplicates
        const existing = await pool.query(
          "SELECT title FROM checklist_tasks WHERE couple_id = $1",
          [coupleId],
        );
        const existingTitles = new Set(existing.rows.map((r: any) => r.title));

        // Get current max sort_order
        const maxOrder = await pool.query(
          "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM checklist_tasks WHERE couple_id = $1",
          [coupleId],
        );
        let sortOrder = (maxOrder.rows[0]?.max_order || 0) + 1;

        const inserted: any[] = [];
        for (const tradition of selectedTraditions) {
          const items = TRADITION_CHECKLIST_ITEMS[tradition];
          if (!items) continue;
          for (const item of items) {
            if (existingTitles.has(item.title)) continue;
            const result = await pool.query(
              `INSERT INTO checklist_tasks (couple_id, title, months_before, category, is_default, is_tradition_item, sort_order)
             VALUES ($1, $2, $3, $4, true, true, $5) RETURNING *`,
              [
                coupleId,
                item.title,
                item.monthsBefore,
                item.category,
                sortOrder++,
              ],
            );
            inserted.push(result.rows[0]);
            existingTitles.add(item.title);
          }
        }

        res.json({
          message:
            inserted.length > 0
              ? `${inserted.length} tradisjonsoppgaver lagt til`
              : "Alle tradisjonsoppgaver finnes allerede",
          tasks: inserted,
          count: inserted.length,
        });
      } catch (error) {
        console.error("Seed tradition checklist error:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke legge til tradisjonsoppgaver" });
      }
    },
  );

  // ==============================================================
  // SEED TRADITION BUDGET ITEMS — Insert tradition-specific budget items
  // ==============================================================
  app.post("/api/evendi/budget/seed-traditions", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId } = req.body;
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

      // Get couple's selected traditions
      const coupleResult = await pool.query(
        "SELECT selected_traditions FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      if (
        !coupleResult.rows.length ||
        !coupleResult.rows[0].selected_traditions?.length
      ) {
        return res
          .status(400)
          .json({ error: "Ingen tradisjoner valgt for dette paret" });
      }

      const selectedTraditions: string[] =
        coupleResult.rows[0].selected_traditions;

      // Import tradition budget data
      const { TRADITION_BUDGET_ITEMS } = await import("./tradition-checklists");

      // Get existing budget item labels to avoid duplicates
      const existing = await pool.query(
        "SELECT label FROM budget_items WHERE couple_id = $1",
        [coupleId],
      );
      const existingLabels = new Set(existing.rows.map((r: any) => r.label));

      // Get current max sort_order
      const maxOrder = await pool.query(
        "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM budget_items WHERE couple_id = $1",
        [coupleId],
      );
      let sortOrder = (maxOrder.rows[0]?.max_order || 0) + 1;

      const inserted: any[] = [];
      for (const tradition of selectedTraditions) {
        const items = TRADITION_BUDGET_ITEMS[tradition];
        if (!items) continue;
        for (const item of items) {
          if (existingLabels.has(item.label)) continue;
          const result = await pool.query(
            `INSERT INTO budget_items (couple_id, category, label, estimated_cost, is_tradition_item, sort_order)
             VALUES ($1, $2, $3, $4, true, $5) RETURNING *`,
            [
              coupleId,
              item.category,
              item.label,
              item.estimatedCost,
              sortOrder++,
            ],
          );
          inserted.push(result.rows[0]);
          existingLabels.add(item.label);
        }
      }

      res.json({
        message:
          inserted.length > 0
            ? `${inserted.length} tradisjonsbudsjettposter lagt til`
            : "Alle tradisjonsbudsjettposter finnes allerede",
        items: inserted,
        count: inserted.length,
      });
    } catch (error) {
      console.error("Seed tradition budget error:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke legge til tradisjonsbudsjettposter" });
    }
  });

  // ==============================================================
  // CHECKLIST & BUDGET CRUD — Basic CRUD for couple checklist/budget items
  // ==============================================================
  app.get("/api/evendi/checklist/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;
      const { coupleId } = req.params;
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length)
        return res.status(403).json({ error: "Ingen tilgang" });
      const result = await pool.query(
        "SELECT * FROM checklist_tasks WHERE couple_id = $1 ORDER BY sort_order ASC",
        [coupleId],
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke hente sjekkliste" });
    }
  });

  app.get("/api/evendi/budget/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;
      const { coupleId } = req.params;
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length)
        return res.status(403).json({ error: "Ingen tilgang" });
      const result = await pool.query(
        "SELECT * FROM budget_items WHERE couple_id = $1 ORDER BY sort_order ASC",
        [coupleId],
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke hente budsjett" });
    }
  });

  // ================================================================
  // SPEECHES BRIDGE — Fetch organizer's speeches/program via Evendi, with contract check
  // Supports all event types (wedding, conference, corporate, etc.)
  // ================================================================
  app.get("/api/evendi/speeches/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId } = req.params;

      // Check vendor has an active contract with can_view_speeches = true
      const contractCheck = await pool.query(
        `SELECT id, can_view_speeches FROM couple_vendor_contracts
         WHERE vendor_id = $1 AND couple_id = $2 AND status = 'active' LIMIT 1`,
        [vendor.id, coupleId],
      );

      // Fallback: if no contract, check if they have a conversation (relaxed access)
      if (!contractCheck.rows.length) {
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res
            .status(403)
            .json({ error: "Ingen tilgang til arrangørens taler/program" });
        }
      }

      // If contract exists but can_view_speeches is false, deny
      if (contractCheck.rows.length && !contractCheck.rows[0].can_view_speeches) {
        return res
          .status(403)
          .json({ error: "Tilgang til taler er ikke aktivert i kontrakten" });
      }

      // Fetch speeches directly from DB (shared database)
      const result = await pool.query(
        `
        SELECT id, couple_id, speaker_name, role, duration_minutes,
               sort_order, notes, scheduled_time, created_at, updated_at
        FROM speeches
        WHERE couple_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
        [coupleId],
      );

      // Get organizer info for context
      const organizerResult = await pool.query(
        "SELECT display_name, event_type FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      const organizer = organizerResult.rows[0];

      res.json({
        speeches: result.rows,
        coupleId,
        eventType: organizer?.event_type || "wedding",
        organizerName: organizer?.display_name || "Ukjent",
      });
    } catch (error) {
      console.error("Evendi speeches bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente taler" });
    }
  });

  // ================================================================
  // SEATING / TABLES BRIDGE — Fetch organizer's table layout via Evendi, with contract check
  // Supports all event types (wedding, conference, corporate, etc.)
  // ================================================================
  app.get("/api/evendi/tables/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId } = req.params;

      // Check vendor has an active contract with can_view_table_seating = true
      const contractCheck = await pool.query(
        `SELECT id, can_view_table_seating FROM couple_vendor_contracts
         WHERE vendor_id = $1 AND couple_id = $2 AND status = 'active' LIMIT 1`,
        [vendor.id, coupleId],
      );

      // Fallback: if no contract, check conversation
      if (!contractCheck.rows.length) {
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res
            .status(403)
            .json({ error: "Ingen tilgang til arrangørens bordplassering" });
        }
      }

      // If contract exists but can_view_table_seating is false, deny
      if (
        contractCheck.rows.length &&
        !contractCheck.rows[0].can_view_table_seating
      ) {
        return res
          .status(403)
          .json({
            error: "Tilgang til bordplassering er ikke aktivert i kontrakten",
          });
      }

      // Fetch tables
      const tablesResult = await pool.query(
        `
        SELECT id, couple_id, table_number, name, category, label, seats,
               is_reserved, vendor_notes, sort_order, created_at
        FROM wedding_tables
        WHERE couple_id = $1
        ORDER BY sort_order ASC, table_number ASC
      `,
        [coupleId],
      );

      // Fetch guest assignments with guest names
      const assignmentsResult = await pool.query(
        `
        SELECT tga.table_id, tga.guest_id, tga.seat_number,
               wg.name as guest_name, wg.category as guest_category
        FROM table_guest_assignments tga
        JOIN wedding_guests wg ON wg.id = tga.guest_id
        WHERE tga.couple_id = $1
      `,
        [coupleId],
      );

      // Group assignments by table
      const assignmentsByTable: Record<string, any[]> = {};
      for (const a of assignmentsResult.rows) {
        if (!assignmentsByTable[a.table_id]) assignmentsByTable[a.table_id] = [];
        assignmentsByTable[a.table_id].push({
          guestId: a.guest_id,
          guestName: a.guest_name,
          guestCategory: a.guest_category,
          seatNumber: a.seat_number,
        });
      }

      // Build response (hide private notes, only show vendor_notes)
      const tables = tablesResult.rows.map((t: any) => ({
        id: t.id,
        tableNumber: t.table_number,
        name: t.name,
        category: t.category,
        label: t.label,
        seats: t.seats,
        isReserved: t.is_reserved,
        vendorNotes: t.vendor_notes,
        sortOrder: t.sort_order,
        guests: assignmentsByTable[t.id] || [],
      }));

      // Get organizer info
      const organizerResult = await pool.query(
        "SELECT display_name, event_type FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      const organizer = organizerResult.rows[0];

      res.json({
        tables,
        coupleId,
        eventType: organizer?.event_type || "wedding",
        organizerName: organizer?.display_name || "Ukjent",
        totalTables: tables.length,
        totalSeats: tables.reduce((sum: number, t: any) => sum + t.seats, 0),
        assignedGuests: assignmentsResult.rows.length,
      });
    } catch (error) {
      console.error("Evendi tables bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente bordplassering" });
    }
  });

  // =============================================
  // MUSIC BRIDGE — GET /api/evendi/music/:coupleId
  // =============================================
  app.get("/api/evendi/music/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId } = req.params;

      // Check vendor has an active contract with can_view_music = true
      const contractCheck = await pool.query(
        `SELECT id, can_view_music FROM couple_vendor_contracts
         WHERE vendor_id = $1 AND couple_id = $2 AND status = 'active' LIMIT 1`,
        [vendor.id, coupleId],
      );

      // Fallback: if no contract, check if they have a conversation (relaxed access)
      if (!contractCheck.rows.length) {
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res
            .status(403)
            .json({ error: "Ingen tilgang til arrangørens musikkdata" });
        }
      }

      // If contract exists but can_view_music is false, deny
      if (contractCheck.rows.length && !contractCheck.rows[0].can_view_music) {
        return res
          .status(403)
          .json({
            error: "Tilgang til musikk er ikke aktivert for denne kontrakten",
          });
      }

      // Fetch music data directly from DB
      const [
        performancesResult,
        setlistsResult,
        preferencesResult,
        organizerResult,
      ] = await Promise.all([
        pool.query(
          "SELECT * FROM couple_music_performances WHERE couple_id = $1 ORDER BY date",
          [coupleId],
        ),
        pool.query("SELECT * FROM couple_music_setlists WHERE couple_id = $1", [
          coupleId,
        ]),
        pool.query(
          "SELECT * FROM couple_music_preferences WHERE couple_id = $1 LIMIT 1",
          [coupleId],
        ),
        pool.query(
          "SELECT display_name, event_type FROM couple_profiles WHERE id = $1",
          [coupleId],
        ),
      ]);

      const organizer = organizerResult.rows[0];
      const preferences = preferencesResult.rows[0] || null;

      res.json({
        performances: performancesResult.rows,
        setlists: setlistsResult.rows,
        preferences: preferences
          ? {
              spotifyPlaylistUrl: preferences.spotify_playlist_url,
              youtubePlaylistUrl: preferences.youtube_playlist_url,
              entranceSong: preferences.entrance_song,
              firstDanceSong: preferences.first_dance_song,
              lastSong: preferences.last_song,
              doNotPlay: preferences.do_not_play,
              additionalNotes: preferences.additional_notes,
            }
          : null,
        coupleId,
        eventType: organizer?.event_type || "wedding",
        organizerName: organizer?.display_name || "Ukjent",
        totalPerformances: performancesResult.rows.length,
        totalSetlists: setlistsResult.rows.length,
      });
    } catch (error) {
      console.error("Evendi music bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente musikkdata" });
    }
  });

  // =============================================
  // REVIEWS BRIDGE — GET /api/evendi/reviews/:vendorId
  // =============================================
  app.get("/api/evendi/reviews/:vendorId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { vendorId } = req.params;

      // Fetch approved reviews with vendor responses
      const reviewsResult = await pool.query(
        `SELECT r.id, r.rating, r.title, r.body, r.is_anonymous, r.created_at,
                rr.body AS response_body, rr.created_at AS response_created_at
         FROM vendor_reviews r
         LEFT JOIN vendor_review_responses rr ON rr.review_id = r.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC`,
        [vendorId],
      );

      const reviews = reviewsResult.rows.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        isAnonymous: r.is_anonymous,
        createdAt: r.created_at,
        vendorResponse: r.response_body
          ? {
              body: r.response_body,
              createdAt: r.response_created_at,
            }
          : null,
      }));

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
            reviews.length
          : 0;

      res.json({
        reviews,
        vendorId,
        totalReviews: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      });
    } catch (error) {
      console.error("Evendi reviews bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente anmeldelser" });
    }
  });

  app.get("/api/evendi/bookings", async (req, res) => {
    try {
      if (!(await hasTable("bookings"))) {
        return res.json([]);
      }
      const columns = await getTableColumns("bookings");
      const status = readString(req.query.status);
      const filters: string[] = [];
      const params: unknown[] = [];
      const userId =
        readString(req.headers["x-user-id"]) || readString(req.query.userId) || null;
      if (userId && columns.has("user_id")) {
        params.push(userId);
        filters.push(`user_id = $${params.length}`);
      }
      if (status && columns.has("status")) {
        params.push(status);
        filters.push(`status = $${params.length}`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const result = await pool.query(
        `SELECT * FROM bookings ${whereClause} ORDER BY created_at DESC NULLS LAST, date DESC NULLS LAST`,
        params,
      );
      res.json(
        result.rows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          creatorUserId:
            readString(row.user_id) ||
            readString(row.creator_user_id) ||
            "",
          title:
            readString(row.title) ||
            readString(row.project_name) ||
            readString(row.client_name) ||
            "Booking",
          clientName: readString(row.client_name) || "Kunde",
          eventDate:
            readOptionalIsoDate(row.event_date) ||
            readOptionalIsoDate(row.date) ||
            new Date().toISOString(),
          eventType: readString(row.event_type) || undefined,
          totalAmount:
            readNumber(row.total_amount) ??
            readNumber(row.amount) ??
            readNumber(row.price) ??
            0,
          status:
            (readString(row.status) as
              | "pending"
              | "confirmed"
              | "completed"
              | "cancelled") || "pending",
          notes: readString(row.notes) || undefined,
          venueName:
            readString(row.location) || readString(row.venue_name) || undefined,
          contactEmail: readString(row.client_email) || undefined,
          contactPhone: readString(row.client_phone) || undefined,
          createdAt: readOptionalIsoDate(row.created_at) || undefined,
          updatedAt: readOptionalIsoDate(row.updated_at) || undefined,
        })),
      );
    } catch (error) {
      console.error("Error loading Evendi bookings:", error);
      res.status(500).json({ error: "Kunne ikke hente Evendi-bookinger" });
    }
  });

  app.get("/api/evendi/analytics/summary", async (req, res) => {
    try {
      if (!(await hasTable("bookings"))) {
        return res.json({
          totalBookings: 0,
          totalRevenue: 0,
          activeClients: 0,
          completedProjects: 0,
          upcomingEvents: 0,
          revenueByMonth: [],
          bookingsByStatus: [],
        });
      }
      const columns = await getTableColumns("bookings");
      const userId =
        readString(req.headers["x-user-id"]) || readString(req.query.userId) || null;
      const filters: string[] = [];
      const params: unknown[] = [];
      if (userId && columns.has("user_id")) {
        params.push(userId);
        filters.push(`user_id = $${params.length}`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const result = await pool.query(`SELECT * FROM bookings ${whereClause}`, params);
      const rows = result.rows as Array<Record<string, unknown>>;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const revenueByMonthMap = new Map<string, number>();
      const statusMap = new Map<string, number>();
      const clients = new Set<string>();
      let upcomingEvents = 0;
      let completedProjects = 0;
      let totalRevenue = 0;

      for (const row of rows) {
        const eventDate =
          readOptionalIsoDate(row.event_date) || readOptionalIsoDate(row.date);
        const monthKey = eventDate ? eventDate.slice(0, 7) : "unknown";
        const amount =
          readNumber(row.total_amount) ??
          readNumber(row.amount) ??
          readNumber(row.price) ??
          0;
        totalRevenue += amount;
        revenueByMonthMap.set(monthKey, (revenueByMonthMap.get(monthKey) || 0) + amount);
        const status = readString(row.status) || "pending";
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
        const clientName =
          readString(row.client_name) || readString(row.client_email) || null;
        if (clientName) {
          clients.add(clientName.toLowerCase());
        }
        if (status === "completed") {
          completedProjects += 1;
        }
        if (eventDate) {
          const eventAt = new Date(eventDate);
          if (Number.isFinite(eventAt.getTime()) && eventAt >= today) {
            upcomingEvents += 1;
          }
        }
      }

      res.json({
        totalBookings: rows.length,
        totalRevenue,
        activeClients: clients.size,
        completedProjects,
        upcomingEvents,
        revenueByMonth: Array.from(revenueByMonthMap.entries()).map(
          ([month, amount]) => ({ month, amount }),
        ),
        bookingsByStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          count,
        })),
      });
    } catch (error) {
      console.error("Error loading Evendi analytics summary:", error);
      res.status(500).json({ error: "Kunne ikke hente Evendi-analyse" });
    }
  });

}
