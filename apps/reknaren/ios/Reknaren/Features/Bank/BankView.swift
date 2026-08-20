import SwiftUI

@MainActor
@Observable
final class BankViewModel {
    enum Load { case idle, loading, loaded([BankTx]), failed(String) }
    var load: Load = .idle

    func fetch(orgId: String) async {
        load = .loading
        do {
            let txs: [BankTx] = try await APIClient.shared.get("/api/organizations/\(orgId)/bank/transactions")
            load = .loaded(txs)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct BankView: View {
    let orgId: String
    @State private var model = BankViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter transaksjoner…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente transaksjoner", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let txs) where txs.isEmpty:
                ContentUnavailableView("Ingen transaksjoner", systemImage: "building.columns",
                                       description: Text("Koble banken din, eller importer kontoutskrift, for å komme i gang."))
            case .loaded(let txs):
                List(txs) { tx in TransactionRow(tx: tx) }
                    .listStyle(.plain)
            }
        }
        .navigationTitle("Bank og avstemming")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

/// Én transaksjonslinje. Egen view for å holde type-dybden lav (unngår SwiftUI
/// stack-overflow-fella med dype `some View`-hierarkier).
private struct TransactionRow: View {
    let tx: BankTx
    private let gold = Color(red: 0.69, green: 0.57, blue: 0.23)
    private let ok = Color(red: 0.10, green: 0.42, blue: 0.27)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(tx.description).font(.body.weight(.medium)).lineLimit(2)
                Spacer()
                Text(tx.amount.kr)
                    .font(.body.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(tx.isIncoming ? ok : .primary)
            }
            metaRow
            if tx.isUnmatched, let g = tx.guidance { guidanceBox(g) }
            if tx.isUnmatched, let s = tx.suggestion { suggestionBox(s) }
        }
        .padding(.vertical, 4)
    }

    private var metaRow: some View {
        HStack(spacing: 8) {
            Text(tx.isIncoming ? "Inn" : "Ut")
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 7).padding(.vertical, 1)
                .background(tx.isIncoming ? ok.opacity(0.14) : Color.secondary.opacity(0.12), in: Capsule())
                .foregroundStyle(tx.isIncoming ? ok : .secondary)
            Text(tx.bookedDate).font(.caption).foregroundStyle(.secondary).monospacedDigit()
            if let c = tx.counterparty { Text(c).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            if let kid = tx.kid {
                Text("KID \(kid)").font(.caption2).monospacedDigit()
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(gold.opacity(0.16), in: Capsule()).foregroundStyle(gold)
            }
        }
    }

    private func suggestionBox(_ s: CategorySuggestion) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            (Text("Ser ut som ").foregroundStyle(.secondary)
             + Text(s.label.lowercased()).foregroundStyle(.primary).fontWeight(.semibold))
                .font(.subheadline)
            Text(s.explanation).font(.caption).foregroundStyle(.secondary)
        }
        .padding(8).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.12, green: 0.30, blue: 0.23).opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func guidanceBox(_ g: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("SPØRSMÅL").font(.caption2.weight(.bold)).foregroundStyle(gold)
            Text(g).font(.caption).foregroundStyle(.primary)
        }
        .padding(8).frame(maxWidth: .infinity, alignment: .leading)
        .background(gold.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }
}
