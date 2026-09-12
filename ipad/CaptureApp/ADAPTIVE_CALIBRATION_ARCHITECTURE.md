# Adaptiv kalibrering — arkitektur

Den generelle rammen bak «adaptiv redigering» (jf. `ADAPTIVE_EDITING_SCOPE.md`). Kjerne-
innsikten: **hud-, mat-, produkt- og eiendoms-kalibrering er SAMME abstraksjon** —
`CalibrationReference<Anchor>` — der bare segmenteringen og ankrene byttes ut. Bygger vi
hud-versjonen med den generaliteten, er mat/produkt uker hver, ikke måneder.

```
CalibrationReference<Anchor>:
  classAnchors[klasse]     // hud-linje / matklasse ("seared_meat","leafy_greens"…) / "nøytral vegg"
      hueTarget + range
      chromaEnvelope       // hvor mye «forbi virkeligheten» som er lov (memory colors)
      lockedAxes           // 🔒 hud: langs-aksen (melanin) LÅST; mat: ingen
      forbiddenZones       // harde grenser (grønn på hud; blå/​grønn-på-kjøtt for mat)
  entityAnchors[id]        // person (E8) / klient·merkevare (mat) — EMA-lært, byttekostnad
  sceneTolerances[lys]     // tolerert cast per lys-klynge (gyllen time varm, studio 0)
  emaUpdate(...)           // aksept- + korreksjons-signal (samme rør på tvers av domener)
```

Skin = 70 % fysikk / 30 % smak (hud-linja er biologi, universell). Mat = omvendt
(«riktig» tomatrød er kultur/sesong/råvare) → matankre trenger bredere konvolutter, mer
vekt på lært klient-smak, og forbudssonene er de eneste virkelig harde grensene.

---

## Illuminant-bevisst pipeline (kjerneproblemet)

Ulikt lys er ikke en komplikasjon i hud-kalibrering — det ER problemet. Samme hud under
tungsten/skygge/blits/gyllen time gir fire ulike a*/b*. Tre lag:

**Lag 1 — normaliser illuminanten FØR huden måles.** ✅ `ChromaticAdaptation` (CAT02):
mål → D65 via kromatisk adaptasjon, så huden måles «i nøytralt lys» før sammenligning.
🔑 **Esset ingen edit-app har:** EXIF/telemetri VET lyset — CIRAWFilters as-shot
`neutralTemperature` (K) → hvitpunkt → CAT02→D65, FØR piksler analyseres. Kombiner med
gray-world (`AdaptiveWhiteBalance`); **uenighet = signal om blandet lys → Lag 3.** Korpus-
måling blir `(hud-LAB@D65, estimert illuminant, scene-features)` → «samme person under 6
lyssettinger» kollapser til seks like målinger; gjenstående spredning = ekte måle-usikkerhet.

**Lag 2 — skill korrigerbar cast fra INTENDERT lys.** Ikke alt skal bort — gyllen time skal
være varm. Per scene-klynge: mål hvor mye cast fotografen BEHOLDT i sine egne perfekte
bilder → `sceneTolerances[lys].tolerertCast`. Korreksjon = `(målt cast − lært scene-cast) ×
gain`. Serie på tvers av lysbytte (kirke→reception): E8-ankeret sikrer samme hud, scene-
toleransen lar lyset leve.

**Lag 3 — blandet lys i samme bilde** (vanskeligst, mest verdifullt). Ett globalt WB kan ikke
fikse vindus-side (dagslys) + rom-side (tungsten). Deteksjon: bimodal hud-kromatisitet
(`SkinScope` fanger den) eller per-region/per-ansikt cast (brud nøytral, brudgom varm).
Ærlige ambisjonsnivåer:
- **v1 detektér+informér:** «Blandet lys — WB satt for hud, bakgrunn blir varm»-chip; WB ankret i hovedpersonens hud (E8 + størst ansikt). Mer enn Lightroom gjør.
- **v2 to-sone:** global WB for dominant illuminant + selektiv per-ansikt/​region-korreksjon (= `FaceLocalAdjust`-mekanikk m/ per-region warmth).
- **v3 capture-siden:** HUD «blandet lys — flytt motivet 1 m fra vinduet / gel blitsen CTO» MENS bildet kan tas om — verdt 10× korreksjon etterpå. Blits-EXIF-vakten er halve deteksjonen alt.

