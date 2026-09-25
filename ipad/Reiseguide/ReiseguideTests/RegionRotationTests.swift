// RegionRotationTests.swift
//
// Bakgrunnsvarselet (pakke 2, item 2): nærmeste-20-utvalget (CLLocationManager
// sin grense for samtidig regionovervåking) og når settet bør regnes på nytt
// (bare når brukeren har beveget seg nok — regionoppsett er dyrt). Ren logikk
// uten CoreLocation, se Core/Navigation/RegionRotation.swift.

import XCTest
@testable import Reiseguide

final class RegionRotationTests: XCTestCase {
    private let origin = Coordinate(lat: 59.91, lng: 10.74)

    func testNearestPoisCapsAtTwenty() {
        let pois = (0 ..< 30).map { makePoi(id: "poi-\($0)", latOffset: Double($0) * 0.0002) }
        let nearest = RegionRotation.nearestPois(pois, from: origin)
        XCTAssertEqual(nearest.count, RegionRotation.maxMonitoredRegions)
        XCTAssertEqual(nearest.first?.id, "poi-0", "nærmeste først")
        XCTAssertEqual(nearest.last?.id, "poi-19")
    }

    func testNearestPoisReturnsFewerWhenAreaIsSmall() {
        let pois = (0 ..< 3).map { makePoi(id: "poi-\($0)", latOffset: Double($0) * 0.0002) }
        XCTAssertEqual(RegionRotation.nearestPois(pois, from: origin).count, 3)
    }

    func testShouldRecomputeOnFirstCall() {
        XCTAssertTrue(RegionRotation.shouldRecompute(previousOrigin: nil, newOrigin: origin))
    }

    func testShouldNotRecomputeForSmallMovement() {
        let nearby = Coordinate(lat: origin.lat + 0.0005, lng: origin.lng) // ~55 m
        XCTAssertFalse(RegionRotation.shouldRecompute(previousOrigin: origin, newOrigin: nearby))
    }

    func testShouldRecomputeAfterMovingPastThreshold() {
        let farAway = Coordinate(lat: origin.lat + 0.01, lng: origin.lng) // ~1,1 km
        XCTAssertTrue(RegionRotation.shouldRecompute(previousOrigin: origin, newOrigin: farAway))
    }

    private func makePoi(id: String, latOffset: Double) -> GuidePOI {
        GuidePOI(
            id: id, slug: id, areaId: "area", categoryId: nil, lat: origin.lat + latOffset, lng: origin.lng,
            triggerRadiusM: 30, priority: 0, sortOrder: 0, freePreview: false,
            heroImageUrl: nil, heroImageAlt: nil, title: id, subtitle: nil, summary: nil, locationLabel: nil,
            practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
