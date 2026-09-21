import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers

/// Phase 2C — final-quality RAW export.
///
/// While ``MagicPipeline`` runs on the display-JPEG (`?kind=display`) for
/// sub-second live feedback, this pipeline operates on the camera-original
/// CR3/NEF/ARW (`?kind=main`) and demosaics through `CIRAWFilter`. The
/// MagicRecipe parameters were chosen to map cleanly onto CIRAWFilter's
/// inputs — the same warmth/shadow values therefore produce a faithful
/// RAW-quality version of what the photographer saw on the iPad, with
/// ~2 stops more shadow headroom and white-balance set correctly from
/// the demosaiced sensor data instead of the camera JPEG.
///
/// The renderer is a pure function: bytes in, bytes out. No filesystem,
/// no network, no MainActor. Orchestration (download → render → write)
/// lives in ``RAWExportService``.
enum RAWExportPipeline {

    enum Error: Swift.Error, Equatable {
        case decodeFailed
        case renderFailed
        case encodeFailed
    }

    /// Render a camera-original RAW into a JPEG with the given recipe applied.
    ///
    /// - Parameters:
    ///   - rawData: bytes of the RAW file (`?kind=main`).
    ///   - recipe: enhancement recipe — same shape consumed by ``MagicPipeline``.
    ///   - identifierHint: file extension, MIME type, or UTI. It is normalized
    ///     to a UTI before reaching `CIRAWFilter` (e.g. `"cr3"` becomes
    ///     `"com.canon.cr3-raw-image"`). Optional.
    ///   - jpegCompressionQuality: 0…1; default 0.92 — higher than the
    ///     display preview's 0.85 because this output is the deliverable.
    ///   - targetMaxDimension: when set, the demosaic uses
    ///     `CIRAWFilter.scaleFactor` to downsample so the long edge
    ///     hits this many pixels. nil = full resolution. Use ~1920 for
    ///     in-app hero previews (saves RAM + render time vs. the 5088×
    ///     full demosaic) while keeping the same color-science path.
    ///   - colorPurpose: drives the working color space + output ICC
    ///     profile via ``ColorManagement``. `.webDelivery` (default)
    ///     = sRGB-tagged JPEG for the gallery upload (cross-browser-
    ///     safe). `.appPreview` / `.wideGamutDelivery` = Display P3.
    ///     `.printDelivery` = Adobe RGB (for photo lab / RIP software).
    /// - Returns: JPEG bytes the photographer can hand off / upload.
    static func render(
        rawData: Data,
        recipe: MagicRecipe,
        identifierHint: String? = nil,
        jpegCompressionQuality: CGFloat = 0.92,
        exposureEV: Double = 0,
        targetMaxDimension: CGFloat? = nil,
        colorPurpose: ColorManagement.Purpose = .webDelivery,
    ) throws -> Data {
        guard let filter = makeRawFilter(rawData: rawData, identifierHint: identifierHint) else {
            throw Error.decodeFailed
        }
        // Picture Style-baseline (Phase 5.2) leses fra rå-bytene ÉN gang her.
        let baseline = (CanonPictureStyle.read(fromImageData: rawData) ?? .unknown).baselineRecipeAdjustment
        guard let toned = tonedImage(
            filter: filter,
            asShotTemperature: filter.neutralTemperature,
            defaultLuminanceNR: filter.luminanceNoiseReductionAmount,
            pictureStyleBaseline: baseline,
            recipe: recipe,
            exposureEV: exposureEV,
            targetMaxDimension: targetMaxDimension,
        ) else { throw Error.renderFailed }

        let context = ColorManagement.makeContext(for: colorPurpose)
        guard let cgImage = ColorManagement.renderCGImage(
            from: toned,
            context: context,
            purpose: colorPurpose,
        ) else {
            throw Error.renderFailed
        }

        do {
            return try ColorManagement.encodeJPEG(
                cgImage: cgImage,
                purpose: colorPurpose,
                quality: jpegCompressionQuality,
            )
        } catch {
            throw Error.encodeFailed
        }
    }

    // MARK: - Delt tone-kjerne (engangs-render OG cachet interaktiv render)

