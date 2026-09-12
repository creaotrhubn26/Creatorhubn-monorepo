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
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  transcribeAudio,
  processMeetingNote,
  type MeetingNoteProcessingScope,
} from "./leadgrid-meeting-notes-service.js";
import { emitWebhook } from "./webhook-emitter.js";
import {
  parseOr400,
  fromTextBody,
  uploadAudioBody,
} from "./leadgrid-validators.js";

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

type MeetingNotePermission =
  | "meeting_notes.create"
  | "meeting_notes.view"
  | "meeting_notes.delete";

async function authorizeLead(
  pool: Pool,
  userId: string,
  leadId: string,
  permission: MeetingNotePermission,
  res: Response,
): Promise<MeetingNoteProcessingScope | null> {
  const lead = await loadAccessibleLeadgridLead(pool, { leadId, userId });
  if (!lead) {
    res.status(404).json({ error: "ikke_funnet" });
    return null;
  }
  const access = await resolveEffectivePermissions(
    pool,
    lead.organizationId,
    userId,
  );
  if (!access.role || !access.permissions.has(permission)) {
    res.status(403).json({
      error: "mangler_tillatelse",
      required: permission,
    });
    return null;
  }
  return {
    noteId: "",
    leadId: lead.id,
    organizationId: lead.organizationId,
    projectId: lead.projectId,
  };
}

