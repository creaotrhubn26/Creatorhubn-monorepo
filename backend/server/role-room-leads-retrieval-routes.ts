/**
 * role-room-leads-retrieval-routes.ts — Meta `leads_retrieval` App Review
 * demo + API.
 *
 * Permission/feature: "leads_retrieval" — read Lead Ads form-submissions
 * fra Facebook Pages. The Role Room ingester casting-call-leads automatisk
 * fra Lead Ads-kampanjer ("Be on TV — sign up!", "Talent open call",
 * etc.) inn i casting-pipeline'en, så casting-direktører slipper å
 * polle Meta Business Suite manuelt.
 *
 * Endepunkter:
 *   GET /api/role-room/leads/forms?pageId=...&pageAccessToken=...
 *     Kaller /v21.0/{page-id}/leadgen_forms?fields=id,name,status,
 *     created_time,leads_count,questions
 *
 *   GET /api/role-room/leads/from-form?formId=...&pageAccessToken=...
 *     Kaller /v21.0/{form-id}/leads?fields=id,created_time,ad_id,form_id,
 *     field_data
 *
 *   GET /admin/leads-retrieval-app-review-demo
 *     Server-rendret admin-side. data-testid for Playwright; bypass via ?token=.
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */

import type { Application, Request, Response } from "express";

export interface SetupLeadsRetrievalRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const FORM_FIELDS = "id,name,status,created_time,leads_count,questions{key,label,type},page";
const LEAD_FIELDS = "id,created_time,ad_id,ad_name,adset_id,campaign_id,form_id,field_data,is_organic,platform";

