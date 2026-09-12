import SwiftUI
import UIKit

struct StoryboardReviewAnnotationPointDTO: Decodable, Sendable {
    let x: Double
    let y: Double
}

struct StoryboardReviewAnnotationDTO: Decodable, Identifiable, Sendable {
    let id: String
    let tool: String
    let color: String
    let strokeWidth: Double
    let points: [StoryboardReviewAnnotationPointDTO]
}

struct StoryboardReviewSnapshotFrameDTO: Decodable, Identifiable, Sendable {
    let id: String
    let shotNumber: String?
    let description: String?
    let imageUrl: String?
    let thumbnailUrl: String?
}

struct StoryboardReviewSnapshotSceneDTO: Decodable, Identifiable, Sendable {
    let id: String
    let heading: String
    let storyboardFrames: [StoryboardReviewSnapshotFrameDTO]
}

struct StoryboardReviewSnapshotDTO: Decodable, Sendable {
    let scenes: [StoryboardReviewSnapshotSceneDTO]
}

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
    var snapshot: StoryboardReviewSnapshotDTO? = nil
    var comments: [StoryboardReviewCommentDTO]? = nil
    var carriedCommentCount: Int? = nil
}

struct StoryboardReviewCommentDTO: Decodable, Identifiable, Sendable {
    let id: String
    let reviewRoundId: String
    let frameId: String?
    let authorDisplayName: String
    let body: String
    var anchorX: Double? = nil
    var anchorY: Double? = nil
    var annotations: [StoryboardReviewAnnotationDTO]? = nil
    let status: String
    let assignedTo: String?
    let dueAt: String?
    let resolutionNote: String?
    let resolvedBy: String?
    let resolvedAt: String?
    let resolvedInRoundId: String?
    let carriedFromCommentId: String?
    let createdAt: String
    let updatedAt: String?
}

enum StoryboardReviewFieldUpdate: Sendable {
    case unchanged
    case value(String?)
}

struct StoryboardReviewCommentChanges: Sendable {
    var status: String?
    var assignedTo: StoryboardReviewFieldUpdate = .unchanged
    var dueAt: StoryboardReviewFieldUpdate = .unchanged
    var resolutionNote: StoryboardReviewFieldUpdate = .unchanged
    var resolvedInRoundId: StoryboardReviewFieldUpdate = .unchanged
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
    @State private var selectedDetail: StoryboardReviewRoundDTO?
    @State private var comments: [StoryboardReviewCommentDTO] = []
    @State private var showOpenCommentsOnly = true
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
    private var visibleComments: [StoryboardReviewCommentDTO] {
        comments
            .filter { !showOpenCommentsOnly || $0.status == "open" }
            .sorted {
                if $0.status != $1.status { return $0.status == "open" }
                return ($0.dueAt ?? "9999") < ($1.dueAt ?? "9999")
            }
    }

    private func frame(for comment: StoryboardReviewCommentDTO) -> StoryboardReviewSnapshotFrameDTO? {
        guard let frameID = comment.frameId else { return nil }
        return selectedDetail?.snapshot?.scenes
            .lazy
            .flatMap(\.storyboardFrames)
            .first { $0.id == frameID }
    }

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

