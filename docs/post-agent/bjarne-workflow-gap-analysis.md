# Workflow gap-analyse — Bjarne (profesjonell videograf)

Detaljert kartlegging av friction-punkter når en ikke-teknisk profesjonell videograf skal bruke CreatorHub-plattformen til å levere bryllups-, reklame-, dokumentar- og musikkvideo-prosjekter (storyboard, multi-angle-sync, post-prod, DaVinci-export, klient-review, leveranse).

**Persona Bjarne**:
- Profesjonell videograf, ikke utvikler
- Bruker Mac, behersker DaVinci Resolve + Premiere Pro på vanlig nivå
- Mål: levere 15-25 prosjekter i året (bryllup, kommersielt, musikkvideo) — hele løpet fra brief til endelig fil
- Lavt teknisk vokabular: "orchestration", "session ID", "JSON", "Integration Test" = uforståelig
- Forventer at ting fungerer som i Frame.io, Vimeo Pro, Pixieset Films, DaVinci, Premiere

Gaps er klassifisert i tre nivåer:

- ❌ **BLOCKER** — Bjarne kan IKKE få jobben gjort uten håndholding
- ⚠️ **FRICTION** — Bjarne kommer i gang men sliter, undrer "hvorfor er det sånn?"
- 🎯 **NICE** — vil vesentlig forbedre opplevelsen

Estimater for arbeidsomfang: **S** (≤1t), **M** (1-4t), **L** (4t+).

Filreferanser bruker monorepo-root.

---

## ❌ BLOCKERS (5)

### B1. DaVinci Resolve-eksporten er ødelagt av runtime-bugs
**Hva Bjarne møter**: Etter en hel kveld med å sette sammen et 7-minutters bryllups-cut i Story Arc Studio, klikker han "Eksporter til DaVinci Resolve". Han forventer en `.xml`-fil han kan importere i Resolve. I stedet får han hvit skjerm + en konsoll full av JavaScript-feil. Hele kveldens arbeid er fortsatt der, men eksporten skjer aldri.
**Hvorfor det er rart**: Hvis en "Eksporter"-knapp finnes, forventer man at den fungerer. Spesielt for en profesjonell sluttbruker som ikke åpner DevTools.
**Fil**: `frontend/client/src/components/ExportDialog.tsx`
- `:68` — default resolution `'1920x108'` (mangler `0` — bør være `'1920x1080'`)
- `:69` — `colorSpace: 'Rec70'` (mangler `9` — bør være `'Rec709'`)
- `:70` — `exportFormat: 'XM'` (mangler `L` — bør være `'XML'`)
- `:97` — `id: exportd,` (refererer udefinert variabel — `ReferenceError: exportd is not defined`)
- `:114` — `fetch('/api/user/kv, ', ...)` (komma + space inne i URL → 404)
- `:147` — `options.resolution.split('x,')` (finner ikke `'x,'` i `"1920x1080"` → splittet array har 1 element → `width/height = NaN` i XML-en)

**Fix (S)**: Direkte fil-edit. Burde testes lokalt: opprett en dummy story-arc, klikk eksport, åpne den genererte XML-en i en text-editor og bekreft `width=1920 height=1080` før den committes.

### B2. Stream-transcoding-status er usynlig — klient kan klikke play før videoen er klar
**Hva Bjarne møter**: Han laster opp et ferdig 4K-bryllups-cut. Cloudflare Stream begynner transcoding (kan ta 5-30 minutter for 8-timer 4K). Bjarne ser ingen status — uploaden er ferdig, så han antar videoen er klar. Han sender klient-galleri-lenken til brudeparet. Brudeparet klikker, men får "playback not yet available" eller en svart skjerm med spinning loader.
**Hvorfor det er rart**: Cloudflare Stream returnerer `readyToStream: false` i upload-responsen og `true` når transcoding er ferdig. Frontend bør polle og signalisere.
**Fil**:
- `backend/server/cloudflare-stream-service.ts:125` — `getStreamVideoStatus(uid)` finnes og returnerer `ready: boolean`
- `frontend/client/src/components/role-room/components/MediaUploader.tsx:281` — kommentar sier "Auto-transkodet når ferdig", men ingen polling-state vises i UI
**Fix (M)**: Når en upload returnerer `storage.ready === false`, vis "Klargjør video for streaming (kan ta opptil 10 min)" i UI med live-progress fra `getStreamVideoStatus`-polling hvert 10. sekund. Galleri-lenken kan IKKE deles før videoen er ready.

