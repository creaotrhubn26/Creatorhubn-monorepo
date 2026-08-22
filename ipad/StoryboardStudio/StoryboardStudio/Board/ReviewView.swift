import SwiftUI

// Review-flaten (mockup-paritet): kø gruppert på status, stor forhånds-
// visning med versjonsvelger (drawingHistory) og sammenligning, nummererte
// kommentar-pins på bildet, inspector med shot-info og review-status
// (prioritet/frist/godkjenning). Frittstående mot API-et — åpnes direkte
// fra hubben uten boardet.

@MainActor
final class ReviewState: ObservableObject {
    let project: ProjectSummary
    let manuscript: ManuscriptSummary
    @Published var scenes: [SceneSummary] = []
    @Published var selected: (sceneId: String, frameId: String)?
    @Published var statusFilter: String?
    @Published var roleFilter: String?
    @Published var sortMode = "Sekvens"     // Sekvens / Frist / Prioritet
    @Published var status: String?

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        self.project = project
        self.manuscript = manuscript
    }

    static let statusOrder: [(key: String, title: String, color: Color)] = [
        ("needs_work", "ENDRINGER ØNSKET", .red),
        ("planned", "TIL REVIEW", .gray),
        ("in_review", "I REVIEW", .orange),
        ("done", "GODKJENT", .green),
    ]

    var allFrames: [(scene: SceneSummary, frame: FrameSummary)] {
        scenes.flatMap { scene in scene.frames.map { (scene, $0) } }
    }

    func frames(status: String) -> [(scene: SceneSummary, frame: FrameSummary)] {
        var items = allFrames.filter { pair in
            guard (pair.frame.frameStatus ?? "planned") == status else { return false }
            // Snoozet: ute av køen til tidspunktet er passert
            if let snoozed = pair.frame.reviewSnoozedUntil,
               let until = ISO8601DateFormatter().date(from: snoozed),
               until > Date() { return false }
            return true
        }
        if let roleFilter {
            items = items.filter { pair in
                pair.frame.comments.contains { $0.role == roleFilter }
            }
        }
        switch sortMode {
        case "Frist":
            items.sort { ($0.frame.reviewDueAt ?? "9999") < ($1.frame.reviewDueAt ?? "9999") }
        case "Prioritet":
            let rank = ["Høy": 0, "Normal": 1, "Lav": 2]
            items.sort { rank[$0.frame.reviewPriority ?? "Normal", default: 1]
                       < rank[$1.frame.reviewPriority ?? "Normal", default: 1] }
        default:
            break
        }
        return items
    }

    /// Shots med minst én kommentar fra rollen (rolle-chips i toppen).
    func roleCount(_ role: String) -> Int {
        allFrames.filter { pair in pair.frame.comments.contains { $0.role == role } }.count
    }

    @Published var presentNames: [String] = []

    var reviewers: [(name: String, role: String, online: Bool)] {
        let team: [HubState.TeamMember] = HubState.decodeList(scenes.first?.hubTeam)
        return team.map { ($0.name, $0.role, presentNames.contains($0.name)) }
    }

    var selectedPair: (scene: SceneSummary, frame: FrameSummary)? {
        guard let selected else { return nil }
        guard let scene = scenes.first(where: { $0.id == selected.sceneId }),
              let frame = scene.frames.first(where: { $0.id == selected.frameId })
        else { return nil }
        return (scene, frame)
    }

    func load() async {
        if let fetched = try? await RoleRoomAPIClient.shared
            .fetchScenes(manuscriptId: manuscript.id) {
            scenes = fetched
            if selected == nil,
               let first = allFrames.first(where: { ($0.frame.frameStatus ?? "planned") != "done" })
                ?? allFrames.first {
                selected = (first.scene.id, first.frame.id)
            }
        }
        await FrameImageCache.prefetch(frames: Array(allFrames.map(\.frame).prefix(24)))
        presentNames = await RoleRoomAPIClient.shared.reportPresence(manuscriptId: manuscript.id)
    }

    /// Serialiser kommentarliste (bevarer pins/likes/tråder/lederlinjer).
    static func commentDicts(_ comments: [ReviewComment]) -> [[String: any Sendable]] {
        comments.map { comment in
            var dict: [String: any Sendable] = [
                "id": comment.id, "role": comment.role, "author": comment.author,
                "text": comment.text, "at": comment.at,
            ]
            if let x = comment.x { dict["x"] = x }
            if let y = comment.y { dict["y"] = y }
            if let parentId = comment.parentId { dict["parentId"] = parentId }
            if let likes = comment.likes { dict["likes"] = likes }
            if let targetX = comment.targetX { dict["targetX"] = targetX }
            if let targetY = comment.targetY { dict["targetY"] = targetY }
            return dict
        }
    }

    /// Redline: reviewer-strøk på lag «Review» — synlig i review og board,
    /// filtrert fra eksport. Lagres som vanlige strokes (historikk gjelder).
    func appendRedline(_ stroke: PencilStroke) {
        guard let selected, let pair = selectedPair else { return }
        let manuscriptId = manuscript.id
        status = "…"
        Task {
            do {
                var strokes = (try? StrokeSerialization.decodeFromWebJSON(
                    pair.frame.strokesJSON ?? "[]")) ?? []
                strokes.append(stroke)
                let json = try StrokeSerialization.encodeToWebJSON(strokes)
                _ = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: manuscriptId, sceneId: selected.sceneId,
                    frameId: selected.frameId, strokesJSON: json,
                    baseUpdatedAt: pair.frame.updatedAt)
                await load()
                status = "Markering lagret ✓"
            } catch {
                status = error.localizedDescription
            }
        }
    }

    func likeComment(_ commentId: String) {
        guard let pair = selectedPair else { return }
        var dicts = Self.commentDicts(pair.frame.comments)
        for index in dicts.indices where (dicts[index]["id"] as? String) == commentId {
            dicts[index]["likes"] = ((dicts[index]["likes"] as? Int) ?? 0) + 1
        }
        patch(["frameComments": dicts])
    }

    func patch(_ fields: [String: any Sendable]) {
        guard let selected else { return }
        let manuscriptId = manuscript.id
        status = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: manuscriptId, sceneId: selected.sceneId,
                    frameId: selected.frameId, fields: fields)
                await load()
                status = "Lagret ✓"
            } catch {
                status = error.localizedDescription
            }
        }
    }

    func setStatus(_ value: String) {
        var fields: [String: any Sendable] = ["frameStatus": value]
        if value == "done" {
            fields["reviewApprovedAt"] = ISO8601DateFormatter().string(from: Date())
            Task {
                let name = await RoleRoomAPIClient.shared.userDisplayName ?? "iPad"
                fields["reviewApprovedBy"] = name
                patch(fields)
            }
            return
        }
        fields["reviewApprovedBy"] = NSNull()
        fields["reviewApprovedAt"] = NSNull()
        patch(fields)
    }

    func addComment(role: String, text: String, pin: CGPoint?, pinTarget: CGPoint? = nil,
                    parentId: String? = nil) {
        guard let pair = selectedPair else { return }
        Task {
            let author = await RoleRoomAPIClient.shared.userDisplayName ?? "iPad"
            var existing = Self.commentDicts(pair.frame.comments)
            var new: [String: any Sendable] = [
                "id": "c-\(Int(Date().timeIntervalSince1970 * 1000))",
                "role": role, "author": author, "text": text,
                "at": ISO8601DateFormatter().string(from: Date()),
            ]
            if let pin {
                new["x"] = Double(pin.x)
                new["y"] = Double(pin.y)
            }
            if let pinTarget {
                new["targetX"] = Double(pinTarget.x)
                new["targetY"] = Double(pinTarget.y)
            }
            if let parentId { new["parentId"] = parentId }
            existing.append(new)
            patch(["frameComments": existing])
        }
    }
}

