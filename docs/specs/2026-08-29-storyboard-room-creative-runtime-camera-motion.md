# Storyboard Room: kreativ runtime og kamerabevegelse

**Status:** Fase 0 og kanoniske fase 1-modeller implementert og verifisert;
videre runtime/UI leveres inkrementelt
**Dato:** 2026-08-29
**Omfang:** Native iPad-app, delt storyboardkontrakt, animatic/export og AI-video
**Beslutningsnivå:** Klar for inkrementell implementasjon når fase 0-portene er lukket

## 1. Konklusjon

Storyboard Room bør utvikles videre som en deterministisk, produksjonsbevisst
kreativ runtime. Vi skal ikke skrive om appen til en kopi av Procreate Dreams,
og vi skal ikke starte med en generell animasjonsmotor, full scene graph,
virtual texturing eller en stor global timeline.

Første produksjonsvertikal skal være:

~~~text
ShotFraming ved t=0 + CameraMotionTrack
                    ↓
       FrameEvaluator(document, time)
                    ↓
            RenderSnapshot
       ┌────────────┼─────────────┐
       ↓            ↓             ↓
 Live Metal     Thumbnail    Animatic/export
                                  ↓
                    Structured MotionIntent
                                  ↓
                       Provider adapter
                                  ↓
                       Reviewed AI video
~~~

Det gir brukeren en synlig og redigerbar kamerabane i Storyboard Room, samme
utsnitt i live-visning og eksport, én samlet undo-handling og et strukturert
grunnlag som flere video-leverandører kan konsumere.

En lokal kamerabane over et flatt storyboard er en 2D-bevegelse: pan, zoom,
roll og crop. Ekte fly-through med ny geometri, parallakse og korrekt
okklusjon krever enten en multiplan-/dybderepresentasjon eller generativ video.
Disse nivåene skal ikke fremstilles som samme funksjon.

Den opprinnelige betalte-submit-risikoen er nå lukket: Higgsfields offisielle
retry-dokumentasjon sier at generasjons-POST ikke har idempotency-støtte, og
backend sender derfor aldri automatisk samme tvetydige POST på nytt. En lokal
prepared/submitting-tilstand, eksplisitt submission_unknown, recovery-grace,
provider-handle-CAS og worker-leaser hindrer doble betalte provider-jobber.
Webhooken er bare et wake-signal; terminal state bekreftes med autentisert GET.
Billing/refund og arkivering er egne varige køer, slik at et prosesskrasj etter
provider-resultatet ikke mister økonomisk settlement eller videofilen.

## 2. Hva dokumentet beslutter

Dette dokumentet er den tekniske kontrakten for første fase. Det beslutter:

- hvilken del av den eksisterende appen som skal gjenbrukes;
- den kanoniske tids- og kameramodellen;
- hvordan samme dokument evalueres for live, thumbnail og eksport;
- hva lokal 2D-bevegelse kan love og hva generativ fly-through kan love;
- hvordan endringer inngår i undo, offline WAL og samtidighetskontroll;
- hvordan AI-providerne isoleres bak kapabilitetsstyrte adaptere;
- hvilke sikkerhets-, kostnads- og observability-porter som kreves;
- hvilke tester og målinger som må bestås før utrulling.

Dokumentet beslutter ikke å bygge hele den langsiktige kreative runtime-en nå.
Det definerer en vei som gjør en senere utvidelse mulig uten å gjøre dagens
vertikal avhengig av uprøvde abstraheringer.

## 3. Produktmål

### 3.1 Primært mål

En bruker skal kunne åpne et shot, velge **Kamerabane**, definere eller utføre
en kamerabevegelse, spille den av lokalt, angre den, arbeide offline,
eksportere den i animatic og eventuelt sende den samme intensjonen til en
kompatibel AI-video-provider.

### 3.2 Kvalitetsmål

- Bevegelsen skal føles direkte på iPad og aldri svekke Pencil-input.
- Første og siste bilde skal være eksplisitte og redigerbare.
- Preview og eksport skal bruke samme evaluator og gi samme komposisjon.
- Gammelt innhold uten kamerabane skal rendres identisk med før.
- En kamerabane skal ikke endre originale strokes eller bake crop i bildet.
- Alle betalte genereringer skal ha prisbekreftelse og eksakt kildebinding.
- Usikre provider-submissions skal aldri automatisk skape en ny betalt jobb.
- AI-resultatet skal være en separat versjon som brukeren vurderer og godkjenner.

### 3.3 Ikke-mål i første leveranse

- full Dreams-lignende flerspors timeline;
- generell animasjon av vilkårlige node-properties;
- full ECS, generell render-graph-DAG eller plugin-runtime;
- uendelig canvas eller generell virtual-texture-motor;
- frame-by-frame character animation;
- automatisk oppdeling av alle tegninger til perfekte dybdeplan;
- garantert fysisk korrekt 3D-kamera fra ett flatt bilde;
- CRDT eller full event sourcing;
- mange nye Swift packages før grensene er bevist i samme app-target.

## 4. Verifisert nåsituasjon i repoet

Kartleggingen ble gjort mot den faktiske arbeidskopien 2026-08-29. Det finnes
mange pågående endringer i worktree; denne spesifikasjonen forutsetter at de
bevares, og foreslår ingen destruktiv migrering.

### 4.1 Plattform og prosjekt

| Område | Verifisert tilstand | Konsekvens |
|---|---|---|
| Plattform | iPad-only, minimum iOS/iPadOS 17 | Vi kan bruke moderne Swift concurrency og Pencil-API-er, men ikke APIs som bare finnes fra iOS 26/27 |
| Språk | Swift 6 med strict concurrency complete | Nye rene modeller bør være Sendable; muterbar UI-state må ha tydelig actor-eierskap |
| Tegneflate | Egen UIView over CAMetalLayer | Behold løsningen; den er en gyldig Apple-arkitektur for kontrollert Metal-presentasjon |
| GPU | Metal er påkrevd capability | Lokal kamera-preview skal bygges på eksisterende Metal-sti |
| Prosjektstruktur | Ett app-target pluss unit- og UI-test-targets | Første ekstraksjon kan skje som filer og protokoller i samme target |

Lokalt verifisert verktøykjede:

- Xcode 26.6, build 17F113
- Swift 6.3.3
- iPhoneOS SDK 26.5
- deployment target i prosjektet: iOS 17.0

### 4.2 Eksisterende komponenter vi skal beholde

| Komponent | Fil | Hva som allerede er nyttig |
|---|---|---|
| Statisk kamera/framing | ipad/StoryboardStudio/StoryboardStudio/Model/ShotFraming.swift | Normalisering, koordinatmapping, aspect-fill, fokus og kvalitetsvalidering |
| Dokumentcheckpoint | ipad/StoryboardStudio/StoryboardStudio/Model/StoryboardDocument.swift | Strokes, lag, framing, historikk og atomisk lokal lagring |
| Pencil-input | ipad/StoryboardStudio/StoryboardStudio/Canvas/PencilCanvasView.swift | Coalesced actual samples, transient predicted touches og CanvasState |
| Metal-rendering | ipad/StoryboardStudio/StoryboardStudio/Engine/MetalStrokeRenderer.swift | Redigerbart basebilde, strokes og ikke-destruktiv framing ved presentasjon |
| Board/Inspector | ipad/StoryboardStudio/StoryboardStudio/Board/NativeBoardView.swift | Shot UI, autosave/WAL, AI-flyt, animatic og eksport |
| Alternativ frame-editor | ipad/StoryboardStudio/StoryboardStudio/Sync/ProjectBrowserView.swift | Aktiv inngang som også må bevare nye dokumentfelt |
| Native sync | ipad/StoryboardStudio/StoryboardStudio/Sync/RoleRoomAPIClient.swift | Scene/frame-kontrakt, cache, autentisering og offline-støtte |
| Prompt Engine | backend/server/storyboard-prompt-engine/ | Produksjonskontekst og modellspesifikke adaptere |
| AI-video | backend/server/storyboard-ai-video-service.ts | Preflight, pris, kilde-CAS, versjoner, polling og adoption |
| Providerklient | backend/server/generative-media.ts | Higgsfield estimate/submit/poll og hemmeligheter kun på server |

### 4.3 Faktiske gap

1. FrameSummary.movement er en tekststreng. Den påvirker prompten, men er ikke
   en tidsavhengig kamerabane.
2. ShotFramingState er ett statisk utsnitt. Det finnes ingen keyframes eller
   evaluator med et tidspunkt.
3. effectiveFrameForRendering returnerer én avledet statisk frame.
4. Animatic-eksporten renderer ett UIImage per shot og holder samme
   pixel-buffer gjennom hele varigheten. Bare overganger endrer bildet.
5. Thumbnail, live canvas og eksport har ikke én eksplisitt RenderSnapshot-
   kontrakt.
6. CanvasState muteres direkte og bruker fulle dokument-snapshots til undo.
   Det finnes ingen avgrenset command-transaksjon for en utført kamerabane.
7. NativeBoardView er over 10 000 linjer og eier UI, lagring, AI og eksport.
   Ny tidslogikk må trekkes ut av denne filen.
8. Higgsfield-adapteren sender prompt, image_url og enhance_prompt=false til
   en hardkodet Turbo-sti. Modellargumentet styrer ikke tier.
9. Adapteren sender ikke providerens strukturerte motions, seed eller end frame.
10. Appens 4–15 sekunders varighetsvalg sendes ikke til Higgsfield DoP og kan
    derfor ikke presenteres som providerens faktiske klipplengde.
11. Dagens AI-kildebinding dekker framing og paintover-stadier godt, men har
    ingen motion-fingerprint.
12. Det finnes gode framing-, render-, offline- og AI-integritetstester, men
    ingen tester for tidsevaluering, live/export-paritet over tid eller
    kamerabane-konflikter.
13. Det finnes ingen systematisk OSSignposter-/MetricKit-instrumentering for
    Pencil-latens, playback, export frame eller minnepress.

## 5. Arkitekturprinsipper

### 5.1 Hovedinvariant

For et kanonisk dokument D og kanonisk tid t skal systemet produsere samme
semantiske render-snapshot:

~~~swift
func evaluate(
    document: FrameDocument,
    at time: MediaTime
) throws -> FrameRenderSnapshot
~~~

Dette betyr:

- ingen lesing av veggklokke eller tilfeldig generator i evaluatoren;
- ingen avhengighet til valgt panel, zoom i editoren eller aktiv gesture;
- keyframes normaliseres i en bestemt rekkefølge;
- ikke-finite og ugyldige verdier avvises eller repareres deterministisk;
- alle avledede fingerprints bygges fra kanonisk serialisering;
- evaluatorens resultat er Foundation-/SIMD-data, ikke SwiftUI Views,
  CAMetalDrawable eller AVAssetWriter.

GPU-piksler kan avvike svakt mellom OS- og GPU-familier. Derfor er
determinismeporten todelt:

1. eksakt hash av normalisert dokument og semantisk RenderSnapshot;
2. toleransebaserte golden-image-tester på en pinnet simulator/device,
   oppløsning og fargerom.

Vi skal ikke kreve identisk rå GPU-bytehash på tvers av alle Apple-GPU-er.

### 5.2 En sannhet, flere konsumere

Live preview, scrub, thumbnail og export skal ikke implementere hver sin
interpolasjon. De bruker samme evaluator.

Provider-prompten bruker den samme normaliserte motion-planen, men providerens
video er ikke en deterministisk render av snapshotet. Den er et versjonert,
reviewbart AI-resultat med egen provenance.

### 5.3 Dokument og editor er separat state

Persistér:

