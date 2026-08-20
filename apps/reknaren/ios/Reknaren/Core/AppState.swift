import Foundation
import Observation

/// Delt app-tilstand: brukerens virksomheter + aktiv virksomhet. Lastes én gang.
@MainActor
@Observable
final class AppState {
    var orgs: [Organization] = []
    var activeOrgId: String?
    var loadError: String?
    private(set) var loaded = false

    var activeOrg: Organization? { orgs.first { $0.id == activeOrgId } }

    func loadOrgsIfNeeded() async {
        guard !loaded else { return }
        do {
            orgs = try await APIClient.shared.get("/api/organizations")
            if activeOrgId == nil { activeOrgId = orgs.first?.id }
            loaded = true
        } catch {
            loadError = error.localizedDescription
        }
    }

    func reloadOrgs() async {
        loaded = false
        await loadOrgsIfNeeded()
    }
}
