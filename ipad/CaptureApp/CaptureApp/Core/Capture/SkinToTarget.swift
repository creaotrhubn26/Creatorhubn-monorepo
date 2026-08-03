import Foundation

/// Fase 2 (adaptiv redigering): nudge MÅLT hud mot HUD-TONE-LINJEN (memory-color),
/// på device — porten av Python-treneren sin `skin_line_correct`, men ment påført
/// MASKET til hud (fjæret matte fra ``GuidedFilter``), ikke globalt, så grønt/blått/
/// treverk ikke roteres med. All hud (uansett etnisitet) klumper langs ~samme hue-
/// akse i a*/b*-planet; etnisitet endrer mest METNING (radius), ikke hue. Derfor:
/// roter hue-en mot linjen (dempet, klemt), og la metningen stort sett være — bare
/// dra ekstreme verdier mot et naturlig chroma-bånd.
///
/// Ren matte (a*/b* i LAB, nøytral = 0) → deterministisk + testbar. CIImage-/maske-
/// påføringen er wiring-steget.
enum SkinToTarget {

    /// Rotasjon (radianer) + chroma-skala som skal påføres a*/b* for å flytte hud mot
    /// linjen. `identity` = ingen endring (brukes når huden er for grå til å ha en
    /// pålitelig hue).
    struct Correction: Equatable {
        var rotationRadians: Double
        var chromaScale: Double
        static let identity = Correction(rotationRadians: 0, chromaScale: 1)
    }

    /// Beregn korreksjonen fra målt hud-chroma `(a, b)` (LAB, nøytral=0). Dempet
    /// rotasjon mot `targetHueDegrees` (klemt til ±`maxRotationDegrees`), og chroma
    /// dratt inn i `chromaRange` (mykt, pow 0.5). Under `minChroma` → identity.
    ///
    /// Standard hue ~45° er hud-linja i a*/b*-planet (jf. vectorscope ~123°/+I);
    /// bør feltjusteres mot ekte hud. Rotasjonen er BEGRENSET + dempet med vilje —
    /// dette er en korreksjon, ikke en tvangs-nøytralisering.
    static func correction(a: Double, b: Double,
                           targetHueDegrees: Double = 45,
                           maxRotationDegrees: Double = 8, damping: Double = 0.7,
                           chromaRange: ClosedRange<Double> = 12...26,
                           minChroma: Double = 3) -> Correction {
        let chroma = (a * a + b * b).squareRoot()
        guard chroma >= minChroma else { return .identity }
        let hue = atan2(b, a) * 180 / .pi
        // Korteste vei rundt sirkelen, så f.eks. 179°→−179° blir +2°, ikke −358°.
        var dHue = targetHueDegrees - hue
        while dHue > 180 { dHue -= 360 }
        while dHue < -180 { dHue += 360 }
        dHue = min(maxRotationDegrees, max(-maxRotationDegrees, dHue)) * damping
        let targetC = min(chromaRange.upperBound, max(chromaRange.lowerBound, chroma))
        let scale = pow(min(1.12, max(0.88, targetC / chroma)), 0.5)
        return Correction(rotationRadians: dHue * .pi / 180, chromaScale: scale)
    }

    /// Påfør en korreksjon på ett a*/b*-par: roter + skaler. Dette er per-piksel-
    /// matten CIImage-filteret vil implementere (innenfor hud-masken).
    static func applied(a: Double, b: Double, _ c: Correction) -> (a: Double, b: Double) {
        let cosT = cos(c.rotationRadians), sinT = sin(c.rotationRadians)
        let ra = (a * cosT - b * sinT) * c.chromaScale
        let rb = (a * sinT + b * cosT) * c.chromaScale
        return (ra, rb)
    }
}
