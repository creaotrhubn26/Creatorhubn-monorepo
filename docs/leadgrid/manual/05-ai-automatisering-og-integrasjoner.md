# Leadgrid AI, automatisering og integrasjoner

**Verifisert mot kode:** 29. august 2026

Dette kapitlet beskriver hva som skjer bak «research», «AI», «workflow» og
«connector»-begrepene. En ferdig AI-visning betyr ikke at all input er
verifisert, at resultatet er lagret eller at en ekstern handling faktisk er
sendt.

## 1. Prinsipp: tre forskjellige ting

| Type | Hva systemet gjør | Brukerens ansvar |
|---|---|---|
| Beriking | Henter og strukturerer data fra registre, nettsider og karttjenester | Kontroller identitet, dato og kilde |
| Analyse/anbefaling | Beregner score, sammendrag, forecast eller neste handling | Vurder og godkjenn før bruk |
| Automatisering | Utfører en definert handling ved trigger | Test trigger, vilkår, mål og audit |

Ikke dokumenter en analyse som automatisk utførelse. Next Best Action er for
eksempel en anbefaling helt til brukeren eller en aktiv workflow utfører noe.

## 2. Research og beriking

### Per-lead research

Flyten kan kombinere:

1. eksisterende leaddata;
2. BRREG og organisasjonsopplysninger;
3. nettstedscrawl og synlige signaler;
4. Google Places/Maps/Geocoding;
5. bransje og tidligere historikk;
6. AI-strukturering og kvalitetskontroll;
7. resultat tilbake på lead/researchjobb.

Tilgang styres normalt av `lead_research.run` eller en tilsvarende research-
permission. Ved feil skal den opprinnelige leaden bestå; en ufullstendig
researchjobb må ikke tolkes som «ingen signaler».

### Full intelligence/agentbro

Agentbroen orkestrerer flere eksisterende tjenester til en større rapport,
blant annet bedrift, nettsted, konkurrenter, fit/threat, SWOT og outreach.
Dette er et sammensatt AI-resultat. Bevar hvilke delkilder som faktisk svarte,
og ikke skjul en delvis feil bak ett samlet grønt resultat.

### Market Scan

Market Scan søker etter bedrifter innen et marked og kan opprette leads/pins.
Kriteriene må inneholde geografi, bransje og ønsket profil. Før commit:

- dedupliser mot eksisterende `crm_customers`;
- kontroller at bedriften er riktig juridisk enhet;
- kontroller at kontaktdata kan brukes til det tiltenkte formålet;
- behold scan/run-ID som sporbarhet;
- ikke masseutsend før samtykke/berettiget interesse og kanalpolicy er avklart.

### Prosjektbasert og kontinuerlig discovery

Backend støtter discovery for et valgt prosjekt og en konfigurasjon som kan
kjøre automatisk hvert femte minutt. Denne funksjonen er først og fremst en
serverflate. Admin skal ha kvote, av-knapp, siste run, neste run og feilstatus
før automatisk discovery brukes i produksjon.

## 3. Import

### CSV/Excel

Webimporten støtter fil, preview, mapping, dedupe og commit. Kjente grenser:

- maks 10 MB;
- preview-token ligger i en prosesslokal Map i 15 minutter;
- restart eller annen serverinstans kan miste tokenet;
- commit er sekvensiell uten samlet DB-transaksjon;
- rollback-endepunkt finnes ikke;
- flere felter vises i mappingen, men lagres bare i rå-JSON og ikke i egne
  leadkolonner.

En import kan derfor bli delvis. Vis antall opprettet, hoppet over og feilet,
og behold batch-ID til avstemming.

### URL Research

Enkelt- og bulk-URL-flyter lager researchutkast før commit. Bulk støtter
status, polling, retry, cancel og commit-all. En recovery-sweeper forsøker å
gjenoppta items som står fast etter deploy/restart.

Native Leads-fanens enkle importark er ikke den samme produksjonsflyten; det
lukker uten filpicker/API. Den fullførte webimporten ligger på `/import`.

## 4. Scoring, NBA og forecast

### Intelligence score

Composite score og historikk bruker signaler på leaden og kan oppdateres av
daglig rescore. Dokumenter alltid:

- scoreversjon og tidspunkt;
- hvilke signalgrupper som var tilgjengelige;
- om score ble beregnet på nytt eller lest fra cache;
- om organisasjonens datagrunnlag var komplett.

### Next Best Action

NBA kan aksepteres, avvises eller utføres. Disse tre handlingene er blant de få
som har eksplisitt native offline-kø. Etter reconnect må klienten kontrollere
serverresultatet; en handling kastes etter fem mislykkede forsøk i dagens kø.

### Forecast

Forecast kan gi p10/p50/p90 og AI-refinement med cache. Forecast er
sannsynlighetsbasert, ikke en garanti. Vis valuta, periode, pipelinegrunnlag og
sist oppdatert. NBA-attribusjon må skilles fra korrelasjon.

### Momentum

