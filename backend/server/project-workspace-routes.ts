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
 *   project_workspace_deliverables  — Leveranser
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
import { archiveToRoleRoomB2, presignRoleRoomB2Download, getFromRoleRoomB2, slugifyForKey } from "./b2-archive-helper";
import { Vibrant } from "node-vibrant/node";
import { GEN_MODELS, publicModelList, getGenSettings, isWhitelisted, aiAllowed, invalidateGenSettings, emitGenAiMeter, falConfigured, falSubmit, falPoll, falOutputUrl, beebleConfigured, beebleSubmit, beeblePoll, DEFAULT_CREDIT_PACKS } from "./generative-media";
import Stripe from "stripe";
import { ensureCreditSchema as ensureCreditSchemaShared, getUserCredits as getUserCreditsShared, creditMove as creditMoveShared } from "./ai-credits";
import { createGoogleMeetLink } from "./google-meet";
import { classifySession } from "./capture-culling-service";
import { enqueuePhotoEnhancerJobFromBuffer, listPhotoEnhancerJobsByProjectId } from "./photo-enhancer-routes";

// Web-opplasting holdes i minne og skyves server-side til B2 (Role Room-bøtta).
// 60 MB tak — store RAW/originaler skal uansett gjennom capture multipart-flyten.
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });
// Video-review-kopier (komprimert H.264/H.265) — 500 MB tak. Større mastere
// hører hjemme i capture/leveranse-flyten, ikke review-rommet.
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

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
      // VIKTIG: hver setning i SIN egen query med eget .catch. Tidligere kjørte
      // alt i ÉN batch — da rev en kollisjon (eksisterende `project_workspace_deliverables`
      // fra en annen feature mangler `order_index`, så `CREATE INDEX … order_index`
      // feilet) med seg HELE batchen → board_tasks/checklist/images/split_shares
      // ble aldri opprettet og alle tab-ene 500'et. Workspace-leveranser bruker nå
      // sin egen tabell `project_workspace_deliverables` (ikke den kolliderende).
      const stmts: string[] = [
        `CREATE TABLE IF NOT EXISTS project_board_tasks (
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
        )`,
        `CREATE INDEX IF NOT EXISTS idx_pbt_project ON project_board_tasks (project_id, crew_role, order_index)`,
        `CREATE TABLE IF NOT EXISTS project_checklist_items (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          label       TEXT NOT NULL,
          checked     BOOLEAN NOT NULL DEFAULT FALSE,
          category    VARCHAR(40),
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_pci_project ON project_checklist_items (project_id, order_index)`,
        `CREATE TABLE IF NOT EXISTS project_workspace_deliverables (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          title       TEXT NOT NULL,
          type        VARCHAR(60),
          status      VARCHAR(20) NOT NULL DEFAULT 'not_started',
          due_date    DATE,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_pwd_project ON project_workspace_deliverables (project_id, order_index)`,
        `CREATE TABLE IF NOT EXISTS project_images (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id   VARCHAR(64) NOT NULL,
          panel        VARCHAR(40),
          b2_key       TEXT NOT NULL,
          label        VARCHAR(255),
          content_type VARCHAR(80),
          size_bytes   BIGINT,
          uploaded_by  VARCHAR(64),
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE project_images ADD COLUMN IF NOT EXISTS category VARCHAR(40)`,
        `CREATE INDEX IF NOT EXISTS idx_pi_project ON project_images (project_id, panel, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS project_split_shares (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  VARCHAR(64) NOT NULL,
          name        VARCHAR(255),
          email       VARCHAR(255),
          role        VARCHAR(40),
          percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_pss_project ON project_split_shares (project_id, order_index)`,
      ];
      for (const s of stmts) {
        await pool.query(s).catch((e: any) => console.error("[workspace ensureSchema]", e?.message || e));
      }
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

  // ─────────── Klient-feedback + aktivitet (galleri-kommentarer) ───────────
  app.get("/api/projects/:projectId/client-feedback", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const g = await pool.query(`SELECT id FROM photographer_client_galleries WHERE project_id = $1`, [req.params.projectId]).catch(() => ({ rows: [] }));
      const ids = g.rows.map((x: any) => x.id);
      if (ids.length === 0) return res.json({ feedback: [], activity: [] });
      const cm = await pool.query(
        `SELECT client_name, comment, comment_type, created_at FROM client_image_comments
          WHERE gallery_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 20`,
        [ids],
      ).catch(() => ({ rows: [] }));
      const feedback = cm.rows.map((c: any) => ({ clientName: c.client_name, comment: c.comment, type: c.comment_type, at: c.created_at }));
      // Aktivitet = nylige kommentarer + innsendte utvalg.
      const sub = await pool.query(
        `SELECT count(*)::int n, max(submitted_at) AS at FROM client_image_selections
          WHERE gallery_id = ANY($1::uuid[]) AND submitted_at IS NOT NULL`,
        [ids],
      ).catch(() => ({ rows: [{ n: 0, at: null }] }));
      const activity = [
        ...feedback.slice(0, 5).map((f: any) => ({ who: f.clientName || 'Klient', what: 'la igjen en kommentar', at: f.at })),
      ];
      if (sub.rows[0]?.n > 0) activity.unshift({ who: 'Klient', what: `sendte inn ${sub.rows[0].n} utvalgte bilder`, at: sub.rows[0].at });
      res.json({ feedback, activity });
    } catch (e) { console.error("GET client-feedback", e); res.json({ feedback: [], activity: [] }); }
  });

  // ─────────── Klient-review-overflate — klientens hjerter/kommentarer/utvalg ──
  // Full review-tråd: kommentarer m/ type + status + produsent-svar + bilde-
  // thumbnail, fordeling pr type, og utvalgs-sammendrag. Teamet ser hva klienten
  // har sagt på showcase-galleriene og kan svare — uten å forlate workspacet.
  app.get("/api/projects/:projectId/client-reviews", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const g = await pool.query(`SELECT id FROM photographer_client_galleries WHERE project_id = $1`, [req.params.projectId]).catch(() => ({ rows: [] }));
      const ids = g.rows.map((x: any) => x.id);
      if (ids.length === 0) return res.json({ hasGallery: false, comments: [], counts: {}, selections: { selected: 0, submitted: 0 } });
      const [cm, cnt, sel] = await Promise.all([
        pool.query(
          `SELECT c.id, c.client_name, c.client_email, c.comment, c.comment_type, c.status,
                  c.photographer_response, c.responded_at, c.created_at, c.image_id,
                  i.thumbnail_url
             FROM client_image_comments c
             LEFT JOIN client_gallery_images i ON i.id = c.image_id
            WHERE c.gallery_id = ANY($1::uuid[]) ORDER BY c.created_at DESC LIMIT 60`,
          [ids],
        ).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT comment_type, count(*)::int n FROM client_image_comments
            WHERE gallery_id = ANY($1::uuid[]) GROUP BY comment_type`,
          [ids],
        ).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT count(*)::int selected, count(*) FILTER (WHERE submitted_at IS NOT NULL)::int submitted
             FROM client_image_selections WHERE gallery_id = ANY($1::uuid[])`,
          [ids],
        ).catch(() => ({ rows: [{ selected: 0, submitted: 0 }] })),
      ]);
      const counts: any = {};
      cnt.rows.forEach((r: any) => { counts[r.comment_type || "comment"] = r.n; });
      res.json({
        hasGallery: true,
        comments: cm.rows.map((c: any) => ({
          id: c.id, clientName: c.client_name || "Klient", comment: c.comment,
          type: c.comment_type || "comment", status: c.status || "open",
          photographerResponse: c.photographer_response || null, respondedAt: c.responded_at || null,
          thumbUrl: c.thumbnail_url || null, at: c.created_at,
        })),
        counts,
        selections: { selected: sel.rows[0]?.selected || 0, submitted: sel.rows[0]?.submitted || 0 },
      });
    } catch (e) { console.error("GET client-reviews", e); res.json({ hasGallery: false, comments: [], counts: {}, selections: { selected: 0, submitted: 0 } }); }
  });

  // Produsent/team svarer på en klient-kommentar (uten å åpne showcase-admin).
  app.post("/api/projects/:projectId/client-reviews/:commentId/respond", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const response = String((req.body?.response ?? "")).trim();
      if (!response) return res.status(400).json({ error: "response_required" });
      // Verifiser at kommentaren tilhører ETT av prosjektets gallerier (ikke IDOR).
      const g = await pool.query(`SELECT id FROM photographer_client_galleries WHERE project_id = $1`, [req.params.projectId]).catch(() => ({ rows: [] }));
      const ids = g.rows.map((x: any) => x.id);
      if (ids.length === 0) return res.status(404).json({ error: "no_gallery" });
      const upd = await pool.query(
        `UPDATE client_image_comments SET photographer_response = $1, responded_at = NOW(), status = 'responded'
          WHERE id = $2 AND gallery_id = ANY($3::uuid[]) RETURNING id`,
        [response, req.params.commentId, ids],
      ).catch(() => ({ rows: [] }));
      if (upd.rows.length === 0) return res.status(404).json({ error: "comment_not_found" });
      res.json({ ok: true, id: upd.rows[0].id });
    } catch (e) { console.error("POST client-review respond", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Moodboard-meta (stil/palett/notater) ───────────
  app.get("/api/projects/:projectId/moodboard-meta", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS project_moodboard_meta (project_id VARCHAR(64) PRIMARY KEY, style TEXT, palette JSONB, notes JSONB, must_capture JSONB, client_approved VARCHAR(20), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
      const r = await pool.query(`SELECT style, palette, notes, must_capture, client_approved FROM project_moodboard_meta WHERE project_id = $1`, [req.params.projectId]).catch(() => ({ rows: [] }));
      const m = r.rows[0];
      res.json({ meta: m ? { style: m.style, palette: m.palette || [], notes: m.notes || [], mustCapture: m.must_capture || [], clientApproved: m.client_approved } : null });
    } catch (e) { console.error("GET moodboard-meta", e); res.json({ meta: null }); }
  });
  app.put("/api/projects/:projectId/moodboard-meta", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS project_moodboard_meta (project_id VARCHAR(64) PRIMARY KEY, style TEXT, palette JSONB, notes JSONB, must_capture JSONB, client_approved VARCHAR(20), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
      const b = req.body ?? {};
      await pool.query(
        `INSERT INTO project_moodboard_meta (project_id, style, palette, notes, must_capture, client_approved, updated_at)
         VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,NOW())
         ON CONFLICT (project_id) DO UPDATE SET style=EXCLUDED.style, palette=EXCLUDED.palette, notes=EXCLUDED.notes, must_capture=EXCLUDED.must_capture, client_approved=EXCLUDED.client_approved, updated_at=NOW()`,
        [req.params.projectId, b.style || null, JSON.stringify(b.palette || []), JSON.stringify(b.notes || []), JSON.stringify(b.mustCapture || []), b.clientApproved || null],
      );
      res.json({ success: true });
    } catch (e) { console.error("PUT moodboard-meta", e); res.status(500).json({ error: "failed" }); }
  });

  // Auto-uttrekk av fargepalett fra moodboard-referansebildene (node-vibrant).
  // Henter referansene fra B2 server-side (ingen CORS), kjører Vibrant pr bilde,
  // slår sammen + deduperer dominante farger på tvers, navngir til norsk, og
  // lagrer på project_moodboard_meta.palette. canAccessProject-gatet.
  app.post("/api/projects/:projectId/moodboard-meta/extract-palette", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    const hexToRgb = (h: string) => { const x = h.replace("#", ""); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
    const NAMED: Array<[string, number[]]> = [
      ["Elfenben", [246, 242, 235]], ["Krem", [248, 243, 230]], ["Champagne", [234, 217, 193]], ["Sand", [220, 201, 177]], ["Beige", [225, 210, 185]], ["Taupe", [180, 160, 140]],
      ["Terrakotta", [200, 110, 80]], ["Rust", [160, 82, 45]], ["Brun", [120, 80, 55]], ["Mørk brun", [70, 50, 40]], ["Mokka", [110, 85, 70]],
      ["Gull", [212, 160, 23]], ["Oker", [204, 160, 40]], ["Sennep", [200, 170, 60]],
      ["Salvie", [166, 180, 154]], ["Mørk grønn", [46, 74, 59]], ["Oliven", [120, 128, 80]], ["Skoggrønn", [60, 100, 70]], ["Mynte", [170, 200, 180]], ["Petrol", [40, 90, 100]],
      ["Marineblå", [40, 55, 90]], ["Himmelblå", [150, 180, 210]], ["Støvet blå", [120, 140, 160]],
      ["Lavendel", [180, 170, 200]], ["Plomme", [110, 70, 100]], ["Rosa", [220, 180, 180]], ["Pudderrosa", [230, 200, 195]], ["Vinrød", [120, 40, 50]], ["Korall", [240, 140, 120]],
      ["Kull", [40, 40, 44]], ["Grafitt", [70, 72, 78]], ["Grå", [140, 140, 145]], ["Lys grå", [200, 200, 205]], ["Sort", [20, 20, 22]], ["Hvit", [250, 250, 250]],
    ];
    const nearestName = (hex: string) => {
      const [r, g, b] = hexToRgb(hex); let best = "Farge", bd = Infinity;
      for (const [name, [nr, ng, nb]] of NAMED) { const d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2; if (d < bd) { bd = d; best = name; } }
      return best;
    };
    try {
      const pid = req.params.projectId;
      const imgs = await pool.query(
        `SELECT b2_key FROM project_images WHERE project_id = $1 AND panel IN ('references','moodboard','moodboard-shared') ORDER BY created_at DESC LIMIT 8`,
        [pid],
      ).catch(() => ({ rows: [] }));
      if (imgs.rows.length === 0) return res.status(400).json({ error: "no_references", message: "Last opp referansebilder først." });
      const collected: Array<{ hex: string; pop: number }> = [];
      for (const im of imgs.rows) {
        const obj = await getFromRoleRoomB2(im.b2_key).catch(() => null);
        if (!obj?.body) continue;
        try {
          const palette: any = await Vibrant.from(obj.body).getPalette();
          for (const key of ["Vibrant", "Muted", "DarkVibrant", "DarkMuted", "LightVibrant", "LightMuted"]) {
            const sw = palette[key]; if (sw?.hex) collected.push({ hex: sw.hex, pop: sw.population || 1 });
          }
        } catch { /* ikke-dekodbar */ }
      }
      if (collected.length === 0) return res.status(422).json({ error: "extract_failed", message: "Klarte ikke lese farger fra referansene." });
      // Dedupe like farger (RGB-avstand < ~48), behold høyest populasjon.
      collected.sort((a, b) => b.pop - a.pop);
      const merged: Array<{ hex: string; pop: number }> = [];
      for (const c of collected) {
        const [r, g, b] = hexToRgb(c.hex);
        const dup = merged.find((m) => { const [mr, mg, mb] = hexToRgb(m.hex); return ((r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2) < 48 * 48; });
        if (!dup) merged.push(c);
        if (merged.length >= 6) break;
      }
      const usedNames = new Set<string>();
      const palette = merged.map((c) => {
        let name = nearestName(c.hex); if (usedNames.has(name)) name = `${name} ${[...usedNames].filter((n) => n.startsWith(name)).length + 1}`;
        usedNames.add(name); return { name, hex: c.hex.toUpperCase() };
      });
      // Lagre på meta (behold style/notes/mustCapture).
      await pool.query(`CREATE TABLE IF NOT EXISTS project_moodboard_meta (project_id VARCHAR(64) PRIMARY KEY, style TEXT, palette JSONB, notes JSONB, must_capture JSONB, client_approved VARCHAR(20), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
      await pool.query(
        `INSERT INTO project_moodboard_meta (project_id, palette, updated_at) VALUES ($1,$2::jsonb,NOW())
         ON CONFLICT (project_id) DO UPDATE SET palette=EXCLUDED.palette, updated_at=NOW()`,
        [pid, JSON.stringify(palette)],
      );
      res.json({ palette, fromImages: imgs.rows.length });
    } catch (e) { console.error("POST extract-palette", e); res.status(500).json({ error: "failed" }); }
  });

  // AI-stilnotater: analyser referansebildene m/ Claude vision → stil-retning,
  // mood-deskriptorer, stilnotater og foreslåtte «må fanges»-shots. Lagres på meta.
  app.post("/api/projects/:projectId/moodboard-meta/generate-notes", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const imgs = await pool.query(
        `SELECT b2_key, content_type FROM project_images WHERE project_id = $1 AND panel IN ('references','moodboard','moodboard-shared') ORDER BY created_at DESC LIMIT 6`,
        [pid],
      ).catch(() => ({ rows: [] }));
      if (imgs.rows.length === 0) return res.status(400).json({ error: "no_references", message: "Last opp referansebilder først." });
      // Bygg vision-innhold (base64 av referansene).
      const content: any[] = [];
      for (const im of imgs.rows) {
        const obj = await getFromRoleRoomB2(im.b2_key).catch(() => null);
        if (!obj?.body) continue;
        const mime = im.content_type || obj.contentType || "image/jpeg";
        if (!/^image\/(jpe?g|png|webp|gif)$/i.test(mime)) continue;
        content.push({ type: "image", source: { type: "base64", media_type: mime, data: obj.body.toString("base64") } });
        if (content.length >= 6) break;
      }
      if (content.length === 0) return res.status(422).json({ error: "no_usable_images" });
      content.push({ type: "text", text: "Dette er moodboard-referanser for et foto/video-prosjekt. Kall moodboard_notes med stil-retning, mood-deskriptorer, konkrete stilnotater for fotografen, og foreslåtte «må fanges»-øyeblikk. Svar på NORSK." });
      let client: any;
      try {
        const mod: any = await import("@anthropic-ai/sdk");
        const Ctor = mod.default ?? mod.Anthropic;
        client = new Ctor({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
      } catch { return res.status(503).json({ error: "ai_not_configured" }); }
      const TOOL = {
        name: "moodboard_notes",
        description: "Strukturerte stilnotater fra moodboard-referanser.",
        input_schema: {
          type: "object",
          properties: {
            styleDirection: { type: "string", description: "Kort stil-retning, f.eks. 'Romantisk / Editorial'" },
            moods: { type: "array", items: { type: "string" }, description: "3-6 mood-deskriptorer" },
            notes: { type: "array", items: { type: "string" }, description: "4-8 konkrete stilnotater for fotografen" },
            mustCapture: { type: "array", items: { type: "string" }, description: "3-6 må-fanges-øyeblikk" },
          },
          required: ["styleDirection", "moods", "notes", "mustCapture"],
        },
      };
      const resp = await client.messages.create({
        model: process.env.CAPTURE_ANALYZE_MODEL || "claude-opus-4-7",
        max_tokens: 1024,
        tools: [TOOL], tool_choice: { type: "tool", name: "moodboard_notes" },
        messages: [{ role: "user", content }],
      });
      try { (await import("./ai-usage-tracker")).logAIUsage?.(resp as any, { feature: "workspace/moodboard-notes", userId: uid }); } catch { /* */ }
      const tu = (resp.content || []).find((b: any) => b.type === "tool_use" && b.name === "moodboard_notes");
      const out: any = tu?.input || {};
      const styleDirection = String(out.styleDirection || "").slice(0, 200);
      const notes = Array.isArray(out.notes) ? out.notes.map((s: any) => String(s).slice(0, 300)).filter(Boolean) : [];
      const mustCapture = Array.isArray(out.mustCapture) ? out.mustCapture.map((s: any) => ({ label: String(s).slice(0, 200), done: false })).filter((x: any) => x.label) : [];
      const moods = Array.isArray(out.moods) ? out.moods.map((s: any) => String(s).slice(0, 60)).filter(Boolean) : [];
      // Lagre på meta (behold palette).
      await pool.query(`CREATE TABLE IF NOT EXISTS project_moodboard_meta (project_id VARCHAR(64) PRIMARY KEY, style TEXT, palette JSONB, notes JSONB, must_capture JSONB, client_approved VARCHAR(20), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
      await pool.query(
        `INSERT INTO project_moodboard_meta (project_id, style, notes, must_capture, updated_at) VALUES ($1,$2,$3::jsonb,$4::jsonb,NOW())
         ON CONFLICT (project_id) DO UPDATE SET style=EXCLUDED.style, notes=EXCLUDED.notes, must_capture=EXCLUDED.must_capture, updated_at=NOW()`,
        [pid, styleDirection || null, JSON.stringify(notes), JSON.stringify(mustCapture)],
      );
      res.json({ styleDirection, moods, notes, mustCapture, fromImages: content.length });
    } catch (e) { console.error("POST generate-notes", e); res.status(500).json({ error: "failed" }); }
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

  // ─────────── Media-mappestruktur (maler + egne) ───────────
  // Maler matcher One Desk/iPad-ingest-strukturen. project_id-scopet.
  const FOLDER_TEMPLATES: Record<string, { label: string; folders: string[] }> = {
    wedding: { label: 'Bryllup (foto + video)', folders: ['01_Brief', '02_Shotlists', '03_Photo_RAW', '04_Video_A_Cam', '05_Video_B_Cam', '06_Drone', '07_Audio', '08_Selects', '09_Client_Review', '10_Final_Delivery', 'Archive'] },
    portrait: { label: 'Portrett / Foto', folders: ['01_Brief', '02_RAW', '03_Selects', '04_Edited', '05_Client_Review', '06_Final'] },
    commercial: { label: 'Kommersiell', folders: ['01_Brief', '02_RAW', '03_Video', '04_Audio', '05_Graphics', '06_Selects', '07_Client_Review', '08_Final'] },
  };
  async function ensureFoldersTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS project_media_folders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pmf_project ON project_media_folders (project_id, order_index)`).catch(() => undefined);
  }

  app.get("/api/projects/:projectId/media-folders", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureFoldersTable();
      const r = await pool.query(`SELECT id, name, order_index FROM project_media_folders WHERE project_id = $1 ORDER BY order_index, name`, [req.params.projectId]);
      res.json({ folders: r.rows.map((f: any) => ({ id: f.id, name: f.name })), templates: Object.entries(FOLDER_TEMPLATES).map(([key, t]) => ({ key, label: t.label, count: t.folders.length })) });
    } catch (e) { console.error("GET media-folders", e); res.json({ folders: [], templates: [] }); }
  });
  app.post("/api/projects/:projectId/media-folders", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureFoldersTable();
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!name) return res.status(400).json({ error: "name_required" });
      const r = await pool.query(`INSERT INTO project_media_folders (project_id, name, order_index) VALUES ($1,$2,COALESCE($3,999)) RETURNING id, name`, [req.params.projectId, name, req.body?.orderIndex ?? null]);
      res.status(201).json({ id: r.rows[0].id, name: r.rows[0].name });
    } catch (e) { console.error("POST media-folders", e); res.status(500).json({ error: "failed" }); }
  });
  app.post("/api/projects/:projectId/media-folders/apply-template", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureFoldersTable();
      const tpl = FOLDER_TEMPLATES[String(req.body?.template || "")];
      if (!tpl) return res.status(400).json({ error: "unknown_template" });
      for (let i = 0; i < tpl.folders.length; i++) {
        await pool.query(
          `INSERT INTO project_media_folders (project_id, name, order_index)
           SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM project_media_folders WHERE project_id = $1 AND name = $2)`,
          [req.params.projectId, tpl.folders[i], i],
        );
      }
      const r = await pool.query(`SELECT id, name FROM project_media_folders WHERE project_id = $1 ORDER BY order_index, name`, [req.params.projectId]);
      res.json({ folders: r.rows.map((f: any) => ({ id: f.id, name: f.name })) });
    } catch (e) { console.error("apply-template", e); res.status(500).json({ error: "failed" }); }
  });
  app.delete("/api/projects/:projectId/media-folders/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try { await ensureFoldersTable(); await pool.query(`DELETE FROM project_media_folders WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE media-folders", e); res.status(500).json({ error: "failed" }); }
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

  // ─────────── Talenotater — fotografens innspilte voice-memos på bilder ───────
  // Capture-appen lar fotografen spille inn en talenotat (AAC/m4a) på et enkelt
  // bilde (capture_reviews.audio_key). Editor/team hører konteksten direkte:
  // «dette er hero-bildet», «fiks refleksen her». Presignet lyd + thumbnail.
  app.get("/api/projects/:projectId/voice-notes", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const sessions = await pool.query(
        `SELECT id FROM capture_sessions WHERE project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const sessionIds = sessions.rows.map((s: any) => s.id);
      if (sessionIds.length === 0) return res.json({ notes: [], hasNotes: false });
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "40"), 10) || 40));
      const rows = await pool.query(
        `SELECT r.id, r.asset_id, r.reviewer_id, r.comment, r.rating, r.heart,
                r.audio_key, r.audio_duration_seconds, r.created_at,
                a.original_filename, a.preview_key
           FROM capture_reviews r
           JOIN capture_assets a ON a.id = r.asset_id
          WHERE a.session_id = ANY($1::uuid[]) AND r.audio_key IS NOT NULL
          ORDER BY r.created_at DESC LIMIT $2`,
        [sessionIds, limit],
      ).catch(() => ({ rows: [] }));
      const notes = await Promise.all(rows.rows.map(async (r: any) => ({
        id: r.id,
        assetId: r.asset_id,
        filename: r.original_filename,
        comment: r.comment || null,
        rating: r.rating || null,
        heart: r.heart || false,
        durationSeconds: r.audio_duration_seconds || null,
        audioUrl: r.audio_key ? await signAssetReadUrl(r.audio_key) : null,
        thumbUrl: r.preview_key ? await signAssetReadUrl(r.preview_key) : null,
        createdAt: r.created_at,
      })));
      res.json({ notes, hasNotes: notes.length > 0 });
    } catch (e) { console.error("GET voice-notes", e); res.json({ notes: [], hasNotes: false }); }
  });

  // ─────────── Capture-aktivitet — live hendelseslogg fra iPad + One Desk ──────
  // capture_events er den ekte aktivitetsstrømmen (skudd lastet, rating endret,
  // culling, handoff, levert). Web backfiller siste N her og appender deretter
  // live via capture-WS (broadcastCaptureEvent sender samme rad-form).
  app.get("/api/projects/:projectId/capture-activity", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const sessions = await pool.query(
        `SELECT id FROM capture_sessions WHERE project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const sessionIds = sessions.rows.map((s: any) => s.id);
      if (sessionIds.length === 0) return res.json({ events: [], hasActivity: false });
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "40"), 10) || 40));
      const rows = await pool.query(
        `SELECT e.id, e.session_id, e.asset_id, e.actor_id, e.event_type, e.metadata, e.created_at,
                a.original_filename, u.name AS actor_name
           FROM capture_events e
           LEFT JOIN capture_assets a ON a.id = e.asset_id
           LEFT JOIN users u ON u.id = e.actor_id
          WHERE e.session_id = ANY($1::uuid[])
          ORDER BY e.created_at DESC LIMIT $2`,
        [sessionIds, limit],
      ).catch(() => ({ rows: [] }));
      const events = rows.rows.map((r: any) => ({
        id: r.id,
        type: r.event_type,
        assetId: r.asset_id || null,
        filename: r.original_filename || null,
        actorName: r.actor_name || null,
        metadata: r.metadata || null,
        createdAt: r.created_at,
      }));
      res.json({ events, hasActivity: events.length > 0 });
    } catch (e) { console.error("GET capture-activity", e); res.json({ events: [], hasActivity: false }); }
  });

  // ─────────── AI-forbedring-status — photo_enhancement_jobs pr prosjekt ───────
  // Persistent jobb-tabell (project_id-scopet) fra photo-enhancer-pipelinen
  // (GFPGAN/Real-ESRGAN). Surfacer fremdrift + Før/Etter i Media.
  app.get("/api/projects/:projectId/enhance-status", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const rows = await pool.query(
        `SELECT id, photo_id, enhancement_type, model_used, original_image_url,
                enhanced_image_url, thumbnail_url, status, progress, processing_time,
                error_message, created_at, completed_at
           FROM photo_enhancement_jobs WHERE project_id = $1
          ORDER BY created_at DESC LIMIT 60`,
        [pid],
      ).catch(() => ({ rows: [] }));
      const jobs = rows.rows.map((r: any) => ({
        id: r.id, photoId: r.photo_id, type: r.enhancement_type, model: r.model_used,
        originalUrl: r.original_image_url || null, enhancedUrl: r.enhanced_image_url || null,
        thumbUrl: r.thumbnail_url || null, status: r.status, progress: r.progress ?? null,
        processingMs: r.processing_time ?? null, error: r.error_message || null,
        createdAt: r.created_at, completedAt: r.completed_at,
      }));
      // Flett inn in-memory-jobber utløst FRA workspacet/capture-deliver (lever
      // ikke i DB-tabellen), deduplisert på id. Statusene normaliseres til DB-form.
      const memJobs = listPhotoEnhancerJobsByProjectId(pid).map((m: any) => ({
        id: m.id, photoId: m.fileName, type: "ai-enhance", model: m.preset || "AI",
        originalUrl: null, enhancedUrl: m.enhancedUrl || null, thumbUrl: m.thumbUrl || null,
        status: m.status === "completed" ? "completed" : m.status === "failed" ? "failed" : m.status === "cancelled" ? "failed" : "processing",
        progress: m.progress ?? null, processingMs: null, error: null,
        createdAt: m.createdAt, completedAt: m.completedAt, inMemory: true,
      }));
      const seen = new Set(jobs.map((j: any) => j.id));
      const merged = [...memJobs.filter((m: any) => !seen.has(m.id)), ...jobs];
      const done = merged.filter((j: any) => j.status === "completed" || j.status === "done").length;
      const running = merged.filter((j: any) => j.status === "processing" || j.status === "running" || j.status === "queued" || j.status === "pending").length;
      const failed = merged.filter((j: any) => j.status === "failed" || j.status === "error").length;
      res.json({ hasJobs: merged.length > 0, jobs: merged, summary: { total: merged.length, done, running, failed } });
    } catch (e) { console.error("GET enhance-status", e); res.json({ hasJobs: false, jobs: [] }); }
  });

  // ─────────── Send til AI-forbedring — utløs enhance på valgte/markerte bilder ─
  // Team-handling: send prosjektets bilder gjennom photo-enhancer-pipelinen
  // (GFPGAN/Real-ESRGAN) FRA workspacet. canAccessProject-gatet. Henter buffer
  // fra B2 (full_key ?? preview_key) og køer via enqueuePhotoEnhancerJobFromBuffer.
  app.post("/api/projects/:projectId/enhance-picks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      const model = GEN_MODELS["photo-enhance"];
      const body = (req.body ?? {}) as { assetIds?: unknown; preset?: unknown };
      const preset = typeof body.preset === "string" && body.preset ? body.preset : "auto";
      const sessions = await pool.query(`SELECT id FROM capture_sessions WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      const sessionIds = sessions.rows.map((s: any) => s.id);
      if (sessionIds.length === 0) return res.status(404).json({ error: "no_session" });
      const requested = Array.isArray(body.assetIds) ? body.assetIds.filter((v: any) => typeof v === "string" && v) : [];
      // Eksplisitt liste, ellers default til klient-markerte bilder (picks).
      const rows = requested.length
        ? await pool.query(`SELECT id, full_key, preview_key, mime, original_filename FROM capture_assets WHERE session_id = ANY($1::uuid[]) AND id = ANY($2::uuid[]) AND rejected IS NOT TRUE`, [sessionIds, requested]).catch(() => ({ rows: [] }))
        : await pool.query(`SELECT id, full_key, preview_key, mime, original_filename FROM capture_assets WHERE session_id = ANY($1::uuid[]) AND flagged_for_client IS TRUE AND rejected IS NOT TRUE ORDER BY rating DESC NULLS LAST LIMIT 30`, [sessionIds]).catch(() => ({ rows: [] }));
      if (rows.rows.length === 0) return res.status(400).json({ error: "no_assets", message: "Ingen bilder å forbedre (marker bilder for klient først, eller send assetIds)." });
      // Gate + dagstak + kreditt-pre-sjekk for HELE batchen (N bilder).
      if (settings.enabled) {
        if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted", message: "AI-forbedring er ikke aktivert for din konto." });
        const batchCost = rows.rows.length * model.estCostUsd;
        const spent = await spentTodayUsd();
        if (spent + batchCost > settings.dailyCapUsd) return res.status(429).json({ error: "daily_cap", message: `Dagstak nådd ($${settings.dailyCapUsd}).` });
        const pf = await creditPreflight(settings, uid, batchCost);
        if (!pf.ok) return res.status(402).json({ error: "insufficient_credits", message: `Ikke nok kreditter for ${rows.rows.length} bilder (rest $${pf.balance.toFixed(2)}, trenger $${pf.retail.toFixed(2)}). Kjøp mer.` });
      }
      const jobs: any[] = []; const failures: any[] = [];
      for (const r of rows.rows) {
        const sourceKey = r.full_key || r.preview_key;
        if (!sourceKey) { failures.push({ assetId: r.id, reason: "no_source_key" }); continue; }
        try {
          const url = await signAssetReadUrl(sourceKey);
          const resp = await fetch(url);
          if (!resp.ok) { failures.push({ assetId: r.id, reason: `b2_fetch_${resp.status}` }); continue; }
          const buffer = Buffer.from(await resp.arrayBuffer());
          const jobId = await enqueuePhotoEnhancerJobFromBuffer({
            buffer, fileName: r.original_filename || `${r.id}.jpg`, mimeType: r.mime || "image/jpeg",
            projectId: pid, owner: uid, userId: uid, preset,
          });
          if (!jobId) { failures.push({ assetId: r.id, reason: "enqueue_failed" }); continue; }
          // Bill per faktisk køet bilde (charge-on-submit; enhancer kjører i egen kø).
          if (settings.enabled) {
            const gid = crypto.randomUUID();
            await pool.query(
              `INSERT INTO generative_ai_jobs (id, project_id, user_id, user_email, model, kind, status, provider, source_asset_id, est_cost_usd, completed_at, input)
               VALUES ($1,$2,$3,$4,$5,'image-edit','completed',$6,$7,$8,NOW(),$9::jsonb)`,
              [gid, pid, uid, me.email, model.key, model.provider, r.id, model.estCostUsd, JSON.stringify({ prompt: "Foto-forbedring", enhancerJobId: jobId })],
            ).catch(() => {});
            try { await emitGenAiMeter(pool, { userId: uid, valueUsd: model.estCostUsd, settings }); } catch { /* */ }
            if (settings.billingMode === "credits") { try { await creditMove(uid, "spend", -(model.estCostUsd * (settings.markupMultiplier || 1)), `enhance:${jobId}`, "photo-enhance"); } catch { /* */ } }
          }
          jobs.push({ assetId: r.id, jobId });
        } catch { failures.push({ assetId: r.id, reason: "fetch_threw" }); }
      }
      res.status(202).json({ queued: jobs.length, jobs, failures });
    } catch (e) { console.error("POST enhance-picks", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── AI-cull-forslag — classifySession på prosjektets capture_assets ──
  // Samme cull-motor som iPad-en (capture-culling-service). Teamet ser AI sine
  // hero/keep/weak/reject-bøtter + dub-klynger uten å åpne iPad-en. Read-only.
  app.get("/api/projects/:projectId/cull-suggestions", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const sessions = await pool.query(
        `SELECT id FROM capture_sessions WHERE project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const sessionIds = sessions.rows.map((s: any) => s.id);
      if (sessionIds.length === 0) return res.json({ hasAssets: false, total: 0, counts: {}, weak: [], reject: [] });
      const strictnessRaw = String(req.query.strictness || "").trim().toLowerCase();
      const strictness: any = (strictnessRaw === "conservative" || strictnessRaw === "aggressive") ? strictnessRaw : "balanced";
      const a = await pool.query(
        `SELECT id, rating, rejected, flagged_for_client, signals, original_filename, preview_key
           FROM capture_assets WHERE session_id = ANY($1::uuid[]) ORDER BY capture_time ASC NULLS LAST`,
        [sessionIds],
      ).catch(() => ({ rows: [] }));
      const meta = new Map<string, any>(a.rows.map((r: any) => [r.id, r]));
      const forCulling = a.rows.map((r: any) => ({
        id: r.id, rating: r.rating ?? 0, rejected: r.rejected ?? false,
        flaggedForClient: r.flagged_for_client ?? false, signals: (r.signals ?? {}),
      }));
      const summary: any = classifySession(forCulling as any, { strictness });
      // Berik weak/reject med filnavn + presignet thumbnail (det teamet vurderer).
      const enrich = async (list: any[]) => Promise.all((list || []).slice(0, 24).map(async (s: any) => {
        const m = meta.get(s.assetId) || {};
        return { assetId: s.assetId, score: s.score, reasons: s.reasons || [], filename: m.original_filename || null, thumbUrl: m.preview_key ? await signAssetReadUrl(m.preview_key) : null };
      }));
      const [weak, reject] = await Promise.all([enrich(summary.weak), enrich(summary.reject)]);
      res.json({
        hasAssets: true, total: summary.total || 0, strictness,
        counts: { hero: (summary.hero || []).length, keep: (summary.keep || []).length, weak: (summary.weak || []).length, reject: (summary.reject || []).length, duplicates: Object.keys(summary.duplicateClusters || {}).length },
        weak, reject,
      });
    } catch (e) { console.error("GET cull-suggestions", e); res.json({ hasAssets: false, total: 0, counts: {}, weak: [], reject: [] }); }
  });

  // ─────────── Sound Room — bro fra workspace-prosjekt → audio_review_project ──
  // Audio Showcase («Universal Showcase»-review) har sitt EGET prosjekt-begrep
  // (audio_review_projects). Vi finn-eller-oppretter ett koblet til workspace-
  // prosjektet via bro-tabell project_audio_rooms, slik at Sound Room-fanen
  // åpner den eksisterende full-skjerm review-opplevelsen for nettopp dette
  // prosjektet. canAccessProject-gatet.
  app.get("/api/projects/:projectId/audio-room", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      await pool.query(`CREATE TABLE IF NOT EXISTS project_audio_rooms (
        project_id uuid PRIMARY KEY,
        audio_review_project_id uuid NOT NULL,
        created_at timestamptz DEFAULT now()
      )`).catch(() => {});
      // Eksisterende kobling? Verifiser at audio-review-prosjektet fortsatt finnes.
      const ex = await pool.query(`SELECT audio_review_project_id FROM project_audio_rooms WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      if (ex.rows.length) {
        const chk = await pool.query(`SELECT id FROM audio_review_projects WHERE id = $1::uuid`, [ex.rows[0].audio_review_project_id]).catch(() => ({ rows: [] }));
        if (chk.rows.length) return res.json({ audioRoomId: ex.rows[0].audio_review_project_id, created: false });
      }
      // Opprett — seed tittel/band fra workspace-prosjektet, eid av prosjekteier.
      const proj = await pool.query(`SELECT COALESCE(NULLIF(name,''), NULLIF(title,''), 'Lydrom') AS name, client_name, user_id FROM projects WHERE id = $1 LIMIT 1`, [pid]).catch(() => ({ rows: [] }));
      const title = proj.rows[0]?.name || "Lydrom";
      const band = proj.rows[0]?.client_name || null;
      const owner = proj.rows[0]?.user_id || uid;
      const created = await pool.query(
        `INSERT INTO audio_review_projects (owner_user_id, title, band_name) VALUES ($1,$2,$3) RETURNING id`,
        [owner, title, band],
      );
      const arId = created.rows[0].id;
      await pool.query(
        `INSERT INTO project_audio_rooms (project_id, audio_review_project_id) VALUES ($1,$2)
         ON CONFLICT (project_id) DO UPDATE SET audio_review_project_id = EXCLUDED.audio_review_project_id`,
        [pid, arId],
      ).catch(() => {});
      res.json({ audioRoomId: arId, created: true });
    } catch (e) { console.error("GET audio-room", e); res.status(500).json({ error: "failed" }); }
  });

  // Brukerens EaseVerse-tracks (for å koble inn i Sound Room). Markerer hvilken
  // som er koblet til DETTE prosjektets Sound Room nå.
  app.get("/api/projects/:projectId/easeverse-tracks", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const linked = await pool.query(
        `SELECT a.easeverse_track_id FROM project_audio_rooms r JOIN audio_review_projects a ON a.id = r.audio_review_project_id WHERE r.project_id = $1`,
        [req.params.projectId],
      ).catch(() => ({ rows: [] }));
      const linkedTrackId = linked.rows[0]?.easeverse_track_id || null;
      const t = await pool.query(
        `SELECT id, title, artist, status, bpm, musical_key, duration_seconds, updated_at,
                EXISTS(SELECT 1 FROM audio_review_projects ar WHERE ar.easeverse_track_id = easeverse_tracks.id::text) AS has_review
           FROM easeverse_tracks WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 50`,
        [uid],
      ).catch(() => ({ rows: [] }));
      res.json({
        connected: t.rows.length > 0,
        linkedTrackId,
        tracks: t.rows.map((r: any) => ({ id: r.id, title: r.title, artist: r.artist, status: r.status, bpm: r.bpm, key: r.musical_key, durationSeconds: r.duration_seconds, hasReview: !!r.has_review, linked: r.id === linkedTrackId })),
      });
    } catch (e) { console.error("GET easeverse-tracks", e); res.json({ connected: false, tracks: [] }); }
  });

  // Koble en EaseVerse-track til prosjektets Sound Room: finn/opprett review-rom
  // (m/ easeverse_track_id → full toveis-synk: tekst/takes/DAW/status) og pek
  // bro-tabellen på den. Krever at brukeren eier track-en.
  app.post("/api/projects/:projectId/audio-room/link-easeverse", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const trackId = String(req.body?.trackId || "");
      if (!trackId) return res.status(400).json({ error: "trackId_required" });
      const tr = await pool.query(`SELECT id, title, artist, genre, bpm, musical_key, collaborators FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, uid]).catch(() => ({ rows: [] }));
      const track = tr.rows[0];
      if (!track) return res.status(404).json({ error: "track_not_found" });
      // Finn eksisterende review for track-en, ellers opprett (samme som send-to-review).
      let arId: string | null = null;
      const exist = await pool.query(`SELECT id FROM audio_review_projects WHERE easeverse_track_id = $1 AND owner_user_id = $2 AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`, [trackId, uid]).catch(() => ({ rows: [] }));
      if (exist.rows.length) arId = exist.rows[0].id;
      else {
        const ins = await pool.query(
          `INSERT INTO audio_review_projects (owner_user_id, title, artist_name, genre, bpm, musical_key, status, easeverse_track_id, external_track_id)
           VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$7) RETURNING id`,
          [uid, track.title || "EaseVerse-låt", track.artist || null, track.genre || null, track.bpm || null, track.musical_key || null, trackId],
        );
        arId = ins.rows[0].id;
      }
      await pool.query(`CREATE TABLE IF NOT EXISTS project_audio_rooms (project_id uuid PRIMARY KEY, audio_review_project_id uuid NOT NULL, created_at timestamptz DEFAULT now())`).catch(() => {});
      await pool.query(
        `INSERT INTO project_audio_rooms (project_id, audio_review_project_id) VALUES ($1,$2)
         ON CONFLICT (project_id) DO UPDATE SET audio_review_project_id = EXCLUDED.audio_review_project_id`,
        [pid, arId],
      ).catch(() => {});
      // Auto-synk band-roster fra EaseVerse-collaborators → review-medlemmer m/ invite-token (samme som audio-showcase sync-collaborators).
      let bandSynced = 0;
      try {
        const raw = track.collaborators;
        const collabs: string[] = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || "[]"); } catch { return []; } })();
        if (collabs.length) {
          const existing = await pool.query(`SELECT name FROM audio_review_members WHERE project_id=$1::uuid`, [arId]).catch(() => ({ rows: [] }));
          const have = new Set(existing.rows.map((r: any) => String(r.name || "").trim().toLowerCase()));
          const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
          let idx = existing.rows.length;
          for (const c of collabs) {
            const nm = String(c || "").trim();
            if (!nm || have.has(nm.toLowerCase())) continue;
            const token = "inv_" + crypto.randomUUID().replace(/-/g, "");
            await pool.query(
              `INSERT INTO audio_review_members (project_id, name, role, avatar_color, is_owner, order_index, invite_token, invite_status, invited_at, invite_expires_at)
               VALUES ($1::uuid,$2,'Bidragsyter',$3,false,$4,$5,'pending',NOW(),NOW()+INTERVAL '90 days')`,
              [arId, nm, PALETTE[idx % PALETTE.length], idx, token],
            ).catch(() => {});
            have.add(nm.toLowerCase()); idx++; bandSynced++;
          }
        }
      } catch { /* roster-synk er best-effort */ }
      res.json({ audioRoomId: arId, linked: true, bandSynced });
    } catch (e) { console.error("POST link-easeverse", e); res.status(500).json({ error: "failed" }); }
  });

  // Band-roster for det koblede lydrommet — medlemmer m/ invite-status + delelenke.
  const resolveAudioRoomId = async (pid: string, uid: string): Promise<string | null> => {
    const r = await pool.query(
      `SELECT ar.audio_review_project_id FROM project_audio_rooms ar
       JOIN audio_review_projects p ON p.id = ar.audio_review_project_id
       WHERE ar.project_id = $1::uuid AND p.owner_user_id = $2 LIMIT 1`,
      [pid, uid],
    ).catch(() => ({ rows: [] }));
    return r.rows[0]?.audio_review_project_id || null;
  };

  app.get("/api/projects/:projectId/audio-room/members", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const arId = await resolveAudioRoomId(req.params.projectId, uid);
      if (!arId) return res.json({ members: [] });
      const m = await pool.query(
        `SELECT id, name, role, instrument, email, avatar_color, is_owner, invite_status, invite_token, easeverse_access
         FROM audio_review_members WHERE project_id = $1::uuid ORDER BY is_owner DESC, order_index ASC, created_at ASC`,
        [arId],
      ).catch(() => ({ rows: [] }));
      const members = m.rows.map((x: any) => ({
        id: x.id, name: x.name, role: x.role, instrument: x.instrument || null, email: x.email || null,
        avatarColor: x.avatar_color, isOwner: x.is_owner, status: x.invite_status,
        inviteUrl: x.invite_token && !x.is_owner ? `/audio-review/invite/${x.invite_token}` : null,
        easeverseAccess: x.easeverse_access || false,
      }));
      res.json({ audioRoomId: arId, members });
    } catch (e) { console.error("GET audio-room/members", e); res.status(500).json({ error: "failed" }); }
  });

  app.post("/api/projects/:projectId/audio-room/members", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      // Finn-eller-opprett lydrommet, så «Inviter band» fungerer selv før første låt er koblet.
      let arId = await resolveAudioRoomId(req.params.projectId, uid);
      if (!arId) {
        // Opprett tomt lydrom koblet til workspace-prosjektet.
        const ins = await pool.query(
          `INSERT INTO audio_review_projects (owner_user_id, title, status) VALUES ($1,$2,'draft') RETURNING id`,
          [uid, "Lydrom"],
        );
        arId = ins.rows[0].id;
        await pool.query(`CREATE TABLE IF NOT EXISTS project_audio_rooms (project_id uuid PRIMARY KEY, audio_review_project_id uuid NOT NULL, created_at timestamptz DEFAULT now())`).catch(() => {});
        await pool.query(
          `INSERT INTO project_audio_rooms (project_id, audio_review_project_id) VALUES ($1,$2)
           ON CONFLICT (project_id) DO UPDATE SET audio_review_project_id = EXCLUDED.audio_review_project_id`,
          [req.params.projectId, arId],
        ).catch(() => {});
      }
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "name_required" });
      const role = String(req.body?.role || "Bidragsyter").trim() || "Bidragsyter";
      const instrument = req.body?.instrument ? String(req.body.instrument).trim() : null;
      const email = req.body?.email ? String(req.body.email).trim() : null;
      const dup = await pool.query(`SELECT 1 FROM audio_review_members WHERE project_id=$1::uuid AND lower(name)=lower($2) LIMIT 1`, [arId, name]).catch(() => ({ rows: [] }));
      if (dup.rows.length) return res.status(409).json({ error: "member_exists" });
      const cnt = await pool.query(`SELECT count(*)::int AS n FROM audio_review_members WHERE project_id=$1::uuid`, [arId]).catch(() => ({ rows: [{ n: 0 }] }));
      const idx = cnt.rows[0]?.n || 0;
      const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
      const token = "inv_" + crypto.randomUUID().replace(/-/g, "");
      const created = await pool.query(
        `INSERT INTO audio_review_members (project_id, name, role, avatar_color, is_owner, order_index, email, instrument, invite_token, invite_status, invited_at, invite_expires_at)
         VALUES ($1::uuid,$2,$3,$4,false,$5,$6,$7,$8,'pending',NOW(),NOW()+INTERVAL '90 days') RETURNING id`,
        [arId, name, role, PALETTE[idx % PALETTE.length], idx, email, instrument, token],
      );
      res.status(201).json({ id: created.rows[0].id, audioRoomId: arId, inviteUrl: `/audio-review/invite/${token}`, status: "pending" });
    } catch (e) { console.error("POST audio-room/members", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Photo Room — produsent-side bilde-review-cockpit ───────────────
  // Gjenbruker capture_assets (rating/flagged/rejected/exif/preview_key fra iPad-
  // culling). Net-nytt: per-bilde review-status (godkjent/trenger-redigering) +
  // interne/klient foto-kommentarer. canAccessProject-gatet.
  const ensurePhotoSchema = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS project_photo_review (
      asset_id uuid PRIMARY KEY, project_id uuid NOT NULL,
      review_status text, updated_by varchar, updated_at timestamptz DEFAULT now())`).catch(() => {});
    await pool.query(`CREATE TABLE IF NOT EXISTS project_photo_comments (
      id uuid PRIMARY KEY, project_id uuid NOT NULL, asset_id uuid,
      scope text DEFAULT 'internal', author_name text, author_kind text DEFAULT 'creator',
      comment text NOT NULL, status text DEFAULT 'open', tag text, pinned boolean DEFAULT false,
      parent_id uuid, like_count int DEFAULT 0, created_at timestamptz DEFAULT now())`).catch(() => {});
  };
  const photoSessionIds = async (pid: string) => {
    const s = await pool.query(`SELECT id FROM capture_sessions WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
    return s.rows.map((x: any) => x.id);
  };

  // Konsolidert cockpit-state: statistikk + utvalgs-stadier + bilder (m/ exif + status).
  app.get("/api/projects/:projectId/photo-review", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensurePhotoSchema();
      const pid = req.params.projectId;
      const sessionIds = await photoSessionIds(pid);
      if (sessionIds.length === 0) return res.json({ hasSession: false, stats: {}, stages: [], assets: [] });
      const limit = Math.min(400, Math.max(1, parseInt(String(req.query.limit || "200"), 10) || 200));
      const a = await pool.query(
        `SELECT a.id, a.original_filename, a.mime, a.size_bytes, a.state, a.rating, a.color_label,
                a.flagged_for_client, a.rejected, a.preview_key, a.exif, a.created_at,
                r.review_status
           FROM capture_assets a
           LEFT JOIN project_photo_review r ON r.asset_id = a.id
          WHERE a.session_id = ANY($1::uuid[])
          ORDER BY a.created_at DESC LIMIT $2`,
        [sessionIds, limit],
      ).catch(() => ({ rows: [] }));
      const assets = await Promise.all(a.rows.map(async (r: any) => {
        const ex = r.exif || {};
        return {
          id: r.id, filename: r.original_filename, rating: r.rating || 0,
          flagged: !!r.flagged_for_client, rejected: !!r.rejected, colorLabel: r.color_label,
          reviewStatus: r.review_status || (r.rejected ? "rejected" : r.flagged_for_client ? "flagged" : null),
          thumbUrl: r.preview_key ? await signAssetReadUrl(r.preview_key) : null,
          exif: {
            iso: ex.iso ?? ex.ISO ?? null, lens: ex.lens ?? ex.lensModel ?? ex.LensModel ?? null,
            aperture: ex.aperture ?? ex.fNumber ?? ex.FNumber ?? null,
            shutter: ex.shutter ?? ex.exposureTime ?? ex.ExposureTime ?? null,
            camera: ex.camera ?? ex.model ?? ex.Model ?? null, focalLength: ex.focalLength ?? ex.FocalLength ?? null,
            width: ex.width ?? ex.ImageWidth ?? null, height: ex.height ?? ex.ImageHeight ?? null,
            capturedAt: ex.capturedAt ?? ex.DateTimeOriginal ?? r.created_at,
          },
          createdAt: r.created_at,
        };
      }));
      // Statistikk
      const st = await pool.query(
        `SELECT count(*)::int total,
                count(*) FILTER (WHERE a.rejected IS TRUE)::int rejected,
                count(*) FILTER (WHERE a.flagged_for_client IS TRUE)::int flagged,
                count(*) FILTER (WHERE a.rating >= 4)::int favorites,
                count(*) FILTER (WHERE r.review_status = 'approved')::int approved,
                count(*) FILTER (WHERE r.review_status = 'needs_edit')::int needs_edit,
                count(*) FILTER (WHERE r.review_status IS NOT NULL OR a.rating >= 1)::int reviewed
           FROM capture_assets a LEFT JOIN project_photo_review r ON r.asset_id = a.id
          WHERE a.session_id = ANY($1::uuid[])`,
        [sessionIds],
      ).catch(() => ({ rows: [{}] }));
      const s = st.rows[0] || {};
      const total = s.total || 0;
      const pending = Math.max(0, total - (s.approved || 0) - (s.needs_edit || 0) - (s.rejected || 0));
      const cm = await pool.query(`SELECT count(*)::int n, count(*) FILTER (WHERE scope='internal')::int interne, count(*) FILTER (WHERE scope='client')::int klient FROM project_photo_comments WHERE project_id = $1`, [pid]).catch(() => ({ rows: [{}] }));
      const cc = cm.rows[0] || {};
      res.json({
        hasSession: true,
        stats: { total, pending, approved: s.approved || 0, needsEdit: s.needs_edit || 0, rejected: s.rejected || 0, flagged: s.flagged || 0, comments: cc.n || 0, reviewed: s.reviewed || 0 },
        commentScopes: { all: cc.n || 0, internal: cc.interne || 0, client: cc.klient || 0 },
        stages: [
          { key: "raw", label: "RAW", count: total },
          { key: "color", label: "Fargekorrigert", count: total },
          { key: "retouch", label: "Retusjert", count: s.favorites || 0 },
          { key: "final", label: "Final selects", count: (s.approved || 0) + (s.flagged || 0), locked: false },
        ],
        assets,
      });
    } catch (e) { console.error("GET photo-review", e); res.json({ hasSession: false, stats: {}, stages: [], assets: [] }); }
  });

  // Sett review-status på ett bilde (approved/needs_edit/rejected/flagged/null).
  app.patch("/api/projects/:projectId/photo-review/:assetId", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensurePhotoSchema();
      const status = req.body?.reviewStatus ? String(req.body.reviewStatus).slice(0, 20) : null;
      await pool.query(
        `INSERT INTO project_photo_review (asset_id, project_id, review_status, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (asset_id) DO UPDATE SET review_status = EXCLUDED.review_status, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [req.params.assetId, req.params.projectId, status, uid],
      );
      // Speil rejected/flagged tilbake til capture_assets så iPad/Media er i sync.
      if (status === "rejected") await pool.query(`UPDATE capture_assets SET rejected = TRUE WHERE id = $1`, [req.params.assetId]).catch(() => {});
      if (status === "flagged") await pool.query(`UPDATE capture_assets SET flagged_for_client = TRUE WHERE id = $1`, [req.params.assetId]).catch(() => {});
      res.json({ ok: true });
    } catch (e) { console.error("PATCH photo-review", e); res.status(500).json({ error: "failed" }); }
  });

  // Bulk-godkjenn (Godkjenn utvalg): alle flaggede, eller eksplisitt assetIds.
  app.post("/api/projects/:projectId/photo-review/approve", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensurePhotoSchema();
      const pid = req.params.projectId;
      const ids = Array.isArray(req.body?.assetIds) ? req.body.assetIds.filter((v: any) => typeof v === "string") : [];
      let targets = ids;
      if (targets.length === 0) {
        const sessionIds = await photoSessionIds(pid);
        const f = await pool.query(`SELECT id FROM capture_assets WHERE session_id = ANY($1::uuid[]) AND flagged_for_client IS TRUE AND rejected IS NOT TRUE`, [sessionIds]).catch(() => ({ rows: [] }));
        targets = f.rows.map((r: any) => r.id);
      }
      let n = 0;
      for (const aid of targets) {
        await pool.query(
          `INSERT INTO project_photo_review (asset_id, project_id, review_status, updated_by, updated_at)
           VALUES ($1,$2,'approved',$3,NOW())
           ON CONFLICT (asset_id) DO UPDATE SET review_status='approved', updated_at=NOW()`,
          [aid, pid, uid],
        ).catch(() => {}); n++;
      }
      res.json({ ok: true, approved: n });
    } catch (e) { console.error("POST photo approve", e); res.status(500).json({ error: "failed" }); }
  });

  // Foto-kommentarer (interne/klient) — pr bilde eller hele prosjektet.
  app.get("/api/projects/:projectId/photo-comments", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensurePhotoSchema();
      const pid = req.params.projectId;
      const assetId = req.query.assetId ? String(req.query.assetId) : null;
      const rows = await pool.query(
        `SELECT * FROM project_photo_comments WHERE project_id = $1 ${assetId ? "AND asset_id = $2" : ""} ORDER BY pinned DESC, created_at DESC LIMIT 200`,
        assetId ? [pid, assetId] : [pid],
      ).catch(() => ({ rows: [] }));
      res.json({ comments: rows.rows.map((c: any) => ({
        id: c.id, assetId: c.asset_id, scope: c.scope, authorName: c.author_name || "Team", authorKind: c.author_kind,
        comment: c.comment, status: c.status, tag: c.tag, pinned: c.pinned, parentId: c.parent_id, likeCount: c.like_count || 0, createdAt: c.created_at,
      })) });
    } catch (e) { console.error("GET photo-comments", e); res.json({ comments: [] }); }
  });

  app.post("/api/projects/:projectId/photo-comments", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensurePhotoSchema();
      const b = req.body || {};
      if (!b.comment) return res.status(400).json({ error: "comment_required" });
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO project_photo_comments (id, project_id, asset_id, scope, author_name, author_kind, comment, tag, pinned, parent_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, req.params.projectId, b.assetId || null, String(b.scope || "internal").slice(0, 20),
         String(b.authorName || "").slice(0, 200) || null, String(b.authorKind || "creator").slice(0, 20),
         String(b.comment).slice(0, 4000), b.tag ? String(b.tag).slice(0, 40) : null, !!b.pinned, b.parentId || null],
      );
      res.status(201).json({ id });
    } catch (e) { console.error("POST photo-comments", e); res.status(500).json({ error: "failed" }); }
  });

  app.patch("/api/projects/:projectId/photo-comments/:commentId", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const b = req.body || {};
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      if (b.status != null) { sets.push(`status = $${i++}`); vals.push(String(b.status).slice(0, 20)); }
      if (b.pinned != null) { sets.push(`pinned = $${i++}`); vals.push(!!b.pinned); }
      if (sets.length === 0) return res.status(400).json({ error: "nothing_to_update" });
      vals.push(req.params.commentId, req.params.projectId);
      const upd = await pool.query(`UPDATE project_photo_comments SET ${sets.join(", ")} WHERE id = $${i++} AND project_id = $${i} RETURNING id`, vals).catch(() => ({ rows: [] }));
      if (!upd.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { console.error("PATCH photo-comments", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Generativ AI (fal) — pilot: Nano Banana 2-redigering i Photo ───
  // Gjennomtenkt styring: per-prosjekt SAMTYKKE (persondata→tredjepart utenfor
  // EØS) + WHITELIST (pilot) + global DAGSTAK-kostnadsbrems. Async via fal queue,
  // resultat lagres til B2 (permanent), kilde+resultat presignes til Før/Etter.
  const ensureGenSchema = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS generative_ai_jobs (
      id uuid PRIMARY KEY, project_id uuid NOT NULL, user_id varchar, user_email varchar,
      model varchar, kind varchar, status varchar DEFAULT 'queued', provider varchar,
      fal_request_id varchar, response_url text, input jsonb, source_asset_id uuid,
      output_b2_key text, output_url_temp text, est_cost_usd numeric DEFAULT 0,
      error text, created_at timestamptz DEFAULT now(), completed_at timestamptz)`).catch(() => {});
    await pool.query(`CREATE TABLE IF NOT EXISTS project_ai_consent (
      project_id varchar PRIMARY KEY, consented boolean DEFAULT false,
      consented_by varchar, consented_at timestamptz)`).catch(() => {});
  };
  const userIdentity = async (uid: string) => {
    const r = await pool.query(`SELECT email, role FROM users WHERE id = $1 LIMIT 1`, [uid]).catch(() => ({ rows: [] }));
    return { email: r.rows[0]?.email || null, role: r.rows[0]?.role || null };
  };
  const spentTodayUsd = async (): Promise<number> => {
    const r = await pool.query(`SELECT COALESCE(SUM(est_cost_usd),0)::float s FROM generative_ai_jobs WHERE created_at::date = NOW()::date`).catch(() => ({ rows: [{ s: 0 }] }));
    return Number(r.rows[0]?.s || 0);
  };

  // ─── Forhåndsbetalt AI-kreditt-lommebok (selvbetjent) ───────────────────────
  // balance_usd = RETAIL-verdi brukeren kan bruke. Hver generering trekker
  // kost×påslag; vi betaler kun kost → margin (påslag-delen) er garantert profitt.
  // Delt kreditt-logikk (samme modul som Stripe-webhooken bruker).
  const getUserCredits = (uid: string) => getUserCreditsShared(pool, uid);
  const creditMove = (uid: string, type: string, amountUsd: number, ref: string | null, note: string) => creditMoveShared(pool, uid, type, amountUsd, ref, note);

  // Konfig: hva er tillatt for denne brukeren + samtykke-status + budsjett.
  app.get("/api/projects/:projectId/ai/config", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      const consent = await pool.query(`SELECT consented, consented_by, consented_at FROM project_ai_consent WHERE project_id = $1`, [req.params.projectId]).catch(() => ({ rows: [] }));
      // Brukerens EGET forbruk denne kalendermåneden (det de selv ser).
      const mine = await pool.query(
        `SELECT count(*) FILTER (WHERE status='completed')::int gens,
                COALESCE(SUM(est_cost_usd) FILTER (WHERE status='completed'),0)::float cost
           FROM generative_ai_jobs
          WHERE user_id = $1 AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
        [uid],
      ).catch(() => ({ rows: [{ gens: 0, cost: 0 }] }));
      const myGens = mine.rows[0]?.gens || 0;
      const myCost = Number(mine.rows[0]?.cost || 0);
      res.json({
        enabled: settings.enabled && falConfigured(),
        whitelisted: aiAllowed(settings, me.email, me.role),
        beebleConfigured: beebleConfigured(),
        billingMode: settings.billingMode,
        consent: consent.rows[0] ? { consented: !!consent.rows[0].consented, by: consent.rows[0].consented_by, at: consent.rows[0].consented_at } : { consented: false },
        dailyCapUsd: settings.dailyCapUsd,
        spentTodayUsd: await spentTodayUsd(),
        models: publicModelList(),
        myUsage: {
          generationsThisMonth: myGens,
          includedQuota: settings.includedQuota,
          includedRemaining: settings.includedQuota > 0 ? Math.max(0, settings.includedQuota - myGens) : null,
          unitPriceUsd: settings.billingMode === "metered" ? (GEN_MODELS["nano-banana-2-edit"].estCostUsd * settings.markupMultiplier) : 0,
          billedThisMonthUsd: settings.billingMode === "metered" ? myCost * settings.markupMultiplier : 0,
        },
      });
    } catch (e) { console.error("GET ai/config", e); res.json({ enabled: false }); }
  });

  // Sett/oppdater per-prosjekt-samtykke (persondata til tredjeparts AI).
  app.put("/api/projects/:projectId/ai/consent", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const me = await userIdentity(uid);
      const consented = !!req.body?.consented;
      await pool.query(
        `INSERT INTO project_ai_consent (project_id, consented, consented_by, consented_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (project_id) DO UPDATE SET consented=EXCLUDED.consented, consented_by=EXCLUDED.consented_by, consented_at=NOW()`,
        [req.params.projectId, consented, me.email || uid],
      );
      res.json({ ok: true, consented });
    } catch (e) { console.error("PUT ai/consent", e); res.status(500).json({ error: "failed" }); }
  });

  // Start AI-bilde-redigering på ett capture-bilde (Nano Banana 2).
  app.post("/api/projects/:projectId/ai/image-edit", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      if (!settings.enabled || !falConfigured()) return res.status(503).json({ error: "ai_disabled" });
      if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted", message: "AI-redigering er ikke aktivert for din konto." });
      const model = GEN_MODELS["nano-banana-2-edit"];
      // Samtykke-gate (persondata → tredjepart).
      const consent = await pool.query(`SELECT consented FROM project_ai_consent WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      if (!consent.rows[0]?.consented) return res.status(409).json({ error: "consent_required", message: "Krever samtykke: kundebilder sendes til tredjeparts AI utenfor EØS." });
      // Dagstak-brems (global sikkerhets-bryter).
      const spent = await spentTodayUsd();
      if (spent + model.estCostUsd > settings.dailyCapUsd) return res.status(429).json({ error: "daily_cap", message: `Dagstak nådd ($${settings.dailyCapUsd}). Prøv igjen i morgen.` });
      const pf = await creditPreflight(settings, uid, model.estCostUsd);
      if (!pf.ok) return res.status(402).json({ error: "insufficient_credits", message: `Ikke nok kreditter (rest $${pf.balance.toFixed(2)}, trenger $${pf.retail.toFixed(2)}). Kjøp mer.` });
      const prompt = String(req.body?.prompt || "").trim().slice(0, 1000);
      const assetId = req.body?.assetId;
      if (!prompt || !assetId) return res.status(400).json({ error: "assetId_and_prompt_required" });
      // Kilde fra B2 → presignet URL (fal henter den; 1t holder i kø).
      const a = await pool.query(`SELECT full_key, preview_key, original_filename FROM capture_assets WHERE id = $1`, [assetId]).catch(() => ({ rows: [] }));
      const srcKey = a.rows[0]?.full_key || a.rows[0]?.preview_key;
      if (!srcKey) return res.status(404).json({ error: "asset_not_found" });
      const srcUrl = await signAssetReadUrl(srcKey);
      if (!srcUrl) return res.status(503).json({ error: "source_unavailable" });
      const sub = await falSubmit(model.falPath, { prompt, image_urls: [srcUrl], num_images: 1, output_format: "png" });
      if (sub.error || !sub.requestId) return res.status(502).json({ error: sub.error || "fal_submit_failed" });
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO generative_ai_jobs (id, project_id, user_id, user_email, model, kind, status, provider, fal_request_id, response_url, input, source_asset_id, est_cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9,$10::jsonb,$11,$12)`,
        [id, pid, uid, me.email, model.key, model.kind, model.provider, sub.requestId, sub.responseUrl || null, JSON.stringify({ prompt }), assetId, model.estCostUsd],
      );
      res.status(202).json({ jobId: id, status: "queued" });
    } catch (e) { console.error("POST ai/image-edit", e); res.status(500).json({ error: "failed" }); }
  });

  // Moodboard konsept-generering (tekst→bilde, Nano Banana 2). Ingen samtykke
  // (genererer fra tekst, ikke kundedata). Resultatet legges auto i moodboardet.
  app.post("/api/projects/:projectId/ai/concept-image", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      if (!settings.enabled || !falConfigured()) return res.status(503).json({ error: "ai_disabled" });
      if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted" });
      const model = GEN_MODELS["nano-banana-2-t2i"];
      const spent = await spentTodayUsd();
      if (spent + model.estCostUsd > settings.dailyCapUsd) return res.status(429).json({ error: "daily_cap", message: `Dagstak nådd ($${settings.dailyCapUsd}).` });
      const pf = await creditPreflight(settings, uid, model.estCostUsd);
      if (!pf.ok) return res.status(402).json({ error: "insufficient_credits", message: `Ikke nok kreditter (rest $${pf.balance.toFixed(2)}, trenger $${pf.retail.toFixed(2)}). Kjøp mer.` });
      const prompt = String(req.body?.prompt || "").trim().slice(0, 1000);
      if (!prompt) return res.status(400).json({ error: "prompt_required" });
      const sub = await falSubmit(model.falPath, { prompt, num_images: 1, output_format: "png" });
      if (sub.error || !sub.requestId) return res.status(502).json({ error: sub.error || "fal_submit_failed" });
      const id = crypto.randomUUID();
      // input.addToMoodboard=true → finalize legger resultatet i moodboardet.
      await pool.query(
        `INSERT INTO generative_ai_jobs (id, project_id, user_id, user_email, model, kind, status, provider, fal_request_id, response_url, input, est_cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9,$10::jsonb,$11)`,
        [id, pid, uid, me.email, model.key, model.kind, model.provider, sub.requestId, sub.responseUrl || null, JSON.stringify({ prompt, addToMoodboard: true }), model.estCostUsd],
      );
      res.status(202).json({ jobId: id, status: "queued" });
    } catch (e) { console.error("POST ai/concept-image", e); res.status(500).json({ error: "failed" }); }
  });

  // Animer et stillbilde → kort AI-video (Seedance 2.0). Samme gater. Async/treg
  // (video tar minutter) — jobben poller via /ai/jobs/:id som resten.
  // «Foreslå» — Claude vision ser bildet (+ moodboard-stil) → 3 skreddersydde
  // forslag: bevegelse (for Animer) eller redigeringer (for AI-rediger). Gjør
  // verktøyene kontekst-bevisste uten at brukeren må formulere en god prompt.
  app.post("/api/projects/:projectId/ai/suggest", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      if (!settings.enabled) return res.status(503).json({ error: "ai_disabled" });
      if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted" });
      const consent = await pool.query(`SELECT consented FROM project_ai_consent WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      if (!consent.rows[0]?.consented) return res.status(409).json({ error: "consent_required" });
      const mode = req.body?.mode === "edit" ? "edit" : "motion";
      const assetId = req.body?.assetId;
      if (!assetId) return res.status(400).json({ error: "assetId_required" });
      const a = await pool.query(`SELECT preview_key, full_key FROM capture_assets WHERE id = $1`, [assetId]).catch(() => ({ rows: [] }));
      const srcKey = a.rows[0]?.preview_key || a.rows[0]?.full_key;
      if (!srcKey) return res.status(404).json({ error: "asset_not_found" });
      const obj = await getFromRoleRoomB2(srcKey).catch(() => null);
      if (!obj?.body) return res.status(503).json({ error: "source_unavailable" });
      const mime = obj.contentType && /^image\//.test(obj.contentType) ? obj.contentType : "image/jpeg";
      const styleRow = await pool.query(`SELECT style FROM project_moodboard_meta WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      const style = styleRow.rows[0]?.style ? `Prosjektets stil-retning: «${styleRow.rows[0].style}». ` : "";
      let client: any;
      try { const mod: any = await import("@anthropic-ai/sdk"); client = new (mod.default ?? mod.Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 }); }
      catch { return res.status(503).json({ error: "ai_not_configured" }); }
      const ask = mode === "motion"
        ? `${style}Dette stillbildet skal animeres til en kort video (bilde→video). Kall suggest med 3 KONKRETE, korte bevegelses-beskrivelser tilpasset NETTOPP dette bildet (kamera-bevegelse + naturlig motiv-bevegelse). Norsk.`
        : `${style}Dette bildet skal AI-redigeres. Kall suggest med 3 KONKRETE redigerings-instruksjoner tilpasset NETTOPP dette bildet (f.eks. fjern et spesifikt objekt, juster lys/bakgrunn). Norsk.`;
      const TOOL = { name: "suggest", description: "3 forslag.", input_schema: { type: "object", properties: { suggestions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 } }, required: ["suggestions"] } };
      const resp = await client.messages.create({
        model: process.env.CAPTURE_ANALYZE_MODEL || "claude-opus-4-7",
        max_tokens: 500, tools: [TOOL], tool_choice: { type: "tool", name: "suggest" },
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: obj.body.toString("base64") } }, { type: "text", text: ask }] }],
      });
      try { (await import("./ai-usage-tracker")).logAIUsage?.(resp as any, { feature: `workspace/ai-suggest-${mode}`, userId: uid }); } catch { /* */ }
      const tu = (resp.content || []).find((b: any) => b.type === "tool_use" && b.name === "suggest");
      const suggestions = Array.isArray(tu?.input?.suggestions) ? tu.input.suggestions.map((s: any) => String(s).slice(0, 300)).filter(Boolean).slice(0, 3) : [];
      res.json({ suggestions });
    } catch (e) { console.error("POST ai/suggest", e); res.status(500).json({ error: "failed" }); }
  });

  app.post("/api/projects/:projectId/ai/image-to-video", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      if (!settings.enabled || !falConfigured()) return res.status(503).json({ error: "ai_disabled" });
      if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted", message: "AI-video er ikke aktivert for din konto." });
      const model = GEN_MODELS["seedance-2-i2v"];
      const consent = await pool.query(`SELECT consented FROM project_ai_consent WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      if (!consent.rows[0]?.consented) return res.status(409).json({ error: "consent_required", message: "Krever samtykke: kundebilder sendes til tredjeparts AI utenfor EØS." });
      const duration = Math.min(15, Math.max(4, parseInt(String(req.body?.duration || 5), 10) || 5));
      const estCost = duration * (model.costPerSecondUsd || 0.1);
      const spent = await spentTodayUsd();
      if (spent + estCost > settings.dailyCapUsd) return res.status(429).json({ error: "daily_cap", message: `Dagstak nådd ($${settings.dailyCapUsd}). En ${duration}s-video koster ~$${estCost.toFixed(2)}.` });
      const pfv = await creditPreflight(settings, uid, estCost);
      if (!pfv.ok) return res.status(402).json({ error: "insufficient_credits", message: `Ikke nok kreditter (rest $${pfv.balance.toFixed(2)}, trenger $${pfv.retail.toFixed(2)}). Kjøp mer.` });
      const prompt = String(req.body?.prompt || "").trim().slice(0, 1000);
      const assetId = req.body?.assetId;
      if (!prompt || !assetId) return res.status(400).json({ error: "assetId_and_prompt_required" });
      const a = await pool.query(`SELECT full_key, preview_key FROM capture_assets WHERE id = $1`, [assetId]).catch(() => ({ rows: [] }));
      const srcKey = a.rows[0]?.preview_key || a.rows[0]?.full_key; // preview (mindre) holder som startbilde
      if (!srcKey) return res.status(404).json({ error: "asset_not_found" });
      const srcUrl = await signAssetReadUrl(srcKey);
      if (!srcUrl) return res.status(503).json({ error: "source_unavailable" });
      const sub = await falSubmit(model.falPath, { prompt, image_url: srcUrl, duration: String(duration), resolution: "720p" });
      if (sub.error || !sub.requestId) return res.status(502).json({ error: sub.error || "fal_submit_failed" });
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO generative_ai_jobs (id, project_id, user_id, user_email, model, kind, status, provider, fal_request_id, response_url, input, source_asset_id, est_cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9,$10::jsonb,$11,$12)`,
        [id, pid, uid, me.email, model.key, model.kind, model.provider, sub.requestId, sub.responseUrl || null, JSON.stringify({ prompt, duration }), assetId, estCost],
      );
      res.status(202).json({ jobId: id, status: "queued", estCostUsd: estCost });
    } catch (e) { console.error("POST ai/image-to-video", e); res.status(500).json({ error: "failed" }); }
  });

  // Video Room: Restyle / Relight en videoversjon (SwitchX/Beeble). Bevarer
  // bevegelse, endrer lys/atmosfære/stil. Kilde = versjonens B2-video (presignet).
  app.post("/api/projects/:projectId/ai/video-restyle", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const pid = req.params.projectId;
      const me = await userIdentity(uid);
      const settings = await getGenSettings(pool);
      if (!settings.enabled) return res.status(503).json({ error: "ai_disabled" });
      if (!aiAllowed(settings, me.email, me.role)) return res.status(403).json({ error: "not_whitelisted" });
      if (!beebleConfigured()) return res.status(503).json({ error: "beeble_not_configured", message: "SwitchX (BEEBLE_API_KEY) er ikke konfigurert." });
      const model = GEN_MODELS["switchx-restyle"];
      const consent = await pool.query(`SELECT consented FROM project_ai_consent WHERE project_id = $1`, [pid]).catch(() => ({ rows: [] }));
      if (!consent.rows[0]?.consented) return res.status(409).json({ error: "consent_required", message: "Krever samtykke: video sendes til tredjeparts AI utenfor EØS." });
      const spent = await spentTodayUsd();
      if (spent + model.estCostUsd > settings.dailyCapUsd) return res.status(429).json({ error: "daily_cap", message: `Dagstak nådd ($${settings.dailyCapUsd}).` });
      const pfr = await creditPreflight(settings, uid, model.estCostUsd);
      if (!pfr.ok) return res.status(402).json({ error: "insufficient_credits", message: `Ikke nok kreditter (rest $${pfr.balance.toFixed(2)}, trenger $${pfr.retail.toFixed(2)}). Kjøp mer.` });
      const prompt = String(req.body?.prompt || "").trim().slice(0, 1000);
      const versionId = req.body?.versionId;
      const maxResolution = req.body?.maxResolution === 1080 ? 1080 : 720;
      if (!prompt || !versionId) return res.status(400).json({ error: "versionId_and_prompt_required" });
      // Kilde-video fra versjonen (B2-key presignes; ekstern file_url som fallback).
      const v = await pool.query(`SELECT b2_key, file_url FROM project_video_versions WHERE id = $1 AND project_id = $2`, [versionId, pid]).catch(() => ({ rows: [] }));
      if (!v.rows.length) return res.status(404).json({ error: "version_not_found" });
      const sourceUri = v.rows[0].b2_key ? await presignRoleRoomB2Download(v.rows[0].b2_key, undefined, 3600) : v.rows[0].file_url;
      if (!sourceUri) return res.status(503).json({ error: "source_unavailable" });
      // Valgfritt referansebilde (et capture-asset preview).
      let referenceImageUri: string | null = null;
      if (req.body?.referenceAssetId) {
        const ra = await pool.query(`SELECT preview_key, full_key FROM capture_assets WHERE id = $1`, [req.body.referenceAssetId]).catch(() => ({ rows: [] }));
        const rk = ra.rows[0]?.preview_key || ra.rows[0]?.full_key;
        if (rk) referenceImageUri = await signAssetReadUrl(rk);
      }
      const sub = await beebleSubmit({ sourceUri, prompt, referenceImageUri, maxResolution });
      if (sub.error || !sub.id) return res.status(sub.error === "INSUFFICIENT_BALANCE" ? 402 : 502).json({ error: sub.error || "beeble_submit_failed", message: sub.error === "INSUFFICIENT_BALANCE" ? "Beeble-kontoen mangler kreditter — fyll på i billing-portalen." : undefined });
      const id = crypto.randomUUID();
      // fal_request_id gjenbrukes til Beeble generation-id; response_url=null → poll via provider.
      await pool.query(
        `INSERT INTO generative_ai_jobs (id, project_id, user_id, user_email, model, kind, status, provider, fal_request_id, response_url, input, source_asset_id, est_cost_usd)
         VALUES ($1,$2,$3,$4,$5,'video-to-video','queued','beeble',$6,NULL,$7::jsonb,NULL,$8)`,
        [id, pid, uid, me.email, model.key, sub.id, JSON.stringify({ prompt, versionId, maxResolution }), model.estCostUsd],
      );
      res.status(202).json({ jobId: id, status: "queued" });
    } catch (e) { console.error("POST ai/video-restyle", e); res.status(500).json({ error: "failed" }); }
  });

  // Poll en AI-jobb — finaliserer ved fullføring (laster fal-resultat til B2).
  app.get("/api/projects/:projectId/ai/jobs/:jobId", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const j = await pool.query(`SELECT * FROM generative_ai_jobs WHERE id = $1 AND project_id = $2`, [req.params.jobId, pid]).catch(() => ({ rows: [] }));
      const job = j.rows[0];
      if (!job) return res.status(404).json({ error: "not_found" });
      const beforeUrl = job.source_asset_id ? await (async () => {
        const a = await pool.query(`SELECT preview_key, full_key FROM capture_assets WHERE id = $1`, [job.source_asset_id]).catch(() => ({ rows: [] }));
        const k = a.rows[0]?.preview_key || a.rows[0]?.full_key; return k ? signAssetReadUrl(k) : null;
      })() : null;
      const isVideoKind = job.kind === "image-to-video";
      // Allerede ferdig?
      if (job.status === "completed" && job.output_b2_key) {
        return res.json({ status: "completed", kind: job.kind, isVideo: isVideoKind, beforeUrl, afterUrl: await presignRoleRoomB2Download(job.output_b2_key, undefined, 3600), prompt: job.input?.prompt });
      }
      if (job.status === "failed") return res.json({ status: "failed", kind: job.kind, error: job.error, beforeUrl });
      // Poll fal.
      // Poll riktig provider: Beeble (response_url=null, generation-id i fal_request_id) vs fal.
      let p: { status: string; result?: any; error?: string };
      if (job.provider === "beeble") {
        const bp = await beeblePoll(job.fal_request_id);
        p = { status: bp.status, result: bp.outputUrl ? { video: { url: bp.outputUrl } } : null, error: bp.error };
      } else {
        if (!job.response_url) return res.json({ status: job.status || "queued", kind: job.kind, beforeUrl });
        p = await falPoll(job.response_url);
      }
      if (p.status !== "COMPLETED") {
        if (p.status === "ERROR") { await pool.query(`UPDATE generative_ai_jobs SET status='failed', error=$1 WHERE id=$2`, [p.error || "fal_error", job.id]).catch(() => {}); return res.json({ status: "failed", kind: job.kind, error: p.error, beforeUrl }); }
        await pool.query(`UPDATE generative_ai_jobs SET status='running' WHERE id=$1`, [job.id]).catch(() => {});
        return res.json({ status: "running", kind: job.kind, beforeUrl });
      }
      // Ferdig → hent fal-output (bilde eller video), lagre til B2 (permanent).
      const out = falOutputUrl(p.result);
      const outUrl = out.url;
      if (!outUrl) { await pool.query(`UPDATE generative_ai_jobs SET status='failed', error='no_output' WHERE id=$1`, [job.id]).catch(() => {}); return res.json({ status: "failed", kind: job.kind, error: "no_output", beforeUrl }); }
      let b2Key: string | null = null;
      try {
        const r = await fetch(outUrl);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          const ct = r.headers.get("content-type") || (out.isVideo ? "video/mp4" : "image/png");
          const ext = out.isVideo ? "mp4" : ct.includes("jpeg") ? "jpg" : "png";
          const key = `workspace/${pid}/ai-${out.isVideo ? "video" : "edits"}/${job.id}.${ext}`;
          const stored = await archiveToRoleRoomB2(key, buf, ct);
          if (stored) b2Key = key;
        }
      } catch { /* fallback til temp-url */ }
      await pool.query(
        `UPDATE generative_ai_jobs SET status='completed', output_b2_key=$1, output_url_temp=$2, completed_at=NOW() WHERE id=$3`,
        [b2Key, b2Key ? null : outUrl, job.id],
      ).catch(() => {});
      // Fakturering ved fullføring (idempotent på job-id):
      const fsettings = await getGenSettings(pool);
      // (a) metered → Stripe-måler-event (dvale til env satt);
      try { await emitGenAiMeter(pool, { userId: job.user_id, valueUsd: Number(job.est_cost_usd || 0), settings: fsettings }); } catch { /* metering skal aldri blokkere resultatet */ }
      // (b) credits → trekk retail (kost×påslag) fra brukerens lommebok.
      if (fsettings.billingMode === "credits") {
        try { await creditMove(job.user_id, "spend", -(Number(job.est_cost_usd || 0) * (fsettings.markupMultiplier || 1)), `job:${job.id}`, `${job.model}`); } catch { /* */ }
      }
      // Konsept-bilder legges auto i moodboardet (idempotent på job-id i b2_key).
      if (job.input?.addToMoodboard && b2Key) {
        try {
          await ensureSchema(pool);
          const ex = await pool.query(`SELECT 1 FROM project_images WHERE b2_key = $1`, [b2Key]).catch(() => ({ rows: [] }));
          if (!ex.rows.length) await pool.query(
            `INSERT INTO project_images (project_id, panel, b2_key, label, category, content_type, uploaded_by) VALUES ($1,'moodboard',$2,$3,'ai-konsept','image/png',$4)`,
            [pid, b2Key, `AI-konsept: ${String(job.input?.prompt || "").slice(0, 60)}`, job.user_id],
          );
        } catch { /* */ }
      }
      res.json({ status: "completed", kind: job.kind, isVideo: out.isVideo, beforeUrl, afterUrl: b2Key ? await presignRoleRoomB2Download(b2Key, undefined, 3600) : outUrl, prompt: job.input?.prompt });
    } catch (e) { console.error("GET ai/jobs/:id", e); res.status(500).json({ error: "failed" }); }
  });

  // Siste AI-jobber for prosjektet (galleri av AI-redigeringer).
  app.get("/api/projects/:projectId/ai/jobs", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureGenSchema();
      const r = await pool.query(`SELECT id, model, kind, status, source_asset_id, output_b2_key, output_url_temp, input, created_at, completed_at FROM generative_ai_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 30`, [req.params.projectId]).catch(() => ({ rows: [] }));
      const jobs = await Promise.all(r.rows.map(async (j: any) => ({
        id: j.id, model: j.model, kind: j.kind, status: j.status, sourceAssetId: j.source_asset_id,
        prompt: j.input?.prompt || null, createdAt: j.created_at, completedAt: j.completed_at,
        afterUrl: j.output_b2_key ? await presignRoleRoomB2Download(j.output_b2_key, undefined, 3600) : (j.output_url_temp || null),
      })));
      res.json({ jobs });
    } catch (e) { console.error("GET ai/jobs", e); res.json({ jobs: [] }); }
  });

  // Pre-sjekk: i credits-modus må saldo dekke retail-pris (kost×påslag).
  const creditPreflight = async (settings: any, uid: string, estCost: number): Promise<{ ok: boolean; retail: number; balance: number }> => {
    const retail = estCost * (settings.markupMultiplier || 1);
    if (settings.billingMode !== "credits") return { ok: true, retail, balance: 0 };
    const w = await getUserCredits(uid);
    return { ok: w.balanceUsd >= retail, retail, balance: w.balanceUsd };
  };

  // Brukerens kreditt-saldo + pakker (credits-modus).
  app.get("/api/projects/:projectId/ai/credits", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const settings = await getGenSettings(pool);
      const w = await getUserCredits(uid);
      res.json({ billingMode: settings.billingMode, balanceUsd: w.balanceUsd, purchasedUsd: w.purchasedUsd, spentUsd: w.spentUsd, packs: settings.creditPacks, nokPerUsd: Number(process.env.ROLE_ROOM_NOK_PER_USD || process.env.USD_NOK_RATE || 11) });
    } catch (e) { console.error("GET ai/credits", e); res.json({ balanceUsd: 0, packs: DEFAULT_CREDIT_PACKS }); }
  });

  // Start Stripe Checkout for en kredittpakke → returnerer url.
  app.post("/api/projects/:projectId/ai/credits/checkout", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const settings = await getGenSettings(pool);
      const me = await userIdentity(uid);
      const pack = settings.creditPacks.find((p: any) => p.id === req.body?.packId);
      if (!pack) return res.status(400).json({ error: "unknown_pack" });
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) return res.status(503).json({ error: "stripe_not_configured" });
      const stripe = new Stripe(secret.trim());
      const base = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/$/, "");
      const ret = `${base}/workspace/${req.params.projectId}/photo-room`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${ret}?ai_credits=ok&cs={CHECKOUT_SESSION_ID}`,
        cancel_url: `${ret}?ai_credits=cancel`,
        client_reference_id: uid,
        customer_email: me.email || undefined,
        line_items: [{ quantity: 1, price_data: { currency: "nok", unit_amount: Math.round(pack.priceNok * 100), product_data: { name: `CreatorHub AI-kreditt — $${pack.creditUsd}` } } }],
        metadata: { kind: "ai_credits", user_id: uid, pack_id: pack.id, credit_usd: String(pack.creditUsd) },
      });
      res.json({ url: session.url });
    } catch (e) { console.error("POST ai/credits/checkout", e); res.status(500).json({ error: "failed" }); }
  });

  // Bekreft kjøp ved retur (idempotent på session-id) → krediter lommeboka.
  app.post("/api/projects/:projectId/ai/credits/confirm", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const sessionId = String(req.body?.sessionId || "");
      if (!sessionId) return res.status(400).json({ error: "sessionId_required" });
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) return res.status(503).json({ error: "stripe_not_configured" });
      const stripe = new Stripe(secret.trim());
      const s: any = await stripe.checkout.sessions.retrieve(sessionId);
      if (s?.metadata?.kind !== "ai_credits" || s?.metadata?.user_id !== uid) return res.status(403).json({ error: "not_yours" });
      if (s.payment_status !== "paid") return res.json({ credited: false, status: s.payment_status });
      const creditUsd = Number(s.metadata?.credit_usd || 0);
      const added = await creditMove(uid, "purchase", creditUsd, `stripe:${sessionId}`, `Kjøp pakke ${s.metadata?.pack_id}`);
      const w = await getUserCredits(uid);
      res.json({ credited: added, balanceUsd: w.balanceUsd });
    } catch (e) { console.error("POST ai/credits/confirm", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Admin: generativ-AI-innstillinger (aktiver/styr fra dashboard) ──
  // super_admin-gatet (auth uten prosjekt). Lar admin skru av/på, bytte billing-
  // modus (gratis-whitelist ↔ metered), sette dagstak/whitelist/kvote — uten env.
  const adminGuard = async (req: any, res: any): Promise<string | null> => {
    const session = requireUserSession(req, res); if (!session) return null;
    const { role } = await userIdentity(session.userId);
    if (role !== "super_admin") { res.status(403).json({ error: "admin_only" }); return null; }
    return session.userId;
  };
  app.get("/api/admin/generative-ai-settings", async (req, res) => {
    const uid = await adminGuard(req, res); if (!uid) return;
    try {
      const s = await getGenSettings(pool);
      const today = await spentTodayUsd();
      res.json({
        settings: s,
        falConfigured: falConfigured(),
        meterConfigured: !!process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME,
        spentTodayUsd: today,
        models: publicModelList(),
      });
    } catch (e) { console.error("GET admin genai-settings", e); res.status(500).json({ error: "failed" }); }
  });
  // Per-bruker forbruk + ØKONOMI: vår-kost vs inntekt (kost×påslag) vs margin.
  app.get("/api/admin/generative-ai-usage", async (req, res) => {
    const uid = await adminGuard(req, res); if (!uid) return;
    try {
      const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || "30"), 10) || 30));
      const s = await getGenSettings(pool);
      const markup = s.markupMultiplier || 1;
      const rows = await pool.query(
        `SELECT COALESCE(user_email, user_id, 'ukjent') AS who,
                count(*) FILTER (WHERE status='completed')::int generations,
                count(*) FILTER (WHERE status='failed')::int failed,
                COALESCE(SUM(est_cost_usd) FILTER (WHERE status='completed'),0)::float our_cost,
                max(created_at) last_used,
                array_agg(DISTINCT model) FILTER (WHERE model IS NOT NULL) models
           FROM generative_ai_jobs
          WHERE created_at >= NOW() - ($1 || ' days')::interval
          GROUP BY 1 ORDER BY our_cost DESC LIMIT 200`,
        [days],
      ).catch(() => ({ rows: [] }));
      const users = rows.rows.map((r: any) => {
        const ourCost = Number(r.our_cost || 0);
        const revenue = ourCost * markup;
        return { user: r.who, generations: r.generations || 0, failed: r.failed || 0, ourCostUsd: ourCost, revenueUsd: revenue, marginUsd: revenue - ourCost, models: r.models || [], lastUsed: r.last_used };
      });
      const totals = users.reduce((a: any, u: any) => ({ generations: a.generations + u.generations, ourCostUsd: a.ourCostUsd + u.ourCostUsd, revenueUsd: a.revenueUsd + u.revenueUsd, marginUsd: a.marginUsd + u.marginUsd }), { generations: 0, ourCostUsd: 0, revenueUsd: 0, marginUsd: 0 });
      res.json({ days, billingMode: s.billingMode, markupMultiplier: markup, users, totals });
    } catch (e) { console.error("GET genai-usage", e); res.status(500).json({ error: "failed" }); }
  });

  // Én brukers AI-forbruk + betaling/Stripe-status (vises på brukerprofil).
  app.get("/api/admin/users/:userId/genai-usage", async (req, res) => {
    const uid = await adminGuard(req, res); if (!uid) return;
    try {
      const target = req.params.userId;
      const s = await getGenSettings(pool);
      const markup = s.markupMultiplier || 1;
      const agg = await pool.query(
        `SELECT count(*) FILTER (WHERE status='completed')::int total_gens,
                count(*) FILTER (WHERE status='completed' AND date_trunc('month',created_at)=date_trunc('month',NOW()))::int month_gens,
                COALESCE(SUM(est_cost_usd) FILTER (WHERE status='completed'),0)::float total_cost,
                COALESCE(SUM(est_cost_usd) FILTER (WHERE status='completed' AND date_trunc('month',created_at)=date_trunc('month',NOW())),0)::float month_cost,
                max(created_at) last_used
           FROM generative_ai_jobs WHERE user_id = $1`,
        [target],
      ).catch(() => ({ rows: [{}] }));
      const a = agg.rows[0] || {};
      const totalCost = Number(a.total_cost || 0); const monthCost = Number(a.month_cost || 0);
      const recent = await pool.query(
        `SELECT model, kind, status, input->>'prompt' prompt, est_cost_usd, created_at
           FROM generative_ai_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [target],
      ).catch(() => ({ rows: [] }));
      // Betaling / Stripe
      const cust = await pool.query(`SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1`, [target]).catch(() => ({ rows: [] }));
      const sub = await pool.query(`SELECT status, tier_id, amount, currency, next_billing FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [target]).catch(() => ({ rows: [] }));
      const subRow = sub.rows[0];
      // ALLE AI-kostnader (Claude/Anthropic m.m.) fra ai_usage_log — pr feature.
      const allAi = await pool.query(
        `SELECT feature,
                count(*)::int calls,
                COALESCE(SUM(cost_usd),0)::float cost,
                COALESCE(SUM(cost_usd) FILTER (WHERE date_trunc('month',created_at)=date_trunc('month',NOW())),0)::float month_cost
           FROM ai_usage_log WHERE user_id = $1 GROUP BY feature ORDER BY cost DESC LIMIT 30`,
        [target],
      ).catch(() => ({ rows: [] }));
      const otherTotal = allAi.rows.reduce((a: number, r: any) => a + Number(r.cost || 0), 0);
      const otherMonth = allAi.rows.reduce((a: number, r: any) => a + Number(r.month_cost || 0), 0);
      res.json({
        billingMode: s.billingMode, markupMultiplier: markup,
        allAiCosts: {
          totalUsd: otherTotal + totalCost,            // ai_usage_log + generativ
          monthUsd: otherMonth + monthCost,
          otherTotalUsd: otherTotal, otherMonthUsd: otherMonth,
          generativeTotalUsd: totalCost,
          byFeature: allAi.rows.map((r: any) => ({ feature: r.feature || "ukjent", calls: r.calls || 0, costUsd: Number(r.cost || 0), monthUsd: Number(r.month_cost || 0) })),
        },
        usage: {
          totalGenerations: a.total_gens || 0, monthGenerations: a.month_gens || 0,
          ourCostUsd: totalCost, revenueUsd: totalCost * markup, marginUsd: totalCost * markup - totalCost,
          monthOurCostUsd: monthCost, monthRevenueUsd: monthCost * markup,
          includedQuota: s.includedQuota, includedRemaining: s.includedQuota > 0 ? Math.max(0, s.includedQuota - (a.month_gens || 0)) : null,
          lastUsed: a.last_used || null,
        },
        billing: {
          stripeLinked: !!cust.rows[0]?.stripe_customer_id,
          stripeCustomerId: cust.rows[0]?.stripe_customer_id || null,
          subscriptionStatus: subRow?.status || null,
          plan: subRow ? { tierId: subRow.tier_id, amount: subRow.amount != null ? Number(subRow.amount) : null, currency: subRow.currency, nextBilling: subRow.next_billing } : null,
          paid: !!subRow && (subRow.status === "active" || subRow.status === "trialing" || subRow.status === "paid"),
          // Faktisk genai-fakturering går via Stripe-måleren (billingMode=metered);
          // her vises vårt estimat (kost×påslag) for denne måneden.
          genaiBilledThisMonthUsd: s.billingMode === "metered" ? monthCost * markup : 0,
        },
        recentJobs: recent.rows.map((r: any) => ({ model: r.model, kind: r.kind, status: r.status, prompt: r.prompt, costUsd: Number(r.est_cost_usd || 0), createdAt: r.created_at })),
      });
    } catch (e) { console.error("GET user genai-usage", e); res.status(500).json({ error: "failed" }); }
  });

  app.put("/api/admin/generative-ai-settings", async (req, res) => {
    const uid = await adminGuard(req, res); if (!uid) return;
    try {
      await getGenSettings(pool); // sikrer at tabellen finnes
      const me = await userIdentity(uid);
      const b = req.body || {};
      const whitelist = Array.isArray(b.whitelist) ? b.whitelist.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean) : undefined;
      const packs = Array.isArray(b.creditPacks) ? b.creditPacks.map((p: any) => ({ id: String(p.id || "").trim(), creditUsd: Number(p.creditUsd), priceNok: Number(p.priceNok) })).filter((p: any) => p.id && p.creditUsd > 0 && p.priceNok > 0) : undefined;
      await pool.query(
        `INSERT INTO generative_ai_settings (id, enabled, billing_mode, daily_cap_usd, whitelist, included_quota, markup_multiplier, credit_packs, updated_by, updated_at)
         VALUES (1,$1,$2,$3,$4::jsonb,$5,$6,$8::jsonb,$7,NOW())
         ON CONFLICT (id) DO UPDATE SET
           enabled=COALESCE($1, generative_ai_settings.enabled),
           billing_mode=COALESCE($2, generative_ai_settings.billing_mode),
           daily_cap_usd=COALESCE($3, generative_ai_settings.daily_cap_usd),
           whitelist=COALESCE($4::jsonb, generative_ai_settings.whitelist),
           included_quota=COALESCE($5, generative_ai_settings.included_quota),
           markup_multiplier=COALESCE($6, generative_ai_settings.markup_multiplier),
           credit_packs=COALESCE($8::jsonb, generative_ai_settings.credit_packs),
           updated_by=$7, updated_at=NOW()`,
        [
          typeof b.enabled === "boolean" ? b.enabled : null,
          (b.billingMode === "metered" || b.billingMode === "free_whitelist" || b.billingMode === "credits") ? b.billingMode : null,
          b.dailyCapUsd != null ? Number(b.dailyCapUsd) : null,
          whitelist ? JSON.stringify(whitelist) : null,
          b.includedQuota != null ? Number(b.includedQuota) : null,
          b.markupMultiplier != null ? Number(b.markupMultiplier) : null,
          me.email || uid,
          packs ? JSON.stringify(packs) : null,
        ],
      );
      invalidateGenSettings();
      res.json({ ok: true, settings: await getGenSettings(pool) });
    } catch (e) { console.error("PUT admin genai-settings", e); res.status(500).json({ error: "failed" }); }
  });

  // ─────────── Video Room — produsent-side frame.io-review (versjoner + ───────
  // tidsstemplede kommentarer + chapters + godkjenning). Prosjekt-scopet i VÅRE
  // tabeller; gjenbruker CinematicVideoPlayer-formen på frontend. Cloudflare
  // Stream / B2 host video; vi lagrer file_url/stream_uid + chapters (jsonb).
  const ensureVideoSchema = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS project_video_versions (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL,
      version_label text,
      version_number int NOT NULL DEFAULT 1,
      file_url text,
      stream_uid text,
      thumbnail_url text,
      duration numeric,
      chapters jsonb,
      status text DEFAULT 'under_review',
      uploaded_by varchar,
      created_at timestamptz DEFAULT now()
    )`).catch(() => {});
    // Videofilene ligger på B2 (Cloudflare Stream = kun streaming-lag). b2_key
    // presignes til en avspillings-URL ved lesing.
    await pool.query(`ALTER TABLE project_video_versions ADD COLUMN IF NOT EXISTS b2_key text`).catch(() => {});
    await pool.query(`CREATE TABLE IF NOT EXISTS project_video_comments (
      id uuid PRIMARY KEY,
      version_id uuid NOT NULL,
      project_id uuid NOT NULL,
      timecode_sec numeric NOT NULL DEFAULT 0,
      end_timecode_sec numeric,
      comment text NOT NULL,
      author_name text,
      author_kind text DEFAULT 'creator',
      category text,
      status text DEFAULT 'open',
      is_decision boolean DEFAULT false,
      parent_id uuid,
      like_count int DEFAULT 0,
      created_at timestamptz DEFAULT now()
    )`).catch(() => {});
  };
  const mapVideoComment = (r: any) => ({
    id: r.id, timecodeSec: Number(r.timecode_sec), endTimecodeSec: r.end_timecode_sec != null ? Number(r.end_timecode_sec) : null,
    comment: r.comment, clientName: r.author_name || null, authorKind: r.author_kind || "creator",
    status: r.status || "open", isDecision: !!r.is_decision, category: r.category || null,
    parentId: r.parent_id || null, likeCount: r.like_count || 0, createdAt: r.created_at,
  });

  // Hele cockpit-staten: versjoner + nåværende + kommentarer + chapters + fase.
  app.get("/api/projects/:projectId/video-room", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureVideoSchema();
      const pid = req.params.projectId;
      const vs = await pool.query(
        `SELECT id, version_label, version_number, file_url, b2_key, stream_uid, thumbnail_url, duration, chapters, status, created_at,
                (SELECT count(*) FROM project_video_comments c WHERE c.version_id = v.id)::int comment_count,
                (SELECT count(*) FROM project_video_comments c WHERE c.version_id = v.id AND c.status NOT IN ('resolved','done'))::int open_count
           FROM project_video_versions v WHERE project_id = $1 ORDER BY version_number ASC`,
        [pid],
      ).catch(() => ({ rows: [] }));
      // B2-nøkkel → presignet avspillings-URL (1t). file_url (ekstern) brukes som fallback.
      const versions = await Promise.all(vs.rows.map(async (v: any) => ({
        id: v.id, versionLabel: v.version_label || `V${v.version_number}`, versionNumber: v.version_number,
        fileUrl: v.b2_key ? await presignRoleRoomB2Download(v.b2_key, undefined, 3600) : (v.file_url || null),
        streamUid: v.stream_uid || null, thumbnailUrl: v.thumbnail_url || null,
        duration: v.duration != null ? Number(v.duration) : null, status: v.status, createdAt: v.created_at,
        commentCount: v.comment_count || 0, openCount: v.open_count || 0,
      })));
      const cur = vs.rows.find((v: any) => v.status === "under_review") || vs.rows[vs.rows.length - 1] || null;
      let comments: any[] = []; let chapters: any[] = [];
      if (cur) {
        chapters = Array.isArray(cur.chapters) ? cur.chapters : (cur.chapters ? cur.chapters : []);
        const cm = await pool.query(`SELECT * FROM project_video_comments WHERE version_id = $1 ORDER BY timecode_sec ASC, created_at ASC`, [cur.id]).catch(() => ({ rows: [] }));
        comments = cm.rows.map(mapVideoComment);
      }
      res.json({ hasVersions: versions.length > 0, versions, currentVersionId: cur?.id || null, chapters, comments });
    } catch (e) { console.error("GET video-room", e); res.json({ hasVersions: false, versions: [], comments: [], chapters: [] }); }
  });

  // Ny versjon (V1/V2/…) — file_url eller stream_uid + valgfrie chapters.
  app.post("/api/projects/:projectId/video-versions", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureVideoSchema();
      const pid = req.params.projectId;
      const b = req.body || {};
      if (!b.b2Key && !b.fileUrl && !b.streamUid) return res.status(400).json({ error: "b2Key_or_fileUrl_or_streamUid_required" });
      const n = await pool.query(`SELECT COALESCE(MAX(version_number),0)+1 AS n FROM project_video_versions WHERE project_id = $1`, [pid]);
      const vn = n.rows[0].n;
      // Eldre versjoner går fra under_review → superseded.
      await pool.query(`UPDATE project_video_versions SET status='superseded' WHERE project_id=$1 AND status='under_review'`, [pid]).catch(() => {});
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO project_video_versions (id, project_id, version_label, version_number, file_url, b2_key, stream_uid, thumbnail_url, duration, chapters, status, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'under_review',$11)`,
        [id, pid, String(b.versionLabel || `V${vn}`).slice(0, 80), vn, b.fileUrl || null, b.b2Key || null, b.streamUid || null,
         b.thumbnailUrl || null, b.duration != null ? Number(b.duration) : null,
         b.chapters ? JSON.stringify(b.chapters) : null, uid],
      );
      res.status(201).json({ id, versionNumber: vn });
    } catch (e) { console.error("POST video-versions", e); res.status(500).json({ error: "failed" }); }
  });

  // Last opp videofil → B2 → opprett versjon. Server-side (samme beviste mønster
  // som /images): multer → archiveToRoleRoomB2. Cloudflare Stream = kun streaming,
  // kilden bor på B2. b2_key presignes til avspilling i GET /video-room.
  app.post("/api/projects/:projectId/video-versions/upload", videoUpload.single("file"), async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureVideoSchema();
      const pid = req.params.projectId;
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "file_required" });
      if (!String(file.mimetype || "").startsWith("video/")) return res.status(415).json({ error: "video_only" });
      const key = `workspace/${pid}/video-versions/${crypto.randomUUID()}-${slugifyForKey(file.originalname || "video.mp4")}`;
      const stored = await archiveToRoleRoomB2(key, file.buffer, file.mimetype);
      if (!stored) return res.status(503).json({ error: "b2_not_configured" });
      const n = await pool.query(`SELECT COALESCE(MAX(version_number),0)+1 AS n FROM project_video_versions WHERE project_id = $1`, [pid]);
      const vn = n.rows[0].n;
      await pool.query(`UPDATE project_video_versions SET status='superseded' WHERE project_id=$1 AND status='under_review'`, [pid]).catch(() => {});
      const id = crypto.randomUUID();
      const label = String(req.body?.versionLabel || `V${vn}`).slice(0, 80);
      await pool.query(
        `INSERT INTO project_video_versions (id, project_id, version_label, version_number, b2_key, status, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,'under_review',$6)`,
        [id, pid, label, vn, key, uid],
      );
      res.status(201).json({ id, versionNumber: vn });
    } catch (e) { console.error("POST video upload", e); res.status(500).json({ error: "failed" }); }
  });

  // Tidsstemplet kommentar.
  app.post("/api/projects/:projectId/video-comments", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureVideoSchema();
      const pid = req.params.projectId; const b = req.body || {};
      if (!b.versionId || !b.comment) return res.status(400).json({ error: "versionId_and_comment_required" });
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO project_video_comments (id, version_id, project_id, timecode_sec, end_timecode_sec, comment, author_name, author_kind, category, is_decision, parent_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, b.versionId, pid, Number(b.timecodeSec || 0), b.endTimecodeSec != null ? Number(b.endTimecodeSec) : null,
         String(b.comment).slice(0, 4000), String(b.authorName || "").slice(0, 200) || null,
         String(b.authorKind || "creator").slice(0, 20), b.category ? String(b.category).slice(0, 40) : null,
         !!b.isDecision, b.parentId || null],
      );
      const row = await pool.query(`SELECT * FROM project_video_comments WHERE id = $1`, [id]);
      res.status(201).json(mapVideoComment(row.rows[0]));
    } catch (e) { console.error("POST video-comments", e); res.status(500).json({ error: "failed" }); }
  });

  // Resolve/endre status på kommentar.
  app.patch("/api/projects/:projectId/video-comments/:commentId", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const status = String(req.body?.status || "").slice(0, 20);
      if (!status) return res.status(400).json({ error: "status_required" });
      const upd = await pool.query(
        `UPDATE project_video_comments SET status=$1 WHERE id=$2 AND project_id=$3 RETURNING id`,
        [status, req.params.commentId, req.params.projectId],
      ).catch(() => ({ rows: [] }));
      if (!upd.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { console.error("PATCH video-comments", e); res.status(500).json({ error: "failed" }); }
  });

  // Godkjenn versjon → approved (+ resten superseded).
  app.post("/api/projects/:projectId/video-versions/:vid/approve", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const upd = await pool.query(`UPDATE project_video_versions SET status='approved' WHERE id=$1 AND project_id=$2 RETURNING id`, [req.params.vid, pid]).catch(() => ({ rows: [] }));
      if (!upd.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { console.error("POST video approve", e); res.status(500).json({ error: "failed" }); }
  });

  // Sett chapters (segment-bar) på en versjon.
  app.patch("/api/projects/:projectId/video-versions/:vid/chapters", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const chapters = Array.isArray(req.body?.chapters) ? req.body.chapters : [];
      const upd = await pool.query(`UPDATE project_video_versions SET chapters=$1 WHERE id=$2 AND project_id=$3 RETURNING id`,
        [JSON.stringify(chapters), req.params.vid, req.params.projectId]).catch(() => ({ rows: [] }));
      if (!upd.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { console.error("PATCH video chapters", e); res.status(500).json({ error: "failed" }); }
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

  // ─────────── One Desk DIT-backup-status (RAID/B2-speiling + hash-verifisering) ───
  // Surfacer One Desk sin backup-jobb-status: destinasjoner + hash-verifiserte
  // kopier per fil (dit_backup_jobs) + hvilke One Desk-maskiner som jobber.
  app.get("/api/projects/:projectId/dit-status", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      const pid = req.params.projectId;
      const [dest, jobs, takes] = await Promise.all([
        pool.query(`SELECT id, destination_type, label, storage_type, status, cloud_provider FROM dit_destinations WHERE project_id = $1 ORDER BY priority NULLS LAST, created_at`, [pid]).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT count(*)::int total,
                  count(*) FILTER (WHERE status = 'completed')::int completed,
                  count(*) FILTER (WHERE status IN ('copying','running','started'))::int copying,
                  count(*) FILTER (WHERE status = 'failed')::int failed,
                  count(*) FILTER (WHERE status = 'completed' AND dest_hash IS NOT NULL AND dest_hash = source_hash)::int verified,
                  COALESCE(sum(bytes_copied),0)::bigint bytes,
                  max(completed_at) last_completed,
                  array_agg(DISTINCT helper_hostname) FILTER (WHERE helper_hostname IS NOT NULL) hosts
             FROM dit_backup_jobs WHERE project_id = $1`,
          [pid],
        ).catch(() => ({ rows: [{}] })),
        // Per-take-rollup: hver take = ett opptak; vis hvor mange destinasjoner
        // den er speilet+hash-verifisert til. Trygt på tom tabell (rows=[]).
        pool.query(
          `SELECT take_id,
                  count(*)::int total,
                  count(DISTINCT destination_id)::int destinations,
                  count(*) FILTER (WHERE status = 'completed')::int completed,
                  count(*) FILTER (WHERE status = 'completed' AND dest_hash IS NOT NULL AND dest_hash = source_hash)::int verified,
                  count(*) FILTER (WHERE status IN ('copying','running','started'))::int copying,
                  count(*) FILTER (WHERE status = 'failed')::int failed,
                  max(completed_at) last_completed
             FROM dit_backup_jobs WHERE project_id = $1 AND take_id IS NOT NULL
            GROUP BY take_id ORDER BY max(COALESCE(completed_at, started_at, queued_at)) DESC NULLS LAST LIMIT 40`,
          [pid],
        ).catch(() => ({ rows: [] })),
      ]);
      const j = jobs.rows[0] || {};
      res.json({
        hasBackup: (dest.rows.length > 0) || (j.total || 0) > 0,
        destinations: dest.rows.map((d: any) => ({ id: d.id, type: d.destination_type, label: d.label, storage: d.storage_type, status: d.status, cloud: d.cloud_provider })),
        jobs: {
          total: j.total || 0, completed: j.completed || 0, copying: j.copying || 0, failed: j.failed || 0,
          verified: j.verified || 0, bytes: j.bytes ? Number(j.bytes) : 0, lastCompleted: j.last_completed || null,
        },
        takes: takes.rows.map((t: any) => ({
          takeId: t.take_id, destinations: t.destinations || 0, total: t.total || 0,
          completed: t.completed || 0, verified: t.verified || 0, copying: t.copying || 0,
          failed: t.failed || 0, lastCompleted: t.last_completed || null,
          fullyVerified: (t.total || 0) > 0 && (t.verified || 0) === (t.total || 0),
        })),
        oneDeskHosts: Array.isArray(j.hosts) ? j.hosts.filter(Boolean) : [],
      });
    } catch (e) { console.error("GET dit-status", e); res.json({ hasBackup: false }); }
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
        `SELECT id, panel, b2_key, label, category, content_type, created_at FROM project_images
          WHERE project_id = $1 ${panel ? "AND panel = $2" : ""}
          ORDER BY created_at DESC`,
        panel ? [req.params.projectId, panel] : [req.params.projectId],
      );
      const images = await Promise.all(r.rows.map(async (im: any) => ({
        id: im.id, panel: im.panel, label: im.label, category: im.category || null,
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
      const category = typeof req.body?.category === "string" && req.body.category ? req.body.category.slice(0, 40) : null;
      const safeName = slugifyForKey(file.originalname || "bilde");
      const key = `workspace/${req.params.projectId}/${panel}/${crypto.randomUUID()}-${safeName}`;
      const result = await archiveToRoleRoomB2(key, file.buffer, file.mimetype || "application/octet-stream");
      if (!result) return res.status(502).json({ error: "b2_upload_failed" });
      const ins = await pool.query(
        `INSERT INTO project_images (project_id, panel, b2_key, label, category, content_type, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
        [req.params.projectId, panel, key, label, category, file.mimetype || null, file.size || null, uid],
      );
      res.status(201).json({
        id: ins.rows[0].id, panel, label, category,
        url: await presignRoleRoomB2Download(key, 3600),
        createdAt: ins.rows[0].created_at,
      });
    } catch (e) { console.error("POST images", e); res.status(500).json({ error: "failed" }); }
  });

  // Re-kategoriser et bilde (moodboard-tagging).
  app.patch("/api/projects/:projectId/images/:id", async (req, res) => {
    const uid = await guard(req, res); if (!uid) return;
    try {
      await ensureSchema(pool);
      const category = typeof req.body?.category === "string" ? req.body.category.slice(0, 40) || null : null;
      const upd = await pool.query(`UPDATE project_images SET category = $1 WHERE id = $2 AND project_id = $3 RETURNING id`, [category, req.params.id, req.params.projectId]).catch(() => ({ rows: [] }));
      if (!upd.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) { console.error("PATCH images", e); res.status(500).json({ error: "failed" }); }
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
      const r = await pool.query(`SELECT * FROM project_workspace_deliverables WHERE project_id = $1 ORDER BY order_index, due_date NULLS LAST, created_at`, [req.params.projectId]);
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
        `INSERT INTO project_workspace_deliverables (project_id, title, type, status, due_date, order_index)
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
        `UPDATE project_workspace_deliverables SET title = COALESCE($1, title), type = COALESCE($2, type),
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
    try { await ensureSchema(pool); await pool.query(`DELETE FROM project_workspace_deliverables WHERE id = $1 AND project_id = $2`, [req.params.id, req.params.projectId]); res.json({ success: true }); }
    catch (e) { console.error("DELETE deliverables", e); res.status(500).json({ error: "failed" }); }
  });
}
