/**
 * role-room-meta-review-index-routes.ts — index/landing-side for hele
 * Meta App Review demo-bunken.
 *
 * Server-rendret HTML som lister alle 8 (+ WhatsApp) demo-flater med:
 *   - Permission/feature-navn
 *   - Use-case-snippet
 *   - Status (forventet HTTP-code: 200 hvis OK, 401 hvis bypass-token mangler)
 *   - Demo-URL (link)
 *   - Runbook-path
 *   - Recording-script-kommando
 *
 * Brukes som:
 *   • Reviewer-landing: én URL Daniel kan paste inn i Meta App Review
 *     submission'en — reviewer ser hele bunken på ett sted.
 *   • Internt: recording-koreograf når Daniel skal spille inn alle 9
 *     screencasts sekvensielt.
 *
 *   GET /admin/meta-app-review-index?token=<DEMO_TOKEN>
 */

import type { Application, Request, Response } from "express";

export interface SetupMetaReviewIndexRoutesDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

interface DemoEntry {
  slug: string;
  permission: string;
  title: string;
  oneLiner: string;
  badge: string;          // hex
  demoPath: string;
  runbookPath: string;
  recordingCmd: string;
  graphCalls: string[];
}

const DEMOS: DemoEntry[] = [
  {
    slug: "oembed",
    permission: "oEmbed Read",
    title: "Embed verified public posts",
    oneLiner: "Paste a public FB/IG post URL → backend calls /v21.0/instagram_oembed or /v21.0/oembed_post → renders the returned HTML live.",
    badge: "#22c55e",
    demoPath: "/admin/oembed-app-review-demo",
    runbookPath: "backend/docs/oembed-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-oembed-app-review-demo.playwright.mjs",
    graphCalls: ["GET /v21.0/instagram_oembed", "GET /v21.0/oembed_post"],
  },
  {
    slug: "pages-cta",
    permission: "pages_manage_cta",
    title: "Set Role Agent Page CTA",
    oneLiner: "Choose CTA type (BOOK_NOW/SHOP_NOW/…) + target URL → POST /v21.0/{page-id} + GET-verify.",
    badge: "#a855f7",
    demoPath: "/admin/pages-manage-cta-app-review-demo",
    runbookPath: "backend/docs/pages-manage-cta-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-pages-cta-app-review-demo.playwright.mjs",
    graphCalls: ["POST /v21.0/{page-id}", "GET /v21.0/{page-id}?fields=cta_type,cta_link"],
  },
  {
    slug: "page-public-content",
    permission: "Page Public Content Access",
    title: "Public Page discovery for casting",
    oneLiner: "Read public profile + recent posts of Norwegian production-team Pages — surfaces casting-call announcements.",
    badge: "#0ea5e9",
    demoPath: "/admin/page-public-content-app-review-demo",
    runbookPath: "backend/docs/page-public-content-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-page-public-content-app-review-demo.playwright.mjs",
    graphCalls: ["GET /v21.0/{page-id}?fields=id,name,about,…", "GET /v21.0/{page-id}/posts"],
  },
  {
    slug: "page-mentions",
    permission: "Page Mentions",
    title: "Posts tagging your Page",
    oneLiner: 'Who\'s talking about you-feed — GET /v21.0/{page-id}/tagged with engagement summaries.',
    badge: "#fbbf24",
    demoPath: "/admin/page-mentions-app-review-demo",
    runbookPath: "backend/docs/page-mentions-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-page-mentions-app-review-demo.playwright.mjs",
    graphCalls: ["GET /v21.0/{page-id}/tagged"],
  },
  {
    slug: "page-metadata",
    permission: "Page Public Metadata Access",
    title: "Partner discovery — richer Page fields",
    oneLiner: "Location, hours, founded, mission, payment_options, parking, transit — beyond Page Public Content.",
    badge: "#22c55e",
    demoPath: "/admin/page-public-metadata-app-review-demo",
    runbookPath: "backend/docs/page-public-metadata-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-page-metadata-app-review-demo.playwright.mjs",
    graphCalls: ["GET /v21.0/{page-id}?fields=founded,mission,location,hours,…"],
  },
  {
    slug: "ig-public-content",
    permission: "Instagram Public Content Access",
    title: "Hashtag search + business discovery",
    oneLiner: "Casting monitoring via #norskcasting feed + target-handle profile lookup.",
    badge: "#ec4899",
    demoPath: "/admin/instagram-public-content-app-review-demo",
    runbookPath: "backend/docs/ig-public-content-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-ig-public-content-app-review-demo.playwright.mjs",
    graphCalls: [
      "GET /v21.0/ig_hashtag_search",
      "GET /v21.0/{hashtag-id}/recent_media",
      "GET /v21.0/{ig-user-id}?fields=business_discovery.username(...)",
    ],
  },
  {
    slug: "leads-retrieval",
    permission: "leads_retrieval",
    title: "Casting-call lead ingest from Lead Ads",
    oneLiner: "Auto-pull form-submissions into the casting pipeline. Replaces manual Meta Business Suite exports.",
    badge: "#06b6d4",
    demoPath: "/admin/leads-retrieval-app-review-demo",
    runbookPath: "backend/docs/leads-retrieval-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-leads-retrieval-app-review-demo.playwright.mjs",
    graphCalls: ["GET /v21.0/{page-id}/leadgen_forms", "GET /v21.0/{form-id}/leads"],
  },
  {
    slug: "ig-manage-events",
    permission: "instagram_manage_events",
    title: "Casting events on Instagram",
    oneLiner: "Publish casting events (open auditions, info sessions) so followers RSVP natively in IG.",
    badge: "#f59e0b",
    demoPath: "/admin/instagram-manage-events-app-review-demo",
    runbookPath: "backend/docs/ig-manage-events-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-ig-events-app-review-demo.playwright.mjs",
    graphCalls: [
      "GET /v21.0/{ig-user-id}/events",
      "POST /v21.0/{ig-user-id}/events",
      "DELETE /v21.0/{event-id}",
    ],
  },
  {
    slug: "ig-business-basic",
    permission: "instagram_business_basic",
    title: "Show the connected Instagram professional account",
    oneLiner: "Read + display the connected IG Business account's username + profile picture so the user confirms the right account is linked.",
    badge: "#8b5cf6",
    demoPath: "/admin/instagram-business-basic-app-review-demo",
    runbookPath: "backend/docs/ig-business-basic-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-ig-business-basic-app-review-demo.playwright.mjs",
    graphCalls: [
      "GET /v21.0/{ig-user-id}?fields=username,account_type,profile_picture_url,followers_count,media_count",
    ],
  },
];

