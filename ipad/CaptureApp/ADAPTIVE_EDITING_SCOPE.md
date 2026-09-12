# Adaptiv redigering — scope oppå det som finnes

**Mål:** gjøre CaptureApp-redigeringen genuint *adaptiv per bilde* (som Imagen/Aftershoot/
Radiant/Evoto/Narrative), i stedet for dagens **globale LUT-look** som stemples likt på hele
rammen uansett innhold.

**Rot-diagnose (verifisert i kode + på ekte bilder):** `LearnedStyle.apply()` mater den globale
per-kanal-LUT-en + LAB-skift en base som er auto-lyset (`autoBrightBase`) men **ikke
hvitbalanse-nøytralisert**, **ikke motiv-eksponerings-normalisert**, og **uten region-masker**.
Derfor: en blå himmel blir beige, grønt blir flatt — portrett-graden påføres landskap. Det er
ikke en bug; det er at redigeringssteget **ikke bruker analysen appen alt regner ut**
(`AssetAnalysis`: personmaske, ansikter, skinCast, motiv-luma/klipp).

---

## Prinsippet hele bransjen konvergerer på

> **Normaliser hvert bilde FØRST (WB → eksponering/tone til en nøytral, keyet base), så
> stiliser (LUT), så region-grade med FERSKE per-bilde-masker, så hud-mot-mål, så finish.**

