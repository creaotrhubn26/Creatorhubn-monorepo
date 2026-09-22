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
            "PictureStyleData"
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
        if lowered.contains("standard") { return .standard }
        if lowered.contains("portrait") { return .portrait }
        if lowered.contains("landscape") { return .landscape }
        if lowered.contains("neutral") { return .neutral }
        if lowered.contains("faithful") { return .faithful }
        if lowered.contains("monochrome") || lowered.contains("b&w") || lowered.contains("bw") {
            return .monochrome
        }
        if lowered.contains("auto") { return .auto }
        if lowered.contains("user") { return .custom }
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
                warmth: 0.05, shadowLift: 0.05,
                contrast: 0.05, saturation: 0.05, highlightRecovery: 0.05,
            )
        case .portrait:
            // Skin-friendly direction, halved from pre-audit values.
            // Phase 7: split skin into freq-sep axes (low-freq smooth
            // tone, no high-freq nudge — let recipe decide detail).
            return MagicRecipe(
                warmth: 0.10, skinHighFreq: 0, skinLowFreq: 0.10,
                shadowLift: 0.05, contrast: 0, saturation: 0.03,
                highlightRecovery: 0.08,
            )
        case .landscape:
            // Cool + saturation direction, halved.
            return MagicRecipe(
                warmth: -0.05, shadowLift: 0.08,
                contrast: 0.10, saturation: 0.10, highlightRecovery: 0.10,
            )
        case .neutral, .faithful:
            // Photographer explicitly chose "don't touch colors".
            return MagicRecipe(
                warmth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        case .monochrome:
            // TODO Phase 6: actual greyscale conversion via
            // CIPhotoEffectMono / CIColorMonochrome. Currently no-op.
            return MagicRecipe(
                warmth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        case .auto, .custom, .unknown:
            // Can't replicate auto / custom / missing metadata —
            // let the user's recipe drive without baseline.
            return MagicRecipe(
                warmth: 0, shadowLift: 0,
                contrast: 0, saturation: 0, highlightRecovery: 0,
            )
        }
    }
}

// MARK: - Camera colour profiles

/// The camera-profile choice shown in Redigering. These are deliberately
/// identifiers, not embedded Adobe/Canon profile payloads: neither vendor's
/// downloaded DCP/PF2 files may be redistributed merely because their desktop
/// tools are free to download.
enum CameraColorProfileID: String, Codable, CaseIterable, Sendable {
    case appleEmbedded
    case creatorHubStandard
    case creatorHubPortrait
    case creatorHubLandscape
    case creatorHubNeutral
    case creatorHubFaithful
}

struct CameraColorProfileDefinition: Identifiable, Sendable, Equatable {
    let id: CameraColorProfileID
    let displayName: String
    let detail: String
    /// Residual look applied after Apple's camera-aware RAW conversion.
    /// `nil` means that Apple's embedded-camera rendering is used untouched.
    let renderAdjustment: MagicRecipe?
    let isBeta: Bool
}

/// Safe, model-gated camera matching on top of Apple's RAW decoder.
///
/// Apple's public `CIRAWFilter` API does not expose a DCP/ICC camera-profile
/// selector. It already converts sensor RGB through a camera-dependent input
/// transform. Consequently a LibRaw `cam_xyz` matrix MUST NOT be applied to
/// `filter.outputImage`: that output is no longer sensor RGB and doing so would
/// double-profile the image. The open LibRaw R6 Mark II matrix is retained here
/// as calibration provenance only; it is not part of the render graph.
///
/// CreatorHub profiles are small, owned residual looks. They are intentionally
/// marked beta until measured against ColorChecker captures and Canon DPP
/// references from the physical body under D65 and tungsten illumination.
enum CameraColorProfileCatalog {
    enum CameraFamily: String, Sendable {
        case canonEOSR5
        case canonEOSR6MarkII

        var displayName: String {
            switch self {
            case .canonEOSR5: return "Canon EOS R5"
            case .canonEOSR6MarkII: return "Canon EOS R6 Mark II"
            }
        }
    }

