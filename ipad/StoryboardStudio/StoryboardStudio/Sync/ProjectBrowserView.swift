import SwiftUI

// Fase 2-navigasjon: Logg inn → Prosjekt → Manus → Scene → Frame → Tegn.
// ponytail: token limes inn fra web (Innstillinger → utviklerflyt);
// ASWebAuthenticationSession-OAuth kommer i fase 2b.

@MainActor
final class SyncState: ObservableObject {
    @Published var isLoggedIn = false
    @Published var userName = ""
    @Published var serverURL = UserDefaults.standard.string(forKey: "rr.server") ?? "https://theroleroom.com"
    @Published var errorMessage: String?
}

struct LoginView: View {
    @ObservedObject var sync: SyncState
    @State private var token = ""
    @State private var isWorking = false
    @State private var showAdvanced = false

    private func finishLogin(server: String, sessionToken: String) {
        isWorking = true
        sync.errorMessage = nil
        Task {
            do {
                let name = try await RoleRoomAPIClient.shared.configure(server: server, token: sessionToken)
                UserDefaults.standard.set(server, forKey: "rr.server")
                KeychainHelper.save(sessionToken, account: "session-token")
                sync.userName = name
                sync.isLoggedIn = true
            } catch {
                sync.errorMessage = error.localizedDescription
            }
            isWorking = false
        }
    }

    var body: some View {
        Form {
            Section("The Role Room") {
                TextField("Server", text: $sync.serverURL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
            }
            if let message = sync.errorMessage {
                Text(message).foregroundStyle(.red)
            }
            Section {
                Button {
                    isWorking = true
                    sync.errorMessage = nil
                    let server = sync.serverURL
                    Task {
                        do {
                            let result = try await StoryboardGoogleSignIn.shared.signIn(server: server)
                            finishLogin(server: server, sessionToken: result.token)
                        } catch {
                            sync.errorMessage = error.localizedDescription
                            isWorking = false
                        }
                    }
                } label: {
                    if isWorking { ProgressView() } else { Label("Logg inn med Google", systemImage: "person.badge.key") }
                }
                .disabled(isWorking)
            } footer: {
                Text("Krever eksisterende Role Room-konto.")
            }
            Section("Avansert") {
                Toggle("Bruk sesjon-token direkte", isOn: $showAdvanced)
                if showAdvanced {
                    SecureField("Sesjon-token", text: $token)
                    Button("Koble til med token") {
                        finishLogin(server: sync.serverURL, sessionToken: token)
                    }
                    .disabled(token.isEmpty || isWorking)
                }
            }
        }
        .navigationTitle("Koble til produksjonen")
    }
}

@MainActor
struct ProductionBrowserView: View {
    let showsCloseButton: Bool
    let onSelect: (ProjectSummary, ManuscriptSummary) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var projects: [ProjectSummary] = []
    @State private var manuscriptsByProject: [String: [ManuscriptSummary]] = [:]
    @State private var projectErrors: [String: String] = [:]
    @State private var creatingProjectID: String?
    @State private var isLoading = true
    @State private var errorMessage: String?

