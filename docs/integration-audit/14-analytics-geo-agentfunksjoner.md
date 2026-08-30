# 14 — Analytics- og GEO-oppsett som agentfunksjoner (klient-selvbetjening)

**Formål:** Alt vi har satt opp manuelt for egne merkevarer (GSC, GA4, GTM,
Meta Pixel, Clarity, GEO-prerendering, Bing/ChatGPT/Perplexity) skal bli
funksjoner i The Role Room Agent, slik at Innholdsprodusenten kan tilby en
klient det samme oppsettet — med riktige events, consent-gating og
verifisering. Dokumentet er fasiten fra vårt eget oppsett (juli 2026),
funksjonskatalogen agenten trenger, og gap-analysen implementert vs. må
utvikles. CreatorHubs hosting-/ruteoppsett er revidert til Netlify-status
2026-08-30.

**Kildekode-referanser** peker til mønstrene vi selv bruker i produksjon —
det er disse som skal generaliseres, ikke gjenoppfinnes.

---

## Del 1 — Fasit: hva vi gjorde, og hva som er repeterbart

### 1.1 Google Search Console (GSC)

Hva vi gjorde (theroleroom.com + leadgrid.no):

1. **Verifiseringsfil**: `google<token>.html` legges i `frontend/client/public/`
   og deployes via riktig Netlify merke-site/produksjonsgren. OBS: filen er
   domene-spesifikk — vi la først leadgrid-filen på feil merkevare. Verifiser
   alltid den tiltenkte hosten etter `Promoter merke`.
2. **Sitemap per host**: `client/public/leadgrid-sitemap.xml` (statisk, 12
   locs) + backend-generert `theroleroom-sitemap.xml`
   (`backend/server/theroleroom-sitemap-routes.ts`). Robots per host peker
   på riktig sitemap (`leadgrid-robots.txt`).
3. **Innmelding**: property + sitemap-submit i GSC-UI (krever Google-
   innlogging — kan ikke automatiseres for klient; må guides).

Lærdommer som må inn i agent-logikken:
- **GA4 tillater bare ÉN GSC-link per property.** Deler klienten GA4-property
  på flere domener, må de velge hvilket domene som får linken (hos oss: TRR).
- Verifiseringsfil forsvinner ved re-deploy hvis den ikke ligger i repoet →
  alltid inn i `public/`, aldri lastes opp ad hoc.

Automatiserbart for klient: sitemap-generering, robots, verifiseringsfil-
plassering (hvis vi hoster siden), *verifisering av at alt er live* (HTTP-
sjekker). Ikke automatiserbart: selve GSC-innmeldingen (klientens Google-
konto) → guidet sjekkliste + etterkontroll.

### 1.2 GA4

Hva vi gjorde:

1. **Én property per merkevare** (Leadgrid 546070583/G-3MS91ZHVKS; delt
   CreatorHub+TRR-property med to streams). Anbefaling for klienter: én
   property per domene — den delte property-en ga oss GSC-link-begrensningen.
2. **Per-host bootstrap** i `frontend/client/index.html`:
   `resolveAnalyticsConfig()` velger measurement-ID/GTM/Clarity/Pixel ut fra
   `location.hostname` (LEADGRID_/CREATORHUB_/ROLE_ROOM_-prefiksede
   konstanter; tom streng = ikke last). Dette mønsteret ER malen for
   klient-snippets: én blokk, alle IDer, consent-gatet.
3. **Consent-gating**: analytics lastes først ved analytics-samtykke
   (`__creatorhubApplyConsent` / `__creatorhubLoadAnalytics`).
4. **Events**: klient-tracking går gjennom `trackEvent()` i
   `frontend/client/src/utils/ga4-client-tracking.ts` — ett funksjonskall,
   gtag + Meta-bro. Key events markeres i GA4-UI (`purchase` er system-låst
   og kan ikke av-markeres). Egendefinerte: `leadgrid_signup_completed`,
   `leadgrid_book_demo_clicked`, `book_demo_submitted`, `agency_lead_submitted`,
   `onboarding_complete`, `subscription_purchased`.
5. **Innstillinger satt overalt**: retention 14 mnd (maks på gratis GA4),
   Google Signals av inntil samtykkebehov er avklart.

Automatiserbart: GA4 Admin API kan opprette properties/streams/key events
programmatisk — men krever OAuth mot klientens Google-konto (scope
`analytics.edit`). Klientportalen har allerede `role_room_google_connections`
(`client-portal-connected-platforms.ts`) — samme mønster kan utvides med
analytics-scope. Uten OAuth: guidet oppsett + snippet-generering +
etterkontroll.

### 1.3 GTM

