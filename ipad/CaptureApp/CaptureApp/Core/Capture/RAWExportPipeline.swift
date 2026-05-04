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
    ///   - identifierHint: file extension or MIME hint so `CIRAWFilter` can
    ///     pick the right decoder when the bytes don't carry a clean header
    ///     (e.g. `"cr3"`, `"image/x-canon-cr3"`). Optional.
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
        targetMaxDimension: CGFloat? = nil,
        colorPurpose: ColorManagement.Purpose = .webDelivery,
    ) throws -> Data {
        guard let filter = makeRawFilter(rawData: rawData, identifierHint: identifierHint) else {
            throw Error.decodeFailed
        }

        // Phase 5.2 — Picture Style baseline. Only when the user's
        // recipe is fully neutral (no slider touched yet) do we read
        // the in-camera Picture Style and merge its small baseline
        // adjustment in. Once the photographer reaches for any axis
        // their explicit choice trumps everything and we skip — see
        // the doc comment on `CanonPictureStyle` for the rationale +
        // double-counting risk with `CIRAWFilter`.
        let effectiveRecipe: MagicRecipe = recipe.isNeutral
            ? recipe.merging(baseline: (CanonPictureStyle.read(fromImageData: rawData)
                ?? .unknown).baselineRecipeAdjustment)
            : recipe

        applyRecipe(effectiveRecipe, to: filter)

        // Downsample at decode time when caller wants a preview-size
        // render — `CIRAWFilter.scaleFactor` runs the bayer pipeline at
        // a lower resolution rather than demosaicing-then-shrinking, so
        // we save both wall-clock and RAM. Computed from the native
        // size before any orientation flip.
        if let targetMaxDimension {
            let nativeLong = max(filter.nativeSize.width, filter.nativeSize.height)
            if nativeLong > targetMaxDimension {
                filter.scaleFactor = Float(targetMaxDimension / nativeLong)
            }
        }

        guard let rawOutput = filter.outputImage else {
            throw Error.renderFailed
        }

        let toned = applyToneAdjustments(recipe: effectiveRecipe, to: rawOutput)

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

    // MARK: - CIRAWFilter wiring

    /// Build a `CIRAWFilter` from RAW bytes. The class factory
    /// `+filterWithImageData:identifierHint:` (iOS 15+) bridges to Swift as
    /// the trailing-`init` form below. Passing the extension/MIME hint
    /// helps the decoder pick the right codepath for ambiguous formats
    /// like CR3 where the magic bytes alone don't disambiguate.
    static func makeRawFilter(rawData: Data, identifierHint: String?) -> CIRAWFilter? {
        if let hint = identifierHint, !hint.isEmpty {
            return CIRAWFilter(imageData: rawData, identifierHint: hint)
        }
        return CIRAWFilter(imageData: rawData, identifierHint: nil)
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
    ///   - `skinLowFreq` ≥0 → `luminanceNoiseReductionAmount` 0.2…0.7 (RAW
    ///     carries more sensor noise than the in-camera JPEG, so the floor
    ///     is biased up). Low-freq skin smoothing on RAW happens natively
    ///     here so it stacks correctly against the demosaic.
    ///   - `skinHighFreq` is applied post-output in `applyToneAdjustments`
    ///     because it needs the demosaiced display-RGB image (CIUnsharpMask
    ///     for sharpen direction, CIBilateralFilter for blur direction).
    ///   - `skinSmooth` (legacy) folds into `luminanceNoiseReductionAmount`
    ///     identically to the pre-Phase-7 mapping when present.
    ///
    /// White balance + shadow lift + skin smoothing land natively on
    /// `CIRAWFilter` (pre-demosaic, full sensor precision). Highlight
    /// recovery rides Apple's native `isHighlightRecoveryEnabled` plus
    /// a linear-space `CIToneCurve` pull-down for fine control.
    /// Contrast + saturation are applied post-demosaic in
    /// ``applyToneAdjustments`` (display-gamma so the slider behaves
    /// identically to the display-JPEG MagicPipeline).
    static func applyRecipe(_ recipe: MagicRecipe, to filter: CIRAWFilter) {
        if recipe.warmth != 0 {
            filter.neutralTemperature += Float(recipe.warmth) * 600.0
        }

        if recipe.shadowLift > 0 {
            filter.boostShadowAmount = 1.0 + Float(recipe.shadowLift)
        }

        // Phase 7: low-freq skin smoothing folds in here (CIRAWFilter
        // luminance NR runs pre-demosaic at full sensor precision —
        // best place for tone smoothing). Clamp the input to 0…1 since
        // this axis is bidirectional but luminance NR is unidirectional;
        // negative skinLowFreq (enhance structure) is handled post-output.
        // Legacy `skinSmooth` adds in identically for backwards compat.
        let lowFreqAmt = max(0, recipe.skinLowFreq) + max(0, recipe.skinSmooth)
        if lowFreqAmt > 0, filter.isLuminanceNoiseReductionSupported {
            let clamped = Float(min(1, lowFreqAmt))
            filter.luminanceNoiseReductionAmount = 0.2 + clamped * 0.5
        }

        // Lens correction (vignette, distortion, chromatic aberration)
        // when Apple's profile DB has the lens. Free quality lift —
        // turn on when supported, no-op otherwise. CIRAWFilter handles
        // the per-lens lookup internally.
        if filter.isLensCorrectionSupported {
            filter.isLensCorrectionEnabled = true
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
    /// Mirrors the display pipeline's `* 0.45` mapping so live preview
    /// and final RAW deliverable agree on these axes — a `+0.5 contrast`
    /// slider produces the same perceived bump in both outputs.
    ///   - `contrast` -1…+1 → 0.55…1.45 around 1.0 (neutral).
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

        // Saturation + contrast (post-dehaze).
        if recipe.contrast != 0 || recipe.saturation != 0 {
            let controls = CIFilter.colorControls()
            controls.inputImage = current
            controls.contrast = 1.0 + Float(recipe.contrast) * 0.45
            controls.saturation = 1.0 + Float(recipe.saturation) * 0.45
            controls.brightness = 0
            current = controls.outputImage ?? current
        }

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

        // Phase 7 — skinHighFreq (post-demosaic, since Apple's
        // CIBilateralFilter / CIUnsharpMask both need display-RGB).
        // Bidirectional: positive = sharpen pore detail, negative =
        // blur micro-texture. Narrow radius (1.5) so it ONLY touches
        // sub-skin texture without bleeding into hair/eye edges. Pair
        // with skinLowFreq for true frequency-separation behaviour:
        // smooth tone via low-freq + restore detail via high-freq +.
        // Negative direction applies a gentle gaussian blur with
        // radius matched to typical skin micro-texture (~2-3 px on
        // 5088×3392 sensor, ≈1.5 in CIFilter units after downscale).
        if recipe.skinHighFreq > 0 {
            let s = CIFilter.unsharpMask()
            s.inputImage = current
            s.radius = 1.5
            s.intensity = Float(recipe.skinHighFreq) * 0.5
            current = s.outputImage ?? current
        } else if recipe.skinHighFreq < 0 {
            let blur = CIFilter.gaussianBlur()
            blur.inputImage = current
            blur.radius = Float(-recipe.skinHighFreq) * 1.2
            current = blur.outputImage ?? current
        }

        // Phase 7 — skinLowFreq negative direction (enhance facial
        // structure). Positive direction was handled in applyRecipe
        // via luminance NR. Negative direction is a subtle contrast
        // boost on broad tonal areas, matching Evoto's "decrease low
        // frequency = enhance facial structure and depth" guidance.
        if recipe.skinLowFreq < 0 {
            let controls = CIFilter.colorControls()
            controls.inputImage = current
            controls.contrast = 1.0 + Float(-recipe.skinLowFreq) * 0.15
            controls.saturation = 1.0
            controls.brightness = 0
            current = controls.outputImage ?? current
        }

        if recipe.highlightRecovery > 0 {
            let r = recipe.highlightRecovery
            let toneCurve = CIFilter.toneCurve()
            toneCurve.inputImage = current
            toneCurve.point0 = CGPoint(x: 0,    y: 0)
            toneCurve.point1 = CGPoint(x: 0.50, y: 0.50)
            toneCurve.point2 = CGPoint(x: 0.65, y: 0.65)
            toneCurve.point3 = CGPoint(x: 0.85, y: 0.85 - 0.07 * r)
            toneCurve.point4 = CGPoint(x: 1.00, y: 0.92 - 0.08 * r)
            current = toneCurve.outputImage ?? current
        }

        // Phase 7B — eye-region sharpen + catch-light boost. Runs last
        // so detection sees the fully-toned image (white-balance and
        // exposure correct) and the masked filters apply on top of all
        // upstream adjustments. No-op when no faces detected.
        current = EyeEffectFilter.apply(recipe: recipe, to: current)

        return current
    }

    // Encoding moved to `ColorManagement.encodeJPEG` so color-space +
    // ICC profile tagging stays a single source of truth across all
    // render pipelines (RAW + display-JPEG-Magic).
}
