# Medside Discovery – handoff til Claude

Sist kontrollert: 14. september 2026, Europe/Oslo.

Dette dokumentet er fasiten for neste arbeidsøkt. Det beskriver hva som faktisk
er observert i produksjon, hvorfor Discovery feiler i Medside-prosjektet, hva som
allerede finnes i kodebasen, og hvilken rekkefølge rettingen skal gjennomføres
og verifiseres i.

## Oppdraget

Få Discovery til å fungere for det eksisterende Medside-prosjektet uten å:

- opprette et duplikatprosjekt;
- blande Medside-data med andre kundeprosjekter;
- overskrive brukerredigerte profiler uten en eksplisitt migreringsregel;
- late som Fastlegeregisteret virker før Maskinporten er konfigurert;
- skrive direkte til produksjonsdatabasen som normal leveransemetode;
- endre flere Render-miljøvariabler i én operasjon.

Målet er at Medside får fem forståelige, prosjektavgrensede profiler, at de fire
BRREG-baserte profilene kan brukes umiddelbart, og at fastlegeprofilen viser en
ærlig blokkert tilstand frem til NHN FLR er autorisert og konfigurert.

## Kort konklusjon

Feilen er ikke en tilgangsfeil i iPad-klienten.

Produksjonen bruker fremdeles et eldre Medside-prosjekt med én migrert profil
som søker etter friteksten `legekontor`. BRREG-providerens klassifisering klarer
ikke å mappe dette uttrykket til en offisiell NACE-kode. Den siste kjøringen
stoppet derfor med `classification_resolution_failed` før én eneste kandidat
ble hentet.

Det nye Medside-oppsettet finnes i kildekoden og i den deployede backend-byggen,
men det har aldri blitt forhåndsvist eller committet for produksjonsprosjektet.
Alle FLR/Maskinporten-variablene mangler dessuten på Render.

## Verifiserte produksjonsfakta

Kontrollene ble gjort read-only via SSH mot den aktive Render-instansen og via
dens eksisterende `DATABASE_URL`. Ingen rader, miljøvariabler eller tjenester
ble endret.

### Prosjekt

| Felt | Verifisert verdi |
| --- | --- |
| Render-service | `creatorhub-backend`, `srv-d76ob60ule4c73dv2p60` |
| Prosjekt-ID | `medside-9873ba5b2f66` |
| Organisasjons-ID | `d06f6c27-2704-4180-8735-be3696f4f130` |
| Prosjektnavn | `MedSide — Helsetech kundeprosjekt` |
| Status | `active` |
| Opprettet | `2026-06-18T08:01:10.252Z` |
| `industry` | `NULL` |
| `metadata` | `{}` |
| Brand-kit URL | `https://medside.no` |

Brand-kitet er viktig: gjenbruksoppslaget i domenebasert onboarding undersøker
også `brand_kits.source_url`. En onboarding-commit for `medside.no` skal derfor
finne og gjenbruke `medside-9873ba5b2f66` selv om prosjektets metadata er tomme.

### Tilgang

- `daniel@creatorhubn.com` er `admin` i organisasjonen `Creatorhub AS`.
- Samme bruker er `owner` i Medside-prosjektet.
- Feilen skyldes derfor ikke manglende organisasjons- eller prosjekttilgang.

### Nåværende Discovery-profil

Det finnes bare én aktiv profil:

| Felt | Verdi |
| --- | --- |
| Navn | `Standard` |
| Profil-ID | `ae0b518b-da58-4fc3-ac23-9c1b610d9a82` |
| `template_key` | `NULL` |
| Standardprofil | `true` |
| Kundetype / industry query | `legekontor` |
| Område | Oslo |
| Kandidater per kjøring | 10 |
| Minimum fit-score | 50 |
| Kilde | BRREG |
| Google Places-detaljer | deaktivert |
| Automatisk Discovery | deaktivert på V2-profilen |

