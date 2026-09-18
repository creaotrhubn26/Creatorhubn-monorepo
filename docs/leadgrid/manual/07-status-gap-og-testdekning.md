# Leadgrid: status, gap og testdekning

**Verifisert mot kode:** 29. august 2026  
**Metode:** statisk inspeksjon av aktiv navigasjon, klientkall, lagring,
tilgangsvakter og servermontering, supplert med målrettede enhets-/kontrakt-
tester, målrettet TypeScript-typecheck og simulatorbuild. Ingen produksjonsdata
eller eksterne leverandører er brukt i denne gjennomgangen.

Dette kapitlet er kvalitetsgrensen for resten av manualen. Det skiller mellom
en flate som finnes, en handling som faktisk gjør noe, og en handling som
lagrer varig. En knapp regnes ikke som ferdig bare fordi den viser en grønn
toast eller lukker et ark.

### Implementert og verifisert 29. august 2026

Denne reparasjonsrunden lukker flere konkrete P0-feil, men gjør ikke alle
prototypeflater til ferdige produksjonswrites:

- Native møte-, aktivitets-, fil- og teamhandlinger som mangler write, viser nå
  en eksplisitt «ikke koblet»-tilstand og hevder ikke at noe er lagret eller
  sendt. De er fortsatt **ikke implementerte writes**.
- Hardkodet kontakt-/aktivitetsinnhold i kartdetaljen, syntetiske møtevalg og
  Salgsledelse-forecast er flyttet bak eksplisitt demo-modus eller erstattet av
  ærlige tomtilstander i live modus.
- Watch-hurtighandlinger får en stabil `action_id`, håndteres på iPhone og
  sendes til org-scopet status-/besøkswrite med idempotency. Ved nettfeil
  beholdes samme handling i den org-scopede køen. Watch viser bare at handlingen
  er sendt til iPhone, ikke at backend har bekreftet lagring.
- `OfflineActionQueue` beholder permanent feilede payloads etter maksimalt
  antall forsøk, viser dem i en gjenopprettingsflate og krever manuell retry
  eller eksplisitt discard. Legacy-elementer uten org-scope draines ikke.
- Realtime-bearer sendes i `Authorization`-headeren; serveren godtar ikke
  lenger token fra WebSocket-query eller brukerkanaler. Produksjonshåndtrykket
  slår alltid opp den persisterte sesjonen, og tenant-events stoppes mens
  sesjonen eller kanaltilgangen er eldre enn 15 sekunder og revalideres.
  Oppslag feiler lukket etter tre sekunder. Payload, meldingskø og antall
  org-kanaler er eksplisitt begrenset. Race-sikre reservasjoner begrenser også
  sockets globalt, per token, bruker og faktisk TCP-peer; samtidige handshakes
  dedupliserer sessionoppslaget og trege klienter stenges før outbound-bufferen
  kan vokse uten grense. Native-klienten erstatter gammel socket/reconnect når
  token, base-URL, organisasjon eller kanalsett endres.
- En sentral WebSocket path-policy gir nå hver upgrade-sti nøyaktig én eier.
  Chat-fallbacken kan ikke lenger claime `/ws/leadgrid`,
  `/ws/leadgrid-canvas` eller `/ws/dance/realtime` før de dedikerte handlerne.
  Alle production upgrade-listeners bruker i tillegg én Host-uavhengig parser;
  ugyldig Host eller request-target kan derfor ikke kaste ut resten av
  listenerkjeden. En integrasjonstest bruker samme registreringsrekkefølge som
  serveren, og en wiring-vakt dekker alle eierne og slutt-fallbacken.
- Public API v1 bruker API-keyens `organization_id` som kanonisk tenant for
  lead- og anbefalingsspørringer og håndhever organisasjonsstatus før lesing og
  skriving. Org-statusvakten er montert før første Leadgrid-/Lead Map-rute og
  fail-closed for writes.
- Workflow-ingressen bruker separate HMAC-hemmeligheter per tenant og event.
  Vanlig session er blokkert for provider-eventer og kan bare registrere
  kanonisk bundne møteeventer med eksplisitt DB-permission. Synkron
  workflow-/webhook-dispatch er fortsatt ikke en krasjsikker outbox.
- App-ventelisten er montert og rate-limitert. Status og global utsendelse
  validerer produksjonssession autoritativt mot databasen før den eksakte
  produkteiergaten og DB-verifisert rolle. Hver rad claimes først idet den skal
  sendes. Leveringsstart og stabil Message-ID lagres før SMTP; en levering med
  tvetydig utfall karanteneres som `uncertain` og sendes ikke automatisk på
  nytt. Status skiller mellom pending, in-progress og uncertain.
- Casting-påminnelser claimes nå distribuert per schedule, terskel og kanal.
  Leveringsstart committes før provider; uklare SMS-, WhatsApp- og
  e-postutfall karanteneres og e-post bruker stabil Message-ID. Migrasjon `0463`
  backfiller legacy-markører konservativt. Den gamle runneren bør pauses under
  migration/code-switch fordi gammel kode ikke deltar i den nye claimen.
- Offentlig self-onboarding bruker streng inputvalidering, 16 KiB body-grense,
  distribuert hash-basert IP-/e-postbegrensning og Turnstile før database,
  bcrypt, Stripe og e-post. Trusted proxy-hops er eksplisitt konfigurasjon og
  produksjon feiler lukket når Turnstile-nøkkel mangler. Feil content-type
  stoppes før den globale 50 MB-parseren, Turnstile har femsekunders timeout,
  og oppsettsmalens plan valideres/låses mot aktiv `plan_limits` før noen
  bruker- eller organisasjonswrite. Betalt self-onboarding oppretter
  `solo_free` frem til Stripe faktisk bekrefter betaling; ønsket betalt plan
  beholdes i checkout-metadata. Legacy betalende `solo` migreres til
  `solo_pro`, mens ikke-betalende legacy-rader migreres til `solo_free`.
- Alle øvrige JSON-/form-bodyer under `/api/leadgrid/**` passerer nå en egen
  grense før repositoryets globale 50 MB-parser. Standard og ukjente ruter har
  2 MiB JSON-cap også ved chunked transfer. Bare dokumenterte Canvas- og
  meeting-note-lydruter får større grenser, etter gyldig session og under et
  lite samtidighetsbudsjett. Kapasiteten reserveres synkront før
  sessionoppslaget venter, og frigis idempotent ved avvisning, abort, lukking
  og parserresultat; parallelle auth-kall kan dermed ikke rase forbi grensen.
  Lyd har i tillegg kanonisk base64- og 32 MiB decoded-cap før transkribering.
- Magic-link og Google-webinnlogging oppretter persisterte CreatorHub-sesjoner.
  Hemmeligheter overføres i URL-fragment, fjernes straks fra adresselinjen,
  auth-svar og requests bruker `no-store`, og midlertidige feil kan prøves på
  nytt uten å gjenbruke Google OAuth-state. Web-state er ennå ikke bundet til
  nettleseren med cookie, native callback mangler PKCE/state-validering, og
  Role Room-transferen må gjøres atomisk før hele OAuth-grensen kan regnes som
  lukket.
- Migrasjon `0464` gir brukere en monoton `auth_session_version`. Normal
  innlogging/2FA, Google ID, CreatorHub-/Leadgrid-Google og self-onboard magic
  tar versjonssnapshot. Passordreset og adminendring av rolle/aktiv-status øker
  versjonen og sletter varige sessions i samme transaksjon. En autoritativ
  resolver sammenligner snapshot mot aktiv bruker og gjeldende rolle uten
  BIGINT-presisjonstap. Den brukes foreløpig bare av den høykonsekvente
  ventelisteflyten; global vakt foran admin-/Leadgrid-writes, eldre mint-flyter
  og realtime-versjonsrevalidering er fortsatt åpne P1-punkter.
