import Foundation
import ImageIO

/// Read Canon's in-camera "Picture Style" choice (Standard / Portrait /
/// Landscape / Neutral / Faithful / Monochrome / Auto / custom user
/// styles) from a CR3 or camera-baked JPEG's EXIF metadata, then map
/// it onto a small ``MagicRecipe`` baseline so the iPad's pipeline
/// starts from "what the photographer dialed into the body" rather
/// than from a hard-coded `neutral`.
///
/// **CONFIRMED double-counting risk (audit 2026-05-04):** Apple's
/// `CIRAWFilter` applies a non-zero default look during demosaic.
/// Per WWDC21 session 10160 ("Display HDR and EDR content with Core
/// Image, Metal, and SwiftUI"), the developer-recipe to GET LINEAR
/// scene-referred data is:
///
///     filter.baselineExposure = 0
///     filter.shadowBias = 0
///     filter.boostAmount = 0          // default = 1 (full tone curve)
///     filter.boostShadowAmount = 1    // identity
///     filter.localToneMapAmount = 0   // default varies per image
///     filter.isGamutMappingEnabled = false
///
/// Apple's documentation for `boostAmount` says default = 1 (full
/// global tone curve applied), and `baselineExposure` is "default
/// varies with camera settings." In other words: a freshly-built
/// `CIRAWFilter` has already applied a camera-dependent look before
/// we add anything. Apple doesn't document whether Canon Picture
/// Style specifically feeds these defaults, but the empirical effect
/// is: yes, the metadata is influencing render.
///
/// **Mitigation (ship-current):** keep baseline deltas SMALL — ≤0.10
/// per axis, ideally less. Even at full double-count the worst case
/// is "barely perceptibly different from Apple's default" rather
/// than "obviously oversaturated".
///
/// **Phase 6 (right answer):** zero out Apple's default look entirely
/// via the WWDC21 recipe above, then own the full pipeline. Our
/// baseline + recipe become the ONLY look applied. That requires
/// shipping per-camera color profiles (Lightroom/Capture One
/// approach) and is multi-day work.
///
/// **Verify on real Canon body:** shoot one CR3 in Standard +
/// Portrait + Landscape Picture Styles, render through CIRAWFilter
/// with default settings, A/B against Canon's DPP output for the
/// same Picture Style. If they track within reason, Apple is
/// applying Picture Style and our baseline is purely additive
/// double-counting (set baseline values to 0 across the board). If
/// they DON'T track (e.g. CIRAWFilter ignores Picture Style and
/// always applies the same default), our baseline IS the correct
/// stand-in.
enum CanonPictureStyle: String, Sendable, Equatable {
    case standard
    case portrait
    case landscape
    case neutral
    case faithful
    case monochrome
    case auto
    case custom
    case unknown