    init(
        showsCloseButton: Bool = false,
        onSelect: @escaping (ProjectSummary, ManuscriptSummary) -> Void
    ) {
        self.showsCloseButton = showsCloseButton
        self.onSelect = onSelect
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BoardBrand.chrome.ignoresSafeArea()
                content
            }
            .navigationTitle("Produksjoner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if showsCloseButton {
                        Button("Lukk") { dismiss() }
                            .foregroundStyle(BoardBrand.accent)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await load() }
                    } label: {
                        Label("Oppdater", systemImage: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                    .foregroundStyle(BoardBrand.accent)
                }
            }
        }
        .task {
            if projects.isEmpty {
                await load()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && projects.isEmpty {
            VStack(spacing: 12) {
                ProgressView().tint(.white)
                Text("Henter produksjonene dine …")
                    .font(.system(size: 13))
                    .foregroundStyle(BoardBrand.dim)
            }
        } else if projects.isEmpty {
            VStack(spacing: 14) {
                Image(systemName: "rectangle.stack.badge.plus")
                    .font(.system(size: 34))
                    .foregroundStyle(BoardBrand.accent)
                Text("Ingen produksjoner ennå")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Text(errorMessage ?? "Opprett en produksjon på theroleroom.com, og trykk Oppdater.")
                    .font(.system(size: 13))
                    .foregroundStyle(BoardBrand.dim)
                    .multilineTextAlignment(.center)
                Button("Prøv igjen") {
                    Task { await load() }
                }
                .buttonStyle(.borderedProminent)
                .tint(BoardBrand.accent)
            }
            .padding(28)
        } else {
            ScrollView {
                LazyVStack(spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("VELG PRODUKSJON")
                                .font(.system(size: 10, weight: .bold))
                                .kerning(1.2)
                                .foregroundStyle(BoardBrand.label)
                            Text("\(projects.count) prosjekter fra The Role Room")
                                .font(.system(size: 13))
                                .foregroundStyle(BoardBrand.dim)
                        }
                        Spacer()
                    }
                    .padding(.bottom, 4)

                    ForEach(projects) { project in
                        projectCard(project)
                    }
                }
                .padding(22)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func projectCard(_ project: ProjectSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 9)
                    .fill(BoardBrand.accent.opacity(0.16))
                    .frame(width: 42, height: 42)
                    .overlay {
                        Image(systemName: "film.stack")
                            .foregroundStyle(BoardBrand.accent)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                    Text(project.id)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(BoardBrand.label)
                        .lineLimit(1)
                }
                Spacer()
            }

            if let manuscripts = manuscriptsByProject[project.id] {
                if manuscripts.isEmpty {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Prosjektet har ikke manus ennå.")
                            .font(.system(size: 12))
                            .foregroundStyle(BoardBrand.dim)
                        Button {
                            Task { await createManuscript(for: project) }
                        } label: {
                            HStack {
                                if creatingProjectID == project.id {
                                    ProgressView().tint(.black)
                                } else {
                                    Image(systemName: "doc.badge.plus")
                                }
                                Text("Opprett storyboard-manus")
                            }
                            .font(.system(size: 12, weight: .semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(BoardBrand.accent)
                        .disabled(creatingProjectID != nil)
                        .accessibilityLabel("Opprett storyboard-manus for \(project.name)")
                    }
                } else {
                    ForEach(manuscripts) { manuscript in
                        Button {
                            select(project: project, manuscript: manuscript)
                        } label: {
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundStyle(BoardBrand.accent)
                                Text(manuscript.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.white)
                                Spacer()
                                Text("Åpne")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(BoardBrand.accent)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(BoardBrand.label)
                            }
                            .padding(11)
                            .background(Color.white.opacity(0.045),
                                        in: RoundedRectangle(cornerRadius: 9))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Åpne \(project.name), \(manuscript.title)")
                    }
                }
            } else if let message = projectErrors[project.id] {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Kunne ikke hente manus")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.orange)
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundStyle(BoardBrand.dim)
                }
            } else {
                ProgressView().tint(BoardBrand.accent)
            }
        }
        .padding(16)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .stroke(BoardBrand.border)
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        projectErrors = [:]
        do {
            let fetched = try await RoleRoomAPIClient.shared.fetchProjects()
            projects = fetched
            manuscriptsByProject = [:]
            for project in fetched {
                do {
                    manuscriptsByProject[project.id] = try await RoleRoomAPIClient.shared
                        .fetchManuscripts(projectId: project.id)
                } catch {
                    projectErrors[project.id] = error.localizedDescription
                }
            }
        } catch {
            projects = []
            manuscriptsByProject = [:]
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func createManuscript(for project: ProjectSummary) async {
        creatingProjectID = project.id
        projectErrors[project.id] = nil
        do {
            let manuscript = try await RoleRoomAPIClient.shared.createManuscript(
                projectId: project.id,
                title: "\(project.name) — Storyboard")
            manuscriptsByProject[project.id] = [manuscript]
            select(project: project, manuscript: manuscript)
        } catch {
            projectErrors[project.id] = error.localizedDescription
        }
        creatingProjectID = nil
    }

    private func select(project: ProjectSummary, manuscript: ManuscriptSummary) {
        UserDefaults.standard.set(project.id, forKey: "rr.lastProjectId")
        UserDefaults.standard.set(manuscript.id, forKey: "rr.lastManuscriptId")
        onSelect(project, manuscript)
        if showsCloseButton {
            dismiss()
        }
    }
}

struct ProjectListView: View {
    @State private var projects: [ProjectSummary] = []
    @State private var error: String?
    @State private var openTasks: [(project: String, text: String)] = []
    @State private var inbox: [(project: String, role: String, text: String)] = []

    var body: some View {
        List {
            Section("Produksjoner") {
                ForEach(projects) { project in
                    NavigationLink(project.name) {
                        ManuscriptListView(project: project)
                    }
                }
            }
            // «Mine oppgaver» og «Innboks» på tvers av produksjonene —
            // aggregert fra hub-oppgavene og review-kommentarene.
            if !openTasks.isEmpty {
                Section("Mine oppgaver · \(openTasks.count)") {
                    ForEach(Array(openTasks.prefix(8).enumerated()), id: \.offset) { _, task in
                        HStack {
                            Image(systemName: "square")
                                .font(.system(size: 12)).foregroundStyle(.secondary)
                            Text(task.text).font(.subheadline)
                            Spacer()
                            Text(task.project).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if !inbox.isEmpty {
                Section("Innboks · siste kommentarer") {
                    ForEach(Array(inbox.prefix(6).enumerated()), id: \.offset) { _, entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(entry.role) · \(entry.project)")
                                .font(.caption.bold()).foregroundStyle(.secondary)
                            Text(entry.text).font(.subheadline).lineLimit(2)
                        }
                    }
                }
            }
        }
        .overlay {
            if let error { Text(error).foregroundStyle(.red) }
            else if projects.isEmpty { ProgressView() }
        }
        .navigationTitle("Produksjoner")
        .task {
            do { projects = try await RoleRoomAPIClient.shared.fetchProjects() }
            catch { self.error = error.localizedDescription }
            await loadOverview()
        }
    }

    /// Aggregat på tvers: én manus+scene-henting per prosjekt (få
    /// produksjoner i praksis; ETag gjør gjenbesøk billige).
    private func loadOverview() async {
        var tasks: [(String, String)] = []
        var comments: [(String, String, String, String)] = []   // (at, project, role, text)
        for project in projects {
            guard let manuscripts = try? await RoleRoomAPIClient.shared
                .fetchManuscripts(projectId: project.id),
                  let manuscript = manuscripts.first,
                  let scenes = try? await RoleRoomAPIClient.shared
                .fetchScenes(manuscriptId: manuscript.id) else { continue }
            for task in HubState.decodeTasks(scenes.first?.hubTasks) where !task.done {
                tasks.append((project.name, task.text))
            }
            for scene in scenes {
                for frame in scene.frames {
                    for comment in frame.comments {
                        comments.append((comment.at, project.name, comment.role, comment.text))
                    }
                }
            }
        }
        openTasks = tasks.map { (project: $0.0, text: $0.1) }
        inbox = comments.sorted { $0.0 > $1.0 }
            .map { (project: $0.1, role: $0.2, text: $0.3) }
    }
}

struct ManuscriptListView: View {
    let project: ProjectSummary
    @State private var manuscripts: [ManuscriptSummary] = []
    @State private var error: String?

    var body: some View {
        List(manuscripts) { manuscript in
            NavigationLink(manuscript.title) {
                ProjectHubView(project: project, manuscript: manuscript)
            }
        }
        .overlay {
            if let error { Text(error).foregroundStyle(.red) }
            else if manuscripts.isEmpty { ProgressView() }
        }
        .navigationTitle(project.name)
        .task {
            do { manuscripts = try await RoleRoomAPIClient.shared.fetchManuscripts(projectId: project.id) }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct SceneListView: View {
    let manuscript: ManuscriptSummary
    @State private var scenes: [SceneSummary] = []
    @State private var error: String?

    var body: some View {
        List(scenes) { scene in
            Section(scene.heading) {
                ForEach(scene.frames) { frame in
                    NavigationLink {
                        FrameDrawingScreen(manuscriptId: manuscript.id, sceneId: scene.id, frame: frame)
                    } label: {
                        HStack {
                            Text(frame.shotNumber)
                                .font(.system(.subheadline, design: .monospaced).bold())
                            Text(frame.detail)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Spacer()
                            if frame.strokesJSON?.isEmpty == false {
                                Image(systemName: "pencil.and.outline")
                                    .foregroundStyle(.purple)
                            }
                        }
                    }
                }
            }
        }
        .overlay {
            if let error { Text(error).foregroundStyle(.red) }
            else if scenes.isEmpty { ProgressView() }
        }
        .navigationTitle(manuscript.title)
        .task {
            do { scenes = try await RoleRoomAPIClient.shared.fetchScenes(manuscriptId: manuscript.id) }
            catch { self.error = error.localizedDescription }
        }
    }
}

// Tegneskjerm koblet til én frame: laster strokes fra sync, lagrer tilbake.
struct FrameDrawingScreen: View {
    let manuscriptId: String
    let sceneId: String
    let frame: FrameSummary

    @StateObject private var canvasState = CanvasState()
    @State private var renderer = MetalStrokeRenderer()
    @State private var status: String?
    @State private var isSaving = false
    @State private var baseUpdatedAt: String?
    @State private var baseStrokesJSON: String?
    @State private var baseLayerState: BoardLayerState?
    @State private var baseShotFraming: ShotFramingState?

    var body: some View {
        VStack(spacing: 0) {
            if renderer != nil {
                PencilCanvasView(state: canvasState, renderer: renderer)
            } else {
                ContentUnavailableView("Metal utilgjengelig", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle("Shot \(frame.shotNumber)")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let status { Text(status).font(.caption).foregroundStyle(.secondary) }
                Button {
                    guard !isSaving,
                          let json = try? StrokeSerialization.encodeToWebJSON(
                            canvasState.strokes) else { return }
                    let thumbnail = renderer?.thumbnailDataURL(
                        framing: canvasState.shotFraming)
                    let layers = canvasState.layerState
                    let framing = canvasState.shotFraming
                    let expectedUpdatedAt = baseUpdatedAt
                    let mergeBase = baseStrokesJSON
                    let layerBase = baseLayerState
                    let framingBase = baseShotFraming
                    isSaving = true
                    status = nil
                    Task {
                        do {
                            let saved = try await RoleRoomAPIClient.shared.saveFrameStrokes(
                                manuscriptId: manuscriptId,
                                sceneId: sceneId,
                                frameId: frame.id,
                                strokesJSON: json,
                                thumbnailDataURL: thumbnail,
                                baseUpdatedAt: expectedUpdatedAt,
                                layerState: layers,
                                shotFraming: framing,
                                baseStrokesJSON: mergeBase,
                                baseLayerState: layerBase,
                                baseShotFraming: framingBase
                            )
                            baseUpdatedAt = saved.updatedAt ?? expectedUpdatedAt
                            baseStrokesJSON = saved.strokesJSON ?? json
                            let authoritativeLayers = saved.layerState ?? layers
                            let authoritativeFraming = saved.shotFraming ?? framing
                            baseLayerState = authoritativeLayers
                            baseShotFraming = authoritativeFraming
                            if canvasState.layerState == layers {
                                canvasState.applyLayerState(authoritativeLayers)
                            }
                            if canvasState.shotFraming == framing {
                                canvasState.shotFraming = authoritativeFraming
                            }
                            status = "Synket ✓"
                        } catch {
                            status = error.localizedDescription
                        }
                        isSaving = false
                    }
                } label: {
                    if isSaving { ProgressView() } else { Label("Synk", systemImage: "icloud.and.arrow.up") }
                }
                .disabled(isSaving)
            }
        }
        .onAppear {
            canvasState.contentSize = CGSize(
                width: max(1, frame.drawingWidth),
                height: max(1, frame.drawingHeight))
            if let json = frame.strokesJSON,
               let strokes = try? StrokeSerialization.decodeFromWebJSON(json) {
                canvasState.strokes = strokes
            }
            canvasState.beginHistory(
                frameId: frame.id, layerState: frame.layerState,
                shotFraming: frame.shotFraming ?? ShotFramingState(
                    shotSize: frame.shotType, angle: frame.angle,
                    lensMm: frame.lensMm,
                    aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)))
            canvasState.revision += 1
            baseUpdatedAt = frame.updatedAt
            baseStrokesJSON = frame.strokesJSON
            baseLayerState = canvasState.layerState
            baseShotFraming = canvasState.shotFraming
        }
    }
}
