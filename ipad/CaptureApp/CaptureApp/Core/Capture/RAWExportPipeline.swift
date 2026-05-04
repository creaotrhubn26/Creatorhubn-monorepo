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
    ///     profile via ``ColorManagement``. `.clientDelivery` (default)
    ///     = sRGB-tagged JPEG for the gallery upload (cross-browser-
    ///     safe). `.appPreview` = Display P3-tagged JPEG for the
    ///     in-app hero so the iPad Pro's wide-gamut screen actually
    ///     gets the gamut.
    /// - Returns: JPEG bytes the photographer can hand off / upload.
    static func render(
        rawData: Data,
        recipe: MagicRecipe,
        identifierHint: String? = nil,
        jpegCompressionQuality: CGFloat = 0.92,
        targetMaxDimension: CGFloat? = nil,
        colorPurpose: ColorManagement.Purpose = .clientDelivery,
    ) throws -> Data {
        guard let filter = makeRawFilter(rawData: rawData, identifierHint: identifierHint) else {
            throw Error.decodeFailed
        }

        applyRecipe(recipe, to: filter)

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

        let toned = applyToneAdjustments(recipe: recipe, to: rawOutput)

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
    ///   - `skinSmooth` 0…1 → `luminanceNoiseReductionAmount` 0.2…0.7 (RAW
    ///     carries more sensor noise than the in-camera JPEG, so the floor
    ///     is biased up). Skin softening on RAW happens through luminance
    ///     NR rather than a dedicated bilateral filter; for portrait-grade
    ///     softening the photographer would still reach for the retouch
    ///     pipeline (frequency-separation) downstream.
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

        if recipe.skinSmooth > 0, filter.isLuminanceNoiseReductionSupported {
            filter.luminanceNoiseReductionAmount = 0.2 + Float(recipe.skinSmooth) * 0.5
        }

        // Lens correction (vignette, distortion, chromatic aberration)
        // when Apple's profile DB has the lens. Free quality lift —
        // turn on when supported, no-op otherwise. CIRAWFilter handles
        // the per-lens lookup internally.
        if filter.isLensCorrectionSupported {
            filter.isLensCorrectionEnabled = true
        }

        // Highlight recovery — a linear-space `CIToneCurve` rolloff that
        // pulls the 90-100% range down proportional to the slider, so
        // the photographer can tune exactly how much "softening" of
        // highlights they want without affecting midtones. Done in
        // linear scene-referred (via `linearSpaceFilter`) so the curve
        // acts on actual scene radiance, not gamma-encoded display
        // values — preserves natural rolloff. Apple's native
        // `isHighlightRecoveryEnabled` requires iOS 26 so we don't
        // gate on it here; the linear curve gives most of the same
        // benefit.
        if recipe.highlightRecovery > 0 {
            let toneCurve = CIFilter.toneCurve()
            let topPull = CGFloat(1.0 - 0.15 * recipe.highlightRecovery)
            toneCurve.point0 = CGPoint(x: 0,    y: 0)
            toneCurve.point1 = CGPoint(x: 0.25, y: 0.25)
            toneCurve.point2 = CGPoint(x: 0.50, y: 0.50)
            toneCurve.point3 = CGPoint(x: 0.85, y: 0.78 + 0.07 * (1 - recipe.highlightRecovery))
            toneCurve.point4 = CGPoint(x: 1,    y: topPull)
            filter.linearSpaceFilter = toneCurve
        } else {
            filter.linearSpaceFilter = nil
        }
    }

    /// Apply contrast + saturation post-demosaic on sRGB. Mirrors the
    /// display pipeline's `* 0.45` mapping so live preview and final
    /// RAW deliverable agree on these axes — a `+0.5 contrast` slider
    /// produces the same perceived bump in both outputs.
    ///   - `contrast` -1…+1 → 0.55…1.45 around 1.0 (neutral).
    ///   - `saturation` -1…+1 → 0.55…1.45 around 1.0 (neutral).
    /// Brightness stays at 0 — exposure shifts belong upstream on the RAW
    /// itself, not as a post tone-curve nudge.
    static func applyToneAdjustments(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        guard recipe.contrast != 0 || recipe.saturation != 0 else { return image }
        let controls = CIFilter.colorControls()
        controls.inputImage = image
        controls.contrast = 1.0 + Float(recipe.contrast) * 0.45
        controls.saturation = 1.0 + Float(recipe.saturation) * 0.45
        controls.brightness = 0
        return controls.outputImage ?? image
    }

    // Encoding moved to `ColorManagement.encodeJPEG` so color-space +
    // ICC profile tagging stays a single source of truth across all
    // render pipelines (RAW + display-JPEG-Magic).
}
