import Foundation
import Observation

/// A contextual field note — smarter than plain notes because it knows
/// WHERE it belongs (a shoot/project/gallery/client) and carries the
/// capture context (when/where). Surfaces on the linked entity's screen
/// and on "I dag". AI actions (summarise, extract tasks, → shotlist/
/// quote) operate on `body` — wired to the backend Claude endpoint in
/// the next layer.
struct FieldNote: Codable, Identifiable, Hashable, Sendable {
    enum ContextKind: String, Codable, Sendable, CaseIterable {
        case none, project, gallery, client, today
        var label: String {
            switch self {
            case .none: return "Generelt"
            case .project: return "Prosjekt"
            case .gallery: return "Galleri"
            case .client: return "Kunde"
            case .today: return "I dag"
            }
        }
        var icon: String {
            switch self {
            case .none: return "note.text"
            case .project: return "camera.aperture"
            case .gallery: return "photo.on.rectangle"
            case .client: return "person.crop.circle"
            case .today: return "sun.max"
            }
        }
    }

    let id: UUID
    var body: String
    var pinned: Bool
    var tags: [String]
    var contextKind: ContextKind
    var contextId: String?
    var contextLabel: String?
    /// Free-text capture context stamped at creation (e.g. "Oslo · 14:30").
    var captureContext: String?
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        body: String,
        pinned: Bool = false,
        tags: [String] = [],
        contextKind: ContextKind = .none,
        contextId: String? = nil,
        contextLabel: String? = nil,
        captureContext: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
    ) {
        self.id = id
        self.body = body
        self.pinned = pinned
        self.tags = tags
        self.contextKind = contextKind
        self.contextId = contextId
        self.contextLabel = contextLabel
        self.captureContext = captureContext
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// First line, for compact rows.
    var title: String {
        body.split(separator: "\n", maxSplits: 1).first.map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? "Tomt notat"
    }
}

/// Local-first notes store. Persists to UserDefaults JSON (offline, real);
/// can move to GRDB + backend sync once a notes API exists. `@Observable`
/// so SwiftUI surfaces update live.
@MainActor
@Observable
final class NotesStore {
    static let shared = NotesStore()

    private(set) var notes: [FieldNote] { didSet { persist() } }
    private let key = "creatorhub.notes.v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([FieldNote].self, from: data) {
            notes = decoded
        } else {
            notes = []
        }
    }

    // Sorted: pinned first, then most-recently updated.
    var sorted: [FieldNote] {
        notes.sorted { a, b in
            if a.pinned != b.pinned { return a.pinned && !b.pinned }
            return a.updatedAt > b.updatedAt
        }
    }

    var pinned: [FieldNote] { sorted.filter(\.pinned) }

    func recent(_ limit: Int = 3) -> [FieldNote] { Array(sorted.prefix(limit)) }

    /// Notes attached to a specific entity — for surfacing on shoot/gallery
    /// screens.
    func notes(for kind: FieldNote.ContextKind, id: String?) -> [FieldNote] {
        sorted.filter { $0.contextKind == kind && (id == nil || $0.contextId == id) }
    }

    func search(_ query: String) -> [FieldNote] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return sorted }
        return sorted.filter {
            $0.body.lowercased().contains(q)
                || $0.tags.contains { $0.lowercased().contains(q) }
                || ($0.contextLabel?.lowercased().contains(q) ?? false)
        }
    }

    @discardableResult
    func add(_ note: FieldNote) -> FieldNote {
        notes.append(note)
        return note
    }

    @discardableResult
    func quickAdd(_ body: String, captureContext: String? = nil) -> FieldNote? {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return add(FieldNote(body: trimmed, captureContext: captureContext))
    }

    func update(_ note: FieldNote) {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        var updated = note
        updated.updatedAt = Date()
        notes[idx] = updated
    }

    func togglePin(_ note: FieldNote) {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        notes[idx].pinned.toggle()
        notes[idx].updatedAt = Date()
    }

    func delete(_ note: FieldNote) {
        notes.removeAll { $0.id == note.id }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(notes) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
