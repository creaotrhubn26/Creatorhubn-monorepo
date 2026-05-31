---
title: "Role Room — Google Ads API Design Document"
subtitle: "Basic Access Application — Creatorhub AS"
date: "May 2026"
---

# Role Room — Google Ads API Design Document

**Company:** Creatorhub AS (Norway)
**Product:** Role Room — https://theroleroom.com
**Contact:** daniel@creatorhubn.com
**Document version:** 1.0 — May 2026

---

## 1. Overview

Role Room is a content-production SaaS operated by Creatorhub AS. It enables
marketing producers to manage advertising campaigns on behalf of their
small and mid-size business clients across multiple paid channels — Meta,
Google Ads, and LinkedIn — from a single, unified workflow.

This document describes how Role Room integrates with the Google Ads API
as part of the Basic Access application.

**Primary use cases:**

1. Daily cross-channel performance reporting (Google Ads metrics ingested
   alongside Meta and LinkedIn).
2. Campaign management (create campaigns with daily budgets; pause / resume /
   end campaigns programmatically).
3. AI-assisted advisory recommendations (analysis of client's own
   performance data; advisory only, no automated mutations).
4. Client-controlled monthly spend cap with optional auto-pause when the
   cap is reached.

---

## 2. System Architecture

```
┌──────────────────────┐
│ Producer (browser)   │
│  - Role Room UI      │
│  - React + Vite      │
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐         ┌─────────────────────┐
│ Role Room backend    │ ──────► │ Google Ads API      │
│  - Node.js + Express │         │  - GAQL searchStream│
│  - Hosted on Render  │         │  - campaigns.mutate │
│    (Frankfurt)       │         │  - campaignBudgets  │
└──────────┬───────────┘         └─────────────────────┘
           │
           ▼
┌──────────────────────┐
│ PostgreSQL (Neon)    │
│  - Cached metrics    │
│  - Encrypted tokens  │
└──────────────────────┘
```

**Technology stack:**

- Backend: Node.js + Express, server-side only.
- Database: PostgreSQL (Neon, EU region).
- Frontend: React + Vite, statically deployed on Vercel.
- Google Ads integration: server-side only; no API calls from the browser.

---

## 3. Authentication

OAuth 2.0 web application flow.

**Flow:**

1. Producer clicks "Connect Google Ads" in Role Room.
2. Browser redirects to Google OAuth consent screen with scope
   `https://www.googleapis.com/auth/adwords`.
3. Producer grants permission.
4. Google redirects back to our callback `/ads/google/oauth/callback` with
   an authorization code.
5. Backend exchanges the code for an access token + refresh token via
   Google's token endpoint.
6. Refresh token is encrypted at rest (AES-256-GCM) and stored in our
   `role_room_ads_oauth_connections` table along with the producer's user
   ID and the platform identifier.
7. Access tokens are short-lived (~1 hour) and refreshed on-demand via the
   helper `ensureFreshAdsToken` before each API call.

**Token security:**

- No client credentials or tokens are ever stored client-side.
- All token handling occurs in the backend; the frontend never sees a
  Google access token.
- Refresh tokens are deleted from the database when the producer disconnects
  the Google integration, or when the advertiser revokes access via Google
  Ads UI (detected on next API call returning an auth error).

---

## 4. Google Ads API Endpoints Used

### Reporting (read-only, via `googleAds:searchStream`)

- **Verify access** — `customers:listAccessibleCustomers`
  Called before every write operation. If the target customer ID is not in
  the producer's accessible list, the operation returns HTTP 403 to the
  user and no API call is made.

- **Daily campaign performance** — GAQL:

  ```sql
  SELECT
    segments.date,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE campaign.id = ?
    AND segments.date BETWEEN ? AND ?
  ```

  Run nightly per active campaign by the cron job
  `runAdsAttributionSweep`. One query per campaign per day.

### Mutations (via `googleAds:mutate`)

- **`campaignBudgets:mutate`** — create a daily budget when the producer
  creates a new campaign.
- **`campaigns:mutate`** — create a new campaign (status = PAUSED by
  default), or update status (PAUSED, ENABLED, REMOVED) when the producer
  pauses, resumes, or ends a campaign.

### Operation volume

- Reporting: ~1 GAQL call per campaign per day.
- Mutations: typically fewer than 10 per day per advertiser (campaign
  creation + status changes happen infrequently in steady state).