- kamerakeyframes;
- shotDuration som rasjonell tid;
- projectFrameRate som rasjonell prosjektverdi;
- aspect ratio;
- produksjonsintensjon;
- AI-kildebindinger og versjoner.

Ikke persistér som produksjonsdata:

- hvilket inspector-panel som er åpent;
- timeline-scroll og editor-zoom;
- transient predicted touches;
- midlertidige Perform-samples før brukeren fullfører handlingen;
- aktiv selection eller hover-state.

### 5.4 Plattformnøytral persistens

CMTime brukes ved Apple media- og avspillingsgrenser, men serveren og web skal
ikke lagre en Apple-type. Persistér rasjonell tid som heltall:

~~~json
{
  "value": 48,
  "timescale": 24
}
~~~

Kanonisk verdi er value/timescale. Double brukes bare i UI, ikke som
autoritativ tid i dokumentet eller fingerprinten.

Timing lagres i manuskriptets/prosjektets storyboard-root:

~~~json
{
  "storyboardTiming": {
    "version": 1,
    "projectFrameRate": { "value": 25, "timescale": 1 },
    "timelineTimescale": 600
  }
}
~~~

Legacy-prosjekter uten feltet får deterministisk 25/1 som server-default; dette
skrives ved første timing-mutasjon og avledes aldri fra device eller locale.
Ny shot-wire bruker shotDuration: MediaTime og server-eid durationRevision.
Eksisterende duration/durationSec er en avledet kompatibilitetsprojeksjon.

Normativ write-policy:

- dedikert ny PATCH sender shotDuration, expectedDurationRevision og den
  avledede legacy-verdien; serveren oppdaterer dem atomisk;
- begge verdier i samme request må være like etter normalisering, ellers 409
  duration_mismatch;
- legacy Double normaliseres til nærmeste 1/600 sekund med eksplisitt
  half-away-from-zero-regel; ikke-finite/utenfor bounds avvises;
- hvis shotDuration ennå mangler, kan en legacy-only write initialisere den og
  durationRevision=1;
- når shotDuration finnes, er en identisk legacy-only write en no-op, mens en
  endret legacy-only write uten expectedDurationRevision får 409
  client_upgrade_required og kan aldri klobbe canonical tid;
- nye klienter dual-reader/dual-writer under rollout; fingerprints, OCC og
  export bruker bare normalisert shotDuration.

### 5.5 Inkrementell modularisering

Vi skal først etablere fire grenser i dagens target:

- FrameEvaluator: ren tid-til-snapshot-logikk;
- FrameRenderSession: én stabil renderkilde per shot;
- FrameRenderCoordinator: felles live/offscreen/export-inngang;
- CameraMotionEditorModel: command, Perform, undo og persistens.

AI-orkestreringen kan deretter flyttes til StoryboardAIWorkflowCoordinator.
Swift packages opprettes først når grensene er stabile, testene viser lav
kobling og build-tidsmålinger forsvarer det.

## 6. Kanonisk domenemodell

### 6.1 Produksjonshierarki

Dagens data er i praksis:

~~~text
Manuskript/prosjekt
└── ScriptScene
    └── FrameSummary
        └── storyboard-shot
~~~

FrameSummary fungerer produktmessig som et shot/panel. Vi skal ikke innføre
en ny Shot → Scene-retning som dupliserer og motsier denne sannheten.

Langsiktig hierarki:

~~~text
Production
└── Deliverable eller Episode
    └── Sequence
        └── ScriptScene
            └── Shot
                ├── FrameDocument
                ├── CameraMotionTrack
                ├── Audio/voiceover references
                └── Production metadata
~~~

Første fase endrer ikke serverens scene/frame-hierarki. Den legger en
versjonert cameraMotionTrack-egenskap på eksisterende shot/frame.

### 6.2 MediaTime

Foreslått persistensmodell:

~~~swift
struct MediaTime: Codable, Sendable, Hashable, Comparable {
    let value: Int64
    let timescale: Int32
}
~~~

Invarianter:

- timescale er større enn null;
- verdi er ikke negativ for shot-lokale tider;
- alle sammenligninger skjer rasjonelt, uten konvertering til Double;
- konvertering til prosjektets fps bruker en eksplisitt avrundingsregel;
- serialisering normaliserer felles faktorer slik at 48/24 og 2/1 ikke gir
  forskjellige fingerprints;
- eksport konverterer til CMTime ved AVFoundation-grensen.

For første integer-fps-leveranse kan prosjektet bruke en felles timeline
timescale på 600, som representerer 24/25/30/50/60 fps eksakt. Den lagrede
typen forblir likevel value/timescale, slik at 23.976/29.97 senere kan
representeres korrekt i stedet for som en skjult Double.

Prosjektets frame rate modelleres også rasjonelt, for eksempel 24000/1001.
CMTimeConvertScale-tester skal kontrollere hasBeenRounded; en uventet
avrunding er en kontraktfeil, ikke en skjult toleranse.

### 6.3 ShotFraming og CameraPose2D

Eksisterende ShotFramingState forblir den eneste autoritative kameraposen ved
t=0. CameraPose2D beskriver senere viewporttransformer:

~~~swift
struct CameraPose2D: Codable, Sendable, Equatable {
    var centerX: Double
    var centerY: Double
    var zoom: Double
    var rollDegrees: Double
    var focusAnchorX: Double?
    var focusAnchorY: Double?
}
~~~

Aspect ratio, shot-size-intensjon, fysisk angle og lensMm forblir shot-level
metadata i v1. Vi skal ikke interpolere en 35 mm til 85 mm linse som om det
automatisk var det samme som en digital zoom.

Regler:

- center er i normalisert kilderom;
- zoom følger samme min/maks som ShotFramingState;
- roll normaliseres til et kanonisk intervall;
- focus anchor er valgfritt og i normalisert kilderom;
- aspect ratio kan ikke endres inne i én v1-kamerabane;
- ingen keyframe kan inneholde NaN eller uendelig verdi.

### 6.4 CameraMotionTrack v1

Tracken dupliserer ikke t=0-posen eller shot-varigheten:

~~~json
{
  "version": 1,
  "enabled": true,
  "mode": "keyframed",
  "presetId": "push-in",
  "keyframes": [
    {
      "id": "cam-kf-b",
      "time": { "value": 96, "timescale": 24 },
      "pose": {
        "centerX": 0.52,
        "centerY": 0.43,
        "zoom": 1.32,
        "rollDegrees": -1.5
      },
      "easingFromPrevious": { "kind": "easeInOut" }
    }
  ]
}
~~~

Server-eide sidecars:

~~~json
{
  "cameraMotionRevision": 4,
  "cameraMotionUpdatedAt": "2026-08-29T18:00:00Z",
  "cameraMotionFingerprint": "sha256:…",
  "cameraMotionBaseFramingFingerprint": "sha256:…",
  "cameraMotionStatus": "valid"
}
~~~

cameraMotionStatus er valid, needsRebase eller invalid. Serveren oppdaterer
status, base-framing-fingerprint og motion revision atomisk med dagens
sourceRevision/sourceUpdatedAt når statisk framing endres. V1 beholder dermed
repoets eksisterende kontrakt der framing bumper source; den innfører ikke en
udefinert separat framingRevision. Dermed kan needsRebase beregnes etter en
senere statisk framing-endring uten å gjette ut fra dagens pose. Invalid track
bevares som et recoverable draft.

Tillatte modes i v1:

- keyframed: eksplisitte keyframes;
- performed: keyframes produsert av en brukerhandling, men evaluert identisk
  med keyframed.

Deaktivert eller manglende track betyr statisk framing.

Tillatte easing-typer i v1:

- linear;
- easeIn;
- easeOut;
- easeInOut;
- hold.

En begrenset liste er mer robust enn vilkårlige string-baserte kurver. En
cubicBezier-variant kan legges til i v2 når editor, validering og eksport har
paritet.

Invarianter:

- t=0 kommer alltid fra ShotFramingState;
- keyframe-ID-er er stabile og unike;
- keyframe-tid er større enn null og høyst shot-varigheten;
- maksimalt 64 keyframes og maksimalt 600 sekunder i v1;
- tider er strengt stigende etter normalisering;
- like tider avvises som konflikt, ikke sorteres tilfeldig;
- alle poses valideres med ShotFraming-reglene;
- fingerprint avledes server-side fra normalisert track og kanonisk
  shotDuration;
- keyframe-ID, presetId, revision og fingerprintfeltet selv er ikke del av
  render-fingerprint;
- movement-strengen er et kompatibilitetslabel, ikke source of truth.

### 6.5 Bakoverkompatibilitet

| Inndata | Evaluering |
|---|---|
| Ingen cameraMotionTrack | Bruk shotFraming gjennom hele shotet |
| Deaktivert track | Bruk shotFraming gjennom hele shotet |
| Track med keyframe ved t=0 | Migrator fjerner den hvis lik shotFraming; ellers marker needsRebase |
| Gammel klient sender scene uten track | Serveren bevarer eksisterende track |
| Gammel klient endrer shotFraming | Track markeres needsRebase; den overskrives ikke stille |
| Ukjent fremtidig version | Ikke rediger track; bevar rå JSON og vis oppgraderingsmelding |

Schema-kontrakten deles i to:

- dedikert camera-motion PATCH godtar bare kjent v1 eller eksplisitt null,
  krever expectedMotionRevision og avviser ukjent versjon med 422;
- read/history/WAL og scene-/fallback-envelope kan bære et bounded opaque
  future payload (maks 64 KiB, dybde 16), men kan ikke redigere det;
- compatibility-/whole-scene POST bevarer alltid serverens eksisterende opaque
  payload ved canonical hash og ignorerer et injisert/forandret future payload;
- native rawScenes og WAL beholder rå envelope-data semantisk tapsfritt og viser
  upgrade_required i stedet for å dekode-og-skrive dem bort.

Slik kan gamle klienter roundtrippe kjente sceneendringer uten at strict
v1-mutasjonsvalidering åpnes for ukjent schema.

T=0-paritet er første migreringsport: alle eksisterende fixtures uten track må
gi samme ShotFramingState og samme eksporterte komposisjon som før.

## 7. Evaluator

### 7.1 Ansvar

FrameEvaluator skal:

1. validere dokument- og tidsinput;
2. bruke ShotFramingState som implisitt keyframe ved t=0;
3. finne keyframe-intervallet med binærsøk;
4. evaluere easing;
5. interpolere en CameraPose2D;
6. kjøre samme crop-/coverage-validering som statisk framing;
7. returnere et immutable FrameRenderSnapshot;
8. returnere strukturerte warnings uten å mutere dokumentet.

Evaluatoren skal ikke:

- hente bilder fra nett;
- allokere GPU-teksturer;
- lese CanvasState;
- bestemme aktiv UI-selection;
- kompilere provider-prompt;
- skrive til database eller disk.

### 7.2 Interpolasjonsregler

For normalisert segmenttid u i intervallet 0...1:

- centerX/centerY: lineær interpolasjon etter easing;
- zoom: interpolasjon i log-rom for jevn opplevd skalering;
- roll: korteste vinkelretning, slik at 179° til -179° ikke spinner 358°;
- focus anchor: lineær hvis begge finnes, ellers bruk nærmeste definerte verdi;
- hold: behold venstre pose til neste keyframe;
- exact keyframe time: returner keyframens eksakte normaliserte pose;
- før første eksplisitte keyframe: interpoler fra shotFraming ved t=0;
- etter siste keyframe: clamp til siste;
- tid utenfor shotet: clamp til 0...duration.

Alle beregninger bruker Double i evaluatoren, men tid velges rasjonelt. Output
normaliseres før fingerprint og render.

