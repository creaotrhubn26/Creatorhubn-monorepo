// LeadgridAllRecommendationsView.swift
//
// Filtrerbar liste over alle NBA-anbefalinger fra Intelligence Engine
// (PR #855). Bruker /api/leadgrid/intelligence/recommendations m/ priority-
// filter for raskt å snevre inn.

import SwiftUI

struct LeadgridAllRecommendationsView: View {
    let api: APIClient

    @State private var recs: [LeadgridNBARecommendation] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var filter: String = "all"

    var body: some View {
        List {
            Picker("Prioritet", selection: $filter) {
                Text("Alle").tag("all")
                Text("Urgent").tag("urgent")
                Text("High").tag("high")
                Text("Normal").tag("normal")
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if loading && recs.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if filtered.isEmpty {
                ContentUnavailableView(
                    "Ingen anbefalinger",
                    systemImage: "sparkles",
                    description: Text("Intelligence Engine har ikke flagget noen ventende handlinger.")
                )
            } else {
                ForEach(filtered) { rec in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(rec.leadName ?? String(rec.leadId.prefix(8)))
                                .font(.headline)
                            Spacer()
                            prioChip(rec.priority)
                        }
                        HStack(spacing: 6) {
                            Image(systemName: actionIcon(rec.actionType))
                                .font(.caption)
                                .foregroundStyle(.purple)
                            Text(actionLabel(rec.actionType))
                                .font(.subheadline.bold())
                                .foregroundStyle(.purple)
                            if let ch = rec.channel {
                                Text("via \(ch)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Text(rec.reason)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                        if let conf = rec.confidence, conf >= 0.6 {
                            Text("Konfidens: \(Int(conf * 100))%")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Alle anbefalinger")
        .task { await load() }
        .refreshable { await load() }
    }

    private var filtered: [LeadgridNBARecommendation] {
        if filter == "all" { return recs }
        return recs.filter { $0.priority == filter }
    }

    private func prioChip(_ p: String) -> some View {
        let color: Color
        switch p {
        case "urgent": color = .red
        case "high": color = .orange
        case "normal": color = .blue
        default: color = .gray
        }
        return Text(p.uppercased())
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.2), in: Capsule())
            .foregroundStyle(color)
    }

    private func actionIcon(_ a: String) -> String {
        switch a {
        case "call_now": return "phone.fill"
        case "send_email", "send_follow_up_email": return "envelope.fill"
        case "visit": return "location.fill"
        case "book_meeting": return "calendar.badge.plus"
        case "send_proposal": return "doc.text.fill"
        case "find_decision_maker": return "person.crop.circle.badge.questionmark"
        case "run_research": return "magnifyingglass.circle.fill"
        case "add_missing_info": return "exclamationmark.bubble.fill"
        case "reassign": return "arrow.triangle.swap"
        case "mark_lost": return "xmark.octagon"
        case "do_not_contact": return "hand.raised.fill"
        default: return "sparkles"
        }
    }

    private func actionLabel(_ a: String) -> String {
        switch a {
        case "call_now": return "Ring nå"
        case "send_email": return "Send e-post"
        case "send_follow_up_email": return "Send oppfølgings-mail"
        case "visit": return "Besøk"
        case "book_meeting": return "Book møte"
        case "send_proposal": return "Send tilbud"
        case "find_decision_maker": return "Finn beslutningstaker"
        case "run_research": return "Kjør research"
        case "add_missing_info": return "Legg til kontaktinfo"
        case "reassign": return "Reassign"
        case "mark_lost": return "Marker tapt"
        case "do_not_contact": return "Ikke kontakt"
        case "wait": return "Vent"
        default: return a.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            recs = try await api.fetchNBARecommendations(limit: 200)
        } catch {
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
        }
        loading = false
    }
}
