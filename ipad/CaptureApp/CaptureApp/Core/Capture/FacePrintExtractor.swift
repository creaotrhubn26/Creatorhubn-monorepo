import Foundation
import CoreGraphics
import ImageIO

/// Off-main-uttrekk av ansikts-feature-prints fra en bildefil (E8 person-
/// gruppering). Dekoder bildet ÉN gang og produserer en print per ansikts-rekt.
/// Selve klyngingen (`PersonClusterer`) skjer på MainActor i modellen fordi den
/// er tilstandsfull; her gjør vi kun den tunge, rene per-bilde-jobben.
enum FacePrintExtractor {

    /// (rekt, print)-par for hver av `faceRects` som ga en gyldig print. Rektene
    /// er normaliserte, origo nede-venstre (Vision-konvensjon). Tom ved feil.
    static func prints(imageURL: URL, faceRects: [CGRect]) async -> [FaceRectPrint] {
        await Task.detached(priority: .utility) {
            guard !faceRects.isEmpty,
                  let src = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
                  let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return [] }
            return faceRects.compactMap { rect in
                FacePrint.compute(cg: cg, faceRect: rect).map { FaceRectPrint(rect: rect, print: $0) }
            }
        }.value
    }
}

/// Ett ansikt: dets rekt + feature-print. Sendable (verdityper) → krysser
/// aktør-grensen fra bakgrunnsuttrekk til MainActor-klynging.
struct FaceRectPrint: Sendable {
    let rect: CGRect
    let print: [Float]
}
