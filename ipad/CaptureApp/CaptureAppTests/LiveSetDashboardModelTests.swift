import XCTest
@testable import CaptureApp

final class LiveSetDashboardModelTests: XCTestCase {

    // MARK: - join()

    func test_join_mapsCapturedAssetToTile_withRatingAndFlags() {
        let shots = [
            shotListItem(id: "s1", scene: "Bridal portrait", capturedAssetId: "a1", priority: "high"),
        ]
        let assets = [
            asset(id: "a1", previewUrl: "https://cdn/x.jpg", rating: 4, flagged: true),
        ]
        let tiles = LiveSetDashboardModel.join(shotList: shots, assets: assets)
        XCTAssertEqual(tiles.count, 1)
        guard case .captured(let url, let rating, let flagged, let rejected) = tiles[0].state else {
            return XCTFail("expected .captured, got \(tiles[0].state)")
        }
        XCTAssertEqual(url, "https://cdn/x.jpg")
        XCTAssertEqual(rating, 4)
        XCTAssertTrue(flagged)
        XCTAssertFalse(rejected)
    }

    func test_join_missingShotStaysUncaptured_whenAssetIdUnknown() {
        // capturedAssetId points to an asset that isn't in the listing
        // (e.g. was deleted, or the sync is partial). We treat that as
        // still-missing rather than silently assuming the shot is done.
        let shots = [
            shotListItem(id: "s1", scene: "Orphan", capturedAssetId: "missing-asset"),
        ]
        let tiles = LiveSetDashboardModel.join(shotList: shots, assets: [])
        XCTAssertEqual(tiles.count, 1)
        guard case .missing(let isCompleted) = tiles[0].state else {
            return XCTFail("expected .missing")
        }
        XCTAssertFalse(isCompleted)
    }

    func test_join_missingShotFlagsManualCompletion() {
        // Photographer flipped ShotListPanel's completion toggle but
        // never linked an asset (e.g. shot it on a backup body that
        // isn't tethered). Shows as missing tile but with "Markert
        // ferdig" marker — summary counts it as done.
        let shots = [
            shotListItem(id: "s1", scene: "Backup-body", capturedAssetId: nil, isCompleted: true),
        ]
        let tiles = LiveSetDashboardModel.join(shotList: shots, assets: [])
        guard case .missing(let isCompleted) = tiles[0].state else {
            return XCTFail("expected .missing")
        }
        XCTAssertTrue(isCompleted)
    }

    func test_join_preservesShotListOrdering() {
        // The shot list is already ordered by the planner's intent —
        // priority-sorting in the UI would shuffle tiles on every
        // refresh as shots get captured, which is jarring. Verify we
        // preserve the input order exactly.
        let shots = [
            shotListItem(id: "a", scene: "First",  priority: "low"),
            shotListItem(id: "b", scene: "Second", priority: "critical"),
            shotListItem(id: "c", scene: "Third",  priority: "medium"),
        ]
        let tiles = LiveSetDashboardModel.join(shotList: shots, assets: [])
        XCTAssertEqual(tiles.map(\.scene), ["First", "Second", "Third"])
    }

    // MARK: - summarize()

    func test_summarize_counts_capturedAndCriticalMissing() {
        let tiles: [CoverageTile] = [
            captured(scene: "A", rating: 5),
            captured(scene: "B", rating: 3),
            missing(scene: "C", priority: .critical),
            missing(scene: "D", priority: .critical),
            missing(scene: "E", priority: .mustHave),
            missing(scene: "F", priority: .low),
        ]
        let s = LiveSetDashboardModel.summarize(tiles: tiles)
        XCTAssertEqual(s.total, 6)
        XCTAssertEqual(s.capturedCount, 2)
        XCTAssertEqual(s.completedWithoutAsset, 0)
        XCTAssertEqual(s.criticalMissing, 2)
        XCTAssertEqual(s.mustHaveMissing, 1) // `low` doesn't count as must-have
        XCTAssertEqual(s.doneCount, 2)
    }

    func test_summarize_treatsManualCompletionAsDone_noMissingCount() {
        // Shot is marked done but has no captured asset. It should not
        // appear in "critical missing" — the photographer has asserted
        // coverage exists. doneCount picks it up in the completed bucket.
        let tiles: [CoverageTile] = [
            missing(scene: "A", priority: .critical, isCompleted: true),
            missing(scene: "B", priority: .critical, isCompleted: false),
        ]
        let s = LiveSetDashboardModel.summarize(tiles: tiles)
        XCTAssertEqual(s.capturedCount, 0)
        XCTAssertEqual(s.completedWithoutAsset, 1)
        XCTAssertEqual(s.criticalMissing, 1)
        XCTAssertEqual(s.doneCount, 1)
    }

    func test_summarize_emptyListYieldsEmptySummary() {
        XCTAssertEqual(LiveSetDashboardModel.summarize(tiles: []), .empty)
    }

    // MARK: - buildCoverageRequest()

    func test_buildCoverageRequest_splitsTilesByDoneState() {
        let tiles: [CoverageTile] = [
            captured(scene: "A", rating: 5),
            captured(scene: "B", rating: 0),
            missing(scene: "C", priority: .critical),
            missing(scene: "D", priority: .high, isCompleted: true), // marked done w/o asset
            missing(scene: "E", priority: .low),
        ]
        let req = LiveSetDashboardModel.buildCoverageRequest(
            projectId: "proj-uuid",
            projectTitle: "Holy Crust",
            tiles: tiles,
        )
        // captured + manual-completion both count as completed.
        XCTAssertEqual(req.shotsCompleted.map(\.id), ["A", "B", "D"])
        XCTAssertEqual(req.plannedShots.map(\.id), ["C", "E"])
    }

