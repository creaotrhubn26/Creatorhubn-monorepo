import XCTest
import Metal
@testable import StageOne

final class RendererSmokeTests: XCTestCase {
    private func readPixels(_ tex: MTLTexture) -> [UInt8] {
        var pixels = [UInt8](repeating: 0, count: tex.width * tex.height * 4)
        pixels.withUnsafeMutableBytes { raw in
            tex.getBytes(raw.baseAddress!, bytesPerRow: tex.width * 4,
                         from: MTLRegionMake2D(0, 0, tex.width, tex.height), mipmapLevel: 0)
        }
        return pixels
    }

    private func avgLuma(_ pixels: [UInt8]) -> Double {
        var sum = 0.0
        for i in stride(from: 0, to: pixels.count, by: 4) {
            sum += (Double(pixels[i]) + Double(pixels[i + 1]) + Double(pixels[i + 2])) / (3 * 255)
        }
        return sum / Double(pixels.count / 4)
    }

    @MainActor func testOffscreenRenderIsNotBlank() throws {
        let renderer = try StageRenderer()
        let scene = DefaultScene.make()
        let cam = RenderCamera.from(node: scene.node("camera-a")!)
        let tex = try renderer.renderOffscreen(scene: scene, camera: cam, width: 640, height: 360)
        let pixels = readPixels(tex)
        let unique = Set(stride(from: 0, to: pixels.count, by: 4).map { pixels[$0] })
        XCTAssertGreaterThan(unique.count, 8, "render ser blank/ensfarget ut")
    }

    @MainActor func testLightsAffectImage() throws {
        let renderer = try StageRenderer()
        var scene = DefaultScene.make()
        let cam = RenderCamera.from(node: scene.node("camera-a")!)
        let lit = try renderer.renderOffscreen(scene: scene, camera: cam, width: 320, height: 180)
        for i in scene.nodes.indices where scene.nodes[i].kind == .light {
            scene.nodes[i].enabled = false
        }
        let dark = try renderer.renderOffscreen(scene: scene, camera: cam, width: 320, height: 180)
        XCTAssertGreaterThan(avgLuma(readPixels(lit)), avgLuma(readPixels(dark)) + 0.02)
    }
}
