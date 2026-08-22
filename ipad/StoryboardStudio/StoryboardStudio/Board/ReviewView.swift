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
        allFrames.filter { ($0.frame.frameStatus ?? "planned") == status }
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

    func addComment(role: String, text: String, pin: CGPoint?) {
        guard let pair = selectedPair else { return }
        Task {
            let author = await RoleRoomAPIClient.shared.userDisplayName ?? "iPad"
            var existing: [[String: any Sendable]] = pair.frame.comments.map { comment in
                var dict: [String: any Sendable] = [
                    "id": comment.id, "role": comment.role, "author": comment.author,
                    "text": comment.text, "at": comment.at,
                ]
                if let x = comment.x { dict["x"] = x }
                if let y = comment.y { dict["y"] = y }
                return dict
            }
            var new: [String: any Sendable] = [
                "id": "c-\(Int(Date().timeIntervalSince1970 * 1000))",
                "role": role, "author": author, "text": text,
                "at": ISO8601DateFormatter().string(from: Date()),
            ]
            if let pin {
                new["x"] = Double(pin.x)
                new["y"] = Double(pin.y)
            }
            existing.append(new)
            patch(["frameComments": existing])
        }
    }
}

struct ReviewView: View {
    @StateObject private var state: ReviewState
    @Environment(\.dismiss) private var dismiss
    @State private var selectedVersion = 0        // 0 = gjeldende, 1..3 = historikk
    @State private var compareMode = false
    @State private var pinMode = false
    @State private var pendingPin: CGPoint?
    @State private var commentRole = "Director"
    @State private var commentText = ""
    @State private var historyVersions: [(updatedAt: String, strokes: String)] = []

    private static let roles = ["Director", "DP", "Producer", "Editor", "Artist"]

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        _state = StateObject(wrappedValue: ReviewState(project: project, manuscript: manuscript))
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
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
            } label: {
                Label("Pin", systemImage: "mappin.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(pinMode ? BoardBrand.accent : BoardBrand.dim)
            }
            .buttonStyle(.plain)
        }
    }

    private func versionImage(_ pair: (scene: SceneSummary, frame: FrameSummary),
                              version: Int) -> UIImage? {
        if version == 0 {
            return FrameRenderService.image(for: pair.frame, maxWidth: 900)
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
            reviewApprovedBy: nil, reviewApprovedAt: nil)
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
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { location in
                        guard pinMode, version == 0, !compareMode,
                              geo.size.width > 0, geo.size.height > 0 else { return }
                        pendingPin = CGPoint(x: location.x / geo.size.width,
                                             y: location.y / geo.size.height)
                    }
                }
                .aspectRatio(CGFloat(pair.frame.drawingWidth / max(1, pair.frame.drawingHeight)),
                             contentMode: .fit)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 8))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.05)).frame(height: 240)
                    .overlay(Text("Ingen tegning").foregroundStyle(BoardBrand.dim))
            }
        }
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
            Text("KOMMENTARER · \(pair.frame.comments.count)")
                .font(.system(size: 10, weight: .bold)).kerning(1)
                .foregroundStyle(BoardBrand.label)
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
                TextField(pinMode && pendingPin != nil
                          ? "Kommentar til pin \(pinnedComments(pair).count + 1)…"
                          : "Skriv en kommentar…",
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
            ForEach(pair.frame.comments) { comment in
                HStack(alignment: .top, spacing: 8) {
                    if let index = pinned.firstIndex(where: { $0.id == comment.id }) {
                        pinBadge(number: index + 1).scaleEffect(0.8)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(comment.role) · \(comment.author) · \(shortDate(comment.at))")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(BoardBrand.dim)
                        Text(comment.text)
                            .font(.system(size: 12)).foregroundStyle(.white)
                    }
                }
            }
        }
    }

    private func sendComment() {
        let text = commentText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        commentText = ""
        state.addComment(role: commentRole, text: text, pin: pendingPin)
        pendingPin = nil
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
                        inspectorRow("Type", pair.frame.shotType ?? "—")
                        inspectorRow("Lens", pair.frame.lensMm.map { "\($0)mm" } ?? "—")
                        inspectorRow("Bevegelse", pair.frame.movement ?? "—")
                        inspectorRow("Varighet", String(format: "%.1f s", pair.frame.durationSec))
                        inspectorRow("Overgang", pair.frame.transition ?? "—")
                    }
                    inspectorSection("PRODUKSJON") {
                        inspectorRow("Tid på døgnet", pair.frame.timeOfDay ?? "—")
                        inspectorRow("Vær", pair.frame.weather ?? "—")
                        if !pair.frame.tags.isEmpty {
                            inspectorRow("Tags", pair.frame.tags.joined(separator: ", "))
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
