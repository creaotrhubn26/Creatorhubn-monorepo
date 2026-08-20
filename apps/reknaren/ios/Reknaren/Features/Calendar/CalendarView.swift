import SwiftUI

struct CalendarEvent: Decodable, Identifiable, Sendable {
    let date: String
    let kind: String        // paid | recurring | vat | tax | invoice_in
    let direction: String   // in | out
    let label: String
    let amountMinor: Money
    let status: String      // paid | expected | overdue
    let vendor: String?
    var id: String { date + kind + label + String(amountMinor.minor) }
}

struct CalendarResponse: Decodable, Sendable {
    let from: String
    let to: String
    let asOf: String
    let events: [CalendarEvent]
}

@MainActor
@Observable
final class CalendarViewModel {
    enum Load { case idle, loading, loaded([CalendarEvent]), failed(String) }
    var load: Load = .idle

    func fetch(orgId: String) async {
        load = .loading
        do {
            let r: CalendarResponse = try await APIClient.shared.get("/api/organizations/\(orgId)/payment-calendar")
            load = .loaded(r.events)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct CalendarView: View {
    let orgId: String
    @State private var model = CalendarViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter betalingskalender…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let ev) where ev.isEmpty:
                ContentUnavailableView("Ingen hendelser", systemImage: "calendar",
                                       description: Text("Ingen betalinger eller forfall i vinduet."))
            case .loaded(let ev):
                List {
                    let upcoming = ev.filter { $0.status != "paid" }
                    let done = ev.filter { $0.status == "paid" }
                    if !upcoming.isEmpty {
                        Section("Framover") { ForEach(upcoming) { CalendarRow(event: $0) } }
                    }
                    if !done.isEmpty {
                        Section("Betalt / bokført") { ForEach(done) { CalendarRow(event: $0) } }
                    }
                }
            }
        }
        .navigationTitle("Framover")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct CalendarRow: View {
    let event: CalendarEvent

    private var inbound: Bool { event.direction == "in" }
    private var statusTint: Color {
        switch event.status {
        case "overdue": return .red
        case "expected": return .orange
        default: return .secondary
        }
    }
    private var kindLabel: String {
        switch event.kind {
        case "vat": return "MVA"
        case "tax": return "Skatt"
        case "recurring": return "Fast utgift"
        case "invoice_in": return "Kundefaktura"
        default: return "Betalt"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(event.label).font(.body.weight(.medium)).lineLimit(1)
                Spacer()
                Text("\(inbound ? "+" : "−")\(event.amountMinor.kr)")
                    .font(.body.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(inbound ? Color.green : Color.primary)
            }
            HStack(spacing: 8) {
                Text(event.date).font(.caption).foregroundStyle(.secondary)
                Text(kindLabel).font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(Color.secondary.opacity(0.14), in: Capsule()).foregroundStyle(.secondary)
                if event.status != "paid" {
                    Text(event.status == "overdue" ? "Forfalt" : "Forventet").font(.caption2)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(statusTint.opacity(0.16), in: Capsule()).foregroundStyle(statusTint)
                }
                if let v = event.vendor { Text(v).font(.caption2).foregroundStyle(.secondary) }
            }
        }
        .padding(.vertical, 2)
    }
}
