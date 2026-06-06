/**
 * role-room-page-public-content-routes.ts — Meta `Page Public Content Access`
 * App Review demo + API.
 *
 * Permission/feature: "Page Public Content Access" — read-only access to
 * public content on Facebook Pages the app does NOT manage. Used by
 * The Role Room to discover public casting-call posts and production-team
 * announcements from Norwegian film/TV/theatre Pages, surfacing them to
 * casting directors who want to follow up.
 *
 * Endepunkter:
 *   GET /api/role-room/public-page/profile?pageId=...&accessToken=...
 *     Kaller `GET /v21.0/{pageId}?fields=id,name,about,category,
 *     fan_count,verification_status,website,emails,phone,description`
 *     med App Access Token. Returnerer offentlig page-metadata.
 *
 *   GET /api/role-room/public-page/posts?pageId=...&accessToken=...
 *     Kaller `GET /v21.0/{pageId}/posts?fields=id,message,created_time,
 *     permalink_url,reactions.summary(true),comments.summary(true)&limit=10`.
 *     Returnerer publiserte posts med engagement-counts.
 *
 *   GET /admin/page-public-content-app-review-demo
 *     Server-rendret admin-side. data-testid på alle elementer for Playwright-
 *     recording; bypass-token via ?token=… eller x-demo-token-header.
 *
 * Reference: https://developers.facebook.com/docs/graph-api/reference/page
 */

import type { Application, Request, Response } from "express";

export interface SetupPagePublicContentRoutesDeps {
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

export function setupPagePublicContentRoutes(deps: SetupPagePublicContentRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: GET /api/role-room/public-page/profile ─────────────────────────
  app.get("/api/role-room/public-page/profile", async (req, res) => {
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
    const params = new URLSearchParams({
      fields: "id,name,about,category,fan_count,verification_status,website,emails,phone,description",
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_page_profile_failed",
          pageId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({ success: true, pageId, profile: body });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "page_profile_request_failed",
        detail: String(error),
      });
    }
  });

