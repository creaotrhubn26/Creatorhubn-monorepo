import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { readString } from "./_shared";

export interface MeetingNotesRoutesDeps {
  app: express.Application;
  pool: Pool;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  getUserIdFromAuth: (req: any) => string | null;
  compatResolveUserId: (req: express.Request) => string;
  normalizeJsonObjectField: (value: unknown) => Record<string, unknown> | null;
  resolveMeetingNotesProjectContext: (
    projectId: string | null,
  ) => Promise<any>;
  buildLocalMeetingNotesAiResult: (input: any) => any;
  requestMeetingNotesAiResult: (input: any) => Promise<any>;
  buildLocalMeetingWritingAssist: (input: any) => any;
  requestMeetingWritingAssist: (input: any) => Promise<any>;
  ensureMeetingNotesCompatibilitySchema: () => Promise<void>;
  mapMeetingNotesRecord: (row: any) => any;
  normalizeMeetingNotesPayload: (
    input: any,
    creatorId: string,
  ) => Promise<any>;
  syncMeetingNotesToCustomerDrive: (
    row: any,
    creatorId: string,
  ) => Promise<any>;
  syncNotebookLmWorkspaceForMeetingNote: (
    pool: Pool,
    row: any,
    creatorId: string,
  ) => Promise<void>;
  syncMeetingNotesLifecycleArtifacts: (
    row: any,
    creatorId: string,
  ) => Promise<void>;
}

