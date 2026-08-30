import SwiftUI

// Delt penselrad — brukes av både frikanvas og produksjons-tegneskjermen.
struct BrushToolbar: View {
    @ObservedObject var canvasState: CanvasState
    var onExport: (() -> Void)?
    @State private var showBrushPicker = false
    @State private var showBrushEditor = false

    private var brushOptions: [(BrushType, String)] {
        BrushCatalog.all.map { ($0, BrushCatalog.displayName($0)) }
    }

    private var colorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: canvasState.brushColor) ?? .black },
            set: { canvasState.brushColor = $0.hexString }
        )
    }

    var body: some View {
        HStack(spacing: 12) {
            // Hele katalogen er større enn det iOS Menu kan vise på iPad.
            // En scrollbar popover gjør samtlige kategorier og pensler
            // tilgjengelige uten at de siste seksjonene klippes bort.
            Button {
                showBrushPicker = true
            } label: {
                Label(brushOptions.first(where: { $0.0 == canvasState.brushType })?.1 ?? "Pensel",
                      systemImage: "paintbrush.pointed")
                    .font(.subheadline.bold())
            }
            .accessibilityLabel("Penselvalg")
            .popover(isPresented: $showBrushPicker, arrowEdge: .top) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(BrushCatalog.sections, id: \.category) { section in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(section.title.uppercased())
                                    .font(.caption2.bold())
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 12)

                                ForEach(section.brushes, id: \.self) { type in
                                    Button {
                                        canvasState.selectBrush(type)
                                        showBrushPicker = false
                                    } label: {
                                        HStack(spacing: 10) {
                                            Image(systemName: type == canvasState.brushType
                                                  ? "checkmark.circle.fill"
                                                  : "circle")
                                                .foregroundStyle(type == canvasState.brushType
                                                                 ? Color.purple
                                                                 : Color.secondary)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(BrushCatalog.displayName(type))
                                                    .font(.subheadline.weight(.semibold))
                                                Text(BrushDefaults.describe(type))
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                                    .lineLimit(2)
                                            }
                                            Spacer(minLength: 8)
                                        }
                                        .contentShape(Rectangle())
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel(BrushCatalog.displayName(type))
                                }
                            }
                        }
                    }
                    .padding(.vertical, 14)
                }
                .frame(width: 390, height: 620)
                .presentationCompactAdaptation(.sheet)
            }
            if canvasState.brushType.isProductionStamp {
                Button {
                    showBrushEditor = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("Stamp Inspector")
            }
            Button {
                canvasState.colorPickArmed.toggle()
            } label: {
                Image(systemName: "eyedropper")
                    .foregroundStyle(canvasState.colorPickArmed ? Color.purple : Color.secondary)
            }
            .accessibilityLabel("Fargeplukker")
            if canvasState.brushType == .eraser || canvasState.brushType == .vinyl {
                Button {
                    canvasState.eraserObjectMode.toggle()
                } label: {
                    Image(systemName: "scissors")
                        .foregroundStyle(canvasState.eraserObjectMode ? Color.purple : Color.secondary)
                }
                .accessibilityLabel("Strøk-viskelær")
            }

            ColorPicker("Farge", selection: colorBinding, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 44)

            Slider(value: $canvasState.brushSize, in: 1...120) {
                Text("Størrelse")
            }
            .frame(width: 160)

            Button { canvasState.undo() } label: {
                Image(systemName: "arrow.uturn.backward")
            }
            .disabled(canvasState.undoStack.isEmpty)
            .accessibilityLabel("Angre")
            .accessibilityHint("To fingre på tegneflaten eller Kommando-Z")
            .keyboardShortcut("z", modifiers: .command)
            Button { canvasState.redo() } label: {
                Image(systemName: "arrow.uturn.forward")
            }
            .disabled(canvasState.redoStack.isEmpty)
            .accessibilityLabel("Gjenta")
            .accessibilityHint("Tre fingre på tegneflaten eller Skift-Kommando-Z")
            .keyboardShortcut("z", modifiers: [.command, .shift])
            Button { canvasState.clear() } label: {
                Image(systemName: "trash")
            }
            .disabled(canvasState.strokes.isEmpty)
            .accessibilityLabel("Tøm")
            if let onExport {
                Button(action: onExport) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Eksporter strokes-JSON")
            }

            Text("\(canvasState.strokes.count) strøk")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
        .sheet(isPresented: $showBrushEditor) {
            BrushEditorSheet(canvasState: canvasState)
                .presentationDetents([.medium, .large])
        }
    }
}

// Hex ↔ Color for ColorPicker (strokes lagrer web-hex).
extension Color {
    init?(hex: String) {
        var value: UInt64 = 0
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard cleaned.count == 6, Scanner(string: cleaned).scanHexInt64(&value) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255)
    }

    var hexString: String {
        let components = UIColor(self).cgColor.components ?? [0, 0, 0, 1]
        let red = components.count > 0 ? components[0] : 0
        let green = components.count > 1 ? components[1] : red
        let blue = components.count > 2 ? components[2] : red
        return String(format: "#%02x%02x%02x",
                      Int((red * 255).rounded()),
                      Int((green * 255).rounded()),
                      Int((blue * 255).rounded()))
    }
}

