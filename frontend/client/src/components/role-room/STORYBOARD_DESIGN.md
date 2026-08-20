# The Role Room Storyboard — mål-design

Kilde: Daniels design-mockup 2026-08-20 (`~/Desktop/Storyboard_vision/The_Role
_Room_ Storyboard.png`, «Orion Protocol»-demo). Dette dokumentet er den
autoritative spesifikasjonen for storyboard-modulen (web først; iPad-appen
StoryboardStudio følger samme IA — se ipad/StoryboardStudio/VISION.md).

## Design-tokens

**VIKTIG (Daniel 20/8): IKKE mockupens oransje aksent — modulen skal føles
som The Role Room.** Brand fra `config/branding.ts` DEFAULT_COLORS:
- Primær/valgt/CTA: fiolett `#8b5cf6`; sekundær indigo `#6366f1`;
  aksent cyan `#00d4ff` (sparsomt); gradient fiolett→indigo
- Bakgrunn `#0a0a0f`; surface `#0d1117`; border `rgba(139,92,246,0.3)`
- Status: Done `#10b981` · In Review `#f59e0b` · Needs Work `#ef4444` ·
  Planned grå; Approve `#10b981` / Needs Work `#ef4444`
- Typografi: Poppins (headinger), Inter (brødtekst), JetBrains Mono (koder)
- Mockupenes LAYOUT og informasjonstetthet følges eksakt; kun aksentfargen
  byttes fra oransje til brand-fiolett
- Beat-tags (små caps-pills på frame-kort): ESTABLISHING / TENSION / BEAT /
  ACTION / DIALOGUE
- Tegninger: grafitt på varm papirtone; røde annotasjoner (piler, «PUSH IN»)
  er eget annotasjonslag, ikke del av tegningen
- Typografi: tett sans, caps-labels med letter-spacing på metadata

## Informasjonsarkitektur

Venstre nav (prosjekt-scope): Dashboard, Script, Sequences, Scenes, Shot
Lists, Boards, Animatics, Assets & References, Characters, Locations, Mood
Boards, Version History. Breadcrumb: Sequences > 03. The Heist > Scene 12.
Sekvens-tre med scener som barn.

## Flatene

### 1. Board View (kjernen)
Grid av frame-kort per scene. Kort = shot-kode (12A…), tegning, `SHOT TYPE ·
CAMERA MOVE` (WS · Static, OTS · Push In), aspect-badge (2.39:1),
én-linjes beskrivelse, beat-tag. Valgt kort får oransje ramme. Sort: Shot
Number. Topbar: scene-velger, aspect-ratio-gruppe (2.39:1/16:9/4:3/1:1),
samarbeids-avatarer, Review-knapp, Export.

### 2. Scene-timeline
Under grid: `SCENE 12 · 6 SHOTS · 00:18`, thumbnail-stripe med per-shot
varighet (2.0s/3.0s/…), dramaturgi-fase-segmenter under stripen:
SETUP → TENSION → ACTION → RESOLUTION (farget), + «Add Shot»-kort.

### 3. Shot-detaljpanel (høyre)
Valgt shot: Shot Type, Camera Move, Lens (24/28/35/85mm), Duration, Aspect
Ratio, Shot Size. Faner: SCRIPT / NOTES / TECH / CONTINUITY. Innhold:
Dialogue (rolle + replikk), Action, Continuity («Watch eyeline to Nash…»),
VFX, Production Notes. Alle felter redigerbare og synkes.

### 4b. Tegnegrensesnittet (mockup 2, «Neon City» — autoritativ for Drawing/Board)
Hovedfaner øverst: **Board / Script / Shot List / Animatic**. Venstre:
SCENES-panel (thumbnail, `01 EXT. CITY - NIGHT · 3 SHOTS`, valgt = blå
ramme). Midt: **vertikal board-strip** — én rad per shot: shot-kode-boks
(05A), ACTION/DIALOG-tekst, NOTES/DIAGRAM (småskisser), bred frame-tegning,
og metadata-kolonne (CAM/SHOT, LENS, SHOT SIZE-ikon, MOVEMENT-pil,
DURATION). Blå annotasjonspiler på tegningene = eget lag. Verktøyrad:
select/pensel/blyant/viskelær/shapes/tekst; sidetall; + ADD SHOT; transport
(undo/redo/hånd/zoom%/fit). Høyre: **INSPECTOR / COMMENTS** — Inspector:
CAMERA/SHOT, LENS, SHOT SIZE som 5 ikon-knapper, MOVEMENT som pil-ikoner,
DURATION, **TRANSITION (Cut/…)**, **FOCUS/DEPTH (Shallow/Deep)**,
TIME/TIME OF DAY, **WEATHER**, NOTES, **TAGS** (chips: DRIVER/MIRROR/
TENSION), fargeetiketter. Bunn: Brushes-panel (thumbnails, Size/Opacity/
Smoothing + strøkpreview), **Layers-panel med semantiske lag: Notes /
Dialog / Drawing / Camera / Arrows** (øye + lås per lag, blendmode,
opacity), **Navigator** (minimap m/ viewport, zoom-%).
Lys canvas-flate, mørk chrome. Mockup 1 = konteksten (planlegging/review);
mockup 2 = der man tegner.

