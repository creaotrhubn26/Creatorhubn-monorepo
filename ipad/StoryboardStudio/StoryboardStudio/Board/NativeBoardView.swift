import SwiftUI
import UIKit
import PhotosUI
import AVFoundation

// Native Board Pro — mockup-flaten («Neon City», STORYBOARD_DESIGN.md §4b)
// i SwiftUI rundt Metal-motoren, med Role Room-brand (fiolett aksent).
// Aktiv shot-rute er en LIVE PencilCanvasView (predicted touches, stamp-
// commit); inaktive ruter viser synkede thumbnails. Inspector patcher
// frame-felter rett mot samme scene-upsert som web.

enum BoardBrand {
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

func decodeDataURL(_ dataURL: String?) -> UIImage? {
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

    /// Live-polling: 304-billig sjekk mot serveren; true = noe endret og
    /// summaries er lastet på nytt.
    func refreshFromServer() async -> Bool {
        let changed = await RoleRoomAPIClient.shared.pollScenesChanged(manuscriptId: manuscript.id)
        if changed { await reload() }
        return changed
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

    @Published var sceneDeleteUndoAvailable = false

    func deleteScene(sceneId: String) {
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.deleteScene(
                    manuscriptId: manuscript.id, sceneId: sceneId)
                await reload()
                selectedSceneIndex = min(selectedSceneIndex, max(0, scenes.count - 1))
                activeFrameIndex = 0
                syncStatus = "Scene slettet ✓"
                sceneDeleteUndoAvailable = true
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                sceneDeleteUndoAvailable = false
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func undoSceneDelete() {
        syncStatus = "…"
        sceneDeleteUndoAvailable = false
        Task {
            do {
                try await RoleRoomAPIClient.shared.undoLastSceneDelete()
                await reload()
                syncStatus = "Scene gjenopprettet ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func duplicateScene(sceneId: String) {
        syncStatus = "…"
        Task {
            do {
                let newId = try await RoleRoomAPIClient.shared.duplicateScene(
                    manuscriptId: manuscript.id, sceneId: sceneId)
                await reload()
                if let index = scenes.firstIndex(where: { $0.id == newId }) {
                    selectedSceneIndex = index
                    activeFrameIndex = 0
                }
                syncStatus = "Scene duplisert ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func renameScene(sceneId: String, title: String) {
        syncStatus = "…"
        Task {
            do {
                try await RoleRoomAPIClient.shared.renameScene(
                    manuscriptId: manuscript.id, sceneId: sceneId, title: title)
                await reload()
                syncStatus = "Omdøpt ✓"
            } catch {
                syncStatus = error.localizedDescription
            }
        }
    }

    func renumberShots() {
        guard let scene else { return }
        runMutation("Renummerert ✓") {
            try await RoleRoomAPIClient.shared.renumberFrames(
                manuscriptId: self.manuscript.id, sceneId: scene.id)
            return nil
        }
    }

    /// Flytt shot til eksakt posisjon (drag-reorder).
    func moveShot(frameId: String, toIndex target: Int) {
        guard let scene,
              let source = scene.frames.firstIndex(where: { $0.id == frameId }),
              source != target else { return }
        moveShot(frameId: frameId, offset: target - source)
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

struct BoardCanvasBackground {
    let editableBase: CGImage?
    let referenceUnderlay: CGImage?
    let referenceOpacity: Double
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
    @State private var sceneThumbnailImages: [String: UIImage] = [:]
    @State private var retainedEditableBaseImages: [String: UIImage] = [:]
    @State private var activeImageLoadTask: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    enum InitialSheet { case script, shotList, animatic, review }

    init(manuscript: ManuscriptSummary, projectId: String? = nil,
         initialSceneIndex: Int = 0, initialSheet: InitialSheet? = nil) {
        let state = BoardState(manuscript: manuscript, projectId: projectId)
        state.selectedSceneIndex = initialSceneIndex
        _board = StateObject(wrappedValue: state)
        _showScript = State(initialValue: initialSheet == .script)
        _showShotList = State(initialValue: initialSheet == .shotList)
        _showAnimatic = State(initialValue: initialSheet == .animatic)
        _showReview = State(initialValue: initialSheet == .review)
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
                         frames: board.scene?.frames ?? [],
                         onVoiceoverChanged: { frameId, dataURL in
                             board.patchFrame(frameId: frameId, fields: [
                                 "voiceoverDataURL": dataURL ?? NSNull(),
                             ])
                         })
        }
        .fullScreenCover(isPresented: $showFullscreenDraw) {
            if let frame = board.frame {
                FullscreenDrawView(canvasState: canvasState, frame: frame,
                                   background: composedCanvasBackground())
            }
        }
        .task { await board.reload() }
        .task(id: scenePreviewTaskKey) { await rebuildSceneThumbnails() }
        .onChange(of: board.activeFrameIndex) { loadActiveFrameIntoCanvas() }
        .onChange(of: board.selectedSceneIndex) { board.activeFrameIndex = 0; loadActiveFrameIntoCanvas() }
        .onChange(of: board.scenes.count) { loadActiveFrameIntoCanvas() }
        .onChange(of: canvasState.revision) { scheduleAutosync() }
        .onChange(of: board.frame?.imageUrl) { loadActiveFrameIntoCanvas() }
        .onChange(of: onionMode) { applyUnderlay(to: renderer) }
        .onChange(of: board.frame?.underlayDataURL) { applyUnderlay(to: renderer) }
        .onChange(of: board.frame?.underlayOpacity) { applyUnderlay(to: renderer) }
        .onChange(of: perspectiveMode) { persistPerspective(); updateSnapState() }
        .onChange(of: perspectiveSnap) { updateSnapState() }
        .task {
            // Retry-løkke for usynkede frames (nett tilbake / feilet synk).
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                if !pendingFrameIds.isEmpty { flushAllPending() }
            }
        }
        .task {
            // Live-polling (30 s, 304-billig med ETag): web-endringer dukker
            // opp uten app-restart. Aktiv frame reloades kun når vi ikke har
            // lokale usynkede endringer.
            presentOthers = await RoleRoomAPIClient.shared.reportPresence(
                manuscriptId: board.manuscript.id)
            while !Task.isCancelled {
                // Andre til stede → tettere polling (10 s, 304-billig).
                let interval: UInt64 = presentOthers.isEmpty ? 30 : 10
                try? await Task.sleep(nanoseconds: interval * 1_000_000_000)
                guard !Task.isCancelled else { break }
                presentOthers = await RoleRoomAPIClient.shared.reportPresence(
                    manuscriptId: board.manuscript.id)
                let changed = await board.refreshFromServer()
                if changed, let other = presentOthers.first {
                    board.syncStatus = "Oppdatert fra \(other)"
                }
                if changed,
                   canvasState.revision == loadedRevision,
                   board.frame?.updatedAt != loadedFrameUpdatedAt {
                    loadActiveFrameIntoCanvas()
                }
            }
        }
        .onChange(of: boardTool) { selectedStrokeIds = [] }
    }

    // Forrige lastede frame + strøkantall — usynkede strøk flushes automatisk
    // ved shot-/scenebytte så tegning ikke mistes uten eksplisitt Synk.
    @State private var loadedFrameRef: (sceneId: String, frameId: String)?
    @State private var loadedRevision = 0
    @State private var loadedFrameUpdatedAt: String?
    @State private var pendingFrameIds: Set<String> = []

    private func loadActiveFrameIntoCanvas() {
        flushPendingStrokes()
        autosyncTask?.cancel()
        activeImageLoadTask?.cancel()
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
        loadedFrameUpdatedAt = board.frame?.updatedAt
        // Behold siste dekodede raster for samme frame mens en ny URL
        // lastes. Da blinker ikke aktivt shot (typisk 1A) til blankt når
        // live-polling eller en ny bildeversjon trigger canvas-rebuild.
        if let frame = board.frame,
           let image = FrameImageCache.image(for: frame.imageUrl) {
            retainedEditableBaseImages[frame.id] = image
        }
        // Remote panel-bilde: hent async og re-render kun dersom samme
        // frame/URL fortsatt er aktiv når forespørselen fullføres.
        if let imageUrl = board.frame?.imageUrl, !imageUrl.hasPrefix("data:"),
           FrameImageCache.images[imageUrl] == nil, let frame = board.frame {
            let frameId = frame.id
            activeImageLoadTask = Task {
                await FrameImageCache.prefetch(frames: [frame])
                guard !Task.isCancelled,
                      let image = FrameImageCache.images[imageUrl] else { return }
                retainedEditableBaseImages[frameId] = image
                guard board.frame?.id == frameId,
                      board.frame?.imageUrl == imageUrl else { return }
                applyUnderlay(to: renderer)
            }
        }
        perspectiveMode = board.frame?.perspectiveMode ?? 0
        vanishingPoints = (board.frame?.vanishingPoints ?? []).compactMap { pair in
            pair.count == 2 ? CGPoint(x: pair[0], y: pair[1]) : nil
        }
        applyUnderlay(to: renderer)
        updateSnapState()
        pendingFrameIds = PendingStrokeStore.pendingFrameIds()
        canvasState.revision += 1
        loadedRevision = canvasState.revision
        if restoredPending {
            // Marker som usynket så autosynken plukker den opp (thumb
            // rendres etter at canvasen har rebuildet den nye framen).
            loadedRevision = -1
            scheduleAutosync()
        }
    }

    /// Gjenopprett en historikk-versjon: vanlig strokes-lagring (dagens
    /// versjon havner selv i historikken server-side — angrbart).
    private func restoreHistory(entry: (updatedAt: String, strokes: String)) {
        guard let ref = historyFrameRef else { return }
        showHistorySheet = false
        let manuscriptId = board.manuscript.id
        Task {
            _ = try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: manuscriptId, sceneId: ref.sceneId,
                frameId: ref.frameId, strokesJSON: entry.strokes)
            await board.reload()
            if board.frame?.id == ref.frameId { loadActiveFrameIntoCanvas() }
            board.syncStatus = "Gjenopprettet ✓"
        }
    }

    /// Snap-tilstand → canvas (VP-er i innholdsrom).
    private func updateSnapState() {
        let contentWidth = board.frame?.drawingWidth ?? 1920
        let contentHeight = board.frame?.drawingHeight ?? 1080
        let active = (1...3).contains(perspectiveMode) && perspectiveSnap
        canvasState.perspectiveSnapEnabled = active
        canvasState.perspectiveSnapPoints = active
            ? vanishingPoints.map { CGPoint(x: $0.x * contentWidth, y: $0.y * contentHeight) }
            : []
    }

    // Kuratert symbolsett for stamp-penselen (presentasjons-ikoner).
    static let stampSymbols = ["person.fill", "heart", "target", "chart.bar.fill",
                               "star.fill", "checkmark.seal", "exclamationmark.triangle",
                               "camera.fill", "lightbulb", "hand.thumbsup"]

    /// SF Symbol → PNG-dataURL som penselspiss (form = alfakanal).
    static func symbolTipDataURL(_ name: String) -> String? {
        let config = UIImage.SymbolConfiguration(pointSize: 100, weight: .medium)
        guard let symbol = UIImage(systemName: name, withConfiguration: config)?
            .withTintColor(.black, renderingMode: .alwaysOriginal) else { return nil }
        let side = 128.0
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side),
                                            format: format).image { _ in
            let fit = min(side / symbol.size.width, side / symbol.size.height) * 0.86
            let drawSize = CGSize(width: symbol.size.width * fit, height: symbol.size.height * fit)
            symbol.draw(in: CGRect(x: (side - drawSize.width) / 2,
                                   y: (side - drawSize.height) / 2,
                                   width: drawSize.width, height: drawSize.height))
        }
        guard let png = image.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }

    /// B2-opplasting med dataURL-fallback. Filene legges I PRODUKSJONS-
    /// STRUKTUREN, ikke løst i bucketen: projectId + sceneId + entity-
    /// kobling (storyboard_frame/scene) driver per-prosjekt-visningen og
    /// entity-files-oppslaget i Role Room-lagringen, og filnavnet bærer
    /// prosjekt/scene/shot for menneskelig lesbarhet.
    static func uploadOrInline(dataURL: String, name: String, board: BoardState,
                               sceneId: String? = nil,
                               entityType: String? = nil,
                               entityId: String? = nil,
                               note: String? = nil) async -> String {
        guard let comma = dataURL.firstIndex(of: ","),
              let jpeg = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else {
            return dataURL
        }
        do {
            let path = try await RoleRoomAPIClient.shared.uploadStorageImage(
                jpegData: jpeg, name: name,
                projectId: board.projectId,
                sceneId: sceneId,
                attachedToEntityType: entityType,
                attachedToEntityId: entityId,
                attachmentNote: note)
            await MainActor.run {
                FrameImageCache.images[path] = UIImage(data: jpeg)
            }
            return path
        } catch {
            return dataURL
        }
    }

    /// Nedskalert JPEG-dataURL (payload-diett for scene-synk).
    static func jpegDataURL(_ image: UIImage, maxSide: Double, quality: Double) -> String? {
        let scaleFactor = min(1, maxSide / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scaleFactor,
                          height: image.size.height * scaleFactor)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = scaled.jpegData(compressionQuality: quality) else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }

    /// Persister perspektiv-oppsettet på framen (visnings-metadata; web
    /// ignorerer feltene).
    private func persistPerspective() {
        guard board.frame != nil else { return }
        board.patchActiveFrame([
            "perspectiveMode": perspectiveMode,
            "vanishingPoints": vanishingPoints.map { [Double($0.x), Double($0.y)] },
        ])
    }

    /// Dekod frame-underlag + ev. onion-skin (forrige shot) og sett på
    /// gitt renderer (inline og fullskjerm har hver sin instans).
    private func applyUnderlay(to target: MetalStrokeRenderer?) {
        let background = composedCanvasBackground()
        target?.setEditableBase(cgImage: background.editableBase)
        target?.setUnderlay(cgImage: background.referenceUnderlay,
                            opacity: background.referenceOpacity)
        canvasState.backgroundRevision += 1
    }

    /// Et faktisk panelbilde går inn i rasterakkumulatoren og kan viskes i.
    /// Referansefoto/onion uten panelbilde forblir et skjerm-underlag.
    private func composedCanvasBackground() -> BoardCanvasBackground {
        let (composed, opacity) = composedUnderlay()
        if board.frame?.imageUrl != nil {
            return BoardCanvasBackground(editableBase: composed,
                                         referenceUnderlay: nil, referenceOpacity: 0)
        }
        return BoardCanvasBackground(editableBase: nil,
                                     referenceUnderlay: composed, referenceOpacity: opacity)
    }

    /// Komponert underlag (referansefoto + onion-lag) for aktiv frame —
    /// deles med fullskjerm så begge renderere viser det samme.
    private func composedUnderlay() -> (CGImage?, Double) {
        // Bilde-frame: statisk innhold tegnes underst med full opacity
        // (i motsetning til referanse-underlaget følger det med i eksport
        // via FrameRenderService).
        let frameImage = board.frame.flatMap { frame in
            FrameImageCache.image(for: frame.imageUrl)
                ?? retainedEditableBaseImages[frame.id]
                ?? frame.thumbnailDataURL.flatMap(decodeDataURL)
        }
        let underlayImage = board.frame?.underlayDataURL.flatMap(decodeDataURL)
        // Onion-kilder med alpha: forrige tydeligst, nabo nummer to svakere.
        var onionLayers: [(image: UIImage, alpha: CGFloat)] = []
        if onionMode > 0, let scene = board.scene {
            func render(_ index: Int) -> UIImage? {
                guard scene.frames.indices.contains(index) else { return nil }
                return FrameRenderService.image(for: scene.frames[index], maxWidth: 1120)
                    ?? decodeDataURL(scene.frames[index].thumbnailDataURL)
            }
            let current = board.activeFrameIndex
            if let previous = render(current - 1) { onionLayers.append((previous, 0.35)) }
            if onionMode == 2, let next = render(current + 1) { onionLayers.append((next, 0.2)) }
            if onionMode == 3, let older = render(current - 2) { onionLayers.append((older, 0.2)) }
        }
        let opacity = board.frame?.underlayOpacity ?? 0.4
        switch (underlayImage, onionLayers.isEmpty && frameImage == nil) {
        case (nil, true):
            return (nil, 0)
        case (let underlay?, true):
            return (underlay.cgImage, opacity)
        default:
            // Komponer på papirfarget flate (samlet opacity 1 i shaderen).
            let width = 1120.0
            let height = width * (board.frame.map { $0.drawingHeight / max(1, $0.drawingWidth) } ?? 9.0 / 16)
            let size = CGSize(width: width, height: height)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let composed = UIGraphicsImageRenderer(size: size, format: format).image { context in
                UIColor(red: 0.961, green: 0.949, blue: 0.918, alpha: 1).setFill()
                context.fill(CGRect(origin: .zero, size: size))
                if let base = frameImage {
                    base.draw(in: CGRect(origin: .zero, size: size))
                }
                if let underlay = underlayImage {
                    underlay.draw(in: CGRect(origin: .zero, size: size), blendMode: .normal, alpha: opacity)
                }
                for layer in onionLayers {
                    layer.image.draw(in: CGRect(origin: .zero, size: size),
                                     blendMode: .multiply, alpha: layer.alpha)
                }
            }
            return (composed.cgImage, 1)
        }
    }

    private func flushPendingStrokes() {
        guard let ref = loadedFrameRef, canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        let manuscriptId = board.manuscript.id
        Task {
            _ = try? await RoleRoomAPIClient.shared.saveFrameStrokes(
                manuscriptId: manuscriptId, sceneId: ref.sceneId,
                frameId: ref.frameId, strokesJSON: json)
        }
    }

    @State private var autosyncTask: Task<Void, Never>?

    private func syncActiveFrameStrokes() {
        guard let scene = board.scene, let frame = board.frame else { return }
        // Re-entrancy-vern (E2E-QA fant race): manuell Synk + autosynk-
        // timeren samtidig ga to parallelle saves og visnings-desynk.
        guard !syncInFlight else { return }
        syncInFlight = true
        board.syncStatus = "…"
        // Thumb rendres fra akkumulatoren så SCENES/minimap viser native
        // tegninger uten å vente på web.
        let thumbnail = renderer?.thumbnailDataURL()
        Task {
            do {
                let json = try StrokeSerialization.encodeToWebJSON(canvasState.strokes)
                let result = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                    manuscriptId: board.manuscript.id, sceneId: scene.id, frameId: frame.id,
                    strokesJSON: json, thumbnailDataURL: thumbnail,
                    baseUpdatedAt: loadedFrameUpdatedAt)
                loadedRevision = canvasState.revision
                // KRITISK (funnet av E2E-QA): uten oppdatert baseline så
                // NESTE synk på samme frame en falsk konflikt → union-merge
                // gjenopplivet slettede/angrede strøk for alltid.
                loadedFrameUpdatedAt = result.updatedAt ?? loadedFrameUpdatedAt
                PendingStrokeStore.clear(frameId: frame.id)
                pendingFrameIds.remove(frame.id)
                if result.merged {
                    // Ekte konflikt: serveren hadde nyere strøk — hent unionen
                    // inn i canvasen så lokal visning matcher det som ble lagret.
                    await board.reload()
                    loadActiveFrameIntoCanvas()
                    board.syncStatus = "Synket (flettet med annen enhet) ✓"
                } else {
                    board.syncStatus = "Synket ✓"
                }
            } catch SyncError.unauthenticated {
                board.syncStatus = "Token utløpt — logg inn på nytt"
            } catch {
                // Pending-fil beholdes; neste autosynk prøver igjen.
                board.syncStatus = error.localizedDescription
            }
            syncInFlight = false
        }
    }

    /// Synk alle usynkede frames fra disk-backupen — kjøres fra «Synk nå»
    /// og en 60 s retry-timer (nett tilbake skal ikke kreve at hver frame
    /// åpnes på nytt).
    private func flushAllPending() {
        for frameId in PendingStrokeStore.pendingFrameIds() {
            if frameId == board.frame?.id {
                syncActiveFrameStrokes()
                continue
            }
            guard let scene = board.scenes.first(where: { scene in
                scene.frames.contains { $0.id == frameId }
            }), let json = PendingStrokeStore.load(frameId: frameId) else { continue }
            let manuscriptId = board.manuscript.id
            let sceneId = scene.id
            Task {
                do {
                    _ = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                        manuscriptId: manuscriptId, sceneId: sceneId,
                        frameId: frameId, strokesJSON: json)
                    PendingStrokeStore.clear(frameId: frameId)
                    pendingFrameIds.remove(frameId)
                } catch {
                    // beholdes på disk; neste retry tar den
                }
            }
        }
    }

    // Autosynk: backup til disk straks, nett-synk etter 3 s ro.
    private func scheduleAutosync() {
        guard let frame = board.frame,
              canvasState.revision != loadedRevision,
              let json = try? StrokeSerialization.encodeToWebJSON(canvasState.strokes) else { return }
        PendingStrokeStore.save(json, frameId: frame.id)
        pendingFrameIds.insert(frame.id)
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
            if !pendingFrameIds.isEmpty {
                Button { flushAllPending() } label: {
                    Label("\(pendingFrameIds.count) usynket — synk nå",
                          systemImage: "arrow.triangle.2.circlepath")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.orange)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Synk nå")
            }
            if !presentOthers.isEmpty {
                Label(presentOthers.joined(separator: ", "), systemImage: "eye")
                    .font(.system(size: 11))
                    .foregroundStyle(BoardBrand.accent)
                    .lineLimit(1)
                    .accessibilityLabel("Andre aktive: \(presentOthers.joined(separator: ", "))")
            }
            if board.sceneDeleteUndoAvailable {
                Button { board.undoSceneDelete() } label: {
                    Text("Angre sletting")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(BoardBrand.accent, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            if let status = board.syncStatus {
                Text(status).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
                if status.localizedCaseInsensitiveContains("token") {
                    // Token utløp midt i økta — re-auth uten å miste tegningen.
                    Button {
                        showReauth = true
                    } label: {
                        Text("Logg inn")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.red.opacity(0.8), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            Button {
                toneReport = renderer?.toneReport()
                heroReport = renderer?.heroAnalysis()
                showToneReport = true
            } label: {
                Image(systemName: "chart.bar")
                    .font(.system(size: 15)).foregroundStyle(BoardBrand.dim)
            }
            .accessibilityLabel("Tone-analyse")
            if let progress = pdfExportProgress {
                Text("Eksporterer \(progress)")
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(BoardBrand.dim)
            }
            Menu {
                Button {
                    exportPDF(includeUnderlay: false)
                } label: {
                    Label("PDF", systemImage: "doc.richtext")
                }
                Button {
                    exportPDF(includeUnderlay: true)
                } label: {
                    Label("PDF med underlag", systemImage: "photo.on.rectangle")
                }
                Button {
                    presentationConceptDraft = board.scenes.first?.presentationConcept ?? ""
                    presentationFooterDraft = PresentationFooter.decode(
                        board.scenes.first?.presentationFooter)
                    showPresentationSetup = true
                } label: {
                    Label("Presentasjonsoppsett…", systemImage: "text.badge.checkmark")
                }
                Button {
                    pdfExportProgress = "…"
                    Task {
                        exportPDFURL = await BoardPDFExporter.exportPresentation(
                            projectTitle: board.manuscript.title, scenes: board.scenes,
                            progress: { done, total in pdfExportProgress = "\(done)/\(total)" })
                        pdfExportProgress = nil
                    }
                } label: {
                    Label("Presentasjon (PDF)", systemImage: "rectangle.grid.3x2")
                }
                Button {
                    exportPDFURL = BoardPDFExporter.exportCSV(
                        projectTitle: board.manuscript.title, scenes: board.scenes)
                } label: {
                    Label("Shot-liste (CSV)", systemImage: "tablecells")
                }
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 16)).foregroundStyle(BoardBrand.dim)
            }
            .disabled(board.scenes.isEmpty || pdfExportProgress != nil)
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

    /// Fingerprinten gjør at SwiftUI avbryter gammel preview-lasting når
    /// scene-/frame-data byttes av live-synk.
    private var scenePreviewTaskKey: String {
        board.scenes.map { scene in
            guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
                return scene.id
            }
            let thumbnailKey = frame.thumbnailDataURL.map {
                "\($0.count):\($0.prefix(24))"
            } ?? ""
            return [scene.id, frame.id, frame.updatedAt ?? "",
                    frame.imageUrl ?? "", thumbnailKey].joined(separator: "|")
        }.joined(separator: ";")
    }

    /// Scene-listen viser et faktisk kompositt (original + strøk) når det
    /// finnes. Gamle/blanke thumbnailUrl-data brukes bare som siste fallback.
    private func rebuildSceneThumbnails() async {
        let scenes = board.scenes
        let representatives = scenes.compactMap {
            StoryboardPreviewPolicy.representativeFrame(in: $0.frames)
        }
        await FrameImageCache.prefetchPreviewSources(frames: representatives)
        guard !Task.isCancelled else { return }

        var rendered: [String: UIImage] = [:]
        for scene in scenes {
            guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
                continue
            }
            if let image = FrameRenderService.image(for: frame, maxWidth: 248)
                ?? StoryboardPreviewPolicy.sourceURLs(for: frame).lazy.compactMap({
                    FrameImageCache.image(for: $0)
                }).first {
                rendered[scene.id] = image
            }
        }
        guard !Task.isCancelled else { return }
        let activeSceneIds = Set(scenes.map(\.id))
        var next = sceneThumbnailImages.filter { activeSceneIds.contains($0.key) }
        for (sceneId, image) in rendered { next[sceneId] = image }
        sceneThumbnailImages = next
    }

    private func scenePreviewFallbackImage(for scene: SceneSummary) -> UIImage? {
        guard let frame = StoryboardPreviewPolicy.representativeFrame(in: scene.frames) else {
            return nil
        }
        return StoryboardPreviewPolicy.sourceURLs(for: frame).lazy.compactMap {
            FrameImageCache.image(for: $0)
        }.first
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
                                    if let image = sceneThumbnailImages[scene.id]
                                        ?? scenePreviewFallbackImage(for: scene) {
                                        Image(uiImage: image).resizable().scaledToFill()
                                    } else {
                                        ZStack {
                                            Color.white.opacity(0.06)
                                            ProgressView().controlSize(.mini).tint(BoardBrand.dim)
                                        }
                                    }
                                }
                                .frame(width: 62, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .accessibilityElement(children: .ignore)
                                .accessibilityIdentifier("scene-thumbnail-\(scene.id)")
                                .accessibilityLabel("Scene-thumbnail \(index + 1)")
                                .accessibilityValue(sceneThumbnailImages[scene.id] == nil ? "loading" : "loaded")
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
                        .contextMenu {
                            Button {
                                renameSceneId = scene.id
                                renameSceneDraft = scene.heading
                            } label: { Label("Omdøp", systemImage: "pencil") }
                            Button {
                                board.duplicateScene(sceneId: scene.id)
                            } label: { Label("Dupliser", systemImage: "plus.square.on.square") }
                            Button {
                                board.selectedSceneIndex = index
                                showSheetImportDialog = true
                            } label: { Label("Importer ark…", systemImage: "square.grid.3x3.square") }
                            Button {
                                board.renumberShots()
                            } label: { Label("Renummerer shots", systemImage: "textformat.123") }
                            Button(role: .destructive) {
                                pendingDeleteSceneId = scene.id
                            } label: { Label("Slett scene", systemImage: "trash") }
                        }
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
            Rectangle().fill(BoardBrand.border).frame(width: 1, height: 20).padding(.horizontal, 4)
            // Onion-skin: nabo-shots bak aktiv frame
            Menu {
                Picker("Onion-skin", selection: $onionMode) {
                    Text("Av").tag(0)
                    Text("Forrige shot").tag(1)
                    Text("Forrige + neste").tag(2)
                    Text("To tilbake").tag(3)
                }
            } label: {
                Image(systemName: "square.2.layers.3d.bottom.filled")
                    .font(.system(size: 14))
                    .foregroundStyle(onionMode > 0 ? .white : BoardBrand.dim)
                    .frame(width: 34, height: 30)
                    .background(onionMode > 0 ? BoardBrand.accent : Color.white.opacity(0.05),
                                in: RoundedRectangle(cornerRadius: 7))
            }
            .accessibilityLabel("Onion-skin")
            // Perspektiv-hjelpelinjer
            Menu {
                Picker("Perspektiv", selection: $perspectiveMode) {
                    Text("Av").tag(0)
                    Text("1-punkts").tag(1)
                    Text("2-punkts").tag(2)
                    Text("3-punkts").tag(3)
                    Text("Isometrisk").tag(4)
                    Text("Fisheye").tag(5)
                }
                if (1...3).contains(perspectiveMode) {
                    Toggle("Snap strøk til VP", isOn: $perspectiveSnap)
                }
            } label: {
                Image(systemName: "road.lanes.curved.right")
                    .font(.system(size: 14))
                    .foregroundStyle(perspectiveMode > 0 ? .white : BoardBrand.dim)
                    .frame(width: 34, height: 30)
                    .background(perspectiveMode > 0 ? BoardBrand.accent : Color.white.opacity(0.05),
                                in: RoundedRectangle(cornerRadius: 7))
            }
            .accessibilityLabel("Perspektiv")
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
            if tool == .eraser { canvasState.selectBrush(.eraser) }
            if tool == .draw,
               [.eraser, .kneaded, .lightlift].contains(canvasState.brushType) {
                canvasState.selectBrush(.pencil)
            }
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
            Button("Tekst") { commitTextAnnotation(style: nil) }
            Button("Post-it") { commitTextAnnotation(style: "note") }
            Button("Snakkeboble") { commitTextAnnotation(style: "bubble") }
            Button("Avbryt", role: .cancel) { textPromptValue = "" }
        }
        .sheet(isPresented: $showShotList) {
            ShotListSheet(sceneHeading: board.scene?.heading ?? "",
                          frames: board.scene?.frames ?? [])
        }
        .sheet(isPresented: $showScript) {
            ScriptSheet(scenes: board.scenes, activeIndex: board.selectedSceneIndex)
        }
        .fullScreenCover(isPresented: $showReview) {
            // Den ekte Review-flaten (samme som hubben) — den gamle enkle
            // ReviewSheet er pensjonert.
            NavigationStack {
                ReviewView(project: ProjectSummary(id: board.projectId ?? "",
                                                   name: board.manuscript.title),
                           manuscript: board.manuscript)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Board") {
                                showReview = false
                                Task { await board.reload() }
                            }
                        }
                    }
            }
        }
        .sheet(isPresented: $showBrushEditor) {
            BrushEditorSheet(canvasState: canvasState)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showToneReport) {
            ToneReportSheet(report: toneReport, hero: heroReport)
                .presentationDetents([.medium])
        }
        .sheet(item: $exportPDFURL) { url in
            ShareSheet(items: [url])
        }
        .sheet(isPresented: $showReauth) {
            NavigationStack { LoginView(sync: reauthSync) }
        }
        .sheet(isPresented: Binding(get: { imageImportFrameId != nil },
                                    set: { if !$0 { imageImportFrameId = nil } })) {
            NavigationStack {
                VStack(spacing: 20) {
                    Text("Bildet blir panelets innhold — det vises i boardet, kan tegnes over, og følger med i PDF/PNG/animatic.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal)
                    PhotosPicker(selection: $frameImagePickerItem, matching: .images) {
                        Label("Velg bilde", systemImage: "photo.badge.plus")
                            .font(.headline)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(BoardBrand.accent, in: Capsule())
                            .foregroundStyle(.white)
                    }
                    if board.scene?.frames.first(where: { $0.id == imageImportFrameId })?.imageUrl != nil {
                        Button("Fjern eksisterende bilde", role: .destructive) {
                            if let frameId = imageImportFrameId {
                                board.patchFrame(frameId: frameId,
                                                 fields: ["imageUrl": NSNull(), "imageSource": NSNull()])
                            }
                            imageImportFrameId = nil
                        }
                    }
                }
                .navigationTitle("Bilde-frame")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { imageImportFrameId = nil }
                } }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: frameImagePickerItem) {
            guard let item = frameImagePickerItem, let frameId = imageImportFrameId else { return }
            frameImagePickerItem = nil
            imageImportFrameId = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let dataURL = Self.jpegDataURL(image, maxSide: 1600, quality: 0.75) else { return }
                // B2 først (holder scene-payloaden slank); dataURL kun som
                // fallback når lagring ikke er konfigurert/offline.
                let scene = board.scene
                let shot = scene?.frames.first(where: { $0.id == frameId })?.shotNumber ?? frameId
                let imageUrl = await Self.uploadOrInline(
                    dataURL: dataURL,
                    name: "\(board.manuscript.title) - \(scene?.heading ?? "scene") - \(shot).jpg",
                    board: board,
                    sceneId: scene?.id,
                    entityType: "storyboard_frame",
                    entityId: frameId,
                    note: "Panel-bilde importert fra Storyboard Studio")
                board.patchFrame(frameId: frameId,
                                 fields: ["imageUrl": imageUrl, "imageSource": "imported"])
                if board.frame?.id == frameId { loadActiveFrameIntoCanvas() }
            }
        }
        .sheet(isPresented: $showSheetImportDialog) {
            NavigationStack {
                VStack(spacing: 18) {
                    Text("Importer et helt storyboard-ark: bildet splittes i et rutenett og hver rute blir et panel i scenen.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal)
                    Picker("Rutenett", selection: Binding(
                        get: { "\(sheetImportGrid.columns)x\(sheetImportGrid.rows)" },
                        set: { value in
                            let parts = value.split(separator: "x").compactMap { Int($0) }
                            if parts.count == 2 { sheetImportGrid = (parts[0], parts[1]) }
                        })) {
                        Text("2 × 2").tag("2x2")
                        Text("3 × 2").tag("3x2")
                        Text("4 × 3").tag("4x3")
                        Text("3 × 4").tag("3x4")
                    }
                    .pickerStyle(.segmented).padding(.horizontal)
                    PhotosPicker(selection: $sheetImportPickerItem, matching: .images) {
                        Label("Velg ark", systemImage: "square.grid.3x3.square")
                            .font(.headline)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(BoardBrand.accent, in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
                .navigationTitle("Importer ark")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { showSheetImportDialog = false }
                } }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: sheetImportPickerItem) {
            guard let item = sheetImportPickerItem else { return }
            sheetImportPickerItem = nil
            showSheetImportDialog = false
            let grid = sheetImportGrid
            guard let scene = board.scene else { return }
            let manuscriptId = board.manuscript.id
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data), let cg = image.cgImage else { return }
                var panels: [String] = []
                let cellWidth = cg.width / grid.columns
                let cellHeight = cg.height / grid.rows
                for row in 0..<grid.rows {
                    for col in 0..<grid.columns {
                        guard let cell = cg.cropping(to: CGRect(
                            x: col * cellWidth, y: row * cellHeight,
                            width: cellWidth, height: cellHeight)) else { continue }
                        if let dataURL = Self.jpegDataURL(UIImage(cgImage: cell),
                                                          maxSide: 1200, quality: 0.72) {
                            panels.append(dataURL)
                        }
                    }
                }
                guard !panels.isEmpty else { return }
                board.syncStatus = "Importerer \(panels.count) paneler…"
                var panelURLs: [String] = []
                for (index, dataURL) in panels.enumerated() {
                    board.syncStatus = "Laster opp panel \(index + 1)/\(panels.count)…"
                    panelURLs.append(await Self.uploadOrInline(
                        dataURL: dataURL,
                        name: "\(board.manuscript.title) - \(scene.heading) - ark \(index + 1).jpg",
                        board: board,
                        sceneId: scene.id,
                        entityType: "storyboard_scene",
                        entityId: scene.id,
                        note: "Ark-import (\(grid.columns)×\(grid.rows)) fra Storyboard Studio"))
                }
                do {
                    try await RoleRoomAPIClient.shared.importImageFrames(
                        manuscriptId: manuscriptId, sceneId: scene.id, imageURLs: panelURLs)
                    await board.reload()
                    board.syncStatus = "\(panels.count) paneler importert ✓"
                } catch {
                    board.syncStatus = error.localizedDescription
                }
            }
        }
        .sheet(isPresented: $showPresentationSetup) {
            NavigationStack {
                Form {
                    Section("Konsept-linje (under tittelen)") {
                        TextField("f.eks. En som tar helse på alvor …",
                                  text: $presentationConceptDraft, axis: .vertical)
                            .lineLimit(2...3)
                    }
                    ForEach($presentationFooterDraft) { $section in
                        Section {
                            TextField("Tittel", text: $section.title)
                                .font(.headline)
                            TextField("Ett punkt per linje", text: $section.itemsText, axis: .vertical)
                                .lineLimit(3...6)
                        }
                    }
                }
                .navigationTitle("Presentasjonsoppsett")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Avbryt") { showPresentationSetup = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lagre") {
                            showPresentationSetup = false
                            let concept = presentationConceptDraft
                            let footer = PresentationFooter.encode(presentationFooterDraft)
                            let manuscriptId = board.manuscript.id
                            Task {
                                try? await RoleRoomAPIClient.shared.setPresentationMeta(
                                    manuscriptId: manuscriptId, concept: concept,
                                    footerJSON: footer)
                                await board.reload()
                                board.syncStatus = "Presentasjonsoppsett lagret ✓"
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showHistorySheet) {
            NavigationStack {
                List {
                    if historyEntries.isEmpty {
                        Text("Ingen tidligere versjoner — historikk lagres fra og med neste tegneendring.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(historyEntries.enumerated()), id: \.offset) { _, entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.updatedAt.isEmpty ? "Ukjent tidspunkt" : entry.updatedAt)
                                    .font(.subheadline)
                                let count = (try? StrokeSerialization.decodeFromWebJSON(entry.strokes))?.count ?? 0
                                Text("\(count) strøk").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Gjenopprett") {
                                restoreHistory(entry: entry)
                            }
                            .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                        }
                    }
                }
                .navigationTitle("Tegne-historikk")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { showHistorySheet = false }
                    }
                }
            }
        }
        .onChange(of: reauthSync.isLoggedIn) {
            if reauthSync.isLoggedIn {
                showReauth = false
                board.syncStatus = "Innlogget ✓"
                flushAllPending()
            }
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
        .alert("Omdøp scene", isPresented: Binding(
            get: { renameSceneId != nil },
            set: { if !$0 { renameSceneId = nil } })) {
            TextField("Scenetittel", text: $renameSceneDraft)
            Button("Lagre") {
                let title = renameSceneDraft.trimmingCharacters(in: .whitespaces)
                if let sceneId = renameSceneId, !title.isEmpty {
                    board.renameScene(sceneId: sceneId, title: title)
                }
                renameSceneId = nil
            }
            Button("Avbryt", role: .cancel) { renameSceneId = nil }
        }
        .confirmationDialog("Slette scenen og alle shots permanent?",
                            isPresented: Binding(get: { pendingDeleteSceneId != nil },
                                                 set: { if !$0 { pendingDeleteSceneId = nil } })) {
            Button("Slett scene", role: .destructive) {
                if let sceneId = pendingDeleteSceneId { board.deleteScene(sceneId: sceneId) }
                pendingDeleteSceneId = nil
            }
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
                        .onDrop(of: [.text], delegate: ShotDropDelegate(
                            targetIndex: index,
                            draggedFrameId: $draggedFrameId,
                            board: board))
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
                        Button {
                            exportPDFURL = FrameRenderService.exportPNG(
                                frame: frame, projectTitle: board.manuscript.title)
                        } label: {
                            Label("Eksporter PNG", systemImage: "photo")
                        }
                        Button {
                            imageImportFrameId = frame.id
                        } label: {
                            Label("Importer bilde…", systemImage: "photo.badge.plus")
                        }
                        Button {
                            guard let scene = board.scene else { return }
                            historyFrameRef = (scene.id, frame.id)
                            Task {
                                historyEntries = await RoleRoomAPIClient.shared.frameHistory(
                                    manuscriptId: board.manuscript.id,
                                    sceneId: scene.id, frameId: frame.id)
                                showHistorySheet = true
                            }
                        } label: {
                            Label("Historikk…", systemImage: "clock.arrow.circlepath")
                        }
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
                    // Drag-reorder: grip-håndtak (drag på selve raden ville
                    // kollidert med tegning på aktiv canvas).
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color(white: 0.6))
                        .frame(width: 20, height: 20)
                        .contentShape(Rectangle())
                        .onDrag {
                            draggedFrameId = frame.id
                            return NSItemProvider(object: frame.id as NSString)
                        }
                        .accessibilityLabel("Flytt shot \(frame.shotNumber)")
                    if pendingFrameIds.contains(frame.id) {
                        Circle().fill(Color.orange).frame(width: 7, height: 7)
                            .accessibilityLabel("Usynkede endringer")
                    }
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
                } else if let image = decodeDataURL(frame.thumbnailDataURL)
                    ?? FrameImageCache.image(for: frame.imageUrl) {
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

    private func commitTextAnnotation(style: String?) {
        let text = textPromptValue.trimmingCharacters(in: .whitespacesAndNewlines)
        textPromptValue = ""
        guard !text.isEmpty else { return }
        var stroke = annotationStroke(
            points: [annotationPoint(textPromptPoint.x, textPromptPoint.y)], text: text)
        stroke.annotationStyle = style
        appendAnnotation(stroke)
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
                        let style = stroke.annotationStyle
                        Text(style == nil ? (stroke.textAnnotation ?? "").uppercased()
                                          : (stroke.textAnnotation ?? ""))
                            .font(.custom(BoardBrand.handwriting,
                                          size: max(12, (style == nil ? 40 : 30) * scale)))
                            .foregroundStyle(style == "note"
                                ? Color(red: 0.25, green: 0.22, blue: 0.15)
                                : (Color(hex: stroke.color) ?? BoardBrand.accent))
                            .padding(style == nil ? 0 : 10)
                            .background {
                                if style == "note" {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Color(red: 0.96, green: 0.91, blue: 0.75))
                                        .shadow(color: .black.opacity(0.2), radius: 3, y: 2)
                                } else if style == "bubble" {
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(.white)
                                        .overlay(RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color(hex: stroke.color) ?? BoardBrand.accent,
                                                    lineWidth: 2))
                                        .shadow(color: .black.opacity(0.15), radius: 3, y: 2)
                                }
                            }
                            .position(x: CGFloat(point.x) * scale, y: CGFloat(point.y) * scale)
                            .allowsHitTesting(false)
                    }
                }
                if perspectiveMode > 0 {
                    PerspectiveOverlay(
                        mode: perspectiveMode,
                        points: $vanishingPoints,
                        editable: boardTool == .select,
                        onCommit: { persistPerspective(); updateSnapState() })
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
                    .scaleEffect(selectionScaleFactor)
                    .rotationEffect(.radians(selectionRotationAngle))
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
                // Skaleringshåndtak (nedre høyre): drag fra/mot senter.
                selectionHandle(systemImage: "arrow.up.left.and.arrow.down.right")
                    .position(x: rect.maxX + 8, y: rect.maxY + 8)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                let center = CGPoint(x: rect.midX, y: rect.midY)
                                let start = hypot(value.startLocation.x - center.x,
                                                  value.startLocation.y - center.y)
                                let current = hypot(value.location.x - center.x,
                                                    value.location.y - center.y)
                                selectionScaleFactor = max(0.1, min(8, current / max(1, start)))
                            }
                            .onEnded { _ in
                                transformSelection(scaleBy: Double(selectionScaleFactor),
                                                   rotateBy: 0, viewRect: rect, scale: scale)
                                selectionScaleFactor = 1
                            }
                    )
                // Rotasjonshåndtak (topp midt).
                selectionHandle(systemImage: "arrow.trianglehead.2.clockwise.rotate.90")
                    .position(x: rect.midX, y: rect.minY - 28)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                let center = CGPoint(x: rect.midX, y: rect.midY)
                                let startAngle = atan2(value.startLocation.y - center.y,
                                                       value.startLocation.x - center.x)
                                let currentAngle = atan2(value.location.y - center.y,
                                                         value.location.x - center.x)
                                selectionRotationAngle = Double(currentAngle - startAngle)
                            }
                            .onEnded { _ in
                                transformSelection(scaleBy: 1, rotateBy: selectionRotationAngle,
                                                   viewRect: rect, scale: scale)
                                selectionRotationAngle = 0
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
                    // Retusj (SBP Pencil Line Retouch-paritet): juster
                    // eksisterende strøk uten å tegne på nytt.
                    retouchButton("minus.circle", "Tynnere") { retouchSelection(widthFactor: 0.8) }
                    retouchButton("plus.circle", "Tykkere") { retouchSelection(widthFactor: 1.25) }
                    retouchButton("sun.min", "Blekere") { retouchSelection(opacityFactor: 0.8) }
                    retouchButton("sun.max", "Mørkere") { retouchSelection(opacityFactor: 1.25) }
                    retouchButton("paintpalette", "Pensel-farge") {
                        retouchSelection(color: canvasState.brushColor)
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

    private func retouchButton(_ systemImage: String, _ label: String,
                               action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                .padding(6)
                .background(Color.black.opacity(0.6), in: Circle())
        }
        .accessibilityLabel(label)
    }

    /// Muter valgte strøk (bredde/opasitet/farge) — én undo per trykk.
    private func retouchSelection(widthFactor: Double = 1,
                                  opacityFactor: Double = 1,
                                  color: String? = nil) {
        guard !selectedStrokeIds.isEmpty else { return }
        canvasState.undoStack.append(canvasState.strokes)
        canvasState.redoStack = []
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var adjusted = stroke
            adjusted.width = max(0.5, adjusted.width * widthFactor)
            adjusted.opacity = min(1, max(0.05, adjusted.opacity * opacityFactor))
            if var brush = adjusted.brush {
                brush.size = max(0.5, brush.size * widthFactor)
                brush.opacity = min(1, max(0.05, brush.opacity * opacityFactor))
                if let color { brush.color = color }
                adjusted.brush = brush
            }
            if let color { adjusted.color = color }
            return adjusted
        }
        canvasState.revision += 1
    }

    private func selectionHandle(systemImage: String) -> some View {
        Image(systemName: systemImage)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(BoardBrand.accent, in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 1.5))
    }

    /// Skaler/roter valgte strøk rundt utvalgets senter (innholdsrom).
    private func transformSelection(scaleBy factor: Double, rotateBy angle: Double,
                                    viewRect: CGRect, scale: CGFloat) {
        guard !selectedStrokeIds.isEmpty,
              factor != 1 || angle != 0 else { return }
        let center = (x: Double(viewRect.midX / scale), y: Double(viewRect.midY / scale))
        let cosA = cos(angle), sinA = sin(angle)
        canvasState.undoStack.append(canvasState.strokes)
        canvasState.redoStack = []
        canvasState.strokes = canvasState.strokes.map { stroke in
            guard selectedStrokeIds.contains(stroke.id) else { return stroke }
            var transformed = stroke
            transformed.points = transformed.points.map { point in
                var p = point
                let dx = (p.x - center.x) * factor
                let dy = (p.y - center.y) * factor
                p.x = center.x + dx * cosA - dy * sinA
                p.y = center.y + dx * sinA + dy * cosA
                return p
            }
            transformed.width *= factor
            transformed.brush?.size *= factor
            return transformed
        }
        canvasState.revision += 1
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

                    // Referanse-underlag: foto i lav opacity bak tegningen
                    // (kun i canvas — aldri i thumbnails/PDF/PNG).
                    panelLabel("Underlag")
                    HStack(spacing: 6) {
                        PhotosPicker(selection: $underlayPickerItem, matching: .images) {
                            Label(frame.underlayDataURL == nil ? "Velg foto" : "Bytt foto",
                                  systemImage: "photo.on.rectangle")
                                .font(.system(size: 11))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8).padding(.vertical, 5)
                                .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 7))
                        }
                        if frame.underlayDataURL != nil {
                            Button {
                                board.patchActiveFrame(["underlayDataURL": NSNull(), "underlayOpacity": NSNull()])
                                renderer?.setUnderlay(cgImage: nil, opacity: 0)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 11)).foregroundStyle(.white)
                                    .frame(width: 24, height: 24)
                                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Fjern underlag")
                        }
                    }
                    if frame.underlayDataURL != nil {
                        HStack(spacing: 8) {
                            Slider(value: Binding(
                                get: { frame.underlayOpacity ?? 0.4 },
                                set: { value in
                                    board.patchActiveFrame(["underlayOpacity": value])
                                    applyUnderlay(to: renderer)
                                }), in: 0.05...0.9)
                                .tint(BoardBrand.accent)
                            Text("\(Int((frame.underlayOpacity ?? 0.4) * 100))%")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(BoardBrand.dim)
                        }
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
        .onChange(of: tipPickerItem) {
            guard let item = tipPickerItem else { return }
            tipPickerItem = nil
            let isStamp = canvasState.brushType == .stamp
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                // ≤256px PNG (alpha bevares) — bakes i strøket ved tegning.
                let maxSide = 256.0
                let scaleFactor = min(1, maxSide / max(image.size.width, image.size.height))
                let size = CGSize(width: image.size.width * scaleFactor,
                                  height: image.size.height * scaleFactor)
                let format = UIGraphicsImageRendererFormat()
                format.scale = 1
                let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
                    image.draw(in: CGRect(origin: .zero, size: size))
                }
                guard let png = scaled.pngData() else { return }
                let dataURL = "data:image/png;base64," + png.base64EncodedString()
                if isStamp {
                    canvasState.stampTipDataURL = dataURL
                    UserDefaults.standard.set(dataURL, forKey: "sb.stampTip")
                } else {
                    canvasState.customTipDataURL = dataURL
                    UserDefaults.standard.set(dataURL, forKey: "sb.customTip")
                }
            }
        }
        .onChange(of: underlayPickerItem) {
            guard let item = underlayPickerItem else { return }
            underlayPickerItem = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                // Nedskalert JPEG holder scene-payloaden nede (hele scenen
                // POSTes ved hver synk).
                let maxSide = 1280.0
                let scale = min(1, maxSide / max(image.size.width, image.size.height))
                let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                let format = UIGraphicsImageRendererFormat()
                format.scale = 1
                let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
                    image.draw(in: CGRect(origin: .zero, size: size))
                }
                guard let jpeg = scaled.jpegData(compressionQuality: 0.6) else { return }
                let dataURL = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                board.patchActiveFrame(["underlayDataURL": dataURL,
                                        "underlayOpacity": board.frame?.underlayOpacity ?? 0.4])
                renderer?.setUnderlay(cgImage: scaled.cgImage,
                                      opacity: board.frame?.underlayOpacity ?? 0.4)
            }
        }
        .onAppear {
            notesDraft = board.frame?.notes ?? ""
            descriptionDraft = board.frame?.description ?? ""
        }
    }

    @State private var notesDraft = ""
    @State private var descriptionDraft = ""
    @State private var tagDraft = ""
    @State private var underlayPickerItem: PhotosPickerItem?
    @State private var tipPickerItem: PhotosPickerItem?
    @State private var imageImportFrameId: String?
    @State private var frameImagePickerItem: PhotosPickerItem?
    @State private var sheetImportPickerItem: PhotosPickerItem?
    @State private var sheetImportGrid: (columns: Int, rows: Int) = (4, 3)
    @State private var showSheetImportDialog = false
    @State private var showPresentationSetup = false
    @State private var presentationConceptDraft = ""
    @State private var presentationFooterDraft: [PresentationFooter.Section] = PresentationFooter.defaults
    @State private var renameSceneId: String?
    @State private var renameSceneDraft = ""
    @State private var pendingDeleteSceneId: String?
    @State private var draggedFrameId: String?
    @StateObject private var reauthSync = SyncState()
    @State private var showReauth = false
    @State private var presentOthers: [String] = []
    @State private var canUndoSceneDelete = false
    @State private var historyFrameRef: (sceneId: String, frameId: String)?
    @State private var historyEntries: [(updatedAt: String, strokes: String)] = []
    @State private var showHistorySheet = false
    @State private var pdfExportProgress: String?
    @State private var heroReport: HeroReport?
    @State private var syncInFlight = false

    private func exportPDF(includeUnderlay: Bool) {
        pdfExportProgress = "…"
        Task {
            exportPDFURL = await BoardPDFExporter.export(
                projectTitle: board.manuscript.title, scenes: board.scenes,
                includeUnderlay: includeUnderlay,
                progress: { done, total in pdfExportProgress = "\(done)/\(total)" })
            pdfExportProgress = nil
        }
    }
    // Onion-skin: 0=av, 1=forrige, 2=forrige+neste, 3=to tilbake.
    @State private var onionMode = 0
    // Perspektiv-hjelpelinjer: 0=av, 1/2/3-punkts. VP-er normalisert 0–1
    // (y>1 = under canvas for 3-punkts). Kun visning — aldri i data/eksport.
    @State private var perspectiveMode = 0
    @State private var vanishingPoints: [CGPoint] = []
    @State private var perspectiveSnap = false
    // Lasso-transform (transient under gest)
    @State private var selectionScaleFactor: CGFloat = 1
    @State private var selectionRotationAngle: Double = 0

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
        (.fill, "Fyll"), (.halftone, "Raster"), (.stamp, "Stamp"), (.custom, "Egen"),
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
                if board.frame?.imageUrl != nil {
                    Label("Bilde redigeres", systemImage: "photo.badge.checkmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.green)
                        .accessibilityLabel("Panelbildet er redigerbart")
                }
                Spacer()
                Button { canvasState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.undoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.undoStack.isEmpty)
                .accessibilityLabel("Angre")
                Button { canvasState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                        .font(.system(size: 13)).foregroundStyle(canvasState.redoStack.isEmpty ? BoardBrand.label : .white)
                }
                .disabled(canvasState.redoStack.isEmpty)
                .accessibilityLabel("Gjenta")
                Text("\(canvasState.strokes.count) strøk")
                    .font(.system(size: 10).monospacedDigit()).foregroundStyle(BoardBrand.dim)
            }
            HStack(alignment: .top, spacing: 14) {
                // Tip-glyfer i 2×5-grid (mockup) — form, ikke tekst.
                // Scrollbart glyf-grid — penselfamilien vokser.
                ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 4) {
                    let chips = sortedBrushChips()
                    ForEach(0..<((chips.count + 4) / 5), id: \.self) { row in
                        HStack(spacing: 5) {
                            ForEach(Array(chips[(row * 5)..<min(row * 5 + 5, chips.count)]), id: \.0) { type, name in
                                let selected = canvasState.brushType == type
                                let favorite = canvasState.favoriteBrushes.contains(type.rawValue)
                                Button {
                                    canvasState.selectBrush(type)
                                    boardTool = [.eraser, .kneaded, .lightlift].contains(type)
                                        ? .eraser
                                        : .draw
                                } label: {
                                    BrushTipGlyph(type: type)
                                        .frame(width: 44, height: 26)
                                        .background(selected ? Color.white.opacity(0.12) : Color.white.opacity(0.04),
                                                    in: RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? BoardBrand.accent : BoardBrand.border,
                                                    lineWidth: selected ? 1.5 : 1))
                                        .overlay(alignment: .topTrailing) {
                                            if favorite {
                                                Image(systemName: "star.fill")
                                                    .font(.system(size: 6))
                                                    .foregroundStyle(.yellow)
                                                    .padding(2)
                                            }
                                        }
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(name)
                                .contextMenu {
                                    Text(BrushDefaults.describe(type))
                                    Button {
                                        canvasState.toggleFavoriteBrush(type)
                                    } label: {
                                        Label(favorite ? "Fjern favoritt" : "Favoritt",
                                              systemImage: favorite ? "star.slash" : "star")
                                    }
                                }
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
                        Button { canvasState.colorPickArmed.toggle() } label: {
                            Image(systemName: "eyedropper")
                                .font(.system(size: 12))
                                .foregroundStyle(canvasState.colorPickArmed ? .white : BoardBrand.dim)
                                .frame(width: 24, height: 24)
                                .background(canvasState.colorPickArmed ? BoardBrand.accent : Color.white.opacity(0.05),
                                            in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Fargeplukker")
                        if canvasState.brushType == .stamp || canvasState.brushType == .custom {
                            PhotosPicker(selection: $tipPickerItem, matching: .images) {
                                Image(systemName: "square.and.arrow.down")
                                    .font(.system(size: 12))
                                    .foregroundStyle(BoardBrand.dim)
                                    .frame(width: 24, height: 24)
                                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 7))
                            }
                            .accessibilityLabel("Importer penselspiss")
                            // Innebygd symbolsett (SF Symbols → spiss)
                            ForEach(Self.stampSymbols, id: \.self) { symbol in
                                Button {
                                    if let dataURL = Self.symbolTipDataURL(symbol) {
                                        if canvasState.brushType == .stamp {
                                            canvasState.stampTipDataURL = dataURL
                                            UserDefaults.standard.set(dataURL, forKey: "sb.stampTip")
                                        } else {
                                            canvasState.customTipDataURL = dataURL
                                            UserDefaults.standard.set(dataURL, forKey: "sb.customTip")
                                        }
                                    }
                                } label: {
                                    Image(systemName: symbol)
                                        .font(.system(size: 11))
                                        .foregroundStyle(BoardBrand.dim)
                                        .frame(width: 22, height: 22)
                                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Symbol \(symbol)")
                            }
                        }
                        if canvasState.brushType == .eraser {
                            // Objektmodus: berørte strøk slettes hele
                            Button { canvasState.eraserObjectMode.toggle() } label: {
                                Image(systemName: "scissors")
                                    .font(.system(size: 12))
                                    .foregroundStyle(canvasState.eraserObjectMode ? .white : BoardBrand.dim)
                                    .frame(width: 24, height: 24)
                                    .background(canvasState.eraserObjectMode ? BoardBrand.accent : Color.white.opacity(0.05),
                                                in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Strøk-viskelær")
                        }
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
                // Strøk-forhåndsvisning: ekte dabs gjennom motoren
                StrokePreview(brush: canvasState.currentBrush())
                    .frame(width: 118, height: 122)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity)
    }

    /// Favoritter først (stabil rekkefølge ellers).
    private func sortedBrushChips() -> [(BrushType, String)] {
        let favorites = canvasState.favoriteBrushes
        guard !favorites.isEmpty else { return Self.brushChips }
        return Self.brushChips.filter { favorites.contains($0.0.rawValue) }
            + Self.brushChips.filter { !favorites.contains($0.0.rawValue) }
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

// Voiceover per shot: m4a i Documents/voiceover/<frameId>.m4a — lokalt
// på enheten (server-synk er bevisst utelatt; animatic-lyd er arbeidslyd).
enum VoiceoverStore {
    static var directory: URL {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("voiceover", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(frameId: String) -> URL {
        directory.appendingPathComponent("\(frameId).m4a")
    }

    static func exists(frameId: String) -> Bool {
        FileManager.default.fileExists(atPath: url(frameId: frameId).path)
    }

    static func delete(frameId: String) {
        try? FileManager.default.removeItem(at: url(frameId: frameId))
    }
}

// Animatic → MP4: ett stillbilde per shot i shot-varighet (H.264 1280×720).
// Frames re-rendres i hi-res gjennom motoren; thumb/plakat som fallback.
@MainActor
enum AnimaticVideoExporter {
    static func export(sceneHeading: String, frames: [FrameSummary]) async -> URL? {
        guard !frames.isEmpty else { return nil }
        await FrameImageCache.prefetch(frames: frames)
        let videoSize = CGSize(width: 1280, height: 720)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(sceneHeading.replacingOccurrences(of: "/", with: "-")) animatic.mp4")
        try? FileManager.default.removeItem(at: url)
        guard let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4) else { return nil }
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(videoSize.width),
            AVVideoHeightKey: Int(videoSize.height),
        ])
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: Int(videoSize.width),
                kCVPixelBufferHeightKey as String: Int(videoSize.height),
            ])
        writer.add(input)
        guard writer.startWriting() else { return nil }
        writer.startSession(atSourceTime: .zero)
        var time = CMTime.zero
        let rendered: [UIImage?] = frames.map { frame in
            FrameRenderService.image(for: frame, maxWidth: 1280)
                ?? decodeDataURL(frame.thumbnailDataURL)
        }
        func append(_ buffer: CVPixelBuffer, at presentationTime: CMTime) async {
            while !input.isReadyForMoreMediaData {
                try? await Task.sleep(nanoseconds: 20_000_000)
            }
            adaptor.append(buffer, withPresentationTime: presentationTime)
        }
        for (index, frame) in frames.enumerated() {
            guard let buffer = pixelBuffer(image: rendered[index], shotNumber: frame.shotNumber,
                                           size: videoSize) else { continue }
            await append(buffer, at: time)
            var holdSeconds = max(0.5, frame.durationSec)
            // Dissolve/Fade mot NESTE shot: siste 0,5 s erstattes av 8
            // interpolerte mellombilder (kryssfading av stillbilder).
            let transition = (frame.transition ?? "").lowercased()
            if index + 1 < frames.count,
               transition.contains("dissolve") || transition.contains("fade"),
               holdSeconds > 0.7 {
                holdSeconds -= 0.5
                var fadeTime = CMTimeAdd(time, CMTime(seconds: holdSeconds,
                                                      preferredTimescale: 600))
                let fadeSteps = 8
                for step in 1...fadeSteps {
                    let alpha = CGFloat(step) / CGFloat(fadeSteps + 1)
                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1
                    let blended = UIGraphicsImageRenderer(size: videoSize, format: format)
                        .image { context in
                            UIColor.white.setFill()
                            context.fill(CGRect(origin: .zero, size: videoSize))
                            rendered[index]?.draw(in: aspectFit(rendered[index], in: videoSize),
                                                  blendMode: .normal, alpha: 1 - alpha)
                            rendered[index + 1]?.draw(in: aspectFit(rendered[index + 1], in: videoSize),
                                                      blendMode: .normal, alpha: alpha)
                        }
                    if let fadeBuffer = pixelBuffer(image: blended, shotNumber: frame.shotNumber,
                                                    size: videoSize) {
                        await append(fadeBuffer, at: fadeTime)
                    }
                    fadeTime = CMTimeAdd(fadeTime, CMTime(seconds: 0.5 / Double(fadeSteps),
                                                          preferredTimescale: 600))
                }
                holdSeconds += 0.5
            }
            time = CMTimeAdd(time, CMTime(seconds: holdSeconds, preferredTimescale: 600))
        }
        input.markAsFinished()
        writer.endSession(atSourceTime: time)
        await withCheckedContinuation { continuation in
            writer.finishWriting { continuation.resume() }
        }
        guard writer.status == .completed else { return nil }
        return await mixVoiceover(videoURL: url, frames: frames)
    }

    /// Legg voiceover-klippene inn på shot-tidene (composition + re-eksport).
    /// Uten voiceover returneres videofilen urørt.
    private static func mixVoiceover(videoURL: URL, frames: [FrameSummary]) async -> URL {
        guard frames.contains(where: { VoiceoverStore.exists(frameId: $0.id) }) else {
            return videoURL
        }
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: videoURL)
        guard let videoTrack = try? await videoAsset.loadTracks(withMediaType: .video).first,
              let videoDuration = try? await videoAsset.load(.duration),
              let compositionVideo = composition.addMutableTrack(
                withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              (try? compositionVideo.insertTimeRange(
                CMTimeRange(start: .zero, duration: videoDuration),
                of: videoTrack, at: .zero)) != nil,
              let compositionAudio = composition.addMutableTrack(
                withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            return videoURL
        }
        var time = CMTime.zero
        for frame in frames {
            let shotDuration = CMTime(seconds: max(0.5, frame.durationSec), preferredTimescale: 600)
            defer { time = CMTimeAdd(time, shotDuration) }
            guard VoiceoverStore.exists(frameId: frame.id) else { continue }
            let audioAsset = AVURLAsset(url: VoiceoverStore.url(frameId: frame.id))
            guard let audioTrack = try? await audioAsset.loadTracks(withMediaType: .audio).first,
                  let audioDuration = try? await audioAsset.load(.duration) else { continue }
            let clip = CMTimeMinimum(audioDuration, shotDuration)
            try? compositionAudio.insertTimeRange(
                CMTimeRange(start: .zero, duration: clip), of: audioTrack, at: time)
        }
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("animatic-voiceover.mp4")
        try? FileManager.default.removeItem(at: outputURL)
        guard let export = AVAssetExportSession(asset: composition,
                                                presetName: AVAssetExportPresetHighestQuality) else {
            return videoURL
        }
        export.outputURL = outputURL
        export.outputFileType = .mp4
        await withCheckedContinuation { continuation in
            export.exportAsynchronously { continuation.resume() }
        }
        return export.status == .completed ? outputURL : videoURL
    }

    private static func aspectFit(_ image: UIImage?, in size: CGSize) -> CGRect {
        guard let image, image.size.width > 0, image.size.height > 0 else {
            return CGRect(origin: .zero, size: size)
        }
        let scale = min(size.width / image.size.width, size.height / image.size.height)
        let drawSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        return CGRect(x: (size.width - drawSize.width) / 2,
                      y: (size.height - drawSize.height) / 2,
                      width: drawSize.width, height: drawSize.height)
    }

    /// Aspekt-fit på hvit flate; shots uten tegning får plakat med shot-nr.
    private static func pixelBuffer(image: UIImage?, shotNumber: String,
                                    size: CGSize) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        CVPixelBufferCreate(kCFAllocatorDefault, Int(size.width), Int(size.height),
                            kCVPixelFormatType_32BGRA, nil, &buffer)
        guard let buffer else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: Int(size.width), height: Int(size.height), bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
                | CGImageAlphaInfo.premultipliedFirst.rawValue) else { return nil }
        UIGraphicsPushContext(context)
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        if let image {
            let scale = min(size.width / image.size.width, size.height / image.size.height)
            let drawSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            image.draw(in: CGRect(x: (size.width - drawSize.width) / 2,
                                  y: (size.height - drawSize.height) / 2,
                                  width: drawSize.width, height: drawSize.height))
        } else {
            let text = "SHOT \(shotNumber)" as NSString
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 44),
                .foregroundColor: UIColor(white: 0.55, alpha: 1),
            ]
            let textSize = text.size(withAttributes: attributes)
            text.draw(at: CGPoint(x: (size.width - textSize.width) / 2,
                                  y: (size.height - textSize.height) / 2),
                      withAttributes: attributes)
        }
        UIGraphicsPopContext()
        return buffer
    }
}

