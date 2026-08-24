// AeroSpotServiceTests.swift — sanity-checks for domain-logikken.
// Speiler web-versjonens vitest-suite (13 grønne der).

import XCTest
import CoreLocation
@testable import AeroSpot

final class AeroSpotServiceTests: XCTestCase {
    private let osl = OSLData.airport.coordinate

    private func weather(windDir: Double = 20, windKt: Int = 11) -> Weather {
        Weather(
            temperatureC: 17, windDirectionDeg: windDir, windSpeedKt: windKt,
            gustKt: nil, visibilityKm: 10, cloudCoverPct: 40,
            precipitationMmH: 0, pressureHpa: 1016, symbol: nil,
            fetchedAtIso: "2026-08-19T10:00:00Z"
        )
    }

    func testDistanceOsloGardermoen() {
        let oslo = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)
        let d = Geo.distanceKm(oslo, osl)
        XCTAssertTrue(d > 30 && d < 50)
    }

    func testAngleDiffWrap() {
        XCTAssertEqual(Geo.angleDiffDeg(350, 10), 20, accuracy: 0.001)
    }

    func testSunPositionSummerNoon() {
        let date = ISO8601DateFormatter().date(from: "2026-06-21T11:00:00Z")!
        let pos = SunService.position(date: date, coordinate: osl)
        XCTAssertTrue(pos.azimuthDeg > 140 && pos.azimuthDeg < 220)
        XCTAssertTrue(pos.elevationDeg > 45)
    }

    func testSunriseBeforeSunset() {
        let date = ISO8601DateFormatter().date(from: "2026-08-19T10:00:00Z")!
        let times = SunService.times(date: date, coordinate: osl)
        XCTAssertNotNil(times.sunrise)
        XCTAssertNotNil(times.sunset)
        XCTAssertLessThan(times.sunrise!, times.sunset!)
    }

    func testLightQuality() {
        XCTAssertEqual(
            SunService.lightQuality(sunAzimuthDeg: 180, sunElevationDeg: 20, shootingDirectionDeg: 180).quality,
            .poor
        )
        XCTAssertEqual(
            SunService.lightQuality(sunAzimuthDeg: 90, sunElevationDeg: 20, shootingDirectionDeg: 180).quality,
            .excellent
        )
    }

    func testRunwayNorthWind() {
        let rec = RunwayService.recommend(airport: OSLData.airport, weather: weather())
        XCTAssertTrue(["01L", "01R"].contains(rec.runway))
        XCTAssertGreaterThan(rec.confidence, 0.7)
    }

    func testRunwaySouthWind() {
        let rec = RunwayService.recommend(airport: OSLData.airport, weather: weather(windDir: 190))
        XCTAssertTrue(["19R", "19L"].contains(rec.runway))
    }

    func testRarity() {
        XCTAssertEqual(RarityService.classify(aircraftIcao: "B738", callsign: nil), .common)
        XCTAssertEqual(RarityService.classify(aircraftIcao: "A388", callsign: nil), .veryRare)
        XCTAssertEqual(RarityService.classify(aircraftIcao: "A124", callsign: nil), .legendary)
    }

    func testMilitaryDetection() {
        // Callsign-mønster
        XCTAssertTrue(RarityService.isMilitary(hex: nil, callsign: "RCH485"))
        XCTAssertTrue(RarityService.isMilitary(hex: nil, callsign: "NATO01"))
        XCTAssertFalse(RarityService.isMilitary(hex: nil, callsign: "SAS1472"))
        // Hex-range (US military-blokk)
        XCTAssertTrue(RarityService.isMilitary(hex: "ae1234", callsign: nil))
        XCTAssertFalse(RarityService.isMilitary(hex: "4aca79", callsign: nil))
        // Militær → veryRare
        XCTAssertEqual(RarityService.classify(aircraftIcao: nil, callsign: "RCH485"), .veryRare)
    }

    func testApproachCorridorGeometry() {
        let corridor = OSLData.airport.approachCorridor(for: "01L")
        XCTAssertNotNil(corridor)
        XCTAssertEqual(corridor?.count, 3) // apex + to hjørner
    }

    func testAirportCatalog() {
        // Minst 5 flyplasser, hver med spottepunkter
        XCTAssertGreaterThanOrEqual(AirportCatalog.all.count, 5)
        for entry in AirportCatalog.all {
            XCTAssertFalse(entry.spots.isEmpty, "\(entry.airport.iata) mangler spottepunkter")
            XCTAssertFalse(entry.airport.runways.isEmpty)
        }
        XCTAssertEqual(AirportCatalog.entry(icao: "ENBR").airport.iata, "BGO")
        XCTAssertEqual(AirportCatalog.entry(icao: "UKJENT").airport.icao, "ENGM") // fallback
    }

    func testFocalLengthGrowsWithDistance() {
        XCTAssertGreaterThan(
            CameraRecommendationService.estimateFocalLengthMm(distanceKm: 4),
            CameraRecommendationService.estimateFocalLengthMm(distanceKm: 1)
        )
    }

    func testShutterDiffDetected() {
        let out = CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftSpeedKt: 300,
                aircraftDistanceKm: 2,
                sunElevationDeg: nil,
                cloudCoverPct: nil,
                current: CameraSettingsSnapshot(shutterSpeed: "1/250", aperture: nil, iso: "400"),
                lensRange: nil,
                mode: .freeze
            )
        )
        XCTAssertTrue(out.differences.contains { $0.setting == "shutterSpeed" })
    }

    func testGearClampsFocalToOwnedLens() {
        // Fly 2.5 km unna krever ~800 mm. Med bare 100–500mm skal
        // anbefalingen klippes til 500 og be om beskjæring.
        let out = CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftDistanceKm: 2.5,
                current: nil,
                lensRange: 100...500,
                cropFactor: 1.0,
                mode: .freeze
            )
        )
        XCTAssertLessThanOrEqual(out.recommendation.focalRange.upperBound, 500)
        XCTAssertTrue(out.recommendation.explanation.contains("beskjær"))
    }

    func testCropFactorReducesRequiredFocal() {
        let full = CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftDistanceKm: 5, current: nil, lensRange: 100...600,
                cropFactor: 1.0, mode: .freeze
            )
        ).recommendation.focalRange.upperBound
        let crop = CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftDistanceKm: 5, current: nil, lensRange: 100...600,
                cropFactor: 1.6, mode: .freeze
            )
        ).recommendation.focalRange.upperBound
        // På crop-hus trengs mindre faktisk mm for samme rekkevidde.
        XCTAssertLessThan(crop, full)
    }

    func testLensRangeParsing() {
        XCTAssertEqual(
            CameraRecommendationService.parseLensRange("RF100-500mm F4.5-7.1 L IS USM"),
            100...500
        )
        XCTAssertEqual(CameraRecommendationService.parseLensRange("RF 400mm F2.8"), 400...400)
        XCTAssertNil(CameraRecommendationService.parseLensRange(nil))
    }

    func testSpottingScoreRanking() {
        let date = ISO8601DateFormatter().date(from: "2026-08-19T08:00:00Z")!
        let sun = SunService.times(date: date, coordinate: osl)
        let runway = RunwayService.recommend(airport: OSLData.airport, weather: weather())
        let ranked = SpottingScoreService.rank(
            locations: OSLData.spottingLocations,
            weather: weather(),
            sun: sun,
            runway: runway,
            trafficCount: 20,
            userCoordinate: nil
        )
        XCTAssertEqual(ranked.count, OSLData.spottingLocations.count)
        XCTAssertTrue(ranked[0].score.total >= ranked.last!.score.total)
    }
}
