import Foundation
import CoreGraphics

/// Perceptuell «difference hash» (dHash) — 64-bit fingeravtrykk for rask
/// nesten-duplikat-deteksjon i filmstripen (burst-rammer / gjentatte poseringer).
/// Sendable (UInt64) → beregnes off-main, sammenlignes med Hamming-avstand. Robust
/// mot små eksponerings-/skala-endringer (sammenligner NABO-lysstyrker, ikke
/// absolutte verdier). Ikke krypto — ren likhets-signatur.
enum PerceptualHash {

    /// 9×8 gråtone → for hver rad: bit = venstre-piksel lysere enn høyre. 8×8 = 64 bit.
    static func dHash(_ cg: CGImage) -> UInt64 {
        let w = 9, h = 8
        var px = [UInt8](repeating: 0, count: w * h)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue)
        else { return 0 }
        ctx.interpolationQuality = .low
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        var hash: UInt64 = 0
        var bit = 0
        for y in 0..<h {
            for x in 0..<(w - 1) {
                if px[y * w + x] > px[y * w + x + 1] { hash |= (1 << UInt64(bit)) }
                bit += 1
            }
        }
        return hash
    }

    /// Antall ulike bit (Hamming-avstand) mellom to hasher. 0 = identisk; ~< 10 av
    /// 64 = nesten-duplikat (empirisk terskel for dHash).
    static func hammingDistance(_ a: UInt64, _ b: UInt64) -> Int {
        (a ^ b).nonzeroBitCount
    }

    /// Standard nesten-duplikat-terskel (av 64 bit).
    static let duplicateThreshold = 10

    static func isDuplicate(_ a: UInt64, _ b: UInt64, threshold: Int = duplicateThreshold) -> Bool {
        hammingDistance(a, b) <= threshold
    }
}
