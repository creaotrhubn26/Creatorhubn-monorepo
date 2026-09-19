# Google OAuth verification — runbook

App: **CreatorHub Norge** · Google Cloud-prosjekt `creatorhubn-com`
Konsoll: <https://console.cloud.google.com/auth/overview?project=creatorhubn-com>
Publiseringsstatus: In production · External · brukertak 100

Google avviste verifiseringen **2026-08-14** på to punkter:

> **Privacy policy requirements** — Your privacy policy page does not have
> sufficient content. Ensure your privacy policy page sufficiently details
> your app's data collection and usage.
>
> **Request minimum scopes** — The provided justification does not
> sufficiently explain why the requested OAuth scopes are necessary.

Begge er løst. Dette dokumentet er sannhetskilden for gjenopptakelsen.

## Status

| Krav | Status | Bevis |
|---|---|---|
| Personvernerklæring med reelt innhold | ✅ | `https://creatorhubn.com/privacy-policy` — 19 081 tegn synlig tekst i rå HTML (var 57) |
| Limited Use-erklæring | ✅ | Seksjon 8b, norsk + engelsk ordlyd |
| Minimum scopes | ✅ | 43 scopes (8 non-sensitive, 26 sensitive, 9 restricted). 33 fjernet 2026-09-19 |
| Scope-begrunnelser | ✅ | Fire felter på Data Access, 936/897/800/635 tegn |
| Feature-kategorier | ✅ | Drive: productivity + sync client. Gmail: client + productivity. Chat: Chat app |
| Demo-video | ⬜ | Tas opp med skriptet under |
| Innlogging til appen for reviewer | ⬜ | CreatorHub-konto, ikke Google-konto — se «Testkonto» under |
| Egen Google-konto til opptaket | ⬜ | Ikke et Google-krav, men personvern: unngå ekte kundedata i videoen |
| Svar på e-posttråden | ⬜ | Ingenting starter uten dette |

## Hvorfor personvernsiden ble avvist

Erklæringen var 785 linjer React og GDPR-grundig, men eksisterte bare etter
at JavaScript hadde kjørt. Rå-HTML ga 57 tegn synlig tekst. Alt som ikke
kjører JS — inkludert Googles henting — så et tomt skall. Målt live før
fiksen:

```
creatorhubn.com/privacy-policy      57 tegn
leadgrid.no/personvern              57 tegn   (prerender var UA-gated)
leadgrid.no/privacy-policy          57 tegn
theroleroom.com/privacy-policy      57 tegn
theroleroom.com/privacy             11 710 tegn
```

Løst i PR #2428: hvert merke prerenderer sin egen juridiske side, servert
til alle user-agents. Ikke bot-gated — ulikt innhold til bot og menneske er
cloaking.

## De 9 restricted scopene

| Scope | Hva den brukes til | Hvorfor smalere ikke holder |
|---|---|---|
| `drive` | Skrive godkjente leveranser, kontrakter og eksporter tilbake til brukerens egen Drive; opprette prosjektmapper | `drive.file` dekker bare filer appen selv har laget — arbeidet er på kundens eksisterende mapper |
| `drive.readonly` | Åpne opptak, stillbilder og dokumenter brukeren peker ut | Samme |
| `drive.meet.readonly` | Lese opptak/transkripsjon Google Meet lagde for brukerens eget møte | Ingen smalere finnes for Meet-genererte filer |
| `drive.scripts` | Feste container-bundet Apps Script med CreatorHub-meny på brukerens fil | Apps Script-tilknytning krever dette |
| `drive.activity.readonly` | Vise hvem som endret en leveransefil og når, i prosjektloggen | Aktivitets-API har ingen smalere variant |
| `gmail.readonly` | Hente KUN meldinger der `In-Reply-To`/`References` matcher `Message-ID` på en e-post CreatorHub selv sendte | `gmail.metadata` kan ikke lese svarteksten som må vises |
| `gmail.compose` | Opprette utkast brukeren leser gjennom i Gmail før sending | `gmail.addons.*` kan ikke opprette utkast utenfor add-on-kontekst |
| `chat.messages` | Poste statusoppdateringer, leveranselenker og godkjenninger i prosjektets eget rom | Ingen smalere skrive-scope for rom-meldinger |
| `chat.messages.readonly` | Lese samme rom så samtalen vises ved siden av filene den gjelder | — |

Kodepekere: `backend/server/creatorhub-google-routes.ts:126-165` (scope-bunten
med kommentarer), `backend/server/chat-gmail-poller.ts:1-11` (Message-ID-
matchingen), `backend/server/communication-routes.ts:383-395` (scope-gatene).

## Ta opp videoen

```
node backend/scripts/record-google-oauth-verification-demo.playwright.mjs
```

Leser `backend/.env.google-verification.demo.local`:

```
APP_BASE_URL=https://creatorhubn.com
DEMO_PROJECT_ID=<prosjekt med Drive-filer, Gmail-tråd og Chat-rom>
```

`USE_USER_CHROME=1` bruker din installerte Chrome-profil. Chrome må være helt
avsluttet (cmd+Q) først, ellers feiler det med «profile locked».

Output: `recordings/google-oauth-verification-demo-<ts>.webm`

Skriptet er operatør-styrt: det legger på skjermtekst og pauser mellom hvert
steg til du trykker ENTER. Skjermteksten blir samtidig fortellerstemmen for
reviewer.

**Bruk en ren konto i opptaket**, ikke et produksjonsprosjekt med ekte
kundedata — se «Testkonto» under.

### Googles krav til videoen — verifisert mot kilde

Fra konsollen (Data Access → «Demo video: how will the scopes will be used?»):

