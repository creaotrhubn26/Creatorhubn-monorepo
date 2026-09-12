// LeadgridMarketScanDetailView.swift
//
// Detail-view for én Market Scan. Viser:
//   - Header: navn + status-chip + leads-badge
//   - Mens running: ProgressView + "Claude analyserer markedet..." +
//     poll hvert 3 sek til status != running
//   - Konkurrenter-seksjon (m/ adresse + website hvis tilgjengelig)
//   - Muligheter-seksjon (Claude-generete kampanje-vinkler)
//   - "Vis på kart"-CTA nederst (instruerer bruker å bytte til Kart-tab)
//
// Bruker LeadgridMarketScanDetail = scan + competitors + opportunities. Status-
// poll henter kun scan-progress (lett); full re-load skjer når status
// flipper til completed.

import SwiftUI

struct LeadgridMarketScanDetailView: View {
    let api: APIClient
    /// Scan-id å vise/poll'e.
    let scanId: String
    /// Valgfri "start"-rad — vi viser den umiddelbart mens første poll
    /// kommer inn. Tillater seamless overgang fra Form → Detail.
    let initialScan: LeadgridMarketScan?

    @Environment(\.dismiss) private var dismiss

    @State private var scan: LeadgridMarketScan?
    @State private var competitors: [LeadgridMarketScanCompetitor] = []
    @State private var opportunities: [LeadgridMarketScanOpportunity] = []

    @State private var isLoading = false
    @State private var error: String?

    /// Viser bekreftelses-banner når "Vis på kart" trykkes.
    @State private var showingMapHint = false

    init(
        api: APIClient,
        scanId: String,
        initialScan: LeadgridMarketScan? = nil,
    ) {
        self.api = api
        self.scanId = scanId
        self.initialScan = initialScan
        _scan = State(initialValue: initialScan)
    }

