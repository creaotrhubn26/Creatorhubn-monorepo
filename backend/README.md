# CreatorHub Norge - Backend

Node.js + Express + TypeScript backend for CreatorHub Norge creator management platform.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Passport.js + JWT
- **API:** RESTful + WebSocket

## Development

```bash
# Install dependencies
npm install

# Start development server (port 5050)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run typecheck

# Database operations
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio
```

## Environment Variables

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Required only by the legacy source-to-target migration utilities.
OLD_DATABASE_URL=postgresql://user:password@legacy-host:5432/database

# Server
PORT=5050
NODE_ENV=development

# Evendi bridge
EVENDI_API_URL=https://evendi.onrender.com

# Auth
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Google OAuth / Workspace
CREATORHUB_GOOGLE_CLIENT_ID=your-creatorhub-google-client-id
CREATORHUB_GOOGLE_CLIENT_SECRET=your-creatorhub-google-client-secret
CREATORHUB_GOOGLE_REDIRECT_URI=http://localhost:5050/api/creatorhub/google/oauth/callback
ROLE_ROOM_GOOGLE_CLIENT_ID=your-role-room-google-client-id
ROLE_ROOM_GOOGLE_CLIENT_SECRET=your-role-room-google-client-secret
ROLE_ROOM_GOOGLE_REDIRECT_URI=http://localhost:5050/api/role-room/google/oauth/callback
ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY=your-role-room-google-token-secret
GOOGLE_PROJECT_ID=creatorhubn-com
GOOGLE_CLOUD_QUOTA_PROJECT=creatorhubn-com

# Dedicated Leadgrid web OAuth. Set ID + secret together; leaving both blank
# keeps the existing CreatorHub/Google fallback during migration.
LEADGRID_GOOGLE_CLIENT_ID=
LEADGRID_GOOGLE_CLIENT_SECRET=
LEADGRID_PUBLIC_URL=http://localhost:5050

# Discovery production rollout gate. Production defaults to disabled when the
# variable is missing. Phase 1 must remain false while every old worker is
# replaced with the queue-compatible release; enable it in a separate deploy.
# Preview, profile and review reads remain available while disabled, but any
# operation that would enqueue/start/confirm a run returns
# 503 discovery_not_enabled.
LEADGRID_DISCOVERY_ENABLED=false
# Organization-wide safeguards for automatic Discovery work.
LEADGRID_DISCOVERY_MAX_AUTO_PROFILES_PER_ORG=5
LEADGRID_DISCOVERY_ORG_MONTHLY_CANDIDATE_BUDGET=500

# MedSide fastlegeprofil: NHNs offentlige Fastlegeregister via Maskinporten.
# Hold kilden deaktivert til nhn:flr/export og skriftlige gjenbruksvilkår er
# godkjent. Nøkkelen er server-side only og kan oppgis med escaped \n.
LEADGRID_DISCOVERY_FLR_ENABLED=false
LEADGRID_FLR_ENVIRONMENT=test
LEADGRID_FLR_MASKINPORTEN_CLIENT_ID=
LEADGRID_FLR_MASKINPORTEN_KEY_ID=
LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY=

# Legacy shared Google OAuth envs are deprecated and should not be used in production.
# Keep them only if an older local helper script still requires them during transition.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Never place real connection URLs in tracked files. The Virtual Studio shell
# test reads PGHOST, PGUSER, PGDATABASE and PGPASSWORD from the environment.

# The Role Room Agent (OpenAI)
OPENAI_API_KEY=your-openai-api-key
ROLE_ROOM_AGENT_MODEL=gpt-5.4-mini

# The Role Room Agent (retrieval + enrichment)
COHERE_API_KEY=your-cohere-api-key
GOOGLE_PLACES_API_KEY=your-server-side-google-places-api-key

# Tripletex testmiljø (valgfritt, men nødvendig for regnskapsflyt)
TRIPLETEX_TEST_BASE_URL=https://api-test.tripletex.tech/v2
TRIPLETEX_TEST_CONSUMER_TOKEN=your-consumer-token
TRIPLETEX_TEST_EMPLOYEE_TOKEN=your-employee-token
# Optional expiration date in YYYY-MM-DD
TRIPLETEX_TEST_SESSION_EXPIRATION_DATE=2030-01-01
```

## Deployment

Deployed to Render. Configure environment variables in Render dashboard.

For Google in production:

- use an `External` OAuth app in the `creatorhubn-com` Google Cloud project
- use a dedicated CreatorHub web client with:
  - `https://creatorhubn.com`
  - `https://creatorhubn.com/api/creatorhub/google/oauth/callback`
- use a dedicated The Role Room web client with:
  - `https://theroleroom.com`
  - `https://creatorhubn.com`
  - `https://theroleroom.com/api/role-room/google/oauth/callback`
  - `https://creatorhubn.com/api/role-room/google/oauth/callback`
