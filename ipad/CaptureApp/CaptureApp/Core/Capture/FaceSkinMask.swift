import Foundation
import CoreImage
import Vision

/// LANDMARK-DREVET HUD-MASKE — den on-device motparten til FaceXFormers landmark-/
/// parsing-metode. iOS Vision `VNDetectFaceLandmarksRequest` gir et 76-punkts
/// ansikts-konstellasjon per FUNNET ansikt (kontur, øyne, bryn, nese, lepper); vi
/// bygger et hud-POLYGON (ansikts-kontur + panne fra brynene) og TREKKER FRA øyne,
/// bryn og lepper → en kirurgisk hud-maske som IKKE inkluderer øyne/lepper.
///
/// 🔑 Løser en ekte svakhet i `SkinLineCorrectFilter`: lepper er kromatiske (rød) og
/// ville ellers rotert med hud-korreksjonen. Denne masken (spatialt) + chroma-gaten
/// (kromatisk) = dobbelt trygt. Per bilde, per ansikt, ingen hardkoding.
/// (Server-pro-tier: FaceXFormer `best_model.pt` fra R2 for landmarks + full parsing.)
enum FaceSkinMask {

    /// Hvit = ansikts-hud (alle ansikter), svart ellers, skalert til `extent`.
    /// `nil` → ingen ansikt/landmarks (kaller faller tilbake til ansikts-oval).
    static func skinMask(for image: CIImage, extent: CGRect) -> CIImage? {
        let req = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(ciImage: image, options: [:])
        do { try handler.perform([req]) } catch { return nil }
        guard let faces = req.results, !faces.isEmpty else { return nil }

        let W = Int(extent.width), H = Int(extent.height)
        guard W > 1, H > 1 else { return nil }
        let cs = CGColorSpaceCreateDeviceGray()
        guard let g = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8,
                                bytesPerRow: W, space: cs,
                                bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
        g.setFillColor(gray: 0, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: W, height: H))
        let fw = CGFloat(W), fh = CGFloat(H)

        func pts(_ r: VNFaceLandmarkRegion2D?, _ bb: CGRect) -> [CGPoint] {
            guard let r = r else { return [] }
            return r.normalizedPoints.map {
                CGPoint(x: (bb.minX + $0.x * bb.width) * fw, y: (bb.minY + $0.y * bb.height) * fh)
            }
        }

        var drew = false
        for f in faces {
            guard let lm = f.landmarks else { continue }
            let bb = f.boundingBox
            var poly = pts(lm.faceContour, bb)
            guard poly.count > 4 else { continue }
            // panne: bryn hevet opp, i revers, lukker polygonet over øynene
            let brows = (pts(lm.rightEyebrow, bb) + pts(lm.leftEyebrow, bb))
                .map { CGPoint(x: $0.x, y: $0.y + bb.height * fh * 0.12) }
            poly += brows.reversed()
            g.setFillColor(gray: 1, alpha: 1)
            g.beginPath(); g.move(to: poly[0]); poly.dropFirst().forEach { g.addLine(to: $0) }
            g.closePath(); g.fillPath()
            drew = true
            // trekk fra øyne / bryn / lepper (svarte ellipser rundt landmark-boksene)
            let ep = bb.width * fw * 0.06
            for (region, pad) in [(lm.leftEye, ep), (lm.rightEye, ep), (lm.outerLips, ep * 0.8),
                                  (lm.leftEyebrow, ep * 0.4), (lm.rightEyebrow, ep * 0.4)] {
                let p = pts(region, bb); guard !p.isEmpty else { continue }
                let xs = p.map { $0.x }, ys = p.map { $0.y }
                let rect = CGRect(x: xs.min()!, y: ys.min()!, width: xs.max()! - xs.min()!,
                                  height: ys.max()! - ys.min()!).insetBy(dx: -pad, dy: -pad)
                g.setFillColor(gray: 0, alpha: 1); g.fillEllipse(in: rect)
            }
        }
        guard drew, let cg = g.makeImage() else { return nil }
        // fjær litt for myk overgang (skala med ansiktsstørrelse)
        let sigma = Double(max(2, (faces.first!.boundingBox.width * fw) * 0.02))
        return CIImage(cgImage: cg).applyingGaussianBlur(sigma: sigma).cropped(to: extent)
    }
}
