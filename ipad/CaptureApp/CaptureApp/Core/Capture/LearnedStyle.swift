import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics

/// On-device anvendelse av en ARKIV-LÆRT stil-profil (destillert fra Post Agent-
/// motoren `arkiv_laert_redigering.py` via `eksporter` → JSON). Prinsippet
/// (Imagen lokalt): fotografens EGNE RAW→ferdig-par lærte per-kanal-tonekurver
/// (CDF-matching) + LAB a/b-skift, klynget til scene-sentroider. Her matcher vi
/// et nytt bilde mot sine k nærmeste scener (farge-vektet kNN) og påfører det
/// vektede snittet av deres LUT + a/b-skift.
///
/// v1 dekker kjernen: features (identisk med Python) + farge-vektet kNN +
/// per-kanal-LUT (CIColorCurves) + a/b-skift (approksimert i RGB). Reinhard-std,
/// ansikts-dodge og film-finish gjenbrukes fra de eksisterende filtrene / er
/// dokumentert oppfølging.
struct LearnedStyleProfile: Codable, Sendable {
    struct Scene: Codable, Sendable {
        let feat: [Double]        // 12-dim scene-feature
        let lut: [[Int]]          // [B,G,R][256] (cv2-kanalrekkefølge)
        let ab: [Double]          // [Δa, Δb] LAB-middel-skift
        let labStd: [Double]      // [L,a,b] Reinhard-spredning (v1: ubrukt)
        let weight: Int
    }
    let version: Int
    let scenes: [Scene]

    static func load(contentsOf url: URL) -> LearnedStyleProfile? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(LearnedStyleProfile.self, from: data)
    }
}

enum LearnedStyle {

    /// Beregn scene-features (12-dim) IDENTISK med Python `features()`:
    /// 8-bin luma-histogram (OpenCV Lab L, 0–255) + L-snitt/255 + L-std/128 +
    /// (a-snitt−128)/20 + (b-snitt−128)/20. Beregnes på 128×128 nedskalering.
    static func features(of cgImage: CGImage) -> [Double] {
        let w = 128, h = 128
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                            bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        ctx?.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

        var hist = [Double](repeating: 0, count: 8)
        var sumL = 0.0, sumL2 = 0.0, sumA = 0.0, sumB = 0.0
        let n = Double(w * h)
        for i in stride(from: 0, to: px.count, by: 4) {
            let (lcv, acv, bcv) = labCV(r: CGFloat(px[i]) / 255, g: CGFloat(px[i + 1]) / 255, b: CGFloat(px[i + 2]) / 255)
            hist[min(7, Int(lcv / 32.0))] += 1
            sumL += lcv; sumL2 += lcv * lcv; sumA += acv; sumB += bcv
        }
        for i in 0..<8 { hist[i] /= n }
        let meanL = sumL / n
        let stdL = (max(0, sumL2 / n - meanL * meanL)).squareRoot()
        return hist + [meanL / 255.0, stdL / 128.0, (sumA / n - 128) / 20.0, (sumB / n - 128) / 20.0]
    }

    /// sRGB(0…1) → OpenCV 8-bit Lab (L,a,b i 0…255, 128=nøytral for a/b).
    private static func labCV(r: CGFloat, g: CGFloat, b: CGFloat) -> (Double, Double, Double) {
        let a = SkinToneMath.aStar(r: r, g: g, b: b)          // CIE a*
        let (lCie, bCie) = SkinToneMath.lbStar(r: r, g: g, b: b)
        return (lCie * 2.55, a + 128, bCie + 128)
    }

    /// Farge-vektet k-NN: a/b-feature (indeks 10–11) vektes 1.6× — matcher
    /// Python-motorens apply. Returnerer vektet snitt av LUT + a/b.
    static func blend(features f: [Double], profile: LearnedStyleProfile, k: Int = 5)
        -> (lut: [[Double]], ab: [Double])? {
        guard !profile.scenes.isEmpty, f.count == 12 else { return nil }
        let scored: [(d: Double, s: LearnedStyleProfile.Scene)] = profile.scenes.map { sc in
            var sum = 0.0
            for i in 0..<12 {
                let wgt = (i >= 10) ? 1.6 : 1.0
                let diff = (sc.feat[i] - f[i]) * wgt
                sum += diff * diff
            }
            return (sum.squareRoot(), sc)
        }.sorted { $0.d < $1.d }

        let top = Array(scored.prefix(k))
        let wts = top.map { 1.0 / ($0.d + 1e-4) }
        let wsum = wts.reduce(0, +)
        var lut = [[Double]](repeating: [Double](repeating: 0, count: 256), count: 3)
        var ab = [0.0, 0.0]
        for (j, item) in top.enumerated() {
            let wt = wts[j] / wsum
            for c in 0..<3 {
                let curve = item.s.lut[c]
                for x in 0..<256 { lut[c][x] += Double(curve[x]) * wt }
            }
            ab[0] += item.s.ab[0] * wt
            ab[1] += item.s.ab[1] * wt
        }
        return (lut, ab)
    }

    /// Påfør en lært stil på et CIImage: per-kanal-LUT (CIColorCurves) + a/b-skift.
    static func apply(profile: LearnedStyleProfile, to image: CIImage, k: Int = 5) -> CIImage {
        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = ctx.createCGImage(image, from: image.extent) else { return image }
        let f = features(of: cg)
        guard let blended = blend(features: f, profile: profile, k: k) else { return image }
        var out = image

        // Per-kanal 1D-LUT via CIColorCurves. cv2-LUT er BGR → map til RGB.
        var samples = [Float]()
        samples.reserveCapacity(256 * 3)
        for x in 0..<256 {
            samples.append(Float(blended.lut[2][x] / 255.0))  // R ← lut[2]
            samples.append(Float(blended.lut[1][x] / 255.0))  // G ← lut[1]
            samples.append(Float(blended.lut[0][x] / 255.0))  // B ← lut[0]
        }
        let curves = CIFilter.colorCurves()
        curves.inputImage = out
        curves.curvesData = samples.withUnsafeBufferPointer { Data(buffer: $0) }
        curves.curvesDomain = CIVector(x: 0, y: 1)
        curves.colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
        out = curves.outputImage ?? out

        // a/b-middel-skift approksimert i RGB (0.5× som motoren): +a = rød↔grønn,
        // +b = gul↔blå. Skalert til RGB-enheter (LAB a/b ~ ±0..30 → små bias).
        let da = blended.ab[0] * 0.5 / 255.0
        let db = blended.ab[1] * 0.5 / 255.0
        if abs(da) > 0.0005 || abs(db) > 0.0005 {
            let m = CIFilter.colorMatrix()
            m.inputImage = out
            m.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
            m.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
            m.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
            m.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
            // +a: rød opp, grønn ned. +b: rød/grønn opp, blå ned (gul).
            m.biasVector = CIVector(x: da + db, y: -da + db, z: -db, w: 0)
            out = m.outputImage ?? out
        }
        return out.cropped(to: image.extent)
    }
}
