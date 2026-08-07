import Foundation

/// Patch fra AI-assistenten (POST /api/stageone/assistant).
/// Kompakt: kun endrede/nye noder + fjernede id-er + ev. environment/shots.
struct AssistantPatch: Codable, Sendable {
    var summary: String
    var updatedNodes: [Node]?
    var removedNodeIds: [String]?
    var environment: String?
    var shots: [Shot]?

    var isEmpty: Bool {
        (updatedNodes?.isEmpty ?? true) && (removedNodeIds?.isEmpty ?? true)
            && environment == nil && shots == nil
    }
}

enum ScenePatcher {
    /// Appliserer patchen. Ren funksjon — kalles inne i én `document.mutate`
    /// så hele AI-endringen blir én undo.
    static func apply(_ patch: AssistantPatch, to scene: inout SceneData) {
        for node in patch.updatedNodes ?? [] {
            if let i = scene.nodes.firstIndex(where: { $0.id == node.id }) {
                scene.nodes[i] = node
            } else {
                scene.nodes.append(node)
                addToGroup(nodeId: node.id, kind: node.kind, scene: &scene)
            }
        }
        for id in patch.removedNodeIds ?? [] {
            scene.nodes.removeAll { $0.id == id }
            for i in scene.groups.indices {
                scene.groups[i].childIds.removeAll { $0 == id }
            }
            scene.shots.removeAll { $0.cameraNodeId == id }
        }
        if let environment = patch.environment {
            scene.environment = environment
        }
        if let shots = patch.shots {
            // behold kun shots som peker på ekte kameraer
            scene.shots = shots.filter { scene.node($0.cameraNodeId)?.kind == .camera }
        }
    }

    private static func addToGroup(nodeId: String, kind: NodeKind, scene: inout SceneData) {
        let groupId = switch kind {
        case .light: "lights"
        case .camera: "cameras"
        case .talent: "talent"
        case .prop: "studio"
        }
        if let i = scene.groups.firstIndex(where: { $0.id == groupId }) {
            scene.groups[i].childIds.append(nodeId)
        } else {
            scene.groups.append(Group(id: groupId, name: groupId.capitalized, childIds: [nodeId]))
        }
    }
}