Kilder (utvalg):
- Aftershoot om hvorfor flate presets feiler: kopierer eksakte settings «without regard to
  over/under-exposed images, wildly inaccurate white balance… differences in natural lighting».
  ([fstoppers](https://fstoppers.com/reviews/batch-edit-your-session-quickly-aftershoot-instant-ai-profiles-713065),
  [aftershoot](https://aftershoot.com/blog/what-are-ai-presets/))
- Radiant Photo: adaptiv korreksjon legger til *ulik* mengde ut fra om bildet alt er kontrastrikt
  eller flatt — «unlike a standard preset that adds a fixed amount to everything».
  ([petapixel](https://petapixel.com/2024/11/25/radiant-photo-2-uses-ai-to-improve-image-editing-without-taking-control-from-photographers/))
- Imagen «Smart Adjustments line up exposure and white balance across changing lighting», så
  stil oppå. ([imagen](https://imagen-ai.com/valuable-tips/image-editing-ai/))
- Lightroom/ON1 Adaptive Presets = **maske regnes på nytt per bilde** + Auto-Tone holdes dynamisk
  (ikke bakt inn). ([shotkit](https://shotkit.com/lightroom-adaptive-presets/),
  [scottdavenport](https://scottdavenportphoto.com/blog/how-to-make-ai-adaptive-presets-in-on1-photo-raw))
- Rekkefølge (korriger før grade): RawTherapee-toolchain gjør WB @ stage 5, tonekurver @ 13–15;
  «correct white balance and adjust exposure *before* the LUT».
  ([RawPedia toolchain](https://rawpedia.rawtherapee.com/Toolchain_Pipeline),
  [Imagen LUT-guide](https://imagen-ai.com/valuable-tips/cinematic-luts/))

---

## Målarkitektur (mot dagens)

```
NÅ:   RAW → CIRAWFilter → autoBrightBase → [GLOBAL LUT + LAB-skift] → hud-finish → ut
MÅL:  RAW → CIRAWFilter
        → (1) WB-NØYTRALISER  (global robust + ansikt-anker)          [normaliser]
        → (2) MOTIV-EKSPONERING til key (motiv-vektet)                [normaliser]
        → (3) LÆRT LUT + LAB   (samme som nå, men nå på nøytral base) [stiliser]
        → (4) REGION-GRADE     (motiv vs himmel vs bakgrunn, fjæret)  [adaptiv]
        → (5) HUD-MOT-MÅL      (skin-line-nudge, adaptiv dodge)       [adaptiv]
        → (6) FINISH           (lokal tone valgfritt, korn, sharpen)  [finish]
```

Rekkefølgen (1→2→3) er den **enkeltviktigste endringen**: LUT-en ble trent på nøytraliserte,
eksponerings-normaliserte bilder, så den lander bare konsistent hvis hvert nytt bilde bringes til
samme nøytrale base *før* LUT-en. (4) er der «adaptiv til innhold» faktisk skjer.

---

## Hva finnes allerede (gjenbruk) vs greenfield

| Stage | Finnes? | Hvor (fil:linje) |
|---|---|---|
| Personmaske (Vision) | ✅ | `SubjectSegmentation.personMask`; `AssetAnalysis.swift` bruker den |
| Ansikts-rekter/landmarks/quality | ✅ | `AssetAnalysis.detectFaces` (+ rektangel-fallback) |
| skinCast (4-klasse) | ✅ grov | `AssetAnalysis` `classifyCast` (R/B, R/G) |
| Motiv-luma / motiv-klipp / motiv-skarphet | ✅ | `AssetAnalysis` `subjectHighlightClip`, `subjectSharpness` |
| Luma-histogram/persentiler | ✅ | `AssetAnalysis` `lumaHistogram`/`percentile`/`clipFractions` |
| Auto-bright base | ✅ global | `LearnedStyle.autoBrightBase` (99-persentil→0.94) |
| Per-kanal LUT + LAB-transfer + Reinhard | ✅ | `LearnedStyle.apply` (CIColorCurves + `LabColorTransfer`) |
| Myk maske-blanding (radial) | ✅ | `SkinToneGuardFilter`, `FaceLocalAdjustFilter` |
| RAW EV (native, pre-demosaic) + warmth | ✅ | `RAWExportPipeline` (`exposure`, `neutralTemperature`) |
| Hud-guard a*≈11 / skin-unify / teeth / tap-to-face | ✅ | `SkinToneGuardFilter`, `SkinToneUnifyFilter`, `FaceLocalAdjustFilter` |
| LAB-math (a*/b*, konvertering) | ✅ | `SkinToneMath` |
| **Kontinuerlig WB-estimat** | ❌ | greenfield (kun cast-enum i dag) |
| **Motiv-vektet eksponerings-normalisering** | ❌ | greenfield (kun global auto-bright) |
| **Himmel-maske** | ❌ | greenfield (Vision har ingen; CoreML DeepLab) |
| **Guided-filter maske-fjæring / region-grade** | ❌ | greenfield (Metal) |
| **Skin-line-nudge mot målhue + adaptiv dodge-target** | ❌ delvis | Python `apply_model` har det; må portes on-device |

**Konklusjon:** analysen (masker, ansikter, klipp, cast) finnes alt. Gapet er at
redigeringssteget ikke *bruker* den, pluss tre greenfield-primitiver: kontinuerlig WB, himmel-maske
(CoreML), og en Metal guided-filter for fjæret region-grade.

---

## Faseplan (verdi/innsats-rekkefølge)

### Fase 0 — Reorder til «normaliser før stiliser» + motiv-vektet base  *(mest gjenbruk, størst gevinst)*
- Erstatt/utvid `autoBrightBase` med **motiv-vektet eksponerings-key**: bruk `subjectLuma`/
  `medianLuma`/`p95Luma` fra `AssetAnalysis` → skaler så *motivet* (ikke hele rammen) treffer key
  (~0.18–0.23 middelgrå på RAW). Motlys-brud mot lys himmel eksponeres da riktig.
  Metode: key/mean-luma targeting, motiv-vektet. ([RawPedia Exposure](https://rawpedia.rawtherapee.com/Exposure),
  [Opsenica auto-exposure](https://bruop.github.io/exposure/))
- **WB-nøytraliser før LUT** (to lag): (a) robust global — *shades-of-gray (p≈5)* eller *gray-edge*
  (billig: `CIAreaAverage` (+Sobel) → `CIColorMatrix`/`CITemperatureAndTint`); (b) *ansikt-anker* —
  dytt estimatet så målt hud lander på hud-tone-målet. ([darktable color-calibration / gray-edge](https://docs.darktable.org/usermanual/development/en/module-reference/processing-modules/color-calibration/),
  [color-constancy-sammenligning](https://www.diva-portal.org/smash/get/diva2:631476/FULLTEXT01.pdf))
- Kjør LUT + LAB *etter* (1)+(2). Uendret LUT-kode, men nå på nøytral base → looken lander konsistent.
- **Innsats:** lav–middels, mest gjenbruk. **Ingen CoreML.** Rører `LearnedStyle.apply` +
  `RedigeringPipeline`/`RAWExportPipeline`. Risiko: må re-verifisere at v3-profilen fortsatt
  matcher (kan trenge lett re-kalibrering av base-key mot trenings-develop — jf. `base-align`-fella).

### Fase 1 — Region-bevisst grade (det som redder himmel/grønt)  *(kjernen i «adaptiv»)*
- Masker: **motiv/person** (har `SubjectSegmentation`) + **himmel** (ny CoreML DeepLabV3 eller
  dedikert himmel-modell — Vision har ingen himmel-API). ([DeepLabV3→CoreML](https://github.com/IlyaKrotov/iOS-Object-Segmentation))
- **Fjær maskene med en Metal guided filter** (joint-upsample lav-oppløst Vision-maske → skarp
  full-res matte, halo-fri). ([He et al. Guided Filter](https://link.springer.com/content/pdf/10.1007/978-3-642-15549-9_1.pdf),
  [Fast Guided Filter](https://arxiv.org/pdf/1505.00996))
- Påfør portrett-graden primært på motiv; gi himmel/bakgrunn en mildere/annen behandling
  (unngå at bright-airy-warm push gjør blå himmel beige). Bland med `CIBlendWithMask`.
- **Innsats:** middels–høy. **CoreML: himmel-modell.** Ny `RegionGradeFilter` + Metal guided filter.

### Fase 2 — Hud-mot-mål on-device (paritet med Python-finishen)  *(portrett-kvalitet)*
- Port `skin_line_correct` (roter hud mot hud-tone-linjen; chroma-guard) og **adaptiv dodge**
  (dodge-target skalert etter målt ansikts-L*, ikke hardkodet 105) inn i on-device-kjeden. Vi har
  alt `SkinToneGuardFilter` (a*≈11-anker) å bygge på. Masket til fjæret hud-region.
  Mål-geometri: vectorscope skin-line ~123°/+I (LAB ~45°). ([Pixel Valley — skin-tone line](https://pixelvalleystudio.com/pmf-articles/the-skin-tone-line),
  [LAB skin-hue](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7403205))
- **Innsats:** middels. Ingen CoreML. Utvid `SkinToneGuardFilter`/`FaceDodgeFilter` til å ta
  per-ansikt-parametre fra `AssetAnalysis`.

### Fase 3 — Lokal tone (valgfri, tyngre)
- Guided-filter **tone-equalizer** for motiv-vs-bakgrunn-eksponering (løft motlyst ansikt, dsemp
  lys himmel). Reserver **Local Laplacian** til hero-bilder (GPU-tungt).
  ([darktable tone equalizer](https://docs.darktable.org/usermanual/4.6/en/module-reference/processing-modules/tone-equalizer/),
  [Local Laplacian](https://people.csail.mit.edu/sparis/publi/2015/cacm/Paris_15_Local_Laplacian_Filters.pdf))
- **Innsats:** middels (tone-eq) / høy (Laplacian).

### Fase 4 — Lær de adaptive parametrene (lukk løkka)
- Utvid `arkiv_laert_redigering.py`: fra RAW→edit-parene, lær også **per-bilde-regresjoner**
  (EV-offset, WB-korreksjon, dodge-target) — ikke bare den globale LUT-en. Da læres *hvor mye* som
  normaliseres fra fotografens egne redigeringer, ikke hardkodes. (Imagen/Narrative lærer nettopp
  eksponering+WB+HSL per bilde fra katalogen.)
- **Innsats:** middels (Python + profil-format-utvidelse). Ingen device-CoreML.

---

## CoreML/GPU-flagg (ærlig)
- **Fase 0/2/4:** ingen CoreML; klassiske CoreImage/Vision/Metal-primitiver.
- **Fase 1:** krever **himmel-segmentering (CoreML)** + en **Metal guided filter** (billig, fast-variant).
- **Fase 3 Local Laplacian:** GPU-tungt — kun hero.
- Valgfritt: **lært AWB (FFCC/FC⁴, CoreML)** hvis klassisk WB feiler på blandet kirke/blits-lys.
  ([FFCC](https://github.com/google/ffcc), [FC⁴](https://github.com/yuanming-hu/fc4))

## Anbefalt første kutt
**Fase 0 + Fase 2** gir mest per innsats uten CoreML: normaliser-før-stiliser + ekte hud-mot-mål.
Det fjerner «hvorfor ser looken vasket/varm ut»-klassen av problemer og er ren gjenbruk av analysen
vi alt har. **Fase 1** (region + himmel) er så det store adaptive løftet, og trenger én CoreML-modell.

---

*Research-agenter (industri + on-iOS-algoritmer) + kodebase-kartlegging, 2026-08-03. Alle
metode-påstander kildebelagt over.*
