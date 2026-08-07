import SwiftUI
import MetalKit

/// Gestless live-tile: rendrer scenen fra en gitt kamera-node via delt renderer.
/// Brukes av Cameras-skjermen (program/preview/multicam) og fase 3-preview.
struct CameraTileView: UIViewRepresentable {
    let document: SceneDocument
    let renderer: StageRenderer
    let cameraNodeId: String
    var fps: Int = 30

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = renderer.device
        view.colorPixelFormat = StageRenderer.colorFormat
        view.depthStencilPixelFormat = StageRenderer.depthFormat
        view.clearColor = StageRenderer.clearColor
        view.preferredFramesPerSecond = fps
        view.isUserInteractionEnabled = false
        view.delegate = context.coordinator
        context.coordinator.parent = self
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {
        context.coordinator.parent = self
        uiView.preferredFramesPerSecond = fps
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    @MainActor
    final class Coordinator: NSObject, MTKViewDelegate {
        var parent: CameraTileView

        init(_ parent: CameraTileView) { self.parent = parent }

        nonisolated func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        nonisolated func draw(in view: MTKView) {
            MainActor.assumeIsolated {
                let doc = parent.document
                guard let node = doc.data.node(parent.cameraNodeId), node.kind == .camera else { return }
                parent.renderer.selectedNodeId = nil
                parent.renderer.draw(scene: doc.data, camera: .from(node: node), in: view)
            }
        }
    }
}
