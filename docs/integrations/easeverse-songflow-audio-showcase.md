# Integrasjon: EaseVerse ⇄ Workspace/Sound Room ⇄ Pro Tools Companion

> Implementert arkitektur og driftsrunbook for den samlede musikkprodusentflyten.
> Sist oppdatert: 2026-09-12.

## 1. Mål

Musikkprodusenten skal logge inn én gang med CreatorHub OAuth og kunne bevege seg mellom Workspace, Sound Room, EaseVerse og Pro Tools Companion uten å velge prosjekt eller låt på nytt.

Den kanoniske flyten er:

`Workspace-prosjekt → Sound Room → EaseVerse-låt → Pro Tools-session → bounce/review → keeper/reference → godkjenning/splits`

## 2. Implementert status

| Område | Status | Implementasjon |
|---|---|---|
| Felles innlogging | ✅ | EaseVerse bruker CreatorHub OAuth, HttpOnly session-cookie og `/api/auth/session`; Clerk er fjernet fra aktiv appflyt og avhengigheter. |
| Prosjektkontekst | ✅ | Workspace, Sound Room, EaseVerse track/project og prosjektnavn sendes gjennom deep-link, pairing og Companion-konfigurasjon. |
| Synlig Workspace-inngang | ✅ | Musikkprodusent ser EaseVerse og Pro Tools Companion fra Workspace/Oversikt og Sound Room, også før første studiosesjon finnes. |
| Companion-paring | ✅ | DB-lagret seks-sifret engangskode, utløp, rate-limit, atomisk claim, device-token og målrettet tilbakekalling per enhet. |
| Markører og metadata | ✅ | Session Info/Memory Locations parses lokalt, valideres og lagres transaksjonelt, blir Sound Room-seksjoner og speiles til EaseVerse. |
| Direkte Pro Tools-kontroll | ✅ | Companion bruker den lokalt lisensierte Avid PTSL 2026.4-broen til locate, markøropprettelse, lydimport og mix-export. Filmodus er fortsatt fallback. |
| Bounce til review | ✅ | Stabil filfingerprint, retry og `clientEventId` gjør opplasting idempotent; én bounce gir én review-versjon. |
| Keeper tilbake til Sound Room | ✅ | EaseVerse sender keeper via service-autentisert webhook og oppretter idempotent review-kandidat. |
| Kanonisk lydlinje | ✅ | `creatorhub_music_artifacts` følger take → import → mix → review → keeper/master med foreldre-ID, revision og prosjekt-/tenantkontekst. |
| Godkjent referansemiks | ✅ | Sound Room sender godkjent miks til EaseVerse sitt `/api/v1/collab/reference`-endepunkt. |
| Native lyd i EaseVerse | ✅ | Referansespor, takes og produsentmemoer spiller i iOS/Android og web gjennom samme `expo-audio`-spiller. |
| Pro Tools Intro-preflight | ✅ | Companion teller audio-, instrument-, MIDI-, aux- og I/O-ressurser og viser konkrete stem/flatten-tiltak før handoff. |
| Lyrics | ✅ | Revisjons-/tidsstempelstyrt last-write-wins hindrer eldre offlineutkast fra å overskrive nyere tekst. |
| Robust synk | ✅ | Companion har atomisk lokal outbox og auto-resume etter omstart. CreatorHub og EaseVerse har DB-outbox med leasing, eksponentiell retry, dead-letter og bakgrunnsworker/Netlify-cron. |
| Produsentinnboks | ✅ | `/sound-room` samler nye hendelser, åpne innspill, oppgaver, sign-off, lyttegrad og EP-/albumrekkefølge på tvers av låter. |
| Revisjonsbrief | ✅ | Sound Room grupperer tidskodet feedback i en handlingsklar brief. AI brukes server-side når tilgjengelig, med deterministisk fallback uten datatap. |
| Decision Room | ✅ | To til fire versjoner kan blindtestes. Delings-API-et skjuler kandidatnavn og stemmetall, og webspilleren måler faktisk loudness før nivåmatching aktiveres. |
| Sign-off og levering | ✅ | Rollebasert mix/master/delivery-sign-off og atomiske, nummererte leveringsmanifest gjør beslutning og overlevering eksplisitt. |
| Auth-recovery | ✅ | 401 og auth-relaterte 403-responser ugyldiggjør den lokale CreatorHub-sesjonen og viser felles innlogging på nytt; rollebaserte 403-responser logger ikke brukeren ut. |
| Companion-feedback | ✅ | Companion viser kommentarer, oppgaver, revisjonsbrief, beslutningsrom og sign-off, kan locate/svare/løse, og reagerer på den brukeravgrensede WebSocket-strømmen; 60 sekunders polling er kun fallback. |
| Realtime-sikkerhet | ✅ | Web-klienten henter en tilfeldig 30-sekunders engangsticket før WebSocket-oppkobling; OAuth-token legges ikke i URL-en. |
| Legacy EaseVerse-paring | ✅ | Gamle Clerk-/lokale Companion-kort er fjernet fra aktiv EaseVerse-UI. Paring administreres i Workspace/Sound Room. |
| Desktop-distribusjon | 🟡 | macOS-DMG-er for v0.1.3 er Developer ID-signert/notarisert i et GitHub-utkast. Windows x64 bygget, men publisering stoppet før Authenticode fordi den konfigurerte Public Trust-profilen ennå ikke finnes i Azure. Releasen forblir utkast til profilen er opprettet og Windows-smoken passerer. |

