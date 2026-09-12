import Foundation
import CoreImage
import CoreGraphics

/// Fase 0 (adaptiv redigering): per-bilde HVITBALANSE-NØYTRALISERING som kjøres FØR
/// den lærte LUT-en, så looken lander konsistent i stedet for å arve rammens
/// fargestikk (blandet kirke-/blits-/vindus-lys). Estimerer belysningen med
/// Minkowski p-norm-statistikk («shades-of-gray»: p=1 = gray-world, høyere p → mot
/// white-patch; p≈5 robust default — kant/norm-robust mot store fargeflater som
/// kjoler, løv, treverk). Produserer EKSPONERINGS-BEVARENDE gains (grønn = referanse,
/// gain=1), så steget kun nøytraliserer FARGE — lysstyrke håndteres av
/// eksponerings-normaliseringen separat.
///
/// Ren + testbar: estimatet leser en nedskalert piksel-buffer direkte (ingen GPU),
/// så resultatet er deterministisk og målbart i enhetstester.
enum AdaptiveWhiteBalance {

    /// Per-kanal multiplikative gains som nøytraliserer fargestikket. `identity`
    /// = ingen endring. Normalisert slik at grønn = 1 (WB-referansekanal).
    struct Gains: Equatable {
        var r: Double
        var g: Double
        var b: Double
        static let identity = Gains(r: 1, g: 1, b: 1)

        /// Klem gainene så en enkelt kanal ikke kan skyte i taket på en degenerert
        /// ramme (f.eks. nær-monokrom). `max` = tak på |avvik fra 1|-forhold.
        func clamped(to maxRatio: Double) -> Gains {
            func c(_ v: Double) -> Double { min(maxRatio, max(1 / maxRatio, v)) }
            return Gains(r: c(r), g: c(g), b: c(b))
        }
    }

    /// Estimer eksponerings-bevarende WB-gains fra et bilde via Minkowski p-norm.
    /// `p`=1 → gray-world; ~5 = robust default. Leser en `sampleSide`×`sampleSide`
    /// nedskalering. Returnerer `.identity` ved degenererte input.
    static func estimateGains(_ cg: CGImage, p: Double = 5, sampleSide: Int = 96,
                              clampRatio: Double = 3.0) -> Gains {
        let w = max(1, sampleSide), h = max(1, sampleSide)
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return .identity }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        // Σ(c_lin)^p per kanal → p-middel = (Σ/N)^(1/p). p=1 er ren gray-world.
        // 🔑 LINEARISER sRGB→lys FØRST: WB-gains skal virke i lineært lys (det er der
        // `CIColorMatrix` multipliserer), ellers blir nøytraliseringen skjev.
        func lin(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        var sr = 0.0, sg = 0.0, sb = 0.0
        let n = Double(w * h)
        let pw = max(0.1, p)
        for i in stride(from: 0, to: px.count, by: 4) {
            let r = lin(Double(px[i]) / 255), g = lin(Double(px[i + 1]) / 255), b = lin(Double(px[i + 2]) / 255)
            if pw == 1 { sr += r; sg += g; sb += b } else {
                sr += pow(r, pw); sg += pow(g, pw); sb += pow(b, pw)
            }
        }
        let ir = pow(sr / n, 1 / pw), ig = pow(sg / n, 1 / pw), ib = pow(sb / n, 1 / pw)
        // Grønn = referanse → gain_c = illum_g / illum_c (grønn uendret = eksp. bevart).
        guard ir > 1e-4, ig > 1e-4, ib > 1e-4 else { return .identity }
        return Gains(r: ig / ir, g: 1, b: ig / ib).clamped(to: clampRatio)
    }

    /// Blend det globale estimatet mot ANSIKTS-forankring: gray-world/edge alene kan
    /// dras skjevt av store fargeflater, men vi bryr oss mest om at HUD ser riktig
    /// ut. `faceGains` = gains som ville nøytralisert ansikts-regionens stikk; vi
    /// tar en dempet blanding (default 35 %) mot den, IKKE full nøytralisering (hud
    /// skal ikke bli grå). nil-ansikt → globalt estimat uendret.
    static func anchoredToFace(global: Gains, faceGains: Gains?, weight: Double = 0.35) -> Gains {
        guard let f = faceGains else { return global }
        let wgt = min(1, max(0, weight))
        func mix(_ a: Double, _ b: Double) -> Double { a * (1 - wgt) + b * wgt }
        return Gains(r: mix(global.r, f.r), g: 1, b: mix(global.b, f.b))
    }

    /// Påfør gains som en diagonal fargematrise. Ren farge-skalering (grønn=1).
    static func apply(_ image: CIImage, gains: Gains) -> CIImage {
        guard gains != .identity, let m = CIFilter(name: "CIColorMatrix") else { return image }
        m.setValue(image, forKey: kCIInputImageKey)
        m.setValue(CIVector(x: CGFloat(gains.r), y: 0, z: 0, w: 0), forKey: "inputRVector")
        m.setValue(CIVector(x: 0, y: CGFloat(gains.g), z: 0, w: 0), forKey: "inputGVector")
        m.setValue(CIVector(x: 0, y: 0, z: CGFloat(gains.b), w: 0), forKey: "inputBVector")
        m.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputAVector")
        return m.outputImage ?? image
    }
}
