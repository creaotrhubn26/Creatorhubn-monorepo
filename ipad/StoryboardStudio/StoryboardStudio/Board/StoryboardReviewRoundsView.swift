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
        NavigationStack {
            GeometryReader { proxy in
                if proxy.size.width >= 820 {
                    HStack(spacing: 0) {
                        reviewRail
                            .frame(width: min(320, max(270, proxy.size.width * 0.25)))
                        Rectangle().fill(BoardBrand.border).frame(width: 1)
                        detailSurface
                    }
                } else {
                    VStack(spacing: 0) {
                        compactRoundStrip
                        Rectangle().fill(BoardBrand.border).frame(height: 1)
                        detailSurface
                    }
                }
            }
            .background(BoardBrand.chrome)
            .foregroundStyle(.white)
            .navigationTitle("Review-runder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if busy {
                        HStack(spacing: 7) {
                            ProgressView().controlSize(.small).tint(BoardBrand.accent)
                            Text("Synkroniserer")
                                .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Board") { dismiss() }
                        .foregroundStyle(BoardBrand.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
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

    private var reviewRail: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                inboxSection
                roundsSection
            }
            .padding(14)
        }
        .refreshable { await reload() }
        .background(BoardBrand.panel)
    }

    private var compactRoundStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                if !inbox.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("INNBOKS")
                            .font(.system(size: 8, weight: .bold)).kerning(0.8)
                            .foregroundStyle(BoardBrand.label)
                        if unreadCount > 0 {
                            Text("\(unreadCount) ulest")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(BoardBrand.accent)
                                .accessibilityIdentifier("storyboard.review.inbox.count")
                        }
                    }
                    .frame(width: 70, height: 62, alignment: .leading)
                }
                ForEach(inbox.prefix(20)) { item in compactInboxButton(item) }
                if unreadCount > 0 {
                    Button { markAllInboxRead() } label: {
                        Label("Merk lest", systemImage: "checkmark.circle")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(BoardBrand.accent)
                            .padding(.horizontal, 12).frame(height: 62)
                            .background(Color.white.opacity(0.03),
                                        in: RoundedRectangle(cornerRadius: 9))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("storyboard.review.inbox.readAll")
                }
                if !inbox.isEmpty {
                    Rectangle().fill(BoardBrand.border).frame(width: 1, height: 54)
                }
                ForEach(rounds) { round in roundButton(round, compact: true) }
            }
            .padding(12)
        }
        .frame(height: 104)
        .background(BoardBrand.panel)
    }

    private func compactInboxButton(_ item: StoryboardReviewInboxItemDTO) -> some View {
        Button { openInboxItem(item) } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: item.read ? inboxIcon(item) : "circle.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(item.read ? BoardBrand.label : BoardBrand.accent)
                    .frame(width: 16, height: 16)
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                        .font(.system(size: 11, weight: item.read ? .medium : .bold))
                        .foregroundStyle(item.read ? BoardBrand.dim : .white)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    Text(item.message ?? "Review-oppdatering")
                        .font(.system(size: 9)).foregroundStyle(BoardBrand.label).lineLimit(1)
                }
                Spacer(minLength: 2)
                Text("v\(item.roundVersion)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(BoardBrand.label)
            }
            .padding(9)
            .frame(width: 250, height: 62, alignment: .topLeading)
            .background(Color.white.opacity(item.read ? 0.025 : 0.055),
                        in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("storyboard.review.inbox.\(item.eventType)")
    }

    private var inboxSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                reviewSectionLabel("Review-innboks")
                Spacer()
                if unreadCount > 0 {
                    Text("\(unreadCount) ulest")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(BoardBrand.accent, in: Capsule())
                        .accessibilityIdentifier("storyboard.review.inbox.count")
                }
            }
            if inbox.isEmpty && !busy {
                emptyRailRow("tray", "Ingen review-hendelser ennå")
            }
            ForEach(inbox.prefix(20)) { item in
                Button { openInboxItem(item) } label: {
                    HStack(alignment: .top, spacing: 9) {
                        Image(systemName: item.read ? inboxIcon(item) : "circle.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(item.read ? BoardBrand.label : BoardBrand.accent)
                            .frame(width: 18, height: 18)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title)
                                .font(.system(size: 12, weight: item.read ? .medium : .bold))
                                .foregroundStyle(item.read ? BoardBrand.dim : .white)
                                .multilineTextAlignment(.leading)
                            if let message = item.message, !message.isEmpty {
                                Text(message)
                                    .font(.system(size: 10)).foregroundStyle(BoardBrand.label)
                                    .lineLimit(2).multilineTextAlignment(.leading)
                            }
                        }
                        Spacer(minLength: 4)
                        Text("v\(item.roundVersion)")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(BoardBrand.label)
                    }
                    .padding(9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(item.read ? 0.025 : 0.055),
                                in: RoundedRectangle(cornerRadius: 9))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("storyboard.review.inbox.\(item.eventType)")
            }
            if unreadCount > 0 {
                Button("Merk alle som lest") { markAllInboxRead() }
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(BoardBrand.accent)
                    .buttonStyle(.plain)
                    .padding(.top, 2)
                    .accessibilityIdentifier("storyboard.review.inbox.readAll")
            }
        }
    }

    private var roundsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            reviewSectionLabel("Låste revisjoner")
            if rounds.isEmpty && !busy {
                emptyRailRow("clock.arrow.circlepath", "Lås første revisjon i arbeidsflaten")
            }
            ForEach(rounds) { round in roundButton(round, compact: false) }
        }
    }

    private func roundButton(_ round: StoryboardReviewRoundDTO, compact: Bool) -> some View {
        let isSelected = selectedID == round.id
        return Button { selectedID = round.id } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("v\(round.version) · \(round.label)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(isSelected ? .white : BoardBrand.accent)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(statusLabel(round.status))
                        .font(.system(size: 8, weight: .bold)).kerning(0.4)
                        .foregroundStyle(statusColor(round.status))
                }
                Text("\(round.frameCount) shots · \(String(round.snapshotHash.prefix(8)))…")
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(BoardBrand.label)
            }
            .padding(10)
            .frame(width: compact ? 250 : nil)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? BoardBrand.accent.opacity(0.2) : Color.white.opacity(0.03),
                        in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9)
                .stroke(isSelected ? BoardBrand.accent : BoardBrand.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("v\(round.version) · \(round.label)")
        .accessibilityIdentifier("storyboard.review.round.\(round.version)")
    }

    private var detailSurface: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let errorMessage { feedbackBanner(errorMessage, icon: "exclamationmark.triangle.fill", color: .red) }
                if let successMessage { feedbackBanner(successMessage, icon: "checkmark.circle.fill", color: .green) }

                if let selected {
                    revisionHeader(selected)
                    createRevisionPanel
                    if let diff { diffBanner(diff) }
                    resolutionQueue
                    secondaryActions(for: selected)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "rectangle.stack.badge.play")
                            .font(.system(size: 34)).foregroundStyle(BoardBrand.accent)
                        Text("Velg en låst revisjon")
                            .font(.system(size: 18, weight: .bold))
                        Text("Review-punkt, visuelle markeringer og sign-off vises her.")
                            .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                    }
                    .frame(maxWidth: .infinity, minHeight: 360)
                }
            }
            .padding(18)
        }
        .background(BoardBrand.chrome)
    }

    private func revisionHeader(_ round: StoryboardReviewRoundDTO) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 8) {
                    Text("v\(round.version)")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(BoardBrand.accent)
                    Text(round.label)
                        .font(.system(size: 24, weight: .bold)).foregroundStyle(.white)
                    Text(statusLabel(round.status))
                        .font(.system(size: 9, weight: .bold)).kerning(0.6)
                        .foregroundStyle(statusColor(round.status))
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(statusColor(round.status).opacity(0.12), in: Capsule())
                }
                if let summary = round.summary, !summary.isEmpty {
                    Text(summary).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                }
                Text("LÅST SNAPSHOT  \(String(round.snapshotHash.prefix(12)))…")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .kerning(0.5).foregroundStyle(BoardBrand.label)
                    .textSelection(.enabled)
            }
            Spacer()
            metricChip("\(round.frameCount)", "SHOTS")
            metricChip(String(format: "%.1f", round.totalDurationSeconds), "SEK")
        }
    }

    private var createRevisionPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            reviewSectionLabel("Ny låst revisjon")
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { revisionFields; sendReviewButton }
                VStack(spacing: 10) { revisionFields; sendReviewButton }
            }
        }
        .storyboardReviewPanel()
    }

    private var revisionFields: some View {
        Group {
            TextField("Navn på revisjon", text: $label)
                .storyboardReviewField()
            TextField("Kort beskjed til teamet", text: $summary, axis: .vertical)
                .lineLimit(1...3)
                .storyboardReviewField()
        }
    }

    private var sendReviewButton: some View {
        Button { createRound() } label: {
            Label("Send til review", systemImage: "paperplane.fill")
                .font(.system(size: 12, weight: .semibold))
                .frame(minHeight: 24)
        }
        .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
        .disabled(busy || label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        .accessibilityIdentifier("storyboard.review.create")
    }

    private func diffBanner(_ diff: StoryboardReviewDiffDTO) -> some View {
        let unchanged = diff.changeCount == 0 && !diff.scriptChanged
        let color: Color = unchanged ? .green : .orange
        return HStack(spacing: 10) {
            Image(systemName: unchanged ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 2) {
                Text(unchanged ? "Arbeidskopien samsvarer" : "Endringer siden låsing")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                Text(unchanged
                     ? "Ingen storyboard- eller manusendringer."
                     : "\(diff.changeCount) storyboardendringer\(diff.scriptChanged ? " · manus endret" : "")")
                    .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
            }
            Spacer()
        }
        .padding(11)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(color.opacity(0.22)))
        .accessibilityIdentifier("storyboard.review.diff")
    }

    private var resolutionQueue: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    reviewSectionLabel("Løsningskø")
                    Text("\(comments.filter { $0.status == "open" }.count) åpne av \(comments.count) punkt")
                        .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                }
                Spacer()
                Button(showOpenCommentsOnly ? "Vis alle" : "Bare åpne") {
                    showOpenCommentsOnly.toggle()
                }
                .font(.system(size: 11, weight: .semibold))
                .buttonStyle(.bordered).tint(BoardBrand.accent)
                .accessibilityIdentifier("storyboard.review.comments.filter")
            }
            if visibleComments.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: comments.isEmpty ? "text.bubble" : "checkmark.circle")
                        .font(.system(size: 24)).foregroundStyle(BoardBrand.label)
                    Text(comments.isEmpty ? "Ingen kommentarer" : "Alle punkt er løst")
                        .font(.system(size: 13, weight: .semibold))
                    Text(comments.isEmpty
                         ? "Kommentarer fra review-lenken vises her."
                         : "Vis alle for å se løste punkt.")
                        .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                ForEach(visibleComments) { comment in
                    StoryboardReviewResolutionRow(
                        comment: comment, frame: frame(for: comment), rounds: rounds, busy: busy,
                        onUpdate: { changes in updateComment(comment, changes: changes) })
                    .id(comment.updatedAt ?? comment.id)
                }
            }
        }
        .storyboardReviewPanel()
        .overlay(alignment: .topLeading) {
            Color.clear
                .frame(width: 1, height: 1)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Løsningskø")
                .accessibilityIdentifier("storyboard.review.resolutionQueue")
        }
    }

    private func secondaryActions(for round: StoryboardReviewRoundDTO) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) { sharePanel(for: round); restorePanel(for: round) }
            VStack(spacing: 12) { sharePanel(for: round); restorePanel(for: round) }
        }
    }

    private func sharePanel(for round: StoryboardReviewRoundDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Gjestelenke", systemImage: "link")
                .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
            Picker("Tilgang", selection: $accessMode) {
                Text("Bare visning").tag("view")
                Text("Kommentarer").tag("comment")
                Text("Kommentarer og sign-off").tag("approve")
            }
            .pickerStyle(.menu).tint(BoardBrand.accent)
            Toggle("Krev navn", isOn: $requireIdentity)
                .font(.system(size: 11)).tint(BoardBrand.accent)
            Button { createShare(round: round) } label: {
                Label("Opprett sikker lenke", systemImage: "link.badge.plus")
            }
            .buttonStyle(.bordered).tint(BoardBrand.accent)
            .disabled(busy || round.status == "superseded")
            .accessibilityIdentifier("storyboard.review.share")
            if let shareURL {
                ShareLink(item: shareURL) {
                    Label("Del review-lenken", systemImage: "square.and.arrow.up")
                }
                .foregroundStyle(BoardBrand.accent)
                Text("Tokenet vises bare i denne økten.")
                    .font(.system(size: 9)).foregroundStyle(BoardBrand.label)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .storyboardReviewPanel()
    }

    private func restorePanel(for round: StoryboardReviewRoundDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Sikker gjenoppretting", systemImage: "clock.arrow.circlepath")
                .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
            Text("Bare storyboardfelter gjenopprettes. Nyere manus-, casting- og produksjonsdata beholdes.")
                .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
            TextField("Skriv \(String(round.snapshotHash.prefix(8)))", text: $restoreCode)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .storyboardReviewField()
            Button(role: .destructive) { restore(round: round) } label: {
                Label("Gjenopprett storyboardfelter", systemImage: "arrow.uturn.backward.circle")
            }
            .buttonStyle(.bordered).tint(.red)
            .disabled(busy || diff == nil
                      || restoreCode.lowercased() != String(round.snapshotHash.prefix(8)))
            .accessibilityIdentifier("storyboard.review.restore")
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .storyboardReviewPanel()
    }

    private func reviewSectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .bold)).kerning(1)
            .foregroundStyle(BoardBrand.label)
    }

    private func emptyRailRow(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 10)).foregroundStyle(BoardBrand.label)
            .padding(10).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.025), in: RoundedRectangle(cornerRadius: 9))
    }

    private func metricChip(_ value: String, _ label: String) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(value).font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text(label).font(.system(size: 8, weight: .bold)).kerning(0.8)
                .foregroundStyle(BoardBrand.label)
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 8))
    }

    private func feedbackBanner(_ text: String, icon: String, color: Color) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 11, weight: .medium)).foregroundStyle(.white)
            .padding(10).frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
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
        switch status {
        case "approved": return .green
        case "changes_requested": return .orange
        case "in_review": return BoardBrand.accent
        default: return BoardBrand.dim
        }
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

