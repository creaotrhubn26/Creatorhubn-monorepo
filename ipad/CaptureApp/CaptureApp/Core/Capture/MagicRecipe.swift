import Foundation

/// Parameterised enhancement recipe — the transparent alternative to an
/// opaque "preset" string. Every parameter is a continuous float with
/// human-meaningful units, so the UI can show the photographer exactly
/// what Magic is doing and let them tune it without resorting to hidden
/// preset switching.
///
/// Scale: each value is 0…1 (or -1…1 for signed params), mapped to real
/// CIFilter inputs by `MagicPipeline.apply`. Store the recipe on-device
/// alongside the asset; the same shape ships to the backend enhancer
/// once the production loop is wired.
struct MagicRecipe: Sendable, Equatable, Codable {
    /// Color temperature shift. Positive = warmer (toward amber).
    /// Real-world range: -500K…+500K. We display as "Warmth ±%".
    var warmth: Double

    /// Green↔magenta white-balance correction. Temperature cannot remove the
    /// green cast from fluorescent/LED fixtures on its own, so tint is a
    /// separate, reversible axis. Range -1…+1 (green…magenta).
    var tint: Double = 0

    /// **Phase 7 (Evoto parity)** — High-frequency skin axis. Controls
    /// pore + micro-texture *detail* independent of tone smoothing.
    /// Bidirectional like Evoto's "High Frequency" slider:
    ///   -1 → blur micro-texture (CIBilateralFilter narrow radius)
    ///    0 → preserve as-shot
    ///   +1 → enhance pore/skin-detail (CIUnsharpMask radius ≈1.5px)
    /// Pair with `skinLowFreq` for true frequency-separation control:
    /// e.g. `skinLowFreq +0.4, skinHighFreq +0.2` = smooth tone with
    /// pore detail preserved (industry "natural retouch" recipe).
    var skinHighFreq: Double = 0

    /// **Phase 7 (Evoto parity)** — Low-frequency skin axis. Controls
    /// tone smoothing + colour-blotch evenness without touching pore
    /// texture. Bidirectional like Evoto's "Low Frequency" slider:
    ///   -1 → enhance facial structure (subtle contrast bump on
    ///        broad tonal areas)
    ///    0 → preserve as-shot
    ///   +1 → smooth tone (CIRAWFilter luminanceNoiseReduction +
    ///        CINoiseReduction sharpness=0.7 to keep edges)
    /// Industry consensus (Evoto support, Jana Kukebal review,
    /// Fstoppers): keep this ≤0.5 for natural look. >0.7 reads
    /// "plastic / cartoon".
    var skinLowFreq: Double = 0

    /// Legacy axis — single-slider skin softening. Pre-Phase-7 shape;
    /// retained for JSON-wire backwards-compat with backend builds
    /// that still emit `skinSmooth`. Reads as `skinLowFreq` only
    /// (no high-freq detail preservation), so legacy recipes get the
    /// pre-Phase-7 behaviour: tone smoothing without texture rebuild.
    /// New code paths set `skinSmooth = 0` and use the two new axes
    /// directly. UI does not expose this slider any more.
    var skinSmooth: Double = 0

    /// Shadow-lift strength. 0 = no lift, 1 = full recovery.
    var shadowLift: Double

    /// Tone-curve contrast. -1…+1 around neutral 1.0.
    var contrast: Double

    /// Saturation bump. -1…+1.
    var saturation: Double

    /// Highlight recovery — pulls down clipped/near-clipped highlights
    /// using a tone-curve roll-off in linear scene-referred space, plus
    /// CIRAWFilter's native isHighlightRecoveryEnabled when supported.
    /// 0 = no recovery; 1 = aggressive (≈1.5 stops of headroom recovered
    /// for blown skies / window light / specular hits on bread crust).
    /// Most useful in food + interior + harsh-sun work; subtle for
    /// portraits.
    var highlightRecovery: Double = 0

    /// **Phase 6** — Vibrance. Maps to `CIVibrance` which boosts dull
    /// colors more than already-saturated ones. Photographer pros prefer
    /// this over global saturation for food + product because it keeps
    /// already-vivid sauce/paint/fabric from going neon while lifting
    /// muted background or skin tones.
    /// Range -1…+1: -1 = compress vibrance toward grey, 0 = no change,
    /// +1 = aggressive lift. Applied AFTER saturation in the pipeline.
    var vibrance: Double = 0

    /// **Phase 6** — Texture. Mid-frequency local-contrast boost via
    /// `CIUnsharpMask` with a wide radius (~25px). Industry tool for
    /// landscape (foliage detail), vehicle (panel lines), aviation
    /// (rivet definition). Distinct from `contrast` (global tone curve)
    /// and from `skinSmooth` (which uses noise reduction at narrow
    /// radius). Range 0…1: 0 = no boost, 1 = aggressive (>+0.5 starts
    /// looking crunchy / halo-ridden per Lightroom community advice).
    var texture: Double = 0

    /// **Phase 7D (Evoto parity)** — Teeth whitening, masked to the
    /// `innerLips` polygon from `VNDetectFaceLandmarksRequest`. Inside
    /// the mask: cool the white point ~800 K + saturation drop +
    /// luminance lift, scaled by amount. Industry rule (Adobe Phlearn
    /// SLR Lounge, 2026 consensus): never max out — teeth naturally
    /// have some yellow; pure white reads "TV-anchor plastic". Pros
    /// stay 0.20–0.40. Default portrait preset = 0.20.
    /// Range 0…1: 0 = no whitening, 1 = aggressive.
    var teethWhiten: Double = 0