### B3. Klient som spiller av en 8-timers 4K-fil på hotell-wifi blir tatt som gissel
**Hva Bjarne møter**: Han leverer en 60GB ferdig 4K-fil til en bedriftskunde. Kunden åpner lenken på kontoret. Stream HLS spiller adaptive bitrate, men på trege nett (≤10 Mbps) får kunden 360p preview som ser uskarp ut. Kunden ringer Bjarne: "filmen er pixlete, ble den eksportert i lav oppløsning?". Det er nettet, ikke fila, men ingen vet det.
**Hvorfor det er rart**: Frame.io, Vimeo Pro, alle profesjonelle leveranseplattformer genererer en eksplisitt "low quality preview"-versjon med tydelig label, og lar bruker velge.
**Fil**:
- `frontend/client/src/components/role-room/components/MediaUploader.tsx:281` — Stream returnerer auto-transcoded varianter (240p, 360p, 720p, 1080p, 4K), men UI-en gir ikke kunden valg
- `frontend/client/src/components/IntelligentVideoAnalyzer.tsx:287` — `maxFileSizeMB={2000}` antar at klient kan håndtere 2GB-filer uten preview-fall-back
**Fix (M)**:
- Vis en quality-selector i CinematicVideoPlayer ("Auto / 4K / 1080p / 720p / 360p") så kunden kan tvinge en bestemt variant
- Vis network-quality-indikator ("Tregt nett — viser 720p") så kunden ikke tror filmen ble dårlig levert

### B4. VideografOrchestrator triggerer fail i stillhet
**Hva Bjarne møter**: Han klikker "Story Arc Automatisk Redigering"-orkestreringen. API-et er nede. Frontend setter status `running: true`, viser progress-bar i 2 sekunder, så stopper bare. Ingen feilmelding. Ingen "Prøv igjen". Bjarne tror redigeringen er i gang i bakgrunnen og venter resten av dagen forgjeves.
**Hvorfor det er rart**: Vi fikset NETTOPP samme antipattern i FotografOrchestrator. Den er ikke fikset her.
**Fil**: `frontend/client/src/components/universal/VideografOrchestrator.tsx:402` — mutation har `.catch(() => {})` som spiser alle feil + ingen `onError` som rapporterer status.
**Fix (S)**: Speil fixen vi gjorde for FotografOrchestrator i den siste runden (commit `e8689b71`). Sett `status: 'error'` + vis "Kunne ikke starte arbeidsflyt — sjekk loggen" i UI.

### B5. Timecode-kommentarer fra klient blir sluppet i stillhet
**Hva Bjarne møter**: Brudeparet ser igjennom edit-en, pauser ved 03:47 og skriver "Kan du klippe ut tante Astrids hostekanon her?". De trykker "Send kommentar". POST feiler (API nede / nettverk drop). Frontend logger til console.error. Bjarne ser aldri kommentaren. Brudeparet tror den ble sendt. Hosten blir værende i ferdig leveranse.
**Hvorfor det er rart**: Klient-feedback er en kritisk tilbakemeldingskanal og må ALDRI tape data stille.
**Fil**: `frontend/client/src/components/universal/UniversalShowcase.tsx:5220` — `.catch(error => console.error(...))` som eneste error-handler.
**Fix (S)**:
- Vis en retry-toast hvis POST feiler: "Kunne ikke sende — prøv igjen"
- Persistér ulagrede kommentarer i localStorage så bruker ikke mister dem ved refresh
- Vis "Sendt ✓" eller "Mislyktes" eksplisitt på hver kommentar

---

## ⚠️ FRICTION (12)