struct AnimaticView: View {
    let sceneHeading: String
    let frames: [FrameSummary]
    // Synk: kalles ved opptak-stopp (dataURL) og sletting (nil) —
    // boardet PATCHer framen så lyden følger prosjektet på tvers av enheter.
    var onVoiceoverChanged: ((String, String?) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var playing = true
    @State private var exporting = false
    @State private var exportURL: URL?
    @State private var audioRecorder: AVAudioRecorder?
    @State private var recordingFrameId: String?
    @State private var voiceoverPlayer: AVAudioPlayer?
    @State private var voiceoverRevision = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Text(sceneHeading.uppercased())
                        .font(.system(size: 12, weight: .bold)).kerning(1.2)
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Button {
                        exporting = true
                        Task {
                            exportURL = await AnimaticVideoExporter.export(
                                sceneHeading: sceneHeading, frames: frames)
                            exporting = false
                        }
                    } label: {
                        if exporting {
                            ProgressView().tint(.white)
                        } else {
                            Label("Eksporter video", systemImage: "film")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    .disabled(exporting || frames.isEmpty)
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.horizontal, 24)
                ZStack {
                    if let frame = frames.indices.contains(index) ? frames[index] : nil {
                        if let image = decodeDataURL(frame.thumbnailDataURL) {
                            Image(uiImage: image).resizable().scaledToFit()
                                .id(frame.id)
                                .transition(.opacity)
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
                        // Voiceover: opptak per shot (lokalt, mikses i MP4)
                        Button {
                            toggleRecording(frameId: frame.id)
                        } label: {
                            Image(systemName: recordingFrameId == frame.id
                                  ? "stop.circle.fill" : "mic.circle")
                                .font(.system(size: 18))
                                .foregroundStyle(recordingFrameId == frame.id ? .red
                                                 : VoiceoverStore.exists(frameId: frame.id)
                                                 ? BoardBrand.accent : .white.opacity(0.6))
                        }
                        .accessibilityLabel("Voiceover")
                        .id(voiceoverRevision)
                        if VoiceoverStore.exists(frameId: frame.id), recordingFrameId == nil {
                            Button {
                                VoiceoverStore.delete(frameId: frame.id)
                                voiceoverRevision += 1
                                onVoiceoverChanged?(frame.id, nil)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                            }
                            .accessibilityLabel("Slett voiceover")
                        }
                    }
                }
                .padding(.horizontal, 24).padding(.bottom, 20)
            }
        }
        .sheet(item: $exportURL) { url in
            ShareSheet(items: [url])
        }
        .onAppear {
            // Server-voiceover → lokale filer (andre enheters opptak).
            for frame in frames where !VoiceoverStore.exists(frameId: frame.id) {
                guard let dataURL = frame.voiceoverDataURL,
                      let comma = dataURL.firstIndex(of: ","),
                      let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) else { continue }
                try? data.write(to: VoiceoverStore.url(frameId: frame.id))
            }
            voiceoverRevision += 1
        }
        .task(id: "\(index)-\(playing)") {
            guard playing, frames.indices.contains(index) else { return }
            // Spill shot-voiceover under avspilling.
            let frameId = frames[index].id
            if VoiceoverStore.exists(frameId: frameId), recordingFrameId == nil {
                voiceoverPlayer = try? AVAudioPlayer(
                    contentsOf: VoiceoverStore.url(frameId: frameId))
                voiceoverPlayer?.play()
            }
            let seconds = max(0.5, frames[index].durationSec)
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            if playing {
                let transition = (frames[index].transition ?? "").lowercased()
                let next = (index + 1) % max(1, frames.count)
                if transition.contains("dissolve") || transition.contains("fade") {
                    withAnimation(.easeInOut(duration: 0.45)) { index = next }
                } else {
                    index = next
                }
            }
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
// Ekte forhåndsvisning: S-kurve med trykksvell rendret gjennom motoren
// (samme dab-pipeline som canvasen) — viser penselens faktiske karakter.
// Delt offscreen-renderer; siste render caches på pensel-spec.
private struct StrokePreview: View {
    let brush: BrushSpec

    var body: some View {
        Group {
            if let image = Self.render(brush: brush) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color.white
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border, lineWidth: 1))
    }

    @MainActor private static var cache: (key: String, image: UIImage?)?

    @MainActor private static func render(brush: BrushSpec) -> UIImage? {
        let key = (try? JSONEncoder().encode(brush))
            .map { String(decoding: $0, as: UTF8.self) } ?? UUID().uuidString
        if let cached = cache, cached.key == key { return cached.image }
        guard let renderer = FrameRenderService.renderer else { return nil }
        let width = 236.0, height = 244.0
        var points: [StrokePoint] = []
        let sampleCount = 48
        for i in 0...sampleCount {
            let t = Double(i) / Double(sampleCount)
            points.append(StrokePoint(
                x: width * (0.1 + 0.8 * t),
                y: height * (0.5 + 0.2 * sin(t * .pi * 2)),
                pressure: 0.25 + 0.75 * sin(t * .pi),
                tiltX: 30, tiltY: 20,
                timestamp: t * 400))
        }
        let stroke = PencilStroke(
            id: "brush-preview", points: points, inputType: "pencil",
            color: brush.color, width: brush.size, opacity: brush.opacity,
            brush: brush, boardLayer: nil, textAnnotation: nil)
        renderer.resizeCanvas(width: Int(width), height: Int(height))
        renderer.rebuild(strokes: [stroke], scale: 1)
        let image = renderer.thumbnailDataURL(maxWidth: width).flatMap(decodeDataURL)
        cache = (key, image)
        return image
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
    // Komponert av boardet — panelbildet er redigerbar base, mens et rent
    // referanseunderlag forblir skjerm-only.
    // Perspektiv-overlay følger bevisst IKKE med hit: fullskjerm zoomer i
    // UIScrollView-rommet der et SwiftUI-overlay ikke ville fulgt canvasen.
    let background: BoardCanvasBackground
    @State private var renderer = MetalStrokeRenderer()
    @State private var fingerDraws = false
    @Environment(\.dismiss) private var dismiss

    private var aspect: CGFloat { CGFloat(frame.drawingWidth / max(1, frame.drawingHeight)) }

    private func applyUnderlay() {
        renderer?.setEditableBase(cgImage: background.editableBase)
        renderer?.setUnderlay(cgImage: background.referenceUnderlay,
                              opacity: background.referenceOpacity)
        canvasState.backgroundRevision += 1
    }

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
        .onAppear { applyUnderlay() }
    }
}

extension AnimaticView {
    /// Start/stopp opptak for et shot (AVAudioRecorder → m4a).
    fileprivate func toggleRecording(frameId: String) {
        if recordingFrameId == frameId {
            audioRecorder?.stop()
            audioRecorder = nil
            recordingFrameId = nil
            voiceoverRevision += 1
            if let data = try? Data(contentsOf: VoiceoverStore.url(frameId: frameId)) {
                onVoiceoverChanged?(frameId, "data:audio/m4a;base64," + data.base64EncodedString())
            }
            return
        }
        audioRecorder?.stop()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, options: [.defaultToSpeaker])
        try? session.setActive(true)
        session.requestRecordPermission { granted in
            guard granted else { return }
            Task { @MainActor in
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: 44_100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                ]
                audioRecorder = try? AVAudioRecorder(
                    url: VoiceoverStore.url(frameId: frameId), settings: settings)
                audioRecorder?.record()
                recordingFrameId = frameId
                playing = false
            }
        }
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
// Perspektiv-hjelpelinjer: stråler fra flyttbare forsvinningspunkter +
// horisont. Ren visning (aldri i strokes/eksport); håndtak kun aktive i
// select-modus så tegning ikke forstyrres.
private struct PerspectiveOverlay: View {
    let mode: Int
    @Binding var points: [CGPoint]   // normalisert 0–1 (kan gå utenfor)
    let editable: Bool
    var onCommit: () -> Void = {}