Profilens `brief.migrated_from` er `leadgrid_project_discovery_config`. Dette er
altså en maskinmigrert legacyprofil, ikke en av de nye Medside-malene.

Legacykonfigurasjonen har fortsatt `auto_discover_enabled=true`, mens V2-profilen
har `auto_discover_enabled=false`. Denne inkonsistensen er ikke den direkte
årsaken til den manuelle feilen, men skal ryddes eller dokumenteres i
migreringsarbeidet.

### Siste kjøring

| Felt | Verdi |
| --- | --- |
| Run-ID | `0e64644d-fd5e-427e-9825-8e77730ddc33` |
| Opprettet | `2026-09-14T07:10:54.715Z` |
| Status | `failed` |
| Profil-ID | `NULL` – kjøringen ble lagret som ad hoc |
| Feilkode | `classification_resolution_failed` |
| Feilmelding | `Discovery could not map the customer segment to an official industry code.` |
| Råresultater | 0 |
| Kandidater | 0 |

`search_plan` viser én BRREG industry-query med teksten `legekontor`. Providerens
fail-closed-regel kaster feilen når SSB Klass ikke returnerer en gyldig
næringskode for en industry-query.

### Domenebasert onboarding

Det finnes ingen rader for `medside.no` i
`leadgrid_project_onboarding_previews`. Medside-planen er derfor aldri blitt
committet mot dette prosjektet.

### FLR/Maskinporten på Render

Følgende fem verdier var fraværende på produksjonsinstansen:

- `LEADGRID_DISCOVERY_FLR_ENABLED`
- `LEADGRID_FLR_ENVIRONMENT`
- `LEADGRID_FLR_MASKINPORTEN_CLIENT_ID`
- `LEADGRID_FLR_MASKINPORTEN_KEY_ID`
- `LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY`

Fastlegeprofilen skal fortsatt være fail-closed. Ikke legg inn dummyverdier og
ikke fall tilbake til scraping av Legelisten.

## Det som allerede finnes i kodebasen

### Fem Medside-profiler

`backend/server/leadgrid-domain-onboarding-service.ts` har en egen
`buildMedSideOnboardingPlan`. Den lager:

1. `medside.gp_offices` – **Fastlegekontor – Norge**
   - kilde: `nhn_flr_public`
   - NACE: `86.210`
   - mål: 60
2. `medside.medical_specialists` – **Private spesialistklinikker – Norge**
   - BRREG/SSB/Geonorge
   - NACE: `86.221`, `86.222`
3. `medside.physiotherapy` – **Fysioterapi og ergoterapi – Norge**
   - BRREG/SSB/Geonorge
   - NACE: `86.950`
4. `medside.chiropractic` – **Kiropraktorer – Norge**
   - BRREG organization-name queries
   - påkrevde kvalifiseringstermer
5. `medside.psychology` – **Psykolog- og psykoterapitjenester – Norge**
   - BRREG/SSB/Geonorge
   - NACE: `86.930`

Alle profilene er nasjonale, manuelle og prosjektavgrensede. Planen reparerer
også Medside-metadata, målgruppe, logo og kategori.

Eksisterende tester:

- `backend/server/leadgrid-domain-onboarding-service.test.ts`
  - verifiserer fem profiler og forventede koder;
- `backend/server/leadgrid-discovery-flr-provider.test.ts`
  - verifiserer Maskinporten JWT, scope og FLR-kontrakten;
- `ipad/LeadMapApp/LeadMapAppTests/DiscoveryV2Tests.swift`
  - verifiserer at iPad-kontrakten bevarer `nhn_flr_public`.

### Viktig fallgruve i nåværende onboarding

Ikke bare kjør onboarding mot produksjon uten å rette denne først.

`ensureRecommendedProfiles` ser at legacyprofilen `Standard` allerede er
standardprofil. Funksjonen oppretter da de fem nye malene, men:

- den arkiverer eller oppgraderer ikke Medside sin `Standard`-profil;
- den lar `Standard` forbli standardprofil;
- ingen av de fem nye profilene blir standard;
- brukeren kan dermed fortsatt åpne den ugyldige `legekontor`-profilen først.

Det finnes en eksplisitt legacy-oppgradering for CreatorHub, men ingen
tilsvarende konservativ migreringsregel for Medside. Dette må dekkes av test før
produksjonscommit.

## Anbefalt implementeringsplan

### 1. Start isolert fra siste `main`

Ikke bygg Medside-rettelsen videre på Pondus-grenen.

Ved denne handoffen var:

- `origin/main`: `e5bbd1d04a9a7317490c2b7ed3f022be9d56cb84`
- Pondus-kodecommit: `08d6c051c78bf93b22e7e26f5a442476e53328fe`
- Pondus-gren: `fix/leadgrid-staging-pondus-deeplink-20260914`

`main` beveger seg raskt. Kjør alltid `git fetch origin main` på nytt og lag en
egen branch/worktree, for eksempel:

```bash
git fetch origin main
git worktree add /tmp/leadgrid-medside-discovery \
  -b fix/leadgrid-medside-discovery-20260914 origin/main
```

Bevar alle andre brukerendringer. Ikke reset eller slett andre worktrees.

### 2. Skriv regressjonstesten før rettelsen

Lag en service-/commit-test med disse preconditions:

- eksisterende prosjekt-ID `medside-legacy-project`;
- tom project metadata;
- brand-kit med `source_url=https://medside.no`;
- én aktiv, default `Standard`-profil uten `template_key`;
- `brief.migrated_from=leadgrid_project_discovery_config`;
- industry query `legekontor`.

Etter Medside onboarding-commit skal testen bevise:

- samme prosjekt-ID gjenbrukes;
- ingen ekstra Medside-prosjekt opprettes;
- nøyaktig fem aktive autoritative Medside-profiler finnes;
- hver profil har riktig og unik `template_key`;
- den ugyldige legacybriefen `legekontor` er ikke lenger valgbart standardvalg;
- nøyaktig én profil er default;
- en replay med samme preview/commit oppretter ingenting nytt;
- en ny preview for samme domene gjenbruker samme prosjekt og profiler;
- brukerredigerte Medside-profiler med template key overskrives ikke.

### 3. Implementer en konservativ Medside-legacyregel

Foretrukket løsning er en smal, eksplisitt migrering inne i samme transaksjon
som onboarding-committen. Den må bare treffe profilen dersom alle kjennetegnene
for den kjente legacyprofilen stemmer.

Ikke bruk `name == Standard` alene. Krev minst:

- Medside-plan / `website_domain == medside.no`;
- `template_key IS NULL` og `template_version IS NULL`;
- `brief.migrated_from == leadgrid_project_discovery_config`;
- normalisert industry query er nøyaktig `legekontor`;
- profilens organisasjon og prosjekt matcher onboarding-transaksjonen.

Oppgrader profilen kontrollert eller arkiver den etter at erstatningsprofilene
er opprettet. Bevar profil-ID i en in-place-oppgradering hvis det gir bedre
historikk, men ikke kopier den gamle ugyldige briefen inn i en autoritativ mal.

Standardprofilen må være eksplisitt og entydig etter migreringen. Ikke la
`hasDefault` fra legacyprofilen styre resultatet.

### 4. Håndter FLR-readiness ærlig

Fastlegeprofilen kan ikke gjennomføre et søk før Maskinporten virker.

Anbefalt midlertidig produktatferd:

- vis alle fem profiler;
- marker Fastlegekontor som «Krever FLR-oppsett» når backend ikke er klar;
- deaktiver startknappen kun for denne profilen;
- forklar hva som mangler, uten en generell serverfeil;
- velg en operativ BRREG-profil som default frem til FLR er verifisert.

