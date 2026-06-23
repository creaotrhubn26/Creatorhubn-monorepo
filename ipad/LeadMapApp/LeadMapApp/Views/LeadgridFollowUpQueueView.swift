// LeadgridFollowUpQueueView.swift
//
// Prioritert liste over leads som trenger handling i dag — drevet av
// /api/leadgrid/intelligence/follow-up-queue (PR #855). Selger åpner appen
// om morgenen og ser denne — Intelligence Engine har allerede bestemt
// hvem som er viktigst, hvorfor, og hva neste handling er.

import SwiftUI

struct LeadgridFollowUpQueueView: View {
    let api: APIClient
    @State private var items: [LeadgridFollowUpItem] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            let urgent = items.filter { $0.priority == "urgent" }
            let high   = items.filter { $0.priority == "high" }
            let normal = items.filter { $0.priority == "normal" }
            let low    = items.filter { $0.priority == "low" }

            if !urgent.isEmpty {
                Section {
                    ForEach(urgent) { card($0) }
                } header: {
                    Label("URGENT", systemImage: "exclamationmark.octagon.fill")
                        .foregroundStyle(.red)
                }
            }
            if !high.isEmpty {
                Section {
                    ForEach(high) { card($0) }
                } header: {
                    Label("I DAG", systemImage: "bolt.fill")
                        .foregroundStyle(.orange)
                }
            }
            if !normal.isEmpty {
                Section {
                    ForEach(normal) { card($0) }
                } header: {
                    Label("DENNE UKEN", systemImage: "calendar")
                        .foregroundStyle(.blue)
                }
            }
            if !low.isEmpty {
                Section {
                    ForEach(low) { card($0) }
                } header: {
                    Label("SENERE", systemImage: "clock")
                        .foregroundStyle(.secondary)
                }
            }

            if items.isEmpty && !loading {
                ContentUnavailableView(
                    "Ingen oppfølginger akkurat nå",
                    systemImage: "checkmark.seal.fill",
                    description: Text("Intelligence Engine har ikke flagget noen leads for handling."))
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Følg-opp-kø")
        .task { await load() }
        .refreshable { await load() }
        .overlay {
            if loading && items.isEmpty {
                ProgressView().controlSize(.large)
            }
        }
    }

    // MARK: - Card

    @ViewBuilder
    private func card(_ item: LeadgridFollowUpItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(item.leadName).font(.headline)
                Spacer()
                tempChip(item.leadTemperature)
            }
            HStack(spacing: 6) {
                Image(systemName: actionIcon(item.actionType)).font(.caption)
                Text(actionLabel(item.actionType)).font(.subheadline.bold())
                if let ch = item.channel {
                    Text("via \(ch)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Text(item.reason)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
            HStack(spacing: 8) {
                if let ev = item.expectedValue, ev > 0 {
                    Text("\(Int(ev)) kr")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                }
                if let score = item.leadScore {
                    Text("Score \(score)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()

                Menu {
                    Button("1 time")                  { snooze(item.id, hours: 1)   }
                    Button("4 timer")                 { snooze(item.id, hours: 4)   }
                    Button("I morgen tidlig (24t)")   { snooze(item.id, hours: 24)  }
                    Button("Neste uke (7 dager)")     { snooze(item.id, hours: 168) }
                } label: {
                    Label("Snooze", systemImage: "clock.fill")
                        .font(.caption)
                }
                .menuStyle(.borderlessButton)
                .buttonStyle(.bordered)
                .tint(.orange)

                Button("Avvis") {
                    Task {
                        _ = try? await api.dismissRecommendation(item.id)
                        await load()
                    }
                }
                .font(.caption)
                .buttonStyle(.bordered)
                .tint(.gray)

                Button("Gjør") {
                    // TODO: naviger til lead-detail (kobles på når MapScreen
                    // eksponerer en selectLead-binding fra Hub). Markeres
                    // som accepted via API i mellomtiden.
                    Task {
                        _ = try? await api.acceptRecommendation(item.id)
                        await load()
                    }
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
                .tint(.purple)
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Chips & labels

    private func tempChip(_ t: String?) -> some View {
        let color: Color = {
            switch t {
            case "ready": return .purple
            case "hot":   return .red
            case "warm":  return .orange
            case "cold":  return .blue
            default:      return .gray
            }
        }()
        return Text(t?.uppercased() ?? "—")
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.2), in: Capsule())
            .foregroundStyle(color)
    }

    private func actionIcon(_ a: String) -> String {
        switch a {
        case "call_now":                 return "phone.fill"
        case "send_email",
             "send_follow_up_email":     return "envelope.fill"
        case "visit":                    return "location.fill"
        case "book_meeting":             return "calendar.badge.plus"
        case "send_proposal":            return "doc.text.fill"
        case "find_decision_maker":      return "person.crop.circle.badge.questionmark"
        case "run_research":             return "magnifyingglass.circle.fill"
        case "add_missing_info":         return "exclamationmark.bubble.fill"
        case "reassign":                 return "arrow.triangle.swap"
        case "mark_lost":                return "xmark.octagon"
        case "do_not_contact":           return "hand.raised.fill"
        default:                         return "sparkles"
        }
    }

    private func actionLabel(_ a: String) -> String {
        switch a {
        case "call_now":                 return "Ring nå"
        case "send_email":               return "Send e-post"
        case "send_follow_up_email":     return "Send oppfølgings-mail"
        case "visit":                    return "Besøk"
        case "book_meeting":             return "Book møte"
        case "send_proposal":            return "Send tilbud"
        case "find_decision_maker":      return "Finn beslutningstaker"
        case "run_research":             return "Kjør research"
        case "add_missing_info":         return "Legg til kontaktinfo"
        case "reassign":                 return "Reassign"
        case "mark_lost":                return "Marker tapt"
        case "do_not_contact":           return "Ikke kontakt"
        case "wait":                     return "Vent"
        default:                         return a.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    @MainActor
    private func load() async {
        loading = true; errorText = nil
        do {
            items = try await api.fetchFollowUpQueue()
        } catch {
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
        }
        loading = false
    }

    /// Snooze en NBA-anbefaling i N timer og last køen på nytt.
    /// Backend: POST /api/leadgrid/intelligence/recommendations/:id/snooze (PR #882).
    @MainActor
    private func snooze(_ id: String, hours: Int) {
        Task {
            do {
                _ = try await api.snoozeRecommendation(id, hours: hours)
                await load()
            } catch {
                errorText = "Kunne ikke snooze: \(error.localizedDescription)"
            }
        }
    }
}
