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

private func decodeDataURL(_ dataURL: String?) -> UIImage? {
    guard let dataURL, dataURL.hasPrefix("data:"),
          let comma = dataURL.firstIndex(of: ","),
          let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else { return nil }
    return UIImage(data: data)
}

@MainActor
final class BoardState: ObservableObject {
    let manuscript: ManuscriptSummary
    @Published var scenes: [SceneSummary] = []
    @Published var selectedSceneIndex = 0
    @Published var activeFrameIndex = 0
    @Published var errorMessage: String?
    @Published var syncStatus: String?

    init(manuscript: ManuscriptSummary) {
        self.manuscript = manuscript
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
        syncStatus = "…"
        Task {
            do {
                let newId = try await RoleRoomAPIClient.shared.addFrame(
                    manuscriptId: manuscript.id, sceneId: scene.id)
                await reload()
                if let index = self.scene?.frames.firstIndex(where: { $0.id == newId }) {
                    activeFrameIndex = index
                }
                syncStatus = "Shot lagt til ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func patchActiveFrame(_ fields: [String: any Sendable]) {
        guard let scene, let frame else { return }
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: manuscript.id, sceneId: scene.id, frameId: frame.id, fields: fields)
                await reload()
                syncStatus = "Synket ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
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
    @State private var boardTool: BoardTool = .draw
    @State private var textPromptShown = false
    @State private var textPromptValue = ""
    @State private var textPromptPoint: CGPoint = .zero
    @Environment(\.dismiss) private var dismiss

    init(manuscript: ManuscriptSummary) {
        _board = StateObject(wrappedValue: BoardState(manuscript: manuscript))
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
        .task { await board.reload() }
        .onChange(of: board.activeFrameIndex) { loadActiveFrameIntoCanvas() }
        .onChange(of: board.selectedSceneIndex) { board.activeFrameIndex = 0; loadActiveFrameIntoCanvas() }
        .onChange(of: board.scenes.count) { loadActiveFrameIntoCanvas() }
    }

    // Forrige lastede frame + strøkantall — usynkede strøk flushes automatisk
    // ved shot-/scenebytte så tegning ikke mistes uten eksplisitt Synk.
    @State private var loadedFrameRef: (sceneId: String, frameId: String)?
    @State private var loadedStrokeCount = 0

    private func loadActiveFrameIntoCanvas() {
        flushPendingStrokes()
        canvasState.contentSize = board.frame.map {
            CGSize(width: $0.drawingWidth, height: $0.drawingHeight)
        }
        if let json = board.frame?.strokesJSON,
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
        loadedStrokeCount = canvasState.strokes.count
    }

    private func flushPendingStrokes() {
        guard let ref = loadedFrameRef, canvasState.strokes.count != loadedStrokeCount,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        let manuscriptId = board.manuscript.id
        Task {
            try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: manuscriptId, sceneId: ref.sceneId,
                frameId: ref.frameId, strokesJSON: json)
        }
    }

    private func syncActiveFrameStrokes() {
        guard let scene = board.scene, let frame = board.frame else { return }
        board.syncStatus = "…"
        Task {
            do {
                let json = try StrokeSerialization.encodeToWebJSON(canvasState.strokes)
                try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: board.manuscript.id, sceneId: scene.id, frameId: frame.id, strokesJSON: json)
                loadedStrokeCount = canvasState.strokes.count
                board.syncStatus = "Synket ✓"
            } catch {
                board.syncStatus = error.localizedDescription
            }
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
                topTab("Animatic", icon: "play.rectangle", active: false) { showAnimatic = true }
            }
            Spacer()
            if let status = board.syncStatus {
                Text(status).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            }
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
            panelLabel("Scenes").padding(.horizontal, 14).padding(.vertical, 12)
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
    }