- verify `creatorhubn.com` and `theroleroom.com` in Search Console
- keep production OAuth origins and redirects limited to live domains only
- use a server-side Google Places key for backend enrichment; browser/referrer keys will be rejected by backend requests

### Leadgrid Discovery data policy

Discovery v2 searches and scores only official Norwegian sources: BRREG Open
Data for company identity, SSB Klass for industry classification, and
Kartverket/Geonorge for location verification. Candidates stay outside CRM
until a user approves them. Runs use a fenced database queue, single-use
WebSocket tickets, per-organization monthly capacity, a maximum of five active
automatic profiles, and schedules no more frequent than once daily.

Person-oriented profiles, such as The Role Room's actor/talent profile, still
use public BRREG business identities. Approval creates a CRM lead plus a
`leadgrid_customer_contacts` talent prospect; it never creates or activates a
The Role Room talent account and never records consent by inference. The
contact is marked `notice_required` before outreach. If no privacy review has
resolved it within 90 days, the bounded daily retention job changes the CRM
lead to `do_not_contact` and the prospect to `expired`. An explicit CRM
`do_not_contact` change synchronizes to the talent prospect immediately. This
workflow is a technical safeguard, not a substitute for the customer's legal
assessment of purpose, notice and lawful basis.

The persisted BRREG `source_cursor_map` resumes at an exact raw-row offset
for each query fingerprint, so local caps and mid-page filtering do not discard
the remaining rows while the upstream ordering is stable. BRREG offset pages
are not a locked snapshot: insertions or deletions ahead of a stored cursor
between runs can cause repeats or, rarely, skips. Leadgrid identity deduplication
absorbs repeats, but the integration does not claim snapshot consistency.

Google Places is not part of v2 search, radius filtering, scoring, or candidate
persistence. The optional adapter is available only as a user-initiated,
transient detail view. CRM promotion has one narrow exception: when the user
explicitly confirms a match, only its Google Place ID may be persisted together
with confirmation time and Discovery provenance. Place IDs are exempt from
Google Maps Platform content-cache restrictions; all other Places content stays
transient:

- the Discovery profile must explicitly set `places_details_enabled=true`;
  existing and profile-less runs fail closed
- the iOS client calls
  `POST /api/leadgrid/projects/:projectId/discovery/runs/:runId/candidates/:candidateId/place-details`
  only after the user opens Google Maps details for one candidate
- the backend sends a bounded Text Search (New) request with a server-side
  `GOOGLE_PLACES_API_KEY`; the client cannot provide a query, URL, field mask,
  key, radius or result count
- the response is capped at three matches, carries `Cache-Control: no-store`,
  is not written to Discovery, and never contributes to a score
- names, ratings, phone numbers, addresses, websites and other Place details
  are never copied into CRM; for later choice validation, the backend stores at
  most the three returned Place IDs as user-, candidate-, project- and
  run-scoped attestations
- an attestation is usable for 15 minutes; both consumed and unconsumed expired
  attestations are scheduled for deletion by the existing daily retention cron
- each run deletes at most 20 batches of 500 rows (10,000 total); if an
  index-backed remainder probe still finds expired rows, the endpoint returns
  `place_confirmation_retention_backlog` with HTTP 503 so the workflow alerts,
  and later successful runs continue the bounded cleanup
- only an explicitly confirmed, still-valid attested Place ID is stored during
  CRM promotion and then follows the lead's retention lifecycle
- Google Maps and third-party attribution are rendered in a separate detail
  sheet, never on Apple Map
- set `LEADGRID_DISCOVERY_PLACES_DETAILS_ENABLED=false` as an immediate kill
  switch without changing profile data

Restrict the Google Cloud key to Places API (New). When the production host has
stable outbound addresses, also apply server-IP restrictions. Never ship this
key in the iOS app or configure it as a browser-referrer key.

Apply `0522_leadgrid_discovery_profile_targeting.sql` before enabling the
adapter. Apply `0556_leadgrid_discovery_place_confirmation_retention.sql`
before deploying the retention-aware backend so cleanup is index-backed across
both consumed and unconsumed attestations. Apply
`0566_leadgrid_discovery_profile_templates_and_talent_privacy.sql` before
deploying Role Room template reconciliation or person-oriented profiles.

### Leadgrid Discovery campaign runs

An ordered Discovery campaign is one project-scoped server workflow, not four
client-side start calls. Apply `0554_leadgrid_discovery_campaign_runs.sql` and
then `0555_leadgrid_discovery_source_cursor_map.sql` before deploying a backend
or worker that exposes campaign routes. The iOS client may close after start;
the durable `leadgrid_discovery_campaign_tick` worker advances exactly one
profile at a time and the client only reads status.

