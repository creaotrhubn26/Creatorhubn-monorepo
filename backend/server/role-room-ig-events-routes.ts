/**
 * role-room-ig-events-routes.ts — Meta `instagram_manage_events`
 * App Review demo + API.
 *
 * Permission/feature: "instagram_manage_events" — create / read / update /
 * delete Instagram events on a connected IG Business account.
 *
 * Brukes av The Role Room for å publisere casting-events (open auditions,
 * audition days, info-sesjoner, premiere-screenings) som IG-events synlig
 * for produksjons-team Page's følgere — slik at talenter kan RSVP eller
 * markere "interested" direkte i Instagram.
 *
 * Endepunkter:
 *   GET    /api/role-room/ig-events?igUserId=...&accessToken=...
 *     Kaller /v21.0/{ig-user-id}/events?fields=id,name,start_time,end_time,
 *     description,place
 *
 *   POST   /api/role-room/ig-events
 *     Body: { igUserId, accessToken, name, startTime, endTime?, description?,
 *             placeName? }
 *     Kaller /v21.0/{ig-user-id}/events med samme felter.
 *
 *   DELETE /api/role-room/ig-events/:eventId?accessToken=...
 *     Kaller DELETE /v21.0/{event-id}.
 *
 *   GET /admin/instagram-manage-events-app-review-demo
 *     Server-rendret admin-side. data-testid for Playwright; bypass via ?token=.
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/reference/ig-user
 */

import type { Application, Request, Response } from "express";

export interface SetupIgEventsRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const EVENT_FIELDS = "id,title,start_time,end_time,description,venue";

function resolveAccessToken(req: Request, fallback?: unknown): string {
  const fromQuery = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  if (fromQuery) return fromQuery;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (appId && appSecret) return `${appId}|${appSecret}`;
  return "";
}

