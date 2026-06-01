# Page Public Metadata Access — App Review Runbook (The Role Room)

**Permission/feature:** Page Public Metadata Access
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** Page Public Metadata Access

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. Beyond the basic public fields
> covered by **Page Public Content Access**, casting directors need
> richer Page metadata to filter the partner-discovery feed:
>
> - **Location** (city, country, lat/long, street) — find production
>   teams in Oslo, Bergen, Trondheim, or in driving distance to a
>   specific shoot location.
> - **Hours** — only show Pages whose business hours indicate they're
>   actually active (vs dormant projects).
> - **Founded** — distinguish established production companies from
>   one-off project Pages.
> - **Mission**, **company_overview**, **general_info** — surface the
>   Page's own description so the casting director gets context before
>   reaching out.
> - **Phone**, **emails**, **website** — public contact channels the
>   Page owner has explicitly published.
> - **Price range**, **payment options**, **parking**, **public_transit**
>   — operational details relevant for partnership decisions.
> - **Impressum** — required for German/Austrian production Pages by law.
>
> All fields read are explicitly marked public by the Page owner. We do
> NOT read user-level data, messages, posts content (separate
> submissions), or anything private. We use the **App Access Token**
> (`META_APP_ID|META_APP_SECRET`).
>
> Concretely:
> `GET /v21.0/{page-id}?fields=id,name,founded,mission,products,location,
> hours,phone,emails,website,price_range,payment_options,parking,
> public_transit,company_overview,general_info,impressum,
> single_line_address,category,verification_status`

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/page-public-metadata-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. The demo renders two steps:
>    - **Step 1 — Enter a Page ID** of any production-team Page.
>    - **Step 2 — Click "Fetch metadata"**. Backend issues
>      `GET /v21.0/{page-id}?fields=...` with App Access Token and
>      returns the rich metadata field-set. The result pane below shows
>      each field as its own card (name, category, founded, mission,
>      location, hours, phone, ...) plus the raw JSON.
> 3. Empty fields ("not set publicly") indicate the Page owner has not
>    published that field — expected and not an error.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-page-metadata-routes.ts` — API + demo page
- `backend/scripts/record-page-metadata-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/page-public-metadata-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupPageMentionsRoutes`

### Endpoint

```
GET /api/role-room/public-page/metadata?pageId=...[&accessToken=...]
  → calls GET /v21.0/{pageId}?fields={RICH_METADATA_FIELDS}
  → returns { success, pageId, metadata }
```

Uses `requireAdminOrDemoBypass`. App Access Token by default; explicit
`accessToken` param overrides.

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_PAGE_ID=<production-page-id>

node backend/scripts/record-page-metadata-app-review-demo.playwright.mjs
# → recordings/page-metadata-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/page-public-metadata-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/public-page/metadata?pageId=$PAGE_ID&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Posting on behalf of the Page (`pages_manage_posts`)
- Reading message threads (`pages_messaging`)
- Modifying any metadata fields (`pages_manage_metadata`)
- Reading insights or leads (`page_read_user_content`, `leads_retrieval`)

This submission ONLY reads richer public metadata fields using the App
Access Token. No private data, no write ops, no user-token impersonation.
