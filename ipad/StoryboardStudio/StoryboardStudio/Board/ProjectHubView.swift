import SwiftUI
import PhotosUI

// Prosjekt-hub (Milanote-ideen): landingsflaten FØR boardet — oversikt,
// fremdrift, scene-kart, moodboard, oppgaver og notater for produksjonen.
// Datagrunnlag: scenene/frames fra API-et + hub-metadata lagret på første
// scene (samme mønster som presentasjonsoppsettet — web ignorerer feltene).

// Flate-navigasjon: samme sidemeny i hub, Assets og Review — velger man
// en annen flate lukkes den aktive og målet åpnes fra hubben.
enum HubDestination: String, Identifiable {
    case board, script, shotList, animatic, review, assets
    var id: String { rawValue }
}

struct HubSidebar: View {
    let projectName: String
    let storageUsed: Int
    let storageQuota: Int?
    var active: HubDestination?
    let onSelect: (HubDestination) -> Void

    private static let items: [(HubDestination, String, String)] = [
        (.board, "rectangle.grid.2x2", "Board"),
        (.script, "doc.text", "Script"),
        (.shotList, "list.bullet", "Shot List"),
        (.animatic, "play.rectangle", "Animatic"),
        (.review, "checkmark.bubble", "Review"),
        (.assets, "folder", "Assets"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(projectName)
                .font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                .padding(.bottom, 10)
            ForEach(Self.items, id: \.0) { destination, icon, title in
                let isActive = active == destination
                Button {
                    guard !isActive else { return }
                    onSelect(destination)
                } label: {
                    HStack(spacing: 9) {
                        Image(systemName: icon).font(.system(size: 12))
                        Text(title).font(.system(size: 13, weight: .medium))
                        Spacer()
                    }
                    .foregroundStyle(isActive ? .white : BoardBrand.dim)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(isActive ? BoardBrand.accent.opacity(0.35)
                                : Color.white.opacity(0.03),
                                in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            Spacer()
            VStack(alignment: .leading, spacing: 5) {
                Text("LAGRING")
                    .font(.system(size: 9, weight: .bold)).kerning(1)
                    .foregroundStyle(BoardBrand.label)
                GeometryReader { geo in
                    let quota = Double(storageQuota ?? 1_073_741_824)
                    let fraction = min(1, Double(storageUsed) / max(1, quota))
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.08))
                        Capsule().fill(fraction > 0.85 ? Color.orange : BoardBrand.accent)
                            .frame(width: geo.size.width * fraction)
                    }
                }
                .frame(height: 5)
                Text("\(ByteCountFormatter.string(fromByteCount: Int64(storageUsed), countStyle: .file)) av \(ByteCountFormatter.string(fromByteCount: Int64(storageQuota ?? 1_073_741_824), countStyle: .file))")
                    .font(.system(size: 9)).foregroundStyle(BoardBrand.dim)
            }
        }
        .padding(14)
        .frame(width: 170)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(BoardBrand.panel)
    }
}

@MainActor
final class HubState: ObservableObject {
    let project: ProjectSummary
    let manuscript: ManuscriptSummary
    @Published var scenes: [SceneSummary] = []
    @Published var tasks: [HubTask] = []
    @Published var notes = ""
    @Published var quote = ""
    @Published var moodboard: [String] = []   // imageUrl-stier (B2/dataURL)
    @Published var presentOthers: [String] = []
    @Published var loading = true
    @Published var status: String?

    struct HubTask: Identifiable, Codable {
        var id: String
        var text: String
        var done: Bool
    }

    struct MapNote: Identifiable, Codable {
        var id: String
        var text: String
        var x: Double
        var y: Double
        // Blå pil fra lappen til en scene-node (mockup-annotasjonen)
        var targetSceneId: String?
    }

    struct ProjectInfo: Codable {
        var genre = ""
        var director = ""
        var dp = ""
        var aspect = ""
        var targetMins = ""
        var status = "I arbeid"
    }

    struct TeamMember: Identifiable, Codable {
        var id: String
        var name: String
        var role: String
    }