    private static let defaults: [Int: [CGPoint]] = [
        1: [CGPoint(x: 0.5, y: 0.45)],
        2: [CGPoint(x: 0.06, y: 0.45), CGPoint(x: 0.94, y: 0.45)],
        3: [CGPoint(x: 0.06, y: 0.45), CGPoint(x: 0.94, y: 0.45), CGPoint(x: 0.5, y: 1.6)],
        5: [CGPoint(x: 0.5, y: 0.5)],   // fisheye-senter
    ]

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let active = activePoints()
            ZStack {
                Canvas { context, _ in
                    let diagonal = hypot(size.width, size.height) * 2.2
                    if mode == 4 {
                        // Isometrisk: tre linjefamilier (30°/150°/vertikal).
                        for angle in [Double.pi / 6, .pi - .pi / 6, .pi / 2] {
                            let step = 46.0
                            let normal = CGVector(dx: -sin(angle), dy: cos(angle))
                            var offset = -diagonal
                            while offset < diagonal {
                                var path = Path()
                                let mid = CGPoint(x: size.width / 2 + normal.dx * offset,
                                                  y: size.height / 2 + normal.dy * offset)
                                path.move(to: CGPoint(x: mid.x - cos(angle) * diagonal,
                                                      y: mid.y - sin(angle) * diagonal))
                                path.addLine(to: CGPoint(x: mid.x + cos(angle) * diagonal,
                                                         y: mid.y + sin(angle) * diagonal))
                                context.stroke(path, with: .color(BoardBrand.accent.opacity(0.16)),
                                               lineWidth: 0.8)
                                offset += step
                            }
                        }
                        return
                    }
                    if mode == 5 {
                        // Fisheye: konsentriske sirkler + buede «vertikaler»
                        // gjennom senteret (flyttbart).
                        let center = active.first ?? CGPoint(x: 0.5, y: 0.5)
                        let origin = CGPoint(x: center.x * size.width, y: center.y * size.height)
                        let maxRadius = hypot(size.width, size.height) * 0.62
                        for step in 1...6 {
                            let radius = maxRadius * Double(step) / 6
                            context.stroke(
                                Path(ellipseIn: CGRect(x: origin.x - radius, y: origin.y - radius,
                                                       width: radius * 2, height: radius * 2)),
                                with: .color(BoardBrand.accent.opacity(0.18)), lineWidth: 0.8)
                        }
                        for step in stride(from: -3, through: 3, by: 1) where step != 0 {
                            let bend = CGFloat(step) * size.width * 0.16
                            var path = Path()
                            path.move(to: CGPoint(x: origin.x + bend, y: 0))
                            path.addQuadCurve(to: CGPoint(x: origin.x + bend, y: size.height),
                                              control: CGPoint(x: origin.x + bend * 1.9, y: origin.y))
                            context.stroke(path, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                            var horizontal = Path()
                            horizontal.move(to: CGPoint(x: 0, y: origin.y + bend))
                            horizontal.addQuadCurve(to: CGPoint(x: size.width, y: origin.y + bend),
                                                    control: CGPoint(x: origin.x, y: origin.y + bend * 1.9))
                            context.stroke(horizontal, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                        }
                        return
                    }
                    for vp in active {
                        let origin = CGPoint(x: vp.x * size.width, y: vp.y * size.height)
                        for step in 0..<36 {
                            let angle = Double(step) / 36 * .pi * 2
                            var path = Path()
                            path.move(to: origin)
                            path.addLine(to: CGPoint(x: origin.x + cos(angle) * diagonal,
                                                     y: origin.y + sin(angle) * diagonal))
                            context.stroke(path, with: .color(BoardBrand.accent.opacity(0.18)),
                                           lineWidth: 0.8)
                        }
                    }
                    // Horisont gjennom de to første VP-ene
                    if active.count >= 2 {
                        var horizon = Path()
                        let a = CGPoint(x: active[0].x * size.width, y: active[0].y * size.height)
                        let b = CGPoint(x: active[1].x * size.width, y: active[1].y * size.height)
                        let direction = CGVector(dx: b.x - a.x, dy: b.y - a.y)
                        let length = max(1, hypot(direction.dx, direction.dy))
                        let unit = CGVector(dx: direction.dx / length, dy: direction.dy / length)
                        horizon.move(to: CGPoint(x: a.x - unit.dx * 4000, y: a.y - unit.dy * 4000))
                        horizon.addLine(to: CGPoint(x: a.x + unit.dx * 4000, y: a.y + unit.dy * 4000))
                        context.stroke(horizon, with: .color(BoardBrand.accent.opacity(0.45)),
                                       style: StrokeStyle(lineWidth: 1.2, dash: [8, 5]))
                    }
                }
                .allowsHitTesting(false)
                if editable {
                    ForEach(active.indices, id: \.self) { index in
                        Circle()
                            .fill(BoardBrand.accent)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                            .position(x: active[index].x * size.width,
                                      y: min(size.height - 8, max(8, active[index].y * size.height)))
                            .gesture(
                                DragGesture()
                                    .onChanged { value in
                                        ensureCount()
                                        points[index] = CGPoint(
                                            x: value.location.x / size.width,
                                            y: value.location.y / size.height)
                                    }
                                    .onEnded { _ in onCommit() }
                            )
                    }
                }
            }
        }
        .allowsHitTesting(editable)
    }

