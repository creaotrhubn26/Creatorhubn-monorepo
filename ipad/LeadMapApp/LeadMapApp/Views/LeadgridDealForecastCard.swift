// LeadgridDealForecastCard.swift
//
// Min dag-kort som viser weighted pipeline-forecast + top deals at risk
// (mig 0349, #154/#155).
//
// Backend:
//   GET /api/leadgrid/deals/forecast
//   GET /api/leadgrid/deals/at-risk

import SwiftUI

struct LeadgridDealForecastCard: View {
    let api: APIClient

    @State private var forecast: LeadgridDealForecast?
    @State private var atRisk: [LeadgridDealAtRisk] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(Color(hex: "a855f7"))
                Text("Weighted forecast")
                    .font(.headline)
                Spacer()
                if loading { ProgressView().scaleEffect(0.8) }
            }

            if let errorText {
                Text(errorText).font(.caption).foregroundStyle(.red)
            } else if let f = forecast {
                weightedSummary(f.summary)
                if !f.byMonth.isEmpty {
                    Divider().padding(.vertical, 4)
                    monthsBreakdown(f.byMonth)
                }
            }

            if !atRisk.isEmpty {
                Divider().padding(.vertical, 4)
                atRiskSection
            }
        }
        .padding(16)
        .background(
            Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .task { await load() }
    }

    private func weightedSummary(_ s: LeadgridDealForecastSummary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Weighted pipeline")
                .font(.caption).foregroundStyle(.secondary)
            Text(fmtNok(s.totalWeightedValue))
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(Color(hex: "a855f7"))
            Text(
                "av \(fmtNok(s.totalPipelineValue)) · \(s.dealsCount) deals · snitt \(Int(s.averageProbability))%"
            )
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
    }

    private func monthsBreakdown(_ months: [LeadgridDealPeriodBucket]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Neste 3 måneder").font(.caption.bold()).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                ForEach(months.prefix(3)) { b in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(b.period).font(.caption2).foregroundStyle(.secondary)
                        Text(fmtNok(b.weightedValue))
                            .font(.subheadline.bold())
                        Text("\(b.dealsCount) deals")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var atRiskSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text("Top deals at risk")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }
            ForEach(atRisk.prefix(5)) { d in
                HStack(spacing: 8) {
                    Text(d.name ?? String(d.leadId.prefix(8)))
                        .font(.caption)
                        .lineLimit(1)
                    Spacer()
                    Text("-\(d.daysOverdue)d")
                        .font(.caption2.bold())
                        .foregroundStyle(.orange)
                    Text(fmtNok(d.weightedValue))
                        .font(.caption2.bold())
                }
                .padding(.vertical, 1)
            }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let f = api.fetchDealForecast()
            async let r = api.fetchDealsAtRisk(limit: 5)
            forecast = try await f
            atRisk = (try? await r) ?? []
        } catch {
            errorText = "Kunne ikke laste forecast: \(error.localizedDescription)"
        }
    }
}

private func fmtNok(_ v: Double) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "nb_NO")
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return "\(f.string(from: NSNumber(value: v)) ?? "0") kr"
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255,
        )
    }
}