Momentum kombinerer mål, aktivitet og anbefaling. Det kan være mer operativt
enn en ren salgs-KPI, men skal ikke brukes som lønns-/personellbeslutning uten
innsyn i datagrunnlaget.

## 5. AI-møtebrief og møtenotater

### Møtebrief

AI-møtebrief kan bruke BRREG, regnskap, Doffin-signaler og egne vunnede case.
Den er en eksplisitt kostnadsbærende entitlement. Resultatet skal skille:

- register-/kildedata;
- interne CRM-fakta;
- AI-oppsummering;
- hypoteser eller anbefalte spørsmål.

### Møtenotater

Voice memo kan sendes til Whisper og deretter AI for ryddet tekst, action
items, follow-up-dato og sentiment. Native `TranscriptIntelligence` bruker
on-device modell for korte tekster når tilgjengelig og faller tilbake til
backend ellers.

Watch-hurtignotat får analysen tilbake, men lagrer ikke notat eller oppgaver.
Brukeren må overføre/bekrefte i hovedappen.

### Lydopptak

Fullt kundesamtaleopptak er et eget compliance-regime og ikke det samme som
et kort selv-diktert notat. Lydopptak er fail-closed. Se
[GDPR-pakken](../../leadgrid-gdpr-lydopptak.md).

## 6. Leadbook- og Canvas-AI

### Leadbook

AI kan strukturere salgseksempler og støtte transkriptanalyse. Egen entitlement
skal kontrollere kostnaden. Anonymisering skal skje før bred publisering.

### Canvas

Canvas kan analysere håndskrift og bruke levende CRM-/KPI-/kartkort. AI-
analysen kan åpnes av `canvasAnalyse` eller møtebrief-nøkkelen. En AI-analyse
skal lagres som avledet lag, ikke overskrive original håndskrift/PDF.

## 7. AI-bruk, kø og kost

Backend har:

- AI usage-tabeller og dashboard;
- sentral `recordAIUsage()`-tracker;
- prosesslokal AI-kø og rategrenser;
- overage-/billing-jobber.

Kjente gap:

- `recordAIUsage()` har ingen faktiske kallesteder utenfor egen definisjon;
- flere AI-kall sender `organizationId = null`;
- per-org-kvote virker derfor ikke konsekvent;
- køen deles ikke mellom serverinstanser;
- restart mister prosesslokal køtilstand.

AI-kostdashboardet skal merkes «ufullstendig datakilde» til tracker og org-ID
er koblet gjennom alle AI-funksjoner.

## 8. Workflow Builder

### Modell

En workflow består av:

- trigger;
- valgfrie conditions;
- én eller flere actions;
- aktiv/inaktiv status;
- execution- og eventlogg;
- eventuelle wait/resume-jobs.

### Støttede triggerfamilier

- lead opprettet/oppdatert;
- pipeline-stage endret;
- deal sannsynlighet/endring;
- e-post åpnet eller lenke klikket;
- møte booket eller no-show;
- tilbud åpnet;
- kontrakt signert;
- planlagte/schedule-events;
- kontinuerlig discovery og relaterte salgsereigninger.

### Conditions

Engine støtter vilkår på blant annet score, bransje, by, deal amount og
temperatur. Webbyggeren sender i dag alltid `conditions: []`. Conditions er
derfor en backendkapabilitet, ikke en komplett webfunksjon.

### Actions

| Action-gruppe | Status |
|---|---|
| Stage/status, assign, tag, task, feltoppdatering, archive/revive | Serverkoblet |
| E-post, calls, møter og interne datahandlinger | Varierer; test provider/sideeffekt |
| Wait/resume | Reelt implementert med jobs/poller |
| Webhook/Zapier | Serverkoblet med SSRF-vern, HMAC og rategrense |
| `send_sms`, `send_whatsapp`, `notify_channel`, `ai_pitch_generate` | Returnerer `deferred`; utfører ikke handlingen |
| `book_meeting` med `send_invite` | Lager lokal møtepost, ikke Google Meet/invitasjon |
| `manager` som mottaker | Faller tilbake til lead owner |

Web kan opprette, aktivere/deaktivere og slette workflows, men mangler full
redigering av eksisterende workflow og en faktisk execute-knapp. Native har
egne workflow-visninger, men inngangen er ikke en toppnivåfunksjon.

## 9. Workflow-sikkerhet

Seks event-ingressruter for e-post, møter, tilbud og kontrakt mangler effektiv
session-, HMAC- eller service-tokenhåndhevelse. De kan ta org-/customerdata fra
body og publisere workflow/webhook-event. Dette er et kritisk gap.

Før disse brukes i produksjon:

1. krev provider-signatur eller intern service credential;
2. avled org/customer fra en verifisert hendelse, ikke fri body;
3. bruk replay-vern og timestamp;
4. rate-limit per provider/org;
5. auditér mottatt, avvist og publisert event;
6. legg til negativ tenant-/auth-integrasjonstest.

## 10. Legacy lead rules

