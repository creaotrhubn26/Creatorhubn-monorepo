// OfflineQueueBadge.swift
//
// Robusthet-pakke 3 — viser et lite banner i Leadgrid-hub når selgeren
// enten er offline eller har pending actions i køen. Skrur seg ned når
// vi er online og køen er tom.

import SwiftUI

struct OfflineQueueBadge: View {
    @Environment(NetworkMonitor.self) private var monitor
    @State private var pendingCount: Int = 0
    @State private var refreshTimer: Timer?

    var body: some View {
        Group {
            if shouldShow {
                HStack(spacing: 10) {
                    Image(systemName: monitor.isOnline ? "arrow.up.circle.fill" : "wifi.slash")
                        .foregroundStyle(monitor.isOnline ? .blue : .orange)
                        .imageScale(.large)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(monitor.isOnline ? "Synker køen…" : "Frakoblet — handlinger lagres lokalt")
                            .font(.caption.bold())
                        if pendingCount > 0 {
                            Text("\(pendingCount) ventende handling(er)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }
        }
        .task {
            pendingCount = await OfflineActionQueue.shared.pendingCount()
        }
        .onAppear {
            // Re-poll hvert 3. sekund mens visningen er på skjermen
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
                Task { @MainActor in
                    let count = await OfflineActionQueue.shared.pendingCount()
                    pendingCount = count
                }
            }
        }
        .onDisappear {
            refreshTimer?.invalidate()
            refreshTimer = nil
        }
    }

    private var shouldShow: Bool {
        pendingCount > 0 || !monitor.isOnline
    }
}
