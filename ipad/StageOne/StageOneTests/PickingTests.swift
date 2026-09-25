import XCTest
import simd
@testable import StageOne

final class PickingTests: XCTestCase {
    func testRayHitsCoffeeTable() {
        let scene = DefaultScene.make()
        let hit = pickNode(in: scene, rayOrigin: [0, 5, 0.3], rayDir: [0, -1, 0])
        XCTAssertEqual(hit, "coffee-table")
    }

    func testRayMissesEverything() {
        let hit = pickNode(in: DefaultScene.make(), rayOrigin: [50, 5, 50], rayDir: [0, -1, 0])
        XCTAssertNil(hit)
    }

    func testNearestNodeWins() {
        // rett ned over høyre stol: talent-kapsel > stol > gulv — kapselen er øverst
        let scene = DefaultScene.make()
        let hit = pickNode(in: scene, rayOrigin: [0.7, 5, 0.2], rayDir: [0, -1, 0])
        XCTAssertEqual(hit, "guest")
    }

    func testDisabledNodesIgnored() {
        var scene = DefaultScene.make()
        for i in scene.nodes.indices where ["guest", "chair-right"].contains(scene.nodes[i].id) {
            scene.nodes[i].enabled = false
        }
        let hit = pickNode(in: scene, rayOrigin: [0.7, 5, 0.2], rayDir: [0, -1, 0])
        XCTAssertNotEqual(hit, "guest")
        XCTAssertNotEqual(hit, "chair-right")
    }

    func testScreenRayPointsTowardTarget() {
        let cam = OrbitCamera.default.renderCamera()
        let r = ray(fromScreenPoint: CGPoint(x: 512, y: 384), viewSize: CGSize(width: 1024, height: 768),
                    camera: cam)
        // senter-stråle skal peke mot orbit-target
        let toTarget = simd_normalize(cam.target - cam.position)
        XCTAssertGreaterThan(simd_dot(r.dir, toTarget), 0.999)
    }
}