> Lys-variasjon er en GAVE for læringen: `observasjon = person-anker × illuminant ×
> fotografens intensjon` — E8 er konstanten, lys-variasjonen lar oss faktorisere ut
> illuminant-responsen, residualet er smak per scene. Ikke filtrer korpuset til «rent» lys.

---

## Sikkerhet: melanin-aksen bevares MATEMATISK

✅ `SkinToTarget` — korreksjonen dekomponeres i (LANGS hud-linja, VINKELRETT) og er en ren
PERPENDIKULÆR translasjon. Langs-komponenten (melanin) og L* er LÅST → systemet kan aldri
lysne/mørkne/endre en persons hudtone, uansett treningsdata. `alongLineChange() ≈ 0` er
test-bevist. Hud-linja empirisk kalibrert: **hue 49°** fra 726 ansikter i faktiske leveranser
(sør-asiatisk + nordisk) — hue nær-konstant, chroma varierer m/ etnisitet (derfor låst).
✅ `ForbiddenZone` — den eneste harde grensen; klemmer hue ut av forbudte soner.

---

## Vectorscope-vaktpost (broadcast-hudlinja, men smart)

✅ `SkinScope.analyze` — gatet hud-hue-sky + LÆRT toleranse-kile (senter/halvbredde fra
per-person-anker + scene-toleranse) → **cast** (median avvik m/ retning), **spread** (MAD),
**fractionOutside**, **bimodal** (to klumper = blandet lys). Skopet OBSERVERER; korreksjonen
bor i kalibratoren → samme tall, kan aldri være uenige.

Gjenstår (billig): behold ~2–4k subsamplede hud-`(hue,chroma)` i `AssetAnalysis` (ett felt,
samme readback) + SwiftUI `Canvas`-skop (polart tetthets-plot + kile-sektor + 3 skalarer;
mønster fra `HistogramChart`) i HUD + ved histogrammet (live per WB-slider-tick) +
**serie-modus** (hver leverte rammes median-hudpunkt m/ tidsfarge → drift-vakt: «WB glidd
300K siden bilde 40»). Feller: mål i samme normaliserte rom som kalibratoren (skop på gradert
preview viser looken, ikke huden); < ~1500 gatede piksler → «for lite hud»; ingen aksjoner
fra skopet selv (kun «Korriger mot linja»-tapp som fyrer kalibratorens betingede korreksjon).

---

## Mat (bevis på at designet er generelt nok)

Enklere enn hud: **tallerkenen er et gratis gråkort** (hvit keramikk/duk → illuminanten MÅLT,
ikke estimert — CAT02 får fysisk anker i nesten hvert bilde); **ingen etisk akse** (kan
kalibrere aggressivt). Annerledes: anker = **memory colors** (grønnere basilikum, rødere
tomat — folk vil ha mat litt forbi virkeligheten, men skarp klippe: +10 % → kunstig/​råtten).
`perClass` med `chromaEnvelope` + `forbiddenZone` (blå på alt, grønn på kjøtt). Læringssløyfe:
**per klient·merkevare** («varm rustikk» vs «clean skandinavisk») — E8-personankerets
kommersielle motpart, byttekostnad etter ~10 leveranser. **«Meny-modus»:** lås tallerken-
normalisert WB fra første godkjente bilde, hold hele serien (40 retter / 3 t synkende dagslys)
— reelt smertepunkt ingen konkurrent løser.

---

## Byggeklosser (status)

| Primitiv | Fil | Status |
|---|---|---|
| WB-normalisering (shades-of-gray, lineær) | `AdaptiveWhiteBalance` | ✅ #1856 |
| Eksponerings-normalisering (motiv-vektet, høylys-trygg) | `AdaptiveExposure` | ✅ #1856 |
| Guided filter (kant-bevarende maske-fjæring) | `GuidedFilter` | ✅ #1858 |
| Melanin-bevarende hud-cast + empirisk linje | `SkinToTarget` | ✅ #1862 |
| CAT02 kromatisk adaptasjon (Lag 1 + EXIF-prior) | `ChromaticAdaptation` | ✅ #1862 |
| Forbudssone (hard grense, generisk) | `ForbiddenZone` | ✅ #1862 |
| Vectorscope-vaktpost (cast/spread/bimodal) | `SkinScope` | ✅ #1862 |
| `CalibrationReference<Anchor>` (generisk struct/EMA) | — | 🟡 design |
| Sky-maske (region, Lag 1 himmel) | — | 🟡 CoreML |
| Scene-tolerert-cast + brand/person-EMA-læring | trener + struct | 🟡 korpus/retrain |
| Vectorscope Canvas + serie-modus | UI | 🟡 view |
| Blandet lys v2/v3 (to-sone + capture-HUD) | pipeline + HUD | 🟡 |