    /// **Phase 7E (Evoto parity)** — Subject-type variant. Layered on
    /// top of the portrait base via `subjectTypeAdjustment`. Per
    /// industry retouching guides (Retouching Academy / Fstoppers /
    /// Imagen 2026):
    ///   - male: less smoothing, more midtone clarity ("rugged")
    ///   - female: more smoothing, mild warmth
    ///   - child: light smoothing, mild vibrance lift
    ///   - elderly: minimal smoothing (preserve wisdom-lines), more
    ///              skin-tone unify, mild warmth
    ///   - none: no overlay (default)
    var subjectType: SubjectType = .none

    enum SubjectType: String, Sendable, Codable, CaseIterable {
        case none, male, female, child, elderly
    }

    /// A photographer-facing starting point for the portrait controls. `custom`
    /// is persisted as soon as an individual portrait slider is changed; the
    /// three named levels remain reproducible across preview and RAW export.
    enum PortraitRetouchLevel: String, Sendable, Codable, CaseIterable {
        case custom, natural, clean, maximum
    }

    /// **Phase 7F (Evoto parity)** — Skin-tone unify (face↔body).
    /// Samples mean skin tone in the face Vision rect + samples
    /// non-face skin pixels (neck/hands/arms), computes the colour
    /// delta, and applies a partial correction to bring body skin
    /// into line with face skin. Particularly useful when hands
    /// read redder than face (cold-hand bias) or neck reads more
    /// yellow than face. Range 0…1: 0 = no correction, 1 = full
    /// shift toward face reference (industry: 0.30–0.50 typical).
    var skinUnify: Double = 0

    /// Evens local red/yellow/magenta colour variation while preserving the
    /// original luminance channel. This is intentionally separate from skin
    /// smoothing: pores, freckles and facial modelling live primarily in
    /// luminance and must not disappear merely because colour is corrected.
    var skinDiscoloration: Double = 0

    /// Selective small-spot cleanup inside detected facial skin. Unlike the
    /// low-frequency skin control this only blends pixels that differ markedly
    /// from a local median, so pores and stable facial features remain intact.
    var blemishCleanup: Double = 0

    /// Local dodge & burn: compresses uneven facial illumination with a soft,
    /// feature-protected mask while retaining the overall exposure and shape.
    var dodgeBurn: Double = 0

    /// Tames specular forehead/cheek/nose highlights inside the skin mask.
    var shineControl: Double = 0

    /// Subtle lift beneath detected eyes. The eye itself, brows and lashes are
    /// excluded; this is not eye enlargement or identity manipulation.
    var underEyeLift: Double = 0

    /// Expands protection around eyes, brows and lips when smoothing or local
    /// tone work is active. Useful for preserving makeup colour and edges.
    var makeupProtection: Double = 0.75

    /// Conservative by default. When enabled, automatic cleanup uses a stricter
    /// anomaly threshold and a bounded repair mix so stable freckles, moles and
    /// other identity marks are not silently erased. The photographer can turn
    /// it off explicitly for a stronger cleanup and inspect the retouch map.
    var preserveIdentityMarks: Bool = true

    /// Records which reproducible portrait starting point was selected. Manual
    /// changes move this to `.custom`; it does not alter rendering by itself.
    var portraitRetouchLevel: PortraitRetouchLevel = .custom

    /// **Phase 7C** — Auto-straighten via `VNDetectHorizonRequest`.
    /// When true, detection runs on a 1024-px-downsample of the image
    /// and `CIStraightenFilter` applies the result. When detection
    /// fails (no clear horizon, low confidence, |angle|>15°), the
    /// image passes through and `straightenAngle` (if non-zero) is
    /// used as a manual fallback. Default false — pros don't want
    /// auto-straighten silently rotating studio/product/portrait
    /// frames; landscape/aviation/vehicle presets enable it.
    var autoStraighten: Bool = false

    /// Apple scene auto-enhance (`CIImage.autoAdjustmentFilters` med `.enhance`).
    /// Gir en ren, farge-nøytral baseline for RÅ/kamera-JPEG-fangst før recipe-
    /// justeringene legges på. Men på ALLEREDE ferdig-gradede/leverte bilder
    /// dobbelt-prosesserer den (over-metter, re-kontrasterer, flytter farge) og
    /// bør slås AV. Default true (bevarer fangst-oppførsel); korrigerende
    /// finishing-presets (f.eks. ``wedding``) setter false.
    var autoEnhance: Bool = true

    /// Hud-tone-guard-styrke (0…1). Forankrer hudens rødhet (Lab a*) mot den
    /// etnisitets-invariante ~10–11 uten å røre L*/b* — fikser både grønn/gjørmete
    /// (sør-asiatisk/mørk hud i blandet lys) og oransje (lys hud i varmt lys).
    /// Se ``SkinToneGuardFilter``. Default 0 (av).
    var skinGuard: Double = 0

    /// Film-korn-styrke (0…1). Dempet organisk korn som soft-light-finish — en
    /// av de mest taktile «film»-tellene. Se ``FilmGrainFilter``. Default 0.
    var filmGrain: Double = 0

