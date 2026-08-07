# StageOne fase 4 — Role Room-auth + sky-lagring

**Dato:** 2026-08-07. Bygger på fase 3 (PR #1944). Backend-delen: egen PR #1945
(`feat/stageone-scenes-api` fra origin/main — lokal main var foreldet, StageOne-
kjeden mangler auth-backenden; uavhengig merge).

## Auth

Gjenbruker Leadgrid-iPad-infrastrukturen uendret: 8-tegns pairing-kode
(`XXXX-XXXX`) → `POST /api/ipad-tokens/exchange` `{shortCode, deviceInfo}` →
`{bearer, user}` (permanent token, `persistent_auth_sessions`, 365d).
Token + e-post i **Keychain** (`AuthStore`, service `com.creatorhubn.StageOne.auth`,
AfterFirstUnlockThisDeviceOnly). Google Sign-In utsatt.

## Backend (PR #1945)

`backend/server/stageone-scene-routes.ts` — `register*Routes({app, pool,
requireUserSession})`-malen: GET liste / GET/PUT/DELETE `/api/stageone/scenes/:id`.
JSONB per bruker (user-scoping KUN fra sesjon), 2MB-cap, id-regex, lat
`CREATE TABLE IF NOT EXISTS stageone_scenes` (pricing-config-mønsteret — ingen
manuell migrasjon). Verifisert: tsc-feiltall identisk med/uten endring.

## iPad

- `Cloud/AuthStore` (Keychain), `Cloud/CloudAPI` (exchange + scene-CRUD,
  string-konkat-URL-er, ISO8601-parsing m/ og uten brøkdels-sekunder),
  `Cloud/CloudSync` (@Observable: status/email/lastSync).
- **Synk-modell (last-write-wins):** autosave-løypa pusher scenen etter lokal
  lagring (no-op utlogget). Ved oppstart og etter innlogging: pull om remote
  `updatedAt` er >2s nyere enn lokal fil-mtime (`shouldPull`, ren funksjon);
  ellers push av lokal. Én scene i v1 (`id: default`).
- **UI:** konto-knapp i toolbaren (badge-ikon når innlogget) → `AccountSheet`:
  pairing-kode-felt m/ norske feilmeldinger (samme koder som LeadMapApp) /
  innlogget: e-post, synk-status, «Lagre til sky nå» / «Hent fra sky», logg ut.

## Testing

`shouldPull`-matrise, request-bygger (URL/Bearer/Content-Type), dato-parsing,
PUT-body-roundtrip av SceneData, Keychain-roundtrip. Full suite.
**E2E mot prod gjenstår til #1945 er merget** (Render-deploy) + Daniel genererer
pairing-kode i web-admin.

## Ikke i fase 4

Google Sign-In, flere scener/scene-velger, konflikt-merge (kun last-write-wins),
offline-kø.
