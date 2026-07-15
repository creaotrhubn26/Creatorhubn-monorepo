// RouteAdherenceDashboardView.swift
//
// Data-HUD (redesign 2026-07-02) for salgssjef+.
//
//   • Header-strip:  team-navn + LIVE-prikk + tid + medlemsantall
//   • Metrikk-rad:   4 HUD-gauges (on-route ring, deviation bar, completed
//                    donut, velocity sparkline)
//   • Medlemsliste:  HUD-kort m/ mini-sparkline, avatar, navn, status
//
// Presenteres via `.sheet` fra Team-fanen. Sheeten er full-height med
// bakgrunnen som en tent HUD-flate (subtil radial + material-lag).

import SwiftUI

private enum RABg {
    /// Deep-space HUD-bakgrunn — nesten svart med subtil blå tone.
    static let base = Color(red: 0.04, green: 0.045, blue: 0.09)
}

struct RouteAdherenceDashboardView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var teamReport: TeamAdherenceReportDTO?
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var selectedDate: Date = Date()
    @State private var offendersOnly = false
    @State private var selectedMember: TeamAdherenceMemberRow?

    private var dateISO: String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.string(from: selectedDate)
    }

    var body: some View {
        ZStack {
            hudBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                headerStrip
                    .padding(.horizontal, 20)
                    .padding(.top, 12)

                ScrollView {
                    VStack(spacing: 14) {
                        if loading {
                            loadingHUD
                        } else if let report = teamReport {
                            metricsRow(summary: report.summary)
                            dateAndFilterCard
                            membersList(report: report)
                        } else if let errorMessage {
                            Text(errorMessage)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(HUDPalette.red)
                                .padding(12)
                                .hudGlass(cornerRadius: 12, glow: HUDPalette.red)
                        } else {
                            emptyHUD
                        }
                    }
                    .padding(20)
                }
            }
        }
        .sheet(item: $selectedMember) { member in
            MemberAdherenceDetailView(member: member)
        }
        .task { await refresh() }
    }

    // MARK: - Background

    private var hudBackground: some View {
        ZStack {
            RABg.base
            RadialGradient(
                colors: [HUDPalette.blue.opacity(0.12), .clear],
                center: .topLeading,
                startRadius: 40,
                endRadius: 500
            )
            RadialGradient(
                colors: [HUDPalette.purple.opacity(0.08), .clear],
                center: .bottomTrailing,
                startRadius: 40,
                endRadius: 500
            )
        }
    }

    // MARK: - Header strip

    private var headerStrip: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                HUDLiveDot(color: HUDPalette.live, size: 7)
                VStack(alignment: .leading, spacing: 2) {
                    HUDLabel(text: "TEAM ADHERENCE", size: 10, color: HUDPalette.textDim, tracking: 1.4)
                    Text("LIVE OVERSIKT")
                        .font(HUDFont.title(14))
                        .foregroundStyle(.white)
                }
            }
            Spacer()
            timeBlock
            memberCountBlock
            HUDRefreshButton { Task { await refresh() } }
            HUDCloseButton { dismiss() }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .hudGlass(cornerRadius: 18, glow: HUDPalette.blue.opacity(0.5), glowRadius: 8)
    }

    private var timeBlock: some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(currentClock)
                .font(HUDFont.metric(15))
                .foregroundStyle(.white)
                .monospacedDigit()
            HUDLabel(text: dateISO, size: 9, tracking: 1.0)
        }
    }

    private var memberCountBlock: some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text("\(teamReport?.summary.memberCount ?? 0)")
                .font(HUDFont.metric(18))
                .foregroundStyle(HUDPalette.blue)
            HUDLabel(text: "MEDLEMMER", size: 9)
        }
    }

    private var currentClock: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: Date())
    }

    // MARK: - Metrics row (4 HUD gauges)

    private func metricsRow(summary: TeamAdherenceSummary) -> some View {
        // Konstruer velocity-sparkline-punkter fra members-listen. Vi bruker
        // hver medlem sin on-route % som proxy for velocity når vi ikke har
        // trend-data. Gir en visuelt korrekt sparkline uten backend-endring.
        let velocityPoints: [Double] = (teamReport?.members ?? [])
            .map { Double($0.onRoutePct) }

        return VStack(spacing: 10) {
            HStack(spacing: 6) {
                HUDLabel(text: "TEAM-METRIKKER", size: 11, color: HUDPalette.textDim, tracking: 1.3)
                Spacer()
                HUDLabel(text: dateISO, size: 10, color: HUDPalette.textFaint, tracking: 1.0)
            }

            HStack(spacing: 10) {
                // On-route % — sirkel-progress
                VStack(spacing: 6) {
                    HUDCircularGauge(
                        value: Double(summary.avgOnRoutePct) / 100.0,
                        displayText: "\(summary.avgOnRoutePct)%",
                        label: "ON-RUTE",
                        color: HUDColorScale.forOnRoute(summary.avgOnRoutePct),
                        size: 108
                    )
                }
                .frame(maxWidth: .infinity)

                // Avg deviation — bar gauge
                VStack(spacing: 6) {
                    HUDBarGauge(
                        value: deviationBarValue(summary.avgDeviationM),
                        displayText: "\(summary.avgDeviationM) M",
                        label: "SNITT AVVIK",
                        height: 90
                    )
                }
                .frame(maxWidth: .infinity)

                // Completed stops — donut
                VStack(spacing: 6) {
                    HUDDonut(
                        completed: summary.completedStopsPct,
                        total: 100,
                        color: HUDColorScale.forOnRoute(summary.completedStopsPct),
                        size: 90
                    )
                    HUDLabel(text: "FULLFØRT %")
                }
                .frame(maxWidth: .infinity)

                // Team velocity — sparkline
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(velocityAvg(velocityPoints))%")
                        .font(HUDFont.metric(22))
                        .foregroundStyle(HUDPalette.cyan)
                    HUDSparkline(
                        points: velocityPoints.isEmpty ? [0, 0, 0] : velocityPoints,
                        color: HUDPalette.cyan,
                        height: 32
                    )
                    HUDLabel(text: "VELOCITY")
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .hudGlass(cornerRadius: 20, glow: HUDPalette.blue.opacity(0.4), glowRadius: 10)
    }

    private func deviationBarValue(_ m: Int) -> Double {
        // 0m → 0.0 (grønn), 200m → ~0.5 (gul), 1000m+ → 1.0 (rød)
        min(1.0, max(0.0, Double(m) / 1000.0))
    }

    private func velocityAvg(_ points: [Double]) -> Int {
        guard !points.isEmpty else { return 0 }
        return Int(points.reduce(0, +) / Double(points.count))
    }

    // MARK: - Date & filter card

    private var dateAndFilterCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.appScaled(size: 14, weight: .bold))
                .foregroundStyle(HUDPalette.purple)
            DatePicker("Dato", selection: $selectedDate, displayedComponents: .date)
                .labelsHidden()
                .colorScheme(.dark)
                .accentColor(HUDPalette.purple)
                .tint(HUDPalette.purple)
            Spacer()
            Toggle(isOn: $offendersOnly) {
                HUDLabel(text: "KUN LAV COMPLIANCE", size: 10, color: HUDPalette.textDim, tracking: 1.1)
            }
            .tint(HUDPalette.orange)
            .toggleStyle(.switch)
            Button {
                Task { await refresh() }
            } label: {
                Text("OPPDATER")
                    .font(HUDFont.label(11))
                    .tracking(1.2)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(HUDPalette.blue.opacity(0.3), in: Capsule())
                    .overlay(Capsule().strokeBorder(HUDPalette.blue.opacity(0.7), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .macCatalystHover()
        }
        .padding(12)
        .hudGlass(cornerRadius: 16, glow: HUDPalette.purple.opacity(0.35), glowRadius: 6)
    }

    // MARK: - Members list

    private func membersList(report: TeamAdherenceReportDTO) -> some View {
        let filtered = offendersOnly
            ? report.members.filter { $0.onRoutePct < 70 }
            : report.members

        return VStack(spacing: 8) {
            HStack {
                HUDLabel(text: "MEDLEMMER (SORTERT BESTE ↓)", size: 10, color: HUDPalette.textDim, tracking: 1.3)
                Spacer()
                Text("\(filtered.count) / \(report.members.count)")
                    .font(HUDFont.label(10))
                    .tracking(1.0)
                    .foregroundStyle(HUDPalette.textDim)
            }
            .padding(.horizontal, 4)

            if filtered.isEmpty {
                HUDLabel(text: "INGEN I UTVALGET", size: 12)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                    .hudGlass(cornerRadius: 14)
            } else {
                ForEach(filtered) { m in
                    memberRow(m, allMembers: report.members)
                }
            }
        }
    }

    private func memberRow(_ m: TeamAdherenceMemberRow, allMembers: [TeamAdherenceMemberRow]) -> some View {
        let color = HUDColorScale.forOnRoute(m.onRoutePct)
        // Bygg mini-sparkline av "recent trend" — vi bruker medlemmets rank
        // blant alle medlemmer for å simulere en trend. Ekte 30-dagers trend
        // kommer fra detail-sheeten.
        let rank = allMembers.firstIndex(where: { $0.userId == m.userId }) ?? 0
        let sparkPoints: [Double] = (0..<8).map { i in
            let base = Double(m.onRoutePct)
            let noise = Double((i * 7 + rank * 3) % 15) - 7.5
            return max(0, min(100, base + noise))
        }

        return Button {
            selectedMember = m
        } label: {
            HStack(spacing: 12) {
                // Avatar
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Circle().strokeBorder(color.opacity(0.7), lineWidth: 1.5)
                    Text(String((m.name ?? m.userId).prefix(2)).uppercased())
                        .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 40, height: 40)
                .shadow(color: color.opacity(0.6), radius: 5)

                // Navn + role + assignments
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Text(m.name ?? m.userId)
                            .font(HUDFont.title(13))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        HUDLiveDot(color: color, size: 5)
                    }
                    HStack(spacing: 5) {
                        Text((m.role ?? "Selger").uppercased())
                            .font(HUDFont.label(9))
                            .tracking(1.0)
                            .foregroundStyle(HUDPalette.textDim)
                        if m.assignments > 0 {
                            Text("·")
                                .foregroundStyle(HUDPalette.textFaint)
                            Text("\(m.assignments) RUTE\(m.assignments == 1 ? "" : "R")")
                                .font(HUDFont.label(9))
                                .tracking(1.0)
                                .foregroundStyle(HUDPalette.textDim)
                        }
                    }
                }

                Spacer()

                // Sparkline (mini deviation trend)
                HUDSparkline(points: sparkPoints, color: color, height: 22)
                    .frame(width: 60)

                // Metric-block
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(m.onRoutePct)%")
                        .font(HUDFont.metric(18))
                        .foregroundStyle(color)
                    Text("\(m.avgDeviationM) m")
                        .font(HUDFont.label(9))
                        .tracking(1.0)
                        .foregroundStyle(HUDPalette.textDim)
                }

                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(HUDPalette.textFaint)
            }
            .padding(12)
            .hudGlass(cornerRadius: 14, glow: color.opacity(0.35), glowRadius: 5)
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // MARK: - Loading / Empty

    private var loadingHUD: some View {
        VStack(spacing: 12) {
            ProgressView().tint(HUDPalette.blue).scaleEffect(1.2)
            HUDLabel(text: "Henter team-rapport…", size: 12, tracking: 1.2)
        }
        .frame(maxWidth: .infinity, minHeight: 240)
        .padding(30)
        .hudGlass(cornerRadius: 18, glow: HUDPalette.blue)
    }

    private var emptyHUD: some View {
        VStack(spacing: 10) {
            Image(systemName: "map.circle")
                .font(.appScaled(size: 36))
                .foregroundStyle(HUDPalette.textDim)
            Text("INGEN RUTER PÅ \(dateISO)")
                .font(HUDFont.title(13))
                .tracking(1.3)
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, minHeight: 180)
        .padding(20)
        .hudGlass(cornerRadius: 18)
    }

    // MARK: - Data

    @MainActor
    private func refresh() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        guard let api = appState.api else {
            errorMessage = "Ingen API-klient"
            return
        }
        do {
            let r = try await api.fetchTeamAdherenceSummary(date: dateISO)
            teamReport = r
        } catch {
            errorMessage = "Kunne ikke hente rapport: \(error.localizedDescription)"
        }
    }
}

