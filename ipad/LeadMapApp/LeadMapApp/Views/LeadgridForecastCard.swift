// LeadgridForecastCard.swift
//
// Predikert revenue for neste 90d m/ p10/p50/p90-bånd + Claude-reasoning.
// Vises på Min dag-skjermen. Pakke 3B (mig 323 + PR #885).

import SwiftUI

struct LeadgridForecastCard: View {
    let api: APIClient
    @State private var forecast: LeadgridForecast?
    @State private var loading = true
    @State private var errorText: String?
    @State private var refreshing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(.purple)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Predikert revenue").font(.headline)
                    if let f = forecast {
                        Text("Neste \(f.horizonDays) dager")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Button {
                    Task { await refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                        .rotationEffect(.degrees(refreshing ? 360 : 0))
                        .animation(
                            refreshing
                                ? .linear(duration: 1).repeatForever(autoreverses: false)
                                : .default,
                            value: refreshing
                        )
                }
                .disabled(refreshing)
                .accessibilityLabel("Oppdater forecast")
            }

            if loading && forecast == nil {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if let f = forecast {
                content(f)
            } else if let errorText {
                Text(errorText).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .task { await load() }
    }

    @ViewBuilder
    private func content(_ f: LeadgridForecast) -> some View {
        // p10/p50/p90 hovedtall
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(formatNok(f.predictedRevenueMid))
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(.primary)
                Text("NOK").font(.caption).foregroundStyle(.secondary)
            }
            Text("Spenn: \(formatNok(f.predictedRevenueLow)) – \(formatNok(f.predictedRevenueHigh))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }

        // Konfidens + nøkkeltall
        HStack(spacing: 12) {
            statBox(
                title: "Konfidens",
                value: "\(Int(f.confidence * 100))%",
                color: confidenceColor(f.confidence)
            )
            statBox(title: "Predikerte deals", value: "\(f.predictedWonDeals)", color: .blue)
            statBox(title: "Snitt syklus", value: "\(Int(f.predictedAvgCycleDays))d", color: .gray)
        }

        Divider()

        // Reasoning
        Text(f.reasoning)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)

        // Contributing factors bar-chart
        if !f.contributingFactors.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Drivere").font(.caption.bold()).foregroundStyle(.secondary)
                ForEach(f.contributingFactors, id: \.factor) { factor in
                    HStack(spacing: 8) {
                        Text(factor.factor)
                            .font(.caption)
                            .frame(width: 110, alignment: .leading)
                        ProgressView(value: min(max(factor.weight, 0), 1))
                            .tint(factor.direction == "positive" ? .green : .red)
                        Image(systemName: factor.direction == "positive" ? "arrow.up" : "arrow.down")
                            .font(.caption2)
                            .foregroundStyle(factor.direction == "positive" ? .green : .red)
                    }
                }
            }
        }

        // Pipeline-stats nederst
        HStack {
            Image(systemName: "tray.fill").font(.caption).foregroundStyle(.secondary)
            Text("Aktiv pipeline: \(formatNok(f.activePipelineValue)) NOK (\(f.activeDeals) deals)")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    @ViewBuilder
    private func statBox(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline.bold()).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
    }

    private func confidenceColor(_ c: Double) -> Color {
        if c >= 0.75 { return .green }
        if c >= 0.5 { return .orange }
        return .red
    }

    private func formatNok(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "nb_NO")
        f.groupingSeparator = " "
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: value)) ?? "0"
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            forecast = try await api.fetchPipelineForecast()
        } catch {
            errorText = "Kunne ikke laste forecast: \(error.localizedDescription)"
        }
        loading = false
    }

    @MainActor
    private func refresh() async {
        refreshing = true
        defer { refreshing = false }
        do {
            forecast = try await api.refreshPipelineForecast()
        } catch {
            errorText = "Refresh feilet: \(error.localizedDescription)"
        }
    }
}
