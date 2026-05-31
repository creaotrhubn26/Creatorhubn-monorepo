# `pages_manage_cta` — App Review Runbook (The Role Room)

**Permission:** `pages_manage_cta`
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** Pages Manage CTA

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. Our **Role Agent** is an automated
> production-team assistant that helps casting directors keep their public
> Facebook Page aligned with the lifecycle of their active productions.
>
> When a production opens auditions, the Role Agent sets the Page's CTA
> button to `BOOK_NOW` and points it at the audition landing page
> (`theroleroom.com/audition/{role-id}`). When the production wraps and
> moves into release-promotion, the Agent flips the CTA to `WATCH_NOW`
> or `SHOP_NOW` for tie-in merch. Without `pages_manage_cta`, casting
> directors have to manually log into Meta Business Suite for each
> milestone transition, which is the #1 reason production-team Pages have
> stale CTAs months after a project closes.
>
> Concretely, our backend calls
> `POST /v21.0/{page-id}?cta_type=...&cta_link=...&access_token={page-token}`
> with a Page-scoped token. We verify the change immediately afterward
> via `GET /v21.0/{page-id}?fields=cta_type,cta_link`. No user data,
> messages, or post content is read or modified — only the CTA fields on
> the Page that the Page admin has explicitly granted access to.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/pages-manage-cta-app-review-demo?token=<DEMO_TOKEN>`
>    (Reviewer credentials shipped with the submission — same demo-bypass token as
>    the WhatsApp / oEmbed Read submissions.)
> 2. The demo page renders four steps in a single column:
>    - **Step 1 — Enter a Page ID + Page-scoped access token.** The
>      submitter has pre-populated test credentials for the demo Page.
>    - **Step 2 — Choose a CTA type (BOOK_NOW, SHOP_NOW, etc.) and a
>      target URL.** A `BOOK_NOW` → `https://theroleroom.com/audition/lead`
>      pairing is pre-selected.
>    - **Step 3 — Click "Set CTA on Page".** The Role Room backend
>      issues `POST /v21.0/{page-id}?cta_type=...&cta_link=...` and
>      returns the Graph API response in the result pane below.
>    - **Step 4 — Click "Verify current CTA".** The backend reads
>      `cta_type` + `cta_link` back from the Page and displays them so
>      you can confirm the change took effect.
> 3. Both calls go directly against Meta's Graph API on the v21.0
>    endpoint. There are no proxies or caches in between.
>
> If the demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-pages-cta-routes.ts` — both API endpoints + demo page
- `backend/scripts/record-pages-cta-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/pages-manage-cta-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupOEmbedRoutes`

### Endpoints

```
POST /api/role-room/page/cta
  Body: { pageId, pageAccessToken, ctaType, ctaUrl }
  → calls POST /v21.0/{pageId} with cta_type + cta_link + access_token

GET /api/role-room/page/cta?pageId=...&pageAccessToken=...
  → calls GET /v21.0/{pageId}?fields=id,name,cta_type,cta_link
```

Both endpoints use `requireAdminOrDemoBypass` so the reviewer's
`?token=…` bypass works alongside the regular admin-session gate.

### Recording

```bash
# Set env (or use backend/.env.pages-cta.demo.local — gitignored)
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_PAGE_ID=<page-id>
export DEMO_PAGE_ACCESS_TOKEN=<page-scoped-token>
export DEMO_CTA_URL=https://theroleroom.com/audition/lead
export DEMO_CTA_TYPE=BOOK_NOW

node backend/scripts/record-pages-cta-app-review-demo.playwright.mjs
# → recordings/pages-manage-cta-demo-<timestamp>.webm
```

### Validate live

```bash
# Demo page (HTML)
curl -sI "$APP_BASE_URL/admin/pages-manage-cta-app-review-demo?token=$DEMO_TOKEN" | head -5

# API verification (need real page + token)
curl "$APP_BASE_URL/api/role-room/page/cta?token=$DEMO_TOKEN&pageId=$PAGE_ID&pageAccessToken=$PAGE_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Reading or sending Page messages (different permission)
- Modifying Page profile, cover photo, bio (different permission)
- Reading insights, posts, leads (different permissions)

This submission ONLY covers setting/reading the CTA-button fields on
Pages the admin user has explicit access to.
