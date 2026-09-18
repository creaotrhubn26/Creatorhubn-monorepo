# Leadgrid admin, drift og kommersielt

**Målgruppe:** plattformadministrator, organisasjonsadministrator, salgssjef,
support og kommersielt ansvarlig  
**Verifisert mot kode:** 29. august 2026

Dette kapitlet beskriver drift av Leadgrid som produkt. Admin Workspace brukes
til å organisere selve dokumentasjons-/produktarbeidet, men kunders org,
entitlements, planer og salgsdata administreres i Leadgrid-/SuperAdmin-flatene.

## 1. Administrasjonsflatene

| Flate | Formål | Nåbarhet |
|---|---|---|
| Native SuperAdmin Hub | Org, entitlement, brukere, audit, faktura, AI-kost, scan, partner, pris og support | `appState.isSuperAdmin` |
| Web `/superadmin` | Lead inbox, org, betaling, partnere, TestFlight, avtaler, API/webhooks, kanaler og audit | `super_admin` |
| Web `/admin` Leadgrid-seksjon | Landingpris, experience-media, testimonials og Lead Map-prising/entitlements | Admin/superadmin |
| Admin Room Lead Map | Operativt kart/CRM/territorieverktøy | Hardkodet owner-shell i dagens web |
| Organisasjonsinnstillinger | Profil, medlemmer, bransjer og egne valg | Org-rolle/permission |
| Admin Workspace | Intern dokumentasjon, prosjektstyring og produktoppgaver | Creatorhub-admin; ikke kundeorg-drift |

Det finnes ikke én samlet web-adminshell. Ved support skal operatøren notere
hvilken flate, organisasjon og auth-mekanisme som ble brukt.

## 2. Organisasjonslivsløp

### Opprettelse

Organisasjoner kan komme fra flere flyter:

- offentlig self-onboarding for Solo;
- Google Sign-In som kan opprette Solo Free;
- superadmin-opprettelse/invitasjon;
- eldre Lead Map-organisasjon;
- TestFlight-prosess som senere «graduates» til organisasjon.

Etter opprettelse skal admin kontrollere:

1. juridisk/visningsnavn og org.nr.;
2. primær administrator og medlemskap;
3. aktiv plan og grace-status;
4. produktprofil, blant annet B2B kontra dørsalg;
5. entitlements og eksplisitt default-off-funksjoner;
6. e-post/WhatsApp-avsender og samtykke;
7. datatilgang og første import;
8. onboarding-tour og eventuelle drips.

### Aktiv organisasjon og to org-modeller

Backend har to historiske modeller som må forstås i feilsøking:

- Legacy Lead Map bruker hovedsakelig `organizations` og
  `organization_members`.
- Nyere Leadgrid-resolver bruker org-override, siste aktive
  `enterprise_team_members`-rad og deretter bruker-ID som solo-org.

Dette kan gi ulikt scope mellom eldre `/api/admin-room/lead-map/*` og nyere
`/api/leadgrid/*`. Support skal sammenligne resolver-resultatet, medlemskapet
og `crm_customers.organization_id`, ikke bare det som vises i orgvelgeren.

### Pause og suspensjon

Org-status-middleware er ment å blokkere `paused`/`suspended`. I dagens
servermontering registreres middleware etter en stor blokk med Leadgrid-ruter,
så den dekker ikke nødvendigvis rutene som allerede ble montert. En pause skal
derfor ikke anses som full håndhevelse før direkte API-kall er testet.

## 3. Roller og permissions

### Roller

Native produktintensjon bruker Salgssjef, Teamleder, Selger og Spectator.
Backend/web har også blant annet `admin`, `salgskonsulent`, `promotor`,
`member`, `viewer`, kvalitet- og markedsroller.

### Permission-administrasjon

Legacy Lead Map har:

- global permission-katalog;
- rolledefaults;
- per-bruker grant/revoke;
- permission audit log;
- admin-gulv.

Ved endring:

1. identifiser serverpermissionen som beskytter handlingen;
2. kontroller rolledefault;
3. registrer et eksplisitt override bare når nødvendig;
4. test både UI og direkte API som tillatt og sperret bruker;
5. kontroller auditloggen.

Native Team-tilgangsmatrisen er delvis en previewmodell: teammedlemmer kan være
live, mens rolle/override defaultes lokalt. Bruk ikke den alene som bevis på
servertilgang.

## 4. Entitlements og plan

### Tilstander

| Tilstand | Betydning |
|---|---|
| `included` | Inkludert i plan. |
| `trial` | Midlertidig tilgang, eventuelt med sluttdato. |
| `add_on` | Betalt tillegg. |
| `locked` | Sperret. |

