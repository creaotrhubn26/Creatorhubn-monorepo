// LeadgridMomentumCard.swift
//
// "Momentum i dag" — hovedkort på Min dag som viser Daniels Momentum
// Engine: stor score m/ progress + trend-arrow + 4 aktivitets-chips
// + 3 Next Best Actions + Claude-reasoning. Knapp åpner SetGoal-sheet.
//
// Endepunkt: GET /api/leadgrid/momentum/today

import SwiftUI

struct LeadgridMomentumCard: View {
    let api: APIClient
    @State private var momentum: LeadgridMomentum?
    @State private var loading = true
    @State private var errorText: String?
    @State private var presentingSetGoal = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            if loading && momentum == nil {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if let m = momentum {
                scoreRow(m)
                activityRow(m)
                if !m.nextBestActions.isEmpty {
                    Divider()
                    actionsSection(m)
                }
                Divider()
                Text(m.reasoning)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else if let errorText {
                Text(errorText).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
        .task { await load() }
        .sheet(isPresented: $presentingSetGoal) {
            LeadgridSetGoalSheet(api: api, onSaved: {
                Task { await load() }
            })
        }
    }

    @ViewBuilder
    private var header: some View {
        HStack {
            Image(systemName: "bolt.heart.fill")
                .foregroundStyle(.purple)
                .font(.title3)
            Text("Momentum i dag").font(.headline)
            Spacer()
            Button {
                presentingSetGoal = true
            } label: {
                Image(systemName: "target")
                    .font(.caption)
            }
            .accessibilityLabel("Sett salgsmål")
            Button {
                Task { await load() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.caption)
            }
            .accessibilityLabel("Oppdater momentum")
        }
    }

    @ViewBuilder
    private func scoreRow(_ m: LeadgridMomentum) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("\(Int(m.score))")
                .font(.system(size: 56, weight: .bold))
                .foregroundStyle(momentumColor(m.score))
            Text("%")
                .font(.title2)
                .foregroundStyle(.secondary)
            Spacer()
            trendBadge(m.trend)
        }
        ProgressView(value: m.score / 100.0)
            .tint(momentumColor(m.score))
            .scaleEffect(x: 1, y: 1.5, anchor: .center)
    }

    @ViewBuilder
    private func activityRow(_ m: LeadgridMomentum) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Aktivitet i dag").font(.caption.bold()).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                activityChip("Kontakter", current: m.todayActivity.contacts, target: m.todayActivity.contactsTarget, color: .blue)
                activityChip("Oppfølg.", current: m.todayActivity.followups, target: m.todayActivity.followupsTarget, color: .orange)
                activityChip("Møter", current: m.todayActivity.meetings, target: m.todayActivity.meetingsTarget, color: .green)
                activityChip("Pipeline", current: m.todayActivity.pipelineMoves, target: m.todayActivity.pipelineMovesTarget, color: .indigo)
            }
        }
    }

    @ViewBuilder
    private func activityChip(_ label: String, current: Int, target: Int, color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(current)/\(target)")
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(current >= target ? color : .primary)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(color.opacity(current >= target ? 0.20 : 0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private func actionsSection(_ m: LeadgridMomentum) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Neste beste handling").font(.caption.bold()).foregroundStyle(.secondary)
            ForEach(m.nextBestActions) { action in
                HStack(spacing: 8) {
                    Image(systemName: actionIcon(action.type))
                        .foregroundStyle(urgencyColor(action.urgency))
                        .font(.caption)
                        .frame(width: 16)
                    Text(action.label)
                        .font(.caption)
                    Spacer()
                }
            }
        }
    }

    @ViewBuilder
    private func trendBadge(_ trend: String) -> some View {
        let (icon, color, label): (String, Color, String) = switch trend {
            case "rising": ("arrow.up.right", .green, "Stiger")
            case "falling": ("arrow.down.right", .red, "Faller")
            default: ("arrow.right", .blue, "Stabil")
        }
        HStack(spacing: 3) {
            Image(systemName: icon)
            Text(label)
        }
        .font(.caption.bold())
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.15), in: Capsule())
        .foregroundStyle(color)
    }

    private func momentumColor(_ score: Double) -> Color {
        if score >= 75 { return .green }
        if score >= 50 { return .orange }
        return .red
    }
    private func urgencyColor(_ u: String) -> Color {
        if u == "high" { return .red }
        if u == "normal" { return .orange }
        return .blue
    }
    private func actionIcon(_ type: String) -> String {
        switch type {
        case "contact_more": return "phone.fill"
        case "do_followups": return "envelope.fill"
        case "book_meeting": return "calendar.badge.plus"
        case "prevent_decay": return "exclamationmark.triangle.fill"
        case "clear_overdue": return "clock.badge.exclamationmark.fill"
        default: return "sparkles"
        }
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            momentum = try await api.fetchMomentumToday()
        } catch {
            errorText = "Kunne ikke laste momentum: \(error.localizedDescription)"
        }
        loading = false
    }
}
