# instagram_manage_events — App Review Runbook (The Role Room)

**Permission/feature:** instagram_manage_events
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** instagram_manage_events

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. Casting directors schedule open
> auditions, audition days, info sessions, and premiere screenings —
> all events where talent and the production team need to align on a
> physical time + place.
>
> Today producers publish these manually as Facebook events, then
> re-create them as IG event posts. With **`instagram_manage_events`**,
> The Role Room publishes the casting event directly as an Instagram
> event on the production team's connected IG Business account —
> visible to followers, who can RSVP or mark "interested" natively in
> the IG app. No separate signup landing page needed.
>
> The platform offers full CRUD via the Graph API:
> - `GET /v21.0/{ig-user-id}/events?fields=id,name,start_time,end_time,
>   description,place,attending_count,interested_count,ticket_uri,
>   cover{source}` — list current events.
> - `POST /v21.0/{ig-user-id}/events` with `name`, `start_time`,
>   optional `end_time`, `description`, `place` (JSON `{name:...}`) —
>   create.
> - `DELETE /v21.0/{event-id}` — remove an event a casting director
>   has cancelled.
>
> Page admin must grant `instagram_manage_events` explicitly on each
> connected IG account.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/instagram-manage-events-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. The demo renders setup + three operations:
>    - **Setup — Enter IG Business `user_id` + access token** (with
>      `instagram_manage_events` granted by Page admin).
>    - **Step 1 — Click "List events"**. Backend issues
>      `GET /v21.0/{ig-user-id}/events` and renders each event as a card
>      with name, start/end time, place, attending/interested counts,
>      and event ID. Each card has a "🗑 Delete"-button.
>    - **Step 2 — Fill in event details** (name, start time as
>      datetime-local picker, optional end time, place, description).
>    - **Step 3 — Click "Create event"**. Backend issues
>      `POST /v21.0/{ig-user-id}/events` with the form fields and
>      returns the new event ID + Graph API response.
> 3. Optional — Click "Delete" on any event card to confirm
>    `DELETE /v21.0/{event-id}` works against the same Graph API.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-ig-events-routes.ts` — 3 API endpoints + demo page
- `backend/scripts/record-ig-events-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/ig-manage-events-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupLeadsRetrievalRoutes`

### Endpoints

```
GET /api/role-room/ig-events?igUserId=...&accessToken=...
  → /v21.0/{ig-user-id}/events?fields={EVENT_FIELDS}
  → returns { success, igUserId, eventCount, events }

POST /api/role-room/ig-events
  Body: { igUserId, accessToken, name, startTime, endTime?,
          description?, placeName? }
  → POST /v21.0/{ig-user-id}/events with form-encoded fields
  → returns { success, igUserId, createdEvent }

DELETE /api/role-room/ig-events/:eventId?accessToken=...
  → DELETE /v21.0/{eventId}
  → returns { success, eventId, response }
```

All endpoints use `requireAdminOrDemoBypass`. Token is required for all
three operations (no App Access Token fallback for write-ops).

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_IG_USER_ID=<ig-business-user-id>
export DEMO_IG_TOKEN=<token-with-instagram_manage_events>

node backend/scripts/record-ig-events-app-review-demo.playwright.mjs
# → recordings/instagram-manage-events-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/instagram-manage-events-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/ig-events?igUserId=$IG_USER&accessToken=$IG_TOKEN&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Posting feed content (`instagram_content_publish`)
- Reading other Pages' events
- Reading user-level RSVPs (only aggregate counts via `attending_count` /
  `interested_count`)
- Modifying events on Pages that have not granted the permission

This submission ONLY manages events on IG Business accounts where the
Page admin has explicitly granted `instagram_manage_events`. No private
user data, no read-/write-ops on unrelated accounts.
