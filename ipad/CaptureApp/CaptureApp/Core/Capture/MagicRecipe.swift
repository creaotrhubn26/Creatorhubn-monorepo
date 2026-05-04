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

    /// Skin-softening strength. 0 = no softening, 1 = heavy.
    /// Below 0.1 is visually inert; above 0.6 is usually too much.
    var skinSmooth: Double

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

    /// Portraits: vibrance preferred over saturation for skin (lifts
    /// background/clothing without overdriving lip/cheek redness).
    /// Mild texture for hair/fabric; zero dehaze (no atmospheric
    /// haze indoors).
    static let portrait = MagicRecipe(
        warmth: 0.10, skinSmooth: 0.30, shadowLift: 0.20, contrast: 0.05, saturation: 0.05,
        highlightRecovery: 0.10, vibrance: 0.10, texture: 0.05, dehaze: 0
    )

    /// Aviation: dehaze is the canonical primary tool for aviation
    /// (industry +50-65). High texture for rivet/lettering/panel-line
    /// definition. Vibrance instead of saturation to lift washed sky
    /// without making airframe colors cartoonish.
    static let aviation = MagicRecipe(
        warmth: -0.30, skinSmooth: 0, shadowLift: 0.25, contrast: 0.30, saturation: 0.05,
        highlightRecovery: 0.30, vibrance: 0.20, texture: 0.30, dehaze: 0.45
    )

    /// Cars + vehicles: deep blacks + paint truth (negative warmth
    /// to compensate Apple bias). Texture for panel-line definition.
    /// Modest vibrance over saturation so paint reads accurate.
    /// Dehaze for outdoor/parking-lot atmospheric softness.
    static let vehicle = MagicRecipe(
        warmth: -0.10, skinSmooth: 0, shadowLift: 0.20, contrast: 0.25, saturation: 0.10,
        highlightRecovery: 0.20, vibrance: 0.15, texture: 0.25, dehaze: 0.20
    )

    /// Food: realism over drama. Vibrance > saturation (industry
    /// consensus: keeps cream sauce white while lifting tomato red).
    /// Light texture for crispy/crusty surfaces. Zero dehaze
    /// (interior food has no atmospheric haze).
    static let food = MagicRecipe(
        warmth: 0.20, skinSmooth: 0, shadowLift: 0.20, contrast: 0.15, saturation: 0.10,
        highlightRecovery: 0.10, vibrance: 0.20, texture: 0.10, dehaze: 0
    )

    /// Landscape: industry recipe — texture +20-40 for foliage,
    /// vibrance for sky/water without going neon, moderate dehaze
    /// for distance haze.
    static let landscape = MagicRecipe(
        warmth: -0.25, skinSmooth: 0, shadowLift: 0.30, contrast: 0.25, saturation: 0.20,
        highlightRecovery: 0.40, vibrance: 0.20, texture: 0.30, dehaze: 0.30
    )

    /// Product: COLOR TRUTH mandate. Vibrance > saturation, but
    /// both small. Zero texture (catalog products want clean, not
    /// crunchy). Zero dehaze (studio).
    static let product = MagicRecipe(
        warmth: -0.10, skinSmooth: 0, shadowLift: 0.10, contrast: 0.10, saturation: -0.05,
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
        warmth: -0.05, skinSmooth: 0, shadowLift: 0.20, contrast: 0.10, saturation: -0.05,
        highlightRecovery: 0.25, vibrance: 0.10, texture: 0.10, dehaze: 0.05
    )

    /// Short chip-strings for the recipe display under the hero. Hides
    /// parameters that are at neutral so we don't clutter the UI with
    /// "Warmth +0%".
    var displayChips: [String] {
        var chips: [String] = []
        if abs(warmth) >= 0.05 {
            let pct = Int((warmth * 100).rounded())
            chips.append("Warmth \(pct > 0 ? "+" : "")\(pct)%")
        }
        if skinSmooth >= 0.05 {
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
        return chips
    }

    var isNeutral: Bool {
        warmth == 0 && skinSmooth == 0 && shadowLift == 0
            && contrast == 0 && saturation == 0 && highlightRecovery == 0
            && vibrance == 0 && texture == 0 && dehaze == 0
    }
}