### 4. Drawing Mode (fullskjerm)
Verktøyskinne venstre: Brush, Eraser, Shapes, Text, Arrow, Frame, Camera,
Note, Stamp, Fill, Select, Hand. Topp: penselkurve-preview, Size, Opacity,
Flow, Smoothing, Stabilize. Høyre panel: POSES (posebibliotek-grid, Human-
kategori) / REFERENCES + 3D MANIKIN med «Add to Canvas». Bunn: Onion
Skin-slider, transport, «1 of 6». Røde annotasjoner (pil/tekst) = eget lag.

### 5. Review Mode
Stor frame + metadata + dialog; vertikal filmstripe (alle shots i scenen);
NOTES / COMMENTS-faner — kommentarer med ROLLE (Director/DP/Producer),
relativ tid; STATUS-pill (In Review); Approve (grønn) / Needs Work (rød).

### 6. Shot List (Shot Planning)
Faner: Shot Planning / Shot List / Continuity / Stripboard. Tabell: SHOT,
BOARD (thumb), SHOT TYPE, CAMERA MOVE, LENS, DURATION, LOCATION, TIME,
STATUS (Done/In Review/Planned). Footer: antall, Total Duration, legend,
«Sync to Shot List». Filter + søk + Export Shot List.

### 7. Versions
v-nummererte versjoner med tidsstempel, forfatter og endringsbeskrivelse
(«Adjusted timing on 12B…»), thumbnail, «Compare Versions».

## Datamodell-utvidelser (frame/scene)

```
frame: {
  shotCode: '12B',
  shotType: 'WS'|'MS'|'CU'|'OTS'|'POV'|'INSERT'|…,
  cameraMove: 'Static'|'Push In'|'Pan Right'|'Handheld'|'Dolly'|…,
  lensMm: 24|28|35|50|85,
  shotSize: 'Over the Shoulder'|…,
  durationSec: 3.0,
  aspectRatio: '2.39:1',
  beatTag: 'ESTABLISHING'|'TENSION'|'BEAT'|'ACTION'|'DIALOGUE',
  location: 'Vault Interior', timeOfDay: 'Night',
  status: 'planned'|'in_review'|'done'|'needs_work',
  dialogue: [{character, line}], action, continuityNotes, vfxNotes,
  productionNotes,
  transition: 'Cut'|'Dissolve'|'Wipe'|'Match Cut'|'Smash Cut',
  focusDepth: 'Shallow'|'Deep',
  weather: 'Rain'|'Snow'|'Clear'|…, tags: ['DRIVER','MIRROR','TENSION'],
  colorLabel: '#…',
  annotations: [{type:'arrow'|'text', color:'#d33', …}]  // eget lag
}
// Semantiske tegnelag per frame: notes / dialog / drawing / camera / arrows
scene: { dramaturgyPhases: [{label:'SETUP', fromShot:'12A', toShot:'12A'}, …] }
comments: [{frameId, role:'Director'|'DP'|'Producer'|…, author, text, at}]
versions: [{v, author, at, summary, thumbnail}]
```

## Byggerekkefølge (web)

| Bølge | Innhold |
|-------|---------|
| A | Board View-kort + beat-tags + shot-metadata-panel (type/move/lens/duration/size) + scene-timeline m/ faser |
| B | Shot List-tabell m/ status + total varighet + sync; sekvens-tre |
| C | Review Mode: kommentarer m/ rolle, Approve/Needs Work, status-flyt |
| D | Drawing Mode-oppgradering: annotasjonslag (pil/tekst i rødt), posebibliotek + onion skin montert, Stabilize-slider (StreamLine-UI) |
| E | Versions-panel m/ compare; Animatics-kobling |

Prinsipper fra VISION.md gjelder: «hva skal publikum føle akkurat nå?» før
strek; Clarity > Art; klippsjekker (180°/eyeline/size progression) som
forslag, ikke politi.
