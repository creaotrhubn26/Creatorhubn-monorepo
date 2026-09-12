# 2. Google Cloud Integration Map

## Headline finding

**The platform does not run on Google Cloud infrastructure.** There is no
`@google-cloud/*` package anywhere in `package.json` (backend or frontend) — no
Firestore, Cloud SQL client, BigQuery, Pub/Sub, Cloud Storage, Secret Manager,
Vertex AI, or Cloud Tasks/Scheduler SDKs. Hosting is Render (`render.yaml`), the
database is self-managed Postgres (`DATABASE_URL`), object storage is Cloudflare R2,
and scheduled jobs run as GitHub Actions cron workflows, not Cloud Scheduler/Tasks.

What the codebase *does* use is a set of Google's **public/Workspace REST APIs**,
called either via the `googleapis` npm package or plain `fetch`. This section
documents each one actually found, per the checklist in the request. Services in
the request's checklist that have **zero usage** are marked "Not used" rather than
invented.

## Per-service documentation

### Google Workspace APIs (Drive, Gmail, Calendar, Meet, People, Admin)
- **Where**: ~28 backend files import `{ google } from 'googleapis'`, e.g.
  `google-oauth-shared.ts`, `google-calendar-project.ts`, `chat-gmail-poller.ts`,
  `google-meet.ts`, `customer-drive-sync.ts`, `drive-batch-upload-wiring.ts`,
  `google-people-routes.ts`, `apps-script-service.ts`.
- **Purpose**: Drive file sync/uploads, Gmail polling for client comms, Calendar
  project scheduling, Meet link generation, domain-wide-delegation admin actions.
- **Credentials**: OAuth2 (`GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`), tokens stored
  encrypted (see Security report). Domain-wide delegation via
  `GOOGLE_IMPERSONATE_USER` / `GOOGLE_USE_IMPERSONATION`.
- **Scopes/roles**: not centrally enumerated — each integration file requests its
  own scope list inline. **Gap**: no single source of truth for "which OAuth scopes
  does this app request" — recommend consolidating into one scopes manifest.
- **Quotas/cost risk**: Workspace APIs are per-user-quota, low cost risk at current
  scale; no quota monitoring/alerting found.
- **Retry/timeout**: inconsistent — hand-rolled per file, not centralized.
- **Tenant separation**: OAuth tokens are per-user/per-org rows (see Security
  report); no evidence of cross-tenant token leakage in the reviewed files.

### YouTube Data / Analytics API
- **Where**: `social-publisher-youtube.ts`, `social-youtube-insights-worker.ts`,
  `youtube-routes.ts`.
- **Purpose**: publishing + performance analytics for the creator/social module.
  Not related to MI/Leadgrid.

### Google Places API (New)
- **Where**: plain `fetch` to `places.googleapis.com`, e.g.
  `role-room-agent.ts:2722,2796,2972,3453,3990,4586`, and Leadgrid's
  `leadgrid-project-lead-discovery-routes.ts` (lead prospecting by category/area).
- **Auth**: `X-Goog-Api-Key` header, key from `GOOGLE_PLACES_API_KEY`
  (`backend/render.yaml:18`).
- **Timeout/retry**: `AbortSignal.timeout(12_000)`, no retry in the callee — a code
  comment (`role-room-agent.ts:2946`) explicitly documents that retry is expected to
  live in the caller. Failures are caught and return `null`/logged, not thrown — so
  a Places outage degrades a feature rather than crashing the request. This is the
  right pattern and should be the template for other external calls (see below).
- **Cost risk**: Places (New) is metered per request category (Nearby/Text
  Search vs. Place Details cost differently); no per-org cost attribution or budget
  alerting was found — a runaway lead-discovery loop for one org could not
  currently be isolated in billing terms from another org's usage.

