// TourModeControllerTests.swift
//
// Tur-modus (pakke 2, item 3): den rene tilstandsovergangstabellen
// (TourModeReducer, ingen avhengigheter) og kontrolleren rundt den — «Start
// tur» finner første stopp og persisterer, fullførte besøk går videre til
// neste stopp eller avslutter touren, og områdebytte avslutter en tur som
// gjaldt et annet område. Bruker TourProgress.nextStop under panseret, så
// dette speiler den vanlige «neste stopp»-logikken som resten av appen bruker.

import XCTest
@testable import Reiseguide

final class TourModeControllerTests: XCTestCase {
    // MARK: - TourModeReducer (ren tilstandsovergang)

    func testStartedWithFirstStopGoesToWalking() {
        let next = TourModeReducer.reduce(state: .idle, event: .started(firstStopId: "a"))
        XCTAssertEqual(next, .walking(poiId: "a"))
    }

    func testStartedWithoutAStopCompletesImmediately() {
        let next = TourModeReducer.reduce(state: .idle, event: .started(firstStopId: nil))
        XCTAssertEqual(next, .completed)
    }

    func testArrivedMovesToAtStop() {
        let next = TourModeReducer.reduce(state: .walking(poiId: "a"), event: .arrived(poiId: "a"))
        XCTAssertEqual(next, .atStop(poiId: "a"))
    }

    func testPlaybackStartedMovesToPlaying() {
        let next = TourModeReducer.reduce(state: .atStop(poiId: "a"), event: .playbackStarted(poiId: "a"))
        XCTAssertEqual(next, .playing(poiId: "a"))
    }

    func testEndedAlwaysGoesToIdle() {
        XCTAssertEqual(TourModeReducer.reduce(state: .playing(poiId: "a"), event: .ended), .idle)
        XCTAssertEqual(TourModeReducer.reduce(state: .completed, event: .ended), .idle)
    }

    // MARK: - TourModeController

    @MainActor
    func testStartFindsFirstUnvisitedStopAndPersists() throws {
        let (controller, settings, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]

        let first = controller.start(areaSlug: "oslo", route: route, completedPoiIds: ["a"])

        XCTAssertEqual(first?.id, "b")
        XCTAssertTrue(controller.isActive)
        XCTAssertEqual(controller.currentPoiId, "b")
        XCTAssertEqual(settings.activeTourAreaSlug, "oslo")
    }

    @MainActor
    func testStartWithEverythingAlreadyVisitedReturnsNil() throws {
        let (controller, _, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let route = [makePoi(id: "a", sortOrder: 0)]

        let first = controller.start(areaSlug: "oslo", route: route, completedPoiIds: ["a"])

        XCTAssertNil(first)
        XCTAssertTrue(controller.isActive, "touren regnes fortsatt som aktiv (for området), bare uten et neste stopp")
        XCTAssertNil(controller.currentPoiId)
    }

    @MainActor
    func testVisitCompletedAdvancesToNextStop() throws {
        let (controller, _, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        controller.start(areaSlug: "oslo", route: route, completedPoiIds: [])

        controller.noteVisitCompletedIfNew(poiId: "a", route: route, completedPoiIds: ["a"])

        XCTAssertEqual(controller.currentPoiId, "b")
        XCTAssertTrue(controller.isActive)
    }

    @MainActor
    func testVisitCompletedIsIgnoredWhenAlreadyProcessed() throws {
        let (controller, _, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let route = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1), makePoi(id: "c", sortOrder: 2)]
        controller.start(areaSlug: "oslo", route: route, completedPoiIds: [])
        controller.noteVisitCompletedIfNew(poiId: "a", route: route, completedPoiIds: ["a"])
        XCTAssertEqual(controller.currentPoiId, "b")

        // Besøksloggen endrer seg av en annen grunn (stjerner), samme fullførte sted rapporteres igjen.
        controller.noteVisitCompletedIfNew(poiId: "a", route: route, completedPoiIds: ["a"])
        XCTAssertEqual(controller.currentPoiId, "b", "allerede behandlet: ingen endring")
    }

    @MainActor
    func testLastStopCompletedEndsTheTour() throws {
        let (controller, settings, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let route = [makePoi(id: "a", sortOrder: 0)]
        controller.start(areaSlug: "oslo", route: route, completedPoiIds: [])

        controller.noteVisitCompletedIfNew(poiId: "a", route: route, completedPoiIds: ["a"])

        XCTAssertFalse(controller.isActive)
        XCTAssertNil(controller.currentPoiId)
        XCTAssertNil(settings.activeTourAreaSlug)
    }

    @MainActor
    func testAreaChangeEndsATourThatBelongedToAnotherArea() throws {
        let (controller, _, suite) = try makeController()
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        controller.start(areaSlug: "oslo", route: [makePoi(id: "a", sortOrder: 0)], completedPoiIds: [])

        controller.endIfAreaChanged(to: "oslo")
        XCTAssertTrue(controller.isActive, "samme område: touren fortsetter")

        controller.endIfAreaChanged(to: "bergen")
        XCTAssertFalse(controller.isActive, "byttet område: touren i det gamle området avsluttes")
    }

    @MainActor
    func testControllerResumesFromPersistedSettingOnInit() throws {
        let suite = "TourModeControllerTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let settings = AppSettings(defaults: defaults)
        settings.activeTourAreaSlug = "oslo"

        let resumed = TourModeController(settings: settings)
        XCTAssertTrue(resumed.isActive)
        XCTAssertEqual(resumed.activeAreaSlug, "oslo")
    }

    // MARK: - Hjelpere

    @MainActor
    private func makeController() throws -> (TourModeController, AppSettings, String) {
        let suite = "TourModeControllerTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        let settings = AppSettings(defaults: defaults)
        return (TourModeController(settings: settings), settings, suite)
    }

    private func makePoi(id: String, sortOrder: Int) -> GuidePOI {
        GuidePOI(
            id: id, slug: id, areaId: "area", categoryId: nil, lat: 59.91, lng: 10.74,
            triggerRadiusM: 30, priority: 0, sortOrder: sortOrder, freePreview: false,
            heroImageUrl: nil, heroImageAlt: nil, title: id, subtitle: nil, summary: nil, locationLabel: nil,
            practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