- De tidligere brutte webmålene har eksplisitt routing; der selve produktflaten
  mangler, vises en ærlig statusside. Pricing-handoff åpner riktig gratis- eller
  planmerket kontaktflyt.
- Local-admin er nå et eksplisitt root-script og virker bare i development på
  loopback. Vite binder loopback og beholder Host ved proxying når enten
  frontend- eller backendflagget er aktivt, også for trimmed/case-varianter av
  `true`. En tidligere hardkodet, reell adminsession er fjernet fra tracked
  E2E-kode, men selve sessionen må fortsatt tilbakekalles operativt før release.

Verifikasjonsbevis i denne arbeidskopien omfatter en samlet backendmatrise på
**34 testfiler / 331 tester**, gjentatt grønn to ganger, en separat
auth-/sesjonsmatrise på **85/85** og
etterfølgende parser-/WebSocket-regresjon på **5 filer / 61 tester** — alle
grønne. Frontendens berørte enhetspakke er **7 filer / 46 tester**, full
frontend- og backend-TypeScript-kontroll er grønn, Leadgrid web-navigasjon har
**11/11 enhetstester**, og Leadgrid route-handoff-E2E har **8/8 tester**. I
tillegg er Admin Workspace nå verifisert med **11/11 browser-tester** gjennom
ekte Express-ruter og en dedikert lokal PostgreSQL-database. På faktisk
iOS-simulator er `OfflineActionQueueTests` **7/7** og realtime-livssyklustesten
**1/1** grønn; full LeadMapApp simulatorbuild er også grønn. Det mangler
fortsatt en ende-til-ende WatchConnectivity-reise mot reell backend.

## 1. Statusbildet

| Status                | Hva som er bekreftet                                                                                                                                                                      | Viktigste forbehold                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Aktiv**             | iPhone-, iPad- og Mac Catalyst-hovedappen har auth, org-/prosjektkontekst, API-klient og aktiv navigasjon. De sentrale lese- og flere skriveflytene bruker produksjons-API.               | Aktiv betyr ikke at alle delknapper eller offline-scenarier er ferdige.                                                                 |
| **Aktiv · betinget**  | Roller, permissions, entitlements, plan og ekstern konfigurasjon kan åpne Kart, Leads, Salgsledelse, Leadgrid Go, Kvalitet, Anbud, Canvas og dyre AI-funksjoner.                          | Den native entitlement-modellen er bakoverkompatibel og kan være fail-open for eldre organisasjoner. Servervakt må være sannhetskilden. |
| **Hybrid**            | Oversikt, Kart, Leads, Møter, Team, Leadbook, Salgsledelse og Canvas kombinerer reelle dataflyter med lokale valg, demo-fallback, syntetiske deldata eller synlige handlinger uten write. | Status må vurderes per handling, ikke bare per skjerm.                                                                                  |
| **Lokal-only**        | Enhetsinnstillinger, enkelte notater/favoritter, målinger, møteflagg og deler av kjøreboken persisterer på én enhet.                                                                      | Lokal persistens er reell, men er ikke organisasjonsdelt eller nødvendigvis sikkerhetskopiert.                                          |
| **Demo/prototype**    | Eksplisitt demo-modus muterer in-memory. visionOS-klienten og Pondus' ecosystem-mockup bruker ikke produksjonsdata.                                                                       | Må aldri omtales som produksjonssynk.                                                                                                   |
| **Legacy/ikke nåbar** | Enkelte komponenter og ruter finnes uten aktiv parent eller route.                                                                                                                        | Kodeeksistens er ikke brukerfunksjon.                                                                                                   |

### Aktiv native navigasjon

- Uautentisert start tilbyr Google OAuth eller åttetegns pairingkode.
- iPhone viser Oversikt, Kart, Leads når tilgjengelig, Møter og Mer.
- iPad portrait bruker tab-opplevelsen; bred iPad og Mac Catalyst bruker
  sidebar.
- Sidebar/Mer gir inngang til Team, Leadbook, Salgsledelse, Leadgrid Go,
  Kvalitet, Anbud, Canvas og Verktøy.
- Salgsledelse er avgrenset til admin/salgssjef. Leads, Canvas og flere
  undermoduler kan skjules av entitlement.
- Verktøy-huben leder videre til CRM, research, Market Scan, pipeline, Next
  Best Action, analytics, varsler, kanal-onboarding, rapporter, eksport,
  partner/billing og SuperAdmin.

Primærbevis: `ipad/LeadMapApp/LeadMapApp/App/LeadMapApp.swift`,
`App/AppState.swift`, `Views/LeadgridHubView.swift`,
`Views/Tabs/Leadbook/GatedView.swift` og `TeamAccessControl.swift`.

## 2. Synlige handlinger uten varig produksjonspersistens

Tabellen omfatter handlinger som presenteres som opprett, lagre, send,
eksporter, aktiver eller endre. Vanlige Avbryt/Lukk-knapper, filtervalg og
midlertidig navigasjonsstate er ikke gap. «Lokal-only» betyr at handlingen
overlever appstart på samme enhet, men ikke er en delt backend-write.

### Felles, Leads, Kart og Møter

