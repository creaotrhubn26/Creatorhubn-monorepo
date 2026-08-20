import SwiftUI

struct Institution: Decodable, Sendable { let id: String; let name: String }

@MainActor
@Observable
final class PayViewModel {
    enum Load { case idle, loading, loaded([PayableInvoice]), failed(String) }
    var load: Load = .idle
    var aspspName: String?      // banken betalingen sendes fra (fra feed-institusjonene)
    var payFeedAvailable = false
    var payingId: String?
    var note: String?

    func fetch(orgId: String) async {
        load = .loading
        do {
            let inv: [PayableInvoice] = try await APIClient.shared.get("/api/organizations/\(orgId)/payments/payable")
            load = .loaded(inv)
            // Hent bank-navnet for PIS (best-effort; 503 = feed ikke aktiv).
            if let inst = try? await APIClient.shared.get("/api/organizations/\(orgId)/bank-feed/institutions?country=NO") as [Institution] {
                aspspName = inst.first?.name
                payFeedAvailable = aspspName != nil
            }
        } catch {
            load = .failed(error.localizedDescription)
        }
    }

    func pay(orgId: String, invoice: PayableInvoice) async {
        guard let aspsp = aspspName else { note = "Koble banken din først for å betale herfra."; return }
        payingId = invoice.documentId
        note = nil
        struct Body: Encodable { let aspspName: String }
        struct Resp: Decodable { let authUrl: String }
        do {
            let r: Resp = try await APIClient.shared.post("/api/organizations/\(orgId)/payments/\(invoice.documentId)/initiate", body: Body(aspspName: aspsp))
            if let url = URL(string: r.authUrl) {
                await WebAuth.shared.present(url: url, callbackScheme: nil)
                note = "Fullfør godkjenningen i banken. Betalingen bekreftes når du er tilbake."
            }
        } catch {
            note = error.localizedDescription
        }
        payingId = nil
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
                    if let note = model.note {
                        Section { Text(note).font(.footnote).foregroundStyle(.secondary) }
                    }
                    Section {
                        ForEach(inv) { invoice in
                            PayableRow(inv: invoice,
                                       canPay: model.payFeedAvailable && invoice.payable,
                                       paying: model.payingId == invoice.documentId) {
                                Task { await model.pay(orgId: orgId, invoice: invoice) }
                            }
                        }
                    } footer: {
                        Text("«Betal nå» sender betalingen til banken din; du godkjenner med BankID. Marker faste leverandører for auto-godkjenn under «Faste leverandører».")
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
    let canPay: Bool
    let paying: Bool
    let onPay: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
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
            if canPay {
                Button(action: onPay) {
                    if paying { ProgressView() } else { Label("Betal nå (BankID)", systemImage: "building.columns") }
                }
                .buttonStyle(.bordered)
                .disabled(paying)
            }
        }
        .padding(.vertical, 2)
    }
}
