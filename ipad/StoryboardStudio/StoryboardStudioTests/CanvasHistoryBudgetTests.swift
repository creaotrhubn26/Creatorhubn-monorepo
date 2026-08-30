import XCTest
@testable import StoryboardStudio

final class CanvasHistoryBudgetTests: XCTestCase {
    private let snapshot = CanvasDocumentSnapshot(
        strokes: [],
        layers: .standard,
        shotFraming: .standard
    )

    func testDepthLimitKeepsMostImmediatelyApplicableEntries() {
        let entries = (1...5).map { index in
            entry("u\(index)", timestamp: TimeInterval(index), bytes: 64)
        }

        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: entries,
            redo: [],
            maximumEntriesPerStack: 3,
            maximumEstimatedBytes: 1_024
        )

        XCTAssertEqual(bounded.undo.map(\.label), ["u3", "u4", "u5"])
        XCTAssertTrue(bounded.redo.isEmpty)
    }

    func testCombinedByteBudgetEvictsOldestAcrossUndoAndRedo() {
        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: [
                entry("undo-old", timestamp: 1, bytes: 80),
                entry("undo-next", timestamp: 3, bytes: 80),
            ],
            redo: [
                entry("redo-old", timestamp: 2, bytes: 80),
                entry("redo-next", timestamp: 4, bytes: 80),
            ],
            maximumEntriesPerStack: 80,
            maximumEstimatedBytes: 160
        )

        XCTAssertEqual(bounded.undo.map(\.label), ["undo-next"])
        XCTAssertEqual(bounded.redo.map(\.label), ["redo-next"])
    }

    func testSingleCheckpointOverBudgetFailsClosed() {
        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: [entry("oversized", timestamp: 1, bytes: 257)],
            redo: [],
            maximumEntriesPerStack: 80,
            maximumEstimatedBytes: 256
        )

        XCTAssertTrue(bounded.undo.isEmpty)
        XCTAssertTrue(bounded.redo.isEmpty)
    }

    func testLegacyArchiveWithoutEstimateRemainsDecodableAndIsMeasured() throws {
        let archive = CanvasHistoryArchive(
            frameId: "legacy",
            undo: [entry("legacy-entry", timestamp: 1, bytes: 64)],
            redo: []
        )
        let encoded = try JSONEncoder().encode(archive)
        var object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        var undo = try XCTUnwrap(object["undo"] as? [[String: Any]])
        undo[0].removeValue(forKey: "estimatedByteCount")
        object["undo"] = undo
        let legacyData = try JSONSerialization.data(withJSONObject: object)

        let decoded = try JSONDecoder().decode(
            CanvasHistoryArchive.self, from: legacyData)
        let measured = CanvasHistoryBudgetPolicy.estimatedByteCount(
            for: decoded.undo[0].snapshot)
        XCTAssertEqual(decoded.undo[0].estimatedByteCount, measured)

        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: decoded.undo, redo: decoded.redo)
        XCTAssertEqual(bounded.undo[0].estimatedByteCount, measured)
    }

    func testPersistedEstimateCannotUnderreportDecodedSnapshot() throws {
        let archive = CanvasHistoryArchive(
            frameId: "underreported",
            undo: [entry("entry", timestamp: 1, bytes: 1)],
            redo: []
        )

        let decoded = try JSONDecoder().decode(
            CanvasHistoryArchive.self,
            from: JSONEncoder().encode(archive)
        )
        XCTAssertEqual(
            decoded.undo[0].estimatedByteCount,
            CanvasHistoryBudgetPolicy.estimatedByteCount(
                for: decoded.undo[0].snapshot)
        )
    }

    private func entry(
        _ label: String,
        timestamp: TimeInterval,
        bytes: Int
    ) -> CanvasHistoryEntry {
        CanvasHistoryEntry(
            label: label,
            createdAt: Date(timeIntervalSince1970: timestamp),
            snapshot: snapshot,
            estimatedByteCount: bytes
        )
    }
}
