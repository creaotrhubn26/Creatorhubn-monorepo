// AreaSelectionTests.swift
//
// Flere områder (Lørenskog, Nesoddtangen, Oslo): valg av nærmeste område,
// reserven når posisjonen er ukjent eller langt unna, at brukerens eget valg
// vinner og huskes i AppSettings, og at AreaStore bytter område og viser
// cachet innhold for det nye området uten nett.

import XCTest
@testable import Reiseguide

final class AreaSelectionTests: XCTestCase {
    private let oslo = makeArea(slug: AreaStore.demoAreaSlug, name: "Oslo", lat: 59.9075, lng: 10.7413, poiCount: 6)
    private let lorenskog = makeArea(slug: "lorenskog", name: "Lørenskog", lat: 59.9270, lng: 10.9580, poiCount: 4)
    private let nesoddtangen = makeArea(slug: "nesoddtangen", name: "Nesoddtangen", lat: 59.8530, lng: 10.6580, poiCount: 1)

    private var all: [GuideArea] { [oslo, lorenskog, nesoddtangen] }

    // MARK: - Nærmeste område

    func testPicksNearestAreaToUser() {
        let atLorenskogStation = Coordinate(lat: 59.9290, lng: 10.9500)
        let atNesoddtangenPier = Coordinate(lat: 59.8560, lng: 10.6620)
        let atOperaen = Coordinate(lat: 59.9075, lng: 10.7530)

        XCTAssertEqual(AreaSelection.nearest(to: atLorenskogStation, in: all)?.slug, "lorenskog")
        XCTAssertEqual(AreaSelection.nearest(to: atNesoddtangenPier, in: all)?.slug, "nesoddtangen")
        XCTAssertEqual(AreaSelection.nearest(to: atOperaen, in: all)?.slug, AreaStore.demoAreaSlug)
    }

    func testNoNearestAreaWhenUserIsFarAway() {
        let bergen = Coordinate(lat: 60.3913, lng: 5.3221)
        XCTAssertNil(AreaSelection.nearest(to: bergen, in: all))
    }

    func testResolveUsesNearestWhenNothingIsChosen() {
        let nearLorenskog = Coordinate(lat: 59.9300, lng: 10.9600)
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: all, location: nearLorenskog), "lorenskog")
    }

    // MARK: - Reserve

    func testFallsBackToOsloWithoutLocation() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: all, location: nil), AreaStore.demoAreaSlug)
    }

    func testFallsBackToOsloWhenUserIsFarAway() {
        let tromso = Coordinate(lat: 69.6496, lng: 18.9560)
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: all, location: tromso), AreaStore.demoAreaSlug)
    }

    func testFallsBackToOsloWhenAreasCouldNotBeFetched() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: [], location: nil), AreaStore.demoAreaSlug)
    }

    func testSingleAreaBackendKeepsTheExistingFlow() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: [oslo], location: nil), AreaStore.demoAreaSlug)
        let nearLorenskog = Coordinate(lat: 59.9300, lng: 10.9600)
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: [oslo], location: nearLorenskog), AreaStore.demoAreaSlug)
    }

    func testUsesFirstAreaWhenBackendHasNoOsloArea() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: nil, areas: [nesoddtangen, lorenskog], location: nil), "nesoddtangen")
    }

    // MARK: - Brukerens valg

    func testStoredChoiceWinsOverLocation() {
        let atOperaen = Coordinate(lat: 59.9075, lng: 10.7530)
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: "lorenskog", areas: all, location: atOperaen), "lorenskog")
    }

    func testStoredChoiceIsKeptOffline() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: "nesoddtangen", areas: [], location: nil), "nesoddtangen")
    }

    func testStoredChoiceRemovedFromBackendFallsBack() {
        XCTAssertEqual(AreaSelection.resolveSlug(storedSlug: "fjernet-omrade", areas: all, location: nil), AreaStore.demoAreaSlug)
    }

    func testPickerShowsCurrentAreaWhenListIsUnavailable() {
        XCTAssertEqual(AreaSelection.pickerAreas(fetched: [], current: lorenskog).map(\.slug), ["lorenskog"])
        XCTAssertEqual(AreaSelection.pickerAreas(fetched: all, current: lorenskog).count, 3)
        XCTAssertTrue(AreaSelection.pickerAreas(fetched: [], current: nil).isEmpty)
    }

    func testPlacesKeyIsSingularOnlyForOne() {
        XCTAssertEqual(AreaSelection.placesKey(count: 1), "area.places.one")
        XCTAssertEqual(AreaSelection.placesKey(count: 0), "area.places.other")
        XCTAssertEqual(AreaSelection.placesKey(count: 4), "area.places.other")
    }

    @MainActor
    func testSettingsRememberSelectedArea() throws {
        let suite = "AreaSelectionTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let settings = AppSettings(defaults: defaults)
        XCTAssertNil(settings.selectedAreaSlug, "ingenting er valgt ved første oppstart")
        settings.selectedAreaSlug = "lorenskog"
        XCTAssertEqual(AppSettings(defaults: defaults).selectedAreaSlug, "lorenskog")
        settings.selectedAreaSlug = nil
        XCTAssertNil(AppSettings(defaults: defaults).selectedAreaSlug)
    }

    // MARK: - AreaStore bytter område

    @MainActor
    func testStoreSwitchesSlugAndShowsCachedContentForNewArea() throws {
        let cacheDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("AreaSelectionTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: cacheDirectory) }

        let fixtureURL = try XCTUnwrap(Bundle(for: AreaSelectionTests.self).url(forResource: "area-nb", withExtension: "json"))
        let fixture = try Data(contentsOf: fixtureURL)
        try fixture.write(to: cacheDirectory.appendingPathComponent(AreaStore.cacheFileName(slug: "lorenskog", lang: "nb")))

        let store = AreaStore(areaSlug: AreaStore.demoAreaSlug, cacheDirectory: cacheDirectory)
        XCTAssertEqual(store.slug, AreaStore.demoAreaSlug)

        store.select(slug: "lorenskog", lang: "nb")
        XCTAssertEqual(store.slug, "lorenskog")
        guard case let .loaded(_, fromCache) = store.state else {
            return XCTFail("cachet innhold for det nye området skal vises med én gang")
        }
        XCTAssertTrue(fromCache)
        XCTAssertFalse(store.pois.isEmpty)

        store.select(slug: "nesoddtangen", lang: "nb")
        XCTAssertEqual(store.state, .loading, "uten cache for det nye området vises «laster», ikke det gamle området")
        XCTAssertTrue(store.pois.isEmpty)
    }
}

private func makeArea(slug: String, name: String, lat: Double, lng: Double, poiCount: Int) -> GuideArea {
    GuideArea(
        id: "id-\(slug)", slug: slug, name: name, defaultLang: "nb",
        center: Coordinate(lat: lat, lng: lng),
        bbox: BoundingBox(south: lat - 0.01, west: lng - 0.02, north: lat + 0.01, east: lng + 0.02),
        priceNok: nil, languages: ["nb", "en"], poiCount: poiCount
    )
}
