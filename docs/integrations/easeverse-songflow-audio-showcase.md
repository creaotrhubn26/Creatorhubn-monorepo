# Integrasjon: EaseVerse ⇄ SongFlow ⇄ Audio Showcase ⇄ Split Sheets

> Plan + spec for å koble musikk-økosystemet sammen ende-til-ende.
> Sist oppdatert: 2026-06-12.

## 1. Systemkart (4 deler)

| # | System | Hva | Hvor |
|---|--------|-----|------|
| A | **EaseVerse (ekstern app)** | Skriv tekst → ta opp vokal-takes → Pro Tools-session → comp keepers | `creaotrhubn26/EaseVerse` (Expo/Vercel, Clerk-auth) |
| B | **SongFlow / EaseVerse-tracks** | Track-/prosjekt-hub: recording→mixing→mastering, bpm, key, **lyrics**, stems, collaborators, Drive-backup | CreatorHub `easeverse_projects`/`easeverse_tracks` (index.ts) + `songflow-platform.tsx` |
| C | **Audio Showcase** | Mix/master-review-studio: versjoner, tidskodede kommentarer, seksjoner, godkjenning, leveranser, tasks | CreatorHub `audio_review_*` + `audio-showcase-routes.ts` + `pages/audio-showcase.tsx` |
| D | **Split Sheets** | Royalty-splitter knyttet til tracks (sign/share/pdf/revenue) | CreatorHub `split-sheets-routes.ts` |

Livssyklus: **A (skriv/ta opp) → B (track-hub) → C (review/godkjenn/lever) → D (royalty)**.
**B (SongFlow) er den naturlige naven** — den har allerede lyrics, bpm, key, collaborators, projectId.

## 2. Felles nøkler / spine
- `easeverse_tracks.id` = kanonisk **song/track-id** internt i CreatorHub.
- `externalTrackId` = nøkkelen delt med ekstern EaseVerse (settes i dag = track.id ved sync).
- `projectId` + `source`-tag finnes på begge sider.
- Link-spine vi etablerer: `easeverse_track ↔ audio_review_project ↔ externalTrackId ↔ split_sheet`.

## 3. Hva finnes ALLEREDE (verifisert i kode)
- **`easeverse-platform.tsx` = `export … from './songflow-platform'`** → «EaseVerse» er kanonisk navn, «SongFlow» er deprecated-alias (sunset 2026-12-31, jf. `songflow-deprecated-aliases-routes.ts`).
- SongFlow-API: `GET /api/easeverse-tracks|-projects`, `POST /api/easeverse-tracks`, `…/:id/backup`, `…/:id/sync-lyrics`, `PUT …/:id/lyrics`.
- **Eksisterende enveis-bro:** `syncLyricsToEaseVerse()` POST-er `{externalTrackId, projectId, title, artist, lyrics, collaborators, source:"creatorhub"}` til `${EASEVERSE_API_URL}/api/v1/collab/lyrics` (env `EASEVERSE_API_URL`/`EASEVERSE_API_KEY`).
- Split Sheets ↔ track: `POST /api/split-sheets/from-songflow/:trackId`, `…/:id/link-songflow`, `…/:id/songflow`, unlink. Link-kolonner `easeverse_track_id`/`songflow_track_id`.

## 4. Hva MANGLER (gapene denne planen lukker)
1. **Audio Showcase er frakoblet** — `audio_review_*` har ingen lenke til `easeverse_tracks`. Ingen «send track til review».
2. **Tekster-fanen i studioet er tom** — ikke koblet til `easeverse_tracks.lyrics`.
3. **Bro er enveis** — pusher lyrics UT, henter ingenting INN (markers, takes, keeper-WAV) fra ekstern EaseVerse.
4. **DAW-seksjoner** fra Pro Tools (`/api/v1/collab/protools.markers`) går ikke inn i `audio_review_sections`.
5. **Takes → versjoner** mangler (keeper/comp-WAV blir ikke review-versjon).
6. **Split Sheet ↔ godkjenning** er ikke trigget fra review-flyten.

