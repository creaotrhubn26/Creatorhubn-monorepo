// OfflineQueueBadge.swift
//
// Global status for den tenant-avgrensede offline-køen. Komponenten er
// bevisst skjult når appen er online og køen er tom, men dukker opp i den
// delte Leadgrid-headeren ved offline, ventende handlinger eller feil.

import SwiftUI

struct LeadgridSyncStatusButton: View {
    @Environment(NetworkMonitor.self) private var monitor
    @Environment(AppState.self) private var appState

    @State private var pendingCount = 0
    @State private var failedCount = 0
    @State private var showSyncCenter = false

    private var refreshKey: String {
        "\(appState.activeOrganizationId ?? "none")|\(appState.activeProjectId ?? "none")|\(appState.currentUserId ?? "none")|\(monitor.isOnline)"
    }

    private var shouldShow: Bool {
        appState.activeOrganizationId != nil
            && (pendingCount > 0 || failedCount > 0 || !monitor.isOnline)
    }

    private var totalCount: Int { pendingCount + failedCount }

    var body: some View {
        Group {
            if shouldShow {
                Button {
                    showSyncCenter = true
                } label: {
                    ZStack(alignment: .topTrailing) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(red: 0.10, green: 0.09, blue: 0.16))
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.06), lineWidth: 1)
                            Image(systemName: statusIcon)
                                .font(.appScaled(size: 14, weight: .semibold))
                                .foregroundStyle(statusColor)
                        }
                        .frame(width: 44, height: 44)

                        if totalCount > 0 {
                            Text("\(min(totalCount, 99))")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(statusColor, in: Capsule())
                                .overlay(
                                    Capsule().stroke(
                                        Color(red: 0.05, green: 0.04, blue: 0.10),
                                        lineWidth: 1.5
                                    )
                                )
                                .offset(x: 6, y: -6)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("global-sync-status")
                .accessibilityLabel(accessibilityLabel)
                .macCatalystHover()
            }
        }
        .task(id: refreshKey) {
            await refreshCounts()
            while !Task.isCancelled {
                do {
                    try await Task.sleep(nanoseconds: 3_000_000_000)
                } catch {
                    break
                }
                await refreshCounts()
            }
        }
        .sheet(isPresented: $showSyncCenter, onDismiss: {
            Task { await refreshCounts() }
        }) {
            if let organizationId = appState.activeOrganizationId,
               let projectId = appState.activeProjectId,
               let actorUserId = appState.currentUserId {
                OfflineQueueRecoverySheet(
                    organizationId: organizationId,
                    projectId: projectId,
                    actorUserId: actorUserId,
                    api: appState.api,
                    lastSyncAt: appState.lastSyncAt
                )
            }
        }
    }

    private var statusIcon: String {
        if failedCount > 0 { return "exclamationmark.triangle.fill" }
        if !monitor.isOnline { return "wifi.slash" }
        return "arrow.triangle.2.circlepath"
    }

    private var statusColor: Color {
        if failedCount > 0 { return .red }
        if !monitor.isOnline { return .orange }
        return .blue
    }

    private var accessibilityLabel: String {
        if failedCount > 0 {
            return "Synkronisering, \(failedCount) handlinger krever oppfølging"
        }
        if !monitor.isOnline {
            return pendingCount > 0
                ? "Frakoblet, \(pendingCount) handlinger lagret lokalt"
                : "Frakoblet"
        }
        return "Synkronisering, \(pendingCount) ventende handlinger"
    }

    @MainActor
    private func refreshCounts() async {
        guard let organizationId = appState.activeOrganizationId,
              let projectId = appState.activeProjectId,
              let actorUserId = appState.currentUserId else {
            pendingCount = 0
            failedCount = 0
            return
        }
        pendingCount = await OfflineActionQueue.shared.pendingCount(
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        )
        failedCount = await OfflineActionQueue.shared.failedCount(
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        )
    }
}

struct OfflineQueueRecoverySheet: View {
    let organizationId: String
    let projectId: String
    let actorUserId: String
    let api: APIClient?
    let lastSyncAt: Date?

    @Environment(\.dismiss) private var dismiss
    @Environment(NetworkMonitor.self) private var monitor

    @State private var actions: [OfflineActionQueue.PendingAction] = []
    @State private var pendingDiscard: OfflineActionQueue.PendingAction?
    @State private var isSyncing = false

    private var pendingActions: [OfflineActionQueue.PendingAction] {
        actions.filter { $0.permanentlyFailedAt == nil }
    }