    func test_buildCoverageRequest_synthesisesSceneFromProject() {
        let req = LiveSetDashboardModel.buildCoverageRequest(
            projectId: "proj-uuid",
            projectTitle: "Holy Crust",
            tiles: [missing(scene: "A", priority: .high)],
        )
        XCTAssertEqual(req.projectId, "proj-uuid")
        // Slice 2 rolls all shots up under one synthetic scene per
        // project — verify the scene-id stays stable + carries the
        // project title as the heading.
        XCTAssertEqual(req.sceneId, "project:proj-uuid")
        XCTAssertEqual(req.scene.id, "project:proj-uuid")
        XCTAssertEqual(req.scene.heading, "Holy Crust")
    }

    func test_buildCoverageRequest_mapsPriorityToBackendVocab() {
        let tiles: [CoverageTile] = [
            missing(scene: "crit",  priority: .critical),
            missing(scene: "must",  priority: .mustHave),
            missing(scene: "high",  priority: .high),
            missing(scene: "med",   priority: .medium),
            missing(scene: "low",   priority: .low),
            missing(scene: "unk",   priority: .unknown),
        ]
        let req = LiveSetDashboardModel.buildCoverageRequest(
            projectId: "p", projectTitle: nil, tiles: tiles,
        )
        XCTAssertEqual(req.plannedShots.map(\.priority), [
            "critical", "must-have", "high", "medium", "low", nil,
        ])
    }

    func test_buildCoverageRequest_descriptionFallsBackToScene() {
        let withDescription = CoverageTile(
            shotId: "x", scene: "Bridal portrait",
            description: "Two-shot, soft window light",
            priority: .high, state: .missing(isCompleted: false),
        )
        let withoutDescription = CoverageTile(
            shotId: "y", scene: "Cake closeup",
            description: nil,
            priority: .high, state: .missing(isCompleted: false),
        )
        let req = LiveSetDashboardModel.buildCoverageRequest(
            projectId: "p", projectTitle: nil,
            tiles: [withDescription, withoutDescription],
        )
        XCTAssertEqual(req.plannedShots[0].description, "Two-shot, soft window light")
        XCTAssertEqual(req.plannedShots[1].description, "Cake closeup")
    }

    // MARK: - CoverageCheckResult.topMissing

    func test_topMissing_picksMostSevereEntryFirst() {
        let result = CoverageCheckResult(
            status: .gaps,
            summary: "",
            missingCoverage: [
                .init(type: "insert", reason: "x", severity: .niceToHave),
                .init(type: "reaction", reason: "y", severity: .critical),
                .init(type: "OTS", reason: "z", severity: .recommended),
            ],
        )
        XCTAssertEqual(result.topMissing?.type, "reaction")
    }

    func test_topMissing_returnsNilWhenEmpty() {
        let result = CoverageCheckResult(
            status: .complete, summary: "", missingCoverage: [],
        )
        XCTAssertNil(result.topMissing)
    }

    // MARK: - Priority parsing

    func test_priority_handlesVariants_andDefaultsToUnknown() {
        XCTAssertEqual(Priority(raw: "critical"), .critical)
        XCTAssertEqual(Priority(raw: "CRITICAL"), .critical)
        XCTAssertEqual(Priority(raw: "must-have"), .mustHave)
        XCTAssertEqual(Priority(raw: "must_have"), .mustHave)
        XCTAssertEqual(Priority(raw: "musthave"),  .mustHave)
        XCTAssertEqual(Priority(raw: "high"),      .high)
        XCTAssertEqual(Priority(raw: "normal"),    .medium)
        XCTAssertEqual(Priority(raw: "low"),       .low)
        XCTAssertEqual(Priority(raw: nil),         .unknown)
        XCTAssertEqual(Priority(raw: "nonsense"),  .unknown)
    }

    // MARK: - Fixtures

    private func shotListItem(
        id: String,
        scene: String,
        description: String? = nil,
        capturedAssetId: String? = nil,
        priority: String? = "high",
        isCompleted: Bool? = nil,
    ) -> BackendShotListItem {
        BackendShotListItem(
            id: id, scene: scene, description: description,
            estimatedDuration: nil, priority: priority, shotType: nil,
            locationName: nil, notes: nil, scouted: nil,
            isCompleted: isCompleted, capturedAssetId: capturedAssetId,
        )
    }

    private func asset(
        id: String,
        previewUrl: String? = "https://cdn/x.jpg",
        rating: Int? = 0,
        flagged: Bool = false,
        rejected: Bool = false,
    ) -> BackendAsset {
        BackendAsset(
            id: id, sessionId: "sess", originalFilename: "\(id).jpg",
            mime: "image/jpeg", sizeBytes: 1024,
            previewKey: "k/\(id)", fullKey: nil, rawKey: nil,
            state: "uploaded", checksumSha256: nil,
            previewUrl: previewUrl, rating: rating,
            flaggedForClient: flagged, rejected: rejected,
        )
    }

    private func captured(scene: String, rating: Int) -> CoverageTile {
        CoverageTile(
            shotId: scene, scene: scene, description: nil,
            priority: .medium,
            state: .captured(previewUrl: "https://cdn/\(scene).jpg",
                             rating: rating, isFlagged: false, isRejected: false),
        )
    }

    private func missing(
        scene: String,
        priority: Priority,
        isCompleted: Bool = false,
    ) -> CoverageTile {
        CoverageTile(
            shotId: scene, scene: scene, description: nil,
            priority: priority,
            state: .missing(isCompleted: isCompleted),
        )
    }
}