| Flate           | Synlig handling                        | Faktisk effekt                                                                                                                                               | Status                                         | Kildebevis                                                                         |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Delt tab-header | Ny oppfølging → Lagre                  | Sender callback og oppretter lokalt varsel; ingen follow-up-POST                                                                                             | Ingen serverpersistens                         | `Views/Shared/NewFollowUpSheet.swift`, `Views/Tabs/Shared/LeadgridTabHeader.swift` |
| Leads           | Last opp fil                           | Files-picker kan velge lokal fil og forberede metadata, men serveropplasting er sperret med tydelig beskjed. Ingen simulert progresjon eller lagringspåstand | Sperret; ingen serverpersistens                | `Views/Tabs/Leads/UploadFileSheet.swift`                                           |
| Leads           | Logg aktivitet, Lagre, Lagre + lag ny  | Beholder arket og opplysningene åpne og forklarer at aktivitetsloggen ikke er koblet                                                                         | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Leads/LogActivitySheet.swift`                                          |
| Leads           | Importer leads                         | Kildevalg og knapper lukker importarket; ingen picker eller import-API er koblet i denne native flaten                                                       | No-op                                          | `Views/Tabs/Leads/LeadsFilterViews.swift`                                          |
| Leads           | Favoritt og lead-notat                 | Lagrer i `UserDefaults`; ingen org-delt backendflate                                                                                                         | Lokal-only                                     | `Views/Tabs/Leads/LeadsView.swift`                                                 |
| Leads-detalj    | Ring, e-post, SMS og video             | Åpner ekstern systemapp når mulig; oppretter ikke automatisk Leadgrid-aktivitet                                                                              | Ekstern handling, ingen CRM-write              | `Views/Tabs/Leads/FollowUpDetailSheet.swift`, `FollowUpCommSheets.swift`           |
| Kart            | Planlegg/book møte                     | Beholder valgene i arket og sier eksplisitt at møte, kalenderoppføring og invitasjon ikke er lagret/sendt                                                    | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Kart/ScheduleMeetingSheet.swift`                                       |
| Kart            | Målinger og lagrede måleruter          | Lagrer på enheten                                                                                                                                            | Lokal-only                                     | `Views/Shared/MeasureToolModels.swift`, `MeasureRouteSheets.swift`                 |
| Møter           | Book møte                              | Beholder arket og varsler at møte, kalender, invitasjon og status ikke er endret                                                                             | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Moeter/BookMeetingSheet.swift`                                         |
| Møter           | Logg/Lagre notat                       | Beholder notatet i arket og viser at lagring ikke finnes; AI-transkribering er fortsatt en stub i denne flaten                                               | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Moeter/MeetingSheets.swift`                                            |
| Møter           | Endre status                           | Beholder valgene og forklarer at status/notat ikke er lagret                                                                                                 | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Moeter/MenuActionSheets.swift`                                         |
| Møter           | Avlys møte                             | Forklarer at møtet ikke er avlyst, kontakten ikke er varslet og ingen ny tid er foreslått                                                                    | Ærlig sperret; ingen serverpersistens          | `Views/Tabs/Moeter/MenuActionSheets.swift`                                         |
| Møter           | Tilordne selger                        | Live-team kan brukes som forhåndsvisning, men valget beholdes i arket og meldes som ikke lagret                                                              | Ærlig sperret; ingen assignment-write          | `Views/Tabs/Moeter/MenuActionSheets.swift`                                         |
| Møter           | Legg til i kampanje / Opprett kampanje | Syntetiske kampanjer vises kun i demo. Handlingen er merket som demo/ikke koblet og skriver ikke                                                             | Demo eller ærlig sperret; ingen kampanje-write | `Views/Tabs/Moeter/MenuActionSheets.swift`                                         |
| Møter           | Endre tidspunkt/varighet               | Lagrer bare når arket får en verifisert callback; ellers beholdes valgene med tydelig feil. Ren resize-visning er fortsatt lokal state                       | Hybrid                                         | `Views/Tabs/Moeter/MeetingsView.swift`, `MenuActionSheets.swift`                   |
| Møter           | Etter-møte-flagg og tidsvarsler        | ID-er og lokale pushvarsler lagres per enhet; ikke den delte møteloggen                                                                                      | Lokal-only                                     | `Views/Tabs/Moeter/MoteOppfolging.swift`                                           |

### Team og Leadbook

| Flate                | Synlig handling                                                   | Faktisk effekt                                                                                                     | Status                          | Kildebevis                                                                                    |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------- |
| Team                 | Inviter ny selger, filtrer områder, sett mål                      | Viser bare toast                                                                                                   | No-op                           | `Views/Tabs/Team/AssignAreaSheet.swift`, `TeamCards.swift`, `TeamKPIDetail.swift`             |
| Team                 | Eksporter CSV, sammenlign periode, send rapport, marker alle lest | Manglende callback gir nå «ikke koblet til lagring», aldri suksess. En faktisk callback omtales bare som startet   | Ærlig sperret når write mangler | `Views/Tabs/Team/TeamStubActions.swift`, `TeamCards.swift`, `TeamKPIDetail.swift`             |
| Team                 | Forecast 30 dager og pipeline-helse                               | Manglende callback gir informasjon om at handlingen ikke er koblet, ikke suksess-toast                             | Ærlig sperret; ingen write      | `Views/Tabs/Team/TeamStubActions.swift`, `TeamCards.swift`                                    |
| Team                 | Tilpass dashboard og Import fra Excel                             | Manglende callback fremstilles ikke lenger som utført                                                              | Ærlig sperret; ingen write      | `Views/Tabs/Team/TeamView.swift`                                                              |
| Team KPI             | AI-foreslå formel og Opprett KPI                                  | AI-knappen viser toast; Opprett lukker bare arket                                                                  | No-op                           | `Views/Tabs/Team/CreateCustomKPISheet.swift`                                                  |
| Team KPI             | Sett mål, aktiver alert, send rapport og ukentlig rapport         | Skjemaene samler data, men lagre/send lukker bare arket                                                            | No-op                           | `Views/Tabs/Team/TeamKPIDetail.swift`                                                         |
| Team-tilgang         | Rediger medlemsrolle/overrides                                    | Teamlisten er live, men per-medlem-RBAC er lokal preview og backendmedlemmer defaultes til seller i denne modellen | Hybrid/local-only               | `Views/Tabs/Leadbook/TeamAccessControl.swift`                                                 |
| Leadbook             | Ytelse → Eksporter CSV/PDF/Del rapport                            | Tomme closures                                                                                                     | No-op                           | `Views/Tabs/Leadbook/LeadbookCards.swift`                                                     |
| Leadbook KPI         | Sett mål og Lag varsel                                            | Gir toast i foreldrevisningen, men ingen persistens                                                                | No-op                           | `Views/Tabs/Leadbook/LeadbookCards.swift`                                                     |
| Leadbook KPI         | Del rapport → Send                                                | Lukker arket; ingen e-post, fil eller rapportjobb                                                                  | No-op                           | `Views/Tabs/Leadbook/LeadbookCards.swift`                                                     |
| Leadbook-kortskanner | Lagre lead                                                        | OCR skjer lokalt, men lagring viser toast og lukker. Den separate Leads-skanneren bruker reelt API                 | No-op i Leadbook                | `Views/Tabs/Leadbook/BusinessCardScanner.swift`, kontra `Views/BusinessCardScannerView.swift` |
| Leadbook Maler       | Lagre som vanlig medlem                                           | `UserDefaults` på enheten; leder/superadmin forsøker org-/global backendversjon                                    | Lokal-only for ikke-leder       | `Views/Tabs/Leadbook/LeadbookMalerTab.swift`                                                  |
| Legacy Pondus        | Eksport, publisering/godkjenning og enkelte editorvalg            | Lokal state eller dismiss-only; legacy-flaten vises primært ved manglende publiserte maler i demo                  | Demo/no-op                      | `Views/Tabs/Leadbook/PondusTab.swift`                                                         |
| Pondus ecosystem     | Interaksjoner i Watch/iPhone/Mac/Vision-visualisering             | Interaktiv produktmockup i hovedappen, ikke plattformkommunikasjon                                                 | Demo/prototype                  | `Views/Tabs/Leadbook/PondusEcosystem.swift`                                                   |
| SuperAdmin           | Bytt plan                                                         | Velgeren er eksplisitt forhåndsvisning. Entitlement-matrisen, ikke planvelgeren, endrer faktisk tilgang            | No-op                           | `Views/Tabs/Leadbook/SuperAdmin.swift`                                                        |

### Leadgrid Go og andre lokale writes

| Handling                                              | Faktisk lagring                                    | Begrensning                                                        | Kildebevis                                                                            |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Automatisk registrert tur fra fullført kartnavigasjon | `TripStore` lokalt og et fire-and-forget push-kall | API-feil blir ikke lagt i generell offline-kø                      | `Views/Tabs/Kart/KartView.swift`, `Core/TripService.swift`                            |
| Tur opprettet av bakgrunnsdetektoren                  | `TripStore` i `UserDefaults`                       | Pusher ikke umiddelbart; bulk-sync skjer når Kjørebok åpnes        | `Core/TripDetector.swift`, `Core/TripLog.swift`, `Views/Tabs/Kart/KjorebokView.swift` |
| Notat på tur                                          | Lokal `TripStore`                                  | Ingen separat note-PATCH; kan først følge med ved senere bulk-sync | `Core/TripLog.swift`, `TripService.swift`                                             |
| PDF fra kjørebok                                      | Lokal midlertidig fil og systemdeling              | Ikke rapportarkiv i backend                                        | `Views/Tabs/Kart/KjorebokView.swift`                                                  |

Eksplisitt demo-modus skriver med vilje aldri til produksjon. Dette er riktig
sikkerhetsatferd, men all demo-copy skal fortsette å være tydelig merket.

## 3. Apple Watch, Vision Pro, widget og Live Activity

| Plattform          | Reell status                                                      | Dataflyt                                                                                                                                                                                                                                      | Kritisk gap                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Watch        | Hybrid companion med tre hovedsider: Leads, Hurtignotat og Pondus | iPhone sender opptil 50 leads og Pondus-snapshot via WatchConnectivity; Watch cacher i `UserDefaults`. Hurtighandlinger får stabil `action_id`, håndteres på telefonen og går til org-scopet, idempotent status-/besøkswrite eller offline-kø | Watch viser «sendt til iPhone», ikke falsk backend-suksess. Det mangler fortsatt backend-ACK tilbake til Watch og dokumentert companion-E2E. |
| Watch hurtignotat  | Analyseflyt er koblet via telefonen                               | Diktert tekst sendes til `TranscriptIntelligence`, og analyse returneres                                                                                                                                                                      | Resultatet oppretter ikke notat, task eller follow-up.                                                                                       |
| Watch Pondus       | Reell companion-sync                                              | Toppmaler og aktiv mal sendes/caches; entitlement-denial sender tomt snapshot                                                                                                                                                                 | Ingen dokumentert ende-til-ende-test.                                                                                                        |
| Watch complication | Ikke implementert                                                 | Ingen target eller source                                                                                                                                                                                                                     | Produkttekst om complication/«12 leads i dag» må ikke regnes som levert.                                                                     |
| Vision Pro         | Demo/prototype                                                    | Eget seed-datasett med to maler og lokal session-state                                                                                                                                                                                        | Ingen auth, org, rolle, entitlement, API eller synk. Targetet er ikke embedded/dependency i hovedappen.                                      |
| Widget             | Aktiv read-only snapshotflate                                     | Hovedappen skriver app-group-fil; WidgetKit leser og refresher omtrent hvert 15. minutt                                                                                                                                                       | Ingen knapp, deep link eller manuell refresh; data kan være stale hvis hovedappen ikke har oppdatert snapshot.                               |
| Live Activity      | Aktiv på iOS                                                      | Hovedappen starter/stopper ActivityKit-state for aktivt besøk                                                                                                                                                                                 | Ikke tilgjengelig i Catalyst og ikke et varig aktivitetsarkiv.                                                                               |

Kilder: `ipad/LeadMapApp/LeadgridWatchApp/`,
`LeadMapApp/Core/WatchSession.swift`, `LeadgridVisionApp/`, `LeadMapWidget/`,
`LeadMapApp/Core/WidgetSnapshot.swift` og `Core/ActiveVisitActivity.swift`.

Watch deklarerer mikrofontillatelse, men har ingen egen lydopptaker; hurtignotat
bruker systemdiktering. Vision-targetet deklarerer kamera-/mikrofontekst uten at
dagens kode bruker sensorene.

## 4. Offline, synk og realtime

| Mekanisme              | Bekreftet dekning                                                                                                                                                                                                                                                                                                                             | Begrensning eller risiko                                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline snapshot-cache | JSON-snapshots i Documents for sentrale lesedata                                                                                                                                                                                                                                                                                              | Ingen database, konfliktmodell eller generell stale-policy. README-omtale av GRDB er ikke sann for LeadMap-targetet.                                                                                                                         |
| Pending visit queue    | Besøkslogger lagres i JSON og vellykkede writes fjernes ved flush                                                                                                                                                                                                                                                                             | Spesialisert til besøk, ikke generell mutasjonskø.                                                                                                                                                                                           |
| `OfflineActionQueue`   | NBA accept/dismiss/execute, lead-status og Watch-telefonkontakt har org-scopede wrappers. Samme UUID brukes som idempotency-nøkkel ved direkte kall og retry. Simulator-testene dekker også samtidige drain, korrupt lagring og skrivefeil                                                                                                    | De fleste writes bruker den fortsatt ikke. Etter fem feil beholdes payloaden som permanent feilet med auditbar ID, manuell retry og eksplisitt discard; legacy-payload uten org-scope draines ikke.                                          |
| Nettverksmonitor       | Drenerer kø ved appstart og offline→online                                                                                                                                                                                                                                                                                                    | Beviser ikke at pågående skjermhandlinger retries.                                                                                                                                                                                           |
| API-klient             | Bearer, 20 sekunders timeout og `waitsForConnectivity`; raw write støtter eksplisitt idempotency-header                                                                                                                                                                                                                                       | Ingen generell automatisk retry eller idempotency. De org-scopede offline-wrapperne bruker det, mens flere andre writes har egne eller ingen retries.                                                                                        |
| WebSocket              | Org-kanal, heartbeat/pong og eksponentiell reconnect; polling supplerer. Bearer sendes kun i `Authorization`-header. Serveren revaliderer persistert session, org-status og medlemskap periodisk og revokerer kanal eller socket fail-closed. Native generation-guard bytter socket/reconnect ved endret token, base-URL, org eller kanalsett | Realtime-livssyklus har én målrettet native simulator-test, men ingen ende-til-ende-test av socket, serverrevalidering og eventfanout. Root håndterer globalt hovedsakelig `lead.created`; andre eventer avhenger av at aktuell view lytter. |
| Widget snapshot        | App-group-fil etter `refreshAll`                                                                                                                                                                                                                                                                                                              | Read-only og mulig gammel frem til ny app-refresh/timeline.                                                                                                                                                                                  |
| WatchConnectivity      | Context for siste state og `transferUserInfo` for returhandlinger; telefonens quick-action-handler er koblet til org-scopet, idempotent write/kø                                                                                                                                                                                              | Levering til telefon er fortsatt ikke det samme som backendbekreftelse; ACK tilbake til Watch og companion-E2E mangler.                                                                                                                      |

Primærbevis: `Core/OfflineCache.swift`, `OfflineActionQueue.swift`,
`OfflineResilientActions.swift`, `NetworkMonitor.swift`,
`LeadgridRealtimeClient.swift`, `Core/APIClient.swift` og `App/AppState.swift`.

## 5. Syntetiske data: reparert og gjenværende

| Funn                                                                                                   | Nåværende konsekvens/status                                                                                                                                       | Kildebevis                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Full kart-leaddetalj hadde «Anders Johansen», rolle, kontaktkanaler, notater og aktivitet utenfor demo | **Reparert for denne flaten:** ekte modellverdier brukes i live modus; manglende data skjules eller får tomtilstand. Eksempelinnhold vises bare i eksplisitt demo | `Views/Tabs/Kart/LeadDetailFullSheet.swift` og tilhørende kode i `KartView.swift`                               |
| Møteark brukte syntetiske selgere, kampanjer, kontaktverdier og detaljinnhold                          | **Reparert for de berørte arkene:** live-team brukes der det finnes; resterende eksempeldata er demo-gatet eller erstattet med ærlig tomtilstand                  | `Views/Tabs/Kart/ScheduleMeetingSheet.swift`, `Views/Tabs/Moeter/MeetingSheets.swift`, `MenuActionSheets.swift` |
| Salgsledelsesforecast og cockpit hadde mockrader og hardkodet AI-analyse i live modus                  | **Reparert for cockpit-flatene:** mockdatasett er demo-gatet, AI-teksten er merket demo og live modus bruker backenddata eller tomtilstand                        | `Views/Tabs/Shared/SalgssjefCockpit.swift`                                                                      |
| Leadbook Oversikt bygger deler av innholdet fra statisk `LeadbookData`                                 | **Åpent gap:** live valgt mal og statisk opplæringsinnhold kan blandes                                                                                            | `Views/Tabs/Leadbook/LeadbookView.swift`                                                                        |
| Academy kan falle tilbake til mockdata ved manglende liveinnhold                                       | **Åpent gap:** tom/feilet backend kan se ut som et ferdig kursbibliotek                                                                                           | `Views/Tabs/Leadbook/AcademyTab.swift`, `PondusAcademy.swift`                                                   |
| Vision Pro bruker to hardkodede maler                                                                  | **Avgrenset prototype:** hele opplevelsen er eksplisitt prototype, ikke kundedata                                                                                 | `LeadgridVisionApp/Core/VisionPondusModels.swift`                                                               |

Syntetiske data skal enten flyttes bak eksplisitt demo-flag, merkes som
eksempel eller erstattes av en ærlig tom-/feiltilstand.

## 6. Kjente web- og backendgap

Web har aktive enkeltsider og en omfattende eierstyrt Lead Map, men ingen
samlet, ordinær Leadgrid web-shell for en organisasjonsbruker. Tabellen skiller
mellom reparerte kontrakter og åpne produktgap:

| Gap                             | Faktisk tilstand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Kildebevis                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingen samlet webapp             | Import, Deals, Workflows, partner og Lead Map deler ikke shell eller én auth-/org-klient                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `frontend/client/src/components/role-room/casting-main.tsx`                                                                                                                                                                                                                                                 |
| Eierstyrt hovedverktøy          | Admin Room Lead Map er gated til `daniel@creatorhubn.com`, selv om API-et har bredere rollemodell                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `frontend/client/src/pages/AdminRoom.tsx`, `components/admin/LeadMapPanel.tsx`                                                                                                                                                                                                                              |
| Flere authmønstre               | Magic-/Google-inngangen er reparert, men øvrige flater bruker fortsatt cookie-fetch, `apiRequest`, `apiFetch`, `rr_bearer` og andre tokenkeys med ulik 401/org-atferd                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `pages/leadgrid-welcome.tsx` og de respektive Leadgrid-klientene under `frontend/client/src/`                                                                                                                                                                                                               |
| Magic- og Google-weblogin       | **Delvis reparert:** magic-token konsumeres atomisk og begge webflyter oppretter en persistert CreatorHub-session. Welcome leser hemmeligheter fra fragment, renser URL-en straks, bruker `no-store` og tilbyr trygg retry ved midlertidig feil. Google-state konsumeres én gang og utvekslet ID-token beholdes bare i minnet ved retry. Åpent sikkerhetsarbeid: browser-cookiebinding av web-state, PKCE og lokal state-sammenligning i native Leadgrid/Storyboard samt atomisk engangs-consume av Role Room OAuth-transfer                                                                                                                                                                                                                                                                                                              | `backend/server/org-self-onboard-routes.ts`, `leadgrid-google-auth-routes.ts`, `role-room-oauth-store.ts`, `role-room-routes.ts`, `frontend/client/src/pages/leadgrid-welcome.tsx`, `frontend/e2e/leadgrid-route-handoffs.spec.ts`                                                                          |
| Offentlig self-onboarding       | **Hardenet og kontrakttestet:** JSON/+json og 16 KiB håndheves før globale parsere; streng schema, atomisk distribuert rate-limit på hashet IP og e-post, eksplisitt trusted-hop-modell og Turnstile med timeout kjører før kostbar eller muterende behandling. Malen JOINes/låses mot aktiv `plan_limits`; ukjent/deaktivert plan feiler før user/org-write. Produksjon feiler lukket uten secret/site key eller ved Cloudflares test-secret. Ny betalt registrering står på `solo_free` frem til betalingsbekreftelse; checkout beholder ønsket plan. `0462` reparerer både ikke-betalende og betalende legacy Solo-rader. Migrasjonene `0461` og `0462` samt begge Turnstile-variablene må være på plass før backend/frontend kan rulles ut                                                                                            | `backend/server/org-self-onboard-routes.ts`, `org-self-onboard-routes.test.ts`, `role-room-turnstile-service.ts`, `backend/migrations/0461_leadgrid_public_self_onboard_rate_limits.sql`, `backend/migrations/0462_org_setup_template_plan_integrity.sql`, `frontend/client/src/pages/leadgrid-landing.tsx` |
| Leadgrid request-body           | **Reparert og kontrakttestet:** hele `/api/leadgrid/**` får 2 MiB JSON-standard og 32 KiB formgrense før global parser, også for ukjent path og chunked transfer. Store Canvas-/lydruter krever løst session før buffering og deler en concurrency-gate; plassen reserveres atomisk før første auth-`await`, med idempotent release på alle avslutningsbaner. Egne caps er 36 MiB Canvas og 46 MiB encoded lyd. Lyd valideres som kanonisk base64 og maksimalt 32 MiB decoded før provider                                                                                                                                                                                                                                                                                                                                                | `backend/server/leadgrid-body-parser-security.ts`, `leadgrid-body-parser-security.test.ts`, `leadgrid-validators.ts`, `leadgrid-validators-audio.test.ts`, `backend/server/index.ts`                                                                                                                        |
| App-venteliste                  | **Reparert og kontrakttestet:** offentlig påmelding har egen 2 KiB-parser før global parser, bruker samme eksplisitte trusted-hop-IP-modell som self-onboarding, er rate-limitert og duplikat varsler ikke admin på nytt. Adminstatus og global send gjør autoritativt persistent sessionoppslag, avviser tilbakekalt cache-token, og krever eksakt produkteiergate samt DB-verifisert rolle. Rader claimes én om gangen. Leveringsstart og stabil Message-ID lagres før SMTP; tvetydig provider-/kvitteringsutfall karanteneres som `uncertain` for manuell avklaring og kan ikke auto-claimes igjen                                                                                                                                                                                                                                     | `leadgrid-app-waitlist-routes.ts`, `leadgrid-app-waitlist-routes.test.ts`, `casting-reminder-sender.ts`, `backend/server/index.ts`                                                                                                                                                                          |
| Casting-påminnelser             | **Reparert og DB-verifisert:** `0463` gir atomisk claim per schedule, terskel og kanal. En ti minutters lease kan bare reclaimes før leveringsstart; etter providerstart er delivered/uncertain terminalt. E-post kan bare frigis for bevist `definite_pre_delivery`, og bruker stabil Message-ID/120 s timeout. SMS/WhatsApp karanteneres konservativt ved feil etter start. Utrulling krever migrasjon før ny runner og helst pause av gammel runner i switch-vinduet                                                                                                                                                                                                                                                                                                                                                                   | `backend/server/casting-reminder-runner.ts`, `casting-reminder-runner.delivery.test.ts`, `backend/migrations/0463_casting_reminder_delivery_claims.sql`                                                                                                                                                     |
| Webruter og historiske slugs    | **Reparert på routingnivå:** alle `/leadgrid/*` eies av Leadgrid-routeren; developers-/partners-aliaser peker til aktive flater. Kart, API-keys og connector-docs viser en ærlig statusside fremfor 404/fallthrough. Disse statussidene er ikke de manglende produktflatene                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `lib/leadgridNavigation.ts`, `casting-main.tsx`, `pages/leadgrid-route-status.tsx`                                                                                                                                                                                                                          |
| Pricing-handoff                 | **Reparert:** gratisplan åpner self-onboarding; betalte planer overfører validert plan/periode til en planmerket demo-/kontaktflyt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `leadgrid-pricing.tsx`, `leadgrid-landing.tsx`, `lib/leadgridNavigation.ts`                                                                                                                                                                                                                                 |
| Public API tenant-/statusgrense | **Reparert:** API-keyens `organization_id` er kanonisk for list, count, read, create og recommendations; body-org ignoreres og legacy NULL failer lukket. Key-auth slår i tillegg opp org-status: suspended/closed sperres, paused/read-only er lesbare men kan ikke skrive, og statusfeil failer lukket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `backend/server/leadgrid-api-key-auth.ts`, `leadgrid-public-api-v1.ts`, `leadgrid-public-api-v1.test.ts`                                                                                                                                                                                                    |
| Workflow-eventgrense            | **Ingress reparert; leveringsgap åpent:** HMAC er tenant+event-bundet, provider-eventer avviser vanlig session, møte-session krever eksplisitt permission, og møter/forslag/lokale kontrakter bindes kanonisk før idempotent behandling. Audit, `publishEvent` og webhook kjører fortsatt synkront uten transaksjonell outbox; krasj eller delvis feil kan derfor gi duplikat workflow/audit eller mistet webhook. Stabil delivery-ID og persistent retry krever en egen godkjent worker-endring                                                                                                                                                                                                                                                                                                                                          | `backend/server/leadgrid-workflow-triggers-routes.ts`, `leadgrid-workflow-triggers-routes.test.ts`, `backend/migrations/0460_leadgrid_workflow_event_ingress_security.sql`                                                                                                                                  |
| Org-statushåndheving            | **Reparert for writes, lesegap åpent:** vakten monteres før første rute, håndhever active/paused/read-only/suspended/closed og feiler lukket ved uklar org eller statusfeil på writes. Autentiserte/protected reads uten entydig org og status-/kontekstfeil kan fortsatt passere; legacy `userId → organizationId`-gjetning og workflow-eventstatus må strammes etter eksplisitt godkjenning                                                                                                                                                                                                                                                                                                                                                                                                                                             | `backend/server/org-status-enforcement.ts`, `org-status-enforcement.test.ts`, `backend/server/index.ts`                                                                                                                                                                                                     |
| Realtime auth og livssyklus     | **Delvis reparert på kontraktnivå:** bare org-kanaler og header-only bearer; persistent session, org-status og medlemskap revalideres med maksimalt 15 sekunders ferskhet og tresekunders fail-closed timeout. Payload, meldingskø, kanalsett, totale sockets og sockets per token/bruker/TCP-peer er begrenset; sessionlookup dedupliseres og outbound-buffer har hard grense. Sentral path-policy gir én eier, og alle upgrade-listeners bruker Host-uavhengig URL-parsing. **Åpent P1:** persistent session-raden JOINes ennå ikke mot `users.auth_session_version`/`is_active`; et login/reset-race kan derfor overleve for handshake/revalidering. Andre socketfamilier er fortsatt cache-first eller uten løpende autoritativ revalidering. Grensene er per backendprosess; TCP-peer-grensen må vurderes mot faktisk proxy-topologi | `backend/server/leadgrid-realtime.ts`, `websocket-path-policy.ts`, `websocket-path-policy.test.ts`, `leadgrid-realtime-auth.test.ts`, `leadgrid-realtime-lead-created.test.ts`, `LeadMapApp/Core/LeadgridRealtimeClient.swift`                                                                              |
| Lokal dev-admin-session         | **Avgrenset:** den kjente `dev-admin-local-session` godtas bare når backend faktisk kjører med `NODE_ENV=development`, eksplisitt opt-in og både direkte TCP-peer og Host er loopback. Browser-origin må også være loopback og `Sec-Fetch-Site` kan ikke være cross-site. Root-scriptet setter begge flagg; Vite binder `127.0.0.1`, beholder Host og avviser ukjent Host. Backend og Vite normaliserer begge trimmed/case-varianter av `true`. Preview, test, produksjon, offentlig Host og ekstern peer avvises                                                                                                                                                                                                                                                                                                                         | `backend/server/local-development-session.ts`, `local-development-session.test.ts`, `frontend/shared/devServerSecurity.ts`, `frontend/shared/devServerSecurity.test.ts`, `backend/server/index.ts`, `package.json`                                                                                          |
| Race-sikker sessionrevokering   | **Primitiver implementert; global håndheving åpen:** `0464` oppretter monoton sessionversjon. Passordreset og admin rolle-/aktiv-status gjør versjonsbump og persistent sletting transaksjonelt; sentrale login-/2FA-/Google-/magic-flyter tar snapshot, og resolveren avviser inaktiv bruker, rolle-/versjonsmismatch og DB-feil fail-closed. Policyfunksjonen for Leadgrid-writes er ennå ikke montert globalt, så synkrone cache-vakter kan fortsatt godta et forsinket stale login-token. Role Room Google og flere eldre mint-flyter mangler komplett `is_active`/versjonssnapshot, og socketene mangler samme join. `0464` må kjøres før koden aktiveres                                                                                                                                                                            | `backend/migrations/0464_users_auth_session_version.sql`, `backend/server/auth-session-authority.ts`, `auth-session-authority.test.ts`, `auth-routes.ts`, `password-reset-service.ts`, `admin-users-routes.ts`, `role-room-routes.ts`, `leadgrid-realtime.ts`                                               |
| E2E-sessionhemmelighet          | **Kode reparert, operativ P0 åpen:** en reell adminsession lå hardkodet i Playwright/Swift-QA. Literalene er fjernet; testene krever nå miljøvariablene `STORYBOARD_VERIFY_TOKEN`/`SB_TOKEN` og skipper uten kortlivet session. Tokenet finnes fortsatt i git-historikk og var aktivt ved verifisering. Akkurat denne sessionen må tilbakekalles og 401 må bevises før release                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `frontend/e2e/storyboard-vision-verify.spec.ts`, `ipad/StoryboardStudio/StoryboardStudioUITests/E2EWorkflowQATests.swift`, `FeatureVisualQATests.swift`                                                                                                                                                     |
| Deals                           | Markedsføring lover drag-and-drop; siden grupperer kort uten stage-drag eller stage-editor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `leadgrid-landing.tsx`, `leadgrid-deals.tsx`                                                                                                                                                                                                                                                                |
| Workflow Builder                | Sender alltid `conditions: []`; full condition-editor og reell manuell execute mangler                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `leadgrid-workflows.tsx`, `leadgrid-workflow-*.ts`                                                                                                                                                                                                                                                          |
| Lead Map-filter                 | Synlig 7-dagersknapp har ingen koblet filtertilstand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `components/admin/LeadMapPanel.tsx`                                                                                                                                                                                                                                                                         |
| Import-ferdig-CTA               | **Reparert som ærlig handoff:** `/leadgrid/map` er nå nåbar og forklarer hvordan kartet åpnes; en ordinær webkartflate er fortsatt ikke levert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `leadgrid-import.tsx`, `pages/leadgrid-route-status.tsx`, `casting-main.tsx`                                                                                                                                                                                                                                |
| Portal-SMS                      | Backendkontrakten støtter SMS, men klientportalen viser bare e-post og WhatsApp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `leadgrid-client-portal.tsx` og portalens servermodell                                                                                                                                                                                                                                                      |
| Umonterte flater                | Lead Map org-panel, CRM customer drawer og web kanal-onboarding har ingen aktiv parent. Partnersluggen bruker nå den aktive partner-wizarden                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `LeadMapOrgPanel.tsx`, `CrmCustomerDetailDrawer.tsx`, `NotificationChannelsOnboardingWizard.tsx`, `casting-main.tsx`                                                                                                                                                                                        |
| Integrasjonsmerking             | Connectors-katalogens «Live» er bredere enn verifiserte konfigurasjons-/dokumentasjonssider                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `leadgrid-connectors.tsx`                                                                                                                                                                                                                                                                                   |

Utrulling av denne hardeningen er rekkefølgeavhengig: `0460` må ligge før den
nye workflow-ingressen, `0461` og `0462` før offentlig self-onboarding, `0463`
før ny reminder-runner og `0464` før kode som leser eller skriver
`auth_session_version`. Gammel reminder-runner bør pauses i switch-vinduet.
Produksjon må i tillegg ha begge Turnstile-variablene og korrekt antall trusted
proxy-hops; local-admin-/E2E-flagg skal aldri finnes i preview eller produksjon.
Ingen av migrasjonene eller kodeendringene i denne gjennomgangen er deployet.

Servermodul eller komponent alene er ikke bevis på nåbar funksjon. Se
[Leadgrid web og portaler](./09-web-og-portaler.md) for full rutekatalog.

## 7. Testnivå

### Native Apple-klienter

| Område                      | Eksisterende bevis                                                                                                                                                                                                                                                                                                   | Mangler                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Transcript intelligence     | Målrettede enhetstester for on-device/backend-routing og fallback med mocks                                                                                                                                                                                                                                          | Reell modell, auth, nett og persistens                                                                    |
| Hovedfaner                  | `QASweepTests` åpner faner/modaler og tar skjermbilder                                                                                                                                                                                                                                                               | Testen har `continueAfterFailure`; manglende element kan bli «UTILGJENGELIG»-bilde i stedet for feil      |
| Accessibility               | Begrenset audit for Oversikt, Leads og Møter                                                                                                                                                                                                                                                                         | Team, Leadbook, Go, Kvalitet, Anbud, Canvas, Watch og Vision                                              |
| Kart                        | Screenshot-/manuell verifisering                                                                                                                                                                                                                                                                                     | MapKit-ruter, location, reroute, besøkskø og annotasjoner som deterministiske tester                      |
| Persistens                  | Ingen samlet dekning                                                                                                                                                                                                                                                                                                 | Opprett–les–oppdater–slett for alle synlige writes og negativ tenanttest                                  |
| Offline/realtime            | `OfflineActionQueueTests` har **7/7** grønne simulator-tester for org-scope, permanent feil/retry, legacy fail-closed, duplikat-ID, samtidige drain, korrupt køfil og skrivefeil. Realtime-livssyklus er **1/1** grønn og verifiserer at token-, base-URL- og kanal/org-endring erstatter gammel socketkonfigurasjon | Ingen ende-til-ende-test av faktisk nettutfall, serverrevalidering, reconnect, konflikt eller eventfanout |
| Watch                       | Telefonhandler og stabil action-ID finnes; køens deduplisering er testet på simulator                                                                                                                                                                                                                                | Ingen automatisert WatchConnectivity-/companion-reise, backend-ACK til Watch eller rolle-/nettmatrise     |
| Vision/widget/Live Activity | Ingen automatisert test                                                                                                                                                                                                                                                                                              | Snapshot-staleness, app-group, timeline og ActivityKit-livsløp                                            |
| Build                       | Full LeadMapApp simulatorbuild fullfører grønt på faktisk iOS-simulator                                                                                                                                                                                                                                              | Build er ikke brukerreise- eller persistensbevis                                                          |

Kilder: `ipad/LeadMapApp/LeadMapAppTests/TranscriptIntelligenceTests.swift`,
`LeadMapAppUITests/QASweepTests.swift` og `scripts/qa-sweep*.sh`.

### Web og backend

Backend har fortsatt målrettede tester for blant annet import/deduplisering,
URL Research, bransjer, intelligence/webhook-signatur, territorier, ruteplan,
deals, pricing-kontrakt, realtime `lead.created`, research-kvalitet og
salgssignalsynk. Sluttmatrisen i denne hardeningrunden kombinerer public API,
org/RBAC, onboarding, parsergrenser, workflow-ingress, auth/revokering,
realtime/WebSocket og casting-leveranse. Før de to siste race-rettelsene var
den foreløpig **32 testfiler / 299 tester** grønn. Endelig samlet kjøring er
**34 testfiler / 331 tester**, gjentatt grønn to ganger;
auth-/sessionutvalget er separat **85/85**, og
parser-/WebSocket-utvalget etter rettelsene er **5 filer / 61 tester**. Full
backend-`typecheck` er grønn. Testene beviser kontraktene, men ikke krasjsikker
workflow-dispatch, ekstern providerleveranse eller alle
sessionmint-/socketfamilier.

Webnavigasjonens resolver, historiske slugs, ukjent-rute-tilstand og
pricing-intent er dekket av **11/11 grønne enhetstester**; den samlede berørte
frontend-enhetspakken for navigasjon, auth og lokal dev-servergrense er **7
testfiler / 46 tester**. Playwright-suiten
`leadgrid-route-handoffs.spec.ts` er i tillegg **8/8 grønn** og kjører i en
faktisk localhost-browser. Den dekker router-boot, legacy-/statusruter,
pricing-/connector-handoffs, Turnstile-verifisert gratisregistrering,
magic-link, Google-code-exchange og utløpt/avbrutt/manglende velkomstlenke.

De åtte browser-testene mocker API-handoffene. De beviser klientrouting,
fragment-/query-rens, synlig feiltilstand og lagring av returnert session, men
ikke OAuth-/magic-kall gjennom reell backend, database og ekstern Google. Det
mangler også browser-E2E for Deals, Workflows, klientportal, Admin Room Lead
Map og RBAC-matrisen. Den komplette webreisen er derfor fortsatt **Krever
verifisering**.

Admin Workspace har en separat, fail-closed Playwright-harness som bare kan
starte i development/test med eksplisitt flagg, loopback TCP/Host og den eksakte
lokale databasen `creatorhub_admin_workspace_e2e`. Skjemaet dobbeltsjekker
databaseidentitet før migrasjon eller reset, bruker en syntetisk bruker og
monterer bare workspace-rutene som inngår i testen. **11/11 browser-tester**
dekker kalender-CRUD, støttefrist og Oppstartstilskudd-arbeidsflate,
dokumentredigering/forhåndsvisning/versjoner/kilder, prosjektfiler, inline
kontekst, CV-import/verifisering/generering og kollapsbar Teamchat/Varsler mot
ekte backend og lokal PostgreSQL. Eksterne leverandører og produksjonsdata er
ikke involvert.

Frontend ESLint er grønn for de berørte filene. Standard typecheck-prosess gikk
én gang tom for Node-heap ved omtrent 4 GiB; den samme komplette `tsc --noEmit`
bestod uten TypeScript-feil med 8 GiB heap. CI bør derfor gi denne store
frontendpakken eksplisitt heap eller dele typekontrollen opp.

## 8. Prioritert gap-backlog

### P0 — stopp misvisende suksess og risiko for feil kundedata

1. **Delvis implementert:** de gjennomgåtte møte-, aktivitets-, fil- og
   `TeamStubActions`-handlingene er ærlig sperret når write mangler. Flere Team-
   og Leadbook-knapper i tabellene må fortsatt kobles eller gjennomgås; sperring
   er heller ikke det samme som å levere write-funksjonen.
2. **Delvis implementert:** kartdetalj, de berørte møtearkene og
   Salgsledelse-cockpit er demo-gatet. Leadbook/Academy-gapene i seksjon 5 står
   fortsatt åpne.
3. **Implementert på telefon-/backendbanen, verifikasjonsgap gjenstår:**
   `WatchSession.onQuickAction` bruker org-scope, stabil action-ID, idempotent
   write og offline-kø. Watch viser ikke backend-suksess, men eksplisitt ACK
   tilbake til klokken og companion-E2E mangler.
4. **Implementert og enhetstestet:** permanent feil beholdes med auditbar ID,
   manuell retry og eksplisitt discard; legacy uten org-scope failer lukket.
   Køens data- og samtidighetskontrakt er simulator-testet.
5. **Delvis implementert og kontrakt-/livssyklustestet:** WebSocket-bearer ligger i
   `Authorization`-header og query-token godtas ikke. Bare org-kanaler kan
   abonneres på; produksjon validerer persistent session ved håndtrykk og før
   eventlevering etter maksimalt 15 sekunder. Auth-/membership-oppslag feiler
   lukket etter tre sekunder. Payload, kø, kanalsett, sockets per prosess,
   token, bruker og TCP-peer samt outbound-buffer er begrenset. Native klient
   erstatter gammel forbindelse når token, base-URL, org eller kanalsett endres.
   Host-/request-target-parsing er lukket. `auth_session_version` sammenlignes
   ennå ikke ved handshake/revalidering, andre socketfamilier mangler samme
   løpende autoritet, og reell socket-E2E/distribuerte grenser mangler.
6. **Implementert og kontrakttestet for Public API og writes:** API-keyens org
   er direkte tenant-scope, statusmatrisen håndheves og rutegarden feiler lukket
   på writes. Protected reads uten entydig org og read-side statusfeil er et
   eksplisitt åpent fail-open-gap.
7. **Ingress implementert, durability-gap åpent:** workflow-eventer har
   tenant+event-HMAC, session-permissions, kanonisk ressursbinding og replay-
   vern. Audit, workflow og webhook mangler fortsatt transaksjonell outbox,
   stabil webhook delivery-ID og persistent branch-retry.
8. **Implementert og kontrakttestet:** ventelistestatus og global utsendelse
   gjør autoritativ sessionsjekk, eier-/rollekontroll og én-rad-claim. SMTP-start
   lagres før send; tvetydig resultat karanteneres fremfor automatisk retry.
9. **Implementert og kontrakttestet:** public self-onboarding har streng body-
   og schema-grense foran globale parsere, distribuert rate-limit, bounded
   magic-limiter og Turnstile med timeout før kostbar behandling. Aktiv plan
   valideres/låses før user/org-write. Migrasjonene `0461`/`0462` og
   produksjonsnøkler er et eksplisitt utrullingskrav.
10. **Kode reparert, operativ blokkering åpen:** den hardkodede adminsessionen
    er fjernet fra tracked E2E-kode, men den konkrete sessionen må tilbakekalles
    og verifiseres avvist før release. Historikken skal fortsatt behandles som
    kompromittert selv om literalene ikke lenger finnes i arbeidskopien.
11. **Implementert og DB-verifisert:** casting-påminnelser bruker distribuert
    per-kanal-claim, commit-before-send og uncertain-karantene. `0463` må
    migreres før backend, og gammel runner bør pauses under switch-vinduet.
12. **Implementert og kontrakttestet:** ukjente og ordinære Leadgrid-bodyer kan
    ikke lenger bruke den globale 50 MiB-parseren; dokumenterte store ruter har
    auth-før-buffering, egne caps og en concurrency-plass som reserveres før
    første auth-`await` og frigis på alle avslutningsbaner.

**Ferdigkriterium er ikke fullt oppnådd:** alle gjenværende P0-handlinger må ha
minst én suksess-, feil-, offline- og sperret-rolletest, og en faktisk
Watch-reise og en ikke-mocket browser-E2E mot reell backend må bevise hele
brukerreisen. UI-et i de reparerte flatene hevder nå ikke mer enn den
observerte effekten.

### P1 — fullfør kjernearbeidsflytene

1. Implementere én felles møte-write for Book møte, kartbooking, notat,
   avlysning, status, ansvarlig og kampanje.
2. Koble native Lead-import og filopplasting til eksisterende server-/objekt-
   lagringskontrakter, med fremdrift, cancel og feilresume.
3. Implementere Team KPI-mål, alerts, custom KPI, rapport/eksport og Excel-
   import; fjern `TeamStubActions` som suksessfasade.
4. Gjøre Leadbook KPI-mål/varsler/rapporter reelle og la Leadbook-skanneren
   bruke samme lead-opprettingsservice som Leads.
5. Avklare én autoritativ RBAC-modell for native medlemsoversikt og backend.
6. Utvide offline-resilient writes til kjernehandlinger med idempotency og
   konfliktregler.
7. Binde web-OAuth-state til nettleseren, innføre PKCE og lokal state-validering
   i begge native klienter, og gjøre Role Room OAuth-transfer til atomisk
   engangs-consume.
8. La authenticated/protected reads feile lukket ved manglende org eller
   status-/kontekstfeil, fjerne legacy `userId → organizationId`-gjetning og
   håndheve org-status på workflow-eventer.
9. Bygge en transaksjonell workflow/webhook-outbox med stabil delivery-ID,
   persistent retry og idempotent worker før synkron dispatch kan regnes som
   krasjsikker.
10. Montere `auth_session_version`-autoriteten foran alle admin-kall og
    session-autentiserte Leadgrid/Lead Map-writes etter eksplisitt godkjenning.
    Uten mount kan samtidige login/reset/demotion-race fortsatt nå eldre,
    synkrone cache-vakter selv om snapshots og versjonsbump finnes.
11. Gjøre `is_active` og `auth_session_version` obligatorisk for Role Room
    Google og alle øvrige eldre sessionmint-flyter. Bruke den samme
    autoritative joinen ved Leadgrid-realtime-handshake/revalidering og lukke
    allerede tilkoblede chat-/Canvas-/capture-/user-event-sockets når bruker
    deaktiveres eller sessionversjonen endres.

### P2 — plattform- og webparitet

1. Lagre Watch hurtignotat som valgt notat/task/follow-up og bygg complication
   bare hvis produktet fortsatt skal love den.
2. Koble Vision Pro til auth, org, entitlements og Pondus-API, eller behold
   targetet eksplisitt som prototype uten produksjonsmarkedsføring.
3. Legge deep links og stale-indikator til widgeten der det gir verdi.
4. Etablere én Leadgrid web-shell med én session-/org-klient og ordinær inngang
   til de publiserte produktflatene; gjenbruk den reparerte magic-/Google-
   innloggingen som felles inngang.
5. Beholde de reparerte rutene, ventelisteregistreringen og pricing-handoffet,
   og levere de faktiske kart-/API-key-/connector-docs-flatene. Workflow-
   conditions og en reell import→webkart-reise står fortsatt åpne.
6. Flytte den offentlige app-ventelistens prosesslokale rate-limit til delt
   lagring og legge e-post-/menneskeverifisering foran lagring/adminvarsling.
7. Unngå konto-/organisasjonsenumerering i self-onboarding og avgjøre om
   user/org skal være provisional frem til e-post er bekreftet.
8. Gjøre Stripe-kunde, checkout og velkomstmail etter org-commit eksplisitt
   resumable/kompenserbar, slik at delvis ekstern feil ikke etterlater en
   ufullstendig onboarding uten operativ gjenoppretting.

### P3 — bevis, vedlikehold og opprydding

1. Erstatte screenshot-sweep som hovedbevis med deterministiske unit-,
   kontrakt-, integration- og E2E-tester.
2. Legge testmatrise for tillatt/sperret rolle, entitlement, org/tenant og
   direkte API-kall til alle writes.
3. Beholde kø- og realtime-livssyklustestene i CI, og legge reell nett-
   reconnect, WatchConnectivity, widget og Live Activity til der plattformen
   tillater det.
4. Fjerne eller merke foreldreløse komponenter, genererte mockups og stale
   README-påstander, inkludert GRDB/complication-påstander som ikke matcher
   targetene.
5. Gjøre gap-søk etter `TODO`, `stub`, `mock`, tomme closures og dismiss-only
   savebars til en releasekontroll.

## 9. Når et gap kan lukkes

En rad kan flyttes fra Hybrid/Demo til Aktiv først når:

1. den aktive inngangen er bekreftet;
2. handlingen kaller riktig tjeneste;
3. resultatet kan leses tilbake etter ny appstart eller på en annen klient;
4. tillatt og sperret rolle/entitlement er testet også direkte mot API;
5. offline-/feilatferd er ærlig og dokumentert;
6. demo- og live-data ikke kan blandes;
7. testen feiler når persistensen eller kontrakten brytes.

Før disse punktene er bevist skal funksjonen fortsatt beskrives som Hybrid,
Demo/prototype, Lokal-only eller Krever verifisering.
