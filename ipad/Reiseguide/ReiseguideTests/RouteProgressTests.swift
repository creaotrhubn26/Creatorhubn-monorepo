// RouteProgressTests.swift
//
// Turn-by-turn i veiviseren (pakke 2, item 1): hvilket steg brukeren er på,
// framgang mot neste manøver, av-rute-deteksjon (Geo.distanceToSegmentM) og
// gjentaksdemping av reroute-varsel (OffRouteRerouteGate). Ren logikk uten
// CoreLocation/MapKit, syntetiske koordinater på bykartskala.

import XCTest
@testable import Reiseguide

final class RouteProgressTests: XCTestCase {
    private let origin = Coordinate(lat: 59.91, lng: 10.74)

    /// To steg rett nordover: 0→100 m, så 100→200 m.
    private func twoStraightSteps() -> [WalkingRouteStep] {
        [
            WalkingRouteStep(instructions: "Gå nordover", distanceM: 100, coordinates: [origin, offset(origin, north: 100, east: 0)]),
            WalkingRouteStep(instructions: "Sving til høyre", distanceM: 100, coordinates: [
                offset(origin, north: 100, east: 0), offset(origin, north: 200, east: 0)
            ])
        ]
    }

    func testStaysOnFirstStepUntilNearItsEnd() {
        let steps = twoStraightSteps()
        // Midt i første steg: fortsatt steg 0.
        let progress = RouteProgress.update(coordinate: offset(origin, north: 50, east: 0), steps: steps, previousStepIndex: 0)
        XCTAssertEqual(progress.currentStepIndex, 0)
        XCTAssertEqual(progress.distanceToManeuverM, 50, accuracy: 2)
        XCTAssertFalse(progress.isOffRoute)
    }

    func testAdvancesToNextStepWithinArrivalRadius() {
        let steps = twoStraightSteps()
        // 10 m fra slutten av steg 0 (under arrivalRadiusM = 15): hopper til steg 1.
        let nearEndOfStepOne = offset(origin, north: 90, east: 0)
        let progress = RouteProgress.update(coordinate: nearEndOfStepOne, steps: steps, previousStepIndex: 0)
        XCTAssertEqual(progress.currentStepIndex, 1, "innenfor ankomstradius: går videre til neste manøver")
    }

    func testNeverJumpsBackToAnEarlierStep() {
        let steps = twoStraightSteps()
        // Brukeren er allerede på steg 1; et GPS-hopp tilbake til starten skal ikke gå tilbake til steg 0.
        let progress = RouteProgress.update(coordinate: origin, steps: steps, previousStepIndex: 1)
        XCTAssertEqual(progress.currentStepIndex, 1)
    }

    func testOffRouteWhenFarFromCurrentStepPolyline() {
        let steps = twoStraightSteps()
        // 60 m rett øst for midten av steg 0: langt fra linja (over terskelen på 30 m).
        let farEast = offset(origin, north: 50, east: 60)
        let progress = RouteProgress.update(coordinate: farEast, steps: steps, previousStepIndex: 0)
        XCTAssertTrue(progress.isOffRoute)
    }

    func testNotOffRouteCloseToPolyline() {
        let steps = twoStraightSteps()
        let closeEast = offset(origin, north: 50, east: 5)
        let progress = RouteProgress.update(coordinate: closeEast, steps: steps, previousStepIndex: 0)
        XCTAssertFalse(progress.isOffRoute)
    }

    func testEmptyStepsReturnsNeutralProgress() {
        let progress = RouteProgress.update(coordinate: origin, steps: [], previousStepIndex: 3)
        XCTAssertEqual(progress.currentStepIndex, 0)
        XCTAssertFalse(progress.isOffRoute)
    }

    // MARK: - OffRouteRerouteGate

    func testRerouteGateRequiresConsecutiveOffRouteReadings() {
        var gate = OffRouteRerouteGate()
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertTrue(gate.update(isOffRoute: true), "tredje påfølgende av-rute-avlesning trigger reroute")
    }

    func testRerouteGateResetsWhenBackOnRoute() {
        var gate = OffRouteRerouteGate()
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertFalse(gate.update(isOffRoute: false), "tilbake på ruta: telleren nullstilles")
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertTrue(gate.update(isOffRoute: true))
    }

    func testRerouteGateFiresAgainAfterFiring() {
        var gate = OffRouteRerouteGate()
        for _ in 0 ..< 3 { _ = gate.update(isOffRoute: true) }
        XCTAssertFalse(gate.update(isOffRoute: true), "telleren ble nullstilt etter forrige varsel")
        XCTAssertFalse(gate.update(isOffRoute: true))
        XCTAssertTrue(gate.update(isOffRoute: true))
    }

    // MARK: - Geo.distanceToSegmentM

    func testDistanceToSegmentIsZeroOnTheLine() {
        let midpoint = offset(origin, north: 50, east: 0)
        let distance = Geo.distanceToSegmentM(point: midpoint, segmentStart: origin, segmentEnd: offset(origin, north: 100, east: 0))
        XCTAssertEqual(distance, 0, accuracy: 0.5)
    }

    func testDistanceToSegmentClampsToEndpoints() {
        // Punkt langt forbi enden av linjestykket: avstanden er til sluttpunktet, ikke til en uendelig linje.
        let farPastEnd = offset(origin, north: 300, east: 0)
        let end = offset(origin, north: 100, east: 0)
        let distance = Geo.distanceToSegmentM(point: farPastEnd, segmentStart: origin, segmentEnd: end)
        XCTAssertEqual(distance, 200, accuracy: 2)
    }

    // MARK: - Hjelpere

    private func offset(_ coordinate: Coordinate, north: Double, east: Double) -> Coordinate {
        let metresPerDegreeLat = 111_320.0
        let metresPerDegreeLng = metresPerDegreeLat * cos(coordinate.lat * .pi / 180)
        return Coordinate(lat: coordinate.lat + north / metresPerDegreeLat, lng: coordinate.lng + east / metresPerDegreeLng)
    }
}
