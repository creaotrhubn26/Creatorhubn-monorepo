import Foundation
import CoreImage
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// Single source of truth for color space + ICC profile handling
/// across the iPad CaptureApp's render pipelines.
///
/// **Why this exists:** the source files we work on (Canon CR3, the
/// `?kind=display` JPEG Canon embeds for previews) are all tagged
/// **Display P3** — a wide-gamut color space. Our render pipelines
/// (`RAWExportPipeline`, `MagicPipeline`) constructed `CIContext`
/// without specifying a working color space, which defaults to
/// linear sRGB. This silently down-gamuted everything to sRGB and
/// then wrote JPEGs **without an ICC profile tag**, which means:
///
///   * On the photographer's iPad Pro Display P3 screen, hero
///     previews looked less saturated than they should — we'd
///     thrown away gamut information before display.
///   * Client-gallery deliverables landed on web browsers without
///     a color profile tag. Modern browsers assume sRGB when no
///     tag is present, but older Safari + color-unmanaged Windows
///     paths could shift colors.
///
/// **Policy this module enforces:**
///
///   * **Hero preview path** (in-app, RAW preview rendered by
///     `RAWExportService.renderPreview`): use **Display P3** end-to-
///     end so the wide gamut survives all the way to the iPad
///     screen. Tag the JPEG with the P3 ICC profile so SwiftUI's
///     `Image(uiImage:)` color-manages correctly.
///
///   * **Deliverable path** (`RAWExportService.render` for client
///     gallery upload): use **sRGB** end-to-end. Tag the JPEG with
///     the sRGB ICC profile so every browser interprets identically.
///     Most clients view on sRGB monitors anyway; tagging with sRGB
///     gives 100% color compatibility at a small (perceptible only
///     on wide-gamut displays) gamut cost.
///
///   * **Display preview path** (`MagicPipeline.renderToDisk` on
///     the camera-baked JPEG): use **Display P3** since the source
///     is already P3 and the result is consumed in-app on the iPad.
///
/// Helpers below should be the only place where `CIContext` is
/// constructed and the only place where `CGImageDestination` is
/// finalized for color-aware output. Anything else is a leak.
enum ColorManagement {

    /// What the rendered image will be consumed by. Drives the
    /// color-space + ICC choice — no other knob needed at call sites.
    /// Photographer-selectable for delivery; in-app preview is fixed
    /// to Display P3 since the iPad's screen is wide-gamut.
    enum Purpose {
        /// Hero preview displayed inside the app on the iPad's
        /// Display P3 screen. Wide gamut survives end-to-end.
        case appPreview
        /// JPEG uploaded to the client gallery for cross-device,
        /// cross-browser viewing. sRGB + ICC tag for compatibility.
        /// Default for `.web` delivery — universal denominator.
        case webDelivery
        /// JPEG for clients viewing in the modern Apple ecosystem
        /// (web on Safari/Chrome macOS+iOS) where Display P3 is
        /// honored. Wider gamut than sRGB but partial Windows
        /// support. Use when the photographer knows the client is
        /// on Apple devices (e.g. iCloud Photos handoff, AirDrop).
        case wideGamutDelivery
        /// JPEG bound for a print workflow — Adobe RGB (1998) tag.
        /// 50% wider gamut than sRGB; well-supported by RIP software
        /// + photo lab pre-press (sRGB→CMYK conversion drops more
        /// saturation than AdobeRGB→CMYK). NOT for web — uncolor-
        /// managed browsers strip the profile and the result looks
        /// desaturated.
        case printDelivery
    }

    /// CGColorSpace to use as both the CIContext working space AND
    /// the output CGImage's color space when rendering for `purpose`.
    static func outputColorSpace(for purpose: Purpose) -> CGColorSpace {
        switch purpose {
        case .appPreview, .wideGamutDelivery:
            // Display P3 covers ~25% more of the visible spectrum
            // than sRGB, especially in saturated reds/greens. iPad
            // Pro screens render in P3 natively. Web Safari + modern
            // Chrome honor Display P3 ICC tag.
            return CGColorSpace(name: CGColorSpace.displayP3)
                ?? CGColorSpaceCreateDeviceRGB()
        case .webDelivery:
            // sRGB is the universal denominator. Browsers without
            // color management assume sRGB; browsers with color
            // management round-trip sRGB → display correctly.
            return CGColorSpace(name: CGColorSpace.sRGB)
                ?? CGColorSpaceCreateDeviceRGB()
        case .printDelivery:
            // Adobe RGB (1998). ~50% wider gamut than sRGB; the
            // industry-standard exchange profile for photo labs +
            // RIP software. Browsers without color management
            // strip the profile and the result LOOKS DESATURATED —
            // never use this for web galleries; only print.
            return CGColorSpace(name: CGColorSpace.adobeRGB1998)
                ?? CGColorSpaceCreateDeviceRGB()
        }
    }

