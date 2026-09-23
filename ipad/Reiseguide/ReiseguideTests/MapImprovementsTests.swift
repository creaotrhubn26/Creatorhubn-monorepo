// MapImprovementsTests.swift
//
// Ren logikk bak kartforbedringene (Features/Map): besøkt/«neste stopp» på
// markørene, VoiceOver-oppsummeringen, kart/liste-standarden, throttling av
// gangrutekall, luftlinje som reserve og turruta i sortOrder. Ingen MapKit,
// Observation eller bundle-oppslag: strengene sendes inn som closure.
//
// Stedene lages ved å dekode JSON (som fra backend) i stedet for med
// memberwise-init, så testene tåler nye valgfrie felt på GuidePOI.

import XCTest
@testable import Reiseguide

final class MapImprovementsTests: XCTestCase {
    // MARK: - Besøkt og «neste stopp»

    func testMarksCompletedAsVisitedAndFirstUnvisitedAsNextStop() throws {
        let pois = try [makePoi(id: "c", sortOrder: 2), makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let markers = MapTourMarkers(pois: pois, completedIds: ["a"], visitedIds: ["a"])

        XCTAssertEqual(markers.status(for: "a"), MapMarkerStatus(isVisited: true, isNextStop: false))
        XCTAssertEqual(markers.status(for: "b"), MapMarkerStatus(isVisited: false, isNextStop: true))
        XCTAssertEqual(markers.status(for: "c"), MapMarkerStatus(isVisited: false, isNextStop: false))
    }

    func testNextStopMatchesVeiviserForStartedButUnfinishedPlace() throws {
        // "b" er startet (i loggen) men ikke fullført: ingen hake, og ikke
        // neste stopp heller, akkurat som veiviserens «neste sted».
        let pois = try [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1), makePoi(id: "c", sortOrder: 2)]
        let markers = MapTourMarkers(pois: pois, completedIds: ["a"], visitedIds: ["a", "b"])

        XCTAssertFalse(markers.status(for: "b").isVisited)
        XCTAssertFalse(markers.status(for: "b").isNextStop)
        XCTAssertEqual(markers.nextStopId, "c")
        XCTAssertEqual(markers.nextStopId, VeiviserTarget.resolve(.nextStop, pois: pois, visitedIds: ["a", "b"])?.id)
    }

