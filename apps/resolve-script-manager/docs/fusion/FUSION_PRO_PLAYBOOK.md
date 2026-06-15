# Fusion Pro Playbook — produksjonsklar bruk av DaVinci Resolve Fusion

Skrevet som en VFX-supervisor/motion-designer-referanse for Post Agent + Daniels
egen produksjon (produktvideo, app-demo, bryllup, kommersielt, social, brand).
Forankret i ekte Fusion-workflow **og** i scripting-realiteter verifisert mot
DaVinci Resolve **21** i denne kodebasen (se «Scripting-realiteter» — de er gull
og finnes ikke i vanlige tutorials).

> Kjerne-filosofi: **Effekten skal aldri merkes som en effekt.** Den skal styre
> blikket, støtte budskapet og få produktet/øyeblikket til å føles dyrere. Hvis
> seeren tenker «åh, en effekt» har du tapt. Mindre, men presist > mer.

---

## A. Hva Fusion er best til (strategisk)

Fusion er en **node-basert compositor** (som Nuke), ikke et lag-basert verktøy.
Det betyr at den er overlegen til:

- **Motion graphics som må være konsistente og gjenbrukbare** (lower thirds,
  callouts, titler, infographics) — fordi en node-graf kan pakkes til en macro
  med publiserte kontroller.
- **Compositing**: legge UI/skjerm inn i device-mockups, bytte bakgrunn, lys/
  skygge/refleksjon, få flere elementer til å se ut som én scene.
- **Data-drevet grafikk**: tellere, grafer, prosent-ringer — der presisjon og
  animasjon er matematisk (her er prosedyre-generering faktisk proff).
- **Tracking + screen replacement**: feste grafikk/skjerm til bevegelse.
- **3D-rom**: 3D-tekst, kamera-flythrough, parallax, partikler.

**Hva Fusion IKKE bør brukes til:** rask klipping, fargegrading (bruk Color-
siden), enkel tekst som Edit-sidens titler dekker, eller å «redde» et dårlig
opptak. Og: ikke prøv å håndlage Motion-Array-kvalitet node-for-node under
tidspress — kjøp/lag en macro én gang, gjenbruk for alltid.

---

## B. De viktigste ferdighetene å mestre (i rekkefølge)

1. **Merge-noden** — alt compositing er Merge (Background/Foreground/EffectMask).
   Skjønner du Merge + alpha, skjønner du Fusion.
2. **Masker** (Rectangle/Ellipse/Polygon/BSpline) + `EffectMask`-inngangen.
3. **Transform / DVE** + keyframes + **spline-easing** (the difference between
   amatør og proff er nesten utelukkende easing).
4. **Text+** (typografi, shading, follower/WriteOn).
5. **Tracker / Planar Tracker** (screen replacement, feste grafikk).
6. **Delta Keyer** (green screen).
7. **Expressions** (data-drevet: tellere, koblet animasjon).
8. **Macros + publiserte kontroller** (gjenbruk = hele poenget).
9. **Scripting (Lua/Python)** for å bygge/fylle automatisk.

---

## C. Beste profesjonelle workflows

- **Bygg én gang, gjenbruk alltid.** Hver effekt du lager mer enn to ganger →
  gjør den til en macro med publiserte kontroller (tekst, farge, varighet).
- **Skjerm-rom vs. media-rom (kritisk for kamera + overlays):** Hvis et
  «kamera» (Transform) zoomer/panorerer media, må element-forankrede effekter
  (highlight rundt en knapp) ligge **FØR** kameraet i grafen, så de følger
  elementet. Skjerm-fast UI (lower third, logo, vignett) ligger **ETTER**
  kameraet. Dette ene grepet skiller proff fra rotete.
- **Grade til slutt, lett.** En diskret BrightnessContrast (kontrast +metning) +
  myk vignett løfter alt. Ikke overdriv.
- **Timing er alt:** 0.3–0.6 s inn-animasjoner, ease-in-out, aldri lineært.
- **Hold grafen ren:** navngi noder, bruk Underlay/Group, venstre→høyre flyt.

