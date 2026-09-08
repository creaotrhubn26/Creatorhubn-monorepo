# Integrasjon: EaseVerse ⇄ Workspace/Sound Room ⇄ Pro Tools Companion

> Implementert arkitektur og driftsrunbook for den samlede musikkprodusentflyten.
> Sist oppdatert: 2026-09-07.

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
| Bounce til review | ✅ | Stabil filfingerprint, retry og `clientEventId` gjør opplasting idempotent; én bounce gir én review-versjon. |
| Keeper tilbake til Sound Room | ✅ | EaseVerse sender keeper via service-autentisert webhook og oppretter idempotent review-kandidat. |
| Godkjent referansemiks | ✅ | Sound Room sender godkjent miks til EaseVerse sitt `/api/v1/collab/reference`-endepunkt. |
| Lyrics | ✅ | Revisjons-/tidsstempelstyrt last-write-wins hindrer eldre offlineutkast fra å overskrive nyere tekst. |
| Robust synk | ✅ | CreatorHub bruker persistent outbox med event-ID, leveringsstatus, feilårsak, eksponentiell retry og manuell retry fra Sound Room. |
| Realtime-sikkerhet | ✅ | Web-klienten henter en tilfeldig 30-sekunders engangsticket før WebSocket-oppkobling; OAuth-token legges ikke i URL-en. |
| Legacy EaseVerse-paring | ✅ | Gamle Clerk-/lokale Companion-kort er fjernet fra aktiv EaseVerse-UI. Paring administreres i Workspace/Sound Room. |

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

1. EaseVerse åpner CreatorHub authorization-endepunkt med PKCE, `state` og en strengt validert callback.
2. Callback sender authorization code + verifier til EaseVerse `/api/auth/creatorhub/exchange`.
3. Serveren validerer utvekslingen mot CreatorHub og setter en `HttpOnly`, `Secure`, `SameSite=Lax` session-cookie.
4. Web/native leser autentisert bruker via `/api/auth/session`; token lagres ikke i `localStorage`.
5. Deep-link til `/integrations/creatorhub` lagrer validert prosjektkontekst og sender brukeren til riktig EaseVerse-prosjekt.

Kun relative retur-URL-er eller godkjente CreatorHub-domener aksepteres. Hemmelige nøkler skal kun ligge i servermiljøet.

## 5. Companion-flyt

### Paring

- Workspace kaller `POST /api/protools/pair/start` med workspace-, Sound Room- og track-kontekst.
- Backend validerer at den innloggede brukeren eier/har tilgang til de refererte ressursene.
- Companion kaller `POST /api/protools/pair/claim` med engangskoden.
- Claim er atomisk og returnerer device-token, `deviceId` og prosjektkontekst.
- Companion lagrer konteksten lokalt og forhåndsutfyller prosjekt/session.

### Session og DAW-data

- `POST /api/protools/sessions`
- `POST /api/protools/sessions/:id/markers`
- `POST /api/protools/sessions/:id/metadata`
- `POST /api/protools/sessions/:id/playhead`
- `POST /api/protools/sessions/:id/bounce/presign`
- `POST /api/protools/sessions/:id/bounce/complete`

Watcher markerer ikke en fil som ferdig behandlet før serveren har bekreftet mottak. Feil retries ved 0, 2, 5 og 15 sekunder. Markør-/metadataeventer og bounces har stabile event-ID-er basert på innhold, ikke lokal filsti.

### Administrasjon i Sound Room

- `GET /api/protools/web/status?audioRoomId=...` viser enheter, siste session, markører, bounces og outbox-status.
- `POST /api/protools/web/unlink-device` tilbakekaller kun valgt enhet.
- `POST /api/protools/web/retry-sync` prøver pending EaseVerse-leveranser på nytt.
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

Outbox lagrer payload, `eventType`, `eventId`, forsøk, neste retry, siste feil og leveringstid. Et allerede levert event med samme ID leveres ikke på nytt.

## 7. Databaseendringer

Migrasjon `0558_protools_companion_integration_integrity.sql` etablerer:

- persistent pairing codes og claim/rate-limit-data
- device- og prosjektkontekst på sessions
- unik/idempotent bounce-identitet
- durable EaseVerse outbox
- nødvendige indekser og integritetsfelter

EaseVerse sitt collaboration-lager lagrer prosjektkontekst, canonical Pro Tools snapshot, referansemiks og lyrics-revisjon.

## 8. Verifikasjonsmatrise

Før produksjonsrelease skal følgende passere:

| Lag | Kommando/flyt | Krav |
|---|---|---|
| CreatorHub backend | målrettet Vitest for sync, Companion-ruter og realtime tickets | Alle passerer |
| CreatorHub backend | `npm run build` | Passerer |
| CreatorHub web | `npm run build` | Passerer |
| Companion Rust | `cargo test` | Alle passerer |
| Companion webview | `npm run typecheck && npm run build` | Passerer |
| EaseVerse | `npm run typecheck && npm test` | Alle passerer |
| EaseVerse Netlify | `npm run netlify:build` | Genererte funksjoner/ruter inkluderer nye API-er |
| OAuth E2E | CreatorHub login → HttpOnly cookie → integration handoff → prosjekt | Passerer uten token i localStorage |
| Musikk E2E | Workspace → Sound Room → pair → markers/metadata → bounce → review | Samme prosjekt-/track-ID hele veien |
| Offline | Endring uten nett → retry/reconnect → én server-side versjon | Ingen duplikater eller tapt state |

## 9. Produksjonskonfigurasjon

### EaseVerse / Netlify

- `EXTERNAL_API_KEY` – servicehemmelighet for CreatorHub-kall
- `ANTHROPIC_API_KEY` – server-side AI-funksjoner
- `CREATORHUB_API_URL` – CreatorHub-produksjons-API
- `EXPO_PUBLIC_CREATORHUB_URL` – offentlig Workspace/OAuth-base

### CreatorHub / Render

- `EASEVERSE_API_URL=https://easeverse.netlify.app`
- `EASEVERSE_API_KEY` – samme verdi som EaseVerse `EXTERNAL_API_KEY`

Logg aldri verdiene, og eksponer dem ikke gjennom `EXPO_PUBLIC_*` eller frontend-bundlen.

## 10. Release- og rollback-runbook

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

## 11. Deprecated flater

- `songflow-*` beholdes bare som bakoverkompatible aliaser frem til avtalt sunset.
- EaseVerse sin gamle lokale/Clerk-baserte Companion-paring skal ikke brukes i ny UI.
- Query-string-baserte bearer tokens for realtime støttes midlertidig kun for eldre klienter; nye webklienter bruker engangsticket.