- Én container per merkevare (leadgrid.no GTM-W8QZL75L, creatorhubn
  GTM-KC38RPNZ, TRR GTM-TNWTVHSP), publisert v1 (en container uten publisert
  versjon serverer ingenting).
- **Lærdom (creatorhub-oppryddingen)**: det lå en FREMMED, tom container
  (GTM-MFWW7X83) i index.html — verifisert tom ved å lese servert gtm.js før
  utskifting. Agentens audit-funksjon må flagge GTM-IDer som ikke lar seg
  verifisere eid av klienten.

### 1.4 Meta Pixel

Hva vi gjorde:

1. **Én pixel per merkevare** (TRR 1254983913516214, Leadgrid
   929515126829909, CreatorHub 1886226702029036).
2. **Strengere consent enn analytics**: `hasMarketingConsent()` — pixel
   lastes KUN ved marketing-samtykke (GDPR). Loaderen ligger i BÅDE
   `index.html` og `theroleroom.html` (TRR-shellen serverer egne ruter —
   glem aldri sekundær-shells).
3. **Konverterings-bro**: `META_STANDARD_EVENT_MAP` i
   `ga4-client-tracking.ts` oversetter våre GA4-events til Meta-standard
   (Purchase/Subscribe/InitiateCheckout/CompleteRegistration/Lead) med
   value/currency (NOK default). Ett trackEvent-kall → begge plattformer.
4. **Policy**: pixels er KOBLET men ingen annonser aktivert — oppsett og
   aktivering er separate beslutninger. Samme skille bør agenten tilby
   klienter.

Ikke automatiserbart: pixel-opprettelse i Events Manager (klientens Meta-
innlogging; business.facebook.com er dessuten blokkert for browser-verktøy).
Automatiserbart: snippet-generering med klientens pixel-ID, event-bro-oppsett,
verifisering (fbq til stede + gatet riktig).

### 1.5 Microsoft Clarity

- Ett prosjekt per merkevare (Leadgrid: xnzezvwkbm). Lastes consent-gatet
  fra samme bootstrap.
- Clarity↔GA4-integrasjonen i Clarity-UI feilet først («Oops, there was a
  problem») — løsningen var å koble fra GA4-siden/riktig konto-kontekst.
  Guidet steg, ikke API.

### 1.6 GEO-prerendering (AI-crawlere: GPTBot, ClaudeBot, PerplexityBot m.fl.)

Arkitekturen (verifisert live for 19 TRR-pillarsider + 8 Leadgrid-sider):

1. **Build-steg**: `vite build --ssr` med
   `frontend/client/src/prerender/geo-prerender-entry.tsx` → statisk HTML m/
   inline emotion-CSS til `dist/geo/<site>/<side>.html`. `buildDocument()`
   er parametrisert per site (TRR_SITE/LEADGRID_SITE) — en tredje site
   (klientens) er et konfigobjekt, ikke ny kode. Komponent-mappen THROWER
   på umappet nøkkel — bevisst, så manglende sider stopper bygget.
2. **Serving**: `netlify/host-routes.json` er kilden for host- og
   UA-betingede ruter (bot-UA → `/geo/...html`). Frontend-builden genererer
   `netlify/edge-functions/host-routes.ts`, som dekker både `/` og de øvrige
   pillarsidene. Mennesker faller gjennom til vanlig SPA-respons og påvirkes
   aldri (juni-beslutningen står).
3. **Struktur i prerendret HTML**: full artikkel-HTML, Article/FAQPage
   JSON-LD, ærlig avsender-deklarasjon.
4. **Måling**: citation-tracker (geo-visibility-tjenesten, doc 08) kjører
   ukentlig (mandag 03:00) mot godkjente prompt-sets; Bing Webmaster har
   «AI Performance (BETA)»-rapport som ekstern fasit.

### 1.7 Bing / ChatGPT / Perplexity

- **Bing Webmaster** = ChatGPT-searchs indeks. Import fra GSC er den raske
  veien (klienten logger inn med Microsoft-konto — guidet steg). Sitemaps
  for alle 4 domener meldt inn.
- **IndexNow**: Bing støtter API-innmelding av URL-er med en selvhostet
  nøkkelfil — dette ER automatiserbart uten OAuth (nøkkelfil i `public/` +
  POST). Ikke tatt i bruk hos oss ennå; lavthengende for agent-funksjon.
- **Perplexity**: PerplexityBot får prerendret HTML (dekket av GEO-oppsettet).
  Gjenstår hos oss: Perplexity som kilde i citation-trackeren.

---

## Del 2 — Funksjonskatalog for The Role Room Agent

Agenten er propose-only (`role-room-agent-definition.ts`): verktøyene
returnerer forslag/utkast; mutasjoner skjer via egne endepunkter etter
bekreftelse. Nye verktøy følger samme kontrakt.

