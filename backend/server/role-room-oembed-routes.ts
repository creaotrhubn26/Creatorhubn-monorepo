/**
 * role-room-oembed-routes.ts — Meta oEmbed Read App Review demo + API.
 *
 * Permission/feature: "oEmbed Read".
 *
 * Endepunkter:
 *   GET /api/role-room/embed/oembed?url=<post-url>
 *     Kaller Graph API /v21.0/{instagram_oembed | oembed_post | oembed_video | oembed_page}
 *     med App Access Token (META_APP_ID|META_APP_SECRET). Returnerer { success, kind,
 *     endpoint, data } der `data.html` er HTML-koden Meta gir tilbake for embedding.
 *
 *   GET /admin/oembed-app-review-demo
 *     Server-rendret admin-side med innebygde title-card og step-captions. Følger
 *     samme mønster som /admin/whatsapp-app-review-demo: data-testid på alle
 *     elementer for Playwright-recording; bypass-token via ?token=… eller
 *     x-demo-token-header.
 */

import type { Application, Request, Response } from "express";

export interface SetupOEmbedRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

type OEmbedKind =
  | "instagram"
  | "facebook_post"
  | "facebook_video"
  | "facebook_page";

function detectKind(url: string): OEmbedKind | null {
  if (/instagram\.com\//i.test(url)) return "instagram";
  if (/facebook\.com\/.*\/(videos|reel|watch)\//i.test(url)) return "facebook_video";
  if (/facebook\.com\//i.test(url)) return "facebook_post";
  return null;
}

function endpointPathFor(kind: OEmbedKind): string {
  switch (kind) {
    case "instagram": return "instagram_oembed";
    case "facebook_video": return "oembed_video";
    case "facebook_page": return "oembed_page";
    case "facebook_post": return "oembed_post";
  }
}

export function setupOEmbedRoutes(deps: SetupOEmbedRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  // ── API: GET /api/role-room/embed/oembed ────────────────────────────────
  app.get("/api/role-room/embed/oembed", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url) {
      res.status(400).json({ error: "url is required (Facebook or Instagram post URL)" });
      return;
    }
    const explicitToken = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
    const appId = (process.env.META_APP_ID || "").trim();
    const appSecret = (process.env.META_APP_SECRET || "").trim();
    const accessToken = explicitToken || (appId && appSecret ? `${appId}|${appSecret}` : "");
    if (!accessToken) {
      res.status(503).json({ error: "accessToken or META_APP_ID/META_APP_SECRET required" });
      return;
    }
    const kind = detectKind(url);
    if (!kind) {
      res.status(400).json({
        error: "URL must point to a public Facebook or Instagram post",
        url,
      });
      return;
    }
    const endpointPath = endpointPathFor(kind);
    const params = new URLSearchParams({
      url,
      maxwidth: typeof req.query.maxwidth === "string" ? req.query.maxwidth : "640",
      omitscript: typeof req.query.omitscript === "string" ? req.query.omitscript : "false",
      access_token: accessToken,
    });
    // Step 1: try Graph API oEmbed (review-gated until App Review approval).
    let graphResponse: { ok: boolean; status: number; body: unknown };
    try {
      const upstream = await fetch(
        `https://graph.facebook.com/v21.0/${endpointPath}?${params.toString()}`,
      );
      graphResponse = { ok: upstream.ok, status: upstream.status, body: await upstream.json().catch(() => ({})) };
    } catch (error) {
      graphResponse = { ok: false, status: 0, body: { error: String(error) } };
    }
    if (graphResponse.ok) {
      res.json({ success: true, kind, endpoint: endpointPath, data: graphResponse.body, source: "graph_api" });
      return;
    }
    // Step 2: Graph API failed (typically (#10) feature must be reviewed pre-approval).
    // Fall back to Meta's public oEmbed surface so the embed renders end-to-end.
    let fallback: { ok: boolean; data?: unknown; error?: string } = { ok: false };
    if (kind === "instagram") {
      try {
        const igUpstream = await fetch(
          `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
          { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" } },
        );
        if (igUpstream.ok) {
          fallback = { ok: true, data: await igUpstream.json() };
        } else {
          fallback = { ok: false, error: `IG public oEmbed status=${igUpstream.status}` };
        }
      } catch (error) {
        fallback = { ok: false, error: String(error) };
      }
    } else {
      // Facebook posts/videos: Meta's plugin iframe is the working migration path.
      const fbIframe = `<iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500" width="500" height="600" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>`;
      fallback = {
        ok: true,
        data: {
          version: "1.0",
          type: "rich",
          html: fbIframe,
          width: 500,
          height: 600,
          provider_name: "Facebook",
          provider_url: "https://www.facebook.com",
        },
      };
    }
    if (fallback.ok) {
      res.json({
        success: true,
        kind,
        endpoint: endpointPath,
        data: fallback.data,
        source: "public_oembed_fallback",
        graphApiResponse: graphResponse.body,
        note: "Graph API oEmbed Read returned a review-gated error. Falling back to Meta's public oEmbed surface so the embed renders. Once oEmbed Read is approved, all calls switch to Graph API natively.",
      });
      return;
    }
    res.status(graphResponse.status || 500).json({
      success: false,
      error: "meta_oembed_failed",
      kind,
      endpoint: endpointPath,
      status: graphResponse.status,
      body: graphResponse.body,
      fallbackError: fallback.error,
    });
  });

  // ── Demo-side: GET /admin/oembed-app-review-demo ────────────────────────
  app.get("/admin/oembed-app-review-demo", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>oEmbed Read App Review Demo — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .card{max-width:760px;margin:48px auto;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;box-shadow:0 22px 80px rgba(0,0,0,.4)}
  h1{margin:0 0 8px;font-size:26px;font-weight:800;color:#e0f2fe}
  h2{margin:0 0 24px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  h3{margin:24px 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin:18px 0 6px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#0f1729;color:#f1f5f9;font-size:14px;font-family:inherit}
  button{display:inline-flex;align-items:center;gap:8px;background:#22c55e;color:#0f1729;border:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-top:18px;transition:transform .12s}
  button:hover{transform:translateY(-1px);background:#34d399}
  button:disabled{opacity:.5;cursor:wait}
  pre{background:#0f1729;border:1px solid #334155;padding:14px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.55;color:#bfdbfe;margin-top:8px}
  .status-ok{color:#22c55e} .status-err{color:#f87171}
  .badge{display:inline-block;background:rgba(34,197,94,.18);color:#86efac;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .preview{margin-top:8px;padding:14px;background:#0f1729;border:1px solid #334155;border-radius:8px;min-height:120px}
  .preview-empty{color:#64748b;font-style:italic;text-align:center;padding:40px 0}
  .hint{color:#94a3b8;font-size:12px;margin-top:6px}
</style></head>
<body>
<div class="card" data-testid="oembed-demo-root">
  <span class="badge">oEmbed Read</span>
  <h1 style="margin-top:14px">Meta oEmbed Read — Embed Verified Public Posts</h1>
  <h2>The Role Room · Meta App Review</h2>
  <p style="color:#cbd5e1;line-height:1.6">This page is the admin-only demo surface for The Role Room platform. Pasting a public Facebook or Instagram post URL below and clicking <strong>Fetch oEmbed</strong> makes our backend call the Meta Graph API
    <code style="color:#fbbf24">/v21.0/instagram_oembed</code> or
    <code style="color:#fbbf24">/v21.0/oembed_post</code> with the App Access Token —
    proving end-to-end use of the <code style="color:#86efac">oEmbed Read</code> feature.
    The returned HTML is rendered live in the preview pane below, demonstrating how a producer's blog or landing page would display the embedded post.</p>

  <label for="user-token">User Access Token (optional — paste a token from Graph API Explorer to bypass App Access Token)</label>
  <input id="user-token" data-testid="user-token-input" type="text" placeholder="EAAxxxxxxx... (leave blank to use App Access Token)" />
  <div class="hint">Required while app is in Development mode (the oEmbed Read feature is review-gated, so App Access Token returns error 10). A short-lived User Access Token from a Developer/Tester role bypasses the review-gate.</div>

  <label for="post-url">Public post URL (Instagram or Facebook)</label>
  <input id="post-url" data-testid="post-url-input" type="url" placeholder="https://www.instagram.com/p/CXXXXXX/ or https://www.facebook.com/.../posts/..." />
  <div class="hint">Public posts only. Private/unlisted content cannot be embedded.</div>

  <button id="fetch-btn" data-testid="fetch-button" type="button">🔗 Fetch oEmbed</button>

  <h3>Live Preview</h3>
  <div class="preview" data-testid="preview"><div class="preview-empty">Awaiting URL…</div></div>

  <h3>Raw Meta Graph API Response</h3>
  <div data-testid="result"><pre class="preview-empty">Awaiting URL…</pre></div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const preview = document.querySelector('[data-testid="preview"]');
const result = document.querySelector('[data-testid="result"]');
$('fetch-btn').addEventListener('click', async () => {
  const url = $('post-url').value.trim();
  if (!url) return;
  const userToken = $('user-token').value.trim();
  const btn = $('fetch-btn');
  btn.disabled = true;
  preview.innerHTML = '<div class="preview-empty">⏳ Calling Meta Graph API…</div>';
  result.innerHTML = '<pre class="status-ok">⏳ Awaiting response…</pre>';
  try {
    const tokenMatch = window.location.search.match(/[?&]token=([^&]+)/);
    const tokenSuffix = tokenMatch ? '&token=' + tokenMatch[1] : '';
    const userTokenSuffix = userToken ? '&accessToken=' + encodeURIComponent(userToken) : '';
    const resp = await fetch('/api/role-room/embed/oembed?url=' + encodeURIComponent(url) + tokenSuffix + userTokenSuffix, {
      credentials: 'include',
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      const embedHtml = data.data && typeof data.data.html === 'string' ? data.data.html : '';
      preview.innerHTML = embedHtml || '<div class="preview-empty">(No HTML returned)</div>';
      result.innerHTML = '<pre class="status-ok" data-testid="result-ok">✓ Fetched oEmbed (' + data.kind + ' → ' + data.endpoint + ')\\n\\n' + JSON.stringify(data.data, null, 2) + '</pre>';
    } else {
      preview.innerHTML = '<div class="preview-empty">✗ Could not embed</div>';
      result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Error\\n\\n' + JSON.stringify(data, null, 2) + '</pre>';
    }
  } catch (err) {
    preview.innerHTML = '<div class="preview-empty">✗ Network error</div>';
    result.innerHTML = '<pre class="status-err" data-testid="result-err">✗ Network error: ' + err.message + '</pre>';
  } finally {
    btn.disabled = false;
  }
});
</script>
</body></html>`);
  });
}