---

## D. Node-tre-prinsipper

- Flyt **venstre → høyre**, MediaIn/Loader til venstre, MediaOut til høyre.
- **Merge-stacking** nedover: bakerst nederst, fremst øverst.
- **Anchored-før-kamera, skjerm-etter-kamera** (se over).
- **Behandle media i media-rom** (grade/blur på selve bildet), **UI i skjerm-rom**.
- Bruk **Instances** for delte parametre, **Macros** for gjenbruk.
- En typisk produktdemo-scene (slik Post Agent bygger den):
  ```
  MediaIn → [anchored fx: spotlight/glow/callout] → Transform(kamera)
          → BrightnessContrast(grade) → Merge(lower third)
          → Merge(infographic/card) → Vignette → Blur(overgang) → MediaOut
  ```

---

## E. Effekt-bibliotek (praktiske oppskrifter)

Format per oppskrift: **hva · hvorfor · noder · timing · easing · regler · feil**.

### 1. CTA-highlight på nettside/skjermopptak
- **Hva:** dim alt unntatt knappen, myk glød-ring, liten cursor som klikker.
- **Noder:** `Background`(svart) + `RectangleMask`(rundt knapp, **Invert=1**,
  SoftEdge) som EffectMask → Merge over media. Glød: `RectangleMask`(omriss,
  Solid=0, BorderWidth) → `Background`(accent) → `Glow` → Merge.
- **Timing:** dim inn 0.4 s til ~55 %, glød pulserer subtilt (8→20→8 over scenen).
- **Easing:** ease-in-out. **Regel:** kun ÉN ting fremheves om gangen.
- **Feil å unngå:** for mørk dimming (>65 %), hard maskekant, neon-glød.

### 2. Smooth zoom/fokus på produktfunksjon (virtuelt kamera)
- **Noder:** `Transform` (Size + Center animert mot fokuspunktet).
- **Timing:** 1.0→1.2 Size over HELE klippet. **Easing:** to keyframes +
  auto-smooth = ren ease-in-out (mer synlig + roligere enn front-lastet).
- **Regel:** klem senteret så du aldri viser kant: maks-offset = (1−1/Size)/2.

### 3. Rene lower thirds
- **Noder:** `Text+`(navn, Bold) + `Text+`(tittel, Medium) +
  `Background`+`RectangleMask`(tynn accent-strek) + `Transform`(slide+fade).
- **Timing:** strek «wiper» inn 0.45 s, tekst slider opp + fader 0.5 s.
- **Regel:** venstrejustert, brand-font, IKKE grå sentrert «pille» (amatør-tell).

### 4. Animert infographic-stat (teller opp)
- **Noder:** `Text+` med **expression** på StyledText som teller 0→verdi +
  `Text+`(label) + valgfritt `Background`+`RectangleMask`(kort) + pop-in Transform.
- **Expression (verifisert):** `tostring(math.floor(math.min(1,time/SPAN)*VALUE))`
- **Timing:** tell over 0.9 s, pop-in 0.4 s. **Regel:** ett tall = ett poeng.

### 5. Søylediagram / sammenligning
- **Noder:** per søyle `Background`(accent) + `RectangleMask` med **Height 0→h**
  OG **Center.y opp** samtidig (så bunnen står fast) + verdi/kategori-`Text+`.
- **Timing:** søyler vokser 0.7 s, gjerne 0.05 s forskjøvet (stagger).

### 6. Device-mockup / screen replacement
- **Statisk mockup (flat):** `Transform`(skaler skjermbildet inn i et kort) +
  `RectangleMask`(avrundede hjørner) + hvitt kort-`Background` + `Blur`-skygge +
  3 `EllipseMask`-prikker (nettleser-chrome) på branded bakgrunn.
- **Ekte enhet i opptak (telefon i hånd):** `Planar Tracker` på skjermen →
  `Corner Positioner` for å feste skjerm-innholdet → grade for å matche lys.
