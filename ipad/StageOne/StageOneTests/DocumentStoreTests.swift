import XCTest
@testable import StageOne

final class DocumentStoreTests: XCTestCase {
    func testSaveLoadRoundtrip() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let store = DocumentStore(directory: dir)
        let scene = DefaultScene.make()
        try store.save(scene, id: "test-scene")
        let back = try store.load(id: "test-scene")
        XCTAssertEqual(scene, back)
        XCTAssertEqual(store.listSceneIds(), ["test-scene"])
    }
}
