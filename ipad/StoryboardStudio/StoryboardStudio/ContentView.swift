import SwiftUI
import UIKit

// Delt penselrad — brukes av både frikanvas og produksjons-tegneskjermen.
struct BrushToolbar: View {
    @ObservedObject var canvasState: CanvasState
    var onExport: (() -> Void)?

    private let brushOptions: [(BrushType, String)] = [
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

    private var colorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: canvasState.brushColor) ?? .black },
            set: { canvasState.brushColor = $0.hexString }
        )
    }

    var body: some View {
        HStack(spacing: 12) {
            // 13 pensler — meny i stedet for segmenter; valg setter
            // spec-defaults via selectBrush.
            Menu {
                ForEach(brushOptions, id: \.0) { option in
                    Button(option.1) { canvasState.selectBrush(option.0) }
                }
            } label: {
                Label(brushOptions.first(where: { $0.0 == canvasState.brushType })?.1 ?? "Pensel",
                      systemImage: "paintbrush.pointed")
                    .font(.subheadline.bold())
            }
            .accessibilityLabel("Penselvalg")
            Button {
                canvasState.colorPickArmed.toggle()
            } label: {
                Image(systemName: "eyedropper")
                    .foregroundStyle(canvasState.colorPickArmed ? Color.purple : Color.secondary)
            }
            .accessibilityLabel("Fargeplukker")
            if canvasState.brushType == .eraser {
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
            .accessibilityLabel("Angre")
            Button { canvasState.clear() } label: {
                Image(systemName: "trash")
            }
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
        #if DEBUG
        if ProcessInfo.processInfo.environment["SB_AI_VIDEO_DEMO"] == "1" {
            AIStoryboardVideoDemoView()
        } else {
            authenticatedRoot
        }
        #else
        authenticatedRoot
        #endif
    }

    private var authenticatedRoot: some View {
        ZStack {
            BoardBrand.chrome.ignoresSafeArea()
            if sync.isLoggedIn {
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
            get: { bootChecked && !sync.isLoggedIn },
            set: { _ in })) {
            RoleRoomLoginModal(sync: sync, showFreeCanvas: $showFreeCanvas)
                .interactiveDismissDisabled(true)
        }
        .fullScreenCover(isPresented: $showFreeCanvas) {
            NavigationStack {
                FreeCanvasView()
                    .toolbar {
                        Button("Lukk") { showFreeCanvas = false }
                    }
            }
        }
        .task {
            // Test-harness (samme mønster som web ?token=): sim-launch med
            // SB_TOKEN/SB_SERVER env auto-konfigurerer sync for verifisering.
            let env = ProcessInfo.processInfo.environment
            defer { bootChecked = true }
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

#if DEBUG
/// Simulator-only inngang for visuell kontroll av AI-video uten ekte token,
/// prosjektdata eller provider-kall. Release-builden kompilerer ikke denne inn.
@MainActor
private struct AIStoryboardVideoDemoView: View {
    @StateObject private var board: BoardState

    private let projectId = "00000000-0000-4000-8000-000000000001"
    private let sceneId = "demo-scene"
    private let frameId = "demo-frame"

    init() {
        let manuscript = ManuscriptSummary(id: "demo-manuscript", title: "TROLL — Manuskript v1")
        let state = BoardState(
            manuscript: manuscript,
            projectId: "00000000-0000-4000-8000-000000000001")
        var frame = FrameSummary(
            id: "demo-frame", shotNumber: "3B", detail: "MCU · Low Angle · Push In",
            strokesJSON: nil,
            description: "Et mørkt troll-omriss speiles i vinduet bak Nora.",
            notes: "Avslør speilingen sent. Behold Nora som tydelig silhuett.",
            shotType: "MCU", lensMm: 50, movement: "Push In",
            durationSec: 4, transition: "Cut", focusDepth: "Dyp",
            timeOfDay: "NATT", weather: "Snøstorm", beatTag: "Varsel",
            tags: ["troll", "mystery"], thumbnailDataURL: nil,
            drawingWidth: 1920, drawingHeight: 1080,
            frameStatus: "planned", comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil,
            perspectiveMode: nil, vanishingPoints: nil, voiceoverDataURL: nil,
            imageUrl: Self.demoImageDataURL(),
            reviewPriority: nil, reviewDueAt: nil,
            reviewApprovedBy: nil, reviewApprovedAt: nil, reviewStarred: nil,
            reviewAssignee: nil, reviewColorLabel: nil, reviewSnoozedUntil: nil)
        frame.imageSource = "ai-generated"
        frame.cameraAngle = "Low Angle"
        frame.lighting = "Varm skjermglød mot kald vindusrefleksjon"
        frame.aiImageVersions = [
            AIImageVersion(
                id: "demo-image-v1", imageURL: frame.imageUrl ?? "",
                prompt: "Production storyboard of Nora and a hidden troll reflection",
                styleID: "story-pencil", generatedAt: "2026-08-25T17:38:00Z",
                revisedPrompt: nil),
        ]
        state.scenes = [
            SceneSummary(
                id: "demo-scene", heading: "SCENE 3 · INT. TOG — NATT",
                frames: [frame], presentationConcept: nil,
                presentationFooter: nil, hubTasks: nil, hubNotes: nil,
                hubQuote: nil, hubMoodboard: nil, hubMapPositions: nil,
                hubMapNotes: nil, hubTeam: nil, hubInfo: nil,
                hubAssetFolders: nil, hubAssetColors: nil,
                sceneNumber: 3, intExt: "INT", location: "Tog gjennom Dovrefjell",
                timeOfDay: "NATT",
                descriptionText: "Nora følger en pulserende rute gjennom Dovrefjell mens tunnelen blir mørk.",
                characters: ["Nora"]),
        ]
        _board = StateObject(wrappedValue: state)
    }

    var body: some View {
        AIStoryboardStudioView(
            board: board,
            projectId: projectId,
            sceneId: sceneId,
            frameId: frameId,
            initialPrompt: "Hold Nora i varm skjermglød; la trollspeilingen bli synlig helt mot slutten av shotet.")
    }

    private static func demoImageDataURL() -> String? {
        let size = CGSize(width: 1280, height: 720)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            let cg = context.cgContext
            let colors = [
                UIColor(red: 0.02, green: 0.05, blue: 0.12, alpha: 1).cgColor,
                UIColor(red: 0.06, green: 0.17, blue: 0.25, alpha: 1).cgColor,
            ] as CFArray
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors,
                locations: [0, 1])!
            cg.drawLinearGradient(
                gradient, start: CGPoint(x: 0, y: 0),
                end: CGPoint(x: 0, y: size.height), options: [])

            UIColor(red: 0.18, green: 0.88, blue: 0.67, alpha: 0.52).setStroke()
            for offset in stride(from: -80.0, through: 240.0, by: 64.0) {
                let ribbon = UIBezierPath()
                ribbon.move(to: CGPoint(x: -40, y: 145 + offset * 0.12))
                ribbon.addCurve(
                    to: CGPoint(x: 1320, y: 105 + offset * 0.18),
                    controlPoint1: CGPoint(x: 320, y: 20 + offset),
                    controlPoint2: CGPoint(x: 810, y: 280 - offset * 0.35))
                ribbon.lineWidth = 22
                ribbon.stroke()
            }

            UIColor(red: 0.015, green: 0.04, blue: 0.065, alpha: 0.9).setFill()
            let mountains = UIBezierPath()
            mountains.move(to: CGPoint(x: 0, y: 430))
            mountains.addLine(to: CGPoint(x: 250, y: 250))
            mountains.addLine(to: CGPoint(x: 475, y: 420))
            mountains.addLine(to: CGPoint(x: 720, y: 285))
            mountains.addLine(to: CGPoint(x: 980, y: 430))
            mountains.addLine(to: CGPoint(x: 1280, y: 320))
            mountains.addLine(to: CGPoint(x: 1280, y: 720))
            mountains.addLine(to: CGPoint(x: 0, y: 720))
            mountains.close()
            mountains.fill()

            UIColor(red: 0.04, green: 0.15, blue: 0.21, alpha: 1).setFill()
            UIBezierPath(rect: CGRect(x: 0, y: 470, width: 1280, height: 250)).fill()
            UIColor(red: 0.15, green: 0.65, blue: 0.57, alpha: 0.23).setStroke()
            for y in stride(from: 500.0, through: 680.0, by: 34.0) {
                let water = UIBezierPath()
                water.move(to: CGPoint(x: 30, y: y))
                water.addLine(to: CGPoint(x: 1250, y: y - 18))
                water.lineWidth = 4
                water.stroke()
            }

            UIColor(red: 0.03, green: 0.025, blue: 0.05, alpha: 1).setFill()
            UIBezierPath(rect: CGRect(x: 690, y: 610, width: 590, height: 110)).fill()
            UIBezierPath(ovalIn: CGRect(x: 846, y: 390, width: 66, height: 66)).fill()
            let person = UIBezierPath(roundedRect: CGRect(x: 824, y: 446, width: 108, height: 218),
                                      cornerRadius: 38)
            person.fill()
            UIColor.white.withAlphaComponent(0.17).setStroke()
            let framing = UIBezierPath(rect: CGRect(x: 42, y: 42, width: 1196, height: 636))
            framing.lineWidth = 3
            framing.stroke()
        }
        guard let data = image.jpegData(compressionQuality: 0.88) else { return nil }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }
}
#endif

// Laster prosjekter og åpner huben direkte — husker siste valg.
struct HubBootView: View {
    @ObservedObject var sync: SyncState
    @State private var project: ProjectSummary?
    @State private var manuscript: ManuscriptSummary?
    @State private var failed = false

    var body: some View {
        Group {
            if let project, let manuscript {
                ProjectHubView(project: project, manuscript: manuscript)
            } else if failed {
                VStack(spacing: 12) {
                    Text("Fant ingen produksjoner")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Opprett en produksjon i The Role Room først.")
                        .font(.system(size: 13)).foregroundStyle(BoardBrand.dim)
                    Button("Prøv igjen") { failed = false; Task { await boot() } }
                        .foregroundStyle(BoardBrand.accent)
                }
            } else {
                ProgressView().tint(.white)
            }
        }
        .task { await boot() }
    }

    private func boot() async {
        guard project == nil else { return }
        guard let projects = try? await RoleRoomAPIClient.shared.fetchProjects(),
              !projects.isEmpty else { failed = true; return }
        let lastProject = UserDefaults.standard.string(forKey: "rr.lastProjectId")
        let chosenProject = projects.first { $0.id == lastProject } ?? projects[0]
        guard let manuscripts = try? await RoleRoomAPIClient.shared
            .fetchManuscripts(projectId: chosenProject.id), !manuscripts.isEmpty else {
            failed = true
            return
        }
        let lastManuscript = UserDefaults.standard.string(forKey: "rr.lastManuscriptId")
        let chosenManuscript = manuscripts.first { $0.id == lastManuscript } ?? manuscripts[0]
        UserDefaults.standard.set(chosenProject.id, forKey: "rr.lastProjectId")
        UserDefaults.standard.set(chosenManuscript.id, forKey: "rr.lastManuscriptId")
        project = chosenProject
        manuscript = chosenManuscript
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