### F1. "Video AI"-tabben er bare Photo Enhancer i kostyme
**Hva Bjarne møter**: Han klikker "Video AI" i menyen. Forventer auto-cut, silence removal, color grade-AI, multi-cam-sync. Får i stedet `CreatorHubPhotoEnhancer` med bildebehandlings-UI ("eksponering", "støy-fjerning", "skarphet").
**Hvorfor det er rart**: Navn signaliserer noe annet enn implementasjon.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:6918` — `CreatorHubPhotoEnhancer` montert for videograf, samme komponent som fotograf-tabben på linje 6537.
**Fix**:
- **Kort sikt (S)**: Bytt label til "AI-bildebehandling for stills" så det er klart at det ikke er video-redigering. Eller fjern tabben helt for videograf.
- **Lang sikt (L)**: Bygg en faktisk video-AI-suite: silence-removal via WebRTC VAD, auto-cut basert på beat-detection, color-grade-LUT-suggester.

### F2. Multi-angle/multi-cam-orkestreringen mangler en backend
**Hva Bjarne møter**: Han har 4 kameravinkler fra et bryllup. Klikker "Multi-Angle Synkronisering" i VideografOrchestrator. Får queued-status. Venter en time. Ingenting skjer.
**Hvorfor det er rart**: Knappen finnes, men det er ikke noe som faktisk synker kameraer på backend.
**Fil**:
- `frontend/client/src/components/universal/VideografOrchestrator.tsx:70-290` — `multiAngleSync` listed som orchestration
- Vi har ingen backend-implementasjon for `audio_fingerprint_sync` eller `timecode_sync` per orchestration-worker (mappet via `orchestration-worker.ts` — kun BREG-validering er ekte implementert)
**Fix**:
- **Kort sikt (S)**: Marker orchestration som "Kommer snart" i UI så Bjarne ikke prøver den.
- **Lang sikt (L)**: Implementer ekte multi-cam-sync via `ffmpeg`-pipeline med cross-correlation på audio waveforms.

### F3. Ingen "godkjenn versjon"-flyt
**Hva Bjarne møter**: Han leverer v1 til brudeparet. De vil ha to endringer. Han lager v2. Hvordan vet brudeparet at v2 er klar? Hvordan markerer de "godkjent"? Det finnes ikke i UI.
**Hvorfor det er rart**: Frame.io, Vimeo Pro, alle profesjonelle leveranseplattformer har version-tracking + approval-button som sentralt feature.
**Fil**: Søk etter `version`, `approval`, `approve` i `client-gallery-routes.ts` gav 0 treff for video-versjons-flyt. Eksisterende `gallery.status: 'completed'` er per-galleri, ikke per-versjon.
**Fix (M)**:
- Utvid `client_gallery_images` med `version: integer`-kolonne
- Implementer "Godkjenn denne versjonen"-knapp i client-gallery.tsx
- Notify Bjarne via e-post når versjon blir godkjent

### F4. Ingen DaVinci Resolve / Premiere round-trip-bro
**Hva Bjarne møter**: Han eksporterer XML fra Story Arc Studio (når den fungerer — se B1). Drar XML-en inn i Resolve. Justerer color grade. Når han er ferdig — hvordan kommer endringene tilbake til CreatorHub? Han må manuelt re-eksportere ferdig fil og laste opp på nytt.
**Hvorfor det er rart**: Adobe Premiere har CEP-plugins, Resolve har Workflow Integration API, og vi har allerede UXP-plugin for Photoshop (per memory). For video mangler det.
**Fil**: Søk etter `adobe|premiere|extendscript|cep|uxp|@tauri-apps/api` i videograf-kontekst — 0 treff. Memory `project_resolve_script_manager_tauri` sier Resolve-app bygges som standalone Tauri-app, ikke embedded.
**Fix**:
- **Kort sikt (M)**: Dokumenter manuell upload-flow i app-en så Bjarne forstår den
- **Lang sikt (L)**: Implementer Resolve Workflow Integration-script som POST-er ferdig MP4 + frame.io-style timecode-comments tilbake til CreatorHub

### F5. Upload-progress mangler ETA på 2GB-filer
**Hva Bjarne møter**: Han laster opp en 1.8GB H.264 bryllups-master. Får en "Uploading..."-spinner uten prosent eller ETA. På hotell-wifi (12 Mbps) tar opplastingen 22 minutter. Han vet ikke om det henger eller bare er tregt.
**Hvorfor det er rart**: Chunked upload har per-chunk-progress på backend (`chunked-upload-routes.ts:status`), men frontend `MediaUploader` viser ikke ETA.
**Fil**:
- `frontend/client/src/components/role-room/components/MediaUploader.tsx` — ingen ETA-beregning fra received vs total bytes
- `frontend/client/src/lib/chunked-upload.ts:182` — `onProgress` callback gir `bytesUploaded` + `totalBytes`, men callere bruker det ikke til ETA
**Fix (S)**: Beregn `eta = (totalBytes - bytesUploaded) / averageBytesPerSecond` siste 30s og vis "12:34 igjen" i UI.

### F6. Stream signed-URL utløp midt i play crasher klient
**Hva Bjarne møter**: Brudeparet har spilt av et 8-timers bryllups-recap i 65 minutter. Token utløper. HLS-player fortsetter å request neste segment, får 403, dør.
**Hvorfor det er rart**: TTL er 1 time per default — for video lengre enn det, må klienten få nytt token midtveis.
**Fil**: `backend/server/cloudflare-stream-service.ts:174` — `signStreamPlaybackUrl(uid, ttlSeconds = 60 * 60)`. Frontend henter URL én gang. Ingen refresh midt i play.
**Fix (M)**:
- Frontend gjør periodisk POST til `/api/client/gallery/:token/files/:imageId/refresh-stream-url` for å hente nytt token før utløp
- Eller: TTL utvides til 4 timer for video lengre enn 1 time (auto-detect via Stream-metadata.duration)

### F7. "Tabs" navigerer overflate — Filsystem vs Filer
**Hva Bjarne møter**: Han ser tab "Filsystem" og tab "Filer". Den ene er en kort opplastings-veiviser. Den andre er en mappestruktur. Han gjetter feil hver gang.
**Fil**:
- `frontend/client/src/components/universal/UniversalDashboard.tsx:368` — `{ id: 'file-upload', label: 'Filsystem' }`
- `:373` — `{ id: 'files', label: 'Filer' }`
**Fix (S)**: Slå sammen til én tab "Filer" med subnavigering, eller bytt label-er til **"Last opp"** + **"Bibliotek"**.

### F8. Story Arc Studio "Pro Editor Mode" toggle uten forklaring
**Hva Bjarne møter**: Han ser en toggle "Pro Editor Mode" i Story Arc-fanen. Hva er forskjellen? Vet ikke. Klikker. Får et helt annet UI uten advarsel. Klikker tilbake. Mister state.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:4686-4771` — toggle finnes, men ingen tooltip eller "Du må lagre før du bytter modus"-advarsel.
**Fix (S)**: Tooltip på toggle som forklarer hva Pro Mode tilbyr (kanaler, advanced color grade, multi-track timeline), pluss en autosave før modus-bytte.

