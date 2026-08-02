# Landing-mockups — lag dem selv, bestem hva som vises

Mockupene på leadgrid.no (enhets-rammer med app-UI + de fire tour-videoene)
lages fra **ekte app-UI i simulatoren**, ikke AI-bilder. Denne mappa gjør det
repeterbart, og lar deg styre **hva som vises inne i dem**.

## Slik bestemmer du innholdet

Appen har DEBUG-hooks som driver den til en gitt skjerm på ren demo-data,
uten backend/innlogging. Du styrer alt via miljøvariabler ved oppstart:

| Variabel | Hva den gjør |
|----------|--------------|
| `QA_TAB=0..7` | Hvilken skjerm: 0 Oversikt · 1 Kart · 2 Leads · 3 Møter · 4 Leadbook · 5 Go · 6 Salgsledelse · 7 Kvalitet |
| `QA_DEMO=1` | Seeder demo-data (leads, dørsalg-stats, selgere) — tallene du ser |
| `QA_TOUR=<navn>` | Hopper over innlogging (demo-token). Kreves i sim |
| `QA_CAPTURE=1` | Kollapser sidepanel → rent «detalj»-utsnitt |
| `QA_DORSALG=1` / `QA_KJOREBOK=1` … | Åpner spesifikke moduser (se `grep -r QA_ LeadMapApp`) |

Vil du endre **tallene/dataene** som vises (f.eks. andre selgernavn eller
dørsalg-tall), er de seedet i appens demo-lag (`DemoModeManager.swift` +
demo-init-ene). Endre der → bygg på nytt → capture.

## Kjøre

```bash
cd ipad/LeadMapApp/scripts
pip3 install pillow          # engangs (framer-avhengighet)

./capture-mockups.sh oversikt   # ett skjermbilde, rammet, til public/leadgrid/app/
./capture-mockups.sh all        # alle recipes
```

Scriptet: bygger appen ved behov → setter Apple-konsistent status-bar
(**09:41**, fullt signal/batteri, via `simctl status_bar override`) → starter
appen med QA-variablene fra valgt *recipe* → tar `simctl io screenshot` →
rammer inn med `frame_mockup.py` (avrundede hjørner + tynn bezel, transparent
bakgrunn) → skriver `.png` + `.webp` til `frontend/client/public/leadgrid/app/`.

### Legge til / endre en mockup
Rediger `run_recipe()`-tabellen i `capture-mockups.sh`. Én linje per mockup;
QA-strengen bestemmer skjerm + data. Eksempel — Kart-skjermen:

```bash
kart) capture "$IP" "SIMCTL_CHILD_QA_TOUR=demo SIMCTL_CHILD_QA_DEMO=1 SIMCTL_CHILD_QA_TAB=1" 0.09 16 "shot-kart" ;;
```

## Video-turene (tour-*.mp4)
Samme oppskrift, men med opptak i stedet for stillbilde:
```bash
xcrun simctl io <udid> recordVideo --codec h264 tour-kart.mp4 &
# … naviger via QA-hooks / interaksjon …
kill %1
```
Se `QA_TOUR`/`QA_CINEMATIC` i koden for de skriptede tur-flytene.

## Klokke / Apple-konsistens
`simctl status_bar override --time "09:41"` gir samme klokke som Apples egen
marketing på iPhone/iPad. For **Apple Watch** bruker Apple konvensjonelt
**10:09** — sett `--time "10:09"` når du fanger watch-skjermer.

## Enhets-rammer
`frame_mockup.py` tegner en ren, generisk bezel (ingen ekstern enhets-kunst),
så samme verktøy funker for iPhone/iPad/watch — juster `--radius` og `--bezel`.
Vil du ha Apples *offisielle* enhets-rammer i stedet, er `fastlane frameit`
alternativet (krever `snapshot`-oppsett + UITests; dekker kun iOS-enheter,
ikke MacBook/web).

> Merk: QA-hookene er DEBUG-only (`#if DEBUG`) og står på revert-lista
> (task #59). Beholder du dem, er det nettopp for denne mockup-flyten —
> vurder å la dem stå bak `#if DEBUG` permanent.
