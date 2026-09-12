import SwiftUI

struct StoryboardReviewRoundDTO: Decodable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let manuscriptId: String
    let version: Int
    let label: String
    let summary: String?
    let snapshotHash: String
    let scriptFingerprint: String
    let status: String
    let frameCount: Int
    let totalDurationSeconds: Double
    let createdAt: String
}

struct StoryboardReviewDiffDTO: Decodable, Sendable {
    let currentHash: String
    let baselineHash: String
    let scriptChanged: Bool
    let addedFrameIds: [String]
    let removedFrameIds: [String]
    let changedFrameIds: [String]
    let movedFrameIds: [String]
    let impactedScriptLineRanges: [[Int]]

    var changeCount: Int {
        addedFrameIds.count + removedFrameIds.count
            + changedFrameIds.count + movedFrameIds.count
    }
}

struct StoryboardReviewShareDTO: Decodable, Sendable {
    let id: String
    let reviewRoundId: String
    let accessMode: String
    let requireIdentity: Bool
    let expiresAt: String?
    let token: String
}

struct StoryboardReviewInboxItemDTO: Decodable, Identifiable, Sendable {
    let id: String
    let eventType: String
    let title: String
    let message: String?
    let reviewRoundId: String
    let roundVersion: Int
    let frameId: String?
    let actorDisplayName: String?
    let decision: String?
    let createdAt: String
    let read: Bool
    let readAt: String?
}

struct StoryboardReviewInboxDTO: Decodable, Sendable {
    let items: [StoryboardReviewInboxItemDTO]
    let unreadCount: Int
}

struct StoryboardReviewRoundsView: View {
    let projectId: String
    let manuscriptId: String
    let onRestored: () async -> Void

    @State private var rounds: [StoryboardReviewRoundDTO] = []
    @State private var inbox: [StoryboardReviewInboxItemDTO] = []
    @State private var selectedID: String?
    @State private var diff: StoryboardReviewDiffDTO?
    @State private var label = "Storyboard review"
    @State private var summary = ""
    @State private var accessMode = "approve"
    @State private var requireIdentity = true
    @State private var restoreCode = ""
    @State private var shareURL: URL?
    @State private var busy = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @Environment(\.dismiss) private var dismiss

    private var selected: StoryboardReviewRoundDTO? {
        rounds.first { $0.id == selectedID }
    }

    private var unreadCount: Int { inbox.filter { !$0.read }.count }