    /// LibRaw `colordata.cpp` entry for Canon EOS R6 Mark II. Informational
    /// calibration input only — see the double-profile warning above.
    static let canonEOSR6MarkIILibRawCameraMatrix: [Int] = [
        9539, -2795, -1224,
        -4175, 11998, 2458,
        -465, 1755, 6048,
    ]

    static func cameraFamily(for model: String?) -> CameraFamily? {
        guard let model else { return nil }
        let normalized = model
            .lowercased()
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")

        switch normalized {
        case "canon eos r5", "eos r5":
            return .canonEOSR5
        case "canon eos r6 mark ii", "eos r6 mark ii",
             "canon eos r6m2", "eos r6m2", "canon eos r6 mk ii", "eos r6 mk ii":
            return .canonEOSR6MarkII
        default:
            return nil
        }
    }

    static func profiles(cameraModel: String?, hasRaw: Bool) -> [CameraColorProfileDefinition] {
        let embedded = CameraColorProfileDefinition(
            id: .appleEmbedded,
            displayName: "Apple innebygd",
            detail: hasRaw
                ? "Kameraets RAW-data tolkes av Apples kameratilpassede dekoder."
                : "Ingen RAW-original — den innebygde JPEG-fargen beholdes.",
            renderAdjustment: nil,
            isBeta: false
        )
        guard hasRaw, let family = cameraFamily(for: cameraModel) else { return [embedded] }

        let prefix = "\(family.displayName) · CreatorHub matching"
        return [
            embedded,
            .init(
                id: .creatorHubStandard,
                displayName: "Kamera Standard",
                detail: "\(prefix): tydelig kontrast og balansert farge.",
                renderAdjustment: MagicRecipe(
                    warmth: -0.04, contrast: 0.06, saturation: 0.01,
                    highlightRecovery: 0.04, vibrance: 0.07,
                    autoEnhance: false
                ),
                isBeta: true
            ),
            .init(
                id: .creatorHubPortrait,
                displayName: "Kamera Portrett",
                detail: "\(prefix): kontrollert hudfarge uten global oransje varme.",
                renderAdjustment: MagicRecipe(
                    warmth: -0.03, tint: 0.01, contrast: 0.03,
                    saturation: -0.02, highlightRecovery: 0.08,
                    vibrance: 0.06, autoEnhance: false, skinGuard: 0.70
                ),
                isBeta: true
            ),
            .init(
                id: .creatorHubLandscape,
                displayName: "Kamera Landskap",
                detail: "\(prefix): mer separasjon og fargedybde uten neonfarger.",
                renderAdjustment: MagicRecipe(
                    warmth: -0.04, contrast: 0.09, saturation: 0.03,
                    highlightRecovery: 0.08, vibrance: 0.09, texture: 0.04,
                    dehaze: 0.03, autoEnhance: false
                ),
                isBeta: true
            ),
            .init(
                id: .creatorHubNeutral,
                displayName: "Kamera Nøytral",
                detail: "\(prefix): ingen ekstra farge-look; auto-forbedring er av.",
                renderAdjustment: MagicRecipe(autoEnhance: false),
                isBeta: true
            ),
            .init(
                id: .creatorHubFaithful,
                displayName: "Kamera Troverdig",
                detail: "\(prefix): dempet metning og nøktern tone for videre arbeid.",
                renderAdjustment: MagicRecipe(
                    warmth: -0.02, contrast: 0.02, saturation: -0.03,
                    highlightRecovery: 0.05, autoEnhance: false
                ),
                isBeta: true
            ),
        ]
    }

    static func profile(
        _ id: CameraColorProfileID,
        cameraModel: String?,
        hasRaw: Bool
    ) -> CameraColorProfileDefinition {
        let available = profiles(cameraModel: cameraModel, hasRaw: hasRaw)
        return available.first(where: { $0.id == id }) ?? available[0]
    }

