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

    /// Portraits: skin transitions are delicate. Warmth 0.35 = ~315K
    /// nudge toward "natural golden hour" (Adobe Lightroom portrait
    /// preset territory) without veering into orange. Skin smoothing
    /// 0.40 maps to luminance NR amount 0.40 — softens pores without
    /// crossing into plastic-skin uncanny valley (>0.50 starts to
    /// look airbrushed on iPad). Shadow lift gentle so depth around
    /// eyes/nose stays. Contrast deliberately LOW (0.10) — high
    /// contrast on skin reads as harsh + ages the subject. Saturation
    /// muted (0.15) — over-saturated reds register as sunburn rather
    /// than healthy glow. Highlight recovery moderate-aggressive (0.30)
    /// because forehead/cheek highlights are the first thing to clip
    /// in mixed lighting.
    static let portrait = MagicRecipe(
        warmth: 0.35, skinSmooth: 0.40, shadowLift: 0.35, contrast: 0.10, saturation: 0.15,
        highlightRecovery: 0.30
    )

    /// Aviation: cool tint cuts atmospheric haze (-0.20 ≈ -180K, which
    /// fights the warm cast that haze adds at distance). Strong
    /// contrast for rivet/lettering/panel-line definition against
    /// blown-out sky. Moderate saturation — over-saturated airframes
    /// look unnatural. Aggressive highlight recovery (0.65) because
    /// sky is almost always at or beyond clipping in aerial shots.
    static let aviation = MagicRecipe(
        warmth: -0.20, skinSmooth: 0, shadowLift: 0.35, contrast: 0.60, saturation: 0.40,
        highlightRecovery: 0.65
    )

    /// Cars + vehicles: NEUTRAL warmth is critical — bodywork colour
    /// is the entire point of the shot, and a warmth shift falsifies
    /// the buyer's expectation of how the colour reads in person.
    /// Strong contrast for sharp panel lines + deep blacks (paint
    /// depth = perceived quality). Moderate shadow lift so metal
    /// shadows don't go to mush. Heavy saturation (0.55) punches
    /// the bodywork colour. High highlight recovery (0.60) for
    /// chrome + glass + rim/wheel highlights that habitually clip.
    static let vehicle = MagicRecipe(
        warmth: 0.00, skinSmooth: 0, shadowLift: 0.30, contrast: 0.55, saturation: 0.55,
        highlightRecovery: 0.60
    )

    /// Food: warm-tone bias maps to "appetizing" in cross-cultural
    /// colour research (warm = fresh, recently cooked). +0.50 ≈ +450K
    /// gives that golden-hour tint without going orange. Strong
    /// shadow lift opens up dark food (chocolate, sauces, cast iron).
    /// Heavy saturation (0.55) boosts reds/oranges/yellows that
    /// dominate food. Strong contrast (0.40) for surface texture.
    /// Aggressive highlight recovery (0.55) because sauce/glaze gleam
    /// is THE shot — losing it to clipping kills the appetite trigger.
    /// No skin smoothing.
    static let food = MagicRecipe(
        warmth: 0.50, skinSmooth: 0, shadowLift: 0.50, contrast: 0.40, saturation: 0.55,
        highlightRecovery: 0.55
    )

    /// Landscape: cool tilt (-0.10) emphasises sky + water + green
    /// foliage (blue/green register MORE saturated when the warm
    /// cast is removed). Strong shadow lift opens shadow detail in
    /// foreground (rocks, grass, near-trees). Strong contrast for
    /// cloud-vs-sky drama. High saturation (0.60) — landscape is
    /// where the photographer can push colours hardest before the
    /// image looks fake. Highlight recovery essentially MAXED at 0.70
    /// because outdoor sky is at or above clipping nearly always
    /// (especially on iPad-class CR3 dynamic range).
    static let landscape = MagicRecipe(
        warmth: -0.10, skinSmooth: 0, shadowLift: 0.55, contrast: 0.55, saturation: 0.60,
        highlightRecovery: 0.70
    )

    /// Product on white/studio background: NEUTRAL warmth is
    /// mandatory — colour accuracy is the deliverable (e-commerce
    /// listings live or die by this). Light shadow lift for
    /// soft-product depth without commercial flatness. LOW contrast
    /// (0.20) to keep that clean catalog look — high contrast reads
    /// as "lifestyle photography", not "product photography".
    /// Minimal saturation (0.05) for truthfulness over drama.
    /// Moderate highlight recovery (0.30) preserves white-background
    /// detail (sweep lines, fold shadows on backdrop).
    static let product = MagicRecipe(
        warmth: 0.00, skinSmooth: 0, shadowLift: 0.20, contrast: 0.20, saturation: 0.05,
        highlightRecovery: 0.30
    )

    /// Fallback when subject classification doesn't confidently fire.
    /// Mild-warm bias (most snapshots benefit from a small golden
    /// nudge), conservative on every other axis. Goal: never make
    /// any photo objectively worse, while giving most photos a
    /// gentle lift. Highlight recovery is the most universal axis —
    /// almost every consumer photo has at least one near-clipped
    /// highlight worth pulling.
    static let neutral = MagicRecipe(
        warmth: 0.20, skinSmooth: 0, shadowLift: 0.25, contrast: 0.20, saturation: 0.20,
        highlightRecovery: 0.30
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
