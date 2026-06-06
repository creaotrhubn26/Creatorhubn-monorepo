# Page Mentions — App Review Runbook (The Role Room)

**Permission/feature:** Page Mentions
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** Page Mentions

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. Production-team Pages frequently
> get tagged by casting directors, talent, and partner Pages in
> casting-call announcements, reviews, behind-the-scenes posts, and
> collaborator shout-outs.
>
> We use **Page Mentions** via Graph API `GET /v21.0/{page-id}/tagged`
> to surface these tagged-in posts to the production team as a
> **"Who's talking about you"-feed**. The feed lets producers:
> - Engage with mentions in real time (reply, share, react)
> - Discover new collaborators who proactively tagged their work
> - Track campaign-driven traffic by counting branded mentions
> - Find issues early — e.g., a wrong audition date getting circulated
>
> We read fields: `id, from, message, created_time, permalink_url, type,
> reactions.summary, comments.summary`. We do NOT read user-level data,
> private messages, or anything not already public on Facebook. We use
> the **App Access Token** (`META_APP_ID|META_APP_SECRET`) — Page-scoped
> tokens are optional but supported for Pages that have granted
> `page_read_engagement`.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/page-mentions-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the WhatsApp/oEmbed/pages_manage_cta/
>    Page Public Content Access submissions.)
> 2. The demo renders two steps:
>    - **Step 1 — Enter a Page ID** of any production-team Page (one is
>      pre-suggested in the placeholder).
>    - **Step 2 — Click "Fetch mentions"**. Backend issues
>      `GET /v21.0/{page-id}/tagged` with App Access Token and returns
>      the most recent posts that tag this Page. The result pane below
>      shows mention-cards (from-Page, message, created_time, reaction +
>      comment counts, permalink) followed by the raw JSON.
> 3. The Graph API call is direct, no proxies. Empty results are
>    rendered explicitly as "No recent mentions" — that's expected for
>    Pages with low engagement.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-page-mentions-routes.ts` — API + demo page
- `backend/scripts/record-page-mentions-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/page-mentions-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupPagePublicContentRoutes`

### Endpoint

```
GET /api/role-room/page-mentions?pageId=...[&accessToken=...&limit=10]
  → calls GET /v21.0/{pageId}/tagged?fields=id,from,message,created_time,
        permalink_url,type,reactions.summary(true),comments.summary(true)
  → returns { success, pageId, mentionCount, mentions }
```

Uses `requireAdminOrDemoBypass` (same gate as other Meta App Review
demos). `accessToken` query-arg overrides the App Access Token default.

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_PAGE_ID=<production-page-id>

node backend/scripts/record-page-mentions-app-review-demo.playwright.mjs
# → recordings/page-mentions-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/page-mentions-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/page-mentions?pageId=$PAGE_ID&limit=3&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Posting on behalf of the Page (`pages_manage_posts`)
- Reading message threads (`pages_messaging`)
- Modifying CTA, profile, photos (separate submissions)
- Reading insights or leads (`page_read_user_content`, `leads_retrieval`)

This submission ONLY reads the public `tagged` edge for Pages, surfacing
mentions as a notification feed. No private data, no write ops.