    var body: some View {
        NavigationSplitView {
            List(selection: $selectedID) {
                Section {
                    if inbox.isEmpty && !busy {
                        Text("Ingen review-hendelser ennå.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(inbox.prefix(20)) { item in
                        Button {
                            openInboxItem(item)
                        } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: item.read ? inboxIcon(item) : "circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(item.read ? .secondary : BoardBrand.accent)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title).font(.subheadline.weight(item.read ? .regular : .bold))
                                    if let message = item.message, !message.isEmpty {
                                        Text(message).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                                    }
                                }
                                Spacer()
                                Text("v\(item.roundVersion)").font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("storyboard.review.inbox.\(item.eventType)")
                    }
                    if unreadCount > 0 {
                        Button("Merk alle som lest") { markAllInboxRead() }
                            .font(.caption.bold())
                            .accessibilityIdentifier("storyboard.review.inbox.readAll")
                    }
                } header: {
                    HStack {
                        Text("Review-innboks")
                        Spacer()
                        if unreadCount > 0 {
                            Text("\(unreadCount) ulest").foregroundStyle(BoardBrand.accent)
                                .accessibilityIdentifier("storyboard.review.inbox.count")
                        }
                    }
                }

                Section("Review-revisjoner") {
                    if rounds.isEmpty && !busy {
                        ContentUnavailableView("Ingen review-runder",
                                               systemImage: "clock.arrow.circlepath",
                                               description: Text("Lås første revisjon fra panelet til høyre."))
                    }
                    ForEach(rounds) { round in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("v\(round.version) · \(round.label)").font(.headline)
                                Spacer()
                                Text(statusLabel(round.status)).font(.caption.bold())
                                    .foregroundStyle(statusColor(round.status))
                            }
                            Text("\(round.frameCount) shots · \(String(round.snapshotHash.prefix(10)))…")
                                .font(.caption.monospaced()).foregroundStyle(.secondary)
                        }
                        .tag(round.id)
                        .accessibilityIdentifier("storyboard.review.round.\(round.version)")
                    }
                }
            }
            .navigationTitle("Review-runder")
            .refreshable { await reload() }
        } detail: {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    GroupBox("Ny låst revisjon") {
                        VStack(spacing: 12) {
                            TextField("Navn", text: $label)
                            TextField("Kort beskjed", text: $summary, axis: .vertical)
                            Button {
                                createRound()
                            } label: {
                                Label("Send til review", systemImage: "paperplane.fill")
                            }
                            .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                            .disabled(busy || label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            .accessibilityIdentifier("storyboard.review.create")
                        }
                    }

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                    if let successMessage {
                        Label(successMessage, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    if busy { ProgressView().tint(BoardBrand.accent) }

                    if let selected {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("v\(selected.version) · \(selected.label)").font(.title2.bold())
                            Text("Låst snapshot \(selected.snapshotHash)")
                                .font(.caption.monospaced()).textSelection(.enabled)
                            Text("\(selected.frameCount) shots · \(selected.totalDurationSeconds, specifier: "%.1f") sek")
                                .foregroundStyle(.secondary)
                        }

                        if let diff {
                            Label(
                                diff.changeCount == 0 && !diff.scriptChanged
                                    ? "Arbeidskopien samsvarer med revisjonen."
                                    : "\(diff.changeCount) storyboardendringer\(diff.scriptChanged ? " · manus endret" : "")",
                                systemImage: diff.changeCount == 0 && !diff.scriptChanged
                                    ? "checkmark.shield" : "exclamationmark.triangle")
                            .foregroundStyle(diff.changeCount == 0 && !diff.scriptChanged ? .green : .orange)
                            .accessibilityIdentifier("storyboard.review.diff")
                        }

                        GroupBox("Sikker gjestelenke") {
                            VStack(alignment: .leading, spacing: 12) {
                                Picker("Tilgang", selection: $accessMode) {
                                    Text("Bare visning").tag("view")
                                    Text("Kommentarer").tag("comment")
                                    Text("Kommentarer og sign-off").tag("approve")
                                }
                                Toggle("Krev navn", isOn: $requireIdentity)
                                Button {
                                    createShare(round: selected)
                                } label: {
                                    Label("Opprett lenke", systemImage: "link.badge.plus")
                                }
                                .buttonStyle(.bordered)
                                .disabled(busy || selected.status == "superseded")
                                .accessibilityIdentifier("storyboard.review.share")
                                if let shareURL {
                                    ShareLink(item: shareURL) {
                                        Label("Del review-lenken", systemImage: "square.and.arrow.up")
                                    }
                                    Text("Tokenet vises bare i denne økten.")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }

                        GroupBox("Sikker gjenoppretting") {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Bare storyboardfelter gjenopprettes. Nyere manus-, casting- og produksjonsdata beholdes.")
                                    .font(.subheadline).foregroundStyle(.secondary)
                                TextField("Skriv \(String(selected.snapshotHash.prefix(8)))", text: $restoreCode)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                Button(role: .destructive) {
                                    restore(round: selected)
                                } label: {
                                    Label("Gjenopprett storyboardfelter", systemImage: "arrow.uturn.backward.circle")
                                }
                                .disabled(busy || diff == nil
                                          || restoreCode.lowercased() != String(selected.snapshotHash.prefix(8)))
                                .accessibilityIdentifier("storyboard.review.restore")
                            }
                        }
                    }
                }
                .padding(24)
                .frame(maxWidth: 760, alignment: .leading)
            }
            .background(BoardBrand.chrome)
            .foregroundStyle(.white)
            .navigationTitle(selected == nil ? "Velg en revisjon" : "Revisjonsdetaljer")
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Board") { dismiss() } }
        }
        .task {
            if ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] == "1" {
                let demo = StoryboardReviewRoundDTO(
                    id: "round-demo", projectId: projectId, manuscriptId: manuscriptId,
                    version: 3, label: "Regissørens sign-off", summary: "Låst presentasjon",
                    snapshotHash: String(repeating: "a", count: 64),
                    scriptFingerprint: String(repeating: "b", count: 64),
                    status: "in_review", frameCount: 24, totalDurationSeconds: 62.5,
                    createdAt: "2026-09-12T12:00:00Z")
                rounds = [demo]
                inbox = [
                    StoryboardReviewInboxItemDTO(
                        id: "notification-comment", eventType: "storyboard_review_comment_added",
                        title: "Kari kommenterte storyboard v3", message: "Hold totalbildet litt lenger.",
                        reviewRoundId: demo.id, roundVersion: 3, frameId: "frame-3",
                        actorDisplayName: "Kari", decision: nil, createdAt: "2026-09-12T12:03:00Z",
                        read: false, readAt: nil),
                    StoryboardReviewInboxItemDTO(
                        id: "notification-round", eventType: "storyboard_review_round_created",
                        title: "Storyboard v3 er sendt til review", message: "Regissørens sign-off",
                        reviewRoundId: demo.id, roundVersion: 3, frameId: nil,
                        actorDisplayName: nil, decision: nil, createdAt: "2026-09-12T12:00:00Z",
                        read: true, readAt: "2026-09-12T12:00:00Z")
                ]
                selectedID = demo.id
                diff = StoryboardReviewDiffDTO(
                    currentHash: String(repeating: "c", count: 64),
                    baselineHash: demo.snapshotHash, scriptChanged: true,
                    addedFrameIds: ["frame-new"], removedFrameIds: [],
                    changedFrameIds: ["frame-3"], movedFrameIds: [],
                    impactedScriptLineRanges: [[10, 12]])
            } else {
                await reload()
            }
        }
        .task(id: selectedID) {
            if ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] == "1" { return }
            guard let selectedID else { diff = nil; return }
            diff = try? await RoleRoomAPIClient.shared.fetchStoryboardReviewDiff(
                projectId: projectId, manuscriptId: manuscriptId, roundId: selectedID)
            shareURL = nil
            restoreCode = ""
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "in_review": return "TIL REVIEW"
        case "changes_requested": return "ENDRINGER"
        case "approved": return "GODKJENT"
        case "superseded": return "ERSTATTET"
        default: return status.uppercased()
        }
    }

    private func statusColor(_ status: String) -> Color {
        status == "approved" ? .green : status == "changes_requested" ? .orange : .secondary
    }

    private func inboxIcon(_ item: StoryboardReviewInboxItemDTO) -> String {
        switch item.eventType {
        case "storyboard_review_approved": return "checkmark.seal.fill"
        case "storyboard_review_changes_requested": return "arrow.triangle.2.circlepath"
        case "storyboard_review_comment_added": return "text.bubble.fill"
        default: return "paperplane.fill"
        }
    }

    @MainActor private func reload(prefer id: String? = nil) async {
        busy = true
        defer { busy = false }
        do {
            async let nextRounds = RoleRoomAPIClient.shared.fetchStoryboardReviewRounds(
                projectId: projectId, manuscriptId: manuscriptId)
            async let nextInbox = RoleRoomAPIClient.shared.fetchStoryboardReviewInbox(
                projectId: projectId, manuscriptId: manuscriptId)
            let loaded = try await (nextRounds, nextInbox)
            rounds = loaded.0
            inbox = loaded.1.items
            selectedID = id ?? selectedID ?? rounds.first?.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor private func openInboxItem(_ item: StoryboardReviewInboxItemDTO) {
        selectedID = item.reviewRoundId
        guard !item.read else { return }
        if let index = inbox.firstIndex(where: { $0.id == item.id }) {
            inbox[index] = StoryboardReviewInboxItemDTO(
                id: item.id, eventType: item.eventType, title: item.title, message: item.message,
                reviewRoundId: item.reviewRoundId, roundVersion: item.roundVersion,
                frameId: item.frameId, actorDisplayName: item.actorDisplayName, decision: item.decision,
                createdAt: item.createdAt, read: true,
                readAt: ISO8601DateFormatter().string(from: Date()))
        }
        Task {
            do {
                try await RoleRoomAPIClient.shared.markStoryboardReviewNotificationRead(
                    projectId: projectId, manuscriptId: manuscriptId, notificationId: item.id)
            } catch {
                errorMessage = error.localizedDescription
                await reload(prefer: item.reviewRoundId)
            }
        }
    }

    private func markAllInboxRead() {
        busy = true; errorMessage = nil
        Task {
            do {
                try await RoleRoomAPIClient.shared.markAllStoryboardReviewNotificationsRead(
                    projectId: projectId, manuscriptId: manuscriptId)
                await reload(prefer: selectedID)
            } catch {
                errorMessage = error.localizedDescription
                busy = false
            }
        }
    }

    private func createRound() {
        busy = true; errorMessage = nil; successMessage = nil; shareURL = nil
        Task {
            do {
                let created = try await RoleRoomAPIClient.shared.createStoryboardReviewRound(
                    projectId: projectId, manuscriptId: manuscriptId,
                    label: label, summary: summary)
                successMessage = "Revisjon v\(created.version) er låst til \(String(created.snapshotHash.prefix(10)))…"
                await reload(prefer: created.id)
            } catch {
                errorMessage = error.localizedDescription; busy = false
            }
        }
    }

    private func createShare(round: StoryboardReviewRoundDTO) {
        busy = true; errorMessage = nil; successMessage = nil
        Task {
            do {
                let result = try await RoleRoomAPIClient.shared.createStoryboardReviewShareLink(
                    projectId: projectId, manuscriptId: manuscriptId, roundId: round.id,
                    accessMode: accessMode, requireIdentity: requireIdentity)
                shareURL = try await RoleRoomAPIClient.shared.storyboardReviewURL(token: result.token)
                successMessage = "Sikker review-lenke opprettet."
            } catch { errorMessage = error.localizedDescription }
            busy = false
        }
    }

    private func restore(round: StoryboardReviewRoundDTO) {
        guard let diff else { return }
        busy = true; errorMessage = nil; successMessage = nil
        Task {
            do {
                try await RoleRoomAPIClient.shared.restoreStoryboardReviewRound(
                    projectId: projectId, manuscriptId: manuscriptId, roundId: round.id,
                    snapshotHash: round.snapshotHash, expectedCurrentHash: diff.currentHash)
                successMessage = "Storyboardfeltene er gjenopprettet uten å endre manusdata."
                restoreCode = ""
                await onRestored()
                self.diff = try await RoleRoomAPIClient.shared.fetchStoryboardReviewDiff(
                    projectId: projectId, manuscriptId: manuscriptId, roundId: round.id)
            } catch { errorMessage = error.localizedDescription }
            busy = false
        }
    }
}