### 7.3 RenderSnapshot

Første versjon trenger ikke en generell scene graph:

~~~swift
struct FrameRenderSnapshot: Sendable, Equatable {
    let frameID: String
    let time: MediaTime
    let documentIdentity: String
    let localDocumentRevision: Int
    let aiSourceRevision: Int?
    let layerState: BoardLayerState
    let presentationFraming: ShotFramingState
    let rasterPlacementFraming: ShotFramingState
    let visibleStrokeIDs: [String]
    let rasterSourceIdentity: RasterSourceIdentity?
    let warnings: [FrameRenderWarning]
    let semanticFingerprint: String
}
~~~

presentationFraming er utsnittet brukeren skal se ved t. rasterPlacementFraming
er utsnittet et viewport-bundet AI-raster faktisk ble produsert for. Disse må
ikke blandes.

Evaluator og lokal render skal fungere uten en AI-rad. aiSourceRevision er
derfor optional. Når Color/Atmosphere adopteres, må image-versjonen fryse hele
anvendte t=0-rasterPlacementFraming, ikke bare en fingerprint; ellers kan
viewport-rasteret ikke rekonstrueres sikkert etter senere framing-endringer.

Strokes kan fortsatt ligge i dagens dokument. Snapshotet beskriver hvilken
state renderer skal konsumere; det kopierer ikke alle tunge sample-arrays for
hver display tick.

### 7.4 Coverage gjennom hele banen

Validering av bare start- og sluttbilde er utilstrekkelig. En bane kan krysse
et ugyldig utsnitt mellom keyframes.

CoveragePolicy v1 skal minst evaluere t=0, alle keyframe-tider, segmentgrenser,
alle faktiske rasjonelle export-PTS-er og en konservativ swept-envelope mellom
dem. Policyen eier tillatte projectFrameRate-verdier, normalisert
containment-epsilon, maksimal transform-/kurvefeil, subdivisjonsgrense og
fail-closed-regel ved manglende konvergens.

Alle konstanter og policyVersion låses i en egen ADR og i felles JSON-fixtures.
Swift og TypeScript må gi identisk blocking/warning-resultat. Inntil denne
kontrakten er implementert og parity-testet kan klienten vise coverage-warning,
men backend kan ikke bruke den til å blokkere commit/preflight.

Resultatet er:

- blocking: ugyldige dimensjoner, ikke-finite verdier, tomt viewport, kritisk
  motiv helt utenfor eller manglende motion-plate coverage;
- warning: lav kildeoppløsning, store tomme hjørner, fokus nær crop-kant eller
  aggressiv digital zoom;
- info: provider kan skape nytt innhold som lokal preview ikke viser.

En blocking-feil lagres fortsatt i lokal draft, WAL og serverpersistens med
cameraMotionStatus=invalid, slik at recovery aldri mister arbeid. Den blokkerer
commit som valid bane, playback, export og AI-generation. En warning krever
synlig bekreftelse, men endrer aldri kamerabanen automatisk.

## 8. Renderarkitektur

### 8.1 Live Metal-preview

Behold den eksisterende CAMetalLayer-baserte visningen og dagens
non-destruktive framing i present-steget.

Ny flyt:

~~~text
CAMetalDisplayLink.Update.targetPresentationTimestamp
eller CADisplayLink.targetTimestamp
        ↓ forventet presentasjonstid
PlaybackClock → MediaTime
        ↓
FrameEvaluator
        ↓
Presentation framing uniform
        ↓
MetalStrokeRenderer.present
        ↓
CAMetalDrawable
~~~

Krav:

- display link er kun en scheduler; dokumenttid skal ikke akkumuleres fra
  antall callbacks;
- faktisk callback-rate kan variere med hardware, Low Power Mode, termisk
  tilstand og accessibility;
- CAMetalDisplayLink er tilgjengelig fra iOS 17 og callbacken renderer kun til
  update.drawable;
- CADisplayLink/manuell CAMetalLayer-rendering henter nextDrawable sent;
- hent aldri et andre drawable i samme callback;
- behold aldri drawable mellom frames;
- håndter nil/timeout uten å blokkere Pencil;
- pause display link når preview ikke spiller;
- én koordinert display link per aktiv scene, ikke én per panel;
- Pencil-preview har høyere prioritet enn animatic playback.

Vi setter 60 Hz som første konsistente playback-mål. 120 Hz er ønsket på
ProMotion-enheter, men ingen funksjon skal anta en bestemt refresh rate.

Tegning under avspilling er deaktivert i første versjon. Hvis det senere
tillates, må Pencil-inputens inverse transform og Metal-presentasjonen bruke
nøyaktig samme presentationFraming ved samme tid. Bare å animere shaderen vil
ellers lagre strokes i feil source-koordinater.

### 8.2 FrameRenderSession

Dagens committed texture kan dimensjoneres etter aktuell zoom. Den må ikke
rebygges for hvert sample i en zoom-animasjon.

En shot-lokal FrameRenderSession:

- fryser ett immutable FrameDocument;
- bygger strokes/base-raster én gang;
- beregner nødvendig oppløsning fra maksimal zoom, innen eksisterende
  capability-/8192-policy;
- endrer bare framing-uniform under playback;
- kan brukes av både live og offscreen render;
- avsluttes eller bygges på nytt når kildeidentiteten endres.

### 8.3 Felles renderkoordinator

FrameRenderService ligger i dag inne i NativeBoardView. Den bør trekkes ut til
FrameRenderCoordinator med tre innganger:

~~~swift
func present(snapshot: FrameRenderSnapshot, in target: LiveTarget)
func renderImage(snapshot: FrameRenderSnapshot, spec: ImageRenderSpec) async throws -> CGImage
func renderPixelBuffer(snapshot: FrameRenderSnapshot, spec: VideoRenderSpec) async throws -> CVPixelBuffer
~~~

Alle bruker samme:

- layer order og visibility;
- blend modes og opacity;
- raster/stroke-sammensetning;
- aspect/crop/roll;
- annotation policy;
- fargerom og alpha-policy.

Forskjellen er bare output-target og kvalitet.

### 8.4 Animatic og eksport

Dagens animatic holder ett stillbilde gjennom shot-varigheten. Ny exporter:

1. velg output fps og rasjonell frame duration;
2. frys FrameDocument og FrameRenderSession ved export-start;
3. iterer presentasjonstider uten Double-akkumulering;
4. evaluer snapshot for hver tid;
5. render direkte til pixel buffer eller en kontrollert mellomtekstur;
6. append når AVAssetWriterInput er ready;
7. bruk adaptorens pixelBufferPool;
8. håndter cancel, backgrounding og writer failure;
9. mux voiceover med eksplisitt tidsbase.

En sequence-level TransitionCompositor ligger rundt shot-evaluatoren og
bevarer dagens cut, dissolve og fade mellom naboshots samt voiceover-offsets.
Kameramotoren erstatter ikke eksisterende transition-semantikk.

Ingen export-frame skal gå via skjermbilde av UIView.

For target iOS 17 er AVAssetWriterInputPixelBufferAdaptor fortsatt riktig
kompatibilitetsbane. Nyere receiver-API-er som først finnes på senere OS skal
ikke gjøres til et krav. En availability-optimalisering kan komme separat.

### 8.5 Thumbnails og scene-listen

Thumbnail skal ha en eksplisitt posterTime:

- default: t=0;
- valgfritt: valgt keyframe eller midpoint;
- aldri tilfeldig siste preview-tick.

Thumbnail cache key inkluderer:

- frame ID;
- source revision;
- layer fingerprint;
- framing/motion fingerprint;
- posterTime;
- output size og fargerom.

Da forsvinner ikke eller gjenbrukes feil thumbnails når bare kamerabanen
endres.

### 8.6 Minne

Dagens renderer har én committed texture og en øvre teksturgrense. Det er ikke
bevist at vi trenger full virtual texturing for denne vertikalen.

Fase 1:

- behold nåværende texturemodell;
- sett eksplisitte cachegrenser etter device class og målte data;
- kast regenererbare thumbnails, decoded images og offscreen textures ved
  minnepress;
- behold dokumentmodell, aktiv stroke og usynkede endringer;
- stopp prefetch før aktiv renderkvalitet reduseres;
- test på fysisk iPad, fordi simulator ikke representerer jetsam.

Sparse textures, heaps og generell tile-store er et separat ADR etter at
instrumentering viser at reelle prosjekter ikke kan holdes innenfor
minnebudsjettet. Sparse texture-støtte varierer mellom Apple GPU-familier og
kan ikke antas for alle enheter som støtter iPadOS 17.

## 9. UX for kamerabane

### 9.1 Plassering

I Inspectorens eksisterende **Movement**-seksjon legges:

- valgt bevegelseslabel;
- status: Statisk, 1–64 keyframes, Utført, Må rebaseres eller Ugyldig;
- handlingen **Kamerabane…**.

Dette åpner et fokusert kameraeditor-lag over boardet. Vi legger ikke til en
ny global app-tab eller en permanent full film-timeline i første fase.

### 9.2 Kameraeditor

Editoren består av:

- stort Stage med samme renderer som boardet;
- play/pause og scrub;
- kompakt shot-lokal tidslinje;
- start- og sluttkort;
- knapp for å legge til/fjerne keyframe;
- easing-valg mellom to poses;
- **Perform**;
- Reset og Ferdig;
- synlige warnings for crop/oppløsning/coverage.

Startflyt:

~~~text
Velg shot
  → Movement
  → Kamerabane…
  → Velg preset eller Start/Slutt
  → Preview
  → Eventuelt Perform
  → Ferdig
  → én undo-transaksjon
~~~

### 9.3 Presets

Presets oppretter data, ikke særkode:

| Preset | Start/slutt |
|---|---|
| Static | Ingen track |
| Push in | Samme center/roll, høyere zoom |
| Pull out | Samme center/roll, lavere zoom innen coverage |
| Pan left/right | Endret centerX |
| Tilt up/down | Endret centerY |
| Drift | Liten center- og zoomendring |
| Handheld restrained | Deterministisk kurveprofil med lav amplitude; ikke tilfeldig ved avspilling |

Orbit, crane og ekte dolly-through skal ikke være lokale 2D-presets. De kan
vises som AI-/depth-krevende kapabiliteter med tydelig merking.

### 9.4 Perform

Perform registrerer brukerens pan, pinch og roll mot shotets tid.

Pipeline:

~~~text
Gesture samples
  → timestamp mot playback clock
  → normalisert pose
  → transient råbuffer
  → deterministisk smoothing
  → keyframe reduction
  → validering
  → én CameraMotionCommand
~~~

Første implementasjon:

- sample ved display-/input-tid, men lagre rasjonell shot-tid;
- bruk en versjonert, deterministisk filterkonfigurasjon;
- behold rå samples bare til gesture-transaksjonen er godkjent;
- reduser punkter med en dokumentert skjermromstoleranse;
- lås aspect ratio;
- stopp opptak ved shot-slutt;
- overskriving av eksisterende segment krever synlig valg;
- Cancel gjenoppretter nøyaktig state før Perform.

Algoritmevalg, terskler og filterversjon inngår i golden fixtures. Vi skal ikke
velge One Euro, Ramer–Douglas–Peucker eller Bézier-fitting bare fordi navnet er
populært; alternativene må måles på samme representative gestures.

### 9.5 Accessibility

- Respekter SwiftUI accessibilityReduceMotion og UIKit
  UIAccessibility.isReduceMotionEnabled.
- Observer UIAccessibility.reduceMotionStatusDidChangeNotification mens
  editoren er åpen.
