// CullingEngineTests.swift
//
// Tier 0: den rene rank/dedupe-logikken i CullingEngine — deterministisk,
// uten Vision/bilder.

import XCTest
@testable import CaptureApp

final class CullingEngineTests: XCTestCase {

    private func score(_ id: String, _ aesthetics: Float, utility: Bool = false, face: Float? = nil) -> PhotoScore {
        PhotoScore(id: id, aesthetics: aesthetics, isUtility: utility, faceQuality: face)
    }

    func testRankingSortsByQuality() {
        let scores = [score("a", 0.2), score("b", 0.9), score("c", 0.5)]
        let result = CullingEngine.cull(scores: scores, duplicateGroups: [])
        XCTAssertEqual(result.ranked.map(\.id), ["b", "c", "a"])
        XCTAssertEqual(result.keep, ["b", "c", "a"])   // ingen duplikater
    }

    func testUtilityIsDemoted() {
        // Kvittering med høy estetikk skal falle bak et ekte bilde.
        let scores = [score("shot", 0.6), score("receipt", 0.95, utility: true)]
        let result = CullingEngine.cull(scores: scores, duplicateGroups: [])
        XCTAssertEqual(result.ranked.first?.id, "shot")
    }

    func testFaceQualityInfluencesRank() {
        // Samme estetikk, men bedre ansikts-fangst vinner.
        let scores = [score("blink", 0.6, face: 0.1), score("sharp", 0.6, face: 0.9)]
        let result = CullingEngine.cull(scores: scores, duplicateGroups: [])
        XCTAssertEqual(result.ranked.first?.id, "sharp")
    }

    func testGroupDuplicatesUnionsNearby() {
        // a~b (0.1), c isolert (langt unna).
        let ids = ["a", "b", "c"]
        let dist: (String, String) -> Double = { x, y in
            let pair = Set([x, y])
            if pair == Set(["a", "b"]) { return 0.1 }
            return 0.9
        }
        let groups = CullingEngine.groupDuplicates(ids: ids, threshold: 0.3, distance: dist)
        XCTAssertEqual(groups, [["a", "b"]])
    }

    func testCullKeepsBestOfDuplicateGroup() {
        let scores = [score("a", 0.4), score("b", 0.8), score("c", 0.5)]
        let groups = [["a", "b"]]   // a og b er duplikater
        let result = CullingEngine.cull(scores: scores, duplicateGroups: groups)
        // b (beste i gruppa) + c beholdes; a demoteres.
        XCTAssertTrue(result.keep.contains("b"))
        XCTAssertTrue(result.keep.contains("c"))
        XCTAssertFalse(result.keep.contains("a"))
    }

    func testNoDuplicatesWhenAllFar() {
        let groups = CullingEngine.groupDuplicates(ids: ["a", "b", "c"], threshold: 0.3) { _, _ in 0.9 }
        XCTAssertTrue(groups.isEmpty)
    }
}
