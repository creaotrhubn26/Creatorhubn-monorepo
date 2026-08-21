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
            activeFrameIndex = 0
        } catch {
            errorMessage = error.localizedDescription
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

struct NativeBoardView: View {
    @StateObject private var board: BoardState
    @StateObject private var canvasState = CanvasState()
    @State private var renderer = MetalStrokeRenderer()
    @State private var showAnimatic = false
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

    private func loadActiveFrameIntoCanvas() {
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
    }

    private func syncActiveFrameStrokes() {
        guard let scene = board.scene, let frame = board.frame else { return }
        board.syncStatus = "…"
        Task {
            do {
                let json = try StrokeSerialization.encodeToWebJSON(canvasState.strokes)
                try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: board.manuscript.id, sceneId: scene.id, frameId: frame.id, strokesJSON: json)
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
            if let status = board.syncStatus {
                Text(status).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            }
            Button { showAnimatic = true } label: {
                Image(systemName: "play.circle")
                    .font(.system(size: 18)).foregroundStyle(BoardBrand.dim)
            }
            .disabled((board.scene?.frames.isEmpty) ?? true)
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

    private var sheetArea: some View {
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
            }
            .frame(width: 150, alignment: .leading)

            // Midt: aktiv = live Metal-canvas, ellers thumbnail
            ZStack {
                if isActive, renderer != nil {
                    PencilCanvasView(state: canvasState, renderer: renderer)
                        .background(Color(red: 0.992, green: 0.992, blue: 0.984))
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
                    inspectorPicker("Movement", value: frame.movement,
                                    options: ["Static", "Pan", "Tilt", "Push In", "Tracking", "Handheld"]) {
                        board.patchActiveFrame(["movement": $0])
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

                    if !frame.tags.isEmpty {
                        panelLabel("Tags")
                        FlowTags(tags: frame.tags)
                    }
                } else {
                    Text("Velg et shot").font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                }
            }
            .padding(14)
        }
        .frame(width: 250)
        .background(BoardBrand.chrome)
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

    private var layersPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            panelLabel("Layers")
            ForEach(BoardLayers.all, id: \.self) { layer in
                let active = canvasState.activeBoardLayer == layer
                let hidden = canvasState.hiddenLayers.contains(layer)
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
                    Button { canvasState.activeBoardLayer = layer } label: {
                        Text(layer)
                            .font(.system(size: 11, weight: active ? .bold : .regular))
                            .foregroundStyle(active ? .white : BoardBrand.dim)
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
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

private struct FlowTags: View {
    let tags: [String]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.system(size: 10, weight: .bold)).kerning(0.5)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.white.opacity(0.08), in: Capsule())
            }
        }
    }
}
