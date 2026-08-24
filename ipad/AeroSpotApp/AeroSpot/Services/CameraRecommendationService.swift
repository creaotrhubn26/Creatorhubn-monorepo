// CameraRecommendationService.swift — regelbasert eksponerings-anbefaling
// for flyfoto. Tar aviation-data + miljø + live kamera-state (CCAPI) og
// returnerer anbefaling + differ. Porta fra web-versjonen.

import Foundation

enum CameraRecommendationService {
    struct Input {
        var aircraftSpeedKt: Int?
        var aircraftDistanceKm: Double?
        var sunElevationDeg: Double?
        var cloudCoverPct: Int?
        var current: CameraSettingsSnapshot?
        var lensRange: ClosedRange<Int>?
        /// Kamerahusets crop-faktor (1.0 fullformat, 1.6 APS-C Canon …).
        /// På crop-hus gir samme objektiv-mm mer rekkevidde.
        var cropFactor: Double = 1.0
        var mode: PhotographyMode
    }

    struct Output {
        let recommendation: CameraRecommendation
        let differences: [CameraSettingDifference]
    }

    /// Estimert brennvidde (fullformat) for å fylle ~60% av rammen.
    static func estimateFocalLengthMm(distanceKm: Double, aircraftLengthM: Double = 45) -> Int {
        let sensorWidthMm = 36.0
        let targetFraction = 0.6
        let focal = sensorWidthMm * distanceKm * 1000 / (aircraftLengthM / targetFraction)
        return Int(min(800, max(24, focal)).rounded())
    }

    private static func shutterSeconds(_ s: String) -> Double? {
        if s.hasPrefix("1/"), let d = Double(s.dropFirst(2)) { return d > 0 ? 1 / d : nil }
        return Double(s.replacingOccurrences(of: "s", with: ""))
    }

    private static func shutterForSpeed(speedKt: Int, distanceKm: Double) -> String {
        let angular = Double(speedKt) / max(0.5, distanceKm)
        if angular > 250 { return "1/2000" }
        if angular > 120 { return "1/1600" }
        if angular > 60 { return "1/1250" }
        return "1/1000"
    }

