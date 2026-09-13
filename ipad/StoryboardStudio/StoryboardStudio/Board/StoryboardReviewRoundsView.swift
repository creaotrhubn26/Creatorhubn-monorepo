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

struct StoryboardReviewDrawingDataDTO: Decodable, Sendable {
    let strokes: String?
    let width: Double?
    let height: Double?
}

struct StoryboardReviewSnapshotFrameDTO: Decodable, Identifiable, Sendable {
    let id: String
    let shotNumber: String?
    let description: String?
    let duration: Double?
    let shotType: String?
    let movement: String?
    let lensMm: Int?
    let transition: String?
    let continuityNotes: String?
    let productionNotes: String?
    let imageUrl: String?
    let thumbnailUrl: String?
    let drawingData: StoryboardReviewDrawingDataDTO?

    init(
        id: String,
        shotNumber: String?,
        description: String?,
        duration: Double? = nil,
        shotType: String? = nil,
        movement: String? = nil,
        lensMm: Int? = nil,
        transition: String? = nil,
        continuityNotes: String? = nil,
        productionNotes: String? = nil,
        imageUrl: String?,
        thumbnailUrl: String?,
        drawingData: StoryboardReviewDrawingDataDTO? = nil
    ) {
        self.id = id
        self.shotNumber = shotNumber
        self.description = description
        self.duration = duration
        self.shotType = shotType
        self.movement = movement
        self.lensMm = lensMm
        self.transition = transition
        self.continuityNotes = continuityNotes
        self.productionNotes = productionNotes
        self.imageUrl = imageUrl
        self.thumbnailUrl = thumbnailUrl
        self.drawingData = drawingData
    }

    private enum CodingKeys: String, CodingKey {
        case id, shotNumber, description, duration, shotType, movement, lensMm, transition
        case continuityNotes, productionNotes, imageUrl, imageURL
        case thumbnailUrl, thumbnailDataURL, drawingData
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        shotNumber = try values.decodeIfPresent(String.self, forKey: .shotNumber)
        description = try values.decodeIfPresent(String.self, forKey: .description)
        duration = try values.decodeIfPresent(Double.self, forKey: .duration)
        shotType = try values.decodeIfPresent(String.self, forKey: .shotType)
        movement = try values.decodeIfPresent(String.self, forKey: .movement)
        lensMm = try values.decodeIfPresent(Int.self, forKey: .lensMm)
        transition = try values.decodeIfPresent(String.self, forKey: .transition)
        continuityNotes = try values.decodeIfPresent(String.self, forKey: .continuityNotes)
        productionNotes = try values.decodeIfPresent(String.self, forKey: .productionNotes)
        imageUrl = try values.decodeIfPresent(String.self, forKey: .imageUrl)
            ?? values.decodeIfPresent(String.self, forKey: .imageURL)
        thumbnailUrl = try values.decodeIfPresent(String.self, forKey: .thumbnailUrl)
            ?? values.decodeIfPresent(String.self, forKey: .thumbnailDataURL)
        drawingData = try values.decodeIfPresent(
            StoryboardReviewDrawingDataDTO.self, forKey: .drawingData)
    }
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
    var status: String
    let assignedTo: String?
    let dueAt: String?
    var resolutionNote: String?
    var resolvedBy: String?
    var resolvedAt: String?
    let resolvedInRoundId: String?
    let carriedFromCommentId: String?
    let createdAt: String
    let updatedAt: String?
    var changes: [StoryboardReviewCommentChangeDTO]? = nil
}

struct StoryboardReviewCommentChangeDTO: Decodable, Identifiable, Sendable {
    let id: String
    let reviewRoundId: String
    let commentId: String
    let sceneId: String
    let frameId: String
    let operation: String
    let field: String
    let fieldLabel: String
    let beforeDisplayValue: String
    let afterDisplayValue: String
    let beforeHash: String
    let afterHash: String
    let revertsChangeId: String?
    let createdBy: String
    let createdAt: String
}

struct StoryboardReviewChangePreviewDTO: Decodable, Sendable {
    let previewHash: String
    let beforeHash: String
    let afterHash: String
    let commentId: String
    let roundId: String
    let sceneId: String
    let frameId: String
    let field: String
    let fieldLabel: String
    let beforeDisplayValue: String
    let afterDisplayValue: String
    let currentFrameUpdatedAt: String?
}

