import SwiftUI

struct DiscoveryPlaceDetailsSheet: View {
    let candidate: DiscoveryV2Candidate
    let load: @MainActor () async throws -> DiscoveryV2PlaceDetailsResponse

    @Environment(\.dismiss) private var dismiss
    @State private var response: DiscoveryV2PlaceDetailsResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    sourceIdentity
                    content
                }
                .frame(maxWidth: 720)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .background(LeadgridDiscoveryTheme.background.ignoresSafeArea())
            .navigationTitle("Google Maps-detaljer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .task(id: candidate.id) { await reload() }
    }

    private var sourceIdentity: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label("Kandidaten fra Brønnøysundregistrene", systemImage: "building.columns")
                .font(.caption.bold())
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            Text(candidate.name).font(.headline)
            if let address = [candidate.address, candidate.city]
                .compactMap({ $0 })
                .filter({ !$0.isEmpty })
                .joined(separator: " · ")
                .nilIfEmpty {
                Text(address)
                    .font(.subheadline)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            Text("Google Maps brukes kun til dette detaljoppslaget og endrer ikke kandidaten eller matchscoren.")
                .font(.caption)
                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
        }
        .discoverySurface()
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            VStack(spacing: 12) {
                ProgressView()
                Text("Henter oppdaterte detaljer …")
                    .font(.subheadline)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 34)
            .discoverySurface()
        } else if let errorMessage {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title2)
                    .foregroundStyle(LeadgridDiscoveryTheme.warning)
                Text(errorMessage).multilineTextAlignment(.center)
                Button("Prøv igjen") { Task { await reload() } }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
            .discoverySurface()
        } else if let response {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Mulige bedriftsprofiler")
                        .font(.headline)
                    Spacer()
                    Text("Google Maps")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .accessibilityLabel("Google Maps")
                }
                Text(response.notice)
                    .font(.caption)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                Text(response.rankingNotice)
                    .font(.caption2)
                    .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)

                if response.matches.isEmpty {
                    Label("Fant ingen Google Maps-profiler som kunne vises.", systemImage: "magnifyingglass")
                        .font(.subheadline)
                        .padding(.vertical, 12)
                } else {
                    ForEach(response.matches) { match in
                        placeCard(match)
                    }
                }
            }
            .padding(16)
            .background(LeadgridDiscoveryTheme.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(LeadgridDiscoveryTheme.accent.opacity(0.45), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func placeCard(_ match: DiscoveryV2PlaceMatch) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(match.displayName).font(.headline)
                    if let type = match.primaryTypeLabel {
                        Text(type)
                            .font(.caption)
                            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    }
                }
                Spacer()
                Text(match.matchQualityTitle)
                    .font(.caption.bold())
                    .foregroundStyle(matchQualityColor(match.matchQuality))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(matchQualityColor(match.matchQuality).opacity(0.14), in: Capsule())
            }

            if let address = match.formattedAddress {
                Label(address, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
            }
            if let phone = match.phoneNumber {
                Label(phone, systemImage: "phone")
                    .font(.subheadline)
            }
            if let status = match.businessStatusTitle {
                Label(status, systemImage: "building.2")
                    .font(.caption)
                    .foregroundStyle(status == "Permanent stengt"
                        ? LeadgridDiscoveryTheme.danger
                        : LeadgridDiscoveryTheme.secondaryText)
            }
            if !match.matchReasons.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(match.matchReasons, id: \.self) { reason in
                        Text("• \(reason)")
                            .font(.caption)
                            .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                    }
                }
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { placeLinks(match) }
                VStack(alignment: .leading, spacing: 8) { placeLinks(match) }
            }

            if !match.attributions.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(match.attributions) { attribution in
                        if let url = attribution.providerURL {
                            Link("Datakilde: \(attribution.provider)", destination: url)
                                .font(.caption2)
                        } else {
                            Text("Datakilde: \(attribution.provider)")
                                .font(.caption2)
                                .foregroundStyle(LeadgridDiscoveryTheme.secondaryText)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(LeadgridDiscoveryTheme.background.opacity(0.62), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func placeLinks(_ match: DiscoveryV2PlaceMatch) -> some View {
        if let url = match.googleMapsURL {
            Link(destination: url) {
                Label("Åpne i Google Maps", systemImage: "arrow.up.right.square")
            }
            .buttonStyle(.borderedProminent)
        }
        if let url = match.websiteURL {
            Link(destination: url) {
                Label("Nettsted", systemImage: "globe")
            }
            .buttonStyle(.bordered)
        }
        if let url = match.phoneURL {
            Link(destination: url) {
                Label("Ring", systemImage: "phone.fill")
            }
            .buttonStyle(.bordered)
        }
    }

    private func matchQualityColor(_ quality: String) -> Color {
        switch quality {
        case "strong": LeadgridDiscoveryTheme.success
        case "possible": LeadgridDiscoveryTheme.warning
        default: LeadgridDiscoveryTheme.secondaryText
        }
    }

    @MainActor
    private func reload() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            response = try await load()
        } catch is CancellationError {
            return
        } catch {
            response = nil
            errorMessage = error.localizedDescription
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
