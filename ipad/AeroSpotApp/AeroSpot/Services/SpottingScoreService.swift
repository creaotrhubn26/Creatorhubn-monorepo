// SpottingScoreService.swift — AeroSpot-score per spottepunkt.
// Vekter samlet i Weights så justering ikke rører beregningen.

import Foundation
import CoreLocation

enum SpottingScoreService {
    private enum Weights {
        static let light = 0.28
        static let wind = 0.14
        static let visibility = 0.18
        static let traffic = 0.20
        static let position = 0.20
    }

    private static func qualityScore(_ q: SunService.LightQuality) -> Double {
        switch q {
        case .excellent: return 95
        case .good: return 78
        case .fair: return 55
        case .poor: return 25
        }
    }

    static func score(
        location: SpottingLocation,
        weather: Weather,
        sun: SunTimes,
        runway: RunwayRecommendation,
        trafficCount: Int,
        userCoordinate: CLLocationCoordinate2D?
    ) -> SpottingRecommendation {
        let light = SunService.lightQuality(
            sunAzimuthDeg: sun.azimuthDeg,
            sunElevationDeg: sun.elevationDeg,
            shootingDirectionDeg: location.shootingDirectionDeg
        )
        let lightScore = qualityScore(light.quality)

        let windScore = weather.windSpeedKt <= 15
            ? 90.0
            : max(30, 90 - Double(weather.windSpeedKt - 15) * 4)

        let visibilityScore = min(95, weather.visibilityKm / 10 * 95)
        let trafficScore = min(96, 30 + Double(trafficCount) * 3)

        let runwayMatch = location.runwayIds.contains { id in
            id == runway.runway
                || OSLData.airport.runways.contains { $0.id == id && $0.reciprocal == runway.runway }
        }
        var positionScore: Double = runwayMatch ? 92 : 45
        if let user = userCoordinate, Geo.distanceKm(user, location.coordinate) > 30 {
            positionScore -= 15
        }

        let total = lightScore * Weights.light
            + windScore * Weights.wind
            + visibilityScore * Weights.visibility
            + trafficScore * Weights.traffic
            + positionScore * Weights.position

        let explanation = [
            "\(light.label) fra \(Int(sun.azimuthDeg))°.",
            runwayMatch
                ? "\(runway.runway) er sannsynlig aktiv bane — punktet dekker den."
                : "Aktiv bane \(runway.runway) dekkes ikke optimalt herfra.",
            weather.visibilityKm >= 10 ? "God sikt." : "Sikt \(Int(weather.visibilityKm)) km.",
        ].joined(separator: " ")

        return SpottingRecommendation(
            location: location,
            score: SpottingScore(
                light: Int(lightScore.rounded()),
                wind: Int(windScore.rounded()),
                visibility: Int(visibilityScore.rounded()),
                traffic: Int(trafficScore.rounded()),
                position: Int(positionScore.rounded()),
                total: Int(total.rounded())
            ),
            explanation: explanation
        )
    }

    static func rank(
        locations: [SpottingLocation],
        weather: Weather,
        sun: SunTimes,
        runway: RunwayRecommendation,
        trafficCount: Int,
        userCoordinate: CLLocationCoordinate2D?
    ) -> [SpottingRecommendation] {
        locations
            .map {
                score(
                    location: $0, weather: weather, sun: sun, runway: runway,
                    trafficCount: trafficCount, userCoordinate: userCoordinate
                )
            }
            .sorted { $0.score.total > $1.score.total }
    }
}
