/**
 * role-room-pages-show-list-routes.ts — Meta `pages_show_list`
 * App Review demo + API.
 *
 * Permission/feature: "pages_show_list" — list the Facebook Pages a person
 * manages, for the account-picker in The Role Room's connect flow.
 *
 * Brukes når et produksjons-team kobler Meta-kontoen sin via Facebook Login:
 * vi kaller /me/accounts og viser lista over Page-er brukeren administrerer,
 * slik at de kan VELGE hvilken produksjons-team-Page (+ tilkoblet IG-Business
 * + ad-konto) som skal kobles til The Role Room. Dette er inngangsporten for
 * alle de andre Page/IG-funksjonene.
 *
 * Endepunkter:
 *   GET /api/role-room/pages-show-list?accessToken=...&userId=...
 *     Kaller /v21.0/me/accounts?fields=id,name,category,tasks,picture{url}
 *     (produksjon: bruker-token). For reviewer-demoen kan en eksplisitt
 *     userId sendes, da kalles /v21.0/{user-id}/accounts med samme felter —
 *     ekvivalent med /me/accounts mot brukerens eget token.
 *
 *   GET /admin/pages-show-list-app-review-demo
 *     Server-rendret admin-side. data-testid for Playwright; bypass via ?token=.
 *
 * Reference: https://developers.facebook.com/docs/graph-api/reference/user/accounts
 */

import type { Application, Request, Response } from "express";

export interface SetupPagesShowListRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const PAGE_FIELDS = "id,name,category,tasks,picture{url}";

function resolveAccessToken(req: Request, fallback?: unknown): string {
  const fromQuery = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  if (fromQuery) return fromQuery;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appId && appSecret) return `${appId}|${appSecret}`;
  return "";
}

