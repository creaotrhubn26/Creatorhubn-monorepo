# Claude-handoff: Photo Room, Capture og CreatorHub S3

Sist kontrollert: 14. september 2026.

Dette er arbeidsgrunnlaget for å fortsette Photo Room/Capture-sporet i Claude. Les hele dokumentet før du endrer kode. Ikke start en parallell Photo Room-modell, en ny lagringsadapter eller en ny OAuth-flyt før du har fulgt filkartet og kontrollert gjeldende gren.

## Kortversjon

- Photo Room-unifiseringen er merget i `main` via PR #2315.
- Nye Capture-opplastinger, Photo Enhancer-kilder, AI-resultater og leveranser skal ligge privat i CreatorHub sin AWS S3-bøtte.
- Role Room-bøtten skal aldri brukes av Photo Room eller Capture.
- Cloudflare R2 er kun en lesbar legacy-kilde mens gamle objekter kopieres og verifiseres. Migreringsjobben sletter aldri kilden.
- Photo Room og klientgalleriet bruker fortsatt to kommentartabeller, men backend presenterer dem som ett delt reviewrom og kobler dem med `captureAssetId`.
- Canonisk review-status ligger i `project_photo_review`; `capture_assets.rejected` og `flagged_for_client` er kompatibilitetsspeil via databasetriggere.
- Capture Google-innlogging er rettet på grenen `fix/capture-google-sdk-oauth-404`, commit `45d419f4729cfc999034737a4e3bee3e7eecc724`. Den bruker GoogleSignIn iOS SDK 10.0.0 og ligger i PR #2324, ikke merget i `main` ennå.
- Migrasjon `0605` er verifisert komplett i produksjonsdatabasen: 43 av 43 objekter, ingen drift. Capture-/Photo Room-tabellene i produksjon er tomme.
- Neste leveranse er runtime-verifikasjon av Google-innlogging og en ekte Capture -> CreatorHub S3 -> Photo Room -> klientgalleri-flyt. Ikke bygg flere funksjoner før denne kjeden er bevist.

## Gren- og commitstatus

Arbeidet ble avsluttet i denne isolerte worktreen:

```text
/Users/danielqazi/Creatorhubn-worktrees/photo-room-unification-20260914
```

Gjeldende gren:

```text
fix/capture-google-sdk-oauth-404
```

Viktige commits:

| Commit | Status | Innhold |
|---|---|---|
| `a9fb0e67c` | i `main` | Merge av Photo Room-unifiseringen, PR #2315 |
| `fede017aa` | i `main` | Felles reviewmodell, klientgalleribro, sikkerhet og CreatorHub S3 |
| `196819bbb` | i `main` | Bevarer legacy billing-indeks i migrasjonen |
| `674638409` | i `main` | Merge av isolert CreatorHub OAuth for Capture, PR #2319 |
| `67649e5f0` | i `main` | CreatorHub-personverkrute for Capture OAuth, PR #2322 |
| `45d419f47` | kun pushet feature-gren | Offisiell GoogleSignIn SDK og fiks for Google 404 |
| `8f9828530` | historisk gjenbrukskilde | Eldre annotering og foto-versjoner; ikke revert til denne committen |

Start alltid med:

```bash
git fetch origin
git status --short --branch
git log --oneline --decorate -15
git show --stat 45d419f4729cfc999034737a4e3bee3e7eecc724
```

Hvis Claude kjører fra en annen worktree, les den push­ede grenen via `origin/fix/capture-google-sdk-oauth-404`. Ikke bruk `git reset --hard`, og ikke overskriv andre ubundne endringer.

## Produktregler som ikke skal brytes

1. Produktgrensen er CreatorHub. Photo Room/Capture skal ikke importere Role Room-lagringsidentitet eller skrive til Role Room B2/S3.
2. Nye medieobjekter går til CreatorHub AWS S3. R2 er kun legacy-lesing og migreringskilde.
3. Alle objektkeys skal være tenant-, bruker- og prosjektavgrenset under:

   ```text
   organizations/<organization-or-personal-user>/users/<user>/projects/<project>/photo-room/...
   ```