    static func recommend(_ input: Input) -> Output {
        var shutter: String
        var aperture: String
        var iso: String
        var explanationParts: [String] = []

        switch input.mode {
        case .freeze:
            shutter = "1/1000"
            aperture = "f/5.6"
            iso = "400"
            explanationParts.append("Rask lukker fryser jetfly skarpt. Servo AF og burst anbefales.")
        case .panning:
            shutter = "1/125"
            aperture = "f/8"
            iso = "Auto"
            explanationParts.append("Følg flyet jevnt gjennom søkeren og fortsett bevegelsen etter eksponeringen.")
        case .propeller:
            shutter = "1/160"
            aperture = "f/8"
            iso = "Auto"
            explanationParts.append("Lukkertid rundt 1/160 gir propell-blur — frossen propell ser unaturlig ut.")
        case .night:
            shutter = "1/60"
            aperture = "f/2.8"
            iso = "3200"
            explanationParts.append("Åpen blender og høy ISO. Panorer med flyet for å redde lukkertiden.")
        }

        if input.mode == .freeze, let speed = input.aircraftSpeedKt {
            shutter = shutterForSpeed(speedKt: speed, distanceKm: input.aircraftDistanceKm ?? 3)
        }

        // Lysjustering av ISO (kun numerisk ISO)
        if let isoNum = Int(iso), let sunElev = input.sunElevationDeg {
            let cloud = input.cloudCoverPct ?? 0
            if sunElev < 5 || cloud > 80 {
                iso = String(min(3200, isoNum * 4))
                explanationParts.append("Lite lys — ISO hevet.")
            } else if sunElev > 25, cloud < 40 {
                iso = String(max(100, isoNum / 2))
                explanationParts.append("Godt lys — ISO senket.")
            }
        }

        // Brennvidde. estimateFocalLengthMm gir fullformat-ekvivalent behov;
        // på crop-hus trengs mindre faktisk mm (deler på crop-faktor).
        var focalRange = 100...400
        if let dist = input.aircraftDistanceKm {
            let idealEquivalent = estimateFocalLengthMm(distanceKm: dist)
            let crop = max(1.0, input.cropFactor)
            let idealActual = Int(Double(idealEquivalent) / crop)
            var lo = max(24, Int(Double(idealActual) * 0.8))
            var hi = min(800, Int(Double(idealActual) * 1.15))
            if let lens = input.lensRange {
                lo = max(lo, lens.lowerBound)
                hi = min(hi, lens.upperBound)
                if lo > hi {
                    lo = lens.upperBound
                    hi = lens.upperBound
                    explanationParts.append("Flyet krever mer rekkevidde enn objektivet ditt — beskjær i etterkant.")
                }
            }
            focalRange = lo...max(lo, hi)
            if crop > 1.0 {
                explanationParts.append("Ca. \(idealActual) mm på ditt \(String(format: "%.1f", crop))×-hus (\(idealEquivalent) mm ekvivalent).")
            } else {
                explanationParts.append("Ca. \(idealEquivalent) mm på fullformat fra denne avstanden.")
            }
        }

        // Differ mot kameraets faktiske innstillinger
        var differences: [CameraSettingDifference] = []
        if let current = input.current {
            if let curShutter = current.shutterSpeed,
               let curS = shutterSeconds(curShutter),
               let recS = shutterSeconds(shutter),
               abs(log2(curS / recS)) >= 0.5 {
                differences.append(CameraSettingDifference(
                    setting: "shutterSpeed",
                    recommended: shutter,
                    current: curShutter,
                    message: curS > recS
                        ? "Lukkeren er for treg — risiko for bevegelsesuskarphet."
                        : "Lukkeren er raskere enn nødvendig — koster ISO/støy."
                ))
            }
            if let curIsoStr = current.iso, let curIso = Int(curIsoStr),
               let recIso = Int(iso),
               abs(log2(Double(curIso) / Double(recIso))) >= 1 {
                differences.append(CameraSettingDifference(
                    setting: "iso",
                    recommended: iso,
                    current: curIsoStr,
                    message: curIso > recIso
                        ? "ISO er høyere enn nødvendig — mer støy enn du trenger."
                        : "ISO er lav — sjekk at lukkertiden holder."
                ))
            }
            if let focal = current.focalLengthMm,
               focal < Int(Double(focalRange.lowerBound) * 0.85)
               || focal > Int(Double(focalRange.upperBound) * 1.15) {
                differences.append(CameraSettingDifference(
                    setting: "focalLength",
                    recommended: "\(focalRange.lowerBound)–\(focalRange.upperBound) mm",
                    current: "\(focal) mm",
                    message: focal < focalRange.lowerBound
                        ? "Zoom inn — flyet blir lite i rammen."
                        : "Zoom ut — du risikerer å klippe vingene."
                ))
            }
        }

        return Output(
            recommendation: CameraRecommendation(
                shutterSpeed: shutter,
                aperture: aperture,
                iso: iso,
                focalRange: focalRange,
                explanation: explanationParts.joined(separator: " ")
            ),
            differences: differences
        )
    }

    /// Parse "RF100-500mm F4.5-7.1 L IS USM" → 100...500
    static func parseLensRange(_ lensName: String?) -> ClosedRange<Int>? {
        guard let name = lensName else { return nil }
        let zoomPattern = /(\d{2,4})-(\d{2,4})\s?mm/
        if let match = name.firstMatch(of: zoomPattern),
           let lo = Int(match.1), let hi = Int(match.2) {
            return lo...hi
        }
        let primePattern = /(\d{2,4})\s?mm/
        if let match = name.firstMatch(of: primePattern), let mm = Int(match.1) {
            return mm...mm
        }
        return nil
    }
}
