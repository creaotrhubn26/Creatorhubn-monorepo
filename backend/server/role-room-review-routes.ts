/**
 * Client Review Portal — signed-token sessions for klient-review uten
 * auth-krav.
 *
 * Authed endepunkter (bearer):
 *   GET    /api/role-room/review/sessions?projectId=X
 *   POST   /api/role-room/review/sessions               (create + token)
 *   PATCH  /api/role-room/review/sessions/:id           (update settings/status)
 *   DELETE /api/role-room/review/sessions/:id
 *   POST   /api/role-room/review/sessions/:id/comment-addressed (mark comment as addressed)
 *
 * Public endepunkter (token i URL):
 *   GET    /api/role-room/review/:token                 (session + cuts data)
 *   GET    /review/:token                               (server-rendered HTML for klient)
 *   POST   /api/role-room/review/:token/comment         (klient submitter kommentar)
 *   PATCH  /api/role-room/review/:token/cut/:cutId      (klient approve/reject cut)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { pool: Pool; activeSessions: Map<string, SessionData>; }

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanAccessProject(
  pool: Pool, projectId: string, viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

function generateReviewToken(): string {
  // 32-byte random → URL-safe base64
  return crypto.randomBytes(32).toString("base64url");
}

const DEFAULT_VISIBILITY = {
  showCuts: true,
  showBroll: false,
  showMusic: false,
  showLowerThirds: false,
  showCaptions: true,
  allowReject: true,
  allowApprove: true,
  allowComments: true,
};

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReviewHtml(data: {
  session: { id: string; sessionTitle: string | null;
    clientName: string | null; status: string;
    visibilitySettings: Record<string, boolean> };
  cuts: Array<{ id: string; headline: string | null;
    transcriptSnippet: string | null; status: string;
    outputPath: string | null; thumbnailPath: string | null;
    aspectRatio: string; standoutScore: number | null;
    startSec: number; endSec: number }>;
  comments: Array<{ id: string; cutId: string | null;
    clientName: string; commentText: string;
    timestampSec: number | null; sentiment: string | null;
    createdAt: string }>;
  token: string;
}): string {
  const title = data.session.sessionTitle || "Klient-review";
  const v = { ...DEFAULT_VISIBILITY, ...(data.session.visibilitySettings || {}) };
  const cutsHtml = data.cuts.map(c => {
    const cutComments = data.comments.filter(cm => cm.cutId === c.id);
    return `
      <div class="cut-card" data-cut-id="${escHtml(c.id)}">
        <div class="cut-thumb">
          ${c.thumbnailPath
            ? `<div class="thumb-placeholder">Preview</div>`
            : `<div class="thumb-placeholder">Ingen preview</div>`}
          <div class="cut-badge">${escHtml(c.aspectRatio)} · ${Math.round(c.endSec - c.startSec)}s</div>
          ${c.standoutScore
            ? `<div class="score-badge">score ${Math.round(c.standoutScore * 100)}</div>` : ""}
        </div>
        <div class="cut-body">
          <div class="cut-title">${escHtml(c.headline || "(uten tittel)")}</div>
          ${c.transcriptSnippet
            ? `<div class="cut-snippet">"${escHtml(c.transcriptSnippet.slice(0, 200))}${c.transcriptSnippet.length > 200 ? "…" : ""}"</div>` : ""}
          <div class="cut-status status-${escHtml(c.status)}">${escHtml(c.status)}</div>
          ${v.allowApprove || v.allowReject ? `
            <div class="cut-actions">
              ${v.allowApprove ? `<button onclick="approveCut('${escHtml(c.id)}')" class="btn btn-approve">Godkjenn</button>` : ""}
              ${v.allowReject ? `<button onclick="rejectCut('${escHtml(c.id)}')" class="btn btn-reject">Avvis</button>` : ""}
            </div>` : ""}
          ${v.allowComments ? `
            <div class="cut-comments">
              ${cutComments.map(cm => `
                <div class="comment">
                  <div class="comment-author">${escHtml(cm.clientName)}</div>
                  <div class="comment-text">${escHtml(cm.commentText)}</div>
                </div>
              `).join("")}
              <form onsubmit="postComment(event, '${escHtml(c.id)}')" class="comment-form">
                <input type="text" name="clientName" placeholder="Ditt navn"
                       value="${escHtml(data.session.clientName || "")}" required />
                <textarea name="comment" placeholder="Kommentar …" required></textarea>
                <button type="submit" class="btn btn-primary">Send kommentar</button>
              </form>
            </div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)} — Role Room</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(180deg, #0a0518 0%, #14081f 100%);
      color: #e8e0f0;
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, rgba(20,12,40,0.95), rgba(10,5,24,0.95));
      border: 1px solid rgba(160,48,192,0.30);
      border-radius: 10px; padding: 20px;
      max-width: 1200px; margin: 0 auto 20px auto;
    }
    .header h1 {
      font-size: 22px; margin-bottom: 6px;
      background: linear-gradient(135deg, #a030c0, #6e3fc7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header-meta { font-size: 12px; color: #a89cb8; }
    .powered-by {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 999px;
      background: rgba(160,48,192,0.18); color: #c8bcd8;
      font-size: 11px; font-weight: 600;
      margin-top: 10px;
    }
    .powered-by .dot {
      width: 6px; height: 6px; border-radius: 3px;
      background: #a030c0;
    }
    .cuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
      max-width: 1200px; margin: 0 auto;
    }
    .cut-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(160,48,192,0.18);
      border-radius: 8px; overflow: hidden;
    }
    .cut-thumb {
      position: relative;
      aspect-ratio: 16/9;
      background: rgba(0,0,0,0.5);
    }
    .thumb-placeholder {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: rgba(160,48,192,0.4); font-size: 18px; font-weight: 700;
    }
    .cut-badge, .score-badge {
      position: absolute;
      padding: 3px 8px; border-radius: 3px;
      font-size: 10px; font-weight: 600;
      background: rgba(0,0,0,0.7); color: #fff;
    }
    .cut-badge { bottom: 8px; right: 8px; }
    .score-badge {
      top: 8px; left: 8px;
      background: linear-gradient(135deg, #6e3fc7, #a030c0);
    }
    .cut-body { padding: 14px; }
    .cut-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .cut-snippet { font-size: 12px; color: #c8bcd8; line-height: 1.4;
      margin-bottom: 8px; font-style: italic; }
    .cut-status {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      margin-bottom: 10px;
    }
    .status-extracted { background: rgba(160,48,192,0.20); color: #c8bcd8; }
    .status-reviewed { background: rgba(240,165,0,0.20); color: #f0a500; }
    .status-approved { background: rgba(74,212,138,0.20); color: #4ad48a; }
    .status-rejected { background: rgba(239,79,111,0.20); color: #ef4f6f; }
    .cut-actions { display: flex; gap: 6px; margin-bottom: 10px; }
    .btn {
      padding: 7px 14px; border-radius: 4px; border: 0;
      font-size: 11.5px; font-weight: 600; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-approve {
      background: rgba(74,212,138,0.18); color: #4ad48a;
      border: 1px solid rgba(74,212,138,0.40);
    }
    .btn-reject {
      background: rgba(239,79,111,0.18); color: #ef4f6f;
      border: 1px solid rgba(239,79,111,0.40);
    }
    .btn-primary {
      background: linear-gradient(135deg, #6e3fc7, #a030c0); color: #fff;
    }
    .cut-comments {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 10px;
    }
    .comment {
      background: rgba(255,255,255,0.03);
      border-radius: 4px; padding: 8px;
      margin-bottom: 6px; font-size: 12px;
    }
    .comment-author { font-weight: 600; color: #a030c0; margin-bottom: 3px; font-size: 11px; }
    .comment-form {
      display: flex; flex-direction: column; gap: 6px;
      margin-top: 8px;
    }
    .comment-form input,
    .comment-form textarea {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(160,48,192,0.18);
      border-radius: 3px; padding: 6px 8px;
      color: #e8e0f0; font-size: 12px;
      font-family: inherit;
    }
    .comment-form textarea { min-height: 50px; resize: vertical; }
    .toast {
      position: fixed; bottom: 20px; left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #6e3fc7, #a030c0); color: #fff;
      padding: 10px 18px; border-radius: 6px;
      font-size: 12px; font-weight: 600;
      box-shadow: 0 8px 30px rgba(0,0,0,0.55);
      opacity: 0; transition: opacity 0.2s;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(title)}</h1>
    <div class="header-meta">
      Du har ${data.cuts.length} cuts å se gjennom.
      ${data.session.clientName ? `Velkommen, ${escHtml(data.session.clientName)}.` : ""}
    </div>
    <div class="powered-by">
      <span class="dot"></span> Powered by Role Room
    </div>
  </div>
  <div class="cuts-grid">${cutsHtml}</div>
  <div id="toast" class="toast"></div>
  <script>
    const TOKEN = ${JSON.stringify(data.token)};
    function showToast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2500);
    }
    async function approveCut(cutId) {
      const res = await fetch(\`/api/role-room/review/\${TOKEN}/cut/\${cutId}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        showToast("Cut godkjent");
        setTimeout(() => location.reload(), 800);
      } else showToast("Kunne ikke godkjenne");
    }
    async function rejectCut(cutId) {
      const res = await fetch(\`/api/role-room/review/\${TOKEN}/cut/\${cutId}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        showToast("Cut avvist");
        setTimeout(() => location.reload(), 800);
      } else showToast("Kunne ikke avvise");
    }
    async function postComment(e, cutId) {
      e.preventDefault();
      const form = e.target;
      const data = new FormData(form);
      const res = await fetch(\`/api/role-room/review/\${TOKEN}/comment\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cutId,
          clientName: data.get("clientName"),
          commentText: data.get("comment"),
        }),
      });
      if (res.ok) {
        showToast("Kommentar sendt");
        form.reset();
        setTimeout(() => location.reload(), 800);
      } else showToast("Kunne ikke sende");
    }
  </script>
</body>
</html>`;
}

export function registerRoleRoomReviewRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // ============ AUTHED ENDPOINTS ============

  // GET sessions for project
  app.get("/api/role-room/review/sessions",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const projectId = String(req.query.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows } = await pool.query(
          `SELECT id, project_id, token, agent_kind, session_title,
                  client_name, client_email, visibility_settings, status,
                  expires_at, last_viewed_at, view_count,
                  created_by, created_at, updated_at
             FROM role_room_review_sessions
            WHERE project_id = $1
            ORDER BY updated_at DESC`,
          [projectId],
        );
        const { rows: commentCounts } = await pool.query(
          `SELECT session_id, COUNT(*) AS count
             FROM role_room_review_comments
            WHERE session_id = ANY($1::text[])
            GROUP BY session_id`,
          [rows.map(r => r.id)],
        );
        const countMap = new Map<string, number>();
        for (const r of commentCounts) {
          countMap.set(r.session_id, parseInt(r.count, 10));
        }
        res.json({
          sessions: rows.map(r => ({
            id: r.id,
            projectId: r.project_id,
            token: r.token,
            agentKind: r.agent_kind,
            sessionTitle: r.session_title,
            clientName: r.client_name,
            clientEmail: r.client_email,
            visibilitySettings: r.visibility_settings,
            status: r.status,
            expiresAt: r.expires_at,
            lastViewedAt: r.last_viewed_at,
            viewCount: r.view_count,
            commentCount: countMap.get(r.id) || 0,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } catch (err) {
        console.error("[review] GET sessions failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST create session
  app.post("/api/role-room/review/sessions",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const body = req.body as {
        projectId?: unknown; sessionTitle?: unknown;
        clientName?: unknown; clientEmail?: unknown;
        agentKind?: unknown; visibilitySettings?: unknown;
        expiresInDays?: unknown;
      };
      const projectId = typeof body?.projectId === "string"
        ? body.projectId.trim() : "";
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      try {
        if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const token = generateReviewToken();
        const expiresInDays = typeof body?.expiresInDays === "number"
          ? Math.min(365, Math.max(1, body.expiresInDays)) : 30;
        const settings = body?.visibilitySettings
                          && typeof body.visibilitySettings === "object"
          ? JSON.stringify({ ...DEFAULT_VISIBILITY, ...body.visibilitySettings })
          : JSON.stringify(DEFAULT_VISIBILITY);
        const { rows } = await pool.query(
          `INSERT INTO role_room_review_sessions
             (project_id, token, agent_kind, session_title,
              client_name, client_email, visibility_settings,
              status, expires_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active',
                   now() + ($8 * interval '1 day'), $9)
           RETURNING id, token, expires_at, created_at`,
          [
            projectId, token,
            typeof body?.agentKind === "string"
              ? body.agentKind.slice(0, 50) : null,
            typeof body?.sessionTitle === "string"
              ? body.sessionTitle.slice(0, 200) : null,
            typeof body?.clientName === "string"
              ? body.clientName.slice(0, 200) : null,
            typeof body?.clientEmail === "string"
              ? body.clientEmail.slice(0, 200) : null,
            settings, expiresInDays, viewerId,
          ],
        );
        res.json({
          ok: true,
          id: rows[0].id,
          token: rows[0].token,
          expiresAt: rows[0].expires_at,
        });
      } catch (err) {
        console.error("[review] POST session failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // PATCH update session
  app.patch("/api/role-room/review/sessions/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      const body = req.body as Record<string, unknown>;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_review_sessions WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        if (typeof body?.sessionTitle === "string") {
          updates.push(`session_title = $${p++}`);
          values.push(body.sessionTitle.slice(0, 200));
        }
        if (typeof body?.clientName === "string") {
          updates.push(`client_name = $${p++}`);
          values.push(body.clientName.slice(0, 200));
        }
        if (typeof body?.status === "string"
            && ["draft", "active", "completed", "expired"].includes(body.status)) {
          updates.push(`status = $${p++}`);
          values.push(body.status);
        }
        if (body?.visibilitySettings && typeof body.visibilitySettings === "object") {
          updates.push(`visibility_settings = $${p++}::jsonb`);
          values.push(JSON.stringify(body.visibilitySettings));
        }
        if (updates.length === 0) {
          res.status(400).json({ error: "ingen_endringer" }); return;
        }
        updates.push(`updated_at = now()`);
        values.push(id);
        await pool.query(
          `UPDATE role_room_review_sessions SET ${updates.join(", ")} WHERE id = $${p}`,
          values,
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[review] PATCH session failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // DELETE session
  app.delete("/api/role-room/review/sessions/:id",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      if (!id) { res.status(400).json({ error: "mangler_id" }); return; }
      try {
        const { rows } = await pool.query(
          `SELECT project_id FROM role_room_review_sessions WHERE id = $1`, [id]);
        if (rows.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, rows[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(`DELETE FROM role_room_review_sessions WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[review] DELETE session failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // GET session-comments (authed — bjarne ser kommentarer)
  app.get("/api/role-room/review/sessions/:id/comments",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      try {
        const { rows: existing } = await pool.query(
          `SELECT project_id FROM role_room_review_sessions WHERE id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        const { rows } = await pool.query(
          `SELECT id, session_id, cut_id, timestamp_sec,
                  client_name, comment_text, sentiment,
                  addressed, addressed_at, created_at
             FROM role_room_review_comments
            WHERE session_id = $1
            ORDER BY created_at DESC`,
          [id],
        );
        res.json({
          comments: rows.map(r => ({
            id: r.id,
            sessionId: r.session_id,
            cutId: r.cut_id,
            timestampSec: r.timestamp_sec
              ? parseFloat(r.timestamp_sec) : null,
            clientName: r.client_name,
            commentText: r.comment_text,
            sentiment: r.sentiment,
            addressed: r.addressed,
            addressedAt: r.addressed_at,
            createdAt: r.created_at,
          })),
        });
      } catch (err) {
        console.error("[review] GET comments failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // POST mark comment as addressed
  app.post("/api/role-room/review/comments/:id/addressed",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) { res.status(401).json({ error: "krever_innlogging" }); return; }
      const id = req.params.id;
      try {
        // Sjekk tilgang via session → project
        const { rows: existing } = await pool.query(
          `SELECT s.project_id
             FROM role_room_review_comments c
             JOIN role_room_review_sessions s ON s.id = c.session_id
            WHERE c.id = $1`, [id]);
        if (existing.length === 0) {
          res.status(404).json({ error: "ikke_funnet" }); return;
        }
        if (!await viewerCanAccessProject(pool, existing[0].project_id, viewerId)) {
          res.status(403).json({ error: "ingen_tilgang" }); return;
        }
        await pool.query(
          `UPDATE role_room_review_comments
              SET addressed = true, addressed_at = now()
            WHERE id = $1`, [id]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[review] PATCH comment addressed failed:", err);
        res.status(500).json({ error: "intern_feil",
          detail: (err as Error).message });
      }
    });

  // ============ PUBLIC ENDPOINTS (token-based auth) ============

  async function loadSessionData(token: string) {
    const { rows: sessRows } = await pool.query(
      `SELECT id, project_id, session_title, client_name, status,
              visibility_settings, expires_at
         FROM role_room_review_sessions
        WHERE token = $1 LIMIT 1`,
      [token],
    );
    if (sessRows.length === 0) return { error: "ikke_funnet" as const };
    const sess = sessRows[0];
    if (new Date(sess.expires_at) < new Date()) {
      return { error: "expired" as const };
    }
    if (sess.status === "draft") {
      return { error: "draft" as const };
    }

    // Bump view-count + last_viewed_at
    await pool.query(
      `UPDATE role_room_review_sessions
          SET view_count = view_count + 1, last_viewed_at = now()
        WHERE id = $1`, [sess.id]);

    // Hent cuts + comments
    const { rows: cutsRows } = await pool.query(
      `SELECT id, headline, transcript_snippet, status,
              output_path, thumbnail_path, aspect_ratio,
              standout_score, start_sec, end_sec
         FROM role_room_social_cuts
        WHERE project_id = $1
        ORDER BY standout_score DESC NULLS LAST, created_at DESC`,
      [sess.project_id],
    );
    const { rows: commRows } = await pool.query(
      `SELECT id, cut_id, timestamp_sec, client_name,
              comment_text, sentiment, created_at
         FROM role_room_review_comments
        WHERE session_id = $1
        ORDER BY created_at DESC`,
      [sess.id],
    );
    return {
      session: {
        id: sess.id,
        sessionTitle: sess.session_title,
        clientName: sess.client_name,
        status: sess.status,
        visibilitySettings: sess.visibility_settings ?? DEFAULT_VISIBILITY,
      },
      cuts: cutsRows.map(c => ({
        id: c.id,
        headline: c.headline,
        transcriptSnippet: c.transcript_snippet,
        status: c.status,
        outputPath: c.output_path,
        thumbnailPath: c.thumbnail_path,
        aspectRatio: c.aspect_ratio,
        standoutScore: c.standout_score
          ? parseFloat(c.standout_score) : null,
        startSec: parseFloat(c.start_sec),
        endSec: parseFloat(c.end_sec),
      })),
      comments: commRows.map(c => ({
        id: c.id,
        cutId: c.cut_id,
        timestampSec: c.timestamp_sec
          ? parseFloat(c.timestamp_sec) : null,
        clientName: c.client_name,
        commentText: c.comment_text,
        sentiment: c.sentiment,
        createdAt: c.created_at,
      })),
    };
  }

  // GET public session data (JSON)
  app.get("/api/role-room/review/:token",
    async (req: Request, res: Response) => {
      const token = req.params.token;
      try {
        const data = await loadSessionData(token);
        if ("error" in data) {
          const code = data.error === "expired" ? 410
            : data.error === "draft" ? 403 : 404;
          res.status(code).json({ error: data.error }); return;
        }
        res.json(data);
      } catch (err) {
        console.error("[review] public GET failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    });

  // GET server-rendered HTML for klient
  app.get("/review/:token",
    async (req: Request, res: Response) => {
      const token = req.params.token;
      try {
        const data = await loadSessionData(token);
        if ("error" in data) {
          const msg = data.error === "expired"
            ? "Denne review-linken er utløpt."
            : data.error === "draft"
              ? "Denne review-en er ikke aktiv enda."
              : "Review-link er ugyldig.";
          res.status(data.error === "expired" ? 410
            : data.error === "draft" ? 403 : 404)
            .send(`<!DOCTYPE html><html><head><meta charset="UTF-8" />
              <title>Role Room — Review</title>
              <style>
                body { background: #0a0518; color: #e8e0f0;
                  font-family: system-ui, sans-serif;
                  display: flex; align-items: center; justify-content: center;
                  min-height: 100vh; margin: 0; padding: 20px; }
                .box { background: rgba(255,255,255,0.04); padding: 30px;
                  border-radius: 10px; max-width: 400px; text-align: center;
                  border: 1px solid rgba(160,48,192,0.30); }
                h1 { background: linear-gradient(135deg, #a030c0, #6e3fc7);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  margin-bottom: 10px; }
              </style>
              </head><body><div class="box">
                <h1>Role Room</h1>
                <p>${escHtml(msg)}</p>
              </div></body></html>`);
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(buildReviewHtml({ ...data, token }));
      } catch (err) {
        console.error("[review] HTML render failed:", err);
        res.status(500).send("Intern feil");
      }
    });

  // POST comment fra klient
  app.post("/api/role-room/review/:token/comment",
    async (req: Request, res: Response) => {
      const token = req.params.token;
      const body = req.body as {
        cutId?: unknown; clientName?: unknown;
        commentText?: unknown; timestampSec?: unknown;
        sentiment?: unknown;
      };
      try {
        const { rows } = await pool.query(
          `SELECT id, expires_at, status,
                  visibility_settings
             FROM role_room_review_sessions
            WHERE token = $1 LIMIT 1`,
          [token],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "session_ikke_funnet" }); return;
        }
        const sess = rows[0];
        if (new Date(sess.expires_at) < new Date()) {
          res.status(410).json({ error: "expired" }); return;
        }
        if (sess.status !== "active") {
          res.status(403).json({ error: "session_ikke_aktiv" }); return;
        }
        const v = sess.visibility_settings || DEFAULT_VISIBILITY;
        if (!v.allowComments) {
          res.status(403).json({ error: "kommentarer_deaktivert" }); return;
        }
        const clientName = typeof body?.clientName === "string"
          ? body.clientName.trim().slice(0, 200) : "";
        const commentText = typeof body?.commentText === "string"
          ? body.commentText.trim().slice(0, 5000) : "";
        if (!clientName || !commentText) {
          res.status(400).json({ error: "mangler_felter" }); return;
        }
        await pool.query(
          `INSERT INTO role_room_review_comments
             (session_id, cut_id, timestamp_sec, client_name,
              comment_text, sentiment)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sess.id,
            typeof body?.cutId === "string" ? body.cutId : null,
            typeof body?.timestampSec === "number" ? body.timestampSec : null,
            clientName, commentText,
            typeof body?.sentiment === "string"
              && ["positive", "neutral", "negative"].includes(body.sentiment)
              ? body.sentiment : null,
          ],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[review] POST comment failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    });

  // PATCH cut-status fra klient (approve/reject)
  app.patch("/api/role-room/review/:token/cut/:cutId",
    async (req: Request, res: Response) => {
      const token = req.params.token;
      const cutId = req.params.cutId;
      const body = req.body as { status?: unknown };
      try {
        const { rows } = await pool.query(
          `SELECT s.id, s.project_id, s.expires_at, s.status,
                  s.visibility_settings
             FROM role_room_review_sessions s
            WHERE s.token = $1 LIMIT 1`,
          [token],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: "session_ikke_funnet" }); return;
        }
        const sess = rows[0];
        if (new Date(sess.expires_at) < new Date()) {
          res.status(410).json({ error: "expired" }); return;
        }
        if (sess.status !== "active") {
          res.status(403).json({ error: "session_ikke_aktiv" }); return;
        }
        const v = sess.visibility_settings || DEFAULT_VISIBILITY;

        // Sjekk at cut tilhører samme project
        const { rows: cutRows } = await pool.query(
          `SELECT id, project_id FROM role_room_social_cuts WHERE id = $1`, [cutId]);
        if (cutRows.length === 0
            || cutRows[0].project_id !== sess.project_id) {
          res.status(404).json({ error: "cut_ikke_funnet" }); return;
        }

        const newStatus = typeof body?.status === "string"
          ? body.status : "";
        if (newStatus === "approved") {
          if (!v.allowApprove) {
            res.status(403).json({ error: "approve_deaktivert" }); return;
          }
        } else if (newStatus === "rejected") {
          if (!v.allowReject) {
            res.status(403).json({ error: "reject_deaktivert" }); return;
          }
        } else {
          res.status(400).json({ error: "ugyldig_status" }); return;
        }

        await pool.query(
          `UPDATE role_room_social_cuts
              SET status = $1, updated_at = now()
            WHERE id = $2`,
          [newStatus, cutId]);
        res.json({ ok: true });
      } catch (err) {
        console.error("[review] PATCH cut failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    });
}
