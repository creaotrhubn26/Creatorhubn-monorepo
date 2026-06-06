# Page Public Content Access — App Review Runbook (The Role Room)

**Permission/feature:** Page Public Content Access
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** Page Public Content Access

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. To help casting directors stay on
> top of active casting calls and production announcements made by other
> production companies, we use the **Page Public Content Access** feature
> to surface **publicly visible posts** from Pages that have been marked
> as Norwegian production-team Pages in our directory.
>
> A typical workflow: a casting director searches our discovery feed for
> "Storyline Norway" and we display their **public Page profile**
> (name, category, fan count, website, about) plus the **10 most recent
> public posts** (message, created_time, permalink, reaction/comment
> counts). The casting director then decides whether to follow up via the
> public contact channels on that Page.
>
> All data we read is already public on Facebook. We do NOT read messages,
> private fields, or any user-level data. We do NOT post on behalf of the
> Page (that would be `pages_manage_posts`, which is a separate
> submission). We use the **App Access Token** (`META_APP_ID|META_APP_SECRET`)
> — no user token required.
>
> Concretely:
> - `GET /v21.0/{page-id}?fields=id,name,about,category,fan_count,verification_status,website,emails,phone,description`
> - `GET /v21.0/{page-id}/posts?fields=id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true)&limit=10`

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/page-public-content-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the WhatsApp/oEmbed/pages_manage_cta submissions.)
> 2. The demo renders three steps:
>    - **Step 1 — Enter a public Page ID.** A Norwegian production-company
>      Page ID is pre-suggested in the placeholder. You can paste any
>      public Page ID.
>    - **Step 2 — Click "Fetch public profile".** Backend issues
>      `GET /v21.0/{page-id}` with App Access Token and returns the public
>      fields. The result pane below shows the rendered fields followed by
>      the raw JSON.
>    - **Step 3 — Click "Fetch public posts".** Backend issues
>      `GET /v21.0/{page-id}/posts` with App Access Token and returns the
>      10 most recent public posts. The cards show the public message,
>      timestamp, reaction count, comment count, and a "↗ open" link to
>      the post on Facebook.
> 3. Both calls go directly to Meta's Graph API on v21.0. No caching or
>    user-token impersonation. No private data is read.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-page-public-content-routes.ts` — both API endpoints + demo page
- `backend/scripts/record-page-public-content-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/page-public-content-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupPagesCtaRoutes`

### Endpoints

```
GET /api/role-room/public-page/profile?pageId=...[&accessToken=...]
  → calls GET /v21.0/{pageId}?fields=id,name,about,category,fan_count,
        verification_status,website,emails,phone,description
  → returns { success, pageId, profile }
  → accessToken-arg er valgfri; default = META_APP_ID|META_APP_SECRET

GET /api/role-room/public-page/posts?pageId=...[&accessToken=...&limit=10]
  → calls GET /v21.0/{pageId}/posts?fields=id,message,created_time,
        permalink_url,reactions.summary(true),comments.summary(true)&limit=...
  → returns { success, pageId, postCount, posts }
```

Both endpoints use `requireAdminOrDemoBypass` so the reviewer's
`?token=…` bypass works alongside the regular admin-session gate.

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_PAGE_ID=<norsk-production-page-id>

node backend/scripts/record-page-public-content-app-review-demo.playwright.mjs
# → recordings/page-public-content-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/page-public-content-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/public-page/profile?pageId=$PAGE_ID&token=$DEMO_TOKEN" | jq .
curl "$APP_BASE_URL/api/role-room/public-page/posts?pageId=$PAGE_ID&limit=3&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Posting on behalf of the Page (`pages_manage_posts`)
- Reading message threads (`pages_messaging`)
- Modifying CTA, profile, photos (`pages_manage_cta`, `pages_manage_metadata`)
- Reading insights or leads (`page_read_user_content`, `leads_retrieval`)

This submission ONLY reads public fields and public posts using the
App Access Token. No user token, no private data, no write operations.
