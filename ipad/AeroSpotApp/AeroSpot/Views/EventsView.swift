// EventsView.swift — Arrangementer: flyshow, flydager, spotterdager,
// museer og fly-ins. Kuratert liste fra backend med offline-fallback.

import SwiftUI

@MainActor
@Observable
final class EventsStore {
    private(set) var events: [AeroEvent] = []
    private(set) var loading = true

    func load() async {
        loading = true
        events = await AeroSpotAPI.events()
        loading = false
    }
}

struct EventsView: View {
    @State private var store = EventsStore()
    @State private var filter: String = "Alle"

    private let typeFilters = ["Alle", "airshow", "flydag", "spotting", "museum"]

    @State private var showSubmit = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.spacingLG) {
                    HStack {
                        Text("Arrangementer")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Button {
                            showSubmit = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title2)
                                .foregroundStyle(Theme.primaryBright)
                        }
                    }

                    filterChips

                    if store.loading {
                        ProgressView().tint(Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(Theme.spacingXL)
                    } else if filtered.isEmpty {
                        EmptyStateView(title: "Ingen arrangementer", message: "Prøv et annet filter.")
                    } else {
                        if !featuredEvents.isEmpty {
                            Text("FREMHEVET")
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.8)
                                .foregroundStyle(Theme.gold)
                            ForEach(featuredEvents) { event in
                                eventLink(event)
                            }
                        }
                        ForEach(grouped, id: \.0) { month, events in
                            Text(month.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.8)
                                .foregroundStyle(Theme.textSecondary)
                            ForEach(events) { event in
                                eventLink(event)
                            }
                        }
                    }

                    organizerClaim
                }
                .padding(Theme.spacingLG)
            }
            .background(Theme.background)
        }
        .task { await store.load() }
        .sheet(isPresented: $showSubmit) {
            EventSubmitView()
        }
    }

    /// Inngang for arrangører som allerede bruker appen: meld inn / claim.
    private var organizerClaim: some View {
        Button {
            showSubmit = true
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Label("Er du arrangør?", systemImage: "megaphone.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryBright)
                Text("Meld inn arrangementet ditt og få en verifisert side i AeroSpot.")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.spacingMD)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
        }
        .buttonStyle(.plain)
        .padding(.top, Theme.spacingMD)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.spacingSM) {
                ForEach(typeFilters, id: \.self) { item in
                    Button {
                        filter = item
                    } label: {
                        Text(label(for: item))
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, Theme.spacingSM)
                            .background(filter == item ? Theme.primary : Theme.surfaceElevated)
                            .foregroundStyle(filter == item ? .white : Theme.textSecondary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func label(for type: String) -> String {
        switch type {
        case "airshow": return "Flyshow"
        case "flydag": return "Flydag"
        case "spotting": return "Spotting"
        case "museum": return "Museum"
        default: return "Alle"
        }
    }

    private func eventLink(_ event: AeroEvent) -> some View {
        NavigationLink {
            EventDetailView(event: event)
        } label: {
            EventCard(event: event)
        }
        .buttonStyle(.plain)
    }

    /// Fremhevede arrangementer (kommende), vist i egen topp-seksjon.
    private var featuredEvents: [AeroEvent] {
        filtered.filter { $0.featured == true }
    }

    private var filtered: [AeroEvent] {
        let list = filter == "Alle" ? store.events : store.events.filter { $0.type == filter }
        return list.sorted { $0.startDate < $1.startDate }
    }

    /// Grupper på måned (norsk) for seksjonsoverskrifter.
    private var grouped: [(String, [AeroEvent])] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "nb_NO")
        formatter.dateFormat = "yyyy-MM-dd"
        let out = DateFormatter()
        out.locale = Locale(identifier: "nb_NO")
        out.dateFormat = "LLLL yyyy"

        var order: [String] = []
        var map: [String: [AeroEvent]] = [:]
        for event in filtered where event.featured != true {
            let key: String
            if let date = formatter.date(from: event.startDate) {
                key = out.string(from: date).capitalized
            } else {
                key = "Løpende"
            }
            if map[key] == nil { order.append(key) }
            map[key, default: []].append(event)
        }
        return order.map { ($0, map[$0] ?? []) }
    }
}

private struct EventCard: View {
    let event: AeroEvent

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(event.name)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                        if event.verified == true {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.primaryBright)
                        }
                    }
                    Text(event.venue)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    if event.featured == true {
                        Label("Fremhevet", systemImage: "star.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.background)
                            .padding(.horizontal, Theme.spacingSM)
                            .padding(.vertical, 3)
                            .background(Theme.gold)
                            .clipShape(Capsule())
                    }
                    typeBadge
                }
            }
            HStack(spacing: Theme.spacingSM) {
                Label(dateText, systemImage: "calendar")
                if event.country != "NO" {
                    Label(event.country, systemImage: "globe")
                }
            }
            .font(.caption)
            .foregroundStyle(Theme.textSecondary)

            Text(event.description)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)

            if let urlString = event.url, let url = URL(string: urlString) {
                Link(destination: url) {
                    Label("Mer info", systemImage: "arrow.up.right.square")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.primaryBright)
                }
            }
        }
        .card()
    }

    private var typeBadge: some View {
        Text(typeLabel.uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, 3)
            .background(typeColor)
            .clipShape(Capsule())
    }

    private var typeLabel: String {
        switch event.type {
        case "airshow": return "Flyshow"
        case "flydag": return "Flydag"
        case "spotting": return "Spotting"
        case "museum": return "Museum"
        case "fly-in": return "Fly-in"
        default: return event.type
        }
    }

    private var typeColor: Color {
        switch event.type {
        case "airshow": return Theme.danger
        case "flydag": return Theme.primary
        case "spotting": return Theme.success
        case "museum": return Theme.textTertiary
        default: return Theme.warning
        }
    }

    private var dateText: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.locale = Locale(identifier: "nb_NO")
        outFmt.dateFormat = "d. MMM"
        guard let start = inFmt.date(from: event.startDate) else { return event.startDate }
        if event.startDate == event.endDate {
            return outFmt.string(from: start)
        }
        if let end = inFmt.date(from: event.endDate) {
            return "\(outFmt.string(from: start))–\(outFmt.string(from: end))"
        }
        return outFmt.string(from: start)
    }
}
