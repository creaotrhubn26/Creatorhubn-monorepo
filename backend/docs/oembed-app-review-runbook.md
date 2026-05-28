# Meta App Review — oEmbed Read Runbook

For permission/feature: **oEmbed Read** (Meta App ID `1042181045651851` — The Role Room).

Slik tar du opp og leverer screencast + tekstene Meta-skjemaet trenger.

## 0. Forutsetninger

- Meta App er i Development mode (eller du er som Developer på Live-appen).
- `META_APP_ID` + `META_APP_SECRET` satt på Render.
- `WHATSAPP_DEMO_BYPASS_TOKEN` allerede satt på Render — vi gjenbruker den
  samme tokenen for å bypasse admin-auth i recording (samme `isDemoBypassed`).
- Et offentlig Instagram-post-URL og et offentlig Facebook-post-URL klart.
  Bekreft i incognito at de er offentlige før recording.

## 1. Lokal env-fil

Opprett `backend/.env.oembed.demo.local` (gitignored):

```bash
APP_BASE_URL=https://creatorhub-backend-rtbl.onrender.com
WHATSAPP_DEMO_BYPASS_TOKEN=<samme som på Render>
DEMO_INSTAGRAM_POST_URL=https://www.instagram.com/p/Cxxxxxxxxx/
DEMO_FACEBOOK_POST_URL=https://www.facebook.com/.../posts/...
```

## 2. Sanity-test demo-siden manuelt

```
https://creatorhub-backend-rtbl.onrender.com/admin/oembed-app-review-demo?token=<bypass>
```

Lim inn Instagram-URL → klikk **Fetch oEmbed** → preview-pane skal vise embedet
og JSON-panelet skal vise hele Meta-responsen (`html`, `author_name`,
`provider_name`, osv.).

Gjenta med Facebook-URL.

Hvis 503 «META_APP_ID / META_APP_SECRET not configured» → mangler env på Render.
Hvis Meta returnerer feil → sjekk at posten er offentlig og at oEmbed Read er
tilgjengelig for app-rollen din (Developers har det i Development mode).

## 3. Kjør recordingen

```bash
cd backend
node scripts/record-oembed-app-review-demo.playwright.mjs
```

Scriptet spiller inn én video `recordings/oembed-read-demo-<ts>.webm`:

1. Title card: «Meta oEmbed Read — App Review demo».
2. Step 1: lim inn Instagram-URL (markert med pulsende grønn outline).
3. Step 2: klikk «Fetch oEmbed».
4. Step 3: vis live preview + raw Meta-respons.
5. Step 4: gjenta med Facebook-URL for å vise multi-endpoint-håndtering.
6. End card.

Captions og title-cards er injisert i recordingen — ingen post-prod trengs.
Trim eventuelt med `ffmpeg`.

## 4. Use-case text (paste i Meta-skjemaet, engelsk)

> The Role Room is a Norwegian B2B SaaS used by content producers and creator
> agencies to plan social media for their clients (restaurants, retail, cultural
> institutions). The oEmbed Read feature lets us render verified public Facebook
> and Instagram posts inside the producer's planning dashboard and on the
> client-facing landing pages: a producer can drop a public Instagram reel URL
> into a content-plan card to use as a creative reference, or embed a featured
> brand post on the campaign landing page so visitors see authentic public
> content rather than scraped screenshots. The backend calls the Graph API
> endpoints `/v21.0/instagram_oembed`, `/v21.0/oembed_post`, `/v21.0/oembed_video`
> and `/v21.0/oembed_page` with our App Access Token, and renders the returned
> `html` directly. No private data is requested or stored — only the publicly
> available embed markup Meta returns.

## 5. Reviewer test instructions (paste i App Review-skjemaet)

> 1. Navigate to `https://creatorhub-backend-rtbl.onrender.com/admin/oembed-app-review-demo?token=<DEMO_BYPASS_TOKEN provided in submission notes>`.
> 2. Paste a public Instagram post URL (for example `https://www.instagram.com/p/Cxxxxxxxxx/`) into the URL field.
> 3. Click **Fetch oEmbed**. The backend calls `https://graph.facebook.com/v21.0/instagram_oembed` and returns the embed HTML.
> 4. The "Live Preview" pane renders the embed inline; the "Raw Meta Graph API Response" pane shows the full JSON response from Meta.
> 5. Repeat with a public Facebook post URL (for example `https://www.facebook.com/<page>/posts/<id>`) — the backend automatically routes to `/v21.0/oembed_post` instead.
> 6. Both flows demonstrate the same `oEmbed Read` feature against the two supported product surfaces.

## 6. Etter App Review er godkjent

1. Fjern `WHATSAPP_DEMO_BYPASS_TOKEN` fra Render (eller roter den).
2. Slett `backend/.env.oembed.demo.local` lokalt.
3. (Anbefalt) Fjern `?token=`-bypass-pathen fra `isDemoBypassed`, behold kun
   `x-demo-token`-header — query-strings havner i access-logs.

## 7. Endepunkt-oversikt

| Path | Bruk |
| --- | --- |
| `GET /api/role-room/embed/oembed?url=<post-url>` | Kaller Meta Graph oEmbed-endepunktet, returnerer `{ success, kind, endpoint, data }` |
| `GET /admin/oembed-app-review-demo` | Demo-side for screencast (bypass via `?token=` eller `x-demo-token`) |

## Feilsøking

- **400 `URL must point to a public Facebook or Instagram post`** → vi gjenkjenner kun `instagram.com/*` og `facebook.com/*`. Sjekk URL-en.
- **`meta_oembed_failed` med 400 fra Meta** → posten er sannsynligvis ikke offentlig, eller oEmbed Read er ikke aktiv for app-rollen. Test posten i incognito for å bekrefte offentlig-status.
- **`meta_oembed_failed` med 403/100** → access_token gyldig, men appen mangler tilgang til oEmbed Read. Sjekk Development-mode + app-rolle.
- **Recording har tomt token-felt** → forventet i bypass-modus. Demo-siden viser ikke access-token-felt i det hele tatt (server-side env-var).
