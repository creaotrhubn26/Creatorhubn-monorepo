import Foundation
import simd

/// RoomPlan-skann → scene-noder. Konverteringen tar rene structs (testbar
/// uten LiDAR); det tynne CapturedRoom-uttrekket bor i RoomScanSheet
/// (bak `canImport`/isSupported-gaten).
struct ScannedSurface: Sendable {
    enum Kind: String, Sendable { case wall, floor, door, window, opening, object }
    var kind: Kind
    var dimensions: SIMD3<Float>   // bredde, høyde, dybde (RoomPlan-konvensjon)
    var transform: float4x4        // world-transform fra skannet
}

enum RoomScanImporter {
    static let groupId = "scanned-room"

    /// Fabrikkerer prop-noder fra skannede flater. Vegger/dører/vinduer = tynne
    /// bokser, gulv = plan, objekter = bokser.
    static func nodes(from surfaces: [ScannedSurface]) -> [Node] {
        surfaces.enumerated().compactMap { index, surface in
            guard surface.kind != .opening else { return nil } // åpninger trenger ikke geometri
            let position = SIMD3<Float>(surface.transform.columns.3.x,
                                        surface.transform.columns.3.y,
                                        surface.transform.columns.3.z)
            // ponytail: kun yaw ekstraheres — RoomPlan-flater er i praksis
            // aksealignerte vertikalt; full euler-dekomponering ved behov.
            let yawDeg = atan2(surface.transform.columns.0.z,
                               surface.transform.columns.0.x) * -180 / .pi
            let (shape, material, scale): (PropShape, String, SIMD3<Float>) = switch surface.kind {
            case .floor:
                (.plane, "Skannet gulv", SIMD3(surface.dimensions.x, 1, max(surface.dimensions.z, surface.dimensions.y)))
            case .wall, .opening:
                (.box, "Skannet vegg", SIMD3(surface.dimensions.x, surface.dimensions.y, 0.1))
            case .door:
                (.box, "Skannet dør", SIMD3(surface.dimensions.x, surface.dimensions.y, 0.06))
            case .window:
                (.box, "Skannet vindu", SIMD3(surface.dimensions.x, surface.dimensions.y, 0.05))
            case .object:
                (.box, "Skannet objekt", simd_max(surface.dimensions, SIMD3(repeating: 0.05)))
            }
            return Node(
                id: "scan-\(surface.kind.rawValue)-\(index)",
                name: "\(material) \(index + 1)",
                kind: .prop,
                enabled: true,
                transform: Transform(position: position,
                                     rotationEulerDeg: [0, yawDeg, 0],
                                     scale: scale),
                params: .prop(PropParams(material: material, shape: shape))
            )
        }
    }

    /// Legger skannet inn i scenen som én mutasjon (kalles inne i document.mutate):
    /// erstatter ev. tidligere skann (samme gruppe) — nytt skann = nytt rom.
    static func apply(nodes: [Node], to scene: inout SceneData) {
        let oldIds = Set(scene.groups.first { $0.id == groupId }?.childIds ?? [])
        scene.nodes.removeAll { oldIds.contains($0.id) }
        scene.groups.removeAll { $0.id == groupId }
        guard !nodes.isEmpty else { return }
        scene.nodes.append(contentsOf: nodes)
        scene.groups.append(Group(id: groupId, name: "Scanned Room", childIds: nodes.map(\.id)))
    }
}
