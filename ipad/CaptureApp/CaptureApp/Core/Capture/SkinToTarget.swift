import Foundation

/// Fase 2 (adaptiv redigering): korriger målt hud-CAST mot hud-tone-linjen, på
/// device, MELANIN-BEVARENDE. Ment påført MASKET til hud (fjæret matte fra
/// ``GuidedFilter``), aldri globalt.
///
/// 🔒 SIKKERHETS-INVARIANT (matematisk, ikke policy-tekst): korreksjonen er en ren
/// PERPENDIKULÆR forskyvning i a*/b*-planet — den flytter huden mot linja langs
/// retningen VINKELRETT på linja, og rører ALDRI komponenten LANGS linja (melanin-
/// aksen) eller L* (som ikke er i a*/b* i det hele tatt). Dermed kan systemet
/// verken lysne eller mørkne hud, uansett hva treningsdataene sier — dekomponert i
/// (langs, ⊥) med langs-komponenten låst til 0.
///
/// Hud-linja (hue 49°, empirisk kalibrert fra 726 ansikter i faktiske leveranser,
/// 5 bryllup, sør-asiatisk + nordisk — hue er nær-konstant på tvers av etnisitet,
/// mens METNING/chroma varierer; derfor rører vi IKKE chroma). Dempet: alltid
/// HALVVEIS mot linja, aldri hele — samme filosofi som resten av pipelinen.
/// Deterministisk (ren funksjon).
enum SkinToTarget {

    /// Perpendikulær a*/b*-forskyvning som flytter målt hud mot linja. `identity` =
    /// ingen endring (for grå til å ha pålitelig hue → ikke rør).
    struct Correction: Equatable {
        var da: Double
        var db: Double
        static let identity = Correction(da: 0, db: 0)
    }

    /// Beregn den melanin-bevarende cast-korreksjonen fra MÅLT hud-snitt `(a, b)`
    /// (LAB, nøytral = 0). `strength` = hvor langt mot linja (0.5 = halvveis).
    /// Kappet til `maxShift`. Under `minChroma` → identity.
    static func correction(measuredA a: Double, measuredB b: Double,
                           targetHueDegrees: Double = 49, strength: Double = 0.5,
                           maxShift: Double = 8, minChroma: Double = 3) -> Correction {
        let chroma = (a * a + b * b).squareRoot()
        guard chroma >= minChroma else { return .identity }
        let t = targetHueDegrees * .pi / 180
        let ux = cos(t), uy = sin(t)                 // enhetsvektor LANGS linja
        let along = a * ux + b * uy                  // projeksjon på linja (melanin)
        let perpA = a - along * ux                   // avvik ⊥ linja = CASTen
        let perpB = b - along * uy
        var da = -perpA * strength                   // dra mot linja (dempet)
        var db = -perpB * strength
        let mag = (da * da + db * db).squareRoot()
        if mag > maxShift { let s = maxShift / mag; da *= s; db *= s }
        return Correction(da: da, db: db)
    }

    /// Påfør korreksjonen på ett a*/b*-par: ren translasjon → LANGS-komponenten
    /// (melanin) og L* er uendret per konstruksjon. Dette er per-piksel-matten
    /// CIImage-filteret vil implementere innenfor hud-masken.
    static func applied(a: Double, b: Double, _ c: Correction) -> (a: Double, b: Double) {
        (a + c.da, b + c.db)
    }

    /// Sikkerhets-sonde (for tester/CI): endringen LANGS hud-linja som korreksjonen
    /// medfører. Skal være ~0 for enhver input — beviser at melanin-aksen bevares.
    static func alongLineChange(_ c: Correction, targetHueDegrees: Double = 49) -> Double {
        let t = targetHueDegrees * .pi / 180
        return c.da * cos(t) + c.db * sin(t)
    }
}