4. Alle Photo Room- og AI-kall med `assetId` må bevise at asseten tilhører en `capture_session` med samme `project_id`.
5. `GET`/`HEAD` kan bruke lesetilgang. `POST`/`PATCH`/`DELETE` krever `canEditProject`.
6. Ingen Photo Room-tabeller skal opprettes dynamisk fra runtime-ruter. Migrasjon `0605` eier skjema, constraints, indekser og triggere.
7. Gamle objekter må aldri slettes før kopiering, størrelse/checksum og databasen er verifisert. Nåværende script beholder alltid kilden.
8. Ikke gjeninnfør håndskrevet `ASWebAuthenticationSession`/PKCE mot Google. Capture skal bruke den offisielle GoogleSignIn-SDK-en og eksisterende `/api/auth/google/token`.
9. Ikke stol på `docs/capture/README.md` som nåstatus. Den er datert 16. april 2026 og beskriver R2, manglende Xcode og en gammel faseplan.

## Nåværende dataflyt

```text
Canon/demo-kamera
  -> Capture SwiftUI-app
  -> autentisert multipart-opplasting
  -> CreatorHub privat AWS S3
  -> capture_assets/capture_sessions i PostgreSQL
  -> Photo Room API-projeksjon
       -> project_photo_review
       -> project_photo_comments
       -> client_image_selections/client_image_comments
  -> eksisterende CreatorHub-klientgalleri
  -> klientkommentarer, favoritter og review tilbake til Photo Room

Valgfri AI-flyt:
Capture/Photo Room-asset
  -> prosjektvalidering og samtykke
  -> tredjeparts AI-kø
  -> permanent resultat i CreatorHub AWS S3
  -> generative_ai_jobs
  -> historikk og ekte download-endepunkt i Photo Room
```

Viktig presisering: UI-et er et felles rom, men kommentarene er ikke fysisk slått sammen til én tabell. Backend leser og normaliserer både `project_photo_comments` og `client_image_comments`. Svar på en klientgallerikommentar bruker foreløpig galleriets `photographer_response`, mens interne/prosjektkommentarer har ekte `parent_id`-tråder.

## Det som allerede er implementert

### Photo Room-web

Eier: `frontend/client/src/components/workspace/tabs/PhotoRoomTab.tsx`.

- Komponent er flyttet ut av `WorkspaceShell.tsx`; ikke bygg den inline igjen.
- Ingen `@ts-nocheck`.
- Norsk/engelsk tekst via workspace-lokaliseringsmønsteret.
- Paginering med 80 bilder per side og «Last inn flere»; tidligere 40-bildersgrense er borte.
- Søk, statusfilter, mappefilter og sortering.
- Filmstripe og rutenett.
- Tastaturfokuserbare bildetekster og navngitte checkboxer.
- Flervalg og enkel sammenligning av nøyaktig to bilder.
- Kommentarer lastes per valgt asset.
- Interne og klientrettede kommentarer vises i samme panel.
- Svar, redigering, sletting, løsning og gjenåpning av prosjektkommentarer.
- Godkjenn, avvis og «må redigeres» bruker den kanoniske statusmodellen.
- «Må redigeres» oppretter idempotente `project_board_tasks`.
- «Send til kunde» oppretter/oppdaterer eksisterende klientgalleri, kobler bilder med `captureAssetId`, støtter revisjonsrunde og e-postvarsel.
- AI-jobbhistorikk lastes inn igjen, aktive jobber poller, og ferdige jobber bruker backendens download-endepunkt.
- Kredittkjøp sender `returnPath=/workspace/<projectId>/photo-room`.
- Read-only-viewere kan lese og sammenligne lokalt, men ikke mutere.

### Backend og sikkerhet

Eier: `backend/server/project-workspace-routes.ts`, særlig Photo Room-rutene rundt linje 3076 og AI-rutene etter leveringsruten.

