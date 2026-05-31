/**
 * role-room-pages-cta-routes.ts — Meta `pages_manage_cta` App Review demo + API.
 *
 * Permission/feature: "pages_manage_cta" — gjør Role Agent i stand til å sette
 * Call-To-Action-knappen på en Facebook Page (BOOK_NOW / CALL_NOW / SIGN_UP / ...).
 *
 * Endepunkter:
 *   POST /api/role-room/page/cta
 *     Body: { pageId, pageAccessToken, ctaType, ctaUrl }
 *     Kaller `POST /{pageId}` med `cta_type` + `cta_link` parametre på Graph API.
 *     Returnerer { success, pageId, ctaType, ctaUrl, response } eller error.
 *
 *   GET /api/role-room/page/cta?pageId=...&pageAccessToken=...
 *     Verifiserer at CTA-en er satt ved å lese `cta_type` + `cta_link` felter
 *     fra page-objektet. Returnerer { success, pageId, currentCta }.
 *
 *   GET /admin/pages-manage-cta-app-review-demo
 *     Server-rendret admin-side. data-testid på alle elementer for Playwright-
 *     recording; bypass-token via ?token=… eller x-demo-token-header.
 *
 * Reference: https://developers.facebook.com/docs/graph-api/reference/page
 */

import type { Application, Request, Response } from "express";

export interface SetupPagesCtaRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const CTA_TYPES = [
  "BOOK_NOW", "CALL_NOW", "CONTACT_US", "DONATE", "DONATE_NOW", "EMAIL",
  "GET_DIRECTIONS", "GET_QUOTE", "LEARN_MORE", "LISTEN_NOW", "MESSAGE_PAGE",
  "OPEN_LINK", "ORDER_FOOD", "PLAY_MUSIC", "REQUEST_TIME", "SAVE", "SEE_MENU",
  "SHOP_NOW", "SIGN_UP", "USE_APP", "WATCH_NOW", "WATCH_VIDEO",
] as const;

type CtaType = (typeof CTA_TYPES)[number];

function isValidCtaType(value: unknown): value is CtaType {
  return typeof value === "string" && (CTA_TYPES as readonly string[]).includes(value);
}

