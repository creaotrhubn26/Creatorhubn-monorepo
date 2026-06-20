// LeaderboardView.swift
//
// Team-leaderboard for Salgssjef/Teamleder/Admin (PR #620).
// Speilet fra web LeadMapLeaderboardPanel.

import SwiftUI

struct LeaderboardView: View {
    @Environment(AppState.self) private var state
    @State private var period: LeaderboardPeriod = .thisMonth
    @State private var sort: LeaderboardSort = .progress
    @State private var teamFilter: String = ""
    @State private var teams: [SalesTeam] = []
    @State private var entries: [LeaderboardEntry] = []
    @State private var summary: LeaderboardSummary?
    @State private var error: String?
    @State private var loading = false

    private var hasAccess: Bool {
        guard let role = state.roleInOrg else { return false }
        return ["admin", "salgssjef", "teamleder"].contains(role)
    }

    var body: some View {
        NavigationStack {
            Group {
                if !hasAccess {
                    accessGate
                } else {
                    content
                }
            }
            .navigationTitle("Team-leaderboard")
        .salesHierarchyBackdrop(.teamLeader)
            .task { await load() }
            .refreshable { await load() }
        }
    }

    // MARK: - Access gate

    private var accessGate: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Kun for admin, salgssjef og teamleder")
                .font(.headline)
            Text("Salgskonsulent og promotør har ikke tilgang til leaderboard for å unngå intern konkurranse-press.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(spacing: 16) {
                filterBar
                if let summary = summary {
                    summarySection(summary)
                }
                entriesSection
            }
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
    }

    // MARK: - Filter

    private var filterBar: some View {
        VStack(spacing: 8) {
            Picker("Periode", selection: $period) {
                ForEach(LeaderboardPeriod.allCases) { p in
                    Text(p.label).tag(p)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: period) { Task { await load() } }

            HStack(spacing: 12) {
                if !teams.isEmpty {
                    Picker("Team", selection: $teamFilter) {
                        Text("Alle team").tag("")
                        ForEach(teams) { t in
                            Text(t.name).tag(t.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .onChange(of: teamFilter) { Task { await load() } }
                }
                Spacer()
                Picker("Sortér", selection: $sort) {
                    ForEach(LeaderboardSort.allCases) { s in
                        Text(s.label).tag(s)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: sort) { Task { await load() } }
            }
        }
    }

    // MARK: - Summary

    private func summarySection(_ s: LeaderboardSummary) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            summaryTile("chart.line.uptrend.xyaxis",
                       color: Color(red: 0.75, green: 0.52, blue: 0.99),
                       label: "Omsetning",
                       value: formatNok(s.totalAchievedNok),
                       sub: s.totalTargetNok > 0
                          ? "av \(formatNok(s.totalTargetNok)) mål" : nil)
            summaryTile("trophy.fill",
                       color: Color(red: 0.97, green: 0.45, blue: 0.09),
                       label: "Vunnet",
                       value: "\(s.totalWon)",
                       sub: s.closeRate.map { "\($0)% close-rate" })
            summaryTile("person.3.fill",
                       color: Color(red: 0.20, green: 0.85, blue: 0.60),
                       label: "Møter",
                       value: "\(s.totalMeetings)")
            summaryTile("medal.fill",
                       color: Color(red: 0.98, green: 0.75, blue: 0.14),
                       label: "Aktive selgere",
                       value: "\(s.activeSellers)",
                       sub: s.progressPct.map { "\($0)% snitt" })
        }
    }

    private func summaryTile(_ icon: String, color: Color, label: String, value: String, sub: String? = nil) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(color)
            VStack(alignment: .leading) {
                Text(label).font(.caption2).foregroundStyle(.secondary)
                Text(value).font(.headline)
                if let sub {
                    Text(sub).font(.caption2).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Entries

    private var entriesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Rangering")
                .font(.headline)
                .padding(.top, 4)
            if entries.isEmpty && !loading {
                Text("Ingen salgs-konsulenter funnet")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            ForEach(entries) { entry in
                LeaderboardRow(entry: entry)
            }
        }
    }

    // MARK: - Load

    @MainActor
    private func load() async {
        guard let api = state.api, let orgId = state.activeOrganizationId,
              hasAccess else { return }
        loading = true
        defer { loading = false }
        // Hent teams hvis tomt
        if teams.isEmpty {
            do { teams = try await api.fetchSalesTeams(orgId) } catch { /* noop */ }
        }
        do {
            let resp = try await api.fetchLeaderboard(
                organizationId: orgId,
                period: period.rawValue,
                teamId: teamFilter.isEmpty ? nil : teamFilter,
                sort: sort.rawValue
            )
            entries = resp.leaderboard
            error = nil
        } catch {
            self.error = String(describing: error)
        }
        do {
            summary = try await api.fetchLeaderboardSummary(
                organizationId: orgId,
                period: period.rawValue
            )
        } catch {
            // Summary er ikke kritisk
        }
    }
}

// MARK: - Leaderboard-rad

private struct LeaderboardRow: View {
    let entry: LeaderboardEntry

    private var roleColor: Color {
        switch entry.role {
        case "admin": return Color(red: 0.75, green: 0.52, blue: 0.99)
        case "salgssjef": return Color(red: 0.97, green: 0.45, blue: 0.09)
        case "teamleder": return Color(red: 0.98, green: 0.75, blue: 0.14)
        case "salgskonsulent": return Color(red: 0.20, green: 0.85, blue: 0.60)
        case "promotor": return Color(red: 0.37, green: 0.65, blue: 0.98)
        default: return .gray
        }
    }

    private var roleLabel: String {
        switch entry.role {
        case "admin": return "Admin"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Salgskonsulent"
        case "promotor": return "Promotør"
        default: return entry.role
        }
    }

    private var progressColor: Color {
        let pct = entry.progressPct ?? 0
        if pct >= 100 { return Color(red: 0.20, green: 0.85, blue: 0.60) }
        if pct >= 70 { return Color(red: 0.75, green: 0.52, blue: 0.99) }
        return Color(red: 0.98, green: 0.75, blue: 0.14)
    }

    private var closeRateColor: Color {
        guard let r = entry.closeRate else { return .gray }
        if r >= 50 { return Color(red: 0.20, green: 0.85, blue: 0.60) }
        if r >= 25 { return Color(red: 0.98, green: 0.75, blue: 0.14) }
        return Color(red: 0.97, green: 0.45, blue: 0.44)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                rankBadge
                avatar
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(entry.displayName ?? entry.email ?? entry.userId)
                            .font(.callout).bold()
                        Text(roleLabel)
                            .font(.caption2).bold()
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(roleColor.opacity(0.2), in: Capsule())
                            .foregroundStyle(roleColor)
                    }
                    Text("\(entry.title ?? "—")\(entry.teamName.map { " · \($0)" } ?? "")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if let rate = entry.closeRate {
                    Text("\(rate)%")
                        .font(.caption2).bold()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(closeRateColor.opacity(0.2), in: Capsule())
                        .foregroundStyle(closeRateColor)
                }
            }

            // Kvote-bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(formatNok(entry.achievedNok))
                        .font(.caption).bold()
                    Spacer()
                    if let pct = entry.progressPct {
                        Text("\(pct)%").font(.caption).foregroundStyle(.secondary)
                    }
                }
                ProgressView(value: min(1.0, Double(entry.progressPct ?? 0) / 100))
                    .tint(progressColor)
                if entry.targetNok > 0 {
                    Text("Mål \(formatNok(entry.targetNok))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // Stats-rad
            HStack(spacing: 16) {
                statBlock("Vunnet", value: "\(entry.wonCount)",
                          extra: entry.lostCount > 0 ? "/\(entry.lostCount) tapt" : nil)
                statBlock("Møter", value: "\(entry.meetingsCount)")
                statBlock("Aktive leads", value: "\(entry.leadsActive)")
            }
            .font(.caption2)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(entry.medalHex.map { Color(hex: $0) } ?? .clear,
                        lineWidth: entry.medalHex != nil ? 1.5 : 0)
        )
    }

    @ViewBuilder
    private var rankBadge: some View {
        if let hex = entry.medalHex {
            Image(systemName: "medal.fill")
                .font(.title)
                .foregroundStyle(Color(hex: hex))
                .frame(width: 40, height: 40)
        } else {
            Text("\(entry.rank)")
                .font(.title3).bold()
                .foregroundStyle(.secondary)
                .frame(width: 40, height: 40)
        }
    }

    private var avatar: some View {
        AsyncImage(url: entry.avatarUrl.flatMap(URL.init)) { phase in
            switch phase {
            case .success(let img): img.resizable().scaledToFit()
            default:
                Text(String((entry.displayName ?? entry.email ?? "?").prefix(1)).uppercased())
                    .font(.callout).bold()
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.gray)
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(Circle())
        .overlay(
            Circle().stroke(
                entry.medalHex.map { Color(hex: $0) } ?? .clear,
                lineWidth: entry.medalHex != nil ? 2 : 0
            )
        )
    }

    private func statBlock(_ label: String, value: String, extra: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).foregroundStyle(.secondary)
            HStack(spacing: 2) {
                Text(value).bold().font(.caption)
                if let extra {
                    Text(extra).foregroundStyle(.secondary).font(.caption2)
                }
            }
        }
    }
}

// MARK: - Hjelpere

private func formatNok(_ n: Double) -> String {
    let fmt = NumberFormatter()
    fmt.locale = Locale(identifier: "nb_NO")
    fmt.numberStyle = .decimal
    fmt.maximumFractionDigits = 0
    return "\(fmt.string(from: NSNumber(value: n)) ?? "0") kr"
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