    /// **Phase 7C** — Manual horizon angle, in radians. Range
    /// effectively ±0.2618 (±15°) — beyond that the straighten tool
    /// stops; use the regular crop+rotate UI for dutch tilts. Used as
    /// fallback when `autoStraighten` fails or as override when the
    /// photographer drags the angle slider in the Tune panel.
    /// Sign convention: positive = rotate counter-clockwise, matches
    /// `CIStraightenFilter` and `VNHorizonObservation.angle`.
    var straightenAngle: Double = 0

    /// **Phase 7B (Evoto parity)** — Eye sharpening. Detects eyes via
    /// `CIDetector` face landmarks (`leftEyePosition` + `rightEyePosition`),
    /// builds a soft radial-gradient mask around each, applies a
    /// narrow-radius `CIUnsharpMask` (radius 2.5px) limited to that
    /// region via `CIBlendWithMask`. Iris detail + lash definition pop
    /// without sharpening the rest of the face.
    /// Range 0…1: 0 = no eye sharpening, 1 = aggressive (>0.5 reads
    /// "crispy / artificial"; pros usually 0.20–0.40 for portraits).
    /// No-op when no faces are detected (eyes closed, deep shadow,
    /// extreme angle) — never sharpens at the wrong location.
    var eyeSharpen: Double = 0

    /// **Phase 7B (Evoto parity)** — Catch-light boost. Same detection
    /// + masking path as `eyeSharpen`, but applies `CIExposureAdjust`
    /// (up to ~+0.4 EV inside the eye region) to brighten specular
    /// highlights and lift the iris colour. Photographers reach for
    /// this when window-light catch-lights are weak (overcast outdoor,
    /// indoor mixed light).
    /// Range 0…1: 0 = no boost, 1 = strong (>0.6 starts looking
    /// flashlight-in-the-eye; pros stick to 0.15–0.30).
    /// No-op when no faces detected.
    var eyeCatchlight: Double = 0

    /// **Phase 6** — Dehaze proxy. Apple has no native dehaze CIFilter,
    /// so we approximate via coordinated nudges to contrast + saturation
    /// + shadow lift, all inside this single axis. Range 0…1: 0 = no
    /// dehaze, 1 = strong (industry-standard +50-65 typical for
    /// aviation). Useful for outdoor work with atmospheric haze, distant
    /// landscapes, smoky/dusty interiors. Applied as an ADDITIVE nudge
    /// on top of the recipe's other axes — your `contrast: 0.30` plus a
    /// `dehaze: 0.40` combine to a noticeably-punchy-but-still-natural
    /// look. Stay below +0.50 unless the haze is really bad (over +0.70
    /// produces the over-cooked / HDR-disaster look).
    var dehaze: Double = 0

    /// Removes residual purple/magenta chromatic aberration only where colour
    /// coincides with a luminance edge. This deliberately leaves broad purple
    /// objects alone; it is a cleanup tool, not a global hue replacement.
    var defringe: Double = 0

    /// Selectively restrains dominant foliage greens without reducing skin or
    /// neutral colours. Useful for outdoor portraits where global vibrance can
    /// otherwise make grass and leaves compete with the subject.
    var greenControl: Double = 0

    /// Non-generative person separation. Vision supplies a soft person mask;
    /// only the background receives a small exposure/saturation reduction.
    var subjectSeparation: Double = 0

    /// Subject-specific factory presets. Picked automatically by
    /// `MagicPipeline` based on Vision classification results, overridable
    /// via the Tune panel. Each recipe's intensities are tuned to what a
    /// retouch editor typically does for that subject — not dramatic.

    /// **Audit-recalibrated 2026-05-04** — all presets now compensate
    /// for Apple's CIRAWFilter built-in warm + saturated bias (~+10
    /// RGB warmth + ~+7 saturation, measured against Canon's own
    /// embedded JPEG preview). Pre-recalibration values were stacking
    /// on top of Apple's bias → real-world food photos came out
    /// notably orange and over-saturated (visible bright-sauce-loses-
    /// white character, "63%"-style highlight clipping). Fix: small
    /// direction-vector deltas, zero or negative warmth on subjects
    /// where color truth matters, lowered highlight recovery so
    /// bright-by-intent areas (sauce gleam, white-on-white, sky
    /// haze) keep their character.
    ///
    /// Ground-truth methodology: extract Canon-baked preview via
    /// `exiftool -PreviewImage -b file.CR3 > canon.jpg`, render
    /// `.CR3` through Apple `sips -s format jpeg`, sample 5 pixel
    /// positions with ImageMagick, compute mean RGB delta. Repeat
    /// per-body for camera-specific bias (R5 / R5 mkII may differ).

