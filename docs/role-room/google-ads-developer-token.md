# Google Ads developer-token — søknadspakke for Creatorhub

Denne dokumentet inneholder alt du trenger for å søke om et **Basic Access**
Google Ads developer-token til Role Room, ferdig-utfylt for Creatorhubs
use case (administrere annonser på vegne av kunder, første live-kunde:
MedInnova/PreVisit fra 2026-06-01).

> **Hvorfor du trenger dette:** Uten developer-token kan ikke
> `role-room-google-ads.ts` snakke med Google Ads API. Sweep-en skip-er
> Google-grenen med `missing_dispatcher`. Med token kan vi hente insights +
> opprette/pause kampanjer programmatisk på vegne av kunder du har MCC-
> tilgang til.

---

## 1. Forutsetninger — sjekkliste før du går inn i skjemaet

| Krav | Status | Notat |
|------|--------|-------|
| **Google Ads Manager-konto (MCC)** | ⚠️ verifiser | Du må søke fra MCC-konto, ikke vanlig Google Ads-konto. Opprett gratis på <https://ads.google.com/intl/en/home/tools/manager-accounts/> hvis du ikke har det. |
| **Personvernerklæring publisert** | ⚠️ verifiser | URL kreves i skjemaet. Hvis ikke finnes: minimum-versjon på creatorhubn.com/privacy som dekker behandling av kunde-annonsedata. |
| **Vilkår for bruk publisert** | ⚠️ verifiser | URL kreves. creatorhubn.com/terms holder. |
| **Tool URL** | ✅ | `https://creatorhubn.com` eller `https://theroleroom.com`. |
| **Kontakt-e-post** | ✅ | `daniel@creatorhubn.com`. |
| **MCC-konto-ID for hvor du logger inn** | ⚠️ verifiser | 10-sifret nummer øverst i Google Ads etter du er logget inn på MCC. |
| **Forretningsmodell-beskrivelse** | ✅ klar (se §3 nedenfor) | |
| **Use-case-beskrivelse** | ✅ klar (se §3) | |
| **Compliance-bekreftelse** | ✅ klar (se §3) | Du må godta Google Ads API Terms + Required Minimum Functionality. |

**Gjør disse to tingene FØRST hvis de mangler:**

1. **Opprett MCC-konto** hvis du kun har vanlig Google Ads. MCC er gratis,
   tar 5 minutter, og er separat fra din egen konto. MCC-en din administrerer
   senere alle kunde-kontoene (MedInnova etc.) ett sted.
2. **Publiser privacy + terms** på creatorhubn.com hvis ikke finnes. Google
   sjekker at URL-ene resolve-er — minimum-versjoner som beskriver hva systemet
   gjør holder for godkjenning.

---

## 2. Hvor du søker

1. Logg inn på <https://ads.google.com> med MCC-kontoen din (sjekk konto-ID
   øverst — den skal være MCC-en, ikke en sub-konto).
2. Klikk **Verktøy og innstillinger** (skiftenøkkel-ikon, øverst til høyre).
3. Under «Oppsett» → klikk **API-senter**.
4. Klikk **Søk om Basic-tilgang** (eller «Apply for access» hvis engelsk-UI).
5. Skjemaet åpner seg.

---

## 3. Ferdig-utfyllte svar (kopier inn i skjemaet)

Google bruker engelsk-skjema selv om Google Ads-UI er på norsk. Svarene
nedenfor er på engelsk og målrettet mot Creatorhubs use case.

### Section: Contact information

| Felt | Svar |
|------|------|
| Contact name | `Daniel Qazi` |
| Contact email | `daniel@creatorhubn.com` |
| Phone | (ditt telefonnummer, +47 …) |
| Company name | `Creatorhub AS` |
| Company website | `https://creatorhubn.com` |

### Section: Business model

| Felt | Svar |
|------|------|
| Business model | **Commercial — I manage Google Ads accounts on behalf of third-party advertisers (agency / SaaS).** |

### Section: Tool details

**Tool name:**
```
Role Room (by Creatorhub)
```

**Tool URL:**
```
https://creatorhubn.com
```

**Tool description (det viktigste feltet — Google leser dette nøye):**
```
Role Room is a content-production SaaS for marketing producers who run
advertising campaigns on behalf of small and mid-size business clients.
The producer logs in to Role Room, the client grants admin access to their
Google Ads customer ID (or links the MCC), and Role Room then provides:

1. A unified dashboard showing daily spend, CTR, CPC, conversions, ROAS
   and cost-per-conversion across Meta, Google Ads and LinkedIn — refreshed
   nightly via the Google Ads Reporting API (GAQL searchStream on the
   campaign resource).

2. Campaign management (create campaign with daily budget, pause / resume /
   end) using campaignBudgets.mutate + campaigns.mutate, so producers don't
   have to context-switch to the Google Ads UI for each client.

3. AI-assisted recommendations: a daily analysis that reads the client's
   own performance data and suggests budget reallocation, underperformer
   pauses, and creative refresh — purely advisory, no automated actions.

4. A client-controlled spend cap with optional auto-pause when the
   client's monthly budget is reached, enforced via campaigns.mutate to set
   status=PAUSED. The client must explicitly opt in to auto-pause.

The producer uses OAuth 2.0 to obtain access on a per-client basis (the
client grants admin role on their customer ID; Role Room stores only the
refresh token, never the client's Google credentials). All write operations
happen against accounts the producer has been explicitly granted admin
access to. We use listAccessibleCustomers + the adAccountUsers-equivalent
to verify access before any mutation, returning 403 to the user if access
has been revoked.

Why API access is required (vs. using the Google Ads UI):
- Unified cross-channel reporting (Google + Meta + LinkedIn in one view)
  requires programmatic ingestion of metrics.
- Producers manage 10+ client accounts; manual UI navigation per-client per-
  day is the operational pain point Role Room solves.
- The AI recommendations layer requires structured access to performance
  metrics not available via UI export at the cadence we run them.
```

