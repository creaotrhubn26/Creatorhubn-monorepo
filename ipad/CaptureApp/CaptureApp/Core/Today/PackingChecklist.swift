import Foundation
import Observation

/// "Klar før avreise" packing checklist. Native + persisted locally
/// (UserDefaults) so it survives launches and works fully offline — the
/// photographer ticks gear off before heading out. Sync to the backend
/// can be layered later behind the same model; there's no server endpoint
/// for it yet, so it's deliberately device-local for now.
@MainActor
@Observable
final class PackingChecklist {
    struct Item: Codable, Identifiable, Hashable, Sendable {
        let id: UUID
        var name: String
        var packed: Bool
        init(id: UUID = UUID(), name: String, packed: Bool = false) {
            self.id = id; self.name = name; self.packed = packed
        }
    }

    private(set) var items: [Item] {
        didSet { persist() }
    }

    private let key = "creatorhub.packing.checklist.v1"

    var packedCount: Int { items.filter(\.packed).count }
    var total: Int { items.count }

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([Item].self, from: data) {
            items = decoded
        } else {
            items = Self.defaultGear
        }
    }

    func toggle(_ item: Item) {
        guard let idx = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[idx].packed.toggle()
    }

    func add(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        items.append(Item(name: trimmed))
    }

    func remove(_ item: Item) {
        items.removeAll { $0.id == item.id }
    }

    /// Reset the packed flags for the next shoot (keeps the gear list).
    func resetPacked() {
        for i in items.indices { items[i].packed = false }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private static let defaultGear: [Item] = [
        .init(name: "Canon R5"),
        .init(name: "RF 24–70mm f/2.8L"),
        .init(name: "RF 85mm f/1.2L"),
        .init(name: "Batterier x4"),
        .init(name: "CFexpress-kort"),
        .init(name: "LED-lys (Aputure 120d)"),
        .init(name: "Diffuser / reflektor"),
    ]
}