    /// Read from JPEG / CR3 bytes by walking the standard EXIF dicts
    /// in priority order. Apple's iOS doesn't expose a public
    /// constant for the Canon Picture Style tag, so we inspect the
    /// MakerNotes dict and EXIF Aux dict by string key — this is
    /// the same heuristic Lightroom uses when Canon's SDK isn't
    /// available. Returns nil only on completely unreadable data;
    /// `.unknown` for valid metadata that doesn't carry a Picture
    /// Style tag (e.g. sips-converted JPEGs strip MakerNotes).
    static func read(fromImageData data: Data) -> CanonPictureStyle? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            return nil
        }
        guard let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
            as? [String: Any]
        else {
            return nil
        }

        // 1. Canon MakerNotes (highest fidelity — when present, this
        //    is the photographer's actual in-camera choice). Key path
        //    varies by iOS version + camera firmware; we sniff for any
        //    string value matching a known Picture Style name.
        if let canon = props[kCGImagePropertyMakerCanonDictionary as String]
            as? [String: Any] {
            if let style = sniffPictureStyle(in: canon) { return style }
        }

        // 2. EXIF Aux dictionary — Apple sometimes promotes Canon
        //    Picture Style here under a more generic label.
        if let aux = props[kCGImagePropertyExifAuxDictionary as String]
            as? [String: Any] {
            if let style = sniffPictureStyle(in: aux) { return style }
        }

        // 3. Top-level EXIF — last resort; some camera-baked JPEGs
        //    embed UserComment that mentions the Picture Style.
        if let exif = props[kCGImagePropertyExifDictionary as String]
            as? [String: Any] {
            if let style = sniffPictureStyle(in: exif) { return style }
        }

        return .unknown
    }

    /// Walk a metadata dict looking for any string key/value that
    /// names a Picture Style. Case-insensitive substring match.
    /// Tries both common key names ("PictureStyle", "PictureControl",
    /// "PictureMode") and value-based fallback for cases where the
    /// platform exposes a more generic field (`Description`,
    /// `UserComment`) that includes the style name.
    private static func sniffPictureStyle(in dict: [String: Any]) -> CanonPictureStyle? {
        let candidateKeys = [
            "PictureStyle",
            "PictureControl",
            "PictureMode",
            "PictureStyleData",
        ]
        for key in candidateKeys {
            if let raw = dict[key] as? String,
               let style = match(name: raw) {
                return style
            }
        }
        // Fallback: scan all string values in the dict for a known
        // name. Cheap (most EXIF dicts are < 30 entries) + tolerant
        // to the platform shifting where it parks the field.
        for (_, value) in dict {
            if let raw = value as? String, let style = match(name: raw) {
                return style
            }
        }
        return nil
    }

    private static func match(name raw: String) -> CanonPictureStyle? {
        let lowered = raw.lowercased()
        if lowered.contains("standard")  { return .standard }
        if lowered.contains("portrait")  { return .portrait }
        if lowered.contains("landscape") { return .landscape }
        if lowered.contains("neutral")   { return .neutral }
        if lowered.contains("faithful")  { return .faithful }
        if lowered.contains("monochrome") || lowered.contains("b&w") || lowered.contains("bw") {
            return .monochrome
        }
        if lowered.contains("auto")      { return .auto }
        if lowered.contains("user")      { return .custom }
        return nil
    }

    /// Per-style baseline `MagicRecipe` modifier. **Audit-revised
    /// 2026-05-04**: deltas are now ≤0.10 per axis since Apple's
    /// `CIRAWFilter` applies its own camera-dependent default look
    /// during demosaic (per WWDC21 session 10160). Stacking large
    /// deltas on top double-counts; small deltas only add a "subject-
    /// flavoured nudge" without overdriving any axis.
    ///
    /// The relative direction of each delta still matches the audited
    /// preset philosophy (Portrait warm + low contrast, Landscape
    /// cool + saturation bump, etc.), just at lower magnitude. If
    /// real-world A/B testing on a Canon body shows Apple isn't
    /// applying Picture Style after all, we can scale these back up.
    var baselineRecipeAdjustment: MagicRecipe {
        switch self {
        case .standard:
            // Canon's pleasing default. Tiny additive nudge.
            return MagicRecipe(
                warmth: 0.05, skinSmooth: 0, shadowLift: 0.05,
                contrast: 0.05, saturation: 0.05, highlightRecovery: 0.05,
            )
        case .portrait:
            // Skin-friendly direction, halved from pre-audit values.
            return MagicRecipe(
                warmth: 0.10, skinSmooth: 0.10, shadowLift: 0.05,
                contrast: 0, saturation: 0.03, highlightRecovery: 0.08,
            )
        case .landscape:
            // Cool + saturation direction, halved.
            return MagicRecipe(
                warmth: -0.05, skinSmooth: 0, shadowLift: 0.08,
                contrast: 0.10, saturation: 0.10, highlightRecovery: 0.10,
            )
        case .neutral, .faithful:
            // Photographer explicitly chose "don't touch colors".
            return MagicRecipe(
                warmth: 0, skinSmooth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        case .monochrome:
            // TODO Phase 6: actual greyscale conversion via
            // CIPhotoEffectMono / CIColorMonochrome. Currently no-op.
            return MagicRecipe(
                warmth: 0, skinSmooth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        case .auto, .custom, .unknown:
            // Can't replicate auto / custom / missing metadata —
            // let the user's recipe drive without baseline.
            return MagicRecipe(
                warmth: 0, skinSmooth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        }
    }
}

extension MagicRecipe {
    /// Sum each axis with another recipe and clamp to the field's
    /// natural range. Used by ``CanonPictureStyle.baselineRecipeAdjustment``
    /// to layer a Picture Style baseline beneath the user's recipe.
    /// The clamp prevents a baseline + recipe over-shooting the
    /// slider's intended range (e.g. saturation +0.30 baseline +
    /// user's +0.55 = 0.85, which our `* 0.45` mapper would expand
    /// to ~38% post-output saturation — well within reasonable).
    func merging(baseline: MagicRecipe) -> MagicRecipe {
        MagicRecipe(
            warmth: clampSigned(warmth + baseline.warmth),
            skinSmooth: clampUnit(skinSmooth + baseline.skinSmooth),
            shadowLift: clampUnit(shadowLift + baseline.shadowLift),
            contrast: clampSigned(contrast + baseline.contrast),
            saturation: clampSigned(saturation + baseline.saturation),
            highlightRecovery: clampUnit(highlightRecovery + baseline.highlightRecovery),
        )
    }

    private func clampSigned(_ v: Double) -> Double { max(-1, min(1, v)) }
    private func clampUnit(_ v: Double) -> Double { max(0, min(1, v)) }
}
