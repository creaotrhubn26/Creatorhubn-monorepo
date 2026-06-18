// MarketingInboxView.swift
//
// Markedsfører-innboks: alle pending+in_progress focus-requests fra
// klienter. Gated på marketing.deliveries.execute.
//
// Tap på rad → DeliveryPlaybookView som viser playbook + lar
// markedsføreren markere steg som ferdig.

import SwiftUI

struct MarketingInboxView: View {
    @Environment(AppState.self) private var appState

    @State private var response: FocusRequestsResponse?
    @State private var isLoading = true
    @State private var error: String?
    @State private var filter: StatusFilter = .open
    @State private var selectedFocus: FocusRequestRow?
    @State private var startedDeliverableId: String?

    enum StatusFilter: String, CaseIterable {
        case open = "open"
        case in_progress = "in_progress"
        case completed = "completed"

        var label: String {
            switch self {
            case .open:        return "Åpne"
            case .in_progress: return "Pågår"
            case .completed:   return "Ferdig"
            }
        }

        var apiValue: String? {
            switch self {
            case .open:        return "pending"
            case .in_progress: return "in_progress"
            case .completed:   return "completed"
            }
        }
    }

    var body: some View {
        NavigationStack {
            content
                .background(
                    BrandedHeroBackground(.backdrop1, darkenFrom: 0.55, darkenTo: 0.97)
                        .ignoresSafeArea()
                )
                .scrollContentBackground(.hidden)
                .navigationTitle("Innboks")
                .navigationBarTitleDisplayMode(.large)
                .toolbar { toolbar }
                .task { await load() }
                .refreshable { await load() }
                .sheet(item: $selectedFocus) { focus in
                    DeliveryPlaybookView(
                        focusRequest: focus,
                        existingDeliverableId: startedDeliverableId
                    )
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(spacing: 14) {
                if isLoading && response == nil {
                    ProgressView().padding(.top, 60)
                } else if let rows = response?.focusRequests {
                    if rows.isEmpty {
                        ContentUnavailableView(
                            "Innboksen er tom",
                            systemImage: "tray",
                            description: Text("Når klienter ber om fokus på behov dukker de opp her.")
                        )
                        .padding(.top, 60)
                    } else {
                        ForEach(rows) { row in
                            inboxRow(row)
                                .onTapGesture {
                                    selectedFocus = row
                                }
                        }
                    }
                } else if let error {
                    ContentUnavailableView(
                        "Kunne ikke hente innboks",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Picker("Filter", selection: $filter) {
                ForEach(StatusFilter.allCases, id: \.self) { f in
                    Text(f.label).tag(f)
                }
            }
            .pickerStyle(.menu)
            .onChange(of: filter) { _, _ in
                Task { await load() }
            }
        }
    }

    private func inboxRow(_ row: FocusRequestRow) -> some View {
        HStack(spacing: 14) {
            // Logo
            if let logo = row.customerLogo, let u = URL(string: logo) {
                AsyncImage(url: u) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit()
                    } else {
                        placeholder(row.customerName ?? row.needType)
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                placeholder(row.customerName ?? row.needType)
                    .frame(width: 48, height: 48)
                    .background(
                        LinearGradient(
                            colors: [.purple.opacity(0.6), .blue.opacity(0.4)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(row.customerName ?? "Ukjent kunde")
                    .font(.headline)
                    .lineLimit(1)
                Text(row.displayNeedLabel)
                    .font(.subheadline)
                    .foregroundStyle(.tint)
                    .lineLimit(1)
                if let note = row.clientNote, !note.isEmpty {
                    Text("«\(note)»")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            statusBadge(row.status)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    private func placeholder(_ name: String) -> some View {
        Text(String(name.prefix(2)).uppercased())
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color
        let label: String
        switch status {
        case "pending":      color = .orange; label = "Ny"
        case "acknowledged": color = .blue;   label = "Sett"
        case "in_progress":  color = .yellow; label = "Pågår"
        case "completed":    color = .green;  label = "Ferdig"
        case "declined":     color = .gray;   label = "Avvist"
        default:             color = .gray;   label = status
        }
        return Text(label)
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
    }

    private func load() async {
        guard let api = appState.api,
              let orgId = appState.activeOrganizationId else { return }
        do {
            let r = try await api.fetchFocusRequests(orgId: orgId, status: filter.apiValue)
            response = r
            isLoading = false
        } catch {
            self.error = String(describing: error)
            isLoading = false
        }
    }
}
