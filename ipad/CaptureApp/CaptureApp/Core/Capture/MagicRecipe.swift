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

    /// Subject-specific factory presets. Picked automatically by
    /// `MagicPipeline` based on Vision classification results, overridable
    /// via the Tune panel. Each recipe's intensities are tuned to what a
    /// retouch editor typically does for that subject — not dramatic.

    static let portrait = MagicRecipe(
        warmth: 0.45, skinSmooth: 0.65, shadowLift: 0.45, contrast: 0.15, saturation: 0.20
    )

    /// Planes + aviation: crisp, cool to fight haze, deep contrast so
    /// rivets and markings pop against the sky.
    static let aviation = MagicRecipe(
        warmth: -0.25, skinSmooth: 0, shadowLift: 0.30, contrast: 0.55, saturation: 0.40
    )

    /// Cars + vehicles: punch the bodywork colour, deep shadows for
    /// metal, warm highlights for chrome.
    static let vehicle = MagicRecipe(
        warmth: 0.15, skinSmooth: 0, shadowLift: 0.20, contrast: 0.50, saturation: 0.55
    )

    /// Food: warm golden-hour tint, gentle shadow lift, heavy saturation
    /// bump on reds/oranges. Avoid skin-style softening.
    static let food = MagicRecipe(
        warmth: 0.60, skinSmooth: 0, shadowLift: 0.40, contrast: 0.30, saturation: 0.50
    )

    /// Landscape: punchy everything, cool toward blue to emphasise
    /// sky and water.
    static let landscape = MagicRecipe(
        warmth: -0.15, skinSmooth: 0, shadowLift: 0.45, contrast: 0.50, saturation: 0.55
    )

    /// Product on white/studio background: minimal warmth shift, clean
    /// shadow recovery, tasteful contrast, honest saturation.
    static let product = MagicRecipe(
        warmth: 0.10, skinSmooth: 0, shadowLift: 0.30, contrast: 0.30, saturation: 0.15
    )

    /// Fallback when nothing classifies confidently.
    static let neutral = MagicRecipe(
        warmth: 0.35, skinSmooth: 0, shadowLift: 0.30, contrast: 0.25, saturation: 0.30
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
        return chips
    }

    var isNeutral: Bool {
        warmth == 0 && skinSmooth == 0 && shadowLift == 0 && contrast == 0 && saturation == 0
    }
}
