import XCTest
@testable import StoryboardStudio

final class StoryboardReviewRoundsTests: XCTestCase {
    func testReviewPinGeometryClampsTouchCoordinatesInsideCanvas() {
        XCTAssertEqual(ReviewPinGeometry.clamped(CGPoint(x: -0.4, y: 1.3)),
                       CGPoint(x: 0, y: 1))
        XCTAssertEqual(ReviewPinGeometry.clamped(CGPoint(x: 0.4, y: 0.7)),
                       CGPoint(x: 0.4, y: 0.7))

        let size = CGSize(width: 400, height: 200)
        XCTAssertEqual(ReviewPinGeometry.normalized(CGPoint(x: 200, y: 100), in: size),
                       CGPoint(x: 0.5, y: 0.5))
        XCTAssertEqual(
            ReviewPinGeometry.normalized(CGPoint(x: 0, y: 0), in: size, visualInset: 16),
            CGPoint(x: 0.04, y: 0.08))
        XCTAssertEqual(
            ReviewPinGeometry.normalized(CGPoint(x: 500, y: 300), in: size, visualInset: 16),
            CGPoint(x: 0.96, y: 0.92))
    }

    func testReviewPinGeometryUsesSafeCenterForUnavailableCanvasSize() {
        XCTAssertEqual(
            ReviewPinGeometry.normalized(CGPoint(x: 10, y: 10), in: .zero),
            CGPoint(x: 0.5, y: 0.5))
    }

    func testReviewWorkspaceKeepsRevisionsInsideOneDestination() {
        XCTAssertEqual(StoryboardReviewWorkspaceSection.allCases, [.shots, .revisions])
        XCTAssertEqual(StoryboardReviewWorkspaceSection.shots.title, "Arbeidskopi")
        XCTAssertEqual(StoryboardReviewWorkspaceSection.revisions.title, "Låste revisjoner")
    }

    func testSnapshotFramePreservesDrawingFallbackAndImageAliases() throws {
        let data = Data(#"""
        {
          "id":"frame-drawing","shotNumber":"4A","description":"Nora ser opp",
          "duration":3.5,"shotType":"Nær","movement":"Dolly inn","lensMm":50,
          "transition":"Klipp","continuityNotes":"Blikk mot venstre",
          "productionNotes":"Skinne langs vinduet",
          "imageURL":"/api/storage/frame.png",
          "thumbnailDataURL":"data:image/jpeg;base64,cHJldmlldw==",
          "drawingData":{"strokes":"[]","width":2048,"height":1152}
        }
        """#.utf8)

        let frame = try JSONDecoder().decode(StoryboardReviewSnapshotFrameDTO.self, from: data)

        XCTAssertEqual(frame.imageUrl, "/api/storage/frame.png")
        XCTAssertEqual(frame.thumbnailUrl, "data:image/jpeg;base64,cHJldmlldw==")
        XCTAssertEqual(frame.drawingData?.strokes, "[]")
        XCTAssertEqual(frame.drawingData?.width, 2048)
        XCTAssertEqual(frame.drawingData?.height, 1152)
        XCTAssertEqual(frame.duration, 3.5)
        XCTAssertEqual(frame.shotType, "Nær")
        XCTAssertEqual(frame.movement, "Dolly inn")
        XCTAssertEqual(frame.lensMm, 50)
        XCTAssertEqual(frame.continuityNotes, "Blikk mot venstre")
    }

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

    func testResolutionQueueDecodesAssignmentDueDateAndCarryProvenance() throws {
        let data = Data(#"""
        {
          "id":"comment-2","reviewRoundId":"round-2","frameId":"frame-a",
          "authorDisplayName":"Kari","body":"Hold bildet lenger.","status":"resolved",
          "anchorX":0.72,"anchorY":0.38,
          "annotations":[{
            "id":"mark-1","tool":"arrow","color":"#fbbf24","strokeWidth":3,
            "points":[{"x":0.24,"y":0.68},{"x":0.72,"y":0.38}]
          }],
          "assignedTo":"Mina","dueAt":"2026-09-14T10:00:00Z",
          "resolutionNote":"Forlenget to frames","resolvedBy":"owner-1",
          "resolvedAt":"2026-09-12T12:05:00Z","resolvedInRoundId":"round-3",
          "changes":[{
            "id":"change-1","reviewRoundId":"round-2","commentId":"comment-2",
            "sceneId":"scene-1","frameId":"frame-a","operation":"apply",
            "field":"duration","fieldLabel":"Varighet",
            "beforeDisplayValue":"2.0 sek","afterDisplayValue":"3.5 sek",
            "beforeHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "afterHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "revertsChangeId":null,"createdBy":"owner-1",
            "createdAt":"2026-09-12T12:05:00Z"
          }],
          "carriedFromCommentId":"comment-1","createdAt":"2026-09-12T12:01:00Z",
          "updatedAt":"2026-09-12T12:05:00Z"
        }
        """#.utf8)
        let comment = try JSONDecoder().decode(StoryboardReviewCommentDTO.self, from: data)
        XCTAssertEqual(comment.status, "resolved")
        XCTAssertEqual(comment.assignedTo, "Mina")
        XCTAssertEqual(comment.anchorX, 0.72)
        XCTAssertEqual(comment.annotations?.first?.tool, "arrow")
        XCTAssertEqual(comment.annotations?.first?.points.count, 2)
        XCTAssertEqual(comment.resolvedInRoundId, "round-3")
        XCTAssertEqual(comment.carriedFromCommentId, "comment-1")
        XCTAssertEqual(comment.changes?.first?.field, "duration")
        XCTAssertEqual(comment.changes?.first?.afterDisplayValue, "3.5 sek")
    }

    func testReviewChangeInputAcceptsNorwegianDecimalAndSuggestsSafeTiming() throws {
        XCTAssertEqual(
            try StoryboardReviewEditableField.duration.parsedValue("3,5"),
            .number(3.5))
        XCTAssertEqual(
            try StoryboardReviewEditableField.lensMm.parsedValue("50"),
            .number(50))
        XCTAssertThrowsError(try StoryboardReviewEditableField.duration.parsedValue("0,1"))
        XCTAssertThrowsError(try StoryboardReviewEditableField.lensMm.parsedValue("35,5"))
        XCTAssertThrowsError(try StoryboardReviewEditableField.description.parsedValue("  "))

        let frame = StoryboardReviewSnapshotFrameDTO(
            id: "frame-a", shotNumber: "3A", description: "Trollet ser inn",
            duration: 2, imageUrl: nil, thumbnailUrl: nil)
        XCTAssertEqual(
            StoryboardReviewEditableField.duration.initialValue(
                frame: frame, comment: "Hold totalbildet litt lenger."),
            "3")
    }
}
