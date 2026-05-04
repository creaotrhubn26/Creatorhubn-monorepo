# R6mkII end-to-end smoke-test protocol

**Hva dette er:** Konkret steg-for-steg-validering av hele tether-stacken
(iPad CaptureApp + backend + galleri-leveranse) mot ekte Canon R6 Mark II
body. **Ikke kjørt ennå** — dette er protokollen Daniel kjører fysisk når
kameraet er tilkoblet.

**Hvorfor:** Per `phase2c_e2e_untested.md` har RAW-pipelinen (Phase 2C
shipping date 2026-05-03) aldri vært kjørt mot ekte Canon body. Alt under
Phase 7-7F er bygget grønt og verifisert mot to fixture-CR3-filer
(_L9A7437.CR3 + _L9A0727.CR3) — men ikke mot live shutter-trigger.

---

## Pre-test sjekkliste

- [ ] R6 Mark II tilkoblet via WiFi (CCAPI-mode), firmware 1.6.0+
- [ ] iPad har Wi-Fi tilkoblet til samme nettverk
- [ ] CaptureApp build fra commit `6a506a8` eller senere installert
- [ ] Backend tilgjengelig (Render staging eller prod)
- [ ] Konto logget inn på iPad med Capture-tilgang
- [ ] Et tomt prosjekt opprettet i UniversalDashboard for test-galleri
- [ ] CR-batteri ≥50%, minst ett SD-kort med ≥2 GB ledig

## Kalibreringsbilder å ta

For å kunne validere ALLE Phase 7-7F akser trenger du forskjellige typer
shots. Ikke alle nødvendige hvis du bare vil derisk-e Holy Crust, men
fullstendig dekning krever:

| # | Subject | Phase 7 axes som testes | Notes |
|---|---------|-------------------------|-------|
| 1 | Portrett, åpne øyne, smil med tenner synlige | freq-sep skin, eye sharpen, eye catchlight, teeth whiten, skin unify, subject_type | Hovedstresstest for face-detection-pipelinen |
| 2 | Portrett, lukkede øyne / profil | Verify no-op + ingen falske mask-applikasjoner | Empty-result robustness check |
| 3 | Halvfigur (ansikt + hender) | skin_unify face↔body delta | Hands skal nudges mot face skin tone |
| 4 | Landskap med tydelig horisont | auto_straighten | Verify Vision detect + CIStraightenFilter |
| 5 | Skrå foto (ca 5° tilt) | auto_straighten correction | Verify horisonten rettes |
| 6 | Top-down food shot | auto_straighten = false (no-op) | Skal ikke rotere — ingen horisont |
| 7 | Bil / kjøretøy | auto_straighten + freq-sep skin = 0 | Skin-axes må være no-op |
| 8 | Produkt på hvit bakgrunn | warmth -, skin axes 0 | Color truth |

## Test-protokoll

### Phase 1: CCAPI tilkobling
1. **Åpne CaptureApp** → fane "Live"
2. **Auto-discovery**: skal finne R6mkII innen 10 sek
3. **Verify kamera-status-rad** viser:
   - Body-modell: "Canon EOS R6 Mark II"
   - Battery %, ledig SD-plass
   - Live exposure (shutter / aperture / ISO)
4. **Skal IKKE skje:** "Kamera ikke funnet" lengre enn 30 sek → hvis det
   skjer, sjekk at iPad + R6 er på samme subnet

### Phase 2: Live shutter
1. **Sett R6 til M-modus** (manual exposure), ISO 400, f/4, 1/200
2. **Trigg shutter fra iPad** (ikke fra body)
3. **Verify**:
   - LED på R6 blinker / shutter klikker
   - CR3 lastes ned til iPad innen 8 sek (R5 er treg, R6mkII raskere)
   - Asset-thumbnail vises i grid
   - **Phase 7C/7E auto-straighten + subject_type:** sjekk at
     `Magic·Tune` panelet viser auto-detected subject + horisont-status
4. **Ta 3-5 shots i hurtig rekkefølge** for backpressure-test

### Phase 3: AI analyze (backend Claude Vision)
For et av portrett-bildene fra kalibreringssettet:
1. **Tap thumbnail → "Magic·Tune"** drawer slides opp (35% detent)
2. **Verify Claude Vision-respons** innen 6 sek:
   - subject = "portrait"
   - confidence ≥ 0.85
   - **Phase 7-7F akser populert** (i recipe-chips):
     - "Skin Tone +N%" (skin_low_freq)
     - "Skin Detail +N%" (skin_high_freq)
     - "Eye Sharpen +N%"
     - "Catch-light +N%"
     - "Teeth +N%"
     - "Skin Unify +N%"
     - "Type: Female/Male/Child/Elderly"
   - auto_straighten = false for portrait
3. **Verify recipe-verdier** ligger i envelope fra
   `capture-analyze-service.ts` (skin_low_freq 0.20-0.40, etc)

### Phase 4: Render-pipeline (RAWExportPipeline)
1. **Med Magic anvendt på portrettet**, sjekk hero-preview
2. **Sammenlign med camera-baked JPEG** (preview path):
   - **Hud:** Tone glattet, pore-detalj bevart (ikke "plastic")
   - **Øyne:** Iris ser litt skarpere, catchlight har pop
   - **Tenner (hvis synlige):** Litt hvitere, ikke "TV-anchor white"
   - **Hender vs ansikt** (hvis halvfigur): tones agree
3. **Sjekk at orientation er riktig** (post-`268214c` fix):
   portrett shot vertikal skal vises stående