export function setupIgEventsRoutes(deps: SetupIgEventsRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── GET /api/role-room/ig-events ────────────────────────────────────────
  app.get("/api/role-room/ig-events", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const igUserId = typeof req.query.igUserId === "string" ? req.query.igUserId.trim() : "";
    if (!igUserId) {
      res.status(400).json({ error: "igUserId is required" });
      return;
    }
    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken required (with instagram_manage_events)" });
      return;
    }
    const params = new URLSearchParams({
      fields: EVENT_FIELDS,
      access_token: accessToken,
    });
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/upcoming_events?${params.toString()}`,
      );
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_events_list_failed",
          igUserId,
          status: upstream.status,
          response: body,
        });
        return;
      }
      res.json({
        success: true,
        igUserId,
        eventCount: Array.isArray((body as Record<string, unknown>).data)
          ? ((body as Record<string, unknown>).data as unknown[]).length
          : 0,
        events: body,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_events_list_request_failed",
        detail: String(error),
      });
    }
  });

  // ── POST /api/role-room/ig-events ───────────────────────────────────────
  app.post("/api/role-room/ig-events", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const igUserId = typeof body.igUserId === "string" ? body.igUserId.trim() : "";
    if (!igUserId) {
      res.status(400).json({ error: "igUserId is required" });
      return;
    }
    const accessToken = resolveAccessToken(req, body.accessToken);
    if (!accessToken) {
      res.status(503).json({ error: "accessToken required (with instagram_manage_events)" });
      return;
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!startTime) {
      res.status(400).json({ error: "startTime is required (ISO 8601 or Unix timestamp)" });
      return;
    }
    // Meta v21 upcoming_events requires Unix epoch seconds for start_time/end_time.
    // Accept ISO 8601 as input for ergonomics and convert.
    const toUnix = (s: string): string => {
      if (/^\d+$/.test(s)) return s;
      const ms = Date.parse(s);
      return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : s;
    };
    const form = new URLSearchParams({
      title: name,
      start_time: toUnix(startTime),
      access_token: accessToken,
    });
    if (typeof body.endTime === "string" && body.endTime.trim()) {
      form.set("end_time", toUnix(body.endTime.trim()));
    }
    if (typeof body.description === "string" && body.description.trim()) {
      form.set("description", body.description.trim());
    }
    if (typeof body.placeName === "string" && body.placeName.trim()) {
      form.set("venue_name", body.placeName.trim());
    }
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/upcoming_events`,
        {
          method: "POST",
          body: form,
        },
      );
      const responseBody = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_events_create_failed",
          igUserId,
          status: upstream.status,
          response: responseBody,
          requestedFields: { name, startTime, endTime: body.endTime, placeName: body.placeName },
        });
        return;
      }
      res.json({
        success: true,
        igUserId,
        createdEvent: responseBody,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_events_create_request_failed",
        detail: String(error),
      });
    }
  });

  // ── DELETE /api/role-room/ig-events/:eventId ────────────────────────────
  app.delete("/api/role-room/ig-events/:eventId", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const eventId = req.params.eventId.trim();
    const accessToken = resolveAccessToken(req);
    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }
    if (!accessToken) {
      res.status(503).json({ error: "accessToken required" });
      return;
    }
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(eventId)}?access_token=${encodeURIComponent(accessToken)}`,
        { method: "DELETE" },
      );
      const responseBody = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({
          success: false,
          error: "meta_ig_events_delete_failed",
          eventId,
          status: upstream.status,
          response: responseBody,
        });
        return;
      }
      res.json({ success: true, eventId, response: responseBody });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "ig_events_delete_request_failed",
        detail: String(error),
      });
    }
  });

  // ── Demo-side ───────────────────────────────────────────────────────────
  app.get("/admin/instagram-manage-events-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>instagram_manage_events App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:920px;margin:32px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#fef9c3}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:12px 0 6px}
  input,textarea{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  textarea{min-height:70px;resize:vertical}
  button{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f59e0b,#ec4899);color:#fff;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:14px;transition:transform .12s}
  button:hover{transform:translateY(-1px);filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:wait}
  button.secondary{background:#475569;color:#f1f5f9}
  button.tiny{padding:6px 12px;margin:0;font-size:11px;background:#f87171;color:#0f1729}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#fde68a;margin-top:8px;max-height:380px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(236,72,153,.2));color:#fbbf24;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
  .event-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:8px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  .event-info{flex:1;min-width:0}
  .event-name{color:#fbbf24;font-weight:700;font-size:14px;margin-bottom:6px}
  .event-meta{display:flex;gap:12px;font-size:11px;color:#94a3b8;flex-wrap:wrap;margin-top:4px}
  .form-card{background:#0f1729;border:1px solid #334155;border-radius:10px;padding:16px;margin-top:14px}
</style></head>
<body>
<div class="card" data-testid="ig-events-demo-root">
  <span class="badge">instagram_manage_events</span>
  <h1 style="margin-top:14px">Instagram Events — Publish Casting Events to IG Followers</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform.
    Production teams schedule open auditions, audition days, info-sessions,
    and premiere screenings. The Role Room uses
    <code style="color:#fbbf24">instagram_manage_events</code> to surface
    those casting-events as IG-events so a production team's followers can
    RSVP or mark "interested" directly in Instagram — without going via
    a separate signup landing page. We <strong>list, create, and delete</strong>
    events for connected IG Business accounts that have granted the
    permission explicitly.</p>

  <h3>Setup — IG Business user_id + access token</h3>
  <div class="row">
    <div>
      <label for="ig-user-id">IG Business user_id</label>
      <input id="ig-user-id" data-testid="ig-user-id-input" type="text" placeholder="e.g. 17841401234567890" />
    </div>
    <div>
      <label for="ig-token">Access Token (with instagram_manage_events)</label>
      <input id="ig-token" data-testid="ig-token-input" type="text" placeholder="Page-scoped token" />
    </div>
  </div>

  <button id="list-events-btn" data-testid="list-events-button" type="button">📅 List events</button>

  <h3>Step 2 — Existing events</h3>
  <div data-testid="events-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting setup…</pre>
  </div>

  <h3>Step 3 — Create new casting event</h3>
  <div class="form-card">
    <label for="event-name">Event name</label>
    <input id="event-name" data-testid="event-name-input" type="text" placeholder="Open Casting Call — Lead Role for Nordlys" />

    <div class="row">
      <div>
        <label for="event-start">Start time (ISO 8601)</label>
        <input id="event-start" data-testid="event-start-input" type="datetime-local" />
      </div>
      <div>
        <label for="event-end">End time (optional)</label>
        <input id="event-end" data-testid="event-end-input" type="datetime-local" />
      </div>
    </div>

    <label for="event-place">Place (location name)</label>
    <input id="event-place" data-testid="event-place-input" type="text" placeholder="e.g. Filmens Hus, Oslo" />

    <label for="event-desc">Description</label>
    <textarea id="event-desc" data-testid="event-desc-input" placeholder="Bring 1 monologue + headshot. Casting director on site. Walk-ins welcome."></textarea>

    <button id="create-event-btn" data-testid="create-event-button" type="button">➕ Create event</button>
  </div>

  <h3>Step 4 — Create-response</h3>
  <div data-testid="create-result">
    <pre class="preview-empty" style="color:#64748b;font-style:italic;">Awaiting create…</pre>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const eventsResult = document.querySelector('[data-testid="events-result"]');
const createResult = document.querySelector('[data-testid="create-result"]');

function tokenSuffix() {
  const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
  return tokenMatch ? '&token=' + tokenMatch[1] : '';
}

function renderEvents(payload) {
  const data = (payload.events && Array.isArray(payload.events.data)) ? payload.events.data : [];
  const header = '<div style="color:#fbbf24;font-size:13px;margin-top:8px"><strong>' + data.length + '</strong> events on IG account ' + payload.igUserId + '</div>';
  const cards = data.slice(0, 20).map((e, i) => {
    const placeName = (e.place && e.place.name) || '(no place)';
    return '<div class="event-card" data-testid="event-card">'
      + '<div class="event-info">'
      + '<div class="event-name">' + (e.name || '(no name)').replace(/</g, '&lt;') + '</div>'
      + '<div class="event-meta">'
      + '<span>📅 ' + (e.start_time || '?') + '</span>'
      + (e.end_time ? '<span>→ ' + e.end_time + '</span>' : '')
      + '<span>📍 ' + placeName.replace(/</g, '&lt;') + '</span>'
      + '<span>👥 ' + (e.attending_count || 0) + ' attending</span>'
      + '<span>⭐ ' + (e.interested_count || 0) + ' interested</span>'
      + '<span>ID: ' + e.id + '</span>'
      + '</div></div>'
      + '<button class="tiny" data-testid="delete-event-' + i + '" onclick="deleteEvent(\\'' + e.id + '\\')">🗑 Delete</button>'
      + '</div>';
  }).join('');
  return header + (cards || '<div style="color:#64748b;font-style:italic">No events yet</div>') + '<pre data-testid="events-raw" style="margin-top:10px">' + JSON.stringify(payload, null, 2).slice(0, 8000).replace(/</g, '&lt;') + '</pre>';
}

$('list-events-btn').addEventListener('click', async () => {
  const igUserId = $('ig-user-id').value.trim();
  const token = $('ig-token').value.trim();
  if (!igUserId || !token) {
    eventsResult.innerHTML = '<pre class="status-err" data-testid="events-err">✗ IG user_id + access token required</pre>';
    return;
  }
  const btn = $('list-events-btn');
  btn.disabled = true;
  eventsResult.innerHTML = '<pre class="status-ok">⏳ /v21.0/{ig-user-id}/events…</pre>';
  try {
    const url = '/api/role-room/ig-events?igUserId=' + encodeURIComponent(igUserId)
      + '&accessToken=' + encodeURIComponent(token) + tokenSuffix();
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      eventsResult.innerHTML = renderEvents(data);
    } else {
      eventsResult.innerHTML = '<pre class="status-err" data-testid="events-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    eventsResult.innerHTML = '<pre class="status-err" data-testid="events-err">✗ Network: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

$('create-event-btn').addEventListener('click', async () => {
  const igUserId = $('ig-user-id').value.trim();
  const token = $('ig-token').value.trim();
  const name = $('event-name').value.trim();
  const startLocal = $('event-start').value.trim();
  const endLocal = $('event-end').value.trim();
  const placeName = $('event-place').value.trim();
  const description = $('event-desc').value.trim();
  if (!igUserId || !token || !name || !startLocal) {
    createResult.innerHTML = '<pre class="status-err" data-testid="create-err">✗ IG user_id + token + name + start time required</pre>';
    return;
  }
  const btn = $('create-event-btn');
  btn.disabled = true;
  createResult.innerHTML = '<pre class="status-ok">⏳ POST /v21.0/{ig-user-id}/events…</pre>';
  try {
    const urlBase = '/api/role-room/ig-events';
    const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
    const url = urlBase + (tokenMatch ? '?token=' + tokenMatch[1] : '');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        igUserId,
        accessToken: token,
        name,
        startTime: new Date(startLocal).toISOString(),
        endTime: endLocal ? new Date(endLocal).toISOString() : undefined,
        placeName: placeName || undefined,
        description: description || undefined,
      }),
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      createResult.innerHTML = '<pre class="status-ok" data-testid="create-ok">✓ Event created\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
      // Re-list to show the new one
      $('list-events-btn').click();
    } else {
      createResult.innerHTML = '<pre class="status-err" data-testid="create-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    createResult.innerHTML = '<pre class="status-err" data-testid="create-err">✗ Network: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});

async function deleteEvent(eventId) {
  const token = $('ig-token').value.trim();
  if (!token) {
    createResult.innerHTML = '<pre class="status-err" data-testid="create-err">✗ Access token required for delete</pre>';
    return;
  }
  if (!confirm('Delete event ' + eventId + '?')) return;
  try {
    const url = '/api/role-room/ig-events/' + encodeURIComponent(eventId)
      + '?accessToken=' + encodeURIComponent(token) + tokenSuffix();
    const resp = await fetch(url, { method: 'DELETE', credentials: 'include' });
    const data = await resp.json();
    if (resp.ok && data.success) {
      createResult.innerHTML = '<pre class="status-ok" data-testid="delete-ok">✓ Event deleted\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
      $('list-events-btn').click();
    } else {
      createResult.innerHTML = '<pre class="status-err" data-testid="delete-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    createResult.innerHTML = '<pre class="status-err" data-testid="delete-err">✗ Network: ' + err.message + '</pre>';
  }
}
window.deleteEvent = deleteEvent;
</script>
</body></html>`);
  });
}