> Note: The unverified app screen will appear for your test account. This is
> expected and must be shown in the video.

Fra <https://support.google.com/cloud/answer/13804565>:

- Hele ende-til-ende-flyten inkludert OAuth-godkjenningen
- Alle integrasjonspunkter mot Google-API-ene det bes om
- Komplett samtykkeskjerm med **nøyaktig** de scopene vi ber om
- **Språkvelgeren nederst til venstre satt til English** — dette er en vanlig
  avvisningsgrunn for nordiske utviklere
- Hver forespurte scope demonstrert i bruk
- Fortellerstemme (tale eller tekst) som peker på hvor kravene oppfylles
- Samme app som er sendt inn, med samme navn og branding

Skjermteksten i skriptet dekker tekst-varianten av fortellerstemmen, og
skriptet pauser på uverifisert-app-skjermen i stedet for å klikke forbi.

### Testkonto — hva Google faktisk ber om

Googles dokumentasjon krever **ikke** at du oppretter en egen Google-konto.
Reviewer bruker sin egen Google-konto til selve samtykket — det er derfor
uverifisert-app-skjermen dukker opp for dem. Det de trenger fra oss er
innlogging til **applikasjonen**, så de kommer inn i CreatorHub og kan følge
flyten.

Grunnen til å likevel bruke en egen konto i opptaket er personvern, ikke
Googles krav: videoen viser ekte Gmail-, Drive- og Chat-innhold, og skal
lastes opp til YouTube og sendes til Google. Et produksjonsprosjekt med
ekte kundedata hører ikke hjemme der.

Konverter før opplasting:

```
ffmpeg -i recordings/google-oauth-verification-demo-<ts>.webm \
  -c:v libx264 -crf 20 -pix_fmt yuv420p \
  recordings/upload/google-oauth-verification.mp4
```

Last opp til YouTube som **ulistet**, og lim lenken inn i Data Access →
«Demo video: how will the scopes will be used?». Feltet peker i dag på
`yaPXAozNjlc`, som ikke viser gjeldende scopes.

## Svar til Trust & Safety (lim inn i e-posttråden)

> Hi,
>
> We have addressed the two items flagged in the Verification Center.
>
> **1. Request minimum scopes**
>
> We audited every Google scope in the project against our source code and
> removed each one the application does not actually call. We removed 33
> scopes; the request is now 43 (8 non-sensitive, 26 sensitive, 9 restricted:
> 5 Drive, 2 Gmail, 2 Chat).
>
> We also corrected the declared feature categories so they describe only
> what the app does. Drive is now "Drive productivity and Drive sync client"
> — we removed "Drive backup", as we do not back up Drive content. Gmail is
> now "Email client and Email productivity" — we removed "Email
> backup/takeout" and "Email reporting and monitoring", neither of which the
> app performs.
>
> Each group now has a written justification on the Data Access page,
> including why a narrower alternative is not sufficient for the restricted
> scopes. In summary:
>
> *Drive* — CreatorHub is a production workspace for video and content teams.
> Users connect their own Drive so the app can open the footage and documents
> they select, write approved deliverables and contracts back into their
> Drive, attach a container-bound Apps Script that adds the CreatorHub menu
> to their own file, import the recording and transcript Google Meet produced
> for their own meeting, and show who changed a delivery file in the project
> activity log. `drive.file` is not sufficient, because the work is on the
> customer's existing folders and footage libraries, not on files our app
> created.
>
> *Gmail* — the project chat sends from the user's own address.
> `gmail.readonly` is used only to fetch messages whose `In-Reply-To` /
> `References` headers match the `Message-ID` of a message CreatorHub itself
> sent, so the client's reply appears in the correct project thread. No other
> mail is read, stored or indexed. `gmail.compose` creates drafts of delivery
> and quote emails that the user reviews in Gmail before sending.
> `gmail.metadata` is not sufficient, because we must render the body of the
> reply.
>
> *Chat* — each project mirrors its client conversation into a Google Chat
> space the user owns. We post status updates, delivery links and approval
> requests there, and read that same space so the conversation appears next
> to the files it refers to. We do not access spaces outside the project.
>
> **2. Privacy policy**
>
> Our privacy policy at https://creatorhubn.com/privacy-policy was previously
> rendered client-side, so a request that does not execute JavaScript
> received an almost empty document. We have corrected this: the page now
> serves its full content as static HTML to every visitor. It details, per
> category, what data we collect, the purpose and legal basis, retention
> periods, who it is shared with, and how users revoke access and request
> deletion. It now includes a dedicated section on Google user data and an
> explicit Limited Use declaration.
>
> **3. Limited Use**
>
> CreatorHub Norge's use of information received from Google APIs adheres to
> the Google API Services User Data Policy, including the Limited Use
> requirements. We do not transfer this data except as necessary to provide
> or improve the user-facing features, do not use it for advertising, do not
> sell it, and do not use it to develop, improve or train generalised AI or
> ML models.
>
> **4. Demo video and test account**
>
> A new demo video showing the current, reduced scope set in use:
> [LINK]
> Test credentials: [EMAIL] / [PASSWORD]
>
> We would be grateful if you could re-review the request.
>
> Best regards,
> Daniel Qazi
> Creatorhub AS

## Verifiser før du sender

```bash
for u in https://creatorhubn.com/privacy-policy \
         https://creatorhubn.com/terms-and-conditions; do
  printf "%6s  %s\n" "$(curl -sL "$u" | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' ' | wc -c)" "$u"
done
```

Begge skal gi flere tusen tegn. 57 betyr at promoteringen av
`live/creatorhub` ikke har gått ut.
