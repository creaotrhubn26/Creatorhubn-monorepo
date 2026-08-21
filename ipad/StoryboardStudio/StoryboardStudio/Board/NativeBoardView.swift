import SwiftUI
import UIKit

// Native Board Pro — mockup-flaten («Neon City», STORYBOARD_DESIGN.md §4b)
// i SwiftUI rundt Metal-motoren, med Role Room-brand (fiolett aksent).
// Aktiv shot-rute er en LIVE PencilCanvasView (predicted touches, stamp-
// commit); inaktive ruter viser synkede thumbnails. Inspector patcher
// frame-felter rett mot samme scene-upsert som web.

private enum BoardBrand {
    static let accent = Color(red: 0.545, green: 0.361, blue: 0.965)      // #8b5cf6
    static let chrome = Color(red: 0.043, green: 0.043, blue: 0.055)      // #0b0b0e
    static let panel = Color(red: 0.078, green: 0.082, blue: 0.098)
    static let border = Color.white.opacity(0.07)
    static let dim = Color.white.opacity(0.55)
    static let label = Color.white.opacity(0.42)
    static let workspace = Color(red: 0.235, green: 0.243, blue: 0.267)
    static let sheet = Color(red: 0.969, green: 0.965, blue: 0.949)
    static let inkOnSheet = Color(red: 0.2, green: 0.204, blue: 0.227)
    static let handwriting = "Bradley Hand"                               // innebygd iOS-håndskrift
}

private func panelLabel(_ text: String) -> some View {
    Text(text.uppercased())
        .font(.system(size: 10.5, weight: .bold))
        .kerning(1.1)
        .foregroundStyle(BoardBrand.label)
}

// Ray casting — punkt-i-polygon for lasso-utvalg.
private func pointInPolygon(_ point: CGPoint, polygon: [CGPoint]) -> Bool {
    guard polygon.count > 2 else { return false }
    var inside = false
    var j = polygon.count - 1
    for i in 0..<polygon.count {
        let a = polygon[i], b = polygon[j]
        if (a.y > point.y) != (b.y > point.y),
           point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x {
            inside.toggle()
        }
        j = i
    }
    return inside
}

private func decodeDataURL(_ dataURL: String?) -> UIImage? {
    guard let dataURL, dataURL.hasPrefix("data:"),
          let comma = dataURL.firstIndex(of: ","),
          let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else { return nil }
    return UIImage(data: data)
}

@MainActor
final class BoardState: ObservableObject {
    let manuscript: ManuscriptSummary
    let projectId: String?
    @Published var scenes: [SceneSummary] = []
    @Published var selectedSceneIndex = 0
    @Published var activeFrameIndex = 0
    @Published var errorMessage: String?
    @Published var syncStatus: String?

    init(manuscript: ManuscriptSummary, projectId: String? = nil) {
        self.manuscript = manuscript
        self.projectId = projectId
    }

    var scene: SceneSummary? { scenes.indices.contains(selectedSceneIndex) ? scenes[selectedSceneIndex] : nil }
    var frame: FrameSummary? {
        guard let scene, scene.frames.indices.contains(activeFrameIndex) else { return nil }
        return scene.frames[activeFrameIndex]
    }

    func reload() async {
        do {
            scenes = try await RoleRoomAPIClient.shared.fetchScenes(manuscriptId: manuscript.id)
            selectedSceneIndex = min(selectedSceneIndex, max(0, scenes.count - 1))
            // Behold aktivt shot (klemt) — reset til 0 kastet brukeren tilbake
            // til første shot ved hver Inspector-patch.
            activeFrameIndex = min(activeFrameIndex, max(0, (scene?.frames.count ?? 1) - 1))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addShot() {
        guard let scene else { return }
        runMutation("Shot lagt til ✓") {
            try await RoleRoomAPIClient.shared.addFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id)
        }
    }

    func deleteShot(frameId: String) {
        guard let scene else { return }
        runMutation("Shot slettet ✓") {
            try await RoleRoomAPIClient.shared.deleteFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId)
            return nil
        }
    }

