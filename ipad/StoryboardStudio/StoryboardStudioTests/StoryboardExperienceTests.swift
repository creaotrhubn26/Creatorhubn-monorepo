import XCTest
@testable import StoryboardStudio

final class StoryboardExperienceTests: XCTestCase {
    func testWorkspaceExposesExactlyThreeStableModes() {
        XCTAssertEqual(StoryboardWorkspaceMode.allCases.map(\.title),
                       ["Lag", "Avgjør", "Produser"])
        XCTAssertTrue(StoryboardWorkspaceMode.create.contains(.board))
        XCTAssertTrue(StoryboardWorkspaceMode.create.contains(.script))
        XCTAssertTrue(StoryboardWorkspaceMode.create.contains(.assets))
        XCTAssertTrue(StoryboardWorkspaceMode.decide.contains(.review))
        XCTAssertTrue(StoryboardWorkspaceMode.produce.contains(.shotList))
        XCTAssertTrue(StoryboardWorkspaceMode.produce.contains(.animatic))
        XCTAssertFalse(StoryboardWorkspaceMode.decide.contains(.board))
    }

    func testThreeAssistantsAccountForEveryAnalysisCapabilityExactlyOnce() {
        let grouped = StoryboardAssistant.allCases.flatMap(\.capabilities)
        XCTAssertEqual(grouped.count, Set(grouped.map(\.rawValue)).count)
        XCTAssertEqual(Set(grouped.map(\.rawValue)), Set([
            StoryboardSkillID.planSceneCoverage,
            .auditVisualContinuity,
            .designShotVariants,
            .auditBoardReadability,
            .buildAnimaticPass,
            .auditProductionFeasibility,
            .reconcileStoryboardRevision,
        ].map(\.rawValue)))
        XCTAssertFalse(grouped.contains(.translateArtistMarks))
    }

    func testArtistMarksRemainGeneralInputInsteadOfAssistant() {
        XCTAssertEqual(StoryboardSkillID.translateArtistMarks.title, "Artistmerker")
        XCTAssertTrue(StoryboardSkillID.translateArtistMarks.requiresFrame)
    }

    func testRoleLensLimitsSensitiveRevisionControlsWithoutClaimingAuthorization() {
        XCTAssertTrue(StoryboardProductionRole.producer.canManageLockedRevisions)
        XCTAssertTrue(StoryboardProductionRole.producer.canRestoreLockedRevisions)
        XCTAssertTrue(StoryboardProductionRole.director.canManageLockedRevisions)
        XCTAssertFalse(StoryboardProductionRole.director.canRestoreLockedRevisions)
        XCTAssertFalse(StoryboardProductionRole.client.canEditShotMetadata)
        XCTAssertFalse(StoryboardProductionRole.client.canDrawReviewMarks)
    }

    func testPrimaryInteractiveTargetMeetsIPadMinimum() {
        XCTAssertGreaterThanOrEqual(StoryboardExperienceMetrics.minimumTouchTarget, 44)
    }

    func testReviewLayoutRespondsToAvailableWidthInsteadOfDeviceName() {
        XCTAssertEqual(StoryboardReviewLayout(width: 1_366), .wide)
        XCTAssertTrue(StoryboardReviewLayout(width: 1_180).usesVerticalShotRail)
        XCTAssertEqual(StoryboardReviewLayout(width: 1_024), .compact)
        XCTAssertFalse(StoryboardReviewLayout(width: 760).contextOverlaysCanvas)
        XCTAssertEqual(StoryboardReviewLayout(width: 744), .narrow)
        XCTAssertTrue(StoryboardReviewLayout(width: 744).contextOverlaysCanvas)
    }
}
