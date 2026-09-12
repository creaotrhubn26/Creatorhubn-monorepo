# Storyboard Studio — iPad

**Visjon:** Sette film- og storyboard-artister i sentrum av produksjonen.
Procreate er et tegneverktøy; dette er *produksjonens* tegneverktøy. Artisten
tegner rett inn i The Role Room-produksjonen — manuset, scenene, casten,
regissørens notater og callsheetene lever i samme flate som penselen.

**Posisjonering (StoryBrand SB7):** Artisten er helten. Appen er guiden —
med en plan som tar dem fra manus til godkjent sekvens. Problemet vi løser:
artisten står i dag alene mellom regissør, DP, klipper, production design og
stunt, med e-post og løse ark som verktøy. Suksess = artisten designer
filmsekvensen, ikke bare illustrerer den. Fiaskoen vi hjelper dem unngå:
vakre boards som ikke svarer på produksjonens spørsmål.

## Kjerneprinsippet

> En svak artist spør «hva skal jeg tegne?». En sterk artist spør
> **«hva skal publikum føle akkurat nå?»** — og deretter:
> story → beat → blocking → camera → lens → composition → movement → cut.
> I den rekkefølgen. Appen er bygget rundt denne rekkefølgen.

Og: **Clarity > Art.** Et storyboard har gjort jobben når crewet umiddelbart
leser WHO / WHERE / CAMERA / MOVEMENT / ACTION / DIRECTION / CUT — ikke når
tegningen er pen.

## Intensjonslaget — det Procreate aldri kan ha

Hvert frame bærer *hvorfor*, ikke bare *hva*. Strukturerte felter, alltid
synlige ved tegneflaten, synket til The Role Room:

1. **Beat & følelse** («Hva skal publikum føle akkurat nå?») — scene-beat,
   POV-eier, karakterens emosjonelle perspektiv, hva publikum vet / hva som
   skjules (reveal, suspense, dramatic irony), visuell eskalering.
2. **Kamera (DP-språket)** — linse (18/35/50/85mm → perspektivkompresjon
   vises i guidene), kamerahøyde, avstand, eyeline, headroom, negative
   space, deep/shallow staging, motivert bevegelse (dolly vs zoom, handheld
   vs locked-off).
3. **Klipp (før/etter-bevissthet)** — filmstripen med forrige/neste frame er
   alltid synlig mens man tegner; appen sjekker 180°-regel, screen
   direction, eyeline match og size progression mot naboframes og varsler
   brudd som *forslag* (kontinuitetsbrudd kan være bevisste).
4. **Blocking & rom (production design)** — top-down floorplan per scene:
   dører, vinduer, møbler, aktør-posisjoner (A/B/C), kameraposisjon per
   frame. Blocking-endringer mellom frames viser scenens maktforskyvning.
   Kobles til lokasjons-refs fra produksjonen.
5. **Action-kjede (stunt/VFX)** — cause → action → reaction → consequence
   som nummerert kjede over frames; eksport til previs-pipeline
   (script → board → techviz → previs → shoot → postvis).

## Visual Arc (Bruce Block)

Per sekvens: en intensitetskurve koblet til visuelle parametre —
stable→unstable, horizontal→diagonal, wide→tight, low→high contrast,
slow→fast movement, simple→complex. Artisten ser om bildespråket faktisk
eskalerer med dramaet. Appen plotter frames på kurven fra metadataene
(shot size, linse, vinkel, kontrast i tegningen).

## Faglig fundament (innebygd, ikke påklistret)

- **Panel economy & silhuett** (Toth, Eisner, Moebius, Otomo): silhuett-modus
  — vis framet i ren sort/hvitt-silhuett for å teste lesbarhet.
- **Framed Ink-prinsippene** (Mateu-Mestre): komposisjons-overlays — visual
  hierarchy, value-blokker, blikk-flyt (hvor ser øyet først?).
- **Referansestudier**: kuratert bibliotek per behov — Hitchcock (POV/
  suspense), Kurosawa (blocking/bevegelse), Fincher (camera motivation),
  Villeneuve (skala/negativt rom), Miller (action-geografi), Leone
  (shot-size-progresjon), Kubrick (perspektiv/geometri); Rembrandt/
  Caravaggio/Hopper/Vermeer for lys, isolasjon og crops.
- **Akademi-kobling**: master-curriculumet (20% tegning/perspektiv, 20%
  regi, 15% foto, 15% klipp, 10% blocking, 10% komposisjon, 5% production
  design, 5% stunt/VFX) som læringsspor i Role Room-akademiet — appen er
  øvingsflaten.

## Differensiatorer oppsummert

1. Manus → frames med shot-metadata ferdig utfylt
2. Full toveis-sync med The Role Room (vektor-strokes, ikke bilder)
3. Intensjonslaget: beat/POV/følelse/kamera/klipp/blocking per frame
4. Kontinuitets- og klippsjekker mot naboframes
5. Floorplan-blocking koblet til frames
6. Visual Arc-panel per sekvens
7. Regissør-kommentarer og godkjenningsflyt på frame-nivå
8. Animatic med produksjons-timing
9. Offline på sett

## Arkitektur

- **Egen Metal-motor** (ikke PencilKit): instanced dab-rendering på GPU med
  samme stamp-semantikk som web-motoren (`stampEngine.ts`) — spacing i % av
  penselstørrelse, scatter, tilt-rotasjon, trykk→størrelse/alpha, canvas-låst
  papirtann, seedet randomisering per strøk.
- **Datamodell-paritet:** `PencilStroke`-JSON identisk med web. Compat-frames
  krever strokes som JSON-STRENG i `drawingData` (parseStoredStrokes).
- **Input:** coalesced + predicted touches, force/altitude/azimuth →
  pressure/tilt (PointerEvent-grader).
- **Sync:** Role Room-API (ASWebAuthenticationSession-mønsteret fra
  LeadMapApp). Konfliktstrategi v1 = siste skriving vinner + versjonslogg.

## Faser

| Fase | Innhold | Milepæl |
|------|---------|---------|
| 1 ✅ | Metal-motor: canvas, dabs, Pencil-input m/ predicted touches, undo, PencilStroke-paritet | Levert 2026-08-20 (commit 08e0e9d64) |
| 2 | Sync: auth, prosjektvelger, scene/frame-liste fra manus, strokes opp/ned | Tegning på iPad synlig i web-editoren |
| 3 | Palett-paritet: alle pensler, smudge, piksel-viskelær, lag, StreamLine, eksport + **filmstripe med før/etter-frames** | Side-om-side-paritet med web |
| 4 | **Intensjonslaget**: beat/følelse-felter, DP-metadata m/ linseguider, klippsjekker (180°/eyeline/size progression), floorplan-blocking | Frame bærer hvorfor, ikke bare hva |
| 5 | Produksjonsflaten: regissør-kommentarer, referansepanel, animatic, Visual Arc, versjoner/godkjenning | Full visjon |
| 6 | TestFlight + pilot på ekte produksjon (TROLL-demoen som testseng) | Ekstern artist designer en scene |

## Bygg

XcodeGen (som LeadMapApp): `xcodegen generate` etter nye filer — pbxproj er
gitignored. Sim-bygg: `xcodebuild -project StoryboardStudio.xcodeproj -scheme
StoryboardStudio -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)'
CODE_SIGNING_ALLOWED=NO build`.