    private func activePoints() -> [CGPoint] {
        let wanted = Self.defaults[mode] ?? []
        if points.count != wanted.count { return wanted }
        return points
    }

    private func ensureCount() {
        let wanted = Self.defaults[mode] ?? []
        if points.count != wanted.count { points = wanted }
    }
}

// Drag-reorder av shots: droppes grip-håndtaket på en annen rad flyttes
// shotet dit (server-side moveFrame med offset).
private struct ShotDropDelegate: DropDelegate {
    let targetIndex: Int
    @Binding var draggedFrameId: String?
    let board: BoardState

    func performDrop(info: DropInfo) -> Bool {
        guard let frameId = draggedFrameId else { return false }
        draggedFrameId = nil
        board.moveShot(frameId: frameId, toIndex: targetIndex)
        return true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }
}

// Presentasjons-footer: fire tema-spalter (TONE/BUDSKAP/MÅL/… i pitch-
// formatet). Lagres som JSON på første scene; web ignorerer feltet.
enum PresentationFooter {
    struct Section: Identifiable {
        var id = UUID()
        var title: String
        var itemsText: String   // ett punkt per linje
    }

    static let defaults: [Section] = [
        Section(title: "TONE", itemsText: ""),
        Section(title: "BUDSKAP", itemsText: ""),
        Section(title: "MÅL", itemsText: ""),
        Section(title: "VIDERE IDEER", itemsText: ""),
    ]

