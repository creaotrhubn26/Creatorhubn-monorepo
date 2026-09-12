import Foundation
import simd

enum EditorTool: String, CaseIterable, Sendable { case select, move, rotate, scale }

enum ViewPreset: String, CaseIterable, Sendable { case front, back, left, right, top }

struct OrbitCamera: Equatable, Sendable {
    var target: SIMD3<Float>
    var distance: Float
    var azimuthDeg: Float
    var elevationDeg: Float

    static let `default` = OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: 0, elevationDeg: 18)
    static let editorFovY: Float = 2 * atan(12.0 / 35.0) // 35mm-ekvivalent

    func renderCamera() -> RenderCamera {
        let az = azimuthDeg * .pi / 180
        let el = min(max(elevationDeg, -89), 89) * .pi / 180
        let eye = target + SIMD3<Float>(
            distance * cos(el) * sin(az),
            distance * sin(el),
            distance * cos(el) * cos(az)
        )
        return RenderCamera(position: eye, target: target, fovYRadians: Self.editorFovY)
    }

    static func preset(_ preset: ViewPreset) -> OrbitCamera {
        switch preset {
        case .front: OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: 0, elevationDeg: 12)
        case .back: OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: 180, elevationDeg: 12)
        case .left: OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: -90, elevationDeg: 12)
        case .right: OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: 90, elevationDeg: 12)
        case .top: OrbitCamera(target: [0, 0, 0], distance: 10, azimuthDeg: 0, elevationDeg: 88)
        }
    }
}
