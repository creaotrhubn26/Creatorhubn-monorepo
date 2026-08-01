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

    /// PLAIN nøytral RAW-develop (bar CIRAWFilter, sRGB) — for «Min stil»-banen.
    /// Den lærte CDF-LUT-en ble trent på en NØYTRAL rawpy-develop (~0.42 luma).
    /// `renderPreview` gir derimot en Canon-Picture-Style-baket, tone-justert,
    /// `.appPreview`-fargestyrt base — påfører man LUT-en på DEN, blir det utvasket.
    /// Denne matcher trenings-neutralen (bekreftet: harness mot bar CIRAWFilter gir
    /// riktig, rikt resultat). EV + crop påføres etterpå som i `renderPreview`.
    static func renderNeutralRAW(
        rawPath: String, exposureEV: Double = 0, crop: CGRect? = nil,
        maxDimension: CGFloat? = 1600,
    ) -> UIImage? {
        // CACHE: den demosaikede basen (Data-lesing 30–50MB + CIRAWFilter-develop +
        // skalering) er RECIPE-UAVHENGIG for den lærte banen og endrer seg aldri for
        // en gitt RAW. Cache per (sti, maxDim) → slider-slipp gjenbruker basen og
        // påfører kun EV/crop (billige) i stedet for full re-develop hver gang.
        guard let base = cachedNeutralBase(rawPath: rawPath, maxDimension: maxDimension) else { return nil }
        var img = base
        if exposureEV != 0 { img = applyExposure(exposureEV, to: img) ?? img }
        if let crop { img = cropped(img, to: crop) }
        return img
    }

    // Lås-beskyttet base-cache (nås fra render()-ens detached task, off-main).
    private nonisolated(unsafe) static var neutralBaseCache: [String: UIImage] = [:]
    private static let cacheLock = NSLock()

    private static func cachedNeutralBase(rawPath: String, maxDimension: CGFloat?) -> UIImage? {
        let key = "\(rawPath)@\(maxDimension.map { Int($0) } ?? 0)"
        cacheLock.lock()
        let hit = neutralBaseCache[key]
        cacheLock.unlock()
        if let hit { return hit }

        guard let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)),
              let filter = CIFilter(imageData: data, options: nil),
              var out = filter.outputImage else { return nil }
        if let maxDimension {
            let longEdge = max(out.extent.width, out.extent.height)
            if longEdge > maxDimension {
                let s = maxDimension / longEdge
                out = out.transformed(by: CGAffineTransform(scaleX: s, y: s))
            }
        }
        guard let cg = sharedContext.createCGImage(
            out, from: out.extent, format: .RGBA8,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else { return nil }
        let img = UIImage(cgImage: cg)
        cacheLock.lock()
        if neutralBaseCache.count >= 4 { neutralBaseCache.removeAll() }   // enkel minne-cap
        neutralBaseCache[key] = img
        cacheLock.unlock()
        return img
    }

    /// Tøm base-cachen (f.eks. ved minnepress / øktbytte).
    static func clearBaseCache() {
        cacheLock.lock(); neutralBaseCache.removeAll(); cacheLock.unlock()
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
        guard let cg = sharedContext.createCGImage(out, from: out.extent) else { return image }
        return UIImage(cgImage: cg)
    }

    /// Delt GPU-render-kontekst. CIContext er dyr å opprette (allokerer Metal-
    /// ressurser) og skal gjenbrukes — ikke opprettes per slider-slipp.
    static let sharedContext = CIContext(options: [.useSoftwareRenderer: false])
}