    static func encode(_ sections: [Section]) -> String {
        let payload = sections.map { ["title": $0.title, "items": $0.itemsText
            .split(separator: "\n").map(String.init)] }
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return "[]" }
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    static func decode(_ json: String?) -> [Section] {
        guard let json, let data = json.data(using: .utf8),
              let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]],
              !list.isEmpty else { return defaults }
        return list.map { entry in
            Section(title: (entry["title"] as? String) ?? "",
                    itemsText: ((entry["items"] as? [String]) ?? []).joined(separator: "\n"))
        }
    }
}

/// Felles preview-policy for scene-listen. Bildekilden kommer før en lagret
/// thumbnail fordi eldre iPad-versjoner kunne lagre en hvit thumbnail før
/// det eksterne originalbildet var ferdig lastet.
enum StoryboardPreviewPolicy {
    static func sourceURLs(for frame: FrameSummary) -> [String] {
        var seen = Set<String>()
        return [frame.imageUrl, frame.thumbnailDataURL]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    static func representativeFrame(in frames: [FrameSummary]) -> FrameSummary? {
        frames.first(where: hasVisualContent) ?? frames.first
    }

    private static func hasVisualContent(_ frame: FrameSummary) -> Bool {
        if !sourceURLs(for: frame).isEmpty { return true }
        guard let strokes = frame.strokesJSON?.trimmingCharacters(in: .whitespacesAndNewlines)
        else { return false }
        return !strokes.isEmpty && strokes != "[]"
    }
}

// Minne-cache for remote panel-bilder (B2 download-stier) — de synkrone
// render-veiene (canvas, celler, eksport) leser herfra; async prefetch
// fyller den. dataURL-er dekodes direkte og trenger ikke cachen.
@MainActor
enum FrameImageCache {
    static var images: [String: UIImage] = [:]

