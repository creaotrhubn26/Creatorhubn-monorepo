/**
 * role-room-ig-public-routes.ts — Meta `Instagram Public Content Access`
 * App Review demo + API.
 *
 * Permission/feature: "Instagram Public Content Access" — read-only access til
 * public IG-content via Hashtag Search + recent_media + business_discovery.
 *
 * Brukes av The Role Room for konkurrent-monitorering: producer søker på
 * #norskcasting / #productioncrew og ser hvem som er aktive, hva annonseres,
 * og hvilke produksjonsteam publiserer aktiv-prosjekt-content. Hjelper med
 * å oppdage nye samarbeidspartnere + identifisere aktive casting-calls.
 *
 * Endepunkter:
 *   GET /api/role-room/ig-public/hashtag-search?q=<hashtag>&userId=<ig-user-id>
 *     Kaller /v21.0/ig_hashtag_search?q=...&user_id=... — returnerer hashtag-ID.
 *
 *   GET /api/role-room/ig-public/hashtag-media?hashtagId=<id>&userId=<ig-user-id>
 *     Kaller /v21.0/{hashtag-id}/recent_media?user_id=...&fields=...
 *     — returnerer public IG media for hashtag.
 *
 *   GET /api/role-room/ig-public/business-discovery?username=<ig>&userId=<ig-user-id>
 *     Kaller /v21.0/{ig-user-id}?fields=business_discovery.username(target){
 *       media{...},name,followers_count,media_count,biography}
 *
 *   GET /admin/instagram-public-content-app-review-demo
 *     Server-rendret admin-side. data-testid for Playwright; bypass via ?token=.
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search
 */

import type { Application, Request, Response } from "express";

