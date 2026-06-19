// LeadgridNotificationBellView.swift
//
// Bell-ikon m/ unread-counter + dropdown med siste 10 varsler.
// Brukes i top-nav på MapScreen.

import SwiftUI

struct LeadgridNotificationBellView: View {
    @Environment(AppState.self) private var appState
    @State private var showInbox = false

    var body: some View {
        Button {
            showInbox = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: appState.leadgridUnreadCount > 0
                       ? "bell.badge.fill" : "bell")
                    .foregroundStyle(appState.leadgridUnreadCount > 0 ? .red : .primary)
                if appState.leadgridUnreadCount > 0 {
                    Text("\(min(appState.leadgridUnreadCount, 99))")
                        .font(.caption2.bold())
                        .padding(3)
                        .background(Color.red)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                        .offset(x: 8, y: -8)
                }
            }
        }
        .sheet(isPresented: $showInbox) {
            LeadgridNotificationInboxView()
                .presentationDetents([.medium, .large])
        }
    }
}

struct LeadgridNotificationInboxView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var showPrefs = false

    var body: some View {
        NavigationStack {
            Group {
                if appState.leadgridNotifications.isEmpty {
                    ContentUnavailableView(
                        "Ingen varsler ennå",
                        systemImage: "bell.slash",
                        description: Text("Du får varsler her når en lead tildeles, status endres, eller noe vinnes/tapes."),
                    )
                } else {
                    List(appState.leadgridNotifications) { notif in
                        notifRow(notif)
                            .onTapGesture {
                                Task { await markRead(notif) }
                            }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Varsler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task { await appState.markLeadgridNotificationsRead() }
                        } label: {
                            Label("Marker alle som lest", systemImage: "checkmark.circle")
                        }
                        Button { showPrefs = true } label: {
                            Label("Varsels-innstillinger", systemImage: "gearshape")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .refreshable {
                await appState.refreshLeadgridNotifications()
            }
            .sheet(isPresented: $showPrefs) {
                if let api = appState.api {
                    LeadgridNotificationPrefsView(api: api)
                }
            }
            .task {
                await appState.refreshLeadgridNotifications()
            }
        }
    }

    @ViewBuilder
    private func notifRow(_ notif: LeadgridNotification) -> some View {
        HStack(spacing: 12) {
            tierIcon(notif.tier)
                .font(.title2)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 4) {
                Text(notif.title)
                    .font(notif.isUnread ? .body.bold() : .body)
                    .lineLimit(2)
                if let body = notif.body, !body.isEmpty {
                    Text(body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    Text(notif.timeAgo).font(.caption2).foregroundStyle(.secondary)
                    if !notif.byName.isEmpty {
                        Text("· av \(notif.byName)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            if notif.isUnread {
                Circle().fill(Color.purple)
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.vertical, 4)
        .listRowBackground(notif.isUnread ? Color.purple.opacity(0.06) : Color.clear)
    }

    @ViewBuilder
    private func tierIcon(_ tier: String?) -> some View {
        switch tier {
        case "hot":  Image(systemName: "flame.fill").foregroundStyle(.red)
        case "warm": Image(systemName: "thermometer.sun.fill").foregroundStyle(.orange)
        case "cool": Image(systemName: "snowflake").foregroundStyle(.blue)
        default:     Image(systemName: "bell").foregroundStyle(.secondary)
        }
    }

    private func markRead(_ notif: LeadgridNotification) async {
        if notif.isUnread {
            await appState.markLeadgridNotificationsRead(ids: [notif.id])
        }
    }
}