    static func effectiveRecipe(
        userRecipe: MagicRecipe,
        profileID: CameraColorProfileID,
        cameraModel: String?,
        hasRaw: Bool
    ) -> MagicRecipe {
        guard let adjustment = profile(profileID, cameraModel: cameraModel, hasRaw: hasRaw)
            .renderAdjustment
        else { return userRecipe }
        return userRecipe.merging(baseline: adjustment)
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
            tint: clampSigned(tint + baseline.tint),
            skinHighFreq: clampSigned(skinHighFreq + baseline.skinHighFreq),
            skinLowFreq: clampSigned(skinLowFreq + baseline.skinLowFreq),
            skinSmooth: clampUnit(skinSmooth + baseline.skinSmooth),
            shadowLift: clampUnit(shadowLift + baseline.shadowLift),
            contrast: clampSigned(contrast + baseline.contrast),
            saturation: clampSigned(saturation + baseline.saturation),
            highlightRecovery: clampUnit(highlightRecovery + baseline.highlightRecovery),
            vibrance: clampSigned(vibrance + baseline.vibrance),
            texture: clampUnit(texture + baseline.texture),
            dehaze: clampUnit(dehaze + baseline.dehaze),
            defringe: clampUnit(defringe + baseline.defringe),
            greenControl: clampUnit(greenControl + baseline.greenControl),
            subjectSeparation: clampUnit(subjectSeparation + baseline.subjectSeparation),
            eyeSharpen: clampUnit(eyeSharpen + baseline.eyeSharpen),
            eyeCatchlight: clampUnit(eyeCatchlight + baseline.eyeCatchlight),
            autoStraighten: autoStraighten || baseline.autoStraighten,
            // 🔑 autoEnhance/skinGuard/filmGrain MÅ videreføres — utelot man dem
            // her (memberwise-init-ens defaults true/0/0 tok over), ble de STILLE
            // nullstilt ved HVER render (merging kalles ubetinget), så f.eks.
            // Bryllup-presetets `autoEnhance:false` + skinGuard + filmGrain forsvant
            // i hele pipelinen. autoEnhance: recipens «false» vinner (unngå
            // dobbel-prosessering); skinGuard/filmGrain additivt som andre akser.
            autoEnhance: autoEnhance && baseline.autoEnhance,
            skinGuard: clampUnit(skinGuard + baseline.skinGuard),
            filmGrain: clampUnit(filmGrain + baseline.filmGrain),
            straightenAngle: max(-AutoStraightenFilter.maxAngle,
                                 min(AutoStraightenFilter.maxAngle,
                                     straightenAngle + baseline.straightenAngle)),
            teethWhiten: clampUnit(teethWhiten + baseline.teethWhiten),
            // SubjectType doesn't merge — the recipe's choice wins.
            // Picture-Style baseline shouldn't impose a subject type.
            subjectType: subjectType != .none ? subjectType : baseline.subjectType,
            skinUnify: clampUnit(skinUnify + baseline.skinUnify),
            skinDiscoloration: clampUnit(skinDiscoloration + baseline.skinDiscoloration),
            blemishCleanup: clampUnit(blemishCleanup + baseline.blemishCleanup),
            dodgeBurn: clampUnit(dodgeBurn + baseline.dodgeBurn),
            shineControl: clampUnit(shineControl + baseline.shineControl),
            underEyeLift: clampUnit(underEyeLift + baseline.underEyeLift),
            // Protection is a policy strength, not an additive visual effect.
            makeupProtection: max(makeupProtection, baseline.makeupProtection),
            // Policy is always the photographer's choice; a camera baseline
            // must neither disable protection nor re-enable it after an
            // explicit opt-out.
            preserveIdentityMarks: preserveIdentityMarks,
            portraitRetouchLevel: portraitRetouchLevel != .custom
                ? portraitRetouchLevel
                : baseline.portraitRetouchLevel,
        )
    }

    private func clampSigned(_ v: Double) -> Double { max(-1, min(1, v)) }
    private func clampUnit(_ v: Double) -> Double { max(0, min(1, v)) }
}