    /// Portrait Natural — deliberately conservative. Camera/display JPEGs have
    /// already received a picture style, so Apple's scene auto-enhance used to
    /// grade them a second time before adding positive warmth. On real faces that
    /// stacked into the orange result caught by the portrait visual regression.
    ///
    /// The factory look now protects identity and skin texture by default while
    /// still landing like a professionally finished portrait:
    ///   - no opaque scene auto-enhance / double white-balance
    ///   - cool-neutral global colour with a masked skin guard
    ///   - a deliberate black/midtone anchor instead of lifted, milky shadows
    ///   - selective vibrance for colour separation without orange skin
    ///   - modest low-frequency evening and a smaller pore-detail restore
    ///
    /// Stronger beauty work remains available as explicit, reversible controls in
    /// the Portrait section of the editor rather than being baked into one click.
    static let portrait = MagicRecipe(
        warmth: -0.18, skinHighFreq: 0.12, skinLowFreq: 0.20, shadowLift: 0.02,
        contrast: 0.27, saturation: 0,
        highlightRecovery: 0.58, vibrance: 0.24, texture: 0.07, dehaze: 0.03,
        defringe: 0.85, greenControl: 0.48, subjectSeparation: 0.42,
        eyeSharpen: 0.20, eyeCatchlight: 0.11, autoEnhance: false, skinGuard: 0.82,
        teethWhiten: 0.10, skinUnify: 0.18, skinDiscoloration: 0.15,
        blemishCleanup: 0.16, dodgeBurn: 0.12, shineControl: 0.10,
        underEyeLift: 0.08, makeupProtection: 0.85,
        preserveIdentityMarks: true, portraitRetouchLevel: .natural
    )

    /// **Bryllup / varmt lys** — KORRIGERENDE reportasje-grade for tungsten- og
    /// mikset venue-lys, kalibrert mot bransjestandard for bryllupsredigering
    /// (Lightroom-workflow fra profesjonelle bryllupsfotografer):
    ///   • temp mot blå (`warmth -0.35`) — nøytraliser oransjestikket i stedet
    ///     for å ADDERE varme (den vanligste nybegynnerfeilen på tungsten-lys)
    ///   • høylys-gjenoppretting `0.42` (LR «Highlights −10…−40») — hent tilbake
    ///     utbrente detaljer i kjoler/vindus-/spotlys
    ///   • skyggeløft `0.22` (LR «Shadows +10…+35») for den store dynamikken
    ///   • kontrast `0.12` (LR «Contrast 0…+15») — mild, ikke knivskarp
    ///   • `vibrance 0.18` (LR «+10…+25») som BESKYTTER hud, kombinert med
    ///     `saturation -0.08` (LR «−5…+5») som demper den oransje hud-over-
    ///     metningen — bransjekonsensus: vibrance > saturation for hud
    ///   • lett hud-frekvensseparasjon (høyfrekvent detalj bevart, lavfrekvent
    ///     tone ≤0.5 = «natural retouch», aldri plast)
    /// **Auto-enhance AV** — bildet skal graderes bevisst, ikke re-prosesseres
    /// av Apples scene-auto-enhance (det doble-prosesserer ferdige/leverte JPEG-er).
    static let wedding = MagicRecipe(
        warmth: -0.35, skinHighFreq: 0.12, skinLowFreq: 0.18, shadowLift: 0.22,
        contrast: 0.12, saturation: -0.08,
        highlightRecovery: 0.42, vibrance: 0.18, texture: 0.05, dehaze: 0,
        eyeSharpen: 0.22, eyeCatchlight: 0.15, autoEnhance: false, skinGuard: 0.7,
        teethWhiten: 0.15, skinUnify: 0.22
    )

    /// **Portra Clean** — den rene standard-bryllups/portrett-looken, kalibrert
    /// mot Kodak Portra 400 (bransje-referanse): svakt varm (+~200K), myk
    /// høylys-skulder, skygge-løft til varm grå, DEMPET metning m/ vibrance som
    /// beskytter hud (film-standard: vibrance > saturation), fint korn. Hud-guard
    /// på så «kremaktige» høylys ikke tipper til oransje.
    static let portraClean = MagicRecipe(
        warmth: 0.15, skinHighFreq: 0.10, skinLowFreq: 0.15, shadowLift: 0.28,
        contrast: 0.08, saturation: -0.08,
        highlightRecovery: 0.35, vibrance: 0.12, texture: 0.05, dehaze: 0,
        eyeSharpen: 0.22, eyeCatchlight: 0.15, skinGuard: 0.6, filmGrain: 0.12,
        teethWhiten: 0.15, skinUnify: 0.20
    )

    /// **Reception Warm** — tungsten/innendørs fest: KORRIGER hvitbalanse mot
    /// nøytral først (håndteres av grunn-render + hud-guard), behold en dus varm
    /// stemning, men beskytt høylys (levende lys/practicals) og TEM oransje hud
    /// hardt. Auto-enhance av (ferdige/leverte bilder). Litt mer korn (dim fest).
    static let receptionWarm = MagicRecipe(
        warmth: -0.05, skinHighFreq: 0.10, skinLowFreq: 0.18, shadowLift: 0.22,
        contrast: 0.12, saturation: -0.10,
        highlightRecovery: 0.55, vibrance: 0.10, texture: 0.05, dehaze: 0,
        eyeSharpen: 0.20, eyeCatchlight: 0.15, autoEnhance: false, skinGuard: 0.8, filmGrain: 0.16,
        teethWhiten: 0.15, skinUnify: 0.25
    )

