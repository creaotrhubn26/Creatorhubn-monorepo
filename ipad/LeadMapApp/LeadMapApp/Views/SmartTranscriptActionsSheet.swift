// SmartTranscriptActionsSheet.swift
//
// Vises etter brukeren har diktert et notat. Claude har analysert
// transkriptet og funnet:
//   - Erstattet 'kunden' med lead-navn (bytt → 'kunden bør sees innen 22.06' → 'Bakeriet bør sees innen 22.06')
//   - Action items (to-do for selger)
//   - Foreslått follow-up-dato
//   - Foreslått kalender-event (med EventKit-integrasjon)
//
// Brukeren kan med ett tap:
//   ✓ Erstatte tekst-feltet med resolved_text
//   ✓ Sette next_follow_up_at i visit-form
//   ✓ Legge til som kalender-event (EKEventStore)

import SwiftUI
import EventKit

struct SmartTranscriptActionsSheet: View {
    let analysis: TranscriptAnalysis
    let leadName: String
    let onApplyResolvedText: (String) -> Void
    let onApplyFollowUp: (Date) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var calendarStatus: CalendarStatus = .notRequested
    @State private var calendarError: String?
    @State private var followUpApplied = false
    @State private var resolvedApplied = false

    enum CalendarStatus { case notRequested, added(eventId: String), denied, failed(String) }

    var body: some View {
        NavigationStack {
            Form {
                sentimentSection
                if analysis.resolved_text != "" {
                    resolvedTextSection
                }
                if !analysis.action_items.isEmpty {
                    actionItemsSection
                }
                if analysis.followUpDate != nil {
                    followUpSection
                }
                if analysis.calendar_suggestion != nil {
                    calendarSection
                }
            }
            .navigationTitle("Claude foreslår")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
    }

    private var sentimentSection: some View {
        Section {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(hex: analysis.sentimentColor))
                    .frame(width: 12, height: 12)
                Text(sentimentLabel)
                    .font(.headline)
                Spacer()
            }
        } header: {
            Text("Stemning fra besøket")
        }
    }

    private var sentimentLabel: String {
        switch analysis.sentiment {
        case "positiv": return "Positiv stemning"
        case "negativ": return "Negativ stemning"
        default: return "Nøytral stemning"
        }
    }

    private var resolvedTextSection: some View {
        Section {
            Text(analysis.resolved_text)
                .font(.callout)
                .foregroundStyle(.primary)
            Button {
                onApplyResolvedText(analysis.resolved_text)
                resolvedApplied = true
            } label: {
                Label(resolvedApplied ? "Anvendt ✓" : "Bytt ut råteksten med dette",
                      systemImage: resolvedApplied ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath")
            }
            .disabled(resolvedApplied)
        } header: {
            Text("Erstatt 'kunden' med \(leadName)")
        } footer: {
            Text("Claude byttet ut pronomen for klarere notater.")
                .font(.caption2)
        }
    }

    private var actionItemsSection: some View {
        Section {
            ForEach(analysis.action_items, id: \.self) { item in
                Label(item, systemImage: "checkmark.square")
                    .font(.callout)
            }
        } header: {
            Text("To-do (\(analysis.action_items.count))")
        }
    }

    @ViewBuilder
    private var followUpSection: some View {
        if let date = analysis.followUpDate {
            Section {
                Label {
                    Text(date.formatted(date: .abbreviated, time: .shortened))
                } icon: {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundStyle(.orange)
                }
                Button {
                    onApplyFollowUp(date)
                    followUpApplied = true
                } label: {
                    Label(followUpApplied
                            ? "Lagt til som follow-up ✓"
                            : "Sett som Neste oppfølging",
                          systemImage: followUpApplied ? "checkmark.circle.fill" : "arrow.right.circle.fill")
                }
                .disabled(followUpApplied)
            } header: {
                Text("Foreslått oppfølgings-dato")
            }
        }
    }

    @ViewBuilder
    private var calendarSection: some View {
        if let sug = analysis.calendar_suggestion, let date = analysis.calendarDate {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(sug.title).font(.subheadline.bold())
                    Text(date.formatted(date: .complete, time: .omitted))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let notes = sug.notes {
                        Text(notes).font(.caption).foregroundStyle(.secondary)
                    }
                }
                switch calendarStatus {
                case .added:
                    Label("Lagt til i kalenderen ✓", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                case .denied:
                    Text("Kalender-tilgang nektet. Aktivér i Innstillinger.")
                        .font(.caption)
                        .foregroundStyle(.red)
                case .failed(let msg):
                    Text(msg).font(.caption).foregroundStyle(.red)
                case .notRequested:
                    Button {
                        Task { await addToCalendar(suggestion: sug, date: date) }
                    } label: {
                        Label("Legg til i Kalenderen", systemImage: "calendar.badge.plus")
                    }
                }
            } header: {
                Text("Kalender-forslag")
            }
        }
    }

    @MainActor
    private func addToCalendar(suggestion: TranscriptAnalysis.CalendarSuggestion, date: Date) async {
        let store = EKEventStore()
        do {
            let granted: Bool
            if #available(iOS 17.0, *) {
                granted = try await store.requestWriteOnlyAccessToEvents()
            } else {
                granted = try await withCheckedThrowingContinuation { cont in
                    store.requestAccess(to: .event) { ok, err in
                        if let err { cont.resume(throwing: err) }
                        else { cont.resume(returning: ok) }
                    }
                }
            }
            if !granted {
                calendarStatus = .denied
                return
            }
            let event = EKEvent(eventStore: store)
            event.title = suggestion.title
            event.startDate = date
            event.endDate = date.addingTimeInterval(60 * 60) // 1 time
            event.notes = suggestion.notes
            event.calendar = store.defaultCalendarForNewEvents
            try store.save(event, span: .thisEvent)
            calendarStatus = .added(eventId: event.eventIdentifier ?? "")
        } catch {
            calendarStatus = .failed(error.localizedDescription)
        }
    }
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
