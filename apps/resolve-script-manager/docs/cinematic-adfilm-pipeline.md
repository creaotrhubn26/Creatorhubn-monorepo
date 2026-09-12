# Cinematic Ad-Film Pipeline (Leadgrid NAVIGATOR)

End-to-end-dokumentasjon av hvordan den cinematiske Leadgrid-reklamefilmen ble
laget — fra tom side til ferdig 60-sekunders film + redigerbar Resolve-timeline —
og designet for å bli et **gjenbrukbart grensesnitt i Post Agent** (ny `ad_film`-
agent + `cinematic_adfilm_engine`-motor) som kan brukes på et hvilket som helst
produkt/app i andre prosjekter.

> Kildemateriale: alle stegene ble kjørt manuelt i `/tmp/leadgrid-film/`
> (scripts: `gen_navigator*.py`, `key_navigator.py`, `assemble_navigator.py`,
> `build_reveal_nordic.py`, `gen_vo_fal.py`, `finish_navigator_FINAL.py`).
> Dette dokumentet abstraherer dem til én parametrisert pipeline.

---

## 0. Filosofi (kardinalregler — MÅ håndheves i grensesnittet)

Disse er ufravikelige og bør kodes inn som valideringer/guards i agenten:

1. **ALDRI generer eller finn på produkt-UI.** Alt skjerm-innhold skal være
   EKTE app-opptak/skjermbilder, keyet pixel-perfekt. AI genererer bare
   *omgivelsene* (person, gate, café, iPad-skall) — aldri grensesnittet.
2. **Produktet er helten, mennesket er kun bruker.** Ansiktet holdes ofte i
   silhuett/skygge; fokus er skjermen og handlingen.
3. **Kvalitetsnivå:** Apple / Tesla / Stripe / Linear / DJI. Ingen sci-fi,
   neon, HUD, emoji. Rolig, selvsikker Apple-keynote-tone.
4. **Karakter-lås:** samme person, klær og look i ALLE shots (se Continuity-
   motoren, §2). Én referanse → alle andre avledes fra den.
5. **Setting:** valgbar, men konsistent (her: Oslo, golden hour / blåtime / regn).

---

## 1. Pipeline-oversikt (9 stadier)

```
 0  Storyboard + VO-manus        (menneske/Claude → JSON)
 1  Generer stills               fal: nano-banana (T2I)        + Continuity-motor
 2  Animer stills → klipp        fal: bytedance/seedance/v1/pro/image-to-video
 3  Ta opp EKTE app-UI           simctl / skjermopptak         (grønn iPad-skjerm i plate)
 4  Greenscreen-key ekte UI      OpenCV per-frame chroma key   → UI på iPad-skjermen
 5  Monter til storyboard        ffmpeg concat + normalisering + musikk-bed
 6  Voice-over                   fal: elevenlabs/tts/multilingual-v2  + duck under musikk
 7  Undertekster                 silencedetect → linje-timing → PNG-overlay / SRT
 8  Reveal-segment (valgfritt)   map→UX pull-back key (spesial-shot)
 9  Redigerbar Resolve-timeline  DaVinciResolveScript: V1 video · V2 subs · A1 musikk · A2 VO
```

Sluttleveranser:
- **Bakt master:** `LEADGRID-NAVIGATOR-final.mp4` (1920×1080, 60,3s, H.264).
- **Redigerbar Resolve-timeline:** `NAVIGATOR-SUNRISE-KEY` → `NAVIGATOR-EDIT-v7`.

---

## 2. Stadier i detalj

### Stadie 0 — Storyboard + VO-manus
Et lite JSON/tabell-objekt driver alt. For NAVIGATOR: 11 VO-linjer + 15 shots.

**VO-manus (`VO-SCRIPT`)** — engelsk tale, norsk undertekst, ~3–4s/linje:

| # | Scene | EN (VO) | NO (undertekst) |
|---|-------|---------|-----------------|
| 01 | Jordkloden | "The world is full of opportunity." | «Verden er full av muligheter.» |
| 04 | Dashboard | "Every lead, every route — one clear view." | «Hver lead, hver rute — ett tydelig overblikk.» |
| 11 | Tag | "Leadgrid. Lead smarter. Close more." | «Leadgrid. Lead smarter. Close more.» |

**Storyboard (`SHOT-liste`)** — hvert shot har: prompt, varighet, hvorvidt det
har ekte-UI-key (SHOT-s05/06/07/09/11/13/14) eller er ren atmosfære (s01/02/03/
04/08/10/12/15). Denne markeringen styrer §4.

### Stadie 1 — Generer stills (fal nano-banana T2I)
- Endepunkt: `https://queue.fal.run/fal-ai/nano-banana`
- Body: `{"prompt": <shot-prompt>, "num_images": 1, ...}`
- Output: én still per shot i cinematisk stil.

**Scene Continuity Engine (avgjørende for karakter-lås):**
Alle shots avledes fra ÉN godkjent referanse-still via
`fal-ai/nano-banana/edit` (image-edit) — man sender referansen + en edit-prompt
(«samme person/klær, ny vinkel/setting»). Dette holder person, antrekk og look
identisk på tvers av alle 15 shots. Uten dette driver karakteren fra shot til shot.

### Stadie 2 — Animer stills → klipp (fal Seedance 2.0 / v1 Pro)
- Endepunkt: `https://queue.fal.run/fal-ai/bytedance/seedance/v1/pro/image-to-video`
- Input: still (lastet opp til fal-storage) + bevegelses-prompt (subtil push-in,
  parallax, håndholdt drift). Output: ~5s klipp.
- Seedance er valgt for realistisk, filmatisk bevegelse (ikke morphing/warping).

### Stadie 3 — Ta opp EKTE app-UI
- iOS-app: `xcrun simctl io <UDID> recordVideo` på simulator, eller ekte enhet.
- 🔑 QA-hook i appen (`QA_CINEMATIC=nordic` env) kjører den ekte funksjonen
  (f.eks. `startNavigation`) automatisk, så opptaket viser ekte flyt.
- Plate-shot generert i §2 har en **grønn iPad-skjerm** (chroma-flate) som UI-en
  keyes inn på.

### Stadie 4 — Greenscreen-key ekte UI på iPad-skjermen (OpenCV)
Per-frame chroma key (`key_navigator.py` / `green_quad()` i `build_reveal_nordic.py`):
- Konverter plate til HSV, masker grønn (hue/sat/val-terskler).
- Finn skjerm-quaden (fire hjørner), warp UI-opptaket inn i quaden per frame.
- Komposit UI over plate der masken er grønn.
- 🔑 Tight maske (UI kun på skjerm-fronten), håndledd-rotoscoping der en hånd
  krysser skjermen (rundet glass-maske).

### Stadie 5 — Monter til storyboard + musikk-bed (ffmpeg)
- Normaliser hvert klipp: `scale=1920:1080:force_original_aspect_ratio=increase,
  crop=1920:1080,fps=24,format=yuv420p`, trim til shot-varighet (`-ss START -t DUR`).
- Concat via `ffmpeg -f concat`.
- Legg på sømløs musikk-bed med fade in/out.

### Stadie 6 — Voice-over (fal ElevenLabs) + duck
- Endepunkt: `https://queue.fal.run/fal-ai/elevenlabs/tts/multilingual-v2`
- Body: `{"text": <hele VO-manuset>, "voice": <navn/id>}` → én sammenhengende VO.
- **Duck musikken under VO** (profesjonell mix):
  ```
  [music]atrim,volume=0.72,afade[m];
  [vo]volume=1.7,adelay=250|250,asplit=2[v1][v2];      # asplit: VO brukes 2 steder
  [m][v1]sidechaincompress=threshold=0.04:ratio=8:attack=15:release=350[md];
  [md][v2]amix=inputs=2:duration=longest,alimiter=limit=0.95
  ```
  🔑 `asplit` er nødvendig fordi VO konsumeres to steder (sidechain + amix) —
  én filter-output kan bare brukes én gang.
  🔑 Loop musikken (`-stream_loop -1`) hvis beden er kortere enn videoen.

