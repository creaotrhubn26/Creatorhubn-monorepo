// LeadgridAnalyticsDashboardView.swift
//
// iPad Analytics Dashboard som visualiserer 7 KPI-endepunkter fra
// Leadgrid Analytics-backenden (PR #858) som SwiftUI Charts.
//
// 6 seksjoner (Picker-toggle):
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
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selectedSection: Section = .overview
    @State private var projects: [ProjectListItem] = []
    @State private var selectedProjectId: String?
    @State private var projectsLoading = true
    @State private var resolvedOrganizationId: String?
    @State private var scopeNotice: String?

    enum Section: String, CaseIterable, Identifiable {
        case overview = "Oversikt"
        case channels = "Kanaler"
        case sources = "Kilder"
        case segments = "Segmenter"
        case pipeline = "Pipeline"
        case territories = "Territorier"
        case outcomes = "Resultater"
        var id: Self { self }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Datagrunnlag")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(selectedProjectName)
                        .font(.subheadline.bold())
                        .lineLimit(1)
                }
                Spacer()
                if projectsLoading {
                    ProgressView().controlSize(.small)
                }
                Picker("Kundeprosjekt", selection: projectSelectionBinding) {
                    ForEach(projects) { project in
                        Text(project.name).tag(Optional(project.id))
                    }
                }
                .pickerStyle(.menu)
                .disabled(projectsLoading)
                .accessibilityIdentifier("analytics.project-filter")
            }
            .padding(.horizontal)
            .padding(.top, 12)

            Group {
                if horizontalSizeClass == .compact {
                    Picker("Analyse", selection: $selectedSection) {
                        ForEach(Section.allCases) { section in
                            Text(section.rawValue).tag(section)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Picker("", selection: $selectedSection) {
                        ForEach(Section.allCases) { section in
                            Text(section.rawValue).tag(section)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .padding()

            if projectsLoading {
                ProgressView("Avklarer kundeprosjekt …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if selectedProjectId == nil {
                ContentUnavailableView(
                    "Velg et kundeprosjekt",
                    systemImage: "folder.badge.questionmark",
                    description: Text("Analyse er alltid avgrenset til ett kundeprosjekt.")
                )
            } else {
                switch selectedSection {
                case .overview:    OverviewSection(api: api, projectId: selectedProjectId)
                case .channels:    ChannelsSection(api: api, projectId: selectedProjectId)
                case .sources:     SourcesSection(api: api, projectId: selectedProjectId)
                case .segments:    SegmentsSection(api: api, projectId: selectedProjectId)
                case .pipeline:    PipelineSection(api: api, projectId: selectedProjectId)
                case .territories: TerritoriesSection(api: api, projectId: selectedProjectId)
                case .outcomes:    OutcomesSection(api: api, projectId: selectedProjectId)
                }
            }
        }
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: appState.activeOrganizationId) { await loadProjects() }
        .alert("Prosjektavgrensning oppdatert", isPresented: Binding(
            get: { scopeNotice != nil },
            set: { if !$0 { scopeNotice = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(scopeNotice ?? "")
        }
    }

    private var projectSelectionBinding: Binding<String?> {
        Binding(
            get: { selectedProjectId },
            set: {
                selectedProjectId = $0
                scopeNotice = nil
            })
    }

    private var selectedProjectName: String {
        guard let selectedProjectId else { return "Ingen prosjekt valgt" }
        return projects.first(where: { $0.id == selectedProjectId })?.name
            ?? "Valgt kundeprosjekt"
    }

    @MainActor
    private func loadProjects() async {
        guard let organizationId = appState.activeOrganizationId else {
            projects = []
            selectedProjectId = nil
            resolvedOrganizationId = nil
            projectsLoading = false
            return
        }
        let organizationChanged = resolvedOrganizationId != organizationId
        if organizationChanged {
            selectedProjectId = nil
            resolvedOrganizationId = organizationId
        }
        projectsLoading = true
        defer { projectsLoading = false }
        let fresh: [ProjectListItem]
        do {
            fresh = try await api.fetchProjects(organizationId: organizationId)
            guard appState.activeOrganizationId == organizationId else { return }
        } catch {
            fresh = appState.projects.filter {
                $0.organizationId == nil || $0.organizationId == organizationId
            }
        }
        guard appState.activeOrganizationId == organizationId else { return }
        projects = fresh
        let safeDefault = appState.activeProjectId.flatMap { activeProjectId in
            fresh.contains(where: { $0.id == activeProjectId }) ? activeProjectId : nil
        } ?? fresh.first?.id
        if organizationChanged || selectedProjectId == nil {
            selectedProjectId = safeDefault
        } else if let selectedProjectId,
                  !fresh.contains(where: { $0.id == selectedProjectId }) {
            self.selectedProjectId = safeDefault
            scopeNotice = safeDefault == nil
                ? "Det valgte prosjektet er ikke lenger tilgjengelig. Ingen prosjektdata vises."
                : "Det valgte prosjektet er ikke lenger tilgjengelig. Et tilgjengelig kundeprosjekt er valgt; «Alle prosjekter» ble ikke aktivert automatisk."
        }
    }
}

// MARK: - Overview

private struct OverviewSection: View {
    let api: APIClient
    let projectId: String?
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
        .task(id: projectId) { await load() }
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
            overview = try await api.fetchAnalyticsOverview(projectId: projectId)
        } catch {
            // Silent — backend gating (403) eller nettverk; vis tom-state.
        }
        loading = false
    }
}

// MARK: - Channels

private struct ChannelsSection: View {
    let api: APIClient
    let projectId: String?
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
        .task(id: projectId) { await load() }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            channels = try await api.fetchAnalyticsChannels(projectId: projectId)
        } catch {
            channels = []
        }
        loading = false
    }
}

// MARK: - Sources

private struct SourcesSection: View {
    let api: APIClient
    let projectId: String?
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
        .task(id: projectId) { await load() }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            sources = try await api.fetchAnalyticsSources(projectId: projectId)
        } catch {
            sources = []
        }
        loading = false
    }
}

