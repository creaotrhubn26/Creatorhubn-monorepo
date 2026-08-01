# EVOTO_GAP.md — location-paritet mot Evoto (Fase 0-audit)

Kode-verifisert gap-analyse (ikke fra hukommelse). Alle stier relative til
`ipad/CaptureApp/CaptureApp/`. Verifisert mot main per 2026-08-02.

> **Merk — flere av oppgavens antatte bugs var utdaterte.** Verifisert mot
> nåkode: RAW-cachen finnes nå (`CachedRawFilter`), `persistSeries`-crop er
> fikset, `BurstAnalyzer`/`BurstGrouper`/`BurstPicker` er **død kode** (0 kallere),
> og lukkede-øyne-deteksjon finnes nå (`AssetAnalyzer` + live-HUD). Cull-flaten er
> reimplementert i `AssetAnalyzer` (delt) + `VisionCullAnalyzer` (iOS 18).

## Sammendrag

| Krav | Kort | STATUS |
|------|------|--------|
| E1 | Tethered auto-deteksjon, ett-tapp | **Delvis** (WiFi/IP ✅ ett-tapp ✅; USB ❌ + 2 bugs) |
| E2 | Sanntids-telemetri (av/tv/iso/EC) | **Delvis** (av/tv/iso/batteri/objektiv ✅; EC ❌) |
| E3 | Lagringsstatus + bilder igjen | **Delvis** (ledig plass ✅; «bilder igjen» ❌; total-count usynlig) |
| E4 | Capture-policy (sync forrige / preset) | **Mangler** (blokkert av captureTime=Date()-bug) |
| E5 | Sanntids effekt-preview live | **Delvis** (banen finnes; 1.5 s syntetisk forsinkelse er flaskehals) |
| E6 | Retusjér ett → synk til serie | **Har** |
| E7 | Sanntids AI-culling | **Delvis** (måles alt; live = kun advarsel på fokusert; auto-filter ❌; duplikater kun post-shoot) |
| E8 | Levering under shoot, per-ansikt | **Delvis** (levering ✅; ansiktsgruppering/branding/gjest ❌) |
| E9 | Gratis å se, betal ved eksport | **Mangler** (forretningsmodell, ikke kode) |

---

## E1 — Tethered auto-deteksjon (wireless + USB), ett-tapp fra hjem

**STATUS: Delvis**

**HVOR:**
- Bonjour + subnett-skann: `Core/Capture/CameraDiscovery.swift:51` (`start()`), `:112` (`scanLocalSubnets`), `:149-153` (probe http:8080/https:443/8443), `:231` (`localIPv4Subnets`).
- Ett-tapp: deteksjon auto-starter på hjem-skjermen `App/LiveCaptureView.swift:682-685` (`.onAppear { discovery.start() }`); funnet kamera kobles med ett tapp `:751-788` (`DiscoveredCameraCard`).
- Tilkobling: `Core/Capture/CCAPIAdapter.swift:start()`, `Core/Capture/CCAPIClient.swift`.

**HVA mangler / bugs (verifisert):**
- 🔴 **Bonjour-reconcile FJERNER IP-skannede kameraer** — `CameraDiscovery.swift:272` `cameras.removeAll { !activeKeys.contains($0.id) }`. `activeKeys` (`:285-288`) er kun Bonjour-instansnavn; IP-funn har id `"ip:<host>"` (`:174`) som aldri finnes der. Canon-kropper annonserer ikke via mDNS i CCAPI-modus, så IP-skann ER funn-stien — og et hvilket som helst Bonjour-delta på nettet tømmer den. **Fikses P1.**
- 🔴 **Long-poll query-enkoding** — `longPollEvents` (`CCAPIClient.swift:257-261`) bygger korrekt `/event/polling?continue=on` via `getVersioned`+`splitQuery`, men ruter gjennom `get(path:)` (`:293-299`) som gjør `baseURL.appendingPathComponent(path)` → prosent-koder `?` til `%3F` → `continue=on` tapes. `getAbsolute(path:)` (`:301-309`) bruker korrekt `URL(string:relativeTo:)`. **Fiks: la `get(path:)` bruke query-bevarende bygging. P1.** (Mildnende: adapteren bruker i praksis short-poll `pollEvents`.)
- ❌ **USB/wired transport finnes ikke** — kun IP/Bonjour over nett. Ingen PTP/USB-kode. Kravets USB-del umøtt (større, egen oppgave — ikke i Fase 1).