    /// **Bright & Airy (Fuji 400H)** — lys/luftig fine-art: sterkt skygge-løft
    /// (pastell), flat/lav kontrast, dempede pasteller (høyere metnings-demping),
    /// kjølig-nøytral. Kalibrert mot Fuji Pro 400H (lys-og-luftig-linjen).
    static let brightAiry = MagicRecipe(
        warmth: -0.10, skinHighFreq: 0.08, skinLowFreq: 0.12, shadowLift: 0.38,
        contrast: -0.05, saturation: -0.14,
        highlightRecovery: 0.40, vibrance: 0.05, texture: 0.03, dehaze: 0,
        eyeSharpen: 0.18, eyeCatchlight: 0.12, skinGuard: 0.5, filmGrain: 0.18,
        teethWhiten: 0.12, skinUnify: 0.20
    )

    /// Aviation: dehaze is the canonical primary tool for aviation
    /// (industry +50-65). High texture for rivet/lettering/panel-line
    /// definition. Vibrance instead of saturation to lift washed sky
    /// without making airframe colors cartoonish.
    static let aviation = MagicRecipe(
        warmth: -0.30, shadowLift: 0.25, contrast: 0.30, saturation: 0.05,
        highlightRecovery: 0.30, vibrance: 0.20, texture: 0.30, dehaze: 0.45,
        autoStraighten: true
    )

    /// Cars + vehicles: deep blacks + paint truth (negative warmth
    /// to compensate Apple bias). Texture for panel-line definition.
    /// Modest vibrance over saturation so paint reads accurate.
    /// Dehaze for outdoor/parking-lot atmospheric softness.
    static let vehicle = MagicRecipe(
        warmth: -0.10, shadowLift: 0.20, contrast: 0.25, saturation: 0.10,
        highlightRecovery: 0.20, vibrance: 0.15, texture: 0.25, dehaze: 0.20,
        autoStraighten: true
    )

    /// Food: realism over drama. Vibrance > saturation (industry
    /// consensus: keeps cream sauce white while lifting tomato red).
    /// Light texture for crispy/crusty surfaces. Zero dehaze
    /// (interior food has no atmospheric haze).
    static let food = MagicRecipe(
        warmth: 0.20, shadowLift: 0.20, contrast: 0.15, saturation: 0.10,
        highlightRecovery: 0.10, vibrance: 0.20, texture: 0.10, dehaze: 0
    )

    /// Landscape: industry recipe — texture +20-40 for foliage,
    /// vibrance for sky/water without going neon, moderate dehaze
    /// for distance haze.
    static let landscape = MagicRecipe(
        warmth: -0.25, shadowLift: 0.30, contrast: 0.25, saturation: 0.20,
        highlightRecovery: 0.40, vibrance: 0.20, texture: 0.30, dehaze: 0.30,
        autoStraighten: true
    )

    /// Product: COLOR TRUTH mandate. Vibrance > saturation, but
    /// both small. Zero texture (catalog products want clean, not
    /// crunchy). Zero dehaze (studio).
    static let product = MagicRecipe(
        warmth: -0.10, shadowLift: 0.10, contrast: 0.10, saturation: -0.05,
        highlightRecovery: 0.10, vibrance: 0.05, texture: 0, dehaze: 0
    )

    /// Fallback when subject classification doesn't confidently fire.
    /// **Audit-calibrated 2026-05-04** against Canon's embedded JPEG
    /// preview (the camera's own ground-truth bake) for the Holy
    /// Crust CR3 reference fixture: Apple's `CIRAWFilter` already
    /// runs +5-15 RGB warmer + ~5-9 RGB more saturated than Canon's
    /// in-camera intent (mean delta 4.16/255 = ~1.6%, max single-
    /// pixel delta 77/255). So our pre-audit `warmth +0.20` was
    /// *adding* to Apple's warm bias, pushing further away from
    /// Canon's intent. Calibrated values now slightly cool +
    /// slightly desaturate to compensate, with shadowLift held
    /// because Apple's localToneMap doesn't lift shadows aggressively
    /// enough for indoor mixed lighting.
    ///
    /// Ground-truth methodology: extract Canon-baked preview via
    /// `exiftool -PreviewImage -b file.CR3 > canon.jpg`, render
    /// `.CR3` through Apple `sips -s format jpeg`, sample 5 pixel
    /// positions with ImageMagick, compute mean RGB delta. Repeat
    /// when calibrating against new bodies (R5 / R5 mkII may have
    /// different defaults).
    static let neutral = MagicRecipe(
        warmth: -0.05, shadowLift: 0.20, contrast: 0.10, saturation: -0.05,
        highlightRecovery: 0.25, vibrance: 0.10, texture: 0.10, dehaze: 0.05
    )

    /// Applies only portrait-finishing controls. Global colour, exposure and
    /// camera-profile choices are deliberately left untouched.
    mutating func applyPortraitRetouchLevel(_ level: PortraitRetouchLevel) {
        guard level != .custom else {
            portraitRetouchLevel = .custom
            return
        }

        portraitRetouchLevel = level
        preserveIdentityMarks = true
        switch level {
        case .custom:
            break
        case .natural:
            skinLowFreq = 0.20
            skinHighFreq = 0.12
            blemishCleanup = 0.18
            skinDiscoloration = 0.15
            dodgeBurn = 0.12
            shineControl = 0.10
            underEyeLift = 0.08
            skinUnify = 0.18
            makeupProtection = 0.85
        case .clean:
            skinLowFreq = 0.32
            skinHighFreq = 0.14
            blemishCleanup = 0.48
            skinDiscoloration = 0.38
            dodgeBurn = 0.22
            shineControl = 0.28
            underEyeLift = 0.20
            skinUnify = 0.30
            makeupProtection = 0.90
        case .maximum:
            // Strong, but still identity-safe until the photographer explicitly
            // disables `preserveIdentityMarks` in the editor.
            skinLowFreq = 0.48
            skinHighFreq = 0.16
            blemishCleanup = 0.92
            skinDiscoloration = 0.70
            dodgeBurn = 0.32
            shineControl = 0.45
            underEyeLift = 0.30
            skinUnify = 0.48
            makeupProtection = 0.92
        }
    }

