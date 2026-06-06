/**
 * role-room-ig-business-basic-routes.ts — Meta `instagram_business_basic`
 * App Review demo + API.
 *
 * Permission/feature: "instagram_business_basic" — read the basic profile
 * (username, account_type, profile_picture_url, followers_count, media_count)
 * of an Instagram professional account that a Page admin has connected.
 *
 * Brukes av The Role Room for å vise produksjons-teamet HVILKEN
 * Instagram-Business-konto som er koblet til (brukernavn + profilbilde),
 * slik at de kan bekrefte riktig konto før de publiserer eller leser
 * innhold via de andre IG-tillatelsene. Dette er en avhengighet for
 * instagram_content_publish + Instagram Public Content Access.
 *
 * Endepunkter:
 *   GET /api/role-room/ig-business-basic/profile?igUserId=...&accessToken=...
 *     Kaller /v21.0/{ig-user-id}?fields=id,username,account_type,
 *     profile_picture_url,followers_count,media_count,name
 *
 *   GET /admin/instagram-business-basic-app-review-demo
 *     Server-rendret admin-side. data-testid for Playwright; bypass via ?token=.
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/reference/ig-user
 */

import type { Application, Request, Response } from "express";

export interface SetupIgBusinessBasicRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

// account_type is only returnable on the Instagram-Login /me node, not on the
// IG-User node reached via Facebook Login — so we omit it here to keep the read
// robust across connection styles. username + profile_picture_url (the fields
// the screencast must show) are always present.
const PROFILE_FIELDS =
  "id,username,profile_picture_url,followers_count,media_count,name,biography,website";

function resolveAccessToken(req: Request, fallback?: unknown): string {
  const fromQuery = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  if (fromQuery) return fromQuery;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appId && appSecret) return `${appId}|${appSecret}`;
  return "";
}

