import express from "express";
import type { Pool } from "pg";
import { readString } from "./_shared";

export interface WeddingTimelineRoutesDeps {
  app: express.Application;
  pool: Pool;
  getUserIdFromAuth: (req: any) => string | null;
  resolveMeetingNotesProjectContext: (...args: any[]) => Promise<any>;
}

export function setupWeddingTimelineRoutes(
  deps: WeddingTimelineRoutesDeps,
): void {
  const {
    app,
    pool,
    getUserIdFromAuth,
    resolveMeetingNotesProjectContext,
  } = deps;

  function mapTimelineRow(r: any) {
    return {
      id: r.id,
      projectId: r.project_id || "",
      userId: r.user_id || "",
      weddingId: r.wedding_id || r.id,
      weddingDate: r.wedding_date || "",
      venue: r.venue || "",
      coupleName: r.couple_name || "",
      title: r.title || "",
      culture: r.culture || r.cultural_type || "norsk",
      culturalType: r.cultural_type || r.culture || "norsk",
      photographerId: r.photographer_id || r.user_id || "",
      status: r.status || "active",
      isActive: r.is_active !== false,
      clientAccessEnabled:
        r.client_access_enabled || r.is_client_access_enabled || false,
      clientAccessCode: r.client_access_code || "",
      clientAccessToken: r.client_access_token || "",
      photographerMessage: r.photographer_message || "",
      clientNotes: r.client_notes || "",
      timelineData: r.timeline_data || {},
      timelineItems: r.timeline_items || [],
      clientSettings: r.client_settings || {},
      events: [] as any[], // filled separately
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // Helper: map wedding_timeline_events row to camelCase
  function mapTimelineEventRow(r: any) {
    return {
      id: r.id,
      timelineId: r.timeline_id || "",
      title: r.title || "",
      time: r.event_time
        ? new Date(r.event_time).toTimeString().substring(0, 5)
        : "",
      eventTime: r.event_time,
      duration: r.duration_minutes || 0,
      durationMinutes: r.duration_minutes || 0,
      description: r.description || "",
      location: r.location || "",
      status: r.status || "planned",
      canClientEdit: r.can_client_edit || false,
      hasSpeech: false,
      participants: [],
      equipment: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  type MeetingTimelineSelection = {
    keyPoints?: boolean;
    actionItems?: boolean;
    decisions?: boolean;
    nextSteps?: boolean;
    clientRequests?: boolean;
    timeline?: boolean;
  };

  function readMeetingTimelineSelection(
    raw: unknown,
  ): Required<MeetingTimelineSelection> {
    const selection =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return {
      keyPoints: selection.keyPoints !== false,
      actionItems: selection.actionItems !== false,
      decisions: selection.decisions !== false,
      nextSteps: selection.nextSteps !== false,
      clientRequests: selection.clientRequests !== false,
      timeline: selection.timeline !== false,
    };
  }

  function readMeetingTimelineStructuredNotes(raw: unknown) {
    const value =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    const readVisibilityItems = (field: string) =>
      Array.isArray(value[field])
        ? value[field]
            .filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === "object" && !Array.isArray(item),
            )
            .map((item) => ({
              text: readString(item.text) || "",
              visibility:
                readString(item.visibility) === "client" ? "client" : "personal",
            }))
            .filter((item) => item.text)
        : [];

    const readActionItems = () =>
      Array.isArray(value.actionItems)
        ? value.actionItems
            .filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === "object" && !Array.isArray(item),
            )
            .map((item) => ({
              task: readString(item.task) || "",
              assignedTo: readString(item.assignedTo) || "",
              dueDate: readString(item.dueDate) || "",
              visibility:
                readString(item.visibility) === "client" ? "client" : "personal",
            }))
            .filter((item) => item.task)
        : [];

    const readTimelineItems = () =>
      Array.isArray(value.timeline)
        ? value.timeline
            .filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === "object" && !Array.isArray(item),
            )
            .map((item) => ({
              event: readString(item.event) || "",
              date: readString(item.date) || "",
              notes: readString(item.notes) || "",
              visibility:
                readString(item.visibility) === "client" ? "client" : "personal",
            }))
            .filter((item) => item.event)
        : [];

    const readStringList = (field: string) =>
      Array.isArray(value[field])
        ? value[field]
            .map((item) => readString(item))
            .filter((item): item is string => Boolean(item))
        : [];

    return {
      keyPoints: readVisibilityItems("keyPoints"),
      actionItems: readActionItems(),
      decisions: readVisibilityItems("decisions"),
      nextSteps: readVisibilityItems("nextSteps"),
      clientRequests: readStringList("clientRequests"),
      timeline: readTimelineItems(),
      personalReminders: readStringList("personalReminders"),
      technicalNotes: readStringList("technicalNotes"),
    };
  }

  function buildEvendiMeetingSyncDescription(params: {
    briefSummary?: string | null;
    specialRequests?: string | null;
    selectedSections: ReturnType<typeof readMeetingTimelineStructuredNotes>;
  }) {
    const sections: string[] = [];

    const pushSection = (title: string, lines: string[]) => {
      const filtered = lines.filter(Boolean);
      if (filtered.length === 0) {
        return;
      }
      sections.push(`${title}\n${filtered.map((line) => `- ${line}`).join("\n")}`);
    };

    const briefSummary = readString(params.briefSummary);
    const specialRequests = readString(params.specialRequests);
    if (briefSummary) {
      sections.push(`Prosjektbrief\n- ${briefSummary}`);
    }
    if (specialRequests && specialRequests !== briefSummary) {
      sections.push(`Kundeønsker\n- ${specialRequests}`);
    }

    pushSection(
      "Hovedpunkter fra møtet",
      params.selectedSections.keyPoints.map((item) => item.text),
    );
    pushSection(
      "Beslutninger",
      params.selectedSections.decisions.map((item) => item.text),
    );
    pushSection(
      "Oppgaver og oppfølging",
      params.selectedSections.actionItems.map((item) =>
        [item.task, item.assignedTo ? `(${item.assignedTo})` : "", item.dueDate ? `frist ${item.dueDate}` : ""]
          .filter(Boolean)
          .join(" "),
      ),
    );
    pushSection(
      "Neste steg",
      params.selectedSections.nextSteps.map((item) => item.text),
    );
    pushSection("Tidslinjepunkter", params.selectedSections.timeline.map((item) => {
      const dateLabel = item.date ? `${item.date}: ` : "";
      return `${dateLabel}${item.event}${item.notes ? ` — ${item.notes}` : ""}`;
    }));

    return sections.join("\n\n").trim();
  }

  function buildTimelineIcal(timeline: any, events: any[]) {
    const sanitize = (value: string) =>
      value
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
        .replace(/\n/g, "\\n");

    const formatUtc = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");

    const calendarName = sanitize(
      timeline?.coupleName || timeline?.title || "Wedding Timeline",
    );

    const eventBlocks = events.map((evt) => {
      const startDate = evt.event_time ? new Date(evt.event_time) : null;
      const endDate =
        startDate && evt.duration_minutes
          ? new Date(startDate.getTime() + evt.duration_minutes * 60000)
          : null;

      const lines = [
        "BEGIN:VEVENT",
        `UID:${evt.id}@creatorhubn`,
        `DTSTAMP:${formatUtc(new Date())}`,
        startDate ? `DTSTART:${formatUtc(startDate)}` : "",
        endDate ? `DTEND:${formatUtc(endDate)}` : "",
        `SUMMARY:${sanitize(evt.title || "Timeline Event")}`,
        evt.location ? `LOCATION:${sanitize(evt.location)}` : "",
        evt.description ? `DESCRIPTION:${sanitize(evt.description)}` : "",
        "END:VEVENT",
      ];

      return lines.filter(Boolean).join("\n");
    });

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CreatorHubN//Wedding Timeline//EN",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${calendarName}`,
      ...eventBlocks,
      "END:VCALENDAR",
    ].join("\n");
  }


  app.get("/api/wedding/timeline/project/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;

      // Find timeline by project_id
      const tlResult = await pool.query(
        "SELECT * FROM wedding_timelines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
        [projectId],
      );

      if (tlResult.rowCount === 0) {
        return res
          .status(404)
          .json({ error: "Ingen tidslinje funnet for dette prosjektet" });
      }

      const timeline = mapTimelineRow(tlResult.rows[0]);

      // Fetch events for this timeline
      const eventsResult = await pool.query(
        "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC",
        [timeline.id],
      );

      timeline.events = eventsResult.rows.map(mapTimelineEventRow);

      res.json(timeline);
    } catch (error) {
      console.error("Error fetching wedding timeline:", error);
      res.status(500).json({ error: "Kunne ikke hente bryllupstidslinje" });
    }
  });

  // Triage-fix: tre endpoints frontend-koden polled mot men som ikke
  // fantes (404-flom i prod-konsollen). Returnerer tomme-default-svar
  // så React Query får en valid respons og ikke logger feil. Når en
  // faktisk implementasjon trengs, erstatt disse stubene.
  app.get("/api/wedding-timeline", async (_req, res) => {
    // Frontend polled denne med ?contract_signature_status=pending —
    // ingen tilsvarende rute fantes. Tom liste avslutter polleren rent.
    res.json([]);
  });

  app.post("/api/wedding-timeline/sync-meeting-notes", async (req, res) => {
    try {
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const meetingId = readString(body.meetingId);
      const meetingTitle = readString(body.meetingTitle) || "Møtenotat";
      const meetingDate = readString(body.meetingDate);
      const projectId = readString(body.projectId);
      const incomingTimelineId = readString(body.weddingTimelineId);
      const selection = readMeetingTimelineSelection(body.selection);
      const structuredNotes = readMeetingTimelineStructuredNotes(body.structuredNotes);
      const projectContextPayload =
        body.projectContext && typeof body.projectContext === "object" && !Array.isArray(body.projectContext)
          ? (body.projectContext as Record<string, unknown>)
          : {};

      let timelineRow: any = null;
      if (incomingTimelineId) {
        const result = await pool.query(
          `SELECT * FROM wedding_timelines
           WHERE id = $1 OR wedding_id = $1 OR project_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [incomingTimelineId],
        );
        timelineRow = result.rows[0] || null;
      }

      if (!timelineRow && projectId) {
        const result = await pool.query(
          `SELECT * FROM wedding_timelines
           WHERE project_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [projectId],
        );
        timelineRow = result.rows[0] || null;
      }

      if (!timelineRow) {
        return res.status(404).json({ error: "Ingen Evendi-tidslinje funnet for prosjektet" });
      }

      const timeline = mapTimelineRow(timelineRow);
      const resolvedProjectContext = await resolveMeetingNotesProjectContext(
        projectId || timeline.projectId,
      );
      const briefSummary =
        readString(projectContextPayload.briefSummary) ||
        readString(projectContextPayload.inquirySummary) ||
        readString(projectContextPayload.specialRequests) ||
        readString(resolvedProjectContext?.request_summary) ||
        readString(resolvedProjectContext?.description);
      const specialRequests =
        readString(projectContextPayload.specialRequests) ||
        readString(resolvedProjectContext?.inquiry_special_requests);
      const clientName =
        readString(projectContextPayload.clientName) ||
        readString(resolvedProjectContext?.client_name) ||
        timeline.coupleName;
      const location =
        readString(projectContextPayload.location) ||
        readString(resolvedProjectContext?.inquiry_location) ||
        timeline.venue;
      const projectTitle =
        readString(projectContextPayload.projectTitle) ||
        readString(resolvedProjectContext?.title) ||
        timeline.title;

      const selectedSections = {
        keyPoints: selection.keyPoints ? structuredNotes.keyPoints : [],
        actionItems: selection.actionItems ? structuredNotes.actionItems : [],
        decisions: selection.decisions ? structuredNotes.decisions : [],
        nextSteps: selection.nextSteps ? structuredNotes.nextSteps : [],
        clientRequests: selection.clientRequests ? structuredNotes.clientRequests : [],
        timeline: selection.timeline ? structuredNotes.timeline : [],
        personalReminders: [],
        technicalNotes: [],
      };

      const syncDescription = buildEvendiMeetingSyncDescription({
        briefSummary,
        specialRequests,
        selectedSections,
      });

      const timelineData = timelineRow.timeline_data && typeof timelineRow.timeline_data === "object"
        ? (timelineRow.timeline_data as Record<string, unknown>)
        : {};

      const meetingContextPayload = {
        latestMeetingSync: {
          meetingId: meetingId || null,
          meetingTitle,
          syncedAt: new Date().toISOString(),
          baseMode: readString(body.baseMode) || "personal",
          projectTitle: projectTitle || null,
          clientName: clientName || null,
          briefSummary: briefSummary || null,
          specialRequests: specialRequests || null,
          location: location || null,
          selectedSections,
        },
        planningBrief: {
          title: projectTitle || null,
          clientName: clientName || null,
          summary: briefSummary || null,
          requests: specialRequests || null,
          location: location || null,
          eventDate:
            readString(projectContextPayload.eventDate) ||
            readString(resolvedProjectContext?.inquiry_event_date) ||
            timeline.weddingDate ||
            null,
          timeframe:
            readString(projectContextPayload.inquiryTimeframe) ||
            readString(resolvedProjectContext?.inquiry_timeframe) ||
            null,
        },
      };

      await pool.query(
        `UPDATE wedding_timelines
            SET timeline_data = COALESCE(timeline_data, '{}')::jsonb || $1::jsonb,
                updated_at = NOW()
          WHERE id = $2`,
        [JSON.stringify(meetingContextPayload), timeline.id],
      );

      const eventTitle = `Møtenotat: ${meetingTitle}`;
      const parsedEventTime = meetingDate ? new Date(meetingDate) : new Date();
      const eventTime = Number.isNaN(parsedEventTime.getTime())
        ? new Date()
        : parsedEventTime;

      const existingEvent = await pool.query(
        `SELECT id
           FROM wedding_timeline_events
          WHERE timeline_id = $1
            AND title = $2
          ORDER BY updated_at DESC
          LIMIT 1`,
        [timeline.id, eventTitle],
      );

      let eventRow: any;
      if (existingEvent.rows[0]) {
        const updated = await pool.query(
          `UPDATE wedding_timeline_events
              SET event_time = $2,
                  duration_minutes = $3,
                  description = $4,
                  location = $5,
                  status = 'planned',
                  updated_at = NOW()
            WHERE id = $1
            RETURNING *`,
          [
            existingEvent.rows[0].id,
            eventTime,
            30,
            syncDescription,
            location || "",
          ],
        );
        eventRow = updated.rows[0];
      } else {
        const inserted = await pool.query(
          `INSERT INTO wedding_timeline_events
            (id, timeline_id, title, event_time, duration_minutes, description, location, status, can_client_edit, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', false, NOW(), NOW())
           RETURNING *`,
          [
            crypto.randomUUID(),
            timeline.id,
            eventTitle,
            eventTime,
            30,
            syncDescription,
            location || "",
          ],
        );
        eventRow = inserted.rows[0];
      }

      if (meetingId) {
        await pool
          .query(
            `UPDATE meeting_notes
                SET wedding_timeline_id = $2,
                    timeline_updates = $3::jsonb,
                    updated_at = NOW()
              WHERE meeting_id = $1`,
            [
              meetingId,
              timeline.id,
              JSON.stringify(selectedSections.timeline),
            ],
          )
          .catch(() => undefined);
      }

      return res.json({
        success: true,
        timelineId: timeline.id,
        timelineTitle: timeline.title,
        syncedAt: new Date().toISOString(),
        syncedSections: Object.entries(selection)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key),
        contextSummary: {
          projectTitle: projectTitle || null,
          clientName: clientName || null,
          briefSummary: briefSummary || null,
          specialRequests: specialRequests || null,
        },
        event: mapTimelineEventRow(eventRow),
      });
    } catch (error) {
      console.error("Error syncing meeting notes to Evendi timeline:", error);
      return res.status(500).json({ error: "Kunne ikke synkronisere møtenotater til Evendi" });
    }
  });

  // GET /api/wedding/timeline/:timelineId/ical — iCal export for a timeline (token required)
  app.get("/api/wedding/timeline/:timelineId/ical", async (req, res) => {
    try {
      const { timelineId } = req.params;
      const token = typeof req.query.token === "string" ? req.query.token : "";

      const tlResult = await pool.query(
        "SELECT * FROM wedding_timelines WHERE id = $1 LIMIT 1",
        [timelineId],
      );

      if (tlResult.rowCount === 0) {
        return res.status(404).json({ error: "Tidslinje ikke funnet" });
      }

      const timeline = tlResult.rows[0];
      if (
        !timeline.client_access_enabled ||
        !token ||
        token !== timeline.client_access_token
      ) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }
      const eventsResult = await pool.query(
        "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC",
        [timelineId],
      );

      const ical = buildTimelineIcal(timeline, eventsResult.rows);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="timeline-${timelineId}.ics"`,
      );
      res.send(ical);
    } catch (error) {
      console.error("Error generating timeline iCal:", error);
      res.status(500).json({ error: "Kunne ikke generere iCal" });
    }
  });

  // GET /api/wedding/timeline/ical/:accessToken — iCal export by access token
  app.get("/api/wedding/timeline/ical/:accessToken", async (req, res) => {
    try {
      const { accessToken } = req.params;

      const tlResult = await pool.query(
        "SELECT * FROM wedding_timelines WHERE client_access_token = $1 LIMIT 1",
        [accessToken],
      );

      if (tlResult.rowCount === 0) {
        return res.status(404).json({ error: "Tidslinje ikke funnet" });
      }

      const timeline = tlResult.rows[0];
      if (!timeline.client_access_enabled) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }

      const eventsResult = await pool.query(
        "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC",
        [timeline.id],
      );

      const ical = buildTimelineIcal(timeline, eventsResult.rows);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="timeline-${timeline.id}.ics"`,
      );
      res.send(ical);
    } catch (error) {
      console.error("Error generating token timeline iCal:", error);
      res.status(500).json({ error: "Kunne ikke generere iCal" });
    }
  });

  // GET /api/wedding/timeline/project/:projectId/ical — iCal export for a project timeline (token required)
  app.get("/api/wedding/timeline/project/:projectId/ical", async (req, res) => {
    try {
      const { projectId } = req.params;
      const token = typeof req.query.token === "string" ? req.query.token : "";

      const tlResult = await pool.query(
        "SELECT * FROM wedding_timelines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
        [projectId],
      );

      if (tlResult.rowCount === 0) {
        return res.status(404).json({ error: "Tidslinje ikke funnet" });
      }

      const timeline = tlResult.rows[0];
      if (
        !timeline.client_access_enabled ||
        !token ||
        token !== timeline.client_access_token
      ) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }
      const eventsResult = await pool.query(
        "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC",
        [timeline.id],
      );

      const ical = buildTimelineIcal(timeline, eventsResult.rows);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="timeline-${timeline.id}.ics"`,
      );
      res.send(ical);
    } catch (error) {
      console.error("Error generating project timeline iCal:", error);
      res.status(500).json({ error: "Kunne ikke generere iCal" });
    }
  });

  // POST /api/wedding/timeline/project/:projectId — create timeline for a project
  app.post("/api/wedding/timeline/project/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromAuth(req);
      const { weddingDate, venue, coupleName, events, culturalType } = req.body;

      // Ensure project exists in public.projects (FK constraint)
      // Our projects live in legacy.projects but wedding_timelines FK references public.projects
      const pubCheck = await pool.query(
        "SELECT id FROM public.projects WHERE id = $1",
        [projectId],
      );
      if (pubCheck.rowCount === 0) {
        // Copy from legacy.projects or create a minimal record
        const legacyProj = await pool.query(
          "SELECT * FROM legacy.projects WHERE id = $1",
          [projectId],
        );
        if ((legacyProj.rowCount ?? 0) > 0) {
          const lp = legacyProj.rows[0];
          await pool.query(
            `INSERT INTO public.projects (id, title, slug, category, description, location, date, featured, published)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, true)
             ON CONFLICT (id) DO NOTHING`,
            [
              projectId,
              lp.title || "Bryllup",
              (lp.title || "bryllup")
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[æ]/g, "ae")
                .replace(/[ø]/g, "oe")
                .replace(/[å]/g, "aa"),
              lp.category || "photographer",
              lp.description || "",
              lp.location || "",
              lp.event_date || lp.date || "",
            ],
          );
        } else {
          await pool.query(
            `INSERT INTO public.projects (id, title, slug, category) VALUES ($1, $2, $3, 'photographer') ON CONFLICT (id) DO NOTHING`,
            [
              projectId,
              coupleName ? `Bryllup ${coupleName}` : "Nytt bryllup",
              `bryllup-${projectId.substring(0, 8)}`,
            ],
          );
        }
      }

      const timelineId = crypto.randomUUID();
      const weddingId = crypto.randomUUID();

      const result = await pool.query(
        `INSERT INTO wedding_timelines 
          (id, project_id, user_id, wedding_id, couple_name, wedding_date, venue, 
           cultural_type, culture, title, status, is_active, 
           timeline_data, client_settings, timeline_items,
           created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'active', true, 
                 '{}', '{}', '[]', NOW(), NOW())
         RETURNING *`,
        [
          timelineId,
          projectId,
          userId || "",
          weddingId,
          coupleName || "",
          weddingDate || null,
          venue || "",
          culturalType || "norsk",
          `Bryllupstidslinje - ${coupleName || "Nytt bryllup"}`,
        ],
      );

      const timeline = mapTimelineRow(result.rows[0]);

      // If initial events were passed, insert them
      if (events && Array.isArray(events) && events.length > 0) {
        for (const evt of events) {
          await pool.query(
            `INSERT INTO wedding_timeline_events 
              (id, timeline_id, title, event_time, duration_minutes, description, location, status, can_client_edit, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
            [
              crypto.randomUUID(),
              timelineId,
              evt.title || "",
              evt.time ? new Date(`${weddingDate}T${evt.time}`) : new Date(),
              evt.duration || 30,
              evt.description || "",
              evt.location || "",
              evt.status || "planned",
              evt.canClientEdit || false,
            ],
          );
        }
      }

      // Update project metadata to mark timeline as integrated
      await pool
        .query(
          `UPDATE legacy.projects SET 
          metadata = COALESCE(metadata, '{}')::jsonb || $1::jsonb,
          updated_at = NOW()
         WHERE id = $2`,
          [
            JSON.stringify({
              weddingTimelineId: timelineId,
              weddingTimelineIntegrated: true,
            }),
            projectId,
          ],
        )
        .catch(() => {});

      console.log(
        `💒 Bryllupstidslinje opprettet: "${timeline.title}" for prosjekt ${projectId}`,
      );
      res.status(201).json(timeline);
    } catch (error) {
      console.error("Error creating wedding timeline:", error);
      res.status(500).json({ error: "Kunne ikke opprette bryllupstidslinje" });
    }
  });

  app.get("/api/wedding-timeline/timelines/:weddingId", async (req, res) => {
    try {
      const { weddingId } = req.params;

      // Try by wedding_id first, then by project_id, then by id
      let result = await pool.query(
        "SELECT * FROM wedding_timelines WHERE wedding_id = $1 LIMIT 1",
        [weddingId],
      );
      if (result.rowCount === 0) {
        result = await pool.query(
          "SELECT * FROM wedding_timelines WHERE project_id = $1 OR id = $1 LIMIT 1",
          [weddingId],
        );
      }
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Tidslinje ikke funnet" });
      }

      const timeline = mapTimelineRow(result.rows[0]);

      const eventsResult = await pool.query(
        "SELECT * FROM wedding_timeline_events WHERE timeline_id = $1 ORDER BY event_time ASC",
        [timeline.id],
      );
      timeline.events = eventsResult.rows.map(mapTimelineEventRow);

      res.json(timeline);
    } catch (error) {
      console.error("Error fetching wedding timeline:", error);
      res.status(500).json({ error: "Kunne ikke hente tidslinje" });
    }
  });

  app.get("/api/wedding/timeline/templates", async (req, res) => {
    // Return a default Norwegian wedding template
    res.json({
      id: "template-norsk",
      weddingDate: "",
      venue: "",
      coupleName: "",
      culturalType: "norsk",
      events: [
        {
          id: "tpl-1",
          title: "Forberedelser brud",
          time: "10:00",
          duration: 120,
          description: "Hår, makeup og påkledning",
          location: "Hotell",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-2",
          title: "Forberedelser brudgom",
          time: "11:00",
          duration: 60,
          description: "Påkledning og forberedelser",
          location: "Hotell",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-3",
          title: "First Look",
          time: "12:30",
          duration: 30,
          description: "Første møte mellom brud og brudgom",
          location: "Hage/Park",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-4",
          title: "Vielse",
          time: "14:00",
          duration: 45,
          description: "Seremoni",
          location: "Kirke",
          status: "planned",
          hasSpeech: true,
        },
        {
          id: "tpl-5",
          title: "Gruppefoto",
          time: "15:00",
          duration: 30,
          description: "Familiebilder og gjester",
          location: "Utenfor kirken",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-6",
          title: "Brudepar-fotografering",
          time: "15:30",
          duration: 60,
          description: "Portretter av brudeparet",
          location: "Parkområde",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-7",
          title: "Ankomst middag",
          time: "17:00",
          duration: 30,
          description: "Velkomstdrikk og plassering",
          location: "Festlokale",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-8",
          title: "Middag",
          time: "17:30",
          duration: 120,
          description: "Treretters middag med taler",
          location: "Festlokale",
          status: "planned",
          hasSpeech: true,
        },
        {
          id: "tpl-9",
          title: "Kakeseremoni",
          time: "19:30",
          duration: 20,
          description: "Kakeskjæring og servering",
          location: "Festlokale",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-10",
          title: "Første dans",
          time: "20:00",
          duration: 15,
          description: "Brudevalsen",
          location: "Dansegulv",
          status: "planned",
          hasSpeech: false,
        },
        {
          id: "tpl-11",
          title: "Fest og dans",
          time: "20:15",
          duration: 180,
          description: "Fri dans og feiring",
          location: "Festlokale",
          status: "planned",
          hasSpeech: false,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}
