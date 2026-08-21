import SwiftUI

// Delt penselrad — brukes av både frikanvas og produksjons-tegneskjermen.
struct BrushToolbar: View {
    @ObservedObject var canvasState: CanvasState
    var onExport: (() -> Void)?

    private let brushOptions: [(BrushType, String)] = [
        (.pencil, "Blyant"), (.graphite, "Grafitt"), (.charcoal, "Kull"),
        (.conte, "Conté"), (.pen, "Penn"), (.ink, "Tusj"), (.marker, "Marker"),
        (.eraser, "Viskelær"),
    ]

    var body: some View {
        HStack(spacing: 12) {
            Picker("Pensel", selection: $canvasState.brushType) {
                ForEach(brushOptions, id: \.0) { option in
                    Text(option.1).tag(option.0)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 560)

            Slider(value: $canvasState.brushSize, in: 1...48) {
                Text("Størrelse")
            }
            .frame(width: 160)

            Button { canvasState.undo() } label: {
                Image(systemName: "arrow.uturn.backward")
            }
            Button { canvasState.clear() } label: {
                Image(systemName: "trash")
            }
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

struct ContentView: View {
    @StateObject private var sync = SyncState()

    var body: some View {
        NavigationStack {
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