    func duplicateShot(frameId: String) {
        guard let scene else { return }
        runMutation("Shot duplisert ✓") {
            try await RoleRoomAPIClient.shared.duplicateFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId)
        }
    }

    func moveShot(frameId: String, offset: Int) {
        guard let scene else { return }
        runMutation("Flyttet ✓") {
            try await RoleRoomAPIClient.shared.moveFrame(
                manuscriptId: self.manuscript.id, sceneId: scene.id, frameId: frameId, offset: offset)
            return frameId
        }
    }

    func addScene(title: String) {
        syncStatus = "…"
        Task {
            do {
                let sceneId = try await RoleRoomAPIClient.shared.addScene(
                    manuscriptId: manuscript.id, title: title, projectId: projectId)
                await reload()
                if let index = scenes.firstIndex(where: { $0.id == sceneId }) {
                    selectedSceneIndex = index
                    activeFrameIndex = 0
                }
                syncStatus = "Scene opprettet ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    /// Kjør frame-mutasjon → reload → velg returnert frame-id (om noen).
    private func runMutation(_ successStatus: String, _ work: @escaping () async throws -> String?) {
        syncStatus = "…"
        Task {
            do {
                let focusId = try await work()
                await reload()
                if let focusId, let index = scene?.frames.firstIndex(where: { $0.id == focusId }) {
                    activeFrameIndex = index
                }
                syncStatus = successStatus
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func patchActiveFrame(_ fields: [String: any Sendable]) {
        guard let frame else { return }
        patchFrame(frameId: frame.id, fields: fields)
    }

    func patchFrame(frameId: String, fields: [String: any Sendable]) {
        guard let scene else { return }
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: manuscript.id, sceneId: scene.id, frameId: frameId, fields: fields)
                await reload()
                syncStatus = "Synket ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    /// Review: sett status (planned/in_review/needs_work/done).
    func setFrameStatus(frameId: String, status: String) {
        patchFrame(frameId: frameId, fields: ["frameStatus": status])
    }

    /// Review: legg til rollekommentar (web StoryboardFrameComment-form).
    func addComment(frameId: String, role: String, text: String) {
        guard let frame = scene?.frames.first(where: { $0.id == frameId }) else { return }
        Task {
            let author = await RoleRoomAPIClient.shared.userDisplayName ?? "iPad"
            let existing: [[String: String]] = frame.comments.map {
                ["id": $0.id, "role": $0.role, "author": $0.author, "text": $0.text, "at": $0.at]
            }
            let new: [String: String] = [
                "id": "c-\(Int(Date().timeIntervalSince1970 * 1000))",
                "role": role,
                "author": author,
                "text": text,
                "at": ISO8601DateFormatter().string(from: Date()),
            ]
            patchFrame(frameId: frameId, fields: ["frameComments": existing + [new]])
        }
    }
}

// Verktøyraden over arket (mockup): select | tegn/viskelær | pil/rekt/tekst.
enum BoardTool: String, CaseIterable {
    case select, draw, eraser, arrow, rect, text
    var icon: String {
        switch self {
        case .select: return "cursorarrow"
        case .draw: return "paintbrush.pointed"
        case .eraser: return "eraser"
        case .arrow: return "arrow.up.right"
        case .rect: return "rectangle"
        case .text: return "textformat"
        }
    }
}

struct NativeBoardView: View {
    @StateObject private var board: BoardState
    @StateObject private var canvasState = CanvasState()
    @State private var renderer = MetalStrokeRenderer()
    @State private var showAnimatic = false
    @State private var showShotList = false
    @State private var showScript = false
    @State private var showReview = false
    @State private var exportPDFURL: URL?
    @State private var boardTool: BoardTool = .draw
    @State private var textPromptShown = false
    @State private var textPromptValue = ""
    @State private var textPromptPoint: CGPoint = .zero
    @State private var sheetZoom: Double = 1.0
    @State private var scrollTarget: Int?
    @State private var showFullscreenDraw = false
    @State private var showBrushEditor = false
    @State private var toneReport: ToneReport?
    @State private var showToneReport = false
    @State private var pendingDeleteFrameId: String?
    @State private var newSceneTitle = ""
    @State private var showNewScenePrompt = false
    @Environment(\.dismiss) private var dismiss

    init(manuscript: ManuscriptSummary, projectId: String? = nil) {
        _board = StateObject(wrappedValue: BoardState(manuscript: manuscript, projectId: projectId))
    }

    var body: some View {
        VStack(spacing: 0) {
            topbar
            Divider().overlay(BoardBrand.border)
            HStack(spacing: 0) {
                scenesColumn
                Divider().overlay(BoardBrand.border)
                sheetArea
                Divider().overlay(BoardBrand.border)
                inspector
            }
            Divider().overlay(BoardBrand.border)
            brushBar
        }
        .background(BoardBrand.chrome)
        .navigationBarHidden(true)
        .fullScreenCover(isPresented: $showAnimatic) {
            AnimaticView(sceneHeading: board.scene?.heading ?? "",
                         frames: board.scene?.frames ?? [])
        }
        .fullScreenCover(isPresented: $showFullscreenDraw) {
            if let frame = board.frame {
                FullscreenDrawView(canvasState: canvasState, frame: frame)
            }
        }
        .task { await board.reload() }
        .onChange(of: board.activeFrameIndex) { loadActiveFrameIntoCanvas() }
        .onChange(of: board.selectedSceneIndex) { board.activeFrameIndex = 0; loadActiveFrameIntoCanvas() }
        .onChange(of: board.scenes.count) { loadActiveFrameIntoCanvas() }
        .onChange(of: canvasState.revision) { scheduleAutosync() }
        .onChange(of: boardTool) { selectedStrokeIds = [] }
    }

    // Forrige lastede frame + strøkantall — usynkede strøk flushes automatisk
    // ved shot-/scenebytte så tegning ikke mistes uten eksplisitt Synk.
    @State private var loadedFrameRef: (sceneId: String, frameId: String)?
    @State private var loadedRevision = 0

    private func loadActiveFrameIntoCanvas() {
        flushPendingStrokes()
        autosyncTask?.cancel()
        canvasState.contentSize = board.frame.map {
            CGSize(width: $0.drawingWidth, height: $0.drawingHeight)
        }
        // Pending-backup (app drept før synk) er alltid nyere enn serverens
        // versjon — gjenopprett og synk den.
        var restoredPending = false
        if let frameId = board.frame?.id,
           let pending = PendingStrokeStore.load(frameId: frameId),
           let strokes = try? StrokeSerialization.decodeFromWebJSON(pending) {
            canvasState.strokes = strokes
            restoredPending = true
            board.syncStatus = "Gjenopprettet usynket tegning"
        } else if let json = board.frame?.strokesJSON,
           let strokes = try? StrokeSerialization.decodeFromWebJSON(json) {
            canvasState.strokes = strokes
        } else {
            canvasState.strokes = []
        }
        canvasState.undoStack = []
        canvasState.redoStack = []
        loadedFrameRef = board.scene.flatMap { scene in
            board.frame.map { (scene.id, $0.id) }
        }
        canvasState.revision += 1
        loadedRevision = canvasState.revision
        if restoredPending {
            // Marker som usynket så autosynken plukker den opp (thumb
            // rendres etter at canvasen har rebuildet den nye framen).
            loadedRevision = -1
            scheduleAutosync()
        }
    }

    private func flushPendingStrokes() {
        guard let ref = loadedFrameRef, canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        let manuscriptId = board.manuscript.id
        Task {
            try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: manuscriptId, sceneId: ref.sceneId,
                frameId: ref.frameId, strokesJSON: json)
        }
    }

    @State private var autosyncTask: Task<Void, Never>?

    private func syncActiveFrameStrokes() {
        guard let scene = board.scene, let frame = board.frame else { return }
        board.syncStatus = "…"
        // Thumb rendres fra akkumulatoren så SCENES/minimap viser native
        // tegninger uten å vente på web.
        let thumbnail = renderer?.thumbnailDataURL()
        Task {
            do {
                let json = try StrokeSerialization.encodeToWebJSON(canvasState.strokes)
                try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: board.manuscript.id, sceneId: scene.id, frameId: frame.id,
                    strokesJSON: json, thumbnailDataURL: thumbnail)
                loadedRevision = canvasState.revision
                PendingStrokeStore.clear(frameId: frame.id)
                board.syncStatus = "Synket ✓"
            } catch SyncError.unauthenticated {
                board.syncStatus = "Token utløpt — logg inn på nytt"
            } catch {
                // Pending-fil beholdes; neste autosynk prøver igjen.
                board.syncStatus = error.localizedDescription
            }
        }
    }

    // Autosynk: backup til disk straks, nett-synk etter 3 s ro.
    private func scheduleAutosync() {
        guard let frame = board.frame,
              canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        PendingStrokeStore.save(json, frameId: frame.id)
        autosyncTask?.cancel()
        autosyncTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            syncActiveFrameStrokes()
        }
    }

    // MARK: Topbar

    private var topbar: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8)
                .fill(LinearGradient(colors: [BoardBrand.accent, Color(red: 0.388, green: 0.4, blue: 0.945)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 32, height: 32)
                .overlay(Image(systemName: "rectangle.grid.2x2").font(.system(size: 15)).foregroundStyle(.white))
            Text("PROJECT").font(.system(size: 10.5, weight: .bold)).kerning(1).foregroundStyle(BoardBrand.label)
            Text(board.manuscript.title).font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            if let scene = board.scene {
                Text("SEQ.").font(.system(size: 10.5, weight: .bold)).kerning(1).foregroundStyle(BoardBrand.label)
                Menu {
                    ForEach(Array(board.scenes.enumerated()), id: \.element.id) { index, sceneEntry in
                        Button(sceneEntry.heading) { board.selectedSceneIndex = index }
                    }
                } label: {
                    Text("\(String(format: "%02d", board.selectedSceneIndex + 1)) \(scene.heading) ▾")
                        .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                }
            }
            Spacer()
            // Fanerad (mockup): Board aktiv · Shot List · Animatic.
            HStack(spacing: 4) {
                topTab("Board", icon: "rectangle.grid.2x2", active: true) {}
                topTab("Script", icon: "doc.text", active: false) { showScript = true }
                topTab("Shot List", icon: "list.bullet", active: false) { showShotList = true }
                topTab("Review", icon: "checkmark.bubble", active: false) { showReview = true }
                topTab("Animatic", icon: "play.rectangle", active: false) { showAnimatic = true }
            }
            Spacer()
            if let status = board.syncStatus {
                Text(status).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            }
            Button {
                toneReport = renderer?.toneReport()
                showToneReport = true
            } label: {
                Image(systemName: "chart.bar")
                    .font(.system(size: 15)).foregroundStyle(BoardBrand.dim)
            }
            .accessibilityLabel("Tone-analyse")
            Button {
                exportPDFURL = BoardPDFExporter.export(
                    projectTitle: board.manuscript.title, scenes: board.scenes)
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 16)).foregroundStyle(BoardBrand.dim)
            }
            .disabled(board.scenes.isEmpty)
            .accessibilityLabel("Eksporter PDF")
            Button { syncActiveFrameStrokes() } label: {
                Label("Synk", systemImage: "icloud.and.arrow.up")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 9))
            }
            Button { dismiss() } label: {
                Image(systemName: "xmark").foregroundStyle(BoardBrand.dim)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
    }

    private func topTab(_ title: String, icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(active ? .white : BoardBrand.dim)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(active ? Color.white.opacity(0.1) : .clear,
                            in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    // MARK: SCENES

    private var scenesColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                panelLabel("Scenes")
                Spacer()
                Button { showNewScenePrompt = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(BoardBrand.dim)
                }
                .accessibilityLabel("Ny scene")
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(Array(board.scenes.enumerated()), id: \.element.id) { index, scene in
                        let selected = index == board.selectedSceneIndex
                        Button { board.selectedSceneIndex = index } label: {
                            HStack(spacing: 10) {
                                Group {
                                    if let image = decodeDataURL(scene.frames.compactMap(\.thumbnailDataURL).first) {
                                        Image(uiImage: image).resizable().scaledToFill()
                                    } else {
                                        Color.white.opacity(0.06)
                                    }
                                }
                                .frame(width: 62, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(String(format: "%02d", index + 1))
                                        .font(.system(size: 10, weight: .bold)).foregroundStyle(BoardBrand.label)
                                    Text(scene.heading)
                                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                                        .lineLimit(1)
                                    Text("\(scene.frames.count) \(scene.frames.count == 1 ? "SHOT" : "SHOTS")")
                                        .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(8)
                            .background(selected ? BoardBrand.accent.opacity(0.16) : Color.white.opacity(0.02),
                                        in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10)
                                .stroke(selected ? BoardBrand.accent : BoardBrand.border, lineWidth: selected ? 1.5 : 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        .frame(width: 230)
        .background(BoardBrand.chrome)
    }

    // MARK: Arket

    private var toolRow: some View {
        HStack(spacing: 6) {
            ForEach([BoardTool.select, .draw, .eraser], id: \.self) { tool in toolButton(tool) }
            Rectangle().fill(BoardBrand.border).frame(width: 1, height: 20).padding(.horizontal, 4)
            ForEach([BoardTool.arrow, .rect, .text], id: \.self) { tool in toolButton(tool) }
            Spacer()
            Button { board.addShot() } label: {
                Label("Add shot", systemImage: "plus")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Color.black, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(BoardBrand.panel)
    }

    private func toolButton(_ tool: BoardTool) -> some View {
        let selected = boardTool == tool
        return Button {
            boardTool = tool
            // Tegn/viskelær speiles i pensel-valget (samme kobling som web).
            if tool == .eraser { canvasState.brushType = .eraser }
            if tool == .draw && canvasState.brushType == .eraser { canvasState.brushType = .pencil }
        } label: {
            Image(systemName: tool.icon)
                .font(.system(size: 14))
                .foregroundStyle(selected ? .white : BoardBrand.dim)
                .frame(width: 34, height: 30)
                .background(selected ? BoardBrand.accent : Color.white.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
    }

    private var sheetArea: some View {
        VStack(spacing: 0) {
            toolRow
            Divider().overlay(BoardBrand.border)
            beatTimeline
            sheetScroll
        }
        .alert("Annotasjonstekst", isPresented: $textPromptShown) {
            TextField("f.eks. PUSH IN", text: $textPromptValue)
            Button("Legg til") { commitTextAnnotation() }
            Button("Avbryt", role: .cancel) { textPromptValue = "" }
        }
        .sheet(isPresented: $showShotList) {
            ShotListSheet(sceneHeading: board.scene?.heading ?? "",
                          frames: board.scene?.frames ?? [])
        }
        .sheet(isPresented: $showScript) {
            ScriptSheet(scenes: board.scenes, activeIndex: board.selectedSceneIndex)
        }
        .sheet(isPresented: $showReview) {
            ReviewSheet(board: board)
        }
        .sheet(isPresented: $showBrushEditor) {
            BrushEditorSheet(canvasState: canvasState)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showToneReport) {
            ToneReportSheet(report: toneReport)
                .presentationDetents([.medium])
        }
        .sheet(item: $exportPDFURL) { url in
            ShareSheet(items: [url])
        }
        .confirmationDialog("Slette shotet permanent?",
                            isPresented: Binding(get: { pendingDeleteFrameId != nil },
                                                 set: { if !$0 { pendingDeleteFrameId = nil } })) {
            Button("Slett shot", role: .destructive) {
                if let frameId = pendingDeleteFrameId { board.deleteShot(frameId: frameId) }
                pendingDeleteFrameId = nil
            }
        }
        .alert("Ny scene", isPresented: $showNewScenePrompt) {
            TextField("Scenetittel", text: $newSceneTitle)
            Button("Opprett") {
                let title = newSceneTitle.trimmingCharacters(in: .whitespaces)
                newSceneTitle = ""
                if !title.isEmpty { board.addScene(title: title) }
            }
            Button("Avbryt", role: .cancel) { newSceneTitle = "" }
        }
    }

    // Beat-timeline (web SceneTimelineStrip): SETUP/TENSION/ACTION/RESOLUTION,
    // segmentbredde ∝ varighet, frames uten beat arver forrige fase.
    private static let beatToPhase: [String: String] = [
        "ESTABLISHING": "SETUP", "TENSION": "TENSION", "BEAT": "TENSION",
        "ACTION": "ACTION", "DIALOGUE": "ACTION", "RESOLUTION": "RESOLUTION",
    ]
    private static let phaseColors: [String: Color] = [
        "SETUP": Color(red: 0.39, green: 0.45, blue: 0.55),
        "TENSION": Color(red: 0.96, green: 0.62, blue: 0.04),
        "ACTION": BoardBrand.accent,
        "RESOLUTION": Color(red: 0.13, green: 0.7, blue: 0.42),
    ]

    private var beatTimeline: some View {
        let frames = board.scene?.frames ?? []
        var phase = "SETUP"
        let entries: [(index: Int, phase: String, weight: Double)] = frames.enumerated().map { index, frame in
            if let beat = frame.beatTag, let mapped = Self.beatToPhase[beat] { phase = mapped }
            return (index, phase, max(0.5, frame.durationSec))
        }
        return HStack(spacing: 2) {
            ForEach(entries, id: \.index) { entry in
                Button { scrollTarget = entry.index } label: {
                    RoundedRectangle(cornerRadius: 2)
                        .fill((Self.phaseColors[entry.phase] ?? .gray)
                            .opacity(entry.index == board.activeFrameIndex ? 1 : 0.45))
                        .frame(height: 6)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .frame(minWidth: 10)
                .layoutPriority(entry.weight)
                .accessibilityLabel("Beat \(entry.phase) shot \(entry.index + 1)")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 5)
        .background(BoardBrand.panel)
    }

    private var sheetScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                sheetContent
            }
            .background(BoardBrand.workspace)
            .onChange(of: scrollTarget) {
                if let target = scrollTarget {
                    withAnimation { proxy.scrollTo(target, anchor: .top) }
                    scrollTarget = nil
                }
            }
        }
    }

    private var sheetContent: some View {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(Array((board.scene?.frames ?? []).enumerated()), id: \.element.id) { index, frame in
                    shotRow(frame: frame, index: index)
                        .id(index)
                }
            }
            .padding(28)
            .background(BoardBrand.sheet, in: RoundedRectangle(cornerRadius: 4))
            .shadow(color: .black.opacity(0.4), radius: 22, y: 8)
            .padding(.vertical, 24)
            .frame(maxWidth: 900 * sheetZoom)
            .frame(maxWidth: .infinity)
    }

    private func shotRow(frame: FrameSummary, index: Int) -> some View {
        let isActive = index == board.activeFrameIndex
        return HStack(alignment: .top, spacing: 18) {
            // Venstre: kode + ACTION/DIALOG + NOTES
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    // Shot-meny: dupliser/flytt/slett (mockupens «…»)
                    Menu {
                        Button { board.duplicateShot(frameId: frame.id) } label: {
                            Label("Dupliser", systemImage: "plus.square.on.square")
                        }
                        Button { board.moveShot(frameId: frame.id, offset: -1) } label: {
                            Label("Flytt opp", systemImage: "arrow.up")
                        }
                        .disabled(index == 0)
                        Button { board.moveShot(frameId: frame.id, offset: 1) } label: {
                            Label("Flytt ned", systemImage: "arrow.down")
                        }
                        .disabled(index == (board.scene?.frames.count ?? 1) - 1)
                        Button(role: .destructive) { pendingDeleteFrameId = frame.id } label: {
                            Label("Slett shot", systemImage: "trash")
                        }
                    } label: {
                        Text(frame.shotNumber)
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundStyle(BoardBrand.inkOnSheet)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(.white, in: RoundedRectangle(cornerRadius: 4))
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(white: 0.25), lineWidth: 1.5))
                    }
                    .accessibilityLabel("Shot-meny \(frame.shotNumber)")
                    Rectangle().fill(Color(white: 0.72)).frame(width: 24, height: 1.5)
                }
                Text("ACTION / DIALOG")
                    .font(.system(size: 8.5, weight: .bold)).kerning(1)
                    .foregroundStyle(Color(white: 0.62))
                Text(frame.description)
                    .font(.custom(BoardBrand.handwriting, size: 15))
                    .foregroundStyle(BoardBrand.inkOnSheet)
                if let notes = frame.notes, !notes.isEmpty {
                    Text("NOTES / DIAGRAM")
                        .font(.system(size: 8.5, weight: .bold)).kerning(1)
                        .foregroundStyle(Color(white: 0.62))
                        .padding(.top, 3)
                    Text(notes)
                        .font(.custom(BoardBrand.handwriting, size: 13))
                        .foregroundStyle(Color(white: 0.38))
                }
                NotesDiagramMini(strokesJSON: frame.strokesJSON,
                                 contentWidth: frame.drawingWidth)
            }
            .frame(width: 150, alignment: .leading)

            // Midt: aktiv = live Metal-canvas, ellers thumbnail
            ZStack {
                if isActive, renderer != nil {
                    activeCanvas(frame: frame)
                } else if let image = decodeDataURL(frame.thumbnailDataURL) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Color(white: 0.925)
                    Text("Trykk for å tegne")
                        .font(.system(size: 11)).foregroundStyle(Color(white: 0.6))
                }
            }
            .aspectRatio(CGFloat(frame.drawingWidth / max(1, frame.drawingHeight)), contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4)
                .stroke(isActive ? BoardBrand.accent : Color(white: 0.2), lineWidth: isActive ? 2 : 1.5))
            .onTapGesture {
                if !isActive { board.activeFrameIndex = index }
            }

            // Høyre: metadata-kolonnen
            VStack(alignment: .leading, spacing: 8) {
                metaEntry("CAM / SHOT", frame.shotType ?? "—")
                metaEntry("LENS / CAMERA", frame.lensMm.map { "\($0)mm" } ?? "—")
                metaEntry("MOVEMENT", frame.movement ?? "—")
                metaEntry("DURATION", "\(Int(frame.durationSec)) SEC")
                if let beat = frame.beatTag {
                    Text(beat)
                        .font(.system(size: 9, weight: .bold)).kerning(0.8)
                        .foregroundStyle(BoardBrand.accent)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(BoardBrand.accent.opacity(0.14), in: Capsule())
                }
            }
            .frame(width: 104, alignment: .leading)
        }
    }

    // MARK: Aktiv canvas + annotasjonsverktøy (pil/rekt/tekst — web-paritet)

    @State private var shapeStart: CGPoint?
    @State private var shapeCurrent: CGPoint?
    @State private var lassoPoints: [CGPoint] = []
    @State private var selectedStrokeIds: Set<String> = []
    @State private var selectionDragOffset: CGSize = .zero

    private func annotationStroke(points: [StrokePoint], text: String? = nil) -> PencilStroke {
        var brush = BrushSpec.preset(.ink, size: 7, color: "#8b5cf6", opacity: 0.95)
        brush.grain = 0
        return PencilStroke(
            id: "board-\(Int(Date().timeIntervalSince1970 * 1000))-\(Int.random(in: 100...999))",
            points: points, inputType: "pencil",
            color: "#8b5cf6", width: 7, opacity: 0.95,
            brush: brush, boardLayer: "Camera / Arrows", textAnnotation: text)
    }

    private func annotationPoint(_ x: Double, _ y: Double) -> StrokePoint {
        StrokePoint(x: x, y: y, pressure: 0.85, tiltX: 0, tiltY: 0,
                    timestamp: Date().timeIntervalSince1970 * 1000)
    }

    private func appendAnnotation(_ stroke: PencilStroke) {
        canvasState.undoStack.append(canvasState.strokes)
        canvasState.redoStack = []
        canvasState.strokes.append(stroke)
    }

    private func commitTextAnnotation() {
        let text = textPromptValue.trimmingCharacters(in: .whitespacesAndNewlines)
        textPromptValue = ""
        guard !text.isEmpty else { return }
        appendAnnotation(annotationStroke(
            points: [annotationPoint(textPromptPoint.x, textPromptPoint.y)], text: text))
    }

    private func activeCanvas(frame: FrameSummary) -> some View {
        GeometryReader { geo in
            let scale = geo.size.width / CGFloat(max(1, frame.drawingWidth))
            ZStack(alignment: .topTrailing) {
                PencilCanvasView(state: canvasState, renderer: renderer)
                    .background(Color(red: 0.992, green: 0.992, blue: 0.984))
                    .allowsHitTesting(boardTool == .draw || boardTool == .eraser)
                // Tekst-annotasjoner: Metal tegner ikke tekst — SwiftUI-overlay
                // i samme håndskrift som web (Caveat ↔ Bradley Hand).
                ForEach(canvasState.strokes.filter {
                    $0.textAnnotation != nil
                        && !canvasState.hiddenLayers.contains($0.boardLayer ?? "Drawing")
                }) { stroke in
                    if let point = stroke.points.first {
                        Text((stroke.textAnnotation ?? "").uppercased())
                            .font(.custom(BoardBrand.handwriting, size: max(12, 40 * scale)))
                            .foregroundStyle(Color(hex: stroke.color) ?? BoardBrand.accent)
                            .position(x: CGFloat(point.x) * scale, y: CGFloat(point.y) * scale)
                            .allowsHitTesting(false)
                    }
                }
                if boardTool == .arrow || boardTool == .rect || boardTool == .text {
                    annotationCapture(scale: scale)
                }
                if boardTool == .select {
                    lassoCapture(scale: scale)
                }
                // Fullskjerm tegnemodus (pinch-zoom, palm rejection)
                Button { showFullscreenDraw = true } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
                .padding(6)
                .accessibilityLabel("Fullskjerm tegning")
            }
        }
    }

    private func annotationCapture(scale: CGFloat) -> some View {
        ZStack {
            Color.clear.contentShape(Rectangle())
            // Gummistrikk-preview i view-rom
            if let start = shapeStart, let current = shapeCurrent, boardTool != .text {
                Path { path in
                    if boardTool == .arrow {
                        path.move(to: start)
                        path.addLine(to: current)
                    } else {
                        path.addRect(CGRect(x: min(start.x, current.x), y: min(start.y, current.y),
                                            width: abs(current.x - start.x), height: abs(current.y - start.y)))
                    }
                }
                .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            }
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    if shapeStart == nil { shapeStart = value.startLocation }
                    shapeCurrent = value.location
                }
                .onEnded { value in
                    defer { shapeStart = nil; shapeCurrent = nil }
                    let start = value.startLocation
                    let end = value.location
                    if boardTool == .text {
                        textPromptPoint = CGPoint(x: end.x / scale, y: end.y / scale)
                        textPromptShown = true
                        return
                    }
                    // Innholdsrom-koordinater (web lagrer 1920×1080-rom)
                    let sx = Double(start.x / scale), sy = Double(start.y / scale)
                    let ex = Double(end.x / scale), ey = Double(end.y / scale)
                    guard hypot(ex - sx, ey - sy) >= 12 else { return }
                    let points: [StrokePoint]
                    if boardTool == .arrow {
                        // Web-paritet: linje + tilbake til spiss + to hodelinjer (34px, ±0.45 rad)
                        let angle = atan2(ey - sy, ex - sx)
                        let head = 34.0
                        points = [
                            annotationPoint(sx, sy), annotationPoint(ex, ey),
                            annotationPoint(ex - head * cos(angle - 0.45), ey - head * sin(angle - 0.45)),
                            annotationPoint(ex, ey),
                            annotationPoint(ex - head * cos(angle + 0.45), ey - head * sin(angle + 0.45)),
                        ]
                    } else {
                        let x0 = min(sx, ex), y0 = min(sy, ey), x1 = max(sx, ex), y1 = max(sy, ey)
                        points = [annotationPoint(x0, y0), annotationPoint(x1, y0),
                                  annotationPoint(x1, y1), annotationPoint(x0, y1),
                                  annotationPoint(x0, y0)]
                    }
                    appendAnnotation(annotationStroke(points: points))
                }
        )
    }

    // MARK: Lasso-select: marker strøk → flytt (drag) eller slett

    private func selectionRect(scale: CGFloat) -> CGRect? {
        let selected = canvasState.strokes.filter { selectedStrokeIds.contains($0.id) }
        let points = selected.flatMap(\.points)
        guard let firstX = points.map(\.x).min(), let lastX = points.map(\.x).max(),
              let firstY = points.map(\.y).min(), let lastY = points.map(\.y).max() else { return nil }
        return CGRect(x: firstX * scale, y: firstY * scale,
                      width: max(20, (lastX - firstX) * scale), height: max(20, (lastY - firstY) * scale))
    }

    private func lassoCapture(scale: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear.contentShape(Rectangle())
            if lassoPoints.count > 1 {
                Path { path in
                    path.move(to: lassoPoints[0])
                    for point in lassoPoints.dropFirst() { path.addLine(to: point) }
                }
                .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
            if let rect = selectionRect(scale: scale) {
                RoundedRectangle(cornerRadius: 4)
                    .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    .background(BoardBrand.accent.opacity(0.06))
                    .frame(width: rect.width + 16, height: rect.height + 16)
                    .offset(x: rect.minX - 8 + selectionDragOffset.width,
                            y: rect.minY - 8 + selectionDragOffset.height)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture()
                            .onChanged { selectionDragOffset = $0.translation }
                            .onEnded { value in
                                moveSelection(dx: Double(value.translation.width / scale),
                                              dy: Double(value.translation.height / scale))
                                selectionDragOffset = .zero
                            }
                    )
                HStack(spacing: 8) {
                    Button { deleteSelection() } label: {
                        Label("Slett", systemImage: "trash")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.red.opacity(0.85), in: Capsule())
                    }
                    Button { selectedStrokeIds = [] } label: {
                        Text("Avbryt")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.black.opacity(0.6), in: Capsule())
                    }
                }
                .offset(x: max(0, rect.minX - 8), y: max(0, rect.minY - 36))
            }
        }
        .gesture(
            selectedStrokeIds.isEmpty
                ? DragGesture(minimumDistance: 0)
                    .onChanged { lassoPoints.append($0.location) }
                    .onEnded { _ in finishLasso(scale: scale) }
                : nil
        )
    }

    private func finishLasso(scale: CGFloat) {
        defer { lassoPoints = [] }
        guard lassoPoints.count > 4 else { return }
        let polygon = lassoPoints.map { CGPoint(x: $0.x / scale, y: $0.y / scale) }
        var hit: Set<String> = []
        for stroke in canvasState.strokes {
            let total = stroke.points.count
            guard total > 0 else { continue }
            let inside = stroke.points.filter {
                pointInPolygon(CGPoint(x: $0.x, y: $0.y), polygon: polygon)
            }.count
            if Double(inside) / Double(total) > 0.5 { hit.insert(stroke.id) }
        }
        selectedStrokeIds = hit
    }

    private func moveSelection(dx: Double, dy: Double) {
        guard !selectedStrokeIds.isEmpty, dx != 0 || dy != 0 else { return }
        canvasState.undoStack.append(canvasState.strokes)
        canvasState.redoStack = []
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var moved = stroke
            moved.points = moved.points.map { point in
                var p = point
                p.x += dx
                p.y += dy
                return p
            }
            return moved
        }
        canvasState.revision += 1
    }

    private func deleteSelection() {
        guard !selectedStrokeIds.isEmpty else { return }
        canvasState.undoStack.append(canvasState.strokes)
        canvasState.redoStack = []
        canvasState.strokes.removeAll { selectedStrokeIds.contains($0.id) }
        canvasState.revision += 1
        selectedStrokeIds = []
    }

    private func metaEntry(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8, weight: .bold)).kerning(1)
                .foregroundStyle(Color(white: 0.62))
            Text(value).font(.custom(BoardBrand.handwriting, size: 14))
                .foregroundStyle(BoardBrand.inkOnSheet)
        }
    }

    // MARK: Inspector

    private var inspector: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                panelLabel("Inspector")
                if let frame = board.frame {
                    HStack {
                        Text("SHOT \(frame.shotNumber)")
                            .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "lock").font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                    }
                    .padding(10)
                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))

                    inspectorPicker("Camera / Shot", value: frame.shotType,
                                    options: ["EWS", "WS", "MS", "MCU", "CU", "OTS", "POV", "INSERT"]) {
                        board.patchActiveFrame(["shotType": $0])
                    }
                    inspectorPicker("Lens", value: frame.lensMm.map { "\($0)mm" },
                                    options: ["14mm", "18mm", "24mm", "28mm", "35mm", "50mm", "85mm", "135mm"]) {
                        board.patchActiveFrame(["lensMm": Int($0.replacingOccurrences(of: "mm", with: "")) ?? 35])
                    }

                    // SHOT SIZE-glyfrad (mockup): EWS→ECU, aktiv i fiolett.
                    panelLabel("Shot size")
                    HStack(spacing: 6) {
                        glyphButton("figure.stand", value: "EWS", current: frame.shotType) { board.patchActiveFrame(["shotType": "EWS"]) }
                        glyphButton("figure.walk", value: "WS", current: frame.shotType) { board.patchActiveFrame(["shotType": "WS"]) }
                        glyphButton("person.fill", value: "MS", current: frame.shotType) { board.patchActiveFrame(["shotType": "MS"]) }
                        glyphButton("person.crop.circle", value: "CU", current: frame.shotType) { board.patchActiveFrame(["shotType": "CU"]) }
                        glyphButton("eye", value: "ECU", current: frame.shotType) { board.patchActiveFrame(["shotType": "ECU"]) }
                    }

                    // MOVEMENT-glyfrad (mockup).
                    panelLabel("Movement")
                    HStack(spacing: 6) {
                        glyphButton("minus", value: "Static", current: frame.movement) { board.patchActiveFrame(["movement": "Static"]) }
                        glyphButton("arrow.left.and.right", value: "Pan", current: frame.movement) { board.patchActiveFrame(["movement": "Pan"]) }
                        glyphButton("arrow.up.and.down", value: "Tilt", current: frame.movement) { board.patchActiveFrame(["movement": "Tilt"]) }
                        glyphButton("plus.magnifyingglass", value: "Push In", current: frame.movement) { board.patchActiveFrame(["movement": "Push In"]) }
                        glyphButton("arrow.right.to.line", value: "Tracking", current: frame.movement) { board.patchActiveFrame(["movement": "Tracking"]) }
                        glyphButton("hand.raised", value: "Handheld", current: frame.movement) { board.patchActiveFrame(["movement": "Handheld"]) }
                    }

                    // DURATION-stepper (mockup: tallfelt).
                    HStack {
                        panelLabel("Duration (sec)")
                        Spacer()
                        Button { board.patchActiveFrame(["duration": max(0.5, frame.durationSec - 0.5)]) } label: {
                            Image(systemName: "minus").font(.system(size: 11)).foregroundStyle(.white)
                                .frame(width: 24, height: 24)
                                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 6))
                        }
                        Text(String(format: "%.1f", frame.durationSec))
                            .font(.system(size: 13).monospacedDigit()).foregroundStyle(.white)
                            .frame(width: 34)
                        Button { board.patchActiveFrame(["duration": frame.durationSec + 0.5]) } label: {
                            Image(systemName: "plus").font(.system(size: 11)).foregroundStyle(.white)
                                .frame(width: 24, height: 24)
                                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 6))
                        }
                    }
                    inspectorPicker("Transition", value: frame.transition,
                                    options: ["Cut", "Dissolve", "Match Cut", "Smash Cut", "Wipe", "Fade"]) {
                        board.patchActiveFrame(["transition": $0])
                    }
                    inspectorPicker("Focus / Depth", value: frame.focusDepth, options: ["Shallow", "Deep"]) {
                        board.patchActiveFrame(["focusDepth": $0])
                    }
                    inspectorPicker("Time of day", value: frame.timeOfDay, options: ["Day", "Night", "Dawn", "Dusk"]) {
                        board.patchActiveFrame(["timeOfDay": $0])
                    }
                    inspectorPicker("Weather", value: frame.weather,
                                    options: ["Clear", "Rain", "Snow", "Overcast", "Fog"]) {
                        board.patchActiveFrame(["weather": $0])
                    }

                    // ACTION / DIALOG (frame.description)
                    panelLabel("Action / Dialog")
                    TextField("Hva skjer i shotet…", text: $descriptionDraft, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.system(size: 12))
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                        .onSubmit { board.patchActiveFrame(["description": descriptionDraft]) }

                    // BEAT-tag (web BEAT_TAG_OPTIONS)
                    inspectorPicker("Beat", value: frame.beatTag,
                                    options: ["ESTABLISHING", "TENSION", "BEAT", "ACTION", "DIALOGUE", "RESOLUTION"]) {
                        board.patchActiveFrame(["beatTag": $0])
                    }

                    // NOTES (mockup: fritekstfelt).
                    panelLabel("Notes")
                    TextField("Add notes…", text: $notesDraft, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.system(size: 12))
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                        .onSubmit { board.patchActiveFrame(["notes": notesDraft]) }

                    // TAGS (mockup: chips med x + tillegg).
                    panelLabel("Tags")
                    FlowTags(tags: frame.tags) { removed in
                        board.patchActiveFrame(["tags": frame.tags.filter { $0 != removed }])
                    }
                    HStack(spacing: 6) {
                        TextField("Ny tag", text: $tagDraft)
                            .font(.system(size: 11))
                            .foregroundStyle(.white)
                            .textInputAutocapitalization(.characters)
                            .padding(.horizontal, 8).padding(.vertical, 5)
                            .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 7))
                            .onSubmit { addTag(frame: frame) }
                        Button { addTag(frame: frame) } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 11)).foregroundStyle(.white)
                                .frame(width: 24, height: 24)
                                .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .disabled(tagDraft.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } else {
                    Text("Velg et shot").font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                }
            }
            .padding(14)
        }
        .frame(width: 250)
        .background(BoardBrand.chrome)
        .onChange(of: board.frame?.id) {
            notesDraft = board.frame?.notes ?? ""
            descriptionDraft = board.frame?.description ?? ""
        }
        .onAppear {
            notesDraft = board.frame?.notes ?? ""
            descriptionDraft = board.frame?.description ?? ""
        }
    }

    @State private var notesDraft = ""
    @State private var descriptionDraft = ""
    @State private var tagDraft = ""

    private func addTag(frame: FrameSummary) {
        let tag = tagDraft.trimmingCharacters(in: .whitespaces).uppercased()
        tagDraft = ""
        guard !tag.isEmpty, !frame.tags.contains(tag) else { return }
        board.patchActiveFrame(["tags": frame.tags + [tag]])
    }

    private func glyphButton(
        _ symbol: String, value: String, current: String?, action: @escaping () -> Void
    ) -> some View {
        let selected = current == value
        return Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13))
                .foregroundStyle(selected ? .white : BoardBrand.dim)
                .frame(width: 34, height: 30)
                .background(selected ? BoardBrand.accent : Color.white.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value)
    }

    private func inspectorPicker(
        _ label: String, value: String?, options: [String], onSelect: @escaping (String) -> Void
    ) -> some View {
        HStack {
            panelLabel(label)
            Spacer()
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) { onSelect(option) }
                }
            } label: {
                Text(value ?? "—")
                    .font(.system(size: 13)).foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: Bunnpaneler (Brushes | Layers | Navigator) — mockup-stil

    private var brushBar: some View {
        HStack(alignment: .top, spacing: 0) {
            brushesPanel
            Divider().overlay(BoardBrand.border)
            layersPanel
            Divider().overlay(BoardBrand.border)
            navigatorPanel
        }
        .frame(height: 190)
        .background(BoardBrand.panel)
    }

    // Story Brush Engine-settet (spec §47/§83): DRAW / TONE / CLEAN.
    private static let brushChips: [(BrushType, String)] = [
        (.layout, "Layout"), (.pencil, "Blyant"), (.heavy, "Heavy"),
        (.detail, "Detalj"), (.ink, "Tusj"),
        (.hatch, "Skraver"), (.crosshatch, "Kryss"), (.shade, "Skygge"),
        (.graintex, "Korn"), (.smudge, "Smudge"),
        (.eraser, "Viskelær"), (.kneaded, "Kna"), (.lightlift, "Lysløft"),
        (.forest, "Skog"), (.debris, "Bunn"), (.organictex, "Bark"), (.fur, "Pels"),
        (.toneblock, "Tone"), (.speedlines, "Fart"),
        (.airbrush, "Luft"), (.wethair, "Hår"), (.softfocus, "Fokus"),
        (.skintex, "Hud"), (.rocktex, "Stein"), (.gloss, "Glans"),
        (.wash, "Vask"), (.spikes, "Pigg"), (.watercolor, "Akvarell"),
    ]

    private var brushColorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: canvasState.brushColor) ?? .black },
            set: { canvasState.brushColor = $0.hexString }
        )
    }

    // Smoothing vises som pensel-default til brukeren overstyrer (web-paritet
    // streamlineOverride = pct * 0.92).
    private var smoothingBinding: Binding<Double> {
        Binding(
            get: {
                canvasState.streamlineOverride.map { $0 / 0.92 }
                    ?? Streamline.amount(for: canvasState.brushType) / 0.92
            },
            set: { canvasState.streamlineOverride = $0 * 0.92 }
        )
    }

    private var brushesPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button { showBrushEditor = true } label: {
                    HStack(spacing: 4) {
                        panelLabel("Brushes")
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 9, weight: .bold)).foregroundStyle(BoardBrand.label)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pensel-editor")
                // Valgt pensel med navn — glyfene alene sa ikke hva som er aktivt.
                Text(Self.brushChips.first(where: { $0.0 == canvasState.brushType })?.1 ?? "")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(BoardBrand.accent.opacity(0.25), in: Capsule())
                Spacer()
                Button { canvasState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.undoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.undoStack.isEmpty)
                Button { canvasState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.redoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.redoStack.isEmpty)
                Text("\(canvasState.strokes.count) strøk")
                    .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
            }
            HStack(alignment: .top, spacing: 14) {
                // Tip-glyfer i 2×5-grid (mockup) — form, ikke tekst.
                // Scrollbart glyf-grid — penselfamilien vokser.
                ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 4) {
                    ForEach(0..<((Self.brushChips.count + 4) / 5), id: \.self) { row in
                        HStack(spacing: 5) {
                            ForEach(Array(Self.brushChips[(row * 5)..<min(row * 5 + 5, Self.brushChips.count)]), id: \.0) { type, name in
                                let selected = canvasState.brushType == type
                                Button { canvasState.selectBrush(type) } label: {
                                    BrushTipGlyph(type: type)
                                        .frame(width: 44, height: 26)
                                        .background(selected ? Color.white.opacity(0.12) : Color.white.opacity(0.04),
                                                    in: RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? BoardBrand.accent : BoardBrand.border,
                                                    lineWidth: selected ? 1.5 : 1))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(name)
                            }
                        }
                    }
                }
                }
                .frame(height: 92)
                VStack(spacing: 4) {
                    HStack(spacing: 5) {
                        ColorPicker("Farge", selection: brushColorBinding, supportsOpacity: false)
                            .labelsHidden().frame(width: 32, height: 28)
                        // Nylige farger
                        ForEach(canvasState.recentColors.prefix(6), id: \.self) { hex in
                            Button { canvasState.brushColor = hex } label: {
                                Circle()
                                    .fill(Color(hex: hex) ?? .white)
                                    .frame(width: 16, height: 16)
                                    .overlay(Circle().stroke(
                                        canvasState.brushColor == hex ? BoardBrand.accent : BoardBrand.border,
                                        lineWidth: canvasState.brushColor == hex ? 1.5 : 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                // Sliders vertikalt m/ verdi til høyre (mockup)
                VStack(spacing: 10) {
                    sliderRow("Size", value: $canvasState.brushSize, range: 1...120,
                              display: "\(Int(canvasState.brushSize)) px")
                    sliderRow("Opacity", value: $canvasState.brushOpacity, range: 0.1...1,
                              display: "\(Int(canvasState.brushOpacity * 100))%")
                    sliderRow("Smothing", value: smoothingBinding, range: 0...1,
                              display: "\(Int(smoothingBinding.wrappedValue * 100))%")
                }
                .frame(maxWidth: .infinity)
                // Strøk-forhåndsvisning (mockup: hvit kurve på svart)
                StrokePreview(size: canvasState.brushSize, opacity: canvasState.brushOpacity)
                    .frame(width: 118, height: 122)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity)
    }

    private func sliderRow(
        _ label: String, value: Binding<Double>, range: ClosedRange<Double>, display: String
    ) -> some View {
        HStack(spacing: 8) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold)).kerning(0.8)
                .foregroundStyle(BoardBrand.label)
            Slider(value: value, in: range).tint(BoardBrand.accent)
            Text(display)
                .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                .frame(width: 40, alignment: .trailing)
        }
    }

    private var activeLayerOpacityBinding: Binding<Double> {
        Binding(
            get: { canvasState.layerOpacity[canvasState.activeBoardLayer] ?? 1 },
            set: { canvasState.layerOpacity[canvasState.activeBoardLayer] = $0 }
        )
    }

    private static let layerIcons: [String: String] = [
        "Drawing": "paintbrush.pointed.fill",
        "Camera / Arrows": "arrow.up.right.square",
        "Dialog": "text.bubble",
        "Notes": "note.text",
    ]

    private var layersPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            panelLabel("Layers")
            ForEach(BoardLayers.all, id: \.self) { layer in
                let active = canvasState.activeBoardLayer == layer
                let hidden = canvasState.hiddenLayers.contains(layer)
                let locked = canvasState.lockedLayers.contains(layer)
                HStack(spacing: 8) {
                    Button {
                        if hidden { canvasState.hiddenLayers.remove(layer) }
                        else { canvasState.hiddenLayers.insert(layer) }
                    } label: {
                        Image(systemName: hidden ? "eye.slash" : "eye")
                            .font(.system(size: 11))
                            .foregroundStyle(hidden ? BoardBrand.label : BoardBrand.dim)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Vis \(layer)")
                    Image(systemName: Self.layerIcons[layer] ?? "square")
                        .font(.system(size: 9))
                        .foregroundStyle(active ? .white : BoardBrand.label)
                    Button { canvasState.activeBoardLayer = layer } label: {
                        Text(layer)
                            .font(.system(size: 11, weight: active ? .bold : .regular))
                            .foregroundStyle(active ? .white : BoardBrand.dim)
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                    Button {
                        if locked { canvasState.lockedLayers.remove(layer) }
                        else { canvasState.lockedLayers.insert(layer) }
                    } label: {
                        Image(systemName: locked ? "lock.fill" : "lock.open")
                            .font(.system(size: 10))
                            .foregroundStyle(locked ? BoardBrand.accent : BoardBrand.label)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Lås \(layer)")
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(active ? BoardBrand.accent.opacity(0.22) : .clear,
                            in: RoundedRectangle(cornerRadius: 6))
            }
            // Blend-modus (kun Normal støttes) + opacity for aktivt lag (mockup)
            HStack(spacing: 8) {
                Menu {
                    Button("Normal") {}
                } label: {
                    HStack(spacing: 4) {
                        Text("Normal").font(.system(size: 10, weight: .semibold)).foregroundStyle(.white)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 7, weight: .bold)).foregroundStyle(BoardBrand.dim)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                }
                Slider(value: activeLayerOpacityBinding, in: 0.1...1)
                    .tint(BoardBrand.accent)
                Text("\(Int((canvasState.layerOpacity[canvasState.activeBoardLayer] ?? 1) * 100))%")
                    .font(.system(size: 9).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                    .frame(width: 28, alignment: .trailing)
            }
            .padding(.top, 2)
            // Hurtigfarger (mockup-swatches): hvit + sort blekk
            HStack(spacing: 6) {
                ForEach(["#ffffff", "#26282e"], id: \.self) { hex in
                    Button { canvasState.brushColor = hex } label: {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(hex: hex) ?? .white)
                            .frame(width: 22, height: 22)
                            .overlay(RoundedRectangle(cornerRadius: 4)
                                .stroke(canvasState.brushColor == hex ? BoardBrand.accent : BoardBrand.border,
                                        lineWidth: canvasState.brushColor == hex ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
        }
        .padding(12)
        .frame(width: 200)
    }

    private var navigatorPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            panelLabel("Navigator")
            // Minimap av arket: alle shots i scenen, aktiv i fiolett;
            // tap hopper til raden.
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3),
                      spacing: 4) {
                ForEach(Array((board.scene?.frames ?? []).enumerated()), id: \.element.id) { index, frame in
                    Button { scrollTarget = index } label: {
                        ZStack {
                            if let image = decodeDataURL(frame.thumbnailDataURL) {
                                Image(uiImage: image).resizable().scaledToFill()
                            } else {
                                Color.white.opacity(0.07)
                            }
                        }
                        .frame(height: 24)
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .overlay(RoundedRectangle(cornerRadius: 3)
                            .stroke(index == board.activeFrameIndex ? BoardBrand.accent : BoardBrand.border,
                                    lineWidth: index == board.activeFrameIndex ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Gå til shot \(frame.shotNumber)")
                }
            }
            Spacer(minLength: 0)
            // Zoom styrer arkbredden (reflow — canvas skalerer med)
            HStack(spacing: 6) {
                Button { sheetZoom = max(0.5, sheetZoom - 0.1) } label: {
                    Image(systemName: "minus").font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                }
                Slider(value: $sheetZoom, in: 0.5...1.4).tint(BoardBrand.accent)
                Button { sheetZoom = min(1.4, sheetZoom + 0.1) } label: {
                    Image(systemName: "plus").font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                }
                Text("\(Int(sheetZoom * 100))%")
                    .font(.system(size: 9).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                    .frame(width: 30, alignment: .trailing)
            }
        }
        .padding(12)
        .frame(width: 200)
    }
}

// MARK: Animatic — scene-avspilling med per-shot varighet (native AnimaticLite)

struct AnimaticView: View {
    let sceneHeading: String
    let frames: [FrameSummary]
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var playing = true

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Text(sceneHeading.uppercased())
                        .font(.system(size: 12, weight: .bold)).kerning(1.2)
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.horizontal, 24)
                ZStack {
                    if let frame = frames.indices.contains(index) ? frames[index] : nil {
                        if let image = decodeDataURL(frame.thumbnailDataURL) {
                            Image(uiImage: image).resizable().scaledToFit()
                        } else {
                            RoundedRectangle(cornerRadius: 8).fill(Color(white: 0.94))
                                .aspectRatio(2.39, contentMode: .fit)
                                .overlay(Text("SHOT \(frame.shotNumber)")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundStyle(Color(white: 0.55)))
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 24)
                HStack(spacing: 14) {
                    Button { playing.toggle() } label: {
                        Image(systemName: playing ? "pause.fill" : "play.fill")
                            .font(.system(size: 17)).foregroundStyle(.white)
                    }
                    // Fremdrift: én segmentert stripe per shot, aktiv i fiolett.
                    HStack(spacing: 4) {
                        ForEach(Array(frames.enumerated()), id: \.element.id) { i, _ in
                            Capsule()
                                .fill(i == index ? BoardBrand.accent : Color.white.opacity(0.18))
                                .frame(height: 4)
                        }
                    }
                    if let frame = frames.indices.contains(index) ? frames[index] : nil {
                        Text("\(frame.shotNumber) · \(Int(frame.durationSec))s")
                            .font(.system(size: 12).monospacedDigit())
                            .foregroundStyle(.white.opacity(0.6))
                    }
                }
                .padding(.horizontal, 24).padding(.bottom, 20)
            }
        }
        .task(id: "\(index)-\(playing)") {
            guard playing, frames.indices.contains(index) else { return }
            let seconds = max(0.5, frames[index].durationSec)
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            if playing { index = (index + 1) % max(1, frames.count) }
        }
    }
}

// Mini-diagram i shot-radens venstrekolonne: strek-render av Notes-lag-strøk
// (mockupens NOTES/DIAGRAM-skisse). Skjules når laget er tomt.
// Decode-cache: JSON-parsing per rad per render er dyrt — nøkkel er selve
// json-strengen (endres kun når strøkene endres). Enkel cap i stedet for LRU.
@MainActor
private enum NoteStrokeCache {
    static var store: [String: [PencilStroke]] = [:]

    static func noteStrokes(for json: String) -> [PencilStroke] {
        if let hit = store[json] { return hit }
        let parsed = ((try? StrokeSerialization.decodeFromWebJSON(json)) ?? [])
            .filter { $0.boardLayer == "Notes" && $0.textAnnotation == nil }
        if store.count > 60 { store.removeAll(keepingCapacity: true) }
        store[json] = parsed
        return parsed
    }
}

private struct NotesDiagramMini: View {
    let strokesJSON: String?
    let contentWidth: Double

    private var noteStrokes: [PencilStroke] {
        strokesJSON.map { NoteStrokeCache.noteStrokes(for: $0) } ?? []
    }

    var body: some View {
        let strokes = noteStrokes
        if !strokes.isEmpty {
            Canvas { context, size in
                let scale = size.width / CGFloat(max(1, contentWidth))
                for stroke in strokes {
                    guard let first = stroke.points.first else { continue }
                    var path = Path()
                    path.move(to: CGPoint(x: first.x * scale, y: first.y * scale))
                    for point in stroke.points.dropFirst() {
                        path.addLine(to: CGPoint(x: point.x * scale, y: point.y * scale))
                    }
                    context.stroke(
                        path,
                        with: .color(Color(hex: stroke.color) ?? Color(white: 0.4)),
                        style: StrokeStyle(lineWidth: max(1, stroke.width * scale * 0.6),
                                           lineCap: .round, lineJoin: .round))
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .background(Color.white.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(white: 0.75), lineWidth: 1))
            .padding(.top, 4)
        }
    }
}

// Shot List-fanen (mockup): tabellvisning av scenens shots.
struct ShotListSheet: View {
    let sceneHeading: String
    let frames: [FrameSummary]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(frames) { frame in
                    HStack(spacing: 12) {
                        Text(frame.shotNumber)
                            .font(.system(.subheadline, design: .monospaced).bold())
                            .frame(width: 44, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(frame.description.isEmpty ? "—" : frame.description)
                                .font(.subheadline).lineLimit(1)
                            Text([frame.shotType, frame.lensMm.map { "\($0)mm" },
                                  frame.movement, frame.transition]
                                .compactMap(\.self).joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let beat = frame.beatTag {
                            Text(beat).font(.caption2.bold())
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.purple.opacity(0.18), in: Capsule())
                        }
                        Text(String(format: "%.1fs", frame.durationSec))
                            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Shot List — \(sceneHeading)")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }
}

// Pensel-tupp-glyf (mockup: form-bokser, ikke tekst). Tegner stav + tupp
// der tuppformen skiller penslene.
private struct BrushTipGlyph: View {
    let type: BrushType

    var body: some View {
        Canvas { context, size in
            let cx = size.width / 2
            let white = Color.white.opacity(0.85)
            var shaft = Path()
            var tip = Path()
            switch type {
            case .pencil:
                shaft.addRect(CGRect(x: cx - 2.5, y: 5, width: 5, height: 16))
                tip.move(to: CGPoint(x: cx - 2.5, y: 21))
                tip.addLine(to: CGPoint(x: cx + 2.5, y: 21))
                tip.addLine(to: CGPoint(x: cx, y: 32))
                tip.closeSubpath()
            case .graphite:
                shaft.addRect(CGRect(x: cx - 3, y: 5, width: 6, height: 15))
                tip.move(to: CGPoint(x: cx - 3, y: 20))
                tip.addLine(to: CGPoint(x: cx + 3, y: 20))
                tip.addLine(to: CGPoint(x: cx + 3, y: 31))
                tip.closeSubpath()
            case .charcoal:
                shaft.addRect(CGRect(x: cx - 4.5, y: 5, width: 9, height: 14))
                tip.move(to: CGPoint(x: cx - 4.5, y: 19))
                tip.addLine(to: CGPoint(x: cx + 4.5, y: 19))
                tip.addLine(to: CGPoint(x: cx + 2, y: 31))
                tip.addLine(to: CGPoint(x: cx - 2, y: 31))
                tip.closeSubpath()
            case .conte:
                shaft.addRect(CGRect(x: cx - 4, y: 6, width: 8, height: 15))
                tip.move(to: CGPoint(x: cx - 4, y: 21))
                tip.addLine(to: CGPoint(x: cx + 4, y: 21))
                tip.addLine(to: CGPoint(x: cx + 4, y: 29))
                tip.addLine(to: CGPoint(x: cx - 4, y: 25))
                tip.closeSubpath()
            case .pen, .ink:
                shaft.addRect(CGRect(x: cx - 1.5, y: 5, width: 3, height: 18))
                tip.move(to: CGPoint(x: cx - 1.5, y: 23))
                tip.addLine(to: CGPoint(x: cx + 1.5, y: 23))
                tip.addLine(to: CGPoint(x: cx, y: 32))
                tip.closeSubpath()
            case .marker:
                shaft.addRect(CGRect(x: cx - 4, y: 5, width: 8, height: 16))
                tip.addRoundedRect(in: CGRect(x: cx - 2.5, y: 21, width: 5, height: 10),
                                   cornerSize: CGSize(width: 2, height: 2))
            case .highlighter:
                shaft.addRect(CGRect(x: cx - 5, y: 5, width: 10, height: 16))
                tip.addRect(CGRect(x: cx - 4, y: 21, width: 8, height: 9))
            case .smudge:
                tip.addEllipse(in: CGRect(x: cx - 7, y: 10, width: 14, height: 18))
            case .eraser:
                tip.addRoundedRect(in: CGRect(x: cx - 7, y: 8, width: 14, height: 20),
                                   cornerSize: CGSize(width: 3, height: 3))
            case .layout:
                shaft.addRect(CGRect(x: cx - 1.5, y: 6, width: 3, height: 16))
                tip.move(to: CGPoint(x: cx - 1.5, y: 22))
                tip.addLine(to: CGPoint(x: cx + 1.5, y: 22))
                tip.addLine(to: CGPoint(x: cx, y: 30))
                tip.closeSubpath()
            case .heavy:
                shaft.addRect(CGRect(x: cx - 4, y: 5, width: 8, height: 15))
                tip.move(to: CGPoint(x: cx - 4, y: 20))
                tip.addLine(to: CGPoint(x: cx + 4, y: 20))
                tip.addLine(to: CGPoint(x: cx, y: 31))
                tip.closeSubpath()
            case .detail:
                shaft.addRect(CGRect(x: cx - 1, y: 5, width: 2, height: 19))
                tip.move(to: CGPoint(x: cx - 1, y: 24))
                tip.addLine(to: CGPoint(x: cx + 1, y: 24))
                tip.addLine(to: CGPoint(x: cx, y: 31))
                tip.closeSubpath()
            case .hatch:
                for i in 0..<4 {
                    let base = CGFloat(i) * 8
                    tip.move(to: CGPoint(x: cx - 12 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 10))
                }
            case .crosshatch:
                for i in 0..<3 {
                    let base = CGFloat(i) * 9
                    tip.move(to: CGPoint(x: cx - 11 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 4 + base, y: 10))
                    tip.move(to: CGPoint(x: cx - 4 + base, y: 26))
                    tip.addLine(to: CGPoint(x: cx - 11 + base, y: 10))
                }
            case .shade:
                tip.addEllipse(in: CGRect(x: cx - 12, y: 13, width: 24, height: 11))
            case .graintex:
                // Deterministisk spredning (Canvas redraw skal ikke flimre)
                for i in 0..<14 {
                    let px = cx - 12 + CGFloat((i * 37) % 24)
                    let py = 10 + CGFloat((i * 23 + 7) % 16)
                    tip.addEllipse(in: CGRect(x: px, y: py, width: 1.6, height: 1.6))
                }
            case .kneaded:
                tip.addRoundedRect(in: CGRect(x: cx - 8, y: 10, width: 16, height: 16),
                                   cornerSize: CGSize(width: 6, height: 6))
            case .lightlift:
                tip.addEllipse(in: CGRect(x: cx - 9, y: 9, width: 18, height: 18))
            case .forest:
                // Gran: stamme + skrå grener
                tip.move(to: CGPoint(x: cx, y: 28)); tip.addLine(to: CGPoint(x: cx, y: 8))
                tip.move(to: CGPoint(x: cx, y: 12)); tip.addLine(to: CGPoint(x: cx - 6, y: 18))
                tip.move(to: CGPoint(x: cx, y: 12)); tip.addLine(to: CGPoint(x: cx + 6, y: 18))
                tip.move(to: CGPoint(x: cx, y: 18)); tip.addLine(to: CGPoint(x: cx - 9, y: 26))
                tip.move(to: CGPoint(x: cx, y: 18)); tip.addLine(to: CGPoint(x: cx + 9, y: 26))
            case .debris:
                tip.move(to: CGPoint(x: cx - 10, y: 24)); tip.addLine(to: CGPoint(x: cx - 2, y: 20))
                tip.move(to: CGPoint(x: cx + 1, y: 25)); tip.addLine(to: CGPoint(x: cx + 9, y: 23))
                tip.move(to: CGPoint(x: cx - 5, y: 15)); tip.addLine(to: CGPoint(x: cx + 3, y: 12))
                tip.addEllipse(in: CGRect(x: cx + 5, y: 13, width: 4, height: 3))
            case .organictex:
                tip.move(to: CGPoint(x: cx - 9, y: 22)); tip.addLine(to: CGPoint(x: cx - 5, y: 14))
                tip.addLine(to: CGPoint(x: cx - 1, y: 22))
                tip.move(to: CGPoint(x: cx + 1, y: 20)); tip.addLine(to: CGPoint(x: cx + 5, y: 12))
                tip.addLine(to: CGPoint(x: cx + 9, y: 20))
            case .fur:
                for i in 0..<4 {
                    let base = CGFloat(i) * 6
                    tip.move(to: CGPoint(x: cx - 9 + base, y: 25))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 12))
                }
            case .toneblock:
                tip.addRect(CGRect(x: cx - 10, y: 10, width: 20, height: 16))
            case .speedlines:
                for i in 0..<3 {
                    let y = 13.0 + Double(i) * 5
                    tip.move(to: CGPoint(x: cx - 12, y: y))
                    tip.addLine(to: CGPoint(x: cx + 12, y: y - 2))
                }
            case .airbrush:
                tip.addEllipse(in: CGRect(x: cx - 9, y: 9, width: 18, height: 18))
                shaft.addEllipse(in: CGRect(x: cx - 5, y: 13, width: 10, height: 10))
            case .wethair:
                for i in 0..<3 {
                    let base = CGFloat(i) * 7
                    tip.move(to: CGPoint(x: cx - 8 + base, y: 10))
                    tip.addQuadCurve(to: CGPoint(x: cx - 3 + base, y: 26),
                                     control: CGPoint(x: cx - 11 + base, y: 20))
                }
            case .softfocus:
                tip.addEllipse(in: CGRect(x: cx - 10, y: 8, width: 20, height: 20))
                tip.addEllipse(in: CGRect(x: cx - 6, y: 12, width: 12, height: 12))
            case .skintex:
                for i in 0..<12 {
                    let px = cx - 10 + CGFloat((i * 31) % 20)
                    let py = 10 + CGFloat((i * 17 + 3) % 15)
                    tip.addEllipse(in: CGRect(x: px, y: py, width: 2.2, height: 2.2))
                }
            case .rocktex:
                tip.move(to: CGPoint(x: cx - 9, y: 24))
                tip.addLine(to: CGPoint(x: cx - 5, y: 12))
                tip.addLine(to: CGPoint(x: cx + 2, y: 17))
                tip.addLine(to: CGPoint(x: cx + 8, y: 10))
                tip.addLine(to: CGPoint(x: cx + 10, y: 24))
                tip.closeSubpath()
            case .wash:
                tip.addEllipse(in: CGRect(x: cx - 12, y: 12, width: 24, height: 11))
                shaft.addRect(CGRect(x: cx - 8, y: 25, width: 16, height: 2))
            case .spikes:
                for i in 0..<4 {
                    let base = CGFloat(i) * 7
                    tip.move(to: CGPoint(x: cx - 12 + base, y: 25))
                    tip.addLine(to: CGPoint(x: cx - 9 + base, y: 11))
                    tip.addLine(to: CGPoint(x: cx - 6 + base, y: 25))
                }
            case .gloss:
                // Dråpe
                tip.move(to: CGPoint(x: cx, y: 9))
                tip.addQuadCurve(to: CGPoint(x: cx + 6, y: 20),
                                 control: CGPoint(x: cx + 7, y: 13))
                tip.addArc(center: CGPoint(x: cx, y: 20), radius: 6,
                           startAngle: .zero, endAngle: .radians(.pi), clockwise: false)
                tip.addQuadCurve(to: CGPoint(x: cx, y: 9),
                                 control: CGPoint(x: cx - 7, y: 13))
            default:
                shaft.addRect(CGRect(x: cx - 3, y: 5, width: 6, height: 16))
                tip.addEllipse(in: CGRect(x: cx - 3, y: 21, width: 6, height: 10))
            }
            context.fill(shaft, with: .color(white.opacity(0.5)))
            switch type {
            case .smudge:
                context.fill(tip, with: .color(white.opacity(0.35)))
            case .hatch, .crosshatch, .forest, .debris, .organictex, .fur, .speedlines, .wethair, .spikes:
                context.stroke(tip, with: .color(white), lineWidth: 1.4)
            case .airbrush, .softfocus:
                context.fill(tip, with: .color(white.opacity(0.25)))
                context.fill(shaft, with: .color(white.opacity(0.45)))
            case .lightlift:
                context.stroke(tip, with: .color(white.opacity(0.6)), lineWidth: 2)
            case .shade, .graintex, .kneaded:
                context.fill(tip, with: .color(white.opacity(0.6)))
            default:
                context.fill(tip, with: .color(white))
            }
        }
    }
}

// Strøk-forhåndsvisning: hvit S-kurve på svart, bredde/dekning følger valget.
private struct StrokePreview: View {
    let size: Double
    let opacity: Double

    var body: some View {
        Canvas { context, canvasSize in
            var path = Path()
            let w = canvasSize.width, h = canvasSize.height
            path.move(to: CGPoint(x: w * 0.14, y: h * 0.62))
            path.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.45),
                          control1: CGPoint(x: w * 0.24, y: h * 0.28),
                          control2: CGPoint(x: w * 0.4, y: h * 0.72))
            path.addCurve(to: CGPoint(x: w * 0.86, y: h * 0.5),
                          control1: CGPoint(x: w * 0.62, y: h * 0.2),
                          control2: CGPoint(x: w * 0.72, y: h * 0.75))
            context.stroke(path,
                           with: .color(.white.opacity(opacity)),
                           style: StrokeStyle(lineWidth: max(2, size * 0.55),
                                              lineCap: .round, lineJoin: .round))
        }
        .background(Color.black, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border, lineWidth: 1))
    }
}

// Fullskjerm tegnemodus: pinch/slider-zoom (bredde-reflow → skarp
// re-rendring), finger panorerer, Pencil tegner (palm rejection),
// «Finger tegner»-toggle for enheter uten Pencil. Deler CanvasState med
// boardet (strokes/autosynk følger med); egen renderer-instans så inline-
// canvasens akkumulator ikke thrashes av to layouts.
struct FullscreenDrawView: View {
    @ObservedObject var canvasState: CanvasState
    let frame: FrameSummary
    @State private var renderer = MetalStrokeRenderer()
    @State private var fingerDraws = false
    @Environment(\.dismiss) private var dismiss

    private var aspect: CGFloat { CGFloat(frame.drawingWidth / max(1, frame.drawingHeight)) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("SHOT \(frame.shotNumber)")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Toggle(isOn: $fingerDraws) {
                    Text("Finger tegner").font(.system(size: 12))
                }
                .toggleStyle(.switch)
                .frame(width: 150)
                Button { dismiss() } label: {
                    Text("Ferdig").font(.system(size: 13, weight: .semibold))
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(.bar)
            BrushToolbar(canvasState: canvasState, onExport: nil)
            // Ekte UIScrollView-zoom: pinch ankrer rundt fingrene,
            // skarp re-rendring ved zoom-slutt.
            ZoomablePencilCanvas(state: canvasState, renderer: renderer,
                                 baseSize: CGSize(width: 1100, height: 1100 / aspect),
                                 fingerDraws: fingerDraws)
        }
        .background(Color.black)
    }
}

// Review-modus (web ReviewModeView): status + rollekommentarer per shot.
struct ReviewSheet: View {
    @ObservedObject var board: BoardState
    @State private var commentDrafts: [String: String] = [:]
    @State private var commentRole = "Director"
    @Environment(\.dismiss) private var dismiss

    private static let roles = ["Director", "DP", "Producer", "Editor", "Artist"]
    private static let statusLabels: [String: (String, Color)] = [
        "planned": ("PLANLAGT", .gray),
        "in_review": ("TIL REVIEW", .orange),
        "needs_work": ("TRENGER ARBEID", .red),
        "done": ("GODKJENT", .green),
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(board.scene?.frames ?? []) { frame in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Text(frame.shotNumber)
                                .font(.system(.subheadline, design: .monospaced).bold())
                            Text(frame.description.isEmpty ? "—" : frame.description)
                                .font(.subheadline).lineLimit(1)
                            Spacer()
                            if let (label, color) = Self.statusLabels[frame.frameStatus ?? "planned"] {
                                Text(label).font(.caption2.bold())
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(color.opacity(0.18), in: Capsule())
                                    .foregroundStyle(color)
                            }
                        }
                        HStack(spacing: 8) {
                            Button("Godkjenn") {
                                board.setFrameStatus(frameId: frame.id, status: "done")
                            }
                            .buttonStyle(.borderedProminent).tint(.green).controlSize(.small)
                            Button("Trenger arbeid") {
                                board.setFrameStatus(frameId: frame.id, status: "needs_work")
                            }
                            .buttonStyle(.bordered).tint(.red).controlSize(.small)
                        }
                        ForEach(frame.comments) { comment in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(comment.role) · \(comment.author)")
                                    .font(.caption2.bold()).foregroundStyle(.secondary)
                                Text(comment.text).font(.caption)
                            }
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.purple.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                        }
                        HStack(spacing: 6) {
                            Menu(commentRole) {
                                ForEach(Self.roles, id: \.self) { role in
                                    Button(role) { commentRole = role }
                                }
                            }
                            .font(.caption)
                            TextField("Kommentar…", text: Binding(
                                get: { commentDrafts[frame.id] ?? "" },
                                set: { commentDrafts[frame.id] = $0 }))
                                .textFieldStyle(.roundedBorder)
                                .font(.caption)
                            Button {
                                let text = (commentDrafts[frame.id] ?? "").trimmingCharacters(in: .whitespaces)
                                guard !text.isEmpty else { return }
                                board.addComment(frameId: frame.id, role: commentRole, text: text)
                                commentDrafts[frame.id] = ""
                            } label: {
                                Image(systemName: "paperplane.fill").font(.caption)
                            }
                            .disabled((commentDrafts[frame.id] ?? "").trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Review — \(board.scene?.heading ?? "")")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}

// PDF-eksport: bransjeleveransen — A4 landskap, én scene per seksjon,
// 3 shot-rader per side (thumb + kode + handling + metadata).
enum BoardPDFExporter {
    static func export(projectTitle: String, scenes: [SceneSummary]) -> URL? {
        let pageRect = CGRect(x: 0, y: 0, width: 842, height: 595) // A4 landskap pt
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) storyboard.pdf")
        do {
            try renderer.writePDF(to: url) { context in
                for scene in scenes where !scene.frames.isEmpty {
                    let shotsPerPage = 3
                    let pages = stride(from: 0, to: scene.frames.count, by: shotsPerPage).map {
                        Array(scene.frames[$0..<min($0 + shotsPerPage, scene.frames.count)])
                    }
                    for (pageIndex, pageFrames) in pages.enumerated() {
                        context.beginPage()
                        drawHeader(scene: scene, projectTitle: projectTitle,
                                   pageIndex: pageIndex, pageCount: pages.count, in: pageRect)
                        for (rowIndex, frame) in pageFrames.enumerated() {
                            drawShotRow(frame, rowIndex: rowIndex, in: pageRect)
                        }
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    private static func drawHeader(scene: SceneSummary, projectTitle: String,
                                   pageIndex: Int, pageCount: Int, in page: CGRect) {
        let title = "\(projectTitle)  ·  \(String(format: "%02d", scene.sceneNumber ?? 0)) \(scene.heading)"
            + (pageCount > 1 ? "  (\(pageIndex + 1)/\(pageCount))" : "")
        (title as NSString).draw(
            at: CGPoint(x: 36, y: 24),
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 13),
                             .foregroundColor: UIColor.black])
    }

    private static func drawShotRow(_ frame: FrameSummary, rowIndex: Int, in page: CGRect) {
        let top = 56.0 + Double(rowIndex) * 172
        let thumbRect = CGRect(x: 156, y: top, width: 280, height: 157.5)
        // Kodeboks
        (frame.shotNumber as NSString).draw(
            at: CGPoint(x: 36, y: top + 4),
            withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 14, weight: .bold),
                             .foregroundColor: UIColor.black])
        // Handling
        (frame.description as NSString).draw(
            in: CGRect(x: 36, y: top + 28, width: 110, height: 130),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                             .foregroundColor: UIColor.darkGray])
        // Frame
        UIColor.black.setStroke()
        let border = UIBezierPath(rect: thumbRect)
        border.lineWidth = 1
        border.stroke()
        if let image = decodeDataURL(frame.thumbnailDataURL) {
            image.draw(in: thumbRect)
        }
        // Metadata-kolonne
        let meta = [
            "CAM/SHOT  \(frame.shotType ?? "—")",
            "LENS  \(frame.lensMm.map { "\($0)mm" } ?? "—")",
            "MOVE  \(frame.movement ?? "—")",
            "DUR  \(String(format: "%.1f", frame.durationSec)) s",
            frame.beatTag.map { "BEAT  \($0)" } ?? "",
            frame.frameStatus.map { "STATUS  \($0)" } ?? "",
        ].filter { !$0.isEmpty }.joined(separator: "\n")
        (meta as NSString).draw(
            in: CGRect(x: 452, y: top + 4, width: 160, height: 150),
            withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                             .foregroundColor: UIColor.black])
        // Notater høyre
        if let notes = frame.notes, !notes.isEmpty {
            ("NOTES  " + notes as NSString).draw(
                in: CGRect(x: 620, y: top + 4, width: 186, height: 150),
                withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                 .foregroundColor: UIColor.darkGray])
        }
    }
}

// URL Identifiable for .sheet(item:)
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

// UIActivityViewController-bro for deling av PDF.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// Mini pensel-editor (spec §25-ånden): overstyr tekstur-parametre for valgt
// pensel. Overrides gjelder nye strøk til penselen byttes.
struct BrushEditorSheet: View {
    @ObservedObject var canvasState: CanvasState
    @Environment(\.dismiss) private var dismiss

    private func overrideBinding(
        _ keyPath: ReferenceWritableKeyPath<CanvasState, Double?>, default defaultValue: Double
    ) -> Binding<Double> {
        Binding(
            get: { canvasState[keyPath: keyPath] ?? defaultValue },
            set: { canvasState[keyPath: keyPath] = $0 }
        )
    }

    var body: some View {
        let preset = BrushSpec.preset(canvasState.brushType, size: canvasState.brushSize,
                                      color: canvasState.brushColor, opacity: canvasState.brushOpacity)
        NavigationStack {
            Form {
                Section("Tekstur") {
                    LabeledContent("Grain") {
                        Slider(value: overrideBinding(\.grainOverride, default: preset.grain), in: 0...1)
                    }
                    LabeledContent("Flow") {
                        Slider(value: overrideBinding(\.flowOverride, default: preset.flow), in: 0.02...1)
                    }
                }
                Section {
                    Button("Tilbakestill til preset") {
                        canvasState.grainOverride = nil
                        canvasState.flowOverride = nil
                    }
                }
            }
            .navigationTitle("Pensel-editor")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
            }
        }
    }
}

// Tonal-analyse (spec §42–§43): fordeling lys/mellom/mørk for aktivt shot,
// med flathetsvarsel. Kun analyse — foreslår, tvinger aldri.
struct ToneReportSheet: View {
    let report: ToneReport?
    @Environment(\.dismiss) private var dismiss

    private func bar(_ label: String, _ value: Double, hint: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(label).font(.system(size: 12, weight: .bold))
                Spacer()
                Text("\(Int(value * 100)) %")
                    .font(.system(size: 12).monospacedDigit()).foregroundStyle(.secondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule().fill(color).frame(width: max(3, geo.size.width * value))
                }
            }
            .frame(height: 10)
            Text(hint).font(.caption2).foregroundStyle(.secondary)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let report {
                    List {
                        Section {
                            bar("LYS (bakgrunn)", report.lightPct,
                                hint: "Fjell, tåke, fjern skog — 10–30 % mørkhet",
                                color: Color(white: 0.75))
                            bar("MELLOM (midtplan)", report.midPct,
                                hint: "Trær, kjøretøy, terreng — 30–55 %",
                                color: Color(white: 0.5))
                            bar("MØRK (forgrunn/hero)", report.darkPct,
                                hint: "Hovedfigurer, silhuetter — 60–90 %",
                                color: Color(white: 0.22))
                        } header: {
                            Text("Tonefordeling · \(Int(report.coveragePct * 100)) % av flaten dekket")
                        }
                        if report.isFlat {
                            Section {
                                Label("Flat tonefordeling: nesten alt ligger i ett bånd. Vurder å skille bakgrunn/midtplan/forgrunn med Vask, Skygge eller Tone.",
                                      systemImage: "exclamationmark.triangle")
                                    .font(.footnote)
                                    .foregroundStyle(.orange)
                            }
                        } else if report.coveragePct > 0.05 {
                            Section {
                                Label("God spredning over tonebåndene — dybden leses.",
                                      systemImage: "checkmark.circle")
                                    .font(.footnote)
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                } else {
                    ContentUnavailableView("Ingen tegning å analysere",
                                           systemImage: "chart.bar")
                }
            }
            .navigationTitle("Tone-analyse")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}

// Krasj-vern: usynkede strøk skrives til disk ved hver endring og slettes
// først når serveren har bekreftet. Overlever app-kill.
enum PendingStrokeStore {
    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("pending-strokes", isDirectory: true)
    }

    private static func fileURL(_ frameId: String) -> URL {
        directory.appendingPathComponent("\(frameId).json")
    }

    static func save(_ json: String, frameId: String) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? json.write(to: fileURL(frameId), atomically: true, encoding: .utf8)
    }

    static func load(frameId: String) -> String? {
        try? String(contentsOf: fileURL(frameId), encoding: .utf8)
    }

    static func clear(frameId: String) {
        try? FileManager.default.removeItem(at: fileURL(frameId))
    }
}

private struct FlowTags: View {
    let tags: [String]
    var onRemove: ((String) -> Void)?

    var body: some View {
        // Wrap-layout: chips brytes over linjer (maks 3 per rad i 250pt-panelet)
        let rows = stride(from: 0, to: tags.count, by: 3).map { Array(tags[$0..<min($0 + 3, tags.count)]) }
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 6) {
                    ForEach(row, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                                .font(.system(size: 10, weight: .bold)).kerning(0.5)
                                .foregroundStyle(.white)
                            if let onRemove {
                                Button { onRemove(tag) } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(.white.opacity(0.55))
                                        .frame(width: 20, height: 20)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Fjern \(tag)")
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.white.opacity(0.08), in: Capsule())
                    }
                }
            }
        }
    }
}