    static func image(for imageUrl: String?) -> UIImage? {
        guard let imageUrl else { return nil }
        if imageUrl.hasPrefix("data:") { return decodeDataURL(imageUrl) }
        return images[imageUrl]
    }

    /// Hent remote-bilder som mangler i cachen (før render/eksport).
    static func prefetch(frames: [FrameSummary]) async {
        await prefetch(urls: frames.compactMap(\.imageUrl))
    }

    /// Scene-preview trenger også remote thumbnailUrl for eldre/drawn-only
    /// frames. Kildene dedupliseres før sekvensiell nedlasting.
    static func prefetchPreviewSources(frames: [FrameSummary]) async {
        await prefetch(urls: frames.flatMap(StoryboardPreviewPolicy.sourceURLs(for:)))
    }

    private static func prefetch(urls: [String]) async {
        var seen = Set<String>()
        for imageUrl in urls where !imageUrl.hasPrefix("data:")
            && seen.insert(imageUrl).inserted {
            guard !Task.isCancelled else { return }
            guard images[imageUrl] == nil else { continue }
            if let data = await RoleRoomAPIClient.shared.fetchRemoteImageData(path: imageUrl),
               let image = UIImage(data: data) {
                images[imageUrl] = image
            }
        }
    }
}

// Delt offscreen-motor: re-rendrer frames fra strokesJSON i full oppløsning
// (PDF/PNG-eksport og penselforhåndsvisning) — 280px-thumbs er kun for
// scenelister. Én instans gjenbrukes; canvas resizes per kall.
@MainActor
enum FrameRenderService {
    static let renderer = MetalStrokeRenderer()