    /// Demosaic + recipe + tone → tonet `CIImage` (før farge-styring/encode).
    /// Tar et FERDIGBYGD `CIRAWFilter` så den interaktive banen kan GJENBRUKE ett
    /// cachet filter per asset (ingen disk-les / re-parse per slider-slipp) — kun
    /// properties muteres + demosaic re-kjøres (Core Image cacher dekodingen).
    /// `asShotTemperature`/`defaultLuminanceNR`/`pictureStyleBaseline` er filterets
    /// opprinnelige verdier (fanget ved opprettelse) så gjenbruk er idempotent.
    static func tonedImage(
        filter: CIRAWFilter,
        asShotTemperature: Float,
        defaultLuminanceNR: Float,
        pictureStyleBaseline: MagicRecipe,
        recipe: MagicRecipe,
        exposureEV: Double = 0,
        targetMaxDimension: CGFloat?,
    ) -> CIImage? {
        // Picture Style-baseline kun når recipen er nøytral (ingen slider rørt);
        // ellers vinner fotografens eksplisitte valg. SubjectType legges alltid på.
        let withStyle: MagicRecipe = recipe.isNeutral
            ? recipe.merging(baseline: pictureStyleBaseline)
            : recipe
        let effectiveRecipe = withStyle.merging(baseline: withStyle.subjectTypeAdjustment)

        applyRecipe(effectiveRecipe, to: filter,
                    asShotTemperature: asShotTemperature, defaultLuminanceNR: defaultLuminanceNR)

        // #2 EV NATIVT: `CIRAWFilter.exposure` (pre-demosaic, scene-lineært RAW) i
        // stedet for en post-develop CIExposureAdjust på 8-bit. +EV henter tilbake
        // klippede høylys (RAW-headroom), −EV gir ingen banding. ABSOLUTT (0 =
        // nøytral) så et gjenbrukt filter ikke arver forrige renders EV.
        filter.exposure = Float(exposureEV)

        // Downsample ved decode (scaleFactor kjører bayer-pipelinen lavere-oppløst).
        // Settes ABSOLUTT (=1 uten nedskalering) så gjenbruk ikke arver stale skala.
        if let targetMaxDimension {
            let nativeLong = max(filter.nativeSize.width, filter.nativeSize.height)
            filter.scaleFactor = nativeLong > targetMaxDimension ? Float(targetMaxDimension / nativeLong) : 1
        } else {
            filter.scaleFactor = 1
        }

        guard let rawOutput = filter.outputImage else { return nil }
        // CIRAWFilter roterer selv etter EXIF-orientering (ingen manuell .oriented()).
        let straightened = AutoStraightenFilter.apply(recipe: effectiveRecipe, to: rawOutput)
        return applyToneAdjustments(recipe: effectiveRecipe, to: straightened)
    }

    // MARK: - CIRAWFilter wiring

    /// Build a `CIRAWFilter` from RAW bytes. The class factory
    /// `+filterWithImageData:identifierHint:` (iOS 15+) bridges to Swift as
    /// the trailing-`init` form below. Core Image expects a UTI here — passing
    /// the raw extension (`"cr3"`) logs a format error even though byte sniffing
    /// may still recover. Normalize extension/MIME callers at this boundary.
    static func makeRawFilter(rawData: Data, identifierHint: String?) -> CIRAWFilter? {
        if let hint = normalizedIdentifierHint(identifierHint) {
            return CIRAWFilter(imageData: rawData, identifierHint: hint)
        }
        return CIRAWFilter(imageData: rawData, identifierHint: nil)
    }