- Felles `guard()` skiller lese- og skriverettigheter.
- `findProjectPhotoAsset()`/`photoAsset()` binder asset til prosjekt gjennom `capture_sessions`.
- Enkeltstatus, bulkstatus og eksplisitt massegodkjenning prosjektvaliderer alle ID-er.
- AI suggestion/edit/video-ruter bruker prosjektvalidert asset.
- Kommentaroppretting krever valgt, prosjektvalidert asset.
- Klientgalleriruter eksponerer CreatorHub review-status og klientrettede prosjektkommentarer.
- Galleri-rendering re-signer Capture-bilder fra gjeldende objektkey; utløpte URL-er i eldre DB-rader er derfor ikke den langsiktige kilden.
- AI-resultater arkiveres med `output_storage_provider='creatorhub_s3'`.

### Database

Eier: `backend/migrations/0605_project_photo_room_unification.sql`.

- `project_photo_review` med gyldige statusverdier, prosjekt-/asset-FK og indekser.
- `project_photo_comments` med scope, author-kind, status, parent-tråd, soft delete og indekser.
- Kobling mellom `photographer_client_galleries` og prosjekt.
- `captureAssetId`-indeks for klientgalleribilder.
- Revisjonsrunde-felt.
- Toveis trigger mellom kanonisk review-status og legacy Capture-flagg, med rekursjonsvern.
- Migrasjonen bevarer legacy-indeksen `generative_ai_jobs_legacy_billing_due_idx`.

### CreatorHub AWS S3

Kjernefiler:

- `backend/server/creatorhub-object-storage.ts`
- `backend/server/photo-room-storage-contract.ts`
- `backend/server/capture-upload-service.ts`
- `backend/server/photo-enhancer-routes.ts`
- `backend/scripts/migrate-capture-r2-to-creatorhub-s3.ts`