    var body: some View {
        List {
            headerSection

            if let chip = scan.map({ LeadgridMarketScanStatusChip($0.displayStatus) }),
               chip == .running {
                runningSection
            }

            if let scan, let errorMsg = scan.errorMessage,
               scan.displayStatus == "failed" {
                Section {
                    Label(errorMsg, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                        .font(.callout)
                }
            }

            if !competitors.isEmpty {
                competitorsSection
            }

            if !opportunities.isEmpty {
                opportunitiesSection
            }

            if let scan, scan.displayStatus == "completed" {
                Section {
                    Button {
                        showingMapHint = true
                    } label: {
                        Label(
                            scan.leadsCreatedCount > 0
                                ? "Vis \(scan.leadsCreatedCount) pins på kart"
                                : "Vis på kart",
                            systemImage: "map.fill",
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }

            if let error {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
        .navigationTitle(scan?.name ?? "Market Scan")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reloadFull() }
        .task { await initialLoad() }
        .task(id: scan?.displayStatus) {
            // Poll-loop hvis status er 'running' eller 'draft' (orchestrator
            // setter status='pending' helt til den er ferdig).
            await pollIfNeeded()
        }
        .alert("Bytt til Kart-fanen", isPresented: $showingMapHint) {
            Button("OK") { dismiss() }
        } message: {
            Text(
                "Pin-er fra denne scanen ligger i Lead Map. Lukk denne "
                    + "visningen og åpne Kart-fanen for å se dem.",
            )
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var headerSection: some View {
        Section {
            if let scan {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        statusChip(LeadgridMarketScanStatusChip(scan.displayStatus))
                        Spacer()
                        if scan.leadsCreatedCount > 0 {
                            leadsBadge(scan.leadsCreatedCount)
                        }
                    }
                    if let industry = scan.industry, !industry.isEmpty,
                       let region = scan.region, !region.isEmpty {
                        Label("\(industry) — \(region)", systemImage: "location.fill")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else if let region = scan.region, !region.isEmpty {
                        Label(region, systemImage: "location.fill")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if let audience = scan.targetAudience, !audience.isEmpty {
                        Label(audience, systemImage: "person.2.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if scan.totalCompetitors > 0 || scan.totalOpportunities > 0 {
                        HStack(spacing: 16) {
                            statCell(
                                "\(scan.totalCompetitors)",
                                "konkurrenter",
                            )
                            statCell(
                                "\(scan.totalOpportunities)",
                                "muligheter",
                            )
                            statCell(
                                "\(scan.leadsCreatedCount)",
                                "leads",
                            )
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(.vertical, 4)
            } else if isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }
            }
        }
    }

    @ViewBuilder
    private var runningSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Claude analyserer markedet…")
                        .font(.callout)
                }
                if let msg = scan?.phaseMessage, !msg.isEmpty {
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if let phase = scan?.phase, !phase.isEmpty {
                    Text(phase)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private var competitorsSection: some View {
        Section("Konkurrenter funnet (\(competitors.count))") {
            ForEach(competitors) { comp in
                competitorRow(comp)
            }
        }
    }

    @ViewBuilder
    private func competitorRow(_ comp: LeadgridMarketScanCompetitor) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: comp.hasCoordinates
                  ? "mappin.circle.fill"
                  : "building.2.fill")
                .foregroundStyle(comp.hasCoordinates ? .purple : .secondary)
                .font(.title3)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(comp.name)
                    .font(.subheadline.weight(.medium))
                if let addr = comp.googleAddress, !addr.isEmpty {
                    Text(addr)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else if let category = comp.category, !category.isEmpty {
                    Text(category)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    if let web = comp.displayWebsite {
                        Label(web, systemImage: "globe")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                            .lineLimit(1)
                    }
                    if let rating = comp.googleRating {
                        Label(
                            String(format: "%.1f", rating),
                            systemImage: "star.fill",
                        )
                        .font(.caption2)
                        .foregroundStyle(.orange)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var opportunitiesSection: some View {
        Section("Muligheter (\(opportunities.count))") {
            ForEach(opportunities) { opp in
                VStack(alignment: .leading, spacing: 4) {
                    Text(opp.title)
                        .font(.subheadline.weight(.medium))
                    if let desc = opp.description, !desc.isEmpty {
                        Text(desc)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let impact = opp.estimatedImpact, !impact.isEmpty {
                        Label(impact, systemImage: "chart.bar.fill")
                            .font(.caption2)
                            .foregroundStyle(.purple)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - Chips / cells

    @ViewBuilder
    private func statusChip(_ chip: LeadgridMarketScanStatusChip) -> some View {
        let (bg, fg) = chipColors(chip)
        Label(chip.label, systemImage: chip.systemIcon)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(bg.opacity(0.18), in: Capsule())
            .foregroundStyle(fg)
    }

    private func chipColors(_ chip: LeadgridMarketScanStatusChip) -> (Color, Color) {
        switch chip {
        case .completed: return (.green, .green)
        case .running:   return (.blue, .blue)
        case .failed:    return (.red, .red)
        case .draft:     return (.gray, .gray)
        }
    }

    @ViewBuilder
    private func leadsBadge(_ count: Int) -> some View {
        Label("\(count) leads", systemImage: "person.crop.circle.badge.plus")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Color.purple.opacity(0.16), in: Capsule())
            .foregroundStyle(.purple)
    }

    @ViewBuilder
    private func statCell(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(.purple)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Loading

    @MainActor
    private func initialLoad() async {
        // Hvis vi mottok en initialScan og den allerede er completed —
        // last hele bundle med en gang.
        if let scan, scan.displayStatus == "completed" {
            await reloadFull()
            return
        }
        // Ellers gjør første full-load for å slå opp ekte status.
        await reloadFull()
    }

    @MainActor
    private func reloadFull() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let bundle = try await api.fetchLeadgridMarketScan(id: scanId)
            self.scan = bundle.scan
            self.competitors = bundle.competitors
            self.opportunities = bundle.opportunities
            self.error = nil
        } catch {
            self.error = "Kunne ikke laste scan: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func pollIfNeeded() async {
        // Poll kun mens scan eksisterer og er running. .task(id:) kjører
        // denne på nytt når displayStatus endrer seg.
        guard let current = scan,
              LeadgridMarketScanStatusChip(current.displayStatus) == .running
        else { return }

        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 3 * NSEC_PER_SEC)
            if Task.isCancelled { return }
            do {
                let updated = try await api.fetchLeadgridMarketScanProgress(id: scanId)
                self.scan = updated
                let chip = LeadgridMarketScanStatusChip(updated.displayStatus)
                if chip == .completed {
                    // Fyll opp competitors + opportunities når scanen er ferdig.
                    await reloadFull()
                    return
                }
                if chip == .failed || chip == .draft {
                    return
                }
            } catch {
                // Kort backoff — vi prøver igjen på neste tick.
                self.error = "Avbrutt polling: \(error.localizedDescription)"
            }
        }
    }
}
