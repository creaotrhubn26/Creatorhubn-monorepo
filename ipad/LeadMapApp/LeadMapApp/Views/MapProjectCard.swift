// MapProjectCard.swift
//
// Aktivt prosjekt-kort øverst på kartet. Erstatter den gamle passive
// ProjectContextCard (som kun viste navn + ikon "1" + diamant "0").
//
// Vises:
//   • Logo / monogram + prosjektnavn
//   • Status-linje: aktiv rute, leads igjen i dag, momentum %
//   • Neste stopp (hvis dayRoute) + drive-tid
//   • Drag-handle: sveipes opp → ProjectDetailSheet (full bottom-sheet)
//   • CTA-rad: [Start rute] [Neste lead] [Detaljer]
//
// Data hentes fra eksisterende AppState — vi finner ikke opp nye
// endepunkter, bare rikere bruk av momentum/dayRoute/workloadLeads.

import SwiftUI

struct MapProjectCard: View {
    @Environment(AppState.self) private var appState
    /// Bindes til parent for å bytte til Leads-tab og åpne Min dag.
    var onStartRoute: () -> Void
    var onOpenNext: (LeadModel) -> Void
    var onTapExpand: () -> Void

    @State private var momentum: LeadgridMomentum?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            headerRow
            statusLine
            if let nextStop = nextRouteStop {
                nextStopRow(nextStop)
            } else if let nextLead = nextWorkloadLead {
                nextStopRow(leadName: nextLead.name,
                            distanceKm: nextLead.distanceKm,
                            address: nextLead.address ?? nextLead.city)
            }
            actionRow
            // Drag-handle som visuell hint om at kortet kan sveipes opp.
            Capsule()
                .fill(Color.white.opacity(0.25))
                .frame(width: 36, height: 4)
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.36, green: 0.18, blue: 0.62).opacity(0.92),
                    Color(red: 0.18, green: 0.08, blue: 0.38).opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 8, x: 0, y: 4)
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture { onTapExpand() }
        .gesture(
            DragGesture(minimumDistance: 18)
                .onEnded { value in
                    if value.translation.height < -20 { onTapExpand() }
                }
        )
        .task { await loadMomentum() }
        .padding(.horizontal, 12)
    }

    // MARK: - Header

    @ViewBuilder
    private var headerRow: some View {
        HStack(alignment: .center, spacing: 10) {
            logoBubble
            VStack(alignment: .leading, spacing: 2) {
                Text(projectName)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(positioning)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            statusBadge
        }
    }

    @ViewBuilder
    private var logoBubble: some View {
        let summary = appState.activeProjectSummary
        Group {
            if let urlStr = summary?.brandKit?.logoUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit().padding(4)
                    default:
                        Text(projectName.prefix(2).uppercased())
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 38, height: 38)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Text(projectName.prefix(2).uppercased())
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        let active = appState.dayRoute != nil
        HStack(spacing: 4) {
            Circle()
                .fill(active ? Color(red: 0.30, green: 0.92, blue: 0.55) : Color.white.opacity(0.4))
                .frame(width: 7, height: 7)
            Text(active ? "Aktiv rute" : "Ingen rute")
                .font(.caption2.bold())
                .foregroundStyle(.white.opacity(0.92))
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Color.white.opacity(0.12), in: Capsule())
    }

    // MARK: - Status-linje (leads igjen i dag · momentum)

    @ViewBuilder
    private var statusLine: some View {
        HStack(spacing: 10) {
            Label("\(leadsRemainingToday) leads igjen", systemImage: "checklist")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.92))
            if let m = momentum {
                Label("\(Int(m.score))% momentum", systemImage: "bolt.heart.fill")
                    .font(.caption.bold())
                    .foregroundStyle(momentumColor(m.score))
            } else if let metrics = appState.metrics {
                Label("\(metrics.totalLeads) leads totalt", systemImage: "person.3.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.85))
            }
            Spacer(minLength: 0)
        }
    }

    private func momentumColor(_ score: Double) -> Color {
        if score >= 75 { return Color(red: 0.30, green: 0.92, blue: 0.55) }
        if score >= 50 { return Color(red: 0.98, green: 0.79, blue: 0.30) }
        return Color(red: 0.98, green: 0.50, blue: 0.50)
    }

    // MARK: - Neste stopp

    @ViewBuilder
    private func nextStopRow(_ stop: DayRouteStop) -> some View {
        nextStopRow(
            leadName: stop.name ?? "Stopp \(stop.position)",
            distanceKm: nil,
            driveSeconds: stop.driveSecondsFromPrevious,
            address: nil
        )
    }

    @ViewBuilder
    private func nextStopRow(
        leadName: String,
        distanceKm: Double?,
        driveSeconds: Int? = nil,
        address: String?
    ) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.turn.up.right")
                .foregroundStyle(Color(red: 0.30, green: 0.92, blue: 0.55))
                .font(.caption.bold())
            VStack(alignment: .leading, spacing: 2) {
                Text("Neste stopp: \(leadName)")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let s = driveSeconds, s > 0 {
                    Text("\(s / 60) min unna")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                } else if let km = distanceKm {
                    Text(formatKm(km))
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                } else if let addr = address {
                    Text(addr)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private func formatKm(_ km: Double) -> String {
        if km < 1 { return "\(Int(km * 1000)) m unna" }
        return String(format: "%.1f km unna", km)
    }

    // MARK: - CTA-rad

    @ViewBuilder
    private var actionRow: some View {
        HStack(spacing: 8) {
            Button {
                onStartRoute()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                    Text(appState.dayRoute == nil ? "Start rute" : "Vis rute")
                }
                .font(.caption.bold())
                .padding(.horizontal, 10).padding(.vertical, 6)
                .frame(maxWidth: .infinity)
                .background(Color.white, in: Capsule())
                .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.62))
            }
            .buttonStyle(.plain)

            if let nextLead = nextWorkloadLead {
                Button {
                    // Map workload-lead → LeadModel hvis vi har den i appState.leads.
                    if let model = appState.leads.first(where: { $0.id == nextLead.id }) {
                        onOpenNext(model)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right.circle.fill")
                        Text("Neste lead")
                    }
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(Color.white.opacity(0.18), in: Capsule())
                    .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Computed helpers

    private var projectName: String {
        appState.activeProjectSummary?.project.name
            ?? appState.projects.first(where: { $0.id == appState.activeProjectId })?.name
            ?? "Alle leads"
    }

    private var positioning: String {
        appState.activeProjectSummary?.brandKit?.positioningSummary
            ?? "Felt-arbeid i dag"
    }

    /// Antall leads vi enda må kontakte i dag (workload − kontaktet).
    private var leadsRemainingToday: Int {
        let pending = appState.workloadLeads.filter { wl in
            // Behandle som "ikke kontaktet" hvis siste kontakt var > 24h siden
            // eller mangler helt.
            guard let s = wl.lastContactedAt,
                  let date = ISO8601DateFormatter().date(from: s) else { return true }
            return Date().timeIntervalSince(date) > 60 * 60 * 24
        }
        return max(pending.count, (appState.dayRoute?.stops.count ?? 0))
    }

    private var nextRouteStop: DayRouteStop? {
        appState.dayRoute?.stops.first
    }

    private var nextWorkloadLead: WorkloadLead? {
        // Foretrekk Claude-rangert; fall back til nærmeste.
        appState.workloadLeads.first {
            ($0.claudeRecommendationRank ?? 9999) <= 5
        } ?? appState.workloadLeads.first
    }

    @MainActor
    private func loadMomentum() async {
        guard let api = appState.api else { return }
        do {
            self.momentum = try await api.fetchMomentumToday()
        } catch {
            // Stille — momentum kan være null hvis bruker ikke har Leadgrid.
        }
    }
}
