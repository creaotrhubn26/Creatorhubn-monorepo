// LeadgridAnalyticsDashboardView.swift
//
// iPad Analytics Dashboard som visualiserer 7 KPI-endepunkter fra
// Leadgrid Analytics-backenden (PR #858) som SwiftUI Charts.
//
// 5 seksjoner (Picker-toggle):
//   - Oversikt:    8 stat-cards + revenue/velocity + follow-ups
//   - Kanaler:     response-rate bar-chart per kanal
//   - Kilder:      konvertering-bar + source-quality-liste
//   - Pipeline:    8-stage funnel (farget) + velocity line/area-chart
//   - Territorier: by-progress + tag-pills
//
// Gated implisitt på backend (analytics.view_* permissions). Wire via
// LeadgridHubView → "Analyse"-seksjon.

import SwiftUI
import Charts

struct LeadgridAnalyticsDashboardView: View {
    let api: APIClient
    @State private var selectedSection: Section = .overview

    enum Section: String, CaseIterable, Identifiable {
        case overview = "Oversikt"
        case channels = "Kanaler"
        case sources = "Kilder"
        case pipeline = "Pipeline"
        case territories = "Territorier"
        var id: Self { self }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedSection) {
                ForEach(Section.allCases) { s in
                    Text(s.rawValue).tag(s)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            switch selectedSection {
            case .overview:    OverviewSection(api: api)
            case .channels:    ChannelsSection(api: api)
            case .sources:     SourcesSection(api: api)
            case .pipeline:    PipelineSection(api: api)
            case .territories: TerritoriesSection(api: api)
            }
        }
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Overview

private struct OverviewSection: View {
    let api: APIClient
    @State private var overview: LeadgridAnalyticsOverview?
    @State private var loading = true

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else if let o = overview {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    statCard("Totale leads", value: "\(o.totalLeads)",
                             icon: "person.3.fill", color: .blue)
                    statCard("Aktive", value: "\(o.activeLeads)",
                             icon: "flame.fill", color: .orange)
                    statCard("Hot leads", value: "\(o.hotLeads)",
                             icon: "flame.circle.fill", color: .red)
                    statCard("Ready", value: "\(o.readyLeads)",
                             icon: "checkmark.seal.fill", color: .green)
                    statCard("Vunnet", value: "\(o.wonDeals)",
                             icon: "trophy.fill", color: .yellow)
                    statCard("Tapt", value: "\(o.lostDeals)",
                             icon: "xmark.circle.fill", color: .gray)
                    statCard("Konvertering", value: "\(Int(o.conversionRate * 100))%",
                             icon: "arrow.up.right", color: .purple)
                    statCard("Snitt deal", value: formatNok(o.averageDealValue),
                             icon: "banknote.fill", color: .green)
                }
                .padding()

                // Revenue + pipeline velocity
                VStack(alignment: .leading, spacing: 8) {
                    sectionTitle("Inntekter")
                    HStack(spacing: 12) {
                        bigStat(label: "Forventet",
                                value: formatNok(o.expectedRevenue),
                                color: .blue)
                        bigStat(label: "Lukket",
                                value: formatNok(o.closedRevenue),
                                color: .green)
                    }
                    Text("Pipeline velocity: \(formatNok(o.pipelineVelocity)) / dag · Snitt cycle: \(Int(o.averageCycleDays))d")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(.horizontal)

                // Follow-ups
                VStack(alignment: .leading, spacing: 8) {
                    sectionTitle("Oppfølging")
                    HStack(spacing: 12) {
                        statCard("I dag", value: "\(o.followUpsDueToday)",
                                 icon: "calendar", color: .blue)
                        statCard("Overdue", value: "\(o.followUpsOverdue)",
                                 icon: "exclamationmark.triangle.fill", color: .red)
                    }
                }
                .padding()
            } else {
                ContentUnavailableView("Ingen oversikt-data",
                                       systemImage: "chart.bar.doc.horizontal")
                    .padding()
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func statCard(_ label: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: icon).font(.title3).foregroundStyle(color)
                Spacer()
            }
            Text(value).font(.title2.bold().monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func bigStat(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.title.bold().monospacedDigit())
                .foregroundStyle(color)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func sectionTitle(_ s: String) -> some View {
        Text(s).font(.headline)
    }

    private func formatNok(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        f.maximumFractionDigits = 0
        return (f.string(from: NSNumber(value: v)) ?? "0") + " kr"
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            overview = try await api.fetchAnalyticsOverview()
        } catch {
            // Silent — backend gating (403) eller nettverk; vis tom-state.
        }
        loading = false
    }
}

// MARK: - Channels

private struct ChannelsSection: View {
    let api: APIClient
    @State private var channels: [LeadgridChannelPerf] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else if channels.isEmpty {
                ContentUnavailableView("Ingen kanal-data",
                                       systemImage: "chart.bar")
                    .padding()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Response-rate per kanal")
                        .font(.headline)
                        .padding(.horizontal)
                    Chart(channels) { c in
                        BarMark(
                            x: .value("Rate", c.responseRate * 100),
                            y: .value("Kanal", c.channel)
                        )
                        .foregroundStyle(.purple.gradient)
                        .annotation(position: .trailing) {
                            Text("\(Int(c.responseRate * 100))%").font(.caption2)
                        }
                    }
                    .frame(height: max(120, CGFloat(channels.count) * 36))
                    .padding(.horizontal)

                    Text("Forsøk vs Svar")
                        .font(.headline)
                        .padding(.horizontal)
                        .padding(.top)
                    ForEach(channels) { c in
                        HStack {
                            Text(c.channel).font(.subheadline)
                            Spacer()
                            Text("\(c.attempts) forsøk · \(c.responses) svar")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            channels = try await api.fetchAnalyticsChannels()
        } catch {
            channels = []
        }
        loading = false
    }
}

// MARK: - Sources

private struct SourcesSection: View {
    let api: APIClient
    @State private var sources: [LeadgridSourcePerf] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else if sources.isEmpty {
                ContentUnavailableView("Ingen kilde-data",
                                       systemImage: "chart.pie")
                    .padding()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Konverteringsrate per kilde")
                        .font(.headline)
                        .padding(.horizontal)
                    Chart(sources) { s in
                        BarMark(
                            x: .value("Source", s.source),
                            y: .value("Konvertering", s.conversionRate * 100)
                        )
                        .foregroundStyle(s.conversionRate > 0.1 ? Color.green : Color.orange)
                    }
                    .frame(height: 220)
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisValueLabel(orientation: .verticalReversed)
                        }
                    }
                    .padding(.horizontal)

                    Text("Source quality score")
                        .font(.headline)
                        .padding(.horizontal)
                        .padding(.top)
                    ForEach(sources) { s in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(s.source).font(.subheadline.bold())
                                Spacer()
                                Text("\(Int(s.sourceQualityScore))")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.purple)
                            }
                            Text("\(s.totalLeads) leads · \(s.conversions) konvertert · snitt \(Int(s.avgDealValue)) kr")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            sources = try await api.fetchAnalyticsSources()
        } catch {
            sources = []
        }
        loading = false
    }
}