struct ContentView: View {
    @StateObject private var sync = SyncState()
    @State private var bootChecked = false
    @State private var showFreeCanvas = false

    var body: some View {
        ZStack {
            BoardBrand.chrome.ignoresSafeArea()
            if StoryboardSampleProject.isEnabled {
                NavigationStack {
                    NativeBoardView(
                        manuscript: StoryboardSampleProject.manuscript,
                        projectId: nil,
                        sampleScenes: StoryboardSampleProject.scenes)
                }
                .accessibilityIdentifier("sample-production-board")
            } else if sync.isLoggedIn {
                // Rett inn i produksjons-huben — ingen mellomskjermer.
                HubBootView(sync: sync)
            } else {
                // Splash bak login-modalen.
                VStack(spacing: 14) {
                    Image("AppIcon-Splash")
                        .resizable().scaledToFit()
                        .frame(width: 120, height: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 26))
                    Text("Storyboard Room")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { !StoryboardSampleProject.isEnabled && bootChecked && !sync.isLoggedIn },
            set: { _ in })) {
            RoleRoomLoginModal(sync: sync, showFreeCanvas: $showFreeCanvas)
                .interactiveDismissDisabled(true)
                // Coveret må presenteres fra den aktive sheet-hierarkien.
                // Et cover på ContentView ligger bak login-sheeten og blir
                // derfor aldri synlig selv om bindingen endres.
                .fullScreenCover(isPresented: $showFreeCanvas) {
                    NavigationStack {
                        FreeCanvasView()
                            .toolbar {
                                Button("Lukk") { showFreeCanvas = false }
                            }
                    }
                }
        }
        .task {
            guard !StoryboardSampleProject.isEnabled else { return }
            // Test-harness (samme mønster som web ?token=): sim-launch med
            // SB_TOKEN/SB_SERVER env auto-konfigurerer sync for verifisering.
            let env = ProcessInfo.processInfo.environment
            defer { bootChecked = true }
            // UI-testene skal ikke bruke eller mutere en virkelig Role Room-
            // sesjon. Dette deaktiverer kun automatisk Keychain-innlogging;
            // login-modalen og dens lokale Frikanvas åpnes på vanlig måte.
            guard env["SB_UI_TEST_DISABLE_KEYCHAIN"] != "1" else { return }
            guard !sync.isLoggedIn else { return }
            // Env-token (sim-verifisering) vinner; ellers Keychain (vanlig
            // app-restart — innloggingen skal overleve).
            let token = env["SB_TOKEN"] ?? KeychainHelper.load(account: "session-token")
            guard let token else { return }
            let server = env["SB_SERVER"] ?? sync.serverURL
            do {
                let name = try await RoleRoomAPIClient.shared.configure(server: server, token: token)
                sync.userName = name
                sync.isLoggedIn = true
                PushDelegate.requestAuthorizationAndRegister()
                let unread = await RoleRoomAPIClient.shared.fetchUnreadMentions(name: name)
                UserDefaults.standard.set(unread, forKey: "sbMentionCount")
            } catch SyncError.unauthenticated {
                KeychainHelper.delete(account: "session-token")
            } catch {}
        }
    }
}

// Laster prosjekter og åpner huben direkte — husker siste valg.
struct HubBootView: View {
    @ObservedObject var sync: SyncState
    @State private var project: ProjectSummary?
    @State private var manuscript: ManuscriptSummary?
    @State private var isBooting = true
    @State private var showProjectBrowser = false