    /// **Phase 7E** — Subject-type modifier deltas. Returned as a
    /// `MagicRecipe`-shaped overlay that callers add to a portrait
    /// base via `merging(baseline:)`. Values calibrated to industry
    /// retouching guides (Retouching Academy / Fstoppers / Imagen
    /// 2026) — small magnitude, just enough to nudge the look.
    var subjectTypeAdjustment: MagicRecipe {
        switch subjectType {
        case .none:
            return MagicRecipe()
        case .male:
            // Less smoothing (preserve texture/character lines), more
            // midtone clarity, slightly cooler — "rugged not pretty".
            return MagicRecipe(
                warmth: -0.03,
                skinHighFreq: 0.10,   // restore pore detail
                skinLowFreq: -0.10,   // less tone smoothing
                contrast: 0.05,
                texture: 0.10,
                teethWhiten: -0.05,   // pros say less aggressive on men
                skinUnify: -0.05      // skin variation reads as character
            )
        case .female:
            // More tone smoothing, slight extra warmth, softer skin.
            return MagicRecipe(
                warmth: 0.03,
                skinLowFreq: 0.05,    // extra tone smoothing
                vibrance: 0.05,       // lift makeup colours subtly
                skinUnify: 0.10
            )
        case .child:
            // Light touch — preserve childhood character, mild
            // vibrance lift for skin, no aggressive smoothing.
            return MagicRecipe(
                warmth: 0.02,
                skinLowFreq: -0.05,   // children's skin is already smooth
                vibrance: 0.05,
                eyeCatchlight: 0.05,  // bright catch-lights pop on kids
                teethWhiten: -0.05    // baby teeth are naturally white
            )
        case .elderly:
            // Preserve wisdom-lines (less smoothing), more skin-tone
            // unify (older skin often has uneven blotches), mild
            // warmth, less aggressive teeth (yellowing is age-natural).
            return MagicRecipe(
                warmth: 0.04,
                skinHighFreq: 0.05,   // keep pore detail
                skinLowFreq: -0.10,   // KEEP wrinkles
                teethWhiten: -0.10,   // don't over-whiten elderly teeth
                skinUnify: 0.20       // even out blotchy areas
            )
        }
    }

    /// Short chip-strings for the recipe display under the hero. Hides
    /// parameters that are at neutral so we don't clutter the UI with
    /// "Warmth +0%".
    var displayChips: [String] {
        var chips: [String] = []
        if abs(warmth) >= 0.05 {
            let pct = Int((warmth * 100).rounded())
            chips.append("Warmth \(pct > 0 ? "+" : "")\(pct)%")
        }
        if abs(tint) >= 0.05 {
            let pct = Int((tint * 100).rounded())
            chips.append("Tint \(pct > 0 ? "+" : "")\(pct)%")
        }
        if abs(skinHighFreq) >= 0.05 {
            let pct = Int((skinHighFreq * 100).rounded())
            chips.append("Skin Detail \(pct > 0 ? "+" : "")\(pct)%")
        }
        if abs(skinLowFreq) >= 0.05 {
            let pct = Int((skinLowFreq * 100).rounded())
            chips.append("Skin Tone \(pct > 0 ? "+" : "")\(pct)%")
        }
        if skinSmooth >= 0.05 {
            // Legacy axis — only fires when wire payload still uses
            // the pre-Phase-7 single skinSmooth field.
            chips.append("Skin \(Int((skinSmooth * 100).rounded()))%")
        }
        if shadowLift >= 0.05 {
            chips.append("Shadows +\(Int((shadowLift * 100).rounded()))%")
        }
        if abs(contrast) >= 0.05 {
            let pct = Int((contrast * 100).rounded())
            chips.append("Contrast \(pct > 0 ? "+" : "")\(pct)%")
        }
        if abs(saturation) >= 0.05 {
            let pct = Int((saturation * 100).rounded())
            chips.append("Saturation \(pct > 0 ? "+" : "")\(pct)%")
        }
        if highlightRecovery >= 0.05 {
            chips.append("Highlights -\(Int((highlightRecovery * 100).rounded()))%")
        }
        if abs(vibrance) >= 0.05 {
            let pct = Int((vibrance * 100).rounded())
            chips.append("Vibrance \(pct > 0 ? "+" : "")\(pct)%")
        }
        if texture >= 0.05 {
            chips.append("Texture +\(Int((texture * 100).rounded()))%")
        }
        if dehaze >= 0.05 {
            chips.append("Dehaze +\(Int((dehaze * 100).rounded()))%")
        }
        if defringe >= 0.05 {
            chips.append("Defringe \(Int((defringe * 100).rounded()))%")
        }
        if greenControl >= 0.05 {
            chips.append("Green control \(Int((greenControl * 100).rounded()))%")
        }
        if subjectSeparation >= 0.05 {
            chips.append("Subject separation \(Int((subjectSeparation * 100).rounded()))%")
        }
        if eyeSharpen >= 0.05 {
            chips.append("Eye Sharpen +\(Int((eyeSharpen * 100).rounded()))%")
        }
        if eyeCatchlight >= 0.05 {
            chips.append("Catch-light +\(Int((eyeCatchlight * 100).rounded()))%")
        }
        if autoStraighten {
            chips.append("Auto-straighten")
        }
        if abs(straightenAngle) >= 0.005 {
            // Convert radians → degrees with 1 decimal place
            let deg = straightenAngle * 180.0 / .pi
            chips.append(String(format: "Straighten %+.1f°", deg))
        }
        if teethWhiten >= 0.05 {
            chips.append("Teeth +\(Int((teethWhiten * 100).rounded()))%")
        }
        if skinUnify >= 0.05 {
            chips.append("Skin Unify +\(Int((skinUnify * 100).rounded()))%")
        }
        if skinDiscoloration >= 0.05 {
            chips.append("Discoloration −\(Int((skinDiscoloration * 100).rounded()))%")
        }
        if blemishCleanup >= 0.05 {
            chips.append("Blemishes −\(Int((blemishCleanup * 100).rounded()))%")
        }
        if dodgeBurn >= 0.05 {
            chips.append("Dodge & Burn +\(Int((dodgeBurn * 100).rounded()))%")
        }
        if shineControl >= 0.05 {
            chips.append("Shine −\(Int((shineControl * 100).rounded()))%")
        }
        if underEyeLift >= 0.05 {
            chips.append("Under-eye +\(Int((underEyeLift * 100).rounded()))%")
        }
        if skinGuard >= 0.05 {
            chips.append("Skin Guard +\(Int((skinGuard * 100).rounded()))%")
        }
        if filmGrain >= 0.05 {
            chips.append("Film Grain +\(Int((filmGrain * 100).rounded()))%")
        }
        if subjectType != .none {
            chips.append("Type: \(subjectType.rawValue.capitalized)")
        }
        return chips
    }

