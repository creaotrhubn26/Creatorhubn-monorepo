import SwiftUI

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

    var body: some View {
        NavigationStack {
            content
        }
        .task {
            // Test-harness (samme mønster som web ?token=): sim-launch med
            // SB_TOKEN/SB_SERVER env auto-konfigurerer sync for verifisering.
            let env = ProcessInfo.processInfo.environment
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
            } catch SyncError.unauthenticated {
                KeychainHelper.delete(account: "session-token")
            } catch {}
        }
    }

    private var content: some View {
            List {
                Section("Produksjon") {
                    if sync.isLoggedIn {
                        NavigationLink {
                            ProjectListView()
                        } label: {
                            Label("The Role Room — \(sync.userName)", systemImage: "film.stack")
                        }
                    } else {
                        NavigationLink {
                            LoginView(sync: sync)
                        } label: {
                            Label("Koble til The Role Room", systemImage: "person.crop.circle.badge.plus")
                        }
                    }
                }
                Section("Skisse") {
                    NavigationLink {
                        FreeCanvasView()
                    } label: {
                        Label("Frikanvas", systemImage: "pencil.and.outline")
                    }
                }
            }
            .navigationTitle("Storyboard Studio")
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