Den generelle vakten er bakoverkompatibel og fail-open ved manglende org,
manglende rad og enkelte DB-feil. Servervakt er bare koblet på et utvalg nyere
moduler, blant annet Canvas, Doffin, utstyr, Leadbook, møtebrief, Kvalitet,
rute, territorier, trips og Pondus. UI-gating på andre funksjoner er ikke en
sikkerhetsgrense.

### Default-off-funksjoner

Kostbare eller sensitive funksjoner kan kreve eksplisitt `included`, `trial`
eller `add_on`, ikke bare fravær av `locked`:

- Leadbook AI-strukturering;
- Leadbook lydopptak;
- AI-møtebrief;
- andre funksjoner som bruker `isExplicitlyEnabled` i klienten.

Lydopptak skal aldri åpnes med en vanlig entitlement-edit alene. Org må først
bekrefte compliance-sjekklisten i den dedikerte flyten.

### Planendring

Den native SuperAdmin-planvelgeren er visuell og lagrer ikke plan. Bruk den
serverkoblede entitlement-matrisen og den faktiske billing/plan-flaten. Etter
endring:

- hent plan summary på nytt;
- test en låst og en åpnet funksjon;
- test direkte API der servergate finnes;
- kontroller Stripe/manuel faktura og audit;
- bekreft trial-dato og månedlige grenser.

## 5. Pris, abonnement og faktura

Leadgrid har flere prismodeller/flater:

- dynamisk `pricing-config` brukt på landingen;
- hardkodet full prisside;
- Lead Map modulpricing/entitlements;
- plan limits/usage/grace;
- Stripe checkout/customer portal/invoices;
- API-overage-meter;
- manuell faktura for organisasjoner uten Stripe.

Prissiden og landingen kan avvike. Endre derfor én sannhetskilde og verifiser
begge før publisering. Pris-CTAens query-parametre forhåndsvelger ikke planen i
dagens landing.

### Fakturasjekk

1. Bekreft org og Stripe customer-link.
2. Bekreft plan/price ID og fakturaperiode.
3. Kontroller eventuelle usage/overage-rader.
4. Kontroller at invoice er klassifisert som Leadgrid.
5. Ved manuell faktura: kontroller mottaker, PDF og e-postlogg.
6. Ikke merk tilgang aktiv før betaling/webhook eller godkjent manuell prosess
   er dokumentert.

Sentral AI-usage-tracker har ingen reelle kallesteder i dagens kode. AI-kost-
dashboard og overage for AI kan derfor være tomt selv om AI er brukt.

## 6. Onboarding og kommunikasjon

### E-postprofilering

Konfigurer navn, signatur, reply-to, logo, farger og lovpålagt footer. Send en
test og kontroller faktisk rendering. Se
[kunde-onboarding](../customer-onboarding.md).

### WhatsApp

Organisasjonen kan bruke delt Leadgrid-nummer eller egen WABA. Egen WABA
krever WABA ID, Phone Number ID, systembrukertoken og godkjente maler. Ikke
lagre eller kopier tokens inn i dokumentasjonen.

### Kanal-onboarding

Den native wizard-flaten er nåbar fra Verktøy. Webkomponenten med samme navn
er ikke montert. Dokumenter hvilken flate som ble brukt, valider credentials og
send en test før aktivering.

### Varselpreferanser

Interne Leadgrid-varsler, klientpreferanser og providerkanaler er separate:

- brukerens Leadgrid-eventpreferanser;
- klientportalens e-post/WhatsApp-preferanser;
- org-avsender og malstatus;
- APNs-enhetstoken;
- utsendelses-/auditlogg.

Klientportalmodellen støtter SMS, men dagens portal-UI viser ikke SMS-valget.
APNs er stub med mindre serveren kjører i live-modus med korrekt konfigurasjon.

## 7. Rapporter og planlagte jobber

### Planlagte rapporter

Admin/leder kan konfigurere mottaker, scope og frekvens, og sende rapport nå.
Kontroller:

- at rapporten tilhører riktig org;
- at permissionen dekker dataene;
- at e-postkanal er konfigurert;
- at cron faktisk kjører;
- at report-loggen har en fullført rad.

### Kritiske cronkontroller

| Jobb | Forventet plan | Viktig kontroll |
|---|---|---|
| Follow-up-varsler | Hvert 15. minutt | Cron-token og deduplisering |
| Intelligence rescore | 04:00 UTC | Intelligence-token |
| Retention | 03:00 UTC | Slettepolicy og audit |
| Org/NACE-backfill | 03:15 UTC | Antall oppdaterte/feilede |
| Drips | Hver time | Grace/status og e-postprovider |
| Scheduled reports | Hver time | Rapportlogg/mottaker |
| Doffin watches | Hver time `:15` | API/varsling |
| Doffin digest | Mandag 05:00 UTC | Mottakerliste |
| Trips månedsrapport | Første dag 06:00 UTC | Tokennavn er feilmatchet i dagens kode |
| API-overage | 05:00 UTC | Stripe meter og usagekilde |
| Partner webhook retry | Hvert 5. minutt | Kø og backoff |