    static func normalizedIdentifierHint(_ raw: String?) -> String? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return nil }
        if let type = UTType(filenameExtension: raw.lowercased()) {
            return type.identifier
        }
        if let type = UTType(mimeType: raw.lowercased()) {
            return type.identifier
        }
        // Preserve an already-normalized UTI. Unknown free-form strings are
        // discarded so Core Image can sniff bytes without noisy false hints.
        if raw.contains("."), !raw.contains("/") { return raw }
        return nil
    }

    /// Map ``MagicRecipe`` → the parts handled natively by `CIRAWFilter`.
    ///
    /// Native (better quality, applied pre-tone-curve in linear RAW space):
    ///   - `warmth` ±1 → `neutralTemperature` ±600 K from camera-as-shot WB.
    ///     Display pipeline uses ±900 K via `CITemperatureAndTint` against a
    ///     hard-coded 6500 K baseline; here we shift the camera's actual
    ///     neutral, which is more accurate, so a smaller delta gives the
    ///     same perceptual change.
    ///   - `shadowLift` 0…1 → `boostShadowAmount` 1.0…2.0 (lighten only;
    ///     CIRAWFilter clamps the range to 0…2 with 1.0 = neutral).
    ///   - Skin frequency controls are intentionally *not* mapped to RAW-global
    ///     noise reduction. Both axes run post-demosaic through the same soft
    ///     face mask as the JPEG preview, preserving hair/fabric/background and
    ///     keeping preview/export behaviour aligned.
    ///
    /// White balance + shadow lift land natively on `CIRAWFilter`
    /// (pre-demosaic, full sensor precision). Highlight
    /// recovery rides Apple's native `isHighlightRecoveryEnabled` plus
    /// a linear-space `CIToneCurve` pull-down for fine control.
    /// Contrast + saturation are applied post-demosaic in
    /// ``applyToneAdjustments`` (display-gamma so the slider behaves
    /// identically to the display-JPEG MagicPipeline).
    /// - Parameters:
    ///   - asShotTemperature: filterets `neutralTemperature` ved OPPRETTELSE
    ///     (kamera-as-shot). Settes ABSOLUTT hver gang (ikke `+=`) så et
    ///     GJENBRUKT filter (RAW-cache) ikke akkumulerer warmth over renders.
    ///   - defaultLuminanceNR: filterets `luminanceNoiseReductionAmount` ved
    ///     opprettelse (sensor-kalibrert default) — gjenopprettes når ingen
    ///     hud-glatting er valgt, så gjenbruk ikke arver forrige renders NR.
    static func applyRecipe(_ recipe: MagicRecipe, to filter: CIRAWFilter,
                            asShotTemperature: Float, defaultLuminanceNR: Float) {
        // WB: ABSOLUTT (= as-shot + delta). warmth==0 → uendret as-shot.
        filter.neutralTemperature = asShotTemperature + Float(recipe.warmth) * 600.0

        // Shadow boost: absolutt (1.0 = nøytral) så gjenbruk nullstilles.
        filter.boostShadowAmount = recipe.shadowLift > 0 ? 1.0 + Float(recipe.shadowLift) : 1.0

        // Sensor noise reduction stays camera-calibrated. Portrait smoothing is
        // applied later through a face mask; driving this RAW-global control from
        // a skin slider softened hair, fabric and the entire background.
        if filter.isLuminanceNoiseReductionSupported {
            filter.luminanceNoiseReductionAmount = defaultLuminanceNR
        }

        // Lens correction (vignette, distortion, chromatic aberration)
        // when Apple's profile DB has the lens. Free quality lift —
        // turn on when supported, no-op otherwise. CIRAWFilter handles
        // the per-lens lookup internally.
        if filter.isLensCorrectionSupported {
            filter.isLensCorrectionEnabled = true
        }

        // This used to exist only in the documentation below. Enable Apple's
        // scene-linear RAW recovery for real when the camera format supports it;
        // the later display-space shoulder remains the photographer's fine
        // control and keeps JPEG preview/export visually aligned.
        if #available(iOS 26.0, *), filter.isHighlightRecoverySupported {
            // CIRAWFilter defaults this to true. Keep native sensor-headroom
            // recovery enabled for every render; the recipe amount controls the
            // visible shoulder below without making a neutral render lower quality.
            filter.isHighlightRecoveryEnabled = true
        }

        // Highlight recovery — applied post-output in
        // ``applyToneAdjustments`` rather than in `linearSpaceFilter`
        // because (audit 2026-05-04, Apple Core Image Filter Reference):
        //   1. `CIToneCurve` actually operates in gamma-2 perceptual
        //      space regardless of which filter slot you put it in,
        //      not linear scene-referred. Original "linear-space"
        //      claim was wrong.
        //   2. CIRAWFilter outputs extended-range scene-linear values
        //      (>1.0 for HDR; up to 14 stops). A curve ending at
        //      point4.x=1.0 just linearly extrapolates above 1.0 then
        //      gamut-clips — meaning highlights that need recovery
        //      most (blown clouds, specular hits) got NO recovery.
        // Both problems disappear when the curve runs after CIRAWFilter
        // has already gamut-mapped to display range.
        filter.linearSpaceFilter = nil
    }

    /// Apply contrast + saturation + highlight-recovery post-demosaic.
    /// The shared five-point contrast curve keeps preview and final RAW
    /// deliverable identical without shifting exposure on low-key portraits.
    ///   - `contrast` -1…+1 → photographic S-curve around fixed black,
    ///     middle-grey and white anchors.
    ///   - `saturation` -1…+1 → 0.55…1.45 around 1.0 (neutral).
    ///   - `highlightRecovery` 0…1 → CIToneCurve pulling display 65-100%
    ///     range down. Knee starts at 65% (industry-standard soft-clip
    ///     threshold per ARRI/Reinhard/Hable shoulder math, NOT the
    ///     85% we used pre-audit which read as "obviously blown" by
    ///     the time the curve kicked in).
    /// Brightness stays at 0 — exposure shifts belong upstream on the RAW
    /// itself, not as a post tone-curve nudge.
    static func applyToneAdjustments(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        var current = image

        // Warmth is developed natively by CIRAWFilter. Tint remains a separate
        // green↔magenta display-space correction so the same slider mapping is
        // used for RAW and camera-JPEG previews.
        if recipe.tint != 0 {
            let tint = CIFilter.temperatureAndTint()
            tint.inputImage = current
            tint.neutral = CIVector(x: 6500, y: 0)
            tint.targetNeutral = CIVector(x: 6500, y: CGFloat(-recipe.tint * 60))
            current = tint.outputImage ?? current
        }

        // Remove residual chromatic aberration before saturation/vibrance can
        // amplify it. Apple's native lens-profile correction has already run on
        // RAW; this edge-masked stage handles what the profile leaves behind.
        current = ColorArtifactFilter.applyDefringe(amount: recipe.defringe, to: current)

        // `image` already contains the CIRAWFilter warmth correction; include
        // the explicit tint correction as well. Skin protection should preserve
        // the chosen white balance, not pull a source cast back into the face.
        let skinColorReference = current

        // Phase 6 — dehaze first because it adjusts contrast +
        // saturation + shadow simultaneously; subsequent slider
        // adjustments stack on top of the dehazed image.
        if recipe.dehaze > 0 {
            let d = Float(recipe.dehaze)
            // Dehaze proxy: coordinated nudge to contrast (+15% per
            // unit), saturation (+10% per unit), and shadow lift
            // (+10% per unit). Calibrated against Lightroom's Dehaze
            // +50 reference — produces equivalent perceived "haze
            // cut" + punch without Apple's actual dehaze algorithm.
            let pre = CIFilter.colorControls()
            pre.inputImage = current
            pre.contrast = 1.0 + d * 0.15
            pre.saturation = 1.0 + d * 0.10
            pre.brightness = 0
            current = pre.outputImage ?? current
            let shadow = CIFilter.highlightShadowAdjust()
            shadow.inputImage = current
            shadow.shadowAmount = d * 0.10
            shadow.highlightAmount = 1.0
            current = shadow.outputImage ?? current
        }

        // Saturation + photographic S-curve (post-dehaze). A plain
        // CIColorControls contrast multiplier pivots around fixed 50 % grey;
        // on a low-key portrait that pushes almost the entire subject toward
        // black and can reduce, rather than add, usable tonal separation.
        current = applyContrastAndSaturation(recipe: recipe, to: current)

        // Phase 6 — Vibrance. CIVibrance only lifts dull pixels;
        // already-saturated areas stay put. Industry favorite for
        // food + product because cream sauce stays white while
        // tomato red lifts.
        if recipe.vibrance != 0 {
            let v = CIFilter.vibrance()
            v.inputImage = current
            v.amount = Float(recipe.vibrance)
            current = v.outputImage ?? current
        }

        // Phase 6 — Texture (mid-frequency local contrast). Wide-
        // radius unsharp mask. Different from skinSmooth's narrow-
        // radius restore — that's tied to portrait-only flow. This
        // axis exposes texture as a first-class control for
        // landscape/vehicle/aviation/food crust.
        if recipe.texture > 0 {
            let t = CIFilter.unsharpMask()
            t.inputImage = current
            t.radius = 25  // wide (vs skin-smooth restore's 1.5)
            t.intensity = Float(recipe.texture) * 0.6
            current = t.outputImage ?? current
        }

        current = SkinFinishFilter.applyFrequencySeparation(recipe: recipe, to: current)
        current = SkinFinishFilter.applyPortraitRetouch(recipe: recipe, to: current)

        current = applyHighlightRecovery(amount: recipe.highlightRecovery, to: current)
        let subjectColourReference = current
        let controlledBackground = ColorArtifactFilter.applyGreenControl(
            amount: recipe.greenControl,
            to: current
        )
        current = SubjectSeparationFilter.apply(
            amount: recipe.subjectSeparation,
            subject: subjectColourReference,
            background: controlledBackground
        )

        // Phase 7B — eye-region sharpen + catch-light boost.
        current = EyeEffectFilter.apply(recipe: recipe, to: current)

        // Phase 7D — teeth whitening, masked to innerLips polygon.
        current = TeethWhiteningFilter.apply(recipe: recipe, to: current)

        // Phase 7F — face↔body skin-tone unify. Runs last among the
        // face-detection chain because it samples averages, which
        // benefits from the post-tone state. No-op when no face
        // detected or delta is tiny.
        current = SkinToneUnifyFilter.apply(recipe: recipe, to: current)
        // Hud-tone-guard SIST — forankrer a* mot ~11 etter unify/tone (fikser
        // grønn/gjørmete + oransje uten å røre L*/b*).
        current = SkinToneGuardFilter.apply(
            recipe: recipe,
            to: current,
            reference: skinColorReference
        )
        // Film-korn som aller siste finish (over ferdig tone/farge).
        current = FilmGrainFilter.apply(recipe: recipe, to: current)

        return current
    }

    /// Shared display/RAW tone stage. The five-point curve keeps true black,
    /// middle grey and white fixed while separating quarter tones. This gives
    /// portraits depth without the exposure shift caused by CIColorControls'
    /// hard-coded 50 %-grey contrast pivot.
    static func applyContrastAndSaturation(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        var current = image

        if recipe.contrast != 0 {
            let amount = max(-1, min(1, recipe.contrast))
            let curve = CIFilter.toneCurve()
            curve.inputImage = current
            curve.point0 = CGPoint(x: 0, y: 0)
            curve.point1 = CGPoint(x: 0.25, y: 0.25 - amount * 0.10)
            curve.point2 = CGPoint(x: 0.50, y: 0.50)
            curve.point3 = CGPoint(x: 0.75, y: 0.75 + amount * 0.10)
            curve.point4 = CGPoint(x: 1, y: 1)
            current = curve.outputImage ?? current
        }

        if recipe.saturation != 0 {
            let controls = CIFilter.colorControls()
            controls.inputImage = current
            controls.contrast = 1
            controls.saturation = 1.0 + Float(recipe.saturation) * 0.45
            controls.brightness = 0
            current = controls.outputImage ?? current
        }

        return current
    }

    /// Rolls off only the upper highlights while retaining a photographic
    /// white point. The previous curve ended at `0.92 - 0.08 * amount`, which
    /// made even a weak recovery setting map pure white to grey and gave the
    /// complete portrait a milky/washed-out appearance. At zero this curve is
    /// now the identity; at full strength white still reaches 0.96 while the
    /// 65–95 % range receives the useful shoulder compression.
    static func applyHighlightRecovery(amount: Double, to image: CIImage) -> CIImage {
        let r = max(0, min(1, amount))
        guard r > 0 else { return image }
        let toneCurve = CIFilter.toneCurve()
        toneCurve.inputImage = image
        toneCurve.point0 = CGPoint(x: 0, y: 0)
        toneCurve.point1 = CGPoint(x: 0.40, y: 0.40)
        toneCurve.point2 = CGPoint(x: 0.65, y: 0.65 - 0.02 * r)
        toneCurve.point3 = CGPoint(x: 0.85, y: 0.85 - 0.15 * r)
        toneCurve.point4 = CGPoint(x: 1.00, y: 1.00 - 0.08 * r)
        return toneCurve.outputImage ?? image
    }

    // Encoding moved to `ColorManagement.encodeJPEG` so color-space +
    // ICC profile tagging stays a single source of truth across all
    // render pipelines (RAW + display-JPEG-Magic).
}