    /// Rendrer frame-tegningen offscreen ved gitt bredde (aspekt fra
    /// drawingWidth/Height). Tekst-annotasjoner («PUSH IN») tegnes inn med
    /// CoreText (Metal tegner ikke tekst); underlaget kan tas med for
    /// review-utgaver. nil → ingen strøk / motor utilgjengelig.
    static func image(for frame: FrameSummary, maxWidth: CGFloat,
                      includeUnderlay: Bool = false,
                      includeReviewLayer: Bool = false) -> UIImage? {
        guard let renderer,
              let json = frame.strokesJSON,
              let strokes = try? StrokeSerialization.decodeFromWebJSON(json) else { return nil }
        // Redlines (lag «Review») er reviewer-markeringer — aldri i
        // PDF/PNG/animatic-leveranser, kun i review-flaten.
        let drawable = strokes.filter {
            $0.textAnnotation == nil
                && (includeReviewLayer || $0.boardLayer != "Review")
        }
        let frameImage = FrameImageCache.image(for: frame.imageUrl)
        guard frame.drawingWidth > 0,
              !drawable.isEmpty || frameImage != nil else { return nil }
        let scale = maxWidth / frame.drawingWidth
        renderer.setEditableBase(cgImage: frameImage?.cgImage)
        renderer.resizeCanvas(width: Int(maxWidth),
                              height: Int(frame.drawingHeight * scale))
        renderer.rebuild(strokes: drawable, scale: scale)
        guard let dataURL = renderer.thumbnailDataURL(maxWidth: maxWidth),
              let base = decodeDataURL(dataURL) else { return nil }

        let annotations = strokes.filter { ($0.textAnnotation ?? "").isEmpty == false }
        let underlayImage = includeUnderlay ? frame.underlayDataURL.flatMap(decodeDataURL) : nil
        guard underlayImage != nil || !annotations.isEmpty else { return base }
        let size = base.size
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            if let underlay = underlayImage {
                underlay.draw(in: CGRect(origin: .zero, size: size), blendMode: .normal,
                              alpha: CGFloat(frame.underlayOpacity ?? 0.4))
            }
            // Multiply: hvitt papir slipper bildet/underlaget gjennom, grafitt biter.
            base.draw(in: CGRect(origin: .zero, size: size), blendMode: .multiply, alpha: 1)
            for stroke in annotations {
                guard let point = stroke.points.first else { continue }
                let style = stroke.annotationStyle
                let text = style == nil
                    ? (stroke.textAnnotation ?? "").uppercased()
                    : (stroke.textAnnotation ?? "")
                let fontSize = max(12, (style == nil ? 40 : 30) * scale)
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont(name: BoardBrand.handwriting, size: fontSize)
                        ?? UIFont.systemFont(ofSize: fontSize),
                    .foregroundColor: style == "note"
                        ? UIColor(red: 0.25, green: 0.22, blue: 0.15, alpha: 1)
                        : UIColor(Color(hex: stroke.color) ?? BoardBrand.accent),
                ]
                let textSize = (text as NSString).size(withAttributes: attributes)
                let origin = CGPoint(x: CGFloat(point.x) * scale - textSize.width / 2,
                                     y: CGFloat(point.y) * scale - textSize.height / 2)
                // Post-it / snakkeboble: bakgrunnsform bak teksten.
                if style == "note" || style == "bubble" {
                    let pad = 10 * scale
                    let box = CGRect(x: origin.x - pad, y: origin.y - pad,
                                     width: textSize.width + pad * 2,
                                     height: textSize.height + pad * 2)
                    let path = UIBezierPath(roundedRect: box,
                                            cornerRadius: style == "bubble" ? 10 * scale : 2)
                    if style == "note" {
                        UIColor(red: 0.96, green: 0.91, blue: 0.75, alpha: 0.95).setFill()
                        path.fill()
                    } else {
                        UIColor.white.setFill()
                        path.fill()
                        UIColor(Color(hex: stroke.color) ?? BoardBrand.accent).setStroke()
                        path.lineWidth = 2 * scale
                        path.stroke()
                        // Hale nederst til venstre
                        let tail = UIBezierPath()
                        tail.move(to: CGPoint(x: box.minX + box.width * 0.22, y: box.maxY))
                        tail.addLine(to: CGPoint(x: box.minX + box.width * 0.14,
                                                 y: box.maxY + 14 * scale))
                        tail.addLine(to: CGPoint(x: box.minX + box.width * 0.34, y: box.maxY))
                        UIColor.white.setFill()
                        tail.fill()
                    }
                }
                (text as NSString).draw(at: origin, withAttributes: attributes)
            }
        }
    }

    /// PNG-fil i temp for deling (shot-menyens «Eksporter PNG»).
    static func exportPNG(frame: FrameSummary, projectTitle: String) -> URL? {
        guard let image = image(for: frame, maxWidth: 1920) ?? decodeDataURL(frame.thumbnailDataURL),
              let png = image.pngData() else { return nil }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) \(frame.shotNumber).png")
        try? png.write(to: url)
        return url
    }
}

