// ModerationView.swift — admin godkjenner/avviser innsendte arrangementer.
// Kun synlig/brukbar for admin (backend rolle-gate 403 ellers).

import SwiftUI

struct ModerationView: View {
    @State private var events: [AeroEvent] = []
    @State private var result: AeroSpotAPI.AdminResult?
    @State private var loading = true
    @State private var working: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                if loading {
                    ProgressView().tint(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(Theme.spacingXL)
                } else if result == .forbidden {
                    EmptyStateView(
                        title: "Kun for admin",
                        message: "Du må være innlogget som administrator for å moderere arrangementer."
                    )
                } else if events.isEmpty {
                    EmptyStateView(
                        title: "Ingen i kø",
                        message: "Alle innsendte arrangementer er behandlet."
                    )
                } else {
                    Text("\(events.count) venter på godkjenning")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                    ForEach(events) { event in
                        card(event)
                    }
                }
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.background)
        .navigationTitle("Moderering")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func card(_ event: AeroEvent) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text(event.name)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text([event.venue, event.country, event.startDate].joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            Text(event.description)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(3)
            if working == event.id {
                ProgressView().tint(Theme.textSecondary)
            } else {
                HStack(spacing: Theme.spacingSM) {
                    Button {
                        Task { await moderate(event, approve: true, verified: true) }
                    } label: {
                        Label("Godkjenn + verifiser", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Theme.spacingSM)
                            .background(Theme.success.opacity(0.2))
                            .foregroundStyle(Theme.success)
                            .clipShape(Capsule())
                    }
                    Button {
                        Task { await moderate(event, approve: true, verified: false) }
                    } label: {
                        Text("Godkjenn")
                            .font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Theme.spacingSM)
                            .background(Theme.surfaceElevated)
                            .foregroundStyle(Theme.primaryBright)
                            .clipShape(Capsule())
                    }
                    Button {
                        Task { await moderate(event, approve: false) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.caption)
                            .padding(Theme.spacingSM)
                            .background(Theme.danger.opacity(0.15))
                            .foregroundStyle(Theme.danger)
                            .clipShape(Circle())
                    }
                }
            }
        }
        .card()
    }

    private func load() async {
        loading = true
        let r = await AeroSpotAPI.pendingEvents()
        events = r.events
        result = r.result
        loading = false
    }

    private func moderate(_ event: AeroEvent, approve: Bool, verified: Bool = false) async {
        working = event.id
        let r = await AeroSpotAPI.moderateEvent(id: event.id, approve: approve, verified: verified)
        if r == .success {
            events.removeAll { $0.id == event.id }
        }
        working = nil
    }
}
