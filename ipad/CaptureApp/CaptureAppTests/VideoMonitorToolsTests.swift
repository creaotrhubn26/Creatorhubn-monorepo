import UIKit
import XCTest
@testable import CaptureApp

@MainActor
final class VideoMonitorToolsTests: XCTestCase {
    func testVectorscopeSamplerProducesBoundedChrominancePoints() throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 96, height: 54))
        let image = renderer.image { context in
            UIColor.systemRed.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 48, height: 54))
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 48, y: 0, width: 48, height: 54))
        }

        let points = VectorscopeSampler.points(from: image)

        XCTAssertEqual(points.count, 48 * 27)
        XCTAssertTrue(points.allSatisfy { (0...1).contains($0.x) && (0...1).contains($0.y) })
        XCTAssertGreaterThan(Set(points.map { Int($0.x * 100) }).count, 1)
    }

    func testSnapshotWritesJPEGAndMetadataSidecar() throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 18))
        let image = renderer.image { context in
            UIColor.black.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 32, height: 18))
        }
        let projectId = "monitor-test-\(UUID().uuidString)"
        let url = try VideoSnapshotStore.save(
            image: image,
            projectId: projectId,
            cameraName: "Testkamera"
        )
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(url.lastPathComponent.hasPrefix("monitor-20"))
        XCTAssertFalse(url.lastPathComponent.contains("formatter"))
        let metadataURL = url.deletingPathExtension().appendingPathExtension("json")
        let metadata = try JSONSerialization.jsonObject(with: Data(contentsOf: metadataURL)) as? [String: String]
        XCTAssertEqual(metadata?["projectId"], projectId)
        XCTAssertEqual(metadata?["camera"], "Testkamera")
    }

    func testPortraitMonitorOrientationsSwapDimensions() {
        XCTAssertFalse(VideoMonitorOrientation.automatic.swapsDimensions)
        XCTAssertFalse(VideoMonitorOrientation.landscape.swapsDimensions)
        XCTAssertTrue(VideoMonitorOrientation.portraitLeft.swapsDimensions)
        XCTAssertTrue(VideoMonitorOrientation.portraitRight.swapsDimensions)
    }
}
