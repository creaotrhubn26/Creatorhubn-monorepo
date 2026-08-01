import Foundation
import CoreImage

/// Delt ansiktsdeteksjon — kjør ÉN gang og gjenbruk rektene nedover hud-kjeden
/// (SkinToneGuard → SkinFinish → FaceDodge), i stedet for ett CIDetector-pass PER
/// filter (tre pass på samme bilde). Rektene er i bildets CI-koordinater (origo
/// nede-venstre), klemt til extent. Filtrene tar `faces:` og hopper over egen
/// deteksjon når rektene er gitt.
enum FaceContext {
    static func detect(in image: CIImage) -> [CGRect] {
        let extent = image.extent
        guard extent.width > 2, extent.height > 2 else { return [] }
        let det = CIDetector(ofType: CIDetectorTypeFace, context: nil,
                             options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        return (det?.features(in: image) ?? [])
            .compactMap { ($0 as? CIFaceFeature)?.bounds.intersection(extent) }
            .filter { $0.width > 2 && $0.height > 2 }
    }
}
