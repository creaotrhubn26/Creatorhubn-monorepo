// ProximityMonitorTests.swift
//
// «Du er framme» (SenseAid Explore pakke 1, punkt 1): valg av sted (høyest
// prioritet, så nærmest), armering over to påfølgende posisjoner, hysterese
// ved kanten og at et sted høyst varsles én gang per økt. Ren logikk uten UI.

import XCTest
@testable import Reiseguide

final class ProximityMonitorTests: XCTestCase {
    /// To severdigheter 5 m fra hverandre, radius 30 m: begge dekker origo.
    private let near = Coordinate(lat: 59.9075, lng: 10.7364)

    func testRequiresTwoConsecutiveFixesBeforeArriving() {
        var monitor = ProximityMonitor()
        let pois = [makePoi(id: "a", lat: near.lat, lng: near.lng, radius: 30)]

        XCTAssertNil(monitor.update(coordinate: near, pois: pois), "første treff armerer bare")
        XCTAssertEqual(monitor.update(coordinate: near, pois: pois), "a", "andre påfølgende treff utløser ankomst")
    }

    func testConsecutiveCountResetsWhenUserStepsOutBeforeArming() {
        var monitor = ProximityMonitor()
        let poi = makePoi(id: "a", lat: near.lat, lng: near.lng, radius: 30)
        let far = Coordinate(lat: near.lat + 0.01, lng: near.lng)

        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]))
        XCTAssertNil(monitor.update(coordinate: far, pois: [poi]), "utenfor radiusen: armeringen nullstilles")
        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]), "må telle to nye påfølgende treff")
        XCTAssertEqual(monitor.update(coordinate: near, pois: [poi]), "a")
    }

    func testFiresOnlyOncePerPoiPerSession() {
        var monitor = ProximityMonitor()
        let poi = makePoi(id: "a", lat: near.lat, lng: near.lng, radius: 30)
        let outsideHysteresis = Coordinate(lat: near.lat + 0.01, lng: near.lng)

        _ = monitor.update(coordinate: near, pois: [poi])
        XCTAssertEqual(monitor.update(coordinate: near, pois: [poi]), "a")

        // Forlater hysteresesonen og kommer tilbake: armeres på nytt, men varsles ikke igjen.
        XCTAssertNil(monitor.update(coordinate: outsideHysteresis, pois: [poi]))
        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]))
        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]), "allerede varslet denne økten")
    }

    func testHysteresisKeepsPoiDockedUntilOutsideOneAndAHalfRadius() {
        var monitor = ProximityMonitor()
        // Radius 40 m: hysteresegrensen er 60 m.
        let poi = makePoi(id: "a", lat: near.lat, lng: near.lng, radius: 40)
        // ~50 m unna: utenfor triggerRadiusM, men innenfor 1,5×.
        let edge = Coordinate(lat: near.lat + 0.00045, lng: near.lng)

        _ = monitor.update(coordinate: near, pois: [poi])
        XCTAssertEqual(monitor.update(coordinate: near, pois: [poi]), "a")
        XCTAssertEqual(monitor.dockedPoiId, "a")

        XCTAssertNil(monitor.update(coordinate: edge, pois: [poi]), "fortsatt innenfor 1,5× radius: forblir ved stedet")
        XCTAssertEqual(monitor.dockedPoiId, "a")
    }

    func testHigherPriorityWinsOverDistanceWhenBothWithinRadius() {
        var monitor = ProximityMonitor()
        let closerLowPriority = makePoi(id: "low", lat: near.lat, lng: near.lng, radius: 50, priority: 0)
        let fartherHighPriority = makePoi(id: "high", lat: near.lat + 0.0002, lng: near.lng, radius: 50, priority: 5)
        let pois = [closerLowPriority, fartherHighPriority]

        _ = monitor.update(coordinate: near, pois: pois)
        XCTAssertEqual(monitor.update(coordinate: near, pois: pois), "high", "høyere prioritet vinner selv om den er lenger unna")
    }

    func testNearestWinsWhenPriorityIsEqual() {
        var monitor = ProximityMonitor()
        let closer = makePoi(id: "closer", lat: near.lat, lng: near.lng, radius: 50)
        let farther = makePoi(id: "farther", lat: near.lat + 0.0002, lng: near.lng, radius: 50)
        let pois = [farther, closer]

        _ = monitor.update(coordinate: near, pois: pois)
        XCTAssertEqual(monitor.update(coordinate: near, pois: pois), "closer")
    }

    func testNoCandidateOutsideAnyRadius() {
        var monitor = ProximityMonitor()
        let poi = makePoi(id: "a", lat: near.lat + 1, lng: near.lng, radius: 30)
        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]))
        XCTAssertNil(monitor.update(coordinate: near, pois: [poi]))
    }

    // MARK: - Hjelpere

    private func makePoi(id: String, lat: Double, lng: Double, radius: Int, priority: Int = 0) -> GuidePOI {
        GuidePOI(
            id: id, slug: id, areaId: "area", categoryId: nil, lat: lat, lng: lng,
            triggerRadiusM: radius, priority: priority, sortOrder: 0, freePreview: false,
            heroImageUrl: nil, heroImageAlt: nil, title: id, subtitle: nil, summary: nil, locationLabel: nil,
            practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
