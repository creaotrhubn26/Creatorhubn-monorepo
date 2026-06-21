import Foundation
import Observation

/// The cards the photographer can arrange on "I dag".
enum DashboardSection: String, Codable, CaseIterable, Identifiable, Sendable {
    case foresporsler
    case dagensShoots
    case klarForAvreise
    case denneUken
    case redigeringLevering
    case lysVaer
    case notater

    var id: String { rawValue }

    var title: String {
        switch self {
        case .foresporsler: return "Forespørsler"
        case .dagensShoots: return "Dagens shoots"
        case .klarForAvreise: return "Klar før avreise"
        case .denneUken: return "Denne uken"
        case .redigeringLevering: return "Redigering & levering"
        case .lysVaer: return "Lys & vær"
        case .notater: return "Notater"
        }
    }

    var icon: String {
        switch self {
        case .foresporsler: return "tray.and.arrow.down"
        case .dagensShoots: return "camera.aperture"
        case .klarForAvreise: return "bag"
        case .denneUken: return "calendar"
        case .redigeringLevering: return "tray.full"
        case .lysVaer: return "sun.haze"
        case .notater: return "note.text"
        }
    }
}

/// Per-user "I dag" layout — card order + visibility — persisted locally so
/// the photographer's arrangement is remembered across launches. Mirrors
/// ``PackingChecklist``'s UserDefaults pattern; can sync to CreatorHub later.
@MainActor
@Observable
final class DashboardLayout {
    struct Entry: Codable, Identifiable, Hashable, Sendable {
        let section: DashboardSection
        var visible: Bool
        var id: String { section.rawValue }
    }

    private(set) var entries: [Entry] { didSet { persist() } }
    /// Number of columns the cards render in (1 = full-width, easy drag;
    /// 2 = grid like the original mockup). Remembered separately.
    var columns: Int {
        didSet { UserDefaults.standard.set(columns, forKey: columnsKey) }
    }
    private let key = "creatorhub.today.layout.v1"
    private let columnsKey = "creatorhub.today.columns.v1"

    init() {
        let stored: [Entry]
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([Entry].self, from: data) {
            stored = decoded
        } else {
            stored = []
        }
        // Merge with the canonical set so sections added in a later build
        // appear (at the end, visible) without wiping the saved order.
        var merged = stored.filter { e in DashboardSection.allCases.contains(e.section) }
        let known = Set(merged.map(\.section))
        for section in DashboardSection.allCases where !known.contains(section) {
            merged.append(Entry(section: section, visible: true))
        }
        entries = merged
        let savedColumns = UserDefaults.standard.integer(forKey: columnsKey)
        columns = (savedColumns == 1 || savedColumns == 2) ? savedColumns : 1
    }

    var visibleSections: [DashboardSection] { entries.filter(\.visible).map(\.section) }

    func move(from source: IndexSet, to destination: Int) {
        entries.move(fromOffsets: source, toOffset: destination)
    }

    func setVisible(_ section: DashboardSection, _ visible: Bool) {
        guard let idx = entries.firstIndex(where: { $0.section == section }) else { return }
        entries[idx].visible = visible
    }

    func resetToDefault() {
        entries = DashboardSection.allCases.map { Entry(section: $0, visible: true) }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
