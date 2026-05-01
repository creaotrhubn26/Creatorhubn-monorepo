# WhatsApp App Review — Runbook

Slik tar du opp og leverer Meta App Review-screencasts for permissions
`whatsapp_business_messaging` og `whatsapp_business_management`.

## 0. Forutsetninger

- Verifisert Meta sandbox WhatsApp-nummer (Phone Number ID).
- Et System User med `whatsapp_business_management` + `whatsapp_business_messaging` scopes, og et permanent token (250+ tegn).
- WABA (WhatsApp Business Account) ID for det samme business managerene.
- Et eget test-mobilnummer som skal motta meldingene, lagt inn i Meta sandbox' allowed-recipients-liste.
- Lokal Playwright + Chromium installert (`npx playwright install chromium`).

## 1. Sett env på Render (én gang)

| Var | Verdi |
| --- | --- |
| `META_APP_ACCESS_TOKEN` | System User permanent token (`EAA…`) |
| `META_APP_SECRET` | Meta App Secret (for webhook-signatur) |
| `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Tilfeldig streng — samme som limt inn i Meta webhook-config |
| `WHATSAPP_PHONE_NUMBER_ID` | Sandbox sender phone-number-id |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA-ID |
| `WHATSAPP_DEMO_BYPASS_TOKEN` | Sterk random streng (rotér etter App Review er godkjent) |

`WHATSAPP_DEMO_BYPASS_TOKEN` lar Playwright omgå admin-login når den
besøker `/admin/whatsapp-*?token=…`. Endepunktene leser også `x-demo-token`
som header — bruk header-pathen utenfor recordings.

## 2. Konfigurer Meta webhook

I Meta Business Manager → din WhatsApp Business App → Configuration →
Webhooks:

- Callback URL: `https://creatorhub-backend-rtbl.onrender.com/api/role-room/whatsapp/webhook`
- Verify Token: samme som `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Subscribe til alle 13 fields (`messages`, `message_template_status_update`, …) — vi persister dem alle til `role_room_whatsapp_events`.

Bekreft at Meta får `200 OK` på challenge-requesten — da er verify-tokenet riktig.

## 3. Last ned local recording-state (én gang)

`backend/scripts/record-whatsapp-app-review-demo.playwright.mjs` cacher
login-state i tre filer i repo-rot:

- `.role-room-admin-state.json` — admin-session for The Role Room
- `.whatsapp-web-state.json` — web.whatsapp.com QR-scan
- `.meta-business-state.json` — Meta Business Manager SSO

Første kjøring åpner browseren og lar deg logge inn manuelt; deretter
gjenbruker scriptet state. Filene er i `.gitignore`-listen og skal **aldri**
committes.

## 4. Lokal env-fil

Oppretter `backend/.env.whatsapp.demo.local` (autogenereres ved første prompt):

```bash
APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
META_APP_ACCESS_TOKEN=EAA...
WHATSAPP_PHONE_NUMBER_ID=1169284516262990
WHATSAPP_BUSINESS_ACCOUNT_ID=1526002049163077
DEMO_RECIPIENT_PHONE_E164=+47XXXXXXXX
WHATSAPP_DEMO_BYPASS_TOKEN=<samme som Render>
```

## 5. Kjør recordingen

```bash
cd backend
node scripts/record-whatsapp-app-review-demo.playwright.mjs
```

Scriptet spiller inn to videoer i `recordings/`:

1. `whatsapp-messaging-demo-<ts>.webm` — sender hello_world til testnummeret
2. `whatsapp-template-demo-<ts>.webm` — oppretter `audition_reminder_24h_no`

Title-cards og step-captions er innebygget; ingen post-prod nødvendig.
Trim eventuelt med `ffmpeg`.

## 6. Verifiser resultat

- Send-demo: åpne `/admin/whatsapp-inbox?token=<bypass>` på Render — du
  skal se en utgående `messages.statuses=sent`-rad i `events-debug` og,
  hvis testnummeret svarer, en `inbound`-melding i inboxen.
- Template-demo: i Meta Business Manager → WhatsApp Manager → Templates,
  skal `audition_reminder_24h_no` ligge med status `In Review` eller `Approved`.

## 7. Etter App Review er godkjent

1. Fjern `WHATSAPP_DEMO_BYPASS_TOKEN` fra Render.
2. Slett `.env.whatsapp.demo.local` lokalt.
3. Roter `META_APP_ACCESS_TOKEN` (system user → revoke + reissue).
4. (Anbefalt) Fjern `?token=` query-string-pathen i `isDemoBypassed` slik at
   bypass kun virker via `x-demo-token`-header — query-strings havner i
   access-logs.

## Endepunkt-oversikt

| Path | Bruk |
| --- | --- |
| `GET /admin/whatsapp-app-review-demo` | Demo-side for `whatsapp_business_messaging` |
| `GET /admin/whatsapp-create-template` | Demo-side for `whatsapp_business_management` |
| `GET /admin/whatsapp-inbox` | Live inbox for incoming-meldinger |
| `POST /api/role-room/whatsapp/test-send` | Sender hello_world-template via Meta Cloud API |
| `POST /api/role-room/whatsapp/create-template` | Oppretter template via Meta Graph API |
| `POST /api/role-room/whatsapp/inject-test-inbound` | Injiser syntetisk inbound for demo |
| `GET /api/role-room/whatsapp/inbox` | JSON: siste inbound-meldinger |
| `GET /api/role-room/whatsapp/events-debug` | JSON: alle webhook-events |
| `GET /api/role-room/whatsapp/webhook` | Meta verify-token challenge |
| `POST /api/role-room/whatsapp/webhook` | Meta webhook-receiver (HMAC-validert) |

## Feilsøking

- **`401 invalid signature` i logs:** sjekk at `META_APP_SECRET` på Render er identisk med Meta App Secret, og at request-bodyen ikke blir parset før HMAC-sjekken (`express.raw()` brukes i webhook-routen).
- **`403 verify token mismatch`:** verify-tokenet i Meta-config må matche `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` (eller fallback `META_WEBHOOK_VERIFY_TOKEN`).
- **`503 WhatsApp API ikke konfigurert`:** `META_APP_ACCESS_TOKEN` eller `WHATSAPP_PHONE_NUMBER_ID` mangler på Render.
- **Recording har tomt access-token-felt:** Forventet i bypass-modus. Server rendrer en låst `🔒 loaded from server`-indikator i stedet for input — det er det reviewer skal se.
- **Playwright `.fill()` race-error på token:** Skal ikke skje lenger — bypass-modus rendrer ikke input. Hvis du ser det utenfor bypass, sett `WHATSAPP_DEMO_BYPASS_TOKEN` og bruk `?token=…` i URLen.
