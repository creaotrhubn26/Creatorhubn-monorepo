import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics

/// GLOBAL avmagentaisering — fjerner den MAGENTA-castet den lærte grade-en kan
/// innføre i skygge/mellomtone når en mørk, grønn-ambient scene løftes kraftig
/// (målt: kilde-develop har grønn-nøytrale lavtoner a*≤0, men LUT+LAB-steget skyver
/// dem til a*>0 / b*<0 = magenta — motsatt av både kilden OG fasit-looken).
///
/// Prinsipp (validert i Python mot ekte iOS-utdata): en tone-vektet, MAGENTA-
/// SIGNATUR-GATET a/b-korreksjon. Den rører KUN piksler som er magenta (positiv a*
/// SAMTIDIG som lav/negativ b*) i lav/mellomtone → den er en NO-OP på:
///   • velbelyste varme scener (b* positiv = ekte varme, ikke magenta) — bevart
///   • grønne/nøytrale scener (a* ≤ 0) — urørt
///   • høylys + hud (tone-vekten faller mot 0; hud korrigeres av SkinLineCorrect)
///
/// Ren funksjon av (L,a,b) → destillert til én STATISK 3D-LUT (bygd én gang,
/// cachet) og påført på GPU via `CIColorCubeWithColorSpace` (zero-copy, Metal).
enum ToneCastNeutralizeFilter {

    /// Styrke 0…1 (1 = full validert korreksjon). No-op ved 0.
    static func apply(to image: CIImage, strength: Double = 1.0) -> CIImage {
        guard strength > 0.001 else { return image }
        let extent = image.extent
        guard extent.width > 1, extent.height > 1 else { return image }
        let dim = 40
        let f = CIFilter.colorCubeWithColorSpace()
        f.inputImage = image
        f.cubeDimension = Float(dim)
        f.cubeData = cachedCube(dim: dim, strength: min(1.0, strength))
        f.colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
        return f.outputImage?.cropped(to: extent) ?? image
    }

    private nonisolated(unsafe) static var cache: [String: Data] = [:]
    private static let lock = NSLock()

    private static func cachedCube(dim: Int, strength: Double) -> Data {
        let key = String(format: "tc_%d_%.2f", dim, strength)
        lock.lock(); let hit = cache[key]; lock.unlock()
        if let hit { return hit }

        var cube = [Float](repeating: 0, count: dim * dim * dim * 4)
        let inv = 1.0 / Double(dim - 1)
        var o = 0
        for bi in 0..<dim {
            let bf = Double(bi) * inv
            for gi in 0..<dim {
                let gf = Double(gi) * inv
                for ri in 0..<dim {
                    let (labL, labA, labB) = srgbToLab(Double(ri) * inv, gf, bf)
                    let a = labA - 128.0, b = labB - 128.0
                    // tone-vekt: sterk i skygge/mellomtone (L 0–255), av i høylys
                    let w = clamp01((185.0 - labL) / 150.0)
                    // magenta-signatur: lav b* OG positiv a* → 1; ekte varme (b*>0) → 0
                    let mag = clamp01((5.0 - b) / 18.0) * clamp01(a / 4.0)
                    let g = w * mag * strength * 0.9
                    let a2 = a - g * max(0, a)          // trekk magenta-rødhet ned
                    let b2 = b + g * max(0, 5.0 - b)     // løft manglende gulhet opp
                    let (nr, ng, nb) = labToSrgb(labL, clamp255(a2 + 128), clamp255(b2 + 128))
                    cube[o] = Float(clamp01(nr)); cube[o + 1] = Float(clamp01(ng))
                    cube[o + 2] = Float(clamp01(nb)); cube[o + 3] = 1
                    o += 4
                }
            }
        }
        let data = cube.withUnsafeBufferPointer { Data(buffer: $0) }
        lock.lock(); if cache.count >= 6 { cache.removeAll() }; cache[key] = data; lock.unlock()
        return data
    }

    // sRGB ↔ OpenCV-LAB (D65, L·2.55 / a,b+128) — samme mate som LabColorTransfer.
    private static func srgbToLab(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
        func lin(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let rl = lin(r), gl = lin(g), bl = lin(b)
        let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
        let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
        let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883
        func fn(_ t: Double) -> Double { t > 0.008856 ? pow(t, 1.0 / 3.0) : (7.787 * t + 16.0 / 116.0) }
        let fx = fn(x), fy = fn(y), fz = fn(z)
        return ((116.0 * fy - 16.0) * 2.55, 500.0 * (fx - fy) + 128.0, 200.0 * (fy - fz) + 128.0)
    }

    private static func labToSrgb(_ Lo: Double, _ Ao: Double, _ Bo: Double) -> (Double, Double, Double) {
        let L = Lo / 2.55, A = Ao - 128.0, B = Bo - 128.0
        let fy = (L + 16.0) / 116.0, fx = (L + 16.0) / 116.0 + A / 500.0, fz = (L + 16.0) / 116.0 - B / 200.0
        func fInv(_ t: Double) -> Double { t > 0.206897 ? t * t * t : (t - 16.0 / 116.0) / 7.787 }
        let x = fInv(fx) * 0.95047, y = fInv(fy), z = fInv(fz) * 1.08883
        let rl = x * 3.2406 + y * -1.5372 + z * -0.4986
        let gl = x * -0.9689 + y * 1.8758 + z * 0.0415
        let bl = x * 0.0557 + y * -0.2040 + z * 1.0570
        func gam(_ c: Double) -> Double { let cc = max(0, c); return cc <= 0.0031308 ? 12.92 * cc : 1.055 * pow(cc, 1.0 / 2.4) - 0.055 }
        return (gam(rl), gam(gl), gam(bl))
    }

    private static func clamp01(_ v: Double) -> Double { max(0, min(1, v)) }
    private static func clamp255(_ v: Double) -> Double { max(0, min(255, v)) }
}
