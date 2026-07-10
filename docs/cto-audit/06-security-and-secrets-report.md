# 6. Security and Secrets Report

## Secrets in frontend

None found. The Google Maps integration
(`frontend/client/src/services/GoogleMapsService.ts`) loads the Maps JS SDK
client-side, which requires a browser-restricted key by design (Google's own model
for that API) — no server-only secret is exposed there. No `ANTHROPIC_API_KEY`,
`GOOGLE_CLIENT_SECRET`, database URL, or similar was found anywhere under
`frontend/`.

## Secrets committed to the repo

- **No service-account JSON keys.** The only files matching `private_key`/
  `client_email` are Drizzle ORM migration snapshots
  (`backend/migrations/meta/0000_snapshot.json:887`, `0001_snapshot.json:4980`) —
  these are column-name metadata for a `client_email` table field, a false
  positive, not credential material.
- **One committed non-`.env.example` env file**: `frontend/client/.env.production`
  is tracked in git. Its contents are public-facing analytics/pixel IDs (GA
  measurement ID, GTM ID, Meta/TikTok pixel IDs) — not secret material by
  themselves, but committing a real `.env.production` file (vs. an
  `.env.production.example` template) is a pattern that invites accidental secret
  commits later. **Recommendation (P1, low effort)**: rename to
  `.env.production.example` and inject real values at build/deploy time instead.
- No hardcoded `AIza...` Maps keys, no `apikey=`/`api_key=` literals, no
  `credentials.json` / `*service-account*.json` files anywhere in the repo.

## Secret Manager

Not used — no `@google-cloud/secret-manager` dependency exists. All secrets are
delivered as environment variables via Render (`render.yaml` declares `sync: false`
placeholders that are filled in through Render's dashboard, not committed). This is
a reasonable pattern for the current single-cloud (Render, not GCP) hosting model —
adopting GCP Secret Manager would only make sense if/when the platform actually
migrates infrastructure onto GCP, which it currently has not.

One piece of custom secret-at-rest handling exists: Google Workspace OAuth tokens
are encrypted before storage via `ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY`
(AES, in `backend/server/google-oauth-shared.ts`), which reconciles three legacy
token formats into one `encryptGoogleToken()`/`decryptGoogleToken()` pair. This is
the right instinct (don't store raw OAuth refresh tokens in plaintext) and should
be the template if/when Market Intelligence needs to store any third-party
credentials (e.g. a customer's own Google Ads/Analytics OAuth token as an MI data
source, per the request's aspirational data-source list).

## API key restrictions / least privilege

Cannot be fully verified from source code alone — restrictions on
`GOOGLE_PLACES_API_KEY`, `GOOGLE_API_KEY`, and OAuth client scopes are configured in
the Google Cloud Console project, not in this repo. **Action item for whoever owns
the GCP project** (not a code change): confirm the server-side Places/Ads keys are
IP- or referrer-restricted and scoped to only the APIs actually used, and confirm no
GCP project has an overly broad service account (moot today since no native GCP
service is used, but relevant the moment Vertex AI/BigQuery is adopted per the
request's roadmap).

## Sensitive data in logs

No instances of tokens, passwords, or secret values being logged were found in a
targeted grep across the reviewed files. Logging that does occur near auth code
logs counts/status only (e.g. a session-hydration count, a refresh-worker status
message), not the credential values themselves.

## Google Cloud errors crashing the dashboard

Places API calls follow a safe pattern already (try/catch, 12s timeout, log +
return `null` on failure, documented as "best-effort" in a code comment) — a Places
outage degrades gracefully. This pattern was **not confirmed** to be applied
consistently to Ads API / Search Console fetches; some of those call sites do not
have an explicit timeout, which is a real (if narrow) risk of a hung request
blocking a route handler. **Recommendation (P1)**: introduce one shared
`callExternalApi()` wrapper (timeout + retry-with-backoff + typed
success/partial-failure result) and route all external Google API calls through it,
matching the pattern the Places integration already demonstrates works.

## Tenant separation for stored credentials

Google Workspace OAuth tokens and Ads/Search-Console connections are stored keyed
to a user/org (not verified to be uniformly `organization_id`-scoped across every
integration in this pass — flagged as a follow-up check, not a confirmed breach,
since the deeper credential-storage schema wasn't fully enumerated in this audit
pass). This should be explicitly verified before any MI feature reads a customer's
connected Google account data across multiple orgs sharing infrastructure.

## Multi-tenant separation — the one real gap this report cross-references

The Market Intelligence tables (`market_scans` and children) have **no
`organization_id` column at all** — scoping is per-user
(`workspace_owner_user_id`). This is not a credential-leak risk today (nothing in
MI stores third-party secrets yet), but it is the same architectural gap flagged in
the System Audit and Domain Coupling Report: without an org column, "multi-tenant
separation" for MI data cannot be verified or enforced at the database level, only
inferred from which user created a row. This PR's migration
(`0374_market_intelligence_tenant_and_industry.sql`) adds the column as a P0 fix.

## Summary verdict against the request's §3 checklist

| Check | Result |
|---|---|
| No secrets in frontend | Pass |
| No secrets committed | Pass (one non-sensitive `.env.production` to clean up, P1) |
| API keys have restrictions | Cannot verify from repo; console-side action item |
| Service accounts follow least privilege | N/A — no GCP service accounts exist today |
| Sensitive data not logged | Pass |
| API costs traceable | **Gap** — no per-org cost/usage tracking for Places/Ads (P2) |
| GCP errors don't crash dashboard | Partial — Places is safe, Ads/Search Console not fully verified (P1) |
| External API errors show as partial-failure states in UI | **Gap** — no standardized partial-failure UI pattern in MI frontend (P1) |