// Script-fanen: manusvisning av scenene (slugline + handling + karakterer).
struct ScriptSheet: View {
    let scenes: [SceneSummary]
    let activeIndex: Int
    @Environment(\.dismiss) private var dismiss

    private func slugline(_ scene: SceneSummary, index: Int) -> String {
        let parts = [scene.intExt?.uppercased(),
                     scene.location?.uppercased(),
                     scene.timeOfDay.map { "— \($0.uppercased())" }]
            .compactMap(\.self)
        let head = parts.isEmpty ? scene.heading.uppercased() : parts.joined(separator: " ")
        return "\(scene.sceneNumber ?? index + 1). \(head)"
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        ForEach(Array(scenes.enumerated()), id: \.element.id) { index, scene in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(slugline(scene, index: index))
                                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                                if let text = scene.descriptionText, !text.isEmpty {
                                    Text(text)
                                        .font(.system(size: 13, design: .monospaced))
                                        .lineSpacing(3)
                                }
                                if !scene.characters.isEmpty {
                                    // Karakterfeltet kan inneholde rolle-ID-er
                                    // («…-ROLE-NORA») — vis bare navnedelen.
                                    Text(scene.characters
                                        .map { $0.components(separatedBy: "-ROLE-").last ?? $0 }
                                        .map { $0.uppercased() }
                                        .joined(separator: " · "))
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                }
                                Text("\(scene.frames.count) \(scene.frames.count == 1 ? "SHOT" : "SHOTS") PÅ BOARDET")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Color.purple)
                            }
                            .id(index)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(index == activeIndex ? Color.purple.opacity(0.08) : Color.clear,
                                        in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(20)
                }
                .onAppear { proxy.scrollTo(activeIndex, anchor: .top) }
            }
            .navigationTitle("Script")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}
