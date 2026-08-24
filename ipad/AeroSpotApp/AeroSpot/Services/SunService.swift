// SunService.swift — solposisjon og soltider (NOAA-formler).
// Porta 1:1 fra web-implementasjonens SunService.ts (13 tester grønne der).

import Foundation
import CoreLocation

enum SunService {
    private static let dayMs = 86_400_000.0
    private static let j1970 = 2440588.0
    private static let j2000 = 2451545.0
    private static let obliquity = rad(23.4397)
    private static let j0 = 0.0009

    private static func rad(_ deg: Double) -> Double { deg * .pi / 180 }

    private static func toJulian(_ date: Date) -> Double {
        date.timeIntervalSince1970 * 1000 / dayMs - 0.5 + j1970
    }
    private static func fromJulian(_ j: Double) -> Date {
        Date(timeIntervalSince1970: (j + 0.5 - j1970) * dayMs / 1000)
    }
    private static func toDays(_ date: Date) -> Double { toJulian(date) - j2000 }

    private static func solarMeanAnomaly(_ d: Double) -> Double {
        rad(357.5291 + 0.98560028 * d)
    }
    private static func eclipticLongitude(_ m: Double) -> Double {
        let c1 = rad(1.9148) * sin(m)
        let c2 = rad(0.02) * sin(2 * m)
        let c3 = rad(0.0003) * sin(3 * m)
        return m + c1 + c2 + c3 + rad(102.9372) + .pi
    }
    private static func declination(_ l: Double) -> Double {
        asin(sin(l) * sin(obliquity))
    }
    private static func rightAscension(_ l: Double) -> Double {
        atan2(sin(l) * cos(obliquity), cos(l))
    }
    private static func siderealTime(_ d: Double, _ lw: Double) -> Double {
        rad(280.16 + 360.9856235 * d) - lw
    }

    static func position(date: Date, coordinate: CLLocationCoordinate2D) -> (azimuthDeg: Double, elevationDeg: Double) {
        let lw = (-coordinate.longitude).degToRad
        let phi = coordinate.latitude.degToRad
        let d = toDays(date)
        let m = solarMeanAnomaly(d)
        let l = eclipticLongitude(m)
        let dec = declination(l)
        let ra = rightAscension(l)
        let h = siderealTime(d, lw) - ra

        let elevation = asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(h))
        let azimuth = atan2(sin(h), cos(h) * sin(phi) - tan(dec) * cos(phi)) + .pi
        return ((azimuth.radToDeg + 360).truncatingRemainder(dividingBy: 360), elevation.radToDeg)
    }

    private static func julianCycle(_ d: Double, _ lw: Double) -> Double {
        (d - j0 - lw / (2 * .pi)).rounded()
    }
    private static func approxTransit(_ ht: Double, _ lw: Double, _ n: Double) -> Double {
        j0 + (ht + lw) / (2 * .pi) + n
    }
    private static func solarTransitJ(_ ds: Double, _ m: Double, _ l: Double) -> Double {
        j2000 + ds + 0.0053 * sin(m) - 0.0069 * sin(2 * l)
    }
    private static func hourAngle(_ h: Double, _ phi: Double, _ dec: Double) -> Double {
        acos((sin(h) - sin(phi) * sin(dec)) / (cos(phi) * cos(dec)))
    }

    /// Tidspunkt solen krysser gitt elevasjon; stigende (morgen) eller settende.
    static func timeAtElevation(
        date: Date,
        coordinate: CLLocationCoordinate2D,
        elevationDeg: Double,
        rising: Bool
    ) -> Date? {
        let lw = (-coordinate.longitude).degToRad
        let phi = coordinate.latitude.degToRad
        let d = toDays(date)
        let n = julianCycle(d, lw)
        let ds = approxTransit(0, lw, n)
        let m = solarMeanAnomaly(ds)
        let l = eclipticLongitude(m)
        let dec = declination(l)
        let jnoon = solarTransitJ(ds, m, l)
        let w = hourAngle(elevationDeg.degToRad, phi, dec)
        guard w.isFinite else { return nil } // midnattssol / polarnatt
        let jset = solarTransitJ(approxTransit(w, lw, n), m, l)
        return fromJulian(rising ? jnoon - (jset - jnoon) : jset)
    }

    static func times(date: Date, coordinate: CLLocationCoordinate2D) -> SunTimes {
        let now = position(date: date, coordinate: coordinate)
        return SunTimes(
            sunrise: timeAtElevation(date: date, coordinate: coordinate, elevationDeg: -0.833, rising: true),
            sunset: timeAtElevation(date: date, coordinate: coordinate, elevationDeg: -0.833, rising: false),
            goldenHourStart: timeAtElevation(date: date, coordinate: coordinate, elevationDeg: 6, rising: false),
            blueHourStart: timeAtElevation(date: date, coordinate: coordinate, elevationDeg: -4, rising: false),
            azimuthDeg: now.azimuthDeg,
            elevationDeg: now.elevationDeg
        )
    }

    enum LightQuality: String {
        case excellent, good, fair, poor
    }

    /// Lyskvalitet gitt solretning vs fotograferingsretning.
    static func lightQuality(
        sunAzimuthDeg: Double,
        sunElevationDeg: Double,
        shootingDirectionDeg: Double
    ) -> (quality: LightQuality, label: String) {
        if sunElevationDeg < -4 { return (.poor, "Mørkt") }
        let relative = abs(
            ((sunAzimuthDeg - shootingDirectionDeg).truncatingRemainder(dividingBy: 360) + 540)
                .truncatingRemainder(dividingBy: 360) - 180
        )
        if relative < 45 { return (.poor, "Motlys") }
        if relative < 100 { return (.excellent, "Sidelys") }
        if relative < 145 { return (.good, "Skrått frontlys") }
        return (.good, "Frontlys")
    }
}