Det eldre IF/THEN-systemet eksisterer parallelt med Leadgrid workflows. Det
har `cron_hourly` og `cron_daily` som gyldige triggernavn, men kartleggingen
fant bare manuell `evaluate-rules`. Nye automatiseringer skal normalt bygges i
Leadgrid workflow-engine til legacy-systemet har en tydelig migreringsplan.

## 11. Varsler og outreach

### Interne varsler

Lead-assignment, status, follow-up, won/lost og flere sanntidshendelser kan
generere in-app/APNs. APNs-klienten er stub hvis `APNS_MODE` ikke er `live`.

### E-post og WhatsApp

E-postbranding og WABA-oppsett er orgspesifikt. Workflow-action som heter
`send_whatsapp` er likevel deferred i workflow-engine; dette må ikke blandes
med den direkte channel/notification-flyten som faktisk kan være konfigurert.

### Scheduled reports

Rapporter bruker egne serverruter/cron og er ikke en workflow-action. Kontroller
send-logg og providerrespons.

## 12. Webhooks

Leadgrid støtter webhook destinations, eventabonnement, leveringskø, HMAC,
test og secret-rotasjon med grace. Ved konfigurering:

1. bruk HTTPS;
2. blokker private/metadata-nettverk og redirect-omgåelser;
3. verifiser signatur hos mottaker;
4. returner rask 2xx og prosesser asynkront;
5. dedupliser på event-ID;
6. håndter retry uten dobbelt sideeffekt;
7. roter secret og avslutt gammel grace.

Expiry-ruten for gammel webhook secret har ingen funnet scheduler. Secret-
opprydding må derfor verifiseres manuelt eller kobles til cron.

## 13. Public API og partner API

### Leadgrid public API v1

Auth bruker `lgk_*`-nøkler som hashes på serveren og scopes. Dokumentert
OpenAPI-overflate omfatter i hovedsak:

- health;
- leads GET/POST;
- enkeltlead GET;
- recommendations.

Scope-queryen bruker fortsatt legacy owner/membership selv om
`crm_customers.organization_id` finnes. Leads kan derfor bli utelatt etter
eierskifte eller medlemsendring.

### Partner API

Partner API bruker `lg_live_*` og har egen management-, audit-, webhook- og
deliverymodell. Partnernøkler og vanlige public API-nøkler er ikke
utskiftbare.

### Rate limiting

Rate buckets er prosesslokale. Ved flere Node-instansser er ikke grensen global.
Bruk distribuert store før grensen behandles som kontraktsmessig garanti.

## 14. Connector-katalogen

Webkatalogen viser connectorer og flere «Live»-påstander. Det finnes ikke
dedikerte webflater for alle navngitte CRM-er, og flere docs-/settings-lenker
er broken. Klassifiser derfor hver connector etter:

- autentisering faktisk implementert;
- inbound/outbound dataobjekter;
- full eller énveis sync;
- konflikthåndtering;
- webhook/polling;
- rate limits og feilstatus;
- testet miljø og sist verifisert dato.

En katalogoppføring alene er markedsinnhold, ikke teknisk integrasjon.

## 15. Eksterne tjenester

| Tjeneste | Bruk | Feil-/fallbackkrav |
|---|---|---|
| BRREG | Org/bedriftsdata | Behold org.nr. og hentetid; håndter manglende treff |
| Google Places/Maps/Geocoding/Distance Matrix | Discovery, adresse og rute | Kvoter, timeout og tomt resultat |
| Kartverket/Geonorge/SSB | Adresse, kommune, tettsted | Cache, lisens og dekning |
| Entur | Kollektiv | Krever client name; vis manglende data |
| NVDB/Vegvesen | Fart, bom, kjøretøy, parkering | Nøkler og geografisk dekning |
| Doffin | Anbud | Offisiell frist er autoritativ |
| Anthropic Claude | Research, score, brief, forslag | Hallusinasjon, quota, timeout og kildevisning |
| OpenAI Whisper | Transkripsjon | Samtykke, retention, feiltranskripsjon |
| Apple Intelligence | Kort lokal analyse | OS/enhet/språk; backendfallback |
| Stripe | Plan, faktura, overage | Webhook-idempotens og customer-link |
| Resend/SMTP | E-post | Bounce/providerlogg |
| Meta WhatsApp | Kundemeldinger | WABA/token/template-status |
| APNs | Push | Stub/live-mode, device-token og miljø |
| Objektlagring | Academy, Canvas, pitch, opptak | Signed URL, region, retention og sletting |

## 16. Integrasjonsverifisering

For hver produksjonskobling skal dokumentasjonen ha:

- eier og databehandlerrolle;
- credentials-kilde og rotasjonsrutine;
- scopes og minst privilegium;
- inn-/utgående felter og tenant-scope;
- timeout, retry og idempotens;
- leverandørfeil og brukerfeiltekst;
- audit/logging uten hemmeligheter;
- test i sandbox og produksjonslignende miljø;
- sletting/retention;
- sist verifisert dato.

