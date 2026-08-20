import SwiftUI

@MainActor
@Observable
final class VendorsViewModel {
    enum Load { case idle, loading, loaded([Vendor]), failed(String) }
    var load: Load = .idle

    func fetch(orgId: String) async {
        load = .loading
        do {
            let vs: [Vendor] = try await APIClient.shared.get("/api/organizations/\(orgId)/vendors")
            load = .loaded(vs)
        } catch { load = .failed(error.localizedDescription) }
    }

    func setAutoApprove(orgId: String, vendor: Vendor, enabled: Bool) async {
        // Optimistisk oppdatering; rull tilbake ved feil.
        update(vendor.id, enabled)
        struct Body: Encodable { let enabled: Bool }
        do {
            let _: Vendor = try await APIClient.shared.post("/api/organizations/\(orgId)/vendors/\(vendor.id)/auto-approve", body: Body(enabled: enabled))
        } catch {
            update(vendor.id, !enabled)
            load = .failed(error.localizedDescription)
        }
    }

    private func update(_ id: String, _ enabled: Bool) {
        if case .loaded(var vs) = load, let i = vs.firstIndex(where: { $0.id == id }) {
            vs[i].autoApprove = enabled
            load = .loaded(vs)
        }
    }
}

/// Faste leverandører du stoler på. Slår du på auto-godkjenn, kobler Reknaren
/// kvittering↔betaling automatisk (høy-konfidens) ved synk — reversibelt og logget.
/// Sender ALDRI penger automatisk.
struct VendorsView: View {
    let orgId: String
    @State private var model = VendorsViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter leverandører…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let vs) where vs.isEmpty:
                ContentUnavailableView("Ingen leverandører ennå", systemImage: "shippingbox",
                                       description: Text("Leverandører dukker opp når du bokfører fakturaer fra dem."))
            case .loaded(let vs):
                List {
                    Section {
                        ForEach(vs) { vendor in
                            Toggle(isOn: binding(for: vendor)) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(vendor.name)
                                    if let n = vendor.orgNumber { Text(n).font(.caption).foregroundStyle(.secondary) }
                                }
                            }
                        }
                    } header: {
                        Text("Auto-godkjenn")
                    } footer: {
                        Text("Auto-godkjenn kobler kvittering og betaling automatisk for faste leverandører du stoler på (f.eks. månedlige regninger). Reversibelt og logget. Ingen penger sendes automatisk.")
                    }
                }
            }
        }
        .navigationTitle("Faste leverandører")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }

    private func binding(for vendor: Vendor) -> Binding<Bool> {
        Binding(
            get: { vendor.autoApprove },
            set: { newValue in Task { await model.setAutoApprove(orgId: orgId, vendor: vendor, enabled: newValue) } }
        )
    }
}
