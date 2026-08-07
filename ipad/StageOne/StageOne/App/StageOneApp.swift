import SwiftUI

@main
struct StageOneApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

enum AppMode: String, CaseIterable {
    case studio = "Studio"
    case lights = "Lights"
    case cameras = "Cameras"
    case export = "Export"
}

struct RootView: View {
    @State private var document: SceneDocument
    @State private var mode: AppMode = .studio
    @State private var renderer: StageRenderer?
    @State private var autosaveTask: Task<Void, Never>?
    @State private var sync = CloudSync()
    @State private var showAccount = false

    private static let store = DocumentStore()
    private static let sceneId = "default"

    /// Mtime på lokal scenefil — sammenlignes mot sky-updatedAt (last-write-wins).
    static func localSceneSavedAt() -> Date? {
        let url = store.directory.appendingPathComponent("\(sceneId).stageone.json")
        return (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date
    }

    init() {
        let data = (try? Self.store.load(id: Self.sceneId)) ?? DefaultScene.make()
        _document = State(initialValue: SceneDocument(data: data))
        // QA-hook (samme mønster som Leadgrid): SIMCTL_CHILD_QA_MODE=lights|cameras|export
        if let qa = ProcessInfo.processInfo.environment["QA_MODE"],
           let m = AppMode.allCases.first(where: { $0.rawValue.lowercased() == qa.lowercased() }) {
            _mode = State(initialValue: m)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            TopToolbar(document: document, mode: $mode,
                       accountSymbol: sync.isSignedIn ? "person.crop.circle.badge.checkmark" : "person.crop.circle",
                       onAccountTap: { showAccount = true })
            Rectangle().fill(Theme.border).frame(height: Theme.hairline)
            content
        }
        .background(Theme.bg)
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showAccount) {
            AccountSheet(document: document, sync: sync)
        }
        .onAppear {
            if renderer == nil { renderer = try? StageRenderer() }
        }
        .task {
            // ved oppstart: hent sky-scenen om den er nyere enn lokal fil
            if let remote = await sync.pullIfNewer(localSavedAt: Self.localSceneSavedAt()) {
                document.mutate { $0 = remote }
                document.undoManager.removeAllActions()
            }
        }
        .onChange(of: document.data) {
            scheduleAutosave()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .studio:
            if let renderer {
                StudioScreen(document: document, renderer: renderer, sync: sync)
            } else {
                Text("Metal utilgjengelig")
                    .foregroundStyle(Theme.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        case .lights:
            if let renderer {
                LightsScreen(document: document, renderer: renderer)
            } else {
                StubScreen(mode: mode)
            }
        case .cameras:
            if let renderer {
                CamerasScreen(document: document, renderer: renderer)
            } else {
                StubScreen(mode: mode)
            }
        case .export:
            if let renderer {
                ExportScreen(document: document, renderer: renderer)
            } else {
                StubScreen(mode: mode)
            }
        }
    }

    private func scheduleAutosave() {
        autosaveTask?.cancel()
        let data = document.data
        autosaveTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            try? Self.store.save(data, id: Self.sceneId)
            await sync.push(scene: data) // no-op når utlogget
        }
    }
}