    func testNextStopSkipsThePlaceThatIsPlaying() throws {
        let pois = try [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let markers = MapTourMarkers(pois: pois, completedIds: [], visitedIds: [], excludingId: "a")
        XCTAssertEqual(markers.nextStopId, "b")
    }

    func testNoNextStopWhenTourIsDone() throws {
        let pois = try [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let markers = MapTourMarkers(pois: pois, completedIds: ["a", "b"], visitedIds: ["a", "b"])
        XCTAssertNil(markers.nextStopId)
        XCTAssertTrue(markers.status(for: "a").isVisited)
        XCTAssertTrue(markers.status(for: "b").isVisited)
    }

    func testMarkerAccessibilityLabelSaysVisitedAndNextStop() {
        let visited = MapMarkerStatus(isVisited: true, isNextStop: false)
        XCTAssertEqual(visited.accessibilityLabel(title: "Akershus festning", distanceText: "300 m", localize: nb), "Akershus festning, 300 m, besøkt")

        let next = MapMarkerStatus(isVisited: false, isNextStop: true)
        XCTAssertEqual(next.accessibilityLabel(title: "Christiania torv", distanceText: nil, localize: nb), "Christiania torv, neste stopp")

        let plain = MapMarkerStatus(isVisited: false, isNextStop: false)
        XCTAssertEqual(plain.accessibilityLabel(title: "Rådhuset", distanceText: "1,2 km", localize: nb), "Rådhuset, 1,2 km")
    }

    // MARK: - VoiceOver-oppsummering

    func testSummaryCountsPlacesWithinRadiusAndNamesNearestWithDirection() throws {
        let pois = try [
            makePoi(id: "torv", sortOrder: 0, title: "Christiania torv", north: 60, east: 60),
            makePoi(id: "sor", sortOrder: 1, title: "Sør", north: -200, east: 0),
            makePoi(id: "vest", sortOrder: 2, title: "Vest", north: 0, east: -400),
            makePoi(id: "langt", sortOrder: 3, title: "Langt unna", north: 0, east: 900)
        ]
        let summary = MapAccessibilitySummary.make(pois: pois, origin: origin)

        XCTAssertEqual(summary.totalCount, 4)
        XCTAssertEqual(summary.countWithinRadius, 3)
        XCTAssertEqual(summary.nearest?.title, "Christiania torv")
        XCTAssertEqual(summary.nearest?.compassWordKey, "veiviser.compass.ne")
        XCTAssertEqual(try XCTUnwrap(summary.nearest?.distanceM), 85, accuracy: 2)

        let text = summary.text(localize: nb, formatDistance: { $0 == 500 ? "500 m" : "120 m" })
        XCTAssertEqual(text, "3 steder innen 500 m. Nærmeste: Christiania torv, 120 m nordøst.")
    }

    func testSummaryUsesSingularAndNone() throws {
        let one = try MapAccessibilitySummary.make(pois: [makePoi(id: "a", sortOrder: 0, title: "A", north: 0, east: 100)], origin: origin)
        XCTAssertEqual(one.text(localize: nb, formatDistance: { "\(Int($0.rounded())) m" }), "1 sted innen 500 m. Nærmeste: A, 100 m øst.")

        let none = try MapAccessibilitySummary.make(pois: [makePoi(id: "a", sortOrder: 0, title: "A", north: -1_000, east: 0)], origin: origin)
        XCTAssertEqual(none.countWithinRadius, 0)
        XCTAssertTrue(none.text(localize: nb, formatDistance: { "\(Int($0.rounded())) m" }).hasPrefix("Ingen steder innen 500 m. Nærmeste: A, "))
        XCTAssertTrue(none.text(localize: nb, formatDistance: { _ in "1 km" }).hasSuffix(" sør."))

        let empty = MapAccessibilitySummary.make(pois: [], origin: origin)
        XCTAssertEqual(empty.text(localize: nb, formatDistance: { _ in "500 m" }), "Ingen steder innen 500 m.")
    }

    func testSummaryWithoutLocationOnlyCountsPlaces() throws {
        let pois = try [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let summary = MapAccessibilitySummary.make(pois: pois, origin: nil)
        XCTAssertNil(summary.countWithinRadius)
        XCTAssertNil(summary.nearest)
        XCTAssertEqual(summary.text(localize: nb, formatDistance: { _ in "?" }), "Steder på kartet: 2. Slå på posisjon for å høre avstander.")
    }

    // MARK: - Kart eller liste

    func testListIsDefaultWithVoiceOverUntilUserChooses() {
        XCTAssertTrue(MapViewMode.showsList(storedChoice: nil, voiceOverRunning: true))
        XCTAssertFalse(MapViewMode.showsList(storedChoice: nil, voiceOverRunning: false))
        XCTAssertFalse(MapViewMode.showsList(storedChoice: false, voiceOverRunning: true))
        XCTAssertTrue(MapViewMode.showsList(storedChoice: true, voiceOverRunning: false))
    }

    @MainActor
    func testSettingsRememberMapOrListChoice() throws {
        let suite = "MapImprovementsTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let settings = AppSettings(defaults: defaults)
        XCTAssertNil(settings.mapShowsList)
        settings.mapShowsList = false
        XCTAssertEqual(AppSettings(defaults: defaults).mapShowsList, false)
        settings.mapShowsList = nil
        XCTAssertNil(AppSettings(defaults: defaults).mapShowsList)
    }

    // MARK: - Gangrute: throttling og reserve

    func testThrottleRequestsOnFirstCallSelectionChangeAndMovesOverFiftyMetres() {
        let first = WalkingRouteRequestKey(poiId: "a", origin: origin)
        XCTAssertTrue(WalkingRouteThrottle.shouldRequest(previous: nil, next: first))

        let movedLittle = WalkingRouteRequestKey(poiId: "a", origin: offset(origin, north: 30, east: 0))
        XCTAssertFalse(WalkingRouteThrottle.shouldRequest(previous: first, next: movedLittle))

        let movedFar = WalkingRouteRequestKey(poiId: "a", origin: offset(origin, north: 60, east: 0))
        XCTAssertTrue(WalkingRouteThrottle.shouldRequest(previous: first, next: movedFar))

        let otherPlace = WalkingRouteRequestKey(poiId: "b", origin: origin)
        XCTAssertTrue(WalkingRouteThrottle.shouldRequest(previous: first, next: otherPlace))
    }

    func testRouteLineFallsBackToStraightLineWithoutWalkingRoute() throws {
        let poi = try makePoi(id: "a", sortOrder: 0, north: 300, east: 0)
        XCTAssertNil(MapRouteLine.resolve(poi: poi, origin: nil, route: nil), "uten posisjon: ingen linje")
        XCTAssertNil(MapRouteLine.resolve(poi: nil, origin: origin, route: nil), "uten valgt sted: ingen linje")

        let otherRoute = WalkingRoute(poiId: "b", coordinates: [origin, poi.coordinate], expectedTravelTimeS: 240, distanceM: 350)
        let line = try XCTUnwrap(MapRouteLine.resolve(poi: poi, origin: origin, route: otherRoute))
        XCTAssertFalse(line.isWalkingRoute)
        XCTAssertNil(line.walkingTimeS)
        XCTAssertEqual(line.coordinates, [origin, poi.coordinate])
        XCTAssertEqual(line.distanceM, 300, accuracy: 2)
    }

    func testRouteLineUsesWalkingRouteForSelectedPlace() throws {
        let poi = try makePoi(id: "a", sortOrder: 0, north: 300, east: 0)
        let path = [origin, offset(origin, north: 150, east: 40), poi.coordinate]
        let route = WalkingRoute(poiId: "a", coordinates: path, expectedTravelTimeS: 348, distanceM: 420)
        let line = try XCTUnwrap(MapRouteLine.resolve(poi: poi, origin: origin, route: route))
        XCTAssertTrue(line.isWalkingRoute)
        XCTAssertEqual(line.coordinates, path)
        XCTAssertEqual(line.distanceM, 420)
        XCTAssertEqual(route.walkingMinutes, 6)
    }

    func testWalkingMinutesIsAtLeastOne() {
        XCTAssertEqual(WalkingRoute.wholeMinutes(seconds: 10), 1)
        XCTAssertEqual(WalkingRoute.wholeMinutes(seconds: 89), 1)
        XCTAssertEqual(WalkingRoute.wholeMinutes(seconds: 91), 2)
    }

    // MARK: - Turruta

    func testTourRouteFollowsSortOrder() throws {
        let a = try makePoi(id: "a", sortOrder: 0, north: 0, east: 0)
        let b = try makePoi(id: "b", sortOrder: 1, north: 100, east: 0)
        let c = try makePoi(id: "c", sortOrder: 2, north: 200, east: 0)
        XCTAssertEqual(TourRoute.coordinates([c, a, b]), [a.coordinate, b.coordinate, c.coordinate])
        XCTAssertEqual(TourRoute.coordinates([a]), [], "ett sted er ingen rute")
    }

    // MARK: - Hjelpere

    private let origin = Coordinate(lat: 59.91, lng: 10.74)

    /// Norske strenger slik de står i Localizable.xcstrings.
    private func nb(_ key: String) -> String {
        [
            "map.marker.visited": "besøkt",
            "map.marker.nextStop": "neste stopp",
            "map.summary.noLocation": "Steder på kartet: %@. Slå på posisjon for å høre avstander.",
            "map.summary.none": "Ingen steder innen %@.",
            "map.summary.one": "1 sted innen %@.",
            "map.summary.many": "%1$@ steder innen %2$@.",
            "map.summary.nearest": "Nærmeste: %1$@, %2$@ %3$@.",
            "veiviser.compass.ne": "Nordøst",
            "veiviser.compass.e": "Øst",
            "veiviser.compass.s": "Sør"
        ][key] ?? key
    }

    /// Flytter et punkt et antall meter nord/øst (nøyaktig nok på bykartskala).
    private func offset(_ coordinate: Coordinate, north: Double, east: Double) -> Coordinate {
        let metresPerDegreeLat = 111_195.0
        let metresPerDegreeLng = metresPerDegreeLat * cos(coordinate.lat * .pi / 180)
        return Coordinate(lat: coordinate.lat + north / metresPerDegreeLat, lng: coordinate.lng + east / metresPerDegreeLng)
    }

    private func makePoi(id: String, sortOrder: Int, title: String? = nil, north: Double = 0, east: Double = 0) throws -> GuidePOI {
        let point = offset(origin, north: north, east: east)
        let json: [String: Any] = [
            "id": id, "slug": id, "areaId": "area", "lat": point.lat, "lng": point.lng,
            "triggerRadiusM": 40, "priority": 0, "sortOrder": sortOrder, "freePreview": false,
            "title": title ?? id, "practicalInfo": [],
            "lang": ["requested": "nb", "resolved": "nb", "fallbackUsed": false, "autoTranslated": false, "available": ["nb"]],
            "variants": [String: Any]()
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        return try JSONDecoder().decode(GuidePOI.self, from: data)
    }
}
