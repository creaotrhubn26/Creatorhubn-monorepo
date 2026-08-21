import SwiftUI

struct InvoiceRow: Decodable, Identifiable, Sendable {
    let id: String
    let invoiceNumber: String?
    let kind: String
    let status: String
    let invoiceDate: String?
    let dueDate: String?
    let kid: String?
    let netMinor: Money
    let grossMinor: Money
    let paidMinor: Money
    let customerName: String?

    enum CodingKeys: String, CodingKey {
        case id, kind, status, kid
        case invoiceNumber = "invoice_number"
        case invoiceDate = "invoice_date"
        case dueDate = "due_date"
        case netMinor = "net_minor"
        case grossMinor = "gross_minor"
        case paidMinor = "paid_minor"
        case customerName = "customer_name"
    }
}

@MainActor
@Observable
final class InvoicesViewModel {
    enum Load { case idle, loading, loaded([InvoiceRow]), failed(String) }
    var load: Load = .idle
    /// Marginalsats i promille (fra reserve-oversikten) → per-faktura «sett av».
    /// Omsetning legges på toppen av årets resultat og skattlegges marginalt, ikke med snitt.
    var taxRatePer1000: Int?

    func fetch(orgId: String) async {
        load = .loading
        do {
            let rows: [InvoiceRow] = try await APIClient.shared.get("/api/organizations/\(orgId)/invoices")
            load = .loaded(rows)
            // Best-effort: hent marginalsats så vi kan vise «sett av» per faktura.
            struct Rate: Decodable { let marginalRatePer1000: Int }
            if let r = try? await APIClient.shared.get("/api/organizations/\(orgId)/tax/reserve-overview") as Rate {
                taxRatePer1000 = r.marginalRatePer1000 > 0 ? r.marginalRatePer1000 : 400
            }
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct InvoicesView: View {
    let orgId: String
    @State private var model = InvoicesViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter fakturaer…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let rows) where rows.isEmpty:
                ContentUnavailableView("Ingen fakturaer", systemImage: "doc.text",
                                       description: Text("Salgsfakturaer du oppretter dukker opp her. Opprett dem i web-appen."))
            case .loaded(let rows):
                List {
                    ForEach(rows) { InvoiceCard(inv: $0, taxRatePer1000: model.taxRatePer1000) }
                }
            }
        }
        .navigationTitle("Salg og faktura")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct InvoiceCard: View {
    let inv: InvoiceRow
    let taxRatePer1000: Int?

    /// Skatt å sette av for denne fakturaen = netto × marginalsats.
    private var setAsideMinor: Int64? {
        guard let rate = taxRatePer1000, rate > 0, inv.netMinor.minor > 0 else { return nil }
        return inv.netMinor.minor * Int64(rate) / 1000
    }

    private var statusText: String {
        switch inv.status {
        case "draft": return "Kladd"
        case "issued": return "Sendt"
        case "paid": return "Betalt"
        case "partial": return "Delbetalt"
        case "overdue": return "Forfalt"
        case "credited": return "Kreditert"
        default: return inv.status
        }
    }
    private var statusTint: Color {
        switch inv.status {
        case "paid": return .green
        case "overdue": return .red
        case "issued", "partial": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(inv.customerName ?? "Ukjent kunde").font(.body.weight(.medium)).lineLimit(1)
                Spacer()
                Text(inv.grossMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
            }
            HStack(spacing: 8) {
                Text(statusText).font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(statusTint.opacity(0.16), in: Capsule()).foregroundStyle(statusTint)
                if let n = inv.invoiceNumber { Text("Nr. \(n)").font(.caption).foregroundStyle(.secondary) }
                if let due = inv.dueDate { Text("Forfaller \(due)").font(.caption).foregroundStyle(.secondary) }
                if inv.paidMinor.minor > 0 && inv.status != "paid" {
                    Text("Betalt \(inv.paidMinor.kr)").font(.caption2).foregroundStyle(.secondary)
                }
            }
            if let sa = setAsideMinor {
                Label("Sett av \(Money(minor: sa).kr) til skatt", systemImage: "banknote")
                    .font(.caption).foregroundStyle(Color.reknarenGreen)
                    .padding(.top, 1)
            }
        }
        .padding(.vertical, 2)
    }
}
