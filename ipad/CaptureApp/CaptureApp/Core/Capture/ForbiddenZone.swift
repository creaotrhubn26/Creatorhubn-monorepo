import Foundation

/// Fase 2 (adaptiv redigering), domene-GENERISK hard grense: `ForbiddenZone` —
/// hue-vinkler i a*/b*-planet en korreksjon ALDRI skal lande i. Dette er den ENESTE
/// virkelig harde grensen i kalibratoren; alt annet er dempet/lært.
///
/// Hud: aldri grønnstikk på hud. Mat (`FoodReference`): aldri blåstikk (ingen
/// naturlig mat er blå — appetitt-dreper), aldri grønnstikk på kjøtt (signaliserer
/// bedervet). Samme mekanikk, ulike soner per domene/matklasse.
///
/// Ren + testbar. Bevarer chroma (radius) — skyver bare hue ut av sonen til nærmeste
/// tillatte kant, så en korreksjon som ville drevet farge inn i en forbudssone
/// stoppes ved grensa i stedet.
struct ForbiddenZone: Equatable {
    /// Forbudte hue-intervaller i GRADER (atan2(b*, a*), −180…180). Kan wrappe rundt
    /// ±180 ved å bruke f.eks. 170…190 (tolkes modulo 360).
    var rangesDegrees: [ClosedRange<Double>]

    init(_ ranges: [ClosedRange<Double>] = []) { rangesDegrees = ranges }

    /// Normaliser en vinkel til (−180, 180].
    private static func norm(_ d: Double) -> Double {
        var x = d.truncatingRemainder(dividingBy: 360)
        if x <= -180 { x += 360 }
        if x > 180 { x -= 360 }
        return x
    }

    /// Er `hueDeg` inne i et forbudt intervall? (Håndterer wrap: lo>hi tolkes som
    /// intervall over ±180.)
    func contains(hueDeg: Double) -> Bool { enclosing(hueDeg: hueDeg) != nil }

    private func enclosing(hueDeg: Double) -> ClosedRange<Double>? {
        let h = Self.norm(hueDeg)
        for r in rangesDegrees {
            let lo = Self.norm(r.lowerBound), hi = Self.norm(r.upperBound)
            let inside = lo <= hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi)  // wrap
            if inside { return r }
        }
        return nil
    }

    /// Klem `(a, b)`: hvis hue ligger i en forbudssone, roter til NÆRMESTE tillatte
    /// kant (bevar chroma). Utenfor alle soner → uendret.
    func clamp(a: Double, b: Double) -> (a: Double, b: Double) {
        guard let r = enclosing(hueDeg: atan2(b, a) * 180 / .pi) else { return (a, b) }
        let chroma = (a * a + b * b).squareRoot()
        guard chroma > 1e-9 else { return (a, b) }
        let h = atan2(b, a) * 180 / .pi
        let lo = r.lowerBound, hi = r.upperBound
        // Avstand (grader) til hver kant, korteste vei rundt sirkelen. Skyv en liten
        // ε UTENFOR kanten så resultatet garantert er ute av (den lukkede) sona.
        func arc(_ x: Double, _ y: Double) -> Double { abs(Self.norm(x - y)) }
        let eps = 0.25
        let target = arc(h, lo) <= arc(h, hi) ? (lo - eps) : (hi + eps)
        let t = target * .pi / 180
        return (chroma * cos(t), chroma * sin(t))
    }
}