---

## E2 — Sanntids kameratelemetri: blender, lukker, ISO, eksponeringskompensasjon

**STATUS: Delvis**

**HVOR:**
- Modell: `Core/Capture/IngestAdapter.swift:40-60` (`CameraTelemetry`: batteri, blender, lukker, ISO, objektiv, ledig plass, total-count).
- Wire-parsing: `Core/Capture/CCAPITypes.swift:123-196` (`CCAPIPollingResponse` — `av→blender :192`, `tv→lukker :193`, `iso :194`).
- Emit: `CCAPIAdapter.swift:168-179` (`.telemetryUpdated`); pumpes `CameraSession.swift:167-169` → `LiveCaptureView.swift:5643` → `mergeTelemetry :7502-7510`.
- **Vises**: `TelemetryFooter` `LiveCaptureView.swift:4245-4276` (blender/lukker/ISO/batteri/objektiv-chips), montert `:505`.

**HVA mangler:**
- ❌ **Eksponeringskompensasjon (EC) finnes ingen steder** — null treff på `exposureComp`/`xcomp` i Core+App. Mangler i alle tre lag (wire-decode → `CameraTelemetry`-felt → chip). Enkel tilføyelse.

---

## E3 — Lagringsstatus + gjenstående bildeantall etter hvert foto

**STATUS: Delvis**

**HVOR:**
- `freeSpaceBytes`/`totalContentsCount`: `IngestAdapter.swift:46-47`, `CCAPITypes.swift:131,135` (parses fra `storage`-diff `:182-188`).
- Ledig plass **vises**: `TelemetryFooter` `LiveCaptureView.swift:4267-4269` (`externaldrive`-chip, `ByteCountFormatter`).

**HVA mangler:**
- ❌ **«Bilder igjen» finnes ikke** — ingen `freeSpaceBytes / snitt-filstørrelse`-beregning. **P3.**
- ⚠️ **`totalContentsCount` samles inn men vises aldri** (merges `:7509`, aldri rendret).
- ⚠️ **Ikke garantert «etter hvert foto»** — `freeSpaceBytes` oppdateres kun når Canons polling-diff tilfeldigvis inkluderer `storage`-objektet; ingen eksplisitt refetch trigget av `addedcontents`.

---

## E4 — Capture-policy før økten (sync forrige / fast preset auto-påført)

**STATUS: Mangler**

**HVOR:**
- Ingen policy-konsept eksisterer (grep `policy|syncPrevious|CaptureEditPolicy|inherit` → kun urelaterte treff som `bufferingPolicy`).
- Nærmeste slektning: `RedigeringModel.swift:359-362` `applyToSeries()` — **manuell/etterskuddsvis**, trigget av knapp, ikke capture.
- Capture-hendelser (`.assetDiscovered`) `CameraSession.swift:103` / `LiveCaptureView.swift:5639` → kun `dispatchShotAutoCheckForNewAssets()` (kvalitet), aldri recipe-arv.
- `RedigeringEditStore.swift:8-23` — `EditState` bærer `version/recipe/exposureEV/crop` (kan bære arven, men ingen policy-lag bruker den fremover).

**HVA mangler / blokker (verifisert):**
- 🔴 **captureTime = Date()-bug** — `CCAPIAdapter.swift:210` setter `captureTime: Date()` ved preview-landing; `register()` (`:200-215`) leser INGEN EXIF. «Forrige bilde»-arv krever ekte opptaksrekkefølge → blokkert. **Fiks P1: EXIF `DateTimeOriginal`, fallback discovery-tid.**
- ❌ Hele policy-laget: `CaptureEditPolicy` (.none/.syncPrevious/.preset), persistert per sesjon, hektet på preview-ready, idempotent. **P2.**