Ikke erklær Medside ferdig dersom appen åpner en utilgjengelig fastlegeprofil
som standard og bare feiler etter at brukeren trykker start.

Hvis produktet i stedet krever Fastlegekontor som permanent default, må FLR
konfigureres og verifiseres før produksjonscommitten regnes som ferdig.

### 5. Konfigurer FLR først etter ekstern godkjenning

Forutsetningene er:

- virksomheten Creatorhub AS er godkjent for scopet `nhn:flr/export`;
- Maskinporten-klient og nøkkel er registrert;
- produksjonsstatus, bruksvilkår, lagring, attribusjon, oppdatering/sletting og
  eventuell HPR-håndtering er skriftlig avklart.

Render-regel:

- bruk kun `PUT /v1/services/{serviceId}/env-vars/{key}`;
- én nøkkel per request;
- ta key-only snapshot før og etter;
- verifiser at ingen andre variabelnavn forsvinner;
- aldri bulk-PUT hele `/env-vars`-samlingen.

Ikke skriv hemmelige verdier i terminaloutput, tester, commits eller denne filen.

### 6. Kjør domenebasert onboarding gjennom produktkontrakten

Bruk de autentiserte endepunktene, helst gjennom iPad-flyten eller eksisterende
E2E-harness:

- `POST /api/leadgrid/project-onboarding/preview`
- `POST /api/leadgrid/project-onboarding/commit`

Previewen skal bruke:

- organisasjonen som Daniel faktisk er admin i;
- `website_url: https://medside.no`.

Committen skal gjenbruke `medside-9873ba5b2f66`. Avbryt dersom responsen viser
en annen prosjekt-ID eller `reused_project=false`.

Ikke gjør manuelle produksjons-UPDATE-er som hovedløsning. Direkte SQL kan
brukes read-only til kontroll. Eventuell engangsdatamigrering skal være
kodefestet, testet, idempotent og revisjonsbar.

### 7. Utvid staging-E2E for Medside

Den nåværende workflowen tester Tidum og CreatorHub, men har ikke et komplett
Medside-scenario. Utvid:

- `.github/workflows/leadgrid-tidum-staging-e2e.yml`;
- `ipad/LeadMapApp/scripts/staging-testflight-e2e.sh`;
- `ipad/LeadMapApp/LeadMapAppUITests/QASweepTests.swift`.

API-/databasekjeden skal kontrollere:

1. `medside.no` preview gir riktig brand og fem profiler.
2. Commit gjenbruker eksisterende prosjekt.
3. Profilsettet er fem, unikt og idempotent.
4. Ny commit/reload lager ingen duplikater.
5. Minst én BRREG-profil fullfører Discovery og gir relevante kandidater.
6. Kandidater blir ikke CRM-leads før manuell godkjenning.
7. Godkjent kandidat havner i riktig Medside-prosjekt.
8. FLR-profilen enten fungerer med ekte staging-Maskinporten eller viser den
   eksplisitte readiness-blokkeringen.

iPad mini-scenarioet skal kontrollere:

1. Logg inn med stagingbrukeren.
2. Velg Medside-prosjektet.
3. Åpne Discovery.
4. Se alle fem profiler med forståelige navn.
5. Velg en BRREG-profil og start søk.
6. Vent på faktiske kandidater.
7. Godkjenn én kandidat.
8. Verifiser at leadet finnes i Leads/kartet under Medside, ikke under Dentum,
   Tidum, CreatorHub eller The Role Room.
9. Test nettverksbrudd og reconnect i den relevante flyten.

Bruk eksakt simulator:

```text
platform=iOS Simulator,name=iPad mini (A17 Pro),OS=26.5
```

### 8. Verifikasjonsrekkefølge før produksjon