// MARK: - Segments

private struct SegmentsSection: View {
    let api: APIClient
    let projectId: String?
    @State private var dimension = "category"
    @State private var segments: [LeadgridSegmentPerf] = []
    @State private var loading = true

    private let dimensions = [
        ("category", "Bransje"),
        ("city", "By"),
        ("lead_status", "Pipelinefase"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Picker("Segmentering", selection: $dimension) {
                    ForEach(dimensions, id: \.0) { value, title in
                        Text(title).tag(value)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                if loading {
                    ProgressView().frame(maxWidth: .infinity).padding()
                } else if segments.isEmpty {
                    ContentUnavailableView("Ingen segmentdata", systemImage: "square.grid.2x2")
                        .padding()
                } else {
                    ForEach(segments) { segment in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack {
                                Text(segment.segment).font(.subheadline.bold())
                                Spacer()
                                Text("\(Int(segment.conversionRate * 100)) %")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.green)
                            }
                            ProgressView(value: min(1, max(0, segment.conversionRate)))
                                .tint(.green)
                            Text("\(segment.totalLeads) leads · \(segment.hotLeads) hot · \(segment.conversions) vunnet")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .task(id: "\(projectId ?? "all")|\(dimension)") { await load() }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        loading = true
        segments = (try? await api.fetchAnalyticsSegments(
            by: dimension,
            projectId: projectId)) ?? []
        loading = false
    }
}

// MARK: - Pipeline (funnel + velocity)

private struct PipelineSection: View {
    let api: APIClient
    let projectId: String?
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
        .task(id: projectId) { await load() }
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
        async let f = api.fetchAnalyticsFunnel(projectId: projectId)
        async let v = api.fetchAnalyticsVelocity(projectId: projectId)
        funnel = (try? await f) ?? []
        velocity = (try? await v) ?? []
        loading = false
    }
}

// MARK: - Territories

private struct TerritoriesSection: View {
    let api: APIClient
    let projectId: String?
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
        .task(id: projectId) { await load() }
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
            territories = try await api.fetchAnalyticsTerritories(projectId: projectId)
        } catch {
            territories = []
        }
        loading = false
    }
}

// MARK: - Closed-loop results

private struct OutcomesSection: View {
    let api: APIClient
    let projectId: String?
    @State private var outcomes: [LeadgridOutcomePerformance] = []
    @State private var profileCohorts: [LeadgridOutcomeProfileCohort] = []
    @State private var loading = true
    @State private var errorText: String?

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
    ]

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding()
            } else if let errorText {
                VStack(spacing: 12) {
                    ContentUnavailableView(
                        "Kunne ikke hente resultater",
                        systemImage: "arrow.triangle.2.circlepath",
                        description: Text(errorText))
                    Button("Prøv igjen") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
                .padding()
            } else if outcomes.allSatisfy({ !$0.hasActivity }) && profileCohorts.isEmpty {
                ContentUnavailableView(
                    "Ingen registrerte resultater ennå",
                    systemImage: "checkmark.seal",
                    description: Text("Når kundesystemet sender pilot-, møte-, publiserings-, forespørsels-, booking- og oppmøtehendelser, vises den lukkede resultatflyten her."))
                    .padding()
            } else {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if !profileCohorts.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Konvertering per Discovery-profil")
                                .font(.headline)
                            Text("Nevneren er unike leads som først ble importert av profilen i valgt periode. Senere profiltreff flytter ikke kreditten.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)

                        ForEach(profileCohorts) { cohort in
                            cohortCard(cohort)
                        }

                        Divider()
                            .padding(.horizontal)
                            .padding(.vertical, 4)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Fra pilot til faktisk oppmøte")
                            .font(.headline)
                        Text("Alle bekreftede hendelser i kundeprosjektet. Leads telles unikt innen hvert trinn; de summeres ikke på tvers av trinn.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)

                    ForEach(Array(outcomes.enumerated()), id: \.element.id) { index, outcome in
                        outcomeCard(outcome, position: index + 1)
                    }
                }
                .padding(.vertical)
            }
        }
        .task(id: projectId) { await load() }
        .refreshable { await load() }
    }

    private func cohortCard(_ cohort: LeadgridOutcomeProfileCohort) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(cohort.profileName)
                        .font(.headline)
                    Text(cohortWindowDescription(cohort))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(cohort.cohortLeads) i kohorten")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(.purple)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Color.purple.opacity(0.12), in: Capsule())
            }

            VStack(spacing: 9) {
                ForEach(cohort.stages) { stage in
                    HStack(spacing: 9) {
                        Circle()
                            .fill(color(for: stage.eventType))
                            .frame(width: 7, height: 7)
                        Text(stage.eventType.title)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Text("\(stage.uniqueLeads)/\(cohort.cohortLeads)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Text("\(Int((stage.conversionRate * 100).rounded())) %")
                            .font(.caption.bold().monospacedDigit())
                            .frame(minWidth: 42, alignment: .trailing)
                    }
                    ProgressView(value: min(1, max(0, stage.conversionRate)))
                        .tint(color(for: stage.eventType))
                        .accessibilityLabel(stage.eventType.title)
                        .accessibilityValue("\(stage.uniqueLeads) av \(cohort.cohortLeads) leads")
                }
            }
        }
        .padding()
        .background(Color.purple.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.purple.opacity(0.16)))
        .padding(.horizontal)
    }

    private func cohortWindowDescription(_ cohort: LeadgridOutcomeProfileCohort) -> String {
        guard let start = LeadgridDate.parse(cohort.windowStartedAt),
              let end = LeadgridDate.parse(cohort.windowEndedAt) else {
            return "Nevner: førstegangsimporterte leads i valgt periode"
        }
        return "Nevner: førstegangsimporterte leads \(start.formatted(date: .abbreviated, time: .omitted))–\(end.formatted(date: .abbreviated, time: .omitted))"
    }

    private func outcomeCard(
        _ outcome: LeadgridOutcomePerformance,
        position: Int
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text("\(position)")
                    .font(.caption.bold().monospacedDigit())
                    .frame(width: 28, height: 28)
                    .background(color(for: outcome.eventType).opacity(0.18), in: Circle())
                    .foregroundStyle(color(for: outcome.eventType))
                Text(outcome.eventType.title)
                    .font(.headline)
                Spacer()
                if outcome.hasActivity {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .accessibilityLabel("Har registrerte resultater")
                }
            }

            LazyVGrid(columns: columns, spacing: 8) {
                metric("Hendelser", value: outcome.events.formatted())
                metric("Unike leads", value: outcome.uniqueLeads.formatted())
                metric("Mengde", value: outcome.quantity.formatted())
                metric(
                    "Verdi",
                    value: outcome.valuesByCurrency.isEmpty
                        ? "–"
                        : outcome.valuesByCurrency
                            .map(formatCurrencyValue)
                            .joined(separator: " · "))
            }

            if let lastOccurredAt = outcome.lastOccurredAt,
               let date = LeadgridDate.parse(lastOccurredAt) {
                Text("Sist registrert \(date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(
            color(for: outcome.eventType).opacity(outcome.hasActivity ? 0.09 : 0.035),
            in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color(for: outcome.eventType).opacity(outcome.hasActivity ? 0.24 : 0.08)))
        .padding(.horizontal)
    }

    private func metric(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.subheadline.bold().monospacedDigit())
                .lineLimit(2)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(9)
        .background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
    }

    private func color(for type: LeadgridOutcomeEventType) -> Color {
        switch type {
        case .pilotInvited: return .blue
        case .meetingCompleted: return .indigo
        case .profilePublished: return .purple
        case .inquiryReceived: return .orange
        case .bookingConfirmed: return .mint
        case .attendanceConfirmed: return .green
        }
    }

    private func formatCurrencyValue(_ value: LeadgridOutcomeCurrencyValue) -> String {
        let currency = value.currency.uppercased()
        let exponent = currencyMinorExponent(currency)
        let divisor = pow(10.0, Double(exponent))
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.locale = Locale(identifier: "nb_NO")
        formatter.minimumFractionDigits = exponent
        formatter.maximumFractionDigits = exponent
        return formatter.string(from: NSNumber(value: Double(value.valueMinor) / divisor))
            ?? "\(value.valueMinor) \(currency)"
    }

    private func currencyMinorExponent(_ currency: String) -> Int {
        let zeroDecimal = Set([
            "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
            "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF",
        ])
        let threeDecimal = Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"])
        if zeroDecimal.contains(currency) { return 0 }
        if threeDecimal.contains(currency) { return 3 }
        return 2
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            let report = try await api.fetchAnalyticsOutcomeReport(projectId: projectId)
            outcomes = report.outcomes
            profileCohorts = report.profileCohorts
        } catch is CancellationError {
            return
        } catch {
            outcomes = []
            profileCohorts = []
            errorText = error.localizedDescription
        }
        loading = false
    }
}
