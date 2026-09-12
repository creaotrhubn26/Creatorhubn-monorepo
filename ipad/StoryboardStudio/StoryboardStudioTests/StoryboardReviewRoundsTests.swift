import XCTest
@testable import StoryboardStudio

final class StoryboardReviewRoundsTests: XCTestCase {
    func testReviewRoundAndDiffContractsDecodeWithoutDroppingIntegrityFields() throws {
        let roundData = Data(#"""
        {
          "id":"round-1","projectId":"project-1","manuscriptId":"manuscript-1",
          "version":4,"label":"Client sign-off","summary":"Locked pass",
          "snapshotHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "scriptFingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "status":"in_review","frameCount":24,"totalDurationSeconds":62.5,
          "createdAt":"2026-09-12T12:00:00Z"
        }
        """#.utf8)
        let round = try JSONDecoder().decode(StoryboardReviewRoundDTO.self, from: roundData)
        XCTAssertEqual(round.version, 4)
        XCTAssertEqual(round.frameCount, 24)
        XCTAssertEqual(round.snapshotHash.count, 64)

        let diffData = Data(#"""
        {
          "currentHash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          "baselineHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "scriptChanged":true,"addedFrameIds":["new"],"removedFrameIds":["old"],
          "changedFrameIds":["changed"],"movedFrameIds":["moved"],
          "impactedScriptLineRanges":[[10,12]]
        }
        """#.utf8)
        let diff = try JSONDecoder().decode(StoryboardReviewDiffDTO.self, from: diffData)
        XCTAssertEqual(diff.changeCount, 4)
        XCTAssertTrue(diff.scriptChanged)
        XCTAssertEqual(diff.impactedScriptLineRanges, [[10, 12]])
    }

    func testRevisionSkillPatchMapsStatusWithoutMutatingOtherFields() throws {
        let data = Data(#"""
        {"revisionStatus":"stale","revisionReason":"Manuslinje 10–12 er endret"}
        """#.utf8)
        let patch = try JSONDecoder().decode(StoryboardSkillFramePatchDTO.self, from: data)
        XCTAssertEqual(patch.fields["revisionStatus"] as? String, "stale")
        XCTAssertEqual(patch.fields["revisionReason"] as? String, "Manuslinje 10–12 er endret")
        XCTAssertEqual(patch.fields.count, 2)
    }

    func testReviewInboxDecodesUnreadActivityAndRoundTarget() throws {
        let data = Data(#"""
        {
          "items":[{
            "id":"notification-1","eventType":"storyboard_review_comment_added",
            "title":"Kari kommenterte storyboard v4","message":"Hold bildet lenger.",
            "reviewRoundId":"round-1","roundVersion":4,"frameId":"frame-a",
            "actorDisplayName":"Kari","decision":null,
            "createdAt":"2026-09-12T12:01:00Z","read":false,"readAt":null
          }],
          "unreadCount":1
        }
        """#.utf8)
        let inbox = try JSONDecoder().decode(StoryboardReviewInboxDTO.self, from: data)
        XCTAssertEqual(inbox.unreadCount, 1)
        XCTAssertEqual(inbox.items.first?.reviewRoundId, "round-1")
        XCTAssertEqual(inbox.items.first?.frameId, "frame-a")
        XCTAssertFalse(inbox.items.first?.read ?? true)
    }
}