1. Målrettede backendtester for onboarding og FLR.
2. Hele berørte backendtestsuiten.
3. Backend-produksjonsbuild.
4. Native unit tests.
5. Målrettet lokal iPad mini-UI-test.
6. PR-gater uten admin override.
7. Merge til `main`.
8. Deploy eksakt merge-SHA til staging.
9. Full staging-E2E med PostgreSQL, BRREG og iPad mini.
10. Deploy samme verifiserte SHA til produksjon.
11. Read-only produksjonskontroll av prosjekt-ID, profiler og siste kjøring.

Ikke bruk en senere, uverifisert `main`-SHA som TestFlight- eller
produksjonsgrunnlag dersom `main` har flyttet seg under E2E-kjøringen.

## Minimum testkommandoer

Tilpass filfilteret til repoets Vitest-versjon, men start med:

```bash
npm --prefix backend run test:unit -- \
  server/leadgrid-domain-onboarding-service.test.ts \
  server/leadgrid-domain-onboarding-routes.test.ts \
  server/leadgrid-discovery-flr-provider.test.ts

npm --prefix backend run build

xcodebuild test \
  -project ipad/LeadMapApp/LeadMapApp.xcodeproj \
  -scheme LeadMapApp \
  -destination 'platform=iOS Simulator,name=iPad mini (A17 Pro),OS=26.5' \
  -only-testing:LeadMapAppTests/DiscoveryV2Tests \
  CODE_SIGNING_ALLOWED=NO
```

Følg deretter repoets etablerte staging-workflow; ikke bytt ut den med en ren
mocktest.

## Ferdigkriterier

Arbeidet er ikke ferdig før alle punktene er sanne:

- Medside bruker fortsatt prosjekt-ID `medside-9873ba5b2f66`.
- Det finnes ikke et nytt Medside-duplikat.
- Prosjektmetadata og brand-kit peker autoritativt på `medside.no`.
- Fem autoritative profiler er synlige i iPad-klienten.
- Legacyprofilen `Standard / legekontor` er ikke default eller aktiv blindvei.
- Nøyaktig én operativ profil er standard i nåværende runtime.
- En BRREG-profil gir relevante kandidater i staging.
- En kandidat kan godkjennes til et Medside-lead uten prosjektlekkasje.
- En ny onboarding-commit er idempotent.
- Fastlegeprofilen er enten verifisert mot ekte FLR eller tydelig blokkert før
  kjøring.
- Ingen Legelisten-scraping er introdusert.
- Ingen Render-miljøvariabler er falt bort.
- PR, build og full staging-E2E er grønne på eksakt samme SHA.

## Filer Claude skal lese først

1. `backend/server/leadgrid-domain-onboarding-service.ts`
2. `backend/server/leadgrid-domain-onboarding-service.test.ts`
3. `backend/server/leadgrid-domain-onboarding-routes.ts`
4. `backend/server/leadgrid-discovery-flr-provider.ts`
5. `backend/server/leadgrid-discovery-brreg-provider.ts`
6. `backend/server/leadgrid-discovery-service.ts`
7. `ipad/LeadMapApp/LeadMapApp/Core/DiscoveryRunCoordinator.swift`
8. `ipad/LeadMapApp/LeadMapApp/Views/Discovery/DiscoveryProfileManagerView.swift`
9. `ipad/LeadMapApp/LeadMapApp/Views/Discovery/ProjectDomainOnboardingView.swift`
10. `ipad/LeadMapApp/scripts/staging-testflight-e2e.sh`
11. `.github/workflows/leadgrid-tidum-staging-e2e.yml`

## Instruks til neste agent

Begynn med å verifisere at produksjonsfakta fremdeles gjelder read-only. Deretter
skriv den manglende legacy-/idempotens-regresjonstesten. Ikke muter produksjon
før koden er gjennom PR, stagingdeploy og komplett E2E. Rapporter eksplisitt om
FLR er konfigurert eller fortsatt eksternt blokkert; ikke skjul denne forskjellen
bak et generelt «Discovery fungerer».
