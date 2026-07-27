// VisionCullAnalyzer.swift
//
// iOS 18+ on-device Vision-analyse for smart culling (gratis):
//   - CalculateImageAestheticsScoresRequest → estetikk + «utility»-flagg
//   - DetectFaceCaptureQualityRequest → beste ansikts-fangst (åpne øyne/skarpt)
//   - GenerateImageFeaturePrintRequest → perseptuelt fingeravtrykk → dedupe
//
// Rank/dedupe-logikken er i CullingModels.swift (ren + testbar). Her holder vi
// de ikke-Sendable Vision-observasjonene isolert i én nonisolated kontekst og
// returnerer kun Sendable CullingResult.

import Foundation
import Vision
import CoreGraphics

@available(iOS 18, *)
struct VisionCullAnalyzer: Sendable {
    /// Feature-print-distanse under denne = «nesten identisk». Heuristikk.
    var duplicateThreshold: Double = 0.3

    /// Analyser en hel batch (id + bilde) → rangert + dedupet resultat.
    func analyze(_ items: [(id: String, image: CGImage)]) async -> CullingResult {
        var scores: [PhotoScore] = []
        var prints: [(String, FeaturePrintObservation)] = []

        for item in items {
            scores.append(await score(item.image, id: item.id))
            if let fingerprint = await featurePrint(item.image) {
                prints.append((item.id, fingerprint))
            }
        }

        let printMap = Dictionary(prints, uniquingKeysWith: { a, _ in a })
        let ids = items.map(\.id)
        let groups = CullingEngine.groupDuplicates(ids: ids, threshold: duplicateThreshold) { a, b in
            guard let pa = printMap[a], let pb = printMap[b],
                  let distance = try? pa.distance(to: pb) else {
                return .greatestFiniteMagnitude
            }
            return distance
        }
        return CullingEngine.cull(scores: scores, duplicateGroups: groups)
    }

    private func score(_ cg: CGImage, id: String) async -> PhotoScore {
        let aesthetics = await aesthetics(cg)
        let face = await bestFaceQuality(cg)
        return PhotoScore(id: id, aesthetics: aesthetics.score, isUtility: aesthetics.isUtility, faceQuality: face)
    }

    private func aesthetics(_ cg: CGImage) async -> (score: Float, isUtility: Bool) {
        let request = CalculateImageAestheticsScoresRequest()
        guard let observation = try? await request.perform(on: cg) else { return (0.5, false) }
        // overallScore er ~ -1…1 → normaliser til 0…1.
        let normalized = max(0, min(1, (observation.overallScore + 1) / 2))
        return (normalized, observation.isUtility)
    }

    private func bestFaceQuality(_ cg: CGImage) async -> Float? {
        let request = DetectFaceCaptureQualityRequest()
        guard let faces = try? await request.perform(on: cg), !faces.isEmpty else { return nil }
        return faces.compactMap { $0.captureQuality?.score }.max()
    }

    private func featurePrint(_ cg: CGImage) async -> FeaturePrintObservation? {
        let request = GenerateImageFeaturePrintRequest()
        return try? await request.perform(on: cg)
    }
}

/// Observerbar tjeneste for review-skjermen: kjør culling på en batch bilder.
@available(iOS 18, *)
@MainActor
@Observable
final class CullingService {
    private(set) var result: CullingResult?
    private(set) var isRunning = false
    var analyzer = VisionCullAnalyzer()

    func cull(_ items: [(id: String, image: CGImage)]) async {
        isRunning = true
        defer { isRunning = false }
        result = await analyzer.analyze(items)
    }
}