struct ReviewView: View {
    @StateObject private var state: ReviewState
    var storageUsed = 0
    var storageQuota: Int?
    var onNavigate: ((HubDestination) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var selectedVersion = 0        // 0 = gjeldende, 1..3 = historikk
    @State private var compareMode = false
    @State private var pinMode = false
    @State private var pendingPin: CGPoint?
    @State private var commentRole = "Director"
    @State private var commentText = ""
    @State private var historyVersions: [(updatedAt: String, strokes: String)] = []
    @State private var commentTab = "Kommentarer"
    @State private var notesDraft = ""
    @State private var replyTo: ReviewComment?
    @State private var redlineMode: String?        // nil / "arrow" / "draw"
    @State private var redlinePoints: [CGPoint] = []   // view-rom under drag
    @State private var pendingPinTarget: CGPoint?
    @State private var fullscreenPreview = false
    @State private var exportShareURL: URL?

    private static let roles = ["Director", "DP", "Producer", "Editor", "Artist"]

    init(project: ProjectSummary, manuscript: ManuscriptSummary,
         storageUsed: Int = 0, storageQuota: Int? = nil,
         onNavigate: ((HubDestination) -> Void)? = nil) {
        _state = StateObject(wrappedValue: ReviewState(project: project, manuscript: manuscript))
        self.storageUsed = storageUsed
        self.storageQuota = storageQuota
        self.onNavigate = onNavigate
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                if let onNavigate {
                    HubSidebar(projectName: state.project.name,
                               storageUsed: storageUsed, storageQuota: storageQuota,
                               active: .review) { destination in
                        onNavigate(destination)
                    }
                    Divider().overlay(BoardBrand.border)
                }
                queue
                Divider().overlay(BoardBrand.border)
                centerPane
                Divider().overlay(BoardBrand.border)
                inspector
            }
            .background(BoardBrand.chrome)
            .navigationTitle("Review — \(state.manuscript.title)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let status = state.status {
                        Text(status).font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .task { await state.load() }
        .fullScreenCover(isPresented: $fullscreenPreview) {
            ZStack(alignment: .topTrailing) {
                Color.black.ignoresSafeArea()
                if let pair = state.selectedPair,
                   let image = versionImage(pair, version: selectedVersion) {
                    Image(uiImage: image).resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                Button { fullscreenPreview = false } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28)).foregroundStyle(.white.opacity(0.8))
                        .padding(20)
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { exportShareURL != nil },
            set: { if !$0 { exportShareURL = nil } })) {
            if let url = exportShareURL { ShareSheet(items: [url]) }
        }
        .onChange(of: state.selected?.frameId) {
            selectedVersion = 0
            compareMode = false
            pendingPin = nil
            historyVersions = []
            loadHistory()
        }
    }