## 3. Systemkart og ansvar

| System | Eier data for | Viktige identiteter |
|---|---|---|
| CreatorHub Workspace | Bruker, workspace-prosjekt, tilgang og rolle | `userId`, `workspaceProjectId` |
| Sound Room / Audio Showcase | Review-rom, versjoner, kommentarer, seksjoner, godkjenning | `audioReviewProjectId` |
| SongFlow / EaseVerse tracks i CreatorHub | Intern låtmetadata, lyrics og kobling til splits | `easeverseTrackId`, `externalTrackId` |
| EaseVerse | Skrive-/opptaksopplevelse, takes, practice loop og ekstern prosjektside | `easeverseProjectId`, `externalTrackId` |
| CreatorHub Pro Tools Companion | Lokal PTX/session-observasjon, markører, metadata og bounces | `deviceId`, `companionSessionId`, `clientEventId` |

Kanonisk link-spine:

`workspaceProjectId ↔ audioReviewProjectId ↔ easeverseTrackId/externalTrackId ↔ easeverseProjectId ↔ companionSessionId`

Alle nye cross-app payloads bærer `schemaVersion: 1` og relevante ID-er i `projectContext`.

## 4. Felles OAuth-flyt

1. En allerede innlogget Workspace-bruker oppretter en kortlivet engangs-
   `POST /api/creatorhub/google/oauth/satellite-transfer` for den eksplisitt
   tillatte EaseVerse-origin-en. Det eksisterende session-tokenet returneres
   aldri til nettleseren eller URL-en.
2. Workspace åpner EaseVerse-callbacken med bare transfer-ID og en lokalt
   validert `/integrations/creatorhub`-retursti.
3. EaseVerse bytter transfer-ID-en server-til-server, setter en `HttpOnly`,
   `Secure`, `SameSite=Lax` session-cookie, og engangs-ID-en kan ikke spilles av
   på nytt.
4. Hvis brukeren ikke kommer fra en aktiv Workspace-sesjon, brukes samme
   CreatorHub Google OAuth som fallback. Callbacken bevarer prosjektet gjennom
   `next`, men avviser eksterne og andre interne retur-ruter.
5. Web/native leser autentisert bruker via `/api/auth/session`; token lagres
   ikke i `localStorage`. Deep-linken lagrer validert prosjektkontekst og sender
   brukeren til riktig EaseVerse-prosjekt.

Kun relative retur-URL-er eller godkjente CreatorHub-domener aksepteres. Hemmelige nøkler skal kun ligge i servermiljøet.

## 5. Companion-flyt

### Paring

- Workspace kaller `POST /api/protools/pair/start` med workspace-, Sound Room- og track-kontekst.
- Backend validerer samme tilgangsmodell som Workspace: eier eller aktivt medlem med `canEdit`. Kun prosjekteieren kan koble Workspace-rommet til en annen EaseVerse-låt.
- Companion kaller `POST /api/protools/pair/claim` med engangskoden.
- Claim er atomisk og returnerer device-token, `deviceId` og prosjektkontekst.
- Companion lagrer konteksten lokalt og forhåndsutfyller prosjekt/session.

### Session og DAW-data

Når den lisensierte Avid-broen er installert lokalt og Pro Tools lytter på
`127.0.0.1:31416`, er PTSL primær transport. Companion registrerer en ny lokal
PTSL-forbindelse per operasjon og støtter:

