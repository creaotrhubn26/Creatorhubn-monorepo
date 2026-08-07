import XCTest
@testable import StageOne

final class LightPresetTests: XCTestCase {
    @MainActor func testApplyPresetSingleUndo() {
        let doc = SceneDocument(data: DefaultScene.make())
        let before = doc.data
        let moody = LightPresets.all.first { $0.id == "moody" }!
        LightPresets.apply(moody, to: doc)

        guard case .light(let key)? = doc.data.node("key-light")?.params,
              case .light(let fill)? = doc.data.node("fill-light")?.params,
              case .light(let back)? = doc.data.node("back-light")?.params else { return XCTFail() }
        XCTAssertEqual(key.intensity, 70)
        XCTAssertEqual(key.temperatureK, 3400)
        XCTAssertEqual(fill.intensity, 10)
        XCTAssertEqual(back.intensity, 20)
        XCTAssertEqual(back.temperatureK, 5000, "back-preset uten temp skal ikke endre temp")

        doc.undoManager.undo()
        XCTAssertEqual(doc.data, before, "hele preseten = én undo")
    }

    func testCameraParamsDecodesWithoutRole() throws {
        let legacyJSON = #"{"focalMm":35,"aperture":"f/2.8","iso":800,"shutter":"1/50","dofEnabled":true}"#
        let p = try JSONDecoder().decode(CameraParams.self, from: Data(legacyJSON.utf8))
        XCTAssertNil(p.role)
        XCTAssertEqual(p.focalMm, 35)
    }

    func testDefaultSceneHasCameraRoles() {
        let s = DefaultScene.make()
        for id in ["camera-a", "camera-b", "camera-c"] {
            guard case .camera(let p)? = s.node(id)?.params else { return XCTFail() }
            XCTAssertNotNil(p.role, id)
        }
    }
}
