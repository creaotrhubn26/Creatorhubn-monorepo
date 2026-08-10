import XCTest
import simd
@testable import StageOne

final class Fase6Tests: XCTestCase {
    // MARK: - RealityScene

    @MainActor func testRealitySceneEntityPerEnabledNode() {
        var scene = DefaultScene.make()
        for i in scene.nodes.indices where scene.nodes[i].id == "guest" {
            scene.nodes[i].enabled = false
        }
        let root = RealityScene.makeRoot(scene: scene)
        let enabledCount = scene.nodes.filter(\.enabled).count
        XCTAssertEqual(root.children.count, enabledCount)
        XCTAssertNil(root.children.first { $0.name == "guest" })
        XCTAssertEqual(root.scale.x, 0.1, accuracy: 0.001)
        // node-transform mappes
        let key = root.children.first { $0.name == "key-light" }
        XCTAssertNotNil(key)
        XCTAssertEqual(key!.position.x, 2.45, accuracy: 0.01)
    }

    @MainActor func testMeshResourceGeneratesForAllKinds() throws {
        let scene = DefaultScene.make()
        for id in ["floor", "stage", "chair-left", "host", "camera-a"] {
            let node = scene.node(id)!
            XCTAssertNoThrow(try RealityScene.meshResource(for: node), id)
        }
    }

    // MARK: - RoomScanImporter

    private func surface(_ kind: ScannedSurface.Kind, dims: SIMD3<Float>,
                         position: SIMD3<Float>, yawDeg: Float = 0) -> ScannedSurface {
        // samme konvensjon som float4x4.model (Ry(+θ)) — importeren skal gi θ tilbake
        var t = float4x4.rotation(axis: [0, 1, 0], radians: yawDeg * .pi / 180)
        t.columns.3 = SIMD4<Float>(position, 1)
        return ScannedSurface(kind: kind, dimensions: dims, transform: t)
    }

    func testScanImportMapsSurfaces() {
        let surfaces = [
            surface(.wall, dims: [4, 2.5, 0], position: [0, 1.25, -2]),
            surface(.wall, dims: [3, 2.5, 0], position: [-2, 1.25, 0], yawDeg: 90),
            surface(.floor, dims: [4, 3, 0], position: [0, 0, 0]),
            surface(.door, dims: [0.9, 2.1, 0], position: [1, 1.05, -2]),
            surface(.opening, dims: [1, 2, 0], position: [0, 1, 0]),
            surface(.object, dims: [0.8, 0.75, 0.6], position: [0.5, 0.37, -1]),
        ]
        let nodes = RoomScanImporter.nodes(from: surfaces)
        XCTAssertEqual(nodes.count, 5) // opening hoppes over
        // vegg 2 har yaw ~90
        let wall2 = nodes[1]
        XCTAssertEqual(wall2.transform.rotationEulerDeg.y, 90, accuracy: 1)
        XCTAssertEqual(wall2.transform.position.x, -2, accuracy: 0.001)
        // gulvet blir plan
        guard case .prop(let floorParams) = nodes[2].params else { return XCTFail() }
        XCTAssertEqual(floorParams.shape, .plane)
        // alle er props
        XCTAssertTrue(nodes.allSatisfy { $0.kind == .prop })
    }

    func testScanApplyReplacesPreviousScan() {
        var scene = DefaultScene.make()
        let originalCount = scene.nodes.count
        let first = RoomScanImporter.nodes(from: [
            surface(.wall, dims: [4, 2.5, 0], position: [0, 1.25, -2]),
            surface(.wall, dims: [4, 2.5, 0], position: [0, 1.25, 2]),
        ])
        RoomScanImporter.apply(nodes: first, to: &scene)
        XCTAssertEqual(scene.nodes.count, originalCount + 2)
        XCTAssertNotNil(scene.groups.first { $0.id == RoomScanImporter.groupId })

        let second = RoomScanImporter.nodes(from: [
            surface(.wall, dims: [3, 2.4, 0], position: [1, 1.2, 0]),
        ])
        RoomScanImporter.apply(nodes: second, to: &scene)
        XCTAssertEqual(scene.nodes.count, originalCount + 1, "nytt skann erstatter gammelt")
        XCTAssertEqual(scene.groups.first { $0.id == RoomScanImporter.groupId }?.childIds.count, 1)
    }

    func testScanNodesSurviveCodableRoundtrip() throws {
        var scene = DefaultScene.make()
        RoomScanImporter.apply(
            nodes: RoomScanImporter.nodes(from: [surface(.wall, dims: [4, 2.5, 0], position: [0, 1.25, -2])]),
            to: &scene)
        let data = try JSONEncoder().encode(scene)
        let back = try JSONDecoder().decode(SceneData.self, from: data)
        XCTAssertEqual(scene, back)
    }
}
