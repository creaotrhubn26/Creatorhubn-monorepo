import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision

/// EN samlet, persistert per-bilde-analyse. Måles ÉN gang (ett Vision-pass, alt på
/// ~1024 px float, delt CIContext, off-main) og driver fire flater fra samme kilde
/// i stedet for re-beregning per visning: on-set-HUD, cull, auto-edit-forslag og
/// Kvalitetssjekk-steget. Persisteres inline på `AssetSignals` (JSON) — ingen
/// migrasjon. Alle mål feiler grasiøst mot nil/0 (aldri kast) — en dårlig ramme
/// skal aldri velte kjeden.
///
/// Denne runden fyller fundamentet + driver HUD-varselet «ansiktet er soft /
/// lukkede øyne»; cull/forslag/QC kobles på senere ved å LESE denne structen.
struct AssetAnalysis: Sendable, Equatable, Hashable, Codable {
    var version: Int

    // MARK: Eksponering & tone (det lærte stilen + auto-EV faktisk trenger)
    var medianLuma: Double          // 0…1
    var p5Luma: Double              // dynamisk spredning, lav ende
    var p95Luma: Double             // dynamisk spredning, høy ende
    var highlightClip: Double       // andel piksler med luma ≥ 0.98 (hele bildet)
    var shadowClip: Double          // andel piksler med luma ≤ 0.02
    /// MOTIV-klipping: andel av MOTIV-pikslene (personmaske) som er utbrent —
    /// mye viktigere enn global klipp (2 % i en spekulær ring ≠ 2 % i brudekjolen).
    /// nil når ingen person segmenteres.
    var subjectHighlightClip: Double?

    // MARK: Skarphet, riktig sted
    var globalSharpness: Double     // Laplacian-energi, hele bildet (rå)
    /// Skarphet MÅLT INNENFOR motivet (personmaske) — skiller «vakker bokeh»
    /// fra «bommet fokus». nil når ingen person segmenteres.
    var subjectSharpness: Double?

    // MARK: Hvitbalanse (hud-forankret) — cast fra største ansikt, nil uten ansikt
    var skinCast: ImageAnalysis.SkinReading.Cast?

    // MARK: Ansikter (per ansikt — det største hullet for et bryllupsverktøy)
    var faces: [FaceAnalysis]

    // MARK: Scene-signatur (12-dim, delt med LearnedStyle) — «lignende bilder»,
    // preset-valg, motlys/gyllen-time-klassifisering.
    var sceneFeature: [Double]

    static let currentVersion = 1

    /// Erstatt eventuelle non-finite Double-er (nan/inf fra divisjon/areaAverage)
    /// med 0 FØR persistering — én non-finite i bloben fikk ellers JSONEncoder til
    /// å kaste, som stille slettet HELE `signals`-bloben. Kalles av
    /// `AssetAnalyzer.run()`. Ren, testbar.
    func sanitized() -> AssetAnalysis {
        func f(_ v: Double) -> Double { v.isFinite ? v : 0 }
        func fo(_ v: Double?) -> Double? { v.map { $0.isFinite ? $0 : 0 } }
        return AssetAnalysis(
            version: version,
            medianLuma: f(medianLuma), p5Luma: f(p5Luma), p95Luma: f(p95Luma),
            highlightClip: f(highlightClip), shadowClip: f(shadowClip),
            subjectHighlightClip: fo(subjectHighlightClip),
            globalSharpness: f(globalSharpness), subjectSharpness: fo(subjectSharpness),
            skinCast: skinCast,
            faces: faces.map { face in
                var s = face
                s.sizeFraction = f(face.sizeFraction)
                s.luma = f(face.luma)
                s.captureQuality = fo(face.captureQuality)
                s.sharpness = fo(face.sharpness)
                return s
            },
            sceneFeature: sceneFeature.map { $0.isFinite ? $0 : 0 })
    }

    /// Praktiske avledninger for HUD/QC (rene, testbare — ingen Vision).
    var hasFaces: Bool { !faces.isEmpty }
    /// Største ansikt (etter areal) — «hovedpersonen» i de fleste portretter.
    var primaryFace: FaceAnalysis? { faces.max { $0.sizeFraction < $1.sizeFraction } }

    /// P5 (E7 v1): on-set-flagg for filmstripen — det fotografen kan reagere på
    /// mens bildet kan tas om. nil = ok. Ren, testbar.
    enum OnSetFlag: String, Hashable { case blurry, lowFaceQuality }
    var onSetFlag: OnSetFlag? {
        if let face = primaryFace {
            if face.isSoft(globalSharpness: globalSharpness) { return .blurry }
            if let q = face.captureQuality, q < 0.35 { return .lowFaceQuality }
        } else if globalSharpness < 0.0006 {
            // Ingen ansikt (landskap/produkt) → global uskarphet.
            return .blurry
        }
        return nil
    }
}