export function setupPagesShowListRoutes(deps: SetupPagesShowListRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── GET /api/role-room/pages-show-list ──────────────────────────────────
  app.get("/api/role-room/pages-show-list", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken required (with pages_show_list)" });
      return;
    }
    // Production path is /me/accounts with the user's own token. The optional
    // userId param lets the reviewer demo run /{user-id}/accounts (equivalent).
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const target = userId ? encodeURIComponent(userId) : "me";
    const params = new URLSearchParams({
      fields: PAGE_FIELDS,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${target}/accounts?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_pages_show_list_failed",
          target,
          status: upstream.status,
          response: body,
        });
        return;
      }
      const data = Array.isArray(body.data) ? (body.data as Array<Record<string, unknown>>) : [];
      res.json({
        success: true,
        target,
        pageCount: data.length,
        pages: data.map((p) => ({
          id: p.id ?? null,
          name: p.name ?? null,
          category: p.category ?? null,
          tasks: Array.isArray(p.tasks) ? p.tasks : [],
          pictureUrl:
            p.picture && typeof p.picture === "object"
              ? ((p.picture as Record<string, unknown>).data as Record<string, unknown> | undefined)?.url ?? null
              : null,
        })),
        raw: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "pages_show_list_request_failed",
        detail: String(error),
      });
    }
  });

  // ── GET /admin/pages-show-list-app-review-demo ───────────────────────────
  app.get("/admin/pages-show-list-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>pages_show_list App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:920px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#dbeafe}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:12px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:14px;transition:transform .12s}
  button:hover{transform:translateY(-1px);filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:wait}
  button.connect{background:linear-gradient(135deg,#1877F2,#3b5998)}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#bfdbfe;margin-top:8px;max-height:340px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:linear-gradient(135deg,rgba(37,99,235,.2),rgba(14,165,233,.2));color:#93c5fd;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .step-note{background:#0f1729;border:1px dashed #475569;border-radius:10px;padding:16px;margin-top:14px;color:#cbd5e1;font-size:13px;line-height:1.6}
  .page-card{display:flex;gap:14px;align-items:center;background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:10px;cursor:pointer}
  .page-card:hover{border-color:#2563eb}
  .page-card.selected{border-color:#0ea5e9;box-shadow:0 0 0 2px rgba(14,165,233,.35)}
  .page-card img{width:52px;height:52px;border-radius:10px;object-fit:cover;border:1px solid #334155;background:#1e293b}
  .page-info{flex:1;min-width:0}
  .page-name{color:#dbeafe;font-weight:700;font-size:15px}
  .page-meta{display:flex;gap:12px;font-size:11px;color:#94a3b8;flex-wrap:wrap;margin-top:4px}
  .radio{width:20px;height:20px;border-radius:50%;border:2px solid #475569;flex:0 0 auto}
  .page-card.selected .radio{border-color:#0ea5e9;background:radial-gradient(circle,#0ea5e9 40%,transparent 45%)}
</style></head>
<body>
<div class="card" data-testid="pages-show-list-demo-root">
  <span class="badge">pages_show_list</span>
  <h1 style="margin-top:14px">Account Picker — Choose the Production-Team Page to Connect</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    When a production team connects its Meta account via Facebook Login,
    The Role Room uses <code style="color:#93c5fd">pages_show_list</code> to call
    <code>/me/accounts</code> and present the list of Facebook Pages the person
    manages, so they can <strong>choose which Page</strong> (and its connected
    Instagram Business account + ad account) to link. The user only ever
    connects the Page they explicitly select here.</p>

  <h3>Step 1 — Connect via Facebook Login</h3>
  <div class="step-note">
    In the live product the user clicks <strong>“Continue with Facebook”</strong>
    and grants <code style="color:#93c5fd">pages_show_list</code>. We then call
    <code>GET /me/accounts</code> with the user's token. For this reviewer demo
    the access token (and, for the demo, the user id) are entered directly below.
    <div style="margin-top:10px">
      <button id="connect-button" class="connect" data-testid="connect-button" type="button">Continue with Facebook</button>
    </div>
  </div>

  <h3>Step 2 — Credentials</h3>
  <div class="row">
    <div>
      <label for="access-token">User access token (with pages_show_list)</label>
      <input id="access-token" data-testid="access-token-input" type="text" placeholder="User token" />
    </div>
    <div>
      <label for="user-id">User ID <span style="color:#64748b">(demo only — blank uses /me)</span></label>
      <input id="user-id" data-testid="user-id-input" type="text" placeholder="optional" />
    </div>
  </div>

  <button id="load-pages-btn" data-testid="load-pages-button" type="button">List my Pages</button>
  <div class="hint">→ GET /v21.0/me/accounts?fields=id,name,category,tasks,picture</div>

  <h3>Step 3 — Pages you manage (pick one to connect)</h3>
  <div data-testid="pages-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting connect…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const pagesResult = document.querySelector('[data-testid="pages-result"]');

function tokenSuffix() {
  const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
  return tokenMatch ? '&token=' + tokenMatch[1] : '';
}

function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }

function selectPage(el) {
  document.querySelectorAll('.page-card').forEach((c) => c.classList.remove('selected'));
  el.classList.add('selected');
}

function renderPages(payload) {
  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const header = '<div style="color:#93c5fd;font-size:13px;margin-top:4px"><strong>' + pages.length + '</strong> Pages this user manages</div>';
  const cards = pages.map((p, i) => {
    const img = p.pictureUrl
      ? '<img src="' + esc(p.pictureUrl) + '" alt="" />'
      : '<div style="width:52px;height:52px;border-radius:10px;background:#1e293b;border:1px solid #334155"></div>';
    return '<div class="page-card' + (i === 0 ? ' selected' : '') + '" data-testid="page-card-' + i + '" onclick="selectPage(this)">'
      + img
      + '<div class="page-info">'
      + '<div class="page-name" data-testid="page-name-' + i + '">' + esc(p.name) + '</div>'
      + '<div class="page-meta">'
      + '<span>' + esc(p.category || '—') + '</span>'
      + '<span>ID: ' + esc(p.id) + '</span>'
      + (Array.isArray(p.tasks) && p.tasks.length ? '<span>tasks: ' + esc(p.tasks.join(', ')) + '</span>' : '')
      + '</div></div>'
      + '<div class="radio"></div>'
      + '</div>';
  }).join('');
  return header + (cards || '<div style="color:#64748b;font-style:italic">No Pages</div>')
    + '<pre data-testid="pages-raw" style="margin-top:12px">' + esc(JSON.stringify(payload, null, 2).slice(0, 8000)) + '</pre>';
}

$('connect-button').addEventListener('click', () => {
  $('access-token').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('load-pages-btn').addEventListener('click', async () => {
  const token = $('access-token').value.trim();
  const userId = $('user-id').value.trim();
  if (!token) {
    pagesResult.innerHTML = '<pre class="status-err" data-testid="pages-err">✗ Access token required</pre>';
    return;
  }
  const btn = $('load-pages-btn');
  btn.disabled = true;
  pagesResult.innerHTML = '<pre class="status-ok">⏳ GET /v21.0/me/accounts…</pre>';
  try {
    let url = '/api/role-room/pages-show-list?accessToken=' + encodeURIComponent(token);
    if (userId) url += '&userId=' + encodeURIComponent(userId);
    url += tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      pagesResult.innerHTML = renderPages(data);
    } else {
      pagesResult.innerHTML = '<pre class="status-err" data-testid="pages-err">✗ Error\\n\\n' + esc(JSON.stringify(data, null, 2)) + '</pre>';
    }
  } catch (err) {
    pagesResult.innerHTML = '<pre class="status-err" data-testid="pages-err">✗ Network: ' + esc(err.message) + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
