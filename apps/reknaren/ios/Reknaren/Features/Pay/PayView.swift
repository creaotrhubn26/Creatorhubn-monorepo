import SwiftUI

@MainActor
@Observable
final class PayViewModel {
    enum Load { case idle, loading, loaded([PayableInvoice]), failed(String) }
    var load: Load = .idle

    func fetch(orgId: String) async {
        load = .loading
        do {
            let inv: [PayableInvoice] = try await APIClient.shared.get("/api/organizations/\(orgId)/payments/payable")
            load = .loaded(inv)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct PayView: View {
    let orgId: String
    @State private var model = PayViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter fakturaer…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let inv) where inv.isEmpty:
                ContentUnavailableView("Ingen ubetalte fakturaer", systemImage: "checkmark.seal",
                                       description: Text("Leverandørfakturaer klare for betaling dukker opp her."))
            case .loaded(let inv):
                List {
                    Section {
                        ForEach(inv) { PayableRow(inv: $0) }
                    } footer: {
                        Text("Marker faste leverandører for auto-godkjenn under «Faste leverandører», så kobles kvittering og betaling automatisk ved synk.")
                    }
                }
            }
        }
        .navigationTitle("Betal leverandører")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct PayableRow: View {
    let inv: PayableInvoice
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(inv.vendorName ?? "Ukjent leverandør").font(.body.weight(.medium))
                Spacer()
                Text(inv.amountMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
            }
            HStack(spacing: 8) {
                if let due = inv.dueDate {
                    Label("Forfaller \(due)", systemImage: "clock").font(.caption).foregroundStyle(.secondary)
                }
                if let kid = inv.kid { Text("KID \(kid)").font(.caption2).monospacedDigit().foregroundStyle(.secondary) }
                if !inv.payable {
                    Text("Mangler konto").font(.caption2)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Color.orange.opacity(0.18), in: Capsule()).foregroundStyle(.orange)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
