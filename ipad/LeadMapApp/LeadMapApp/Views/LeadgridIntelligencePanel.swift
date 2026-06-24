// LeadgridIntelligencePanel.swift
//
// Inline-komponent som viser «Neste beste handling» + score-breakdown for
// én lead. Brukes som section i lead-detail-sheet eller standalone i sheet
// fra pipeline-kanban. Drevet av /api/leadgrid/intelligence/leads/:id.

import SwiftUI

struct LeadgridIntelligencePanel: View {
    let api: APIClient
    let leadId: String
    @State private var intel: LeadgridIntelligenceForLead?
    @State private var loading = true
    @State private var errorText: String?
    @State private var acted = false
    @State private var presentingVoiceMemo = false
    @State private var presentingFullReport = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "sparkles").foregroundStyle(.purple)
                Text("Neste beste handling").font(.headline)
                Spacer()
                if let scoredAt = intel?.scoredAt {
                    Text("Beregnet \(relativeTime(scoredAt))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Button {
                    Task { await recompute() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .font(.caption)
                .disabled(loading)
            }
            Divider()

            if loading {
                ProgressView().frame(maxWidth: .infinity)
            } else if let intel {
                content(intel)
            } else if let errorText {
                Text(errorText).foregroundStyle(.red)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .task { await load() }
        .sheet(isPresented: $presentingVoiceMemo) {
            if let lead = intel?.lead {
                LeadgridVoiceMemoSheet(
                    api: api,
                    leadId: lead.id,
                    leadName: lead.name
                )
            }
        }
        .sheet(isPresented: $presentingFullReport) {
            if let lead = intel?.lead {
                LeadgridFullIntelligenceSheet(
                    api: api,
                    leadId: lead.id,
                    leadName: lead.name
                )
            }
        }
    }

    @ViewBuilder
    private func content(_ i: LeadgridIntelligenceForLead) -> some View {
        if let rec = i.recommendation {
            HStack {
                Image(systemName: actionIcon(rec.actionType))
                    .font(.title2)
                    .foregroundStyle(.purple)
                VStack(alignment: .leading) {
                    Text(actionLabel(rec.actionType)).font(.title3.bold())
                    if let ch = rec.channel {
                        Text(ch.capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                prioChip(rec.priority)
            }

            Text("Hvorfor:")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Text(rec.reason).font(.subheadline)

            if let bct = rec.bestContactTime {
                HStack(spacing: 4) {
                    Image(systemName: "clock").font(.caption2)
                    Text(formatBestTime(bct)).font(.caption)
                }
                .foregroundStyle(.secondary)
            }
            if let conf = rec.confidence, conf >= 0.6 {
                Text("Konfidens: \(Int(conf * 100))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } else {
            Text("Ingen aktiv anbefaling for denne leaden.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }

        Divider()
        Text("Score-breakdown")
            .font(.caption.bold())
            .foregroundStyle(.secondary)
        facetBars(i.facets, totalScore: i.lead.leadScore)

        if i.recommendation != nil {
            Divider()
            HStack {
                Button(acted ? "Akseptert ✓" : "Aksepter") {
                    guard let rec = i.recommendation else { return }
                    Task {
                        _ = try? await api.acceptRecommendation(rec.id)
                        acted = true
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(acted)

                Button("Avvis") {
                    guard let rec = i.recommendation else { return }
                    Task {
                        _ = try? await api.dismissRecommendation(rec.id)
                        await load()
                    }
                }
                .buttonStyle(.bordered)
                .tint(.gray)

                Button {
                    presentingVoiceMemo = true
                } label: {
                    Label("Voice memo", systemImage: "mic.fill")
                }
                .buttonStyle(.bordered)
                .tint(.red)

                Button {
                    presentingFullReport = true
                } label: {
                    Label("Full rapport", systemImage: "sparkles.rectangle.stack")
                }
                .buttonStyle(.bordered)
                .tint(.indigo)
            }
        } else {
            // Ingen aktiv anbefaling — vis fortsatt Full-rapport-CTA.
            Divider()
            Button {
                presentingFullReport = true
            } label: {
                Label("Full rapport", systemImage: "sparkles.rectangle.stack")
            }
            .buttonStyle(.bordered)
            .tint(.indigo)
        }
    }

    @ViewBuilder
    private func facetBars(_ f: ScoringFacets, totalScore: Int?) -> some View {
        let rows: [(String, Double?)] = [
            ("Kategori-fit",   f.categoryFit),
            ("Digitalt behov", f.digitalNeed),
            ("Budsjett",       f.budgetPotential),
            ("Engasjement",    f.engagement),
            ("Timing",         f.timing),
            ("Lokasjons-fit",  f.locationFit),
        ]
        VStack(alignment: .leading, spacing: 4) {
            ForEach(rows, id: \.0) { row in
                HStack(spacing: 8) {
                    Text(row.0)
                        .font(.caption)
                        .frame(width: 110, alignment: .leading)
                    ProgressView(value: max(0, min(100, row.1 ?? 0)) / 100.0)
                        .tint(.purple)
                    Text("\(Int(row.1 ?? 0))")
                        .font(.caption.monospacedDigit())
                        .frame(width: 28, alignment: .trailing)
                }
            }
            if let total = totalScore {
                HStack {
                    Spacer()
                    Text("Total: \(total)")
                        .font(.caption.bold())
                        .foregroundStyle(.purple)
                }
            }
        }
    }

    // MARK: - Helpers

    private func prioChip(_ p: String) -> some View {
        let color: Color = {
            switch p {
            case "urgent": return .red
            case "high":   return .orange
            case "normal": return .blue
            default:       return .gray
            }
        }()
        return Text(p.uppercased())
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
        case "run_research":             return "magnifyingglass.circle.fill"
        default:                         return "sparkles"
        }
    }

    private func actionLabel(_ a: String) -> String {
        switch a {
        case "call_now":                 return "RING NÅ"
        case "send_email":               return "SEND E-POST"
        case "send_follow_up_email":     return "SEND OPPFØLGINGS-MAIL"
        case "visit":                    return "BESØK"
        case "book_meeting":             return "BOOK MØTE"
        case "send_proposal":            return "SEND TILBUD"
        default:                         return a.replacingOccurrences(of: "_", with: " ").uppercased()
        }
    }

    private func formatBestTime(_ bct: BestContactTime) -> String {
        let day = bct.weekday ?? "—"
        if let from = bct.hourFrom, let to = bct.hourTo {
            return "\(day) \(from):00–\(to):00"
        }
        return day
    }

    private func relativeTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        guard let d = f.date(from: iso) else { return iso }
        let secs = -d.timeIntervalSinceNow
        if secs < 60   { return "nå" }
        if secs < 3600 { return "\(Int(secs/60))m siden" }
        if secs < 86400 { return "\(Int(secs/3600))t siden" }
        return "\(Int(secs/86400))d siden"
    }

    @MainActor
    private func load() async {
        loading = true; errorText = nil
        do {
            intel = try await api.fetchLeadIntelligence(leadId: leadId)
        } catch {
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
        }
        loading = false
    }

    @MainActor
    private func recompute() async {
        loading = true; errorText = nil
        do {
            intel = try await api.recomputeLeadIntelligence(leadId: leadId)
            acted = false
        } catch {
            errorText = "Re-compute feilet: \(error.localizedDescription)"
        }
        loading = false
    }
}
