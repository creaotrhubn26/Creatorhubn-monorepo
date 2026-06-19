// LeadgridWonLostDashboardView.swift
//
// KPI-dashboard for Leadgrid org. Paritet med web's WonLostDashboard:
//   - 4 KPI-cards: vunnet, tapt, sum kr, win-rate
//   - 6 mnd bar-chart
//   - Top selgere (top 5 m/ medalje-farge)
//   - Top lost-reasons m/ progress
//   - Konverterings-trakt
//   - Periode-switcher 7d/30d/90d

import SwiftUI

struct LeadgridWonLostDashboardView: View {
    let api: APIClient

    @State private var stats: WonLostStatsResponse?
    @State private var period: String = "30d"
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                periodPicker

                if loading && stats == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                } else if let stats {
                    kpiCards(stats)
                    Divider()
                    momChart(stats)
                    Divider()
                    HStack(alignment: .top, spacing: 16) {
                        topRepsCard(stats).frame(maxWidth: .infinity, alignment: .topLeading)
                        topLostCard(stats).frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    Divider()
                    if let funnel = stats.funnel {
                        funnelCard(funnel)
                    }
                }
                if let errorText {
                    Text(errorText).foregroundStyle(.red).font(.caption)
                }
            }
            .padding()
        }
        .navigationTitle("Vunnet / Tapt")
        .task(id: period) { await load() }
        .refreshable { await load() }
    }

    private var periodPicker: some View {
        Picker("Periode", selection: $period) {
            Text("7 dager").tag("7d")
            Text("30 dager").tag("30d")
            Text("90 dager").tag("90d")
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func kpiCards(_ s: WonLostStatsResponse) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            KpiCard(label: "Vunnet", value: s.wonCount,
                     subText: (s.inPipeline.flatMap { Int($0).map { "\($0) i pipeline" } } ),
                     color: Color(red: 0.61, green: 0.88, blue: 0.36),
                     iconSystem: "checkmark.circle.fill")
            KpiCard(label: "Tapt", value: s.lostCount,
                     subText: nil,
                     color: Color(red: 0.97, green: 0.44, blue: 0.44),
                     iconSystem: "xmark.circle.fill")
            KpiCard(label: "Sum vunnet",
                     value: kr(s.totalWonKr),
                     subText: s.totalRecurringKr > 0
                            ? "+\(kr(s.totalRecurringKr)) kr/mnd" : nil,
                     color: .purple,
                     iconSystem: "dollarsign.circle.fill")
            KpiCard(label: "Win-rate", value: "\(s.winRatePct)%",
                     subText: nil, color: .orange,
                     iconSystem: "percent")
        }
    }

    @ViewBuilder
    private func momChart(_ s: WonLostStatsResponse) -> some View {
        let maxWon = max(1, s.monthOverMonth.map { $0.wonInt }.max() ?? 1)
        VStack(alignment: .leading, spacing: 8) {
            Text("Siste 6 måneder").font(.headline)
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(s.monthOverMonth) { bucket in
                    VStack(spacing: 4) {
                        VStack(spacing: 1) {
                            if bucket.wonInt > 0 {
                                let h = max(2, CGFloat(bucket.wonInt) / CGFloat(maxWon) * 100)
                                Rectangle()
                                    .fill(Color.green)
                                    .frame(height: h)
                            }
                            if bucket.lostInt > 0 {
                                let h = max(1, CGFloat(bucket.lostInt) / CGFloat(maxWon) * 40)
                                Rectangle()
                                    .fill(Color.red.opacity(0.6))
                                    .frame(height: h)
                            }
                        }
                        Text(String(bucket.month.suffix(2)))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 140)
        }
    }

    @ViewBuilder
    private func topRepsCard(_ s: WonLostStatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: "trophy.fill").foregroundStyle(.yellow)
                Text("Top selgere").font(.headline) }
            if s.topReps.isEmpty {
                Text("Ingen vunnet enda").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(Array(s.topReps.enumerated()), id: \.element.id) { idx, rep in
                    let medalColor: Color = idx == 0 ? .yellow
                                          : idx == 1 ? .gray
                                          : idx == 2 ? Color.brown
                                          : .secondary
                    HStack(spacing: 8) {
                        Text("#\(idx + 1)").font(.caption.bold()).foregroundStyle(medalColor)
                            .frame(width: 28, alignment: .leading)
                        Text(rep.fullName).font(.caption)
                        Spacer()
                        Text("\(rep.wonCountInt) · \(kr(rep.wonAmountKr)) kr")
                            .font(.caption.bold())
                            .foregroundStyle(.green)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func topLostCard(_ s: WonLostStatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: "arrow.down.right").foregroundStyle(.red)
                Text("Hvorfor vi tapte").font(.headline) }
            if s.topLostReasons.isEmpty {
                Text("Ingen tapte enda").font(.caption).foregroundStyle(.secondary)
            } else {
                let lostTotal = max(1, s.lostCountInt)
                ForEach(s.topLostReasons) { r in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(LeadgridLostReason(rawValue: r.lostReason)?.label ?? r.lostReason)
                                .font(.caption)
                            Spacer()
                            Text(String(r.nInt)).font(.caption.bold()).foregroundStyle(.red)
                        }
                        ProgressView(value: Double(r.nInt) / Double(lostTotal))
                            .tint(.red)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func funnelCard(_ funnel: ConversionFunnel) -> some View {
        let stages = funnel.stages
        let maxN = max(1, stages.map { $0.count }.max() ?? 1)
        VStack(alignment: .leading, spacing: 6) {
            Text("Konverterings-trakt").font(.headline)
            ForEach(Array(stages.enumerated()), id: \.offset) { idx, stage in
                HStack(spacing: 8) {
                    Text(stage.label).font(.caption).frame(width: 110, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.secondary.opacity(0.10))
                            RoundedRectangle(cornerRadius: 4)
                                .fill(funnelColor(idx))
                                .frame(width: max(8, geo.size.width *
                                                  CGFloat(stage.count) / CGFloat(maxN)))
                            HStack {
                                Text("\(stage.count)").font(.caption.bold())
                                    .padding(.leading, 6)
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                        }
                    }
                    .frame(height: 22)
                }
            }
        }
    }

    private func funnelColor(_ idx: Int) -> Color {
        let colors: [Color] = [.purple, .blue, .purple, .yellow, .orange, .green]
        return colors[min(idx, colors.count - 1)]
    }

    private func kr(_ v: Double) -> String {
        if v >= 1000 { return String(format: "%.0fk", v / 1000) }
        return String(format: "%.0f", v)
    }

    private func load() async {
        loading = true
        do {
            let res = try await api.fetchWonLostStats(period: period)
            await MainActor.run {
                stats = res
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste stats: \(error.localizedDescription)"
                loading = false
            }
        }
    }
}

private struct KpiCard: View {
    let label: String
    let value: String
    let subText: String?
    let color: Color
    let iconSystem: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: iconSystem).foregroundStyle(color)
                Text(label).font(.caption).foregroundStyle(.secondary)
            }
            Text(value).font(.title.bold()).foregroundStyle(color)
            if let subText {
                Text(subText).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(color.opacity(0.20)))
    }
}
