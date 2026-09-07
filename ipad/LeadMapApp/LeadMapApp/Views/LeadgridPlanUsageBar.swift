// LeadgridPlanUsageBar.swift
//
// Plan-quota-indikator i Hub-toppen.
// "73 / 100 leads brukt" + farge etter prosent + in-grace-banner.
//
// Backend: GET /api/leadgrid/plan/summary?orgId=...

import SwiftUI

struct LeadgridPlanUsageBar: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        HStack(spacing: 10) {
            if appState.workspacePlanLoadState == .loading {
                ProgressView().scaleEffect(0.7)
                Text("Henter plan-bruk…").font(.caption).foregroundStyle(.secondary)
                Spacer()
            } else if appState.workspacePlanOrganizationId == appState.activeOrganizationId,
                      let s = appState.workspacePlanSummary {
                content(s)
            } else if appState.workspacePlanLoadState == .failed {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text("Plan utilgjengelig").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
                Button("Prøv igjen") { Task { await load() } }
                    .font(.caption2)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(barBackground, in: RoundedRectangle(cornerRadius: 10))
        .task(id: appState.activeOrganizationId) {
            guard appState.workspacePlanSummary == nil,
                  appState.workspacePlanLoadState != .loading else { return }
            await load()
        }
    }

    // MARK: - Content

    @ViewBuilder
    private func content(_ s: LeadgridPlanSummary) -> some View {
        // Plan-navn + leads-teller
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Image(systemName: planIcon(s.planKey))
                    .foregroundStyle(barColor(s.worstPct))
                    .font(.caption.bold())
                Text(s.displayName)
                    .font(.caption.bold())
                if s.inGrace {
                    Label("Grace", systemImage: "exclamationmark.shield.fill")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Color.orange.opacity(0.20), in: Capsule())
                        .foregroundStyle(.orange)
                }
            }
            Text(s.primaryLabel)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }

        Spacer()

        // Bar
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.secondary.opacity(0.15))
                    .frame(height: 6)

                RoundedRectangle(cornerRadius: 4)
                    .fill(barColor(s.worstPct))
                    .frame(
                        width: geo.size.width * CGFloat(min(100, s.worstPct)) / 100,
                        height: 6,
                    )
            }
            .frame(height: 6)
            .frame(maxHeight: .infinity, alignment: .center)
        }
        .frame(width: 80, height: 20)

        Text("\(s.worstPct)%")
            .font(.caption2.bold())
            .foregroundStyle(barColor(s.worstPct))
            .frame(width: 36, alignment: .trailing)
    }

    // MARK: - Helpers

    private var barBackground: Color {
        guard appState.workspacePlanOrganizationId == appState.activeOrganizationId,
              let s = appState.workspacePlanSummary else { return Color.secondary.opacity(0.08) }
        if s.inGrace { return Color.orange.opacity(0.10) }
        if s.worstPct >= 90 { return Color.red.opacity(0.08) }
        if s.worstPct >= 75 { return Color.orange.opacity(0.08) }
        return Color.secondary.opacity(0.08)
    }

    private func barColor(_ pct: Int) -> Color {
        if pct >= 90 { return .red }
        if pct >= 75 { return .orange }
        return .green
    }

    private func planIcon(_ key: String) -> String {
        LeadgridPlanPresentation.icon(for: key)
    }

    // MARK: - Load

    private func load() async {
        await appState.loadWorkspacePlanSummary()
    }
}
