import XCTest
@testable import CaptureApp

final class ModelsTests: XCTestCase {
    func testAssetStateRoundTripsThroughJSON() throws {
        for state in AssetState.allCases {
            let encoded = try JSONEncoder().encode(state)
            let decoded = try JSONDecoder().decode(AssetState.self, from: encoded)
            XCTAssertEqual(state, decoded)
        }
    }

    func testTerminalStates() {
        XCTAssertTrue(AssetState.verified.isTerminal)
        XCTAssertTrue(AssetState.failedPermanent.isTerminal)
        XCTAssertFalse(AssetState.anticipated.isTerminal)
        XCTAssertFalse(AssetState.failedTransient.isTerminal)
    }

    func testPreviewAndFullAvailability() {
        XCTAssertFalse(AssetState.anticipated.hasPreview)
        XCTAssertTrue(AssetState.previewReady.hasPreview)
        XCTAssertFalse(AssetState.previewReady.hasFull)
        XCTAssertTrue(AssetState.fullReady.hasFull)
        XCTAssertTrue(AssetState.verified.hasFull)
    }

    func testIngestPriorityOrdering() {
        XCTAssertLessThan(IngestPriority.preview, IngestPriority.full)
        XCTAssertLessThan(IngestPriority.full, IngestPriority.raw)
    }

    func testAssetRoundTripsThroughJSON() throws {
        let asset = Asset(
            id: UUID(),
            sessionId: UUID(),
            originalFilename: "IMG_0001.CR3",
            captureTime: Date(timeIntervalSince1970: 1_713_283_200),
            previewKey: nil,
            fullKey: nil,
            rawKey: nil,
            checksumSha256: nil,
            mime: "image/x-canon-cr3",
            sizeBytes: nil,
            state: .anticipated,
            signals: .empty,
            rating: 0,
            colorLabel: nil,
            flaggedForClient: false,
            rejected: false,
            createdAt: Date(timeIntervalSince1970: 1_713_283_200),
            updatedAt: Date(timeIntervalSince1970: 1_713_283_200)
        )
        let encoded = try JSONEncoder().encode(asset)
        let decoded = try JSONDecoder().decode(Asset.self, from: encoded)
        XCTAssertEqual(asset, decoded)
    }

    func testSessionStatusCoversAllCases() {
        XCTAssertEqual(Session.Status.allCases.count, 3)
    }
}
