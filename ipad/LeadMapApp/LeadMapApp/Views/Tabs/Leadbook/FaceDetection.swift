// FaceDetection.swift — Vision-basert auto-detection av ansikt for focal point (2026-06-30)
//
// Bruker VNDetectFaceRectanglesRequest til å finne ansiktet i et bilde
// og returnerer center-punktet normalisert (0…1) m/ origin øverst-venstre.

import SwiftUI
import Vision

enum FaceDetector {

    /// Finn det største ansiktets senter (normalisert, origin topp-venstre).
    /// Returnerer nil hvis intet ansikt funnet.
    static func detectFaceCenter(in imageName: String,
                                 completion: @escaping @Sendable (CGPoint?) -> Void) {
        guard let ui = UIImage(named: imageName), let cg = ui.cgImage else {
            completion(nil); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNDetectFaceRectanglesRequest()
            let handler = VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:])
            try? handler.perform([request])
            // Velg det største ansiktet (mest dominant i bildet)
            let faces = (request.results) ?? []
            let largest = faces.max { lhs, rhs in
                lhs.boundingBox.size.width * lhs.boundingBox.size.height
                < rhs.boundingBox.size.width * rhs.boundingBox.size.height
            }
            // Vision-koordinater: origin nederst-venstre, y vokser oppover.
            // Konverter til normalisert SwiftUI-stil: origin øverst-venstre.
            let result: CGPoint? = largest.map { CGPoint(x: $0.boundingBox.midX,
                                                         y: 1 - $0.boundingBox.midY) }
            DispatchQueue.main.async {
                completion(result)
            }
        }
    }

    /// Konverter normalisert ansiktssenter til focal-offset for klipperammen.
    ///
    /// Bildet er typisk høyere enn klipperammen (portrait→landscape).
    /// Vi flytter bildet slik at ansiktet havner i øvre tredjedel av rammen
    /// (regelen om tredjedeler — komposisjons-best practice for portretter).
    ///
    /// - Parameter face: normalisert ansiktssenter (0…1, origin topp-venstre)
    /// - Parameter imageAspect: bredde / høyde for original-bildet (typisk 0.8 for 4:5)
    /// - Parameter cropAspect: bredde / høyde for klipperammen (16/9 = 1.78)
    static func focalOffset(faceCenter face: CGPoint,
                            imageAspect: CGFloat = 0.8,    // 4:5 portrett
                            cropAspect: CGFloat = 16.0/9.0) -> CGSize {
        // Etter scaledToFill blir bildet skalert slik at det smalere aksen passer rammen.
        // For portrait i landscape betyr det at høyden blir mye større enn rammen.
        // Effektivt høyde-multiplikator:
        let heightRatio = cropAspect / imageAspect  // hvor mye større bildet er enn rammen, vertikalt
        // Vi vil at ansiktet skal være i 35 % fra toppen (øvre tredjedel)
        let targetY: CGFloat = 0.35
        let dy = (targetY - face.y) * heightRatio
        // X-justering er mindre kritisk siden bildet ofte er smalere enn rammen
        let dx = (0.5 - face.x) * 0.5
        return CGSize(width: dx, height: dy)
    }
}

// MARK: - Cache av ansikt-deteksjoner per asset
// Detekter én gang, gjenbruk for alle SmartPortrait-instanser.

@MainActor
final class PortraitFocalCache: ObservableObject {
    static let shared = PortraitFocalCache()
    @Published private(set) var faceCenters: [String: CGPoint] = [:]
    private var inFlight: Set<String> = []

    func center(for assetName: String) -> CGPoint? {
        faceCenters[assetName]
    }

    func detectIfNeeded(_ assetName: String) {
        guard faceCenters[assetName] == nil, !inFlight.contains(assetName) else { return }
        inFlight.insert(assetName)
        FaceDetector.detectFaceCenter(in: assetName) { [weak self] center in
            Task { @MainActor in
                guard let self else { return }
                if let center { self.faceCenters[assetName] = center }
                self.inFlight.remove(assetName)
            }
        }
    }
}

// MARK: - SmartPortrait — bilde m/ auto-focal-point
// Default: rund avatar. Bruk .roundedRect(...) for andre former.

struct SmartPortrait: View {
    let assetName: String
    var cornerRadius: CGFloat = .infinity   // .infinity = Circle
    var cropAspect: CGFloat = 1.0           // 1.0 = kvadrat
    /// Hvor mye av face-detection-offset som skal brukes (0…1). 1.0 = full.
    /// Mindre tall for små avatarer hvor head crop er mindre kritisk.
    var focalStrength: CGFloat = 1.0

    @ObservedObject private var cache = PortraitFocalCache.shared

    var body: some View {
        GeometryReader { geo in
            Image(assetName)
                .resizable()
                .scaledToFill()
                .offset(focalOffset(in: geo.size))
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
        }
        .clipShape(shape)
        .task { cache.detectIfNeeded(assetName) }
    }

    private var shape: AnyShape {
        if cornerRadius == .infinity {
            AnyShape(Circle())
        } else {
            AnyShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
    }

    private func focalOffset(in size: CGSize) -> CGSize {
        guard let center = cache.center(for: assetName) else { return .zero }
        let suggested = FaceDetector.focalOffset(
            faceCenter: center,
            imageAspect: 0.8,
            cropAspect: cropAspect
        )
        return CGSize(
            width: suggested.width * size.width * focalStrength,
            height: suggested.height * size.height * focalStrength
        )
    }
}