### F1: `audit_site_setup` — «hva er allerede på plass?» (READ-ONLY)

Kjernefunksjonen Daniel etterspør: gitt klientens domene, sjekk uautentisert
hva som allerede er implementert. Ingen innlogging trengs for noe av dette:

| Sjekk | Metode | Resultat |
|---|---|---|
| GA4 | hent forsiden, se etter `gtag/js?id=G-…` / gtag-config | funnet ID(er) |
| GTM | `googletagmanager.com/gtm.js?id=GTM-…` i HTML + at containeren serverer publisert versjon | ID + publisert ja/nei |
| Meta Pixel | `fbq('init', …)` / connect.facebook.net | ID + om den er consent-gatet (lastes før samtykke?) |
| Clarity | `clarity.ms/tag/…` | prosjekt-ID |
| Sitemap | GET `/sitemap.xml` (+ robots-deklarert sti) | finnes, antall locs, `<lastmod>` |
| Robots | GET `/robots.txt` | finnes, blokkerer den AI-boter? (GPTBot/ClaudeBot/PerplexityBot-direktiver) |
| GSC-verifisering | GET `/google*.html`-mønster + `<meta name="google-site-verification">` | indikasjon (fravær ≠ ikke verifisert — DNS-verifisering synes ikke) |
| GEO-serving | hent samme URL med vanlig UA og med GPTBot-UA, diff på tekstinnhold | får boter fullt innhold? |
| IndexNow | GET `/<key>.txt`-mønster | nøkkelfil funnet |
| Consent-plattform | kjente CMP-scripts (Cookiebot, CookieYes, egen banner) | hvilken, om noen |

Output: strukturert statuskart per kapabilitet
(`implemented / partial / missing / unknown`) + anbefalte neste steg.
Dette verktøyet kjøres FØR og ETTER oppsett — samme funksjon er
verifiseringen.

Gjenbruk: curl/fetch-mønstrene fra vår egen GEO-verifisering; bot-UA-diffen
er identisk med den vi brukte for å oppdage at pillarsidene var usynlige.

### F2: `generate_analytics_bootstrap` — snippet-generator

Input: `{ domain, ga4MeasurementId?, gtmId?, clarityId?, metaPixelId?,
consentMode: 'gated' | 'always' }`.
Output: én HTML-blokk etter mønsteret i vår `index.html`
(resolveAnalyticsConfig light): consent-gatet lasting, analytics vs.
marketing-skille, tom-ID = hopp over. Pluss `trackEvent`-hjelperen med
Meta-broen (F3s event-plan bestemmer mappingen).

### F3: `generate_event_plan` — event-taksonomi + Meta-bro

Input: klientens forretningsmål (lead / booking / kjøp / påmelding) fra
brief-feltene agenten allerede kan lese (`projectGoal`, `deliverables`).
Output: navngitte GA4-events (kebab/underscore-konvensjon som våre),
hvilke som skal være key events, og META_STANDARD_EVENT_MAP-rader
(GA4-event → Meta-standardevent + value-felt). Leveres som tabell klienten
godkjenner før snippets genereres.

### F4: `guide_platform_setup` — guidede sjekklister for det manuelle

Det som krever klientens innlogging kan ikke og skal ikke automatiseres
(passord-håndtering er forbudt). Verktøyet returnerer plattform-spesifikke
steg-for-steg-lister med skjermbilde-referanser og våre lærdommer bakt inn:

- **GSC**: property-type (domene vs URL-prefiks), verifiseringsvalg,
  sitemap-submit, «kun én GA4-link per property»-advarselen.
- **GA4**: property-oppretting, stream, retention 14 mnd, key
  event-markering (og at `purchase` er system-låst).
- **Meta**: pixel i Events Manager, koble-men-ikke-aktivere-policyen,
  SMS-verifiserings-fella ved ny business-konto.
- **Bing**: GSC-import-snarveien, AI Performance-rapporten.
- **Clarity**: prosjekt + GA4-integrasjon (med «Oops»-workarounden).

Hver liste avsluttes med «kjør audit igjen» (F1) som verifisering.

### F5: `generate_geo_prerender_plan` — GEO for klientens sider

Input: F1-resultatet + liste over klientens viktigste innholdssider.
Output: forslag om (a) hvilke sider som bør bot-serveres statisk, (b)
robots.txt-linjer som eksplisitt SLIPPER INN AI-boter, (c) sitemap-hull,
(d) serving-oppskrift per plattform (Vercel-rewrites + edge-middleware for
rot hos kunder som bruker Vercel; nginx `map $http_user_agent`; Netlify Edge
Function fordi `_redirects` ikke kan betinge på Host/User-Agent),
(e) JSON-LD-maler (Article/FAQPage) for innholdet.
For kunder hostet PÅ The Role Room/Leadgrid: gjenbruk prerender-pipelinen
direkte (ny SITE-konfig i `geo-prerender-entry.tsx`) — da er dette en
konfigurasjonsjobb, ikke en klientjobb.

