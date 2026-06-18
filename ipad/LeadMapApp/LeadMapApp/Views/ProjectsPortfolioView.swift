// ProjectsPortfolioView.swift
//
// Tab i hoved-TabView: organisasjonens kundeprosjekt-portefølje.
// Grid-view m/ logo, navn, Leadgrid-score, needs-count, status-pin.
//
// Hentes fra GET /organizations/:id/portfolio. Tap på et kort →
// LeadDetailSheet via customer_id (gjenbruker eksisterende flyt).
//
// Header viser aggregat: total prosjekter, snitt-score, totalt antall
// behov på tvers. Som «cockpit-tall» for markedssjef.

import SwiftUI

struct ProjectsPortfolioView: View {
    @Environment(AppState.self) private var appState

    @State private var response: PortfolioResponse?
    @State private var isLoading = true
    @State private var error: String?
    @State private var sortMode: SortMode = .score
    @State private var selectedProject: PortfolioProject?

    enum SortMode: String, CaseIterable {
        case score = "score"
        case recent = "recent"
        case name = "name"

        var label: String {
            switch self {
            case .score: return "Score"
            case .recent: return "Nyeste"
            case .name: return "Navn"
            }
        }
    }

    var body: some View {
        NavigationStack {
            content
                .background(
                    BrandedHeroBackground(.backdrop8, darkenFrom: 0.55, darkenTo: 0.97)
                        .ignoresSafeArea()
                )
                .scrollContentBackground(.hidden)
                .navigationTitle("Portefølje")
                .navigationBarTitleDisplayMode(.large)
                .toolbar { toolbar }
                .task { await load() }
                .refreshable { await load() }
                .sheet(item: $selectedProject) { project in
                    if let customerId = project.customerId {
                        // Bygg en minimal LeadModel for sheet — alle felter er
                        // ikke nødvendige siden LeadDetailSheet henter mer
                        // ved load.
                        LegacyLeadSheetProxy(
                            customerId: customerId,
                            name: project.customerName ?? project.projectName,
                            websiteUrl: project.websiteUrl,
                            logoUrl: project.logoUrl
                        )
                    }
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(spacing: 18) {
                if let s = response?.summary {
                    summaryHeader(s)
                }
                if isLoading && response == nil {
                    ProgressView().padding(.top, 60)
                } else if let projects = response?.projects {
                    if projects.isEmpty {
                        ContentUnavailableView(
                            "Ingen prosjekter ennå",
                            systemImage: "rectangle.stack",
                            description: Text("Plott gridden og opprett kundeprosjekter — så dukker de opp her.")
                        )
                        .padding(.top, 60)
                    } else {
                        projectsGrid(projects)
                    }
                } else if let error {
                    ContentUnavailableView(
                        "Kunne ikke hente porteføljen",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Sammendrag-header

    private func summaryHeader(_ s: PortfolioSummary) -> some View {
        HStack(spacing: 12) {
            summaryTile(
                value: "\(s.totalProjects)",
                label: "Prosjekter",
                icon: "rectangle.stack.fill",
                color: .accentColor
            )
            summaryTile(
                value: "\(s.avgScore)",
                label: "Snitt-score",
                icon: "chart.line.uptrend.xyaxis",
                color: scoreColor(s.avgScore)
            )
            summaryTile(
                value: "\(s.totalNeeds)",
                label: "Totalt behov",
                icon: "list.bullet.clipboard.fill",
                color: .orange
            )
        }
    }

    private func summaryTile(value: String, label: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.system(size: 28, weight: .bold))
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Grid

    private func projectsGrid(_ projects: [PortfolioProject]) -> some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 280), spacing: 14)],
            spacing: 14
        ) {
            ForEach(projects) { project in
                projectCard(project)
                    .onTapGesture { selectedProject = project }
            }
        }
    }

    private func projectCard(_ p: PortfolioProject) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                logoView(p.logoUrl, name: p.projectName)
                VStack(alignment: .leading, spacing: 4) {
                    Text(p.customerName ?? p.projectName)
                        .font(.headline)
                        .lineLimit(1)
                    if let website = p.websiteUrl {
                        Text(displayHost(website))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let cat = p.leadCategory {
                        Text(cat)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                scoreBadge(p.aiOpportunityScore)
            }

            // Needs/Signals chips
            HStack(spacing: 8) {
                statChip(
                    icon: "list.bullet.clipboard",
                    text: "\(p.needsCount) behov",
                    color: .orange
                )
                if p.signalsPositiveCount > 0 {
                    statChip(
                        icon: "checkmark.circle",
                        text: "\(p.signalsPositiveCount)",
                        color: .green
                    )
                }
                if p.signalsNegativeCount > 0 {
                    statChip(
                        icon: "exclamationmark.triangle",
                        text: "\(p.signalsNegativeCount)",
                        color: .red
                    )
                }
                Spacer()
                if let last = p.lastScoutAt {
                    Text("Sist trålet \(last.prefix(10))")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                } else {
                    Text("Ikke trålet ennå")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
            }

            // Tags
            if let tags = p.tags, !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags.prefix(6), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.secondary.opacity(0.12),
                                            in: Capsule())
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(scoreColor(p.aiOpportunityScore ?? 0).opacity(0.4), lineWidth: 1)
        )
    }

    private func logoView(_ url: String?, name: String) -> some View {
        Group {
            if let urlStr = url, let u = URL(string: urlStr) {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    case .empty:
                        ProgressView().controlSize(.small)
                    default:
                        Text(String(name.prefix(2)).uppercased())
                            .font(.callout.weight(.bold))
                            .foregroundStyle(.white)
                    }
                }
            } else {
                Text(String(name.prefix(2)).uppercased())
                    .font(.callout.weight(.bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 48, height: 48)
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.6), .blue.opacity(0.4)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func scoreBadge(_ score: Int?) -> some View {
        let s = score ?? 0
        return VStack(spacing: 0) {
            Text("\(s)")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(scoreColor(s))
            Text("score")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(scoreColor(s).opacity(0.10),
                    in: RoundedRectangle(cornerRadius: 8))
    }

    private func statChip(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(color)
            Text(text)
                .font(.caption2.weight(.semibold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.10),
                    in: Capsule())
    }

    private func scoreColor(_ s: Int) -> Color {
        switch s {
        case 80...100: return .green
        case 60..<80:  return .yellow
        case 40..<60:  return .orange
        default:       return .red
        }
    }

    private func displayHost(_ url: String) -> String {
        URL(string: url)?.host?.replacingOccurrences(of: "www.", with: "") ?? url
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                ForEach(SortMode.allCases, id: \.self) { mode in
                    Button {
                        sortMode = mode
                        Task { await load() }
                    } label: {
                        if sortMode == mode {
                            Label(mode.label, systemImage: "checkmark")
                        } else {
                            Text(mode.label)
                        }
                    }
                }
            } label: {
                Image(systemName: "arrow.up.arrow.down.circle")
            }
        }
    }

    // MARK: - Load

    private func load() async {
        guard let api = appState.api,
              let orgId = appState.activeOrganizationId else { return }
        do {
            let r = try await api.fetchPortfolio(orgId: orgId, sort: sortMode.rawValue)
            response = r
            isLoading = false
        } catch {
            self.error = String(describing: error)
            isLoading = false
        }
    }
}

/// Bryter mellom portfolio-tap og eksisterende LeadDetailSheet. Henter
/// LeadModel fra ID + viser sheet.
private struct LegacyLeadSheetProxy: View {
    let customerId: String
    let name: String
    let websiteUrl: String?
    let logoUrl: String?

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        // For nå viser vi en enkel bridge-view. Når vi har full
        // LeadDetailSheet-flyt fra portfolio kan vi gjøre full
        // pre-load via API.
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 14) {
                        if let urlStr = logoUrl, let u = URL(string: urlStr) {
                            AsyncImage(url: u) { phase in
                                if case .success(let img) = phase {
                                    img.resizable().scaledToFit()
                                }
                            }
                            .frame(width: 60, height: 60)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        VStack(alignment: .leading) {
                            Text(name).font(.title2.bold())
                            if let url = websiteUrl {
                                Link(destination: URL(string: url) ?? URL(string: "https://example.com")!) {
                                    Text(url).font(.caption).foregroundStyle(.tint)
                                }
                            }
                        }
                        Spacer()
                    }
                    LeadNeedsView(leadId: customerId, leadName: name, canRunScout: true)
                        .frame(minHeight: 600)
                }
                .padding(20)
            }
            .navigationTitle("Prosjekt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }
}