@MainActor
enum BoardPDFExporter {
    /// Async: frames pre-rendres med Task.yield mellom hver (UI forblir
    /// responsiv på store prosjekter) og progress rapporteres «N/M».
    static func export(projectTitle: String, scenes: [SceneSummary],
                       includeUnderlay: Bool = false,
                       progress: ((Int, Int) -> Void)? = nil) async -> URL? {
        // Pre-render alle frame-bilder (den tunge delen).
        let allFrames = scenes.flatMap(\.frames)
        await FrameImageCache.prefetch(frames: allFrames)
        var images: [String: UIImage] = [:]
        for (index, frame) in allFrames.enumerated() {
            progress?(index + 1, allFrames.count)
            if let image = FrameRenderService.image(for: frame, maxWidth: 1120,
                                                    includeUnderlay: includeUnderlay)
                ?? decodeDataURL(frame.thumbnailDataURL) {
                images[frame.id] = image
            }
            await Task.yield()
        }

        let pageRect = CGRect(x: 0, y: 0, width: 842, height: 595) // A4 landskap pt
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) storyboard.pdf")
        do {
            try renderer.writePDF(to: url) { context in
                drawTitlePage(context: context, projectTitle: projectTitle,
                              scenes: scenes, in: pageRect)
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
                            drawShotRow(frame, rowIndex: rowIndex, in: pageRect,
                                        image: images[frame.id])
                        }
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    /// Forside: prosjekt, dato, omfang — produksjonskontorets førsteside.
    private static func drawTitlePage(context: UIGraphicsPDFRendererContext,
                                      projectTitle: String, scenes: [SceneSummary],
                                      in page: CGRect) {
        context.beginPage()
        let shotCount = scenes.reduce(0) { $0 + $1.frames.count }
        let totalSeconds = scenes.flatMap(\.frames).reduce(0.0) { $0 + $1.durationSec }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.locale = Locale(identifier: "nb_NO")
        (projectTitle.uppercased() as NSString).draw(
            at: CGPoint(x: 72, y: 200),
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 34),
                             .foregroundColor: UIColor.black])
        ("STORYBOARD" as NSString).draw(
            at: CGPoint(x: 72, y: 244),
            withAttributes: [.font: UIFont.systemFont(ofSize: 16, weight: .medium),
                             .foregroundColor: UIColor.darkGray])
        let meta = [
            formatter.string(from: Date()),
            "\(scenes.count) scener · \(shotCount) shots",
            String(format: "Estimert lengde %.0f sek", totalSeconds),
        ].joined(separator: "\n")
        (meta as NSString).draw(
            in: CGRect(x: 72, y: 300, width: 500, height: 120),
            withAttributes: [.font: UIFont.systemFont(ofSize: 13),
                             .foregroundColor: UIColor.black])
    }

    /// Presentasjons-mal (pitch-dokument): 4×3-grid per side, nummer-
    /// badge, caption (description) under hvert panel, tittel-header og
    /// enkel footer — i motsetning til produksjons-PDF-en (metadata-rader).
    static func exportPresentation(projectTitle: String, scenes: [SceneSummary],
                                   progress: ((Int, Int) -> Void)? = nil) async -> URL? {
        let allFrames = scenes.flatMap(\.frames)
        guard !allFrames.isEmpty else { return nil }
        await FrameImageCache.prefetch(frames: allFrames)
        var images: [String: UIImage] = [:]
        for (index, frame) in allFrames.enumerated() {
            progress?(index + 1, allFrames.count)
            if let image = FrameRenderService.image(for: frame, maxWidth: 640)
                ?? decodeDataURL(frame.thumbnailDataURL)
                ?? FrameImageCache.image(for: frame.imageUrl) {
                images[frame.id] = image
            }
            await Task.yield()
        }
        let pageRect = CGRect(x: 0, y: 0, width: 842, height: 595)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) presentasjon.pdf")
        let columns = 4, rows = 3
        let perPage = columns * rows
        let margin = 36.0
        let cellWidth = (pageRect.width - margin * 2 - Double(columns - 1) * 14) / Double(columns)
        let panelHeight = cellWidth * 9 / 16
        let cellHeight = panelHeight + 34
        do {
            try renderer.writePDF(to: url) { context in
                let pages = stride(from: 0, to: allFrames.count, by: perPage).map {
                    Array(allFrames[$0..<min($0 + perPage, allFrames.count)])
                }
                for (pageIndex, pageFrames) in pages.enumerated() {
                    context.beginPage()
                    // Header + konsept-linje
                    (projectTitle.uppercased() as NSString).draw(
                        at: CGPoint(x: margin, y: 16),
                        withAttributes: [.font: UIFont.boldSystemFont(ofSize: 20),
                                         .foregroundColor: UIColor(red: 0.1, green: 0.3, blue: 0.75, alpha: 1)])
                    if let concept = scenes.first?.presentationConcept, !concept.isEmpty {
                        ("KONSEPT: \(concept)" as NSString).draw(
                            in: CGRect(x: margin, y: 40, width: pageRect.width - margin * 2, height: 14),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8.5),
                                             .foregroundColor: UIColor.darkGray])
                    }
                    let formatter = DateFormatter()
                    formatter.dateStyle = .medium
                    formatter.locale = Locale(identifier: "nb_NO")
                    let headerRight = "\(formatter.string(from: Date()))  ·  side \(pageIndex + 1)/\(pages.count)"
                    let rightAttributes: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 9), .foregroundColor: UIColor.darkGray]
                    let rightSize = (headerRight as NSString).size(withAttributes: rightAttributes)
                    (headerRight as NSString).draw(
                        at: CGPoint(x: pageRect.width - margin - rightSize.width, y: 28),
                        withAttributes: rightAttributes)
                    // Grid
                    for (slot, frame) in pageFrames.enumerated() {
                        let column = slot % columns, row = slot / columns
                        let x = margin + Double(column) * (cellWidth + 14)
                        let y = 58.0 + Double(row) * (cellHeight + 16)
                        let panelRect = CGRect(x: x, y: y, width: cellWidth, height: panelHeight)
                        UIColor.black.setStroke()
                        let border = UIBezierPath(rect: panelRect)
                        border.lineWidth = 1
                        border.stroke()
                        images[frame.id]?.draw(in: panelRect)
                        // Nummer-badge
                        let badge = CGRect(x: x + 4, y: y + 4, width: 22, height: 16)
                        UIColor.white.setFill()
                        UIBezierPath(rect: badge).fill()
                        UIColor.black.setStroke()
                        UIBezierPath(rect: badge).stroke()
                        let number = "\(pageIndex * perPage + slot + 1)" as NSString
                        number.draw(in: badge.insetBy(dx: 5, dy: 2),
                                    withAttributes: [.font: UIFont.boldSystemFont(ofSize: 10),
                                                     .foregroundColor: UIColor.black])
                        // Caption: description, to linjer
                        (frame.description as NSString).draw(
                            in: CGRect(x: x, y: y + panelHeight + 4, width: cellWidth, height: 28),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                             .foregroundColor: UIColor.black])
                    }
                    // Footer: fire tema-spalter når satt, ellers enkel linje
                    let sections = PresentationFooter.decode(scenes.first?.presentationFooter)
                        .filter { !$0.itemsText.isEmpty }
                    if sections.isEmpty {
                        let footer = "\(projectTitle)  ·  \(scenes.count) scener  ·  \(allFrames.count) paneler"
                        (footer as NSString).draw(
                            at: CGPoint(x: margin, y: pageRect.height - 22),
                            withAttributes: [.font: UIFont.systemFont(ofSize: 8),
                                             .foregroundColor: UIColor.gray])
                    } else {
                        let footerTop = pageRect.height - 64
                        UIColor.lightGray.setStroke()
                        let divider = UIBezierPath()
                        divider.move(to: CGPoint(x: margin, y: footerTop - 6))
                        divider.addLine(to: CGPoint(x: pageRect.width - margin, y: footerTop - 6))
                        divider.lineWidth = 0.5
                        divider.stroke()
                        let columnWidth = (pageRect.width - margin * 2) / CGFloat(sections.count)
                        for (index, section) in sections.enumerated() {
                            let x = margin + CGFloat(index) * columnWidth
                            (section.title.uppercased() as NSString).draw(
                                at: CGPoint(x: x, y: footerTop),
                                withAttributes: [.font: UIFont.boldSystemFont(ofSize: 8),
                                                 .foregroundColor: UIColor(red: 0.1, green: 0.3, blue: 0.75, alpha: 1)])
                            let items = section.itemsText.split(separator: "\n")
                                .map { "•  \($0)" }.joined(separator: "\n")
                            (items as NSString).draw(
                                in: CGRect(x: x, y: footerTop + 11,
                                           width: columnWidth - 10, height: 50),
                                withAttributes: [.font: UIFont.systemFont(ofSize: 6.5),
                                                 .foregroundColor: UIColor.black])
                        }
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    /// Shot-liste som CSV (semikolon — Excel-NO) for produksjonsplanlegging.
    static func exportCSV(projectTitle: String, scenes: [SceneSummary]) -> URL? {
        var rows = ["Scene;Shot;Beskrivelse;Type;Lens;Bevegelse;Varighet (s);Beat;Status;Tags"]
        for scene in scenes {
            for frame in scene.frames {
                let cells = [
                    scene.heading, frame.shotNumber, frame.description,
                    frame.shotType ?? "", frame.lensMm.map { "\($0)mm" } ?? "",
                    frame.movement ?? "", String(format: "%.1f", frame.durationSec),
                    frame.beatTag ?? "", frame.frameStatus ?? "",
                    frame.tags.joined(separator: ", "),
                ].map { $0.replacingOccurrences(of: ";", with: ",") }
                rows.append(cells.joined(separator: ";"))
            }
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) shotliste.csv")
        guard let data = ("\u{FEFF}" + rows.joined(separator: "\n")).data(using: .utf8) else { return nil }
        try? data.write(to: url)
        return url
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

    private static func drawShotRow(_ frame: FrameSummary, rowIndex: Int, in page: CGRect,
                                    image: UIImage?) {
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
        if let image {
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

    private var isHatchBrush: Bool {
        canvasState.brushType == .hatch || canvasState.brushType == .crosshatch
    }

    private var isEnvironmentalBrush: Bool {
        switch canvasState.brushType {
        case .forest, .debris, .organictex, .fur, .wethair, .spikes: return true
        default: return false
        }
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
                    LabeledContent("Fargevariasjon") {
                        Slider(value: overrideBinding(\.hueJitterOverride, default: 0), in: 0...1)
                    }
                }
                // §48: parametre per kategori — vis kun det penselen støtter
                if isHatchBrush {
                    Section("Skravering") {
                        LabeledContent("Vinkel \(Int(canvasState.hatchAngleOverride ?? 35))°") {
                            Slider(value: overrideBinding(\.hatchAngleOverride, default: 35), in: 0...180)
                        }
                        LabeledContent("Tetthet") {
                            Slider(value: overrideBinding(\.hatchDensityOverride, default: 1), in: 0.3...2.5)
                        }
                        LabeledContent("Lengde") {
                            Slider(value: overrideBinding(\.hatchLengthOverride, default: 1), in: 0.4...2.5)
                        }
                    }
                }
                if isEnvironmentalBrush {
                    Section("Struktur") {
                        LabeledContent("Tetthet") {
                            Slider(value: overrideBinding(\.envDensityOverride, default: 1), in: 0.3...2.5)
                        }
                        LabeledContent("Skala") {
                            Slider(value: overrideBinding(\.envScaleOverride, default: 1), in: 0.4...2.5)
                        }
                    }
                }
                Section {
                    Button("Tilbakestill til preset") {
                        canvasState.grainOverride = nil
                        canvasState.flowOverride = nil
                        canvasState.hatchAngleOverride = nil
                        canvasState.hatchDensityOverride = nil
                        canvasState.hatchLengthOverride = nil
                        canvasState.envDensityOverride = nil
                        canvasState.envScaleOverride = nil
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
    var hero: HeroReport?
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
                        // Fokal klarhet (§73–§74 forenklet): står noe frem?
                        Section("Fokus") {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Fokal kontrast").font(.system(size: 12, weight: .bold))
                                    Spacer()
                                    Text("\(Int(report.focalContrast * 100)) %")
                                        .font(.system(size: 12).monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                if report.isDiffuse {
                                    Label("Diffust: ingen sone står tydelig frem — vurder å mørkne hero-området eller lette omgivelsene.",
                                          systemImage: "exclamationmark.triangle")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                } else if report.focalZone != nil {
                                    Text("Tyngdepunktet er markert i tetthetskartet under.")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                // §74 hero-separasjon (Vision-saliency)
                                if let hero {
                                    HStack {
                                        Text("Hero-separasjon").font(.system(size: 12, weight: .bold))
                                        Spacer()
                                        Text("\(Int(hero.separation * 100)) %")
                                            .font(.system(size: 12).monospacedDigit())
                                            .foregroundStyle(.secondary)
                                    }
                                    if hero.isWeak {
                                        Label("Hero-regionen drukner i omgivelsene — øk verdikontrasten rundt hovedmotivet.",
                                              systemImage: "exclamationmark.triangle")
                                            .font(.caption)
                                            .foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                        // Density map (§70–§72): heatmap + hvilesoner
                        Section("Tetthetskart") {
                            VStack(alignment: .leading, spacing: 6) {
                                VStack(spacing: 2) {
                                    ForEach(0..<ToneReport.gridRows, id: \.self) { row in
                                        HStack(spacing: 2) {
                                            ForEach(0..<ToneReport.gridColumns, id: \.self) { col in
                                                let isPeak = report.focalZone.map { $0.row == row && $0.col == col } ?? false
                                                RoundedRectangle(cornerRadius: 2)
                                                    .fill(Color.primary.opacity(0.06 + report.densityGrid[row][col] * 0.9))
                                                    .overlay(RoundedRectangle(cornerRadius: 2)
                                                        .stroke(isPeak ? BoardBrand.accent : .clear, lineWidth: 2))
                                                    .aspectRatio(1.6, contentMode: .fit)
                                            }
                                        }
                                    }
                                }
                                Text("\(report.restZoneCount) av \(ToneReport.gridRows * ToneReport.gridColumns) soner er hvileflater (øyet trenger pauser — helt fullt bilde blir støy).")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
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

    /// Frame-id-er med usynkede strøk på disk (indikator-grunnlag).
    static func pendingFrameIds() -> Set<String> {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return Set(files.filter { $0.hasSuffix(".json") }.map { String($0.dropLast(5)) })
    }
}

struct FlowTags: View {
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
    // Lesemodus (fullskjerm): manus-typografi i smal kolonne med
    // justerbar tekststørrelse — for gjennomlesing, ikke redigering.
    var readingMode = false
    var onEnterReadingMode: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("sb.scriptFontSize") private var readingFontSize = 16.0

    private func slugline(_ scene: SceneSummary, index: Int) -> String {
        let parts = [scene.intExt?.uppercased(),
                     scene.location?.uppercased(),
                     scene.timeOfDay.map { "— \($0.uppercased())" }]
            .compactMap(\.self)
        let head = parts.isEmpty ? scene.heading.uppercased() : parts.joined(separator: " ")
        return "\(scene.sceneNumber ?? index + 1). \(head)"
    }

    private var baseSize: Double { readingMode ? readingFontSize : 13 }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: readingMode ? 34 : 26) {
                        ForEach(Array(scenes.enumerated()), id: \.element.id) { index, scene in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(slugline(scene, index: index))
                                    .font(.system(size: baseSize + 1, weight: .bold, design: .monospaced))
                                if let text = scene.descriptionText, !text.isEmpty {
                                    Text(text)
                                        .font(.system(size: baseSize, design: .monospaced))
                                        .lineSpacing(readingMode ? 6 : 3)
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
                    .frame(maxWidth: readingMode ? 680 : .infinity)
                    .frame(maxWidth: .infinity)
                }
                .onAppear { proxy.scrollTo(activeIndex, anchor: .top) }
            }
            .navigationTitle(readingMode ? "Script — lesemodus" : "Script")
            .toolbar {
                if readingMode {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button {
                            readingFontSize = max(12, readingFontSize - 2)
                        } label: { Image(systemName: "textformat.size.smaller") }
                        Button {
                            readingFontSize = min(30, readingFontSize + 2)
                        } label: { Image(systemName: "textformat.size.larger") }
                    }
                } else if let onEnterReadingMode {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            onEnterReadingMode()
                        } label: {
                            Label("Fullskjerm", systemImage: "arrow.up.left.and.arrow.down.right")
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } }
            }
        }
    }
}
