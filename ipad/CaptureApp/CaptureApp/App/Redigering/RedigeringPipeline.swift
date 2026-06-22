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
        guard let img = base else { return nil }
        return exposureEV == 0 ? img : (applyExposure(exposureEV, to: img) ?? img)
    }

    /// Full-resolution web-delivery render for export/persist. RAW when
    /// available, else re-encodes the display JPEG with the recipe.
    static func renderExport(rawPath: String?, jpegPath: String?, recipe: MagicRecipe, exposureEV: Double) -> Data? {
        if let rawPath, let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)) {
            let hint = (rawPath as NSString).pathExtension.lowercased()
            if let jpeg = try? RAWExportPipeline.render(
                rawData: data, recipe: recipe, identifierHint: hint.isEmpty ? nil : hint,
                targetMaxDimension: nil, colorPurpose: .webDelivery,
            ) {
                if exposureEV == 0 { return jpeg }
                if let img = UIImage(data: jpeg), let ev = applyExposure(exposureEV, to: img) {
                    return ev.jpegData(compressionQuality: 0.92)
                }
                return jpeg
            }
        }
        if let jpegPath, let img = MagicPipeline.renderPreview(source: jpegPath, recipe: recipe) {
            let final = exposureEV == 0 ? img : (applyExposure(exposureEV, to: img) ?? img)
            return final.jpegData(compressionQuality: 0.92)
        }
        return nil
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