### Stadie 7 — Undertekster (uten libass)
- **Linje-timing uten whisper:** kjør `silencedetect=noise=-32dB:d=0.35` på den
  rene VO-fila, avled tale-segmenter, og bruk de N-1 **største pausene** som
  linje-grenser → N grupper. Map til undertekst-linjene i rekkefølge.
- 🔑 **Denne ffmpeg-buildet (homebrew) mangler `subtitles`/`drawtext`/libass.**
  Løsning: render hver linje som en transparent **PNG** (PIL: hvit bold tekst +
  mørk pill-bakgrunn, `MarginV` bunn) og legg over med
  `overlay=enable='between(t,a,b)'`. Robust, og gir eksakt kontroll på stil.
- Alternativ (hvis libass finnes): generer `.ass` med stil i headeren og bruk
  `subtitles=film.ass`.

### Stadie 8 — Reveal-segment (spesial-shot)
Map→UX pull-back: start tett på kartet (ekte nav-opptak) → trekk kamera ut til
iPad-en i brukerens hånd på gata (kort + verktøy synlig). Bygget som eget
key-pass og splicet inn i stedet for et atmosfære-shot (matematikk: byttet
3,5s-shot mot 7,9s reveal → total ≈ VO-lengde).

### Stadie 9 — Redigerbar Resolve-timeline (DaVinciResolveScript)
```python
import DaVinciResolveScript as dvr
r = dvr.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject()
mp = p.GetMediaPool()
p.SetSetting("timelineFrameRate","24")
items = mp.ImportMedia([...video, music, vo])
tl = mp.CreateEmptyTimeline("EDIT-v7")
mp.AppendToTimeline(video_items)                       # V1, sekvensielt
tl.AddTrack("audio")                                   # A2
mp.AppendToTimeline([{mediaPoolItem:music,mediaType:2,trackIndex:1,recordFrame:0}])
mp.AppendToTimeline([{mediaPoolItem:vo,   mediaType:2,trackIndex:2,recordFrame:6}])
tl.AddTrack("video")                                   # V2 = undertekster
for i,png in enumerate(sub_pngs):
    it = mp.ImportMedia([png])[0]                       # 🔑 én av gangen
    mp.AppendToTimeline([{mediaPoolItem:it,startFrame:0,endFrame:dur-1,
                          mediaType:1,trackIndex:2,recordFrame:pos}])
p.GetProjectManager().SaveProject()
```
Resultat: V1 video · V2 undertekst-bilder · A1 musikk · A2 VO — alt redigerbart.

---

## 3. fal.ai API-referanse (queue-mønster)

| Bruk | Modell-endepunkt |
|------|------------------|
| Stills (T2I) | `fal-ai/nano-banana` |
| Continuity-edit | `fal-ai/nano-banana/edit` |
| Animer (I2V) | `fal-ai/bytedance/seedance/v1/pro/image-to-video` |
| Voice-over (TTS) | `fal-ai/elevenlabs/tts/multilingual-v2` |

- **Nøkkel:** `~/.config/leadgrid/fal.key` (aldri hardkodes/echoes — server/env-side).
- **Submit:** `POST https://queue.fal.run/<model>` med `Authorization: Key <FAL_KEY>`.
- **Poll:** 🔑 **hent `status_url` og `response_url` FRA submit-responsen** — ALDRI
  konstruér dem manuelt (`/edit`-suffikset droppes → jobben henger for alltid).
