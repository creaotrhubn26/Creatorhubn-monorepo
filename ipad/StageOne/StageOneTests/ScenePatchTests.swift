import XCTest
@testable import StageOne

final class ScenePatchTests: XCTestCase {
    private func lightParams(_ node: Node?) -> LightParams? {
        if case .light(let p)? = node?.params { return p }
        return nil
    }

    func testUpsertExistingNode() {
        var scene = DefaultScene.make()
        var key = scene.node("key-light")!
        if case .light(var p) = key.params { p.intensity = 40; key.params = .light(p) }
        ScenePatcher.apply(AssistantPatch(summary: "dimmet", updatedNodes: [key],
                                          removedNodeIds: nil, environment: nil, shots: nil),
                           to: &scene)
        XCTAssertEqual(lightParams(scene.node("key-light"))?.intensity, 40)
        XCTAssertEqual(scene.nodes.count, DefaultScene.make().nodes.count)
    }

    func testInsertNewNodeJoinsGroup() {
        var scene = DefaultScene.make()
        let newLight = Node(id: "light-ny", name: "Ny Spot", kind: .light, enabled: true,
                            transform: .identity,
                            params: .light(LightParams(type: .spot, intensity: 50, temperatureK: 5000,
                                                       beamDeg: 40, castsShadows: false, quality: "Medium")))
        ScenePatcher.apply(AssistantPatch(summary: "la til", updatedNodes: [newLight],
                                          removedNodeIds: nil, environment: nil, shots: nil),
                           to: &scene)
        XCTAssertNotNil(scene.node("light-ny"))
        XCTAssertTrue(scene.groups.first { $0.id == "lights" }!.childIds.contains("light-ny"))
    }

    func testRemoveNodeCleansGroupsAndShots() {
        var scene = DefaultScene.make()
        ScenePatcher.apply(AssistantPatch(summary: "fjernet kamera C", updatedNodes: nil,
                                          removedNodeIds: ["camera-c"], environment: nil, shots: nil),
                           to: &scene)
        XCTAssertNil(scene.node("camera-c"))
        XCTAssertFalse(scene.groups.flatMap(\.childIds).contains("camera-c"))
        XCTAssertFalse(scene.shots.contains { $0.cameraNodeId == "camera-c" })
    }

    func testShotsReplacementFiltersUnknownCameras() {
        var scene = DefaultScene.make()
        let shots = [Shot(id: "s1", name: "OK", cameraNodeId: "camera-a", durationSec: 3),
                     Shot(id: "s2", name: "Ukjent", cameraNodeId: "finnes-ikke", durationSec: 3)]
        ScenePatcher.apply(AssistantPatch(summary: "nye shots", updatedNodes: nil,
                                          removedNodeIds: nil, environment: "city-night", shots: shots),
                           to: &scene)
        XCTAssertEqual(scene.shots.map(\.id), ["s1"])
        XCTAssertEqual(scene.environment, "city-night")
    }

    func testEmptyPatchIsNoop() {
        var scene = DefaultScene.make()
        let before = scene
        let patch = AssistantPatch(summary: "ingenting", updatedNodes: nil,
                                   removedNodeIds: nil, environment: nil, shots: nil)
        XCTAssertTrue(patch.isEmpty)
        ScenePatcher.apply(patch, to: &scene)
        XCTAssertEqual(scene, before)
    }

    func testPatchDecodesFromBackendJSON() throws {
        // samme form som backend-svaret — updatedNodes i Swift-Codable-formen
        let node = DefaultScene.make().node("key-light")!
        let nodeJSON = String(data: try JSONEncoder().encode(node), encoding: .utf8)!
        let json = #"{"summary":"ok","updatedNodes":[\#(nodeJSON)],"removedNodeIds":["x"]}"#
        let patch = try JSONDecoder().decode(AssistantPatch.self, from: Data(json.utf8))
        XCTAssertEqual(patch.updatedNodes?.first?.id, "key-light")
        XCTAssertEqual(patch.removedNodeIds, ["x"])
        XCTAssertNil(patch.shots)
    }
}
