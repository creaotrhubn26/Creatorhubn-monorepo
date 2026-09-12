// VisionImageTools.swift
//
// Gratis on-device Vision-verktøy (iOS 18+):
//   - recognizeText: les tekst i et bilde (model releases, skilt, kontrakter)
//   - subjectCutout: klipp ut forgrunns-subjektet (transparent bakgrunn) for
//     rask cutout-preview på settet
//
// Rene funksjoner — ingen nettverk, ingen state.

import Foundation
import Vision
import CoreGraphics
import CoreImage

@available(iOS 18, *)
enum VisionImageTools {
    /// Gjenkjenn tekst i et bilde. Returnerer linjer i lese-rekkefølge.
    static func recognizeText(in image: CGImage) async -> [String] {
        let request = RecognizeTextRequest()
        guard let observations = try? await request.perform(on: image) else { return [] }
        return observations.compactMap { $0.topCandidates(1).first?.string }
    }

    /// Klipp ut forgrunns-subjektet (transparent bakgrunn). Nil hvis ingen
    /// tydelig subjekt ble funnet.
    static func subjectCutout(from image: CGImage) async -> CGImage? {
        let handler = ImageRequestHandler(image)
        let request = GenerateForegroundInstanceMaskRequest()
        guard let observation = try? await handler.perform(request) else { return nil }
        guard let pixelBuffer = try? observation.generateMaskedImage(
            for: observation.allInstances,
            imageFrom: handler,
            croppedToInstancesExtent: true
        ) else {
            return nil
        }
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        return CIContext().createCGImage(ciImage, from: ciImage.extent)
    }
}
