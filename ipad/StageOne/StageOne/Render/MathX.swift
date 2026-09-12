import Foundation
import simd

extension float4x4 {
    static func perspective(fovYRadians: Float, aspect: Float, near: Float, far: Float) -> float4x4 {
        let y = 1 / tan(fovYRadians * 0.5)
        let x = y / aspect
        let z = far / (near - far)
        return float4x4(
            SIMD4<Float>(x, 0, 0, 0),
            SIMD4<Float>(0, y, 0, 0),
            SIMD4<Float>(0, 0, z, -1),
            SIMD4<Float>(0, 0, z * near, 0)
        )
    }

    static func lookAt(eye: SIMD3<Float>, center: SIMD3<Float>, up: SIMD3<Float>) -> float4x4 {
        let z = simd_normalize(eye - center)
        let x = simd_normalize(simd_cross(up, z))
        let y = simd_cross(z, x)
        return float4x4(
            SIMD4<Float>(x.x, y.x, z.x, 0),
            SIMD4<Float>(x.y, y.y, z.y, 0),
            SIMD4<Float>(x.z, y.z, z.z, 0),
            SIMD4<Float>(-simd_dot(x, eye), -simd_dot(y, eye), -simd_dot(z, eye), 1)
        )
    }

    static func translation(_ t: SIMD3<Float>) -> float4x4 {
        var m = matrix_identity_float4x4
        m.columns.3 = SIMD4<Float>(t, 1)
        return m
    }

    static func scale(_ s: SIMD3<Float>) -> float4x4 {
        float4x4(diagonal: SIMD4<Float>(s, 1))
    }

    static func rotation(axis: SIMD3<Float>, radians: Float) -> float4x4 {
        float4x4(simd_quatf(angle: radians, axis: simd_normalize(axis)))
    }

    /// T · Ry · Rx · Rz · S — Euler i grader (prototypens konvensjon).
    static func model(_ t: Transform) -> float4x4 {
        let r = t.rotationEulerDeg * (Float.pi / 180)
        let rx = rotation(axis: [1, 0, 0], radians: r.x)
        let ry = rotation(axis: [0, 1, 0], radians: r.y)
        let rz = rotation(axis: [0, 0, 1], radians: r.z)
        return translation(t.position) * ry * rx * rz * scale(t.scale)
    }
}

/// Kelvin → normalisert RGB (Tanner Helland-approksimasjon), 1000–12000 K.
func kelvinToRGB(_ kelvin: Double) -> SIMD3<Float> {
    let t = min(max(kelvin, 1000), 12000) / 100
    var r: Double, g: Double, b: Double
    if t <= 66 {
        r = 255
        g = 99.4708025861 * log(t) - 161.1195681661
        b = t <= 19 ? 0 : 138.5177312231 * log(t - 10) - 305.0447927307
    } else {
        r = 329.698727446 * pow(t - 60, -0.1332047592)
        g = 288.1221695283 * pow(t - 60, -0.0755148492)
        b = 255
    }
    func clamp01(_ v: Double) -> Float { Float(min(max(v / 255, 0), 1)) }
    return SIMD3<Float>(clamp01(r), clamp01(g), clamp01(b))
}
