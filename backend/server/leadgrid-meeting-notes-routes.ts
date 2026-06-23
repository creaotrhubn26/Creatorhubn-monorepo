/**
 * leadgrid-meeting-notes-routes.ts
 *
 * Endepunkter:
 *   POST   /api/leadgrid/leads/:id/meeting-notes/upload-audio   (voice memo)
 *   POST   /api/leadgrid/leads/:id/meeting-notes/from-text      (manuelt)
 *   GET    /api/leadgrid/leads/:id/meeting-notes                (liste)
 *   GET    /api/leadgrid/meeting-notes/:id                      (detalj)
 *   POST   /api/leadgrid/meeting-notes/:id/reprocess
 *   DELETE /api/leadgrid/meeting-notes/:id
 *
 * Auth: Bearer-token (activeSessions) + RBAC (meeting_notes.*).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  transcribeAudio,
  processMeetingNote,
} from "./leadgrid-meeting-notes-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit = req.body?.organization_id ?? req.query?.organization_id;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  // Avled fra lead-id i params
  const leadId = req.params?.id;
  if (typeof leadId === "string" && leadId.length > 0) {
    try {
      const r = await pool.query<{ organization_id: string | null }>(
        `SELECT cp.organization_id::text
           FROM crm_customers c
           LEFT JOIN casting_projects cp ON cp.id = c.project_id
          WHERE c.id = $1::uuid LIMIT 1`,
        [leadId],
      );
      if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
    } catch {
      /* ignore */
    }
  }
  // Brukerens default-org
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END, joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

export function registerLeadgridMeetingNotesRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };
  const permCreate = requireLeadMapPermission("meeting_notes.create", common);
  const permView = requireLeadMapPermission("meeting_notes.view", common);
  const permDelete = requireLeadMapPermission("meeting_notes.delete", common);

  // ─── Upload audio (base64 i body) ─────────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/meeting-notes/upload-audio",
    permCreate,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "mangler_organization_id" });
        return;
      }
      const b = req.body as {
        audio_base64?: string;
        duration_seconds?: number;
        language?: string;
      };
      if (!b.audio_base64) {
        res.status(400).json({ error: "mangler_audio_base64" });
        return;
      }
      try {
        const buf = Buffer.from(b.audio_base64, "base64");
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              audio_duration_seconds, processing_status)
           VALUES ($1::uuid, $2::uuid, $3, 'voice_memo', $4, 'transcribing')
           RETURNING id::text`,
          [req.params.id, orgId, session.userId, b.duration_seconds ?? null],
        );
        const noteId = insert.rows[0].id;

        // Fire-and-forget bakgrunns-prosessering (Whisper → Claude).
        // For en jobb-kø-implementasjon flytt dette til BullMQ/cron.
        void (async () => {
          const tx = await transcribeAudio(buf, b.language ?? "no");
          if (tx) {
            await pool.query(
              `UPDATE lead_meeting_notes
                  SET transcript=$1, transcript_language=$2
                WHERE id=$3::uuid`,
              [tx.transcript, tx.language, noteId],
            );
            await processMeetingNote(pool, noteId);
          } else {
            await pool.query(
              `UPDATE lead_meeting_notes
                  SET processing_status='failed',
                      error_message='Whisper feilet eller mangler nøkkel',
                      processed_at=NOW()
                WHERE id=$1::uuid`,
              [noteId],
            );
          }
        })().catch((err) =>
          console.warn("[meeting-notes] bakgrunns-prosess feilet:", err),
        );

        res.status(201).json({ meeting_note_id: noteId, status: "transcribing" });
      } catch (err) {
        res.status(500).json({ error: "upload_failed", detail: String(err) });
      }
    },
  );

  // ─── Manuell tekst-input (uten audio) ─────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/meeting-notes/from-text",
    permCreate,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "mangler_organization_id" });
        return;
      }
      const b = req.body as { transcript?: string; language?: string };
      if (!b.transcript) {
        res.status(400).json({ error: "mangler_transcript" });
        return;
      }
      try {
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              transcript, transcript_language, processing_status)
           VALUES ($1::uuid, $2::uuid, $3, 'manual', $4, $5, 'analyzing')
           RETURNING id::text`,
          [
            req.params.id,
            orgId,
            session.userId,
            b.transcript,
            b.language ?? "no",
          ],
        );
        const noteId = insert.rows[0].id;
        void processMeetingNote(pool, noteId).catch((err) =>
          console.warn("[meeting-notes] analyse feilet:", err),
        );
        res.status(201).json({ meeting_note_id: noteId, status: "analyzing" });
      } catch (err) {
        res.status(500).json({ error: "create_failed", detail: String(err) });
      }
    },
  );

  // ─── List notes for lead ─────────────────────────────────────────
  app.get(
    "/api/leadgrid/leads/:id/meeting-notes",
    permView,
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `SELECT id::text, source, summary, action_items, decisions,
                  next_steps, topics, participants, confidence,
                  processing_status, error_message,
                  created_at, processed_at,
                  transcript_language, audio_duration_seconds
             FROM lead_meeting_notes
            WHERE lead_id = $1::uuid
            ORDER BY created_at DESC LIMIT 50`,
          [req.params.id],
        );
        res.json({ notes: r.rows });
      } catch (err) {
        res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ─── Detail ──────────────────────────────────────────────────────
  app.get(
    "/api/leadgrid/meeting-notes/:id",
    permView,
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `SELECT id::text, lead_id::text, source, transcript, summary,
                  action_items, decisions, next_steps, topics, participants,
                  confidence, processing_status, error_message,
                  created_at, processed_at
             FROM lead_meeting_notes WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        if (r.rowCount === 0) {
          res.status(404).json({ error: "ikke_funnet" });
          return;
        }
        res.json({ note: r.rows[0] });
      } catch (err) {
        res.status(500).json({ error: "get_failed", detail: String(err) });
      }
    },
  );

  // ─── Re-process (kjør Claude på nytt mot eksisterende transcript) ──
  app.post(
    "/api/leadgrid/meeting-notes/:id/reprocess",
    permCreate,
    async (req: Request, res: Response) => {
      try {
        await pool.query(
          `UPDATE lead_meeting_notes
              SET processing_status='analyzing', error_message=NULL
            WHERE id=$1::uuid`,
          [req.params.id],
        );
        void processMeetingNote(pool, req.params.id).catch((err) =>
          console.warn("[meeting-notes] reprosess feilet:", err),
        );
        res.json({ status: "analyzing" });
      } catch (err) {
        res.status(500).json({ error: "reprocess_failed", detail: String(err) });
      }
    },
  );

  // ─── Delete ──────────────────────────────────────────────────────
  app.delete(
    "/api/leadgrid/meeting-notes/:id",
    permDelete,
    async (req: Request, res: Response) => {
      try {
        await pool.query(
          `DELETE FROM lead_meeting_notes WHERE id=$1::uuid`,
          [req.params.id],
        );
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: "delete_failed", detail: String(err) });
      }
    },
  );
}