                        GroupBox {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Løsningskø").font(.headline)
                                        Text("\(comments.filter { $0.status == "open" }.count) åpne av \(comments.count) punkt")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Button(showOpenCommentsOnly ? "Vis alle" : "Bare åpne") {
                                        showOpenCommentsOnly.toggle()
                                    }
                                    .buttonStyle(.bordered)
                                    .accessibilityIdentifier("storyboard.review.comments.filter")
                                }
                                if visibleComments.isEmpty {
                                    ContentUnavailableView(
                                        comments.isEmpty ? "Ingen kommentarer" : "Alle punkt er løst",
                                        systemImage: comments.isEmpty ? "text.bubble" : "checkmark.circle",
                                        description: Text(comments.isEmpty
                                            ? "Kommentarer fra review-lenken vises her."
                                            : "Vis alle for å se løste punkt."))
                                } else {
                                    ForEach(visibleComments) { comment in
                                        StoryboardReviewResolutionRow(
                                            comment: comment, frame: frame(for: comment),
                                            rounds: rounds, busy: busy,
                                            onUpdate: { changes in updateComment(comment, changes: changes) })
                                        .id(comment.updatedAt ?? comment.id)
                                    }
                                }
                            }
                        }
                        .accessibilityIdentifier("storyboard.review.resolutionQueue")

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
                    createdAt: "2026-09-12T12:00:00Z",
                    snapshot: StoryboardReviewSnapshotDTO(scenes: [
                        StoryboardReviewSnapshotSceneDTO(
                            id: "scene-demo", heading: "INT. TOG — NATT",
                            storyboardFrames: [StoryboardReviewSnapshotFrameDTO(
                                id: "frame-3", shotNumber: "3A",
                                description: "Trollet utenfor togvinduet",
                                imageUrl: nil, thumbnailUrl: nil)])
                    ]))
                rounds = [demo]
                selectedDetail = demo
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
                comments = [
                    StoryboardReviewCommentDTO(
                        id: "comment-demo", reviewRoundId: demo.id, frameId: "frame-3",
                        authorDisplayName: "Kari", body: "Hold totalbildet litt lenger.",
                        anchorX: 0.72, anchorY: 0.38,
                        annotations: [StoryboardReviewAnnotationDTO(
                            id: "mark-demo", tool: "arrow", color: "#fbbf24", strokeWidth: 3,
                            points: [
                                StoryboardReviewAnnotationPointDTO(x: 0.24, y: 0.68),
                                StoryboardReviewAnnotationPointDTO(x: 0.72, y: 0.38)
                            ])],
                        status: "open", assignedTo: "Mina", dueAt: nil, resolutionNote: nil,
                        resolvedBy: nil, resolvedAt: nil, resolvedInRoundId: nil,
                        carriedFromCommentId: nil, createdAt: "2026-09-12T12:03:00Z",
                        updatedAt: "2026-09-12T12:03:00Z")
                ]
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
            guard let selectedID else { diff = nil; selectedDetail = nil; comments = []; return }
            async let nextDiff = RoleRoomAPIClient.shared.fetchStoryboardReviewDiff(
                projectId: projectId, manuscriptId: manuscriptId, roundId: selectedID)
            async let nextDetail = RoleRoomAPIClient.shared.fetchStoryboardReviewRound(
                projectId: projectId, manuscriptId: manuscriptId, roundId: selectedID)
            do {
                let loaded = try await (nextDiff, nextDetail)
                diff = loaded.0
                selectedDetail = loaded.1
                comments = loaded.1.comments ?? []
            } catch {
                errorMessage = error.localizedDescription
            }
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
        case "storyboard_review_comment_resolved": return "checkmark.circle.fill"
        case "storyboard_review_comment_reopened": return "arrow.uturn.backward.circle.fill"
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
            if let selectedID {
                let detail = try await RoleRoomAPIClient.shared.fetchStoryboardReviewRound(
                    projectId: projectId, manuscriptId: manuscriptId, roundId: selectedID)
                selectedDetail = detail
                comments = detail.comments ?? []
            } else {
                selectedDetail = nil
                comments = []
            }
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
                let carried = created.carriedCommentCount ?? 0
                successMessage = "Revisjon v\(created.version) er låst til \(String(created.snapshotHash.prefix(10)))…"
                    + (carried > 0 ? " \(carried) åpne punkt ble videreført." : "")
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

    private func updateComment(_ comment: StoryboardReviewCommentDTO, changes: StoryboardReviewCommentChanges) {
        busy = true; errorMessage = nil; successMessage = nil
        Task {
            do {
                let updated = try await RoleRoomAPIClient.shared.updateStoryboardReviewComment(
                    projectId: projectId, manuscriptId: manuscriptId,
                    roundId: comment.reviewRoundId, commentId: comment.id, changes: changes)
                if let index = comments.firstIndex(where: { $0.id == updated.id }) {
                    comments[index] = updated
                }
                successMessage = updated.status == "resolved"
                    ? "Review-punktet er markert som løst."
                    : "Review-punktet er oppdatert."
                await reload(prefer: selectedID)
            } catch {
                errorMessage = error.localizedDescription
            }
            busy = false
        }
    }
}

private struct StoryboardReviewResolutionRow: View {
    let comment: StoryboardReviewCommentDTO
    let frame: StoryboardReviewSnapshotFrameDTO?
    let rounds: [StoryboardReviewRoundDTO]
    let busy: Bool
    let onUpdate: (StoryboardReviewCommentChanges) -> Void

