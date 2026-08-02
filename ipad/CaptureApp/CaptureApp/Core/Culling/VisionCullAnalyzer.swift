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
    /// #6 Distanse under denne = «samme scene/oppsett». Større enn dedupe-
    /// terskelen: dedupe fanger nesten-like frames, scene-klynging fanger et
    /// helt setup (antrekk/bakgrunn). Heuristikk — finjuster på ekte shoot.
    var sceneThreshold: Double = 0.62

    /// Analyser en hel batch (id + bilde + valgfri delt ``AssetAnalysis``) →
    /// rangert + dedupet resultat. Når `analysis` er gitt brukes øyne/ansikts-
    /// softness i rangeringen OG face-quality gjenbrukes derfra (hopper over et
    /// redundant DetectFaceCaptureQuality-kall).
    func analyze(_ items: [(id: String, image: CGImage, analysis: AssetAnalysis?)]) async -> CullingResult {
        var scores: [PhotoScore] = []
        var prints: [(String, FeaturePrintObservation)] = []

        for item in items {
            scores.append(await score(item.image, id: item.id, analysis: item.analysis))
            if let fingerprint = await featurePrint(item.image) {
                prints.append((item.id, fingerprint))
            }
        }

        let printMap = Dictionary(prints, uniquingKeysWith: { a, _ in a })
        let ids = items.map(\.id)
        let dist: (String, String) -> Double = { a, b in
            guard let pa = printMap[a], let pb = printMap[b],
                  let distance = try? pa.distance(to: pb) else {
                return .greatestFiniteMagnitude
            }
            return distance
        }
        let groups = CullingEngine.groupDuplicates(ids: ids, threshold: duplicateThreshold, distance: dist)
        // #6 Scene-klynger i opptaksrekkefølge (items antas sortert på tid).
        let scenes = CullingEngine.groupByScene(ids: ids, threshold: sceneThreshold, distance: dist)
        let base = CullingEngine.cull(scores: scores, duplicateGroups: groups)
        return CullingResult(ranked: base.ranked, keep: base.keep, duplicates: base.duplicates, scenes: scenes)
    }

    private func score(_ cg: CGImage, id: String, analysis: AssetAnalysis?) async -> PhotoScore {
        let aesthetics = await aesthetics(cg)
        // Gjenbruk face-quality fra den delte analysen (den kjørte alt et
        // capture-quality-pass) → unngå et redundant Vision-kall. Ellers her.
        let face: Float?
        if let a = analysis {
            face = a.primaryFace?.captureQuality.map(Float.init)
        } else {
            face = await bestFaceQuality(cg)
        }
        var score = PhotoScore(id: id, aesthetics: aesthetics.score,
                               isUtility: aesthetics.isUtility, faceQuality: face)
        if let a = analysis, let primary = a.primaryFace {
            score.eyesOpen = primary.eyesOpen
            score.faceSoft = primary.isSoft(globalSharpness: a.globalSharpness)
        }
        return score
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

    func cull(_ items: [(id: String, image: CGImage, analysis: AssetAnalysis?)]) async {
        isRunning = true
        defer { isRunning = false }
        result = await analyzer.analyze(items)
    }
}