const WHATSAPP_DEMOS: DemoEntry[] = [
  {
    slug: "whatsapp-business",
    permission: "WhatsApp Business Messaging",
    title: "Casting reminders + audition logistics",
    oneLiner: "Send template messages to candidates (audition reminders, location updates, booking confirmations). Pre-existing submission.",
    badge: "#25D366",
    demoPath: "/admin/whatsapp-app-review-demo",
    runbookPath: "backend/docs/whatsapp-app-review-runbook.md",
    recordingCmd: "node backend/scripts/record-whatsapp-app-review-demo.playwright.mjs",
    graphCalls: ["POST /v21.0/{phone-number-id}/messages"],
  },
];

export function setupMetaReviewIndexRoutes(deps: SetupMetaReviewIndexRoutesDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  app.get("/admin/meta-app-review-index", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    const tokenMatch = typeof req.query.token === "string" ? `?token=${encodeURIComponent(req.query.token.trim())}` : "";

    const renderRow = (d: DemoEntry, i: number) => `
      <tr data-testid="demo-row-${d.slug}">
        <td class="num">${i + 1}</td>
        <td>
          <span class="permission-badge" style="background:${d.badge}22;color:${d.badge};border-color:${d.badge}55">
            ${d.permission}
          </span>
          <div class="title">${d.title}</div>
          <div class="oneliner">${d.oneLiner}</div>
          <div class="graph-calls">
            ${d.graphCalls.map((c) => `<code>${c}</code>`).join(" · ")}
          </div>
        </td>
        <td>
          <a class="action primary" data-testid="open-demo-${d.slug}" href="${d.demoPath}${tokenMatch}">
            ▶ Open demo
          </a>
          <a class="action secondary" href="https://github.com/creaotrhubn26/Creatorhubn-monorepo/blob/feat/role-room-consent-production-api/${d.runbookPath}" target="_blank" rel="noopener">
            📖 Runbook
          </a>
          <div class="rec-cmd">
            <code>${d.recordingCmd}</code>
          </div>
        </td>
      </tr>
    `;

    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><title>Meta App Review — Demo Index — The Role Room</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  body{margin:0;background:#0f1729;color:#f1f5f9;padding:32px;min-height:100vh}
  .wrap{max-width:1180px;margin:0 auto}
  .hero{background:linear-gradient(135deg,#1e293b,#0f1729);border:1px solid #334155;border-radius:14px;padding:36px;box-shadow:0 22px 80px rgba(0,0,0,.4);margin-bottom:24px}
  h1{margin:0 0 8px;font-size:34px;font-weight:800;background:linear-gradient(135deg,#a78bfa,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  h2{margin:0 0 18px;font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em}
  .meta-row{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;margin-top:14px}
  .meta-row span strong{color:#f1f5f9}
  table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}
  th{background:#0f1729;color:#94a3b8;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;padding:12px 16px;text-align:left;border-bottom:1px solid #334155}
  td{padding:18px 16px;border-bottom:1px solid #334155;vertical-align:top;font-size:14px}
  tr:last-child td{border-bottom:none}
  td.num{color:#475569;font-weight:800;font-size:18px;width:48px;text-align:center}
  .permission-badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid;margin-bottom:6px}
  .title{font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px}
  .oneliner{font-size:12.5px;color:#94a3b8;line-height:1.5;margin-bottom:8px}
  .graph-calls{font-size:11px;color:#67e8f9;display:flex;gap:8px;flex-wrap:wrap}
  .graph-calls code{background:#0f1729;border:1px solid #334155;border-radius:4px;padding:2px 6px;font-size:10.5px;color:#a5f3fc}
  .action{display:inline-block;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;margin-right:8px;margin-bottom:6px;transition:transform .12s}
  .action:hover{transform:translateY(-1px)}
  .action.primary{background:#22c55e;color:#0f1729}
  .action.primary:hover{background:#34d399}
  .action.secondary{background:rgba(148,163,184,.18);color:#cbd5e1;border:1px solid rgba(148,163,184,.32)}
  .rec-cmd{margin-top:6px}
  .rec-cmd code{background:#0f1729;border:1px solid #334155;border-radius:4px;padding:4px 8px;font-size:11px;color:#fbbf24;display:inline-block;word-break:break-all}
  .section-heading{color:#94a3b8;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;margin:28px 0 10px}
  .summary-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
  .pill{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.18);color:#86efac;border:1px solid rgba(34,197,94,.4);padding:6px 12px;border-radius:99px;font-size:12px;font-weight:700}
  .pill::before{content:"✓";font-size:14px}
</style></head>
<body>
<div class="wrap">

<div class="hero" data-testid="hero">
  <h1>Meta App Review — Demo Bundle</h1>
  <h2>The Role Room · App ID 1042181045651851</h2>
  <p style="color:#cbd5e1;line-height:1.6;margin:0 0 14px;max-width:880px">
    Reviewer landing — one URL surfacing all 9 working demo surfaces for our
    Meta App Review submission. Every demo runs against Graph API v21.0
    directly (no caching, no proxies). Each row links to the live demo,
    the engineering runbook on GitHub, and the Playwright recording
    command used to produce the submission screencast.
  </p>
  <div class="summary-pills" data-testid="summary-pills">
    <span class="pill">9 demos shipped</span>
    <span class="pill">All on v21.0</span>
    <span class="pill">data-testid coverage</span>
    <span class="pill">Bypass-token gated</span>
  </div>
  <div class="meta-row">
    <span><strong>Branch:</strong> feat/role-room-consent-production-api</span>
    <span><strong>Bypass mechanism:</strong> <code style="background:#0f1729;padding:2px 6px;border-radius:4px;color:#fbbf24">?token=…</code> or <code style="background:#0f1729;padding:2px 6px;border-radius:4px;color:#fbbf24">x-demo-token</code> header</span>
    <span><strong>Base URL:</strong> <code style="background:#0f1729;padding:2px 6px;border-radius:4px;color:#fbbf24">creatorhub-backend-rtbl.onrender.com</code></span>
  </div>
</div>

<h3 class="section-heading">Meta Graph API features (8)</h3>
<table data-testid="demos-table">
  <thead>
    <tr>
      <th style="width:48px">#</th>
      <th>Feature · Use case · Graph API calls</th>
      <th style="width:340px">Open demo / Recording</th>
    </tr>
  </thead>
  <tbody>
    ${DEMOS.map((d, i) => renderRow(d, i)).join("")}
  </tbody>
</table>

<h3 class="section-heading">WhatsApp Business (pre-existing submission)</h3>
<table data-testid="whatsapp-table">
  <thead>
    <tr>
      <th style="width:48px">#</th>
      <th>Feature · Use case · Graph API calls</th>
      <th style="width:340px">Open demo / Recording</th>
    </tr>
  </thead>
  <tbody>
    ${WHATSAPP_DEMOS.map((d, i) => renderRow(d, i)).join("")}
  </tbody>
</table>

<div style="margin-top:32px;padding:18px;background:#1e293b;border:1px solid #334155;border-radius:12px;font-size:12px;color:#94a3b8;line-height:1.6">
  <strong style="color:#cbd5e1">Reviewer note:</strong> Each demo accepts the same bypass token via <code style="color:#fbbf24">?token=</code> query-arg.
  All Graph API responses are surfaced transparently in the result-pane below each action — including raw JSON for verification.
  No demo writes to a Page or IG account without the operator explicitly entering a Page-scoped access token first.
</div>

</div>
</body></html>`);
  });
}