    @State private var assignedTo: String
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var resolutionNote: String
    @State private var resolvedInRoundId: String

    init(
        comment: StoryboardReviewCommentDTO,
        frame: StoryboardReviewSnapshotFrameDTO?,
        rounds: [StoryboardReviewRoundDTO],
        busy: Bool,
        onUpdate: @escaping (StoryboardReviewCommentChanges) -> Void
    ) {
        self.comment = comment
        self.frame = frame
        self.rounds = rounds
        self.busy = busy
        self.onUpdate = onUpdate
        _assignedTo = State(initialValue: comment.assignedTo ?? "")
        _hasDueDate = State(initialValue: comment.dueAt != nil)
        _dueDate = State(initialValue: comment.dueAt.flatMap(Self.parseDate) ?? Date())
        _resolutionNote = State(initialValue: comment.resolutionNote ?? "")
        _resolvedInRoundId = State(initialValue: comment.resolvedInRoundId ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label(comment.status == "open" ? "Åpent" : "Løst",
                      systemImage: comment.status == "open" ? "circle.dashed" : "checkmark.circle.fill")
                    .font(.caption.bold())
                    .foregroundStyle(comment.status == "open" ? .orange : .green)
                if let frameId = comment.frameId {
                    Text("Shot \(frameId)").font(.caption.monospaced()).foregroundStyle(.secondary)
                }
                if comment.carriedFromCommentId != nil {
                    Text("VIDEREFØRT").font(.caption2.bold()).foregroundStyle(BoardBrand.accent)
                }
                Spacer()
                Text(comment.authorDisplayName).font(.caption).foregroundStyle(.secondary)
            }
            Text(comment.body).font(.subheadline)
            if let frame,
               comment.anchorX != nil || comment.anchorY != nil || !(comment.annotations ?? []).isEmpty {
                StoryboardReviewAnnotationPreview(frame: frame, comment: comment)
                    .frame(maxWidth: 420)
            }
            Divider()
            TextField("Ansvarlig", text: $assignedTo)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("storyboard.review.comment.assignee.\(comment.id)")
            Toggle("Sett frist", isOn: $hasDueDate)
            if hasDueDate {
                DatePicker("Frist", selection: $dueDate, displayedComponents: [.date, .hourAndMinute])
                    .accessibilityIdentifier("storyboard.review.comment.due.\(comment.id)")
            }
            Button("Lagre ansvar og frist") {
                let assignee = assignedTo.trimmingCharacters(in: .whitespacesAndNewlines)
                onUpdate(StoryboardReviewCommentChanges(
                    status: nil,
                    assignedTo: .value(assignee.isEmpty ? nil : assignee),
                    dueAt: .value(hasDueDate ? ISO8601DateFormatter().string(from: dueDate) : nil)))
            }
            .buttonStyle(.bordered)
            .disabled(busy)
            .accessibilityIdentifier("storyboard.review.comment.save.\(comment.id)")

            if comment.status == "open" {
                TextField("Løsningsnotat", text: $resolutionNote, axis: .vertical)
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)
                Picker("Rettet i revisjon", selection: $resolvedInRoundId) {
                    Text("Ikke angitt").tag("")
                    ForEach(rounds) { round in
                        Text("v\(round.version) · \(round.label)").tag(round.id)
                    }
                }
                Button {
                    let note = resolutionNote.trimmingCharacters(in: .whitespacesAndNewlines)
                    onUpdate(StoryboardReviewCommentChanges(
                        status: "resolved",
                        resolutionNote: .value(note.isEmpty ? nil : note),
                        resolvedInRoundId: .value(resolvedInRoundId.isEmpty ? nil : resolvedInRoundId)))
                } label: {
                    Label("Marker løst", systemImage: "checkmark.circle.fill")
                }
                .buttonStyle(.borderedProminent).tint(.green)
                .disabled(busy)
                .accessibilityIdentifier("storyboard.review.comment.resolve.\(comment.id)")
            } else {
                if let note = comment.resolutionNote, !note.isEmpty {
                    Text("Løsning: \(note)").font(.caption).foregroundStyle(.green)
                }
                Button {
                    onUpdate(StoryboardReviewCommentChanges(status: "open"))
                } label: {
                    Label("Gjenåpne", systemImage: "arrow.uturn.backward.circle")
                }
                .buttonStyle(.bordered).tint(.orange)
                .disabled(busy)
                .accessibilityIdentifier("storyboard.review.comment.reopen.\(comment.id)")
            }
        }
        .padding(12)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    private static func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: value)
    }
}

