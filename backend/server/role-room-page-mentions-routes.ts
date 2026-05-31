/**
 * role-room-page-mentions-routes.ts — Meta `Page Mentions` App Review demo + API.
 *
 * Permission/feature: "Page Mentions" — read public posts where the
 * Page has been tagged/mentioned. Used by The Role Room to surface
 * "who's talking about you" to production-team Pages — e.g. casting
 * directors want to know when other Pages tag their production-company
 * Page in casting-call announcements or reviews.
 *
 * Endepunkter:
 *   GET /api/role-room/page-mentions?pageId=...[&accessToken=...&limit=10]
 *     Kaller `GET /v21.0/{pageId}/tagged?fields=id,from,message,created_time,
 *     permalink_url,type,reactions.summary(true),comments.summary(true)`
 *     med App Access Token (default) eller Page-scoped token.
 *
 *   GET /admin/page-mentions-app-review-demo
 *     Server-rendret admin-side med data-testid for Playwright-recording.
 *     Bypass via ?token=… / x-demo-token-header.
 *
 * Reference: https://developers.facebook.com/docs/graph-api/reference/page/tagged
 */

import type { Application, Request, Response } from "express";

export interface SetupPageMentionsRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

function resolveAccessToken(req: Request): string {
  const explicit = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  if (explicit) return explicit;
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appId && appSecret) return `${appId}|${appSecret}`;
  return "";
}

export function setupPageMentionsRoutes(deps: SetupPageMentionsRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: GET /api/role-room/page-mentions ───────────────────────────────
  app.get("/api/role-room/page-mentions", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const pageId = typeof req.query.pageId === "string" ? req.query.pageId.trim() : "";
    if (!pageId) {
      res.status(400).json({ error: "pageId is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken or META_APP_ID/META_APP_SECRET required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "10";
    const params = new URLSearchParams({
      fields: "id,from,message,created_time,permalink_url",
      limit,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/tagged?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_page_mentions_failed",
          pageId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        pageId,
        mentionCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        mentions: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "page_mentions_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: GET /admin/page-mentions-app-review-demo ─────────────────
  app.get("/admin/page-mentions-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>Page Mentions App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:820px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#fef3c7}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#fbbf24;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#fcd34d}
  button:disabled{opacity:.5;cursor:wait}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#fde68a;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(251,191,36,.18);color:#fde68a;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .mention-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:8px;font-size:13px;line-height:1.5}
  .mention-from{color:#fbbf24;font-weight:600;font-size:12px;margin-bottom:6px}
  .mention-meta{display:flex;gap:14px;font-size:11px;color:#94a3b8;margin-top:8px;flex-wrap:wrap}
</style></head>
<body>
<div class="card" data-testid="page-mentions-demo-root">
  <span class="badge">Page Mentions</span>
  <h1 style="margin-top:14px">Page Mentions — Discover Posts Tagging Your Production Page</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    Production-team Pages get tagged by casting directors, talent, and partner
    Pages in casting-call announcements, reviews, and behind-the-scenes
    posts. <code style="color:#fbbf24">Page Mentions</code> via the
    Graph API <code style="color:#fbbf24">/v21.0/{page-id}/tagged</code>
    endpoint lets The Role Room surface these mentions in a "Who's
    talking about you"-feed so producers can engage in real time —
    answer questions, share traffic, find new collaborators.</p>

  <h3>Step 1 — Page ID</h3>
  <label for="page-id">Page ID (production-team Page)</label>
  <input id="page-id" data-testid="page-id-input" type="text" placeholder="e.g. 123456789012345" />
  <div class="hint">App Access Token (META_APP_ID|META_APP_SECRET) er default. Page-scoped token kan også brukes for å lese mentions på Pages som har gitt page_read_engagement.</div>

  <button id="fetch-btn" data-testid="fetch-mentions-button" type="button">🔖 Fetch mentions</button>

  <h3>Step 2 — Tagged posts</h3>
  <div data-testid="mentions-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting Page ID…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const mentionsResult = document.querySelector('[data-testid="mentions-result"]');

function tokenSuffix() {
  const sp = new URLSearchParams(window.location.search);
  const parts = [];
  if (sp.get('token')) parts.push('token=' + encodeURIComponent(sp.get('token')));
  if (sp.get('accessToken')) parts.push('accessToken=' + encodeURIComponent(sp.get('accessToken')));
  return parts.length ? '&' + parts.join('&') : '';
}

function renderMentions(payload) {
  const data = (payload.mentions && Array.isArray(payload.mentions.data)) ? payload.mentions.data : [];
  const header = '<div style="color:#fde68a;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> recent posts tagging Page ' + payload.pageId + '</div>';
  const cards = data.slice(0, 10).map((p) => {
    const fromName = (p.from && p.from.name) || '(unknown)';
    const reactions = (p.reactions && p.reactions.summary && p.reactions.summary.total_count) || 0;
    const comments = (p.comments && p.comments.summary && p.comments.summary.total_count) || 0;
    const message = (p.message || '(no message — likely a media post)').slice(0, 300).replace(/</g, '&lt;');
    return '<div class="mention-card" data-testid="mention-card">'
      + '<div class="mention-from">From: ' + fromName + '</div>'
      + '<div>' + message + '</div>'
      + '<div class="mention-meta">'
      + '<span>📅 ' + (p.created_time || '?') + '</span>'
      + '<span>📌 ' + (p.type || '?') + '</span>'
      + '<span>❤️ ' + reactions + '</span>'
      + '<span>💬 ' + comments + '</span>'
      + (p.permalink_url ? '<a href="' + p.permalink_url + '" target="_blank" style="color:#fbbf24">↗ open</a>' : '')
      + '</div></div>';
  }).join('');
  return header + (cards || '<div class="mention-card" data-testid="mention-empty" style="color:#64748b;font-style:italic">No recent mentions</div>') + '<pre data-testid="mentions-raw" style="margin-top:12px">' + JSON.stringify(payload, null, 2).slice(0, 8000) + '</pre>';
}

$('fetch-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  if (!pageId) {
    mentionsResult.innerHTML = '<pre class="status-err" data-testid="mentions-err">✗ Page ID required</pre>';
    return;
  }
  const btn = $('fetch-btn');
  btn.disabled = true;
  mentionsResult.innerHTML = '<pre class="status-ok">⏳ Calling Meta Graph /v21.0/{page-id}/tagged…</pre>';
  try {
    const url = '/api/role-room/page-mentions?pageId=' + encodeURIComponent(pageId) + '&limit=10' + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      mentionsResult.innerHTML = renderMentions(data);
    } else {
      mentionsResult.innerHTML = '<pre class="status-err" data-testid="mentions-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    mentionsResult.innerHTML = '<pre class="status-err" data-testid="mentions-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
