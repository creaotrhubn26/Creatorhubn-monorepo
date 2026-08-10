import Foundation
import RealityKit
import UIKit
import simd

/// Scene → RealityKit-entiteter for AR-preview (fase 6). Gjenbruker
/// MeshFactory-geometrien via MeshDescriptor så AR-utseendet matcher
/// Metal-viewporten. Kun for AR — editoren rendrer fortsatt ren Metal.
@MainActor
enum RealityScene {
    /// Rot-entitet med én barne-entitet per enabled node. `scale` er
    /// verdensskala (default 1:10 — studioet får plass på et stuegulv).
    static func makeRoot(scene: SceneData, scale: Float = 0.1) -> Entity {
        let root = Entity()
        root.scale = SIMD3<Float>(repeating: scale)
        for node in scene.nodes where node.enabled {
            root.addChild(entity(for: node, worldScale: scale))
        }
        return root
    }

    static func entity(for node: Node, worldScale: Float = 1) -> Entity {
        let entity: Entity
        if node.kind == .light, case .light(let p) = node.params {
            entity = lightEntity(params: p, worldScale: worldScale)
        } else if let mesh = try? meshResource(for: node) {
            let color = StageRenderer.baseColor(for: node)
            let material = SimpleMaterial(
                color: UIColor(red: CGFloat(color.x), green: CGFloat(color.y),
                               blue: CGFloat(color.z), alpha: 1),
                isMetallic: false)
            let model = ModelEntity(mesh: mesh, materials: [material])
            entity = model
        } else {
            entity = Entity()
        }
        entity.name = node.id
        entity.position = node.transform.position
        let r = node.transform.rotationEulerDeg * (Float.pi / 180)
        // samme rotasjonsrekkefølge som float4x4.model: Ry · Rx · Rz
        entity.orientation = simd_quatf(angle: r.y, axis: [0, 1, 0])
            * simd_quatf(angle: r.x, axis: [1, 0, 0])
            * simd_quatf(angle: r.z, axis: [0, 0, 1])
        entity.scale = node.transform.scale
        return entity
    }

    static func meshResource(for node: Node) throws -> MeshResource {
        let mesh = MeshFactory.mesh(forNodeKind: node.kind, params: node.params)
        var descriptor = MeshDescriptor(name: node.id)
        descriptor.positions = MeshBuffer(mesh.vertices.map(\.position))
        descriptor.normals = MeshBuffer(mesh.vertices.map(\.normal))
        descriptor.primitives = .triangles(mesh.indices.map(UInt32.init))
        return try MeshResource.generate(from: [descriptor])
    }

    private static func lightEntity(params: LightParams, worldScale: Float) -> Entity {
        let rgb = kelvinToRGB(params.temperatureK)
        let color = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1)
        // Lys-parametre er world-absolutte: under root.scale krymper avstandene
        // → intensitet må ned med skala² (inverse square), radius med skala.
        let intensityScale = worldScale * worldScale
        if params.type == .spot {
            let light = SpotLight()
            light.light.color = color
            light.light.intensity = Float(params.intensity) * 12000 / 100 * intensityScale
            light.light.outerAngleInDegrees = Float(params.beamDeg)
            light.light.innerAngleInDegrees = Float(params.beamDeg) * 0.6
            light.light.attenuationRadius = 12 * worldScale
            return light
        }
        let light = PointLight()
        light.light.color = color
        light.light.intensity = Float(params.intensity) * 8000 / 100 * intensityScale
        light.light.attenuationRadius = 12 * worldScale
        return light
    }
}
