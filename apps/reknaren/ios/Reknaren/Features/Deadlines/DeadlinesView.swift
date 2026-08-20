import SwiftUI

struct Deadline: Decodable, Identifiable, Sendable {
    let kind: String
    let title: String
    let dueDate: String
    let daysUntil: Int
    let severity: String   // overdue | due_soon | upcoming
    let explanation: String
    let actionScreen: String?
    var id: String { kind + dueDate }
}

@MainActor
@Observable
final class DeadlinesViewModel {
    enum Load { case idle, loading, loaded([Deadline]), failed(String) }
    var load: Load = .idle

    func fetch(orgId: String) async {
        load = .loading
        do {
            let d: [Deadline] = try await APIClient.shared.get("/api/organizations/\(orgId)/deadlines")
            load = .loaded(d)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct DeadlinesView: View {
    let orgId: String
    @State private var model = DeadlinesViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter frister…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let d) where d.isEmpty:
                ContentUnavailableView("Ingen frister nå", systemImage: "checkmark.seal",
                                       description: Text("Ingen lovbestemte frister i vinduet framover."))
            case .loaded(let d):
                List {
                    ForEach(d) { DeadlineRow(deadline: $0) }
                }
            }
        }
        .navigationTitle("Frister")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct DeadlineRow: View {
    let deadline: Deadline

    private var tint: Color {
        switch deadline.severity {
        case "overdue": return .red
        case "due_soon": return .orange
        default: return .secondary
        }
    }
    private var countdown: String {
        if deadline.daysUntil < 0 { return "Forfalt for \(-deadline.daysUntil) d siden" }
        if deadline.daysUntil == 0 { return "Forfaller i dag" }
        return "Om \(deadline.daysUntil) dager"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(deadline.title).font(.body.weight(.medium))
                Spacer()
                Text(countdown).font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(tint.opacity(0.16), in: Capsule()).foregroundStyle(tint)
            }
            Text("Forfaller \(deadline.dueDate)").font(.caption).foregroundStyle(.secondary)
            Text(deadline.explanation).font(.footnote).foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