    private var sheetScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(Array((board.scene?.frames ?? []).enumerated()), id: \.element.id) { index, frame in
                    shotRow(frame: frame, index: index)
                }
            }
            .padding(28)
            .background(BoardBrand.sheet, in: RoundedRectangle(cornerRadius: 4))
            .shadow(color: .black.opacity(0.4), radius: 22, y: 8)
            .padding(.vertical, 24)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .background(BoardBrand.workspace)
    }

    private func shotRow(frame: FrameSummary, index: Int) -> some View {
        let isActive = index == board.activeFrameIndex
        return HStack(alignment: .top, spacing: 18) {
            // Venstre: kode + ACTION/DIALOG + NOTES
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(frame.shotNumber)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(BoardBrand.inkOnSheet)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(.white, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(white: 0.25), lineWidth: 1.5))
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
            ZStack(alignment: .topLeading) {
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
        .onChange(of: board.frame?.id) { notesDraft = board.frame?.notes ?? "" }
        .onAppear { notesDraft = board.frame?.notes ?? "" }
    }

    @State private var notesDraft = ""
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
        .frame(height: 148)
        .background(BoardBrand.panel)
    }

    private static let brushChips: [(BrushType, String)] = [
        (.pencil, "Blyant"), (.graphite, "Grafitt"), (.charcoal, "Kull"),
        (.conte, "Conté"), (.pen, "Penn"), (.ink, "Tusj"), (.marker, "Marker"),
        (.highlighter, "Highlight"), (.smudge, "Smudge"), (.eraser, "Viskelær"),
    ]

    private var brushColorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: canvasState.brushColor) ?? .black },
            set: { canvasState.brushColor = $0.hexString }
        )
    }

    private var brushesPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                panelLabel("Brushes")
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
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Self.brushChips, id: \.0) { type, name in
                        let selected = canvasState.brushType == type
                        Button { canvasState.brushType = type } label: {
                            Text(name)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(selected ? .white : BoardBrand.dim)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(selected ? BoardBrand.accent : Color.white.opacity(0.06), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            HStack(spacing: 14) {
                ColorPicker("Farge", selection: brushColorBinding, supportsOpacity: false)
                    .labelsHidden().frame(width: 32)
                sliderRow("Size", value: $canvasState.brushSize, range: 1...48,
                          display: "\(Int(canvasState.brushSize)) px")
                sliderRow("Opacity", value: $canvasState.brushOpacity, range: 0.1...1,
                          display: "\(Int(canvasState.brushOpacity * 100))%")
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

    private var layersPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                panelLabel("Layers")
                Spacer()
                // Opacity for aktivt lag (mockup: slider øverst i panelet)
                Slider(value: activeLayerOpacityBinding, in: 0.1...1)
                    .tint(BoardBrand.accent)
                    .frame(width: 70)
                Text("\(Int((canvasState.layerOpacity[canvasState.activeBoardLayer] ?? 1) * 100))%")
                    .font(.system(size: 9).monospacedDigit()).foregroundStyle(BoardBrand.dim)
                    .frame(width: 30, alignment: .trailing)
            }
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
        }
        .padding(12)
        .frame(width: 190)
    }

    private var navigatorPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            panelLabel("Navigator")
            ZStack {
                if let image = decodeDataURL(board.frame?.thumbnailDataURL) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Color.white.opacity(0.05)
                    Text("SHOT \(board.frame?.shotNumber ?? "—")")
                        .font(.system(size: 10, weight: .bold)).foregroundStyle(BoardBrand.dim)
                }
            }
            .aspectRatio(2.39, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(BoardBrand.accent.opacity(0.6), lineWidth: 1))
            if let frame = board.frame {
                Text("\(frame.shotNumber) · \(Int(frame.durationSec)) SEC")
                    .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
            }
        }
        .padding(12)
        .frame(width: 190)
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
private struct NotesDiagramMini: View {
    let strokesJSON: String?
    let contentWidth: Double

    private var noteStrokes: [PencilStroke] {
        (strokesJSON.flatMap { try? StrokeSerialization.decodeFromWebJSON($0) } ?? [])
            .filter { $0.boardLayer == "Notes" && $0.textAnnotation == nil }
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