struct StoryboardReviewChangeApplicationDTO: Decodable, Sendable {
    let comment: StoryboardReviewCommentDTO
    let change: StoryboardReviewCommentChangeDTO
    let frameUpdatedAt: String?
}

enum StoryboardReviewChangeValue: Sendable, Equatable {
    case text(String?)
    case number(Double?)
    case tags([String]?)
}

enum StoryboardReviewEditableField: String, CaseIterable, Identifiable, Sendable {
    case duration
    case description
    case shotType
    case movement
    case lensMm
    case transition
    case continuityNotes
    case productionNotes

    var id: String { rawValue }

    var title: String {
        switch self {
        case .duration: return "Varighet"
        case .description: return "Shotbeskrivelse"
        case .shotType: return "Bildestørrelse"
        case .movement: return "Kamerabevegelse"
        case .lensMm: return "Brennvidde"
        case .transition: return "Overgang"
        case .continuityNotes: return "Kontinuitetsnotat"
        case .productionNotes: return "Produksjonsnotat"
        }
    }

    var prompt: String {
        switch self {
        case .duration: return "Sekunder, for eksempel 3,5"
        case .lensMm: return "Millimeter, for eksempel 50"
        case .description: return "Beskriv handlingen i bildet"
        case .shotType: return "For eksempel total, halvtotal eller nær"
        case .movement: return "For eksempel statisk, dolly eller panorering"
        case .transition: return "For eksempel klipp eller dissolve"
        case .continuityNotes: return "Hva må videreføres mellom shots?"
        case .productionNotes: return "Hva må produksjonen vite?"
        }
    }

    func initialValue(frame: StoryboardReviewSnapshotFrameDTO, comment: String) -> String {
        switch self {
        case .duration:
            let current = frame.duration ?? 2
            let normalized = comment.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            let suggested: Double
            if normalized.contains("lenger") || normalized.contains("hold") {
                suggested = min(current + 1, 600)
            } else if normalized.contains("kortere") || normalized.contains("raskere") {
                suggested = max(current - 0.5, 0.25)
            } else {
                suggested = current
            }
            return Self.decimalString(suggested)
        case .description: return frame.description ?? ""
        case .shotType: return frame.shotType ?? ""
        case .movement: return frame.movement ?? ""
        case .lensMm: return frame.lensMm.map(String.init) ?? ""
        case .transition: return frame.transition ?? ""
        case .continuityNotes: return frame.continuityNotes ?? ""
        case .productionNotes: return frame.productionNotes ?? ""
        }
    }

    func parsedValue(_ rawValue: String) throws -> StoryboardReviewChangeValue {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        switch self {
        case .duration:
            guard let value = Self.number(trimmed), (0.25...600).contains(value) else {
                throw StoryboardReviewChangeInputError.invalidDuration
            }
            return .number(value)
        case .lensMm:
            guard let value = Self.number(trimmed), value.rounded() == value,
                  (1...2_000).contains(value) else {
                throw StoryboardReviewChangeInputError.invalidLens
            }
            return .number(value)
        case .description:
            guard !trimmed.isEmpty else { throw StoryboardReviewChangeInputError.emptyDescription }
            return .text(trimmed)
        default:
            return .text(trimmed.isEmpty ? nil : trimmed)
        }
    }

    private static func number(_ value: String) -> Double? {
        Double(value.replacingOccurrences(of: ",", with: "."))
    }

    private static func decimalString(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
    }
}

enum StoryboardReviewChangeInputError: LocalizedError {
    case invalidDuration
    case invalidLens
    case emptyDescription

    var errorDescription: String? {
        switch self {
        case .invalidDuration: return "Varighet må være mellom 0,25 og 600 sekunder."
        case .invalidLens: return "Brennvidde må være et helt tall mellom 1 og 2000 mm."
        case .emptyDescription: return "Shotbeskrivelsen kan ikke være tom."
        }
    }
}

