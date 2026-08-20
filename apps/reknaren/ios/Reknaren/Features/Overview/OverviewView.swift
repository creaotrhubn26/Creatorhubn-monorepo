import SwiftUI

struct Organization: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let orgForm: String?
    let vatStatus: String?
    let orgNumber: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case orgForm = "org_form"
        case vatStatus = "vat_status"
        case orgNumber = "org_number"
    }
}

@MainActor
@Observable
final class OverviewViewModel {
    enum Load { case idle, loading, loaded([Organization]), failed(String) }
    var load: Load = .idle

    func fetch() async {
        load = .loading
        do {
            let orgs: [Organization] = try await APIClient.shared.get("/api/organizations")
            load = .loaded(orgs)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct OverviewView: View {
    @State private var model = OverviewViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter virksomhetene dine…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente data", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let orgs) where orgs.isEmpty:
                ContentUnavailableView("Ingen virksomhet ennå", systemImage: "building.2",
                                       description: Text("Opprett en virksomhet i web-appen for å komme i gang."))
            case .loaded(let orgs):
                List {
                    Section("Virksomheter") {
                        ForEach(orgs) { org in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(org.name).font(.headline)
                                Text([org.orgForm, org.orgNumber].compactMap { $0 }.joined(separator: " · "))
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
        }
        .navigationTitle("Oversikt")
        .task { await model.fetch() }
        .refreshable { await model.fetch() }
    }
}
