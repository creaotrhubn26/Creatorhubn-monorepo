# The Role Room Action Clapper (iPad)

En digital filmklaff for iPad — enheten **blir** klaffebrettet. Ingen dashboard,
ingen produksjonsadministrasjon: bare en helskjerms-klaff som lyder, kjennes og
oppfører seg som en ekte klaff foran kamera.

## Hva den gjør

- **Full-skjerm klaffebrett** med redigerbare felt direkte på slaten
  (Production, Scene, Roll, Take, Director, Camera, Date).
- **Løpende timecode** (HH:MM:SS:FF) ved valgt bildehastighet (24/25/30/50/60 fps)
  — enten veggklokke eller fri løpende fra `00:00:00:00` (hold inne timecode
  for å nullstille).
- **Interaktiv klaffearm** — trykk eller dra ned:
  1. armen animeres ned og treffer slaten (med «tre-fjær»-bounce),
  2. **ekte klaffelyd** spilles **nøyaktig i nedslagsøyeblikket** — én av tre
     tilfeldige varianter (`clap-close/room/hall.wav`, fra lite til stort rom),
  3. skarp haptisk «crack» (Core Haptics),
  4. stort **ACTION!**-utbrudd + lysglimt så alle ser klaffen,
  5. tidsstempel + timecode + full slate-metadata fanges,
  6. take forblir synlig (gul markering) mens klaffen er lukket.
- **Styr med volumknappene**: trykk volum opp/ned for å klappe (klar-tilstand)
  eller åpne til neste take (lukket). Nesten-løs-loop + umiddelbar
  volum-gjenoppretting gir null følt latens og endrer ikke systemvolumet.
- **Åpne armen igjen** → tilbake til READY; med *Auto Increment Take* økes
  take med én per klapp.
- **Kompakte innstillinger** nederst: klaffelyd, auto-take, fps,
  timecode-kilde og en **styrke-slider** for klaffelyden. Ingenting mer.
- Skjermen låses aldri og dimmes ikke mens appen kjører — klar for settet.

## Bygge og kjøre

```sh
# 1) Generér Xcode-prosjektet fra project.yml (xcodegen)
cd ipad/ActionClapper
xcodegen generate

# 2) Åpne og kjør på iPad-simulator eller enhet
open ActionClapper.xcodeproj
# Velg en iPad-destinasjon og trykk Run (⌘R)
```

### Kommandolinje (simulator)

```sh
xcodebuild -project ActionClapper.xcodeproj -scheme ActionClapper \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' build
```

> `.xcodeproj` er generert og ikke committet — kjør `xcodegen generate` hvis
> den mangler.

## Struktur

```
ActionClapper/
├── project.yml                 # XcodeGen-prosjektdefinisjon (iPad-only)
├── ActionClapper/
│   ├── App/                    # App-oppføring + ContentView (med persistens)
│   ├── Core/                   # SlateModel, TimecodeEngine, ClapRecord
│   ├── UI/                     # SlateView, ClapperArmView, felt, settings
│   ├── Audio/                  # Syntetisert klaffelyd (ingen lydfil nødvendig)
│   ├── Haptics/                # Heavy-impact-haptikk
│   └── Resources/              # Assets (farger, ikon, launch)
└── README.md
```

## Merknader

- **Lyden er syntetisert i minnet** (AVAudioEngine + PCM-buffer): skarp
  «crack», dobbel «knock», tre-resonans og lav thump. Ingen ekstern lydfil.
- Lydsesjonen er `.playback` → klaffen høres **selv med lydløs-bryter på**.
- Slate-verdier og innstillinger lagres i `UserDefaults` og gjenopprettes.
- Swift 6 + `SWIFT_STRICT_CONCURRENCY: complete` — samme policy som
  CaptureApp/LeadMapApp.
