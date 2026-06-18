// LeadNeedsView.swift
//
// Viser scout-resultatet (needs/signals/scores) på lead-detail. Vises
// kun hvis bruker har marketing.needs.view-permission. Markedssjef +
// markedskoordinator + alle marketing-roller har dette by default.
//
// Tre seksjoner:
//   1. Composite-score (stort tall, vekt-progress)
//   2. Needs — chips pr behov m/ priority-stripe
//   3. Signals — positive vs negative chip-grid
//   4. "Kjør scout på nytt"-knapp (marketing.scout.run kreves)

import SwiftUI

struct LeadNeedsView: View {
    let leadId: String
    let leadName: String
    let canRunScout: Bool          // marketing.scout.run-permission

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var overview: LeadNeedsOverviewResponse?
    @State private var isLoading = true
    @State private var error: String?
    @State private var isScouting = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Behov & signaler")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
                .task { await load() }
                .refreshable { await load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && overview == nil {
            VStack(spacing: 16) {
                ProgressView().controlSize(.large)
                Text("Leter etter pins …")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let o = overview {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    scoreHeader(score: o.compositeScore, lastRun: o.lastRun)
                    if !o.needs.isEmpty { needsSection(o.needs) }
                    if !o.signals.isEmpty { signalsSection(o.signals) }
                    if !o.scores.isEmpty { scoresSection(o.scores) }
                    if canRunScout {
                        Button {
                            Task { await runScout() }
                        } label: {
                            HStack {
                                if isScouting {
                                    ProgressView().controlSize(.small)
                                    Text("Tråler \(leadName) …")
                                } else {
                                    Image(systemName: "arrow.clockwise")
                                    Text(o.lastRun == nil ? "Trål etter mangler" : "Trål på nytt")
                                }
                                Spacer()
                            }
                            .padding()
                            .background(Color.secondary.opacity(0.08),
                                        in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(isScouting)
                    }
                }
                .padding(20)
            }
        } else {
            ContentUnavailableView(
                "Ingen pins enda",
                systemImage: "magnifyingglass",
                description: Text(error ?? "Trykk 'Trål etter mangler' så går Leadgrid gjennom websiten og setter pins per behov.")
            )
        }
    }

    // MARK: - Score header

    private func scoreHeader(score: Int, lastRun: LeadScoutLastRun?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Leadgrid-score")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(score)")
                    .font(.system(size: 56, weight: .bold))
                    .foregroundStyle(scoreColor(score))
                Text("/ 100")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            ProgressView(value: Double(score) / 100.0)
                .tint(scoreColor(score))
            if let run = lastRun {
                Text("Sist trålet \(run.startedAt.prefix(16)) — \(run.needsFound) behov, \(run.signalsFound) signaler")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [scoreColor(score).opacity(0.12), Color.clear],
                startPoint: .leading, endPoint: .trailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
    }

    // MARK: - Needs

    private func needsSection(_ needs: [LeadNeedRow]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Behov", count: needs.count, icon: "list.bullet.clipboard")
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 160), spacing: 8)],
                alignment: .leading, spacing: 8
            ) {
                ForEach(needs) { need in needPill(need) }
            }
        }
    }

    private func needPill(_ need: LeadNeedRow) -> some View {
        HStack(spacing: 6) {
            Capsule()
                .fill(priorityColor(need.priority))
                .frame(width: 3, height: 22)
            Text(need.displayLabel)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.secondary.opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Signals

    private func signalsSection(_ signals: [LeadSignalRow]) -> some View {
        let positive = signals.filter { $0.isPositive }
        let negative = signals.filter { $0.isNegative }
        return VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Signaler", count: signals.count, icon: "antenna.radiowaves.left.and.right")
            if !positive.isEmpty {
                Text("Styrker")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.green)
                    .textCase(.uppercase)
                signalChipGrid(positive, accent: .green)
            }
            if !negative.isEmpty {
                Text("Mangler")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.orange)
                    .textCase(.uppercase)
                signalChipGrid(negative, accent: .orange)
            }
        }
    }

    private func signalChipGrid(_ signals: [LeadSignalRow], accent: Color) -> some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 170), spacing: 8)],
            alignment: .leading, spacing: 8
        ) {
            ForEach(signals) { s in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Image(systemName: s.isPositive ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(accent)
                            .font(.caption)
                        Text(s.displayLabel)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    if let raw = s.rawValue {
                        Text(raw)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding(10)
                .background(accent.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Scores

    private func scoresSection(_ scores: [LeadScoreRow]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Score-dimensjoner", count: scores.count, icon: "chart.bar.xaxis")
            ForEach(scores) { s in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(s.displayLabel)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("\(s.normalized0_100)/100")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(scoreColor(s.normalized0_100))
                    }
                    ProgressView(value: Double(s.normalized0_100) / 100.0)
                        .tint(scoreColor(s.normalized0_100))
                    if let raw = s.rawValue {
                        Text(raw)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String, count: Int, icon: String) -> some View {
        HStack {
            Image(systemName: icon).foregroundStyle(.tint)
            Text(title).font(.headline)
            Spacer()
            Text("\(count)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
        }
    }

    private func priorityColor(_ p: Int) -> Color {
        switch p {
        case 5:  return .red
        case 4:  return .orange
        case 3:  return .yellow
        case 2:  return .blue
        default: return .secondary
        }
    }

    private func scoreColor(_ s: Int) -> Color {
        switch s {
        case 80...100: return .green
        case 60..<80:  return .yellow
        case 40..<60:  return .orange
        default:       return .red
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Lukk") { dismiss() }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let api = appState.api else { return }
        do {
            let resp = try await api.fetchLeadNeedsOverview(leadId: leadId)
            overview = resp
            isLoading = false
        } catch {
            self.error = String(describing: error)
            isLoading = false
        }
    }

    private func runScout() async {
        guard let api = appState.api else { return }
        isScouting = true
        defer { isScouting = false }
        do {
            _ = try await api.runScoutForLead(leadId: leadId)
            await load()
        } catch {
            self.error = String(describing: error)
        }
    }
}