// MARK: - Pipeline (funnel + velocity)

private struct PipelineSection: View {
    let api: APIClient
    @State private var funnel: [LeadgridFunnelStage] = []
    @State private var velocity: [LeadgridVelocityPoint] = []
    @State private var loading = true

    private let stageColors: [String: Color] = [
        "new": .gray,
        "first_contact": .blue,
        "qualified": .indigo,
        "meeting": .purple,
        "proposal": .orange,
        "negotiation": .yellow,
        "won": .green,
        "lost": .red
    ]

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Conversion funnel")
                        .font(.headline)
                        .padding(.horizontal)
                    if funnel.isEmpty {
                        ContentUnavailableView("Ingen funnel-data",
                                               systemImage: "line.3.horizontal.decrease")
                            .padding(.horizontal)
                    } else {
                        Chart(funnel) { stage in
                            BarMark(
                                x: .value("Antall", stage.count),
                                y: .value("Stage", stageLabel(stage.stage))
                            )
                            .foregroundStyle(stageColors[stage.stage] ?? .gray)
                            .annotation(position: .trailing) {
                                Text("\(stage.count)").font(.caption2)
                            }
                        }
                        .frame(height: max(120, CGFloat(funnel.count) * 32))
                        .padding(.horizontal)
                    }

                    Text("Pipeline velocity (NOK/dag)")
                        .font(.headline)
                        .padding(.horizontal)
                        .padding(.top)
                    if velocity.isEmpty {
                        ContentUnavailableView("Ingen velocity-historikk",
                                               systemImage: "waveform.path.ecg")
                            .padding(.horizontal)
                    } else {
                        Chart(velocity) { p in
                            LineMark(
                                x: .value("Dato", parseDate(p.date) ?? Date()),
                                y: .value("Velocity", p.velocity)
                            )
                            .foregroundStyle(.purple.gradient)
                            .interpolationMethod(.monotone)

                            AreaMark(
                                x: .value("Dato", parseDate(p.date) ?? Date()),
                                y: .value("Velocity", p.velocity)
                            )
                            .foregroundStyle(.purple.opacity(0.15))
                            .interpolationMethod(.monotone)
                        }
                        .frame(height: 200)
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func stageLabel(_ s: String) -> String {
        switch s {
        case "new": return "Ny"
        case "first_contact": return "1. kontakt"
        case "qualified": return "Kvalifisert"
        case "meeting": return "Møte"
        case "proposal": return "Tilbud"
        case "negotiation": return "Forhandling"
        case "won": return "Vunnet"
        case "lost": return "Tapt"
        default: return s
        }
    }

    private func parseDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }

    @MainActor
    private func load() async {
        loading = true
        async let f = api.fetchAnalyticsFunnel()
        async let v = api.fetchAnalyticsVelocity()
        funnel = (try? await f) ?? []
        velocity = (try? await v) ?? []
        loading = false
    }
}

// MARK: - Territories

private struct TerritoriesSection: View {
    let api: APIClient
    @State private var territories: [LeadgridTerritoryPerf] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else if territories.isEmpty {
                ContentUnavailableView("Ingen territorie-data",
                                       systemImage: "map")
                    .padding()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Konvertering per by/region")
                        .font(.headline)
                        .padding(.horizontal)
                    ForEach(territories) { t in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(t.city).font(.subheadline.bold())
                                Spacer()
                                Text("\(Int(t.conversionRate * 100))%")
                                    .foregroundStyle(.green)
                                    .font(.subheadline.bold())
                            }
                            ProgressView(value: min(1.0, max(0.0, t.conversionRate)))
                                .tint(.green)
                            HStack(spacing: 8) {
                                tagPill("\(t.totalLeads) leads", color: .blue)
                                tagPill("\(t.conversions) won", color: .green)
                                tagPill("\(Int(t.hotLeadDensity * 100))% hot", color: .red)
                                tagPill("\(t.meetingsBooked) møter", color: .purple)
                            }
                            Text("Forventet: \(Int(t.expectedValue / 1000))k kr · Snitt score: \(Int(t.avgScore))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(
                            Color.secondary.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func tagPill(_ s: String, color: Color) -> some View {
        Text(s)
            .font(.caption2)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            territories = try await api.fetchAnalyticsTerritories()
        } catch {
            territories = []
        }
        loading = false
    }
}