async function loadMeetingNoteScope(
  pool: Pool,
  noteId: string,
): Promise<MeetingNoteProcessingScope | null> {
  const result = await pool.query<{
    id: string;
    lead_id: string;
    organization_id: string;
    project_id: string;
  }>(
    `SELECT mn.id::text,
            mn.lead_id::text,
            mn.organization_id::text,
            lead.project_id::text
       FROM lead_meeting_notes mn
       JOIN crm_customers lead
         ON lead.id = mn.lead_id
        AND lead.organization_id = mn.organization_id
      WHERE mn.id = $1::uuid
        AND lead.project_id IS NOT NULL
      LIMIT 1`,
    [noteId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    noteId: row.id,
    leadId: row.lead_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
  };
}

async function authorizeMeetingNote(
  pool: Pool,
  userId: string,
  noteId: string,
  permission: MeetingNotePermission,
  res: Response,
): Promise<MeetingNoteProcessingScope | null> {
  const persisted = await loadMeetingNoteScope(pool, noteId);
  if (!persisted) {
    res.status(404).json({ error: "ikke_funnet" });
    return null;
  }
  const accessible = await authorizeLead(
    pool,
    userId,
    persisted.leadId,
    permission,
    res,
  );
  if (!accessible) return null;
  if (
    accessible.leadId !== persisted.leadId ||
    accessible.organizationId !== persisted.organizationId ||
    accessible.projectId !== persisted.projectId
  ) {
    res.status(404).json({ error: "ikke_funnet" });
    return null;
  }
  return persisted;
}

async function markMeetingNoteFailed(
  pool: Pool,
  scope: MeetingNoteProcessingScope,
  errorMessage: string,
): Promise<void> {
  await pool.query(
    `UPDATE lead_meeting_notes
        SET processing_status='failed',
            error_message=$1,
            processed_at=NOW()
      WHERE id=$2::uuid
        AND lead_id=$3::uuid
        AND organization_id=$4::uuid
        AND EXISTS (
          SELECT 1
            FROM crm_customers lead
           WHERE lead.id = lead_meeting_notes.lead_id
             AND lead.organization_id = lead_meeting_notes.organization_id
             AND lead.project_id = $5
        )`,
    [
      errorMessage.slice(0, 500),
      scope.noteId,
      scope.leadId,
      scope.organizationId,
      scope.projectId,
    ],
  );
}

export function registerLeadgridMeetingNotesRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ─── Upload audio (base64 i body) ─────────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/meeting-notes/upload-audio",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const b = parseOr400(uploadAudioBody, req.body, res);
      if (!b) return;
      const leadId = req.params.id;
      try {
        const authorized = await authorizeLead(
          pool,
          session.userId,
          leadId,
          "meeting_notes.create",
          res,
        );
        if (!authorized) return;
        const buf = Buffer.from(b.audio_base64, "base64");
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              audio_duration_seconds, processing_status)
           SELECT lead.id, lead.organization_id, $4, 'voice_memo', $5,
                  'transcribing'
             FROM crm_customers lead
            WHERE lead.id = $1::uuid
              AND lead.organization_id = $2::uuid
              AND lead.project_id = $3
           RETURNING id::text`,
          [
            authorized.leadId,
            authorized.organizationId,
            authorized.projectId,
            session.userId,
            b.duration_seconds ?? null,
          ],
        );
        const noteId = insert.rows[0]?.id;
        if (!noteId) {
          res.status(404).json({ error: "ikke_funnet" });

          return;
        }
        const noteScope: MeetingNoteProcessingScope = {
          ...authorized,
          noteId,
        };

        // Respons FØR tung prosessering. setImmediate sikrer at HTTP-svaret
        // er sendt før Whisper/Claude starter — frigjør request-tråden.
        // Retry: 3 forsøk på Whisper m/ exp backoff (2s, 8s, 18s).
        setImmediate(async () => {
          try {
            let tx: Awaited<ReturnType<typeof transcribeAudio>> = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                tx = await transcribeAudio(buf, b.language);
              } catch (txErr) {
                console.warn(
                  `[meeting-notes] Whisper-forsøk ${attempt}/3 kastet:`,
                  txErr,
                );
              }
              if (tx) break;
              if (attempt < 3) {
                const backoffMs = 2000 * attempt * attempt; // 2s, 8s, 18s
                await new Promise((r) => setTimeout(r, backoffMs));
              }
            }
            if (tx) {
              const updated = await pool.query(
                `UPDATE lead_meeting_notes
                    SET transcript=$1, transcript_language=$2
                  WHERE id=$3::uuid
                    AND lead_id=$4::uuid
                    AND organization_id=$5::uuid
                    AND EXISTS (
                      SELECT 1
                        FROM crm_customers lead
                       WHERE lead.id = lead_meeting_notes.lead_id
                         AND lead.organization_id = lead_meeting_notes.organization_id
                         AND lead.project_id = $6
                    )`,
                [
                  tx.transcript,
                  tx.language,
                  noteScope.noteId,
                  noteScope.leadId,
                  noteScope.organizationId,
                  noteScope.projectId,
                ],
              );
              if (updated.rowCount !== 1) return;
              const processed = await processMeetingNote(pool, noteScope);
              if (!processed) return;
              // Webhook ved completion — best-effort, blokker ikke loggen.
              try {
                void emitWebhook(
                  pool,
                  "meeting_note.processed",
                  {
                    meeting_note_id: noteScope.noteId,
                    lead_id: noteScope.leadId,
                  },
                  noteScope.organizationId,
                );
              } catch (whErr) {
                console.warn("[meeting-notes] webhook emit feilet:", whErr);
              }
            } else {
              await markMeetingNoteFailed(
                pool,
                noteScope,
                "Whisper feilet 3 ganger",
              );
            }
          } catch (err) {
            console.error("[meeting-notes] bakgrunns-prosess feilet:", err);
            await markMeetingNoteFailed(pool, noteScope, String(err)).catch(
              () => {},
            );
          }
        });

        // 202 Accepted = semantisk korrekt: jobben er akseptert, ikke ferdig.
        res
          .status(202)
          .json({ meeting_note_id: noteId, status: "transcribing" });
      } catch (err) {
        res
          .status(500)
          .json({ error: "upload_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Manuell tekst-input (uten audio) ─────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/meeting-notes/from-text",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const b = parseOr400(fromTextBody, req.body, res);
      if (!b) return;
      const leadId = req.params.id;
      try {
        const authorized = await authorizeLead(
          pool,
          session.userId,
          leadId,
          "meeting_notes.create",
          res,
        );
        if (!authorized) return;
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              transcript, transcript_language, processing_status)
           SELECT lead.id, lead.organization_id, $4, 'manual', $5, $6,
                  'analyzing'
             FROM crm_customers lead
            WHERE lead.id = $1::uuid
              AND lead.organization_id = $2::uuid
              AND lead.project_id = $3
           RETURNING id::text`,
          [
            authorized.leadId,
            authorized.organizationId,
            authorized.projectId,
            session.userId,
            b.transcript,
            b.language,
          ],
        );
        const noteId = insert.rows[0]?.id;
        if (!noteId) {
          res.status(404).json({ error: "ikke_funnet" });
          return;
        }
        const noteScope: MeetingNoteProcessingScope = {
          ...authorized,
          noteId,
        };

        // Frigjør request-tråden FØR Claude. setImmediate sikrer at HTTP-svar
        // er på vei før analyse starter.
        setImmediate(async () => {
          try {
            const processed = await processMeetingNote(pool, noteScope);
            if (!processed) return;
            try {
              void emitWebhook(
                pool,
                "meeting_note.processed",
                {
                  meeting_note_id: noteScope.noteId,
                  lead_id: noteScope.leadId,
                },
                noteScope.organizationId,
              );
            } catch (whErr) {
              console.warn("[meeting-notes] webhook emit feilet:", whErr);
            }
          } catch (err) {
            console.error("[meeting-notes] analyse feilet:", err);
            await markMeetingNoteFailed(pool, noteScope, String(err)).catch(
              () => {},
            );
          }
        });

        res.status(202).json({ meeting_note_id: noteId, status: "analyzing" });
      } catch (err) {
        res
          .status(500)
          .json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );

  // ─── List notes for lead ─────────────────────────────────────────
  app.get(
    "/api/leadgrid/leads/:id/meeting-notes",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const lead = await authorizeLead(
          pool,
          session.userId,
          req.params.id,
          "meeting_notes.view",
          res,
        );
        if (!lead) return;
        const result = await pool.query(
          `SELECT mn.id::text, mn.source, mn.summary, mn.action_items,
                  mn.decisions, mn.next_steps, mn.topics, mn.participants,
                  mn.confidence, mn.processing_status, mn.error_message,
                  mn.created_at, mn.processed_at, mn.transcript_language,
                  mn.audio_duration_seconds
             FROM lead_meeting_notes mn
             JOIN crm_customers scoped_lead
               ON scoped_lead.id = mn.lead_id
              AND scoped_lead.organization_id = mn.organization_id
            WHERE mn.lead_id = $1::uuid
              AND mn.organization_id = $2::uuid
              AND scoped_lead.project_id = $3
            ORDER BY mn.created_at DESC
            LIMIT 50`,
          [lead.leadId, lead.organizationId, lead.projectId],
        );
        res.json({ notes: result.rows });
      } catch (err) {
        res
          .status(500)
          .json({ error: "list_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Detail ──────────────────────────────────────────────────────
  app.get(
    "/api/leadgrid/meeting-notes/:id",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const scope = await authorizeMeetingNote(
          pool,
          session.userId,
          req.params.id,
          "meeting_notes.view",
          res,
        );
        if (!scope) return;
        const result = await pool.query(
          `SELECT mn.id::text, mn.lead_id::text, mn.source, mn.transcript,
                  mn.summary, mn.action_items, mn.decisions, mn.next_steps,
                  mn.topics, mn.participants, mn.confidence,
                  mn.processing_status, mn.error_message, mn.created_at,
                  mn.processed_at
             FROM lead_meeting_notes mn
             JOIN crm_customers scoped_lead
               ON scoped_lead.id = mn.lead_id
              AND scoped_lead.organization_id = mn.organization_id
            WHERE mn.id = $1::uuid
              AND mn.lead_id = $2::uuid
              AND mn.organization_id = $3::uuid
              AND scoped_lead.project_id = $4
            LIMIT 1`,
          [scope.noteId, scope.leadId, scope.organizationId, scope.projectId],
        );
        if (!result.rows.length) {
          res.status(404).json({ error: "ikke_funnet" });
          return;
        }
        res.json({ note: result.rows[0] });
      } catch (err) {
        res.status(500).json({ error: "get_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Re-process (kjør Claude på nytt mot eksisterende transcript) ──
  app.post(
    "/api/leadgrid/meeting-notes/:id/reprocess",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const scope = await authorizeMeetingNote(
          pool,
          session.userId,
          req.params.id,
          "meeting_notes.create",
          res,
        );
        if (!scope) return;
        const updated = await pool.query(
          `UPDATE lead_meeting_notes
              SET processing_status='analyzing', error_message=NULL
            WHERE id=$1::uuid
              AND lead_id=$2::uuid
              AND organization_id=$3::uuid
              AND EXISTS (
                SELECT 1
                  FROM crm_customers scoped_lead
                 WHERE scoped_lead.id = lead_meeting_notes.lead_id
                   AND scoped_lead.organization_id = lead_meeting_notes.organization_id
                   AND scoped_lead.project_id = $4
              )
          RETURNING id`,
          [scope.noteId, scope.leadId, scope.organizationId, scope.projectId],
        );
        if (!updated.rows.length) {
          res.status(404).json({ error: "ikke_funnet" });
          return;
        }
        void processMeetingNote(pool, scope).catch(async (err) => {
          console.warn("[meeting-notes] reprosess feilet:", err);
          await markMeetingNoteFailed(pool, scope, String(err)).catch(() => {});
        });
        res.json({ status: "analyzing" });
      } catch (err) {
        res
          .status(500)
          .json({ error: "reprocess_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Delete ──────────────────────────────────────────────────────
  app.delete(
    "/api/leadgrid/meeting-notes/:id",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const scope = await authorizeMeetingNote(
          pool,
          session.userId,
          req.params.id,
          "meeting_notes.delete",
          res,
        );
        if (!scope) return;
        const deleted = await pool.query(
          `DELETE FROM lead_meeting_notes
            WHERE id=$1::uuid
              AND lead_id=$2::uuid
              AND organization_id=$3::uuid
              AND EXISTS (
                SELECT 1
                  FROM crm_customers scoped_lead
                 WHERE scoped_lead.id = lead_meeting_notes.lead_id
                   AND scoped_lead.organization_id = lead_meeting_notes.organization_id
                   AND scoped_lead.project_id = $4
              )
          RETURNING id`,
          [scope.noteId, scope.leadId, scope.organizationId, scope.projectId],
        );
        if (!deleted.rows.length) {
          res.status(404).json({ error: "ikke_funnet" });
          return;
        }
        res.json({ ok: true });
      } catch (err) {
        res
          .status(500)
          .json({ error: "delete_failed", detail: "internal_error" });
      }
    },
  );
}
