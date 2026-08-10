import Foundation
import simd

/// GPU-vertex. `pad`-felter gir 16-byte-alignment som matcher MSL `float3`-layout.
struct Vertex: Sendable {
    var position: SIMD3<Float>
    var pad0: Float = 0
    var normal: SIMD3<Float>
    var pad1: Float = 0

    init(_ p: SIMD3<Float>, _ n: SIMD3<Float>) {
        position = p
        normal = n
    }
}

struct Mesh: Sendable {
    var vertices: [Vertex]
    var indices: [UInt16]
    var boundsMin: SIMD3<Float>
    var boundsMax: SIMD3<Float>

    init(vertices: [Vertex], indices: [UInt16]) {
        self.vertices = vertices
        self.indices = indices
        var mn = SIMD3<Float>(repeating: .greatestFiniteMagnitude)
        var mx = -mn
        for v in vertices {
            mn = simd_min(mn, v.position)
            mx = simd_max(mx, v.position)
        }
        boundsMin = mn
        boundsMax = mx
    }
}

/// Genererte enhets-primitiver (skaleres via Transform.scale).
enum MeshFactory {
    private static let segments = 24

    static func mesh(for shape: PropShape) -> Mesh {
        switch shape {
        case .box: box()
        case .plane: plane()
        case .cylinder: cylinder()
        case .capsule: capsule()
        case .stage: stage()
        }
    }

    static func mesh(forNodeKind kind: NodeKind, params: NodeParams) -> Mesh {
        switch params {
        case .prop(let p): mesh(for: p.shape)
        case .talent: mesh(for: .capsule)
        case .light, .camera: box(half: [0.12, 0.12, 0.12]) // ikon-proxy
        }
    }

    /// Boks sentrert i origo, per-face-normaler. Default halvmål 0.5 (enhetskube).
    static func box(half h: SIMD3<Float> = [0.5, 0.5, 0.5]) -> Mesh {
        var verts: [Vertex] = []
        var idx: [UInt16] = []
        // (normal, u-akse, v-akse)
        let faces: [(SIMD3<Float>, SIMD3<Float>, SIMD3<Float>)] = [
            ([1, 0, 0], [0, 0, -1], [0, 1, 0]), ([-1, 0, 0], [0, 0, 1], [0, 1, 0]),
            ([0, 1, 0], [1, 0, 0], [0, 0, -1]), ([0, -1, 0], [1, 0, 0], [0, 0, 1]),
            ([0, 0, 1], [1, 0, 0], [0, 1, 0]), ([0, 0, -1], [-1, 0, 0], [0, 1, 0]),
        ]
        for (n, u, v) in faces {
            let base = UInt16(verts.count)
            let c = n * h
            let ue = u * h, ve = v * h
            verts.append(Vertex(c - ue - ve, n))
            verts.append(Vertex(c + ue - ve, n))
            verts.append(Vertex(c + ue + ve, n))
            verts.append(Vertex(c - ue + ve, n))
            idx += [base, base + 1, base + 2, base, base + 2, base + 3]
        }
        return Mesh(vertices: verts, indices: idx)
    }

    /// Horisontalt enhets-plan (1×1) i y=0, normal opp.
    static func plane() -> Mesh {
        let n = SIMD3<Float>(0, 1, 0)
        let verts = [
            Vertex([-0.5, 0, -0.5], n), Vertex([0.5, 0, -0.5], n),
            Vertex([0.5, 0, 0.5], n), Vertex([-0.5, 0, 0.5], n),
        ]
        return Mesh(vertices: verts, indices: [0, 2, 1, 0, 3, 2])
    }

    /// Sylinder r=0.5, høyde 1, sentrert i origo.
    static func cylinder(radius: Float = 0.5, height: Float = 1, capped: Bool = true) -> Mesh {
        var verts: [Vertex] = []
        var idx: [UInt16] = []
        let h = height / 2
        for i in 0...segments {
            let a = Float(i) / Float(segments) * 2 * .pi
            let n = SIMD3<Float>(cos(a), 0, sin(a))
            verts.append(Vertex(n * radius + [0, -h, 0], n))
            verts.append(Vertex(n * radius + [0, h, 0], n))
        }
        for i in 0..<segments {
            let b = UInt16(i * 2)
            // CCW sett utenfra — RealityKit backface-culler (Metal-passet culler ikke)
            idx += [b, b + 1, b + 2, b + 2, b + 1, b + 3]
        }
        if capped {
            for (y, n) in [(h, SIMD3<Float>(0, 1, 0)), (-h, SIMD3<Float>(0, -1, 0))] {
                let center = UInt16(verts.count)
                verts.append(Vertex([0, y, 0], n))
                for i in 0...segments {
                    let a = Float(i) / Float(segments) * 2 * .pi
                    verts.append(Vertex([cos(a) * radius, y, sin(a) * radius], n))
                }
                for i in 0..<segments {
                    let b = center + 1 + UInt16(i)
                    idx += n.y > 0 ? [center, b + 1, b] : [center, b, b + 1]
                }
            }
        }
        return Mesh(vertices: verts, indices: idx)
    }

    /// Kapsel: total høyde 2 (sylinderdel 1 + halvkuler r=0.5), sentrert i origo.
    static func capsule(radius: Float = 0.5, cylinderHeight: Float = 1) -> Mesh {
        var verts: [Vertex] = []
        var idx: [UInt16] = []
        let rings = 8
        let h = cylinderHeight / 2
        // stabler: nedre halvkule (rings), sylinderskjøt, øvre halvkule
        var stacks: [(y: Float, r: Float, ny: Float)] = []
        for i in 0...rings {
            let a = -Float.pi / 2 + Float(i) / Float(rings) * (.pi / 2)
            stacks.append((y: -h + sin(a) * radius, r: cos(a) * radius, ny: sin(a)))
        }
        for i in 0...rings {
            let a = Float(i) / Float(rings) * (.pi / 2)
            stacks.append((y: h + sin(a) * radius, r: cos(a) * radius, ny: sin(a)))
        }
        for s in stacks {
            for i in 0...segments {
                let a = Float(i) / Float(segments) * 2 * .pi
                let radial = SIMD3<Float>(cos(a), 0, sin(a))
                let p = radial * s.r + SIMD3<Float>(0, s.y, 0)
                let n = simd_normalize(radial * cos(asin(min(max(s.ny, -1), 1))) + SIMD3<Float>(0, s.ny, 0))
                verts.append(Vertex(p, n))
            }
        }
        let cols = segments + 1
        for s in 0..<(stacks.count - 1) {
            for i in 0..<segments {
                let a = UInt16(s * cols + i)
                let b = UInt16((s + 1) * cols + i)
                idx += [a, b, a + 1, a + 1, b, b + 1]
            }
        }
        return Mesh(vertices: verts, indices: idx)
    }

    /// Scene-riser: flat sylinder r=1, høyde 0.15, står PÅ y=0 (topp 0.15).
    static func stage() -> Mesh {
        var m = cylinder(radius: 1, height: 0.15)
        let lifted = m.vertices.map { v in
            Vertex(v.position + SIMD3<Float>(0, 0.075, 0), v.normal)
        }
        m = Mesh(vertices: lifted, indices: m.indices)
        return m
    }
}
