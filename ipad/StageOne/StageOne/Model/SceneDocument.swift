import Foundation
import Observation

@Observable @MainActor
final class SceneDocument {
    var data: SceneData
    var selectedNodeId: String?
    @ObservationIgnored let undoManager = UndoManager()

    init(data: SceneData) {
        self.data = data
        undoManager.groupsByEvent = false
    }

    /// All mutasjon går her — registrerer helhets-snapshot for undo.
    func mutate(_ change: (inout SceneData) -> Void) {
        registerUndoSnapshot(data)
        change(&data)
    }

    func updateNode(_ id: String, _ change: (inout Node) -> Void) {
        mutate { scene in
            guard let i = scene.nodes.firstIndex(where: { $0.id == id }) else { return }
            change(&scene.nodes[i])
        }
    }

    /// Muterer uten undo — for live slider-/gesture-drag. Kall `commitTransient(from:)`
    /// med snapshot tatt FØR draget for én samlet undo-registrering.
    func updateNodeTransient(_ id: String, _ change: (inout Node) -> Void) {
        guard let i = data.nodes.firstIndex(where: { $0.id == id }) else { return }
        change(&data.nodes[i])
    }

    func commitTransient(from snapshot: SceneData) {
        guard snapshot != data else { return }
        registerUndoSnapshot(snapshot)
    }

    private func registerUndoSnapshot(_ snapshot: SceneData) {
        undoManager.beginUndoGrouping()
        undoManager.registerUndo(withTarget: self) { doc in
            MainActor.assumeIsolated { doc.mutate { $0 = snapshot } }
        }
        undoManager.endUndoGrouping()
    }
}