private struct StoryboardReviewChangeDraft: Identifiable {
    let comment: StoryboardReviewCommentDTO
    let frame: StoryboardReviewSnapshotFrameDTO
    var id: String { comment.id }
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
    var embedded = false
    var presentationRole: StoryboardProductionRole = .producer

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
    @State private var showCreateRevision = false
    @State private var showShareOptions = false
    @State private var showRestoreOptions = false
    @State private var changeDraft: StoryboardReviewChangeDraft?
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
        Group {
            if embedded {
                reviewContent
            } else {
                NavigationStack {
                    reviewContent
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
                                duration: 2,
                                imageUrl: StoryboardReviewDemoArtwork.dataURL(variant: 0),
                                thumbnailUrl: StoryboardReviewDemoArtwork.dataURL(variant: 0))])
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
                if ProcessInfo.processInfo.environment["SB_REVIEW_CHANGE_DEMO"] == "1",
                   let demoComment = comments.first,
                   let demoFrame = demo.snapshot?.scenes.first?.storyboardFrames.first {
                    changeDraft = StoryboardReviewChangeDraft(
                        comment: demoComment, frame: demoFrame)
                }
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
        .sheet(isPresented: $showCreateRevision) {
            NavigationStack {
                createRevisionPanel
                    .padding(20)
                    .background(BoardBrand.chrome)
                    .navigationTitle("Lås ny revisjon")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Ferdig") { showCreateRevision = false }
                        }
                    }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showShareOptions) {
            NavigationStack {
                Group {
                    if let selected { sharePanel(for: selected) }
                }
                .padding(20)
                .background(BoardBrand.chrome)
                .navigationTitle("Del låst revisjon")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Ferdig") { showShareOptions = false }
                    }
                }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showRestoreOptions) {
            NavigationStack {
                Group {
                    if let selected { restorePanel(for: selected) }
                }
                .padding(20)
                .background(BoardBrand.chrome)
                .navigationTitle("Gjenopprett revisjon")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Avbryt") { showRestoreOptions = false }
                    }
                }
            }
            .presentationDetents([.medium])
            .preferredColorScheme(.dark)
        }
        .sheet(item: $changeDraft) { draft in
            StoryboardReviewChangeSheet(
                projectId: projectId,
                manuscriptId: manuscriptId,
                draft: draft,
                demoMode: ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] == "1",
                onApplied: { result in acceptAppliedChange(result, original: draft.comment) })
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .preferredColorScheme(.dark)
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

    private var reviewContent: some View {
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
        .overlay(alignment: .topTrailing) {
            if embedded && busy {
                Label("Synkroniserer", systemImage: "arrow.triangle.2.circlepath")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(BoardBrand.panel.opacity(0.96), in: Capsule())
                    .padding(10)
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
                    revisionActions(selected)
                    lockedRevisionStage(selected)
                    if let diff { diffBanner(diff) }
                    resolutionQueue
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

    private func revisionActions(_ round: StoryboardReviewRoundDTO) -> some View {
        HStack(spacing: 10) {
            if presentationRole.canManageLockedRevisions {
                Button {
                    showCreateRevision = true
                } label: {
                    Label("Lås ny revisjon", systemImage: "lock.badge.plus")
                        .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                }
                .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                .accessibilityIdentifier("storyboard.review.create.open")

                Button {
                    showShareOptions = true
                } label: {
                    Label("Del", systemImage: "square.and.arrow.up")
                        .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                }
                .buttonStyle(.bordered).tint(BoardBrand.accent)
                .disabled(round.status == "superseded")
                .accessibilityIdentifier("storyboard.review.share.open")
            }
            Spacer()
            if presentationRole.canRestoreLockedRevisions {
                Menu {
                    Button(role: .destructive) { showRestoreOptions = true } label: {
                        Label("Gjenopprett storyboardfelter", systemImage: "arrow.uturn.backward.circle")
                    }
                } label: {
                    Label("Flere", systemImage: "ellipsis.circle")
                        .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                }
                .accessibilityLabel("Flere revisjonshandlinger")
                .accessibilityIdentifier("storyboard.review.more")
            }
        }
    }

    @ViewBuilder
    private func lockedRevisionStage(_ round: StoryboardReviewRoundDTO) -> some View {
        let frames = selectedDetail?.snapshot?.scenes.flatMap(\.storyboardFrames) ?? []
        if let frame = frames.first {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("Låst bilde", systemImage: "lock.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(BoardBrand.accent)
                    Text(frame.shotNumber.map { "SHOT \($0)" } ?? "SHOT")
                        .font(.caption.monospaced().weight(.bold))
                        .foregroundStyle(BoardBrand.dim)
                    Spacer()
                    Text("v\(round.version)")
                        .font(.subheadline.monospaced().weight(.bold))
                        .foregroundStyle(.white)
                }
                StoryboardLockedFramePreview(frame: frame)
                    .frame(maxWidth: .infinity)
                if let description = frame.description, !description.isEmpty {
                    Text(description)
                        .font(.body)
                        .foregroundStyle(BoardBrand.dim)
                }
            }
            .padding(14)
            .background(Color.black.opacity(0.34),
                        in: RoundedRectangle(cornerRadius: StoryboardExperienceMetrics.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: StoryboardExperienceMetrics.cornerRadius)
                .stroke(BoardBrand.border))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("storyboard.review.lockedStage")
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
                .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
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
                        canCreateChange: presentationRole.canManageLockedRevisions,
                        onUpdate: { changes in updateComment(comment, changes: changes) },
                        onCreateChange: {
                            guard let frame = frame(for: comment) else { return }
                            changeDraft = StoryboardReviewChangeDraft(comment: comment, frame: frame)
                        },
                        onUndo: { change in undoChange(comment, change: change) })
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

    @MainActor
    private func acceptAppliedChange(
        _ result: StoryboardReviewChangeApplicationDTO,
        original: StoryboardReviewCommentDTO
    ) {
        var updated = result.comment
        updated.changes = (original.changes ?? []) + [result.change]
        if let index = comments.firstIndex(where: { $0.id == updated.id }) {
            comments[index] = updated
        }
        showOpenCommentsOnly = false
        successMessage = "Endringen er godkjent, anvendt og kan angres fra review-punktet."
        errorMessage = nil
        guard ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] != "1" else { return }
        Task { await reload(prefer: selectedID) }
    }

    private func undoChange(
        _ comment: StoryboardReviewCommentDTO,
        change: StoryboardReviewCommentChangeDTO
    ) {
        busy = true; errorMessage = nil; successMessage = nil
        Task {
            do {
                let result: StoryboardReviewChangeApplicationDTO
                if ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] == "1" {
                    var reopened = comment
                    reopened.status = "open"
                    reopened.resolutionNote = nil
                    reopened.resolvedBy = nil
                    reopened.resolvedAt = nil
                    let undo = StoryboardReviewCommentChangeDTO(
                        id: "undo-\(change.id)", reviewRoundId: change.reviewRoundId,
                        commentId: change.commentId, sceneId: change.sceneId,
                        frameId: change.frameId, operation: "undo", field: change.field,
                        fieldLabel: change.fieldLabel,
                        beforeDisplayValue: change.afterDisplayValue,
                        afterDisplayValue: change.beforeDisplayValue,
                        beforeHash: change.afterHash, afterHash: change.beforeHash,
                        revertsChangeId: change.id, createdBy: "demo-director",
                        createdAt: ISO8601DateFormatter().string(from: Date()))
                    reopened.changes = (comment.changes ?? []) + [undo]
                    result = StoryboardReviewChangeApplicationDTO(
                        comment: reopened, change: undo, frameUpdatedAt: nil)
                } else {
                    result = try await RoleRoomAPIClient.shared.undoStoryboardReviewCommentChange(
                        projectId: projectId, manuscriptId: manuscriptId,
                        roundId: comment.reviewRoundId, commentId: comment.id,
                        changeId: change.id, expectedAfterHash: change.afterHash)
                }
                var reopened = result.comment
                reopened.changes = (comment.changes ?? []) + [result.change]
                if let index = comments.firstIndex(where: { $0.id == reopened.id }) {
                    comments[index] = reopened
                }
                successMessage = "Endringen er angret. Review-punktet er åpnet igjen."
                if ProcessInfo.processInfo.environment["SB_REVIEW_ROUNDS_DEMO"] != "1" {
                    await reload(prefer: selectedID)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            busy = false
        }
    }
}

private struct StoryboardReviewChangeSheet: View {
    let projectId: String
    let manuscriptId: String
    let draft: StoryboardReviewChangeDraft
    let demoMode: Bool
    let onApplied: (StoryboardReviewChangeApplicationDTO) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var field: StoryboardReviewEditableField
    @State private var input: String
    @State private var preview: StoryboardReviewChangePreviewDTO?
    @State private var previewValue: StoryboardReviewChangeValue?
    @State private var busy = false
    @State private var errorMessage: String?

    init(
        projectId: String,
        manuscriptId: String,
        draft: StoryboardReviewChangeDraft,
        demoMode: Bool,
        onApplied: @escaping (StoryboardReviewChangeApplicationDTO) -> Void
    ) {
        self.projectId = projectId
        self.manuscriptId = manuscriptId
        self.draft = draft
        self.demoMode = demoMode
        self.onApplied = onApplied
        let suggestedField = Self.suggestedField(for: draft.comment.body)
        _field = State(initialValue: suggestedField)
        _input = State(initialValue: suggestedField.initialValue(
            frame: draft.frame, comment: draft.comment.body))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    sourceCard
                    editorCard
                    if let preview { previewCard(preview) }
                }
                .frame(maxWidth: 820)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .background(BoardBrand.chrome)
            .navigationTitle("Forhåndsvis endring")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if preview != nil {
                    Button { applyPreview() } label: {
                        Label("Godkjenn og bruk", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 12, weight: .bold))
                            .frame(maxWidth: 780,
                                   minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(busy)
                    .accessibilityIdentifier("storyboard.review.change.apply")
                    .padding(.horizontal, 20).padding(.vertical, 12)
                    .frame(maxWidth: .infinity)
                    .background(.ultraThinMaterial)
                    .overlay(alignment: .top) {
                        Rectangle().fill(BoardBrand.border).frame(height: 1)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                        .disabled(busy)
                }
            }
        }
        .onChange(of: field) { _, nextField in
            input = nextField.initialValue(frame: draft.frame, comment: draft.comment.body)
            invalidatePreview()
        }
        .onChange(of: input) { _, _ in invalidatePreview() }
    }

    private var sourceCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Label("HVORFOR", systemImage: "text.bubble.fill")
                .font(.system(size: 9, weight: .bold)).kerning(1)
                .foregroundStyle(BoardBrand.accent)
            Text(draft.comment.body)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(draft.comment.authorDisplayName)
                Text("·")
                Text(draft.frame.shotNumber.map { "SHOT \($0)" } ?? "VALGT SHOT")
                    .fontDesign(.monospaced)
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(BoardBrand.dim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .storyboardReviewPanel()
    }

    private var editorCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("FORESLÅ KONKRET ENDRING")
                .font(.system(size: 9, weight: .bold)).kerning(1)
                .foregroundStyle(BoardBrand.label)
            Picker("Shotfelt", selection: $field) {
                ForEach(StoryboardReviewEditableField.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.menu)
            .tint(BoardBrand.accent)
            .accessibilityIdentifier("storyboard.review.change.field")

            TextField(field.prompt, text: $input, axis: .vertical)
                .lineLimit(field == .description || field == .continuityNotes
                           || field == .productionNotes ? 2...6 : 1...2)
                .keyboardType(field == .duration || field == .lensMm ? .decimalPad : .default)
                .storyboardReviewField()
                .accessibilityIdentifier("storyboard.review.change.value")

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("storyboard.review.change.error")
            }

            Button { requestPreview() } label: {
                Label("Forhåndsvis før godkjenning", systemImage: "rectangle.on.rectangle")
                    .font(.system(size: 12, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
            }
            .buttonStyle(.borderedProminent)
            .tint(BoardBrand.accent)
            .disabled(busy)
            .accessibilityIdentifier("storyboard.review.change.preview")
        }
        .storyboardReviewPanel()
    }

    private func previewCard(_ preview: StoryboardReviewChangePreviewDTO) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("KLAR TIL GODKJENNING", systemImage: "checkmark.shield")
                    .font(.system(size: 9, weight: .bold)).kerning(0.8)
                    .foregroundStyle(.green)
                Spacer()
                Text(preview.fieldLabel.uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(BoardBrand.label)
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) {
                    valueCard("FØR", preview.beforeDisplayValue, color: BoardBrand.dim)
                    Image(systemName: "arrow.right").foregroundStyle(BoardBrand.accent)
                    valueCard("ETTER", preview.afterDisplayValue, color: .white)
                }
                VStack(spacing: 8) {
                    valueCard("FØR", preview.beforeDisplayValue, color: BoardBrand.dim)
                    Image(systemName: "arrow.down").foregroundStyle(BoardBrand.accent)
                    valueCard("ETTER", preview.afterDisplayValue, color: .white)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                impactLine("Konsekvens", "Endrer bare \(preview.fieldLabel.lowercased()) på dette shotet.")
                impactLine("Sporbarhet", "Kommentaren løses og endringen føres i revisjonsjournalen.")
                impactLine("Angre", "Kan reverseres så lenge feltet ikke endres av noen andre etterpå.")
            }

            Label("Ingen produksjonsdata er endret ennå.", systemImage: "lock.shield")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(BoardBrand.dim)

        }
        .storyboardReviewPanel()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("storyboard.review.change.previewResult")
    }

    private func valueCard(_ label: String, _ value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 8, weight: .bold)).kerning(0.8)
                .foregroundStyle(BoardBrand.label)
            Text(value)
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .foregroundStyle(color)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(BoardBrand.border))
    }

    private func impactLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label.uppercased())
                .font(.system(size: 8, weight: .bold)).kerning(0.7)
                .foregroundStyle(BoardBrand.label)
                .frame(width: 70, alignment: .leading)
            Text(value).font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
        }
    }

    private func invalidatePreview() {
        preview = nil
        previewValue = nil
        errorMessage = nil
    }

    private func requestPreview() {
        busy = true; errorMessage = nil
        Task {
            do {
                let value = try field.parsedValue(input)
                let loaded: StoryboardReviewChangePreviewDTO
                if demoMode {
                    loaded = demoPreview(value)
                } else {
                    loaded = try await RoleRoomAPIClient.shared.previewStoryboardReviewCommentChange(
                        projectId: projectId, manuscriptId: manuscriptId,
                        roundId: draft.comment.reviewRoundId, commentId: draft.comment.id,
                        field: field.rawValue, value: value)
                }
                previewValue = value
                preview = loaded
            } catch {
                errorMessage = error.localizedDescription
            }
            busy = false
        }
    }

    private func applyPreview() {
        guard let preview, let previewValue else { return }
        busy = true; errorMessage = nil
        Task {
            do {
                let result: StoryboardReviewChangeApplicationDTO
                if demoMode {
                    var resolved = draft.comment
                    resolved.status = "resolved"
                    resolved.resolutionNote = "Godkjent endring: \(preview.fieldLabel) – \(preview.beforeDisplayValue) → \(preview.afterDisplayValue)"
                    resolved.resolvedBy = "demo-director"
                    resolved.resolvedAt = ISO8601DateFormatter().string(from: Date())
                    let change = StoryboardReviewCommentChangeDTO(
                        id: "change-demo", reviewRoundId: draft.comment.reviewRoundId,
                        commentId: draft.comment.id, sceneId: preview.sceneId,
                        frameId: preview.frameId, operation: "apply", field: preview.field,
                        fieldLabel: preview.fieldLabel,
                        beforeDisplayValue: preview.beforeDisplayValue,
                        afterDisplayValue: preview.afterDisplayValue,
                        beforeHash: preview.beforeHash, afterHash: preview.afterHash,
                        revertsChangeId: nil, createdBy: "demo-director",
                        createdAt: ISO8601DateFormatter().string(from: Date()))
                    result = StoryboardReviewChangeApplicationDTO(
                        comment: resolved, change: change, frameUpdatedAt: nil)
                } else {
                    result = try await RoleRoomAPIClient.shared.applyStoryboardReviewCommentChange(
                        projectId: projectId, manuscriptId: manuscriptId,
                        roundId: draft.comment.reviewRoundId, commentId: draft.comment.id,
                        field: field.rawValue, value: previewValue,
                        expectedPreviewHash: preview.previewHash)
                }
                onApplied(result)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                self.preview = nil
                self.previewValue = nil
            }
            busy = false
        }
    }

    private func demoPreview(_ value: StoryboardReviewChangeValue) -> StoryboardReviewChangePreviewDTO {
        StoryboardReviewChangePreviewDTO(
            previewHash: String(repeating: "f", count: 64),
            beforeHash: String(repeating: "d", count: 64),
            afterHash: String(repeating: "e", count: 64),
            commentId: draft.comment.id, roundId: draft.comment.reviewRoundId,
            sceneId: "scene-demo", frameId: draft.frame.id,
            field: field.rawValue, fieldLabel: field.title,
            beforeDisplayValue: displayValue(field.currentValue(from: draft.frame), field: field),
            afterDisplayValue: displayValue(value, field: field), currentFrameUpdatedAt: nil)
    }

    private func displayValue(
        _ value: StoryboardReviewChangeValue,
        field: StoryboardReviewEditableField
    ) -> String {
        switch value {
        case .text(let text): return text?.isEmpty == false ? text! : "Ikke angitt"
        case .number(let number):
            guard let number else { return "Ikke angitt" }
            if field == .duration { return String(format: "%.1f sek", number) }
            return "\(Int(number)) mm"
        case .tags(let tags): return tags?.joined(separator: ", ") ?? "Ikke angitt"
        }
    }

    private static func suggestedField(for comment: String) -> StoryboardReviewEditableField {
        let value = comment.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        if value.contains("lenger") || value.contains("kortere")
            || value.contains("hold") || value.contains("timing") {
            return .duration
        }
        if value.contains("linse") || value.contains("mm") { return .lensMm }
        if value.contains("kamera") || value.contains("dolly") || value.contains("panorer") {
            return .movement
        }
        if value.contains("kontinuitet") { return .continuityNotes }
        return .description
    }
}