    private func loadHistory() {
        guard let selected = state.selected else { return }
        let manuscriptId = state.manuscript.id
        Task {
            historyVersions = await RoleRoomAPIClient.shared.frameHistory(
                manuscriptId: manuscriptId, sceneId: selected.sceneId,
                frameId: selected.frameId)
        }
    }

    // MARK: Kø

    private var queue: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Status-tellere som filter-chips
                FlowStatusChips(state: state)
                // Rolle-filtre (mockup: Director 5 / Producer 4 / …)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Self.roles, id: \.self) { role in
                            let count = state.roleCount(role)
                            if count > 0 {
                                let active = state.roleFilter == role
                                Button {
                                    state.roleFilter = active ? nil : role
                                } label: {
                                    Text("\(role) \(count)")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(active ? .white : BoardBrand.dim)
                                        .padding(.horizontal, 9).padding(.vertical, 5)
                                        .background(active ? BoardBrand.accent : Color.white.opacity(0.05),
                                                    in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                Menu {
                    Picker("Sorter", selection: Binding(
                        get: { state.sortMode }, set: { state.sortMode = $0 })) {
                        Text("Sekvens").tag("Sekvens")
                        Text("Frist").tag("Frist")
                        Text("Prioritet").tag("Prioritet")
                    }
                } label: {
                    Label("Sorter: \(state.sortMode)", systemImage: "arrow.up.arrow.down")
                        .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                }
                ForEach(ReviewState.statusOrder, id: \.key) { entry in
                    let items = state.frames(status: entry.key)
                    if !items.isEmpty,
                       state.statusFilter == nil || state.statusFilter == entry.key {
                        HStack(spacing: 6) {
                            Circle().fill(entry.color).frame(width: 7, height: 7)
                            Text("\(entry.title) · \(items.count)")
                                .font(.system(size: 10, weight: .bold)).kerning(0.5)
                                .foregroundStyle(BoardBrand.label)
                        }
                        ForEach(items, id: \.frame.id) { pair in
                            queueRow(pair)
                        }
                    }
                }
            }
            .padding(12)
        }
        .frame(width: 300)
        .background(BoardBrand.panel)
    }