Runtime-kontrakt:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN            # valgfri
CREATORHUB_S3_BUCKET
CREATORHUB_S3_REGION         # default eu-north-1
```

`creatorhub-object-storage.ts` velger eksplisitte CreatorHub-credentials. Den skal ikke falle gjennom AWS default chain til en Role Room OIDC-identitet.

Nye Capture-opplastinger bruker alltid CreatorHub S3. `CaptureR2Config` og R2-credentials i `capture-upload-service.ts` finnes kun for lesing/migrering av gamle keys.

### Capture Google-innlogging

På grenen `fix/capture-google-sdk-oauth-404`:

- `ipad/CaptureApp/project.yml` deklarerer GoogleSignIn 10.0.0.
- `GIDClientID` og reversert URL scheme ligger i generert appkonfigurasjon.
- `GoogleOAuthCoordinator.swift` bruker `GIDSignIn.sharedInstance.signIn(withPresenting:)` og frisker token før backend-utveksling.
- `PushAppDelegate` sender URL-callback til `GIDSignIn.sharedInstance.handle(url)`.
- CreatorHub-session opprettes fortsatt via `/api/auth/google/token`.
- Den gamle feilaktige `:/oauthredirect`-flyten som ga Google 404 er fjernet.

## Kjente mangler og regresjoner

Disse skal ikke beskrives som ferdige før de er bevist:

1. **OAuth-fiksen er ikke merget eller distribuert.** Committen er bare pushet på feature-grenen.
2. **Ekte Google-login er ikke fullført i runtime.** Native build og tester passerer, men en bruker må godkjenne sin egen Google-konto i appen.
3. **Capture -> CreatorHub S3 er ikke bevist ende-til-ende i produksjon etter ny login.** Det må verifiseres med en reell upload og DB-/bucketkontroll.
4. ~~**Produksjonsstatus for migrasjon `0605` må dokumenteres.**~~ Verifisert 14. september 2026: alle 43 objekter finnes i produksjon uten drift, se `docs/PHOTO_ROOM_P1_DB_EVIDENCE_2026-09-14.md`. Nytt funn fra samme kontroll: alle Capture-/Photo Room-tabeller i produksjon har 0 rader, så kjeden har aldri produsert ekte data.
5. **Legacy R2-objekter må inventeres og migreres kontrollert.** Script finnes, men produksjonskjøring er ikke dokumentert.
6. **Team-/organisasjonsnamespace er ikke ferdig bevist.** Lagringskontrakten støtter `organizationId`, men Capture-opplastingen sender i dag bruker/prosjekt og faller derfor tilbake til `personal-<user>`. Avklar prosjekteier/organisasjon før teamlansering.
7. **Oppgavene er ikke virkelig tildelt editor.** «Må redigeres» oppretter en oppgave med `crew_role='fotograf'`, uten eksplisitt assignee. Produktmålet er tildelte editoroppgaver med eier, status og retur til kommentaren/asseten.
8. **Foto-versjoner og tegning er falt ut av dagens Photo Room.** Commit `8f9828530` hadde `DrawingOverlay`, `photo-versions`, versjonsvalg og før/etter-sammenligning. Unifiseringscommitten erstattet denne overflaten. Portér funksjonene til dagens sikre modell; ikke revert hele filen.
9. **Dagens sammenligning er bare to valgte enkeltbilder.** Den er ikke en versjons-/revisjonssammenligning.
10. **Klientkommentarbroen er funksjonell, ikke én fysisk kommentarstrøm.** Client-gallery-svar er ett `photographer_response`-felt, ikke en vilkårlig flerleddet tråd.
11. **Frontendtesten dekker bare to integrasjonsscenarier.** Det finnes ingen full Playwright-flyt fra workspace til klientgalleri og tilbake.
12. **AI-status bruker polling.** Det finnes ingen dokumentert realtime-gjenopptakelse for Photo Room-jobber.

## Anbefalt videre plan

### P0 — merge og runtime-bevis

1. Review og merge `45d419f47` til siste `main` gjennom normal PR/CI.
2. Lag en ny Capture TestFlight/dev-build fra den merge­de committen.
3. Kjør Google-login med brukerens egen konto og bekreft at appen får CreatorHub-session uten 404.
4. Koble et eksisterende prosjekt, bruk demo-kamera først og ekte Canon etterpå.
5. Last opp preview/full/raw og kontroller:
   - S3-bøtten er `CREATORHUB_S3_BUCKET`.
   - Key ligger under riktig `/projects/<project>/photo-room/capture/`.
   - `capture_assets` peker på samme key.
   - Ingen Role Room- eller ny R2-key blir skrevet.
6. Avbryt nettverk under multipart-opplasting og bekreft resume, ETag/checksum og idempotent complete.

P0 er ferdig først når en skjerm-/logg-/DB-evidenspakke viser hele kjeden.

### P1 — database og legacy-migrering

1. ~~Verifiser migrasjon `0605` mot produksjonsdatabasen via read-only katalogspørringer.~~ Ferdig 14. september 2026, se `docs/PHOTO_ROOM_P1_DB_EVIDENCE_2026-09-14.md`. Produksjon er Neon-prosjekt `restless-wind-41713954` (Creatorhub EU), identifisert via rollene i `render.yaml`. Legacy-prosjektet `wispy-bar-06530976` mangler hele 0605 og skal ikke brukes.
2. Ta backup/recovery checkpoint før objektmigrering.
3. Kjør migreringsscriptet uten `--execute` og lagre JSON-output.
4. Kjør en liten canary-batch med `--execute --limit=<lite antall>`.
5. Sammenlign størrelse/checksum, les begge objekter, og kontroller at DB først ble oppdatert etter verifikasjon.
6. Skaler i batcher. Ikke legg til sletting av legacy-kilden i samme leveranse.

### P2 — delt reviewrom E2E

Bygg én Playwright-/API-fixture som beviser:

1. Capture-asset vises i Photo Room.
2. Kommentar er bundet til valgt asset, ikke hele prosjektet.
3. Intern kommentar er skjult for klient.
4. Klientrettet kommentar vises i klientgalleriet.
5. Klientkommentar og favoritt vises tilbake i Photo Room.
6. Godkjenn -> avvis -> godkjenn ender med konsistente legacy-flagg.
7. Read-only-bruker får 403 på alle mutasjoner, også AI.
8. En asset-ID fra et annet prosjekt gir 404/403 og starter ingen AI-jobb.
9. «Send til kunde» oppretter ingen duplikatbilder og øker revisjonsrunde eksplisitt.
10. Private bilder blir re-signet ved lesing og fungerer etter at en gammel URL er utløpt.

### P3 — editoroppgaver

1. Endre `project_board_tasks`-oppretting fra hardkodet fotografrolle til riktig editor/postproduksjonsrolle.
2. La bruker velge teammedlem eller teamrolle ved «Be om endringer».
3. Lagre kobling til asset, kommentar og proofing round.
4. Vis oppgavestatus i Photo Room og la oppgaven åpne korrekt bilde/kommentar.
5. Definer hva som skjer når review-status går bort fra `needs_edit`: lukk automatisk, eller krev eksplisitt ferdigmarkering.

### P4 — gjeninnfør versjoner og annotering trygt

Bruk `git show 8f9828530:<path>` som referanse. Portér små deler:

- `DrawingOverlay` over dagens valgte asset.
- Tegning lagret på dagens prosjektkommentar, prosjekt- og assetvalidert.
- Ekte foto-versjonstabeller med prosjekt-FK og eksplisitt asset-junction.
- Versjonsvalg som laster riktig assets og kommentarer samtidig.
- Side-ved-side/før-etter mellom revisjoner, ikke bare tilfeldige bilder.
- Tastatur, touch og read-only-regler.

Ikke kopier eldre runtime-DDL, eldre guard-logikk eller R2/Role Room-lagring fra den historiske committen.

### P5 — team- og driftsherding

1. Løs `organizationId` fra prosjekt/team og send det gjennom alle key-buildere.
2. Legg til negativ tenant-test for to organisasjoner med samme bruker-/prosjektlignende ID-er.
3. Legg inn strukturerte hendelser for upload start/resume/complete, AI archive, galleri-delivery og signeringsfeil.
4. Definer alarmer for `source_unavailable`, checksum mismatch, signing failure og fastlåste AI-jobber.
5. Test stor jobb: flere hundre RAW-filer, app-restart, bakgrunnskjøring, lav lagringsplass og ustabilt nett.

## Akseptansekriterier for første neste leveranse

- Google-kontovelger åpner uten 404 i distribuert Capture-build.
- Google ID-token blir til en gyldig CreatorHub-session.
- Minst én Capture-asset lastes resumérbart til CreatorHub AWS S3.
- Bucket og key er prosjekt-/tenant-riktig og kan ikke signeres fra et annet prosjekt.
- Asseten vises i Photo Room og kan sendes til eksisterende klientgalleri.
- Klientkommentar/favoritt kommer tilbake på samme asset i Photo Room.
- Read-only og cross-project negative tester passerer.
- Ingen nye Photo Room-objekter finnes i Role Room-bøtten eller under legacy R2-prefix.
- Evidens og eksakte testkommandoer legges i en kort rapport før flere produktfunksjoner startes.

## Filkart Claude må lese

### Web

- `frontend/client/src/components/workspace/TeamWorkspacePage.tsx`
- `frontend/client/src/components/workspace/WorkspaceShell.tsx`
- `frontend/client/src/components/workspace/tabs/PhotoRoomTab.tsx`
- `frontend/client/src/components/workspace/tabs/PhotoRoomTab.test.tsx`
- `frontend/client/src/components/workspace/wsLocale.ts`
- `frontend/client/src/components/workspace/ui.tsx`

### Backend/API

- `backend/server/project-workspace-routes.ts`
- `backend/server/project-photo-room-model.ts`
- `backend/server/client-gallery-routes.ts`
- `backend/server/client-gallery-render.ts`
- `backend/server/capture-routes.ts`
- `backend/server/capture-upload-service.ts`
- `backend/server/photo-enhancer-routes.ts`
- `backend/server/creatorhub-object-storage.ts`
- `backend/server/photo-room-storage-contract.ts`

### Database og migrering

- `backend/migrations/0605_project_photo_room_unification.sql`
- `backend/migrations/110_capture_sessions.sql`
- `backend/migrations/111_capture_assets.sql`
- `backend/migrations/112_capture_reviews.sql`
- `backend/scripts/migrate-capture-r2-to-creatorhub-s3.ts`

### iPad Capture

- `ipad/CaptureApp/project.yml`
- `ipad/CaptureApp/CaptureApp/Core/Auth/GoogleOAuthCoordinator.swift`
- `ipad/CaptureApp/CaptureApp/Core/Auth/SignInService.swift`
- `ipad/CaptureApp/CaptureApp/Core/Push/PushNotificationService.swift`
- `ipad/CaptureApp/CaptureApp/Core/Networking/BackendClient.swift`
- `ipad/CaptureApp/CaptureApp/Core/Enhancer/PhotoEnhancerClient.swift`
- `ipad/CaptureApp/CaptureAppTests/GoogleOAuthCoordinatorTests.swift`
- `ipad/CaptureApp/CaptureAppTests/BackendClientTests.swift`
- `ipad/CaptureApp/CaptureAppTests/PhotoEnhancerClientTests.swift`

## Fersk testbaseline

Kjørt 14. september 2026 på commit `45d419f47` etter rebase på daværende `origin/main`:

- Capture Xcode build: bestått.
- Capture målrettede tester: 20/20 bestått.
  - Google OAuth: 3
  - BackendClient: 15
  - PhotoEnhancerClient/CreatorHub S3: 2
- Backend Photo Room/S3-testfiler: 6/6 bestått, 20 tester.
- Frontend `PhotoRoomTab.test.tsx`: 2/2 bestått.
- `git diff --check`: ren før dette dokumentet ble opprettet.
- Pre-push checks: bestått.

Reproduser backendtesten:

```bash
cd backend
npx vitest run --config vitest.config.ts \
  server/project-photo-room-model.test.ts \
  server/project-photo-room-security.test.ts \
  server/photo-room-migration.test.ts \
  server/photo-room-storage-contract.test.ts \
  server/capture-upload-service.test.ts \
  server/photo-enhancer-capture-s3.test.ts
