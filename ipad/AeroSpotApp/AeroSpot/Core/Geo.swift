// Geo.swift — haversine, bearing, kompass. Speiler web-implementasjonen.

import Foundation
import CoreLocation

enum Geo {
    static let earthRadiusKm = 6371.0

    static func distanceKm(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let dLat = (b.latitude - a.latitude).degToRad
        let dLng = (b.longitude - a.longitude).degToRad
        let h = pow(sin(dLat / 2), 2)
            + cos(a.latitude.degToRad) * cos(b.latitude.degToRad) * pow(sin(dLng / 2), 2)
        return 2 * earthRadiusKm * asin(sqrt(h))
    }

    /// Kompass-bearing fra a til b, 0–360°
    static func bearingDeg(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let y = sin((b.longitude - a.longitude).degToRad) * cos(b.latitude.degToRad)
        let x = cos(a.latitude.degToRad) * sin(b.latitude.degToRad)
            - sin(a.latitude.degToRad) * cos(b.latitude.degToRad)
            * cos((b.longitude - a.longitude).degToRad)
        return (atan2(y, x).radToDeg + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Minste vinkelavstand mellom to kompassretninger, 0–180°
    static func angleDiffDeg(_ a: Double, _ b: Double) -> Double {
        let d = abs((a - b).truncatingRemainder(dividingBy: 360))
        return d > 180 ? 360 - d : d
    }

    static func compassLabel(_ deg: Double) -> String {
        let labels = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"]
        let index = Int((deg / 45).rounded()) % 8
        return labels[index]
    }
}

extension Double {
    var degToRad: Double { self * .pi / 180 }
    var radToDeg: Double { self * 180 / .pi }
}
