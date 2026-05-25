import express from "express";
import type { Pool } from "pg";

export interface WeddingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  ensureWeddingTimelineSchema: () => Promise<void>;
  getPhotographerOvertimeRate: (userId: string) => Promise<number | null>;
}

export function setupWeddingRoutes(deps: WeddingRoutesDeps): void {
  const {
    app,
    pool,
    requireUserSession,
    ensureWeddingTimelineSchema,
    getPhotographerOvertimeRate,
  } = deps;

  app.get("/api/wedding/access", async (req, res) => {
    const code = String(req.query?.code || '').trim().toUpperCase();
    if (!code || code.length < 4 || code.length > 12) {
      return res.status(400).json({ error: 'invalid_code_format' });
    }
    try {
      await ensureWeddingTimelineSchema();
      const r = await pool.query(
        `SELECT id, project_id, couple_name, wedding_date, client_settings,
                client_access_enabled, gdpr_delete_requested_at
           FROM wedding_timelines
          WHERE client_access_code = $1 LIMIT 1`,
        [code],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: 'code_not_found' });
      const row = r.rows[0];
      if (!row.client_access_enabled) {
        return res.status(403).json({ error: 'access_disabled' });
      }
      if (row.gdpr_delete_requested_at) {
        return res.status(410).json({ error: 'data_deleted' });
      }
      const settings = (row.client_settings ?? {}) as Record<string, unknown>;
      const accessToken = typeof settings.accessToken === 'string' ? settings.accessToken : null;
      if (!accessToken) return res.status(500).json({ error: 'token_missing' });

      // Stempel first_opened_at
      await pool.query(
        `UPDATE wedding_timelines
            SET first_opened_at = COALESCE(first_opened_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );

      res.json({
        accessToken,
        weddingUrl: `/wedding/timeline/${accessToken}`,
        coupleName: row.couple_name,
        weddingDate: row.wedding_date,
      });
    } catch (err) {
      console.error('[wedding-access] lookup failed:', err);
      res.status(500).json({ error: 'lookup_failed' });
    }
  });

  // GET /api/wedding/client/:token — hent timeline-data for brudepar (public)
  app.get("/api/wedding/client/:token", async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });
    try {
      await ensureWeddingTimelineSchema();
      const r = await pool.query(
        `SELECT id, couple_name, wedding_date, culture, photographer_arrival,
                showcase_url, timeline_data, client_settings, gdpr_consent_at,
                gdpr_delete_requested_at
           FROM wedding_timelines
          WHERE (client_settings->>'accessToken') = $1 LIMIT 1`,
        [token],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: 'not_found' });
      const row = r.rows[0];
      if (row.gdpr_delete_requested_at) return res.status(410).json({ error: 'data_deleted' });

      const [locationsQ, contactsQ, inspirationsQ] = await Promise.all([
        pool.query(`SELECT * FROM wedding_locations WHERE wedding_id = $1 ORDER BY sort_order, arrival_time`, [row.id]),
        pool.query(`SELECT * FROM wedding_contacts WHERE wedding_id = $1 ORDER BY is_must_capture DESC, sort_order`, [row.id]),
        pool.query(`SELECT * FROM wedding_inspirations WHERE wedding_id = $1 ORDER BY created_at DESC LIMIT 100`, [row.id]),
      ]);

      // Slice 9X.37 — gruppér locations med nested alternativer
      const allLocations = locationsQ.rows;
      const primaryLocs = allLocations.filter((l: any) => !l.alternative_for_location_id);
      const mappedLocations = primaryLocs.map((l: any) => ({
        id: l.id,
        label: l.label || '',
        address: l.address || '',
        postalCode: l.postal_code || '',
        city: l.city || '',
        arrivalTime: l.arrival_time,
        departureTime: l.departure_time,
        notes: l.notes || '',
        isIndoor: l.is_indoor,
        weatherDependent: !!l.weather_dependent,
        activationStatus: l.activation_status || 'standby',
        alternatives: allLocations
          .filter((a: any) => a.alternative_for_location_id === l.id)
          .map((a: any) => ({
            id: a.id,
            label: a.label,
            address: a.address,
            city: a.city,
            isIndoor: a.is_indoor,
            activationStatus: a.activation_status || 'standby',
          })),
      }));

      res.json({
        timeline: {
          id: row.id,
          coupleName: row.couple_name,
          weddingDate: row.wedding_date,
          culture: row.culture,
          photographerArrival: row.photographer_arrival,
          showcaseUrl: row.showcase_url,
          timelineData: row.timeline_data,
          gdprConsented: !!row.gdpr_consent_at,
        },
        locations: mappedLocations,
        contacts: contactsQ.rows,
        inspirations: inspirationsQ.rows,
      });
    } catch (err) {
      console.error('[wedding-client] fetch failed:', err);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // POST /api/wedding/client/:token/details — brudepar lagrer/oppdaterer detaljer
  app.post("/api/wedding/client/:token/details", async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });

    const {
      culture, photographerArrival, gdprConsent,
      locations, contacts, inspirations, markComplete,
    } = req.body ?? {};

    try {
      await ensureWeddingTimelineSchema();
      const weddingQ = await pool.query(
        `SELECT id, photographer_id FROM wedding_timelines
          WHERE (client_settings->>'accessToken') = $1 LIMIT 1`,
        [token],
      );
      if ((weddingQ.rowCount ?? 0) === 0) return res.status(404).json({ error: 'not_found' });
      const weddingId = weddingQ.rows[0].id;

      // Krever GDPR-samtykke før noe kan lagres
      if (!gdprConsent) {
        return res.status(412).json({ error: 'gdpr_consent_required' });
      }

      await pool.query(
        `UPDATE wedding_timelines SET
           culture = COALESCE($1, culture),
           photographer_arrival = COALESCE($2::timestamptz, photographer_arrival),
           gdpr_consent_at = COALESCE(gdpr_consent_at, NOW()),
           completed_at = CASE WHEN $3::boolean THEN NOW() ELSE completed_at END,
           updated_at = NOW()
         WHERE id = $4`,
        [
          typeof culture === 'string' ? culture : null,
          photographerArrival || null,
          !!markComplete,
          weddingId,
        ],
      );

      // Replace locations (forenkling — full replace ved hver save)
      if (Array.isArray(locations)) {
        // Slice 9X.37 — bevar alternativer (plan-B-lokasjoner) som peker
        // til primary via alternative_for_location_id. Vi sletter kun
        // primary, og deretter cascade-sletter orphaned alternativer.
        await pool.query(
          `DELETE FROM wedding_locations
             WHERE wedding_id = $1 AND alternative_for_location_id IS NULL`,
          [weddingId],
        );
        await pool.query(
          `DELETE FROM wedding_locations
             WHERE wedding_id = $1
               AND alternative_for_location_id IS NOT NULL
               AND alternative_for_location_id NOT IN (
                 SELECT id FROM wedding_locations WHERE wedding_id = $1
               )`,
          [weddingId],
        );
        for (let i = 0; i < locations.length; i++) {
          const loc = locations[i];
          if (!loc?.label) continue;
          await pool.query(
            `INSERT INTO wedding_locations
               (wedding_id, label, address, postal_code, city, arrival_time, departure_time, notes, sort_order, is_indoor, weather_dependent)
             VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, $10, $11)`,
            [
              weddingId,
              String(loc.label).slice(0, 255),
              loc.address ?? null,
              loc.postalCode ?? null,
              loc.city ?? null,
              loc.arrivalTime || null,
              loc.departureTime || null,
              loc.notes ?? null,
              i,
              typeof loc.isIndoor === "boolean" ? loc.isIndoor : null,
              Boolean(loc.weatherDependent),
            ],
          );
        }
      }

      if (Array.isArray(contacts)) {
        await pool.query(`DELETE FROM wedding_contacts WHERE wedding_id = $1`, [weddingId]);
        for (let i = 0; i < contacts.length; i++) {
          const c = contacts[i];
          if (!c?.fullName || !c?.relation) continue;
          await pool.query(
            `INSERT INTO wedding_contacts
               (wedding_id, full_name, relation, phone, email, notes, is_must_capture, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              weddingId,
              String(c.fullName).slice(0, 255),
              String(c.relation).slice(0, 64),
              c.phone ?? null,
              c.email ?? null,
              c.notes ?? null,
              !!c.isMustCapture,
              i,
            ],
          );
        }
      }

      if (Array.isArray(inspirations)) {
        // Append-only — vi sletter ikke eksisterende, kun legger til nye uten id
        for (const ins of inspirations) {
          if (!ins?.imageUrl && !ins?.sourceUrl) continue;
          if (ins.id) continue; // eksisterende, hopp
          await pool.query(
            `INSERT INTO wedding_inspirations (wedding_id, image_url, source_url, caption, uploaded_by_email)
             VALUES ($1, $2, $3, $4, $5)`,
            [weddingId, ins.imageUrl ?? null, ins.sourceUrl ?? null, ins.caption ?? null, ins.uploadedByEmail ?? null],
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[wedding-client] save failed:', err);
      res.status(500).json({ error: 'save_failed' });
    }
  });

  // DELETE /api/wedding/client/:token/data — GDPR Art. 17 sletting
  app.delete("/api/wedding/client/:token/data", async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });
    try {
      await ensureWeddingTimelineSchema();
      const r = await pool.query(
        `SELECT id FROM wedding_timelines
          WHERE (client_settings->>'accessToken') = $1 LIMIT 1`,
        [token],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: 'not_found' });
      const weddingId = r.rows[0].id;

      // Soft-delete: nullstill data + sett delete-flagg
      await pool.query(`DELETE FROM wedding_locations WHERE wedding_id = $1`, [weddingId]);
      await pool.query(`DELETE FROM wedding_contacts WHERE wedding_id = $1`, [weddingId]);
      await pool.query(`DELETE FROM wedding_inspirations WHERE wedding_id = $1`, [weddingId]);
      await pool.query(
        `UPDATE wedding_timelines SET
           gdpr_delete_requested_at = NOW(),
           timeline_data = '{}'::jsonb,
           culture = NULL,
           photographer_arrival = NULL,
           client_access_enabled = false,
           updated_at = NOW()
         WHERE id = $1`,
        [weddingId],
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error('[wedding-gdpr] delete failed:', err);
      res.status(500).json({ error: 'delete_failed' });
    }
  });

  // GET /api/wedding/culture-templates — list tilgjengelige kultur-templates
  app.get("/api/wedding/culture-templates", async (_req, res) => {
    try {
      const { listCultureTemplates } = await import('./wedding-culture-templates.js');
      res.json({ templates: listCultureTemplates() });
    } catch (err) {
      console.error('[wedding-culture] list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Wedding Timeline Events (Slice 9X.23 — fotograf-kuratert + toveis-comments)
  // ─────────────────────────────────────────────────────────────────────────

  let weddingEventsSchemaReady: Promise<void> | null = null;
  function ensureWeddingEventsSchema(): Promise<void> {
    if (!weddingEventsSchemaReady) {
      weddingEventsSchemaReady = (async () => {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS wedding_timeline_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              wedding_id VARCHAR(64) NOT NULL,
              title VARCHAR(255) NOT NULL,
              description TEXT,
              photo_notes TEXT,
              lens_notes TEXT,
              category VARCHAR(32) DEFAULT 'photo_session',
              scheduled_time TIMESTAMPTZ,
              duration_minutes INTEGER DEFAULT 30,
              buffer_before_minutes INTEGER DEFAULT 0,
              buffer_after_minutes INTEGER DEFAULT 0,
              estimated_shots INTEGER,
              location_id UUID,
              status VARCHAR(32) DEFAULT 'planned',
              sort_order INTEGER DEFAULT 0,
              client_visible BOOLEAN DEFAULT TRUE,
              client_can_comment BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS wedding_timeline_events_wedding_idx
              ON wedding_timeline_events (wedding_id, scheduled_time);
            ALTER TABLE wedding_timeline_events
              ADD COLUMN IF NOT EXISTS lens_notes TEXT;
            ALTER TABLE wedding_timeline_events
              ADD COLUMN IF NOT EXISTS memory_cards TEXT[] DEFAULT '{}';
            ALTER TABLE wedding_timeline_events
              ADD COLUMN IF NOT EXISTS equipment_ids INTEGER[] DEFAULT '{}';
            CREATE TABLE IF NOT EXISTS wedding_event_comments (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              event_id UUID NOT NULL,
              wedding_id VARCHAR(64) NOT NULL,
              author_type VARCHAR(16) NOT NULL,
              author_name VARCHAR(255),
              author_email VARCHAR(255),
              content TEXT NOT NULL,
              parent_comment_id UUID,
              is_resolved BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS wedding_event_comments_event_idx
              ON wedding_event_comments (event_id, created_at);
          `);
        } catch (err) {
          console.warn('[wedding-events] schema-ensure failed:', err);
          weddingEventsSchemaReady = null;
          throw err;
        }
      })();
    }
    return weddingEventsSchemaReady;
  }

  async function assertPhotographerOwnsWedding(weddingId: string, photographerId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM wedding_timelines WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
      [weddingId, photographerId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async function lookupWeddingIdByToken(token: string): Promise<{ id: string; coupleName: string; clientEmail: string | null; projectId: string | null } | null> {
    const r = await pool.query(
      `SELECT w.id, w.couple_name, w.project_id, c.email AS client_email
         FROM wedding_timelines w
         LEFT JOIN projects p ON p.id = w.project_id
         LEFT JOIN clients c ON c.id = p.client_id
        WHERE (w.client_settings->>'accessToken') = $1
          AND w.gdpr_delete_requested_at IS NULL
          AND w.client_access_enabled = true
        LIMIT 1`,
      [token],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return {
      id: r.rows[0].id,
      coupleName: r.rows[0].couple_name,
      clientEmail: r.rows[0].client_email ?? null,
      projectId: r.rows[0].project_id ?? null,
    };
  }

  function serializeEvent(row: Record<string, unknown>, includePhotoNotes = false) {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      // Slice 9X.23 — alle utstyr/note-felter er PRIVATE.
      photoNotes: includePhotoNotes ? (row.photo_notes ?? null) : undefined,
      lensNotes: includePhotoNotes ? (row.lens_notes ?? null) : undefined,
      memoryCards: includePhotoNotes ? (Array.isArray(row.memory_cards) ? row.memory_cards : []) : undefined,
      equipmentIds: includePhotoNotes
        ? (Array.isArray(row.equipment_ids) ? row.equipment_ids.map(Number) : [])
        : undefined,
      category: row.category,
      scheduledTime: row.scheduled_time,
      durationMinutes: Number(row.duration_minutes ?? 30),
      bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
      bufferAfterMinutes: Number(row.buffer_after_minutes ?? 0),
      estimatedShots: row.estimated_shots != null ? Number(row.estimated_shots) : null,
      locationId: row.location_id ?? null,
      status: row.status,
      sortOrder: Number(row.sort_order ?? 0),
      clientVisible: !!row.client_visible,
      clientCanComment: !!row.client_can_comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function serializeComment(row: Record<string, unknown>) {
    return {
      id: row.id,
      eventId: row.event_id,
      authorType: row.author_type,
      authorName: row.author_name,
      authorEmail: row.author_email,
      content: row.content,
      isResolved: !!row.is_resolved,
      createdAt: row.created_at,
    };
  }

  app.get("/api/wedding/:id/timeline-events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const eventsQ = await pool.query(
        `SELECT * FROM wedding_timeline_events
          WHERE wedding_id = $1
          ORDER BY scheduled_time ASC NULLS LAST, sort_order ASC`,
        [weddingId],
      );
      const commentsQ = await pool.query(
        `SELECT event_id, COUNT(*)::int AS comment_count,
                COUNT(*) FILTER (WHERE author_type = 'client')::int AS client_comment_count,
                COUNT(*) FILTER (WHERE author_type = 'client' AND is_resolved = false)::int AS unresolved_client_count
           FROM wedding_event_comments WHERE wedding_id = $1 GROUP BY event_id`,
        [weddingId],
      );
      const countMap = new Map(commentsQ.rows.map((r: Record<string, unknown>) => [String(r.event_id), r]));
      res.json({
        events: eventsQ.rows.map((row: Record<string, unknown>) => {
          const c = countMap.get(String(row.id));
          return {
            ...serializeEvent(row, true),
            commentCount: Number(c?.comment_count ?? 0),
            clientCommentCount: Number(c?.client_comment_count ?? 0),
            unresolvedClientCount: Number(c?.unresolved_client_count ?? 0),
          };
        }),
      });
    } catch (err) {
      console.error('[wedding-events] list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  app.post("/api/wedding/:id/timeline-events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const {
      title, description, photoNotes, lensNotes, memoryCards, equipmentIds,
      category, scheduledTime, durationMinutes,
      bufferBeforeMinutes, bufferAfterMinutes, estimatedShots, locationId,
      clientVisible, clientCanComment,
    } = req.body ?? {};
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (!trimmedTitle) return res.status(400).json({ error: 'title_required' });
    const memoryCardsArray = Array.isArray(memoryCards)
      ? memoryCards.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 20)
      : [];
    const equipmentIdsArray = Array.isArray(equipmentIds)
      ? equipmentIds.map((e: unknown) => Number(e)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 30)
      : [];
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const r = await pool.query(
        `INSERT INTO wedding_timeline_events
           (wedding_id, title, description, photo_notes, lens_notes, memory_cards, equipment_ids,
            category, scheduled_time, duration_minutes, buffer_before_minutes, buffer_after_minutes,
            estimated_shots, location_id, client_visible, client_can_comment)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7::int[], $8, $9::timestamptz, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          weddingId, trimmedTitle,
          typeof description === 'string' ? description : null,
          typeof photoNotes === 'string' ? photoNotes : null,
          typeof lensNotes === 'string' ? lensNotes : null,
          memoryCardsArray,
          equipmentIdsArray,
          typeof category === 'string' ? category : 'photo_session',
          scheduledTime || null,
          Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 30,
          Number.isFinite(Number(bufferBeforeMinutes)) ? Number(bufferBeforeMinutes) : 0,
          Number.isFinite(Number(bufferAfterMinutes)) ? Number(bufferAfterMinutes) : 0,
          Number.isFinite(Number(estimatedShots)) ? Number(estimatedShots) : null,
          locationId || null,
          clientVisible !== false, clientCanComment !== false,
        ],
      );
      res.status(201).json(serializeEvent(r.rows[0], true));
    } catch (err) {
      console.error('[wedding-events] create failed:', err);
      res.status(500).json({ error: 'create_failed' });
    }
  });

  app.patch("/api/wedding/:id/timeline-events/:eventId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    const {
      title, description, photoNotes, lensNotes, memoryCards, equipmentIds,
      category, scheduledTime, durationMinutes,
      bufferBeforeMinutes, bufferAfterMinutes, estimatedShots, status,
      clientVisible, clientCanComment,
    } = req.body ?? {};
    const memoryCardsPatch = Array.isArray(memoryCards)
      ? memoryCards.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 20)
      : null;
    const equipmentIdsPatch = Array.isArray(equipmentIds)
      ? equipmentIds.map((e: unknown) => Number(e)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 30)
      : null;
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const r = await pool.query(
        `UPDATE wedding_timeline_events SET
           title = COALESCE($1, title), description = COALESCE($2, description),
           photo_notes = COALESCE($3, photo_notes), category = COALESCE($4, category),
           scheduled_time = COALESCE($5::timestamptz, scheduled_time),
           duration_minutes = COALESCE($6, duration_minutes),
           buffer_before_minutes = COALESCE($7, buffer_before_minutes),
           buffer_after_minutes = COALESCE($8, buffer_after_minutes),
           estimated_shots = COALESCE($9, estimated_shots),
           status = COALESCE($10, status),
           client_visible = COALESCE($11, client_visible),
           client_can_comment = COALESCE($12, client_can_comment),
           lens_notes = COALESCE($13, lens_notes),
           memory_cards = COALESCE($14::text[], memory_cards),
           equipment_ids = COALESCE($15::int[], equipment_ids),
           updated_at = NOW()
         WHERE id = $16 AND wedding_id = $17 RETURNING *`,
        [
          typeof title === 'string' && title.trim() ? title.trim() : null,
          typeof description === 'string' ? description : null,
          typeof photoNotes === 'string' ? photoNotes : null,
          typeof category === 'string' ? category : null,
          scheduledTime || null,
          Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : null,
          Number.isFinite(Number(bufferBeforeMinutes)) ? Number(bufferBeforeMinutes) : null,
          Number.isFinite(Number(bufferAfterMinutes)) ? Number(bufferAfterMinutes) : null,
          Number.isFinite(Number(estimatedShots)) ? Number(estimatedShots) : null,
          typeof status === 'string' ? status : null,
          typeof clientVisible === 'boolean' ? clientVisible : null,
          typeof clientCanComment === 'boolean' ? clientCanComment : null,
          typeof lensNotes === 'string' ? lensNotes : null,
          memoryCardsPatch,
          equipmentIdsPatch,
          eventId, weddingId,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'event_not_found' });
      res.json(serializeEvent(r.rows[0], true));
    } catch (err) {
      console.error('[wedding-events] update failed:', err);
      res.status(500).json({ error: 'update_failed' });
    }
  });

  // GET /api/wedding/:id/template-suggestion — foreslå komplett event-template
  // basert på kultur + Stines registrerte utstyr. Brukes til "Skal vi legge
  // til dette?"-prompt på et tomt bryllup-prosjekt.
  app.get("/api/wedding/:id/template-suggestion", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      // Hent kultur + wedding-date
      const wQ = await pool.query(
        `SELECT culture, wedding_date, couple_name, photographer_arrival
           FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [weddingId],
      );
      const w = wQ.rows[0];
      if (!w) return res.status(404).json({ error: 'wedding_not_found' });

      const culture = w.culture ?? 'norsk-kristen';
      const { getCultureTemplate, WEDDING_CULTURE_TEMPLATES } = await import('./wedding-culture-templates.js');
      const template = getCultureTemplate(culture) ?? WEDDING_CULTURE_TEMPLATES['norsk-kristen'];

      // Bruk ceremonyStart = photographer_arrival hvis satt, ellers wedding_date 14:00
      let ceremonyStart: Date;
      if (w.photographer_arrival) {
        // Anta seremoni starter ~3-4 timer etter fotograf ankomst
        ceremonyStart = new Date(new Date(w.photographer_arrival).getTime() + 3 * 3600_000);
      } else {
        ceremonyStart = new Date(w.wedding_date);
        ceremonyStart.setHours(14, 0, 0, 0);
      }

      // Hent Stines utstyr — split kameraer + linser + blits
      const eqQ = await pool.query(
        `SELECT id, category, brand, model FROM user_equipment
          WHERE user_id = $1
          ORDER BY purchase_date DESC NULLS LAST`,
        [session.userId],
      );
      const cameras = eqQ.rows.filter((r) => r.category === 'camera_body');
      const lenses = eqQ.rows.filter((r) => r.category === 'lens');
      const flashes = eqQ.rows.filter((r) => r.category === 'flash');

      // Generér events fra template med foreslått utstyr
      const suggestedEvents = template.events.map((tpl) => {
        const scheduledTime = new Date(ceremonyStart.getTime() + tpl.minutesFromCeremony * 60000);

        // Foreslå utstyr basert på event-type (forenkling — kan utvides)
        const suggestedEquipmentIds: number[] = [];
        // Alltid med kameraer
        if (cameras.length >= 1) suggestedEquipmentIds.push(Number(cameras[0].id));
        if (cameras.length >= 2 && (tpl.activityType === 'ceremony' || tpl.activityType === 'religious' || tpl.activityType === 'reception')) {
          suggestedEquipmentIds.push(Number(cameras[1].id));
        }
        // Linser per event-type
        if (lenses.length > 0) {
          const eventCategory = tpl.activityType;
          const preferLens = (slug: string) => lenses.find((l) =>
            String(l.model).toLowerCase().includes(slug),
          );
          if (eventCategory === 'preparation') {
            const lens = preferLens('50') ?? preferLens('35') ?? lenses[0];
            if (lens) suggestedEquipmentIds.push(Number(lens.id));
          } else if (eventCategory === 'ceremony' || eventCategory === 'religious') {
            const lens = preferLens('24-70') ?? preferLens('70-200') ?? lenses[0];
            if (lens) suggestedEquipmentIds.push(Number(lens.id));
            if (lenses.length > 1) {
              const second = preferLens('70-200') ?? preferLens('85') ?? lenses[1];
              if (second && !suggestedEquipmentIds.includes(Number(second.id))) {
                suggestedEquipmentIds.push(Number(second.id));
              }
            }
          } else if (eventCategory === 'photo_session') {
            const lens = preferLens('85') ?? preferLens('50') ?? preferLens('24-70') ?? lenses[0];
            if (lens) suggestedEquipmentIds.push(Number(lens.id));
          } else if (eventCategory === 'reception') {
            const lens = preferLens('24-70') ?? preferLens('35') ?? lenses[0];
            if (lens) suggestedEquipmentIds.push(Number(lens.id));
          } else {
            if (lenses[0]) suggestedEquipmentIds.push(Number(lenses[0].id));
          }
        }
        // Blits ved reception eller mørke seremonier
        if (flashes.length > 0 && (tpl.activityType === 'reception' || tpl.activityType === 'religious')) {
          suggestedEquipmentIds.push(Number(flashes[0].id));
        }

        // Foreslå estimert antall bilder per event-type
        const estimatedShots = (() => {
          switch (tpl.activityType) {
            case 'preparation': return 80;
            case 'ceremony':
            case 'religious': return 120;
            case 'photo_session': return 60;
            case 'reception': return 180;
            case 'transport': return 15;
            default: return 30;
          }
        })();

        return {
          title: tpl.activityName,
          description: tpl.notes ?? null,
          category: tpl.activityType === 'religious' ? 'religious' :
                    tpl.activityType === 'transport' ? 'transport' :
                    tpl.activityType === 'preparation' ? 'preparation' :
                    tpl.activityType === 'ceremony' ? 'ceremony' :
                    tpl.activityType === 'photo_session' ? 'photo_session' : 'reception',
          scheduledTime: scheduledTime.toISOString(),
          durationMinutes: tpl.durationMinutes,
          bufferBeforeMinutes: tpl.bufferBefore ?? 0,
          bufferAfterMinutes: tpl.bufferAfter ?? 0,
          estimatedShots,
          equipmentIds: suggestedEquipmentIds,
          clientVisible: true,
          clientCanComment: true,
        };
      });

      res.json({
        cultureTemplate: { id: template.id, displayName: template.displayName },
        ceremonyStart: ceremonyStart.toISOString(),
        eventCount: suggestedEvents.length,
        events: suggestedEvents,
        availableEquipment: {
          cameras: cameras.map((c) => ({ id: Number(c.id), label: `${c.brand} ${c.model}` })),
          lenses: lenses.map((l) => ({ id: Number(l.id), label: `${l.brand} ${l.model}` })),
          flashes: flashes.map((f) => ({ id: Number(f.id), label: `${f.brand} ${f.model}` })),
        },
        message: cameras.length === 0
          ? 'Du har ingen kameraer registrert i utstyrs-katalogen — events foreslås uten utstyr-tildeling. Legg til utstyr på /photographer/equipment for smartere forslag.'
          : `Forslag basert på ${template.displayName} + ${cameras.length} kamera(er), ${lenses.length} linser, ${flashes.length} blits du har registrert.`,
      });
    } catch (err) {
      console.error('[wedding-events] template-suggestion failed:', err);
      res.status(500).json({ error: 'suggest_failed' });
    }
  });

  // POST /api/wedding/:id/apply-template — opprett alle foreslåtte events i én batch
  app.post("/api/wedding/:id/apply-template", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events || events.length === 0) return res.status(400).json({ error: 'events_required' });

    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }

      const createdIds: string[] = [];
      for (const ev of events) {
        const title = typeof ev?.title === 'string' ? ev.title.trim() : '';
        if (!title) continue;
        const equipmentIdsArray = Array.isArray(ev.equipmentIds)
          ? ev.equipmentIds.map((e: unknown) => Number(e)).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 30)
          : [];
        const r = await pool.query(
          `INSERT INTO wedding_timeline_events
             (wedding_id, title, description, category, scheduled_time,
              duration_minutes, buffer_before_minutes, buffer_after_minutes,
              estimated_shots, equipment_ids, client_visible, client_can_comment)
           VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10::int[], $11, $12)
           RETURNING id`,
          [
            weddingId, title,
            typeof ev.description === 'string' ? ev.description : null,
            typeof ev.category === 'string' ? ev.category : 'photo_session',
            ev.scheduledTime || null,
            Number.isFinite(Number(ev.durationMinutes)) ? Number(ev.durationMinutes) : 30,
            Number.isFinite(Number(ev.bufferBeforeMinutes)) ? Number(ev.bufferBeforeMinutes) : 0,
            Number.isFinite(Number(ev.bufferAfterMinutes)) ? Number(ev.bufferAfterMinutes) : 0,
            Number.isFinite(Number(ev.estimatedShots)) ? Number(ev.estimatedShots) : null,
            equipmentIdsArray,
            ev.clientVisible !== false,
            ev.clientCanComment !== false,
          ],
        );
        if (r.rows[0]?.id) createdIds.push(r.rows[0].id);
      }

      res.status(201).json({ created: createdIds.length, eventIds: createdIds });
    } catch (err) {
      console.error('[wedding-events] apply-template failed:', err);
      res.status(500).json({ error: 'apply_failed' });
    }
  });

  // Slice 9X.27 — Wedding-day live-status. Stine åpner på mobil under shoot,
  // systemet sier "Du er på Vielse-shots (14:00-14:45), 32/120 bilder så langt.
  // Neste: Familiebilder kl 15:30." Reagerer live mens dagen utfolder seg.
  app.get("/api/wedding/:id/live-status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      await ensureWeddingEventsSchema();
      const weddingQ = await pool.query(
        `SELECT id, project_id, couple_name, wedding_date,
                contracted_hours, overtime_activated_at, overtime_hourly_rate, overtime_ended_at
           FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [weddingId],
      );
      const w = weddingQ.rows[0];
      if (!w) return res.status(404).json({ error: 'wedding_not_found' });

      const eventsQ = await pool.query(
        `SELECT id, title, description, photo_notes, scheduled_time, duration_minutes,
                buffer_before_minutes, buffer_after_minutes, estimated_shots,
                status, equipment_ids, memory_cards
           FROM wedding_timeline_events
          WHERE wedding_id = $1
          ORDER BY scheduled_time ASC NULLS LAST`,
        [weddingId],
      );

      const now = Date.now();
      const events = eventsQ.rows.map((row: Record<string, unknown>) => {
        const scheduled = row.scheduled_time ? new Date(row.scheduled_time as string).getTime() : null;
        const duration = Number(row.duration_minutes ?? 30);
        const endTime = scheduled ? scheduled + duration * 60000 : null;
        const isCompleted = row.status === 'completed';
        const isLive = !isCompleted && scheduled !== null && endTime !== null
          && now >= scheduled && now <= endTime;
        const isUpcoming = !isCompleted && scheduled !== null && now < scheduled;
        const isOverdue = !isCompleted && endTime !== null && now > endTime;
        const minutesUntil = scheduled ? Math.round((scheduled - now) / 60000) : null;
        return {
          id: row.id,
          title: row.title,
          description: row.description ?? null,
          photoNotes: row.photo_notes ?? null,
          scheduledTime: row.scheduled_time,
          durationMinutes: duration,
          estimatedShots: row.estimated_shots != null ? Number(row.estimated_shots) : null,
          status: row.status,
          equipmentIds: Array.isArray(row.equipment_ids) ? row.equipment_ids.map(Number) : [],
          memoryCards: Array.isArray(row.memory_cards) ? row.memory_cards : [],
          isLive, isUpcoming, isOverdue, isCompleted, minutesUntil,
          startEpoch: scheduled, endEpoch: endTime,
          bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
          bufferAfterMinutes: Number(row.buffer_after_minutes ?? 0),
        };
      });

      // Live photo-count per event via EXIF capture_time
      const projectId = w.project_id;
      const photoCounts = new Map<string, number>();
      if (projectId) {
        try {
          const windows = events
            .filter((e) => e.startEpoch !== null && e.endEpoch !== null)
            .map((e) => ({
              id: e.id,
              start: new Date((e.startEpoch ?? 0) - e.bufferBeforeMinutes * 60000),
              end: new Date((e.endEpoch ?? 0) + e.bufferAfterMinutes * 60000),
            }));
          if (windows.length > 0) {
            const earliestStart = new Date(Math.min(...windows.map((w) => w.start.getTime())));
            const latestEnd = new Date(Math.max(...windows.map((w) => w.end.getTime())));
            const photosQ = await pool.query(
              `SELECT a.capture_time
                 FROM capture_assets a
                 JOIN capture_sessions s ON s.id = a.session_id
                WHERE s.owner_user_id = $1 AND s.project_id = $2
                  AND a.deleted_at IS NULL
                  AND a.capture_time >= $3::timestamptz
                  AND a.capture_time <= $4::timestamptz`,
              [session.userId, projectId, earliestStart.toISOString(), latestEnd.toISOString()],
            ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
            for (const photo of photosQ.rows) {
              if (!photo.capture_time) continue;
              const captureTs = new Date(photo.capture_time as string).getTime();
              for (const w of windows) {
                if (captureTs >= w.start.getTime() && captureTs <= w.end.getTime()) {
                  photoCounts.set(String(w.id), (photoCounts.get(String(w.id)) ?? 0) + 1);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[wedding-live] photo-count failed:', err);
        }
      }

      const withPhotos = events.map((e) => ({
        ...e,
        capturedShots: photoCounts.get(String(e.id)) ?? 0,
        shotProgress: e.estimatedShots && e.estimatedShots > 0
          ? Math.round(((photoCounts.get(String(e.id)) ?? 0) / e.estimatedShots) * 100)
          : null,
      }));

      const current = withPhotos.find((e) => e.isLive) ?? null;
      const next = withPhotos.find((e) => e.isUpcoming) ?? null;
      const overdue = withPhotos.filter((e) => e.isOverdue);
      const completed = withPhotos.filter((e) => e.isCompleted);
      const upcoming = withPhotos.filter((e) => e.isUpcoming);

      // Slice 9X.28 — VIP-checklist
      const vipQ = await pool.query(
        `SELECT id, full_name, relation, phone, email, notes,
                is_must_capture, captured_at, sort_order
           FROM wedding_contacts
          WHERE wedding_id = $1 AND is_must_capture = true
          ORDER BY captured_at NULLS FIRST, sort_order ASC, full_name ASC`,
        [weddingId],
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

      const vips = vipQ.rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        fullName: r.full_name,
        relation: r.relation,
        phone: r.phone ?? null,
        email: r.email ?? null,
        notes: r.notes ?? null,
        capturedAt: r.captured_at ?? null,
        isCaptured: !!r.captured_at,
      }));

      // Slice 9X.31 — overtime-beregning
      const firstEventStart = events
        .filter((e) => e.startEpoch !== null)
        .map((e) => e.startEpoch as number)
        .sort((a, b) => a - b)[0] ?? null;
      const contractedHours = w.contracted_hours != null ? Number(w.contracted_hours) : null;
      const contractedEndEpoch = firstEventStart !== null && contractedHours !== null
        ? firstEventStart + contractedHours * 3600_000 : null;
      const overtimeActive = !!w.overtime_activated_at;
      const overtimeStartEpoch = w.overtime_activated_at ? new Date(w.overtime_activated_at).getTime() : null;
      const overtimeRate = w.overtime_hourly_rate != null ? Number(w.overtime_hourly_rate) : null;
      const overtimeMinutes = overtimeStartEpoch !== null
        ? Math.max(0, Math.round((now - overtimeStartEpoch) / 60000))
        : 0;
      const overtimeEstimatedFee = overtimeRate !== null
        ? Math.round((overtimeMinutes / 60) * overtimeRate * 100) / 100
        : null;
      const isOverContractedTime = contractedEndEpoch !== null && now > contractedEndEpoch;
      const minutesPastContract = contractedEndEpoch !== null
        ? Math.max(0, Math.round((now - contractedEndEpoch) / 60000)) : 0;

      res.json({
        wedding: { id: w.id, coupleName: w.couple_name, weddingDate: w.wedding_date },
        now: new Date().toISOString(),
        current, next, overdue, completed, upcoming, allEvents: withPhotos,
        vips,
        overtime: {
          contractedHours,
          firstEventStart: firstEventStart ? new Date(firstEventStart).toISOString() : null,
          contractedEndAt: contractedEndEpoch ? new Date(contractedEndEpoch).toISOString() : null,
          isOverContractedTime,
          minutesPastContract,
          active: overtimeActive,
          activatedAt: w.overtime_activated_at ?? null,
          hourlyRate: overtimeRate,
          currentMinutes: overtimeMinutes,
          estimatedFee: overtimeEstimatedFee,
        },
        totals: {
          eventCount: events.length,
          completedCount: completed.length,
          overdueCount: overdue.length,
          totalCaptured: Array.from(photoCounts.values()).reduce((sum, n) => sum + n, 0),
          totalEstimated: events.reduce((sum, e) => sum + (e.estimatedShots ?? 0), 0),
          vipTotal: vips.length,
          vipCaptured: vips.filter((v) => v.isCaptured).length,
        },
      });
    } catch (err) {
      console.error('[wedding-live] failed:', err);
      res.status(500).json({ error: 'live_status_failed' });
    }
  });

  // POST /api/wedding/:id/activate-overtime — Slice 9X.31
  // Stine tapper "aktiver overtid" når kontraktstiden er overskredet.
  // Stempler timestamp + lager note i client_communications som "husk å fakturere".
  app.post("/api/wedding/:id/activate-overtime", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });
    const hourlyRate = req.body?.hourlyRate;

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      // Slice 9X.32 — auto-fetch rate fra prisadministrasjon hvis ikke gitt
      let effectiveRate: number | null = null;
      if (Number.isFinite(Number(hourlyRate))) {
        effectiveRate = Number(hourlyRate);
      } else {
        effectiveRate = await getPhotographerOvertimeRate(session.userId);
      }
      // Idempotent — hvis allerede aktivert, returner eksisterende timestamp
      const r = await pool.query(
        `UPDATE wedding_timelines SET
           overtime_activated_at = COALESCE(overtime_activated_at, NOW()),
           overtime_hourly_rate = COALESCE($1, overtime_hourly_rate),
           updated_at = NOW()
         WHERE id = $2
         RETURNING overtime_activated_at, overtime_hourly_rate, project_id, couple_name`,
        [effectiveRate, weddingId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'wedding_not_found' });
      const row = r.rows[0];

      // Logg til client_communications som påminnelse om fakturering
      if (row.project_id) {
        try {
          const clientQ = await pool.query(
            `SELECT client_id FROM projects WHERE id = $1 LIMIT 1`,
            [row.project_id],
          );
          const clientId = clientQ.rows[0]?.client_id;
          if (clientId) {
            await pool.query(
              `INSERT INTO client_communications
                 (user_id, client_id, project_id, communication_type, direction,
                  subject, content, status, requires_response, priority,
                  category, tags, created_at)
               VALUES ($1, $2, $3, 'overtime_alert', 'internal',
                       $4, $5, 'unread', true, 'high',
                       'billing', ARRAY['overtime','billing-reminder'], NOW())`,
              [
                session.userId, clientId, row.project_id,
                `⏰ Overtid aktivert — ${row.couple_name}`,
                `Bryllup-dekningen gikk over avtalt kontraktstid. Husk å fakturere ekstra timer `
                  + `(${row.overtime_hourly_rate ? `${row.overtime_hourly_rate} kr/t avtalt` : 'sett rate'}). `
                  + `Aktivert ${new Date(row.overtime_activated_at).toLocaleString('nb-NO')}.`,
              ],
            );
          }
        } catch (e) {
          console.warn('[wedding-overtime] CRM-log failed:', e);
        }
      }

      res.json({
        activated: true,
        activatedAt: row.overtime_activated_at,
        hourlyRate: row.overtime_hourly_rate,
      });
    } catch (err) {
      console.error('[wedding-overtime] activate failed:', err);
      res.status(500).json({ error: 'activate_failed' });
    }
  });

  // POST /api/wedding/:id/timeline-events/:eventId/shift-following
  // Slice 9X.30 — Når event tok lengre tid enn planlagt, bumper alle senere
  // non-completed events scheduled_time med offset (i minutter, kan være negativ).
  // Body: { offsetMinutes: number }
  app.post("/api/wedding/:id/timeline-events/:eventId/shift-following", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    const offsetMinutes = Number(req.body?.offsetMinutes);
    if (!Number.isFinite(offsetMinutes) || offsetMinutes === 0) {
      return res.status(400).json({ error: 'offset_minutes_required_nonzero' });
    }
    if (Math.abs(offsetMinutes) > 12 * 60) {
      return res.status(400).json({ error: 'offset_too_large', max: '12 hours' });
    }

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      // Hent scheduled_time for trigger-event
      const triggerQ = await pool.query(
        `SELECT scheduled_time FROM wedding_timeline_events
          WHERE id = $1 AND wedding_id = $2 LIMIT 1`,
        [eventId, weddingId],
      );
      if ((triggerQ.rowCount ?? 0) === 0) return res.status(404).json({ error: 'event_not_found' });
      const trigger = triggerQ.rows[0];
      if (!trigger.scheduled_time) return res.status(400).json({ error: 'trigger_has_no_time' });

      // Bump alle senere events som ikke er completed/cancelled
      const r = await pool.query(
        `UPDATE wedding_timeline_events SET
           scheduled_time = scheduled_time + ($1 || ' minutes')::interval,
           updated_at = NOW()
         WHERE wedding_id = $2
           AND scheduled_time > $3::timestamptz
           AND status NOT IN ('completed', 'cancelled')
         RETURNING id, title, scheduled_time`,
        [offsetMinutes, weddingId, trigger.scheduled_time],
      );

      res.json({
        shifted: r.rowCount,
        offsetMinutes,
        events: r.rows.map((row: Record<string, unknown>) => ({
          id: row.id, title: row.title, newScheduledTime: row.scheduled_time,
        })),
      });
    } catch (err) {
      console.error('[wedding-events] shift failed:', err);
      res.status(500).json({ error: 'shift_failed' });
    }
  });

  // PATCH /api/wedding/:id/vip-contacts/:contactId/capture — toggle VIP fanget-status
  app.patch("/api/wedding/:id/vip-contacts/:contactId/capture", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const contactId = String(req.params.contactId || '').trim();
    if (!weddingId || !contactId) return res.status(400).json({ error: 'ids_required' });
    const captured = req.body?.captured;
    if (typeof captured !== 'boolean') return res.status(400).json({ error: 'captured_boolean_required' });

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const r = await pool.query(
        `UPDATE wedding_contacts SET
           captured_at = CASE WHEN $1::boolean THEN NOW() ELSE NULL END,
           captured_by = CASE WHEN $1::boolean THEN $2 ELSE NULL END
         WHERE id = $3 AND wedding_id = $4
         RETURNING captured_at`,
        [captured, session.userId, contactId, weddingId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'contact_not_found' });
      res.json({ success: true, capturedAt: r.rows[0].captured_at });
    } catch (err) {
      console.error('[wedding-vip] capture toggle failed:', err);
      res.status(500).json({ error: 'capture_failed' });
    }
  });

  // Slice 9X.26 — Norske foto-retailer-søk per batteri-modell.
  function buildBatteryPurchaseLinks(batteryModel: string | null): Array<{ retailer: string; url: string }> {
    if (!batteryModel) return [];
    const q = encodeURIComponent(batteryModel);
    return [
      { retailer: 'foto.no', url: `https://www.foto.no/search?q=${q}` },
      { retailer: 'cyberphoto.no', url: `https://www.cyberphoto.no/search?q=${q}` },
      { retailer: 'fotovideo.no', url: `https://www.fotovideo.no/search?q=${q}` },
    ];
  }

  function buildAaBatteryPurchaseLinks(): Array<{ retailer: string; url: string }> {
    return [
      { retailer: 'Clas Ohlson', url: 'https://www.clasohlson.com/no/search?q=eneloop+pro+AA' },
      { retailer: 'foto.no', url: 'https://www.foto.no/search?q=eneloop+pro' },
    ];
  }

  // POST /api/wedding/:id/charging-reminder — opprett Google Calendar-event
  // dagen før bryllupet kl 18 med påminnelse "Lade alle batterier".
  app.post("/api/wedding/:id/charging-reminder", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const wQ = await pool.query(
        `SELECT wedding_date, couple_name FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [weddingId],
      );
      const w = wQ.rows[0];
      if (!w?.wedding_date) return res.status(400).json({ error: 'no_wedding_date' });

      const weddingDate = new Date(w.wedding_date);
      const reminderDate = new Date(weddingDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      const reminderIso = reminderDate.toISOString().slice(0, 10);

      const { syncProjectCalendarEvent } = await import('./google-calendar-project.js');
      const result = await syncProjectCalendarEvent(pool, {
        photographerId: session.userId,
        projectId: `wedding-${weddingId}-charging`,
        title: `🔋 Lade batterier — ${w.couple_name} bryllup i morgen`,
        eventDate: reminderIso,
        description: `Sjekk at alle kamera-batterier, blits-batterier og minnekort er ladet/klargjort for morgendagens bryllup.`,
        clientName: null,
        clientEmail: null,
      });

      if (result.action === 'skipped' || result.action === 'noop') {
        return res.status(400).json({
          error: 'calendar_sync_failed',
          reason: result.reason ?? 'unknown',
          message: 'Kunne ikke opprette calendar-event. Sjekk at Google Workspace er koblet til.',
        });
      }

      res.json({
        success: true,
        reminderDate: reminderIso,
        calendarEventId: result.eventId,
        message: `Påminnelse satt for ${reminderDate.toLocaleDateString('nb-NO')} i din Google Calendar.`,
      });
    } catch (err) {
      console.error('[wedding-events] charging-reminder failed:', err);
      res.status(500).json({ error: 'reminder_failed' });
    }
  });

  // GET /api/wedding/:id/battery-estimate — beregn batteri-behov for hele bryllupet.
  // Summer estimerte shots per event, fordel på valgte kameraer, sammenlign mot
  // hver Stines battery_count + has_battery_grip. For blits: total trigger-count
  // fordeles på valgte blits-enheter, sjekker chargingTimeMinutes vs gap mellom events.
  app.get("/api/wedding/:id/battery-estimate", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      await ensureWeddingEventsSchema();

      // Hent alle events
      const eventsQ = await pool.query(
        `SELECT id, title, scheduled_time, duration_minutes, estimated_shots, equipment_ids
           FROM wedding_timeline_events
          WHERE wedding_id = $1
          ORDER BY scheduled_time ASC NULLS LAST`,
        [weddingId],
      );

      // Hent UNIK liste av equipment_ids brukt i events
      const allEquipmentIds = new Set<number>();
      for (const ev of eventsQ.rows) {
        if (Array.isArray(ev.equipment_ids)) {
          ev.equipment_ids.forEach((id: number) => allEquipmentIds.add(Number(id)));
        }
      }

      if (allEquipmentIds.size === 0) {
        return res.json({
          warnings: ['Ingen utstyr valgt på events ennå — legg til kameraer/blits per event for å se batteri-estimat.'],
          cameras: [], flashes: [], totals: { totalEstimatedShots: 0, totalFlashFires: 0 },
        });
      }

      // Hent utstyrs-data
      const eqQ = await pool.query(
        `SELECT id, category, brand, model, catalog_id, battery_count,
                has_battery_grip, battery_model
           FROM user_equipment
          WHERE id = ANY($1::int[]) AND user_id = $2`,
        [Array.from(allEquipmentIds), session.userId],
      );

      const { findCatalogEntry } = await import('./equipment-catalog.js');

      // Total estimerte shots
      const totalEstimatedShots = eventsQ.rows.reduce(
        (sum: number, ev: Record<string, unknown>) => sum + Number(ev.estimated_shots ?? 0),
        0,
      );

      // Per-event metadata for senere gap-analyse (blits charging)
      const eventsByTime = eventsQ.rows
        .filter((e) => e.scheduled_time)
        .sort((a, b) => new Date(a.scheduled_time as string).getTime() - new Date(b.scheduled_time as string).getTime());

      // === KAMERAER ===
      const cameras = eqQ.rows
        .filter((r) => r.category === 'camera_body')
        .map((r) => {
          const catalog = r.catalog_id ? findCatalogEntry(String(r.catalog_id)) : null;
          const batteryCount = Number(r.battery_count ?? 1);
          const hasGrip = !!r.has_battery_grip;
          const shotsPerBattery = catalog?.cipaBatteryShotsEvf ?? catalog?.cipaBatteryShots ?? 400;
          const gripMultiplier = hasGrip ? (catalog?.batteryGripMultiplier ?? 1.5) : 1.0;
          const totalCapacity = Math.round(shotsPerBattery * batteryCount * gripMultiplier);

          // Anta likedeling av shots mellom valgte kameraer (forenkling)
          const cameraCountInUse = eqQ.rows.filter((x) => x.category === 'camera_body').length;
          const shotsAssignedToThisCamera = cameraCountInUse > 0
            ? Math.round(totalEstimatedShots / cameraCountInUse) : totalEstimatedShots;

          const utilizationPct = totalCapacity > 0
            ? Math.round((shotsAssignedToThisCamera / totalCapacity) * 100) : 0;
          const shortage = Math.max(0, shotsAssignedToThisCamera - totalCapacity);
          const extraBatteriesNeeded = shortage > 0 && shotsPerBattery > 0
            ? Math.ceil(shortage / (shotsPerBattery * gripMultiplier)) : 0;

          const batteryModelFinal = r.battery_model ?? catalog?.batteryModel ?? null;
          return {
            equipmentId: r.id,
            label: `${r.brand} ${r.model}`,
            batteryModel: batteryModelFinal,
            batteryCount, hasBatteryGrip: hasGrip,
            shotsPerBattery,
            totalCapacity,
            estimatedShotsAssigned: shotsAssignedToThisCamera,
            utilizationPct,
            status: utilizationPct < 70 ? 'ok' : utilizationPct < 100 ? 'tight' : 'shortage',
            extraBatteriesNeeded,
            recommendation: extraBatteriesNeeded > 0
              ? `Bytt batteri ${extraBatteriesNeeded} ganger ila dagen — vurder å kjøpe ${extraBatteriesNeeded} ekstra ${r.battery_model ?? 'batterier'}.`
              : utilizationPct >= 70
                ? 'Bytt batteri på halvveis i dagen for trygghet.'
                : `God margin — ${100 - utilizationPct}% kapasitet til overs.`,
            // Slice 9X.26 — kjøps-lenker + ladings-påminnelse
            chargingReminder: 'Husk å lade alle batterier dagen før!',
            purchaseLinks: extraBatteriesNeeded > 0 || utilizationPct >= 80
              ? buildBatteryPurchaseLinks(batteryModelFinal) : [],
          };
        });

      // === BLITSER ===
      // Anta gjennomsnitt 30-40% av bilder bruker blits (1/32 power = fyll-blits)
      const flashFireRate = 0.35;
      const totalFlashFires = Math.round(totalEstimatedShots * flashFireRate);

      const flashes = eqQ.rows
        .filter((r) => r.category === 'flash')
        .map((r) => {
          const catalog = r.catalog_id ? findCatalogEntry(String(r.catalog_id)) : null;
          const flashCountInUse = eqQ.rows.filter((x) => x.category === 'flash').length;
          const firesAssigned = flashCountInUse > 0
            ? Math.round(totalFlashFires / flashCountInUse) : totalFlashFires;
          const firesPerCharge = catalog?.flashesAt32Power ?? catalog?.flashesPerCharge ?? 200;
          const batteryCount = Number(r.battery_count ?? 1);
          const totalCapacity = firesPerCharge * batteryCount;
          const utilizationPct = totalCapacity > 0 ? Math.round((firesAssigned / totalCapacity) * 100) : 0;
          const extraBatteriesNeeded = firesAssigned > totalCapacity && firesPerCharge > 0
            ? Math.ceil((firesAssigned - totalCapacity) / firesPerCharge) : 0;

          const isRechargeable = catalog?.isRechargeable ?? false;
          const chargingTime = catalog?.chargingTimeMinutes ?? null;

          // Sjekk om gap mellom events er nok for lading
          let canRechargeDuringEvent = false;
          if (isRechargeable && chargingTime && eventsByTime.length >= 2) {
            for (let i = 1; i < eventsByTime.length; i++) {
              const prevEnd = new Date(eventsByTime[i - 1].scheduled_time as string).getTime()
                + Number(eventsByTime[i - 1].duration_minutes ?? 30) * 60000;
              const nextStart = new Date(eventsByTime[i].scheduled_time as string).getTime();
              const gapMinutes = (nextStart - prevEnd) / 60000;
              if (gapMinutes >= chargingTime) {
                canRechargeDuringEvent = true;
                break;
              }
            }
          }

          let recommendation: string;
          if (extraBatteriesNeeded > 0) {
            if (isRechargeable && canRechargeDuringEvent && chargingTime) {
              recommendation = `Du kan lade batteri ila pauser (~${chargingTime} min ladings-tid). Eller ta med ${extraBatteriesNeeded} ekstra batterier.`;
            } else if (isRechargeable) {
              recommendation = `Lading tar ${chargingTime ?? '?'} min — for kort pause mellom events. Ta med ${extraBatteriesNeeded} ekstra batterier.`;
            } else {
              recommendation = `${r.brand} ${r.model} bruker ${catalog?.batteryType === 'aa-removable' ? 'AA-batterier' : 'enkeltbatterier'} — ta med ekstra sett (~${extraBatteriesNeeded * 4} AA om brukt 4-stk).`;
            }
          } else {
            recommendation = `God margin — ${100 - utilizationPct}% kapasitet til overs.`;
          }

          const isAaType = catalog?.batteryType === 'aa-removable';
          const flashBatteryModel = catalog?.batteryType === 'li-ion-removable'
            ? `${r.brand} ${r.model} batteri` : null;
          return {
            equipmentId: r.id,
            label: `${r.brand} ${r.model}`,
            batteryCount,
            batteryType: catalog?.batteryType ?? null,
            isRechargeable,
            chargingTimeMinutes: chargingTime,
            canRechargeDuringEvent,
            firesPerCharge,
            totalCapacity,
            estimatedFiresAssigned: firesAssigned,
            utilizationPct,
            status: utilizationPct < 70 ? 'ok' : utilizationPct < 100 ? 'tight' : 'shortage',
            extraBatteriesNeeded,
            recommendation,
            chargingReminder: isRechargeable ? 'Husk å lade alle batterier dagen før!' : null,
            purchaseLinks: extraBatteriesNeeded > 0 || utilizationPct >= 80
              ? (isAaType ? buildAaBatteryPurchaseLinks() : buildBatteryPurchaseLinks(flashBatteryModel))
              : [],
          };
        });

      res.json({
        totals: { totalEstimatedShots, totalFlashFires },
        cameras,
        flashes,
        eventCount: eventsQ.rowCount,
        assumptions: {
          flashFireRate: '35% av bilder bruker blits',
          cameraShotDistribution: 'Likedelt mellom alle valgte kameraer',
          evfPreferred: 'CIPA EVF-tall foretrekkes (lavest, mest realistisk for bryllup)',
        },
      });
    } catch (err) {
      console.error('[wedding-events] battery-estimate failed:', err);
      res.status(500).json({ error: 'estimate_failed' });
    }
  });

  // GET /api/wedding/:id/memory-cards — hent prosjektets registrerte memory-cards
  // fra projects.project_data.selectedMemoryCards (satt via ProjectCreationWithMemoryCards).
  // Brukes som picker-options når Stine velger kort for et event.
  app.get("/api/wedding/:id/memory-cards", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });
    try {
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const r = await pool.query(
        `SELECT p.project_data
           FROM wedding_timelines w
           JOIN projects p ON p.id = w.project_id
          WHERE w.id = $1 AND p.user_id = $2 LIMIT 1`,
        [weddingId, session.userId],
      );
      if ((r.rowCount ?? 0) === 0) return res.json({ cards: [] });
      const projectData = (r.rows[0].project_data ?? {}) as Record<string, unknown>;
      const selectedCards = Array.isArray(projectData.selectedMemoryCards)
        ? projectData.selectedMemoryCards
        : [];
      // Normaliser til { id, label } så frontend kan vise konsistent
      const cards = selectedCards
        .map((c: any, idx: number) => {
          const brand = c?.brand ?? c?.manufacturer ?? '';
          const type = c?.type ?? c?.cardType ?? '';
          const capacity = c?.capacity ?? '';
          const camera = c?.camera ?? c?.cameraName ?? '';
          const labelParts = [type, capacity, brand].filter(Boolean);
          const baseLabel = labelParts.join(' ') || `Kort ${idx + 1}`;
          const fullLabel = camera ? `${baseLabel} (${camera})` : baseLabel;
          return {
            id: c?.id ?? `card-${idx + 1}`,
            label: fullLabel,
            camera: camera || null,
            capacity: capacity || null,
            type: type || null,
          };
        });
      res.json({ cards });
    } catch (err) {
      console.error('[wedding-events] memory-cards fetch failed:', err);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  app.delete("/api/wedding/:id/timeline-events/:eventId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      await pool.query(`DELETE FROM wedding_event_comments WHERE event_id = $1`, [eventId]);
      const r = await pool.query(
        `DELETE FROM wedding_timeline_events WHERE id = $1 AND wedding_id = $2`,
        [eventId, weddingId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'event_not_found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[wedding-events] delete failed:', err);
      res.status(500).json({ error: 'delete_failed' });
    }
  });

  // Comments — fotograf
  app.get("/api/wedding/:id/timeline-events/:eventId/comments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const r = await pool.query(
        `SELECT * FROM wedding_event_comments WHERE event_id = $1 ORDER BY created_at ASC`,
        [eventId],
      );
      res.json({ comments: r.rows.map(serializeComment) });
    } catch (err) {
      console.error('[wedding-events] comments list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  app.post("/api/wedding/:id/timeline-events/:eventId/comments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'content_required' });
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const userQ = await pool.query(
        `SELECT email, first_name, last_name, company_name FROM users WHERE id = $1 LIMIT 1`,
        [session.userId],
      );
      const u = userQ.rows[0] ?? {};
      const r = await pool.query(
        `INSERT INTO wedding_event_comments
           (event_id, wedding_id, author_type, author_name, author_email, content)
         VALUES ($1, $2, 'photographer', $3, $4, $5) RETURNING *`,
        [
          eventId, weddingId,
          [u.first_name, u.last_name].filter(Boolean).join(' ') || u.company_name || 'Fotograf',
          u.email ?? null, content.slice(0, 5000),
        ],
      );
      res.status(201).json(serializeComment(r.rows[0]));
    } catch (err) {
      console.error('[wedding-events] photographer-comment failed:', err);
      res.status(500).json({ error: 'comment_failed' });
    }
  });

  // GET /api/wedding/:id/timeline-events/:eventId/photos
  // Slice 9X.23 — match capture_assets med event ved å sammenligne EXIF capture_time
  // mot event scheduled_time ± duration (med buffer-tider). Lar Stine se "alle
  // bilder tatt under vielsen" automatisk uten å manuelt tagge hvert bilde.
  app.get("/api/wedding/:id/timeline-events/:eventId/photos", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      // Hent event + tilhørende projectId for å avgrense søk
      const eventQ = await pool.query(
        `SELECT e.scheduled_time, e.duration_minutes, e.buffer_before_minutes,
                e.buffer_after_minutes, w.project_id
           FROM wedding_timeline_events e
           JOIN wedding_timelines w ON w.id = e.wedding_id
          WHERE e.id = $1 AND e.wedding_id = $2 LIMIT 1`,
        [eventId, weddingId],
      );
      if ((eventQ.rowCount ?? 0) === 0) return res.status(404).json({ error: 'event_not_found' });
      const ev = eventQ.rows[0];
      if (!ev.scheduled_time) return res.json({ photos: [], windowStart: null, windowEnd: null });

      // Window = scheduled_time - bufferBefore til scheduled_time + duration + bufferAfter
      const start = new Date(ev.scheduled_time);
      const windowStart = new Date(start.getTime() - (Number(ev.buffer_before_minutes ?? 0) * 60000));
      const windowEnd = new Date(start.getTime()
        + (Number(ev.duration_minutes ?? 30) * 60000)
        + (Number(ev.buffer_after_minutes ?? 0) * 60000));

      // Match capture_assets via capture_time (settet til EXIF DateTimeOriginal i Slice 9X.20)
      const photosQ = await pool.query(
        `SELECT a.id, a.original_filename, a.preview_key, a.full_key, a.capture_time,
                a.mime, a.size_bytes, a.exif, a.tags, a.rating, a.flagged_for_client
           FROM capture_assets a
           JOIN capture_sessions s ON s.id = a.session_id
          WHERE s.owner_user_id = $1
            AND s.project_id = $2
            AND a.deleted_at IS NULL
            AND a.capture_time >= $3::timestamptz
            AND a.capture_time <= $4::timestamptz
          ORDER BY a.capture_time ASC
          LIMIT 500`,
        [session.userId, ev.project_id, windowStart.toISOString(), windowEnd.toISOString()],
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

      // Re-sign R2 URLs for preview
      const { signAssetReadUrl } = await import('./capture-upload-service.js').catch(() => ({ signAssetReadUrl: null }));
      const photos = await Promise.all(
        photosQ.rows.map(async (row: Record<string, unknown>) => {
          let previewUrl: string | null = null;
          if (signAssetReadUrl && row.preview_key) {
            previewUrl = await signAssetReadUrl(String(row.preview_key)).catch(() => null);
          }
          return {
            id: row.id,
            filename: row.original_filename,
            captureTime: row.capture_time,
            previewUrl,
            mime: row.mime,
            sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
            exif: row.exif ?? null,
            tags: row.tags ?? [],
            rating: Number(row.rating ?? 0),
            flaggedForClient: !!row.flagged_for_client,
          };
        }),
      );
      res.json({
        photos,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        matchCount: photos.length,
      });
    } catch (err) {
      console.error('[wedding-events] photos match failed:', err);
      res.status(500).json({ error: 'photos_failed' });
    }
  });

  // GET /api/wedding/:id/all-photos — samlet visning av bilder gruppert per
  // event basert på EXIF capture_time + alle bilder uten event-match.
  // Stine bruker dette for å se hele bryllupsdagen i kronologisk rekkefølge.
  app.get("/api/wedding/:id/all-photos", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    try {
      await ensureWeddingEventsSchema();
      if (!(await assertPhotographerOwnsWedding(weddingId, session.userId))) {
        return res.status(404).json({ error: 'wedding_not_found' });
      }
      const weddingQ = await pool.query(
        `SELECT project_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [weddingId],
      );
      const projectId = weddingQ.rows[0]?.project_id;
      if (!projectId) return res.json({ groups: [], ungrouped: [], total: 0 });

      // Hent alle events for bryllupet
      const eventsQ = await pool.query(
        `SELECT id, title, scheduled_time, duration_minutes, buffer_before_minutes, buffer_after_minutes
           FROM wedding_timeline_events
          WHERE wedding_id = $1 AND scheduled_time IS NOT NULL
          ORDER BY scheduled_time ASC`,
        [weddingId],
      );
      const events = eventsQ.rows.map((e: Record<string, unknown>) => {
        const start = new Date(e.scheduled_time as string);
        const windowStart = new Date(start.getTime() - Number(e.buffer_before_minutes ?? 0) * 60000);
        const windowEnd = new Date(start.getTime()
          + Number(e.duration_minutes ?? 30) * 60000
          + Number(e.buffer_after_minutes ?? 0) * 60000);
        return {
          id: String(e.id),
          title: String(e.title),
          scheduledTime: e.scheduled_time,
          windowStart,
          windowEnd,
        };
      });

      // Hent ALLE bilder fra prosjektet (med capture_time)
      const photosQ = await pool.query(
        `SELECT a.id, a.original_filename, a.preview_key, a.capture_time,
                a.mime, a.size_bytes, a.exif, a.tags, a.rating, a.flagged_for_client
           FROM capture_assets a
           JOIN capture_sessions s ON s.id = a.session_id
          WHERE s.owner_user_id = $1
            AND s.project_id = $2
            AND a.deleted_at IS NULL
          ORDER BY a.capture_time ASC NULLS LAST
          LIMIT 5000`,
        [session.userId, projectId],
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

      const { signAssetReadUrl } = await import('./capture-upload-service.js').catch(() => ({ signAssetReadUrl: null }));

      // Bucket-isér bilder
      const grouped = new Map<string, Record<string, unknown>[]>();
      const ungrouped: Record<string, unknown>[] = [];
      for (const photo of photosQ.rows) {
        if (!photo.capture_time) {
          ungrouped.push(photo);
          continue;
        }
        const captureTs = new Date(photo.capture_time as string).getTime();
        const matchingEvent = events.find((e) =>
          captureTs >= e.windowStart.getTime() && captureTs <= e.windowEnd.getTime(),
        );
        if (matchingEvent) {
          if (!grouped.has(matchingEvent.id)) grouped.set(matchingEvent.id, []);
          grouped.get(matchingEvent.id)!.push(photo);
        } else {
          ungrouped.push(photo);
        }
      }

      async function serializePhoto(row: Record<string, unknown>) {
        let previewUrl: string | null = null;
        if (signAssetReadUrl && row.preview_key) {
          previewUrl = await signAssetReadUrl(String(row.preview_key)).catch(() => null);
        }
        return {
          id: row.id,
          filename: row.original_filename,
          captureTime: row.capture_time,
          previewUrl,
          mime: row.mime,
          sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
          exif: row.exif ?? null,
          tags: row.tags ?? [],
          rating: Number(row.rating ?? 0),
          flaggedForClient: !!row.flagged_for_client,
        };
      }

      const groups = await Promise.all(events.map(async (e) => ({
        eventId: e.id,
        eventTitle: e.title,
        scheduledTime: e.scheduledTime,
        windowStart: e.windowStart.toISOString(),
        windowEnd: e.windowEnd.toISOString(),
        photoCount: (grouped.get(e.id) ?? []).length,
        photos: await Promise.all((grouped.get(e.id) ?? []).map(serializePhoto)),
      })));

      const ungroupedPhotos = await Promise.all(ungrouped.map(serializePhoto));

      res.json({
        groups,
        ungrouped: ungroupedPhotos,
        total: photosQ.rows.length,
      });
    } catch (err) {
      console.error('[wedding-events] all-photos failed:', err);
      res.status(500).json({ error: 'all_photos_failed' });
    }
  });

  // Client-side endepunkter
  app.get("/api/wedding/client/:token/timeline-events", async (req, res) => {
    const token = String(req.params.token || '').trim();
    try {
      await ensureWeddingEventsSchema();
      const wedding = await lookupWeddingIdByToken(token);
      if (!wedding) return res.status(404).json({ error: 'not_found' });
      const eventsQ = await pool.query(
        `SELECT * FROM wedding_timeline_events
          WHERE wedding_id = $1 AND client_visible = true
          ORDER BY scheduled_time ASC NULLS LAST, sort_order ASC`,
        [wedding.id],
      );
      const commentsQ = await pool.query(
        `SELECT * FROM wedding_event_comments WHERE wedding_id = $1 ORDER BY created_at ASC`,
        [wedding.id],
      );
      const commentsByEvent = new Map<string, ReturnType<typeof serializeComment>[]>();
      for (const c of commentsQ.rows) {
        const key = String(c.event_id);
        if (!commentsByEvent.has(key)) commentsByEvent.set(key, []);
        commentsByEvent.get(key)!.push(serializeComment(c));
      }
      res.json({
        events: eventsQ.rows.map((row: Record<string, unknown>) => ({
          ...serializeEvent(row, false),
          comments: commentsByEvent.get(String(row.id)) ?? [],
        })),
      });
    } catch (err) {
      console.error('[wedding-events] client list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  app.post("/api/wedding/client/:token/timeline-events/:eventId/comments", async (req, res) => {
    const token = String(req.params.token || '').trim();
    const eventId = String(req.params.eventId || '').trim();
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const authorName = typeof req.body?.authorName === 'string' ? req.body.authorName.trim().slice(0, 100) : '';
    if (!content) return res.status(400).json({ error: 'content_required' });
    try {
      await ensureWeddingEventsSchema();
      const wedding = await lookupWeddingIdByToken(token);
      if (!wedding) return res.status(404).json({ error: 'not_found' });
      const evQ = await pool.query(
        `SELECT client_can_comment FROM wedding_timeline_events
          WHERE id = $1 AND wedding_id = $2 LIMIT 1`,
        [eventId, wedding.id],
      );
      if ((evQ.rowCount ?? 0) === 0) return res.status(404).json({ error: 'event_not_found' });
      if (!evQ.rows[0].client_can_comment) return res.status(403).json({ error: 'comments_disabled' });
      const r = await pool.query(
        `INSERT INTO wedding_event_comments
           (event_id, wedding_id, author_type, author_name, author_email, content)
         VALUES ($1, $2, 'client', $3, $4, $5) RETURNING *`,
        [
          eventId, wedding.id,
          authorName || wedding.coupleName,
          wedding.clientEmail, content.slice(0, 5000),
        ],
      );
      res.status(201).json(serializeComment(r.rows[0]));
    } catch (err) {
      console.error('[wedding-events] client-comment failed:', err);
      res.status(500).json({ error: 'comment_failed' });
    }
  });

  // POST /api/wedding/reminders/run — trigger reminder-runner manuelt eller via cron
  app.post("/api/wedding/reminders/run", async (req, res) => {
    // Krever enten admin-session ELLER en hemmelig header (for cron)
    const cronSecret = process.env.WEDDING_REMINDER_CRON_SECRET || '';
    const providedSecret = String(req.headers['x-cron-secret'] || '').trim();
    const isAdmin = (() => {
      try {
        const session = requireUserSession(req, res);
        return !!session;
      } catch { return false; }
    })();
    if (!isAdmin && (!cronSecret || providedSecret !== cronSecret)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    try {
      const { runWeddingReminders } = await import('./wedding-reminder-runner.js');
      const result = await runWeddingReminders(pool);
      res.json(result);
    } catch (err) {
      console.error('[wedding-reminders] run failed:', err);
      res.status(500).json({ error: 'run_failed' });
    }
  });

  // POST /api/wedding/:id/generate-shotlist — auto-genérer shot-list fra kultur
  app.post("/api/wedding/:id/generate-shotlist", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const weddingId = String(req.params.id || '').trim();
    if (!weddingId) return res.status(400).json({ error: 'id_required' });

    try {
      const r = await pool.query(
        `SELECT culture, project_id FROM wedding_timelines
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [weddingId, session.userId],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: 'wedding_not_found' });
      const { culture, project_id } = r.rows[0];
      if (!culture) return res.status(400).json({ error: 'no_culture_set' });

      const { getCultureTemplate, WEDDING_CULTURE_TEMPLATES } = await import('./wedding-culture-templates.js');
      const template = getCultureTemplate(culture);
      if (!template) return res.status(404).json({ error: 'culture_template_not_found' });

      // Inkluder shots fra norsk-kristen som fallback for templates med tom shots-array
      const shots = template.shots.length > 0
        ? template.shots
        : WEDDING_CULTURE_TEMPLATES['norsk-kristen'].shots;

      res.json({
        culture: template.id,
        eventCount: template.events.length,
        shotCount: shots.length,
        events: template.events,
        shots,
        message: `${shots.length} shots og ${template.events.length} events generert fra ${template.displayName}-template.`,
      });
    } catch (err) {
      console.error('[wedding-shotlist] generate failed:', err);
      res.status(500).json({ error: 'generate_failed' });
    }
  });
}