export function setupPagesCtaRoutes(deps: SetupPagesCtaRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: POST /api/role-room/page/cta — sett CTA på Page ────────────────
  app.post("/api/role-room/page/cta", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const pageAccessToken = typeof body.pageAccessToken === "string" ? body.pageAccessToken.trim() : "";
    const ctaType = body.ctaType;
    const ctaUrl = typeof body.ctaUrl === "string" ? body.ctaUrl.trim() : "";

    if (!pageId) {
      res.status(400).json({ error: "pageId is required" });
      return;
    }
    if (!pageAccessToken) {
      res.status(400).json({ error: "pageAccessToken is required (Page-scoped token, not user token)" });
      return;
    }
    if (!isValidCtaType(ctaType)) {
      res.status(400).json({ error: "Invalid ctaType", validValues: CTA_TYPES });
      return;
    }
    if (!ctaUrl) {
      res.status(400).json({ error: "ctaUrl is required (target link for the CTA button)" });
      return;
    }

    const params = new URLSearchParams({
      cta_type: ctaType,
      cta_link: ctaUrl,
      access_token: pageAccessToken,
    });

    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}`,
        {
          method: "POST",
          body: params,
        },
      );
      const responseBody = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_set_cta_failed",
          pageId,
          ctaType,
          ctaUrl,
          status: upstream.status,
          response: responseBody,
        });
        return;
      }
      res.json({
        success: true,
        pageId,
        ctaType,
        ctaUrl,
        response: responseBody,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "set_cta_request_failed",
        detail: String(error),
      });
    }
  });

  // ── API: GET /api/role-room/page/cta — verifiser CTA på Page ────────────
  app.get("/api/role-room/page/cta", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const pageId = typeof req.query.pageId === "string" ? req.query.pageId.trim() : "";
    const pageAccessToken = typeof req.query.pageAccessToken === "string"
      ? req.query.pageAccessToken.trim()
      : "";
    if (!pageId) {
      res.status(400).json({ error: "pageId is required" });
      return;
    }
    if (!pageAccessToken) {
      res.status(400).json({ error: "pageAccessToken is required" });
      return;
    }

    const params = new URLSearchParams({
      fields: "id,name,cta_type,cta_link",
      access_token: pageAccessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?${params.toString()}`,
      );
      const responseBody = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_get_page_failed",
          status: upstream.status,
          response: responseBody,
        });
        return;
      }
      res.json({
        success: true,
        pageId,
        currentCta: {
          type: (responseBody as Record<string, unknown>).cta_type ?? null,
          link: (responseBody as Record<string, unknown>).cta_link ?? null,
        },
        pageName: (responseBody as Record<string, unknown>).name ?? null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "get_cta_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: GET /admin/pages-manage-cta-app-review-demo ──────────────
  app.get("/admin/pages-manage-cta-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>pages_manage_cta App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:820px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#e0f2fe}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input,select{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#22c55e;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#34d399}
  button:disabled{opacity:.5;cursor:wait}
  button.secondary{background:#475569;color:#f1f5f9}
  button.secondary:hover{background:#64748b}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#bfdbfe;margin-top:8px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(168,85,247,.18);color:#c4b5fd;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .step-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
</style></head>
<body>
<div class="card" data-testid="cta-demo-root">
  <span class="badge">pages_manage_cta</span>
  <h1 style="margin-top:14px">Meta Pages Manage CTA — Set Role Agent Call-To-Action</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    The Role Agent — our automated production-team assistant — uses
    <code style="color:#fbbf24">pages_manage_cta</code> to set a Facebook Page's CTA button
    on behalf of a casting director, e.g. switching from
    <strong>BOOK_NOW</strong> (pointing to the production's audition signup)
    to <strong>SHOP_NOW</strong> (pointing to the merch shop) when a
    production wraps. This page demonstrates the full
    <strong>POST /{page-id}</strong> + verification flow against the Graph API
    at <code style="color:#fbbf24">/v21.0/{page-id}</code>.</p>

  <h3>Step 1 — Page-scoped token + Page ID</h3>
  <div class="step-row">
    <div>
      <label for="page-id">Page ID</label>
      <input id="page-id" data-testid="page-id-input" type="text" placeholder="e.g. 123456789012345" />
    </div>
    <div>
      <label for="page-token">Page Access Token</label>
      <input id="page-token" data-testid="page-token-input" type="text" placeholder="Page-scoped token" />
    </div>
  </div>
  <div class="hint">Token must be Page-scoped (from /me/accounts), not a User token. Permission required: pages_manage_cta.</div>

  <h3>Step 2 — Pick a CTA type and target URL</h3>
  <div class="step-row">
    <div>
      <label for="cta-type">CTA type</label>
      <select id="cta-type" data-testid="cta-type-select">
        ${CTA_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
      </select>
    </div>
    <div>
      <label for="cta-url">CTA target URL</label>
      <input id="cta-url" data-testid="cta-url-input" type="url" placeholder="https://theroleroom.com/audition/..." />
    </div>
  </div>

  <button id="set-btn" data-testid="set-cta-button" type="button">⚙ Set CTA on Page</button>
  <button id="verify-btn" data-testid="verify-cta-button" type="button" class="secondary">🔍 Verify current CTA</button>

  <h3>Step 3 — Graph API response</h3>
  <div data-testid="result"><pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting action…</pre></div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const result = document.querySelector('[data-testid="result"]');

function tokenSuffix() {
  const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
  return tokenMatch ? '&token=' + tokenMatch[1] : '';
}

$('set-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  const pageAccessToken = $('page-token').value.trim();
  const ctaType = $('cta-type').value;
  const ctaUrl = $('cta-url').value.trim();
  if (!pageId || !pageAccessToken || !ctaType || !ctaUrl) {
    result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Missing required field</pre>';
    return;
  }
  const btn = $('set-btn');
  btn.disabled = true;
  result.innerHTML = '<pre class="status-ok">⏳ Calling Meta Graph API…</pre>';
  try {
    const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
    const url = '/api/role-room/page/cta' + (tokenMatch ? '?token=' + tokenMatch[1] : '');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pageId, pageAccessToken, ctaType, ctaUrl }),
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      result.innerHTML = '<pre class="status-ok" data-testid="result-ok">✓ CTA set: ' + data.ctaType + ' → ' + data.ctaUrl + '\\n\\n' + JSON.stringify(data.response, null, 2) + '</pre>';
    } else {
      result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

$('verify-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  const pageAccessToken = $('page-token').value.trim();
  if (!pageId || !pageAccessToken) {
    result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Page ID + access token required for verification</pre>';
    return;
  }
  const btn = $('verify-btn');
  btn.disabled = true;
  result.innerHTML = '<pre class="status-ok">⏳ Reading current CTA from Page…</pre>';
  try {
    const url = '/api/role-room/page/cta?pageId=' + encodeURIComponent(pageId)
      + '&pageAccessToken=' + encodeURIComponent(pageAccessToken)
      + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      const cta = data.currentCta || {};
      result.innerHTML = '<pre class="status-ok" data-testid="result-verify-ok">✓ Page "' + (data.pageName || '?') + '"\\nCurrent CTA: ' + (cta.type || '(none)') + '\\nLink: ' + (cta.link || '(none)') + '\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    } else {
      result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
