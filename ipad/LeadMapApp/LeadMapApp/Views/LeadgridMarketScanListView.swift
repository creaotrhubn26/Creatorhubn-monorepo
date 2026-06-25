// LeadgridMarketScanListView.swift
//
// Inngangen fra LeadgridHubView ("Market Scan"-seksjonen). Viser en
// liste over markedssjefens siste 30 scans m/ statusbadge + leads-
// counter. "+ Ny scan" presenterer LeadgridMarketScanFormView som sheet;
// tap på en rad navigerer til LeadgridMarketScanDetailView.

import SwiftUI

struct LeadgridMarketScanListView: View {
    @Environment(AppState.self) private var appState
    let api: APIClient

    @State private var scans: [LeadgridMarketScan] = []
    @State private var loading = true
    @State private var error: String?

    @State private var presentingForm = false
    @State private var navigateTo: LeadgridMarketScan?

    var body: some View {
        List {
            if loading && scans.isEmpty {
                Section {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            } else if scans.isEmpty {
                Section {
                    ContentUnavailableView(
                        "Ingen scans ennå",
                        systemImage: "magnifyingglass.circle",
                        description: Text(
                            "Trykk \"Ny scan\" for å la Claude finne "
                                + "nye leads i et bransje + region.",
                        ),
                    )
                    .listRowBackground(Color.clear)
                }
            } else {
                Section("Mine scans (\(scans.count))") {
                    ForEach(scans) { scan in
                        Button {
                            navigateTo = scan
                        } label: {
                            row(scan)
                        }
                        .buttonStyle(.plain)
                    }
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
        .navigationTitle("Market Scan")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    presentingForm = true
                } label: {
                    Label("Ny scan", systemImage: "plus.circle.fill")
                }
                .tint(.purple)
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $presentingForm) {
            LeadgridMarketScanFormView(
                api: api,
                organizationId: appState.activeOrganizationId,
            ) { scan in
                // Vi setter scanen som nav-mål så detail-viewet åpnes
                // umiddelbart etter at sheet er lukket.
                navigateTo = scan
                // Refresh listen i bakgrunnen så den nye scanen vises i
                // historikken.
                Task { await load() }
            }
        }
        .navigationDestination(item: $navigateTo) { scan in
            LeadgridMarketScanDetailView(
                api: api,
                scanId: scan.id,
                initialScan: scan,
            )
        }
    }

    // MARK: - Row

    @ViewBuilder
    private func row(_ scan: LeadgridMarketScan) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass.circle.fill")
                .foregroundStyle(.purple)
                .font(.title2)
            VStack(alignment: .leading, spacing: 4) {
                Text(scan.name)
                    .font(.headline)
                    .lineLimit(2)
                HStack(spacing: 6) {
                    statusChip(LeadgridMarketScanStatusChip(scan.displayStatus))
                    if let industry = scan.industry, !industry.isEmpty {
                        Text(industry)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 10) {
                    if scan.leadsCreatedCount > 0 {
                        Label(
                            "\(scan.leadsCreatedCount) leads",
                            systemImage: "person.crop.circle.badge.plus",
                        )
                        .font(.caption2)
                        .foregroundStyle(.purple)
                    }
                    if let date = scan.createdAt {
                        Text(formatDate(date))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusChip(_ chip: LeadgridMarketScanStatusChip) -> some View {
        let (bg, fg) = chipColors(chip)
        Text(chip.label)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
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

    private static let isoFmt: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoFmtNoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let displayFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    private func formatDate(_ raw: String) -> String {
        // Backend `created_at::text` kan komme som "2026-06-22 10:14:32.123+00"
        // eller ISO8601 — vi prøver begge.
        if let date = Self.isoFmt.date(from: raw) ?? Self.isoFmtNoFrac.date(from: raw) {
            return Self.displayFmt.string(from: date)
        }
        // Fallback: ta første 16 tegn (yyyy-MM-dd HH:mm).
        return String(raw.prefix(16))
    }

    @MainActor
    private func load() async {
        do {
            let resp = try await api.fetchLeadgridMarketScans()
            self.scans = resp
            self.loading = false
            self.error = nil
        } catch {
            self.loading = false
            self.error = "Kunne ikke laste scans: \(error.localizedDescription)"
        }
    }
}