- **Regel:** match perspektiv + refleksjon, ellers ser det limt på ut.

### 7. Light sweep over logo/tekst
- **Noder:** `Background`(hvit) + `RectangleMask`(tynn, rotert ~22°) + `Glow` →
  `Transform`(Center −0.3→1.3 over 0.5 s). **Regel:** bruk én gang, kort.

### 8. Cinematic title / 3D-tekst-reveal
- **2.5D:** `Text+` + `Transform`(scale 1.06→1.0 + fade) + svak `Blur` 6→0.
- **Ekte 3D:** `Text3D` → `Merge3D` (+ `SpotLight`, `Camera3D`) → `Renderer3D`.
  Kamera-dolly inn. **Regel:** subtil dybde > spinnende 3D.

### 9. Before/after (produkt/grade)
- **Noder:** to MediaIn → Merge med animert `RectangleMask`(skille-linje) som
  sveiper. Legg en tynn accent-linje + «Før/Etter»-Text+.

### 10. Cinematic overganger
- Ekte cross-dissolve mellom klipp finnes IKKE i scripting (se realiteter).
  Innen-klipp: `Blur` inn/ut ved grensene (whip-følelse), eller dip-to-color.
- Whip-pan: `Transform` rask pan + `Directional Blur` på toppene.

### 11. Bryllup: elegant intro + minne/glød-overgang
- **Glød-minne:** `Glow`(høy Threshold, lav Gain) + varm grade + lett
  `VariBlur` på kantene → drømmeaktig. **Light leaks:** additiv `Merge` av
  et varmt `Background`-gradient, lav opacity, drift sakte.
- **Regel:** varmt, mykt, lavt tempo. Aldri «tech»-glød i bryllup.

### 12. HUD / app-interface-grafikk
- `Rectangle`/`sCircle`-omriss + `Glow` + tynn font + subtil `Pulse` via
  expression. Hold det monokromt + accent.

---

## F. Scripting-realiteter (VERIFISERT mot Resolve 21 — les dette nøye)

Dette er det dyrekjøpte. Vanlige guider tar feil her.

- **Animasjon settes IKKE med `SetInput(name, value, frame)`** — det setter bare
  en statisk verdi. Riktig: koble en spline til inputen og bruk `SetKeyFrames`:
  - Scalar: `sp = comp.BezierSpline(); tool.Size = sp; sp.SetKeyFrames({0:1.0, 90:1.2})`
  - Punkt/Center: `xp = comp.XYPath({}); tool.Center = xp; xp.X = comp.BezierSpline(); xp.Y = comp.BezierSpline(); xp.X.SetKeyFrames({...}); xp.Y.SetKeyFrames({...})`
  - `SetKeyFrames` gir **automatisk myke bezier-håndtak** = gratis ease-in-out.
- **`GetInput(name)` leser IKKE gjennom modifiers/spliner** (gir base-verdi/None).
  Verifiser med `GetInput(name, time)`, `input.GetConnectedOutput()`, eller
  `spline.GetKeyFrames()`. IKKE stol på `GetInput(name)` alene.
- **`comp.Lock()/Unlock()` rundt byggingen ØDELEGGER render-animasjonen** —
  keyframene registreres ikke for Edit/Deliver (vises kun på Fusion-siden).
  Bygg UTEN lås.
- **Maske-verktøy heter `RectangleMask`/`EllipseMask`** (ikke `Rectangle`/`Ellipse`).
- **`Background` er en generator uten bilde-input → `Blend` er no-op.** Bruk
  `TopLeftAlpha` for å fade en Background. `Blend` virker kun på noder med input
  (Transform/Merge/Glow).
- **Tall-teller:** `text.StyledText.SetExpression('tostring(math.floor(...))')` —
  `time` = comp-lokal frame (0-basert for et klipp).
- **Render-cache lyver:** re-render gir byte-identiske filer hvis Resolve mener
  ingenting endret seg → falske negativer. Bruk nytt timeline-/CustomName per test.