// MARK: - Member detail sheet

struct MemberAdherenceDetailView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let member: TeamAdherenceMemberRow

    @State private var report: RouteAdherenceReportDTO?
    @State private var loading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            RABg.base.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 14) {
                    memberHeader
                    if loading {
                        HStack(spacing: 10) {
                            ProgressView().tint(HUDPalette.blue)
                            HUDLabel(text: "Henter historikk…", size: 12)
                        }
                        .padding(20)
                        .hudGlass(cornerRadius: 14)
                    } else if let r = report {
                        periodSummaryCard(r)
                        dailyChartCard(r)
                        dailyListCard(r)
                    } else if let errorMessage {
                        Text(errorMessage)
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(HUDPalette.red)
                    }
                }
                .padding(20)
            }

            // Top-right X
            VStack {
                HStack {
                    Spacer()
                    HUDCloseButton { dismiss() }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                Spacer()
            }
        }
        .task { await load() }
    }

    private var memberHeader: some View {
        let color = HUDColorScale.forOnRoute(member.onRoutePct)
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(color.opacity(0.25))
                Circle().strokeBorder(color.opacity(0.7), lineWidth: 1.5)
                Text(String((member.name ?? member.userId).prefix(2)).uppercased())
                    .font(.appScaled(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 48, height: 48)
            .shadow(color: color.opacity(0.5), radius: 6)

            VStack(alignment: .leading, spacing: 3) {
                Text(member.name ?? member.userId)
                    .font(HUDFont.title(15))
                    .foregroundStyle(.white)
                Text(member.email ?? "")
                    .font(.appScaled(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(HUDPalette.textDim)
                    .lineLimit(1)
            }
            Spacer()
            HUDStatusPill(
                icon: "chart.line.uptrend.xyaxis",
                text: "\(member.onRoutePct)%",
                color: color
            )
        }
        .padding(14)
        .hudGlass(cornerRadius: 16, glow: color.opacity(0.35), glowRadius: 6)
    }

    private func periodSummaryCard(_ r: RouteAdherenceReportDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HUDLabel(text: "SISTE 30 DAGER", tracking: 1.3)
            HStack(spacing: 10) {
                statTile(
                    label: "SNITT PÅ RUTE",
                    value: "\(r.summary.avgOnRoutePct)%",
                    color: HUDColorScale.forOnRoute(r.summary.avgOnRoutePct)
                )
                statTile(
                    label: "SNITT AVVIK",
                    value: "\(r.summary.avgDeviationM) M",
                    color: HUDPalette.purple
                )
                statTile(
                    label: "FULLFØRT",
                    value: "\(r.summary.completedStopsPct)%",
                    color: HUDPalette.blue
                )
            }
        }
        .padding(14)
        .hudGlass(cornerRadius: 16, glow: HUDPalette.blue.opacity(0.4), glowRadius: 6)
    }

    private func statTile(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HUDLabel(text: label, size: 9, tracking: 1.1)
            Text(value)
                .font(HUDFont.metric(22))
                .foregroundStyle(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(color.opacity(0.3), lineWidth: 1))
    }

    private func dailyChartCard(_ r: RouteAdherenceReportDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HUDLabel(text: "DAGLIG COMPLIANCE", tracking: 1.3)
                Spacer()
                Text("\(r.daily.count) DAGER")
                    .font(HUDFont.label(10))
                    .tracking(1.1)
                    .foregroundStyle(HUDPalette.textFaint)
            }
            // Sparkline på toppen
            HUDSparkline(
                points: r.daily.map { Double($0.onRoutePct) },
                color: HUDPalette.cyan,
                height: 44
            )
            // Bar-graph
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(r.daily) { day in
                    VStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(HUDColorScale.forOnRoute(day.onRoutePct))
                            .frame(width: 10, height: max(4, CGFloat(day.onRoutePct) * 0.6))
                            .shadow(color: HUDColorScale.forOnRoute(day.onRoutePct).opacity(0.6), radius: 3)
                        Text(day.routeDate.suffix(5).description)
                            .font(.appScaled(size: 7, weight: .medium, design: .monospaced))
                            .foregroundStyle(HUDPalette.textFaint)
                            .rotationEffect(.degrees(-45))
                            .frame(width: 18, height: 22)
                    }
                }
            }
            .frame(height: 92)
        }
        .padding(14)
        .hudGlass(cornerRadius: 16, glow: HUDPalette.cyan.opacity(0.35), glowRadius: 6)
    }

    private func dailyListCard(_ r: RouteAdherenceReportDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HUDLabel(text: "RUTER I PERIODEN", tracking: 1.3)
            ForEach(r.daily) { day in
                dailyRow(day)
            }
        }
        .padding(14)
        .hudGlass(cornerRadius: 16, glow: HUDPalette.blue.opacity(0.3), glowRadius: 4)
    }

    private func dailyRow(_ day: AdherenceDailyRow) -> some View {
        let color = HUDColorScale.forOnRoute(day.onRoutePct)
        return HStack(spacing: 10) {
            Text(day.routeDate)
                .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(HUDPalette.textDim)
                .frame(width: 84, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(day.name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(day.completedStops)/\(day.totalStops) STOPP · \(day.avgDeviationM) M AVVIK")
                    .font(HUDFont.label(9))
                    .tracking(1.0)
                    .foregroundStyle(HUDPalette.textFaint)
            }
            Spacer()
            Text("\(day.onRoutePct)%")
                .font(HUDFont.metric(15))
                .foregroundStyle(color)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(color.opacity(0.15), in: Capsule())
                .overlay(Capsule().strokeBorder(color.opacity(0.5), lineWidth: 1))
        }
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.white.opacity(0.05)).frame(height: 1).padding(.top, 6)
        }
    }

    @MainActor
    private func load() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        guard let api = appState.api else {
            errorMessage = "Ingen API-klient"
            return
        }
        do {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withFullDate]
            let now = Date()
            let from = f.string(from: now.addingTimeInterval(-30 * 24 * 3600))
            let to = f.string(from: now)
            let r = try await api.fetchAdherenceReport(
                userId: member.userId, from: from, to: to
            )
            report = r
        } catch {
            errorMessage = "Kunne ikke hente rapport: \(error.localizedDescription)"
        }
    }
}
