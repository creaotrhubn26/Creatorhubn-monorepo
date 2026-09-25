import Foundation
import simd

enum NodeKind: String, Codable, Sendable { case light, camera, talent, prop }

struct Transform: Codable, Equatable, Sendable {
    var position: SIMD3<Float>
    var rotationEulerDeg: SIMD3<Float>
    var scale: SIMD3<Float>
    static let identity = Transform(position: .zero, rotationEulerDeg: .zero, scale: .one)
}

enum LightType: String, Codable, Sendable, CaseIterable { case spot, area }

struct LightParams: Codable, Equatable, Sendable {
    var type: LightType
    var intensity: Double      // 0–100
    var temperatureK: Double
    var beamDeg: Double
    var castsShadows: Bool
    var quality: String        // Low/Medium/High
}

struct CameraParams: Codable, Equatable, Sendable {
    var focalMm: Double
    var aperture: String
    var iso: Int
    var shutter: String
    var dofEnabled: Bool       // lagres i v1, render-effekt kommer senere
}

struct TalentParams: Codable, Equatable, Sendable {
    var seat: String
    var eyeline: Bool
    var marker: String
}

enum PropShape: String, Codable, Sendable { case box, plane, cylinder, capsule, stage }

struct PropParams: Codable, Equatable, Sendable {
    var material: String
    var shape: PropShape
}

enum NodeParams: Codable, Equatable, Sendable {
    case light(LightParams)
    case camera(CameraParams)
    case talent(TalentParams)
    case prop(PropParams)
}

struct Node: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var kind: NodeKind
    var enabled: Bool
    var transform: Transform
    var params: NodeParams
}

struct Group: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var childIds: [String]
}

struct Shot: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var cameraNodeId: String
    var durationSec: Double
}

struct SceneData: Codable, Equatable, Sendable {
    var nodes: [Node]
    var groups: [Group]
    var environment: String
    var shots: [Shot]

    func node(_ id: String) -> Node? { nodes.first { $0.id == id } }
}
