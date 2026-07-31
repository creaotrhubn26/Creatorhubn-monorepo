import Foundation
import CoreImage
import CoreGraphics

/// EKTE-LAB fargeoverføring — den prinsipielle porten av Python-motorens
/// `apply_model`-fargesteg (som RGB-approksimasjonen ikke klarte: metningen
/// krasjet). I CIELAB (OpenCV 8-bit-enheter, som profilen bruker):
///   • a/b-MIDDELSKIFT:   a += 0.5·Δa,  b += 0.5·Δb   (hue/farge-drift)
///   • REINHARD-STD:      kanal = m + (verdi − m)·stdRatio  rundt kanalens SNITT
///     (L=kontrast, a/b=metning) — nøyaktig fotografens spredningsendring per
///     LAB-kanal, i motsetning til en global CIColorControls-metning.
/// Snittet måles på bildet SELV (etter LUT) på en nedskalering; affinen påføres
/// full oppløsning. Reinhard-ratio klemmes 0.6–1.7 som i motoren.
enum LabColorTransfer {

    /// `ab`  = [Δa, Δb] (OpenCV a/b-enheter, fra profilen).
    /// `std` = [L, a, b] Reinhard-spredningsforhold (dimensjonsløst).
    static func apply(to image: CIImage, ab: [Double], std: [Double], ctx: CIContext) -> CIImage {
        guard ab.count == 2, std.count == 3,
              let cg = ctx.createCGImage(image, from: image.extent) else { return image }
        let w = cg.width, h = cg.height
        guard w > 1, h > 1 else { return image }

        // Kanal-snitt (OpenCV LAB) fra en 96×96-nedskalering — raskt, representativt.
        let (mL, mA, mB) = means(of: cg)
        let sL = clampStd(std[0]), sA = clampStd(std[1]), sB = clampStd(std[2])
        let shA = 0.5 * ab[0], shB = 0.5 * ab[1]

        // Full-oppløsnings-buffer.
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let bmp = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return image }
        bmp.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        px.withUnsafeMutableBufferPointer { buf in
            var i = 0
            while i < buf.count {
                let r = Double(buf[i]) / 255, g = Double(buf[i + 1]) / 255, b = Double(buf[i + 2]) / 255
                var (L, A, B) = srgbToLab(r, g, b)
                // Reinhard-std rundt snittet + a/b-middelskift (samme rekkefølge som motoren).
                L = mL + (L - mL) * sL
                A = mA + shA + (A - mA) * sA
                B = mB + shB + (B - mB) * sB
                let (nr, ng, nb) = labToSrgb(clamp255(L), clamp255(A), clamp255(B))
                buf[i] = u8(nr); buf[i + 1] = u8(ng); buf[i + 2] = u8(nb)
                i += 4
            }
        }
        guard let out = bmp.makeImage() else { return image }
        return CIImage(cgImage: out)
    }

    // MARK: - Kanal-snitt (nedskalert)

    private static func means(of cg: CGImage) -> (Double, Double, Double) {
        let s = 96
        var px = [UInt8](repeating: 0, count: s * s * 4)
        guard let c = CGContext(data: &px, width: s, height: s, bitsPerComponent: 8,
                                bytesPerRow: s * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return (128, 128, 128) }
        c.draw(cg, in: CGRect(x: 0, y: 0, width: s, height: s))
        var sumL = 0.0, sumA = 0.0, sumB = 0.0
        let n = Double(s * s)
        var i = 0
        while i < px.count {
            let (L, A, B) = srgbToLab(Double(px[i]) / 255, Double(px[i + 1]) / 255, Double(px[i + 2]) / 255)
            sumL += L; sumA += A; sumB += B
            i += 4
        }
        return (sumL / n, sumA / n, sumB / n)
    }

    // MARK: - sRGB ↔ OpenCV-LAB (D65, L·2.55 / a,b+128)

    private static func srgbToLab(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
        func lin(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let rl = lin(r), gl = lin(g), bl = lin(b)
        let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
        let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
        let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883
        func f(_ t: Double) -> Double { t > 0.008856 ? pow(t, 1.0 / 3.0) : (7.787 * t + 16.0 / 116.0) }
        let fx = f(x), fy = f(y), fz = f(z)
        let L = 116.0 * fy - 16.0
        let A = 500.0 * (fx - fy)
        let B = 200.0 * (fy - fz)
        return (L * 2.55, A + 128.0, B + 128.0)   // OpenCV 8-bit-enheter
    }

    private static func labToSrgb(_ Lo: Double, _ Ao: Double, _ Bo: Double) -> (Double, Double, Double) {
        let L = Lo / 2.55, A = Ao - 128.0, B = Bo - 128.0
        let fy = (L + 16.0) / 116.0
        let fx = fy + A / 500.0
        let fz = fy - B / 200.0
        func fInv(_ t: Double) -> Double { t > 0.206897 ? t * t * t : (t - 16.0 / 116.0) / 7.787 }
        let x = fInv(fx) * 0.95047, y = fInv(fy), z = fInv(fz) * 1.08883
        let rl = x * 3.2406 + y * -1.5372 + z * -0.4986
        let gl = x * -0.9689 + y * 1.8758 + z * 0.0415
        let bl = x * 0.0557 + y * -0.2040 + z * 1.0570
        func gam(_ c: Double) -> Double {
            let cc = max(0, c)
            return cc <= 0.0031308 ? 12.92 * cc : 1.055 * pow(cc, 1.0 / 2.4) - 0.055
        }
        return (gam(rl), gam(gl), gam(bl))
    }

    private static func clampStd(_ v: Double) -> Double { max(0.6, min(1.7, v)) }
    private static func clamp255(_ v: Double) -> Double { max(0, min(255, v)) }
    private static func u8(_ v: Double) -> UInt8 { UInt8(max(0, min(255, v * 255)).rounded()) }
}
