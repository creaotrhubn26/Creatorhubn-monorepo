import SwiftUI

/// Native "Admin" tab — the photographer's contracts hub, rebuilt native
/// for a run-and-gun feel instead of the old WebView. Lists every contract
/// with its status + signature state, and drills into a detail where the
/// photographer can read the sections, sign with Apple Pencil, email the
/// contract to the client, or move it through its lifecycle. End-to-end
/// synced against `/api/contracts`.
@MainActor
@Observable
final class AdminModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var contracts: [ContractSummary] = []
    private(set) var phase: Phase = .loading

    func load(force: Bool = false) async {
        if force || contracts.isEmpty { phase = contracts.isEmpty ? .loading : phase }
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            let result = try await client.listContracts()
            contracts = result
            phase = .loaded
        } catch {
            // Keep any already-loaded list visible; only flip to the
            // error screen when we have nothing to show.
            if contracts.isEmpty {
                phase = .error((error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription)
            }
        }
    }
}

struct AdminView: View {
    @State private var model = AdminModel()

    var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .loading where model.contracts.isEmpty:
                    ProgressView("Laster kontrakter…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case let .error(message) where model.contracts.isEmpty:
                    ContentUnavailableView {
                        Label("Kunne ikke laste kontrakter", systemImage: "exclamationmark.icloud")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Prøv igjen") { Task { await model.load(force: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                default:
                    if model.contracts.isEmpty {
                        ContentUnavailableView(
                            "Ingen kontrakter ennå",
                            systemImage: "doc.text",
                            description: Text("Kontrakter du oppretter for klienter dukker opp her."),
                        )
                    } else {
                        list
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Admin")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.load(force: true) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .navigationDestination(for: ContractSummary.self) { contract in
                ContractDetailView(contractId: contract.id, summary: contract)
            }
        }
        .task { await model.load() }
    }

    private var list: some View {
        List {
            ForEach(model.contracts) { contract in
                NavigationLink(value: contract) {
                    ContractRow(contract: contract)
                }
                .listRowBackground(CHTheme.surface)
                .listRowSeparatorTint(CHTheme.border)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await model.load(force: true) }
    }
}

/// One contract card — title + client up top, status + signature pills, the
/// total, and a contract number / created hint at the bottom.
private struct ContractRow: View {
    let contract: ContractSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(contract.title ?? "Kontrakt")
                        .font(.headline)
                        .foregroundStyle(CHTheme.textPrimary)
                    if let client = contract.clientName, !client.isEmpty {
                        Text(client)
                            .font(.subheadline)
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                }
                Spacer()
                ContractStatusPill(status: contract.status)
            }

            HStack(spacing: 8) {
                SignatureStatusPill(status: contract.signatureStatus)
                if let total = contract.totalAmount, total > 0 {
                    Label(ContractFormat.currency(total), systemImage: "creditcard")
                        .font(.caption)
                        .foregroundStyle(CHTheme.textSecondary)
                }
            }

            if let number = contract.contractNumber, !number.isEmpty {
                Text("Nr. \(number)\(contract.createdAt.map { " · opprettet \(DashboardDate.relative($0))" } ?? "")")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            } else if let created = contract.createdAt {
                Text("Opprettet \(DashboardDate.relative(created))")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Pills

/// Lifecycle status pill (draft / pending / signed / …).
struct ContractStatusPill: View {
    let status: String?

    private var label: String {
        switch (status ?? "").lowercased() {
        case "draft": return "Utkast"
        case "pending_signatures", "pending", "sent": return "Til signering"
        case "signed", "completed": return "Signert"
        case "cancelled", "canceled": return "Avbrutt"
        case "": return "—"
        default: return status ?? "—"
        }
    }

    private var color: Color {
        switch (status ?? "").lowercased() {
        case "signed", "completed": return CHTheme.success
        case "pending_signatures", "pending", "sent": return CHTheme.warning
        case "cancelled", "canceled": return CHTheme.danger
        case "draft": return CHTheme.textSecondary
        default: return CHTheme.textSecondary
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .foregroundStyle(color)
    }
}

/// Signature-state pill (not started / sent / viewed / signed).
struct SignatureStatusPill: View {
    let status: String?

    private var normalized: String { (status ?? "not_started").lowercased() }

    private var label: String {
        switch normalized {
        case "signed": return "Signert"
        case "sent": return "Sendt"
        case "viewed": return "Sett"
        case "not_started", "": return "Ikke signert"
        default: return status ?? "Ikke signert"
        }
    }

    private var icon: String {
        switch normalized {
        case "signed": return "checkmark.seal.fill"
        case "sent": return "paperplane.fill"
        case "viewed": return "eye.fill"
        default: return "signature"
        }
    }

    private var color: Color {
        switch normalized {
        case "signed": return CHTheme.success
        case "sent", "viewed": return CHTheme.info
        default: return CHTheme.textMuted
        }
    }

    var body: some View {
        Label(label, systemImage: icon)
            .font(.caption2.weight(.semibold))
            .labelStyle(.titleAndIcon)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: - Formatting

enum ContractFormat {
    static func currency(_ amount: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "NOK"
        f.locale = Locale(identifier: "nb_NO")
        f.maximumFractionDigits = amount.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        return f.string(from: amount as NSNumber) ?? "\(Int(amount)) kr"
    }
}