### F6: `submit_indexnow` — faktisk automatiserbar innmelding

Generer IndexNow-nøkkelfil (legges i klientens `public/`), og POST
URL-lister til api.indexnow.org ved publisering. Eneste av
innmeldingsfunksjonene som ikke krever klient-OAuth. Confirm-dialog før
innsending (ekstern effekt).

### F7: `check_ai_visibility` — sitering/synlighet over tid

Gjenbruk geo-visibility-tjenesten (doc 08): prompt-sets per klient
(`geo_prompt_sets` er allerede org-scopet med approved-status), ukentlig
kjøring, resultat inn i klientportalen. Perplexity som kilde må bygges
(samme gap som for oss selv).

---

## Del 3 — Gap-analyse: finnes vs. må utvikles

| # | Funksjon | Finnes i dag (gjenbrukbart) | Må utvikles |
|---|---|---|---|
| F1 | audit_site_setup | curl/UA-diff-mønstrene (manuelt brukt); PanelStateContainer-UI-mønster | **Alt som kode**: backend-endepunkt (fetch + parse, org-scopet), tool-schema, resultat-UI i klientportalen. Størst verdi, bygges først. |
| F2 | generate_analytics_bootstrap | Malen ER `index.html`-bootstrapen + `googleAnalyticsRuntime.ts` | Generator (template + input-validering), tool-schema. Liten jobb. |
| F3 | generate_event_plan | Event-taksonomien + META_STANDARD_EVENT_MAP i `ga4-client-tracking.ts`; brief-feltene i agent-konteksten | Prompt-/tool-design; kobling brief → mål → events. Liten-medium. |
| F4 | guide_platform_setup | Alt innholdet står i dette dokumentet (del 1) | Struktureres som data (steg-lister per plattform), tool + UI. Ren innholdsjobb. |
| F5 | generate_geo_prerender_plan | Hele pipeline-en (`geo-prerender-entry.tsx`, `netlify/host-routes.json`, generatoren og Netlify Edge Function); doc 08/09 | For eksterne kunder: plan-generator. For hostede kunder: SITE-konfig-generalisering (i dag hardkodet TRR/Leadgrid). Medium. |
| F6 | submit_indexnow | Ingenting | Nøkkelfil-generering + innmeldings-endepunkt m/ confirm. Liten. |
| F7 | check_ai_visibility | geo_prompt_sets (org-scopet, approved-flyt), ukes-cron, citation-tracker | Klient-vendt visning i portalen; **Perplexity-kilde i trackeren** (felles gap med oss selv). Medium. |
| — | OAuth-utvidelse (GA4 Admin API) | `role_room_google_connections` + connected-platforms-tjenesten | Nytt scope (analytics.edit), property/key-event-oppretting via API, confirm-flyt. Størst løft — fase 2; F1–F4 gir verdi uten. |

**Anbefalt rekkefølge:** F1 (audit — den svarer på «hva er implementert»)
→ F2+F3 (snippets + events, gjenbruk av eksisterende kode) → F4 (guider,
ren innholdsjobb fra del 1) → F6 (IndexNow, billig gevinst) → F5/F7 →
OAuth-fasen sist.

---

## Del 4 — Policy og sikkerhet (gjelder alle funksjonene)

1. **Aldri klient-hemmeligheter i klartekst.** Ingen passord, tokens eller
   API-nøkler gjennom agenten. Innlogginger gjør klienten selv (F4-guider);
   API-tilgang kun via OAuth-connections som allerede finnes i portalen
   (aldri tokens ut til frontend — samme regel som
   `client-portal-connected-platforms.ts` håndhever).
2. **Propose-only står.** Alle funksjoner med ekstern effekt (IndexNow-
   innmelding, fremtidig GA4 Admin API) går via confirm-dialog, som dagens
   agent-verktøy.
3. **Consent er del av leveransen, ikke tillegg.** Genererte snippets er
   alltid consent-gatet (analytics-samtykke for GA4/Clarity, marketing-
   samtykke for Meta Pixel). Auditen (F1) flagger pixels som fyrer før
   samtykke — det er en GDPR-risiko hos klienten, ikke en detalj.
4. **Ærlighet i audit-resultater.** `unknown` er et gyldig svar (f.eks.
   DNS-verifisert GSC synes ikke utenfra). Aldri rapporter «mangler» når
   svaret er «ikke observerbart».