---

## 5. Faseplan

### Fase 0 — Link-spine (fundament)
Etabler koblingen track ↔ review-rom. Ren intern endring, null ekstern risiko.

### Fase 1 — SongFlow ⇄ Audio Showcase (intern, samme DB) ⭐ start her
Høyest verdi, ingen ekstern avhengighet. «Send til review» fra en track → review-rom forhåndsutfylt; lyrics inn i Tekster-fanen; status-synk; godkjenning → track `completed`.

### Fase 2 — Ekstern EaseVerse PULL (utvid enveis-bro → toveis)
Hent lyrics/markers/takes fra ekstern EaseVerse inn i track + studio.

### Fase 3 — Split Sheets ⇄ godkjenning
Ved «Godkjenn mix» → tilby/opprett split sheet fra track; vis royalty-status i studioet.

### Fase 4 — Felles «Studio Companion» (Tauri)
Slå sammen EaseVerse Pro Tools-companion + CreatorHub Resolve/One Desk til én native bro med felles paringstoken; push takes → review-versjoner.

### Fase 5 — Delte pakker + sanntid
Felles wavesurfer-komponent, ffmpeg-pipeline, Claude-prompt-bibliotek, web-push; abonnér på `/api/v1/ws` for live review-oppdateringer.

---

## 6. Strukturert spec-liste

### Fase 0 — Link-spine
- **S0.1** Migrasjon: `ALTER TABLE audio_review_projects ADD COLUMN easeverse_track_id TEXT, ADD COLUMN external_track_id TEXT;` + indeks på `easeverse_track_id`.
- **S0.2** `audio-showcase-routes.ts`: aksepter `easeverseTrackId`/`externalTrackId` i `POST /api/audio-showcases`; returner dem i GET. Bakoverkompatibelt (nullbare).
- **S0.3** Helper `findOrCreateReviewForTrack(trackId)` (idempotent: én aktiv review per track).
- **Akseptanse:** opprette review m/ `easeverseTrackId` set; GET viser koblingen; gjentatt kall lager ikke duplikat.

### Fase 1 — SongFlow ⇄ Audio Showcase
- **S1.1** Backend `POST /api/easeverse-tracks/:trackId/send-to-review` → `findOrCreateReviewForTrack`, kopierer `title, artist, bpm, key→musical_key, genre, lyrics, collaborators→audio_review_members`. Returnerer `{ reviewProjectId }`.
- **S1.2** Stems → versjoner: hvis track har stem-/bounce-URL(er), opprett `audio_review_versions` (status `under_review`).
- **S1.3** Frontend SongFlow (`songflow-platform.tsx`): knapp **«Send til review»** per track → kaller S1.1 → `navigate('/audio-review/:reviewProjectId')`.
- **S1.4** Tekster-fane i studioet: les `easeverse_tracks.lyrics` via `easeverseTrackId` (`GET /api/audio-showcases/:id/lyrics` som joiner track). Vis tekst synket mot seksjonsbaren; «Rediger» skriver tilbake via `PUT /api/easeverse-tracks/:id/lyrics`.
- **S1.5** Status-synk: review `under_review→approved` oppdaterer track `mixing→mastering→completed`; track-status vises som chip i studio-header.
- **S1.6** Medlemmer: track `collaborators[]` → `audio_review_members` (idempotent, e-post/navn-dedupe).
- **Akseptanse:** fra en track → ett klikk → ferdig forhåndsutfylt review-rom m/ tekst, medlemmer og (hvis stems) versjon; godkjenning flipper track til `completed`. E2E mot ekte DB.