### F9. "Worklog"-tab er IDE-jargong for "tidregistrering"
**Hva Bjarne møter**: Han ser "Worklog". Antar det er for utviklere. Åpner aldri. Logger time-bruk i en separat Excel.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:371` — `{ id: 'worklog', label: 'Worklog' }`
**Fix (S)**: Døp om til **"Timer"** eller **"Tidsføring"**.

### F10. "Showcase Admin" er admin-språk
**Hva Bjarne møter**: Han er en videograf, ikke en CMS-admin. "Showcase Admin" gjør ham usikker på om han er feil sted.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:367` — `{ id: 'showcase-admin', label: 'Showcase Admin' }`
**Fix (S)**: Døp om til **"Mitt showcase"** eller **"Portefølje"**.

### F11. Bryllups-tab heter "Evendi" — third-party-brand
**Hva Bjarne møter**: Tab heter "Evendi" med eget ikon. Han googler "Evendi" og blir forvirret. Dette er bryllups-timeline-funksjonaliteten, men det røpes ikke i navnet.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:366` — `{ id: 'wedding-timeline', label: 'Evendi', ... }`
**Fix (S)**: Bruk dobbel-label: **"Bryllup (Evendi)"** eller la sub-brand-en kun vises i header inni tabben.

### F12. Stripe Connect for direkte fakturering til kunde mangler
**Hva Bjarne møter**: Han vil sende faktura til kunde og få betaling rett inn på sin egen konto. Plattformen har orkestrering-actions for `createInvoice` og `sendInvoice` (i FotografOrchestrator), men ingen flow for å koble Bjarnes Stripe Connect-konto.
**Fil**: Søk etter `stripe.connect`, `stripe.accounts.create` i videograf-relaterte komponenter — ingen treff på Connect-onboarding.
**Fix (L)**: Innstillinger-tab → "Betaling" → "Koble Stripe-konto" (Stripe Connect Express). Connect Account ID lagres på user-profilen.

---

## 🎯 NICE (7)

### N1. Frame-aware playback-shortcuts i CinematicVideoPlayer
**Hva**: Mellomrom = play/pause, J/K/L = scrub, I/O = in/out points, +/- = juster timecode. Standard for proff video-tooling.
**Fix (M)**: Wire opp keyboard-handlers i CinematicVideoPlayer.tsx.

### N2. Auto-genereret thumbnails per kapittel
**Hva**: Når Bjarne markerer kapitler (ceremony, speeches, dance), generer en thumbnail per kapittel automatisk via Cloudflare Stream poster-API.
**Fix (M)**: Stream API støtter `/stream/<uid>/thumbnails/<time>.jpg`. Hook det i `GalleryChapterBreak.tsx`.

### N3. Multi-cam audio-fingerprint-sync som ekte tjeneste
**Hva**: Multi-Angle Synkronisering-orchestreringen faktisk gjør jobben via `ffmpeg`-pipeline.
**Fix (L)**: Backend-worker som tar 4 video-filer, ekstraherer audio waveforms, kjører cross-correlation, returnerer offset-array som Bjarne kan laste inn i Resolve.

### N4. Color grade-LUT-bibliotek per bryllups-stil
**Hva**: Forhåndsdefinerte LUTs ("warm summer", "moody nordic", "cinematic teal") som Bjarne kan klikke for å applisere på sin edit.
**Fix (M)**: 5-10 ferdig genererte `.cube`-filer + en panel i Story Arc Studio.

### N5. Klient-versjons-history med tydelig "v1 / v2 / v3"-merking
**Hva**: Brudeparet ser tydelig hvilken versjon de er på, kan klikke mellom dem, og se hva som endret seg.
**Fix (M)**: Utvidelse av `client_gallery_images` + UI i client-gallery.tsx.

### N6. Resolve Workflow Integration via Tauri-app
**Hva**: Resolve Script Manager (per memory) får en knapp "Pakk ferdig Resolve-export tilbake til CreatorHub". Sender ferdig MP4 + timecode-comments via signert API.
**Fix (L)**: Krever Tauri-app + Resolve Workflow Integration API. Estimat ~30t.

### N7. Adobe Premiere CEP-plugin
**Hva**: Direkte import av Story Arc XML til Premiere uten manuell mellomtanke.
**Fix (L)**: Krever CEP-utvikling. Adobe Developer Program-tilgang.

---

## Prioritering for Bjarne's første uke

Hvis du må velge: gjør disse fem først, så er Bjarne produktiv uten daglig håndholding:

1. **B1** Fiks 6 runtime-bugs i `ExportDialog.tsx` (S, ~30 min) — kritisk, hele DaVinci-eksporten er bombet
2. **B4** Speil FotografOrchestrator-fixen i VideografOrchestrator (S, ~20 min)
3. **B5** Retry-toast + localStorage-persist på timecode-kommentarer (S, 1t)
4. **B2** Stream-readiness-polling med UI-status (M, 2t)
5. **F5** ETA-beregning på chunked upload med live oppdatering (S, 1t)

Total: ~5-6 timer arbeid. Etter dette er kjernefunksjonaliteten ærlig nok til at Bjarne får jobben gjort uten å bli lurt.

---

## Hvis du må overlevere Bjarne i dag uten disse fixene

Sørg minst for:
- Daniel ber Bjarne IKKE bruke "Eksporter til DaVinci Resolve"-knappen — gi ham et manuelt eksport-skript i mellomtiden
- Daniel sier eksplisitt: "Når du laster opp video, vent 10-30 min FØR du sender klient-galleri-lenken" (Stream må transcoded)
- Daniel forklarer at "Multi-Angle Synkronisering"-knappen er kommer-snart, ikke implementert
- Daniel sier til brudeparet i forveien: "Hvis kommentarer ikke kommer fram, prøv på nytt — vi har en kjent bug"
- Daniel viser eksplisitt "Video AI"-tabben er for stills, ikke video-AI

Resten kan komme senere etter første tilbakemelding fra Bjarne.

---

## Stabilitetsobservasjon (informativ, ikke gap)

`VideografOrchestrator.tsx` (875 linjer) er bedre enn FotografOrchestrator (8857 linjer) — ingen fake-completion-løgn på frontend-siden. Men `ExportDialog.tsx` (773 linjer) har minst 6 runtime-bugs i én tjeneste-funksjon (`DaVinciResolveExportService`). Det antyder at den filen aldri har blitt ende-til-ende-testet i en ekte exporting-flow. Anbefales å fryse atferd via Playwright-test som faktisk kjører `exportTimeline()` og verifiserer den genererte XML-en.