- Ved Reduce Motion: ikke autoplay fly-through; behold eksplisitt scrub/play,
  og tilby statisk start/slutt eller crossfade.
- Eksplisitt exportert film endres ikke uten brukerens valg; fallbacken gjelder
  editorens presentasjon.
- Motion skal aldri være eneste måte å formidle start, slutt eller varsel på.
- Alle keyframes og kontroller får accessibility labels, values og hints.
- Play, Perform og Stop skal være separate, tydelige handlinger.
- Fargekodede warnings får også symbol og tekst.
- Touch-targets og fokusrekkefølge verifiseres i portrait og landscape.

## 10. Undo, WAL og samtidighet

### 10.1 Avgrenset commandmodell

Vi skal ikke omskrive alle penseloperasjoner til en generell CommandBus i
første fase. Kamerabanen får en avgrenset transaksjonsmodell:

~~~swift
struct SetCameraMotionCommand: Sendable {
    let frameID: String
    let expectedMotionRevision: Int
    let before: CameraMotionTrack?
    let after: CameraMotionTrack?
    let label: String
}
~~~

Apply returnerer en transaksjonskvittering med before/after og ny revision.
Undo/redo bruker kvitteringen. En metode som bare lover inverse() uten den
faktisk normaliserte before-state er for svak når migrering og validering kan
endre input.

Én Perform-session er én undo-handling, ikke ett undo-element per sample.

### 10.2 Historikk

CanvasDocumentSnapshot utvides med optional cameraMotionTrack. Arkivschemaet
bumpes og migreres:

- v2 uten motion dekodes som nil/static;
- ny versjon lagrer track;
- et ukjent nyere schema ignoreres sikkert og overskrives ikke;
- undo av kamera gjenoppretter track og bevegelseslabel, men aldri en rå
  server-eid videoStale-bool. Enhver motion-edit eller undo re-armer stale og
  nullstiller lokal video/preflight straks. Bare eksakt successful adoption med
  full source/paint/framing/motion/duration-binding kan clear-e stale.

### 10.3 Offline WAL

Dagens PendingStoryboardDocument er v6 og har treveis grunnlag for strokes,
layers og shotFraming. v7 skal inkludere:

- baseCameraMotionTrack;
- cameraMotionTrack;
- baseMotionRevision;
- localMotionRevision;
- motionFingerprint;
- endringsklassifisering.

WAL skrives atomisk før autosave og slettes bare med compare-and-clear mot
akkurat det snapshotet serveren bekreftet. FrameSaveRacePolicy må sammenligne
motion, ellers kan en gammel save-completion slette en nyere motion-WAL.

### 10.4 Revisions og stale-regler

Motion må få egen revision. En ren kamera-timeendring:

- skal ikke endre strokes;
- skal ikke gjøre godkjent Color/Atmosphere-raster ugyldig som tegnekilde;
- skal gjøre eksisterende AI-video stale;
- skal invalidere animatic/thumbnail cache som bruker motion;
- skal inngå i neste AI-video source binding.

Dette skiller:

- sourceRevision/sourceUpdatedAt, som i v1 fortsatt dekker Drawing og statisk
  framing;
- separate Color/Atmosphere stage revisions;
- motion revision;
- frame metadata updatedAt.

updatedAt alene er ikke en trygg kildeidentitet.

| Endring | Pencil source | Motion revision | Still-AI stale | Video stale |
|---|---:|---:|---:|---:|
| Drawing strokes + Drawing visual state | Endres | Uendret | Ja | Ja |
| Color/Atmosphere layer | Egen stage revision | Uendret | Selektivt etter stage | Ja |
| Statisk framing | Endres (beholder dagens kontrakt) | Bump/revalider atomisk | Ja | Ja |
| CameraMotionTrack | Uendret | Endres | Nei | Ja |
| Duration | Uendret | Bump/revalider hvis track finnes | Nei | Ja |
| movement-label alene | Uendret | Uendret | Nei | Nei |

### 10.5 Konflikter

Server-PATCH krever expectedMotionRevision. Ved konflikt:

- hvis bare motparten har endret motion: vis behold lokal / bruk server /
  dupliser shot;
- hvis ulike keyframes er endret kan en senere fase tilby semantisk merge;
- v1 skal ikke gjette en merge som kan endre regissørens timing;
- strokes/layers bruker eksisterende treveisstrategi uavhengig.

Whole-scene/fallback-POST bevarer serverens cameraMotionTrack både når feltet
er utelatt, eksplisitt null eller har ukjent versjon. Bare dedikert v1
camera-motion PATCH med expectedMotionRevision kan slette med eksplisitt null.
Dette må testes i backendens compatibility-merge før utrulling.

Den alternative FrameDrawingScreen-inngangen må også laste, lagre og reconcile
track. Ellers får systemet to redigeringsflater med ulik datatap-policy.

## 11. Lokal 2D, 2.5D og generativ fly-through

### 11.1 Kapabilitetsnivåer

| Nivå | Input | Resultat | Kan vise ny skjult geometri? |
|---|---|---|---|
| L0 Statisk | Flatt bilde/strokes | Ett utsnitt | Nei |
| L1 2D kamerabane | Flatt bilde/strokes + keyframes | Pan/zoom/roll/crop | Nei |
| L2 Multiplan 2.5D | Separate plan, depth, masker og fill | Parallakse og begrenset dolly | Delvis |
| L3 Generativ video | Godkjent composite + strukturert intent | Modellgenerert camera/performance | Ja, men ikke deterministisk |

UI og eksportmetadata skal vise nivå. Et L1-resultat skal ikke kalles
3D fly-through.

### 11.2 Motion-plate-begrensning

Godkjente AI Color/Atmosphere-bilder er i dag viewport-bundne rastere. De har
ikke automatisk piksler utenfor utsnittet de ble generert for.

Konsekvens:

- Pencil og eksplisitt importerte source-space-bilder kan beveges innenfor sin
  faktiske kilde;
- push-in inne i et godkjent AI-raster kan være gyldig;
- pull-out og bred pan kan avsløre områder som aldri ble generert;
- stretching eller stille AI-fill i evaluatoren er ikke tillatt.

Første sikre policy:

1. full lokal motion for Pencil/importert source-space;
2. AI-raster bare når hele banens swept visible polygon ligger innenfor det
   bakte viewportområdet;
3. ellers blocking-feilen **Motion plate required**;
4. senere kan Color/Atmosphere generere et overscannet motion plate med egen
   placementFraming, coverage-polygon og asset-fingerprint.

### 11.3 Hva L2 krever

Ekte lokal 2.5D krever mer enn zPosition på en node:

- segmentering i foreground/midground/background eller flere lag;
- depth-map eller eksplisitte plane depths;
- occlusion-masker;
- generativ eller manuell fill bak frigjorte områder;
- projection/camera model;
- validering av disocclusion og kantartefakter;
- egen cache- og minneprofil.

Dette skal prototypetestes på et lite fixture-sett før det blir en
persistenskontrakt.

### 11.4 Hva AI mottar

Prompt Engine eier fortsatt produksjonskonteksten. CameraMotionTrack projiseres
til en provider-nøytral MotionIntent:

~~~json
{
  "version": 1,
  "kind": "camera",
  "trajectory": "push-in",
  "shotDurationIntent": { "value": 96, "timescale": 24 },
  "startPose": { "centerX": 0.5, "centerY": 0.5, "zoom": 1.0 },
  "endPose": { "centerX": 0.52, "centerY": 0.43, "zoom": 1.32 },
  "easing": "easeInOut",
  "strength": 0.35,
  "styleLocks": [
    "graphite-lines",
    "paper-texture",
    "identity",
    "wardrobe",
    "location",
    "framing-start"
  ]
}
~~~

shotDurationIntent er intern forteller-/timingkontekst. Adapteren må aldri
oversette den til et provider-duration-felt uten dokumentert capability.

ModelAdapter oversetter dette til:

- tekstlig motion-prompt;
- eventuell provider motion-ID og strength;
- eventuell start/end frame;
- støttet varighet;
- avvisning eller nedgradering når provider mangler en kapabilitet.

Prompt Inspector skal vise både MotionIntent og faktisk provider-request,
uten hemmeligheter eller signerte URL-parametre.

## 12. Higgsfield og providerarkitektur

### 12.1 Verifisert Higgsfield-kontrakt

Autoritativ base URL er https://api.higgsfield.ai. Offisiell OpenAPI v2.0.0
beskriver:

- POST /higgsfield-ai/dop/lite;
- POST /higgsfield-ai/dop/standard;
- POST /higgsfield-ai/dop/turbo;
- obligatorisk prompt og image_url;
- valgfri seed, heltall 1...1 000 000;
- valgfri motions, maksimalt to;
- hvert motion-element har UUID-id og strength 0...1 i steg på 0,01;
- valgfri end_image_url;
- enhance_prompt har provider-default true;
- ingen dokumentert duration i DoP-request body;
- estimate via /estimate foran samme modellsti.

Repoets enhance_prompt=false beholdes som et eksplisitt continuity-valg, ikke
som en antatt provider-default. Higgsfields Help Center beskriver 3 eller 5
sekunder i produkt-UI-et, men dette beviser ikke en REST-parameter. For
Higgsfield er outputDurationPolicy=provider_defined og effectiveDuration=null.
Shot-varighet kan påvirke promptens timing-intensjon, men adoption skal ikke
late som provider-output har en håndhevet varighet.

Det finnes ingen offentlig, nåværende REST-katalog med verifiserte motion-ID-er.
En «fly-through»-UUID skal aldri hardkodes fra en nettside; den må løses
server-side fra en konto-verifisert, versjonert katalog.

Den offisielle JavaScript-SDK-en v0.2.1 motsier deler av live-kontrakten:
den bruker eldre /v1/image2video/dop med input_images, har
platform.higgsfield.ai som default host, utelater canceled fra V2-status,
auto-retrier generation POST og aksepterer et webhook-secret, mens kildekoden
bare appender webhook-URL-en og ikke anvender secret-feltet. Derfor adopteres
ikke SDK-en ukritisk. OpenAPI og nyere lifecycle-, webhook- og retry-kilder har
presedens, og valgt wire-kontrakt låses med kontrakttest og ADR.

### 12.2 Kritisk sikker jobbtilstand

Generation POST har ingen dokumentert provider-idempotency. Derfor:

~~~text
prepared/reserved/durable
  → submitting
      ├─ 2xx + gyldig request_id/URL-er → bevar returnert providerstatus
      ├─ 2xx + manglende/ugyldig ID      → submission_unknown
      ├─ 2xx + gyldig ID/ugyldige URL-er → accepted_contract_unknown
      ├─ 400/403/423/429                 → rejected_retryable
      ├─ 401/404/422                     → failed_permanent
      └─ timeout/reset/tvetydig 5xx      → submission_unknown

kjent request_id
  ├─ webhook → completed/failed/nsfw
  └─ durable poll → queued/in_progress/completed/failed/nsfw/canceled

submission_unknown
  ├─ terminal webhook kan binde request_id
  └─ ellers operator/provider-reconciliation; aldri automatisk POST
~~~

400, 403, 423 og 429 kan forsøkes på nytt først etter korrigering, funding
eller venting, som en ny eksplisitt attempt. Det er aldri automatisk recovery
av samme jobb. Providerens 2xx-status bevares; den skal ikke overskrives til
queued.

