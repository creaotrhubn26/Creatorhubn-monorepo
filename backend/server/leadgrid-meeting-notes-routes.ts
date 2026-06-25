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
      const b = parseOr400(uploadAudioBody, req.body, res);
      if (!b) return;
      const leadId = req.params.id;
      try {
        const buf = Buffer.from(b.audio_base64, "base64");
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              audio_duration_seconds, processing_status)
           VALUES ($1::uuid, $2::uuid, $3, 'voice_memo', $4, 'transcribing')
           RETURNING id::text`,
          [leadId, orgId, session.userId, b.duration_seconds ?? null],
        );
        const noteId = insert.rows[0].id;

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
              await pool.query(
                `UPDATE lead_meeting_notes
                    SET transcript=$1, transcript_language=$2
                  WHERE id=$3::uuid`,
                [tx.transcript, tx.language, noteId],
              );
              await processMeetingNote(pool, noteId);
              // Webhook ved completion — best-effort, blokker ikke loggen.
              try {
                void emitWebhook(
                  pool,
                  "meeting_note.processed",
                  { meeting_note_id: noteId, lead_id: leadId },
                  orgId,
                );
              } catch (whErr) {
                console.warn("[meeting-notes] webhook emit feilet:", whErr);
              }
            } else {
              await pool.query(
                `UPDATE lead_meeting_notes
                    SET processing_status='failed',
                        error_message='Whisper feilet 3 ganger',
                        processed_at=NOW()
                  WHERE id=$1::uuid`,
                [noteId],
              );
            }
          } catch (err) {
            console.error("[meeting-notes] bakgrunns-prosess feilet:", err);
            await pool
              .query(
                `UPDATE lead_meeting_notes
                    SET processing_status='failed',
                        error_message=$1,
                        processed_at=NOW()
                  WHERE id=$2::uuid`,
                [String(err).slice(0, 500), noteId],
              )
              .catch(() => {});
          }
        });

        // 202 Accepted = semantisk korrekt: jobben er akseptert, ikke ferdig.
        res.status(202).json({ meeting_note_id: noteId, status: "transcribing" });
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
      const b = parseOr400(fromTextBody, req.body, res);
      if (!b) return;
      const leadId = req.params.id;
      try {
        const insert = await pool.query<{ id: string }>(
          `INSERT INTO lead_meeting_notes
             (lead_id, organization_id, user_id, source,
              transcript, transcript_language, processing_status)
           VALUES ($1::uuid, $2::uuid, $3, 'manual', $4, $5, 'analyzing')
           RETURNING id::text`,
          [leadId, orgId, session.userId, b.transcript, b.language],
        );
        const noteId = insert.rows[0].id;

        // Frigjør request-tråden FØR Claude. setImmediate sikrer at HTTP-svar
        // er på vei før analyse starter.
        setImmediate(async () => {
          try {
            await processMeetingNote(pool, noteId);
            try {
              void emitWebhook(
                pool,
                "meeting_note.processed",
                { meeting_note_id: noteId, lead_id: leadId },
                orgId,
              );
            } catch (whErr) {
              console.warn("[meeting-notes] webhook emit feilet:", whErr);
            }
          } catch (err) {
            console.error("[meeting-notes] analyse feilet:", err);
            await pool
              .query(
                `UPDATE lead_meeting_notes
                    SET processing_status='failed',
                        error_message=$1,
                        processed_at=NOW()
                  WHERE id=$2::uuid`,
                [String(err).slice(0, 500), noteId],
              )
              .catch(() => {});
          }
        });

        res.status(202).json({ meeting_note_id: noteId, status: "analyzing" });
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