Campaign endpoints are scoped below
`/api/leadgrid/projects/:projectId/discovery/campaign-runs`: `POST /` starts an
ordered list of `{profile_id, expected_version}` snapshots, `GET /` lists
history, `GET /:campaignId` returns items and attempts, and idempotent
`POST /:campaignId/{advance,retry,cancel}` commands control the state machine.
Campaign states are `queued → running → completed|partial|failed`, with
`cancel_requested → cancelled` for cancellation. Item/attempt history retains
the child run IDs so each territory's candidates remain directly accessible.

Start confirmation freezes the canonical brief, profile version and BRREG
cursor map for every ordered item. Later profile edits apply only to the next
campaign. Every new child launch still revalidates the original initiator's
current project membership and `lead_research.run` permission. Tenant/project
scope, deterministic child idempotency keys, generation-fenced worker ticks and
terminal worker-exhaustion handling are server invariants; client polling must
never be required for progression.

### Leadgrid release order and evidence

Migration filenames are dependency order, not an instruction to cherry-pick
individual SQL files. From `backend/`, the canonical
`node scripts/run-production-migrations.mjs` runner applies every pending
migration in `sort -V` order under one advisory lock and verifies checksums.
It requires the direct PostgreSQL endpoint and the configured migration roles;
a pooled `-pooler` endpoint is rejected.

Use this expand-first release sequence:

1. Keep `LEADGRID_DISCOVERY_ENABLED=false`. Before migration `0526`, inventory
   Public API key owners and warn owners whose organization has zero or multiple
   eligible customer projects. `0526` auto-binds only the unambiguous
   single-project case; every ambiguous legacy key is revoked with
   `project_scope_migration_requires_rotation` and needs a deliberately issued
   replacement key.
2. Run the canonical migration runner for all pending files. Relevant gates are:
   - `0473` before campaign orchestration (`0554`) and BRREG cursor state
     (`0555`)
   - `0522` before transient Places details and its retention index (`0556`)
   - `0523` before server-derived outcome attribution (`0553`)
   - `0527` and `0528` before the new idempotent iOS contact logging and its
     distinct SMS/WhatsApp channel values
3. Rotate any key revoked by `0526`, bind the replacement to its intended
   customer project, and update the connector secret. A plaintext replacement
   key is shown only when it is created.
4. Run `node scripts/run-production-migrations.mjs --expect-zero`; do not
   continue while the migration ledger reports pending or checksum-invalid
   files.
5. Deploy every backend and worker instance with Discovery still disabled.
   Verify application health, worker lease/heartbeat behavior, campaign polling,
   Public API project boundaries, outcome replay, and the daily retention cron.
6. Enable Discovery in a separate configuration deploy only after every old
   worker is gone. The rollback lever is the feature flag; do not roll back the
   additive migrations.
7. Release iOS/TestFlight last, after the deployed backend contract and
   migrations have been verified end to end.

This checklist is a release gate, not deployment evidence. A migration or source
file being present in this repository does not mean it has run in production,
and no backend deployment or TestFlight upload is implied by this document.

### MedSide, Fastlegeregisteret and Legelisten

The `medside.gp_offices` profile uses the authorized NHN public FLR endpoint;
all other MedSide profiles use BRREG/SSB/Geonorge. FLR is fail-closed unless all
five `LEADGRID_*FLR*` values above are valid. Production activation also
requires written confirmation covering commercial reuse, retention,
attribution, updates/deletion and HPR handling. Deploy configuration changes
must follow the repository's single-key PUT rule; never replace the complete
Render environment map.

Leadgrid stores the office as the CRM account. Named doctors are added only
after manual office approval, without raw HPR, gender, patient capacity or
waiting-list data. They are marked `notice_required` / `not_requested` for
privacy review before outreach.

Legelisten is not a Discovery provider. Its published terms prohibit repeated
or systematic copying without written consent, so no scraping, consumer API
calls, ratings or profile imports may be added. A future integration requires a
written partner contract and a separately reviewed provider implementation.

### External contact and calendar proof boundaries

Phone, SMS, WhatsApp and email actions hand off to another iOS app. A successful
OS open means only that the external app opened; it is not a carrier/provider
delivery receipt. Leadgrid writes a CRM activity only after the user explicitly
answers that the call or message was completed. A cancelled confirmation or
failed app open writes nothing. Organization, customer project and lead scope
are checked again before persistence.

If that confirmed CRM write is queued offline, the queue later sends only the
idempotent activity log; it never sends the call, SMS, WhatsApp message or
email. Reports must therefore describe these rows as user-attested contact
activities, not independently verified delivery.

The map's `ScheduleMeetingSheet` is a known calendar boundary: its invite and
calendar controls are currently preview-only. The primary action shows that
persistence is unavailable; it neither creates a meeting record nor sends an
invitation nor writes to a calendar until a verified, project-scoped meeting
write and calendar integration are connected. It must not be counted as a
booked or completed meeting.

## Project Structure

```
server/              # Express application
shared/              # Shared types with frontend
scripts/             # Database and utility scripts
migrations/          # Database migrations
drizzle.config.ts    # Drizzle ORM configuration
```
