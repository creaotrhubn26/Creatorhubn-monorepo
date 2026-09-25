// NearestUnlockedPOITests.swift
//
// «Spill nærmeste» (pakke 2, item 6): utvalget App Intent-en bruker. Låste
// steder hoppes over selv om de er nærmere, ingen kandidat gir nil (ikke en
// krasj eller en paywall fra Siri). PlayNearestPOIIntent.perform() selv er
// AppIntents-runtime og ikke enhetstestbart, se filens hode.

import XCTest
@testable import Reiseguide

final class NearestUnlockedPOITests: XCTestCase {
    private let origin = Coordinate(lat: 59.91, lng: 10.74)

    func testPicksNearestAmongUnlockedPlaces() {
        let near = makePoi(id: "near", latOffset: 0.0002)
        let nearer = makePoi(id: "nearer", latOffset: 0.0001)
        let result = NearestUnlockedPOI.find(pois: [near, nearer], from: origin, isLocked: { _ in false })
        XCTAssertEqual(result?.id, "nearer")
    }

    func testSkipsLockedPlacesEvenWhenCloser() {
        let lockedNear = makePoi(id: "locked", latOffset: 0.0001)
        let unlockedFarther = makePoi(id: "unlocked", latOffset: 0.0005)
        let result = NearestUnlockedPOI.find(
            pois: [lockedNear, unlockedFarther],
            from: origin,
            isLocked: { $0.id == "locked" }
        )
        XCTAssertEqual(result?.id, "unlocked")
    }

    func testReturnsNilWhenEverythingIsLocked() {
        let result = NearestUnlockedPOI.find(pois: [makePoi(id: "a", latOffset: 0.0001)], from: origin, isLocked: { _ in true })
        XCTAssertNil(result)
    }

    func testReturnsNilWithoutAnyPlaces() {
        XCTAssertNil(NearestUnlockedPOI.find(pois: [], from: origin, isLocked: { _ in false }))
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