- **Storage upload (for I2V-input):** `POST https://rest.alpha.fal.ai/storage/upload/initiate`
  → PUT til pre-signed URL → bruk retur-URL som `image_url`.

---

## 4. Gotchas (hardt opptjent — kod dem inn)

| # | Felle | Fix |
|---|-------|-----|
| 1 | fal poll henger | Bruk `status_url` fra respons, ikke konstruert URL |
| 2 | ffmpeg mangler `subtitles`/`drawtext`/libass | Render undertekst-PNG + `overlay` |
| 3 | `force_style`-kommaer tolkes som filter-separatorer | Bruk .ass-fil eller PNG-overlay |
| 4 | Numererte PNG-er (`sub_00,01…`) → Resolve-bilde-SEKVENS | Importer én fil av gangen |
| 5 | `[vo]` brukt i sidechain OG amix → filter-feil | `asplit=2` først |
| 6 | Musikk kortere enn video → siste sekunder stille | `-stream_loop -1` + `duration=longest` |
| 7 | Karakter drifter mellom shots | Continuity-motor: alle avledet fra én ref via `nano-banana/edit` |
| 8 | AI genererer falsk UI | ALDRI — key ekte app-opptak (kardinalregel) |
| 9 | Ingen whisper for VO-timing | `silencedetect` + N-1 største pauser = linje-grenser |
| 10 | simctl-opptak choppy på statiske skjermer | Ha bevegelse i UI-opptaket / kort hold |

---

## 5. Gjenbrukbart grensesnitt i Post Agent

### 5.1 Ny agent-type: `ad_film`
Legg til i `src/agents/types.ts` `AgentKind` og `src/agents/ad_film/index.ts`
som `AgentConfig`:
- **Chapters** (narrative beats): `hook` → `problem` → `product-reveal` →
  `in-use` → `proof/results` → `outro/tag`.
- **Signal-vekter:** `ui_legibility` (er den ekte UI-en lesbar?),
  `character_consistency`, `screen_key_quality`, `grade_consistency`,
  `vo_sub_sync`.
- **Look-packs:** «Golden Hour Premium», «Blue Hour Tech», «Rain Noir».
- **Director-persona:** kjenner kardinalreglene, Apple-keynote-pacing,
  real-UI-key-disiplin.

### 5.2 Gjenbrukbar motor: `python/scripts/cinematic_adfilm_engine.py`
Rene, parametriserte funksjoner (én per stadie) drevet av ett `AdFilmSpec`-JSON:
```python
gen_stills(spec)           # §1  fal nano-banana + continuity-edit
animate_clips(spec)        # §2  fal seedance i2v
key_ui(spec)               # §4  OpenCV green-key ekte UI → plate
assemble(spec)             # §5  ffmpeg concat + musikk
voiceover(spec)            # §6  fal elevenlabs + duck-mix
subtitles(spec)            # §7  silencedetect → PNG-overlay
build_resolve_timeline(spec) # §9 DaVinciResolveScript
```
Modeller registreres i `ai_models.py`; fal-nøkkel via `credential_store.py`;
Tauri↔python via `bridge.py`. Alle fal-kall følger queue+`status_url`-mønsteret.

### 5.3 `AdFilmSpec` (input-kontrakt — gjør pipelinen produkt-agnostisk)
```jsonc
{
  "product": "Leadgrid",
  "brand": { "wordmark_asset": "LeadgridLockup", "accent": "#6a3fbf" },
  "setting": "Oslo, golden hour",
  "character": { "ref_still": "…", "lock": "mann 30-år, hvit skjorte, mørk frakk" },
  "fps": 24,
  "vo": { "provider": "elevenlabs", "voice": "Brian", "lang_spoken": "en", "lang_sub": "no" },
  "music": "assets/seamless_bed.m4a",
  "shots": [
    { "id": "s01", "prompt": "…", "dur": 3.2, "ui_key": false },
    { "id": "s05", "prompt": "…", "dur": 3.5, "ui_key": true,
      "ui_recording": "recordings/nordic_nav.mov" }
  ],
  "vo_lines": [ { "en": "The world is full of opportunity.",
                  "no": "Verden er full av muligheter." } ]
}
```
Bytt `product`, `character.ref_still`, `shots` og `vo_lines` → samme pipeline
lager en ny reklamefilm for et helt annet produkt. Det er gjenbruket.