```

Reproduser frontendtesten:

```bash
cd frontend
npx vitest run --config vitest.config.ts \
  client/src/components/workspace/tabs/PhotoRoomTab.test.tsx
```

Reproduser iOS-testene etter `xcodegen generate`:

```bash
cd ipad/CaptureApp
xcodebuild \
  -project CaptureApp.xcodeproj \
  -scheme CaptureApp \
  -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' \
  -derivedDataPath /tmp/creatorhub-capture-google-sdk-derived \
  CODE_SIGNING_ALLOWED=NO \
  -only-testing:CaptureAppTests/GoogleOAuthCoordinatorTests \
  -only-testing:CaptureAppTests/BackendClientTests \
  -only-testing:CaptureAppTests/PhotoEnhancerClientTests \
  test
```

## Foreslått første beskjed til Claude

```text
Les docs/PHOTO_ROOM_CAPTURE_CLAUDE_HANDOFF_2026-09-14.md helt. Kontroller deretter git-status, origin/main og origin/fix/capture-google-sdk-oauth-404. Ikke endre kode før du har bekreftet hvilke punkter som er i main, hvilke som bare ligger på OAuth-grenen, og hvilke runtime-bevis som mangler. Fortsett kun P0: få Google SDK-fiksen gjennom review/merge og verifiser én ekte Capture -> CreatorHub S3 -> Photo Room -> klientgalleri-flyt. Bevar CreatorHub-produktgrensen; ikke bruk Role Room-bøtten og ikke skriv nye objekter til R2.
```
