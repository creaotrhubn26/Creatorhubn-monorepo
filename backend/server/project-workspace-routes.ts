/**
 * project-workspace-routes.ts — Team Workspace egne panel-data (project_id-scopet)
 *
 * HELT UAVHENGIG av Role Room / casting / wedding. Dedikerte tabeller for
 * foto/video-prosjektets workspace, alle scopet til public.projects.id og
 * gated via canAccessProject (eier ELLER aktivt team-medlem).
 *
 * Ressurser:
 *   project_board_tasks   — Samkjøringsboard / Oppgaver (kanban per crew_role)
 *   project_checklist_items — Sjekkliste (utstyr/backup)
 *   project_deliverables  — Leveranser
 *
 * Endpoints (alle /api/projects/:projectId/...):
 *   GET/POST  board-tasks      PATCH/DELETE board-tasks/:id
 *   GET/POST  checklist        PATCH/DELETE checklist/:id
 *   GET/POST  deliverables     PATCH/DELETE deliverables/:id
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import crypto from "crypto";
import multer from "multer";
import { canAccessProject } from "./project-team-routes";
import { signAssetReadUrl } from "./capture-upload-service";
import { archiveToRoleRoomB2, presignRoleRoomB2Download, slugifyForKey } from "./b2-archive-helper";
import { createGoogleMeetLink } from "./google-meet";

// Web-opplasting holdes i minne og skyves server-side til B2 (Role Room-bøtta).
// 60 MB tak — store RAW/originaler skal uansett gjennom capture multipart-flyten.
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

export interface ProjectWorkspaceRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

let schemaReady: Promise<void> | null = null;
async function ensureSchema(pool: any): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_board_tasks (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          crew_role   VARCHAR(20) NOT NULL DEFAULT 'begge',
          title       TEXT NOT NULL,
          time_label  VARCHAR(60),
          status      VARCHAR(20) NOT NULL DEFAULT 'todo',
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by  VARCHAR(64),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pbt_project ON project_board_tasks (project_id, crew_role, order_index);

        CREATE TABLE IF NOT EXISTS project_checklist_items (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          label       TEXT NOT NULL,
          checked     BOOLEAN NOT NULL DEFAULT FALSE,
          category    VARCHAR(40),
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pci_project ON project_checklist_items (project_id, order_index);

        CREATE TABLE IF NOT EXISTS project_deliverables (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          title       TEXT NOT NULL,
          type        VARCHAR(60),
          status      VARCHAR(20) NOT NULL DEFAULT 'not_started',
          due_date    DATE,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pd_project ON project_deliverables (project_id, order_index);

        CREATE TABLE IF NOT EXISTS project_images (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id   VARCHAR(64) NOT NULL,
          panel        VARCHAR(40),
          b2_key       TEXT NOT NULL,
          label        VARCHAR(255),
          content_type VARCHAR(80),
          size_bytes   BIGINT,
          uploaded_by  VARCHAR(64),
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pi_project ON project_images (project_id, panel, created_at DESC);

        CREATE TABLE IF NOT EXISTS project_split_shares (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          name        VARCHAR(255),
          email       VARCHAR(255),
          role        VARCHAR(40),
          percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pss_project ON project_split_shares (project_id, order_index);
      `).catch(() => undefined);
    })();
  }
  return schemaReady;
}

export function setupProjectWorkspaceRoutes(deps: ProjectWorkspaceRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Felles gate: innlogget + canAccessProject. Returnerer userId, eller null
  // (og har allerede sendt respons).
  const guard = async (req: any, res: any): Promise<string | null> => {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) { res.status(400).json({ error: "missing_project_id" }); return null; }
    if (!(await canAccessProject(pool, session.userId, projectId))) {
      res.status(403).json({ error: "no_access" });
      return null;
    }
    return session.userId;
  };

  // ─────────── Samkjøringsboard / Oppgaver ───────────
  app.get("/api/projects/:projectId/board-tasks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM project_board_tasks WHERE project_id = $1 ORDER BY crew_role, order_index, created_at`,
        [req.params.projectId],
      );
      res.json({ tasks: r.rows.map((t: any) => ({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index })) });
    } catch (e) { console.error("GET board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/board-tasks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (!title) return res.status(400).json({ error: "title_required" });
      const r = await pool.query(
        `INSERT INTO project_board_tasks (project_id, crew_role, title, time_label, status, order_index, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), $7) RETURNING *`,
        [req.params.projectId, (b.crewRole || "begge"), title, b.timeLabel || null, b.status || "todo", b.orderIndex ?? null, uid],
      );
      const t = r.rows[0];
      res.status(201).json({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index });
    } catch (e) { console.error("POST board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/board-tasks/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_board_tasks SET
            title = COALESCE($1, title), status = COALESCE($2, status),
            time_label = COALESCE($3, time_label), crew_role = COALESCE($4, crew_role),
            updated_at = NOW()
          WHERE id = $5 AND project_id = $6 RETURNING *`,
        [b.title ?? null, b.status ?? null, b.timeLabel ?? null, b.crewRole ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const t = r.rows[0];
      res.json({ id: t.id, crewRole: t.crew_role, title: t.title, timeLabel: t.time_label, status: t.status, orderIndex: t.order_index });
    } catch (e) { console.error("PATCH board-tasks", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/board-tasks/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_board_tasks WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE board-tasks", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Delivery-fase utledet fra EKTE showcase-tilstand ───────────
  // Stepperen (Editing→Internal Review→Client Review→Revisions→Approved) drives
  // av galleriets livssyklus + klient-aktivitet, ikke manuelt:
  //   1 Editing        — ingen galleri opprettet
  //   3 Client Review  — galleri finnes (delt med klient), ingen klient-handling
  //   4 Revisions      — klient har comments eller (ikke-innsendte) selections
  //   5 Approved       — klient sendte utvalg (submitted_at) ELLER galleri completed
  app.get("/api/projects/:projectId/delivery-status", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const gq = await pool.query(
        `SELECT id, status, completed_at FROM photographer_client_galleries WHERE project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const galleries = gq.rows;
      if (galleries.length === 0) {
        return res.json({ phase: 1, phaseKey: "editing", signals: { hasGallery: false, selections: 0, submitted: 0, comments: 0, completed: false } });
      }
      const ids = galleries.map((g: any) => g.id);
      const [selQ, subQ, comQ] = await Promise.all([
        pool.query(`SELECT count(*)::int c FROM client_image_selections WHERE gallery_id = ANY($1::uuid[])`, [ids]).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT count(*)::int c FROM client_image_selections WHERE gallery_id = ANY($1::uuid[]) AND submitted_at IS NOT NULL`, [ids]).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT count(*)::int c FROM client_image_comments WHERE gallery_id = ANY($1::uuid[])`, [ids]).catch(() => ({ rows: [{ c: 0 }] })),
      ]);
      const selections = selQ.rows[0]?.c || 0;
      const submitted = subQ.rows[0]?.c || 0;
      const comments = comQ.rows[0]?.c || 0;
      const completed = galleries.some((g: any) => g.status === "completed" || g.completed_at);

      let phase = 3, phaseKey = "client_review";
      if (completed || submitted > 0) { phase = 5; phaseKey = "approved"; }
      else if (comments > 0 || selections > 0) { phase = 4; phaseKey = "revisions"; }
      res.json({ phase, phaseKey, signals: { hasGallery: true, selections, submitted, comments, completed } });
    } catch (e) { console.error("GET delivery-status", e); res.json({ phase: 1, phaseKey: "editing", signals: {} }); }
  });

  // ─────────── Split sheet (honorar-fordeling mellom team) ───────────
  app.get("/api/projects/:projectId/split-sheet", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, name, email, role, percent, order_index FROM project_split_shares WHERE project_id = $1 ORDER BY order_index, created_at`,
        [req.params.projectId],
      );
      const shares = r.rows.map((s: any) => ({ id: s.id, name: s.name, email: s.email, role: s.role, percent: Number(s.percent) }));
      const total = shares.reduce((sum: number, s: any) => sum + (s.percent || 0), 0);
      res.json({ shares, total });
    } catch (e) { console.error("GET split-sheet", e); res.status(500).json({ error: "failed" }); }
  });
  // PUT — erstatt hele fordelingen (enklere enn per-rad-diff). Validerer ~100%.
  app.put("/api/projects/:projectId/split-sheet", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const rows = Array.isArray(req.body?.shares) ? req.body.shares : [];
      const clean = rows
        .map((s: any, i: number) => ({
          name: typeof s.name === "string" ? s.name.trim() : null,
          email: typeof s.email === "string" ? s.email.trim().toLowerCase() : null,
          role: typeof s.role === "string" ? s.role.trim() : null,
          percent: Math.max(0, Math.min(100, Number(s.percent) || 0)),
          order: i,
        }))
        .filter((s: any) => s.name || s.email);
      const total = clean.reduce((sum: number, s: any) => sum + s.percent, 0);
      if (clean.length > 0 && Math.round(total) !== 100) {
        return res.status(400).json({ error: "must_sum_100", total });
      }
      const projectId = req.params.projectId;
      await pool.query(`DELETE FROM project_split_shares WHERE project_id = $1`, [projectId]);
      for (const s of clean) {
        await pool.query(
          `INSERT INTO project_split_shares (project_id, name, email, role, percent, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [projectId, s.name, s.email, s.role, s.percent, s.order],
        );
      }
      res.json({ success: true, total });
    } catch (e) { console.error("PUT split-sheet", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Avtaler — CRM-kunde + møter (Google Meet) ───────────
  // Samler prosjektets kunde-/avtale-info: CRM-kunde (crm_customers.project_id),
  // kommende møter (crm_meetings), pluss kontrakt-status (frontend kaller det
  // eksisterende /contract/status). project_id-scopet, canAccessProject.
  app.get("/api/projects/:projectId/avtaler", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const cust = await pool.query(
        `SELECT id, name, email, status, project_type FROM crm_customers WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const customer = cust.rows[0] || null;
      let meetings: any[] = [];
      if (customer?.id) {
        const m = await pool.query(
          `SELECT id, title, description, location, meet_link, web_view_url, scheduled_at, duration_minutes
             FROM crm_meetings WHERE customer_id = $1 ORDER BY scheduled_at ASC NULLS LAST LIMIT 30`,
          [customer.id],
        ).catch(() => ({ rows: [] }));
        meetings = m.rows.map((r: any) => ({
          id: r.id, title: r.title, description: r.description, location: r.location,
          meetLink: r.meet_link, webViewUrl: r.web_view_url, scheduledAt: r.scheduled_at, durationMinutes: r.duration_minutes,
        }));
      }
      res.json({
        crmCustomer: customer ? { id: customer.id, name: customer.name, email: customer.email, status: customer.status, projectType: customer.project_type } : null,
        meetings,
      });
    } catch (e) { console.error("GET avtaler", e); res.status(500).json({ error: "failed" }); }
  });

  // POST møte — oppretter crm_meeting, evt. med ekte Google Meet-lenke.
  app.post("/api/projects/:projectId/meetings", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const b = req.body ?? {};
      const title = typeof b.title === "string" && b.title.trim() ? b.title.trim() : "Møte";
      const scheduledAt = b.scheduledAt || null;
      const durationMinutes = Number(b.durationMinutes) || 60;
      // Knytt til prosjektets CRM-kunde hvis den finnes.
      const cust = await pool.query(
        `SELECT id, name FROM crm_customers WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const customerId = cust.rows[0]?.id || null;
      const proj = await pool.query(`SELECT COALESCE(title, name) AS title FROM projects WHERE id = $1 LIMIT 1`, [req.params.projectId]).catch(() => ({ rows: [] }));

      // Ekte Google Meet-lenke hvis brukeren har Google koblet (ellers stille fallback).
      let meetLink: string | null = typeof b.meetLink === "string" ? b.meetLink : null;
      let webViewUrl: string | null = null;
      if (b.generateMeet && scheduledAt) {
        try {
          const meet = await createGoogleMeetLink(pool, {
            title, description: b.description || null, startDateTime: scheduledAt, duration: durationMinutes,
            projectId: req.params.projectId, projectName: proj.rows[0]?.title || null, clientName: cust.rows[0]?.name || null,
          }, uid);
          if (meet && (meet as any).meetLink) { meetLink = (meet as any).meetLink; webViewUrl = (meet as any).webViewUrl || null; }
        } catch (err) { console.warn("[avtaler] google meet failed:", (err as Error)?.message); }
      }

      const ins = await pool.query(
        `INSERT INTO crm_meetings (id, customer_id, title, description, location, meet_link, web_view_url, scheduled_at, duration_minutes, owner_user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *`,
        [customerId, title, b.description || null, b.location || null, meetLink, webViewUrl, scheduledAt, durationMinutes, uid],
      );
      const r = ins.rows[0];
      res.status(201).json({ id: r.id, title: r.title, meetLink: r.meet_link, webViewUrl: r.web_view_url, scheduledAt: r.scheduled_at, durationMinutes: r.duration_minutes });
    } catch (e) { console.error("POST meetings", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Editor-handoff (LESER editing_jobs — redigerings-marketplace) ───
  // Jobber sendt fra iPad (SendToEditor/EditingJobs) til redigerings-vendor.
  // project_id-scopet + canAccessProject. Read-only surfacing i Leveranser.
  app.get("/api/projects/:projectId/editing-jobs", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, vendor_name, status, requested_services, brief, amount_cents, currency,
                payment_status, gallery_id, requested_at, accepted_at
           FROM editing_jobs WHERE project_id = $1 ORDER BY requested_at DESC NULLS LAST`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      res.json({
        jobs: r.rows.map((j: any) => ({
          id: j.id, vendorName: j.vendor_name, status: j.status,
          services: Array.isArray(j.requested_services) ? j.requested_services : (j.requested_services || []),
          brief: j.brief, amount: j.amount_cents != null ? j.amount_cents / 100 : null, currency: j.currency || "NOK",
          paymentStatus: j.payment_status, galleryId: j.gallery_id,
          requestedAt: j.requested_at, acceptedAt: j.accepted_at,
        })),
      });
    } catch (e) { console.error("GET editing-jobs", e); res.json({ jobs: [] }); }
  });

  // ─────────── Kontrakt m/ signatur-detaljer (iPad-signatur surfacet) ───────────
  // Surfacer signaturen klienten tegnet på iPad-en: signer_name/signed_at +
  // om digital_signature finnes. project_id-scopet + canAccessProject.
  app.get("/api/projects/:projectId/contract", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, status, signature_status, signer_name, signer_email, signed_at, signed_date,
                (digital_signature IS NOT NULL AND length(digital_signature::text) > 0) AS has_signature,
                client_name
           FROM contracts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      if (r.rows.length === 0) return res.json({ hasContract: false });
      const c = r.rows[0];
      const isSigned = c.signature_status === "signed" || c.status === "signed";
      res.json({
        hasContract: true, contractId: c.id, status: c.status, isSigned,
        signerName: c.signer_name || null, signerEmail: c.signer_email || null,
        signedAt: c.signed_at || c.signed_date || null, hasSignature: !!c.has_signature,
        clientName: c.client_name || null,
      });
    } catch (e) { console.error("GET contract", e); res.json({ hasContract: false }); }
  });

  // ─────────── Tilbud (LESER quotes — project_id) ───────────
  app.get("/api/projects/:projectId/quotes", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, quote_number, title, status, total_amount, valid_until, client_name, created_at
           FROM quotes WHERE project_id = $1 ORDER BY created_at DESC`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      res.json({
        quotes: r.rows.map((q: any) => ({
          id: q.id, quoteNumber: q.quote_number, title: q.title, status: q.status,
          total: q.total_amount != null ? Number(q.total_amount) : null, validUntil: q.valid_until,
          clientName: q.client_name, createdAt: q.created_at,
        })),
      });
    } catch (e) { console.error("GET quotes", e); res.json({ quotes: [] }); }
  });

  // ─────────── Revisjoner (LESER capture_revision_requests — klient-ønsker) ───────────
  app.get("/api/projects/:projectId/revision-requests", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, asset_id, original_filename, client_email, note, status, source, created_at, resolved_at
           FROM capture_revision_requests WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const rows = r.rows.map((x: any) => ({
        id: x.id, filename: x.original_filename, clientEmail: x.client_email, note: x.note,
        status: x.status, source: x.source, createdAt: x.created_at, resolvedAt: x.resolved_at,
      }));
      const open = rows.filter((x: any) => x.status !== "resolved" && x.status !== "done").length;
      res.json({ requests: rows, openCount: open });
    } catch (e) { console.error("GET revision-requests", e); res.json({ requests: [], openCount: 0 }); }
  });

  // ─────────── Showcase / klient-galleri (LESER photographer_client_galleries) ───
  // Kobler Leveranser til det EKTE leveranse-systemet: klient-galleriet/showcasen
  // klienten faktisk ser. project_id-scopet + canAccessProject. shareUrl =
  // /client/gallery/<access_token> (frontend prepender origin).
  app.get("/api/projects/:projectId/galleries", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, project_title, client_name, client_email, access_token, status, created_at, completed_at
           FROM photographer_client_galleries
          WHERE project_id = $1
          ORDER BY created_at DESC`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      res.json({
        galleries: r.rows.map((g: any) => ({
          id: g.id, title: g.project_title || g.client_name || "Galleri",
          clientName: g.client_name, clientEmail: g.client_email,
          status: g.status, accessToken: g.access_token,
          sharePath: g.access_token ? `/client/gallery/${g.access_token}` : null,
          createdAt: g.created_at, completedAt: g.completed_at,
        })),
      });
    } catch (e) { console.error("GET project galleries", e); res.json({ galleries: [] }); }
  });

  // ─────────── Media — capture_assets fra B2 (presigned thumbnails) ───────────
  // Leser prosjektets capture-session(er) → assets → presigned preview_key-URL.
  // Dette er det EKTE mediabiblioteket (RAW/originaler skutt på iPad, lagret i B2).
  app.get("/api/projects/:projectId/media", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const sessions = await pool.query(
        `SELECT id FROM capture_sessions WHERE project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const sessionIds = sessions.rows.map((s: any) => s.id);
      if (sessionIds.length === 0) return res.json({ assets: [], hasSession: false });
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "120"), 10) || 120));
      const a = await pool.query(
        `SELECT id, session_id, original_filename, mime, size_bytes, state, rating,
                color_label, flagged_for_client, preview_key, created_at
           FROM capture_assets
          WHERE session_id = ANY($1::uuid[]) AND rejected IS NOT TRUE
          ORDER BY created_at DESC LIMIT $2`,
        [sessionIds, limit],
      );
      const assets = await Promise.all(a.rows.map(async (r: any) => ({
        id: r.id,
        filename: r.original_filename,
        mime: r.mime,
        sizeBytes: r.size_bytes ? Number(r.size_bytes) : null,
        state: r.state,
        rating: r.rating,
        colorLabel: r.color_label,
        flaggedForClient: r.flagged_for_client,
        previewUrl: r.preview_key ? await signAssetReadUrl(r.preview_key) : null,
        createdAt: r.created_at,
      })));
      // Cull-stats (det fotografen culler på iPad → reflektert i web).
      const cs = await pool.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE rejected IS TRUE)::int AS rejected,
                count(*) FILTER (WHERE rating IS NULL OR rating = 0)::int AS unrated,
                count(*) FILTER (WHERE rating >= 4)::int AS favorites,
                count(*) FILTER (WHERE flagged_for_client IS TRUE)::int AS highlights,
                count(*) FILTER (WHERE rating >= 1)::int AS rated
           FROM capture_assets WHERE session_id = ANY($1::uuid[])`,
        [sessionIds],
      ).catch(() => ({ rows: [{}] }));
      const c = cs.rows[0] || {};
      res.json({
        assets, hasSession: true,
        cullStats: {
          total: c.total || 0, rejected: c.rejected || 0, unrated: c.unrated || 0,
          favorites: c.favorites || 0, highlights: c.highlights || 0, rated: c.rated || 0,
        },
      });
    } catch (e) { console.error("GET media", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Team Sync % (ekte readiness fra board + sjekkliste + presence) ───
  app.get("/api/projects/:projectId/team-sync", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const pid = req.params.projectId;
      const [board, checks, pres, members] = await Promise.all([
        pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status='done')::int done FROM project_board_tasks WHERE project_id=$1`, [pid]).catch(() => ({ rows: [{ total: 0, done: 0 }] })),
        pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE checked)::int done FROM project_checklist_items WHERE project_id=$1`, [pid]).catch(() => ({ rows: [{ total: 0, done: 0 }] })),
        pool.query(`SELECT count(*) FILTER (WHERE pr.last_seen_at > NOW() - INTERVAL '90 seconds')::int online FROM project_team_members m LEFT JOIN user_presence pr ON pr.user_id=m.user_id WHERE m.project_id=$1 AND m.status='active' AND m.deactivated_at IS NULL`, [pid]).catch(() => ({ rows: [{ online: 0 }] })),
        pool.query(`SELECT count(*)::int n FROM project_team_members WHERE project_id=$1 AND status='active' AND deactivated_at IS NULL`, [pid]).catch(() => ({ rows: [{ n: 0 }] })),
      ]);
      const b = board.rows[0], c = checks.rows[0];
      const boardPct = b.total > 0 ? b.done / b.total : null;
      const checkPct = c.total > 0 ? c.done / c.total : null;
      const parts = [boardPct, checkPct].filter((x) => x != null);
      const pct = parts.length ? Math.round((parts.reduce((s: number, x: number) => s + x, 0) / parts.length) * 100) : 0;
      res.json({
        pct, online: pres.rows[0]?.online || 0, teamSize: (members.rows[0]?.n || 0) + 1,
        readiness: [
          { label: "Oppgaver fullført", done: b.total > 0 && b.done === b.total, value: `${b.done}/${b.total}` },
          { label: "Sjekkliste klar", done: c.total > 0 && c.done === c.total, value: `${c.done}/${c.total}` },
        ],
      });
    } catch (e) { console.error("GET team-sync", e); res.json({ pct: 0, online: 0, readiness: [] }); }
  });

  // ─────────── Capture & backup-status (iPad CaptureApp + One Desk) ───────────
  // Sømløst: samme konto ser samme prosjekt/session/assets overalt. Dette
  // surfacer LIVE-tilstanden i workspacet: aktiv capture-session (skyter nå?),
  // antall assets, og B2-backup-status (raw_key satt = original sikret).
  // project_id-scopet + canAccessProject. Poll fra frontend.
  app.get("/api/projects/:projectId/capture-status", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const s = await pool.query(
        `SELECT id, name, status, starts_at, ends_at FROM capture_sessions WHERE project_id = $1 ORDER BY created_at DESC`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const sessions = s.rows;
      if (sessions.length === 0) return res.json({ hasSession: false });
      const ids = sessions.map((x: any) => x.id);
      const stats = await pool.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE raw_key IS NOT NULL OR full_key IS NOT NULL)::int AS secured,
                count(*) FILTER (WHERE preview_key IS NOT NULL)::int AS with_preview,
                max(capture_time) AS last_capture,
                max(created_at) AS last_upload
           FROM capture_assets WHERE session_id = ANY($1::uuid[])`,
        [ids],
      ).catch(() => ({ rows: [{ total: 0, secured: 0, with_preview: 0, last_capture: null, last_upload: null }] }));
      const st = stats.rows[0] || {};
      const total = st.total || 0;
      const secured = st.secured || 0;
      // «Skyter nå» = ny asset siste 5 min ELLER session aktiv uten ends_at.
      const lastUpload = st.last_upload ? new Date(st.last_upload).getTime() : 0;
      const shootingNow = (Date.now() - lastUpload) < 5 * 60 * 1000;
      const active = sessions.find((x: any) => (x.status === "active" || !x.ends_at)) || sessions[0];
      res.json({
        hasSession: true,
        session: { id: active.id, name: active.name, status: active.status, startsAt: active.starts_at, endsAt: active.ends_at },
        sessionCount: sessions.length,
        shootingNow,
        assets: {
          total,
          securedToB2: secured,
          securedPct: total > 0 ? Math.round((secured / total) * 100) : 0,
          lastCaptureAt: st.last_capture || null,
          lastUploadAt: st.last_upload || null,
        },
      });
    } catch (e) { console.error("GET capture-status", e); res.json({ hasSession: false }); }
  });

  // ─────────── Web-bilder (moodboard/referanser/«legg til bilde») → B2 ───────────
  app.get("/api/projects/:projectId/images", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const panel = typeof req.query.panel === "string" ? req.query.panel : null;
      const r = await pool.query(
        `SELECT id, panel, b2_key, label, content_type, created_at FROM project_images
          WHERE project_id = $1 ${panel ? "AND panel = $2" : ""}
          ORDER BY created_at DESC`,
        panel ? [req.params.projectId, panel] : [req.params.projectId],
      );
      const images = await Promise.all(r.rows.map(async (im: any) => ({
        id: im.id, panel: im.panel, label: im.label,
        url: await presignRoleRoomB2Download(im.b2_key, 3600),
        createdAt: im.created_at,
      })));
      res.json({ images });
    } catch (e) { console.error("GET images", e); res.status(500).json({ error: "failed" }); }
  });

  app.post("/api/projects/:projectId/images", mediaUpload.single("file"), async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ error: "file_required" });
      const panel = typeof req.body?.panel === "string" ? req.body.panel : "media";
      const label = typeof req.body?.label === "string" ? req.body.label : file.originalname;
      const safeName = slugifyForKey(file.originalname || "bilde");
      const key = `workspace/${req.params.projectId}/${panel}/${crypto.randomUUID()}-${safeName}`;
      const result = await archiveToRoleRoomB2(key, file.buffer, file.mimetype || "application/octet-stream");
      if (!result) return res.status(502).json({ error: "b2_upload_failed" });
      const ins = await pool.query(
        `INSERT INTO project_images (project_id, panel, b2_key, label, content_type, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [req.params.projectId, panel, key, label, file.mimetype || null, file.size || null, uid],
      );
      res.status(201).json({
        id: ins.rows[0].id, panel, label,
        url: await presignRoleRoomB2Download(key, 3600),
        createdAt: ins.rows[0].created_at,
      });
    } catch (e) { console.error("POST images", e); res.status(500).json({ error: "failed" }); }
  });

  app.delete("/api/projects/:projectId/images/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_images WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE images", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Shotlist (LESER shot_lists wizarden skrev) ───────────
  // GET — drift-trygt: rå SQL mot de EKTE kolonnene (shots_data/name/
  // template_type/critical_shots), IKKE Drizzle-helperen som har skjema-drift.
  // ProjectCreationWithMemoryCards skriver shot_lists via POST; her leser vi den.
  app.get("/api/projects/:projectId/shot-list", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const r = await pool.query(
        `SELECT id, name, template_type, culture, shots_data,
                total_shots, completed_shots, critical_shots, completed_critical_shots, updated_at
           FROM shot_lists
          WHERE project_id = $1 AND is_active = TRUE
          ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [req.params.projectId],
      );
      if (r.rowCount === 0) return res.json({ shotList: null, shots: [] });
      const s = r.rows[0];
      const shots = Array.isArray(s.shots_data) ? s.shots_data : [];
      res.json({
        shotList: {
          id: s.id, name: s.name, templateType: s.template_type, culture: s.culture,
          totalShots: s.total_shots ?? shots.length, completedShots: s.completed_shots ?? 0,
          criticalShots: s.critical_shots ?? 0, completedCriticalShots: s.completed_critical_shots ?? 0,
        },
        shots,
      });
    } catch (e) { console.error("GET shot-list", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Sjekkliste ───────────
  app.get("/api/projects/:projectId/checklist", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(`SELECT * FROM project_checklist_items WHERE project_id = $1 ORDER BY order_index, created_at`, [req.params.projectId]);
      res.json({ items: r.rows.map((i: any) => ({ id: i.id, label: i.label, checked: i.checked, category: i.category })) });
    } catch (e) { console.error("GET checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/checklist", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const label = typeof b.label === "string" ? b.label.trim() : "";
      if (!label) return res.status(400).json({ error: "label_required" });
      const r = await pool.query(
        `INSERT INTO project_checklist_items (project_id, label, checked, category, order_index)
         VALUES ($1, $2, COALESCE($3, FALSE), $4, COALESCE($5, 0)) RETURNING *`,
        [req.params.projectId, label, b.checked ?? false, b.category || null, b.orderIndex ?? null],
      );
      const i = r.rows[0];
      res.status(201).json({ id: i.id, label: i.label, checked: i.checked, category: i.category });
    } catch (e) { console.error("POST checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/checklist/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_checklist_items SET checked = COALESCE($1, checked), label = COALESCE($2, label) WHERE id = $3 AND project_id = $4 RETURNING *`,
        [typeof b.checked === "boolean" ? b.checked : null, b.label ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const i = r.rows[0];
      res.json({ id: i.id, label: i.label, checked: i.checked, category: i.category });
    } catch (e) { console.error("PATCH checklist", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/checklist/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_checklist_items WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE checklist", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Leveranser ───────────
  app.get("/api/projects/:projectId/deliverables", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(`SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY order_index, due_date NULLS LAST, created_at`, [req.params.projectId]);
      res.json({ deliverables: r.rows.map((d: any) => ({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date })) });
    } catch (e) { console.error("GET deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/deliverables", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (!title) return res.status(400).json({ error: "title_required" });
      const r = await pool.query(
        `INSERT INTO project_deliverables (project_id, title, type, status, due_date, order_index)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0)) RETURNING *`,
        [req.params.projectId, title, b.type || null, b.status || "not_started", b.dueDate || null, b.orderIndex ?? null],
      );
      const d = r.rows[0];
      res.status(201).json({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date });
    } catch (e) { console.error("POST deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.patch("/api/projects/:projectId/deliverables/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const r = await pool.query(
        `UPDATE project_deliverables SET title = COALESCE($1, title), type = COALESCE($2, type),
            status = COALESCE($3, status), due_date = COALESCE($4, due_date), updated_at = NOW()
          WHERE id = $5 AND project_id = $6 RETURNING *`,
        [b.title ?? null, b.type ?? null, b.status ?? null, b.dueDate ?? null, req.params.id, req.params.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const d = r.rows[0];
      res.json({ id: d.id, title: d.title, type: d.type, status: d.status, dueDate: d.due_date });
    } catch (e) { console.error("PATCH deliverables", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/deliverables/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_deliverables WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE deliverables", e); res.status(500).json({ error: "failed" }); }
  });
}
