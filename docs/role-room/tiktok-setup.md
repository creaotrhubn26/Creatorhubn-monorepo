# TikTok Setup for The Role Room

Status pr 2026-06-08: **infrastruktur klar, mangler kun TikTok Business app-credentials og pixel-koden**.

**Kjente faste verdier:**
- TikTok username: `user3955828441699`
- TikTok user/account ID: `7649045002449962004`
- TikTok advertiser ID: `7649045350950535189` (The Role Rooms Business Center)

## 1. Opprett TikTok Business App

Gå til <https://business-api.tiktok.com/portal/docs> → "Create App" og fyll inn:

| Felt | Verdi |
|---|---|
| App Name | `The Role Room Agent` |
| Category | Marketing automation / Ad tech |
| Description | "Multi-tenant ad-tracking-agent for content producers — orchestrates Pixel installation, conversion-events, and reporting on behalf of klients." |
| Privacy Policy URL | <https://theroleroom.com/personvern> |
| Service Agreement URL | <https://theroleroom.com/vilkar> |
| App Domain | `theroleroom.com,creatorhubn.com` |
| Redirect URLs | `https://creatorhub-backend-rtbl.onrender.com/api/admin-room/agent/ads/oauth/tiktok/callback` |
| Scopes | `advertiser.read`, `pixel.read`, `pixel.write`, `ads.read` |

Etter at app er opprettet, lagre disse fra "App Information"-fanen:

- **App ID** (numerisk)
- **Secret** (kun synlig én gang — lagres umiddelbart)

## 2. Sett env-vars på Render

```bash
RENDER_API_KEY=rnd_...
SERVICE_ID=srv-d76ob60ule4c73dv2p60

# TikTok Business app creds for Agent multi-tenant flow
curl -X PUT \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars/TIKTOK_BUSINESS_APP_ID" \
  -d '{"value": "<APP_ID_FROM_STEP_1>"}'

curl -X PUT \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars/TIKTOK_BUSINESS_APP_SECRET" \
  -d '{"value": "<SECRET_FROM_STEP_1>"}'
```

(Bruk single-key PUT-pattern — IKKE bulk-array, det overskriver alle env-vars.
Se `feedback_render_env_put_collection_replace.md` i memory.)

Vent på auto-deploy (1-2 min).

## 3. Koble Daniel's TikTok-konto i Agent

1. Logg inn på Admin Room → Role Room Agent → en klient-config (gjerne "The Role Room" som test-klient).
2. Scroll ned til "TikTok"-seksjonen.
3. Klikk "Koble TikTok" → redirectes til TikTok Business OAuth → autoriser scopes.
4. Tilbake i Agent: velg din advertiser fra dropdown.
5. Klikk "Opprett pixel for The Role Room".
6. Kopier pixel-koden (20-tegns alfanumerisk).

## 4. Installer pixel på theroleroom.com

Åpne `frontend/client/index.html` og endre:

```js
var ROLE_ROOM_TIKTOK_PIXEL_CODE = '';
```

til den ekte pixel-koden fra steg 3:

```js
var ROLE_ROOM_TIKTOK_PIXEL_CODE = 'D1ABC2DEFG3HIJ4KLMN5'; // fra TikTok Events Manager
```

Commit + force-deploy:

```bash
git add frontend/client/index.html
git commit -m "feat(theroleroom): live TikTok Pixel-code"
git push
vercel deploy --prod --yes --force
```

Pixel respekterer eksisterende GDPR consent — fyrer kun når brukeren har samtykket til analytics-cookies (`__creatorhubApplyConsent`-callback). Bygd inn i `ensureTiktokPixelLoaded()` i `frontend/client/index.html`.

## 5. Verifiser at pixel rapporterer

1. Installer "TikTok Pixel Helper" Chrome-extension.
2. Åpne <https://theroleroom.com> (eller live-URL).
3. Aksepter cookies.
4. Pixel Helper skal vise: "Pageview" event med din pixel-kode.
5. I TikTok Events Manager → din pixel → "Activity Log" skal du se aktivitet innen 2 min.

## 6. Sett opp conversion-tracking på TheRoleRoom-konverteringene

Definer relevante actions i Agent (samme klient-config):

| Action | Goal category | Trigger | TikTok event-navn (auto-mappet) |
|---|---|---|---|
| Lead Submitted (Byrå-skjema) | submit_lead_form | form_submit | SubmitForm |
| Pilot Booked | book_appointment | page_load (/pilot-takk) | Subscribe |
| Signup Producer | sign_up | page_load (/welcome) | CompleteRegistration |
| Stripe Checkout Started | begin_checkout | click (`data-track="checkout"`) | InitiateCheckout |
| Demo Studio Download | other | click | CustomEvent |

Kjør "Sync til TikTok" i TikTok-panelet → action-er får tiktok_event_name lagret.
Generér prompts i "AI-prompter for klient" — `tiktok_conversion_events`-prompten viser nøyaktig hvilke `ttq.track()`-call's som må legges i frontend-koden, og hvor.

## 7. Sett opp TikTok Events API (server-side, valgfritt men anbefalt)

I TikTok Events Manager → pixel → Settings → "Manually set up Events API" → generér access-token.

Lagre tokenet via Agent-UI: "Events API token" → `tiktok_capi_access_token`-felt.

Backend kan da videresende klient-side events til Events API for ITP-bypass + offline-konverteringer. Implementasjon: `client-tiktok-suite.ts` — `sendTiktokEvent`-helper kommer som del av Wave 4 (policy-monitor + CAPI-router).

---

## Multi-tenant-flyt for klienter

Samme prosedyre, men producer kobler **klientens** TikTok Business-konto via OAuth. Hver klient-config får sin egen pixel + token. UI ligger i Agent → Role Room Agent → klient-config → "TikTok"-seksjonen.
