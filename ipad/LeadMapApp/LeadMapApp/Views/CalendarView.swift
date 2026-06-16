// CalendarView.swift
//
// Liste over kommende møter + follow-ups innen 60 dager. Bruker data
// AppState.calendar henter via GET /api/admin-room/lead-map/calendar.
// Tap en rad → åpne lead-detail-sheet.

import SwiftUI

struct CalendarView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedLead: LeadModel?

    var body: some View {
        NavigationStack {
            Group {
                if appState.calendar.isEmpty {
                    ContentUnavailableView(
                        "Ingen kommende",
                        systemImage: "calendar",
                        description: Text("Du har ingen møter eller follow-ups planlagt de neste 60 dagene.")
                    )
                } else {
                    List {
                        ForEach(grouped, id: \.0) { day, events in
                            Section(header: Text(day).font(.subheadline.bold())) {
                                ForEach(events) { ev in
                                    EventRow(event: ev)
                                        .contentShape(Rectangle())
                                        .onTapGesture { openLead(forId: ev.id) }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Kommende")
            .refreshable {
                await appState.refreshAll()
            }
        }
        .sheet(item: $selectedLead) { lead in
            LeadDetailSheet(lead: lead)
        }
    }

    /// Grupper events per dag-streng for Section-header.
    private var grouped: [(String, [CalendarEvent])] {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "EEEE d. MMMM"
        let cal = Calendar.current
        let now = Date()

        let buckets = Dictionary(grouping: appState.calendar) { event -> String in
            guard let dt = event.datetime else { return "Ukjent" }
            if cal.isDateInToday(dt) { return "I dag" }
            if cal.isDateInTomorrow(dt) { return "I morgen" }
            if dt < now { return "Tidligere" }
            return df.string(from: dt).capitalized
        }
        // Sortert: I dag → I morgen → datoer → Tidligere → Ukjent
        let order: [String] = ["I dag", "I morgen"]
        var sortedKeys = buckets.keys.sorted { a, b in
            if let ia = order.firstIndex(of: a) { return order.firstIndex(of: b).map { ia < $0 } ?? true }
            if order.contains(b) { return false }
            if a == "Tidligere" { return false }
            if b == "Tidligere" { return true }
            if a == "Ukjent" { return false }
            if b == "Ukjent" { return true }
            return a < b
        }
        if !sortedKeys.contains("Tidligere") {} // ingen ekstra logikk nødvendig
        sortedKeys = sortedKeys.filter { buckets[$0]?.isEmpty == false }
        return sortedKeys.map { ($0, buckets[$0]!) }
    }

    private func openLead(forId id: String) {
        if let lead = appState.leads.first(where: { $0.id == id }) {
            selectedLead = lead
        }
    }
}

private struct EventRow: View {
    let event: CalendarEvent

    private var isMeeting: Bool { event.eventType == "meeting" }
    private var accent: Color { isMeeting ? .purple : .yellow }

    var body: some View {
        HStack(spacing: 14) {
            // Dato/tid-kolonne
            VStack(spacing: 2) {
                if let dt = event.datetime {
                    Text(dt, format: .dateTime.hour().minute())
                        .font(.caption.bold().monospacedDigit())
                    Text(dt, format: .dateTime.day(.twoDigits).month(.abbreviated))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 60)

            // Farge-strek
            RoundedRectangle(cornerRadius: 2)
                .fill(accent)
                .frame(width: 3, height: 32)

            // Innhold
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(event.leadName).font(.subheadline.bold())
                    Text(isMeeting ? "MØTE" : "FOLLOW-UP")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(accent.opacity(0.18))
                        .foregroundStyle(accent)
                        .clipShape(Capsule())
                }
                if let action = event.nextAction {
                    Text(action)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else if let city = event.city {
                    Text(city)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}
