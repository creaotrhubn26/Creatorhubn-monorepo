import SwiftUI
import RoomPlan

/// RoomPlan-skann → «Scanned Room»-gruppe i scenen. Kun LiDAR-iPad.
struct RoomScanSheet: View {
    let document: SceneDocument
    @Environment(\.dismiss) private var dismiss
    @State private var finished = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if RoomCaptureSession.isSupported {
                RoomCaptureContainer { room in
                    importRoom(room)
                    dismiss()
                }
                .ignoresSafeArea()
                closeButton.padding(16)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "viewfinder")
                        .font(.system(size: 30))
                        .foregroundStyle(Theme.muted)
                    Text("Rom-skann krever LiDAR-iPad")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.fg)
                    Text("Denne enheten (eller simulatoren) støtter ikke RoomPlan.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                    closeButton.padding(.top, 8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.bg)
            }
        }
    }

    private var closeButton: some View {
        Button { dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.fg)
                .frame(width: 34, height: 34)
                .background(Circle().fill(Theme.surface.opacity(0.9)))
        }
        .buttonStyle(.plain)
    }

    private func importRoom(_ room: CapturedRoom) {
        let surfaces = Self.surfaces(from: room)
        let nodes = RoomScanImporter.nodes(from: surfaces)
        document.mutate { RoomScanImporter.apply(nodes: nodes, to: &$0) }
    }

    /// Tynt uttrekk CapturedRoom → rene structs (logikken bor i RoomScanImporter).
    static func surfaces(from room: CapturedRoom) -> [ScannedSurface] {
        var result: [ScannedSurface] = []
        func kindOf(_ category: CapturedRoom.Surface.Category) -> ScannedSurface.Kind {
            switch category {
            case .wall: .wall
            case .door: .door
            case .window: .window
            case .opening: .opening
            case .floor: .floor
            @unknown default: .wall
            }
        }
        for surface in room.walls + room.doors + room.windows + room.openings + room.floors {
            result.append(ScannedSurface(kind: kindOf(surface.category),
                                         dimensions: surface.dimensions,
                                         transform: surface.transform))
        }
        for object in room.objects {
            result.append(ScannedSurface(kind: .object,
                                         dimensions: object.dimensions,
                                         transform: object.transform))
        }
        return result
    }
}

/// RoomCaptureView-wrapper: kjører økten, kaller `onFinished` når brukeren
/// avslutter med ferdig prosessert rom.
private struct RoomCaptureContainer: UIViewRepresentable {
    let onFinished: @MainActor (CapturedRoom) -> Void

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        view.delegate = context.coordinator
        view.captureSession.run(configuration: RoomCaptureSession.Configuration())
        return view
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinished: onFinished) }

    // RoomCaptureViewDelegate arver NSCoding — tomme stubs + stabilt objc-navn.
    // RoomCaptureView kaller delegaten på main-tråden — @preconcurrency-konformans
    // lar klassen være MainActor under Swift 6 strict concurrency.
    @objc(StageOneRoomCaptureCoordinator)
    @MainActor
    final class Coordinator: NSObject, @preconcurrency RoomCaptureViewDelegate {
        let onFinished: @MainActor (CapturedRoom) -> Void
        init(onFinished: @escaping @MainActor (CapturedRoom) -> Void) { self.onFinished = onFinished }

        required init?(coder: NSCoder) { return nil }
        func encode(with coder: NSCoder) {}

        func captureView(shouldPresent roomDataForProcessing: CapturedRoomData,
                         error: (Error)?) -> Bool { true }

        func captureView(didPresent processedResult: CapturedRoom, error: (Error)?) {
            guard error == nil else { return }
            onFinished(processedResult)
        }
    }
}
