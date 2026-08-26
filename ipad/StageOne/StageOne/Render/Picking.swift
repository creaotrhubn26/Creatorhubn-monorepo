import Foundation
import simd

/// Ray fra skjermpunkt gjennom kameraets frustum (unprojiser nær- og fjernplan).
func ray(fromScreenPoint p: CGPoint, viewSize: CGSize,
         camera: RenderCamera) -> (origin: SIMD3<Float>, dir: SIMD3<Float>) {
    let aspect = Float(viewSize.width / max(viewSize.height, 1))
    let view = float4x4.lookAt(eye: camera.position, center: camera.target, up: [0, 1, 0])
    let proj = float4x4.perspective(fovYRadians: camera.fovYRadians, aspect: aspect, near: 0.05, far: 100)
    let inv = (proj * view).inverse
    let ndc = SIMD2<Float>(
        Float(p.x / viewSize.width) * 2 - 1,
        1 - Float(p.y / viewSize.height) * 2
    )
    func unproject(_ z: Float) -> SIMD3<Float> {
        let clip = inv * SIMD4<Float>(ndc.x, ndc.y, z, 1)
        return SIMD3<Float>(clip.x, clip.y, clip.z) / clip.w
    }
    let near = unproject(0.01)
    let far = unproject(0.99)
    return (near, simd_normalize(far - near))
}

/// Ray-AABB (slab-metoden). Returnerer t for nærmeste treff, nil om bom.
func rayAABBIntersection(origin: SIMD3<Float>, dir: SIMD3<Float>,
                         boundsMin: SIMD3<Float>, boundsMax: SIMD3<Float>) -> Float? {
    var tMin: Float = 0
    var tMax: Float = .greatestFiniteMagnitude
    for axis in 0..<3 {
        let o = origin[axis], d = dir[axis]
        let mn = boundsMin[axis], mx = boundsMax[axis]
        if abs(d) < 1e-8 {
            if o < mn || o > mx { return nil }
        } else {
            var t1 = (mn - o) / d
            var t2 = (mx - o) / d
            if t1 > t2 { swap(&t1, &t2) }
            tMin = max(tMin, t1)
            tMax = min(tMax, t2)
            if tMin > tMax { return nil }
        }
    }
    return tMin
}

/// Nærmeste enablede node truffet av strålen (world-space AABB per node).
func pickNode(in scene: SceneData, rayOrigin: SIMD3<Float>, rayDir: SIMD3<Float>) -> String? {
    var best: (id: String, t: Float)?
    for node in scene.nodes where node.enabled {
        let mesh = MeshFactory.mesh(forNodeKind: node.kind, params: node.params)
        let bounds = worldBounds(mesh: mesh, transform: node.transform)
        guard let t = rayAABBIntersection(origin: rayOrigin, dir: rayDir,
                                          boundsMin: bounds.min, boundsMax: bounds.max) else { continue }
        if best == nil || t < best!.t { best = (node.id, t) }
    }
    return best?.id
}
