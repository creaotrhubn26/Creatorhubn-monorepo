import XCTest
import simd
@testable import StageOne

final class RenderMathTests: XCTestCase {
    func testKelvinToRGB() {
        let warm = kelvinToRGB(2000)
        let neutral = kelvinToRGB(6600)
        let cold = kelvinToRGB(10000)
        XCTAssertGreaterThan(warm.x, warm.z)
        XCTAssertGreaterThan(cold.z, cold.x)
        for c in [neutral.x, neutral.y, neutral.z] { XCTAssertEqual(c, 1.0, accuracy: 0.15) }
    }

    func testMeshesAreSane() {
        for shape in [PropShape.box, .plane, .cylinder, .capsule, .stage] {
            let m = MeshFactory.mesh(for: shape)
            XCTAssertFalse(m.vertices.isEmpty, "\(shape)")
            XCTAssertFalse(m.indices.isEmpty, "\(shape)")
            XCTAssertEqual(m.indices.count % 3, 0, "\(shape)")
            for v in m.vertices {
                XCTAssertEqual(simd_length(v.normal), 1.0, accuracy: 0.01, "\(shape)")
                XCTAssertTrue(all(v.position .>= m.boundsMin - 0.001) && all(v.position .<= m.boundsMax + 0.001), "\(shape)")
            }
            XCTAssertLessThanOrEqual(Int(m.indices.max() ?? 0), m.vertices.count - 1, "\(shape)")
        }
    }

    func testModelMatrixTranslates() {
        var t = Transform.identity
        t.position = [1, 2, 3]
        let p = float4x4.model(t) * SIMD4<Float>(0, 0, 0, 1)
        XCTAssertEqual(p.x, 1, accuracy: 0.001)
        XCTAssertEqual(p.y, 2, accuracy: 0.001)
        XCTAssertEqual(p.z, 3, accuracy: 0.001)
    }

    func testLookAtPerspectiveProjectsCenterForward() {
        let view = float4x4.lookAt(eye: [0, 0, 5], center: .zero, up: [0, 1, 0])
        let proj = float4x4.perspective(fovYRadians: .pi / 3, aspect: 16 / 9, near: 0.1, far: 100)
        let clip = proj * view * SIMD4<Float>(0, 0, 0, 1)
        let ndc = SIMD3<Float>(clip.x, clip.y, clip.z) / clip.w
        XCTAssertEqual(ndc.x, 0, accuracy: 0.001)
        XCTAssertEqual(ndc.y, 0, accuracy: 0.001)
        XCTAssertTrue(ndc.z > 0 && ndc.z < 1)
    }
}
