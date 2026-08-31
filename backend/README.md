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

Google Places is not part of v2 search, radius filtering, scoring, candidate
persistence, or CRM promotion. The optional adapter is available only as a
user-initiated, transient detail view:

- the Discovery profile must explicitly set `places_details_enabled=true`;
  existing and profile-less runs fail closed
- the iOS client calls
  `POST /api/leadgrid/projects/:projectId/discovery/runs/:runId/candidates/:candidateId/place-details`
  only after the user opens Google Maps details for one candidate
- the backend sends a bounded Text Search (New) request with a server-side
  `GOOGLE_PLACES_API_KEY`; the client cannot provide a query, URL, field mask,
  key, radius or result count
- the response is capped at three matches, carries `Cache-Control: no-store`,
  is not written to Discovery or CRM, and never contributes to a score
- Google Maps and third-party attribution are rendered in a separate detail
  sheet, never on Apple Map
- set `LEADGRID_DISCOVERY_PLACES_DETAILS_ENABLED=false` as an immediate kill
  switch without changing profile data

Restrict the Google Cloud key to Places API (New). When the production host has
stable outbound addresses, also apply server-IP restrictions. Never ship this
key in the iOS app or configure it as a browser-referrer key.

Discovery must be rolled out in two phases:

1. Apply `migrations/0473_leadgrid_discovery_platform.sql` before deploying
   this code. The shared worker queue reads `background_jobs.lease_token`
   independently of the Discovery feature flag.
2. Deploy every web and worker instance with
   `LEADGRID_DISCOVERY_ENABLED=false`.
3. Verify the migration, application health, queue heartbeats and that all old
   worker instances have been replaced.
4. Enable `LEADGRID_DISCOVERY_ENABLED=true` in a separate deploy. Roll back by
   disabling the flag; do not roll back the additive migration.

## Project Structure

```
server/              # Express application
shared/              # Shared types with frontend
scripts/             # Database and utility scripts
migrations/          # Database migrations
drizzle.config.ts    # Drizzle ORM configuration
```