- flytting av timeline/playhead fra en Sound Room-kommentar
- opprettelse av en minnelokasjon/markør fra kommentaren
- sikker nedlasting og import av keeper/reference på nytt lydspor
- 24-bit WAV-export av aktiv mix-output til valgt `Bounced Files`-mappe

SDK, generert Avid-klient og rammeverk skal ikke committes eller publiseres fra
repoet. Lokalt ligger den bygde CLI-broen under
`~/.creatorhub-protools-companion/ptsl/`; Windows bruker tilsvarende appdata-path
og må bygges med Windows-utgaven av samme lisensierte SDK.

- `POST /api/protools/sessions`
- `POST /api/protools/sessions/:id/markers`
- `POST /api/protools/sessions/:id/metadata`
- `POST /api/protools/sessions/:id/playhead`
- `POST /api/protools/sessions/:id/bounce/presign`
- `POST /api/protools/sessions/:id/bounce/complete`
- `POST /api/protools/sessions/:id/realtime-ticket`
- `GET /api/protools/sessions/:id/commands`
- `POST /api/protools/sessions/:id/commands/:commandId/complete`
- `POST /api/protools/sessions/:id/feedback/comments/:commentId`
- `GET /api/protools/sessions/:id/artifacts`
- `GET /api/protools/sessions/:id/artifacts/:artifactId/file`

Sound Room sitt produsentlag bruker i tillegg:

- `GET /api/sound-room/command-center`
- `GET /api/sound-room/projects/:projectId`
- `POST /api/sound-room/projects/:projectId/briefs`
- `POST /api/sound-room/projects/:projectId/decisions`
- `POST /api/sound-room/projects/:projectId/signoffs`
- `POST /api/sound-room/projects/:projectId/manifests`
- `POST /api/sound-room/collections` og `PUT /api/sound-room/collections/:id/tracks`
- token-avgrensede `/api/audio-review-shared/:token/os`, lytte-, stemme- og sign-off-endepunkter

Watcher markerer ikke en fil som ferdig behandlet før serveren har bekreftet mottak. Session Info og bounces legges først i en atomisk lokal JSON-outbox. Køen og `auto_watch` overlever app-/maskinomstart, skannes ved oppstart og retries eksponentielt i opptil 15-minutters intervaller. Markør-/metadataeventer og bounces har stabile event-ID-er basert på innhold, ikke lokal filsti.

### Administrasjon i Sound Room

- `GET /api/protools/web/status?audioRoomId=...` viser enheter, siste session, markører, bounces og outbox-status.
- `POST /api/protools/web/unlink-device` tilbakekaller kun valgt enhet.
- `POST /api/protools/web/retry-sync` prøver pending EaseVerse-leveranser på nytt.
- `GET /api/protools/sessions/:id/feedback` gir den device-scopede innboksen med kommentarer, tasks og godkjenninger.
- `POST /api/protools/web/commands` legger locate, markør, import eller export i en varig, device-scopet kø. Kun eier eller Workspace-editor kan kontrollere Pro Tools.
- `GET /api/protools/worker/health` er separat heartbeat/readiness for den automatiske synk-workeren.
- Companion kan tilbakekalle sitt eget token ved unpair.

## 6. CreatorHub ⇄ EaseVerse servicekontrakter

Server-til-server-kall bruker `x-api-key` og samme produksjonshemmelighet på begge sider. URL-er til lyd valideres til `https` før lagring/import.

| Retning | Endepunkt | Formål |
|---|---|---|
| CreatorHub → EaseVerse | `POST /api/v1/collab/protools` | Kanonisk markør-/metadata-snapshot |
| CreatorHub → EaseVerse | `POST /api/v1/collab/lyrics` | Lyrics med revision/`updatedAt` |
| CreatorHub → EaseVerse | `POST /api/v1/collab/reference` | Godkjent referansemiks |
| EaseVerse → CreatorHub | `POST /api/audio-showcases/easeverse/keeper` | Keeper-take som review-kandidat |
| CreatorHub ← EaseVerse | `GET /api/v1/collab/protools/:externalTrackId` | Pull/recovery av DAW-snapshot |
| CreatorHub ← EaseVerse | `GET /api/v1/collab/lyrics/:externalTrackId` | Pull/recovery av lyrics |
| CreatorHub ← EaseVerse | `GET /api/v1/collab/takes/:externalTrackId` | Import av takes |

