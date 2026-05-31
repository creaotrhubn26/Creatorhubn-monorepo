# leads_retrieval — App Review Runbook (The Role Room)

**Permission/feature:** leads_retrieval
**App ID:** 1042181045651851 (The Role Room)
**Submission Item:** leads_retrieval

## Use case (paste this into App Review)

> The Role Room is a casting and production-management platform for the
> Norwegian film/TV/theatre industry. Production teams routinely run
> Lead Ads on Facebook with calls-to-action like
> **"Be on TV — sign up for the casting!"** or **"Talent open call"**.
>
> Today, casting directors have to manually export those leads from Meta
> Business Suite, copy them into a spreadsheet, and paste them into our
> casting pipeline — a workflow that loses hours every week and risks
> missing candidates entirely (the Business Suite export queue can be
> slow when many ads are running concurrently).
>
> With **`leads_retrieval`**, The Role Room polls each connected
> production-team Page's Lead Ads forms and writes the submissions
> straight into the casting pipeline. The casting director simply marks
> a Page as "connected for lead ingest" once, then leads flow in
> automatically with all field_data values (name, email, phone, age,
> location — whatever the casting director asked for in the Lead Ad
> form). We do this with two Graph API calls:
>
> 1. `GET /v21.0/{page-id}/leadgen_forms?fields=id,name,status,
>    created_time,leads_count,questions{key,label,type}` — list forms.
> 2. `GET /v21.0/{form-id}/leads?fields=id,created_time,ad_id,ad_name,
>    adset_id,campaign_id,form_id,field_data,is_organic,platform` —
>    fetch submissions per form.
>
> Both calls require a Page-scoped token with `leads_retrieval` granted
> by the Page admin (explicit, per-Page consent). We do NOT read leads
> from any Page that has not explicitly connected. We do NOT read any
> other Page's leads.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/leads-retrieval-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. The demo renders three steps:
>    - **Step 1 — Enter Page ID + Page-scoped access token.** The
>      submitter has pre-populated test credentials. The token has the
>      `leads_retrieval` permission granted by the Page admin.
>    - **Step 2 — Click "List lead-gen forms"**. Backend issues
>      `GET /v21.0/{page-id}/leadgen_forms` and returns each form as a
>      card with name, status, created time, leads_count, and form ID.
>    - **Step 3 — Click "Pull leads" on a form card.** Backend issues
>      `GET /v21.0/{form-id}/leads` and returns each lead with full
>      field_data (every question the form asked, with the candidate's
>      answer). Lead-cards include created_time, ad/adset/campaign IDs,
>      platform, and the field values.
> 3. Both endpoints are direct Graph API calls. No caching, no proxies.
>    field_data only contains values the candidate explicitly submitted
>    to the Page admin's form.
>
> If the live demo URL is unavailable, the screencast attached to this
> submission shows the full flow end-to-end.

## Implementation notes (internal)

### Files

- `backend/server/role-room-leads-retrieval-routes.ts` — API + demo page
- `backend/scripts/record-leads-retrieval-app-review-demo.playwright.mjs` — Playwright recording
- `backend/docs/leads-retrieval-app-review-runbook.md` — this file
- Mounted in `index.ts` next to `setupIgPublicRoutes`

### Endpoints

```
GET /api/role-room/leads/forms?pageId=...&pageAccessToken=...
  → /v21.0/{pageId}/leadgen_forms?fields=id,name,status,created_time,
        leads_count,questions{key,label,type},page
  → returns { success, pageId, formCount, forms }

GET /api/role-room/leads/from-form?formId=...&pageAccessToken=...&limit=25
  → /v21.0/{formId}/leads?fields=id,created_time,ad_id,ad_name,adset_id,
        campaign_id,form_id,field_data,is_organic,platform
  → returns { success, formId, leadCount, leads }
```

Both endpoints use `requireAdminOrDemoBypass`. Page admin must grant
`leads_retrieval` explicitly per Page — this is not implicit from app
install.

### Production ingest cadence

In production we poll each connected Page every 5 min during business
hours, slowing to every 30 min overnight. Each lead is written into our
DB once (deduped by Meta `lead.id`); we use the form's `questions`
metadata to map field_data keys to our internal candidate fields.

### Recording

```bash
export APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
export WHATSAPP_DEMO_BYPASS_TOKEN=<demo-token>
export DEMO_PAGE_ID=<page-id>
export DEMO_PAGE_ACCESS_TOKEN=<page-token-with-leads_retrieval>

node backend/scripts/record-leads-retrieval-app-review-demo.playwright.mjs
# → recordings/leads-retrieval-demo-<timestamp>.webm
```

### Validate live

```bash
curl -sI "$APP_BASE_URL/admin/leads-retrieval-app-review-demo?token=$DEMO_TOKEN" | head -5
curl "$APP_BASE_URL/api/role-room/leads/forms?pageId=$PAGE_ID&pageAccessToken=$PAGE_TOKEN&token=$DEMO_TOKEN" | jq .
curl "$APP_BASE_URL/api/role-room/leads/from-form?formId=$FORM_ID&pageAccessToken=$PAGE_TOKEN&token=$DEMO_TOKEN" | jq .
```

## Out-of-scope (intentionally NOT in this submission)

- Webhook-based real-time lead delivery (we use polling)
- Writing/posting on behalf of the Page (`pages_manage_posts`)
- Reading non-leadgen content (`page_read_engagement` is separate)
- Reading leads from Pages we are not explicitly connected to

This submission ONLY reads Lead Ads form submissions for Pages where
the Page admin has explicitly granted `leads_retrieval`. No private
data leaves Meta beyond what the candidate already gave consent to
share with the Page admin.