### 5.5 fal.ai ⇄ Claude Vision QC-løkke (kvalitets-motoren)

Kjernen i gjenbruket: hver fal-generering kvalitets-kontrolleres av **Claude
Vision** mot kardinalreglene, og svake resultater **regenereres automatisk** med
en konkret fix-prompt. Dette er det som hever fal-output fra «ok» til premium.

```
 for hvert shot:
   fal (nano-banana / seedance) ──▶ still/klipp
        │
        ▼
   Claude Vision (anthropic_proxy)  ── rubrikk fra kardinalreglene:
        ├─ ekte vs OPPFUNNET UI  (kritisk for ui_key-shots)
        ├─ karakter-konsistens (samme person/klær vs ref)
        ├─ cinematisk premium (lys/komposisjon/farge)
        ├─ ingen sci-fi/neon/HUD/emoji
        └─ produktet er helten
        │  → {score 0-100, pass, issues[], fix_prompt}
        ▼
   score < 78 ?  ──ja──▶  regenerer med fix_prompt (opp til 3 forsøk, behold beste)
        │ nei
        ▼
   godkjent still
```

- **Modeller:** `claude-sonnet-4-6` per still (rask), `claude-opus-4-8` for endelig
  film-QC (strengest). Konfigurerbart (`CLAUDE_QC_MODEL`, `QC_PASS_SCORE`).
- **API:** `anthropic_proxy.Anthropic().messages.create(model, system=<rubrikk>,
  messages=[{image (base64), text}])` — samme vision-mønster som resten av Post Agent.
- **Motor-funksjoner:** `vision_qc(image, shot, spec)` (én frame),
  `gen_stills(spec, qc=True, max_tries=3)` (generer+QC+regenerer-løkke),
  `qc_final(spec, master)` (sampler N frames fra ferdig film → opus-QC-rapport).
- **Rapporter:** `qc_stills_report.json` + `qc_final_report.json` (score + issues)
  vises i panelet så mennesket ser hva som ble regenerert og hvorfor.
- **Fail-open:** QC-feil (nett/proxy) blokkerer aldri pipelinen (returnerer pass).

Dette gir en selv-forbedrende sløyfe: fal lager kandidater, Claude Vision er
den kvalitets-portvokteren som håndhever «aldri oppfunnet UI, alltid premium»,
og regenererer til terskelen er nådd — uten menneske i hver iterasjon.

### 5.7 Shot Plan-generator (én setning → produksjonsark)

Front-enden av pipelinen: **én setning → full «Shot Plan» / produksjonsark**
(karakter-referanser, miljø, storyboard-paneler, kamera-oppsett, shot-typer,
mood/lys, VO-linjer) via **Claude** (`anthropic_proxy`). Video animeres med
**Seedance** (allerede i motoren).
- 🔑 **Kardinalregel innebygd:** Shot Plan-en markerer `ui_key`-shots der EKTE
  app-UI keyes inn — vi lager ALDRI falsk produkt-UI.

**Motor:** `generate_shot_plan(idea, product, setting=, n_shots=, ui_recordings=)`
→ Claude returnerer JSON (character.lock, setting, shots[{prompt, dur, ui_key,
shot_type, camera, mood}], vo_lines[{en,no}]) → ferdig `AdFilmSpec`.

