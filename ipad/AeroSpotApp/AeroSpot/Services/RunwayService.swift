// RunwayService.swift — vind-basert rullebane-anbefaling.
// ESTIMAT, ikke ATC-beslutning — UI merker det.

import Foundation

enum RunwayService {
    static func recommend(airport: Airport, weather: Weather) -> RunwayRecommendation {
        struct Candidate { let id: String; let heading: Double }
        let candidates = airport.runways.flatMap { rwy in
            [
                Candidate(id: rwy.id, heading: rwy.headingDeg),
                Candidate(id: rwy.reciprocal, heading: (rwy.headingDeg + 180).truncatingRemainder(dividingBy: 360)),
            ]
        }

        var best = candidates[0]
        var bestHeadwind = -Double.infinity
        for c in candidates {
            let diff = Geo.angleDiffDeg(weather.windDirectionDeg, c.heading)
            let headwind = Double(weather.windSpeedKt) * cos(diff.degToRad)
            if headwind > bestHeadwind {
                bestHeadwind = headwind
                best = c
            }
        }

        let confidence: Double
        let reason: String
        if weather.windSpeedKt < 4 {
            confidence = 0.5
            reason = "Svak vind (\(weather.windSpeedKt) kt) — preferert baneretning antas"
        } else {
            confidence = min(0.95, 0.55 + (bestHeadwind / Double(weather.windSpeedKt)) * 0.4)
            reason = "Vind \(Int(weather.windDirectionDeg))° / \(weather.windSpeedKt) kt gir \(Int(bestHeadwind)) kt motvind for \(best.id)"
        }

        return RunwayRecommendation(runway: best.id, confidence: confidence, reason: reason)
    }
}