    private var failedActions: [OfflineActionQueue.PendingAction] {
        actions.filter { $0.permanentlyFailedAt != nil }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Status") {
                    Label(
                        monitor.isOnline ? "Tilkoblet" : "Frakoblet",
                        systemImage: monitor.isOnline ? "wifi" : "wifi.slash"
                    )
                    .foregroundStyle(monitor.isOnline ? .green : .orange)

                    if let lastSyncAt {
                        LabeledContent(
                            "Siste datasynk",
                            value: lastSyncAt.formatted(date: .abbreviated, time: .shortened)
                        )
                    }

                    LabeledContent("Venter", value: "\(pendingActions.count)")
                    LabeledContent("Krever oppfølging", value: "\(failedActions.count)")
                }

                if actions.isEmpty {
                    ContentUnavailableView(
                        "Alt er synkronisert",
                        systemImage: "checkmark.icloud.fill",
                        description: Text(
                            monitor.isOnline
                                ? "Ingen lokale handlinger venter på opplasting."
                                : "Ingen handlinger venter. Nye endringer lagres lokalt til nettet er tilbake."
                        )
                    )
                    .listRowBackground(Color.clear)
                }

                if !pendingActions.isEmpty {
                    Section {
                        ForEach(pendingActions) { action in
                            actionRow(action, isFailed: false)
                        }
                    } header: {
                        Text("Venter på synkronisering")
                    } footer: {
                        Text(
                            monitor.isOnline
                                ? "Handlingene sendes automatisk og idempotent."
                                : "Handlingene er lagret på enheten og sendes når forbindelsen er tilbake."
                        )
                    }
                }

                if !failedActions.isEmpty {
                    Section {
                        ForEach(failedActions) { action in
                            actionRow(action, isFailed: true)
                        }
                    } header: {
                        Text("Krever oppfølging")
                    } footer: {
                        Text("Payloaden beholdes lokalt til du prøver igjen eller fjerner handlingen.")
                    }
                }
            }
            .navigationTitle("Synksenter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if !pendingActions.isEmpty {
                        Button {
                            Task { await syncAll() }
                        } label: {
                            if isSyncing {
                                ProgressView()
                            } else {
                                Label("Synkroniser nå", systemImage: "arrow.triangle.2.circlepath")
                            }
                        }
                        .disabled(!monitor.isOnline || api == nil || isSyncing)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ferdig") { dismiss() }
                }
            }
            .task(id: "\(organizationId)|\(projectId)") { await reload() }
            .onChange(of: monitor.isOnline) { _, isOnline in
                if isOnline, !pendingActions.isEmpty {
                    Task { await syncAll() }
                }
            }
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
            } message: {
                Text("Den lokale handlingen slettes og kan ikke gjenopprettes.")
            }
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func actionRow(
        _ action: OfflineActionQueue.PendingAction,
        isFailed: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(
                    actionTitle(action),
                    systemImage: isFailed
                        ? "exclamationmark.triangle.fill"
                        : (monitor.isOnline ? "arrow.up.circle.fill" : "internaldrive.fill")
                )
                .font(.headline)
                .foregroundStyle(isFailed ? .red : (monitor.isOnline ? .blue : .orange))
                Spacer()
                Text(action.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text("Kø-ID \(action.id.uuidString)")
                .font(.caption2.monospaced())
                .foregroundStyle(.secondary)
                .textSelection(.enabled)

            if action.organizationId == nil {
                Text("Eldre køelement mangler workspace og kan ikke sendes trygt.")
                    .font(.caption)
                    .foregroundStyle(.orange)
            } else if isFailed {
                Text("Mislyktes etter \(action.attemptCount) forsøk.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text(
                    monitor.isOnline
                        ? "Klar for opplasting."
                        : "Trygt lagret lokalt til nettet er tilbake."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if let lastError = action.lastError, !lastError.isEmpty {
                Text(lastError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if isFailed {
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
        }
        .padding(.vertical, 4)
    }

    @MainActor
    private func syncAll() async {
        guard monitor.isOnline, let api else {
            await reload()
            return
        }
        isSyncing = true
        _ = await OfflineActionQueue.shared.drain(
            api: api,
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        )
        await reload()
        isSyncing = false
    }

    @MainActor
    private func retry(_ action: OfflineActionQueue.PendingAction) async {
        let reset = await OfflineActionQueue.shared.retry(
            id: action.id,
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        )
        if reset {
            await syncAll()
        } else {
            await reload()
        }
    }

    @MainActor
    private func overrideDuplicate(_ action: OfflineActionQueue.PendingAction) async {
        let reset = await OfflineActionQueue.shared.retryLeadCreationAllowingDuplicate(
            id: action.id,
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        )
        if reset {
            await syncAll()
        } else {
            await reload()
        }
    }

    @MainActor
    private func reload() async {
        actions = await OfflineActionQueue.shared.actions(
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
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
