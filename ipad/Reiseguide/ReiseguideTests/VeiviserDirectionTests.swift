// VeiviserDirectionTests.swift
//
// Ren matte for veiviseren (pakke 2, item 5): bearing (Geo, gjenbrukt),
// relativ vinkel, klokkeslett, kompassord og målvalg (VeiviserTarget).
// Ingen CoreLocation/Observation/UIKit involvert.

import XCTest
@testable import Reiseguide

final class VeiviserDirectionTests: XCTestCase {
    // MARK: - Relativ vinkel

    func testRelativeAngleIsZeroWhenPointingDirectlyAtTarget() {
        XCTAssertEqual(CompassDirection.relativeAngleDegrees(bearingDegrees: 90, headingDegrees: 90), 0, accuracy: 0.001)
    }

    func testRelativeAngleIsPositiveWhenTargetIsToTheRight() {
        // Målet ligger på 100°, enheten peker mot 90° (nord-ish) -> målet er
        // 10° til høyre for der telefonen peker.
        XCTAssertEqual(CompassDirection.relativeAngleDegrees(bearingDegrees: 100, headingDegrees: 90), 10, accuracy: 0.001)
    }

    func testRelativeAngleIsNegativeWhenTargetIsToTheLeft() {
        XCTAssertEqual(CompassDirection.relativeAngleDegrees(bearingDegrees: 80, headingDegrees: 90), -10, accuracy: 0.001)
    }

    func testRelativeAngleWrapsAroundZeroThreeSixty() {
        // Bearing 5°, heading 355° -> målet er 10° til høyre (ikke -350°).
        XCTAssertEqual(CompassDirection.relativeAngleDegrees(bearingDegrees: 5, headingDegrees: 355), 10, accuracy: 0.001)
        // Bearing 355°, heading 5° -> målet er 10° til venstre (ikke +350°).
        XCTAssertEqual(CompassDirection.relativeAngleDegrees(bearingDegrees: 355, headingDegrees: 5), -10, accuracy: 0.001)
    }

    func testRelativeAngleStaysWithinHalfCircle() {
        let relative = CompassDirection.relativeAngleDegrees(bearingDegrees: 179, headingDegrees: 0)
        XCTAssertGreaterThan(relative, -180)
        XCTAssertLessThanOrEqual(relative, 180)
    }

    // MARK: - Klokkeslett

    func testClockBucketStraightAheadIsTwelve() {
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: 0), 12)
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: 10), 12)
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: -10), 12)
    }

    func testClockBucketRightIsThree() {
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: 90), 3)
    }

    func testClockBucketLeftIsNine() {
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: -90), 9)
    }

    func testClockBucketBehindIsSix() {
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: 180), 6)
    }

    func testClockBucketExampleFromSpec() {
        // «Klokka 2» ≈ 60° til høyre.
        XCTAssertEqual(CompassDirection.clockBucket(relativeAngleDegrees: 60), 2)
    }

    // MARK: - Pekt mot målet (haptikk)

    func testIsPointingAtTargetWithinTolerance() {
        XCTAssertTrue(CompassDirection.isPointingAtTarget(relativeAngleDegrees: 14, toleranceDegrees: 15))
        XCTAssertTrue(CompassDirection.isPointingAtTarget(relativeAngleDegrees: -15, toleranceDegrees: 15))
        XCTAssertFalse(CompassDirection.isPointingAtTarget(relativeAngleDegrees: 16, toleranceDegrees: 15))
    }

    // MARK: - Kompassord (fallback uten heading)

    func testCompassWordKeyForCardinalDirections() {
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 0), "veiviser.compass.n")
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 45), "veiviser.compass.ne")
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 90), "veiviser.compass.e")
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 180), "veiviser.compass.s")
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 270), "veiviser.compass.w")
        XCTAssertEqual(CompassDirection.compassWordKey(bearingDegrees: 359), "veiviser.compass.n")
    }

    // MARK: - Målvalg: valgt sted eller «neste sted»

    func testResolveExplicitPoi() {
        let pois = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let resolved = VeiviserTarget.resolve(.poi(id: "b"), pois: pois, visitedIds: [])
        XCTAssertEqual(resolved?.id, "b")
    }

    func testResolveNextStopPicksFirstUnvisitedBySortOrder() {
        let pois = [makePoi(id: "c", sortOrder: 2), makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let resolved = VeiviserTarget.resolve(.nextStop, pois: pois, visitedIds: ["a"])
        XCTAssertEqual(resolved?.id, "b")
    }

    func testResolveNextStopExcludesCurrentPoi() {
        let pois = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let resolved = VeiviserTarget.resolve(.nextStop, pois: pois, visitedIds: [], excludingId: "a")
        XCTAssertEqual(resolved?.id, "b")
    }

    func testResolveNextStopReturnsNilWhenEverythingVisited() {
        let pois = [makePoi(id: "a", sortOrder: 0), makePoi(id: "b", sortOrder: 1)]
        let resolved = VeiviserTarget.resolve(.nextStop, pois: pois, visitedIds: ["a", "b"])
        XCTAssertNil(resolved)
    }

    private func makePoi(id: String, sortOrder: Int) -> GuidePOI {
        GuidePOI(
            id: id, slug: id, areaId: "area", categoryId: nil, lat: 59.9, lng: 10.7,
            triggerRadiusM: 40, priority: 0, sortOrder: sortOrder, freePreview: false, heroImageUrl: nil, heroImageAlt: nil,
            title: id, subtitle: nil, summary: nil, locationLabel: nil, practicalInfo: [],
            lang: LanguageInfo(requested: "nb", resolved: "nb", fallbackUsed: false, autoTranslated: false, editorialStatus: "draft", available: ["nb"]),
            variants: GuideVariants(narration: nil, audioDescription: nil),
            quiz: nil, rating: nil, shareUrl: nil
        )
    }
}
