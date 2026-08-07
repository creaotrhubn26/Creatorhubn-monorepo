import XCTest
import AVFoundation
@testable import StageOne

final class ExportEngineTests: XCTestCase {
    @MainActor func testExportStillWritesPNG() throws {
        let renderer = try StageRenderer()
        let engine = ExportEngine()
        let url = try engine.exportStill(scene: DefaultScene.make(), cameraNodeId: "camera-a",
                                         width: 320, height: 180, renderer: renderer)
        defer { try? FileManager.default.removeItem(at: url) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
        XCTAssertEqual(image.width, 320)
        XCTAssertEqual(image.height, 180)
    }

    @MainActor func testExportVideoWritesPlayableMp4() async throws {
        let renderer = try StageRenderer()
        let engine = ExportEngine()
        let shots = [Shot(id: "s1", name: "A", cameraNodeId: "camera-a", durationSec: 0.25),
                     Shot(id: "s2", name: "B", cameraNodeId: "camera-b", durationSec: 0.25)]
        let url = try await engine.exportVideo(scene: DefaultScene.make(), shots: shots,
                                               width: 160, height: 96, fps: 12,
                                               renderer: renderer, label: "Test")
        defer { try? FileManager.default.removeItem(at: url) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        XCTAssertEqual(duration.seconds, 0.5, accuracy: 0.15)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        XCTAssertEqual(tracks.count, 1)
        let size = try await tracks[0].load(.naturalSize)
        XCTAssertEqual(Int(size.width), 160)
        XCTAssertEqual(Int(size.height), 96)
        XCTAssertFalse(engine.isExporting)
        XCTAssertEqual(engine.progress, 1, accuracy: 0.001)
    }

    @MainActor func testListExportsSeesNewFile() throws {
        let renderer = try StageRenderer()
        let engine = ExportEngine()
        let url = try engine.exportStill(scene: DefaultScene.make(), cameraNodeId: "camera-c",
                                         width: 64, height: 36, renderer: renderer)
        defer { try? FileManager.default.removeItem(at: url) }
        XCTAssertTrue(ExportEngine.listExports().contains { $0.url == url })
    }
}