Lagre request_id, status_url, cancel_url og X-Correlation-ID straks de finnes.
request_id må være UUID. Returnerte URL-er må være HTTPS på forventet host,
uten credentials eller fragment, og ha
/requests/{samme UUID}/status eller /requests/{samme UUID}/cancel som path.
En gyldig ID med ugyldige/manglende URL-er blir accepted_contract_unknown.
Reservasjonen beholdes, og jobben avventes via terminal webhook eller
operator/provider-reconciliation. Manglende/ugyldig ID etter 2xx blir
submission_unknown. Ingen av tilstandene kan refunderes eller resubmitteres
automatisk.

Webhook-kontrakten er:

- offentlig HTTPS-endpoint og svar innen ti sekunder;
- unik høyentropisk token per jobb i callback-URL-en; bare token-hash lagres;
  tokenet forblir gyldig gjennom providerens retry-/reconciliation-vindu og
  revokeres først etterpå;
- streng envelope- og terminalstatusvalidering;
- durable event-record før 2xx;
- deduplisering på request_id + terminal status; gyldig duplicate med samme
  token får fortsatt 2xx;
- providerens network/5xx-retry kan fortsette i opptil to timer; 4xx er
  permanent;
- bare completed, failed og nsfw kommer via dokumentert webhook;
- queued, in_progress og canceled kommer fra polling;
- ingen signatur, secret-header eller source-IP-ranges er dokumentert.
  IP-allowlisting er derfor UNKNOWN til leverandøren publiserer ranges.

En backend-reconciler eier persistent next_poll_at og overlever at iPad-appen
lukkes. Den bruker dokumentert 2→10 sekunders backoff med jitter, retry ved
nettverk/5xx, og webhook som primærvei med polling som recovery. Polling starter
bare for kjent request_id. submission_unknown forblir uten auto-resubmit.

Completion adopteres bare ved full binding-match. Ukjent eller stale output
arkiveres uten å bli aktivt. Provider-output beholdes minst syv dager. Arkivering starter ved completed,
har første SLO p95 under 15 minutter, alarmerer etter 60 minutter og har hard
intern deadline completed_at + seks dager. En bakgrunnsworker med retry eier
dette uten avhengighet til en aktiv klient. Refund og kostnadsbokføring følger definitiv
terminaltilstand og tåler race og duplikater.

Denne state machine-endringen er fase 0-blocker. Alle delte ruter, inkludert
project-workspace-routes.ts, må persistere lokal jobb/reservasjon før betalt
provider-submit.

### 12.3 ProviderCapabilities

Hver adapter annonserer en versjonert, validerbar profil:

~~~typescript
interface VideoProviderCapabilities {
  modelId: string;
  adapterVersion: string;
  acceptsStartImage: boolean;
  acceptsEndImage: boolean;
  motionCatalogSource: "account" | "api" | "none";
  motionCatalogVersion: string | null;
  maxMotionPresets: number;
  motionStrength: { min: number; max: number; step: number } | null;
  seed: { min: number; max: number } | null;
  outputDurationPolicy: "requested" | "fixed" | "provider_defined";
  supportedDurationsSec: number[];
  webhookTerminalStatuses: Array<"completed" | "failed" | "nsfw">;
  webhookVerificationMode: "signed" | "callback_token";
  cancellationLifecycle: "queued_only" | "documented_states" | "none";
  responseContract: "request_id_and_validated_urls";
  supportsProviderIdempotency: boolean;
}
~~~

Higgsfield-profilen setter motion strength til 0...1/0,01, seed til
1...1 000 000, webhookTerminalStatuses til completed/failed/nsfw,
webhookVerificationMode til callback_token, cancellationLifecycle til
queued_only, outputDurationPolicy til provider_defined og responseContract til
request_id_and_validated_urls. Katalogkilde/-versjon er none/null inntil
konto-katalogen faktisk er verifisert.

Kompilatoren returnerer exact, approximated med synlig forklaring eller
unsupported. Det er grunnlaget for flere rimeligere leverandører uten ny UI per
leverandør.

### 12.4 Canonical intent, wire-request og kildebinding

CanonicalProviderIntent er den stabile kostnads- og adoption-bindingen. Den
inkluderer immutable source/end-source fingerprints eller interne B2 keys,
sourceStage, tier, prompt, motions, seed, enhance-valg, adapterversjon og
motion-katalogversjon. Den inkluderer aldri presigned URL-signaturer,
callback-token eller andre transportfelt.

Etter siste CAS og durable attempt bygges én WireProviderRequest-body med
ferske signed image_url/end_image_url. Den normaliserte JSON-bodyen brukes
identisk for estimate og generation-submit innen dette submit-forsøket.
Callbacken er ikke et bodyfelt: bare generation-URL-en får
?hf_webhook=<URL-encoded HTTPS callback URL med jobbtoken>. Estimate-URL-en får
aldri hf_webhook. Transportfeltene valideres separat, mens
providerRequestFingerprint er hash av CanonicalProviderIntent. Nye signerte
asset-URL-er eller callback-token for samme intent skal derfor ikke gi
preflight_changed.

Preflight-response inneholder:

- normalizedMotionIntent, motionFingerprint og canonicalProviderIntentHash;
- adapter- og motion-katalogversjon;
- capabilityDecision;
- outputDurationPolicy og effectiveDuration, som er null for Higgsfield;
- pris/credits;
- eksakt source/paintover/framing-binding.

Submit gjenberegner dette og gir 409 preflight_changed ved relevant endring
eller prisøkning uten ny bekreftelse. Kildeinvalidasjon følger sourceStage:

- Drawing-endring invaliderer Drawing-, Color- og Atmosphere-bundet intent;
- Color-endring invaliderer Color- og Atmosphere-bundet intent;
- Atmosphere-endring invaliderer bare Atmosphere-bundet intent;
- Atmosphere-edit skal ikke invalidere en Color-bundet preflight.

Framing, motion, end-source, adapter eller katalogversjon invaliderer alltid.
ShotDuration inngår i intern timing-/prompt-intensjon, men ikke som en
Higgsfield duration-parameter eller antatt provider-outputlengde.

### 12.5 Lifecycle og output-boundary

Bevar providerstatusene queued, in_progress, completed, failed, nsfw og
canceled separat fra lokale submission_unknown, accepted_contract_unknown og
rejected_retryable.

Output-arkivering skal:

- revalidere hver redirect-host;
- håndheve bytegrense og timeout;
- kontrollere video-MIME og container-signatur;
- aldri la en tilfeldig output URL gjøre en failed/nsfw-jobb completed;
- arkivere før adoption og før retention-deadline;
- adoptere med eksakt CAS mot canonical provider intent, source stage,
  paintover, framing og motion.

### 12.6 Varig bildeavregning og ukjent providerresultat

OpenAIs nåværende Images API-referanse og image-generation-guide beskriver
`POST /images/generations` og `POST /images/edits`, men dokumenterer ingen
provider-side garanti for `Idempotency-Key`. Headeren vi sender er derfor bare
best effort. Den kan ikke brukes som bevis for at en betalt, tvetydig POST er
trygg å gjenta.

Den kanoniske Pencil → Color → Atmosphere-flyten bruker derfor disse reglene:

- en stabil lokal operasjon opprettes før kostnad eller provider-I/O;
- en betalt reservasjon må være bundet til samme bruker, prosjekt,
  storyboard, modell, kvalitet og operasjon ved hver retry;
- `claimed` er før providergrensen og kan tas over etter utløpt lease;
- `processing` har krysset providergrensen og tas aldri automatisk over;
- stale `processing` rapporteres som `generation_result_unknown`, uten
  automatisk ny POST eller automatisk refusjon;
- transportfeil, provider-5xx, ugyldig 2xx-output og lokal persistensfeil etter
  POST beholdes som ukjent resultat i `processing`; eksplisitt provider-4xx
  er en definitiv avvisning som kan avsluttes og refunderes;
- kreditttrekk, refusjon og meter-event er normaliserte, varige intents med
  stabile referanser og egne worker-leaser;
- providerresultat og meter-intent ferdigstilles atomisk, mens Stripe- og
  wallet-I/O skjer utenfor databasetransaksjonen;
- et fullført bilde kan ikke endres til failed/refunded av en sen route-feil;
- historiske rader uten `billing_intent_version=1` etterfaktureres eller
  refunderes ikke automatisk, fordi tidligere sideeffekter ikke kan bevises;
- Stripe-retry stopper før leverandørens dokumenterte dedupliseringsvindu og
  ender i `delivery_unknown` for eksplisitt avstemming.

Video-polling, videoavregning, arkivering, legacy-avregning og bildeavregning
har separate worker-løp. En treg Stripe-/B2-operasjon kan dermed ikke blokkere
polling av aktive provider-jobber.

## 13. Sikkerhet, personvern og kostnad

- HIGGSFIELD_API_KEY_ID og HIGGSFIELD_API_KEY_SECRET forblir bare på Render/
  backend. De skal aldri inn i iPad-app, logs, Prompt Inspector eller response.
- Signed asset URLs skal være kortlivede og bundet til servere vi kontrollerer.
- Status URL fra provider allowlistes til forventet HTTPS-host før fetch.
- Webhook bruker tilfeldig callback-token; ikke stol på request_id alene som
  autorisasjon.
- Alle generation-endpoints krever prosjekt-/organisasjonstilgang og
  server-side rolleautorisasjon.
- Preflight er gratis og må ikke reservere endelig kostnad før brukerens
  eksplisitte bekreftelse.
- Daglig cap, saldo og markup sjekkes både ved preflight og atomisk ved submit.
- Metered submit krever en live Stripe-kunde og et aktivt/trialing abonnement
  som tilhører samme kunde før provider-I/O.
- Eldre betalte AI-ruter uten varig økonomisk intent feiler lukket; bare
  eksplisitt `free_whitelist` kan bruke dem frem til de er migrert.
- Ingen produksjonsmanus eller bilder skal legges i telemetry payload.
- Logger bruker frame/job-fingerprints eller interne ID-er, ikke prompttekst.
- Provider-output skannes for type, størrelse og tillatt URL før arkivering.
- Cancel tilbys bare når providerens tilstand og capability gjør det trygt.

## 14. Observability og ytelsesbudsjetter

### 14.1 Måling før optimalisering

Legg OSSignposter-intervaller rundt StrokeTessellation, FrameEvaluation,
PlaybackFrame, DrawableWait, OffscreenRender, ExportFrame, AutosaveCommit,
AIAnimationPreflight, AIProviderSubmit, AIProviderPollOrWebhook og
AIOutputAdoption.

Pencil får to eksplisitte mål:

1. actual sample → submit, som kan avsluttes når command buffer er submitted;
2. actual sample → synlig pixel, der touch-timestamp korreleres med drawable-et
   som inneholder samplet, og intervallet avsluttes i
   MTLDrawable.addPresentedHandler. presentedTime må være større enn null;
   null betyr droppet/ikke presentert frame og telles separat.

Et intervall som slutter ved commit eller present skal aldri kalles «synlig
pixel». Bruk unike signpost-ID-er for overlappende frames og analyser med
Instruments, os_signposts og Metal System Trace.

For produksjon på iOS 17 brukes MXMetricManager. Metric reports leveres
maksimalt daglig og dekker omtrent de foregående 24 timene; diagnostics kan
leveres umiddelbart når de er tilgjengelige. Ingen av delene er garantert.
MetricKit utility-signposts brukes bare til lavfrekvente, aggregerte
operasjoner, aldri per frame eller Pencil-sample. Telemetri aggregeres
privacy-safe per appversjon og device class; iOS 27 MetricManager er ingen
dependency for minimumstargetet.

### 14.2 Første budsjetter og måleprotokoll

Dette er inngangsporter som kalibreres mot baseline:

| Måling | Første mål | Hard regel |
|---|---:|---|
| Pencil actual sample → synlig pixel p95 | under 20 ms på navngitt referanse-iPad | Aktiv stroke prioriteres; droppet presentasjon telles |
| FrameEvaluator p95 | under 0,5 ms for 64 keyframes | Ingen I/O eller stroke-proporsjonal allokering |
| Kamera-preview | 60 Hz på navngitt referanse-iPad ved normal thermal og Low Power Mode av | Ellers måles misses/drops/hitches mot systemets valgte cadence |
| Main-thread enkeltarbeid under playback | under 4 ms p95 | Ingen decode, filskriving eller providerarbeid |
| 1080p export | ingen append-/writerfeil | PTS er numeriske, gyldige, strengt stigende med eksakt rasjonell frame-delta |
| Autosave under Pencil | input/present p95 og p99 høyst baseline +10 % | Atomisk; ingen full render på main actor |
| Minne | innen målt device-class-budsjett | Ingen OOM/jetsam i stressmatrise |

Frame-rate range er best effort; 60 Hz er bare en hard gate på den eksakt
navngitte release-enheten, OS-versjonen, fixturet, normal thermal state og Low
Power Mode av. Alle andre forhold rapporterer missed deadlines, presentedTime
lik null og hitch-rate relativt til cadence systemet faktisk valgte.

Før CI-gating kjøres tre warm-up-runs som kastes og minst 30 målte runs per
device/OS/fixture. Frame- og Pencil-benchmarks samler minst 1 000 samples per
run; task-benchmarks som export har minst 30 fullførte observasjoner.
Percentiler beregnes på sample-nivå innen hver låst matrise, med 95 %
bootstrap-konfidensintervall. p95/p99 kan ikke bli mer enn 10 % dårligere enn
godkjent baseline, og frame-hitch-rate kan ikke øke mer enn 0,1 prosentpoeng.
Raw målefiler, thermal/LPM-state og baseline-versjon arkiveres med rapporten.

Export-testen feiler hvis pixel-buffer append returnerer false, hvis PTS ikke
er numeric/valid/strictly increasing, hvis delta avviker fra forventet
rasjonell frame duration, eller hvis writer.status/error viser feil.

### 14.3 Minnepress

Observer UIApplication.didReceiveMemoryWarningNotification og en sentral
memory-pressure source. Ved warning:

1. stopp thumbnail/prefetch;
2. kast regenererbare decode- og offscreen-cacher;
3. reduser ikke-livsviktig preview-kvalitet;
4. behold aktivt dokument, aktiv stroke og WAL;
5. mål og logg før/etter working-set lokalt.

Minnevarsler er best effort. Cachebounds og stress-testing må derfor fungere
selv om varselet aldri kommer før systemet terminerer prosessen.

## 15. Test- og verifikasjonsstrategi

### 15.1 Testpyramide

#### A. Rene unit-tester

- MediaTime normalisering, sammenligning og overflow-grenser;
- CMTime bridge, hasBeenRounded og eksplisitt avrunding;
- projectFrameRate default/persistens, durationRevision og legacy-write-regler;
- shotDuration dual-read/dual-write, 1/600-runding og mismatch/upgrade-konflikt;
- sortering og avvisning av like keyframe-tider/ID-er;
- linear/ease/hold;
- log-zoom;
- korteste roll-bane;
- nil focus-anchor policy;
- before/after duration clamp;
- ikke-finite/out-of-range inputs;
- canonical JSON og motion fingerprint;
- migration fra manglende track og WAL v1–v6;
- base-framing-fingerprint gir valid/needsRebase/invalid deterministisk;
- unknown future schema roundtrippes som raw envelope;
- samme dokument + tid gir samme semantiske snapshot;
- t=0-paritet mot eksisterende framing fixtures.

#### B. Property-/fuzz-tester

Generer gyldige og ugyldige tracks med fast seed og kontroller:

- evaluator krasjer ikke;
- output er finite og normalisert;
- exact keyframes er idempotente;
- evaluert tid er monotont valgt;
- roundtrip JSON endrer ikke fingerprint;
- interpolert zoom holder seg innenfor endpointenes gyldige område;
- samme normalized input gir samme snapshot uansett JSON-keyrekkefølge.

Swift og TypeScript bruker felles JSON-fixtures for normalisering og
fingerprint.

#### C. Render- og golden-tester

- live/offscreen/export bruker samme pose ved samme tid;
- 16:9, 9:16 og 2.39:1;
- pan, push, roll og kombinasjon;
- graphite, color og atmosphere-lag;
- image frame med viskelær;
- annotations og production marks;
- source↔touch-symmetri ved ikke-null playhead;
- committed texture bygges én gang per session, ikke per sample;
- rasterPlacementFraming og presentationFraming blandes aldri;
- adoptert viewport-raster beholder full frozen placement-pose;
- versionert coverage-policy har Swift/TypeScript-paritet;
- AI viewport-raster blokkerer motion utenfor baked coverage;
- sRGB og premultiplied-alpha kontrakt;
- tolerant pixel-diff på pinnet simulator;
- semantisk snapshot-hash eksakt på alle testmiljøer.

#### D. Export-tester

- korrekt antall frames og duration ved 24/25/30 fps og rasjonell NTSC-fixture;
- numeric/valid/strictly increasing PTS med eksakt frame-delta;
- append=false og writer status/error feiler testen;
- første og siste frame matcher evaluator;
- cut/dissolve/fade bevares mellom shots;
- voiceover alignment og offsets;
- cancel rydder midlertidige filer;
- background/interruption gir recoverable feil;
- 30 minutters stress-export uten ukontrollert minnevekst;
- ingen UIView-screenshot-sti.

#### E. Undo/offline/sync

- en Perform-session er én undo;
- redo gjenskaper eksakt fingerprint;
- ny edit etter undo forkaster riktig redo-branch;
- app-kill etter WAL før server save;
- app-kill etter server ack før compare-and-clear;
- same-frame samtidig motion-konflikt;
- remote strokes + lokal motion merge;
- gammel klient/whole-scene POST bevarer known og opaque future motion;
- legacy duration-write initialiserer bare manglende canonical verdi; senere
  endring uten durationRevision gir client_upgrade_required;
- statisk framing bevarer dagens sourceRevision-bump og rebaser motion atomisk;
- eksplisitt null i dedikert v1-PATCH sletter track;
- motion-only endrer ikke pencilSourceRevision;
- motion-edit og undo gjør aktiv AI-video stale og nullstiller lokal preflight;
- bare eksakt matching adoption kan clear-e video-stale;
- eldre completion kan ikke clear-e nyere motion-WAL;
- FrameDrawingScreen bevarer track;
- ukjent fremtidig schema bevares uten overskriving.

#### F. Backend contract

- dedikert motion-PATCH aksepterer bare v1/null og krever OCC;
- read/fallback bevarer bounded opaque future track, men kan ikke mutere det;
- injisert future track i whole-scene POST erstatter aldri serverens rå kopi;
- samme canonical intent gir samme fingerprint med nye presigned URLs;
- final WireProviderRequest brukes likt til estimate og submit i én attempt;
- motion-endring etter preflight gir 409 før providerkall;
- Atmosphere-edit bevarer Color-bundet preflight;
- prisøkning krever ny bekreftelse;
- alle tre Higgsfield tier-URL-er;
- ingen duration eller Idempotency-Key i Higgsfield-request;
- motions: ukjent UUID, mer enn to, ugyldig strength og feil 0,01-steg;
- end-frame-CAS endres mellom preflight og submit;
- timeout/tvetydig 5xx gir submission_unknown og null nye POST-forsøk;
- 400/403/423/429 krever ny eksplisitt attempt etter correction/funding/wait;
  401/404/422 er permanent;
- 2xx uten gyldig ID gir submission_unknown; gyldig ID med ugyldige URL-er gir
  accepted_contract_unknown uten refund eller resubmit;
- hf_webhook finnes bare som encoded query på generation-submit, aldri i
  JSON-body eller estimate;
- webhook aksepterer bare terminal completed/failed/nsfw;
- canceled og nonterminal status gjenfinnes via durable polling;
- manglende/ugyldig callback-token og envelope avvises;
- durable webhook-event lagres før 2xx; samme token/event sendt minst to ganger
  dedupliseres og får fortsatt 2xx;
- tokenet er gyldig gjennom retry-vinduet og avvises etter revokering;
- permanent webhook-feil gjenopprettes av backend-poll uten aktiv iPad;
- poll/webhook-race er idempotent;
- request_id-UUID matcher validerte status-/cancel-URL-er;
- X-Correlation-ID lagres;
- alle seks providerstatuser bevares;
- fremmed/ugyldig status- eller cancel-URL avvises;
- redirect, oversized output, feil MIME og falske videobytes avvises;
- stale completion arkiveres og adopteres ikke;
- project-workspace-route kan ikke submitte før lokal jobb er durable;
- archive-worker rekker retention-SLO uten aktiv klient;
- adoption krever canonical intent, source stage, framing og motion; Higgsfield
  har ingen antatt provider-duration.

#### G. UI- og accessibility-tester

- Kamerabane åpnes fra faktisk Inspector;
- preset gir synlig endring i Stage;
- scrub viser forventet start/midt/slutt;
- Perform/Stop/Cancel/Ferdig;
- frame-/scenebytte stopper gammel playback clock;
- portrait, landscape, Split View og compact inspector;
- VoiceOver-navn, verdi og fokusrekkefølge;
- Reduce Motion deaktiverer autoplay og tilbyr statisk/crossfade;
- Dynamic Type uten skjulte primærhandlinger;
- thumbnail oppdateres etter commit og forsvinner ikke ved scene-scroll.

#### H. Ytelse og fysisk enhet

Minst:

- en minimum støttet iPad for iPadOS 17;
- en ikke-ProMotion iPad;
- en M-serie iPad Pro;
- Pencil-stroke samtidig med preview;
- Low Power Mode;
- termisk belastning;
- minnepress;
- store og små prosjektfixtures;
- 500, 5 000 og realistisk worst-case antall strokes;
- 1, 16 og 64 camera keyframes.

Simulator er egnet til funksjonelle og screenshot-baserte porter, men godkjenner
ikke Pencil-latens, GPU-frame pacing, jetsam eller thermal behaviour.

### 15.2 Provider-testing uten unødvendig kostnad

Tre nivåer:

1. FakeProvider i unit/integration: alle tilstander og feil, ingen kostnad.
2. Recorded contract fixtures: saniterte request/response-eksempler fra
   offisielt schema; ingen secrets eller tidsbegrensede URLs.
3. Gated staging smoke: én eksplisitt godkjent betalt request mot valgt modell,
   med lav cap, unik fixture og kontroll av request_id → archive → adoption.

Live paid smoke skal aldri kjøre i vanlig PR-CI.

### 15.3 Traceability-matrise

Hvert krav får en stabil ID:

| ID | Krav | Minimum evidens |
|---|---|---|
| CAM-001 | Manglende track gir statisk paritet | Unit + golden |
| CAM-002 | Samme tid gir samme snapshot | Unit + seeded property |
| CAM-003 | Live og export deler evaluator | Integration + pixel tolerance |
| CAM-004 | Perform er én undo | Unit + UI |
| CAM-005 | Motion overlever offline/app-kill | WAL integration |
| CAM-006 | Motion-konflikt overskrives ikke | Native/backend contract |
| CAM-007 | Motion-only endrer ikke Pencil-kilde | Native/backend regression |
| CAM-008 | Eksisterende video blir stale | Native/backend regression |
| CAM-009 | AI-raster beveges bare innen coverage | Render + UI regression |
| CAM-010 | Rebase/status kan rekonstrueres med dagens sourceRevision | Native/backend contract |
| CAM-011 | Rasjonell duration/default/OCC migreres uten tap | Contract + migration |
| CAM-012 | Future track bevares, men kan ikke muteres via v1 | Contract + fuzz |
| AI-001 | Pris og canonical intent er bundet til preflight | Backend integration |
| AI-002 | Tvetydig Higgsfield-submit resendes ikke | Fault-injection |
| AI-003 | Stale provider-output adopteres ikke | Backend integration |
| AI-004 | Webhook/poll-recovery er durable og idempotent | Fault-injection |
| A11Y-001 | Reduce Motion-fallback | UI-test + manuell kontroll |
| PERF-001 | Pencil-latens innen budsjett | Fysisk enhet + Instruments |
| PERF-002 | Preview stabil ved variabel refresh | Fysisk enhet |
| EXP-001 | Eksakte export timestamps/writer-resultat | Integration |
| EXP-002 | Cut/dissolve/fade og voiceover bevares | Export regression |

Ingen krav regnes som verifisert bare fordi en utvikler har sett det fungere
én gang i simulator.

## 16. Implementasjonsfaser

### Fase 0 — sikkerhets- og baselineport

**Mål:** Ikke bygge ny funksjon på en utrygg provider-state machine eller
ukjent ytelsesbaseline.

Arbeid:

1. Fjern automatisk Higgsfield-resubmission etter ambiguous timeout.
2. Innfør submission_unknown, terminal webhook og durable poll-reconciler.
3. Sikre durable lokal jobb/reservasjon før provider-submit i alle delte ruter.
4. Valider request-ID/URL-kontrakt, callback-token, deduplisering og event før
   2xx.
5. Verifiser endpoint, OpenAPI og SDK-avvik med kontrakttest/ADR.
6. Innfør retention-arkivering med retry, alarm og ingen klientavhengighet.
7. Mål dagens Pencil, static framing, thumbnail og animatic etter protokollen.
8. Legg signposts rundt eksisterende kritiske stier og frys fixtures.

Exit:

- ingen kodevei kan auto-resubmitte en ukjent Higgsfield-jobb;
- ingen provider-submit skjer før durable lokal jobb;
- webhook/poll fault-injection og archive-SLO er grønne;
- baseline har device, OS, fixture, p50/p95/p99, CI og minne;
- ingen betalt request kreves for normal CI.

### Fase 1 — ren evaluator og t=0-paritet

Arbeid:

1. Opprett MediaTime, storyboardTiming med 25/1 legacy-default,
   shotDuration/durationRevision-migrator, CameraPose2D og CameraMotionTrack.
2. Definer raw envelope, rebase-sidecars og full frozen raster placement.
3. Opprett FrameDocument-projeksjon fra FrameSummary/Canvas snapshot.
4. Implementer ren FrameEvaluator og versionert CoveragePolicy.
5. Flytt statisk render-inngang til FrameRenderSession/Coordinator.
6. Koble live, thumbnail og still-export til snapshot ved t=0.

Exit:

- alle gamle fixtures er visuelt og semantisk like;
- duration dual-read/write og unknown-schema roundtrip er kontrakttestet;
- Swift/TypeScript coverage fixtures har paritet;
- evaluator er fullstendig unit-testet;
- NativeBoardView er redusert, ikke større av ny forretningslogikk.

### Fase 2 — durable start/slutt-kamera og animatic

Arbeid, i denne rekkefølgen:

1. Legg optional cameraMotionTrack og server-eide status/revisions i native og
   serverkontrakten.
2. Utvid history og WAL til v7, innfør motion-OCC og minimal
   SetCameraMotionCommand/undo før editoren aktiveres.
3. Implementer start/slutt-editor og presets.
4. Koble display link til evaluator med korrekt timestamp/drawable-kontrakt.
5. Render tidsvarierende animatic og bevar cut/dissolve/fade/voiceover.
6. Utvid thumbnail cache key, coverage og video-stale policy.

Exit:

- push/pan/roll overlever offline, app-kill og samtidig edit;
- invalid draft kan gjenopprettes, men ikke spilles/exporteres/genereres;
- preview og export matcher ved start/midt/slutt;
- gammel klient bevarer track og raw fremtidsschema;
- AI-raster uten coverage blokkeres tydelig;
- 30-minutters export-stress er godkjent.

### Fase 3 — Perform og accessibility

Arbeid:

1. Implementer gesture recorder og versjonert filtering/reduction.
2. Integrer Perform i eksisterende SetCameraMotionCommand og én undo-gruppe.
3. Verifiser cancel/undo/redo og umiddelbar lokal video/preflight-invalidation.
4. Implementer VoiceOver, Dynamic Type og live Reduce Motion-observasjon.
5. Kjør fysisk enhet-matrisen og numeriske regresjonsporter.

Exit:

- Perform kan cancel/undo/redo eksakt uten datatap;
- Pencil p95/p99 og hitch-rate er innen de definerte baselinegrensene;
- VoiceOver og Reduce Motion-portene er godkjent.

### Fase 4 — strukturert AI motion og flere adaptere

Arbeid:

1. MotionIntent i Prompt Engine.
2. ProviderCapabilities og capability decision.
3. CanonicalProviderIntent-hash og separat WireProviderRequest i
   preflight/submit/adoption.
4. Konto-verifisert Higgsfield motion-katalog, hvis tilgjengelig.
5. Samme kontrakt for én rimeligere provider gjennom ny adapter.
6. Prompt Inspector viser normalized og compiled motion.

Exit:

- unsupported felter sendes aldri;
- preflight og submit binder samme canonical intent; final wire-body gjenbrukes
  innen én eksplisitt submit-attempt;
- nye signed URLs endrer ikke intent-fingerprint;
- stale/endrede motions stoppes før kostnad;
- fake-provider suite dekker alle terminaltilstander;
- én eksplisitt staging smoke er godkjent.

### Fase 5 — valgfri 2.5D prototype

Arbeid:

1. Segmenter et lite representativt fixture-sett i plan/depth/masker.
2. Mål disocclusion, fill-kvalitet, minne og renderkost.
3. Evaluer lokal multiplan-render mot generativ video.
4. Beslutt eget ADR for scene graph, asset storage og eventuelle tiles.

Exit:

- produktet viser ikke L2 som stabilt før kvalitetsmål er oppfylt;
- ingen permanent schema låses før prototypen viser reell verdi;
- L1 og L3 fortsetter å fungere uavhengig.

### Fase 6 — generell kreativ runtime, bare ved bevist behov

Mulige senere elementer:

- drawing exposures og onion skin;
- objekt-/lag-transformer over tid;
- audio timeline og waveform;
- non-destructive effects;
- flipbook;
- scene graph og typed animated properties;
- tiled/virtual canvas;
- packages og en større command architecture.

Hver del krever eget ADR, benchmark og brukerflyt. De inngår ikke automatisk
fordi de finnes i Procreate Dreams.

## 17. Foreslått filkart

Første implementasjon i eksisterende target:

~~~text
ipad/StoryboardStudio/StoryboardStudio/
├── Model/
│   ├── MediaTime.swift
│   ├── CameraMotionTrack.swift
│   ├── FrameDocument.swift
│   └── StoryboardDocument.swift
├── Engine/
│   ├── FrameEvaluator.swift
│   ├── FrameRenderSession.swift
│   ├── FrameRenderCoordinator.swift
│   ├── CoveragePolicy.swift
│   ├── TransitionCompositor.swift
│   ├── MetalStrokeRenderer.swift
│   └── CameraPlaybackClock.swift
├── Board/
│   ├── NativeBoardView.swift
│   ├── CameraMotionEditor.swift
│   ├── CameraMotionEditorModel.swift
│   └── AnimaticExporter.swift
└── Sync/
    ├── RoleRoomAPIClient.swift
    └── ProjectBrowserView.swift

frontend/shared/
├── storyboard-camera-motion.ts
└── storyboard-coverage-policy.ts

backend/server/
├── storyboard-camera-motion.ts
├── storyboard-camera-motion.test.ts
├── storyboard-provider-capabilities.ts
├── storyboard-ai-video-service.ts
├── storyboard-ai-video-service.test.ts
├── storyboard-provider-reconciler.ts
├── storyboard-provider-webhook.ts
├── storyboard-routes.ts
├── storyboard-frame-compat.ts
├── casting-manuscripts-service.ts
├── generative-media.ts
└── storyboard-prompt-engine/
    ├── types.ts
    ├── compiler.ts
    └── model-adapters.ts
~~~

Dette er ansvarskart, ikke et krav om at alle filer opprettes samtidig.

Ingen SQL-kolonne er nødvendig for første native track dersom canonical frame
fortsatt ligger i eksisterende JSON og normalized mirror bruker metadata JSONB.
Manglende track betyr statisk, og migreringen kan være additiv uten backfill.
Før normalized mirror eventuelt blir autoritativ motion-store må den faktiske
unikhetsgarantien for project_id + frame_id auditeres. Provider-jobbens
next_poll_at, callback-token-hash, event-dedupe og archive-deadline er derimot
durable backend-state og krever en eksplisitt database-/migrasjonsaudit før
fase 0 kan lukkes.

## 18. Rollout og rollback

Feature flags:

- storyboard_camera_motion_read;
- storyboard_camera_motion_edit;
- storyboard_camera_motion_export;
- storyboard_camera_motion_ai;
- storyboard_camera_motion_perform.

Rekkefølge:

1. server kan bevare og lese optional schema;
2. native leser track, men UI er skjult;
3. intern read-only preview;
4. intern edit/export for Pencil/import;
5. begrenset produksjonsgruppe;
6. AI-adapter separat etter sikkerhetsport.

Rollback:

- slå av edit/play/export-flagg;
- behold cameraMotionTrack rått i persistence;
- fall tilbake til shotFraming ved t=0;
- aldri destruktivt fjerne track ved rollback;
- aktive AI-jobber fortsetter state machine og arkiveres sikkert;
- gamle klienter fortsetter med movement-label og statisk framing.

Database-/JSON-migreringer skal være additive. Ingen rollback skal kreve
datatap eller masseregenerering.

## 19. Risiko-register

| Risiko | Sannsynlighet/konsekvens | Mottiltak |
|---|---|---|
| Dobbel Higgsfield-kostnad etter timeout | Høy/alvorlig i dagens recovery-antakelse | submission_unknown, webhook/review, ingen auto-resubmit |
| Foreldreløs betalt jobb ved DB-feil | Middels/alvorlig | Durable jobb/reservasjon før provider-submit |
| Preview og export divergerer | Middels/høy | én evaluator og renderkoordinator, paritetstester |
| Gammel klient fjerner motion | Middels/høy | compatibility merge og contract-test |
| Motion feilklassifiseres som Pencil-endring | Middels/høy | egne revisions og regression-test |
| AI-video adopteres etter endret bane | Middels/høy | canonical intent + motion fingerprints i CAS |
| AI-raster mangler piksler under pan/pull-out | Høy/høy | swept coverage og motion plate |
| «Fly-through» lover 3D fra flatt bilde | Høy/produkt | tydelige L1/L2/L3 labels og capability UX |
| NativeBoardView blir større monolitt | Høy/middels | evaluator, render, exporter og editor model ut i egne filer |
| Full engine-overbygging før behov | Middels/høy | faseporter og ADR før scene graph/tiles/packages |
| Pixel-golden er ustabil på GPU/OS | Høy/middels | semantisk eksakt hash + tolerant pinnet golden |
| Pencil føles treg under playback | Middels/høy | prioritet, signposts, fysisk device gate |
| OOM på store bilder/export | Middels/høy | bounds, memory-pressure eviction og stress |
| Provider-schema endres | Middels/høy | versjonert adapter, OpenAPI contract probe og capability fail-closed |

