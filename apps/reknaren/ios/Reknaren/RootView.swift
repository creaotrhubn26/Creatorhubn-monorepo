import SwiftUI

/// Navigasjons-mål. Speiler web-nav; utvides fase for fase. `NavigationSplitView`
/// gir sidebar på iPad og kollapser automatisk til stack på iPhone → universell.
enum Screen: String, CaseIterable, Identifiable {
    case overview, bank
    var id: String { rawValue }

    var label: String {
        switch self {
        case .overview: return "Oversikt"
        case .bank: return "Bank og avstemming"
        }
    }
    var systemImage: String {
        switch self {
        case .overview: return "square.grid.2x2"
        case .bank: return "building.columns"
        }
    }
    var section: String {
        switch self {
        case .overview, .bank: return "Virksomhet"
        }
    }
}

struct RootView: View {
    @Environment(Session.self) private var session
    @State private var selection: Screen? = .overview

    private var sections: [(name: String, items: [Screen])] {
        Dictionary(grouping: Screen.allCases, by: \.section)
            .map { ($0.key, $0.value) }
            .sorted { $0.name < $1.name }
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                ForEach(sections, id: \.name) { section in
                    Section(section.name) {
                        ForEach(section.items) { screen in
                            Label(screen.label, systemImage: screen.systemImage).tag(screen)
                        }
                    }
                }
            }
            .navigationTitle("Reknaren")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Logg ut") { Task { await session.signOut() } }
                }
            }
        } detail: {
            switch selection {
            case .overview, .none: OverviewView()
            case .bank: PlaceholderView(title: "Bank og avstemming",
                                        note: "Kommer i Fase 1: transaksjoner, «hva dette kan være», Finn kvittering, «betalte du privat?».")
            }
        }
    }
}

struct PlaceholderView: View {
    let title: String
    let note: String
    var body: some View {
        ContentUnavailableView(title, systemImage: "hammer", description: Text(note))
            .navigationTitle(title)
    }
}
