// ShotMatcherTests.swift
//
// Tier 0: shot-matching-heuristikken (ren, uten bilder/Vision).

import XCTest
@testable import CaptureApp

final class ShotMatcherTests: XCTestCase {
    private let ringDetail = ShotListItem(id: "detail", scene: "Ring detail", shotType: "detail")
    private let groupWide = ShotListItem(id: "wide", scene: "Group photo", shotType: "wide")

    func testDetailMatchesCloseupNoFaces() {
        let m = ShotMatcher.bestMatch(
            signals: CaptureSignals(faceCount: 0, aspectRatio: 1.0),
            shots: [ringDetail, groupWide])
        XCTAssertEqual(m?.id, "detail")
    }

    func testWideMatchesGroupWideFrame() {
        let m = ShotMatcher.bestMatch(
            signals: CaptureSignals(faceCount: 5, aspectRatio: 1.6),
            shots: [ringDetail, groupWide])
        XCTAssertEqual(m?.id, "wide")
    }

    func testLowConfidenceReturnsNil() {
        // wide-shot men portrett + ingen ansikter → svak match; høy terskel → nil
        let m = ShotMatcher.bestMatch(
            signals: CaptureSignals(faceCount: 0, aspectRatio: 0.7),
            shots: [groupWide], threshold: 0.9)
        XCTAssertNil(m)
    }

    func testCompletedShotsExcluded() {
        let done = ShotListItem(id: "detail", scene: "Ring", shotType: "detail", isCompleted: true)
        let m = ShotMatcher.bestMatch(
            signals: CaptureSignals(faceCount: 0, aspectRatio: 1.0), shots: [done])
        XCTAssertNil(m)
    }

    func testMissingMustHaves() {
        let a = ShotListItem(id: "1", scene: "a", priority: "must")
        let b = ShotListItem(id: "2", scene: "b", priority: "must", isCompleted: true)
        let c = ShotListItem(id: "3", scene: "c", priority: "low")
        XCTAssertEqual(ShotMatcher.missingMustHaves([a, b, c]).map(\.id), ["1"])
    }

    func testPriorityBreaksTies() {
        // To detail-shots, samme type-score; must vinner.
        let plain = ShotListItem(id: "plain", scene: "x", shotType: "detail")
        let must = ShotListItem(id: "must", scene: "y", priority: "must", shotType: "detail")
        let m = ShotMatcher.bestMatch(
            signals: CaptureSignals(faceCount: 0, aspectRatio: 1.0), shots: [plain, must])
        XCTAssertEqual(m?.id, "must")
    }
}