  // ── API: GET /api/role-room/public-page/posts ───────────────────────────
  app.get("/api/role-room/public-page/posts", async (req, res) => {
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
      fields: "id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true)",
      limit,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/posts?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_page_posts_failed",
          pageId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        pageId,
        postCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        posts: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "page_posts_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: GET /admin/page-public-content-app-review-demo ───────────
  app.get("/admin/page-public-content-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>Page Public Content Access App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:820px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#e0f2fe}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#0ea5e9;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#38bdf8}
  button:disabled{opacity:.5;cursor:wait}
  button.secondary{background:#475569;color:#f1f5f9}
  button.secondary:hover{background:#64748b}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#bae6fd;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(14,165,233,.18);color:#7dd3fc;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .profile-row{display:grid;grid-template-columns:140px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid rgba(148,163,184,.12);font-size:13px}
  .profile-row strong{color:#7dd3fc}
  .profile-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:18px;margin-top:10px}
  .post-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:8px;font-size:13px;line-height:1.5}
  .post-meta{display:flex;gap:14px;font-size:11px;color:#94a3b8;margin-top:8px}
</style></head>
<body>
<div class="card" data-testid="public-content-demo-root">
  <span class="badge">Page Public Content Access</span>
  <h1 style="margin-top:14px">Public Page Discovery — Norwegian Casting & Production Pages</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    The Role Room uses <code style="color:#fbbf24">Page Public Content Access</code> to discover
    publicly visible posts and announcements from Norwegian film/TV/theatre
    production-company Pages — surfacing them to casting directors who want
    to follow active casting calls and production updates. We read ONLY
    public fields the Page owner has marked as visible to the public.</p>

  <h3>Step 1 — Page ID</h3>
  <label for="page-id">Public Facebook Page ID</label>
  <input id="page-id" data-testid="page-id-input" type="text" placeholder="e.g. 123456789012345 — NRK Drama, Storyline, etc." />
  <div class="hint">Use the numeric Page ID (visible in Page transparency info). App Access Token is read from META_APP_ID/META_APP_SECRET env on the server; no user token required.</div>

  <button id="fetch-profile-btn" data-testid="fetch-profile-button" type="button">🏷️ Fetch public profile</button>
  <button id="fetch-posts-btn" data-testid="fetch-posts-button" type="button" class="secondary">📰 Fetch public posts</button>

  <h3>Step 2 — Public profile fields</h3>
  <div data-testid="profile-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting Page ID…</pre>
  </div>

  <h3>Step 3 — Public posts</h3>
  <div data-testid="posts-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting Page ID…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const profileResult = document.querySelector('[data-testid="profile-result"]');
const postsResult = document.querySelector('[data-testid="posts-result"]');

function tokenSuffix() {
  const sp = new URLSearchParams(window.location.search);
  const parts = [];
  if (sp.get('token')) parts.push('token=' + encodeURIComponent(sp.get('token')));
  if (sp.get('accessToken')) parts.push('accessToken=' + encodeURIComponent(sp.get('accessToken')));
  return parts.length ? '&' + parts.join('&') : '';
}

function renderProfile(profile) {
  const fields = [
    ['Name', profile.name],
    ['ID', profile.id],
    ['Category', profile.category],
    ['Fan count', profile.fan_count],
    ['Verification', profile.verification_status],
    ['Website', profile.website],
    ['Phone', profile.phone],
    ['About', profile.about],
  ];
  const rows = fields
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => '<div class="profile-row"><strong>' + k + '</strong><span>' + String(v).replace(/</g, '&lt;') + '</span></div>')
    .join('');
  return '<div class="profile-card" data-testid="profile-card">' + rows + '</div><pre data-testid="profile-raw" style="margin-top:10px">' + JSON.stringify(profile, null, 2) + '</pre>';
}

function renderPosts(payload) {
  const data = (payload.posts && Array.isArray(payload.posts.data)) ? payload.posts.data : [];
  const header = '<div style="color:#7dd3fc;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> recent public posts on Page ' + payload.pageId + '</div>';
  const cards = data.slice(0, 10).map((p) => {
    const reactions = (p.reactions && p.reactions.summary && p.reactions.summary.total_count) || 0;
    const comments = (p.comments && p.comments.summary && p.comments.summary.total_count) || 0;
    const message = (p.message || '(no message)').slice(0, 300).replace(/</g, '&lt;');
    return '<div class="post-card" data-testid="post-card">'
      + '<div>' + message + '</div>'
      + '<div class="post-meta">'
      + '<span>📅 ' + (p.created_time || '?') + '</span>'
      + '<span>❤️ ' + reactions + '</span>'
      + '<span>💬 ' + comments + '</span>'
      + (p.permalink_url ? '<a href="' + p.permalink_url + '" target="_blank" style="color:#7dd3fc">↗ open</a>' : '')
      + '</div></div>';
  }).join('');
  return header + cards + '<pre data-testid="posts-raw" style="margin-top:12px">' + JSON.stringify(payload, null, 2).slice(0, 8000) + '</pre>';
}

$('fetch-profile-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  if (!pageId) {
    profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ Page ID required</pre>';
    return;
  }
  const btn = $('fetch-profile-btn');
  btn.disabled = true;
  profileResult.innerHTML = '<pre class="status-ok">⏳ Calling Meta Graph /v21.0/{page-id}…</pre>';
  try {
    const url = '/api/role-room/public-page/profile?pageId=' + encodeURIComponent(pageId) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      profileResult.innerHTML = renderProfile(data.profile);
    } else {
      profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

$('fetch-posts-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  if (!pageId) {
    postsResult.innerHTML = '<pre class="status-err" data-testid="posts-err">✗ Page ID required</pre>';
    return;
  }
  const btn = $('fetch-posts-btn');
  btn.disabled = true;
  postsResult.innerHTML = '<pre class="status-ok">⏳ Calling Meta Graph /v21.0/{page-id}/posts…</pre>';
  try {
    const url = '/api/role-room/public-page/posts?pageId=' + encodeURIComponent(pageId) + '&limit=10' + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      postsResult.innerHTML = renderPosts(data);
    } else {
      postsResult.innerHTML = '<pre class="status-err" data-testid="posts-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    postsResult.innerHTML = '<pre class="status-err" data-testid="posts-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