/// Per-ansikt-metrikker fra det ene deteksjonspasset. Rekt i NORMALISERTE
/// bilde-koordinater, origo NEDE-VENSTRE (Vision-konvensjon).
struct FaceAnalysis: Sendable, Equatable, Hashable, Codable {
    var rect: CGRect
    var sizeFraction: Double            // ansiktsareal / bildeareal
    var luma: Double                    // 0…1, snitt innenfor inset ansikts-rekt
    var eyesOpen: Bool?                 // fra øye-landmark-aspektforhold
    var captureQuality: Double?         // VNDetectFaceCaptureQuality 0…1
    var sharpness: Double?              // Laplacian-energi innenfor ansikts-rekt (rå)
    var skinCast: ImageAnalysis.SkinReading.Cast?

    /// Er ansiktet mykt/ute av fokus relativt bildets globale skarphet? Rent
    /// avledet, brukes av HUD-varselet. `globalSharpness` = referanse.
    func isSoft(globalSharpness: Double) -> Bool {
        guard let s = sharpness else { return false }
        // Ansiktet er «soft» når dets Laplacian-energi er markant under bildets —
        // et skarpt ansikt på uskarp bakgrunn har HØYERE energi enn snittet, så
        // dette fanger nettopp bommet fokus, ikke vakker bokeh.
        return s < max(globalSharpness * 0.6, 0.0006)
    }
}

