import SwiftUI
import MetalKit

/// Metal-viewport med orbit/pan/zoom, tap-picking og verktøy-drag på valgt node.
struct ViewportView: UIViewRepresentable {
    let document: SceneDocument
    let renderer: StageRenderer
    @Binding var orbit: OrbitCamera
    @Binding var tool: EditorTool
    @Binding var lookThroughCameraId: String?

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = renderer.device
        view.colorPixelFormat = StageRenderer.colorFormat
        view.depthStencilPixelFormat = StageRenderer.depthFormat
        view.clearColor = StageRenderer.clearColor
        view.preferredFramesPerSecond = 60
        view.delegate = context.coordinator
        context.coordinator.parent = self

        let orbitPan = UIPanGestureRecognizer(target: context.coordinator,
                                              action: #selector(Coordinator.handlePan(_:)))
        orbitPan.maximumNumberOfTouches = 1
        view.addGestureRecognizer(orbitPan)

        let twoFingerPan = UIPanGestureRecognizer(target: context.coordinator,
                                                  action: #selector(Coordinator.handleTwoFingerPan(_:)))
        twoFingerPan.minimumNumberOfTouches = 2
        twoFingerPan.maximumNumberOfTouches = 2
        view.addGestureRecognizer(twoFingerPan)

        let pinch = UIPinchGestureRecognizer(target: context.coordinator,
                                             action: #selector(Coordinator.handlePinch(_:)))
        view.addGestureRecognizer(pinch)

        let tap = UITapGestureRecognizer(target: context.coordinator,
                                         action: #selector(Coordinator.handleTap(_:)))
        view.addGestureRecognizer(tap)
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    private var activeCamera: RenderCamera {
        if let id = lookThroughCameraId, let node = document.data.node(id), node.kind == .camera {
            return RenderCamera.from(node: node)
        }
        return orbit.renderCamera()
    }

    @MainActor
    final class Coordinator: NSObject, MTKViewDelegate {
        var parent: ViewportView

        private var dragStartOrbit: OrbitCamera?
        private var dragNodeId: String?
        private var dragStartScene: SceneData?
        private var dragStartTransform: Transform?

        init(_ parent: ViewportView) { self.parent = parent }

        nonisolated func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        nonisolated func draw(in view: MTKView) {
            MainActor.assumeIsolated {
                let doc = parent.document
                parent.renderer.selectedNodeId = doc.selectedNodeId
                parent.renderer.draw(scene: doc.data, camera: parent.activeCamera, in: view)
            }
        }

        // MARK: - Gester

        @objc func handlePan(_ g: UIPanGestureRecognizer) {
            guard let view = g.view else { return }
            let translation = g.translation(in: view)

            switch g.state {
            case .began:
                dragStartOrbit = parent.orbit
                dragNodeId = nil
                // verktøy-drag: starter draget på den VALGTE noden?
                if parent.tool != .select,
                   let selected = parent.document.selectedNodeId,
                   parent.lookThroughCameraId == nil {
                    let r = ray(fromScreenPoint: g.location(in: view), viewSize: view.bounds.size,
                                camera: parent.orbit.renderCamera())
                    if pickNode(in: parent.document.data, rayOrigin: r.origin, rayDir: r.dir) == selected {
                        dragNodeId = selected
                        dragStartScene = parent.document.data
                        dragStartTransform = parent.document.data.node(selected)?.transform
                    }
                }
            case .changed:
                if let nodeId = dragNodeId {
                    applyToolDrag(nodeId: nodeId, translation: translation, in: view)
                } else if let start = dragStartOrbit, parent.lookThroughCameraId == nil {
                    var orbit = start
                    orbit.azimuthDeg = start.azimuthDeg - Float(translation.x) * 0.35
                    orbit.elevationDeg = min(max(start.elevationDeg + Float(translation.y) * 0.25, -89), 89)
                    parent.orbit = orbit
                }
            case .ended, .cancelled:
                if dragNodeId != nil, let snapshot = dragStartScene {
                    parent.document.commitTransient(from: snapshot)
                }
                dragNodeId = nil
                dragStartScene = nil
                dragStartTransform = nil
                dragStartOrbit = nil
            default:
                break
            }
        }

        private func applyToolDrag(nodeId: String, translation: CGPoint, in view: UIView) {
            guard let startTransform = dragStartTransform else { return }
            let doc = parent.document
            switch parent.tool {
            case .move:
                // flytt i XZ-planet: skjerm-delta mappes til kameraets right/forward
                let cam = parent.orbit.renderCamera()
                let right = simd_normalize(simd_cross(SIMD3<Float>(0, 1, 0),
                                                      cam.position - cam.target))
                let forward = simd_normalize(simd_cross(right, SIMD3<Float>(0, 1, 0)))
                let scale = parent.orbit.distance * 0.0016
                let delta = right * Float(translation.x) * scale + forward * Float(translation.y) * scale
                doc.updateNodeTransient(nodeId) { $0.transform.position = startTransform.position + delta }
            case .rotate:
                doc.updateNodeTransient(nodeId) {
                    $0.transform.rotationEulerDeg.y = startTransform.rotationEulerDeg.y - Float(translation.x) * 0.5
                }
            case .scale:
                let factor = max(0.05, 1 - Float(translation.y) * 0.004)
                doc.updateNodeTransient(nodeId) { $0.transform.scale = startTransform.scale * factor }
            case .select:
                break
            }
        }

        @objc func handleTwoFingerPan(_ g: UIPanGestureRecognizer) {
            guard parent.lookThroughCameraId == nil else { return }
            switch g.state {
            case .began:
                dragStartOrbit = parent.orbit
            case .changed:
                guard let start = dragStartOrbit else { return }
                let t = g.translation(in: g.view)
                let cam = start.renderCamera()
                let right = simd_normalize(simd_cross(SIMD3<Float>(0, 1, 0), cam.position - cam.target))
                let up = SIMD3<Float>(0, 1, 0)
                let scale = start.distance * 0.0014
                var orbit = start
                orbit.target = start.target - right * Float(t.x) * scale + up * Float(t.y) * scale
                parent.orbit = orbit
            default:
                dragStartOrbit = nil
            }
        }

        @objc func handlePinch(_ g: UIPinchGestureRecognizer) {
            guard parent.lookThroughCameraId == nil else { return }
            switch g.state {
            case .began:
                dragStartOrbit = parent.orbit
            case .changed:
                guard let start = dragStartOrbit else { return }
                var orbit = start
                orbit.distance = min(max(start.distance / Float(g.scale), 1.5), 30)
                parent.orbit = orbit
            default:
                dragStartOrbit = nil
            }
        }

        @objc func handleTap(_ g: UITapGestureRecognizer) {
            guard let view = g.view else { return }
            let r = ray(fromScreenPoint: g.location(in: view), viewSize: view.bounds.size,
                        camera: parent.activeCamera)
            parent.document.selectedNodeId =
                pickNode(in: parent.document.data, rayOrigin: r.origin, rayDir: r.dir)
        }
    }
}
