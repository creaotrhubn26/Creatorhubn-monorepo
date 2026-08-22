import SwiftUI
import PhotosUI

// Prosjekt-hub (Milanote-ideen): landingsflaten FØR boardet — oversikt,
// fremdrift, scene-kart, moodboard, oppgaver og notater for produksjonen.
// Datagrunnlag: scenene/frames fra API-et + hub-metadata lagret på første
// scene (samme mønster som presentasjonsoppsettet — web ignorerer feltene).

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
        }
        loading = false
        presentOthers = await RoleRoomAPIClient.shared.reportPresence(manuscriptId: manuscript.id)
        await FrameImageCache.prefetch(frames: Array(allFrames.prefix(20)))
    }

    func persistMeta() {
        let payload: [String: any Sendable] = [
            "hubTasks": Self.encodeTasks(tasks),
            "hubNotes": notes,
            "hubQuote": quote,
            "hubMoodboard": (try? JSONSerialization.data(withJSONObject: moodboard))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]",
        ]
        let manuscriptId = manuscript.id
        Task {
            try? await RoleRoomAPIClient.shared.setHubMeta(manuscriptId: manuscriptId,
                                                           fields: payload)
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
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                HStack(alignment: .top, spacing: 18) {
                    VStack(alignment: .leading, spacing: 18) {
                        recentBoards
                        sceneMap
                        moodboardSection
                    }
                    .frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 18) {
                        infoCard
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
        .background(BoardBrand.chrome)
        .navigationTitle(hub.project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await hub.load() }
        .fullScreenCover(isPresented: $showBoard) {
            NavigationStack {
                NativeBoardView(manuscript: hub.manuscript, projectId: hub.project.id,
                                initialSceneIndex: openBoardSceneIndex ?? 0)
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
            if let hero = hub.recentScenes.first?.frames.first,
               let image = decodeDataURL(hero.thumbnailDataURL)
                ?? FrameImageCache.image(for: hero.imageUrl) {
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

    private var sceneMap: some View {
        sectionCard("SCENE-KART") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(Array(hub.scenes.enumerated()), id: \.element.id) { index, scene in
                        HStack(spacing: 0) {
                            Button {
                                openBoardSceneIndex = index
                                showBoard = true
                            } label: {
                                VStack(spacing: 5) {
                                    sceneThumb(scene, width: 120, height: 68)
                                    Text(String(format: "%02d", scene.sceneNumber ?? index + 1))
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(BoardBrand.label)
                                    Text(scene.heading)
                                        .font(.system(size: 10)).foregroundStyle(.white)
                                        .lineLimit(1).frame(width: 120)
                                    // Fremdriftsstripe per scene
                                    GeometryReader { geo in
                                        let done = scene.frames.filter { $0.frameStatus == "done" }.count
                                        let fraction = scene.frames.isEmpty ? 0
                                            : Double(done) / Double(scene.frames.count)
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(Color.white.opacity(0.1))
                                            Capsule().fill(BoardBrand.accent)
                                                .frame(width: geo.size.width * fraction)
                                        }
                                    }
                                    .frame(width: 120, height: 3)
                                }
                            }
                            .buttonStyle(.plain)
                            if index < hub.scenes.count - 1 {
                                Rectangle().fill(BoardBrand.border)
                                    .frame(width: 26, height: 1.5)
                                    .padding(.bottom, 30)
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
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
        }
    }

    private var infoCard: some View {
        sectionCard(hub.project.name.uppercased()) {
            VStack(alignment: .leading, spacing: 6) {
                infoRow("Manus", hub.manuscript.title)
                infoRow("Scener", "\(hub.scenes.count)")
                infoRow("Shots", "\(hub.allFrames.count)")
                infoRow("Est. lengde", String(format: "%.0f sek", hub.totalSeconds))
                infoRow("Natt / dag", "\(hub.nightCount) / \(hub.allFrames.count - hub.nightCount)")
                if !hub.presentOthers.isEmpty {
                    infoRow("Aktive nå", hub.presentOthers.joined(separator: ", "))
                }
            }
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
