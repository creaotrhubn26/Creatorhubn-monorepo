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

    /// Perceptuell dHash (``PerceptualHash``) for nesten-duplikat-deteksjon i
    /// filmstripen — måles i SAMME pass som alt annet. 0 = ikke beregnet.
    /// Sammenlignes på tvers av bilder (Hamming) i ``LiveCaptureModel``, ikke her.
    var perceptualHash: UInt64 = 0

    static let currentVersion = 2

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
                s.leftEyeSharpness = fo(face.leftEyeSharpness)
                s.rightEyeSharpness = fo(face.rightEyeSharpness)
                return s
            },
            sceneFeature: sceneFeature.map { $0.isFinite ? $0 : 0 },
            perceptualHash: perceptualHash)
    }

    /// Praktiske avledninger for HUD/QC (rene, testbare — ingen Vision).
    var hasFaces: Bool { !faces.isEmpty }
    /// Største ansikt (etter areal) — «hovedpersonen» i de fleste portretter.
    var primaryFace: FaceAnalysis? { faces.max { $0.sizeFraction < $1.sizeFraction } }

    /// Referansen for gruppefokus. Global skarphet alene kan bli kunstig lav av
    /// pen bokeh; medianen av de målte ansiktene gjør at ett mykt familiemedlem
    /// fortsatt oppdages når de andre fire er skarpe. Median (ikke maksimum)
    /// begrenser falske treff fra ett svært teksturrikt/nært ansikt.
    var faceFocusReferenceSharpness: Double {
        let measured = faces.compactMap(\.sharpness).filter(\.isFinite).sorted()
        guard !measured.isEmpty else { return globalSharpness }
        let middle = measured.count / 2
        let median = measured.count.isMultiple(of: 2)
            ? (measured[middle - 1] + measured[middle]) / 2
            : measured[middle]
        return max(globalSharpness, median)
    }

    /// Alle ansiktene i stabil visuell rekkefølge (venstre → høyre), med
    /// eksplisitt fokusstatus. UI-et bruker selve rammen til å vise *hvem* som
    /// er skarp; dette er ikke en identitetsgjenkjenning.
    var faceFocusAssessments: [FaceFocusAssessment] {
        let reference = faceFocusReferenceSharpness
        return faces
            .enumerated()
            .sorted { lhs, rhs in
                if lhs.element.rect.midX == rhs.element.rect.midX {
                    return lhs.element.rect.midY > rhs.element.rect.midY
                }
                return lhs.element.rect.midX < rhs.element.rect.midX
            }
            .enumerated()
            .map { displayOffset, item in
                FaceFocusAssessment(
                    sourceIndex: item.offset,
                    personNumber: displayOffset + 1,
                    rect: item.element.rect,
                    state: item.element.focusState(globalSharpness: reference),
                    sharpness: item.element.sharpness
                )
            }
    }

    /// Eye-level focus can fail even when hair, nose or clothing makes the
    /// larger face/person region look sharp. Each eye is therefore evaluated
    /// inside its own Vision landmark region. Results remain tied to the same
    /// anonymous left-to-right person number used by the face focus UI.
    var eyeFocusAssessments: [EyeFocusAssessment] {
        faceFocusAssessments.flatMap { faceAssessment -> [EyeFocusAssessment] in
            guard faces.indices.contains(faceAssessment.sourceIndex) else { return [] }
            let face = faces[faceAssessment.sourceIndex]
            return [
                EyeFocusAssessment(
                    sourceIndex: faceAssessment.sourceIndex,
                    personNumber: faceAssessment.personNumber,
                    eye: .left,
                    rect: face.leftEyeRect,
                    state: face.eyeFocusState(
                        sharpness: face.leftEyeSharpness,
                        peerSharpness: face.rightEyeSharpness
                    ),
                    sharpness: face.leftEyeSharpness
                ),
                EyeFocusAssessment(
                    sourceIndex: faceAssessment.sourceIndex,
                    personNumber: faceAssessment.personNumber,
                    eye: .right,
                    rect: face.rightEyeRect,
                    state: face.eyeFocusState(
                        sharpness: face.rightEyeSharpness,
                        peerSharpness: face.leftEyeSharpness
                    ),
                    sharpness: face.rightEyeSharpness
                ),
            ].filter { $0.rect != nil && $0.state != .unmeasured }
        }
    }

    /// Conservative delivery warning: if two eyes are measurable, one sharp
    /// eye is sufficient. This avoids rejecting intentional shallow-depth
    /// portraits merely because the farther eye is softer. With only one
    /// measurable eye (profile/occlusion), that eye must be sharp.
    var criticalSoftEyeFocusAssessments: [EyeFocusAssessment] {
        Dictionary(grouping: eyeFocusAssessments, by: \.sourceIndex)
            .values
            .flatMap { eyes -> [EyeFocusAssessment] in
                let measured = eyes.filter { $0.state != .unmeasured }
                guard !measured.isEmpty,
                      measured.allSatisfy({ $0.state == .soft }) else { return [] }
                return measured
            }
    }

    /// On-set-flagg for filmstripen — det fotografen kan reagere på mens bildet kan
    /// tas om. nil = ok. Ren, testbar. Lukkede øyne prioriteres (sterkest signal).
    enum OnSetFlag: String, Hashable {
        case eyesClosed, blurry, lowFaceQuality
        var label: String {
            switch self {
            case .eyesClosed:     return "Lukkede øyne"
            case .blurry:         return "Uskarp"
            case .lowFaceQuality: return "Svakt"
            }
        }
        var icon: String {
            switch self {
            case .eyesClosed:     return "eye.slash"
            case .blurry:         return "camera.metering.spot"
            case .lowFaceQuality: return "person.fill.questionmark"
            }
        }
    }
    var onSetFlag: OnSetFlag? {
        if !faces.isEmpty {
            // En familie leveres som en gruppe: et mindre ansikt er ikke mindre
            // viktig enn det største. Prioriter sterkeste signal på tvers av ALLE.
            if faces.contains(where: { $0.eyesOpen == false }) { return .eyesClosed }
            if !criticalSoftEyeFocusAssessments.isEmpty { return .blurry }
            if faceFocusAssessments.contains(where: { $0.state == .soft }) { return .blurry }
            if faces.contains(where: { ($0.captureQuality ?? 1) < 0.35 }) { return .lowFaceQuality }
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
    var leftEyeRect: CGRect? = nil      // normalisert bildekoordinat, Vision-origo
    var rightEyeRect: CGRect? = nil
    var leftEyeSharpness: Double? = nil // Laplacian-energi i øyelandmark-regionen
    var rightEyeSharpness: Double? = nil

    /// Er ansiktet mykt/ute av fokus relativt bildets globale skarphet? Rent
    /// avledet, brukes av HUD-varselet. `globalSharpness` = referanse.
    func isSoft(globalSharpness: Double) -> Bool {
        guard let s = sharpness else { return false }
        // Ansiktet er «soft» når dets Laplacian-energi er markant under bildets —
        // et skarpt ansikt på uskarp bakgrunn har HØYERE energi enn snittet, så
        // dette fanger nettopp bommet fokus, ikke vakker bokeh.
        return s < max(globalSharpness * 0.6, 0.0006)
    }

    func focusState(globalSharpness: Double) -> FaceFocusState {
        guard sharpness != nil else { return .unmeasured }
        return isSoft(globalSharpness: globalSharpness) ? .soft : .sharp
    }

    /// Conservative eye-focus gate. A single eye is marked soft when it is
    /// substantially below both the detailed face region and its peer. Both
    /// eyes may be marked when a sharp face outline/hair hides missed eye AF.
    func eyeFocusState(sharpness eyeSharpness: Double?, peerSharpness: Double?) -> FaceFocusState {
        guard let eyeSharpness, eyeSharpness.isFinite else { return .unmeasured }
        let faceReference = max(sharpness ?? 0, 0.0008)
        let peerReference = max(peerSharpness ?? eyeSharpness, eyeSharpness)
        let threshold = max(0.00045, max(faceReference * 0.42, peerReference * 0.5))
        return eyeSharpness < threshold ? .soft : .sharp
    }
}

enum FaceFocusState: String, Sendable, Equatable, Hashable, Codable {
    case sharp, soft, unmeasured

    var label: String {
        switch self {
        case .sharp: return "Skarp"
        case .soft: return "Ute av fokus"
        case .unmeasured: return "Ikke målt"
        }
    }
}

struct FaceFocusAssessment: Sendable, Equatable, Hashable, Identifiable {
    let sourceIndex: Int
    let personNumber: Int
    let rect: CGRect
    let state: FaceFocusState
    let sharpness: Double?

    var id: Int { sourceIndex }
}

enum EyeSide: String, Sendable, Equatable, Hashable, Codable {
    case left, right
}

struct EyeFocusAssessment: Sendable, Equatable, Hashable, Identifiable {
    let sourceIndex: Int
    let personNumber: Int
    let eye: EyeSide
    let rect: CGRect?
    let state: FaceFocusState
    let sharpness: Double?

    var id: String { "\(sourceIndex)-\(eye.rawValue)" }
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
        let phash = PerceptualHash.dHash(cg)   // samme nedskalering, null ekstra dekode

        return AssetAnalysis(
            version: AssetAnalysis.currentVersion,
            medianLuma: median, p5Luma: p5, p95Luma: p95,
            highlightClip: hiClip, shadowClip: loClip,
            subjectHighlightClip: subjectHiClip,
            globalSharpness: globalSharp, subjectSharpness: subjectSharp,
            skinCast: primaryCast,
            faces: faces,
            sceneFeature: sceneFeature,
            perceptualHash: phash).sanitized()   // aldri non-finite → trygg persistering
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

    /// Motiv-klipping / høylysrisiko i motivet. Display-P3-konvertering, JPEG og
    /// en bevisst highlight-rolloff kan flytte en sensor-klippet hvit flate litt
    /// under 0.98 uten å bringe teksturen tilbake. Bruk derfor en gradert guard
    /// fra 0.96…1.00 for motivet, mens global `highlightClip` fortsatt bruker
    /// den strengere 0.98-grensen. Det gjør hvite kjoler tryggere uten å flagge
    /// hele bildet bare fordi himmelen eller en lampe er lys.
    nonisolated static func subjectClip(hiMaskSource luma: CIImage, subject: CIImage, extent: CGRect, ctx: CIContext) -> Double? {
        let width = max(1, Int(extent.width.rounded()))
        let height = max(1, Int(extent.height.rounded()))
        let count = width * height
        var lumaBytes = [UInt8](repeating: 0, count: count * 4)
        var subjectBytes = [UInt8](repeating: 0, count: count)

        // Core Image filters work in a linear working space. Comparing their
        // float values directly with a display-referred 0.96 threshold made the
        // old check miss obvious white plateaus after P3/JPEG conversion. One
        // explicit sRGB render makes 245…255 mean the same thing the user sees.
        ctx.render(
            luma.cropped(to: extent),
            toBitmap: &lumaBytes,
            rowBytes: width * 4,
            bounds: extent,
            format: .RGBA8,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)
        )
        ctx.render(
            subject.cropped(to: extent),
            toBitmap: &subjectBytes,
            rowBytes: width,
            bounds: extent,
            format: .L8,
            colorSpace: nil
        )

        var subjectWeight = 0.0
        var highlightWeight = 0.0
        for index in 0..<count {
            let mask = Double(subjectBytes[index]) / 255
            guard mask > 0 else { continue }
            subjectWeight += mask
            let value = Double(lumaBytes[index * 4])
            // Graded safety shoulder: 245 contributes 0, 255 contributes 1.
            // This avoids a brittle one-code-value boundary after JPEG encode.
            let risk = max(0, min(1, (value - 245) / 10))
            highlightWeight += mask * risk
        }
        guard subjectWeight > Double(count) * 0.001 else { return nil }
        return min(1, highlightWeight / subjectWeight)
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
        try? handler.perform([landmarks])
        var obs = (landmarks.results ?? []).filter { $0.confidence >= 0.4 }
        if obs.isEmpty {
            // Fallback: landmark-deteksjon kan komme tomt tilbake der ren rektangel-
            // deteksjon lykkes (bl.a. i simulator-runtimen, og enkelte kilder på
            // enhet). Grupperingen (E8) trenger bare ansikts-rektene; eyesOpen blir
            // nil uten landmarks, så on-set «lukkede øyne»-flagget bare uteblir.
            let rects = VNDetectFaceRectanglesRequest()
            try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([rects])
            obs = (rects.results ?? []).filter { $0.confidence >= 0.4 }
        }
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
            let leftEye = eyeMeasurement(
                face.landmarks?.leftEye,
                faceRect: facePx,
                imageExtent: extent,
                luma: luma,
                ctx: ctx
            )
            let rightEye = eyeMeasurement(
                face.landmarks?.rightEye,
                faceRect: facePx,
                imageExtent: extent,
                luma: luma,
                ctx: ctx
            )
            let cq = idx < qObs.count ? qObs[idx].faceCaptureQuality.map(Double.init) : nil
            let eyes = eyesOpen(face)
            let sizeFrac = imgArea > 0 ? Double(facePx.width * facePx.height) / imgArea : 0
            _ = globalSharpness
            return FaceAnalysis(rect: bb, sizeFraction: sizeFrac, luma: luminance,
                                eyesOpen: eyes, captureQuality: cq, sharpness: faceSharp, skinCast: cast,
                                leftEyeRect: leftEye?.rect, rightEyeRect: rightEye?.rect,
                                leftEyeSharpness: leftEye?.sharpness,
                                rightEyeSharpness: rightEye?.sharpness)
        }
    }

    /// Converts a Vision face-relative eye landmark into a padded normalized
    /// image region and measures only that eye's high-frequency detail. Very
    /// small landmarks are left unmeasured instead of manufacturing confidence.
    nonisolated static func eyeMeasurement(
        _ landmark: VNFaceLandmarkRegion2D?,
        faceRect: CGRect,
        imageExtent: CGRect,
        luma: CIImage,
        ctx: CIContext
    ) -> (rect: CGRect, sharpness: Double)? {
        guard let points = landmark?.normalizedPoints, !points.isEmpty else { return nil }
        let xs = points.map(\.x)
        let ys = points.map(\.y)
        guard let minX = xs.min(), let maxX = xs.max(),
              let minY = ys.min(), let maxY = ys.max() else { return nil }

        var eye = CGRect(
            x: faceRect.minX + minX * faceRect.width,
            y: faceRect.minY + minY * faceRect.height,
            width: max(1, (maxX - minX) * faceRect.width),
            height: max(1, (maxY - minY) * faceRect.height)
        )
        eye = eye.insetBy(dx: -eye.width * 0.30, dy: -eye.height * 0.75)
            .intersection(imageExtent)
        guard eye.width >= 5, eye.height >= 4,
              let sharpness = laplacianEnergy(luma, rect: eye, ctx: ctx),
              sharpness.isFinite else { return nil }

        let normalized = CGRect(
            x: (eye.minX - imageExtent.minX) / imageExtent.width,
            y: (eye.minY - imageExtent.minY) / imageExtent.height,
            width: eye.width / imageExtent.width,
            height: eye.height / imageExtent.height
        )
        return (normalized, sharpness)
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