---

## E5 — Sanntids effekt-preview (retusj/preset synlig live idet bildet lander)

**STATUS: Delvis**

**HVOR:**
- Live-strip auto-grade: `Debug/MagicPipeline.swift:58-156` (`start`→`autoEnhance`→`autoProcess`→`applyMagic`) — opererer på **display-JPEG** (`?kind=display`), ingen `CIRAWFilter` (`:12-14, 171-404`). ✅ riktig arkitektur.
- Interaktiv Redigering-bane: `RedigeringPipeline.swift:158-211` **`CachedRawFilter`** (LRU cap 2, mtime-keyed) — muterer kun filter-properties, ingen disk-relese per kall. `MagicPipeline.renderPreview` er nå kun JPEG-fallback (`:36`).

**HVA mangler / flaskehals (verifisert):**
- 🔴 **1,5 s syntetisk forsinkelse** — `Debug/MagicPipeline.swift:121-122` `Task.sleep(1500ms)` («feel of a real remote enhancer») FØR CoreImage-render → gradert thumbnail lander sent; ugradert lys JPEG vises i mellomtiden. Dette (ikke RAW-relese, som er cachet) er flaskehalsen mot «klienten ser final look live». **P4: fjern sleep + rendre display-JPEG rett til UIImage (ikke JPEG-round-trip-til-disk `:396-399`), mål < 1 s.**

---

## E6 — Retusjér ett bilde → synk til alle valgte i prosjektet

**STATUS: Har**

**HVOR:**
- `RedigeringModel.swift:359-406` `applyToSeries()`/`persistSeries()`.
  - (a) Per-asset EditState persisteres: `:386` `RedigeringEditStore.save(a.id, …)` per asset. ✅
  - (b) Crop fra EditStore-fallback: `:382` `crops[a.id] ?? RedigeringEditStore.load(a.id)?.crop`. ✅
  - (c) Persisterer det som rendres (`exportRecipe`, `:378`), ikke rå-recipe. ✅
- UI: `SmartEditPanel.swift:80-81` «Bruk på serie … alle N bildene i økten» — teksten sier «alle», koden gjør «alle» (`assets` = hele økten fra `CullStore`).

**HVA mangler:** Ingenting mot E6. Ingen ærlighetsgap («lignende bilder»-påstand finnes ikke). (Nyanse: gjelder hele økten, ikke et fotograf-valgt delsett — men UI-teksten er ærlig om det.)

---

## E7 — Sanntids AI-culling (lukkede øyne / blur / eksponering / duplikater)

**STATUS: Delvis**

**HVOR (måles):**
- `AssetAnalyzer` (`Core/Capture/AssetAnalysis.swift`, actor `:102`, `run() :141`, off-main `Task.detached :111`, float `.RGBAf`): **lukkede øyne** (`eyesOpen()` øye-EAR, terskel 0.18, `:350-362`), **ansikts-skarphet** (`laplacianEnergy` per rekt + `isSoft() :91-97`), **eksponering/klipping** (persentiler + `clipFractions` + motiv-klipp ∩ personmaske `:215-267`). Ett Vision-pass.
- **Duplikater**: `VisionCullAnalyzer.swift:89-92` `GenerateImageFeaturePrintRequest` (terskel 0.3/0.62), iOS 18+.
- **Live-HUD**: `LiveCaptureView.swift:5119-5127` (`assetAnalyzer.analyze` på fokusert asset) → HUD-advarsler `:2982-2990` («Lukkede øyne»/«Ansikt uskarpt»/«Motiv utbrent»).