**Full flyt:**
```
 idé (én setning)
   └▶ generate_shot_plan (Claude)         → produksjonsark / AdFilmSpec
        └▶ write_manuscript_md            → menneske refiner VO + shots (§5.6)
             └▶ gen_stills (fal + Vision-QC-løkke, §5.5)   → godkjente storyboard-paneler
                  └▶ animate_clips (Seedance)              → multi-cut klipp
                       └▶ key_ui (ekte app-opptak)         → produkt-UI keyet
                            └▶ assemble + voiceover_per_line + subtitles
                                 └▶ build_resolve_timeline / master-eksport
```
Dette gir «beskriv → produksjonsark → generer»-opplevelsen + vår real-UI-
disiplin + Claude-Vision-QC + manuskript/VO-system.

### 5.6 Manuskript- + Voice-over-system (skriv hva VO skal være)

Én redigerbar **markdown-manus** er kilden til hele filmen — du skriver VO-en
og scenene der, og pipelinen leser den. Rundtripp-es til/fra `AdFilmSpec` så
panelet og hånd-redigering deler samme format.

```markdown
# Leadgrid — Manuskript
- **Stemme (ElevenLabs):** Brian
- **Tale/undertekst:** en / no

## Voice-over
| # | VO (tale)                          | Undertekst                     |
|---|------------------------------------|--------------------------------|
| 1 | The world is full of opportunity.  | Verden er full av muligheter.  |
| 4 | Every lead, every route — one view.| Hver lead, hver rute — overblikk.|

## Scener (storyboard)
| id  | varighet | ui-key | prompt        | app-opptak            |
|-----|----------|--------|---------------|-----------------------|
| s01 | 4.2      | ja     | café hero …   | recordings/dash.mov   |
```

- **Motor:** `write_manuscript_md(spec, path)` / `parse_manuscript_md(path)`
  (rundtripp verifisert). Panelet redigerer denne tabellen; ingen kode nødvendig.
- **Stemme-velger:** `ELEVENLABS_VOICES`-katalog (Brian/Rachel/Adam/Antoni/Bella,
  utvidbar) — velg stemme i UI; genereres via **fal `elevenlabs/tts/multilingual-v2`**.
- **VO-generering — to moduser:**
  - `voiceover(spec)` — hele manuset i én fil (rask).
  - **`voiceover_per_line(spec)` (FORETRUKKET)** — syntetiserer HVER linje for seg
    og skjøter sammen med faste pauser. Da kjenner motoren **eksakt start/slutt per
    linje** → **perfekt undertekst-sync uten silencedetect-gjetting**. Dette er den
    store kvalitets-gevinsten: manuskriptet ⇒ VO ⇒ undertekster er 1:1 koblet.
- **Kobling:** samme `vo_lines`-tabell driver både VO-tale (EN) og undertekst (NO)
  — skriv én gang, få begge synket.

### 5.4 UI-flyt i Post Agent (ad_film-panel)
1. **Brief** → Claude fyller `AdFilmSpec` (storyboard + VO) fra en kort prompt.
2. **Generer & godkjenn** stills — fal genererer, **Claude Vision QC regenererer
   svake automatisk** (§5.5); mennesket ser QC-rapport + kan overstyre.
3. **Animer** godkjente stills (Seedance) — også QC-et.
4. **Dra inn app-opptak** for ui_key-shots → auto-key.
5. **Monter** → forhåndsvis → **VO + undertekster** → **endelig Claude Vision-QC** (opus).
6. **Åpne i Resolve** (redigerbar timeline) eller **eksporter master**.

---

## 6. Kjøre-referanse (denne filmen)
- Arbeidsmappe: `/tmp/leadgrid-film/`
- Endelig script: `finish_navigator_FINAL.py` (§5–7 + reveal-splice)
- Resolve-build: kjørt via `DaVinciResolveScript` mot `NAVIGATOR-SUNRISE-KEY`
- Master: `~/Desktop/LEADGRID-NAVIGATOR-final.mp4`
- Timeline: `NAVIGATOR-EDIT-v7` (bin `NAVIGATOR-EDIT`)