- **Bilde-sekvens-felle:** numererte filer (`scene_0.png`, `scene_1.png`)
  importeres som ÉN sekvens. Importer hver fil individuelt.
- **Ingen public transition-API** for cross-dissolve mellom klipp — løs innen-klipp.
- **Verifiser ALLTID ved å RENDRE + se på pikslene**, ikke bare node-introspeksjon.
- **Python-versjon:** `fusionscript.so` krever Python ≤ ~3.12 (3.14 er for nytt).

### Minimal automatiserings-mal (Python, faktisk fungerende)
```python
comp = timelineItem.AddFusionComp()              # ikke Lock/Unlock
mi = comp.GetToolList(False, "MediaIn")[1]
mo = comp.GetToolList(False, "MediaOut")[1]
tr = comp.AddTool("Transform", -32768, -32768)
tr.ConnectInput("Input", mi)
sp = comp.BezierSpline(); tr.Size = sp; sp.SetKeyFrames({0: 1.0, 120: 1.18})
mo.ConnectInput("Input", tr)
# render for å verifisere (cache: bruk unikt navn)
```

---

## G. Template/macro-strategi

1. Bygg effekten rent i Fusion-GUI én gang (perfekt easing/design).
2. Velg nodene → høyreklikk → **Macro → Create Macro** → publiser kun de
   kontrollene en bruker skal endre (tekst, farge, varighet, fokus).
3. Lagre som `.setting` i `…/Fusion/Templates/Edit/Titles|Generators|Transitions/`
   → dukker opp i Effects Library, og kan settes inn via scripting med
   `InsertFusionTitleIntoTimeline(name)` / `InsertFusionGeneratorIntoTimeline`.
4. Fyll publiserte kontroller via script → **template-kvalitet, automatisk**.
5. For Motion-Array-nivå: kjøp `.drfx`, installer, og driv dem via samme API —
   da ER det MA-kvalitet (du eier asset-et).

**Hybrid (Post Agents vei):** prosedyre der det er sterkt (infographics,
mockups, kamera) + macro-import der det krever motion-design.

---

## H. Anbefalt læringssti

1. Merge + alpha + masker. 2. Transform + spline-editor (ease). 3. Text+.
4. Macro + publiserte kontroller. 5. Tracker/Planar. 6. Delta Keyer.
7. Expressions. 8. 3D (Merge3D/Camera3D/Renderer3D). 9. Scripting.

---

## I. Feil å unngå (amatør-tell)

- Cookie-bannere/rot i skjermopptaket (rens FØR capture).
- Full-skjerm skjermbilde uten ramme → ser ut som opptak (bruk mockup-kort).
- Grå sentrert caption-pille (bruk venstrejustert lower third).
- Lineær animasjon, for rask/for mye, alt animerer samtidig.
- Neon-glød, slagskygger med hard kant, for mørk dimming.
- Default-font (Open Sans). Bruk brand-font.
- Flere fokuspunkter samtidig → seeren vet ikke hvor de skal se.
- Konkurrerende tekst (overlay som gjentar sidens egen overskrift).

---

## J. Handlingsplan (slik Post Agent + du bør jobbe)

1. **Capture rent** (lukk cookies, skjul sticky, 2× retina, rolige seksjoner).
2. **Mockup-ramme** rundt skjerm → umiddelbart «proff».
3. **Ett fokus per scene**, rolig kamera mot det.
4. **Infographics for tall** (teller/grafer) — der data fortjener oppmerksomhet.
5. **Rene lower thirds** i brand-font for budskap.
6. **Lett grade + vignett**, myke overganger.
7. **Voiceover/manus** når det skal forklare (størst løft for demo).
8. **Macro-bibliotek**: bygg favoritt-effektene én gang, gjenbruk + auto-fyll.
9. **Verifiser ved å rendre**, ikke ved å se på node-grafen.

Bunnlinje: bruk Fusion til å *styre blikk og heve verdi* — ikke til å vise frem
effekter. Det dyre ser alltid enkelt ut.
