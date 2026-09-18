// OfflineQueueBadge.swift
//
// Robusthet-pakke 3 — viser et lite banner i Leadgrid-hub når selgeren
// enten er offline eller har pending actions i køen. Skrur seg ned når
// vi er online og køen er tom.

import SwiftUI

struct OfflineQueueBadge: View {
    @Environment(NetworkMonitor.self) private var monitor
    @Environment(AppState.self) private var appState
    @State private var pendingCount: Int = 0
    @State private var failedCount: Int = 0
    @State private var refreshTimer: Timer?
    @State private var showRecovery = false

    var body: some View {
        Group {
            if shouldShow {
                HStack(spacing: 10) {
                    Image(systemName: statusIcon)
                        .foregroundStyle(statusColor)
                        .imageScale(.large)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(statusTitle)
                            .font(.caption.bold())
                        if pendingCount > 0 {
                            Text("\(pendingCount) ventende handling(er)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .accessibilityIdentifier("offline-queue-pending-count")
                        }
                    }
                    Spacer()
                    if failedCount > 0 {
                        Button("Se og rett") { showRecovery = true }
                            .font(.caption.bold())
                            .buttonStyle(.bordered)
                    }
                }
                .padding(.vertical, 4)
                .accessibilityIdentifier("offline-queue-status")
            }
        }
        .task {
            await refreshCounts()
        }
        .onAppear {
            // Re-poll hvert 3. sekund mens visningen er på skjermen
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
                Task { @MainActor in
                    await refreshCounts()
                }
            }
        }
        .onDisappear {
            refreshTimer?.invalidate()
            refreshTimer = nil
        }
        .sheet(isPresented: $showRecovery, onDismiss: {
            Task { await refreshCounts() }
        }) {
            if let organizationId = appState.activeOrganizationId {
                OfflineQueueRecoverySheet(
                    organizationId: organizationId,
                    api: appState.api
                )
            }
        }
    }

    private var shouldShow: Bool {
        pendingCount > 0 || failedCount > 0 || !monitor.isOnline
    }

    private var statusTitle: String {
        if failedCount > 0 { return "\(failedCount) handling(er) krever oppfølging" }
        return monitor.isOnline
            ? "Synker ventende handlinger"
            : "Frakoblet — handlinger lagres lokalt"
    }

    private var statusIcon: String {
        if failedCount > 0 { return "exclamationmark.triangle.fill" }
        return monitor.isOnline ? "arrow.up.circle.fill" : "wifi.slash"
    }

    private var statusColor: Color {
        if failedCount > 0 { return .red }
        return monitor.isOnline ? .blue : .orange
    }

    @MainActor
    private func refreshCounts() async {
        guard let organizationId = appState.activeOrganizationId else {
            pendingCount = 0
            failedCount = 0
            return
        }
        pendingCount = await OfflineActionQueue.shared.pendingCount(
            organizationId: organizationId
        )
        failedCount = await OfflineActionQueue.shared.failedCount(
            organizationId: organizationId
        )
    }
}

private struct OfflineQueueRecoverySheet: View {
    let organizationId: String
    let api: APIClient?

    @Environment(\.dismiss) private var dismiss
    @Environment(NetworkMonitor.self) private var monitor
    @State private var actions: [OfflineActionQueue.PendingAction] = []
    @State private var pendingDiscard: OfflineActionQueue.PendingAction?

    var body: some View {
        NavigationStack {
            List {
                if actions.isEmpty {
                    ContentUnavailableView(
                        "Ingen fastlåste handlinger",
                        systemImage: "checkmark.circle",
                        description: Text("Køen har ingen handlinger som krever manuell oppfølging.")
                    )
                } else {
                    Section {
                        ForEach(actions) { action in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(actionTitle(action))
                                    .font(.headline)
                                Text("Kø-ID \(action.id.uuidString)")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                                Text(action.organizationId == nil
                                     ? "Eldre køelement mangler organisasjonskontekst og kan ikke sendes trygt."
                                     : "Mislyktes etter \(action.attemptCount) forsøk. Payloaden er fortsatt lagret på enheten.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let lastError = action.lastError, !lastError.isEmpty {
                                    Text(lastError)
                                        .font(.caption)
                                        .foregroundStyle(.red)
                                }
                                HStack {
                                    if action.failureKind == .duplicateConflict {
                                        Button("Opprett likevel") {
                                            Task { await overrideDuplicate(action) }
                                        }
                                        .buttonStyle(.borderedProminent)
                                        .disabled(action.organizationId == nil)
                                    } else {
                                        Button("Prøv igjen") {
                                            Task { await retry(action) }
                                        }
                                        .buttonStyle(.borderedProminent)
                                        .disabled(action.organizationId == nil)
                                    }

                                    Button("Fjern", role: .destructive) {
                                        pendingDiscard = action
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    } header: {
                        Text("Handlinger som ikke ble slettet")
                    } footer: {
                        Text("Fjern sletter bare den valgte lokale køhandlingen og kan ikke angres.")
                    }
                }
            }
            .navigationTitle("Offline-kø")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ferdig") { dismiss() }
                }
            }
            .task { await reload() }
            .confirmationDialog(
                "Fjerne denne køhandlingen?",
                isPresented: Binding(
                    get: { pendingDiscard != nil },
                    set: { if !$0 { pendingDiscard = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Fjern permanent", role: .destructive) {
                    guard let action = pendingDiscard else { return }
                    pendingDiscard = nil
                    Task {
                        _ = await OfflineActionQueue.shared.discard(id: action.id)
                        await reload()
                    }
                }
                Button("Avbryt", role: .cancel) { pendingDiscard = nil }
            }
        }
    }

    @MainActor
    private func retry(_ action: OfflineActionQueue.PendingAction) async {
        let reset = await OfflineActionQueue.shared.retry(
            id: action.id,
            organizationId: organizationId
        )
        if reset, monitor.isOnline, let api {
            _ = await OfflineActionQueue.shared.drain(
                api: api,
                organizationId: organizationId
            )
        }
        await reload()
    }

    @MainActor
    private func overrideDuplicate(_ action: OfflineActionQueue.PendingAction) async {
        let reset = await OfflineActionQueue.shared.retryLeadCreationAllowingDuplicate(
            id: action.id,
            organizationId: organizationId
        )
        if reset, monitor.isOnline, let api {
            _ = await OfflineActionQueue.shared.drain(
                api: api,
                organizationId: organizationId
            )
        }
        await reload()
    }

    @MainActor
    private func reload() async {
        actions = await OfflineActionQueue.shared.failedActions(
            organizationId: organizationId
        )
    }

    private func actionTitle(_ action: OfflineActionQueue.PendingAction) -> String {
        if action.endpoint == "/api/admin-room/lead-map/leads" {
            return "Opprett lead"
        }
        if action.endpoint.hasSuffix("/visits") { return "Logg kontakt eller besøk" }
        if action.endpoint.hasSuffix("/status") { return "Oppdater lead-status" }
        if action.endpoint.contains("recommendations") { return "Oppdater anbefaling" }
        return "Leadgrid-handling"
    }
}