    /// Construct a CIContext explicitly tied to the right working
    /// color space. CIContext defaults to linear sRGB working space
    /// regardless of source — explicitly setting it preserves wide
    /// gamut through filter chains (especially CIRAWFilter, which
    /// emits in scene-linear and gets mapped on outputImage).
    static func makeContext(for purpose: Purpose) -> CIContext {
        let space = outputColorSpace(for: purpose)
        return CIContext(options: [
            .useSoftwareRenderer: false,
            .workingColorSpace: space,
            .outputColorSpace: space,
        ])
    }

    /// Render a CIImage to a CGImage in `purpose`'s color space.
    /// The returned CGImage carries the color space tag, which is
    /// what `encodeJPEG` then forwards into the JPEG's ICC profile.
    static func renderCGImage(
        from image: CIImage,
        context: CIContext,
        purpose: Purpose,
    ) -> CGImage? {
        let space = outputColorSpace(for: purpose)
        return context.createCGImage(
            image,
            from: image.extent,
            format: .RGBA8,
            colorSpace: space,
        )
    }

    /// Encode a CGImage to a JPEG with the matching ICC profile
    /// embedded so consumers (browsers, Apple Photos, Lightroom)
    /// interpret colors correctly. The CGImage's own color space
    /// gets serialized as the JPEG's tagged profile — no extra ICC
    /// blob needed; CGImageDestination handles the embedding.
    static func encodeJPEG(
        cgImage: CGImage,
        purpose: Purpose,
        quality: CGFloat,
    ) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            data,
            UTType.jpeg.identifier as CFString,
            1,
            nil,
        ) else {
            throw EncodeError.destinationFailed
        }
        // The CGImage already carries the color space we want; pass
        // the colour-management properties explicitly anyway so the
        // ICC blob lands in the JPEG header even if upstream changes
        // ever drop the source colorSpace tag on the CGImage.
        let space = outputColorSpace(for: purpose)
        let options: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality,
            kCGImagePropertyProfileName: (space.name as String?) ?? "",
        ]
        CGImageDestinationAddImage(destination, cgImage, options as CFDictionary)
        guard CGImageDestinationFinalize(destination) else {
            throw EncodeError.finalizeFailed
        }
        return data as Data
    }

    enum EncodeError: Swift.Error, Equatable {
        case destinationFailed
        case finalizeFailed
    }

    // MARK: - Orientation

    /// Read the EXIF/TIFF orientation tag from a RAW or JPEG byte
    /// blob. CGImageProperty values are 1…8 per the TIFF spec:
    ///   1 = up         (no rotation)
    ///   3 = down       (180°)
    ///   6 = right      (camera held landscape, rotated 90° CW for display)
    ///   8 = left       (camera held landscape, rotated 270° CW for display)
    ///   2/4/5/7        = mirrored variants (rare on Canon bodies)
    /// Returns `.up` when the source carries no orientation tag — safer
    /// than guessing.
    ///
    /// **Why pipelines need this:** Apple's `CIRAWFilter.outputImage`
    /// emits sensor-natural pixel order. On a camera held landscape
    /// (8192×5464), that's correct; on a camera rotated to portrait
    /// (still 8192×5464 sensor, EXIF orientation=8), the photo lands
    /// rotated 90° in the rendered JPEG unless someone applies the
    /// EXIF rotation. Web browsers + Photos.app honour the `kCGImage
    /// PropertyOrientation` JPEG tag, but iPad in-app preview reads
    /// raw pixels — so we apply the rotation in pixels, then write
    /// the JPEG with orientation = up. That makes a single source of
    /// truth (rendered pixels == final orientation) regardless of
    /// downstream consumer.
    static func readOrientation(from rawData: Data) -> CGImagePropertyOrientation {
        guard let source = CGImageSourceCreateWithData(rawData as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
                as? [String: Any],
              let raw = props[kCGImagePropertyOrientation as String] as? UInt32,
              let orientation = CGImagePropertyOrientation(rawValue: raw)
        else {
            return .up
        }
        return orientation
    }
}