### Fase 2 — Ekstern EaseVerse PULL
- **S2.1** Backend `pullLyricsFromEaseVerse(externalTrackId)` → `GET ${EASEVERSE_API_URL}/api/v1/collab/lyrics/:externalTrackId` (x-api-key). Oppdater `easeverse_tracks.lyrics` hvis nyere.
- **S2.2** Backend `pullSectionsFromEaseVerse(externalTrackId)` → `GET …/api/v1/collab/protools/:externalTrackId`; map `markers[{label,positionMs,sectionType}]` → `audio_review_sections` (positionMs/1000, navn, farge per type).
- **S2.3** `POST /api/audio-showcases/:id/pull-from-easeverse` → kjører S2.1+S2.2 for koblet `external_track_id`. Knapp «Hent fra EaseVerse» i studioet.
- **S2.4** (krever companion) Hent keeper-takes via `GET /api/companion/snapshot` (pair-token) → opprett `audio_review_versions` fra `pendingCompExports[].wavUrl`.
- **S2.5** Auth-bro: map CreatorHub-bruker → EaseVerse via e-post (Clerk `fetchUserEmail`) eller felles IdP; lagre kobling i `easeverse_account_links`.
- **Akseptanse:** «Hent fra EaseVerse» fyller Tekster + seksjonsbar fra ekte `/api/v1/collab/*`; idempotent; håndterer 404/503 (bro ikke konfigurert) uten å feile UI.

### Fase 3 — Split Sheets ⇄ godkjenning
- **S3.1** Ved `approvalType=mix_approved`: hvis koblet track mangler split sheet → returner `{ suggestSplitSheet: true }`.
- **S3.2** Studio-UI: etter godkjenning, dialog «Opprett split sheet?» → `POST /api/split-sheets/from-songflow/:trackId`.
- **S3.3** Vis split-sheet-status (signert/utestående) som badge i studio-header + leveranse-status.
- **Akseptanse:** godkjenning av track uten split sheet tilbyr opprettelse; opprettet ark er forhåndsutfylt m/ collaborators; status vises i studio.

### Fase 4 — Felles Studio Companion (Tauri)
- **S4.1** Spec: én Tauri-app som bærer både EaseVerse PT-watcher og CreatorHub Resolve/One Desk-bro; felles paringstoken-format.
- **S4.2** Backend: CreatorHub-paringstoken aksepteres av Audio Showcase take-upload (`POST /api/audio-versions` m/ blob).
- **S4.3** Push: ny stabil WAV i watch-mappe → review-versjon i koblet rom.
- **Akseptanse:** producer parer én gang, slipper WAV i mappe, ser ny versjon i studioet. (Egen leveranse — stor.)

### Fase 5 — Delte pakker + sanntid
- **S5.1** Ekstraher `<Waveform>`-komponent (wavesurfer) til delt pakke brukt av Audio Showcase + EaseVerse web.
- **S5.2** Delt Claude-prompt-bibliotek (mix-feedback, pronunciation) + ffmpeg-mixdown-util.
- **S5.3** Abonner på `/api/v1/ws` → live oppdatering av seksjoner/takes i åpent review-rom.
- **Akseptanse:** ett wavesurfer-oppsett vedlikeholdt ett sted; live-marker dukker opp i studio uten reload.

---

## 7. Hensyn / risiko
- **Auth-mismatch:** Clerk (EaseVerse) vs session-tokens (CreatorHub). Fase 1 unngår dette helt (samme DB/bruker). Fase 2+ trenger e-post-map eller felles IdP (S2.5).
- **Lagring:** Vercel Blob (EaseVerse) vs B2 (CreatorHub) — kryss-hent via offentlige/signerte URL-er; ingen migrering nødvendig.
- **To databaser:** synk via API, ikke delt skjema.
- **Deprecated-alias:** behold `songflow-*`-aliaser til sunset 2026-12-31; nye endepunkter bruker `easeverse-*`/`audio-*`.

## 8. Anbefalt første leveranse
**Fase 0 + Fase 1** i én PR — ren intern kobling (samme DB, ingen Clerk/ekstern avhengighet), leverer umiddelbar verdi: «Send til review» fra SongFlow → ferdig studio m/ tekst, medlemmer, status-synk. Fase 2 (ekstern pull) som oppfølger når auth-broen er avklart.
