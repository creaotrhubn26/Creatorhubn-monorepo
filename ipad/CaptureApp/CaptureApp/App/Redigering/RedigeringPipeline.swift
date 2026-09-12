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
        // #1 RAW-CACHE: den interaktive banen GJENBRUKER ett CIRAWFilter per asset
        // (cachet) i stedet for å lese 30–50 MB fra disk + re-parse RAW hvert
        // slider-slipp. Kun filter-properties muteres → Core Image gjenbruker
        // dekodingen; ingen JPEG-round-trip (rendrer rett til UIImage). #2 EV
        // påføres NATIVT på CIRAWFilter (pre-demosaic) i denne banen.
        if let rawPath, let entry = cachedRawFilter(rawPath: rawPath),
           var img = entry.render(recipe: recipe, exposureEV: exposureEV, maxDimension: maxDimension) {
            if let crop { img = cropped(img, to: crop) }
            return img
        }
        // JPEG-fallback (ingen RAW): EV som post-steg på 8-bit — det beste vi kan
        // uten sensor-headroom (henter ikke klippede høylys).
        guard let jpegPath, var img = MagicPipeline.renderPreview(source: jpegPath, recipe: recipe) else { return nil }
        if exposureEV != 0 { img = applyExposure(exposureEV, to: img) ?? img }
        if let crop { img = cropped(img, to: crop) }
        return img
    }

    /// Full-resolution web-delivery render for export/persist. RAW when
    /// available, else re-encodes the display JPEG with the recipe.
    static func renderExport(rawPath: String?, jpegPath: String?, recipe: MagicRecipe, exposureEV: Double, crop: CGRect? = nil) -> Data? {
        var out: UIImage?
        var evAppliedInRaw = false
        if let rawPath, let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)) {
            let hint = (rawPath as NSString).pathExtension.lowercased()
            // #2 EV NATIVT (pre-demosaic) også på eksport → leveransen henter samme
            // høylys som previewen viser (WYSIWYG mot den cachede render-banen).
            if let jpeg = try? RAWExportPipeline.render(
                rawData: data, recipe: recipe, identifierHint: hint.isEmpty ? nil : hint,
                exposureEV: exposureEV, targetMaxDimension: nil, colorPurpose: .webDelivery,
            ) {
                out = UIImage(data: jpeg)
                evAppliedInRaw = true
            }
        }
        if out == nil, let jpegPath {
            out = MagicPipeline.renderPreview(source: jpegPath, recipe: recipe)
        }
        guard var img = out else { return nil }
        // Kun JPEG-fallback trenger post-EV; RAW-banen har alt påført det nativt.
        if exposureEV != 0, !evAppliedInRaw { img = applyExposure(exposureEV, to: img) ?? img }
        if let crop { img = cropped(img, to: crop) }
        return img.jpegData(compressionQuality: 0.92)
    }

    /// PLAIN nøytral RAW-develop (bar CIRAWFilter, sRGB) — for «Min stil»-banen.
    /// Den lærte CDF-LUT-en ble trent på en NØYTRAL rawpy-develop (~0.42 luma).
    /// `renderPreview` gir derimot en Canon-Picture-Style-baket, tone-justert,
    /// `.appPreview`-fargestyrt base — påfører man LUT-en på DEN, blir det utvasket.
    /// Denne matcher trenings-neutralen (bekreftet: harness mot bar CIRAWFilter gir
    /// riktig, rikt resultat). EV + crop påføres etterpå som i `renderPreview`.
    /// NØYTRAL 16-BIT base som CIImage — for «Min stil»-banen. 🔑 CR3 er 14-bit og
    /// CIRAWFilter gir ut flyttall; å kollapse til 8-bit HER (som før) kastet
    /// headroom + ga banding for HELE redigeringskjeden (LUT/LAB/hud). Nå
    /// materialiseres basen til **RGBA16 (16-bit)** og forblir en høy-bit CIImage
    /// gjennom hele `LearnedStyle.apply`; 8-bit skjer KUN ved siste visning/eksport
    /// (`ColorManagement.renderCGImage`). LearnedStyle-filtrene er late (float
    /// internt), så presisjonen bevares helt til slutt.
    ///   • EV=0 (vanligst) → cachet (demosaic er dyr, endres aldri for en RAW).
    ///   • EV≠0 → EKTE eksponering: CIExposureAdjust på den FLYTENDE RAW-utgangen
    ///     FØR 16-bit-materialisering → utblåste høylys hentes tilbake.
    static func neutralBaseCIImage(
        rawPath: String, exposureEV: Double = 0, crop: CGRect? = nil,
        maxDimension: CGFloat? = 1600,
    ) -> CIImage? {
        let cg = exposureEV == 0
            ? cachedNeutral16(rawPath: rawPath, maxDimension: maxDimension)
            : develop16(rawPath: rawPath, exposureEV: exposureEV, maxDimension: maxDimension)
        guard let cg else { return nil }
        var ci = CIImage(cgImage: cg)
        if let crop { ci = croppedCI(ci, to: crop) }
        return ci
    }

    // Lås-beskyttet base-cache (nås fra render()-ens detached task, off-main).
    // Holder 16-bit CGImage (materialisert demosaic) for rask gjenbruk.
    private nonisolated(unsafe) static var neutral16Cache: [String: CGImage] = [:]
    private static let cacheLock = NSLock()

    private static func cachedNeutral16(rawPath: String, maxDimension: CGFloat?) -> CGImage? {
        let key = "\(rawPath)@\(maxDimension.map { Int($0) } ?? 0)"
        cacheLock.lock()
        let hit = neutral16Cache[key]
        cacheLock.unlock()
        if let hit { return hit }
        guard let cg = develop16(rawPath: rawPath, exposureEV: 0, maxDimension: maxDimension) else { return nil }
        cacheLock.lock()
        if neutral16Cache.count >= 4 { neutral16Cache.removeAll() }   // enkel minne-cap
        neutral16Cache[key] = cg
        cacheLock.unlock()
        return cg
    }

    /// Bar CIRAWFilter-develop → 16-bit (RGBA16, sRGB). EV på den FLYTENDE utgangen
    /// FØR 16-bit-materialisering (lineært lys → ekte eksponering + headroom).
    private static func develop16(rawPath: String, exposureEV: Double, maxDimension: CGFloat?) -> CGImage? {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)),
              let filter = CIFilter(imageData: data, options: nil),
              var out = filter.outputImage else { return nil }
        if exposureEV != 0 {
            let e = CIFilter.exposureAdjust()
            e.inputImage = out
            e.ev = Float(exposureEV)
            out = e.outputImage ?? out
        }
        if let maxDimension {
            let longEdge = max(out.extent.width, out.extent.height)
            if longEdge > maxDimension {
                let s = maxDimension / longEdge
                out = out.transformed(by: CGAffineTransform(scaleX: s, y: s))
            }
        }
        return sharedContext.createCGImage(
            out, from: out.extent, format: .RGBA16,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
    }

    /// Beskjær et CIImage til en normalisert rekt (origo topp-venstre, som crops-
    /// dictet) — CIImage har origo NEDE-venstre, så Y flippes.
    private static func croppedCI(_ image: CIImage, to norm: CGRect) -> CIImage {
        let e = image.extent
        let rect = CGRect(x: e.origin.x + norm.minX * e.width,
                          y: e.origin.y + (1 - norm.minY - norm.height) * e.height,
                          width: norm.width * e.width, height: norm.height * e.height)
        let c = image.cropped(to: rect)
        return c.extent.isEmpty ? image : c
    }

    // MARK: - RAW-filter-cache (#1: interaktiv slider-følelse)

    /// Cachet, gjenbrukbart CIRAWFilter for den INTERAKTIVE preset-banen — så
    /// slider-slipp ikke leser 30–50 MB fra disk + re-parser RAW hver gang. Kun
    /// filter-properties muteres; Core Image gjenbruker den dyre dekodingen.
    /// Lås-serialisert (CIRAWFilter er ikke trådsikkert for samtidig mutasjon).
    final class CachedRawFilter: @unchecked Sendable {
        let filter: CIRAWFilter
        let asShotTemperature: Float
        let defaultLuminanceNR: Float
        let pictureStyleBaseline: MagicRecipe
        private let lock = NSLock()

        init(filter: CIRAWFilter, pictureStyleBaseline: MagicRecipe) {
            self.filter = filter
            self.asShotTemperature = filter.neutralTemperature
            self.defaultLuminanceNR = filter.luminanceNoiseReductionAmount
            self.pictureStyleBaseline = pictureStyleBaseline
        }

        /// Tonet UIImage for recipen (serialisert per asset), rett til UIImage.
        /// EV påføres NATIVT på CIRAWFilter (pre-demosaic) via `tonedImage`.
        func render(recipe: MagicRecipe, exposureEV: Double, maxDimension: CGFloat?) -> UIImage? {
            lock.lock(); defer { lock.unlock() }
            guard let ci = RAWExportPipeline.tonedImage(
                filter: filter, asShotTemperature: asShotTemperature,
                defaultLuminanceNR: defaultLuminanceNR, pictureStyleBaseline: pictureStyleBaseline,
                recipe: recipe, exposureEV: exposureEV, targetMaxDimension: maxDimension) else { return nil }
            let ctx = ColorManagement.makeContext(for: .appPreview)
            guard let cg = ColorManagement.renderCGImage(from: ci, context: ctx, purpose: .appPreview)
            else { return nil }
            return UIImage(cgImage: cg)
        }
    }

    private nonisolated(unsafe) static var rawFilterCache: [String: CachedRawFilter] = [:]
    private static let rawFilterCacheLock = NSLock()

    /// Hent (eller bygg) det cachede filteret for en RAW-sti. Bygging leser +
    /// parser rå-bytene ÉN gang; nøkkel inkluderer mtime så en re-import invalideres.
    private static func cachedRawFilter(rawPath: String) -> CachedRawFilter? {
        let attrs = try? FileManager.default.attributesOfItem(atPath: rawPath)
        let mtime = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        let key = "\(rawPath)@\(mtime)"
        rawFilterCacheLock.lock()
        if let hit = rawFilterCache[key] { rawFilterCacheLock.unlock(); return hit }
        rawFilterCacheLock.unlock()

        guard let data = try? Data(contentsOf: URL(fileURLWithPath: rawPath)) else { return nil }
        let hint = (rawPath as NSString).pathExtension.lowercased()
        guard let filter = RAWExportPipeline.makeRawFilter(
            rawData: data, identifierHint: hint.isEmpty ? nil : hint) else { return nil }
        let baseline = (CanonPictureStyle.read(fromImageData: data) ?? .unknown).baselineRecipeAdjustment
        let entry = CachedRawFilter(filter: filter, pictureStyleBaseline: baseline)
        rawFilterCacheLock.lock()
        if rawFilterCache.count >= 2 { rawFilterCache.removeAll() }   // RAW-filtre er minnetunge
        rawFilterCache[key] = entry
        rawFilterCacheLock.unlock()
        return entry
    }

    /// Tøm base-cachen (f.eks. ved minnepress / øktbytte).
    static func clearBaseCache() {
        cacheLock.lock(); neutral16Cache.removeAll(); cacheLock.unlock()
        rawFilterCacheLock.lock(); rawFilterCache.removeAll(); rawFilterCacheLock.unlock()
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