private extension StoryboardReviewEditableField {
    func currentValue(from frame: StoryboardReviewSnapshotFrameDTO) -> StoryboardReviewChangeValue {
        switch self {
        case .duration: return .number(frame.duration)
        case .description: return .text(frame.description)
        case .shotType: return .text(frame.shotType)
        case .movement: return .text(frame.movement)
        case .lensMm: return .number(frame.lensMm.map(Double.init))
        case .transition: return .text(frame.transition)
        case .continuityNotes: return .text(frame.continuityNotes)
        case .productionNotes: return .text(frame.productionNotes)
        }
    }
}

private struct StoryboardLockedFramePreview: View {
    let frame: StoryboardReviewSnapshotFrameDTO
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Rectangle().fill(Color.black.opacity(0.78))
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "photo.on.rectangle.angled").font(.title2)
                    Text("Forhåndsvisning lastes")
                        .font(.subheadline)
                }
                .foregroundStyle(BoardBrand.dim)
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white.opacity(0.16)))
        .task(id: imagePath) { await loadImage() }
    }

    private var imagePath: String? { frame.thumbnailUrl ?? frame.imageUrl }

    @MainActor
    private func loadImage() async {
        if let imagePath {
            if let cached = FrameImageCache.image(for: imagePath) {
                image = cached
                return
            }
            if let embedded = decodeDataURL(imagePath) {
                FrameImageCache.images[imagePath] = embedded
                image = embedded
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
            if let data, let downloaded = UIImage(data: data) {
                FrameImageCache.images[imagePath] = downloaded
                image = downloaded
                return
            }
        }
        image = renderDrawing()
    }

    @MainActor
    private func renderDrawing() -> UIImage? {
        guard let strokes = frame.drawingData?.strokes,
              !strokes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let renderable = FrameSummary(
            id: frame.id, shotNumber: frame.shotNumber ?? "?", detail: "",
            strokesJSON: strokes, description: frame.description ?? "", notes: nil,
            shotType: nil, lensMm: nil, movement: nil, durationSec: 0,
            transition: nil, focusDepth: nil, timeOfDay: nil, weather: nil,
            beatTag: nil, tags: [], thumbnailDataURL: frame.thumbnailUrl,
            drawingWidth: frame.drawingData?.width ?? 1920,
            drawingHeight: frame.drawingData?.height ?? 1080,
            frameStatus: nil, comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil, perspectiveMode: nil,
            vanishingPoints: nil, voiceoverDataURL: nil, imageUrl: frame.imageUrl,
            reviewPriority: nil, reviewDueAt: nil, reviewApprovedBy: nil,
            reviewApprovedAt: nil, reviewStarred: nil, reviewAssignee: nil,
            reviewColorLabel: nil, reviewSnoozedUntil: nil)
        return FrameRenderService.image(for: renderable, maxWidth: 1200, includeReviewLayer: true)
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
    let canCreateChange: Bool
    let onUpdate: (StoryboardReviewCommentChanges) -> Void
    let onCreateChange: () -> Void
    let onUndo: (StoryboardReviewCommentChangeDTO) -> Void

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
        canCreateChange: Bool,
        onUpdate: @escaping (StoryboardReviewCommentChanges) -> Void,
        onCreateChange: @escaping () -> Void,
        onUndo: @escaping (StoryboardReviewCommentChangeDTO) -> Void
    ) {
        self.comment = comment
        self.frame = frame
        self.rounds = rounds
        self.busy = busy
        self.canCreateChange = canCreateChange
        self.onUpdate = onUpdate
        self.onCreateChange = onCreateChange
        self.onUndo = onUndo
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
                if canCreateChange, frame != nil {
                    Button(action: onCreateChange) {
                        Label("Gjør om til endring", systemImage: "arrow.triangle.2.circlepath")
                            .font(.system(size: 11, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 32)
                    }
                    .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                    .disabled(busy)
                    .accessibilityHint("Viser før og etter før endringen kan godkjennes")
                    .accessibilityIdentifier("storyboard.review.comment.createChange.\(comment.id)")
                }
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
                if let change = activeAppliedChange {
                    VStack(alignment: .leading, spacing: 7) {
                        Label("ANVENDT ENDRING", systemImage: "checkmark.shield.fill")
                            .font(.system(size: 8, weight: .bold)).kerning(0.8)
                            .foregroundStyle(.green)
                        Text(change.fieldLabel)
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                        Text("\(change.beforeDisplayValue)  →  \(change.afterDisplayValue)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(BoardBrand.dim)
                        if canCreateChange {
                            Button { onUndo(change) } label: {
                                Label("Angre endring", systemImage: "arrow.uturn.backward")
                            }
                            .font(.system(size: 11, weight: .semibold))
                            .buttonStyle(.bordered).tint(.orange)
                            .disabled(busy)
                            .accessibilityHint("Angrer bare hvis shotfeltet ikke er endret etter godkjenning")
                            .accessibilityIdentifier("storyboard.review.comment.undoChange.\(comment.id)")
                        }
                    }
                    .padding(10)
                    .background(Color.green.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.green.opacity(0.2)))
                }
                if let note = comment.resolutionNote, !note.isEmpty {
                    Text("Løsning: \(note)")
                        .font(.system(size: 11)).foregroundStyle(.green)
                }
                if activeAppliedChange == nil {
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
    }

    private var activeAppliedChange: StoryboardReviewCommentChangeDTO? {
        let revertedIDs = Set((comment.changes ?? []).compactMap { change in
            change.operation == "undo" ? change.revertsChangeId : nil
        })
        return (comment.changes ?? []).last { change in
            change.operation == "apply" && !revertedIDs.contains(change.id)
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
        if let imagePath {
            if let cached = FrameImageCache.image(for: imagePath) {
                image = cached
                return
            }
            if let embeddedImage = decodeDataURL(imagePath) {
                FrameImageCache.images[imagePath] = embeddedImage
                image = embeddedImage
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
            if let data, let downloaded = UIImage(data: data) {
                FrameImageCache.images[imagePath] = downloaded
                image = downloaded
                return
            }
        }
        image = renderSnapshotDrawing()
    }

    @MainActor
    private func renderSnapshotDrawing() -> UIImage? {
        guard let strokes = frame.drawingData?.strokes,
              !strokes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let drawingWidth = frame.drawingData?.width ?? 1920
        let drawingHeight = frame.drawingData?.height ?? 1080
        let renderable = FrameSummary(
            id: frame.id, shotNumber: frame.shotNumber ?? "?", detail: "",
            strokesJSON: strokes, description: frame.description ?? "", notes: nil,
            shotType: nil, lensMm: nil, movement: nil, durationSec: 0,
            transition: nil, focusDepth: nil, timeOfDay: nil, weather: nil,
            beatTag: nil, tags: [], thumbnailDataURL: frame.thumbnailUrl,
            drawingWidth: drawingWidth, drawingHeight: drawingHeight,
            frameStatus: nil, comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil, perspectiveMode: nil,
            vanishingPoints: nil, voiceoverDataURL: nil, imageUrl: frame.imageUrl,
            reviewPriority: nil, reviewDueAt: nil, reviewApprovedBy: nil,
            reviewApprovedAt: nil, reviewStarred: nil, reviewAssignee: nil,
            reviewColorLabel: nil, reviewSnoozedUntil: nil)
        return FrameRenderService.image(
            for: renderable, maxWidth: 900, includeReviewLayer: true)
    }
}