    private func queueRow(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> some View {
        let isSelected = state.selected?.frameId == pair.frame.id
        return Button {
            state.selected = (pair.scene.id, pair.frame.id)
        } label: {
            HStack(alignment: .top, spacing: 9) {
                Group {
                    if let image = decodeDataURL(pair.frame.thumbnailDataURL)
                        ?? FrameImageCache.image(for: pair.frame.imageUrl) {
                        Image(uiImage: image).resizable().scaledToFill()
                    } else {
                        Rectangle().fill(Color.white.opacity(0.06))
                    }
                }
                .frame(width: 78, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(pair.frame.shotNumber)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                        Text(pair.scene.heading)
                            .font(.system(size: 9)).foregroundStyle(BoardBrand.label)
                            .lineLimit(1)
                    }
                    Text(pair.frame.description.isEmpty ? "—" : pair.frame.description)
                        .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        if !pair.frame.comments.isEmpty {
                            Label("\(pair.frame.comments.count)", systemImage: "bubble.left")
                                .font(.system(size: 9)).foregroundStyle(BoardBrand.dim)
                        }
                        if let due = dueLabel(pair.frame) {
                            Text(due.text)
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(due.urgent ? .red : BoardBrand.dim)
                        }
                        if pair.frame.reviewPriority == "Høy" {
                            Text("HØY").font(.system(size: 8, weight: .bold))
                                .foregroundStyle(.orange)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(7)
            .background(isSelected ? BoardBrand.accent.opacity(0.16) : Color.white.opacity(0.02),
                        in: RoundedRectangle(cornerRadius: 9))
            .overlay(alignment: .leading) {
                if let hex = pair.frame.reviewColorLabel, let color = Color(hex: hex) {
                    RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 3)
                        .padding(.vertical, 6)
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 9)
                .stroke(isSelected ? BoardBrand.accent : .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func dueLabel(_ frame: FrameSummary) -> (text: String, urgent: Bool)? {
        guard let dueAt = frame.reviewDueAt,
              let date = ISO8601DateFormatter().date(from: dueAt) else { return nil }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "nb_NO")
        let text = "Frist \(formatter.localizedString(for: date, relativeTo: Date()))"
        return (text, date.timeIntervalSinceNow < 86_400)
    }

    // MARK: Midtfelt

    private var centerPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let pair = state.selectedPair {
                    headerRow(pair)
                    previewArea(pair)
                    sceneContext(pair)
                    commentsSection(pair)
                } else {
                    Text("Velg et shot i køen").foregroundStyle(BoardBrand.dim).padding(40)
                }
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity)
    }

    private func headerRow(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> some View {
        HStack(spacing: 10) {
            Text(pair.frame.shotNumber)
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
            Text(pair.scene.heading.uppercased())
                .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            Text(pair.frame.description)
                .font(.system(size: 13)).foregroundStyle(.white).lineLimit(1)
            statusBadge(pair.frame)
            Button {
                state.patch(["reviewStarred": !(pair.frame.reviewStarred ?? false)])
            } label: {
                Image(systemName: (pair.frame.reviewStarred ?? false) ? "star.fill" : "star")
                    .font(.system(size: 14))
                    .foregroundStyle((pair.frame.reviewStarred ?? false) ? .yellow : BoardBrand.dim)
            }
            .buttonStyle(.plain)
            // Tildelt person (hubTeam)
            Menu {
                ForEach(Array(state.reviewers.enumerated()), id: \.offset) { _, reviewer in
                    Button(reviewer.name) {
                        state.patch(["reviewAssignee": reviewer.name])
                    }
                }
                if pair.frame.reviewAssignee != nil {
                    Button("Fjern tildeling", role: .destructive) {
                        state.patch(["reviewAssignee": NSNull()])
                    }
                }
            } label: {
                Label(pair.frame.reviewAssignee ?? "Tildel",
                      systemImage: "person.crop.circle")
                    .font(.system(size: 11))
                    .foregroundStyle(pair.frame.reviewAssignee != nil
                                     ? BoardBrand.accent : BoardBrand.dim)
            }
            if let due = dueLabel(pair.frame) {
                Text(due.text)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(due.urgent ? .red : BoardBrand.dim)
            }
            Spacer()
            // Versjonsvelger (drawingHistory)
            if !historyVersions.isEmpty {
                Menu {
                    Button("Gjeldende versjon") { selectedVersion = 0 }
                    ForEach(Array(historyVersions.enumerated()), id: \.offset) { index, version in
                        Button("Versjon −\(index + 1) (\(shortDate(version.updatedAt)))") {
                            selectedVersion = index + 1
                        }
                    }
                } label: {
                    Label(selectedVersion == 0 ? "Gjeldende" : "Versjon −\(selectedVersion)",
                          systemImage: "clock.arrow.circlepath")
                        .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                }
                Button {
                    compareMode.toggle()
                    if compareMode && selectedVersion == 0 { selectedVersion = 1 }
                } label: {
                    Label("Sammenlign", systemImage: "rectangle.split.2x1")
                        .font(.system(size: 12))
                        .foregroundStyle(compareMode ? BoardBrand.accent : BoardBrand.dim)
                }
                .buttonStyle(.plain)
            }
            Button {
                pinMode.toggle()
                pendingPin = nil
                pendingPinTarget = nil
                redlineMode = nil
            } label: {
                Label("Pin", systemImage: "mappin.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(pinMode ? BoardBrand.accent : BoardBrand.dim)
            }
            .buttonStyle(.plain)
            // Redlines: reviewer tegner pil/frihånd oppå panelet
            Button {
                redlineMode = redlineMode == "arrow" ? nil : "arrow"
                pinMode = false
            } label: {
                Label("Pil", systemImage: "arrow.up.right")
                    .font(.system(size: 12))
                    .foregroundStyle(redlineMode == "arrow" ? BoardBrand.accent : BoardBrand.dim)
            }
            .buttonStyle(.plain)
            Button {
                redlineMode = redlineMode == "draw" ? nil : "draw"
                pinMode = false
            } label: {
                Label("Tegn", systemImage: "scribble")
                    .font(.system(size: 12))
                    .foregroundStyle(redlineMode == "draw" ? BoardBrand.accent : BoardBrand.dim)
            }
            .buttonStyle(.plain)
            Button { fullscreenPreview = true } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            }
            .buttonStyle(.plain)
            Menu {
                Button {
                    exportShareURL = FrameRenderService.exportPNG(
                        frame: pair.frame, projectTitle: state.manuscript.title)
                } label: {
                    Label("Eksporter PNG", systemImage: "photo")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            }
        }
    }

    /// Status-badge i headeren (mockup: «In Review»-chipen).
    private func statusBadge(_ frame: FrameSummary) -> some View {
        let entry = ReviewState.statusOrder.first {
            $0.key == (frame.frameStatus ?? "planned")
        }
        return Text(entry?.title.capitalized ?? "Planlagt")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((entry?.color ?? .gray).opacity(0.7), in: Capsule())
    }

    private func versionImage(_ pair: (scene: SceneSummary, frame: FrameSummary),
                              version: Int) -> UIImage? {
        if version == 0 {
            return FrameRenderService.image(for: pair.frame, maxWidth: 900,
                                            includeReviewLayer: true)
                ?? decodeDataURL(pair.frame.thumbnailDataURL)
        }
        guard historyVersions.indices.contains(version - 1) else { return nil }
        let history = historyVersions[version - 1]
        let ghost = FrameSummary(
            id: "\(pair.frame.id)-v\(version)", shotNumber: pair.frame.shotNumber,
            detail: "", strokesJSON: history.strokes,
            description: "", notes: nil, shotType: nil, lensMm: nil, movement: nil,
            durationSec: 0, transition: nil, focusDepth: nil, timeOfDay: nil,
            weather: nil, beatTag: nil, tags: [], thumbnailDataURL: nil,
            drawingWidth: pair.frame.drawingWidth, drawingHeight: pair.frame.drawingHeight,
            frameStatus: nil, comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil,
            perspectiveMode: nil, vanishingPoints: nil, voiceoverDataURL: nil,
            imageUrl: pair.frame.imageUrl,
            reviewPriority: nil, reviewDueAt: nil,
            reviewApprovedBy: nil, reviewApprovedAt: nil, reviewStarred: nil,
            reviewAssignee: nil, reviewColorLabel: nil, reviewSnoozedUntil: nil)
        return FrameRenderService.image(for: ghost, maxWidth: 900)
    }

    private func previewArea(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> some View {
        VStack(spacing: 10) {
            if compareMode {
                HStack(spacing: 10) {
                    labeledPreview(pair, version: selectedVersion,
                                   label: "Versjon −\(max(1, selectedVersion))")
                    labeledPreview(pair, version: 0, label: "Gjeldende")
                }
            } else {
                labeledPreview(pair, version: selectedVersion,
                               label: selectedVersion == 0 ? nil : "Versjon −\(selectedVersion)")
            }
        }
    }

    private func labeledPreview(_ pair: (scene: SceneSummary, frame: FrameSummary),
                                version: Int, label: String?) -> some View {
        VStack(spacing: 4) {
            if let label {
                Text(label).font(.system(size: 10, weight: .bold))
                    .foregroundStyle(BoardBrand.label)
            }
            if let image = versionImage(pair, version: version) {
                GeometryReader { geo in
                    ZStack(alignment: .topLeading) {
                        Image(uiImage: image).resizable().scaledToFit()
                        // Kommentar-pins (kun på gjeldende, ikke i compare)
                        if version == 0 && !compareMode {
                            ForEach(Array(pinnedComments(pair).enumerated()),
                                    id: \.element.id) { index, comment in
                                pinBadge(number: index + 1)
                                    .position(x: CGFloat(comment.x ?? 0) * geo.size.width,
                                              y: CGFloat(comment.y ?? 0) * geo.size.height)
                            }
                            if let pendingPin {
                                pinBadge(number: pinnedComments(pair).count + 1, pending: true)
                                    .position(x: pendingPin.x * geo.size.width,
                                              y: pendingPin.y * geo.size.height)
                            }
                        }
                    // Redline-preview under drag
                    if redlineMode != nil && redlinePoints.count > 1 {
                        Path { path in
                            path.move(to: redlinePoints[0])
                            if redlineMode == "arrow", let last = redlinePoints.last {
                                path.addLine(to: last)
                            } else {
                                for point in redlinePoints.dropFirst() { path.addLine(to: point) }
                            }
                        }
                        .stroke(Color(red: 0.25, green: 0.5, blue: 1),
                                style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    }
                    // Pin-lederlinjer (badge → målpunkt)
                    if version == 0 && !compareMode {
                        Canvas { context, size in
                            for comment in pinnedComments(pair) {
                                guard let targetX = comment.targetX,
                                      let targetY = comment.targetY,
                                      let x = comment.x, let y = comment.y else { continue }
                                let from = CGPoint(x: x * size.width, y: y * size.height)
                                let to = CGPoint(x: targetX * size.width, y: targetY * size.height)
                                var path = Path()
                                path.move(to: from)
                                path.addQuadCurve(to: to, control: CGPoint(
                                    x: (from.x + to.x) / 2,
                                    y: min(from.y, to.y) - 20))
                                context.stroke(path, with: .color(Color(red: 0.25, green: 0.5, blue: 1)),
                                               lineWidth: 2)
                                context.fill(Path(ellipseIn: CGRect(x: to.x - 3, y: to.y - 3,
                                                                    width: 6, height: 6)),
                                             with: .color(Color(red: 0.25, green: 0.5, blue: 1)))
                            }
                        }
                        .allowsHitTesting(false)
                    }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { location in
                        guard version == 0, !compareMode,
                              geo.size.width > 0, geo.size.height > 0 else { return }
                        let normalized = CGPoint(x: location.x / geo.size.width,
                                                 y: location.y / geo.size.height)
                        if pinMode {
                            if pendingPin == nil {
                                pendingPin = normalized
                            } else if pendingPinTarget == nil {
                                // Andre tap = lederlinje-mål (valgfritt)
                                pendingPinTarget = normalized
                            } else {
                                pendingPin = normalized
                                pendingPinTarget = nil
                            }
                        }
                    }
                    .gesture(
                        redlineMode == nil ? nil :
                        DragGesture(minimumDistance: 2)
                            .onChanged { redlinePoints.append($0.location) }
                            .onEnded { _ in
                                commitRedline(pair, viewSize: geo.size)
                                redlinePoints = []
                            }
                    )
                }
                .aspectRatio(CGFloat(pair.frame.drawingWidth / max(1, pair.frame.drawingHeight)),
                             contentMode: .fit)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 8))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                // CAM/DUR som caption-rad UNDER panelet (mockup-stilen)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.05)).frame(height: 240)
                    .overlay(Text("Ingen tegning").foregroundStyle(BoardBrand.dim))
            }
            captionRow(pair.frame)
        }
    }

    /// Scenens øvrige shots stablet under (mockupens panel 1/2-stabel) —
    /// klippet i kontekst; tap bytter valgt shot.
    @ViewBuilder
    private func sceneContext(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> some View {
        let others = pair.scene.frames.filter { $0.id != pair.frame.id }
        if !others.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("SCENEN · \(pair.scene.frames.count) SHOTS")
                    .font(.system(size: 10, weight: .bold)).kerning(1)
                    .foregroundStyle(BoardBrand.label)
                ForEach(Array(others.enumerated()), id: \.element.id) { _, frame in
                    Button {
                        state.selected = (pair.scene.id, frame.id)
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Text(frame.shotNumber)
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(BoardBrand.label)
                                .frame(width: 30, alignment: .leading)
                            VStack(spacing: 3) {
                                Group {
                                    if let image = decodeDataURL(frame.thumbnailDataURL)
                                        ?? FrameImageCache.image(for: frame.imageUrl) {
                                        Image(uiImage: image).resizable().scaledToFit()
                                    } else {
                                        Rectangle().fill(Color.white.opacity(0.05))
                                            .aspectRatio(16 / 9, contentMode: .fit)
                                    }
                                }
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 6))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                captionRow(frame)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func captionRow(_ frame: FrameSummary) -> some View {
        HStack {
            Text(["CAM", frame.shotType, frame.lensMm.map { "\($0)mm" }]
                .compactMap(\.self).joined(separator: "  ·  "))
            Spacer()
            Text(String(format: "DUR: %.1fs", frame.durationSec))
        }
        .font(.system(size: 10, weight: .semibold, design: .monospaced))
        .foregroundStyle(BoardBrand.dim)
        .padding(.horizontal, 2)
    }

    /// Konverter view-punkter → innholdsrom og lagre som Review-lag-strøk.
    private func commitRedline(_ pair: (scene: SceneSummary, frame: FrameSummary),
                               viewSize: CGSize) {
        guard redlinePoints.count > 1, viewSize.width > 0 else { return }
        let scaleX = pair.frame.drawingWidth / viewSize.width
        let scaleY = pair.frame.drawingHeight / viewSize.height
        var t = Date().timeIntervalSince1970 * 1000
        func point(_ p: CGPoint) -> StrokePoint {
            t += 8
            return StrokePoint(x: Double(p.x) * scaleX, y: Double(p.y) * scaleY,
                               pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: t)
        }
        var points: [StrokePoint]
        if redlineMode == "arrow", let first = redlinePoints.first,
           let last = redlinePoints.last {
            // Pil: linje + hode (samme geometri som boardets pil-verktøy)
            let sx = Double(first.x) * scaleX, sy = Double(first.y) * scaleY
            let ex = Double(last.x) * scaleX, ey = Double(last.y) * scaleY
            let angle = atan2(ey - sy, ex - sx)
            let head = 34.0
            points = [CGPoint(x: sx, y: sy), CGPoint(x: ex, y: ey),
                      CGPoint(x: ex - cos(angle - 0.45) * head, y: ey - sin(angle - 0.45) * head),
                      CGPoint(x: ex, y: ey),
                      CGPoint(x: ex - cos(angle + 0.45) * head, y: ey - sin(angle + 0.45) * head)]
                .map { p in
                    t += 8
                    return StrokePoint(x: Double(p.x), y: Double(p.y),
                                       pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: t)
                }
        } else {
            points = redlinePoints.map(point)
        }
        var brush = BrushSpec.preset(.ink, size: 6, color: "#3b82f6", opacity: 0.95)
        brush.grain = 0
        let stroke = PencilStroke(
            id: "review-\(Int(t))", points: points, inputType: "pencil",
            color: "#3b82f6", width: 6, opacity: 0.95,
            brush: brush, boardLayer: "Review")
        state.appendRedline(stroke)
    }

    private func pinnedComments(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> [ReviewComment] {
        pair.frame.comments.filter { $0.x != nil && $0.y != nil }
    }

    private func pinBadge(number: Int, pending: Bool = false) -> some View {
        Text("\(number)")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(pending ? Color.orange : Color(red: 0.25, green: 0.5, blue: 1),
                        in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 1.5))
    }

    private func commentsSection(_ pair: (scene: SceneSummary, frame: FrameSummary)) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                ForEach(["Kommentarer", "Notater"], id: \.self) { tab in
                    Button {
                        commentTab = tab
                        if tab == "Notater" { notesDraft = pair.frame.notes ?? "" }
                    } label: {
                        Text(tab == "Kommentarer"
                             ? "KOMMENTARER · \(pair.frame.comments.count)" : "NOTATER")
                            .font(.system(size: 10, weight: .bold)).kerning(1)
                            .foregroundStyle(commentTab == tab ? .white : BoardBrand.label)
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                // Reviewere (hubTeam) m/ presence
                if !state.reviewers.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(Array(state.reviewers.enumerated()), id: \.offset) { _, reviewer in
                            HStack(spacing: 3) {
                                Circle().fill(reviewer.online ? Color.green : Color.white.opacity(0.25))
                                    .frame(width: 6, height: 6)
                                Text(reviewer.name)
                                    .font(.system(size: 9)).foregroundStyle(BoardBrand.dim)
                            }
                        }
                    }
                }
            }
            if commentTab == "Notater" {
                TextField("Notater til shotet …", text: $notesDraft, axis: .vertical)
                    .lineLimit(4...10)
                    .font(.system(size: 12)).foregroundStyle(.white)
                    .padding(9)
                    .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 9))
                Button("Lagre notater") {
                    state.patch(["notes": notesDraft])
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(BoardBrand.accent)
                .buttonStyle(.plain)
            } else {
            EmptyView()
            HStack(spacing: 8) {
                Menu {
                    ForEach(Self.roles, id: \.self) { role in
                        Button(role) { commentRole = role }
                    }
                } label: {
                    Text(commentRole)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BoardBrand.accent)
                }
                TextField(replyTo != nil
                          ? "Svar til \(replyTo?.author ?? "")…"
                          : (pinMode && pendingPin != nil
                             ? "Kommentar til pin \(pinnedComments(pair).count + 1)…"
                             : "Skriv en kommentar…"),
                          text: $commentText)
                    .font(.system(size: 12)).foregroundStyle(.white)
                    .onSubmit { sendComment() }
                Button {
                    sendComment()
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 12)).foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(BoardBrand.accent, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(commentText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(9)
            .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 9))
            let pinned = pinnedComments(pair)
            let roots = pair.frame.comments.filter { $0.parentId == nil }
            ForEach(roots) { comment in
                commentRow(comment, pinned: pinned, indent: 0)
                ForEach(pair.frame.comments.filter { $0.parentId == comment.id }) { reply in
                    commentRow(reply, pinned: pinned, indent: 1)
                }
            }
            }
        }
    }

    private func commentRow(_ comment: ReviewComment,
                            pinned: [ReviewComment], indent: Int) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if indent > 0 {
                Rectangle().fill(BoardBrand.border).frame(width: 2)
                    .padding(.leading, 10)
            }
            if let index = pinned.firstIndex(where: { $0.id == comment.id }) {
                pinBadge(number: index + 1).scaleEffect(0.8)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("\(comment.role) · \(comment.author) · \(shortDate(comment.at))")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(BoardBrand.dim)
                Text(comment.text)
                    .font(.system(size: 12)).foregroundStyle(.white)
                HStack(spacing: 12) {
                    if indent == 0 {
                        Button("Svar") { replyTo = comment }
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(BoardBrand.accent)
                            .buttonStyle(.plain)
                    }
                    Button {
                        state.likeComment(comment.id)
                    } label: {
                        Label("\((comment.likes ?? 0))", systemImage: "hand.thumbsup")
                            .font(.system(size: 10))
                            .foregroundStyle((comment.likes ?? 0) > 0 ? BoardBrand.accent : BoardBrand.dim)
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func sendComment() {
        let text = commentText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        commentText = ""
        state.addComment(role: commentRole, text: text,
                         pin: replyTo == nil ? pendingPin : nil,
                         pinTarget: replyTo == nil ? pendingPinTarget : nil,
                         parentId: replyTo?.id)
        replyTo = nil
        pendingPin = nil
        pendingPinTarget = nil
        pinMode = false
    }

    private func shortDate(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return iso }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "nb_NO")
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    // MARK: Inspector

    private var inspector: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let pair = state.selectedPair {
                    inspectorSection("SHOT-INFO") {
                        inspectorRow("Scene / shot", pair.frame.shotNumber)
                        // Redigerbart (mockup-dropdowns) — patcher framen direkte
                        editRow("Type", value: pair.frame.shotType,
                                options: ["WS", "MS", "CU", "ECU", "OTS", "POV", "INSERT"],
                                key: "shotType")
                        editRow("Lens", value: pair.frame.lensMm.map { "\($0)mm" },
                                options: ["18mm", "24mm", "35mm", "50mm", "85mm", "135mm"],
                                key: "lensMm", transform: { Int($0.dropLast(2)) ?? 35 })
                        editRow("Bevegelse", value: pair.frame.movement,
                                options: ["Static", "Pan", "Tilt", "Dolly", "Handheld", "Crane"],
                                key: "movement")
                        inspectorRow("Varighet", String(format: "%.1f s", pair.frame.durationSec))
                        editRow("Overgang", value: pair.frame.transition,
                                options: ["Cut", "Dissolve", "Match Cut", "Smash Cut", "Wipe", "Fade"],
                                key: "transition")
                    }
                    inspectorSection("PRODUKSJON") {
                        editRow("Tid på døgnet", value: pair.frame.timeOfDay,
                                options: ["Day", "Night", "Dawn", "Dusk"], key: "timeOfDay")
                        editRow("Vær", value: pair.frame.weather,
                                options: ["Clear", "Overcast", "Rain", "Snow", "Fog"], key: "weather")
                        // Tags med fjerning + tillegg
                        FlowTags(tags: pair.frame.tags) { removed in
                            state.patch(["tags": pair.frame.tags.filter { $0 != removed }])
                        }
                        HStack(spacing: 6) {
                            TextField("Ny tag", text: $newTag)
                                .font(.system(size: 11)).foregroundStyle(.white)
                                .textInputAutocapitalization(.characters)
                                .onSubmit { addTag(pair) }
                            Button { addTag(pair) } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 10)).foregroundStyle(.white)
                                    .frame(width: 20, height: 20)
                                    .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 6))
                            }
                            .buttonStyle(.plain)
                        }
                        // Fargelabels (mockup-swatchene)
                        HStack(spacing: 7) {
                            ForEach(Self.colorLabels, id: \.self) { hex in
                                Button {
                                    state.patch(["reviewColorLabel":
                                        pair.frame.reviewColorLabel == hex ? NSNull() : hex])
                                } label: {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color(hex: hex) ?? .gray)
                                        .frame(width: 22, height: 16)
                                        .overlay(RoundedRectangle(cornerRadius: 4)
                                            .stroke(pair.frame.reviewColorLabel == hex
                                                    ? .white : BoardBrand.border,
                                                    lineWidth: pair.frame.reviewColorLabel == hex ? 2 : 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    inspectorSection("REVIEW-STATUS") {
                        Picker("Prioritet", selection: Binding(
                            get: { pair.frame.reviewPriority ?? "Normal" },
                            set: { state.patch(["reviewPriority": $0]) })) {
                            Text("Lav").tag("Lav")
                            Text("Normal").tag("Normal")
                            Text("Høy").tag("Høy")
                        }
                        .pickerStyle(.segmented)
                        DatePicker("Frist",
                                   selection: Binding(
                                    get: {
                                        pair.frame.reviewDueAt
                                            .flatMap { ISO8601DateFormatter().date(from: $0) }
                                        ?? Date().addingTimeInterval(86_400)
                                    },
                                    set: { state.patch([
                                        "reviewDueAt": ISO8601DateFormatter().string(from: $0),
                                    ]) }),
                                   displayedComponents: .date)
                            .font(.system(size: 12))
                            .colorScheme(.dark)
                        if let approvedBy = pair.frame.reviewApprovedBy {
                            inspectorRow("Godkjent av", approvedBy)
                            inspectorRow("Dato", pair.frame.reviewApprovedAt.map(shortDate) ?? "—")
                        }
                    }
                    VStack(spacing: 8) {
                        Button {
                            state.setStatus("done")
                        } label: {
                            Label("Godkjenn shot", systemImage: "checkmark.circle.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.green.opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
                                .foregroundStyle(.white)
                        }
                        .buttonStyle(.plain)
                        Button {
                            state.setStatus("needs_work")
                        } label: {
                            Label("Be om endringer", systemImage: "arrow.uturn.backward.circle")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.red.opacity(0.75), in: RoundedRectangle(cornerRadius: 10))
                                .foregroundStyle(.white)
                        }
                        .buttonStyle(.plain)
                        Button("Sett til I review") { state.setStatus("in_review") }
                            .font(.system(size: 12))
                            .foregroundStyle(BoardBrand.dim)
                            .buttonStyle(.plain)
                        Button {
                            let until = Date().addingTimeInterval(86_400)
                            state.patch(["reviewSnoozedUntil":
                                ISO8601DateFormatter().string(from: until)])
                        } label: {
                            Label("Utsett 24 t", systemImage: "zzz")
                                .font(.system(size: 12))
                                .foregroundStyle(BoardBrand.dim)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
        }
        .frame(width: 300)
        .background(BoardBrand.panel)
    }

    private func inspectorSection<Content: View>(_ title: String,
                                                 @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 10, weight: .bold)).kerning(1)
                .foregroundStyle(BoardBrand.label)
            content()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 10))
    }

    @State private var newTag = ""

    static let colorLabels = ["#ffffff", "#8b5cf6", "#ef6a6a", "#f0c243",
                              "#4caf7d", "#3bb8c4"]

    private func addTag(_ pair: (scene: SceneSummary, frame: FrameSummary)) {
        let tag = newTag.trimmingCharacters(in: .whitespaces).uppercased()
        newTag = ""
        guard !tag.isEmpty, !pair.frame.tags.contains(tag) else { return }
        state.patch(["tags": pair.frame.tags + [tag]])
    }

    /// Redigerbar inspector-rad (mockup-dropdown): meny som patcher feltet.
    private func editRow(_ label: String, value: String?, options: [String],
                         key: String,
                         transform: ((String) -> any Sendable)? = nil) -> some View {
        HStack {
            Text(label).font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
            Spacer()
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) {
                        state.patch([key: transform?(option) ?? option])
                    }
                }
            } label: {
                HStack(spacing: 3) {
                    Text(value ?? "—")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 7)).foregroundStyle(BoardBrand.label)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    private func inspectorRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
            Spacer()
            Text(value).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
        }
    }
}

// Status-tellere som filter-chips (egen view — holder body lesbar).
private struct FlowStatusChips: View {
    @ObservedObject var state: ReviewState

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                chip(title: "Alle", count: state.allFrames.count, key: nil)
                ForEach(ReviewState.statusOrder, id: \.key) { entry in
                    let count = state.frames(status: entry.key).count
                    if count > 0 {
                        chip(title: entry.title.capitalized, count: count, key: entry.key)
                    }
                }
            }
        }
    }

    private func chip(title: String, count: Int, key: String?) -> some View {
        let active = state.statusFilter == key
        return Button {
            state.statusFilter = key
        } label: {
            Text("\(title) \(count)")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(active ? .white : BoardBrand.dim)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(active ? BoardBrand.accent : Color.white.opacity(0.05),
                            in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