## 20. Definition of Verified

Funksjonen kan kalles **godt verifisert** først når alle punktene under er
oppfylt:

- krav-ID-ene har automatisert evidens og ansvarlig eier;
- relevante unit-, integration-, render-, UI- og backendtester er grønne;
- t=0-regresjon er godkjent mot eksisterende fixtures;
- preview/export-paritet er kontrollert på start, midt og slutt;
- offline/app-kill og samarbeid-konflikt er testet;
- Reduce Motion og VoiceOver er verifisert;
- Pencil, frame pacing, export og minne er målt på fysisk device-matrise;
- backend fault-injection beviser at ambiguous provider-submit ikke resendes;
- webhook er terminal-only, durable før 2xx og poll-recovery virker uten klient;
- archive-SLO er testet mot providerens retention-vindu;
- secrets og provider-URL-er er security-reviewet;
- en staging smoke er eksplisitt godkjent og kostnadsført;
- observability kan skille appfeil, providerfeil, moderation, stale adoption
  og submission_unknown;
- rollback er øvd uten tap av cameraMotionTrack-data;
- dokumentasjon, schema-version og beslutningslogg er oppdatert.

En simulatorvideo, et manuelt skjermbilde eller én vellykket AI-generering er
ikke tilstrekkelig verifikasjon.

## 21. Kilder og evidens

Alle eksterne tekniske påstander under bygger på primærkilder. Verifisert betyr
at API/semantikk er bekreftet; foreslått betyr vår arkitekturbeslutning.

| Kilde | Brukt til | Status |
|---|---|---|
| [Apple: Handling input from Apple Pencil](https://developer.apple.com/documentation/uikit/handling-input-from-apple-pencil) | Pencil-input og samplingmodell | Verifisert |
| [Apple: High-fidelity input with coalesced touches](https://developer.apple.com/documentation/uikit/getting-high-fidelity-input-with-coalesced-touches) | Actual samples skal være autoritative | Verifisert |
| [Apple: Predicted touches](https://developer.apple.com/documentation/uikit/incorporating-predicted-touches-into-an-app) | Predicted samples er transient latency-maskering | Verifisert |
| [Apple: CMTime API](https://developer.apple.com/documentation/coremedia/cmtime-api) | Rasjonell media-tid | Verifisert |
| [Apple: CMTimeConvertScale](https://developer.apple.com/documentation/coremedia/cmtimeconvertscale(_:timescale:method:)) | Eksplisitt timescale-konvertering og avrunding | Verifisert |
| [Apple: CAMetalLayer](https://developer.apple.com/documentation/quartzcore/cametallayer) | Custom Metal-backed UIView | Verifisert |
| [Apple: Onscreen presentation](https://developer.apple.com/documentation/metal/onscreen-presentation) | Drawable-livsløp og presentasjon | Verifisert |
| [Apple: CAMetalDisplayLink](https://developer.apple.com/documentation/quartzcore/cametaldisplaylink) | Metal-synkronisert playback, tilgjengelig fra iOS 17 | Verifisert |
| [Apple: targetPresentationTimestamp](https://developer.apple.com/documentation/quartzcore/cametaldisplaylink/update/targetpresentationtimestamp) | Presentasjonstid for CAMetalDisplayLink-evaluering | Verifisert |
| [Apple: Update.drawable](https://developer.apple.com/documentation/quartzcore/cametaldisplaylink/update/drawable) | Callbackens eneste drawable | Verifisert |
| [Apple: MTLDrawable addPresentedHandler](https://developer.apple.com/documentation/metal/mtldrawable/addpresentedhandler(_:)) | Faktisk sample-til-presentasjon-måling | Verifisert |
| [Apple: MTLDrawable presentedTime](https://developer.apple.com/documentation/metal/mtldrawable/presentedtime) | Presentert eller droppet frame | Verifisert |
| [Apple: preferredFrameRateRange](https://developer.apple.com/documentation/quartzcore/cametaldisplaylink/preferredframeraterange) | Variabel refresh og best-effort frame pacing | Verifisert |
| [Apple: ProMotion guidance](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays) | Ikke anta en bestemt callback-rate | Verifisert |
| [Apple: AVAssetWriterInputPixelBufferAdaptor](https://developer.apple.com/documentation/avfoundation/avassetwriterinputpixelbufferadaptor) | Pixel-buffer-basert videoexport | Verifisert |
| [Apple: isReadyForMoreMediaData](https://developer.apple.com/documentation/avfoundation/avassetwriterinput/isreadyformoremediadata) | Backpressure og append-gating | Verifisert |
| [Apple: FileManager replacement](https://developer.apple.com/documentation/foundation/filemanager) | Erstatning uten datatap | Verifisert |
| [Apple: UIDocument](https://developer.apple.com/documentation/uikit/uidocument) | Safe-save/autosave-konsepter; ikke krav om umiddelbar UIDocument-migrering | Verifisert |
| [Apple: Metal Feature Set Tables PDF](https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf) | Teksturgrenser varierer med GPU-familie | Verifisert, PDF datert 2026-05-21 |
| [Apple: Metal capabilities](https://developer.apple.com/metal/capabilities/) | Sparse textures er capability-avhengig | Verifisert |
| [Apple: OSSignposter](https://developer.apple.com/documentation/os/ossignposter) | Lokal intervalmåling i Instruments | Verifisert |
| [Apple: MXMetricManager](https://developer.apple.com/documentation/metrickit/mxmetricmanager) | Feltmetrikk, rapportcadence og iOS 17-kompatibilitet | Verifisert med leveringsforbehold |
| [Apple: MXSignpostMetric](https://developer.apple.com/documentation/metrickit/mxsignpostmetric) | Begrenset aggregert custom-signpost-bruk | Verifisert |
| [Apple: Responding to memory warnings](https://developer.apple.com/documentation/uikit/responding-to-memory-warnings) | Cache eviction og minnepress | Verifisert |
| [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Reduce Motion og alternative presentasjoner | Sterk evidens for konkret fallback |
| [SwiftUI: accessibilityReduceMotion](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion) | Runtime environment-verdi | Verifisert |
| [UIKit: isReduceMotionEnabled](https://developer.apple.com/documentation/uikit/uiaccessibility/isreducemotionenabled) | Runtime-status | Verifisert |
| [UIKit: reduceMotionStatusDidChangeNotification](https://developer.apple.com/documentation/uikit/uiaccessibility/reducemotionstatusdidchangenotification) | Live statusendring | Verifisert |
| [Apple: XCTest performance tests](https://developer.apple.com/documentation/xctest/performance-tests) | Repetérbare ytelsesporter | Verifisert |
| [Procreate Dreams: Timeline and Modes](https://help.procreate.com/dreams/handbook/interface-and-gestures/timeline) | Compose/Perform/Keyframe som UX-referanse | Verifisert produktatferd, ikke intern arkitektur |
| [Procreate Dreams: Performing](https://help.procreate.com/dreams/handbook/2.0/keyframes-and-performing/performing) | Gesture-opptak, motion filtering og redigerbare keyframes | Verifisert produktatferd, eldre 2.0-side |
| [OpenAI: Images API reference](https://developers.openai.com/api/reference/resources/images) | Generations/edits-kontrakt; ingen dokumentert provider-idempotency | Verifisert 2026-08-30 |
| [OpenAI: Image generation guide](https://developers.openai.com/api/docs/guides/image-generation) | Offisiell bildearbeidsflyt; ingen dokumentert Idempotency-Key-garanti | Verifisert 2026-08-30 |
| [Stripe: Create a meter event](https://docs.stripe.com/api/billing/meter-event/create) | Stabil identifier og idempotency-key for meter-event | Verifisert 2026-08-29 |
| [Stripe: Record usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) | Identifier-deduplisering i minst 24 timer | Verifisert 2026-08-29 |
| [Higgsfield: Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests) | Asynkrone statuser og request_id | Verifisert |
| [Higgsfield: Errors and retries](https://docs.higgsfield.ai/docs/concepts/errors) | Ingen provider-idempotency for generation POST | Verifisert, kritisk |
| [Higgsfield: Polling](https://docs.higgsfield.ai/docs/concepts/polling) | Backoff/jitter og webhook-preferanse | Verifisert |
| [Higgsfield: Webhooks](https://docs.higgsfield.ai/docs/how-to/webhooks) | Callback/recovery og duplikathåndtering | Verifisert |
| [Higgsfield: Billing and retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention) | Autoritativt provider-estimat | Verifisert |
| [Higgsfield: OpenAPI](https://docs.higgsfield.ai/docs/openapi.json) | DoP body, estimate og motion-schema | Verifisert 2026-08-29 |
| [Higgsfield official JS SDK](https://github.com/higgsfield-ai/higgsfield-js/blob/main/README.md) | SDK-versjon og motsetninger mot nyere kontrakt | Verifisert vendor-repo |

### 21.1 Kildebegrensninger og åpne usikkerheter

- Procreate publiserer produktatferd, ikke Dreams' interne implementasjon.
  Timeline/Perform er derfor designinspirasjon, ikke bevis for deres motor.
- Higgsfield Help Center viser produkt-UI og kan ikke overstyre OpenAPI for
  request-body. DoP API-varighet er foreløpig ukjent/fail-closed.
- En gjeldende offentlig REST-katalog med motion-ID-er ble ikke funnet.
  Fly-through-ID er derfor ukjent til konto-/MCP-katalog er verifisert.
- Higgsfield har både direkte OpenAPI og en SDK med eldre/andre kontrakter.
  OpenAPI og nyere lifecycle-/retry-kilder har presedens.
- Apples nåværende docs kan vise nyere/deprecated symboler. Target iOS 17 og
  installert SDK må kontrolleres i kompilering; nyere iOS 26/27-erstatninger
  kan bare brukes bak availability.
- 120 Hz, minne og Pencil-latens kan ikke godkjennes i simulator.

## 22. Beslutninger som krever egne ADR-er

1. ADR-CAM-001: MediaTime og canonical serialization.
2. ADR-CAM-002: CameraMotionTrack v1 og rebase-policy.
3. ADR-CAM-003: storyboardTiming, durationRevision og CoveragePolicy.
4. ADR-REN-001: FrameEvaluator, FrameRenderSession og RenderSnapshot.
5. ADR-SYNC-001: Motion revision, WAL og compatibility merge.
6. ADR-AI-001: ProviderCapabilities, CanonicalProviderIntent og wire-request.
7. ADR-AI-002: Higgsfield unknown-acceptance og webhook/poll recovery.
8. ADR-AI-003: Varig bildeavregning og ukjent OpenAI Images-resultat.
9. ADR-GFX-001: Om målinger forsvarer tile/virtual texture.
10. ADR-SCENE-001: Om 2.5D-prototypen forsvarer scene graph og depth-schema.

## 23. Anbefalt neste handling

Start fase 0 og fase 1, ikke AI-fly-through-UI:

1. sikre Higgsfield-jobbtilstanden mot dobbel submission;
2. sikre durable jobb før alle provider-submits;
3. legge inn instrumentering og etablere baseline;
4. implementere MediaTime, CameraMotionTrack og den rene evaluatoren;
5. bevise t=0-paritet før første nye knapp vises;
6. deretter bygge den minste komplette start/slutt-kamerabanen og animatic.

Dette gir en målbar, reverserbar vertikal. Når den er grønn, kan Perform og
provideradaptere bygges oppå samme kontrakt uten at appen må redesignes.