private struct StoryboardReviewPanelModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(14)
            .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(BoardBrand.border))
    }
}

private struct StoryboardReviewFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 12))
            .foregroundStyle(.white)
            .textFieldStyle(.plain)
            .padding(.horizontal, 10).padding(.vertical, 9)
            .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(BoardBrand.border))
    }
}

private extension View {
    func storyboardReviewPanel() -> some View {
        modifier(StoryboardReviewPanelModifier())
    }

    func storyboardReviewField() -> some View {
        modifier(StoryboardReviewFieldModifier())
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
        VStack(alignment: .leading, spacing: 13) {
            commentHeader
            Text(comment.body)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            if let frame, hasVisualFeedback {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 16) {
                        StoryboardReviewAnnotationPreview(frame: frame, comment: comment)
                            .frame(minWidth: 300, maxWidth: 520)
                        workflowControls.frame(minWidth: 260, maxWidth: 340)
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        StoryboardReviewAnnotationPreview(frame: frame, comment: comment)
                            .frame(maxWidth: 520)
                        workflowControls
                    }
                }
            } else {
                workflowControls
            }
        }
        .padding(14)
        .background(BoardBrand.chrome.opacity(0.72), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border))
    }

    private var hasVisualFeedback: Bool {
        comment.anchorX != nil || comment.anchorY != nil || !(comment.annotations ?? []).isEmpty
    }

    private var commentHeader: some View {
        HStack(spacing: 8) {
            Label(comment.status == "open" ? "ÅPENT" : "LØST",
                  systemImage: comment.status == "open" ? "circle.dashed" : "checkmark.circle.fill")
                .font(.system(size: 9, weight: .bold)).kerning(0.5)
                .foregroundStyle(comment.status == "open" ? .orange : .green)
                .padding(.horizontal, 7).padding(.vertical, 4)
                .background((comment.status == "open" ? Color.orange : Color.green).opacity(0.1),
                            in: Capsule())
            if let shot = frame?.shotNumber ?? comment.frameId {
                Text("SHOT \(shot)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(BoardBrand.label)
            }
            if comment.carriedFromCommentId != nil {
                Text("VIDEREFØRT")
                    .font(.system(size: 8, weight: .bold)).kerning(0.5)
                    .foregroundStyle(BoardBrand.accent)
            }
            Spacer()
            Circle()
                .fill(BoardBrand.accent.opacity(0.22))
                .frame(width: 24, height: 24)
                .overlay(Text(String(comment.authorDisplayName.prefix(1)).uppercased())
                    .font(.system(size: 10, weight: .bold)).foregroundStyle(.white))
            Text(comment.authorDisplayName)
                .font(.system(size: 10, weight: .semibold)).foregroundStyle(BoardBrand.dim)
        }
    }

    private var workflowControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ANSVAR OG FRIST")
                .font(.system(size: 8, weight: .bold)).kerning(0.9)
                .foregroundStyle(BoardBrand.label)
            TextField("Ansvarlig", text: $assignedTo)
                .storyboardReviewField()
                .accessibilityIdentifier("storyboard.review.comment.assignee.\(comment.id)")
            Toggle("Sett frist", isOn: $hasDueDate)
                .font(.system(size: 11, weight: .medium)).tint(BoardBrand.accent)
            if hasDueDate {
                DatePicker("Frist", selection: $dueDate, displayedComponents: [.date, .hourAndMinute])
                    .font(.system(size: 11)).tint(BoardBrand.accent)
                    .accessibilityIdentifier("storyboard.review.comment.due.\(comment.id)")
            }
            Button("Lagre ansvar og frist") {
                let assignee = assignedTo.trimmingCharacters(in: .whitespacesAndNewlines)
                onUpdate(StoryboardReviewCommentChanges(
                    status: nil,
                    assignedTo: .value(assignee.isEmpty ? nil : assignee),
                    dueAt: .value(hasDueDate ? ISO8601DateFormatter().string(from: dueDate) : nil)))
            }
            .font(.system(size: 11, weight: .semibold))
            .buttonStyle(.bordered).tint(BoardBrand.accent)
            .disabled(busy)
            .accessibilityIdentifier("storyboard.review.comment.save.\(comment.id)")

            Rectangle().fill(BoardBrand.border).frame(height: 1).padding(.vertical, 2)

            if comment.status == "open" {
                Text("LØSNING")
                    .font(.system(size: 8, weight: .bold)).kerning(0.9)
                    .foregroundStyle(BoardBrand.label)
                TextField("Hva ble endret?", text: $resolutionNote, axis: .vertical)
                    .lineLimit(2...4)
                    .storyboardReviewField()
                Picker("Rettet i revisjon", selection: $resolvedInRoundId) {
                    Text("Ikke angitt").tag("")
                    ForEach(rounds) { round in
                        Text("v\(round.version) · \(round.label)").tag(round.id)
                    }
                }
                .font(.system(size: 11)).pickerStyle(.menu).tint(BoardBrand.accent)
                Button {
                    let note = resolutionNote.trimmingCharacters(in: .whitespacesAndNewlines)
                    onUpdate(StoryboardReviewCommentChanges(
                        status: "resolved",
                        resolutionNote: .value(note.isEmpty ? nil : note),
                        resolvedInRoundId: .value(resolvedInRoundId.isEmpty ? nil : resolvedInRoundId)))
                } label: {
                    Label("Marker løst", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 11, weight: .semibold))
                }
                .buttonStyle(.borderedProminent).tint(.green)
                .disabled(busy)
                .accessibilityIdentifier("storyboard.review.comment.resolve.\(comment.id)")
            } else {
                if let note = comment.resolutionNote, !note.isEmpty {
                    Text("Løsning: \(note)")
                        .font(.system(size: 11)).foregroundStyle(.green)
                }
                Button {
                    onUpdate(StoryboardReviewCommentChanges(status: "open"))
                } label: {
                    Label("Gjenåpne", systemImage: "arrow.uturn.backward.circle")
                }
                .font(.system(size: 11, weight: .semibold))
                .buttonStyle(.bordered).tint(.orange)
                .disabled(busy)
                .accessibilityIdentifier("storyboard.review.comment.reopen.\(comment.id)")
            }
        }
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