### Google Ads API
- **Where**: `client-google-customer-match.ts`, `client-ads-google-oauth.ts`,
  `client-insights-service.ts`, `google-verification-marketing-routes.ts`,
  `role-room-google-ads.ts`. Custom `GoogleAdsApiError` type used for typed error
  handling in `role-room-routes.ts`.
- **Purpose**: ad account insights/customer-match audiences for the marketing
  module (client-ads-*), unrelated to MI directly but a candidate future MI data
  source ("Google Ads API" is explicitly in the request's generic data-source list).
- **Timeout**: not confirmed explicit timeouts on all fetches to
  `googleads.googleapis.com` — flagged as a risk (a hung request could block a
  route handler indefinitely; recommend a global fetch timeout wrapper).

### Search Console API
- **Where**: `client-google-suite.ts`, `client-insights-service.ts`,
  `google-verification-marketing-routes.ts`. REST calls to
  `www.googleapis.com/webmasters/v3` and `searchconsole.googleapis.com`.
- **Purpose**: site-verification + search performance data for the marketing
  module — another plausible future MI data source.

### Google Analytics Data API (GA4)
- **Package present, unused**: `@google-analytics/data` is declared
  (`backend/package.json:129`) but no `BetaAnalyticsDataClient` call site was
  found — dead dependency or a half-started integration. Recommend either wiring
  it up as a real MI data source or removing the dependency.

### Google Maps JS SDK (client-side)
- **Where**: `frontend/client/src/services/GoogleMapsService.ts` — browser-loaded
  `google.maps.Geocoder`. No server-side key exposure found (the browser Maps key
  should be an HTTP-referrer-restricted key, distinct from the server
  `GOOGLE_PLACES_API_KEY` — verify this restriction is actually configured in the
  Google Cloud Console project, which is outside what a repo audit can confirm).

### Google Trends
- **Package present**: `google-trends-api` (`backend/package.json:206`); no direct
  call site found in this pass — likely unused or called somewhere not surfaced by
  the search. Worth a follow-up `grep` before relying on it.

### Not used (present in the request's checklist, absent from the codebase)
Cloud Run, Cloud Functions, Firestore, Cloud SQL, BigQuery, Pub/Sub, Cloud Storage
(GCS), Secret Manager, Vertex AI, Routes API, Geocoding API (server-side; only used
client-side via Maps JS), Cloud Scheduler, Cloud Tasks, Cloud Logging, Cloud
Monitoring.

## Cross-cutting checks (per the request's §3 checklist)

- **Secrets in frontend**: none found (see Security report — the one committed
  `.env.production` contains only public analytics IDs).
- **Secrets committed to repo**: none found; the two `client_email`/`private_key`
  hits are Drizzle migration-snapshot column metadata, not real GCP keys.
- **API key restrictions**: cannot be verified from the repo alone (restrictions
  are configured in the Google Cloud Console, not in code) — flagged as an
  action item for whoever owns the GCP project, not a code fix.
- **Least privilege for service accounts**: no GCP service accounts exist at all
  (no native GCP services are used), so this doesn't currently apply; if Vertex AI
  or BigQuery is adopted later (per the request's aspirational data-source list),
  a least-privilege service account per environment should be created then.
- **Sensitive data not logged**: no evidence of tokens/secrets in logs in the files
  reviewed.
- **API cost tracking**: not implemented for any Google API — recommend adding
  per-org request counters at minimum for Places/Ads (the two metered-per-call APIs
  most likely to be used heavily by an MI/Leadgrid data-source workflow).
- **Google Cloud errors don't crash the dashboard**: true for Places (explicit
  try/catch + null-return pattern); not verified for all Ads/Search Console call
  sites — recommend the same pattern be enforced repo-wide via a shared
  `callExternalApi()` helper (see Prioritized Implementation Plan, P1).
- **Partial-failure UI**: not implemented anywhere in the current MI frontend —
  this is a real gap against the request's acceptance criteria ("UI fungerer med
  ekte data, tomme data og delvise feil").
