import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics

/// HUD-VAKTPOST (guarded) — når den lærte grade-en på en HARD scene (kraftig løft +
/// farget ambient) driver huden av hud-linja (målt: naturlig 35° → magenta 9°),
/// roterer den hud-punktskyen TILBAKE på ~49°-linja + restaurerer chroma, MELANIN-
/// SIKKERT: L* er urørt og korreksjonen treffer KUN hud-kromatisiteter (chroma+hue-
/// gatet cube), så tenner/øyne/nøytraler ikke tones.
///
/// 🔑 GATET (den «guarded» arkitekturen): måler hvert ansikts median-hud-hue og
/// HOPPER OVER ansikt som alt ligger innenfor `tolerance` av linja → velbelyste
/// portretter (hud ~50°) er en NO-OP (null regresjon); kun faktisk-avdrevet hud
/// (magenta/grønn) korrigeres. Speiler `SkinScope`-vaktpostens cast-deteksjon.
///
/// Per-ansikt rotasjon+skala er lineær i (a*,b*) → destillert til en per-ansikt 3D-
/// LUT (cachet på avrundet rot/skala) og påført på GPU, maskert til ansikts-ovalen.
enum SkinLineCorrectFilter {

    static let targetHueDeg = 49.0     // empirisk hud-linje (726 ansikter)
    static let targetChroma = 24.0     // sunn hud-chroma (fasit-nivå)
    static let toleranceDeg = 10.0     // innenfor → alt på linja → hopp over

    static func apply(to image: CIImage, faces: [CGRect], ctx: CIContext,
                      strength: Double = 0.85, skinMask landmarkSkin: CIImage? = nil) -> CIImage {
        guard strength > 0.001, !faces.isEmpty else { return image }
        let extent = image.extent
        var out = image
        for face in faces {
            let inner = face.insetBy(dx: face.width * 0.18, dy: face.height * 0.18)
            let sampleRect = inner.width > 4 ? inner : face
            guard let (mh, mc) = medianSkin(of: out, in: sampleRect, ctx: ctx), mc >= 4 else { continue }
            let dev = shortestAngle(mh - targetHueDeg)
            guard abs(dev) > toleranceDeg else { continue }   // GATE: alt på linja → no-op
            let rot = max(-45.0, min(45.0, -dev)) * strength
            let scale = max(0.85, min(1.6, targetChroma / mc))

            let dim = 40
            let cube = cachedCube(dim: dim, rotDeg: rot, scale: scale)
            let f = CIFilter.colorCubeWithColorSpace()
            f.inputImage = out
            f.cubeDimension = Float(dim)
            f.cubeData = cube
            f.colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
            guard let corrected = f.outputImage?.cropped(to: extent),
                  let oval = faceMask(extent: extent, faceRect: face) else { continue }
            // LANDMARK-HUD-MASKE (FaceXFormer-metoden, on-device): begrens korreksjonen
            // til ekte ansikts-hud — lepper (kromatiske!) + øyne holdes utenfor. Snitt
            // (multipliser) med ansikts-ovalen. Fallback: bare ovalen.
            var mask = oval
            if let skin = landmarkSkin {
                let m = CIFilter.multiplyCompositing()
                m.inputImage = skin
                m.backgroundImage = oval
                mask = m.outputImage?.cropped(to: extent) ?? oval
            }
            let blend = CIFilter.blendWithMask()
            blend.inputImage = corrected
            blend.backgroundImage = out
            blend.maskImage = mask
            out = blend.outputImage?.cropped(to: extent) ?? out
        }
        return out
    }

    // MARK: - median hud (a*,b*) via lite skin-gatet readback av ansikts-kjernen