export function setupLeadsRetrievalRoutes(deps: SetupLeadsRetrievalRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: GET /api/role-room/leads/forms ─────────────────────────────────
  app.get("/api/role-room/leads/forms", async (req, res) => {
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
      res.status(400).json({ error: "pageAccessToken is required (Page-scoped token with leads_retrieval)" });
      return;
    }
    const params = new URLSearchParams({
      fields: FORM_FIELDS,
      access_token: pageAccessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/leadgen_forms?${params.toString()}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_leadgen_forms_failed",
          pageId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        pageId,
        formCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        forms: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "leadgen_forms_request_failed",
        detail: String(error),
      });
    }
  });

  // ── API: GET /api/role-room/leads/from-form ─────────────────────────────
  app.get("/api/role-room/leads/from-form", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const formId = typeof req.query.formId === "string" ? req.query.formId.trim() : "";
    const pageAccessToken = typeof req.query.pageAccessToken === "string"
      ? req.query.pageAccessToken.trim()
      : "";
    if (!formId) {
      res.status(400).json({ error: "formId is required" });
      return;
    }
    if (!pageAccessToken) {
      res.status(400).json({ error: "pageAccessToken is required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "25";
    const params = new URLSearchParams({
      fields: LEAD_FIELDS,
      limit,
      access_token: pageAccessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(formId)}/leads?${params.toString()}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_form_leads_failed",
          formId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        formId,
        leadCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        leads: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "form_leads_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side: GET /admin/leads-retrieval-app-review-demo ───────────────
  app.get("/admin/leads-retrieval-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>leads_retrieval App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:920px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#cffafe}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#06b6d4;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#22d3ee}
  button:disabled{opacity:.5;cursor:wait}
  button.secondary{background:#475569;color:#f1f5f9}
  button.tiny{padding:6px 12px;margin:0;font-size:12px;background:#06b6d4;color:#0f1729}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#a5f3fc;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(6,182,212,.18);color:#67e8f9;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .form-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .form-info{flex:1;min-width:0}
  .form-name{color:#67e8f9;font-weight:700;font-size:14px;margin-bottom:4px}
  .form-meta{display:flex;gap:12px;font-size:11px;color:#94a3b8;flex-wrap:wrap}
  .form-status{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase}
  .form-status.active{background:rgba(34,197,94,.18);color:#86efac}
  .form-status.archived,.form-status.paused{background:rgba(148,163,184,.18);color:#cbd5e1}
  .lead-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:8px;font-size:13px}
  .lead-meta{display:flex;gap:12px;font-size:11px;color:#94a3b8;margin-bottom:8px;flex-wrap:wrap}
  .lead-field{display:grid;grid-template-columns:140px 1fr;gap:8px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,.08);font-size:12px}
  .lead-field strong{color:#67e8f9}
</style></head>
<body>
<div class="card" data-testid="leads-retrieval-demo-root">
  <span class="badge">leads_retrieval</span>
  <h1 style="margin-top:14px">Lead Ads Retrieval — Ingest Casting-Call Sign-Ups</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    Production teams run Lead Ads on Facebook with calls-to-action like
    <strong>"Be on TV — sign up for the casting!"</strong> or
    <strong>"Talent open call"</strong>. The Role Room uses
    <code style="color:#fbbf24">leads_retrieval</code> against the
    Graph API to ingest those leads automatically into the casting
    pipeline — saving casting directors hours of manual export/import
    from Meta Business Suite, and ensuring no candidate falls through
    the cracks. Flow: <strong>(1) List lead-gen forms on the Page,
    (2) pull the latest leads per form</strong>. Both calls require a
    Page-scoped token with <code style="color:#fbbf24">leads_retrieval</code>.</p>

  <h3>Step 1 — Page-scoped token + Page ID</h3>
  <div class="row">
    <div>
      <label for="page-id">Page ID</label>
      <input id="page-id" data-testid="page-id-input" type="text" placeholder="e.g. 123456789012345" />
    </div>
    <div>
      <label for="page-token">Page Access Token (with leads_retrieval)</label>
      <input id="page-token" data-testid="page-token-input" type="text" placeholder="Page-scoped token" />
    </div>
  </div>
  <div class="hint">Token må være Page-scoped (fra /me/accounts) og ha leads_retrieval-permission. Page admin må explisitt godkjenne.</div>

  <button id="list-forms-btn" data-testid="list-forms-button" type="button">📋 List lead-gen forms</button>

  <h3>Step 2 — Forms on this Page</h3>
  <div data-testid="forms-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting Page credentials…</pre>
  </div>

  <h3>Step 3 — Leads from selected form</h3>
  <div data-testid="leads-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Click "Pull leads" on a form above…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const formsResult = document.querySelector('[data-testid="forms-result"]');
const leadsResult = document.querySelector('[data-testid="leads-result"]');

function tokenSuffix() {
  const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
  return tokenMatch ? '&token=' + tokenMatch[1] : '';
}

function renderForms(payload) {
  const data = (payload.forms && Array.isArray(payload.forms.data)) ? payload.forms.data : [];
  const header = '<div style="color:#67e8f9;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> lead-gen forms on Page ' + payload.pageId + '</div>';
  const cards = data.slice(0, 20).map((f, i) => {
    const status = (f.status || 'unknown').toLowerCase();
    return '<div class="form-card" data-testid="form-card">'
      + '<div class="form-info">'
      + '<div class="form-name">' + (f.name || '(no name)').replace(/</g, '&lt;') + '</div>'
      + '<div class="form-meta">'
      + '<span class="form-status ' + status + '">' + (f.status || '?') + '</span>'
      + '<span>📅 ' + (f.created_time || '?') + '</span>'
      + '<span>📊 ' + (f.leads_count || 0) + ' leads</span>'
      + '<span>ID: ' + f.id + '</span>'
      + '</div></div>'
      + '<button class="tiny" data-testid="pull-leads-' + i + '" onclick="pullLeads(\\'' + f.id + '\\', \\'' + ((f.name || '').replace(/'/g, '').slice(0, 40)) + '\\')">⬇ Pull leads</button>'
      + '</div>';
  }).join('');
  return header + (cards || '<div style="color:#64748b;font-style:italic">No forms on this Page</div>') + '<pre data-testid="forms-raw" style="margin-top:10px">' + JSON.stringify(payload, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

function renderLeads(payload, formName) {
  const data = (payload.leads && Array.isArray(payload.leads.data)) ? payload.leads.data : [];
  const header = '<div style="color:#67e8f9;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> leads from form <em>' + (formName || payload.formId) + '</em></div>';
  const cards = data.slice(0, 20).map((l) => {
    const fields = (l.field_data && Array.isArray(l.field_data)) ? l.field_data : [];
    const fieldRows = fields.map((f) => {
      const name = (f.name || '').replace(/</g, '&lt;');
      const values = (f.values || []).map((v) => String(v).replace(/</g, '&lt;')).join(', ');
      return '<div class="lead-field"><strong>' + name + '</strong><span>' + values + '</span></div>';
    }).join('');
    return '<div class="lead-card" data-testid="lead-card">'
      + '<div class="lead-meta">'
      + '<span>📅 ' + (l.created_time || '?') + '</span>'
      + '<span>🔖 ' + (l.platform || '?') + '</span>'
      + (l.ad_name ? '<span>Ad: ' + l.ad_name.replace(/</g, '&lt;') + '</span>' : '')
      + '<span>Lead ID: ' + l.id + '</span>'
      + '</div>'
      + fieldRows
      + '</div>';
  }).join('');
  return header + (cards || '<div style="color:#64748b;font-style:italic">No leads in this form yet</div>') + '<pre data-testid="leads-raw" style="margin-top:10px">' + JSON.stringify(payload, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

$('list-forms-btn').addEventListener('click', async () => {
  const pageId = $('page-id').value.trim();
  const pageAccessToken = $('page-token').value.trim();
  if (!pageId || !pageAccessToken) {
    formsResult.innerHTML = '<pre class="status-err" data-testid="forms-err">✗ Page ID + access token required</pre>';
    return;
  }
  const btn = $('list-forms-btn');
  btn.disabled = true;
  formsResult.innerHTML = '<pre class="status-ok">⏳ /v21.0/{page-id}/leadgen_forms…</pre>';
  try {
    const url = '/api/role-room/leads/forms?pageId=' + encodeURIComponent(pageId)
      + '&pageAccessToken=' + encodeURIComponent(pageAccessToken) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      formsResult.innerHTML = renderForms(data);
    } else {
      formsResult.innerHTML = '<pre class="status-err" data-testid="forms-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    formsResult.innerHTML = '<pre class="status-err" data-testid="forms-err">✗ Network: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

async function pullLeads(formId, formName) {
  const pageAccessToken = $('page-token').value.trim();
  if (!pageAccessToken) {
    leadsResult.innerHTML = '<pre class="status-err" data-testid="leads-err">✗ Page access token required</pre>';
    return;
  }
  leadsResult.innerHTML = '<pre class="status-ok">⏳ /v21.0/{form-id}/leads for form ' + formId + '…</pre>';
  try {
    const url = '/api/role-room/leads/from-form?formId=' + encodeURIComponent(formId)
      + '&pageAccessToken=' + encodeURIComponent(pageAccessToken)
      + '&limit=25' + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      leadsResult.innerHTML = renderLeads(data, formName);
    } else {
      leadsResult.innerHTML = '<pre class="status-err" data-testid="leads-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    leadsResult.innerHTML = '<pre class="status-err" data-testid="leads-err">✗ Network: ' + err.message + '</pre>';
  }
}
// Eksponer pullLeads globalt så inline onclick fungerer.
window.pullLeads = pullLeads;
</script>
</body></html>`);
  });
}
