import SwiftUI
import ARKit
import RealityKit

/// AR-preview: plasser studioet på gulvet. Tap = plasser/flytt, pinch = skaler,
/// roter m/ to fingre. Krever ekte enhet (ARWorldTracking).
struct ARPreviewSheet: View {
    let document: SceneDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if ARWorldTrackingConfiguration.isSupported {
                ARSceneContainer(scene: document.data)
                    .ignoresSafeArea()
                VStack(alignment: .trailing, spacing: 8) {
                    closeButton
                    Text("Tap gulvet for å plassere · pinch skalerer")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.fg)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Theme.surface.opacity(0.85)))
                }
                .padding(16)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "arkit")
                        .font(.system(size: 30))
                        .foregroundStyle(Theme.muted)
                    Text("AR krever en ekte iPad")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.fg)
                    Text("Simulatoren har ikke kamera/ARKit.")
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
}

private struct ARSceneContainer: UIViewRepresentable {
    let scene: SceneData

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal]
        view.session.run(config)
        context.coordinator.arView = view
        context.coordinator.scene = scene

        let tap = UITapGestureRecognizer(target: context.coordinator,
                                         action: #selector(Coordinator.handleTap(_:)))
        view.addGestureRecognizer(tap)
        let pinch = UIPinchGestureRecognizer(target: context.coordinator,
                                             action: #selector(Coordinator.handlePinch(_:)))
        view.addGestureRecognizer(pinch)
        return view
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.scene = scene
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    @MainActor
    final class Coordinator: NSObject {
        weak var arView: ARView?
        var scene: SceneData?
        private var anchor: AnchorEntity?
        private var baseScale: Float = 0.1

        @objc func handleTap(_ g: UITapGestureRecognizer) {
            guard let view = arView, let scene else { return }
            let point = g.location(in: view)
            guard let hit = view.raycast(from: point, allowing: .estimatedPlane,
                                         alignment: .horizontal).first else { return }
            anchor?.removeFromParent()
            let newAnchor = AnchorEntity(world: hit.worldTransform)
            newAnchor.addChild(RealityScene.makeRoot(scene: scene, scale: baseScale))
            view.scene.addAnchor(newAnchor)
            anchor = newAnchor
        }

        @objc func handlePinch(_ g: UIPinchGestureRecognizer) {
            switch g.state {
            case .changed:
                guard let anchor else { return }
                let s = baseScale * Float(g.scale)
                anchor.children.first?.scale = SIMD3<Float>(repeating: min(max(s, 0.02), 1.0))
            case .ended, .cancelled, .failed:
                // synk alltid — ellers hopper neste plassering tilbake til gammel skala
                baseScale = anchor?.children.first?.scale.x ?? baseScale
            default:
                break
            }
        }
    }
}