private struct StoryboardReviewAnnotationPreview: View {
    let frame: StoryboardReviewSnapshotFrameDTO
    let comment: StoryboardReviewCommentDTO
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Rectangle().fill(Color.black.opacity(0.72))
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "photo.on.rectangle.angled")
                    Text(frame.shotNumber ?? "Visuell markering")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
            Canvas { context, size in
                for annotation in comment.annotations ?? [] {
                    draw(annotation, in: &context, size: size)
                }
            }
            if let anchorX = comment.anchorX, let anchorY = comment.anchorY {
                GeometryReader { proxy in
                    ZStack {
                        Circle().fill(comment.status == "resolved" ? Color.green : Color.yellow)
                        Circle().stroke(Color.black.opacity(0.85), lineWidth: 2)
                        Image(systemName: "pin.fill")
                            .font(.caption2.bold())
                            .foregroundStyle(.black)
                    }
                    .frame(width: 30, height: 30)
                    .position(
                        x: min(max(anchorX, 0), 1) * proxy.size.width,
                        y: min(max(anchorY, 0), 1) * proxy.size.height)
                }
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white.opacity(0.16)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Visuell markering for \(frame.shotNumber ?? "shot")")
        .accessibilityIdentifier("storyboard.review.comment.markup.\(comment.id)")
        .task(id: imagePath) { await loadImage() }
    }

    private var imagePath: String? { frame.thumbnailUrl ?? frame.imageUrl }

    private func draw(
        _ annotation: StoryboardReviewAnnotationDTO,
        in context: inout GraphicsContext,
        size: CGSize
    ) {
        let points = annotation.points.map {
            CGPoint(x: min(max($0.x, 0), 1) * size.width,
                    y: min(max($0.y, 0), 1) * size.height)
        }
        guard let first = points.first else { return }
        var path = Path()
        let strokeColor = Color(hex: annotation.color) ?? .yellow
        let strokeStyle = StrokeStyle(
            lineWidth: max(1, min(annotation.strokeWidth, 8)),
            lineCap: .round,
            lineJoin: .round)

        switch annotation.tool {
        case "freehand":
            path.move(to: first)
            for point in points.dropFirst() { path.addLine(to: point) }
        case "rectangle":
            guard let last = points.last else { return }
            path.addRect(CGRect(
                x: min(first.x, last.x), y: min(first.y, last.y),
                width: abs(last.x - first.x), height: abs(last.y - first.y)))
        case "arrow":
            guard let last = points.last else { return }
            path.move(to: first)
            path.addLine(to: last)
            let angle = atan2(last.y - first.y, last.x - first.x)
            let head: CGFloat = 18
            let left = CGPoint(
                x: last.x - cos(angle - .pi / 6) * head,
                y: last.y - sin(angle - .pi / 6) * head)
            let right = CGPoint(
                x: last.x - cos(angle + .pi / 6) * head,
                y: last.y - sin(angle + .pi / 6) * head)
            path.move(to: left)
            path.addLine(to: last)
            path.addLine(to: right)
        default:
            return
        }
        context.stroke(path, with: .color(strokeColor), style: strokeStyle)
    }

    @MainActor
    private func loadImage() async {
        guard let imagePath else { image = nil; return }
        if let cached = FrameImageCache.image(for: imagePath) {
            image = cached
            return
        }
        let data: Data?
        if let remoteURL = URL(string: imagePath), remoteURL.scheme == "https" {
            if let (downloaded, response) = try? await URLSession.shared.data(from: remoteURL),
               (response as? HTTPURLResponse)?.statusCode == 200 {
                data = downloaded
            } else {
                data = nil
            }
        } else {
            data = await RoleRoomAPIClient.shared.fetchRemoteImageData(path: imagePath)
        }
        guard let data, let downloaded = UIImage(data: data) else { return }
        FrameImageCache.images[imagePath] = downloaded
        image = downloaded
    }
}