    var isNeutral: Bool {
        warmth == 0 && tint == 0 && skinHighFreq == 0 && skinLowFreq == 0 && skinSmooth == 0
            && shadowLift == 0 && contrast == 0 && saturation == 0
            && highlightRecovery == 0 && vibrance == 0 && texture == 0
            && dehaze == 0 && defringe == 0 && greenControl == 0 && subjectSeparation == 0
            && eyeSharpen == 0 && eyeCatchlight == 0
            && !autoStraighten && straightenAngle == 0
            && teethWhiten == 0 && subjectType == .none && skinUnify == 0
            && skinDiscoloration == 0
            && blemishCleanup == 0 && dodgeBurn == 0 && shineControl == 0
            && underEyeLift == 0
            // skinGuard/filmGrain manglet → en recipe med KUN én av dem ble regnet
            // nøytral, og RAWExportPipeline merget inn Picture Style-baselinen selv
            // om fotografen hadde rørt en slider (mot den dokumenterte regelen).
            && skinGuard == 0 && filmGrain == 0
    }

    // MARK: - Codable (forward-compat decode)

    /// Custom decoder so old persisted recipes (pre-Phase-6 + pre-Phase-7)
    /// don't fail to load when their JSON lacks the newer fields.
    /// Synthesized Codable rejects missing keys even when the property has
    /// a default — we explicitly use `decodeIfPresent` so missing fields
    /// fall back to the property's default value (0 for the new axes).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        warmth = try c.decode(Double.self, forKey: .warmth)
        tint = try c.decodeIfPresent(Double.self, forKey: .tint) ?? 0
        shadowLift = try c.decode(Double.self, forKey: .shadowLift)
        contrast = try c.decode(Double.self, forKey: .contrast)
        saturation = try c.decode(Double.self, forKey: .saturation)
        skinHighFreq = try c.decodeIfPresent(Double.self, forKey: .skinHighFreq) ?? 0
        skinLowFreq = try c.decodeIfPresent(Double.self, forKey: .skinLowFreq) ?? 0
        skinSmooth = try c.decodeIfPresent(Double.self, forKey: .skinSmooth) ?? 0
        highlightRecovery = try c.decodeIfPresent(Double.self, forKey: .highlightRecovery) ?? 0
        vibrance = try c.decodeIfPresent(Double.self, forKey: .vibrance) ?? 0
        texture = try c.decodeIfPresent(Double.self, forKey: .texture) ?? 0
        dehaze = try c.decodeIfPresent(Double.self, forKey: .dehaze) ?? 0
        defringe = try c.decodeIfPresent(Double.self, forKey: .defringe) ?? 0
        greenControl = try c.decodeIfPresent(Double.self, forKey: .greenControl) ?? 0
        subjectSeparation = try c.decodeIfPresent(Double.self, forKey: .subjectSeparation) ?? 0
        eyeSharpen = try c.decodeIfPresent(Double.self, forKey: .eyeSharpen) ?? 0
        eyeCatchlight = try c.decodeIfPresent(Double.self, forKey: .eyeCatchlight) ?? 0
        autoStraighten = try c.decodeIfPresent(Bool.self, forKey: .autoStraighten) ?? false
        autoEnhance = try c.decodeIfPresent(Bool.self, forKey: .autoEnhance) ?? true
        skinGuard = try c.decodeIfPresent(Double.self, forKey: .skinGuard) ?? 0
        filmGrain = try c.decodeIfPresent(Double.self, forKey: .filmGrain) ?? 0
        straightenAngle = try c.decodeIfPresent(Double.self, forKey: .straightenAngle) ?? 0
        teethWhiten = try c.decodeIfPresent(Double.self, forKey: .teethWhiten) ?? 0
        subjectType = try c.decodeIfPresent(SubjectType.self, forKey: .subjectType) ?? .none
        skinUnify = try c.decodeIfPresent(Double.self, forKey: .skinUnify) ?? 0
        skinDiscoloration = try c.decodeIfPresent(Double.self, forKey: .skinDiscoloration) ?? 0
        blemishCleanup = try c.decodeIfPresent(Double.self, forKey: .blemishCleanup) ?? 0
        dodgeBurn = try c.decodeIfPresent(Double.self, forKey: .dodgeBurn) ?? 0
        shineControl = try c.decodeIfPresent(Double.self, forKey: .shineControl) ?? 0
        underEyeLift = try c.decodeIfPresent(Double.self, forKey: .underEyeLift) ?? 0
        makeupProtection = try c.decodeIfPresent(Double.self, forKey: .makeupProtection) ?? 0.75
        preserveIdentityMarks = try c.decodeIfPresent(Bool.self, forKey: .preserveIdentityMarks) ?? true
        portraitRetouchLevel = try c.decodeIfPresent(PortraitRetouchLevel.self, forKey: .portraitRetouchLevel) ?? .custom
    }

    /// Memberwise init — synthesized Codable would consume this slot, so
    /// we restore an explicit memberwise init for call-sites (presets,
    /// `magicRecipe(from wire:)`, `merging`) that build recipes directly.
    init(
        warmth: Double = 0,
        tint: Double = 0,
        skinHighFreq: Double = 0,
        skinLowFreq: Double = 0,
        skinSmooth: Double = 0,
        shadowLift: Double = 0,
        contrast: Double = 0,
        saturation: Double = 0,
        highlightRecovery: Double = 0,
        vibrance: Double = 0,
        texture: Double = 0,
        dehaze: Double = 0,
        defringe: Double = 0,
        greenControl: Double = 0,
        subjectSeparation: Double = 0,
        eyeSharpen: Double = 0,
        eyeCatchlight: Double = 0,
        autoStraighten: Bool = false,
        autoEnhance: Bool = true,
        skinGuard: Double = 0,
        filmGrain: Double = 0,
        straightenAngle: Double = 0,
        teethWhiten: Double = 0,
        subjectType: SubjectType = .none,
        skinUnify: Double = 0,
        skinDiscoloration: Double = 0,
        blemishCleanup: Double = 0,
        dodgeBurn: Double = 0,
        shineControl: Double = 0,
        underEyeLift: Double = 0,
        makeupProtection: Double = 0.75,
        preserveIdentityMarks: Bool = true,
        portraitRetouchLevel: PortraitRetouchLevel = .custom
    ) {
        self.warmth = warmth
        self.tint = tint
        self.skinHighFreq = skinHighFreq
        self.skinLowFreq = skinLowFreq
        self.skinSmooth = skinSmooth
        self.shadowLift = shadowLift
        self.contrast = contrast
        self.saturation = saturation
        self.highlightRecovery = highlightRecovery
        self.vibrance = vibrance
        self.texture = texture
        self.dehaze = dehaze
        self.defringe = defringe
        self.greenControl = greenControl
        self.subjectSeparation = subjectSeparation
        self.eyeSharpen = eyeSharpen
        self.eyeCatchlight = eyeCatchlight
        self.autoStraighten = autoStraighten
        self.autoEnhance = autoEnhance
        self.skinGuard = skinGuard
        self.filmGrain = filmGrain
        self.straightenAngle = straightenAngle
        self.teethWhiten = teethWhiten
        self.subjectType = subjectType
        self.skinUnify = skinUnify
        self.skinDiscoloration = skinDiscoloration
        self.blemishCleanup = blemishCleanup
        self.dodgeBurn = dodgeBurn
        self.shineControl = shineControl
        self.underEyeLift = underEyeLift
        self.makeupProtection = makeupProtection
        self.preserveIdentityMarks = preserveIdentityMarks
        self.portraitRetouchLevel = portraitRetouchLevel
    }

    private enum CodingKeys: String, CodingKey {
        case warmth, tint, skinHighFreq, skinLowFreq, skinSmooth, shadowLift
        case contrast, saturation, highlightRecovery, vibrance, texture, dehaze
        case defringe, greenControl, subjectSeparation
        case eyeSharpen, eyeCatchlight
        case autoStraighten, autoEnhance, skinGuard, filmGrain, straightenAngle
        case teethWhiten, subjectType, skinUnify, skinDiscoloration
        case blemishCleanup, dodgeBurn, shineControl, underEyeLift, makeupProtection
        case preserveIdentityMarks, portraitRetouchLevel
    }
}