    private static func medianSkin(of image: CIImage, in rect: CGRect, ctx: CIContext) -> (hue: Double, chroma: Double)? {
        let s = 48
        let scaled = image.cropped(to: rect).transformed(by: CGAffineTransform(
            scaleX: CGFloat(s) / max(1, rect.width), y: CGFloat(s) / max(1, rect.height)))
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        var px = [UInt8](repeating: 0, count: s * s * 4)
        guard let c = CGContext(data: &px, width: s, height: s, bitsPerComponent: 8,
                                bytesPerRow: s * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        c.draw(cg, in: CGRect(x: 0, y: 0, width: s, height: s))
        var as_ = [Double](), bs = [Double]()
        var i = 0
        while i < px.count {
            let (_, A, B) = srgbToLab(Double(px[i]) / 255, Double(px[i + 1]) / 255, Double(px[i + 2]) / 255)
            let a = A - 128, b = B - 128
            let chroma = (a * a + b * b).squareRoot()
            let hue = atan2(b, a) * 180 / .pi
            if chroma >= 8, chroma <= 55, hue >= -40, hue <= 90 {   // hud-kromatisiteter (inkl. magenta-drevet)
                as_.append(a); bs.append(b)
            }
            i += 4
        }
        guard as_.count >= 24 else { return nil }
        let ma = median(as_), mb = median(bs)
        return (atan2(mb, ma) * 180 / .pi, (ma * ma + mb * mb).squareRoot())
    }

    // MARK: - per-ansikt cube (rotasjon+skala i a/b, skin-kromatisitet-gatet)

    private nonisolated(unsafe) static var cache: [String: Data] = [:]
    private static let lock = NSLock()

    private static func cachedCube(dim: Int, rotDeg: Double, scale: Double) -> Data {
        let key = String(format: "sk_%d_%.0f_%.2f", dim, rotDeg, scale)
        lock.lock(); let hit = cache[key]; lock.unlock()
        if let hit { return hit }
        let rot = rotDeg * .pi / 180, cs = cos(rot), sn = sin(rot)
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
                    let w = skinWeight(a: a, b: b, L: labL)
                    // rotasjon+skala vektet av skin-likhet (nøytraler → w=0 → urørt)
                    let ra = a * cs - b * sn, rb = a * sn + b * cs
                    let sa = ra * scale, sb = rb * scale
                    let a2 = a + (sa - a) * w
                    let b2 = b + (sb - b) * w
                    let (nr, ng, nb) = labToSrgb(labL, clamp255(a2 + 128), clamp255(b2 + 128))
                    cube[o] = Float(clamp01(nr)); cube[o + 1] = Float(clamp01(ng))
                    cube[o + 2] = Float(clamp01(nb)); cube[o + 3] = 1
                    o += 4
                }
            }
        }
        let data = cube.withUnsafeBufferPointer { Data(buffer: $0) }
        lock.lock(); if cache.count >= 8 { cache.removeAll() }; cache[key] = data; lock.unlock()
        return data
    }

    /// Hud-kromatisitet-vekt (0…1): høy for hud-farger (moderat chroma, hud-hue-vindu,
    /// ikke bek-mørk), 0 for nøytraler (tenner/øyne) og ut-av-range farger.
    static func skinWeight(a: Double, b: Double, L: Double) -> Double {
        let chroma = (a * a + b * b).squareRoot()
        let hue = atan2(b, a) * 180 / .pi
        let cW = smooth(chroma, 6, 12) * (1 - smooth(chroma, 48, 60))   // 12–48 = full
        let hW = smooth(hue, -40, -10) * (1 - smooth(hue, 78, 92))       // -10…78° = full
        let lW = smooth(L, 22, 42)                                        // beskytt bek-mørkt hår/skygge
        return max(0, min(1, cW * hW * lW))
    }

    private static func smooth(_ x: Double, _ e0: Double, _ e1: Double) -> Double {
        let t = max(0, min(1, (x - e0) / max(1e-6, e1 - e0)))
        return t * t * (3 - 2 * t)
    }

    // MARK: - maske + hjelpere

    private static func faceMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY)
        g.radius0 = Float(min(faceRect.width, faceRect.height) * 0.45)
        g.radius1 = Float(max(faceRect.width, faceRect.height) * 0.8)
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        guard let grad = g.outputImage?.cropped(to: extent) else { return nil }
        let comp = CIFilter.sourceOverCompositing()
        comp.inputImage = grad; comp.backgroundImage = black
        return comp.outputImage?.cropped(to: extent)
    }

    private static func median(_ a: [Double]) -> Double {
        let s = a.sorted(); let n = s.count
        return n == 0 ? 0 : (n % 2 == 1 ? s[n / 2] : (s[n / 2 - 1] + s[n / 2]) / 2)
    }

    private static func shortestAngle(_ d: Double) -> Double {
        var x = d.truncatingRemainder(dividingBy: 360)
        if x <= -180 { x += 360 }; if x > 180 { x -= 360 }
        return x
    }

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
