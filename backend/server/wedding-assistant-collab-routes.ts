/**
 * wedding-assistant-collab-routes.ts
 *
 * Slice 9X.47 + 9X.48:
 *   9X.47 — Assistent-rolodex: oversikt over folk Stine har samarbeidet med
 *   9X.48 — Brief-møte: opprett Google Meet-event med assistenten
 *
 * Endpoints:
 *   GET  /api/photographer/assistants/history
 *   POST /api/photographer/assistants/quick-invite
 *        { weddingId, fromEmail, role, compensationType, compensationValue, sharePct? }
 *        — re-invite et tidligere samarbeid med ferdig-utfylte felter
 *   POST /api/wedding/:weddingId/assistants/:assistantId/schedule-brief
 *        { startDateTime, durationMin?, notes? }
 *   DELETE /api/wedding/:weddingId/assistants/:assistantId/brief
 */

import type express from "express";
import crypto from "crypto";
import { createGoogleMeetLink } from "./google-meet";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingAssistantCollabDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
  getPricingUserId: (req: any) => string;
}

async function ensureSchema(pool: any): Promise<void> {
  for (const col of [
    "brief_meeting_event_id TEXT",
    "brief_meeting_url TEXT",
    "brief_meeting_at TIMESTAMPTZ",
    "brief_meeting_duration_min INTEGER",
  ]) {
    await pool.query(`ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
}

export function setupWeddingAssistantCollabRoutes(deps: WeddingAssistantCollabDeps): void {
  const { app, pool, requireUserSession, getPricingUserId } = deps;

  // ─── GET /api/photographer/assistants/history ────────────────
  // Gruppér på assistant_email/assistant_user_id, returner siste rolle,
  // antall oppdrag, siste oppdragsdato, sum-kompensasjon, status.
  app.get("/api/photographer/assistants/history", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT
            COALESCE(assistant_user_id, assistant_email) AS contact_key,
            MAX(assistant_name) AS name,
            MAX(assistant_email) AS email,
            MAX(assistant_phone) AS phone,
            MAX(assistant_user_id) AS internal_user_id,
            COUNT(*)::int AS total_jobs,
            COUNT(*) FILTER (WHERE status IN ('accepted', 'completed'))::int AS confirmed_jobs,
            COUNT(*) FILTER (WHERE status = 'declined')::int AS declined_jobs,
            MAX(role) AS last_role,
            MAX(compensation_type) AS last_compensation_type,
            (ARRAY_AGG(compensation_value ORDER BY created_at DESC))[1] AS last_compensation_value,
            (ARRAY_AGG(share_pct ORDER BY created_at DESC))[1] AS last_share_pct,
            MAX(created_at) AS last_collaboration_at
          FROM wedding_assistants
          WHERE primary_photographer_id = $1
            AND (assistant_email IS NOT NULL OR assistant_user_id IS NOT NULL)
          GROUP BY contact_key
          ORDER BY last_collaboration_at DESC`,
        [uid],
      );
      res.json({
        assistants: r.rows.map((row: any) => ({
          contactKey: row.contact_key,
          name: row.name,
          email: row.email,
          phone: row.phone,
          internalUserId: row.internal_user_id,
          totalJobs: row.total_jobs,
          confirmedJobs: row.confirmed_jobs,
          declinedJobs: row.declined_jobs,
          lastRole: row.last_role,
          lastCompensationType: row.last_compensation_type,
          lastCompensationValue: row.last_compensation_value != null ? Number(row.last_compensation_value) : null,
          lastSharePct: row.last_share_pct != null ? Number(row.last_share_pct) : null,
          lastCollaborationAt: row.last_collaboration_at,
          reliabilityScore:
            row.total_jobs > 0
              ? Math.round((row.confirmed_jobs / row.total_jobs) * 100)
              : null,
        })),
      });
    } catch (err) {
      console.error("GET /assistants/history:", err);
      res.status(500).json({ error: "Kunne ikke hente historikk" });
    }
  });

  // ─── GET /api/photographer/weddings/upcoming ─────────────────
  // Minimal liste over fotografens bryllup, brukt av rolodex
  // for å fylle wedding-picker når man re-inviterer.
  app.get("/api/photographer/weddings/upcoming", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT id, couple_name, wedding_date
           FROM wedding_timelines
          WHERE photographer_id = $1
            AND (wedding_date IS NULL OR wedding_date >= NOW() - INTERVAL '7 days')
          ORDER BY wedding_date NULLS LAST
          LIMIT 100`,
        [uid],
      );
      res.json({
        weddings: r.rows.map((row: any) => ({
          id: row.id,
          coupleName: row.couple_name,
          weddingDate: row.wedding_date,
        })),
      });
    } catch (err) {
      console.error("GET /weddings/upcoming:", err);
      res.status(500).json({ error: "Kunne ikke hente bryllup" });
    }
  });

  // ─── POST /api/photographer/assistants/quick-invite ──────────
  // Re-invite en tidligere assistent til et nytt bryllup.
  app.post("/api/photographer/assistants/quick-invite", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const {
        weddingId,
        fromEmail,
        role,
        compensationType,
        compensationValue,
        sharePct,
        notes,
      } = req.body || {};
      if (!weddingId || !fromEmail) {
        return res.status(400).json({ error: "weddingId og fromEmail er påkrevd" });
      }

      // Hent siste collab-rad for å pre-fille navn/telefon
      const prev = await pool.query(
        `SELECT assistant_name, assistant_phone, assistant_user_id
           FROM wedding_assistants
           WHERE primary_photographer_id = $1 AND assistant_email = $2
           ORDER BY created_at DESC LIMIT 1`,
        [uid, fromEmail],
      );
      const prevRow = prev.rows[0] || {};

      // Verifiser eierskap til weddingen
      const own = await pool.query(
        `SELECT photographer_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [weddingId],
      );
      if (own.rowCount === 0 || own.rows[0].photographer_id !== uid) {
        return res.status(403).json({ error: "Du eier ikke dette bryllupet" });
      }

      const inviteToken = !prevRow.assistant_user_id ? crypto.randomBytes(24).toString("base64url") : null;

      const ins = await pool.query(
        `INSERT INTO wedding_assistants
           (wedding_id, primary_photographer_id, assistant_user_id, assistant_email,
            assistant_name, assistant_phone, role, compensation_type, compensation_value,
            share_pct, status, invite_token, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'invited', $11, $12)
         RETURNING id`,
        [
          weddingId,
          uid,
          prevRow.assistant_user_id || null,
          fromEmail,
          prevRow.assistant_name || null,
          prevRow.assistant_phone || null,
          role || "assistant",
          compensationType || "fixed",
          compensationValue != null ? Number(compensationValue) : null,
          sharePct != null ? Number(sharePct) : null,
          inviteToken,
          notes || null,
        ],
      );
      res.status(201).json({
        assistantId: ins.rows[0].id,
        inviteUrl: inviteToken ? `/wedding/assistant-invite/${inviteToken}` : null,
      });
    } catch (err) {
      console.error("POST /quick-invite:", err);
      res.status(500).json({ error: "Re-invite feilet" });
    }
  });

  // ─── POST /api/wedding/:weddingId/assistants/:assistantId/schedule-brief ───
  app.post("/api/wedding/:weddingId/assistants/:assistantId/schedule-brief", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      const { startDateTime, durationMin, notes } = req.body || {};
      if (!startDateTime) return res.status(400).json({ error: "startDateTime påkrevd" });
      const duration = Number(durationMin) || 30;

      const a = await pool.query(
        `SELECT a.*, w.couple_name, w.wedding_date
           FROM wedding_assistants a
           JOIN wedding_timelines w ON w.id = a.wedding_id
           WHERE a.id = $1 AND a.wedding_id = $2 AND a.primary_photographer_id = $3 LIMIT 1`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (a.rowCount === 0) return res.status(404).json({ error: "Assistent finnes ikke" });
      const row = a.rows[0];
      if (!row.assistant_email) return res.status(400).json({ error: "Mangler assistent-e-post" });

      const startMs = Date.parse(startDateTime);
      if (!Number.isFinite(startMs)) return res.status(400).json({ error: "Ugyldig startDateTime" });
      const endDateTime = new Date(startMs + duration * 60_000).toISOString();

      const meet = await createGoogleMeetLink(
        pool,
        {
          title: `Brief-møte: bryllup ${row.couple_name || ""} ${row.wedding_date ? new Date(row.wedding_date).toLocaleDateString("nb-NO") : ""}`,
          description: [
            `Brief med ${row.assistant_name || row.assistant_email} (${row.role}) før bryllupet.`,
            "",
            "Agenda:",
            "- Gjennomgang av timeline",
            "- Lokasjon og logistikk",
            "- Utstyrs-deling",
            "- Forventninger og roller",
            notes ? `\nNotater: ${notes}` : "",
          ].filter(Boolean).join("\n"),
          startDateTime: new Date(startMs).toISOString(),
          endDateTime,
          attendees: [row.assistant_email],
          timeZone: "Europe/Oslo",
        },
        uid,
      );

      if (!("meetLink" in meet)) {
        return res.status(503).json({
          error: "Kunne ikke opprette Google Meet. Sjekk at Google Calendar er koblet.",
        });
      }

      await pool.query(
        `UPDATE wedding_assistants
           SET brief_meeting_event_id = $1,
               brief_meeting_url = $2,
               brief_meeting_at = $3::timestamptz,
               brief_meeting_duration_min = $4,
               updated_at = NOW()
           WHERE id = $5`,
        [meet.calendarEventId, meet.meetLink, new Date(startMs).toISOString(), duration, row.id],
      );

      res.json({
        meetLink: meet.meetLink,
        scheduledAt: meet.scheduledAt,
        calendarEventId: meet.calendarEventId,
      });
    } catch (err: any) {
      console.error("POST schedule-brief:", err);
      res.status(500).json({ error: err?.message || "Kunne ikke opprette brief-møte" });
    }
  });

  // ─── DELETE /api/wedding/:weddingId/assistants/:assistantId/brief ─────
  app.delete("/api/wedding/:weddingId/assistants/:assistantId/brief", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      // Vi sletter ikke calendar-eventet fra Google (krever ekstra calendar-API-kall);
      // bare nullstiller lokal referanse. Stine kan kansellere fra Calendar selv.
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET brief_meeting_event_id = NULL,
               brief_meeting_url = NULL,
               brief_meeting_at = NULL,
               brief_meeting_duration_min = NULL,
               updated_at = NOW()
           WHERE id = $1 AND wedding_id = $2 AND primary_photographer_id = $3
         RETURNING id`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /brief:", err);
      res.status(500).json({ error: "Kunne ikke slette" });
    }
  });
}
