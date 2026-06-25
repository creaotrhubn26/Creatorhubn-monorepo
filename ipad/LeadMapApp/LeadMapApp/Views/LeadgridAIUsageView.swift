// LeadgridAIUsageView.swift
//
// iPad AI-kost-dashboard for org-en. Viser kost-utvikling (bar-stack
// per provider), per-provider-detaljer og kost-fordeling (donut).
// Backend: /api/leadgrid/ai-usage/{summary,history} (PR #871),
// gated på billing.view_ai_usage.

import SwiftUI
import Charts

struct LeadgridAIUsageView: View {
    let api: APIClient

    @State private var summary: LeadgridAIUsageSummary?
    @State private var history: LeadgridAIUsageHistory?
    @State private var period: Int = 30
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Periode", selection: $period) {
                    Text("7 dager").tag(7)
                    Text("30 dager").tag(30)
                    Text("90 dager").tag(90)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .onChange(of: period) {
                    Task { await load() }
                }

                if loading && summary == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else if let error = loadError, summary == nil {
                    errorCard(error)
                } else if let s = summary {
                    totalCard(s)
                    if let h = history, !h.history.isEmpty {
                        usageChartCard(h)
                    }
                    providersCard(s)
                    if !s.providers.isEmpty {
                        costPieCard(s)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("AI-kost")
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: - Cards

    @ViewBuilder
    private func errorCard(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text("Kunne ikke laste").font(.headline)
            }
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    @ViewBuilder
    private func totalCard(_ s: LeadgridAIUsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.green)
                Text("Total kost").font(.headline)
                Spacer()
                Text("\(s.sinceDays) dager")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .firstTextBaseline) {
                Text(String(format: "$%.2f", s.totalCostUsd))
                    .font(.system(size: 42, weight: .bold).monospacedDigit())
                    .foregroundStyle(costColor(s.totalCostUsd))
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(s.totalCalls)")
                        .font(.headline.monospacedDigit())
                    Text("kall")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    @ViewBuilder
    private func usageChartCard(_ h: LeadgridAIUsageHistory) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kost-utvikling").font(.headline)
            Chart(h.history) { p in
                BarMark(
                    x: .value("Dato", parseDate(p.date) ?? Date()),
                    y: .value("Kost", p.costUsd)
                )
                .foregroundStyle(by: .value("Provider", p.provider))
            }
            .frame(height: 200)
            .chartForegroundStyleScale([
                "claude": .purple,
                "openai_whisper": .blue,
                "openai_chat": .green,
            ])
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 7)) { value in
                    AxisGridLine()
                    AxisTick()
                    if let date = value.as(Date.self) {
                        AxisValueLabel(formatAxisDate(date))
                    }
                }
            }
        }
        .padding()
        .background(Color.purple.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    @ViewBuilder
    private func providersCard(_ s: LeadgridAIUsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Per provider").font(.headline)
            ForEach(s.providers) { p in
                HStack {
                    Circle()
                        .fill(providerColor(p.provider))
                        .frame(width: 10, height: 10)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(providerLabel(p.provider))
                            .font(.subheadline.bold())
                        providerStats(p)
                    }
                    Spacer()
                    Text(String(format: "$%.3f", p.totalCostUsd))
                        .font(.subheadline.bold().monospacedDigit())
                        .foregroundStyle(.green)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color.blue.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    @ViewBuilder
    private func providerStats(_ p: LeadgridAIUsageProvider) -> some View {
        HStack(spacing: 8) {
            Text("\(p.totalCalls) kall")
                .font(.caption2)
                .foregroundStyle(.secondary)
            if let inp = p.totalInputTokens, inp > 0 {
                Text("\(inp / 1000)k input")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let out = p.totalOutputTokens, out > 0 {
                Text("\(out / 1000)k output")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let audio = p.totalAudioSeconds, audio > 0 {
                Text("\(Int(audio))s audio")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func costPieCard(_ s: LeadgridAIUsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kost-fordeling").font(.headline)
            Chart(s.providers) { p in
                SectorMark(
                    angle: .value("Kost", p.totalCostUsd),
                    innerRadius: .ratio(0.5),
                    angularInset: 2
                )
                .foregroundStyle(by: .value("Provider", p.provider))
                .cornerRadius(4)
            }
            .frame(height: 180)
            .chartForegroundStyleScale([
                "claude": .purple,
                "openai_whisper": .blue,
                "openai_chat": .green,
            ])
        }
        .padding()
        .background(Color.orange.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    // MARK: - Helpers

    private func costColor(_ c: Double) -> Color {
        if c > 100 { return .red }
        if c > 25 { return .orange }
        return .green
    }

    private func providerColor(_ p: String) -> Color {
        switch p {
        case "claude": return .purple
        case "openai_whisper": return .blue
        case "openai_chat": return .green
        default: return .gray
        }
    }

    private func providerLabel(_ p: String) -> String {
        switch p {
        case "claude": return "Anthropic Claude"
        case "openai_whisper": return "OpenAI Whisper"
        case "openai_chat": return "OpenAI Chat"
        default: return p
        }
    }

    private static let dateParser: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()

    private func parseDate(_ s: String) -> Date? {
        Self.dateParser.date(from: s)
    }

    private static let axisDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d. MMM"
        f.locale = Locale(identifier: "nb_NO")
        return f
    }()

    private func formatAxisDate(_ d: Date) -> String {
        Self.axisDateFormatter.string(from: d)
    }

    @MainActor
    private func load() async {
        loading = true
        loadError = nil
        async let s = api.fetchAIUsageSummary(sinceDays: period)
        async let h = api.fetchAIUsageHistory(days: period)
        do {
            summary = try await s
        } catch {
            summary = nil
            loadError = describe(error)
        }
        history = try? await h
        loading = false
    }

    private func describe(_ error: Error) -> String {
        if let api = error as? APIError {
            switch api {
            case .statusCode(let code) where code == 403:
                return "Du har ikke tilgang til AI-kost (krever billing.view_ai_usage)."
            case .statusCode(let code):
                return "Serverfeil (\(code))."
            case .invalidResponse:
                return "Ugyldig svar fra server."
            case .invalidURL:
                return "Ugyldig URL."
            case .serverError(let code, _):
                return "Serverfeil (\(code))."
            }
        }
        return error.localizedDescription
    }
}