export interface SetupIgPublicRoutesDeps {
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

const IG_MEDIA_FIELDS = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,username";

export function setupIgPublicRoutes(deps: SetupIgPublicRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: /ig-public/hashtag-search ──────────────────────────────────────
  app.get("/api/role-room/ig-public/hashtag-search", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim().replace(/^#/, "") : "";
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!q) {
      res.status(400).json({ error: "q (hashtag) is required" });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: "userId (IG Business user_id) is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken or META_APP_ID/META_APP_SECRET required" });
      return;
    }
    const params = new URLSearchParams({
      user_id: userId,
      q,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/ig_hashtag_search?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_hashtag_search_failed",
          hashtag: q,
          status: upstream.status,
          response: body,
        });
        return;
      }
      const data = (body as Record<string, unknown>).data;
      const first = Array.isArray(data) && data.length > 0
        ? (data[0] as Record<string, unknown>)
        : null;
      res.json({
        success: true,
        hashtag: q,
        hashtagId: first ? String(first.id) : null,
        response: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_hashtag_search_request_failed",
        detail: String(error),
      });
    }
  });

  // ── API: /ig-public/hashtag-media ───────────────────────────────────────
  app.get("/api/role-room/ig-public/hashtag-media", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const hashtagId = typeof req.query.hashtagId === "string" ? req.query.hashtagId.trim() : "";
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!hashtagId) {
      res.status(400).json({ error: "hashtagId is required" });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: "userId (IG Business user_id) is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken or META_APP_ID/META_APP_SECRET required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "9";
    const params = new URLSearchParams({
      user_id: userId,
      fields: IG_MEDIA_FIELDS,
      limit,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(hashtagId)}/recent_media?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_hashtag_media_failed",
          hashtagId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        hashtagId,
        mediaCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        media: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_hashtag_media_request_failed",
        detail: String(error),
      });
    }
  });

  // ── API: /ig-public/business-discovery ──────────────────────────────────
  app.get("/api/role-room/ig-public/business-discovery", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const username = typeof req.query.username === "string" ? req.query.username.trim().replace(/^@/, "") : "";
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!username) {
      res.status(400).json({ error: "username is required (target IG handle, without @)" });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: "userId (caller's IG Business user_id) is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken or META_APP_ID/META_APP_SECRET required" });
      return;
    }
    const params = new URLSearchParams({
      fields: `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website,media.limit(6){${IG_MEDIA_FIELDS}}}`,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_business_discovery_failed",
          username,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        username,
        discovery: (body as Record<string, unknown>).business_discovery ?? null,
        response: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_business_discovery_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: /admin/instagram-public-content-app-review-demo ──────────
  app.get("/admin/instagram-public-content-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>Instagram Public Content App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:920px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#fce7f3}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:wait}
  button.secondary{background:#475569;color:#f1f5f9}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#fbcfe8;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:linear-gradient(135deg,rgba(236,72,153,.2),rgba(168,85,247,.2));color:#f9a8d4;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:12px}
  .media-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:10px;font-size:11px}
  .media-card img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:6px;background:#1e293b;margin-bottom:6px}
  .media-caption{color:#cbd5e1;font-size:11px;line-height:1.4;max-height:60px;overflow:hidden}
  .media-meta{display:flex;gap:8px;font-size:10px;color:#94a3b8;margin-top:6px}
  .discovery-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:16px;margin-top:10px}
  .discovery-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px;text-align:center}
  .stat{background:#1e293b;border-radius:8px;padding:10px}
  .stat-val{font-size:18px;font-weight:800;color:#f9a8d4}
  .stat-key{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
</style></head>
<body>
<div class="card" data-testid="ig-public-content-demo-root">
  <span class="badge">Instagram Public Content Access</span>
  <h1 style="margin-top:14px">Instagram Public Content — Competitor Monitoring for Casting</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    The Role Room uses <code style="color:#fbbf24">Instagram Public Content Access</code> to monitor active
    casting and production-team activity on Instagram via two complementary flows: <strong>(A)</strong> Hashtag
    Search + Recent Media for surfacing posts under industry hashtags (#norskcasting,
    #productioncrew, ...), and <strong>(B)</strong> Business Discovery for inspecting a
    specific production-team's public IG profile (followers, recent media,
    biography). All content read is publicly visible on Instagram; no
    private data, no user-token impersonation.</p>

  <h3>Step 1 — IG Business user_id (caller)</h3>
  <label for="ig-user-id">Your Instagram Business user_id</label>
  <input id="ig-user-id" data-testid="ig-user-id-input" type="text" placeholder="e.g. 17841401234567890" />
  <div class="hint">Required by Meta for both hashtag-search and business-discovery. Your IG Business account ID (from /me/accounts).</div>

  <h3>Flow A — Hashtag Search</h3>
  <div class="row">
    <div>
      <label for="hashtag">Hashtag (without #)</label>
      <input id="hashtag" data-testid="hashtag-input" type="text" placeholder="norskcasting" />
    </div>
    <div>
      <label style="visibility:hidden">x</label>
      <button id="search-hashtag-btn" data-testid="search-hashtag-button" type="button">🔎 Search hashtag → media</button>
    </div>
  </div>
  <div data-testid="hashtag-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting hashtag…</pre>
  </div>

  <h3>Flow B — Business Discovery</h3>
  <div class="row">
    <div>
      <label for="ig-username">Target IG username (without @)</label>
      <input id="ig-username" data-testid="ig-username-input" type="text" placeholder="nrkdrama" />
    </div>
    <div>
      <label style="visibility:hidden">x</label>
      <button id="discover-btn" data-testid="discover-button" type="button" class="secondary">🔍 Discover business profile</button>
    </div>
  </div>
  <div data-testid="discovery-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting username…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const hashtagResult = document.querySelector('[data-testid="hashtag-result"]');
const discoveryResult = document.querySelector('[data-testid="discovery-result"]');

function tokenSuffix() {
  const sp = new URLSearchParams(window.location.search);
  const parts = [];
  if (sp.get('token')) parts.push('token=' + encodeURIComponent(sp.get('token')));
  if (sp.get('accessToken')) parts.push('accessToken=' + encodeURIComponent(sp.get('accessToken')));
  return parts.length ? '&' + parts.join('&') : '';
}

function renderMediaGrid(payload, container) {
  const data = (payload.media && Array.isArray(payload.media.data)) ? payload.media.data : [];
  const header = '<div style="color:#f9a8d4;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> recent media for hashtag ' + payload.hashtagId + '</div>';
  const cards = data.slice(0, 9).map((m) => {
    const caption = (m.caption || '(no caption)').slice(0, 140).replace(/</g, '&lt;');
    const imgSrc = m.media_type === 'IMAGE' && m.media_url ? m.media_url : '';
    return '<div class="media-card" data-testid="media-card">'
      + (imgSrc ? '<img src="' + imgSrc + '" alt="" loading="lazy" />' : '<div style="aspect-ratio:1/1;background:#1e293b;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#475569">' + (m.media_type || '?') + '</div>')
      + '<div class="media-caption">' + caption + '</div>'
      + '<div class="media-meta">'
      + '<span>❤️ ' + (m.like_count || 0) + '</span>'
      + '<span>💬 ' + (m.comments_count || 0) + '</span>'
      + (m.permalink ? '<a href="' + m.permalink + '" target="_blank" style="color:#f9a8d4">↗</a>' : '')
      + '</div></div>';
  }).join('');
  return header + '<div class="media-grid">' + (cards || '<div style="color:#64748b;font-style:italic">No recent media</div>') + '</div><pre data-testid="hashtag-raw" style="margin-top:10px">' + JSON.stringify(payload, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

function renderDiscovery(payload) {
  const d = payload.discovery || {};
  const media = (d.media && Array.isArray(d.media.data)) ? d.media.data : [];
  const head = '<div class="discovery-card" data-testid="discovery-card">'
    + '<div style="display:flex;gap:14px;align-items:center">'
    + (d.profile_picture_url ? '<img src="' + d.profile_picture_url + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover" />' : '')
    + '<div><div style="font-weight:700;color:#fce7f3;font-size:16px">' + (d.name || d.username || '') + '</div>'
    + '<div style="color:#94a3b8;font-size:13px">@' + (d.username || '') + '</div></div></div>'
    + '<div class="discovery-stats">'
    + '<div class="stat"><div class="stat-val">' + (d.followers_count || 0) + '</div><div class="stat-key">Followers</div></div>'
    + '<div class="stat"><div class="stat-val">' + (d.follows_count || 0) + '</div><div class="stat-key">Following</div></div>'
    + '<div class="stat"><div class="stat-val">' + (d.media_count || 0) + '</div><div class="stat-key">Posts</div></div>'
    + '</div>'
    + (d.biography ? '<div style="color:#cbd5e1;font-size:12px;margin-top:10px;line-height:1.4">' + String(d.biography).slice(0, 300).replace(/</g, '&lt;') + '</div>' : '')
    + '</div>';
  const mediaCards = media.slice(0, 6).map((m) => {
    const caption = (m.caption || '(no caption)').slice(0, 100).replace(/</g, '&lt;');
    const imgSrc = m.media_type === 'IMAGE' && m.media_url ? m.media_url : '';
    return '<div class="media-card">'
      + (imgSrc ? '<img src="' + imgSrc + '" alt="" loading="lazy" />' : '<div style="aspect-ratio:1/1;background:#1e293b;border-radius:6px"></div>')
      + '<div class="media-caption">' + caption + '</div>'
      + '<div class="media-meta"><span>❤️ ' + (m.like_count || 0) + '</span></div>'
      + '</div>';
  }).join('');
  return head + '<div class="media-grid">' + mediaCards + '</div><pre data-testid="discovery-raw" style="margin-top:10px">' + JSON.stringify(payload, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

$('search-hashtag-btn').addEventListener('click', async () => {
  const userId = $('ig-user-id').value.trim();
  const q = $('hashtag').value.trim();
  if (!userId || !q) {
    hashtagResult.innerHTML = '<pre class="status-err" data-testid="hashtag-err">✗ IG user_id + hashtag required</pre>';
    return;
  }
  const btn = $('search-hashtag-btn');
  btn.disabled = true;
  hashtagResult.innerHTML = '<pre class="status-ok">⏳ /v21.0/ig_hashtag_search…</pre>';
  try {
    const searchUrl = '/api/role-room/ig-public/hashtag-search?userId=' + encodeURIComponent(userId)
      + '&q=' + encodeURIComponent(q) + tokenSuffix();
    const searchResp = await fetch(searchUrl, { credentials: 'include' });
    const searchData = await searchResp.json();
    if (!searchResp.ok || !searchData.success || !searchData.hashtagId) {
      hashtagResult.innerHTML = '<pre class="status-err" data-testid="hashtag-err">✗ Search failed\\n\\n' + JSON.stringify(searchData, null, 2) + '</pre>';
      return;
    }
    hashtagResult.innerHTML = '<pre class="status-ok">✓ Hashtag ID ' + searchData.hashtagId + ' — now /recent_media…</pre>';
    const mediaUrl = '/api/role-room/ig-public/hashtag-media?userId=' + encodeURIComponent(userId)
      + '&hashtagId=' + encodeURIComponent(searchData.hashtagId) + '&limit=9' + tokenSuffix();
    const mediaResp = await fetch(mediaUrl, { credentials: 'include' });
    const mediaData = await mediaResp.json();
    if (mediaResp.ok && mediaData.success) {
      hashtagResult.innerHTML = renderMediaGrid(mediaData);
    } else {
      hashtagResult.innerHTML = '<pre class="status-err" data-testid="hashtag-err">✗ Media failed\\n\\n' + JSON.stringify(mediaData, null, 2) + '</pre>';
    }
  } catch (err) {
    hashtagResult.innerHTML = '<pre class="status-err" data-testid="hashtag-err">✗ Network: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

$('discover-btn').addEventListener('click', async () => {
  const userId = $('ig-user-id').value.trim();
  const username = $('ig-username').value.trim();
  if (!userId || !username) {
    discoveryResult.innerHTML = '<pre class="status-err" data-testid="discovery-err">✗ IG user_id + username required</pre>';
    return;
  }
  const btn = $('discover-btn');
  btn.disabled = true;
  discoveryResult.innerHTML = '<pre class="status-ok">⏳ /v21.0/{ig-user-id}?fields=business_discovery…</pre>';
  try {
    const url = '/api/role-room/ig-public/business-discovery?userId=' + encodeURIComponent(userId)
      + '&username=' + encodeURIComponent(username) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success && data.discovery) {
      discoveryResult.innerHTML = renderDiscovery(data);
    } else {
      discoveryResult.innerHTML = '<pre class="status-err" data-testid="discovery-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    discoveryResult.innerHTML = '<pre class="status-err" data-testid="discovery-err">✗ Network: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