- **Estimated total: under 500 operations per day per advertiser**, well
  under the Basic Access limit of 15,000 operations per day.

---

## 5. Data Storage and Retention

### Cached data (PostgreSQL)

- **`ads_attribution_daily(campaign_id, date, impressions, clicks,
  spend_nok, conversions, conversion_value_nok, ctr, cpc, cpm, roas,
  raw_metrics)`** — daily aggregated metrics per campaign per day.
  Idempotent upsert on `(campaign_id, date)`. Feeds the producer + client
  dashboard.

- **`ads_campaigns(id, project_id, user_id, platform, external_campaign_id,
  status, daily_budget_nok, ...)`** — campaign metadata (project link,
  user owner, platform, external ID for re-syncing).

- **`role_room_ads_oauth_connections(user_id, platform, encrypted_access_token,
  encrypted_refresh_token, expires_at)`** — encrypted OAuth tokens, unique
  on `(user_id, platform)`.

- **`role_room_ads_recommendations(project_id, period, recommendations
  jsonb)`** — AI-generated advisory recommendations (no automated actions).

### Retention

- Performance metrics: retained while the producer-client engagement is
  active. Deleted on advertiser request (GDPR-compliant).
- Refresh tokens: deleted when the producer disconnects the integration or
  the advertiser revokes access in Google Ads UI.
- Audit trail: every API call logged with timestamp, status code, user
  context (retained 90 days).

---

## 6. Access Verification

Before every write operation:

1. Backend resolves the producer's Google Ads OAuth token via
   `resolveAdsAccessToken(pool, 'google', userId)`.
2. Calls `customers:listAccessibleCustomers` to verify the target
   customer ID is in the producer's accessible list.
3. If access is missing, returns HTTP 403 to the user immediately. No
   mutation is sent to Google.

This pattern is mirrored across all three platforms we integrate with
(Meta, Google, LinkedIn) and is exposed in the Role Room UI as the
"Granted Assets" card — clients can see at any time exactly which Page
or Customer ID Role Room has access to on their behalf.

---

## 7. User Interface

Two distinct user roles interact with Role Room:

### Producer (logged-in user)

- Connects Google Ads via OAuth (once per Google account).
- Creates and manages campaigns on behalf of each client (the producer's
  "projects").
- Views cross-channel dashboard with Google + Meta + LinkedIn metrics.
- Receives AI-generated advisory recommendations (advisory only —
  producer decides whether to act).

### Client (advertiser)

- Views read-only "Economy" tab in their Role Room workspace:
  - Daily ad spend + 20% management fee (transparent billing).
  - Per-channel results (CTR, CPC, conversions, ROAS).
  - Monthly budget cap that the client sets themselves.
  - Optional auto-pause toggle: when ON, Role Room pauses all active
    campaigns the moment the period spend reaches the cap (client-
    controlled enforcement; OFF by default).
  - The list of which Google Ads customer IDs they have granted
    Role Room access to.

---

## 8. Compliance

- **Privacy policy:** https://theroleroom.com/privacy
- **Terms of service:** https://theroleroom.com/terms
- **Required Minimum Functionality (RMF):** complied with (campaign
  management features are implemented per Google's specification).
- **Google Ads API Terms:** accepted on submission of this application.
- **Rate-limit awareness:** the backend implements exponential backoff
  on transient errors (HTTP 429, 500, 503).
- **No automated bid management.** Role Room does not modify bids
  algorithmically; bid strategies are set by the producer/client and
  Role Room does not touch them.
- **No automated decision-making against advertiser interests.** All
  mutations are initiated by an authenticated producer; AI
  recommendations are advisory only and never trigger automatic actions
  beyond the client-controlled auto-pause toggle (which the client
  explicitly opts in to and can disable at any time).

---

## 9. Roadmap

| Date           | Milestone                                              |
|----------------|--------------------------------------------------------|
| 2026-06-01     | First commercial client live (MedInnova/PreVisit)      |
| 2026 Q3        | Onboarding 5–10 client accounts via MCC                |
| 2026 Q4        | Apply for Standard Access (subject to volume justifying it) |

Standard Access will be requested when steady-state daily operation
volume across all clients consistently approaches the 15 000/day limit
of Basic Access.

---

## 10. Contact

For questions about this design or the integration:

- **Daniel Qazi** — daniel@creatorhubn.com
- **Company:** Creatorhub AS, Norway
- **Product:** Role Room — https://theroleroom.com

*End of design document.*
