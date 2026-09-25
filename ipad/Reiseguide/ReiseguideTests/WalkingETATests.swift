// WalkingETATests.swift
//
// Gangtid i kartlisten og på markørene (pakke 2, item 4): avstandsestimatet,
// cache-nøkkelens bucketing (samme sted+origo gjenbruker svaret), utvalget av
// hvilke steder som mangler et cachet svar, og tekstene (ekte vs. anslag).
// Ren logikk uten MapKit/bundle, se Core/Navigation/WalkingETA.swift.

import XCTest
@testable import Reiseguide

final class WalkingETATests: XCTestCase {
    private let origin = Coordinate(lat: 59.9075, lng: 10.7364)

    func testEstimateMinutesUsesAssumedWalkingSpeed() {
        // 130 m / 1,3 m/s = 100 s ≈ 2 min.
        XCTAssertEqual(WalkingETAEstimate.minutes(distanceM: 130), 2)
        // Under ett minutts gange rundes opp til minst 1 («0 min» hjelper ingen).
        XCTAssertEqual(WalkingETAEstimate.minutes(distanceM: 5), 1)
    }

    func testCacheKeySameForNearbyOrigins() {
        let a = WalkingETACacheKey(poiId: "poi-1", origin: origin)
        let nearbyOrigin = Coordinate(lat: origin.lat + 0.00001, lng: origin.lng)
        let b = WalkingETACacheKey(poiId: "poi-1", origin: nearbyOrigin)
        XCTAssertEqual(a, b, "under terskelen: samme bucket, cachet svar gjenbrukes")
    }

    func testCacheKeyDiffersAfterMovingPastThreshold() {
        let a = WalkingETACacheKey(poiId: "poi-1", origin: origin)
        // ~100 m nord, godt over minimumMoveM (50 m).
        let farOrigin = Coordinate(lat: origin.lat + 0.0009, lng: origin.lng)
        let b = WalkingETACacheKey(poiId: "poi-1", origin: farOrigin)
        XCTAssertNotEqual(a, b)
    }

    func testCacheKeyDiffersPerPoi() {
        let a = WalkingETACacheKey(poiId: "poi-1", origin: origin)
        let b = WalkingETACacheKey(poiId: "poi-2", origin: origin)
        XCTAssertNotEqual(a, b)
    }

    func testSelectionSkipsAlreadyCachedAndCapsAtLimit() {
        let pois = (0 ..< 12).map { makePoi(id: "poi-\($0)", latOffset: Double($0) * 0.0005) }
        let sorted = Geo.sortedByDistance(pois, from: origin)
        let cachedKeys: Set<WalkingETACacheKey> = [WalkingETACacheKey(poiId: "poi-0", origin: origin)]

        let candidates = WalkingETASelection.poisNeedingRequest(
            sortedByDistance: sorted, origin: origin, cachedKeys: cachedKeys, limit: 8
        )

        XCTAssertEqual(candidates.count, 8, "maks 8 kall selv med flere kandidater")
        XCTAssertFalse(candidates.contains { $0.id == "poi-0" }, "allerede cachet: spørres ikke om på nytt")
        XCTAssertEqual(candidates.first?.id, "poi-1", "nærmeste ikke-cachede sted først")
    }

    func testVisibleTextUsesEstimateKeyOnlyWhenEstimated() {
        let exact = WalkingETA(minutes: 6, isEstimate: false)
        let estimate = WalkingETA(minutes: 6, isEstimate: true)
        let localize: (String) -> String = { $0 }
        let formatMinutes: (Int) -> String = { "\($0) min" }

        XCTAssertEqual(WalkingETAText.visible(exact, localize: localize, formatMinutes: formatMinutes), "map.eta.walking")
        XCTAssertEqual(WalkingETAText.visible(estimate, localize: localize, formatMinutes: formatMinutes), "map.eta.walkingEstimate")
    }

    func testSpokenTextUsesEstimateKeyOnlyWhenEstimated() {
        let exact = WalkingETA(minutes: 6, isEstimate: false)
        let estimate = WalkingETA(minutes: 6, isEstimate: true)
        let localize: (String) -> String = { $0 }
        let formatMinutesSpoken: (Int) -> String = { "\($0) minutter" }

        XCTAssertEqual(WalkingETAText.spoken(exact, localize: localize, formatMinutesSpoken: formatMinutesSpoken), "map.eta.walkingSpoken")
        XCTAssertEqual(WalkingETAText.spoken(estimate, localize: localize, formatMinutesSpoken: formatMinutesSpoken), "map.eta.walkingEstimateSpoken")
    }

    // MARK: - Hjelpere

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