Re-engagement og expiry av gamle webhook secrets har serverruter, men ingen
matchende scheduler ble funnet. Ikke anta at de kjører automatisk.

## 8. Partnere, utviklere og API

### Partnerlivsløp

1. Søknad eller invitasjon.
2. Samtykke og flertrinns verifisering.
3. Dokumenter, risikoscore og sandbox.
4. Intensjonsavtale/e-signering med IP/UA-logg.
5. API-nøkkel og webhooktest.
6. Aktiv partner, periodisk reverifisering og alerts.

Det finnes et eldre, umontert partnersøknadssystem parallelt med den aktive
singular-flyten. Bruk `/innstillinger/partnerskap` og ikke den eldre plural-
kontrakten.

Flere partnermigrasjoner inneholder bare kommentarer om direkte `psql`-kjøring
og kan ikke bygge en ny database. Før release må skjemaet gjøres
reproduserbart.

### API-nøkler

- Leadgrid public API bruker `lgk_*` og scopes.
- Partner API bruker `lg_live_*`.
- Hemmeligheten skal bare vises ved opprettelse/rotasjon.
- Rate limiting er prosesslokal; flere serverinstanser deler ikke bucket.
- Webhook secret-rotasjon har grace-periode.

OpenAPI beskriver bare et lite public API-utvalg, ikke intern- eller partner-
API. Connector-katalogen må ikke behandles som teknisk implementasjonsbevis.

## 9. Superadmin-support

### Før impersonering

1. Ha en konkret supportsak og org.
2. Kontroller audit- og tidsgrense.
3. Unngå mutasjoner hvis problemet kan reproduseres read-only.
4. Noter opprinnelig aktiv org og rolle.

### Under saken

- Kontroller org-resolver og medlemskap.
- Kontroller plan/entitlement og serverpermission separat.
- Kontroller migrations/schema health.
- Kontroller ekstern providerstatus.
- Kontroller siste webhook/cron/realtime-hendelse.
- Test en spesifikk request, ikke bare om skjermen rendrer.

### Etter saken

- Avslutt override/impersonering.
- Bekreft at kundens org fortsatt er aktiv.
- Logg hva som ble lest/endret.
- Opprett produktgap når problemet skyldes hybrid/demo/legacy-kode.

## 10. Data, audit og sletting

Kjerneobjekter:

- leads i `crm_customers`;
- besøk og aktivitet;
- assignments og status history;
- teams, permissions og entitlements;
- workflows, executions og resume jobs;
- rapporter, varsler og channel state;
- trips, utstyr, kvalitet, Academy, Leadbook og Canvas.

Noen aktive tabeller mangler reproduserbar `CREATE TABLE`, og flere nyere
moduler utfører runtime DDL. `crm_visits.customer_id` og
`crm_lead_activities.customer_id` mangler bekreftet FK til `crm_customers`.
Drift skal derfor ha egne orphan-, schema- og migrasjonskontroller.

### Lydopptak

Rå lyd, transkript og avledede eksempler følger egne retention-/sletteregler.
Vanlig soft delete av et CRM-objekt er ikke tilstrekkelig. Se
[GDPR-pakken](../../leadgrid-gdpr-lydopptak.md).

## 11. Operativ release-sjekkliste

- [ ] Ny database kan bygges fra repoets migrasjoner uten manuell `psql`.
- [ ] Schema health dekker alle tabeller/kolonner den nye funksjonen bruker.
- [ ] Tillatt og sperret rolle er testet med direkte HTTP-kall.
- [ ] Org A kan ikke lese eller endre Org B.
- [ ] Pause/suspend er testet på den konkrete API-ruten.
- [ ] Entitlement er testet på serveren, ikke bare ved skjult knapp.
- [ ] Alle eksterne nøkler har en tydelig «ikke konfigurert»-tilstand.
- [ ] Cron-token matcher workflow og backend.
- [ ] Worker tåler restart eller dokumenterer hva som går tapt.
- [ ] E-post/WA/push er testet med en faktisk mottaker i testmiljø.
- [ ] Web-lenker returnerer riktig side eller ekte 404.
- [ ] Native handling viser ikke «lagret» uten bekreftet write.
- [ ] Audit og dokumentasjon er oppdatert.

