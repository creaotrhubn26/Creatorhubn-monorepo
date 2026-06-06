# Instagram Public Content Access — App Review Runbook (The Role Room)

**Permission/feature:** Instagram Public Content Access
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** Instagram Public Content Access

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. We use **Instagram Public Content
> Access** to monitor active casting and production-team activity on
> Instagram via two complementary flows:
>
> **Flow A — Hashtag Search + Recent Media.**
> Casting directors search industry hashtags (e.g. `#norskcasting`,
> `#productioncrew`, `#nordicfilm`) to discover currently-active casting
> calls, behind-the-scenes content, and production-team work. We call:
> 1. `GET /v21.0/ig_hashtag_search?q=...&user_id=...` — resolves the
>    hashtag string to a hashtag-ID.
> 2. `GET /v21.0/{hashtag-id}/recent_media?user_id=...&fields=id,caption,
>    media_type,media_url,permalink,timestamp,like_count,comments_count,username`
>    — returns the most recent public posts under the hashtag.
>
> **Flow B — Business Discovery.**
> Once a production team is identified (e.g., by username), casting
> directors inspect the public business profile to evaluate before
> reaching out:
> - `GET /v21.0/{ig-user-id}?fields=business_discovery.username(<target>){
>   username,name,profile_picture_url,followers_count,follows_count,
>   media_count,biography,website,media.limit(6){...}}`
> — returns public profile + recent posts for the target handle.
>
> All content read is publicly visible on Instagram. We do NOT read
> private accounts, DMs, or any user-level data. We use the **App
> Access Token** (`META_APP_ID|META_APP_SECRET`). An IG Business
> `user_id` is required by Meta for both flows.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/instagram-public-content-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. The demo renders setup + two flows:
>    - **Setup — Enter your IG Business `user_id`.** This is required by
>      Meta's API for both flows. Test credentials are pre-suggested.
>    - **Flow A — Hashtag Search.** Enter `norskcasting` (or any other
>      hashtag) and click **"Search hashtag → media"**. Backend issues
>      `/ig_hashtag_search` to resolve the ID, then `/recent_media` with
>      the resolved ID, returning a 9-card media grid.
>    - **Flow B — Business Discovery.** Enter a target IG username
>      (without `@`) and click **"Discover business profile"**. Backend
>      issues `/v21.0/{ig-user-id}?fields=business_discovery.username(target){...}`
>      and returns the profile + 6 recent media.
> 3. Both flows render thumbnails (when `media_type=IMAGE`), caption
>    snippets, like + comment counts, and permalinks. The raw JSON
>    response is shown below each result for transparency.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-ig-public-routes.ts` — 3 API endpoints + demo page
- `backend/scripts/record-ig-public-content-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/ig-public-content-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupPageMetadataRoutes`

### Endpoints

```
GET /api/role-room/ig-public/hashtag-search?q=<hashtag>&userId=<ig-user-id>
  → /v21.0/ig_hashtag_search?q=...&user_id=...
  → returns { success, hashtag, hashtagId, response }

GET /api/role-room/ig-public/hashtag-media?hashtagId=<id>&userId=<ig-user-id>&limit=9
  → /v21.0/{hashtag-id}/recent_media?user_id=...&fields=<IG_MEDIA_FIELDS>
  → returns { success, hashtagId, mediaCount, media }

GET /api/role-room/ig-public/business-discovery?username=<ig>&userId=<ig-user-id>
  → /v21.0/{ig-user-id}?fields=business_discovery.username(<target>){...}
  → returns { success, username, discovery, response }
```

All endpoints use `requireAdminOrDemoBypass`. App Access Token by default;
explicit `accessToken` query-arg overrides.

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_IG_USER_ID=<your-ig-business-user-id>
export DEMO_HASHTAG=norskcasting
export DEMO_IG_USERNAME=nrkdrama

node backend/scripts/record-ig-public-content-app-review-demo.playwright.mjs
# → recordings/instagram-public-content-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/instagram-public-content-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/ig-public/hashtag-search?userId=$IG_USER&q=norskcasting&token=$DEMO_TOKEN" | jq .
curl "$APP_BASE_URL/api/role-room/ig-public/business-discovery?userId=$IG_USER&username=nrkdrama&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Reading private IG accounts (not possible via public API)
- DMs / inbox (different permission, separate app architecture)
- Stories / reels-specific endpoints (not requested)
- Writing/publishing on IG (`instagram_content_publish`)

This submission ONLY reads public IG content via `ig_hashtag_search`,
`recent_media`, and `business_discovery`. No private data, no user-token
impersonation, no write operations.
