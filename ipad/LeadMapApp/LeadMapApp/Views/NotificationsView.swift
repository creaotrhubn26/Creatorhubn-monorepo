// NotificationsView.swift
//
// Varsler-feed for iPad (PR #622 paritet). Polling hvert 30s,
// mark-as-read, deep-link til lead-detalj.

import SwiftUI

struct NotificationsView: View {
    @Environment(AppState.self) private var state
    @State private var notifications: [NotificationEvent] = []
    @State private var unreadCount: Int = 0
    @State private var loading = false
    @State private var refreshTimer: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if notifications.isEmpty && !loading {
                    emptyState
                } else {
                    list
                }
            }
            .navigationTitle("Varsler")
            .toolbar {
                if unreadCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Markér alle") { Task { await markAllRead() } }
                    }
                }
            }
            .task { await load() }
            .onAppear { startPolling() }
            .onDisappear { stopPolling() }
            .refreshable { await load() }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bell.slash")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Ingen varsler enda").font(.headline)
            Text("Du får varsler når du blir tildelt leads eller en lead-status endres.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var list: some View {
        List(notifications) { notif in
            NotificationRow(notif: notif) {
                Task { await onTap(notif) }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
            .listRowBackground(notif.isUnread
                              ? Color(hex: notif.colorHex).opacity(0.08)
                              : Color.clear)
        }
        .listStyle(.plain)
    }

    @MainActor
    private func load() async {
        guard let api = state.api else { return }
        loading = true
        defer { loading = false }
        do {
            let resp = try await api.fetchNotifications(limit: 50)
            self.notifications = resp.notifications
            self.unreadCount = resp.unreadCount
        } catch {
            // Stille feil — refresh prøver igjen
        }
    }

    private func startPolling() {
        refreshTimer?.cancel()
        refreshTimer = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { return }
                await load()
            }
        }
    }

    private func stopPolling() {
        refreshTimer?.cancel()
        refreshTimer = nil
    }

    @MainActor
    private func onTap(_ notif: NotificationEvent) async {
        guard let api = state.api else { return }
        if notif.isUnread {
            try? await api.markNotificationRead(notif.id)
            // Optimistisk oppdater lokalt
            if let idx = notifications.firstIndex(where: { $0.id == notif.id }) {
                // Vi kan ikke mutere struct-feltet direkte (let), så
                // erstatt med ny instans via Decodable-roundtrip ville
                // vært overkill — i stedet bare reload feed.
                _ = idx
            }
            unreadCount = max(0, unreadCount - 1)
            await load()
        }
        // Deep-link: hopp til Kart-tab + naviger til lead hvis mulig
        if let leadId = notif.leadId {
            // Sett selectedLead via AppState så LeadDetailSheet vises
            if let lead = state.leads.first(where: { $0.id == leadId }) {
                state.selectedLead = lead
            }
        }
    }

    @MainActor
    private func markAllRead() async {
        guard let api = state.api else { return }
        try? await api.markAllNotificationsRead()
        await load()
    }
}

// MARK: - Rad

private struct NotificationRow: View {
    let notif: NotificationEvent
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: notif.iconName)
                    .font(.title3)
                    .foregroundStyle(Color(hex: notif.colorHex))
                    .frame(width: 36, height: 36)
                    .background(Color(hex: notif.colorHex).opacity(0.15))
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(notif.title)
                            .font(.subheadline)
                            .fontWeight(notif.isUnread ? .bold : .regular)
                            .foregroundStyle(.primary)
                        if notif.isUnread {
                            Circle()
                                .fill(Color(hex: notif.colorHex))
                                .frame(width: 7, height: 7)
                        }
                    }
                    Text(notif.body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                    Text(formatRelative(notif.createdAt))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(notif.title). \(notif.body). \(notif.isUnread ? "Ulest" : "Lest")")
    }
}

// MARK: - Hjelpere

private func formatRelative(_ iso: String) -> String {
    guard let date = ISO8601DateFormatter().date(from: iso) else { return iso }
    let diff = Date().timeIntervalSince(date)
    let mins = Int(diff / 60)
    if mins < 1 { return "akkurat nå" }
    if mins < 60 { return "\(mins) min siden" }
    let hrs = mins / 60
    if hrs < 24 { return "\(hrs) t siden" }
    return "\(hrs / 24) d siden"
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