    @Published var mapPositions: [String: CGPoint] = [:]   // sceneId → punkt
    @Published var mapNotes: [MapNote] = []
    @Published var team: [TeamMember] = []
    @Published var assets: [RoleRoomAPIClient.StorageFileSummary] = []
    @Published var info = ProjectInfo()
    @Published var storageUsed = 0
    @Published var storageQuota: Int?
    @Published var palette: [Color] = []

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        self.project = project
        self.manuscript = manuscript
    }

    var allFrames: [FrameSummary] { scenes.flatMap(\.frames) }
    var doneCount: Int { allFrames.filter { $0.frameStatus == "done" }.count }
    var progress: Double {
        allFrames.isEmpty ? 0 : Double(doneCount) / Double(allFrames.count)
    }
    var totalSeconds: Double { allFrames.reduce(0) { $0 + $1.durationSec } }
    var nightCount: Int {
        allFrames.filter { ($0.timeOfDay ?? "").localizedCaseInsensitiveContains("night") }.count
    }
    /// Siste redigerte scener (Recent Boards-raden).
    var recentScenes: [SceneSummary] {
        scenes.sorted { sceneUpdatedAt($0) > sceneUpdatedAt($1) }
    }

    private func sceneUpdatedAt(_ scene: SceneSummary) -> String {
        scene.frames.compactMap(\.updatedAt).max() ?? ""
    }

    func load() async {
        loading = scenes.isEmpty
        if let fetched = try? await RoleRoomAPIClient.shared.fetchScenes(manuscriptId: manuscript.id) {
            scenes = fetched
            let meta = fetched.first
            tasks = Self.decodeTasks(meta?.hubTasks)
            notes = meta?.hubNotes ?? ""
            quote = meta?.hubQuote ?? ""
            moodboard = Self.decodeMoodboard(meta?.hubMoodboard)
            mapPositions = Self.decodePositions(meta?.hubMapPositions)
            mapNotes = Self.decodeList(meta?.hubMapNotes)
            team = Self.decodeList(meta?.hubTeam)
            if let json = meta?.hubInfo, let data = json.data(using: .utf8),
               let decoded = try? JSONDecoder().decode(ProjectInfo.self, from: data) {
                info = decoded
            }
        }
        loading = false
        assets = await RoleRoomAPIClient.shared.listStorageFiles(projectId: project.id)
        presentOthers = await RoleRoomAPIClient.shared.reportPresence(manuscriptId: manuscript.id)
        if let stats = await RoleRoomAPIClient.shared.fetchStorageStats() {
            storageUsed = stats.used
            storageQuota = stats.quota
        }
        await FrameImageCache.prefetch(frames: Array(allFrames.prefix(20)))
        refreshPalette()
    }

    func persistMeta() {
        let payload: [String: any Sendable] = [
            "hubTasks": Self.encodeTasks(tasks),
            "hubNotes": notes,
            "hubQuote": quote,
            "hubMoodboard": (try? JSONSerialization.data(withJSONObject: moodboard))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]",
            "hubMapPositions": Self.encodePositions(mapPositions),
            "hubMapNotes": Self.encodeList(mapNotes),
            "hubTeam": Self.encodeList(team),
            "hubInfo": (try? JSONEncoder().encode(info))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}",
        ]
        let manuscriptId = manuscript.id
        Task {
            try? await RoleRoomAPIClient.shared.setHubMeta(manuscriptId: manuscriptId,
                                                           fields: payload)
        }
    }

    /// Dominante farger fra moodboard-bildene (fargepalett-swatchene):
    /// 4-bit kvantisering per kanal, topp 6 klynger.
    func refreshPalette() {
        var counts: [Int: Int] = [:]
        for imageUrl in moodboard.prefix(8) {
            guard let image = FrameImageCache.image(for: imageUrl),
                  let cg = image.cgImage else { continue }
            let side = 24
            var pixels = [UInt8](repeating: 0, count: side * side * 4)
            guard let context = CGContext(
                data: &pixels, width: side, height: side, bitsPerComponent: 8,
                bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
            context.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))
            for index in stride(from: 0, to: pixels.count, by: 4) {
                let r = Int(pixels[index]) >> 4, g = Int(pixels[index + 1]) >> 4,
                    b = Int(pixels[index + 2]) >> 4
                // hopp over nær-grått/hvitt/svart støy? behold alt — boards er mørke
                counts[(r << 8) | (g << 4) | b, default: 0] += 1
            }
        }
        palette = counts.sorted { $0.value > $1.value }.prefix(6).map { key, _ in
            Color(red: Double((key >> 8) & 0xF) / 15,
                  green: Double((key >> 4) & 0xF) / 15,
                  blue: Double(key & 0xF) / 15)
        }
    }

    static func decodeTasks(_ json: String?) -> [HubTask] {
        guard let json, let data = json.data(using: .utf8),
              let list = try? JSONDecoder().decode([HubTask].self, from: data) else { return [] }
        return list
    }

    static func encodeTasks(_ tasks: [HubTask]) -> String {
        guard let data = try? JSONEncoder().encode(tasks) else { return "[]" }
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    static func decodeList<T: Codable>(_ json: String?) -> [T] {
        guard let json, let data = json.data(using: .utf8),
              let list = try? JSONDecoder().decode([T].self, from: data) else { return [] }
        return list
    }

    static func encodeList<T: Codable>(_ list: [T]) -> String {
        guard let data = try? JSONEncoder().encode(list) else { return "[]" }
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    static func decodePositions(_ json: String?) -> [String: CGPoint] {
        guard let json, let data = json.data(using: .utf8),
              let dict = (try? JSONSerialization.jsonObject(with: data)) as? [String: [Double]]
        else { return [:] }
        return dict.compactMapValues { $0.count == 2 ? CGPoint(x: $0[0], y: $0[1]) : nil }
    }

    static func encodePositions(_ positions: [String: CGPoint]) -> String {
        let payload = positions.mapValues { [Double($0.x), Double($0.y)] }
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    static func decodeMoodboard(_ json: String?) -> [String] {
        guard let json, let data = json.data(using: .utf8),
              let list = (try? JSONSerialization.jsonObject(with: data)) as? [String] else { return [] }
        return list
    }
}

struct ProjectHubView: View {
    @StateObject private var hub: HubState
    @State private var openBoardSceneIndex: Int?
    @State private var newTaskText = ""
    @State private var moodPickerItem: PhotosPickerItem?
    @State private var showBoard = false

    init(project: ProjectSummary, manuscript: ManuscriptSummary) {
        _hub = StateObject(wrappedValue: HubState(project: project, manuscript: manuscript))
    }

    var body: some View {
        HStack(spacing: 0) {
            sidebar
            ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                HStack(alignment: .top, spacing: 18) {
                    VStack(alignment: .leading, spacing: 18) {
                        recentBoards
                        sceneMap
                        moodboardSection
                        assetsSection
                    }
                    .frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 18) {
                        infoCard
                        teamCard
                        progressCard
                        tasksCard
                        notesCard
                        quoteCard
                    }
                    .frame(width: 320)
                }
            }
            .padding(20)
            }
        }
        .background(BoardBrand.chrome)
        .navigationTitle(hub.project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await hub.load() }
        .fullScreenCover(isPresented: $showBoard) {
            NavigationStack {
                NativeBoardView(manuscript: hub.manuscript, projectId: hub.project.id,
                                initialSceneIndex: openBoardSceneIndex ?? 0,
                                initialSheet: boardSheet)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Hub") {
                                showBoard = false
                                Task { await hub.load() }
                            }
                        }
                    }
            }
        }
        .alert("Rediger lapp", isPresented: Binding(
            get: { editingNoteId != nil },
            set: { if !$0 { editingNoteId = nil } })) {
            TextField("Tekst", text: $noteDraft)
            Button("Lagre") {
                if let noteId = editingNoteId,
                   let index = hub.mapNotes.firstIndex(where: { $0.id == noteId }) {
                    hub.mapNotes[index].text = noteDraft
                    hub.persistMeta()
                }
                editingNoteId = nil
            }
            Button("Slett", role: .destructive) {
                hub.mapNotes.removeAll { $0.id == editingNoteId }
                hub.persistMeta()
                editingNoteId = nil
            }
            Button("Avbryt", role: .cancel) { editingNoteId = nil }
        }
        .sheet(isPresented: $showScriptDirect) {
            ScriptSheet(scenes: hub.scenes, activeIndex: 0,
                        onEnterReadingMode: {
                            showScriptDirect = false
                            showScriptFullscreen = true
                        })
        }
        .fullScreenCover(isPresented: $showScriptFullscreen) {
            ScriptSheet(scenes: hub.scenes, activeIndex: 0, readingMode: true)
        }
        .sheet(isPresented: $showShotListDirect) {
            ShotListSheet(sceneHeading: "\(hub.manuscript.title) — alle scener",
                          frames: hub.allFrames)
        }
        .fullScreenCover(isPresented: $showAssets) {
            AssetsView(project: hub.project, manuscript: hub.manuscript,
                       storageUsed: hub.storageUsed, storageQuota: hub.storageQuota,
                       onNavigate: { destination in
                           crossNavigate(from: $showAssets, to: destination)
                       })
        }
        .fullScreenCover(isPresented: $showReviewDirect) {
            ReviewView(project: hub.project, manuscript: hub.manuscript,
                       storageUsed: hub.storageUsed, storageQuota: hub.storageQuota,
                       onNavigate: { destination in
                           crossNavigate(from: $showReviewDirect, to: destination)
                       })
        }
        .fullScreenCover(isPresented: $showAnimaticDirect) {
            AnimaticView(sceneHeading: hub.manuscript.title,
                         frames: hub.allFrames.filter {
                             $0.strokesJSON?.isEmpty == false || $0.imageUrl != nil
                                 || $0.thumbnailDataURL != nil
                         })
        }
        .onChange(of: moodPickerItem) {
            guard let item = moodPickerItem else { return }
            moodPickerItem = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let dataURL = NativeBoardView.jpegDataURL(image, maxSide: 900, quality: 0.7),
                      let comma = dataURL.firstIndex(of: ","),
                      let jpeg = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
                else { return }
                var imageUrl = dataURL
                if let path = try? await RoleRoomAPIClient.shared.uploadStorageImage(
                    jpegData: jpeg, name: "\(hub.manuscript.title) - moodboard.jpg",
                    projectId: hub.project.id,
                    attachedToEntityType: "storyboard_moodboard",
                    attachedToEntityId: hub.manuscript.id) {
                    imageUrl = path
                    FrameImageCache.images[path] = image
                }
                hub.moodboard.append(imageUrl)
                hub.persistMeta()
                hub.refreshPalette()
            }
        }
    }

    // MARK: Sidebar (mockup-navigasjonen, iPad-tilpasset)

    @State private var boardSheet: NativeBoardView.InitialSheet?
    @State private var showScriptDirect = false
    @State private var showScriptFullscreen = false
    @State private var showAssets = false
    @State private var showReviewDirect = false
    @State private var showShotListDirect = false
    @State private var showAnimaticDirect = false

    private func openBoard(sheet: NativeBoardView.InitialSheet?) {
        boardSheet = sheet
        openBoardSceneIndex = 0
        showBoard = true
    }

    private var sidebar: some View {
        HubSidebar(projectName: hub.project.name,
                   storageUsed: hub.storageUsed,
                   storageQuota: hub.storageQuota,
                   active: nil) { destination in
            navigate(to: destination)
        }
    }

    @State private var pendingDestination: HubDestination?

    private func navigate(to destination: HubDestination) {
        switch destination {
        case .board: openBoard(sheet: nil)
        case .script: showScriptDirect = true
        case .shotList: showShotListDirect = true
        case .animatic: showAnimaticDirect = true
        case .review: showReviewDirect = true
        case .assets: showAssets = true
        }
    }

    /// Fra en flate (Assets/Review) til en annen: lukk aktiv cover og
    /// åpne målet når lukkingen er ferdig.
    private func crossNavigate(from current: Binding<Bool>, to destination: HubDestination) {
        pendingDestination = destination
        current.wrappedValue = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            if let target = pendingDestination {
                pendingDestination = nil
                navigate(to: target)
            }
        }
    }

    // MARK: Seksjoner

    private var hero: some View {
        HStack(alignment: .center, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text(hub.manuscript.title)
                    .font(.system(size: 28, weight: .bold)).foregroundStyle(.white)
                Text("Fortsett der du slapp — \(hub.scenes.count) scener · \(hub.allFrames.count) shots")
                    .font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                Button {
                    openBoardSceneIndex = hub.scenes.firstIndex {
                        $0.id == hub.recentScenes.first?.id
                    } ?? 0
                    showBoard = true
                } label: {
                    Label("Åpne board", systemImage: "rectangle.grid.2x2")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(BoardBrand.accent, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 6)
            }
            Spacer()
            // Hero-artwork: første moodboard-bilde (stemning) — fallback
            // til siste tegnede frame.
            if let image = hub.moodboard.first.flatMap({ FrameImageCache.image(for: $0) })
                ?? hub.recentScenes.first?.frames.first.flatMap({
                    decodeDataURL($0.thumbnailDataURL) ?? FrameImageCache.image(for: $0.imageUrl)
                }) {
                Image(uiImage: image)
                    .resizable().scaledToFill()
                    .frame(width: 300, height: 150)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(BoardBrand.border))
            }
        }
        .padding(20)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 16))
    }

    private func sectionCard<Content: View>(_ title: String,
                                            @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .bold)).kerning(1)
                .foregroundStyle(BoardBrand.label)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 14))
    }

    private var recentBoards: some View {
        sectionCard("SISTE BOARDS") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(hub.recentScenes.prefix(6).enumerated()),
                            id: \.element.id) { _, scene in
                        Button {
                            openBoardSceneIndex = hub.scenes.firstIndex { $0.id == scene.id } ?? 0
                            showBoard = true
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                sceneThumb(scene, width: 170, height: 96)
                                Text(scene.heading)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white).lineLimit(1)
                                Text("\(scene.frames.count) shots")
                                    .font(.system(size: 10)).foregroundStyle(BoardBrand.dim)
                            }
                            .frame(width: 170)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // Fritt scene-kart (Milanote-idéen): scener som flyttbare noder med
    // koblingslinjer i fortellerrekkefølge + gule post-it-lapper. Posisjoner
    // og lapper persisteres i hub-metadataene.
    private var sceneMap: some View {
        sectionCard("SCENE-KART") {
            ScrollView([.horizontal, .vertical], showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    // Koblingslinjer under nodene + blå lapp-piler
                    Canvas { context, _ in
                        let points = hub.scenes.enumerated().map { index, scene in
                            nodePosition(scene, index: index)
                        }
                        if points.count > 1 {
                            var path = Path()
                            path.move(to: points[0])
                            for point in points.dropFirst() { path.addLine(to: point) }
                            context.stroke(path, with: .color(.white.opacity(0.18)),
                                           style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
                        }
                        // Pil fra lapp → scene (mockup-annotasjonen)
                        for note in hub.mapNotes {
                            guard let targetId = note.targetSceneId,
                                  let index = hub.scenes.firstIndex(where: { $0.id == targetId })
                            else { continue }
                            let from = CGPoint(x: note.x, y: note.y)
                            let to = nodePosition(hub.scenes[index], index: index)
                            var arrow = Path()
                            arrow.move(to: from)
                            arrow.addQuadCurve(to: to, control: CGPoint(
                                x: (from.x + to.x) / 2, y: min(from.y, to.y) - 40))
                            let angle = atan2(to.y - from.y, to.x - from.x)
                            for side in [-0.5, 0.5] {
                                arrow.move(to: to)
                                arrow.addLine(to: CGPoint(
                                    x: to.x - cos(angle + side) * 14,
                                    y: to.y - sin(angle + side) * 14))
                            }
                            context.stroke(arrow, with: .color(Color(red: 0.35, green: 0.6, blue: 1)),
                                           lineWidth: 2)
                        }
                    }
                    .frame(width: mapSize.width, height: mapSize.height)
                    ForEach(Array(hub.scenes.enumerated()), id: \.element.id) { index, scene in
                        sceneNode(scene, index: index)
                            .position(dragOffsets[scene.id]
                                      ?? nodePosition(scene, index: index))
                            .gesture(
                                DragGesture()
                                    .onChanged { dragOffsets[scene.id] = $0.location }
                                    .onEnded { value in
                                        hub.mapPositions[scene.id] = value.location
                                        dragOffsets[scene.id] = nil
                                        hub.persistMeta()
                                    }
                            )
                    }
                    ForEach($hub.mapNotes) { $note in
                        mapNoteView($note)
                    }
                }
                .frame(width: mapSize.width, height: mapSize.height)
                .scaleEffect(mapZoom, anchor: .topLeading)
                .frame(width: mapSize.width * mapZoom, height: mapSize.height * mapZoom)
            }
            .frame(height: 260)
            HStack(spacing: 10) {
                Button { mapZoom = max(0.5, mapZoom - 0.15) } label: {
                    Image(systemName: "minus.magnifyingglass").foregroundStyle(BoardBrand.dim)
                }
                Button { mapZoom = 1.0 } label: {
                    Image(systemName: "arrow.up.left.and.down.right.magnifyingglass")
                        .foregroundStyle(BoardBrand.dim)
                }
                Button { mapZoom = min(2, mapZoom + 0.15) } label: {
                    Image(systemName: "plus.magnifyingglass").foregroundStyle(BoardBrand.dim)
                }
                Spacer()
            Button {
                hub.mapNotes.append(HubState.MapNote(
                    id: UUID().uuidString, text: "Ny lapp",
                    x: 120 + Double(hub.mapNotes.count % 4) * 40,
                    y: 60 + Double(hub.mapNotes.count % 3) * 30))
                hub.persistMeta()
            } label: {
                Label("Ny lapp", systemImage: "note.text.badge.plus")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(BoardBrand.dim)
            }
            .buttonStyle(.plain)
            }
        }
    }

    @State private var mapZoom: Double = 1.0

    private var mapSize: CGSize {
        CGSize(width: max(900, Double(hub.scenes.count) * 170 + 120), height: 460)
    }

    @State private var dragOffsets: [String: CGPoint] = [:]
    @State private var editingNoteId: String?
    @State private var noteDraft = ""

    private func nodePosition(_ scene: SceneSummary, index: Int) -> CGPoint {
        dragOffsets[scene.id] ?? hub.mapPositions[scene.id]
            ?? CGPoint(x: 90 + Double(index) * 165,
                       y: index % 2 == 0 ? 140 : 300)
    }

    private func sceneNode(_ scene: SceneSummary, index: Int) -> some View {
        VStack(spacing: 4) {
            sceneThumb(scene, width: 120, height: 68)
            Text("\(String(format: "%02d", scene.sceneNumber ?? index + 1)) \(scene.heading)")
                .font(.system(size: 10)).foregroundStyle(.white)
                .lineLimit(1).frame(width: 120)
            GeometryReader { geo in
                let done = scene.frames.filter { $0.frameStatus == "done" }.count
                let fraction = scene.frames.isEmpty ? 0 : Double(done) / Double(scene.frames.count)
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.1))
                    Capsule().fill(BoardBrand.accent)
                        .frame(width: geo.size.width * fraction)
                }
            }
            .frame(width: 120, height: 3)
        }
        .padding(6)
        .background(BoardBrand.chrome, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(BoardBrand.border))
        .onTapGesture(count: 2) {
            openBoardSceneIndex = hub.scenes.firstIndex { $0.id == scene.id } ?? 0
            showBoard = true
        }
    }

    private func mapNoteView(_ note: Binding<HubState.MapNote>) -> some View {
        Text(note.wrappedValue.text)
            .font(.custom(BoardBrand.handwriting, size: 13))
            .foregroundStyle(Color(red: 0.25, green: 0.22, blue: 0.15))
            .padding(10)
            .frame(maxWidth: 150, alignment: .topLeading)
            .background(Color(red: 0.96, green: 0.91, blue: 0.6),
                        in: RoundedRectangle(cornerRadius: 3))
            .shadow(color: .black.opacity(0.35), radius: 4, y: 3)
            .position(x: note.wrappedValue.x, y: note.wrappedValue.y)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        note.wrappedValue.x = value.location.x
                        note.wrappedValue.y = value.location.y
                    }
                    .onEnded { _ in hub.persistMeta() }
            )
            .onTapGesture(count: 2) {
                editingNoteId = note.wrappedValue.id
                noteDraft = note.wrappedValue.text
            }
            .contextMenu {
                Menu("Pek på scene") {
                    ForEach(hub.scenes) { scene in
                        Button(scene.heading) {
                            note.wrappedValue.targetSceneId = scene.id
                            hub.persistMeta()
                        }
                    }
                    if note.wrappedValue.targetSceneId != nil {
                        Button("Fjern pil", role: .destructive) {
                            note.wrappedValue.targetSceneId = nil
                            hub.persistMeta()
                        }
                    }
                }
            }
    }

    private var moodboardSection: some View {
        sectionCard("MOODBOARD") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4),
                      spacing: 10) {
                ForEach(hub.moodboard, id: \.self) { imageUrl in
                    ZStack(alignment: .topTrailing) {
                        if let image = FrameImageCache.image(for: imageUrl) {
                            Image(uiImage: image).resizable().scaledToFill()
                                .frame(height: 90)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.06)).frame(height: 90)
                                .task {
                                    if let data = await RoleRoomAPIClient.shared
                                        .fetchRemoteImageData(path: imageUrl),
                                       let image = UIImage(data: data) {
                                        FrameImageCache.images[imageUrl] = image
                                        hub.objectWillChange.send()
                                    }
                                }
                        }
                        Button {
                            hub.moodboard.removeAll { $0 == imageUrl }
                            hub.persistMeta()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(.white.opacity(0.8))
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                PhotosPicker(selection: $moodPickerItem, matching: .images) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 90)
                        .overlay(Image(systemName: "plus")
                            .foregroundStyle(BoardBrand.dim))
                }
            }
            // Fargepalett: dominante farger fra moodboard-bildene
            if !hub.palette.isEmpty {
                HStack(spacing: 8) {
                    ForEach(Array(hub.palette.enumerated()), id: \.offset) { _, color in
                        RoundedRectangle(cornerRadius: 5)
                            .fill(color)
                            .frame(width: 32, height: 24)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(BoardBrand.border))
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    @State private var showInfoEditor = false

    private var infoCard: some View {
        sectionCard(hub.project.name.uppercased()) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    if !hub.info.genre.isEmpty {
                        Text(hub.info.genre)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(BoardBrand.dim)
                    }
                    Spacer()
                    Text(hub.info.status)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(BoardBrand.accent.opacity(0.8), in: Capsule())
                }
                if !hub.info.director.isEmpty { infoRow("Regi", hub.info.director) }
                if !hub.info.dp.isEmpty { infoRow("Foto (DP)", hub.info.dp) }
                if !hub.info.aspect.isEmpty { infoRow("Format", hub.info.aspect) }
                if !hub.info.targetMins.isEmpty { infoRow("Mållengde", "\(hub.info.targetMins) min") }
                infoRow("Manus", hub.manuscript.title)
                infoRow("Scener / shots", "\(hub.scenes.count) / \(hub.allFrames.count)")
                infoRow("Est. lengde", String(format: "%.0f sek", hub.totalSeconds))
                infoRow("Natt / dag", "\(hub.nightCount) / \(hub.allFrames.count - hub.nightCount)")
                infoRow("Locations", "\(Set(hub.scenes.compactMap(\.location).filter { !$0.isEmpty }).count)")
                infoRow("Snitt shot", hub.allFrames.isEmpty ? "—"
                    : String(format: "%.1f s", hub.totalSeconds / Double(hub.allFrames.count)))
                if !hub.presentOthers.isEmpty {
                    infoRow("Aktive nå", hub.presentOthers.joined(separator: ", "))
                }
                HStack {
                    Button("Rediger info") { showInfoEditor = true }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BoardBrand.accent)
                        .buttonStyle(.plain)
                    Spacer()
                    Button("Vis shot-liste") { showShotListDirect = true }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BoardBrand.accent)
                        .buttonStyle(.plain)
                }
                .padding(.top, 4)
            }
        }
        .sheet(isPresented: $showInfoEditor) {
            NavigationStack {
                Form {
                    TextField("Sjanger (f.eks. Sci-Fi Thriller)", text: $hub.info.genre)
                    TextField("Regi", text: $hub.info.director)
                    TextField("Foto (DP)", text: $hub.info.dp)
                    TextField("Format (f.eks. 2.39:1)", text: $hub.info.aspect)
                    TextField("Mållengde (minutter)", text: $hub.info.targetMins)
                        .keyboardType(.numberPad)
                    Picker("Status", selection: $hub.info.status) {
                        Text("I arbeid").tag("I arbeid")
                        Text("Til review").tag("Til review")
                        Text("Godkjent").tag("Godkjent")
                    }
                }
                .navigationTitle("Prosjektinfo")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lagre") {
                            showInfoEditor = false
                            hub.persistMeta()
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 12)).foregroundStyle(BoardBrand.dim)
            Spacer()
            Text(value).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
        }
    }

    private var progressCard: some View {
        sectionCard("FREMDRIFT") {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("\(Int(hub.progress * 100)) %")
                        .font(.system(size: 22, weight: .bold)).foregroundStyle(BoardBrand.accent)
                    Spacer()
                    Text("\(hub.doneCount) av \(hub.allFrames.count) godkjent")
                        .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.08))
                        Capsule().fill(BoardBrand.accent)
                            .frame(width: geo.size.width * hub.progress)
                    }
                }
                .frame(height: 8)
            }
        }
    }

    private var tasksCard: some View {
        sectionCard("OPPGAVER") {
            VStack(alignment: .leading, spacing: 8) {
                ForEach($hub.tasks) { $task in
                    HStack(spacing: 8) {
                        Button {
                            task.done.toggle()
                            hub.persistMeta()
                        } label: {
                            Image(systemName: task.done ? "checkmark.square.fill" : "square")
                                .foregroundStyle(task.done ? BoardBrand.accent : BoardBrand.dim)
                        }
                        .buttonStyle(.plain)
                        Text(task.text)
                            .font(.system(size: 12))
                            .foregroundStyle(task.done ? BoardBrand.dim : .white)
                            .strikethrough(task.done)
                        Spacer()
                        Button {
                            hub.tasks.removeAll { $0.id == task.id }
                            hub.persistMeta()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 9)).foregroundStyle(BoardBrand.label)
                        }
                        .buttonStyle(.plain)
                    }
                }
                HStack(spacing: 8) {
                    TextField("Ny oppgave", text: $newTaskText)
                        .font(.system(size: 12)).foregroundStyle(.white)
                        .onSubmit(addTask)
                    Button(action: addTask) {
                        Image(systemName: "plus")
                            .font(.system(size: 11)).foregroundStyle(.white)
                            .frame(width: 22, height: 22)
                            .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .disabled(newTaskText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    @State private var newMemberName = ""
    @State private var newMemberRole = ""

    private var teamCard: some View {
        sectionCard("TEAM") {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(hub.team) { member in
                    HStack(spacing: 8) {
                        ZStack(alignment: .bottomTrailing) {
                            Circle()
                                .fill(avatarColor(member.name))
                                .frame(width: 26, height: 26)
                                .overlay(Text(initials(member.name))
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white))
                            Circle()
                                .fill(hub.presentOthers.contains(member.name)
                                      ? Color.green : Color.clear)
                                .frame(width: 8, height: 8)
                                .overlay(Circle().stroke(BoardBrand.panel, lineWidth: 1.5))
                        }
                        Text(member.name)
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                        Text(member.role)
                            .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
                        Spacer()
                        Button {
                            hub.team.removeAll { $0.id == member.id }
                            hub.persistMeta()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 9)).foregroundStyle(BoardBrand.label)
                        }
                        .buttonStyle(.plain)
                    }
                }
                ShareLink(item: "Bli med i storyboard-prosjektet «\(hub.project.name)» i The Role Room: https://theroleroom.com") {
                    Label("Inviter", systemImage: "person.badge.plus")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BoardBrand.accent)
                }
                HStack(spacing: 6) {
                    TextField("Navn", text: $newMemberName)
                        .font(.system(size: 12)).foregroundStyle(.white)
                    TextField("Rolle", text: $newMemberRole)
                        .font(.system(size: 12)).foregroundStyle(.white)
                        .frame(width: 90)
                    Button {
                        let name = newMemberName.trimmingCharacters(in: .whitespaces)
                        guard !name.isEmpty else { return }
                        hub.team.append(HubState.TeamMember(
                            id: UUID().uuidString, name: name,
                            role: newMemberRole.trimmingCharacters(in: .whitespaces)))
                        newMemberName = ""
                        newMemberRole = ""
                        hub.persistMeta()
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 11)).foregroundStyle(.white)
                            .frame(width: 22, height: 22)
                            .background(BoardBrand.accent, in: RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined()
    }

    private func avatarColor(_ name: String) -> Color {
        let hues: [Double] = [0.75, 0.55, 0.08, 0.33, 0.9, 0.62]
        return Color(hue: hues[abs(name.hashValue) % hues.count], saturation: 0.55, brightness: 0.7)
    }

    private var assetsSection: some View {
        sectionCard("ASSETS · \(hub.assets.count)") {
            Button("Åpne Assets-fanen") { showAssets = true }
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(BoardBrand.accent)
                .buttonStyle(.plain)
            if hub.assets.isEmpty {
                Text("Ingen filer i prosjektet ennå — paneler, ark og moodboard-bilder havner her.")
                    .font(.system(size: 11)).foregroundStyle(BoardBrand.dim)
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 6),
                          spacing: 10) {
                    ForEach(hub.assets.prefix(18)) { asset in
                        VStack(spacing: 4) {
                            if asset.isImage,
                               let image = FrameImageCache.image(for: asset.downloadPath) {
                                Image(uiImage: image).resizable().scaledToFill()
                                    .frame(height: 66)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            } else {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.white.opacity(0.05)).frame(height: 66)
                                    .overlay(Image(systemName: asset.isImage ? "photo" : "doc")
                                        .foregroundStyle(BoardBrand.label))
                                    .task {
                                        guard asset.isImage else { return }
                                        if let data = await RoleRoomAPIClient.shared
                                            .fetchRemoteImageData(path: asset.downloadPath),
                                           let image = UIImage(data: data) {
                                            FrameImageCache.images[asset.downloadPath] = image
                                            hub.objectWillChange.send()
                                        }
                                    }
                            }
                            Text(asset.displayName)
                                .font(.system(size: 8)).foregroundStyle(BoardBrand.dim)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }

    private func addTask() {
        let text = newTaskText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        newTaskText = ""
        hub.tasks.append(HubState.HubTask(id: UUID().uuidString, text: text, done: false))
        hub.persistMeta()
    }

    private var notesCard: some View {
        sectionCard("NOTATER") {
            TextField("Visuell retning, intensjon …", text: $hub.notes, axis: .vertical)
                .lineLimit(3...8)
                .font(.system(size: 12)).foregroundStyle(.white)
                .onSubmit { hub.persistMeta() }
                .onChange(of: hub.notes) { debounceMetaSave() }
        }
    }

    private var quoteCard: some View {
        sectionCard("REGINOTAT") {
            TextField("«Byen sover aldri. Den ser.»", text: $hub.quote, axis: .vertical)
                .lineLimit(2...4)
                .font(.custom(BoardBrand.handwriting, size: 16))
                .foregroundStyle(BoardBrand.accent)
                .onChange(of: hub.quote) { debounceMetaSave() }
        }
    }

    @State private var metaSaveTask: Task<Void, Never>?

    private func debounceMetaSave() {
        metaSaveTask?.cancel()
        metaSaveTask = Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            hub.persistMeta()
        }
    }

    private func sceneThumb(_ scene: SceneSummary, width: CGFloat, height: CGFloat) -> some View {
        Group {
            if let frame = scene.frames.first,
               let image = decodeDataURL(frame.thumbnailDataURL)
                ?? FrameImageCache.image(for: frame.imageUrl) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Rectangle().fill(Color.white.opacity(0.06))
                    .overlay(Image(systemName: "rectangle.grid.2x2")
                        .foregroundStyle(BoardBrand.label))
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(BoardBrand.border))
    }
}
