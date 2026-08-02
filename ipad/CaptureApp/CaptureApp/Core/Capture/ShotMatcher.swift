// ShotMatcher.swift
//
// Shot-list auto-checkoff: matcher et tatt bilde mot gjenstående planlagte
// shots så du ikke drar hjem uten et must-have-bilde.
//
// Motoren er REN + testbar (heuristikk over ansiktstelling + bildeformat +
// shot-type + prioritet). Signal-uttrekket bruker Vision. Konservativ terskel
// → auto-huk kun ved klar match; ellers `nil` (fotografen huker manuelt).
//
// Wiring (on-device-integrasjon, gjenstår): på nytt asset i LiveCaptureModel
// sin assets-stream → CaptureSignalExtractor.signals(from:) på previewKey →
// ShotMatcher.bestMatch(...) → ShotListStore.toggleCompletion(shotId:in:
// capturedAssetId:). «Mangler fortsatt»-påminnelse via missingMustHaves.

import Foundation
import Vision
import CoreGraphics

struct CaptureSignals: Sendable, Equatable {
    var faceCount: Int
    var aspectRatio: Double   // bredde / høyde
}

enum CaptureSignalExtractor {
    static func signals(from cgImage: CGImage) -> CaptureSignals {
        let aspect = Double(cgImage.width) / Double(max(1, cgImage.height))
        let request = VNDetectFaceRectanglesRequest()
        try? VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
        let faces = (request.results ?? []).filter { $0.confidence >= 0.5 }.count
        return CaptureSignals(faceCount: faces, aspectRatio: aspect)
    }
}

enum ShotMatcher {
    /// Hvor godt signalene passer en shot-type (0…1).
    static func typeScore(signals: CaptureSignals, shotType: String?) -> Double {
        let t = (shotType ?? "").lowercased()
        let wide = signals.aspectRatio >= 1.4
        if t.contains("wide") {
            return (wide ? 0.6 : 0.35) + (signals.faceCount >= 2 ? 0.4 : 0.1)
        }
        if t.contains("detail") || t.contains("tight") || t.contains("close") {
            return signals.faceCount <= 1 ? 0.8 : 0.3
        }
        if t.contains("candid") {
            return signals.faceCount >= 1 ? 0.7 : 0.45
        }
        return 0.5   // ukjent type → nøytral
    }

    static func priorityBoost(_ priority: String?) -> Double {
        switch (priority ?? "").lowercased() {
        case "must": return 0.15
        case "high": return 0.08
        default: return 0
        }
    }

    /// Beste ufullførte shot å auto-huke — over terskel, ellers nil (konservativt).
    static func bestMatch(
        signals: CaptureSignals, shots: [ShotListItem], threshold: Double = 0.75
    ) -> ShotListItem? {
        bestMatchScored(signals: signals, shots: shots, suggestThreshold: threshold)?.shot
    }

    /// Hvor sikker matchen er — driver om auto-huking flagges «usikker».
    enum MatchConfidence: Sendable, Equatable { case confident, uncertain }

    /// Beste match MED score + konfidens-bånd. `confident` (>= autoThreshold) =
    /// stille auto-huk; `uncertain` (>= suggestThreshold) = auto-huk MEN flagget
    /// så fotografen lett kan angre; under suggestThreshold → nil (hopp over).
    static func bestMatchScored(
        signals: CaptureSignals, shots: [ShotListItem],
        autoThreshold: Double = 0.82, suggestThreshold: Double = 0.68
    ) -> (shot: ShotListItem, score: Double, confidence: MatchConfidence)? {
        let scored = shots
            .filter { !($0.isCompleted ?? false) }
            .map { (shot: $0, score: min(1.0, typeScore(signals: signals, shotType: $0.shotType) + priorityBoost($0.priority))) }
        guard let best = scored.max(by: { $0.score < $1.score }), best.score >= suggestThreshold else {
            return nil
        }
        return (best.shot, best.score, best.score >= autoThreshold ? .confident : .uncertain)
    }

    /// Ufullførte must-have-shots — for «mangler fortsatt»-påminnelsen.
    static func missingMustHaves(_ shots: [ShotListItem]) -> [ShotListItem] {
        shots.filter { !($0.isCompleted ?? false) && ($0.priority ?? "").lowercased() == "must" }
    }
}
