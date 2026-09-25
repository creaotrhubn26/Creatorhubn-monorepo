// TourProgressTests.swift
//
// Turprogresjon (SenseAid Explore pakke 1, punkt 3): ruten er området sine
// severdigheter i sortOrder, besøkt er fullførte besøk i loggen. Ren logikk
// uten UI eller Observation.

import XCTest
@testable import Reiseguide

final class TourProgressTests: XCTestCase {
    func testCountsOnlyCompletedVisitsWithinTheRoute() {
        let pois = [
            makePoi(id: "a", sortOrder: 0),
            makePoi(id: "b", sortOrder: 1),
            makePoi(id: "c", sortOrder: 2)
        ]
        // "b" er fullført, "z" er fra et annet område og teller ikke med.
        let completed: Set<String> = ["b", "z"]

        let progress = TourProgress.compute(pois: pois, completedPoiIds: completed)
        XCTAssertEqual(progress.visitedCount, 1)
        XCTAssertEqual(progress.total, 3)
        XCTAssertFalse(progress.isComplete)
        XCTAssertEqual(progress.fraction, 1.0 / 3.0, accuracy: 0.0001)
    }

    func testIsCompleteWhenEveryPlaceIsVisited() {
        let pois = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let progress = TourProgress.compute(pois: pois, completedPoiIds: ["a", "b"])
        XCTAssertTrue(progress.isComplete)
        XCTAssertEqual(progress.fraction, 1)
    }

    func testEmptyRouteIsNotComplete() {
        let progress = TourProgress.compute(pois: [], completedPoiIds: [])
        XCTAssertEqual(progress.total, 0)
        XCTAssertEqual(progress.visitedCount, 0)
        XCTAssertFalse(progress.isComplete, "et tomt område skal ikke telle som fullført")
        XCTAssertEqual(progress.fraction, 0)
    }

    func testOrderedRouteFollowsSortOrder() {
        let pois = [makePoi(id: "c", sortOrder: 2), makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        XCTAssertEqual(TourProgress.orderedRoute(pois).map(\.id), ["a", "b", "c"])
    }

    // MARK: - «Gå til neste stopp» (avspiller-redesignet, punkt 2)

    func testNextStopPicksTheFollowingUncompletedPlaceInRouteOrder() {
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1), makePoi(id: "c", sortOrder: 2)]
        XCTAssertEqual(TourProgress.nextStop(after: "a", in: route, completedPoiIds: ["a"])?.id, "b")
    }

    func testNextStopSkipsAlreadyCompletedPlacesAfterCurrent() {
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1), makePoi(id: "c", sortOrder: 2)]
        XCTAssertEqual(TourProgress.nextStop(after: "a", in: route, completedPoiIds: ["a", "b"])?.id, "c")
    }

    func testNextStopFallsBackToFirstUncompletedWhenNothingFollows() {
        // "a" er sist i ruten og fullført; "b" tidligere i ruten er ikke det ennå.
        let route = [makePoi(id: "b", sortOrder: 0), makePoi(id: "a", sortOrder: 1)]
        XCTAssertEqual(TourProgress.nextStop(after: "a", in: route, completedPoiIds: ["a"])?.id, "b")
    }

    func testNextStopIsNilWhenEverythingIsCompleted() {
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        XCTAssertNil(TourProgress.nextStop(after: "a", in: route, completedPoiIds: ["a", "b"]))
    }

    func testNextStopIsNilForAnEmptyRoute() {
        XCTAssertNil(TourProgress.nextStop(after: "a", in: [], completedPoiIds: []))
    }

    func testNextStopFallsBackToFirstUncompletedWhenCurrentIsUnknown() {
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        XCTAssertEqual(TourProgress.nextStop(after: nil, in: route, completedPoiIds: [])?.id, "a")
    }

    @MainActor
    func testTrackerShowsCelebrationOnceWhenTourJustCompleted() {
        let tracker = TourProgressTracker()
        let area = makeArea()
        let pois = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]

        tracker.evaluate(area: area, pois: pois, completedPoiIds: ["a"])
        XCTAssertNil(tracker.celebration, "ikke fullført ennå")

        tracker.evaluate(area: area, pois: pois, completedPoiIds: ["a", "b"])
        XCTAssertEqual(tracker.celebration?.id, area.id)

        tracker.dismissCelebration()
        tracker.evaluate(area: area, pois: pois, completedPoiIds: ["a", "b"])
        XCTAssertNil(tracker.celebration, "vises ikke igjen samme økt")
    }

    // MARK: - Hjelpere

    private func makePoi(id: String, sortOrder: Int) -> GuidePOI {
        GuidePOI(
            id: id, slug: id, areaId: "area", categoryId: nil, lat: 59.9, lng: 10.7,
            triggerRadiusM: 40, priority: 0, sortOrder: sortOrder, freePreview: false,
            heroImageUrl: nil, heroImageAlt: nil, title: id, subtitle: nil, summary: nil, locationLabel: nil,
            practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }

    private func makeArea() -> GuideArea {
        GuideArea(
            id: "area", slug: "area", name: "Testområdet", defaultLang: "nb",
            center: Coordinate(lat: 59.9, lng: 10.7),
            bbox: BoundingBox(south: 59.8, west: 10.6, north: 60.0, east: 10.8),
            priceNok: nil, languages: ["nb"], poiCount: 2
        )
    }
}