    var body: some View {
        Group {
            if let project, let manuscript {
                ProjectHubView(
                    project: project,
                    manuscript: manuscript,
                    onBrowseProjects: { showProjectBrowser = true })
                    .id("\(project.id):\(manuscript.id)")
            } else if isBooting {
                VStack(spacing: 12) {
                    ProgressView().tint(.white)
                    Text("Henter produksjonene dine …")
                        .font(.system(size: 13))
                        .foregroundStyle(BoardBrand.dim)
                }
            } else {
                ProductionBrowserView(onSelect: select)
            }
        }
        .sheet(isPresented: $showProjectBrowser) {
            ProductionBrowserView(
                showsCloseButton: true,
                onSelect: { selectedProject, selectedManuscript in
                    select(selectedProject, selectedManuscript)
                    showProjectBrowser = false
                })
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .task { await boot() }
    }

    private func select(_ selectedProject: ProjectSummary, _ selectedManuscript: ManuscriptSummary) {
        UserDefaults.standard.set(selectedProject.id, forKey: "rr.lastProjectId")
        UserDefaults.standard.set(selectedManuscript.id, forKey: "rr.lastManuscriptId")
        project = selectedProject
        manuscript = selectedManuscript
        isBooting = false
    }

    private func boot() async {
        guard project == nil else { return }
        defer { isBooting = false }
        guard let projects = try? await RoleRoomAPIClient.shared.fetchProjects(),
              !projects.isEmpty else { return }

        let lastProjectID = UserDefaults.standard.string(forKey: "rr.lastProjectId")
        let orderedProjects = projects.sorted { lhs, rhs in
            if lhs.id == lastProjectID { return true }
            if rhs.id == lastProjectID { return false }
            return false
        }
        let lastManuscriptID = UserDefaults.standard.string(forKey: "rr.lastManuscriptId")
        for candidate in orderedProjects {
            guard let manuscripts = try? await RoleRoomAPIClient.shared
                .fetchManuscripts(projectId: candidate.id),
                  !manuscripts.isEmpty else { continue }
            let chosen = manuscripts.first { $0.id == lastManuscriptID } ?? manuscripts[0]
            select(candidate, chosen)
            return
        }
    }
}

// Login-modal i Role Room-stil (som theroleroom.com): mørkt kort,
// Google-innlogging som primærhandling, token bak «Avansert».
struct RoleRoomLoginModal: View {
    @ObservedObject var sync: SyncState
    @Binding var showFreeCanvas: Bool
    @State private var isWorking = false
    @State private var showAdvanced = false
    @State private var token = ""

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 18) {
                Image("AppIcon-Splash")
                    .resizable().scaledToFit()
                    .frame(width: 74, height: 74)
                    .clipShape(RoundedRectangle(cornerRadius: 17))
                VStack(spacing: 6) {
                    Text("Velkommen til Storyboard Room")
                        .font(.system(size: 21, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Logg inn med Role Room-kontoen din for å åpne produksjonene dine.")
                        .font(.system(size: 13))
                        .foregroundStyle(BoardBrand.dim)
                        .multilineTextAlignment(.center)
                }
                if let message = sync.errorMessage {
                    Text(message)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                Button {
                    isWorking = true
                    sync.errorMessage = nil
                    let server = sync.serverURL
                    Task {
                        do {
                            let result = try await StoryboardGoogleSignIn.shared.signIn(server: server)
                            await finishLogin(server: server, sessionToken: result.token)
                        } catch {
                            sync.errorMessage = error.localizedDescription
                        }
                        isWorking = false
                    }
                } label: {
                    HStack(spacing: 8) {
                        if isWorking {
                            ProgressView().tint(.black)
                        } else {
                            Image(systemName: "person.badge.key.fill")
                        }
                        Text("Logg inn med Google")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(isWorking)
                Text("Krever eksisterende Role Room-konto.")
                    .font(.system(size: 11)).foregroundStyle(BoardBrand.label)

                DisclosureGroup(isExpanded: $showAdvanced) {
                    VStack(spacing: 8) {
                        TextField("Server", text: $sync.serverURL)
                            .textContentType(.URL)
                            .textInputAutocapitalization(.never)
                        SecureField("Sesjon-token", text: $token)
                        Button("Koble til med token") {
                            let server = sync.serverURL
                            let sessionToken = token
                            Task { await finishLogin(server: server, sessionToken: sessionToken) }
                        }
                        .disabled(token.isEmpty || isWorking)
                        .foregroundStyle(BoardBrand.accent)
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .padding(.top, 6)
                } label: {
                    Text("Avansert")
                        .font(.system(size: 12)).foregroundStyle(BoardBrand.label)
                }
            }
            .padding(28)
            Spacer()
            Button {
                showFreeCanvas = true
            } label: {
                Label("Tegn uten prosjekt — Frikanvas", systemImage: "pencil.and.outline")
                    .font(.system(size: 12))
                    .foregroundStyle(BoardBrand.dim)
            }
            .accessibilityIdentifier("open-free-canvas")
            .buttonStyle(.plain)
            .padding(.bottom, 22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(BoardBrand.chrome)
        .presentationDetents([.medium])
    }

    private func finishLogin(server: String, sessionToken: String) async {
        isWorking = true
        do {
            let name = try await RoleRoomAPIClient.shared.configure(server: server, token: sessionToken)
            UserDefaults.standard.set(server, forKey: "rr.server")
            KeychainHelper.save(sessionToken, account: "session-token")
            sync.userName = name
            sync.isLoggedIn = true
            PushDelegate.requestAuthorizationAndRegister()
        } catch {
            sync.errorMessage = error.localizedDescription
        }
        isWorking = false
    }
}

struct FreeCanvasView: View {
    @StateObject private var canvasState = CanvasState()
    @State private var renderer = MetalStrokeRenderer()
    @State private var showExport = false

    var body: some View {
        VStack(spacing: 0) {
            BrushToolbar(canvasState: canvasState, onExport: { showExport = true })
            if renderer != nil {
                PencilCanvasView(state: canvasState, renderer: renderer)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                ContentUnavailableView("Metal utilgjengelig",
                                       systemImage: "exclamationmark.triangle",
                                       description: Text("Enheten støtter ikke Metal-rendering."))
            }
        }
        .sheet(isPresented: $showExport) {
            ScrollView {
                Text(canvasState.exportWebJSON())
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                    .padding()
            }
            .presentationDetents([.medium, .large])
        }
    }
}