4. **Verify ingen artefakter:**
   - Ingen blur ringen rundt øyne (mask edge)
   - Ingen vinkel-discontinuity ved jaw (skin unify mask)
   - Ingen black corners (auto-straighten fungerer riktig)

### Phase 5: Tune-drawer interaksjon
1. **Drag drawer ned til 35% detent** — bildet bak skal være synlig
2. **Drag i bildet bak** mens drawer er åpen — pinch-zoom skal fungere
3. **Toggle subjectType-picker** Female → Male → Child → Elderly:
   - Verify recipe-chips oppdateres
   - Verify hero-preview re-rendrer (debounced 120ms)
4. **Drag Skin Tone slider** −100% → +100% i sanntid:
   - Hero skal oppdatere kontinuerlig
   - Ingen frame-drops på M5 iPad Pro
5. **Drag Eye Sharpen** og se nær hovedmodellens øyne:
   - Endring skal være synlig på 30%+

### Phase 6: Auto-straighten visualisering
1. **Bruk landskaps- eller kjøretøy-bildet med synlig horisont**
2. **Magic·Tune** skal automatisk slå på `Auto-straighten` toggle
3. **Verify Vision-detection løp** — recipe-chip viser
   `Auto-straighten` (eller `Straighten ±N.N°` hvis manual angle)
4. **Hvis horisont skrås**: bildet skal være rettet i hero
5. **Toggle av auto-straighten**: bildet skal vise opprinnelig vinkel
6. **Toggle på igjen + dra manual angle slider** ±15°: synlig rotation

### Phase 7: Galleri-leveranse
1. **Legg til 2-3 bilder i delivery-køen**
2. **Velg "Levering" → ny galleri-link**
3. **Verify upload progress** (multipart R2)
4. **Åpne galleri-URL i Safari på Mac** (ikke iPad — orientation-bug
   verifisert):
   - Bilder skal vise riktig orientering
   - Phase 7-7F edits er syndlige sammenlignet med camera-bake
   - **Color management:** sRGB-tag honored — ingen overdrevet saturation
     (verifiserer commit `e7ab63a`)
5. **Test sharing:** Generer share-link, åpne på iPhone — orientation
   fortsatt riktig

## Akseptkriterier (alle må være ✅ før vi kaller dette "live")

| Krav | Status |
|------|--------|
| CCAPI auto-discovery innen 10s mot R6mkII | ⏳ |
| Shutter-trigger respond innen 1s | ⏳ |
| CR3 download innen 8s for typisk shot | ⏳ |
| Backend Claude Vision-respons innen 6s | ⏳ |
| Phase 7-7F akser populert i recipe-chips | ⏳ |
| RAW render produserer korrekt orientering | ⏳ |
| Drawer-passthrough bilde-interaksjon fungerer | ⏳ |
| Auto-straighten korrigerer visuelt på horisont-bilde | ⏳ |
| Auto-straighten no-op på top-down food | ⏳ |
| Galleri-leveranse til R2 fullføres | ⏳ |
| Galleri-bilde i Safari Mac viser riktig orientering | ⏳ |
| Galleri-bilde i iPhone Safari viser riktig orientering | ⏳ |

## Kjente begrensninger som IKKE er bug-er

- **CIDetector eye-detection feiler på lukkede øyne** — det er forventet,
  pipelinen no-op-er. Ikke en bug.
- **VNDetectFaceLandmarksRequest mouth-mask kan være tynn på lukket
  munn** — innerLips-polygonet er degenerert; teeth-effekten er liten,
  ikke synlig — også forventet.
- **VNDetectHorizonRequest finner ikke horisont på portretter / food**
  — også forventet, no-op.
- **Skin-unify kan no-op-e på tett-cropped portretter** der hele
  framet er ansikt; det er for lite "body skin" å sample.

## Failure modes — første ting å sjekke hvis noe feiler

1. **CCAPI auto-discovery feiler:**
   - Verify R6 + iPad er på samme subnet
   - Verify CCAPI er aktivert i R6's Wi-Fi-meny
   - Sjekk firewall — CCAPI bruker mDNS for discovery

2. **Backend Claude Vision-respons feiler:**
   - Sjekk `ANTHROPIC_API_KEY` på Render
   - Sjekk credit-saldo i Anthropic console
   - Memory `external_api_state.md` sier "lite credit" → kan være tomt

3. **Render-pipeline produserer wrong orientation:**
   - Allerede fikset i `268214c` for MagicPipeline
   - For RAWExportPipeline — CIRAWFilter håndterer EXIF orientation
     automatisk (verifisert empirisk)
   - Hvis fortsatt feil — sannsynligvis ny path (delivery-leveranse?)
     som re-encoder uten å bevare orientation

4. **Phase 7-akser kommer ikke fra backend:**
   - Sjekk at backend er deployet med `6a506a8`+
   - Sjekk Anthropic-modell-versjonen i `capture-analyze-service.ts`
     (krever Sonnet 4.6+ for sannsynlig riktig schema-følging)
   - JSON schema er nå optional → eldre modeller kan emitte uten dem

5. **CIDetector face-detection feiler systematisk:**
   - Verify accuracy-flag = high (ikke fast)
   - Vision-modellen er bedt om å se "sensor-natural" pixels —
     sjekk at CIRAWFilter outputImage allerede er rotert

## Etter test

- [ ] Slett test-galleri og test-prosjekt
- [ ] Slett test-shots fra Capture-sessionen (eller marker dem
      som debug)
- [ ] Oppdater `phase2c_e2e_untested.md` → flytt til `phase2c_e2e_validated.md`
      med dato + body-info
- [ ] Hvis FEIL funnet: opprett task med konkret reproduserende step
