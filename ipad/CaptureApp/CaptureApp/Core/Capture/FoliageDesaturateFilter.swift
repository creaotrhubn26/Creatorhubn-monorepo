import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics

/// LØVVERK-DEMPING (subjekt-beskyttet) — den «luftige editorial»-looken kommer i
/// stor grad av at dominerende, skrikende GRØNT bakgrunnsløvverk dempes i metning
/// så paret POPPER, MENS motivet beholder full farge. Lært av en håndlaget
/// korreksjon for nettopp denne scenen (grønt ×0.80 metning, gult ×0.91, cyan
/// ×0.94, med metningen blandet tilbake til 1.0 over motivet).
///
/// 🔑 SYSTEMATISERT (ikke hardkodede koordinater): «motiv»-masken BYGGES per bilde
/// fra `FaceContext`-deteksjonene — én myk ellipse per FUNNET ansikt, forlenget
/// nedover for torso, unionert. Nytt bilde → nye deteksjoner → ny maske, automatisk.
/// Løvverk-dempingen blandes KUN inn i bakgrunnen (1 − motiv-maske) → hud/klær/paret
/// urørt. No-op uten ansikter (motiv-teknikk, ikke for rene landskap).
///
/// Metnings-reduksjonen er hue-gatet (grønn→gulgrønn→cyan) og destilleres til én
/// statisk 3D-LUT (GPU). Hud (~49°) ligger utenfor løvverk-vinduet → dobbelt trygt.
enum FoliageDesaturateFilter {

    static func apply(to image: CIImage, faces: [CGRect], ctx: CIContext,
                      reduction: Double = 0.28, subjectMask subjectOverride: CIImage? = nil) -> CIImage {
        // motiv-teknikk: trenger enten en person-matte ELLER ansikter
        guard reduction > 0.001, subjectOverride != nil || !faces.isEmpty else { return image }
        let extent = image.extent
        guard extent.width > 1, extent.height > 1 else { return image }

        // 1) løvverk-dempet versjon (hele bildet)
        let dim = 40
        let f = CIFilter.colorCubeWithColorSpace()
        f.inputImage = image
        f.cubeDimension = Float(dim)
        f.cubeData = cachedCube(dim: dim, reduction: min(0.5, reduction))
        f.colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
        guard let desat = f.outputImage?.cropped(to: extent) else { return image }

        // 2) MOTIV-MASKE: Vision-person-matte når tilgjengelig (piksel-nøyaktig,
        // per bilde), ellers fallback til ansikts-ellipser. Fjæret for myk overgang.
        let subjectRaw: CIImage
        if let ov = subjectOverride { subjectRaw = feather(ov, extent: extent) }
        else if let m = subjectMask(extent: extent, faces: faces) { subjectRaw = m }
        else { return image }
        let subject = subjectRaw
        let inv = CIFilter.colorInvert()
        inv.inputImage = subject
        guard let background = inv.outputImage?.cropped(to: extent) else { return image }

        // 3) demp KUN i bakgrunnen; motivet beholder full farge
        let blend = CIFilter.blendWithMask()
        blend.inputImage = desat
        blend.backgroundImage = image
        blend.maskImage = background
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    /// Motiv-maske: union av myke ellipser fra HVERT detektert ansikt, forlenget
    /// nedover for torso. Ren funksjon av ansikts-rektene → ingen hardkoding.
    private static func subjectMask(extent: CGRect, faces: [CGRect]) -> CIImage? {
        var mask = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        for face in faces {
            // CIImage-koordinater (origin nede-venstre): torso er UNDER ansiktet =
            // LAVERE y. Senter ellipsen mellom ansikt og torso, gjør den høy+bred nok
            // til å dekke stående kropp; skalér vertikalt for ellipse-form.
            let cx = face.midX
            let cy = face.midY - face.height * 0.9
            let g = CIFilter.radialGradient()
            g.center = CGPoint(x: cx, y: cy)
            g.radius0 = Float(face.width * 1.3)
            g.radius1 = Float(face.width * 3.6)
            g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
            g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
            guard var grad = g.outputImage else { continue }
            // gjør sirkelen til en stående ellipse (1.0 bred × ~1.7 høy) rundt (cx,cy)
            let t = CGAffineTransform(translationX: cx, y: cy)
            let ell = CGAffineTransform(scaleX: 1.0, y: 1.7)
            grad = grad.transformed(by: t.inverted().concatenating(ell).concatenating(t))
            let maxc = CIFilter.maximumCompositing()
            maxc.inputImage = grad.cropped(to: extent)
            maxc.backgroundImage = mask
            mask = maxc.outputImage?.cropped(to: extent) ?? mask
        }
        return mask
    }

    private nonisolated(unsafe) static var cache: [String: Data] = [:]
    private static let lock = NSLock()

    private static func cachedCube(dim: Int, reduction: Double) -> Data {
        let key = String(format: "fol_%d_%.2f", dim, reduction)
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
                    let chroma = (a * a + b * b).squareRoot()
                    let hue = atan2(b, a) * 180 / .pi
                    // løvverk-vindu: gulgrønn→grønn→cyan (~60…178°), krever chroma
                    let hW = smooth(hue, 55, 72) * (1 - smooth(hue, 168, 184))
                    let cW = smooth(chroma, 8, 16)
                    let w = hW * cW
                    let scale = 1.0 - reduction * w
                    let (nr, ng, nb) = labToSrgb(labL, clamp255(a * scale + 128), clamp255(b * scale + 128))
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

    /// Fjær en hard matte (Vision-person) litt så bakgrunns-blandingen ikke får
    /// harde kanter; utvider motivet marginalt så hud-kant ikke havner i bakgrunnen.
    private static func feather(_ mask: CIImage, extent: CGRect) -> CIImage {
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = mask.clampedToExtent()
        blur.radius = Float(max(1.5, min(extent.width, extent.height) * 0.006))
        return (blur.outputImage ?? mask).cropped(to: extent)
    }

    private static func smooth(_ x: Double, _ e0: Double, _ e1: Double) -> Double {
        let t = max(0, min(1, (x - e0) / max(1e-6, e1 - e0)))
        return t * t * (3 - 2 * t)
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
