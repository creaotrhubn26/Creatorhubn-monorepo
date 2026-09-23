// CompassDirection.swift
//
// Ren matte for veiviseren (pakke 2, item 5): relativ vinkel, klokkeslett
// («klokka 2») og kompassord («nordøst»). Ingen avhengighet til CoreLocation
// eller Observation, så alt kan enhetstestes med tall alene. Selve
// kompassretningen (bearing) ligger i Geo.bearingDegrees — denne fila tar
// bearing + retning enheten peker (heading) og gjør det om til noe en bruker
// kan handle på, med eller uten et pålitelig kompass.

import Foundation

enum CompassDirection {
    /// Normaliserer en vinkel til [0, 360).
    static func normalizedDegrees(_ degrees: Double) -> Double {
        let wrapped = degrees.truncatingRemainder(dividingBy: 360)
        return wrapped < 0 ? wrapped + 360 : wrapped
    }

    /// Retning til målet minus retningen enheten peker, normalisert til
    /// (-180, 180]: positiv = målet er til høyre, negativ = til venstre.
    static func relativeAngleDegrees(bearingDegrees: Double, headingDegrees: Double) -> Double {
        var delta = (bearingDegrees - headingDegrees).truncatingRemainder(dividingBy: 360)
        if delta > 180 { delta -= 360 }
        if delta <= -180 { delta += 360 }
        return delta
    }

    /// Klokkeslett 1–12 for en relativ vinkel: 0° = 12 (rett fram),
    /// 90° = 3 (til høyre), -90°/270° = 9 (til venstre).
    static func clockBucket(relativeAngleDegrees angle: Double) -> Int {
        let normalized = normalizedDegrees(angle)
        let hour = Int((normalized / 30).rounded()) % 12
        return hour == 0 ? 12 : hour
    }

    /// Er enheten pekt mot målet innenfor toleransen (for lett haptikk)?
    static func isPointingAtTarget(relativeAngleDegrees angle: Double, toleranceDegrees: Double = 15) -> Bool {
        abs(angle) <= toleranceDegrees
    }

    /// Én av åtte himmelretninger for en absolutt kompassretning, som
    /// nøkkel i Localizable.xcstrings (`veiviser.compass.*`) — brukes når
    /// enheten ikke har (pålitelig) retningssensor.
    static func compassWordKey(bearingDegrees: Double) -> String {
        let normalized = normalizedDegrees(bearingDegrees)
        let index = Int((normalized / 45).rounded()) % 8
        return Self.compassWordKeys[index]
    }

    static let compassWordKeys = [
        "veiviser.compass.n", "veiviser.compass.ne", "veiviser.compass.e", "veiviser.compass.se",
        "veiviser.compass.s", "veiviser.compass.sw", "veiviser.compass.w", "veiviser.compass.nw"
    ]
}
