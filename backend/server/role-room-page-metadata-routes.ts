/**
 * role-room-page-metadata-routes.ts — Meta `Page Public Metadata Access`
 * App Review demo + API.
 *
 * Permission/feature: "Page Public Metadata Access" — read-only access to
 * rich metadata-fields utover de som Page Public Content Access gir
 * (location, hours, founded, mission, contact, price_range, etc.).
 *
 * Brukes av The Role Rooms partner-discovery: casting-direktører finner
 * production-team Pages basert på lokasjon (Oslo/Bergen/Trondheim),
 * åpningstider, oppdragsorientering ("mission"), og kontakt-metoder.
 *
 * Endepunkter:
 *   GET /api/role-room/public-page/metadata?pageId=...[&accessToken=...]
 *     Kaller `GET /v21.0/{pageId}?fields=id,name,founded,mission,products,
 *     location,hours,phone,emails,website,price_range,payment_options,
 *     parking,public_transit,company_overview,general_info,impressum,
 *     single_line_address` med App Access Token (eller eksplisitt token).
 *
 *   GET /admin/page-public-metadata-app-review-demo
 *     Server-rendret admin-side med data-testid for Playwright-recording.
 *     Bypass via ?token=… / x-demo-token-header.
 *
 * Reference: https://developers.facebook.com/docs/graph-api/reference/page
 */

import type { Application, Request, Response } from "express";

export interface SetupPageMetadataRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const RICH_METADATA_FIELDS = [
  "id", "name", "founded", "mission", "products",
  "location", "hours", "phone", "emails", "website",
  "price_range", "payment_options", "parking", "public_transit",
  "company_overview", "general_info", "impressum", "single_line_address",
  "category", "verification_status",
].join(",");

function resolveAccessToken(req: Request): string {
  const explicit = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  if (explicit) return explicit;
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appId && appSecret) return `${appId}|${appSecret}`;
  return "";
}

export function setupPageMetadataRoutes(deps: SetupPageMetadataRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: GET /api/role-room/public-page/metadata ────────────────────────
  app.get("/api/role-room/public-page/metadata", async (req, res) => {
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
      fields: RICH_METADATA_FIELDS,
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
          error: "meta_page_metadata_failed",
          pageId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({ success: true, pageId, metadata: body });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "page_metadata_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: GET /admin/page-public-metadata-app-review-demo ──────────
  app.get("/admin/page-public-metadata-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>Page Public Metadata App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:820px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#dcfce7}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#22c55e;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#34d399}
  button:disabled{opacity:.5;cursor:wait}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#bbf7d0;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(34,197,94,.18);color:#86efac;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px}
  .field-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px}
  .field-key{color:#86efac;font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:6px}
  .field-value{color:#f1f5f9;font-size:13px;line-height:1.4;word-break:break-word}
  .field-empty{color:#64748b;font-style:italic}
</style></head>
<body>
<div class="card" data-testid="page-metadata-demo-root">
  <span class="badge">Page Public Metadata Access</span>
  <h1 style="margin-top:14px">Public Page Metadata — Partner Discovery for Casting</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    Casting directors filter our partner-discovery feed by location, business
    hours, contact channels, and operational details — fields beyond what
    <code style="color:#fbbf24">Page Public Content Access</code> alone exposes.
    The Role Room uses <code style="color:#fbbf24">Page Public Metadata Access</code>
    to read <code style="color:#fbbf24">/v21.0/{page-id}?fields=...</code> with
    a richer field-set (founded, mission, location, hours, payment_options,
    price_range, impressum, ...). All fields read are explicitly marked
    public by the Page owner; no private data leaves Meta.</p>

  <h3>Step 1 — Page ID</h3>
  <label for="page-id">Page ID (production-team Page)</label>
  <input id="page-id" data-testid="page-id-input" type="text" placeholder="e.g. 123456789012345 — Storyline Norway, NRK Drama, etc." />
  <div class="hint">App Access Token (META_APP_ID|META_APP_SECRET) er default. No user token required.</div>

  <button id="fetch-btn" data-testid="fetch-metadata-button" type="button">🏛️ Fetch metadata</button>

  <h3>Step 2 — Public metadata fields</h3>
  <div data-testid="metadata-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting Page ID…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const metadataResult = document.querySelector('[data-testid="metadata-result"]');

function tokenSuffix() {
  const sp = new URLSearchParams(window.location.search);
  const parts = [];
  if (sp.get('token')) parts.push('token=' + encodeURIComponent(sp.get('token')));
  if (sp.get('accessToken')) parts.push('accessToken=' + encodeURIComponent(sp.get('accessToken')));
  return parts.length ? '&' + parts.join('&') : '';
}

function fieldValue(v) {
  if (v === undefined || v === null || v === '') {
    return '<span class="field-empty">(not set publicly)</span>';
  }
  if (typeof v === 'object') {
    return '<pre style="margin:0;padding:8px;font-size:11px;color:#bbf7d0;max-height:120px">' + JSON.stringify(v, null, 2).slice(0, 800).replace(/</g, '&lt;') + '</pre>';
  }
  return String(v).slice(0, 400).replace(/</g, '&lt;');
}

function renderMetadata(metadata) {
  const KEYS = [
    'name', 'category', 'founded', 'mission', 'single_line_address',
    'phone', 'emails', 'website', 'hours', 'price_range', 'payment_options',
    'parking', 'public_transit', 'products', 'company_overview',
    'general_info', 'impressum', 'verification_status',
  ];
  const cards = KEYS.map((k) => {
    return '<div class="field-card" data-testid="field-' + k + '">'
      + '<div class="field-key">' + k.replace(/_/g, ' ') + '</div>'
      + '<div class="field-value">' + fieldValue(metadata[k]) + '</div>'
      + '</div>';
  }).join('');
  return '<div class="field-grid">' + cards + '</div>'
    + '<pre data-testid="metadata-raw" style="margin-top:12px">' + JSON.stringify(metadata, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

$('fetch-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  if (!pageId) {
    metadataResult.innerHTML = '<pre class="status-err" data-testid="metadata-err">✗ Page ID required</pre>';
    return;
  }
  const btn = $('fetch-btn');
  btn.disabled = true;
  metadataResult.innerHTML = '<pre class="status-ok">⏳ Calling Meta Graph /v21.0/{page-id} with richer field-set…</pre>';
  try {
    const url = '/api/role-room/public-page/metadata?pageId=' + encodeURIComponent(pageId) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      metadataResult.innerHTML = renderMetadata(data.metadata);
    } else {
      metadataResult.innerHTML = '<pre class="status-err" data-testid="metadata-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    metadataResult.innerHTML = '<pre class="status-err" data-testid="metadata-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
