import XCTest
@testable import StageOne

final class SwitcherTests: XCTestCase {
    @MainActor func testEnsureValidPicksFirstTwoCameras() {
        let s = Switcher()
        s.ensureValid(in: DefaultScene.make())
        XCTAssertEqual(s.programId, "camera-a")
        XCTAssertEqual(s.previewId, "camera-b")
    }

    @MainActor func testCutSwaps() {
        let s = Switcher()
        s.ensureValid(in: DefaultScene.make())
        s.cut()
        XCTAssertEqual(s.programId, "camera-b")
        XCTAssertEqual(s.previewId, "camera-a")
    }

    @MainActor func testSetPreviewIgnoresProgram() {
        let s = Switcher()
        s.ensureValid(in: DefaultScene.make())
        s.setPreview("camera-a") // = program → no-op
        XCTAssertEqual(s.previewId, "camera-b")
        s.setPreview("camera-c")
        XCTAssertEqual(s.previewId, "camera-c")
    }

    @MainActor func testEnsureValidHealsDisabledProgram() {
        var scene = DefaultScene.make()
        let s = Switcher()
        s.ensureValid(in: scene)
        for i in scene.nodes.indices where scene.nodes[i].id == "camera-a" {
            scene.nodes[i].enabled = false
        }
        s.ensureValid(in: scene)
        XCTAssertEqual(s.programId, "camera-b")
        XCTAssertNotEqual(s.previewId, s.programId)
    }

    @MainActor func testAutoEndsInSwap() async {
        let s = Switcher()
        s.ensureValid(in: DefaultScene.make())
        s.auto(duration: 0.1)
        XCTAssertTrue(s.isAutoTransitioning)
        try? await Task.sleep(for: .milliseconds(400))
        XCTAssertFalse(s.isAutoTransitioning)
        XCTAssertEqual(s.programId, "camera-b")
        XCTAssertEqual(s.autoProgress, 0)
    }
}
