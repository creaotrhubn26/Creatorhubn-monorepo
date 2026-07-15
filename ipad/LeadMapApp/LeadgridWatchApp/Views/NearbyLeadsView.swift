// NearbyLeadsView.swift
//
// Watch-rotview: leads sortert etter avstand fra GPS. Tap åpner
// QuickActionView. Hvis ingen GPS-permission, viser usortert liste.

import SwiftUI
import CoreLocation

struct NearbyLeadsView: View {
    @EnvironmentObject private var session: PhoneSession
    @EnvironmentObject private var locationVM: WatchLocationModel

    private var sortedLeads: [(WatchLead, Double?)] {
        let leads = session.leads
        if let loc = locationVM.currentLocation {
            return leads
                .map { ($0, $0.distance(from: loc)) }
                .sorted { ($0.1 ?? .infinity) < ($1.1 ?? .infinity) }
        } else {
            return leads.map { ($0, nil) }
        }
    }

    // MERK: INGEN egen NavigationStack her. Denne visningen er en side i en
    // `TabView(.verticalPage)` (se RootTabs), som på watchOS allerede pakker
    // hver side i sin egen navigasjons-kontroller. En ekstra NavigationStack
    // ga to konkurrerende PUICStackedNavigationBar-er → «top item belongs to a
    // different navigation bar»-krasj så snart lista fikk innhold. NavigationLink
    // pusher på den implisitte stacken.
    var body: some View {
        List {
            if sortedLeads.isEmpty {
                Text("Ingen leads")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(sortedLeads, id: \.0.id) { (lead, distance) in
                    NavigationLink(destination: QuickActionView(lead: lead)) {
                        LeadRow(lead: lead, distance: distance)
                    }
                }
                // Oppdater posisjon — som list-rad (ikke toolbar, som ville
                // gjenskapt nav-bar-konflikten på watchOS' paged TabView).
                Button {
                    locationVM.requestLocation()
                } label: {
                    Label("Oppdater posisjon", systemImage: "location.fill")
                        .font(.footnote)
                        .foregroundStyle(.purple)
                }
            }
        }
        .navigationTitle("Leads")
    }
}

struct LeadRow: View {
    let lead: WatchLead
    let distance: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(lead.name)
                .font(.headline)
                .lineLimit(1)
            HStack(spacing: 6) {
                if let d = distance {
                    Label(formatDistance(d), systemImage: "location")
                        .font(.caption2)
                        .foregroundStyle(.purple)
                }
                if lead.leadStatus != "unvisited" {
                    Text("·")
                        .font(.caption2)
                    Text(lead.statusLabel)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func formatDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return "\(Int(meters)) m"
        }
        return String(format: "%.1f km", meters / 1000)
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "iphone.gen3")
                .font(.largeTitle)
                .foregroundStyle(.purple)
            Text("Åpne Leadgrid på iPhone")
                .font(.caption)
                .multilineTextAlignment(.center)
            Text("Leads synker hit automatisk")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}
