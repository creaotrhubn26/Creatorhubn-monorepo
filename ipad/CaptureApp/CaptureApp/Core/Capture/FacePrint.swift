import Foundation
import Vision
import CoreGraphics

/// On-device ansikts-«fingeravtrykk» for å gruppere en fotografering etter HVEM
/// som er på bildet (levering per-ansikt, E8). Bruker Visions generelle
/// bilde-feature-print på ansikts-REGIONEN (regionOfInterest = ansikts-rekt) —
/// samme persons ansikts-utsnitt klumper seg tett, ulike personer spres. Ikke en
/// dedikert ansikts-embedding (iOS har ingen offentlig sånn), men robust nok til
/// grov klynging når vi allerede har rektene fra deteksjonspasset.
///
/// Vektorene er `[Float]` → Sendable, off-main, sammenlignes med kosinus-avstand.
/// Alt feiler grasiøst mot nil (aldri kast).
enum FacePrint {

    /// Feature-print for ÉN ansikts-region. `faceRect` er normalisert med origo
    /// nede-venstre (Vision-konvensjon — samme som `VNFaceObservation.boundingBox`
    /// og `FaceAnalysis.rect`). nil om print ikke kan produseres.
    static func compute(cg: CGImage, faceRect: CGRect) -> [Float]? {
        let roi = faceRect.intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
        guard roi.width > 0.01, roi.height > 0.01 else { return nil }
        let req = VNGenerateImageFeaturePrintRequest()
        req.regionOfInterest = roi
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        guard (try? handler.perform([req])) != nil,
              let obs = req.results?.first as? VNFeaturePrintObservation else { return nil }
        return vector(from: obs)
    }

    /// Pakk ut feature-printen som `[Float]`. Håndterer både float- og double-
    /// element-typer (eldre/nyere Vision). nil ved uventet layout.
    static func vector(from obs: VNFeaturePrintObservation) -> [Float]? {
        let n = obs.elementCount
        guard n > 0 else { return nil }
        switch obs.elementType {
        case .float:
            guard obs.data.count >= n * MemoryLayout<Float>.size else { return nil }
            return obs.data.withUnsafeBytes { Array($0.bindMemory(to: Float.self).prefix(n)) }
        case .double:
            guard obs.data.count >= n * MemoryLayout<Double>.size else { return nil }
            return obs.data.withUnsafeBytes {
                $0.bindMemory(to: Double.self).prefix(n).map { Float($0) }
            }
        default:
            return nil
        }
    }

    /// Kosinus-avstand (1 − cos θ) i [0, 2]. 0 = identisk retning. Robust mot
    /// skala-forskjeller i feature-magnitude (bedre enn euklidsk for embeddings).
    static func distance(_ a: [Float], _ b: [Float]) -> Float {
        let n = min(a.count, b.count)
        guard n > 0 else { return 2 }
        var dot: Float = 0, na: Float = 0, nb: Float = 0
        for i in 0..<n {
            dot += a[i] * b[i]
            na += a[i] * a[i]
            nb += b[i] * b[i]
        }
        guard na > 0, nb > 0 else { return 2 }
        let cos = dot / (na.squareRoot() * nb.squareRoot())
        return 1 - max(-1, min(1, cos))
    }
}