**Wiring til looken** venter (koordinert m/ retrain på normalisert base). Primitivene er
rene + enhetstestede byggeklosser; ingenting endrer looken før wiring-passet.

---

## ⚠️ EMPIRISK FUNN (2026-08-03): blank base-normalisering hjelper IKKE — kamera-WB er alt prioren

Green-lit + kjørt: retrent norwedfilm-v3 på WB+eksponerings-normalisert base (`normalize_base`
= shades-of-gray + median-luma→key), målt A/B mot fotografens leverte bilder (fasit 51.2° hud-hue).
**Resultat: normaliseringen gjorde det verre på alle akser** (hud-hue 26.6° vs gammel 30.7° vs
fasit 51°; konsistens 18.6° STD vs 17.8°; chroma FALT 26.8 vs 31). Isolert på develop-en (uten LUT):

| develop-hud | hue | chroma |
|---|---|---|
| rawpy-develop (kamera as-shot WB alt påført) | **49.8°** | 18.7 |
| + gray-world WB | 60.3° | 18.8 |
| + eksponering-til-key | 59.6° | 21.3 |

🔑🔑 **Develop-en lander hud på 49.8° — rett på linja, konsistent.** Kamera-WB-en ER illuminant-
prioren designet ville ha, alt bakt inn. En blank normalisering oppå = en ANDRE korreksjon:
gray-world overkorrigerer på mettede bryllupsscener (varme lehengaer/dekor → skyver hud +10° gult),
og selv ren eksponering flytter a*/b* (LAB er luminans-avhengig). **Konklusjon: base er ikke
problemet — ikke normaliser hver ramme.** CAT02/EXIF-illuminant-korreksjon skal RESERVERES for
faktisk-feil/blandet WB, GATET av `SkinScope` (cast/bimodal), aldri blankt.

### 🔑🔑 iOS-PRODUKTET ER ALT PÅ PARITET (målt headless på ekte pipeline, samme 6 rammer):

| (samme rammer) | hud-hue | konsistens (STD) | chroma |
|---|---|---|---|
| Levert (fasit) | 51.2° | 11.3° | 30.9 |
| **iOS `LearnedStyle.apply` (produkt)** | **54.0°** | **11.1°** | 34.7 |
| Python-ref (35°-bug) | 40.1° | 14.1° | 38.3 |

Målt ved å kompilere den EKTE iOS-pipelinen headless (`swiftc -O` på `LearnedStyle.swift` +
`LabColorTransfer`/`SkinToneGuardFilter`/`SkinFinishFilter`/`FaceDodgeFilter`/`FaceContext`/
`HighlightRecoveryFilter`, CIRAWFilter-develop, auto-bane = `styles.flatMap{$0.scenes}`) på
portrett-settet → `/private/tmp/harness/skinrun/`. **iOS gjengir alt fotografens hud: hue Δ2.8°,
chroma Δ3.8, konsistens matchet (11.1 vs 11.3).** Det tidligere «chroma-gapet 18.7→31» var på
DEVELOP-en, ikke produktet — LUT+LAB+hud-steget løfter chroma til 34.7 selv. Rest: bitte-liten
varm/mettet overshoot (+2.8°/+3.8) som ligger innenfor fotografens EGEN 11°-varians → å tune den
= å fitte støy (n=6). **Ingen ekte hud/chroma-gap igjen å jakte i produktet.** Bonus-bug:
referanse-rendreren (`arkiv_laert_redigering.py`) hardkoder `skin_line_correct(target=35°)` → drar
hud ned (påvirker kun Python-side-previews/eksport, IKKE iOS-produktet som bruker 49°). Eksperiment-
koden lever i `/tmp/v3train` (NORM_BASE-gate, ikke shippet).

*Research + design-dialog, 2026-08-03.*