export function setupMeetingNotesRoutes(
  deps: MeetingNotesRoutesDeps,
): void {
  const {
    app,
    pool,
    isRecord,
    getUserIdFromAuth,
    compatResolveUserId,
    normalizeJsonObjectField,
    resolveMeetingNotesProjectContext,
    buildLocalMeetingNotesAiResult,
    requestMeetingNotesAiResult,
    buildLocalMeetingWritingAssist,
    requestMeetingWritingAssist,
    ensureMeetingNotesCompatibilitySchema,
    mapMeetingNotesRecord,
    normalizeMeetingNotesPayload,
    syncMeetingNotesToCustomerDrive,
    syncNotebookLmWorkspaceForMeetingNote,
    syncMeetingNotesLifecycleArtifacts,
  } = deps;

  app.post("/api/meeting-notes/ai-process", async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const mode: any =
        readString(body.mode) === "summarize" ? "summarize" : "full";
      const personalNotes = readString(body.personalNotes) || "";
      const clientVisibleNotes = readString(body.clientVisibleNotes) || "";
      const profession = readString(body.profession) || "photographer";
      const projectId = readString(body.projectId);
      const projectContext =
        await resolveMeetingNotesProjectContext(projectId);
      const projectTitle =
        readString(body.projectTitle) ||
        readString(projectContext?.title) ||
        readString(projectContext?.name);
      const clientName =
        readString(body.clientName) ||
        readString(projectContext?.client_name);
      const meetingTitle = readString(body.meetingTitle);
      const projectBrief =
        readString(body.projectBrief) ||
        readString(projectContext?.request_summary) ||
        readString(projectContext?.description);
      const writingStats = isRecord(body.writingStats)
        ? body.writingStats
        : {};

      const localResult = buildLocalMeetingNotesAiResult({
        personalNotes,
        clientVisibleNotes,
        mode,
        projectTitle,
        clientName,
        meetingTitle,
        projectBrief,
      });
      const llmResult = await requestMeetingNotesAiResult({
        profession,
        mode,
        personalNotes,
        clientVisibleNotes,
        projectTitle,
        clientName,
        meetingTitle,
        projectBrief,
        writingStats,
      });

      return res.json(llmResult || localResult);
    } catch (error) {
      console.error("Meeting notes AI process error:", error);
      return res
        .status(500)
        .json({ error: "Failed to process meeting notes with AI" });
    }
  });

  app.post("/api/meeting-notes/writing-assist", async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const text = readString(body.text) || "";
      const profession = readString(body.profession) || "photographer";
      const projectId = readString(body.projectId);
      const projectContext =
        await resolveMeetingNotesProjectContext(projectId);
      const mode: any =
        readString(body.mode) === "client" ? "client" : "personal";
      const writingStats = isRecord(body.writingStats)
        ? body.writingStats
        : {};
      const preferredStructure = readString(writingStats.preferredStructure);
      const formalityLevel = readString(writingStats.formalityLevel);
      const projectTitle =
        readString(body.projectTitle) ||
        readString(projectContext?.title) ||
        readString(projectContext?.name);
      const clientName =
        readString(body.clientName) ||
        readString(projectContext?.client_name);
      const meetingTitle = readString(body.meetingTitle);
      const projectBrief =
        readString(body.projectBrief) ||
        readString(projectContext?.request_summary) ||
        readString(projectContext?.description);
      const commonPhrases = Array.isArray(writingStats.commonPhrases)
        ? writingStats.commonPhrases
            .map((item: unknown) => readString(item) || "")
            .filter(Boolean)
        : [];

      const localResult = buildLocalMeetingWritingAssist({
        text,
        profession,
        mode,
        preferredStructure,
        projectTitle,
        clientName,
        projectBrief,
      });
      const llmResult = await requestMeetingWritingAssist({
        text,
        profession,
        mode,
        preferredStructure,
        formalityLevel,
        commonPhrases,
        projectTitle,
        clientName,
        meetingTitle,
        projectBrief,
      });

      return res.json(llmResult || localResult);
    } catch (error) {
      console.error("Meeting notes writing assist error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch writing assistance" });
    }
  });

  app.get("/api/meeting-notes", async (req, res) => {
    try {
      await ensureMeetingNotesCompatibilitySchema();

      const meetingId = readString(req.query.meetingId);
      const creatorId =
        readString(req.query.creatorId) ||
        getUserIdFromAuth(req) ||
        compatResolveUserId(req);

      if (meetingId) {
        const single = await pool.query(
          `SELECT * FROM meeting_notes WHERE meeting_id = $1 LIMIT 1`,
          [meetingId],
        );
        if (single.rows[0]) {
          return res.json(mapMeetingNotesRecord(single.rows[0]));
        }
        return res.status(404).json({ error: "Meeting notes not found" });
      }

      const result = creatorId
        ? await pool.query(
            `SELECT * FROM meeting_notes WHERE creator_id = $1 ORDER BY updated_at DESC LIMIT 50`,
            [creatorId],
          )
        : await pool.query(
            `SELECT * FROM meeting_notes ORDER BY updated_at DESC LIMIT 50`,
          );

      return res.json({ notes: result.rows.map(mapMeetingNotesRecord) });
    } catch (error) {
      console.error("Meeting notes fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch meeting notes" });
    }
  });

  app.get("/api/meeting-notes/:meetingId", async (req, res) => {
    try {
      await ensureMeetingNotesCompatibilitySchema();
      const result = await pool.query(
        `SELECT * FROM meeting_notes WHERE meeting_id = $1 OR id::text = $1 ORDER BY updated_at DESC LIMIT 1`,
        [req.params.meetingId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Meeting notes not found" });
      }
      return res.json(mapMeetingNotesRecord(result.rows[0]));
    } catch (error) {
      console.error("Meeting notes get error:", error);
      return res.status(500).json({ error: "Failed to fetch meeting notes" });
    }
  });

  app.post("/api/meeting-notes", async (req, res) => {
    try {
      await ensureMeetingNotesCompatibilitySchema();
      const creatorId = getUserIdFromAuth(req) || compatResolveUserId(req);
      const payload = await normalizeMeetingNotesPayload(
        req.body || {},
        creatorId,
      );

      const result = await pool.query(
        `INSERT INTO meeting_notes (
           id, user_id, creator_id, title, content, note_type, position, size, style, metadata,
           meeting_id, project_id, wedding_timeline_id, client_id, profession, meeting_title, meeting_date,
           meeting_duration, meeting_type, meeting_location, personal_notes, client_notes, practical_info,
           action_items, decisions, follow_up_tasks, participants, agenda, next_steps,
           ai_summary, ai_tags, ai_sentiment, ai_key_topics, timeline_updates,
           is_client_visible, position_x, position_y, width, height, color, created_by,
           vendor_info, equipment_needs, client_access_level, is_archived, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
           $11, $12, $13, $14, $15, $16, $17,
           $18, $19, $20, $21, $22, $23,
           $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28::jsonb, $29::jsonb,
           $30, $31::jsonb, $32, $33::jsonb, $34::jsonb,
           $35, $36, $37, $38, $39, $40, $41,
           $42::jsonb, $43::jsonb, $44, $45, NOW(), NOW()
         )
         RETURNING *`,
        [
          crypto.randomUUID(),
          payload.creatorId,
          payload.creatorId,
          payload.meetingTitle,
          readString(payload.personalNotes?.content) || "",
          payload.meetingType,
          JSON.stringify({ x: 0, y: 0, z: 0 }),
          JSON.stringify({ width: 200, height: 150 }),
          JSON.stringify({
            fontSize: "14px",
            textColor: "#333333",
            fontFamily: "Inter",
          }),
          JSON.stringify({ source: "meeting-notes-api" }),
          payload.meetingId,
          payload.projectId,
          payload.weddingTimelineId,
          payload.clientId,
          payload.profession,
          payload.meetingTitle,
          payload.meetingDate.toISOString().slice(0, 10),
          payload.meetingDuration,
          payload.meetingType,
          payload.meetingLocation,
          JSON.stringify(payload.personalNotes),
          JSON.stringify(payload.clientNotes || {}),
          JSON.stringify(payload.practicalInfo || {}),
          JSON.stringify(payload.actionItems || []),
          JSON.stringify(payload.decisions || []),
          JSON.stringify(payload.actionItems || []),
          JSON.stringify(payload.vendorInfo?.attendees || []),
          JSON.stringify([]),
          JSON.stringify(payload.nextSteps || []),
          payload.aiSummary,
          JSON.stringify(payload.aiTags || []),
          payload.aiSentiment,
          JSON.stringify(payload.aiKeyTopics || []),
          JSON.stringify(payload.timelineUpdates || []),
          payload.isClientVisible,
          0,
          0,
          200,
          150,
          "#ffeb3b",
          payload.creatorId,
          JSON.stringify(payload.vendorInfo || {}),
          JSON.stringify(payload.equipmentNeeds || {}),
          payload.clientAccessLevel,
          false,
        ],
      );

      const syncedRow = await syncMeetingNotesToCustomerDrive(
        result.rows[0],
        creatorId,
      );
      await syncNotebookLmWorkspaceForMeetingNote(
        pool,
        syncedRow,
        creatorId,
      ).catch((error) => {
        console.warn(
          "NotebookLM workspace sync skipped on create:",
          error instanceof Error ? error.message : error,
        );
      });
      await syncMeetingNotesLifecycleArtifacts(syncedRow, creatorId);
      return res.status(201).json(mapMeetingNotesRecord(syncedRow));
    } catch (error) {
      console.error("Meeting notes create error:", error);
      return res
        .status(500)
        .json({ error: "Failed to create meeting notes" });
    }
  });

  app.put("/api/meeting-notes/:meetingId", async (req, res) => {
    try {
      await ensureMeetingNotesCompatibilitySchema();
      const creatorId = getUserIdFromAuth(req) || compatResolveUserId(req);
      const existingResult = await pool.query(
        `SELECT * FROM meeting_notes WHERE meeting_id = $1 OR id::text = $1 ORDER BY updated_at DESC LIMIT 1`,
        [req.params.meetingId],
      );
      if (existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Meeting notes not found" });
      }

      const existing = existingResult.rows[0];
      const payload = await normalizeMeetingNotesPayload(
        {
          ...existing,
          ...req.body,
          meetingId: existing.meeting_id,
          meetingTitle: req.body?.meetingTitle || existing.meeting_title,
          projectId: req.body?.projectId || existing.project_id,
          clientId: req.body?.clientId || existing.client_id,
        },
        creatorId,
      );

      const result = await pool.query(
        `UPDATE meeting_notes
            SET project_id = $2,
                wedding_timeline_id = $3,
                client_id = $4,
                profession = $5,
                title = $6,
                content = $7,
                note_type = $8,
                meeting_title = $9,
                meeting_date = $10,
                meeting_duration = $11,
                meeting_type = $12,
                meeting_location = $13,
                personal_notes = $14,
                client_notes = $15,
                practical_info = $16,
                action_items = $17::jsonb,
                decisions = $18::jsonb,
                follow_up_tasks = $19::jsonb,
                participants = $20::jsonb,
                agenda = $21::jsonb,
                next_steps = $22::jsonb,
                ai_summary = $23,
                ai_tags = $24::jsonb,
                ai_sentiment = $25,
                ai_key_topics = $26::jsonb,
                timeline_updates = $27::jsonb,
                is_client_visible = $28,
                created_by = $29,
                vendor_info = $30::jsonb,
                equipment_needs = $31::jsonb,
                client_access_level = $32,
                updated_at = NOW()
          WHERE meeting_id = $1
          RETURNING *`,
        [
          existing.meeting_id,
          payload.projectId,
          payload.weddingTimelineId,
          payload.clientId,
          payload.profession,
          payload.meetingTitle,
          readString(payload.personalNotes?.content) || "",
          payload.meetingType,
          payload.meetingTitle,
          payload.meetingDate.toISOString().slice(0, 10),
          payload.meetingDuration,
          payload.meetingType,
          payload.meetingLocation,
          JSON.stringify(payload.personalNotes),
          JSON.stringify(payload.clientNotes || {}),
          JSON.stringify(payload.practicalInfo || {}),
          JSON.stringify(payload.actionItems || []),
          JSON.stringify(payload.decisions || []),
          JSON.stringify(payload.actionItems || []),
          JSON.stringify(payload.vendorInfo?.attendees || []),
          JSON.stringify([]),
          JSON.stringify(payload.nextSteps || []),
          payload.aiSummary,
          JSON.stringify(payload.aiTags || []),
          payload.aiSentiment,
          JSON.stringify(payload.aiKeyTopics || []),
          JSON.stringify(payload.timelineUpdates || []),
          payload.isClientVisible,
          payload.creatorId,
          JSON.stringify(payload.vendorInfo || {}),
          JSON.stringify(payload.equipmentNeeds || {}),
          payload.clientAccessLevel,
        ],
      );

      const syncedRow = await syncMeetingNotesToCustomerDrive(
        result.rows[0],
        creatorId,
      );
      await syncNotebookLmWorkspaceForMeetingNote(
        pool,
        syncedRow,
        creatorId,
      ).catch((error) => {
        console.warn(
          "NotebookLM workspace sync skipped on update:",
          error instanceof Error ? error.message : error,
        );
      });
      return res.json(mapMeetingNotesRecord(syncedRow));
    } catch (error) {
      console.error("Meeting notes update error:", error);
      return res
        .status(500)
        .json({ error: "Failed to update meeting notes" });
    }
  });

  app.post("/api/meeting-notes/google-backup", async (req, res) => {
    try {
      await ensureMeetingNotesCompatibilitySchema();
      const creatorId = getUserIdFromAuth(req) || compatResolveUserId(req);
      const meetingId = readString(req.body?.meetingId);
      if (!meetingId) {
        return res.status(400).json({ error: "meetingId is required" });
      }

      let recordResult = await pool.query(
        `SELECT * FROM meeting_notes WHERE meeting_id = $1 LIMIT 1`,
        [meetingId],
      );

      if (recordResult.rows.length === 0) {
        const payload = await normalizeMeetingNotesPayload(
          {
            ...(normalizeJsonObjectField(req.body?.notes) || {}),
            meetingId,
            projectId: req.body?.projectId,
            profession: req.body?.profession,
            title: "Møtenotat",
          },
          creatorId,
        );

        recordResult = await pool.query(
          `INSERT INTO meeting_notes (
             id, user_id, creator_id, title, content, note_type, position, size, style, metadata,
             meeting_id, project_id, wedding_timeline_id, client_id, profession, meeting_title, meeting_date,
             meeting_type, personal_notes, client_notes, practical_info, action_items, decisions, follow_up_tasks,
             participants, agenda, next_steps, ai_summary, ai_tags, ai_key_topics, timeline_updates,
             is_client_visible, position_x, position_y, width, height, color, created_by,
             vendor_info, equipment_needs, client_access_level, is_archived, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
             $11, $12, $13, $14, $15, $16, $17,
             $18, $19, $20, $21, $22::jsonb, $23::jsonb, $24::jsonb,
             $25::jsonb, $26::jsonb, $27::jsonb, $28, $29::jsonb, $30::jsonb, $31::jsonb,
             $32, $33, $34, $35, $36, $37, $38,
             $39::jsonb, $40::jsonb, $41, $42, NOW(), NOW()
           )
           RETURNING *`,
          [
            crypto.randomUUID(),
            payload.creatorId,
            payload.creatorId,
            payload.meetingTitle,
            readString(payload.personalNotes?.content) || "",
            payload.meetingType,
            JSON.stringify({ x: 0, y: 0, z: 0 }),
            JSON.stringify({ width: 200, height: 150 }),
            JSON.stringify({
              fontSize: "14px",
              textColor: "#333333",
              fontFamily: "Inter",
            }),
            JSON.stringify({ source: "meeting-notes-backup" }),
            payload.meetingId,
            payload.projectId,
            payload.weddingTimelineId,
            payload.clientId,
            payload.profession,
            payload.meetingTitle,
            payload.meetingDate.toISOString().slice(0, 10),
            payload.meetingType,
            JSON.stringify(payload.personalNotes),
            JSON.stringify(payload.clientNotes || {}),
            JSON.stringify(payload.practicalInfo || {}),
            JSON.stringify(payload.actionItems || []),
            JSON.stringify(payload.decisions || []),
            JSON.stringify(payload.actionItems || []),
            JSON.stringify(payload.vendorInfo?.attendees || []),
            JSON.stringify([]),
            JSON.stringify(payload.nextSteps || []),
            payload.aiSummary,
            JSON.stringify(payload.aiTags || []),
            JSON.stringify(payload.aiKeyTopics || []),
            JSON.stringify(payload.timelineUpdates || []),
            payload.isClientVisible,
            0,
            0,
            200,
            150,
            "#ffeb3b",
            payload.creatorId,
            JSON.stringify(payload.vendorInfo || {}),
            JSON.stringify(payload.equipmentNeeds || {}),
            payload.clientAccessLevel,
            false,
          ],
        );
      }

      const syncedRow = await syncMeetingNotesToCustomerDrive(
        recordResult.rows[0],
        creatorId,
      );
      await syncNotebookLmWorkspaceForMeetingNote(
        pool,
        syncedRow,
        creatorId,
      ).catch((error) => {
        console.warn(
          "NotebookLM workspace sync skipped on backup:",
          error instanceof Error ? error.message : error,
        );
      });
      return res.json({
        success: true,
        note: mapMeetingNotesRecord(syncedRow),
      });
    } catch (error) {
      console.error("Meeting notes Google backup error:", error);
      return res
        .status(500)
        .json({ error: "Failed to sync meeting notes to Google Drive" });
    }
  });
}
