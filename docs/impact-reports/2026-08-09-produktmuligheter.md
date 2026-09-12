# Produktmuligheter — 2026-08-09

Seed-utgave. Fremover genererer den ukentlige impact-agenten
(`doc-intel-impact-vurdering`) en `## Produktmuligheter`-seksjon per ny
vendor-release, for ALLE flatene: Post Agent (Resolve/UXP), iPad-appene
(Apple SDK), utdanning/LTI (Moodle/Canvas) og billing (stripe-node).
Denne fila dekker det som er kildebelagt i dag.

# Del 1: Resolve 21.0.4 → Post Agent

Forslag forankret i nye scripting-API-er i DaVinci Resolve 21.0.4
(kilde: release-dekning 2026-08-05 + API-doc v21.0; jf.
`docs/evidence/2026-08-resolve-21-impact.yaml`). Alle gjelder Post Agent
(`apps/resolve-script-manager`).

## 1. Kuratert AI-redigering via clip-selection-API (størst verdi)

**Ny funksjon:** scripting-API for å lese timeline-klipputvalg.
**Forbedrer:** highlight-/bryllupspipelines + `python/scripts/timeline/edit_assistants.py`.
**Bruker får:** marker klipp i Resolve og si «vekt inn disse» / «analyser bare
disse» — fotografens kuratering blir input til story-arc-velgeren i stedet for
at motoren velger blindt. Frame-for-frame-vision på utvalg = raskere og
billigere enn hel film.
**Størrelse:** 1–2 dager (selection-les + vekting i picks-flyt).

## 2. Media-pool→timeline-oppslag erstatter manuell leting

**Ny funksjon:** scripting-API for timeline-objekt fra media-pool-entry.
**Forbedrer:** resynk/kategorisering (UBRUKT/<kamera>-flyten) og
B-kamera-matching i social-vertikal-pipelinen; vi itererer i dag
`GetItemListInTrack` manuelt (43 kallsteder).
**Bruker får:** «hvor er dette klippet brukt»-svar direkte; raskere resynk,
færre feilkilder.
**Størrelse:** timer (bytt oppslags-hjelper, behold fallback for eldre Resolve).

## 3. Leveranse-features via SetRenderSettings handles/extents/burn

**Ny funksjon:** SetRenderSettings-opsjoner for handles, extents og data burn.
**Forbedrer:** `python/scripts/export/delivery_manager.py`.
**Bruker får:**
- «Kunde-review med timecode-burn» som én kommando (kommersiell-video-flyten
  gjør dette manuelt i Deliver i dag)
- Byrå-/klagesak-leveranser med X frames handles (leveranser som tåler videre klipp)
- Kombinert med utvalg (forslag 1): «render ut akkurat disse klippene»
**Størrelse:** timer per opsjon.

## Forutsetning (del 1)

Alle tre krever Resolve ≥ 21.0.4 lokalt (verifisert installert 2026-08-09).
Gate i koden: sjekk versjon før API-kall, grasiøs fallback for eldre.

# Del 2: Xcode 27 / iOS 27 → iPad-appene (VENTER GA)

Xcode 27 beta 4 er ute (release-vaktens baseline 2026-08-09); «vent på
Xcode 27»-beslutningen i `docs/evidence/2026-07-ios27-fm-symbols.yaml`
nærmer seg stale. Ved GA åpner iOS 27 (kilde: WWDC juni 2026, dokumentert i
`docs/apple-intelligence-vision-integrasjonsplan-2026-07-27.md`):

## 4. Claude bak Apple FoundationModels-API-et

**Ny funksjon:** `LanguageModel`/`LanguageModelExecutor`-protokoller lar
tredjeparts-LLM (inkl. Claude via Anthropic Swift-pakke) backe
`LanguageModelSession`.
**Forbedrer:** `ipad/LeadMapApp` TranscriptIntelligence + `ipad/CaptureApp`
notat-AI — i dag ruter fasaden on-device iOS 26 FM → backend-Claude-fallback.
**Bruker får:** samme intelligens-API overalt, Claude-kvalitet også i
FM-kodestien; enklere kode (én sesjonstype).
**Størrelse:** 1–2 dager per app når Xcode 27 GA + Anthropic-pakken er ute.

## 5. On-device multimodal + OCRTool

**Ny funksjon:** on-device-modellen får syn + `OCRTool`.
**Forbedrer:** CaptureApp AssetAnalysis (i dag gammelt Vision-API) og
Leadgrid dørsalg-notater.
**Bruker får:** foto-innsikt uten nett og uten API-kost.
**Størrelse:** dager; krever iPhone 17 Pro+/tilsv. iPad for on-device gen —
behold backend-fallback.

# Del 3: Moodle / Blender / stripe-node

Ingen kildebelagte nye funksjoner å foreslå fra i dag (baseline ble nettopp
etablert). Neste versjonsendring genererer forslags-seksjoner automatisk via
den ukentlige agenten.
