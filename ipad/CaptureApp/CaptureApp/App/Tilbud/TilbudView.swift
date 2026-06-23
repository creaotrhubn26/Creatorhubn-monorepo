import SwiftUI

/// Native "Tilbud" tab — the photographer's price quotes, rebuilt native
/// instead of the old WebView. Lists every quote with status + total,
/// drills into a detail with line items + status actions + Apple Pencil
/// signing, and offers a "Nytt tilbud" form. End-to-end synced against
/// `/api/quotes/*` via ``DashboardClient``.
@MainActor
@Observable
final class TilbudModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var quotes: [Quote] = []
    private(set) var phase: Phase = .loading

    func load(force: Bool = false) async {
        if force || quotes.isEmpty { phase = quotes.isEmpty ? .loading : phase }
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            let result = try await client.listQuotes()
            quotes = result
            phase = .loaded
        } catch {
            // Keep any already-loaded list visible; only flip to the
            // error screen when we have nothing to show.
            if quotes.isEmpty {
                phase = .error((error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription)
            }
        }
    }
}

struct TilbudView: View {
    @State private var model = TilbudModel()
    @State private var showingNew = false

    var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .loading where model.quotes.isEmpty:
                    ProgressView("Laster tilbud…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case let .error(message) where model.quotes.isEmpty:
                    ContentUnavailableView {
                        Label("Kunne ikke laste tilbud", systemImage: "exclamationmark.icloud")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Prøv igjen") { Task { await model.load(force: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                default:
                    if model.quotes.isEmpty {
                        ContentUnavailableView {
                            Label("Ingen tilbud ennå", systemImage: "doc.text")
                        } description: {
                            Text("Tilbud du sender til klienter dukker opp her.")
                        } actions: {
                            Button {
                                showingNew = true
                            } label: {
                                Label("Nytt tilbud", systemImage: "plus")
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    } else {
                        list
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Tilbud")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingNew = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.load(force: true) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .navigationDestination(for: Quote.self) { quote in
                QuoteDetailView(quoteId: quote.id, summary: quote) {
                    await model.load(force: true)
                }
            }
            .sheet(isPresented: $showingNew) {
                NewQuoteView { await model.load(force: true) }
            }
        }
        .task { await model.load() }
    }

    private var list: some View {
        List {
            ForEach(model.quotes) { quote in
                NavigationLink(value: quote) {
                    QuoteRow(quote: quote)
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

// MARK: - List row

/// One quote card — client + title up top, status pill, total amount.
private struct QuoteRow: View {
    let quote: Quote

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(quote.clientName ?? quote.title ?? "Uten navn")
                        .font(.headline)
                        .foregroundStyle(CHTheme.textPrimary)
                    if let title = quote.title, quote.clientName != nil {
                        Text(title)
                            .font(.subheadline)
                            .foregroundStyle(CHTheme.textSecondary)
                    }
                }
                Spacer()
                QuoteStatusPill(status: quote.status)
            }

            HStack(alignment: .firstTextBaseline) {
                if let number = quote.quoteNumber, !number.isEmpty {
                    Text("#\(number)")
                        .font(.caption.monospaced())
                        .foregroundStyle(CHTheme.textMuted)
                }
                Spacer()
                Text(QuoteFormat.kr(quote.totalAmount))
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(CHTheme.textPrimary)
            }

            if let created = quote.createdAt {
                Text("Opprettet \(DashboardDate.relative(created))")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Status pill

struct QuoteStatusPill: View {
    let status: String?

    private var label: String {
        switch (status ?? "").lowercased() {
        case "draft": return "Utkast"
        case "pending": return "Venter"
        case "sent": return "Sendt"
        case "viewed": return "Sett"
        case "accepted": return "Akseptert"
        case "rejected": return "Avvist"
        case "": return "—"
        default: return status ?? "—"
        }
    }

    private var color: Color {
        switch (status ?? "").lowercased() {
        case "draft": return CHTheme.textMuted
        case "pending": return CHTheme.warning
        case "sent": return CHTheme.info
        case "viewed": return CHTheme.accent
        case "accepted": return CHTheme.success
        case "rejected": return CHTheme.danger
        default: return CHTheme.textSecondary
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: - Formatting

enum QuoteFormat {
    /// "kr 1 995" — Norwegian-grouped, no decimals (drops øre for tidy
    /// totals). Falls back to "kr 0" on nil.
    static func kr(_ amount: Double?) -> String {
        let value = amount ?? 0
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        fmt.locale = Locale(identifier: "nb_NO")
        fmt.maximumFractionDigits = value == value.rounded() ? 0 : 2
        let number = fmt.string(from: NSNumber(value: value)) ?? "\(Int(value))"
        return "kr \(number)"
    }

    /// Compact quantity like "2" or "1,5".
    static func qty(_ value: Double) -> String {
        if value == value.rounded() { return String(Int(value)) }
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        fmt.locale = Locale(identifier: "nb_NO")
        fmt.maximumFractionDigits = 2
        return fmt.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