Outbox lagrer payload, `eventType`, `eventId`, forsøk, neste retry, lease, siste feil og leveringstid. Et allerede levert event med samme ID leveres ikke på nytt. CreatorHub-worker kjører hvert 15. sekund; EaseVerse sin keeper-outbox kjøres av Netlify Scheduled Functions hvert andre minutt.

## 7. Databaseendringer

Migrasjon `0558_protools_companion_integration_integrity.sql` etablerer grunnkontrakten. Migrasjon `0569_protools_companion_resilience.sql` legger til:

- `organization_id` og separat `integration_owner_user_id` på Companion-session
- leased worker-kø, dead-letter og heartbeat
- egen outbox for godkjente referansemikser
- nødvendige indekser for multi-instance draining

Migrasjon `0572_music_artifact_lineage_and_companion_actions.sql` legger til:

- kanonisk, tenant-scopet artefaktgraf for take/stem/mix/reference/keeper/master
- varig og lease-basert Sound Room → Companion-kommandokø
- PTSL-status, Pro Tools-utgave og Intro-preflight på Companion-session
- markørkvittering på Sound Room-kommentarer
- kobling fra bounce til kanonisk artefakt

Migrasjon `0589_sound_room_producer_operating_system.sql` legger til:

- produsentaktivitet og reelle lyttekvitteringer
- revisjonsbriefer og blind Decision Room med én stemme per reviewer
- rollebasert sign-off per versjon og produksjonssteg
- EP-/albumsamlinger med eksplisitt sporrekkefølge
- atomiske leveringsmanifest med metadata-identitetskontroll

EaseVerse-migrasjon `0002_creatorhub_sync_outbox.sql` etablerer varig keeper-levering tilbake til CreatorHub. Collaboration-lageret lagrer prosjektkontekst, canonical Pro Tools snapshot, referansemiks og lyrics-revisjon.

## 8. Objektlagring og tenant-hierarki

Produksjonsbøtten er `creatorhubn-prod-745600963362-eu-north-1` i AWS `eu-north-1`. Den er privat, har BucketOwnerEnforced, full public-access block, SSE-S3, versjonering, TLS-only policy og lifecycle for `temporary/`, `exports/` og `quarantine/`.

Kanonisk nøkkel for en Pro Tools-bounce:

```text
organizations/{organizationId}/users/{userId}/projects/{workspaceProjectId}/
  sound-room/{audioReviewProjectId}/protools/sessions/{sessionId}/
  bounces/{objectId}-{filename}
```

Personlige brukere bruker `personal-{userId}` som tenant-segment. PostgreSQL er autoritativ for tilgang; en S3-prefix gir aldri tilgang alene. Render skal bruke den scoped IAM-brukeren `creatorhubn-production-storage`, aldri provisioning/root-profilen. Infrastrukturpolicy og runbook ligger i `infrastructure/aws/creatorhubn-storage/`.

## 9. Verifikasjonsmatrise

Før produksjonsrelease skal følgende passere:

| Lag | Kommando/flyt | Krav |
|---|---|---|
| CreatorHub backend | målrettet Vitest for sync, Companion-ruter og realtime tickets | Alle passerer |
| CreatorHub backend | `npm run build` | Passerer |
| CreatorHub web | `npm run build` | Passerer |
| Companion Rust | `cargo test` | Alle passerer |
| Companion + ekte Pro Tools | lisensiert lokal PTSL live-test | locate, marker, import og 24-bit WAV-export bekreftes av Pro Tools |
| Companion webview | `npm run typecheck && npm run build` | Passerer |
| Companion Windows | native Windows build → Artifact Signing → install/start/uninstall-smoke | App-EXE, NSIS EXE og MSI har samme gyldige publisher; installert app starter |
| EaseVerse | `npm run typecheck && npm test` | Alle passerer |
| EaseVerse Netlify | `npm run netlify:build` | Genererte funksjoner/ruter inkluderer nye API-er |
| OAuth E2E | CreatorHub login → HttpOnly cookie → integration handoff → prosjekt | Passerer uten token i localStorage |
| Musikk E2E | Workspace → Sound Room → pair → markers/metadata → bounce → review | Samme prosjekt-/track-ID hele veien |
| Artefaktlinje | EaseVerse keeper → PT-import → export → Sound Room → approve | Foreldrelenke og status bevares; filendepunkt krever riktig device/tenant |
| Offline | Endring uten nett → retry/reconnect → én server-side versjon | Ingen duplikater eller tapt state |

## 10. Produksjonskonfigurasjon

### EaseVerse / Netlify

