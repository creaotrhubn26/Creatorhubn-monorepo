# Infographic Studio — arkitektur (HTML → alfa → Resolve)

Bevist ende-til-ende mot Resolve 21 (2026-06-15). Dette er den valgte metoden for
profesjonelle, redigerbare infographic-/overlay-løsninger — etter at prosedyre-
genererte Fusion-noder viste seg å se «templatet/amatør» ut. HTML/CSS gir
piksel-kvalitet fordi det er samme tech som lager referansene (Motion Array/Figma).

## Pipeline (verifisert)

1. **HTML-mal** (`templates/infographics/*.html`) — ekte font (Inter), ekte ikoner
   (Material Icons via CDN/bundlet), gradienter, skygger, brand-farger. Driver med
   `data-*`-felter + en `window.setProgress(p)` (p = 0..1) som styrer ALL animasjon
   deterministisk (count-up, søyle-vekst, slide/fade, stagger).
2. **Animasjon** i CSS/JS — count-up-tall, voksende søyler/linjer, kort som slider
   inn forskjøvet. Ser perfekt ut og er trivielt å justere.
3. **Frame-for-frame-fangst** (Playwright, headless Chromium, `deviceScaleFactor:2`,
   `omitBackground:true`): kall `setProgress(i/(N-1))` og `screenshot` per frame →
   transparent PNG-sekvens.
4. **ProRes 4444 m/alfa** via ffmpeg:
   `ffmpeg -framerate 30 -i f%03d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov`
   (verifisert: pix_fmt `yuva444p12le` = alfa beholdt).
5. **Inn i Resolve på timelinen** via `scripts/timeline/place_overlay.py`:
   importerer alfa-clipet og legger det på et overlay-spor (V2/V3) ved `recordFrame
   = timelineStart + atSec*fps` — altså NÅR det skal dukke opp i videoen, over opptaket.
   (Verifisert: overlay plassert på V2 ved frame 120.)

## Studioet (in-app, å bygge)

Et gjennomtenkt studio i Post Agent:
- **Mal-bibliotek**: stat-kort, stat-rad, ring/donut-måler, søyle/linje-graf,
  progress, stepper/checklist, lower-third, HUD-paneler, A/B-test, live-analytics-
  bar, «forberedt før konsultasjon»-hero — alle som HTML-maler.
- **Data + brand + timing-editor** med **live-preview** (samme HTML i en iframe;
  `setProgress` scrubbes). Felter: tekst, tall/prosent, ikon, farger, og **atSec /
  varighet** (når den dukker opp på timelinen).
- **Designer-vennlig**: en menneskelig designer (eller kjøpte maler) kan legge til
  nye HTML-maler i `templates/infographics/` — appen bruker dem automatisk.
- **Render + plasser**: appen rendrer alfa-clipet (Playwright+ffmpeg) og kaller
  `place_overlay` for å legge det på timelinen til riktig tid.

## Hvorfor ikke Fusion-noder / hvorfor ikke «editable in Resolve»

- Prosedyre-Fusion-noder for rene UI-kort → ser templatet ut (verifisert).
- «Redigerbart inne i Resolve» krever Fusion-maler/macroer — men de når ikke
  HTML-kvalitet uten en motion-designer per mal. Valget: **HTML-kvalitet +
  redigering i studioet** (ikke i Resolve-nodene). Vil man endre tekst/tall:
  endre i studioet → re-render (raskt). Det er konsistent og ser alltid bra ut.

## Filer
- `templates/infographics/stat-cards.html` — første mal (animert, `setProgress`).
- `python/scripts/timeline/place_overlay.py` — Resolve-plassering (registrert).
- Render-pipeline: Playwright (node, bundlet) + ffmpeg (bundlet).
