// LeadgridMomentumTrendChart.swift
//
// Mini-trendgraf (siste 30 dager) for Daniels Momentum Engine. Bruker
// SwiftUI Charts (iOS 16+): LineMark + AreaMark + mål-RuleMark (75%)
// + stats (snitt/best/verst) + trend-badge (siste minus første).
//
// Endepunkt: GET /api/leadgrid/momentum/trend?days=30
// Vises rett under `LeadgridMomentumCard` på Min dag.

import Charts
import SwiftUI

struct LeadgridMomentumTrendChart: View {
    let api: APIClient
    @State private var trend: LeadgridMomentumTrend?
    @State private var loading = true
    @State private var errorText: String?
    @State private var selectedPoint: TrendPoint?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(.purple)
                Text("Momentum siste 30 dager").font(.headline)
                Spacer()
                if let t = trend {
                    trendBadge(t.directionChange)
                }
            }

            if loading {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .frame(height: 100)
            } else if let t = trend {
                if t.points.count < 2 {
                    emptyState
                } else {
                    chart(t)
                    statsRow(t)
                }
            } else if let errorText {
                Text(errorText).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .task { await load() }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "chart.line.flattrend.xyaxis")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("For lite data — kom tilbake om noen dager")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 80)
    }

    @ViewBuilder
    private func chart(_ t: LeadgridMomentumTrend) -> some View {
        Chart {
            ForEach(t.points) { p in
                LineMark(
                    x: .value("Dato", parseDate(p.date) ?? Date()),
                    y: .value("Score", p.score),
                )
                .foregroundStyle(scoreColor(p.score).gradient)
                .interpolationMethod(.monotone)

                AreaMark(
                    x: .value("Dato", parseDate(p.date) ?? Date()),
                    y: .value("Score", p.score),
                )
                .foregroundStyle(scoreColor(p.score).opacity(0.15).gradient)
                .interpolationMethod(.monotone)
            }
            RuleMark(y: .value("Mål", 75))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4]))
                .foregroundStyle(.green.opacity(0.4))
                .annotation(position: .topTrailing, alignment: .trailing) {
                    Text("Mål 75")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
        }
        .chartYScale(domain: 0...100)
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: 7)) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel(formatXAxis(date))
                }
                AxisGridLine()
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, 50, 100]) { _ in
                AxisValueLabel()
                AxisGridLine()
            }
        }
        .frame(height: 140)
    }

    @ViewBuilder
    private func statsRow(_ t: LeadgridMomentumTrend) -> some View {
        HStack(spacing: 14) {
            statBox(label: "Snitt", value: "\(Int(t.avg))%", color: .blue)
            statBox(label: "Best", value: "\(Int(t.best))%", color: .green)
            statBox(label: "Verst", value: "\(Int(t.worst))%", color: .red)
        }
    }

    @ViewBuilder
    private func statBox(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold().monospacedDigit())
                .foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
    }

    private func trendBadge(_ change: Double) -> some View {
        let (icon, color, label): (String, Color, String) = {
            if change > 5 { return ("arrow.up.right", .green, "+\(Int(change))%") }
            if change < -5 { return ("arrow.down.right", .red, "\(Int(change))%") }
            return ("arrow.right", .blue, "Stabilt")
        }()
        return HStack(spacing: 3) {
            Image(systemName: icon).font(.caption2)
            Text(label).font(.caption.bold())
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(color.opacity(0.15), in: Capsule())
        .foregroundStyle(color)
    }

    private func scoreColor(_ s: Double) -> Color {
        if s >= 75 { return .green }
        if s >= 50 { return .orange }
        return .red
    }

    private func parseDate(_ str: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: str)
    }

    private func formatXAxis(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "dd/MM"
        f.locale = Locale(identifier: "nb_NO")
        return f.string(from: d)
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            trend = try await api.fetchMomentumTrend()
        } catch {
            errorText = "Kunne ikke laste trend: \(error.localizedDescription)"
        }
        loading = false
    }
}