- `EXTERNAL_API_KEY` – servicehemmelighet for CreatorHub-kall
- `ANTHROPIC_API_KEY` – server-side AI-funksjoner
- `CREATORHUB_API_URL` – CreatorHub-produksjons-API
- `EXPO_PUBLIC_CREATORHUB_URL` – offentlig Workspace/OAuth-base

### CreatorHub / Render

- `EASEVERSE_API_URL=https://easeverse.netlify.app`
- `EASEVERSE_API_KEY` – samme verdi som EaseVerse `EXTERNAL_API_KEY`
- `CREATORHUB_S3_BUCKET=creatorhubn-prod-745600963362-eu-north-1`
- `CREATORHUB_S3_REGION=eu-north-1`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` – scoped `creatorhubn-production-storage`-identitet

### Pro Tools Companion / GitHub Actions

- GitHub OIDC kobles til en Microsoft Entra-app med federert credential for
  `repo:creaotrhubn26/Creatorhubn-monorepo:environment:protools-companion-release`.
- Environmentet tillater release-tagger og `main` for manuell rerun; workflowen
  validerer og sjekker alltid ut den eksplisitte immutable release-taggen.
- Azure Artifact Signing bruker en ferdig identitetsvalidert Public Trust-profil.
- Repository secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Repository variables: `AZURE_ARTIFACT_SIGNING_ENDPOINT`,
  `AZURE_ARTIFACT_SIGNING_RESOURCE_GROUP`, `AZURE_ARTIFACT_SIGNING_ACCOUNT`,
  `AZURE_ARTIFACT_SIGNING_PROFILE`.
- Release-pipelinen signerer app-EXE-en før bundling, signerer deretter EXE/MSI og
  avviser releasen dersom Authenticode eller RFC3161-tidsstempelet ikke er gyldig.
- Azure-profilen kontrolleres etter OIDC-innlogging og før native Windows-bygg,
  slik at manglende/ikke-aktiv profil feiler tidlig.

### Verifisert live-flyt 11. september 2026

- Pro Tools Intro 2026.4.1 åpnet en dedikert test-`.ptx`, og PTSL svarte på
  `127.0.0.1:31416` gjennom lokalt lisensiert Avid-klient.
- Companion-testen utførte locate, opprettet markør, importerte en WAV og
  eksporterte en reell 24-bit/48 kHz WAV via `ExportMix`.
- Watcheren lastet den ferdige filen opp til produksjons-backenden; Sound Room
  opprettet review-versjon 7 og en `protools`-artefakt med foreldrelenke.
- Den separate EaseVerse-sync-workeren rapporterte fersk `healthy` heartbeat.
- Testen fant og rettet to avvik i kildekoden: Sound Room skal lese bitdybde,
  samplerate og varighet fra den faktiske WAV-filen, og midlertidige
  filfingeravtrykk skal ryddes også under runtime, ikke bare etter omstart.

Logg aldri verdiene, og eksponer dem ikke gjennom `EXPO_PUBLIC_*` eller frontend-bundlen.

## 11. Release- og rollback-runbook

1. Kjør verifikasjonsmatrisen og `git diff --check` i begge repoer.
2. Deploy EaseVerse til Netlify production og kjør health/API smoke mot produksjons-URL.
3. Oppdater/trigger CreatorHub Render-deploy og verifiser health + autentiseringsgrenser.
4. Kjør reell Workspace/Sound Room deep-link og pairing-smoke.
5. Bygg iOS med neste ledige `buildNumber`, last opp til TestFlight og vent på `VALID`/processing complete.
6. Verifiser OAuth, offline kø og prosjekt-handoff på TestFlight-builden.

Rollback:

- Netlify: publiser forrige kjente deploy.
- Render: deploy forrige kjente commit.
- TestFlight: behold forrige build tilgjengelig for testere; fjern ny build fra testgruppe ved kritisk feil.
- Outbox-data beholdes under rollback og kan retries når servicekontrakten er gjenopprettet.

## 12. Deprecated flater

- `songflow-*` beholdes bare som bakoverkompatible aliaser frem til avtalt sunset.
- EaseVerse sin gamle lokale/Clerk-baserte Companion-paring returnerer HTTP 410. Gamle `pair_*`-tokens aksepteres ikke; kildekatalogene er kun read-only arkiv uten package/Cargo/release-workflow.
- Query-string-baserte bearer tokens for realtime støttes midlertidig kun for eldre klienter; nye webklienter bruker engangsticket.
