import XCTest
@testable import StageOne

final class SceneModelTests: XCTestCase {
    func testCodableRoundtrip() throws {
        let scene = DefaultScene.make()
        let data = try JSONEncoder().encode(scene)
        let back = try JSONDecoder().decode(SceneData.self, from: data)
        XCTAssertEqual(scene, back)
    }

    func testDefaultSceneContents() {
        let s = DefaultScene.make()
        XCTAssertEqual(s.nodes.filter { $0.kind == .light }.count, 3)
        XCTAssertEqual(s.nodes.filter { $0.kind == .camera }.count, 3)
        XCTAssertEqual(s.nodes.filter { $0.kind == .talent }.count, 2)
        XCTAssertNotNil(s.node("key-light"))
        XCTAssertEqual(s.shots.count, 5)
        for shot in s.shots { XCTAssertEqual(s.node(shot.cameraNodeId)?.kind, .camera) }
        for g in s.groups { for c in g.childIds { XCTAssertNotNil(s.node(c), "gruppe \(g.id) refererer ukjent node \(c)") } }
    }

    @MainActor func testMutateRegistersUndo() {
        let doc = SceneDocument(data: DefaultScene.make())
        let before = doc.data
        doc.updateNode("key-light") { node in
            if case .light(var p) = node.params { p.intensity = 12; node.params = .light(p) }
        }
        XCTAssertNotEqual(doc.data, before)
        XCTAssertTrue(doc.undoManager.canUndo)
        doc.undoManager.undo()
        XCTAssertEqual(doc.data, before)
    }

    @MainActor func testTransientMutationSingleUndo() {
        let doc = SceneDocument(data: DefaultScene.make())
        let before = doc.data
        // simulert slider-drag: mange transiente endringer, én commit
        for v in stride(from: 85.0, through: 20.0, by: -5) {
            doc.updateNodeTransient("key-light") { n in
                if case .light(var p) = n.params { p.intensity = v; n.params = .light(p) }
            }
        }
        doc.commitTransient(from: before)
        XCTAssertTrue(doc.undoManager.canUndo)
        doc.undoManager.undo()
        XCTAssertEqual(doc.data, before)
        XCTAssertFalse(doc.undoManager.canUndo)
    }
}
