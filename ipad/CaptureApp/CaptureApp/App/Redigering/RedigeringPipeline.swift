import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

/// Render path for the Redigering tab. Supports RAW directly: when an asset
/// has a camera-original RAW (`rawKey`), it demosaics through `CIRAWFilter`
/// (via ``RAWExportPipeline``) — NO pre-conversion to JPEG. Falls back to the
/// display JPEG via ``MagicPipeline`` when there's no RAW. Exposure (EV) is
/// applied as a post step so "Eksponering" is a true exposure control rather
/// than only a shadow lift.
enum RedigeringPipeline {

    /// Render the editable preview for the given source + recipe + exposure.
    /// `rawPath` wins when present (real RAW support). Heavy — call off the
    /// main actor.
    static func renderPreview(
        rawPath: String?,
        jpegPath: String?,
        recipe: MagicRecipe,
        exposureEV: Double,
        crop: CGRect? = nil,
        maxDimension: CGFloat? = 1600,
    ) -> UIImage? {
        var base: UIImage?

        if let rawPath, let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)) {
            let hint = (rawPath as NSString).pathExtension.lowercased()
            if let jpeg = try? RAWExportPipeline.render(
                rawData: data, recipe: recipe, identifierHint: hint.isEmpty ? nil : hint,
                targetMaxDimension: maxDimension, colorPurpose: .appPreview,
            ) {
                base = UIImage(data: jpeg)
            }
        }
        if base == nil, let jpegPath {
            base = MagicPipeline.renderPreview(source: jpegPath, recipe: recipe)
        }
        guard var img = base else { return nil }
        if exposureEV != 0 { img = applyExposure(exposureEV, to: img) ?? img }
        if let crop { img = cropped(img, to: crop) }
        return img
    }

    /// Full-resolution web-delivery render for export/persist. RAW when
    /// available, else re-encodes the display JPEG with the recipe.
    static func renderExport(rawPath: String?, jpegPath: String?, recipe: MagicRecipe, exposureEV: Double, crop: CGRect? = nil) -> Data? {
        var out: UIImage?
        if let rawPath, let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)) {
            let hint = (rawPath as NSString).pathExtension.lowercased()
            if let jpeg = try? RAWExportPipeline.render(
                rawData: data, recipe: recipe, identifierHint: hint.isEmpty ? nil : hint,
                targetMaxDimension: nil, colorPurpose: .webDelivery,
            ) {
                out = UIImage(data: jpeg)
            }
        }
        if out == nil, let jpegPath {
            out = MagicPipeline.renderPreview(source: jpegPath, recipe: recipe)
        }
        guard var img = out else { return nil }
        if exposureEV != 0 { img = applyExposure(exposureEV, to: img) ?? img }
        if let crop { img = cropped(img, to: crop) }
        return img.jpegData(compressionQuality: 0.92)
    }

    /// Crop to a normalised rect (origin top-left, 0…1).
    static func cropped(_ image: UIImage, to norm: CGRect) -> UIImage {
        guard let cg = image.cgImage else { return image }
        let w = CGFloat(cg.width), h = CGFloat(cg.height)
        let rect = CGRect(x: norm.minX * w, y: norm.minY * h,
                          width: norm.width * w, height: norm.height * h).integral
        guard rect.width >= 1, rect.height >= 1, let c = cg.cropping(to: rect) else { return image }
        return UIImage(cgImage: c, scale: image.scale, orientation: image.imageOrientation)
    }

    /// Apply an EV exposure shift via CIExposureAdjust.
    static func applyExposure(_ ev: Double, to image: UIImage) -> UIImage? {
        guard let ci = CIImage(image: image) else { return image }
        let f = CIFilter.exposureAdjust()
        f.inputImage = ci
        f.ev = Float(ev)
        guard let out = f.outputImage else { return image }
        let context = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = context.createCGImage(out, from: out.extent) else { return image }
        return UIImage(cgImage: cg)
    }
}
