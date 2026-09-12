import XCTest
@testable import StageOne

final class ShotPlayerTests: XCTestCase {
    @MainActor func testShotSequence() {
        let scene = DefaultScene.make() // 5 shots à 4s
        let p = ShotPlayer()
        p.load(shots: scene.shots)
        p.play()
        p.tick(dt: 0.5)
        XCTAssertEqual(p.currentShotIndex, 0)
        p.tick(dt: 4.0)
        XCTAssertEqual(p.currentShotIndex, 1)
        XCTAssertEqual(p.currentCameraId(in: scene), scene.shots[1].cameraNodeId)
        p.tick(dt: 100) // forbi slutten → stopp på siste + pause
        XCTAssertFalse(p.isPlaying)
        XCTAssertEqual(p.currentShotIndex, 4)
        XCTAssertEqual(p.timecode.count, 8)
    }

    @MainActor func testJumpAndReplay() {
        let scene = DefaultScene.make()
        let p = ShotPlayer()
        p.load(shots: scene.shots)
        p.jump(toShotIndex: 2)
        XCTAssertEqual(p.currentShotIndex, 2)
        XCTAssertEqual(p.elapsed, 8, accuracy: 0.001)
        // play etter at sekvensen er ferdig → starter forfra
        p.elapsed = p.totalDuration
        p.play()
        XCTAssertEqual(p.elapsed, 0, accuracy: 0.001)
        p.pause()
    }

    @MainActor func testTimecodeFormat() {
        let p = ShotPlayer()
        p.load(shots: [Shot(id: "s", name: "S", cameraNodeId: "camera-a", durationSec: 4000)])
        p.play()
        p.tick(dt: 3725) // 1t 2m 5s
        XCTAssertEqual(p.timecode, "01:02:05")
        p.pause()
    }
}
