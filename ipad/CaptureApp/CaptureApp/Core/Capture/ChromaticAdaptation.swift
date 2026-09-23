import Foundation

/// Fase 2, Lag 1 (illuminant-bevisst hud-kalibrering): CAT02 kromatisk adaptasjon —
/// transformerer en farge målt under ÉN belysning til hvordan den ville sett ut
/// under et REFERANSELYS (D65), FØR huden sammenlignes med ankeret. Uten dette måler
/// man «samme hud under tungsten/skygge/blits/gyllen time» som fire helt ulike
/// a*/b* og kan ikke skille «huden er feil» fra «lyset er annerledes».
///
/// 🔑 ESSET: EXIF/telemetri VET hva lyset var — CIRAWFilters as-shot
/// `neutralTemperature` (K) gir et illuminant-estimat FØR pikslene analyseres. Vi
/// bruker CCT→hvitpunkt her og adapterer til D65; kombineres i pipelinen med et
/// gray-world-estimat (uenighet = signal om blandet lys → Lag 3).
///
/// Standard matrise-matte (CAT02), ingen ML. Ren + testbar.
enum ChromaticAdaptation {

    typealias XYZ = (X: Double, Y: Double, Z: Double)

    /// D65 hvitpunkt (Y=1-normalisert).
    static let d65: XYZ = (0.95047, 1.0, 1.08883)

    // CAT02 sensor-matrise (XYZ → «cone-like» ρ,γ,β) og dens invers.
    private static let m: [Double] = [
        0.7328, 0.4296, -0.1624,
        -0.7036, 1.6975, 0.0061,
        0.0030, 0.0136, 0.9834
    ]
    private static let mInv: [Double] = [
        1.096124, -0.278869, 0.182745,
        0.454369, 0.473533, 0.072098,
        -0.009628, -0.005698, 1.015326
    ]

    private static func mul(_ a: [Double], _ v: XYZ) -> XYZ {
        (a[0] * v.X + a[1] * v.Y + a[2] * v.Z,
         a[3] * v.X + a[4] * v.Y + a[5] * v.Z,
         a[6] * v.X + a[7] * v.Y + a[8] * v.Z)
    }

    /// Korrelert fargetemperatur (Kelvin) → CIE xy → XYZ-hvitpunkt (Y=1). Kim et al.
    /// (2002)-approksimasjon, gyldig ~1667–25000 K. Lar oss bruke as-shot-WB (EXIF)
    /// som illuminant-prior.
    static func whitePoint(fromCCT t: Double) -> XYZ {
        let T = min(25000, max(1667, t))
        let x: Double
        if T <= 4000 {
            x = -0.2661239e9 / (T * T * T) - 0.2343589e6 / (T * T) + 0.8776956e3 / T + 0.179910
        } else {
            x = -3.0258469e9 / (T * T * T) + 2.1070379e6 / (T * T) + 0.2226347e3 / T + 0.240390
        }
        let y: Double
        if T <= 2222 {
            y = -1.1063814 * x * x * x - 1.34811020 * x * x + 2.18555832 * x - 0.20219683
        } else if T <= 4000 {
            y = -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16748867
        } else {
            y = 3.0817580 * x * x * x - 5.87338670 * x * x + 3.75112997 * x - 0.37001483
        }
        guard y > 1e-6 else { return d65 }
        return (x / y, 1.0, (1 - x - y) / y)
    }

    /// 3×3 adaptasjonsmatrise (rad-major, 9 tall) fra kilde-hvitpunkt til mål-hvitpunkt:
    /// `M⁻¹ · diag(ρd/ρs, γd/γs, βd/βs) · M`.
    static func adaptationMatrix(from src: XYZ, to dst: XYZ) -> [Double] {
        let s = mul(m, src), d = mul(m, dst)
        let g = [d.X / s.X, d.Y / s.Y, d.Z / s.Z]     // diagonal
        // diag · M
        var dm = [Double](repeating: 0, count: 9)
        for r in 0..<3 { for c in 0..<3 { dm[r * 3 + c] = g[r] * m[r * 3 + c] } }
        // M⁻¹ · (diag · M)
        var out = [Double](repeating: 0, count: 9)
        for r in 0..<3 {
            for c in 0..<3 {
                var acc = 0.0
                for k in 0..<3 { acc += mInv[r * 3 + k] * dm[k * 3 + c] }
                out[r * 3 + c] = acc
            }
        }
        return out
    }

    /// Adapter en XYZ-farge med en (forhåndsberegnet) adaptasjonsmatrise.
    static func adapt(_ xyz: XYZ, with matrix: [Double]) -> XYZ { mul(matrix, xyz) }

    /// Bekvemhet: adapter en farge målt under `sourceCCT` (Kelvin) til D65.
    static func adaptToD65(_ xyz: XYZ, sourceCCT: Double) -> XYZ {
        adapt(xyz, with: adaptationMatrix(from: whitePoint(fromCCT: sourceCCT), to: d65))
    }
}