**What does the tool do? (kortere variant — hvis skjemaet ber om punktliste)**
```
- Daily ingestion of campaign-level metrics (impressions, clicks, cost,
  conversions, conversionsValue) via GAQL.
- Campaign creation, pause/resume/end via campaignBudgets.mutate and
  campaigns.mutate.
- Optional client-controlled auto-pause when the monthly spend cap is
  reached.
- AI-assisted advisory recommendations based on performance trends — never
  triggers automatic mutations.
```

### Section: API features

| Felt | Svar |
|------|------|
| API features needed | **Reporting (GAQL searchStream), Campaign management (create campaigns + budgets + pause/resume status changes).** |
| Bid management? | No |
| Automated rules? | No |
| Account-level changes (billing, etc.)? | No |

### Section: Access pattern

| Felt | Svar |
|------|------|
| Authentication method | **OAuth 2.0 (Web application flow).** Each advertiser (client) grants admin role on their customer ID to the producer; Role Room stores only the refresh token, encrypted at rest in PostgreSQL. |
| Number of advertisers using the tool | **1 active (2026-06-01 launch with MedInnova/PreVisit). Pipeline: estimated 5–10 within first 12 months.** |
| Expected daily API operations | **<500/day per advertiser** in steady state. Volume: daily insights pull (~10 calls per campaign per day) + occasional mutations (campaign create/status changes — handful per week). Well under Basic Access 15,000 ops/day limit even for 10 advertisers. |
| Where does the tool run? | **Server-side (Node.js backend hosted on Render). No client-side API calls.** |

### Section: Data handling

| Felt | Svar |
|------|------|
| Do you store advertiser data? | **Yes — daily aggregated metrics (spend, impressions, clicks, conversions, conversionValue) are cached in our PostgreSQL database (ads_attribution_daily table) for the cross-channel reporting view. Raw account data is not stored beyond what is required for the dashboard. Refresh tokens are encrypted at rest.** |
| Do you share advertiser data with third parties? | **No.** |
| Data retention | **Performance metrics: retained while the producer-client engagement is active, deleted on request. Refresh tokens: deleted when access is revoked by the advertiser.** |

### Section: Compliance

| Felt | Svar |
|------|------|
| Privacy policy URL | `https://creatorhubn.com/privacy` |
| Terms of service URL | `https://creatorhubn.com/terms` |
| I agree to the Google Ads API Terms | ✅ |
| I will respect the Required Minimum Functionality (RMF) | ✅ |
| I will not exceed rate limits | ✅ |

---

## 4. Etter innsending

**Saksbehandling:** Basic Access tar typisk **1–7 virkedager**. Du får
svar på samme e-post du oppga.

### Hvis godkjent

1. Du får en token i API-senteret (Verktøy → API-senter på MCC-en).
2. Gi tokenet til meg (eller sett selv via Render-API):
   - Render → backend-service `creatorhub-backend` → Environment →
     **Add Environment Variable** → `GOOGLE_ADS_DEVELOPER_TOKEN` = (verdien).
   - Trigger en redeploy.
3. Når deploy er live: bekreft i Role Room → Økonomi → "Tilganger du har gitt"
   at Google-kortet aktiveres første gang en produsent kobler en kunde-ID.

### Hvis avslått

Google sender konkret grunn — ofte:
- **Tool URL resolverer ikke** → sjekk at creatorhubn.com fungerer.
- **Privacy/terms-URL 404** → publiser dem først.
- **Beskrivelsen for vag** → bruk §3-svarene over, de er konkrete nok.
- **For lav forventet aktivitet** → underestimer ikke; faktiske bruksvolumer
  for live agency er typisk over 100 calls/dag selv med én kunde.

Re-søk via samme skjema med justert info. Vanligvis godkjent etter andre
forsøk.

### Standard Access (senere)

Når dere har 5+ aktive kunder kan dere søke Standard Access (45,000 ops/dag).
Krever screencast som demonstrerer tool-en. Ikke kritisk nå.

---

## 5. Hva som skjer på vår side når token er satt

Cron-en (`role-room-ads-cron.ts` → `buildAdsConnectorRegistry`) sjekker
allerede etter `GOOGLE_ADS_DEVELOPER_TOKEN`-env-varen. Med tokenet på plass
vil det daglige `attribution-tick`-endepunktet:

1. Resolve Google-token per produsent (via OAuth-connection),
2. Kjøre GAQL `searchStream` mot hver kampanje med `external_campaign_id`
   som matcher Google-mønsteret (`customers/{cid}/campaigns/{id}`),
3. Persiste daglig spend → `ads_attribution_daily` → påslag-ledger.

Auto-pause-dispatcher-en (`role-room-ads-auto-pause.ts`) får da også
mulighet til å kjøre `setGoogleCampaignStatus(PAUSED)` — uten tokenet
skip-es Google-kampanjer med `missing_dispatcher`.

Lag 2 AI-anbefalingene leser samme channel-summary, så de vil automatisk
begynne å snakke om Google også når Google-tallene begynner å komme inn.

**Med andre ord: alt på vår side er klart. Tokenet er den siste brikken
for at Google-grenen skal slå inn.**
