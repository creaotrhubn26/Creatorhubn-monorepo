// LeadgridPartnersView.swift
//
// Partner-program landing-strip for markedssjef. Public endpoint
// (godkjente partnere kun). Brukes for "Powered by"-flate.
//
// Backend: GET /api/leadgrid/partners?type=...

import SwiftUI

struct LeadgridPartnersView: View {
    let api: APIClient

    @State private var partners: [LeadgridPartner] = []
    @State private var loading = true
    @State private var selectedType: String? = nil
    @State private var errorText: String?

    private let types: [(label: String, key: String?)] = [
        ("Alle", nil),
        ("Photo/Video", "media"),
        ("Marketing", "marketing"),
        ("Sales", "sales"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Type-filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(types, id: \.label) { t in
                            Button {
                                selectedType = t.key
                                Task { await load() }
                            } label: {
                                Text(t.label)
                                    .font(.subheadline.bold())
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(
                                        selectedType == t.key
                                            ? Color.purple.opacity(0.25)
                                            : Color.secondary.opacity(0.10),
                                        in: Capsule(),
                                    )
                                    .foregroundStyle(
                                        selectedType == t.key ? .purple : .primary,
                                    )
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                if loading && partners.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .frame(height: 100)
                } else if partners.isEmpty {
                    ContentUnavailableView(
                        "Ingen partnere ennå",
                        systemImage: "person.2",
                        description: Text("Vi ruller ut partner-programmet — kom tilbake senere."),
                    )
                    .padding()
                } else {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 250, maximum: 360), spacing: 12)
                    ], spacing: 12) {
                        ForEach(partners) { p in
                            partnerCard(p)
                        }
                    }
                    .padding(.horizontal)
                }

                if let errorText {
                    Text(errorText)
                        .foregroundStyle(.red)
                        .font(.caption)
                        .padding()
                }
            }
        }
        .navigationTitle("Partnere")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func partnerCard(_ p: LeadgridPartner) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if let urlStr = p.logoUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        Image(systemName: "building.2.fill")
                            .foregroundStyle(.secondary)
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    Image(systemName: "building.2.fill")
                        .frame(width: 40, height: 40)
                        .background(Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name).font(.headline)
                    if let type = p.partnerType {
                        Text(type.capitalized)
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 1)
                            .background(Color.purple.opacity(0.20), in: Capsule())
                            .foregroundStyle(.purple)
                    }
                }
                Spacer()
            }

            if let tagline = p.tagline, !tagline.isEmpty {
                Text(tagline)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            if let website = p.website, let url = URL(string: website) {
                Link(destination: url) {
                    Label("Besøk nettside", systemImage: "arrow.up.right.square")
                        .font(.caption.bold())
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let resp = try await api.fetchLeadgridPartners(type: selectedType)
            await MainActor.run {
                partners = resp.partners
                loading = false
                errorText = nil
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste partnere"
                loading = false
            }
        }
    }
}