**HVA mangler:**
- ⚠️ **Live = kun advarsel på FOKUSERT bilde** — ikke batch-analyse av hele strip'en ved preview-ready. **P5: kjør score ved preview-ready (av MainActor), flagg i stripen.**
- ❌ **Ingen auto-filtrering/avvisning i live** — HUD advarer, men rangerer/skjuler ikke. Faktisk kulling (`CullingEngine.cull`) kun i post-shoot `CullTheaterView`.
- ❌ **Duplikater kun post-shoot** (`VisionCullAnalyzer` i review-teatret), ikke live.
- 🗑️ **Død kode**: `BurstAnalyzer` (fortsatt `@MainActor`, 8-bit readback, `:33,121-129`), `BurstGrouper` (captureTime-avhengig, ville brutt av Date()-bug), `BurstPicker` — alle **0 kallere**. Kandidater for sletting.

---

## E8 — Levering under shoot: galleri per ansikt, branding, gjeste-tilgang

**STATUS: Delvis**

**HVOR:**
- `Core/Sync/DeliveryService.swift:16-481` — speiler session til backend, laster opp valgte previews, minter klient-token → share-URL (`/client/gallery/<token>`, `:107-111`). Egen B2-backup-sti for originaler (`:346-480`, atskilt).
- `Core/Sync/QuickTeaserService.swift` — «under shoot»-flaten (3–5 hero-frames → `deliverToShowcase` → uautentisert share-URL).
- `Core/Models/ClientGallery.swift`, `App/Galleri/GalleriView.swift`.

**HVA mangler:**
- ❌ **Ansiktsgruppering for levering** — ingen identitets-clustering. `FaceContext.detect` gir kun `[CGRect]` (`FaceContext.swift:10`), ingen embeddings. Leveringsfiltre (`BackendTypes.swift:422-430`) er `flagged/rating≥4/all_non_rejected`, aldri per-person.
- ❌ **Branding/watermark** i det leverte galleriet (kun app-chrome/mal-navn finnes).
- ❌ **Gjeste-tilgang** som eget konsept (kun én klient-token/PIN).
- ⚠️ **10–20 s-kjede**: ingen ytelsesgaranti i koden; opplasting sekvensiell.
- *(Sky-avhengig flate — utenfor «alt on-device»-fordelen og Fase 1s live-bane-begrensning.)*

---

## E9 — Gratis å bruke/vise; betaling kun ved eksport

**STATUS: Mangler (forretningsmodell, ikke kode)**

**HVOR / HVA:**
- Ingen paywall/entitlement i capture-/preview-stien; ingen `StoreKit`/IAP i appen.
- `pricePerImage` (`CullTheaterView.swift:12,109`) er REDIGERERENS pris (viser «sparer X kr»), ikke klient-paywall. `payment*` (`EditingJobModels.swift`) = escrow for editor-marketplace.
- **TODO forretningsmodell:** entitlement-/StoreKit- eller backend-gate på EKSPORT-steget (ikke capture/preview). Ingen kodegrunnlag i dag.

---

## Anbefalt Fase 1-rekkefølge (uendret fra oppgaven, forankret i funnene)

- **P1 (fundament):** EXIF `DateTimeOriginal` for `captureTime` (CCAPIAdapter:210) + fiks Bonjour-reconcile (CameraDiscovery:272) + long-poll-enkoding (CCAPIClient get(path:)) + retry m/ backoff.
- **P2 (E4):** `CaptureEditPolicy` (.none/.syncPrevious/.preset), persistert per sesjon, hektet på preview-ready via `RedigeringEditStore`, idempotent (aldri overskriv manuell edit ved reconnect).
- **P3 (E2+E3):** Capture-HUD: EC-chip + `totalContentsCount` + «bilder igjen»-estimat + policy-chip.
- **P4 (E5):** Fjern 1,5 s-sleep, rendre display-JPEG rett til UIImage, mål < 1 s.
- **P5 (E7 v1):** BurstA... → **bruk `AssetAnalyzer`** (Burst* er dødt): score ved preview-ready av MainActor, flagg uskarp/lav face-quality i stripen. Lukkede øyne + duplikater = v2.