export function setupIgBusinessBasicRoutes(deps: SetupIgBusinessBasicRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── GET /api/role-room/ig-business-basic/profile ────────────────────────
  app.get("/api/role-room/ig-business-basic/profile", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const igUserId = typeof req.query.igUserId === "string" ? req.query.igUserId.trim() : "";
    if (!igUserId) {
      res.status(400).json({ error: "igUserId is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken required (with instagram_business_basic)" });
      return;
    }
    const params = new URLSearchParams({
      fields: PROFILE_FIELDS,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_business_basic_failed",
          igUserId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        igUserId,
        profile: {
          id: body.id ?? null,
          username: body.username ?? null,
          name: body.name ?? null,
          biography: body.biography ?? null,
          website: body.website ?? null,
          profilePictureUrl: body.profile_picture_url ?? null,
          followersCount: body.followers_count ?? null,
          mediaCount: body.media_count ?? null,
        },
        raw: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_business_basic_request_failed",
        detail: String(error),
      });
    }
  });

  // ── GET /admin/instagram-business-basic-app-review-demo ──────────────────
  app.get("/admin/instagram-business-basic-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>instagram_business_basic App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:920px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#fce7f3}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:12px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:14px;transition:transform .12s}
  button:hover{transform:translateY(-1px);filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:wait}
  button.connect{background:linear-gradient(135deg,#1877F2,#3b5998)}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#fbcfe8;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(236,72,153,.2));color:#c4b5fd;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .step-note{background:#0f1729;border:1px dashed #475569;border-radius:10px;padding:16px;margin-top:14px;color:#cbd5e1;font-size:13px;line-height:1.6}
  .profile-card{display:flex;gap:18px;align-items:center;background:#0f1729;border:1px solid #334155;border-radius:12px;padding:18px;margin-top:8px}
  .profile-card img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:2px solid #8b5cf6;background:#1e293b}
  .profile-meta{flex:1;min-width:0}
  .profile-username{color:#fce7f3;font-weight:800;font-size:18px}
  .profile-name{color:#cbd5e1;font-size:14px;margin-top:2px}
  .profile-stats{display:flex;gap:18px;margin-top:10px;font-size:12px;color:#94a3b8;flex-wrap:wrap}
  .profile-stats b{color:#c4b5fd}
  .acct-pill{display:inline-block;background:rgba(139,92,246,.18);color:#c4b5fd;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;margin-top:8px}
</style></head>
<body>
<div class="card" data-testid="ig-basic-demo-root">
  <span class="badge">instagram_business_basic</span>
  <h1 style="margin-top:14px">Instagram Profile — Show the Connected Professional Account</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    A production team connects its own Instagram Business/Creator account via
    Facebook Login. The Role Room uses
    <code style="color:#c4b5fd">instagram_business_basic</code> to read that
    connected account's basic profile and display it back to the user —
    <strong>username and profile picture</strong> — so they can confirm the
    correct account is linked before publishing or reading content. This is a
    dependency for our content-publishing and discovery features.</p>

  <h3>Step 1 — Connect the Instagram professional account</h3>
  <div class="step-note">
    In the live product the user clicks <strong>“Continue with Facebook”</strong>,
    selects the Page whose connected Instagram Business/Creator account they
    manage, and grants <code style="color:#c4b5fd">instagram_business_basic</code>.
    We then resolve the connected IG Business <code>user_id</code> from
    <code>/me/accounts</code>. For this reviewer demo the resolved
    <code>user_id</code> + access token are entered directly below.
    <div style="margin-top:10px">
      <button id="connect-button" class="connect" data-testid="connect-button" type="button">Continue with Facebook</button>
    </div>
  </div>

  <h3>Step 2 — Connected account credentials</h3>
  <div class="row">
    <div>
      <label for="ig-user-id">IG Business user_id</label>
      <input id="ig-user-id" data-testid="ig-user-id-input" type="text" placeholder="e.g. 17841401234567890" />
    </div>
    <div>
      <label for="ig-token">Access Token (with instagram_business_basic)</label>
      <input id="ig-token" data-testid="ig-token-input" type="text" placeholder="Page-scoped token" />
    </div>
  </div>

  <button id="read-profile-btn" data-testid="read-profile-button" type="button">Read connected profile</button>
  <div class="hint">→ GET /v21.0/{ig-user-id}?fields=id,username,profile_picture_url,followers_count,media_count,name</div>

  <h3>Step 3 — Connected account profile</h3>
  <div data-testid="profile-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting connect…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const profileResult = document.querySelector('[data-testid="profile-result"]');

function tokenSuffix() {
  const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
  return tokenMatch ? '&token=' + tokenMatch[1] : '';
}

function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }

function renderProfile(payload) {
  const p = payload.profile || {};
  const img = p.profilePictureUrl
    ? '<img data-testid="profile-pic" src="' + esc(p.profilePictureUrl) + '" alt="profile" />'
    : '<div style="width:84px;height:84px;border-radius:50%;background:#1e293b;border:2px solid #8b5cf6"></div>';
  const card = '<div class="profile-card" data-testid="profile-card">'
    + img
    + '<div class="profile-meta">'
    + '<div class="profile-username" data-testid="profile-username">@' + esc(p.username || 'unknown') + '</div>'
    + (p.name ? '<div class="profile-name">' + esc(p.name) + '</div>' : '')
    + (p.biography ? '<div class="profile-name" style="margin-top:6px;color:#94a3b8;white-space:pre-line">' + esc(p.biography) + '</div>' : '')
    + '<div class="profile-stats">'
    + '<span><b>' + esc(p.followersCount != null ? p.followersCount : '—') + '</b> followers</span>'
    + '<span><b>' + esc(p.mediaCount != null ? p.mediaCount : '—') + '</b> posts</span>'
    + '<span>ID: ' + esc(p.id || '—') + '</span>'
    + '</div></div></div>';
  return card + '<pre data-testid="profile-raw" style="margin-top:10px">' + esc(JSON.stringify(payload, null, 2).slice(0, 8000)) + '</pre>';
}

$('connect-button').addEventListener('click', () => {
  $('ig-user-id').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('read-profile-btn').addEventListener('click', async () => {
  const igUserId = $('ig-user-id').value.trim();
  const token = $('ig-token').value.trim();
  if (!igUserId || !token) {
    profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ IG user_id + access token required</pre>';
    return;
  }
  const btn = $('read-profile-btn');
  btn.disabled = true;
  profileResult.innerHTML = '<pre class="status-ok">⏳ GET /v21.0/{ig-user-id}?fields=username,account_type,profile_picture_url…</pre>';
  try {
    const url = '/api/role-room/ig-business-basic/profile?igUserId=' + encodeURIComponent(igUserId)
      + '&accessToken=' + encodeURIComponent(token) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      profileResult.innerHTML = renderProfile(data);
    } else {
      profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ Error\\n\\n' + esc(JSON.stringify(data, null, 2)) + '</pre>';
    }
  } catch (err) {
    profileResult.innerHTML = '<pre class="status-err" data-testid="profile-err">✗ Network: ' + esc(err.message) + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
