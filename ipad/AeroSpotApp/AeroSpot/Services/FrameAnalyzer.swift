// FrameAnalyzer.swift — on-device analyse av live view-frames fra Canon.
// Apple Vision + Core Image, ingen nett, ingen ekstra dependency.
//
// Gir strukturerte, deterministiske signaler (horisont-tilt, motiv-
// plassering mot tredjedelene, klipping i høylys). Disse mates videre til
// TipEngine (lag 3) som formulerer ett naturlig tips.

import Foundation
import Vision
import CoreImage
import UIKit

struct FrameSignals: Sendable, Equatable {
    /// Horisont-tilt i grader (+ = roter med klokka for å rette opp). nil = ikke funnet.
    var horizonTiltDeg: Double?
    /// Motivets senter, normalisert 0–1 (x fra venstre, y fra topp). nil = intet motiv.
    var subjectCenter: CGPoint?
    /// Andel piksler som er utbrent (0–1).
    var highlightClippingRatio: Double
    /// Gjennomsnittlig luminans 0–1 (eksponerings-proxy).
    var averageLuminance: Double
}

actor FrameAnalyzer {
    private let ciContext = CIContext(options: [.workingColorSpace: NSNull()])

    func analyze(jpeg: Data) async -> FrameSignals? {
        guard let ciImage = CIImage(data: jpeg) else { return nil }

        async let horizon = detectHorizon(jpeg: jpeg)
        async let subject = detectSubject(jpeg: jpeg)
        let (clip, luma) = exposureStats(ciImage)

        return FrameSignals(
            horizonTiltDeg: await horizon,
            subjectCenter: await subject,
            highlightClippingRatio: clip,
            averageLuminance: luma
        )
    }

    private func detectHorizon(jpeg: Data) async -> Double? {
        let request = VNDetectHorizonRequest()
        let handler = VNImageRequestHandler(data: jpeg, options: [:])
        do {
            try handler.perform([request])
            guard let obs = request.results?.first else { return nil }
            return Double(obs.angle) * 180 / .pi
        } catch {
            return nil
        }
    }

    private func detectSubject(jpeg: Data) async -> CGPoint? {
        // Saliency: hvor i bildet er det mest "interessant" (flyet).
        let request = VNGenerateAttentionBasedSaliencyImageRequest()
        let handler = VNImageRequestHandler(data: jpeg, options: [:])
        do {
            try handler.perform([request])
            guard let obs = request.results?.first as? VNSaliencyImageObservation,
                  let salient = obs.salientObjects?.max(by: { $0.confidence < $1.confidence })
            else { return nil }
            let box = salient.boundingBox // normalisert, origo nederst-venstre
            // Konverter til origo øverst-venstre
            return CGPoint(x: box.midX, y: 1 - box.midY)
        } catch {
            return nil
        }
    }

    /// Utbrent-andel + snitt-luminans via histogram-nedskalering.
    private func exposureStats(_ image: CIImage) -> (clip: Double, luma: Double) {
        let extent = image.extent
        guard !extent.isInfinite, !extent.isEmpty else { return (0, 0.5) }
        // Snitt-farge → luminans
        guard let avgFilter = CIFilter(name: "CIAreaAverage", parameters: [
            kCIInputImageKey: image,
            kCIInputExtentKey: CIVector(cgRect: extent),
        ]), let avgOutput = avgFilter.outputImage else { return (0, 0.5) }
        var bitmap = [UInt8](repeating: 0, count: 4)
        ciContext.render(
            avgOutput,
            toBitmap: &bitmap,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )
        let r = Double(bitmap[0]) / 255, g = Double(bitmap[1]) / 255, b = Double(bitmap[2]) / 255
        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

        // Grov klipping-proxy: hvor lys snittet er (himmelfoto med utbrent
        // himmel gir høyt snitt). ponytail: ekte per-piksel-histogram hvis
        // dette viser seg for grovt i felt.
        let clip = luma > 0.85 ? (luma - 0.85) / 0.15 : 0
        return (clip, luma)
    }
}