/// Off-main worker som produserer `AssetAnalysis` fra en preview/full-fil.
/// Aktør: serialiserer per instans, cacher per (sti, mtime) med LRU-tak.
actor AssetAnalyzer {
    private struct Key: Hashable { let path: String; let mtime: Double }
    private var cache: [Key: AssetAnalysis] = [:]
    private var order: [Key] = []
    private let maxEntries = 200

    func analyze(imageURL: URL) async -> AssetAnalysis? {
        let key = Self.cacheKey(for: imageURL)
        if let key, let hit = cache[key] { touch(key); return hit }
        let result = await Task.detached(priority: .userInitiated) {
            Self.run(imageURL: imageURL)
        }.value
        if let result, let key {
            cache[key] = result
            touch(key)
            while cache.count > maxEntries, let oldest = order.first {
                order.removeFirst()
                cache.removeValue(forKey: oldest)
            }
        }
        return result
    }

    private func touch(_ key: Key) {
        if let idx = order.firstIndex(of: key) { order.remove(at: idx) }
        order.append(key)
    }

    private static func cacheKey(for url: URL) -> Key? {
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        let mtime = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return Key(path: url.path, mtime: mtime)
    }

    // Delt GPU-kontekst (gjenbruk HUD-analysens for å slippe en ny CIContext).
    nonisolated static var ctx: CIContext { ImageAnalyser.sharedContext }

    // MARK: - Kjøring (off-main, ren)

    nonisolated static func run(imageURL: URL) -> AssetAnalysis? {
        guard let data = try? Data(contentsOf: imageURL),
              let full = CIImage(data: data) else { return nil }
        let fullExtent = full.extent
        guard fullExtent.width > 1, fullExtent.height > 1 else { return nil }

        // Alt måles på ÉN ~1024 px nedskalering (arkitektur-regel), i float.
        let cap: CGFloat = 1024
        let s = min(1, cap / max(fullExtent.width, fullExtent.height))
        let img = s < 1 ? full.transformed(by: CGAffineTransform(scaleX: s, y: s)) : full
        let extent = img.extent
        let ctx = self.ctx
        guard let cg = ctx.createCGImage(img, from: extent) else { return nil }

        // Luma-bilde (delt av histogram, klipp-masker og skarphet).
        let luma = img.applyingFilter("CIPhotoEffectMono")

        let hist = lumaHistogram(luma, extent: extent, ctx: ctx)
        let median = percentile(0.5, hist: hist)
        let p5 = percentile(0.05, hist: hist)
        let p95 = percentile(0.95, hist: hist)
        let (hiClip, loClip) = clipFractions(hist: hist)

        let globalSharp = laplacianEnergy(luma, rect: extent, ctx: ctx) ?? 0

        // ÉTT Vision-pass: personmaske + ansikts-landmarks + capture-quality.
        let mask = SubjectSegmentation.personMask(for: cg, extent: extent)
        let subjectHiClip = mask.flatMap { subjectClip(hiMaskSource: luma, subject: $0, extent: extent, ctx: ctx) }
        let subjectSharp = subjectSharpness(luma: luma, mask: mask, extent: extent, ctx: ctx)

        let faces = detectFaces(cg: cg, image: img, luma: luma, extent: extent, ctx: ctx,
                                globalSharpness: globalSharp)
        let primaryCast = faces.max { $0.sizeFraction < $1.sizeFraction }?.skinCast

        let sceneFeature = LearnedStyle.features(of: cg)

        return AssetAnalysis(
            version: AssetAnalysis.currentVersion,
            medianLuma: median, p5Luma: p5, p95Luma: p95,
            highlightClip: hiClip, shadowClip: loClip,
            subjectHighlightClip: subjectHiClip,
            globalSharpness: globalSharp, subjectSharpness: subjectSharp,
            skinCast: primaryCast,
            faces: faces,
            sceneFeature: sceneFeature).sanitized()   // aldri non-finite → trygg persistering
    }

    // MARK: - Histogram / persentiler

    nonisolated static func lumaHistogram(_ luma: CIImage, extent: CGRect, ctx: CIContext) -> [Double] {
        let bins = 256
        guard let f = CIFilter(name: "CIAreaHistogram") else { return [] }
        f.setValue(luma, forKey: kCIInputImageKey)
        f.setValue(CIVector(cgRect: extent), forKey: "inputExtent")
        f.setValue(bins, forKey: "inputCount")
        f.setValue(1.0, forKey: "inputScale")   // bins summerer ~1.0 (fraksjoner)
        guard let out = f.outputImage else { return [] }
        var buf = [Float](repeating: 0, count: bins * 4)
        ctx.render(out, toBitmap: &buf, rowBytes: bins * 4 * MemoryLayout<Float>.size,
                   bounds: CGRect(x: 0, y: 0, width: bins, height: 1), format: .RGBAf, colorSpace: nil)
        return (0..<bins).map { Double(buf[$0 * 4]) }   // luma = R-kanal (mono)
    }

    nonisolated static func percentile(_ target: Double, hist: [Double]) -> Double {
        let total = hist.reduce(0, +)
        guard total > 0, hist.count > 1 else { return 0 }
        var acc = 0.0
        for (i, v) in hist.enumerated() {
            acc += v
            if acc / total >= target { return Double(i) / Double(hist.count - 1) }
        }
        return 1
    }

    nonisolated static func clipFractions(hist: [Double]) -> (hi: Double, lo: Double) {
        let total = hist.reduce(0, +)
        guard total > 0, hist.count == 256 else { return (0, 0) }
        let hi = hist[250...].reduce(0, +) / total   // luma ≥ ~0.98
        let lo = hist[...5].reduce(0, +) / total      // luma ≤ ~0.02
        return (hi, lo)
    }

    // MARK: - Skarphet (Laplacian-energi innenfor et område)

    nonisolated static func laplacianEnergy(_ luma: CIImage, rect: CGRect, ctx: CIContext) -> Double? {
        guard rect.width > 1, rect.height > 1,
              let conv = CIFilter(name: "CIConvolution3X3") else { return nil }
        conv.setValue(luma, forKey: kCIInputImageKey)
        conv.setValue(CIVector(values: [0, 1, 0, 1, -4, 1, 0, 1, 0], count: 9), forKey: "inputWeights")
        conv.setValue(0.0, forKey: "inputBias")
        guard let edges = conv.outputImage,
              let mult = CIFilter(name: "CIMultiplyCompositing") else { return nil }
        mult.setValue(edges, forKey: kCIInputImageKey)
        mult.setValue(edges, forKey: kCIInputBackgroundImageKey)
        guard let energy = mult.outputImage else { return nil }
        return areaAverageR(energy, rect: rect, ctx: ctx)
    }

    /// Skarphet innenfor motivet: energi ∩ maske, normalisert på motivets areal.
    /// nil når ingen personmaske finnes.
    nonisolated static func subjectSharpness(luma: CIImage, mask: CIImage?, extent: CGRect, ctx: CIContext) -> Double? {
        guard let mask else { return nil }
        guard let conv = CIFilter(name: "CIConvolution3X3") else { return nil }
        conv.setValue(luma, forKey: kCIInputImageKey)
        conv.setValue(CIVector(values: [0, 1, 0, 1, -4, 1, 0, 1, 0], count: 9), forKey: "inputWeights")
        conv.setValue(0.0, forKey: "inputBias")
        guard let edges = conv.outputImage,
              let sq = CIFilter(name: "CIMultiplyCompositing") else { return nil }
        sq.setValue(edges, forKey: kCIInputImageKey)
        sq.setValue(edges, forKey: kCIInputBackgroundImageKey)
        guard let energy = sq.outputImage else { return nil }
        let masked = energy.applyingFilter("CIMultiplyCompositing", parameters: [kCIInputBackgroundImageKey: mask])
        let energyInSubject = areaAverageR(masked, rect: extent, ctx: ctx) ?? 0
        let subjectArea = areaAverageR(mask, rect: extent, ctx: ctx) ?? 0
        guard subjectArea > 0.001 else { return nil }
        return energyInSubject / subjectArea
    }

    /// Motiv-klipping: andel av MOTIV-pikslene som er utbrent (luma ≥ 0.98).
    nonisolated static func subjectClip(hiMaskSource luma: CIImage, subject: CIImage, extent: CGRect, ctx: CIContext) -> Double? {
        guard let hiMask = clipMask(luma: luma, highlight: true) else { return nil }
        let both = hiMask.applyingFilter("CIMultiplyCompositing", parameters: [kCIInputBackgroundImageKey: subject])
        let clipInSubject = areaAverageR(both, rect: extent, ctx: ctx) ?? 0
        let subjectArea = areaAverageR(subject, rect: extent, ctx: ctx) ?? 0
        guard subjectArea > 0.001 else { return nil }
        return min(1, clipInSubject / subjectArea)
    }

    /// Binær klipp-maske fra luma (hvit der klippet), samme forsterknings-triks
    /// som HUD-analysens `makeClippingMask`, men på ett-kanals luma.
    nonisolated static func clipMask(luma: CIImage, highlight: Bool) -> CIImage? {
        guard let clamp = CIFilter(name: "CIColorClamp") else { return nil }
        clamp.setValue(luma, forKey: kCIInputImageKey)
        if highlight {
            clamp.setValue(CIVector(x: 0.98, y: 0.98, z: 0.98, w: 0), forKey: "inputMinComponents")
            clamp.setValue(CIVector(x: 1, y: 1, z: 1, w: 1), forKey: "inputMaxComponents")
        } else {
            clamp.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputMinComponents")
            clamp.setValue(CIVector(x: 0.02, y: 0.02, z: 0.02, w: 1), forKey: "inputMaxComponents")
        }
        guard let clamped = clamp.outputImage,
              let matrix = CIFilter(name: "CIColorMatrix") else { return nil }
        matrix.setValue(clamped, forKey: kCIInputImageKey)
        if highlight {
            matrix.setValue(CIVector(x: 50, y: 0, z: 0, w: 0), forKey: "inputRVector")
            matrix.setValue(CIVector(x: 0, y: 50, z: 0, w: 0), forKey: "inputGVector")
            matrix.setValue(CIVector(x: 0, y: 0, z: 50, w: 0), forKey: "inputBVector")
            matrix.setValue(CIVector(x: -49, y: -49, z: -49, w: 0), forKey: "inputBiasVector")
        } else {
            matrix.setValue(CIVector(x: -50, y: 0, z: 0, w: 0), forKey: "inputRVector")
            matrix.setValue(CIVector(x: 0, y: -50, z: 0, w: 0), forKey: "inputGVector")
            matrix.setValue(CIVector(x: 0, y: 0, z: -50, w: 0), forKey: "inputBVector")
            matrix.setValue(CIVector(x: 1, y: 1, z: 1, w: 0), forKey: "inputBiasVector")
        }
        return matrix.outputImage
    }

    nonisolated static func areaAverageR(_ image: CIImage, rect: CGRect, ctx: CIContext) -> Double? {
        guard rect.width > 0, rect.height > 0,
              let avg = CIFilter(name: "CIAreaAverage") else { return nil }
        avg.setValue(image, forKey: kCIInputImageKey)
        avg.setValue(CIVector(cgRect: rect), forKey: "inputExtent")
        guard let out = avg.outputImage else { return nil }
        var buf = [Float](repeating: 0, count: 4)
        ctx.render(out, toBitmap: &buf, rowBytes: 4 * MemoryLayout<Float>.size,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBAf, colorSpace: nil)
        return Double(buf[0])
    }

    // MARK: - Ansikter (ett landmark-pass + capture-quality)

    nonisolated static func detectFaces(cg: CGImage, image: CIImage, luma: CIImage,
                                        extent: CGRect, ctx: CIContext, globalSharpness: Double) -> [FaceAnalysis] {
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        let landmarks = VNDetectFaceLandmarksRequest()
        guard (try? handler.perform([landmarks])) != nil else { return [] }
        let obs = (landmarks.results ?? []).filter { $0.confidence >= 0.4 }
        guard !obs.isEmpty else { return [] }

        // Capture-quality på SAMME observasjoner (bevart rekkefølge) → par per indeks.
        let quality = VNDetectFaceCaptureQualityRequest()
        quality.inputFaceObservations = obs
        try? handler.perform([quality])
        let qObs = quality.results ?? []

        let imgArea = Double(extent.width * extent.height)
        return obs.enumerated().map { idx, face in
            let bb = face.boundingBox    // normalisert, origo nede-venstre
            let facePx = CGRect(x: bb.origin.x * extent.width, y: bb.origin.y * extent.height,
                                width: bb.width * extent.width, height: bb.height * extent.height)
            // Inset 15 % → kinn/panne, ikke hår/kjeve.
            let inset = facePx.insetBy(dx: facePx.width * 0.15, dy: facePx.height * 0.15)
            let luminance = (inset.width > 1 && inset.height > 1)
                ? (areaAverageLuma(image, rect: inset, ctx: ctx) ?? 0) : 0
            let castRGB = (inset.width > 1 && inset.height > 1) ? sampleRGB(image, rect: inset, ctx: ctx) : nil
            let cast = castRGB.map { classifyCast(r: $0.0, g: $0.1, b: $0.2) }
            let faceSharp = laplacianEnergy(luma, rect: facePx.intersection(extent), ctx: ctx)
            let cq = idx < qObs.count ? qObs[idx].faceCaptureQuality.map(Double.init) : nil
            let eyes = eyesOpen(face)
            let sizeFrac = imgArea > 0 ? Double(facePx.width * facePx.height) / imgArea : 0
            _ = globalSharpness
            return FaceAnalysis(rect: bb, sizeFraction: sizeFrac, luma: luminance,
                                eyesOpen: eyes, captureQuality: cq, sharpness: faceSharp, skinCast: cast)
        }
    }

    /// Øyne åpne/lukket via øye-landmarkenes aspektforhold (høyde/bredde). Åpent
    /// øye er «høyt» (~0.25+), lukket flatt (~<0.15). Snitt av begge øyne; nil
    /// når landmarks mangler.
    nonisolated static func eyesOpen(_ face: VNFaceObservation) -> Bool? {
        guard let l = face.landmarks?.leftEye?.normalizedPoints,
              let r = face.landmarks?.rightEye?.normalizedPoints,
              !l.isEmpty, !r.isEmpty else { return nil }
        func ratio(_ pts: [CGPoint]) -> Double {
            let xs = pts.map { $0.x }, ys = pts.map { $0.y }
            let w = Double((xs.max() ?? 0) - (xs.min() ?? 0))
            let h = Double((ys.max() ?? 0) - (ys.min() ?? 0))
            return w > 0 ? h / w : 0
        }
        let avg = (ratio(l) + ratio(r)) / 2
        return avg >= 0.18
    }

    nonisolated static func areaAverageLuma(_ image: CIImage, rect: CGRect, ctx: CIContext) -> Double? {
        guard let (r, g, b) = sampleRGB(image, rect: rect, ctx: ctx) else { return nil }
        return 0.299 * r + 0.587 * g + 0.114 * b
    }

    nonisolated static func sampleRGB(_ image: CIImage, rect: CGRect, ctx: CIContext) -> (Double, Double, Double)? {
        guard rect.width > 0, rect.height > 0,
              let avg = CIFilter(name: "CIAreaAverage") else { return nil }
        avg.setValue(image, forKey: kCIInputImageKey)
        avg.setValue(CIVector(cgRect: rect), forKey: "inputExtent")
        guard let out = avg.outputImage else { return nil }
        var buf = [Float](repeating: 0, count: 4)
        ctx.render(out, toBitmap: &buf, rowBytes: 4 * MemoryLayout<Float>.size,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBAf,
                   colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        return (Double(buf[0]), Double(buf[1]), Double(buf[2]))
    }

    /// Grov cast-klassifisering i sRGB-forhold — samme regel som HUD-analysen.
    nonisolated static func classifyCast(r: Double, g: Double, b: Double) -> ImageAnalysis.SkinReading.Cast {
        guard r > 0.1, g > 0.1, b > 0.1 else { return .neutral }
        let rb = r / max(b, 0.001)
        let rg = r / max(g, 0.001)
        if rb > 1.6 { return .tooWarm }
        if rb < 1.1 { return .tooCool }
        if rg < 0.95 { return .tooGreen }
        if rg > 1.25 { return .tooMagenta }
        return .neutral
    }
}
