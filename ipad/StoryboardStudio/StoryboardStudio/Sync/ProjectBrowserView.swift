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
                    isSaving = true
                    status = nil
                    Task {
                        do {
                            let json = try StrokeSerialization.encodeToWebJSON(canvasState.strokes)
                            try await RoleRoomAPIClient.shared.saveFrameStrokes(
                                manuscriptId: manuscriptId,
                                sceneId: sceneId,
                                frameId: frame.id,
                                strokesJSON: json
                            )
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
            if let json = frame.strokesJSON,
               let strokes = try? StrokeSerialization.decodeFromWebJSON(json) {
                canvasState.strokes = strokes
            }
        }
    }
}
