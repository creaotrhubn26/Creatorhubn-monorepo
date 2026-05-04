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

    /// Portraits: small warm nudge (+0.10 ≈ +90K above Apple's
    /// already-warm baseline = ~+250K total — Adobe Lightroom
    /// portrait territory). Skin smoothing held at 0.30 — only
    /// fires when subject classifier is confident; auto-classifier
    /// false-positives on food / objects shouldn't blur texture.
    /// Highlight recovery 0.10 (was 0.30 — over-aggressive caused
    /// loss of catchlight character).
    static let portrait = MagicRecipe(
        warmth: 0.10, skinSmooth: 0.30, shadowLift: 0.20, contrast: 0.05, saturation: 0.05,
        highlightRecovery: 0.10
    )

    /// Aviation: cool to fight haze. -0.30 = stronger cool than
    /// before (was -0.20) since Apple adds warmth, so pre-fight is
    /// needed to get effective cool tilt. Highlight recovery 0.30
    /// (was 0.65 — way too aggressive; sky highlights are bright
    /// BY DESIGN, not clipped accidents).
    static let aviation = MagicRecipe(
        warmth: -0.30, skinSmooth: 0, shadowLift: 0.25, contrast: 0.30, saturation: 0.10,
        highlightRecovery: 0.30
    )

    /// Cars + vehicles: NEUTRAL warmth target. Apple adds ~+10 RGB
    /// warmth, so we offset -0.10 to land at TRUE neutral (color
    /// truth on bodywork). Lower saturation (0.15 was 0.55) — Apple
    /// already adds saturation, more would falsify paint colour.
    /// Highlight recovery 0.20 (chrome + glass).
    static let vehicle = MagicRecipe(
        warmth: -0.10, skinSmooth: 0, shadowLift: 0.20, contrast: 0.25, saturation: 0.15,
        highlightRecovery: 0.20
    )

    /// Food: warm bias still appropriate (appetizing) but moderated.
    /// +0.20 = ~+180K above Apple's baseline = ~+330K total = real
    /// golden-hour tint without going pumpkin-orange. Saturation
    /// +0.20 (was +0.55 — caused white sauce to lose its character).
    /// Highlight recovery 0.10 (was +0.55 — preserved bright sauce
    /// gleam IS the shot, don't pull it down).
    static let food = MagicRecipe(
        warmth: 0.20, skinSmooth: 0, shadowLift: 0.20, contrast: 0.15, saturation: 0.20,
        highlightRecovery: 0.10
    )

    /// Landscape: keep cool tilt direction but stronger compensation
    /// for Apple's warmth. -0.25 = fights ~+10 RGB warmth + adds
    /// real cool. Saturation +0.30 (was +0.60). Highlight recovery
    /// 0.40 (was 0.70 — sky bright-but-not-clipped should stay
    /// bright).
    static let landscape = MagicRecipe(
        warmth: -0.25, skinSmooth: 0, shadowLift: 0.30, contrast: 0.25, saturation: 0.30,
        highlightRecovery: 0.40
    )

    /// Product: TRUE neutral target. Apple-bias offset of -0.10
    /// warmth, zero saturation lift, light shadow nudge. Highlight
    /// recovery 0.10 (catalog backgrounds stay clean).
    static let product = MagicRecipe(
        warmth: -0.10, skinSmooth: 0, shadowLift: 0.10, contrast: 0.10, saturation: -0.05,
        highlightRecovery: 0.10
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
        highlightRecovery: 0.25
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
        return chips
    }

    var isNeutral: Bool {
        warmth == 0 && skinSmooth == 0 && shadowLift == 0
            && contrast == 0 && saturation == 0 && highlightRecovery == 0
    }
}
