import Foundation
import Metal
import MetalKit
import simd

// Speiler Shaders.metal — endre BEGGE steder ved layout-endring.
struct GPULight {
    var position: SIMD3<Float> = .zero
    var direction: SIMD3<Float> = [0, -1, 0]
    var color: SIMD3<Float> = .one
    var intensity: Float = 0
    var beamCos: Float = -1
    var isSpot: Float = 0
    var pad: Float = 0
}

struct FrameUniforms {
    var viewProj: float4x4 = matrix_identity_float4x4
    var shadowMatrix: float4x4 = matrix_identity_float4x4
    var cameraPos: SIMD3<Float> = .zero
    var lightCount: Int32 = 0
    var hasShadow: Int32 = 0
    var pad0: Int32 = 0
    var pad1: Int32 = 0
    var lights: (GPULight, GPULight, GPULight, GPULight, GPULight, GPULight, GPULight, GPULight) =
        (GPULight(), GPULight(), GPULight(), GPULight(), GPULight(), GPULight(), GPULight(), GPULight())
}

struct NodeUniforms {
    var model: float4x4
    var normalMatrix: float4x4
    var baseColorSelected: SIMD4<Float>
}

struct BeamUniforms {
    var model: float4x4
    var colorAlpha: SIMD4<Float>
}

struct RenderCamera: Sendable {
    var position: SIMD3<Float>
    var target: SIMD3<Float>
    var fovYRadians: Float
    /// Scene-noden dette kameraet ER — rendereren hopper over den (ellers ser
    /// kameraet innsiden av sin egen proxy-boks). nil for orbit-/editor-kamera.
    var sourceNodeId: String? = nil

    /// Kamera-node → RenderCamera. 36mm-ekvivalent: fovY = 2·atan(12/focal).
    static func from(node: Node) -> RenderCamera {
        let m = float4x4.model(node.transform)
        let forward = simd_normalize(SIMD3<Float>(-m.columns.2.x, -m.columns.2.y, -m.columns.2.z))
        let focal: Double = if case .camera(let p) = node.params { p.focalMm } else { 35 }
        return RenderCamera(
            position: node.transform.position,
            target: node.transform.position + forward,
            fovYRadians: 2 * atan(12 / Float(focal)),
            sourceNodeId: node.id
        )
    }
}

enum RendererError: Error { case noDevice, noLibrary, textureCreationFailed, commandFailed }

@MainActor
final class StageRenderer {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    private let meshPipeline: MTLRenderPipelineState
    private let linePipeline: MTLRenderPipelineState
    private let outlinePipeline: MTLRenderPipelineState
    private let beamPipeline: MTLRenderPipelineState
    private let shadowPipeline: MTLRenderPipelineState
    private let depthState: MTLDepthStencilState
    private let depthStateReadOnly: MTLDepthStencilState
    private let shadowTexture: MTLTexture

    var selectedNodeId: String?

    static let colorFormat: MTLPixelFormat = .bgra8Unorm
    static let depthFormat: MTLPixelFormat = .depth32Float
    private static let shadowSize = 2048
    private static let beamLength: Float = 4.5

    private struct GPUMesh {
        var vertexBuffer: MTLBuffer
        var indexBuffer: MTLBuffer
        var indexCount: Int
        var mesh: Mesh
    }
    private var meshCache: [String: GPUMesh] = [:]
    private var gridBuffer: MTLBuffer?
    private var gridVertexCount = 0
    private var beamCone: GPUMesh?

    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else { throw RendererError.noDevice }
        self.device = device
        guard let queue = device.makeCommandQueue() else { throw RendererError.noDevice }
        self.queue = queue

        let library: MTLLibrary
        if let lib = try? device.makeDefaultLibrary(bundle: Bundle(for: StageRenderer.self)) {
            library = lib
        } else if let lib = device.makeDefaultLibrary() {
            library = lib
        } else {
            throw RendererError.noLibrary
        }

        func pipeline(_ vertex: String, _ fragment: String?,
                      configure: ((MTLRenderPipelineDescriptor) -> Void)? = nil) throws -> MTLRenderPipelineState {
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = library.makeFunction(name: vertex)
            if let fragment { desc.fragmentFunction = library.makeFunction(name: fragment) }
            desc.colorAttachments[0].pixelFormat = Self.colorFormat
            desc.depthAttachmentPixelFormat = Self.depthFormat
            configure?(desc)
            return try device.makeRenderPipelineState(descriptor: desc)
        }

        meshPipeline = try pipeline("vertex_main", "fragment_main")
        linePipeline = try pipeline("line_vertex", "line_fragment")
        outlinePipeline = try pipeline("outline_vertex", "outline_fragment")
        beamPipeline = try pipeline("beam_vertex", "beam_fragment") { desc in
            let att = desc.colorAttachments[0]!
            att.isBlendingEnabled = true
            att.rgbBlendOperation = .add
            att.alphaBlendOperation = .add
            att.sourceRGBBlendFactor = .one
            att.destinationRGBBlendFactor = .one
            att.sourceAlphaBlendFactor = .one
            att.destinationAlphaBlendFactor = .one
        }

        let shadowDesc = MTLRenderPipelineDescriptor()
        shadowDesc.vertexFunction = library.makeFunction(name: "shadow_vertex")
        shadowDesc.depthAttachmentPixelFormat = Self.depthFormat
        shadowPipeline = try device.makeRenderPipelineState(descriptor: shadowDesc)

        let depthDesc = MTLDepthStencilDescriptor()
        depthDesc.depthCompareFunction = .less
        depthDesc.isDepthWriteEnabled = true
        depthState = device.makeDepthStencilState(descriptor: depthDesc)!
        depthDesc.isDepthWriteEnabled = false
        depthStateReadOnly = device.makeDepthStencilState(descriptor: depthDesc)!

        let shadowTexDesc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: Self.depthFormat, width: Self.shadowSize, height: Self.shadowSize, mipmapped: false)
        shadowTexDesc.usage = [.renderTarget, .shaderRead]
        shadowTexDesc.storageMode = .private
        guard let shadowTex = device.makeTexture(descriptor: shadowTexDesc) else {
            throw RendererError.textureCreationFailed
        }
        shadowTexture = shadowTex
    }

    // MARK: - Offentlig API

    func draw(scene: SceneData, camera: RenderCamera, in view: MTKView) {
        guard let rpd = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let cmd = queue.makeCommandBuffer() else { return }
        let size = view.drawableSize
        encodeFrame(scene: scene, camera: camera, descriptor: rpd, commandBuffer: cmd,
                    aspect: Float(size.width / max(size.height, 1)))
        cmd.present(drawable)
        cmd.commit()
    }

    func renderOffscreen(scene: SceneData, camera: RenderCamera, width: Int, height: Int) throws -> MTLTexture {
        let colorDesc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: Self.colorFormat, width: width, height: height, mipmapped: false)
        colorDesc.usage = [.renderTarget, .shaderRead]
        colorDesc.storageMode = .shared
        guard let color = device.makeTexture(descriptor: colorDesc) else { throw RendererError.textureCreationFailed }

        let depthDesc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: Self.depthFormat, width: width, height: height, mipmapped: false)
        depthDesc.usage = [.renderTarget]
        depthDesc.storageMode = .private
        guard let depth = device.makeTexture(descriptor: depthDesc) else { throw RendererError.textureCreationFailed }

        let rpd = MTLRenderPassDescriptor()
        rpd.colorAttachments[0].texture = color
        rpd.colorAttachments[0].loadAction = .clear
        rpd.colorAttachments[0].storeAction = .store
        rpd.colorAttachments[0].clearColor = Self.clearColor
        rpd.depthAttachment.texture = depth
        rpd.depthAttachment.loadAction = .clear
        rpd.depthAttachment.storeAction = .dontCare
        rpd.depthAttachment.clearDepth = 1

        guard let cmd = queue.makeCommandBuffer() else { throw RendererError.commandFailed }
        encodeFrame(scene: scene, camera: camera, descriptor: rpd, commandBuffer: cmd,
                    aspect: Float(width) / Float(max(height, 1)))
        cmd.commit()
        cmd.waitUntilCompleted()
        return color
    }

    static let clearColor = MTLClearColor(red: 0.053, green: 0.0482, blue: 0.0704, alpha: 1) // Theme.bg

    // MARK: - Frame-encoding

    private func encodeFrame(scene: SceneData, camera: RenderCamera,
                             descriptor: MTLRenderPassDescriptor, commandBuffer: MTLCommandBuffer,
                             aspect: Float) {
        var frame = makeFrameUniforms(scene: scene, camera: camera, aspect: aspect)
        if frame.hasShadow == 1 {
            encodeShadowPass(scene: scene, camera: camera, lightViewProj: frame.shadowMatrix,
                             commandBuffer: commandBuffer)
            // shadowMatrix i fragment trenger uv-bias — selve matrisen er lys-VP;
            // bias skjer i shaderen via ndc→uv. (Samme matrise brukes begge steder.)
        }
        encodeMainPass(scene: scene, camera: camera, frame: &frame,
                       descriptor: descriptor, commandBuffer: commandBuffer)
    }

    private func encodeShadowPass(scene: SceneData, camera: RenderCamera,
                                  lightViewProj: float4x4, commandBuffer: MTLCommandBuffer) {
        let rpd = MTLRenderPassDescriptor()
        rpd.depthAttachment.texture = shadowTexture
        rpd.depthAttachment.loadAction = .clear
        rpd.depthAttachment.storeAction = .store
        rpd.depthAttachment.clearDepth = 1
        guard let enc = commandBuffer.makeRenderCommandEncoder(descriptor: rpd) else { return }
        enc.setDepthStencilState(depthState)
        enc.setRenderPipelineState(shadowPipeline)
        var vp = lightViewProj
        enc.setVertexBytes(&vp, length: MemoryLayout<float4x4>.stride, index: 1)
        for node in scene.nodes where node.enabled && node.id != camera.sourceNodeId && node.kind != .light {
            let gpuMesh = mesh(for: node)
            var uniforms = nodeUniforms(for: node)
            enc.setVertexBuffer(gpuMesh.vertexBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&uniforms, length: MemoryLayout<NodeUniforms>.stride, index: 2)
            enc.drawIndexedPrimitives(type: .triangle, indexCount: gpuMesh.indexCount,
                                      indexType: .uint16, indexBuffer: gpuMesh.indexBuffer,
                                      indexBufferOffset: 0)
        }
        enc.endEncoding()
    }

    private func encodeMainPass(scene: SceneData, camera: RenderCamera, frame: inout FrameUniforms,
                                descriptor: MTLRenderPassDescriptor, commandBuffer: MTLCommandBuffer) {
        guard let enc = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else { return }
        enc.setDepthStencilState(depthState)
        enc.setFragmentTexture(shadowTexture, index: 0)

        // 1) Grid
        enc.setRenderPipelineState(linePipeline)
        let grid = gridMesh()
        enc.setVertexBuffer(grid, offset: 0, index: 0)
        enc.setVertexBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
        var gridColor = SIMD4<Float>(1, 1, 1, 0.09)
        enc.setFragmentBytes(&gridColor, length: MemoryLayout<SIMD4<Float>>.stride, index: 2)
        enc.drawPrimitives(type: .line, vertexStart: 0, vertexCount: gridVertexCount)

        // 2) Noder
        enc.setRenderPipelineState(meshPipeline)
        for node in scene.nodes where node.enabled && node.id != camera.sourceNodeId {
            let gpuMesh = mesh(for: node)
            var uniforms = nodeUniforms(for: node)
            enc.setVertexBuffer(gpuMesh.vertexBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            enc.setVertexBytes(&uniforms, length: MemoryLayout<NodeUniforms>.stride, index: 2)
            enc.setFragmentBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            enc.setFragmentBytes(&uniforms, length: MemoryLayout<NodeUniforms>.stride, index: 2)
            enc.drawIndexedPrimitives(type: .triangle, indexCount: gpuMesh.indexCount,
                                      indexType: .uint16, indexBuffer: gpuMesh.indexBuffer,
                                      indexBufferOffset: 0)
        }

        // 3) Hjelpelinjer (kamera-frustum + lys-retninger)
        let helpers = helperLines(scene: scene, excluding: camera.sourceNodeId)
        if !helpers.isEmpty {
            enc.setRenderPipelineState(linePipeline)
            enc.setVertexBytes(helpers, length: helpers.count * MemoryLayout<Vertex>.stride, index: 0)
            enc.setVertexBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            var color = SIMD4<Float>(0.56, 0.55, 0.61, 0.55) // Theme.muted
            enc.setFragmentBytes(&color, length: MemoryLayout<SIMD4<Float>>.stride, index: 2)
            enc.drawPrimitives(type: .line, vertexStart: 0, vertexCount: helpers.count)
        }

        // 4) Selection-outline
        if let sel = selectedNodeId,
           let node = scene.node(sel), node.enabled, sel != camera.sourceNodeId {
            enc.setRenderPipelineState(outlinePipeline)
            enc.setDepthStencilState(depthStateReadOnly)
            enc.setCullMode(.front)
            let gpuMesh = mesh(for: node)
            var uniforms = nodeUniforms(for: node)
            enc.setVertexBuffer(gpuMesh.vertexBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            enc.setVertexBytes(&uniforms, length: MemoryLayout<NodeUniforms>.stride, index: 2)
            enc.drawIndexedPrimitives(type: .triangle, indexCount: gpuMesh.indexCount,
                                      indexType: .uint16, indexBuffer: gpuMesh.indexBuffer,
                                      indexBufferOffset: 0)
            enc.setCullMode(.none)
        }

        // 5) Beams (additiv, depth-read-only) — diegetisk glød per brand-spec
        enc.setRenderPipelineState(beamPipeline)
        enc.setDepthStencilState(depthStateReadOnly)
        let cone = beamConeMesh()
        for node in scene.nodes where node.kind == .light && node.enabled {
            guard case .light(let p) = node.params, p.type == .spot else { continue }
            let halfRad = Float(p.beamDeg) * .pi / 180 / 2
            let r = tan(halfRad) * Self.beamLength
            var t = node.transform
            t.scale = [r, r, Self.beamLength]
            var beam = BeamUniforms(
                model: .model(t),
                colorAlpha: SIMD4<Float>(kelvinToRGB(p.temperatureK), Float(p.intensity) / 100 * 0.16)
            )
            enc.setVertexBuffer(cone.vertexBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            enc.setVertexBytes(&beam, length: MemoryLayout<BeamUniforms>.stride, index: 2)
            enc.setFragmentBytes(&frame, length: MemoryLayout<FrameUniforms>.stride, index: 1)
            enc.setFragmentBytes(&beam, length: MemoryLayout<BeamUniforms>.stride, index: 2)
            enc.drawIndexedPrimitives(type: .triangle, indexCount: cone.indexCount,
                                      indexType: .uint16, indexBuffer: cone.indexBuffer,
                                      indexBufferOffset: 0)
        }

        enc.endEncoding()
    }

    // MARK: - Uniforms

    private func makeFrameUniforms(scene: SceneData, camera: RenderCamera, aspect: Float) -> FrameUniforms {
        var frame = FrameUniforms()
        let view = float4x4.lookAt(eye: camera.position, center: camera.target, up: [0, 1, 0])
        let proj = float4x4.perspective(fovYRadians: camera.fovYRadians, aspect: aspect, near: 0.05, far: 100)
        frame.viewProj = proj * view
        frame.cameraPos = camera.position

        var lights: [GPULight] = []
        var shadowSet = false
        for node in scene.nodes where node.kind == .light && node.enabled {
            guard case .light(let p) = node.params, lights.count < 8 else { continue }
            let m = float4x4.model(node.transform)
            let forward = simd_normalize(SIMD3<Float>(-m.columns.2.x, -m.columns.2.y, -m.columns.2.z))
            var l = GPULight()
            l.position = node.transform.position
            l.direction = forward
            l.color = kelvinToRGB(p.temperatureK)
            l.intensity = Float(p.intensity) * 0.055
            l.isSpot = p.type == .spot ? 1 : 0
            l.beamCos = cos(Float(p.beamDeg) * .pi / 180 / 2)
            // Skyggekast: første spot m/ castsShadows legges FØRST (fragment-shaderen
            // skygger kun lys 0).
            if !shadowSet && p.type == .spot && p.castsShadows {
                let up: SIMD3<Float> = abs(forward.y) > 0.99 ? [0, 0, 1] : [0, 1, 0]
                let lightView = float4x4.lookAt(eye: l.position, center: l.position + forward, up: up)
                let fov = min(max(Float(p.beamDeg) * 1.3, 20), 120) * .pi / 180
                let lightProj = float4x4.perspective(fovYRadians: fov, aspect: 1, near: 0.2, far: 30)
                frame.shadowMatrix = lightProj * lightView
                frame.hasShadow = 1
                shadowSet = true
                lights.insert(l, at: 0)
            } else {
                lights.append(l)
            }
        }
        frame.lightCount = Int32(lights.count)
        withUnsafeMutableBytes(of: &frame.lights) { raw in
            let dst = raw.bindMemory(to: GPULight.self)
            for (i, l) in lights.enumerated() { dst[i] = l }
        }
        return frame
    }

    private func nodeUniforms(for node: Node) -> NodeUniforms {
        NodeUniforms(
            model: .model(node.transform),
            normalMatrix: float4x4.model(node.transform).inverse.transpose,
            baseColorSelected: SIMD4<Float>(Self.baseColor(for: node), node.id == selectedNodeId ? 1 : 0)
        )
    }

    // MARK: - Geometri

    private func mesh(for node: Node) -> GPUMesh {
        let key: String = switch node.params {
        case .prop(let p): "prop-\(p.shape.rawValue)"
        case .talent: "talent"
        case .light: "light"
        case .camera: "camera"
        }
        if let cached = meshCache[key] { return cached }
        let gpu = makeGPUMesh(MeshFactory.mesh(forNodeKind: node.kind, params: node.params))
        meshCache[key] = gpu
        return gpu
    }

    private func makeGPUMesh(_ mesh: Mesh) -> GPUMesh {
        let vb = device.makeBuffer(bytes: mesh.vertices,
                                   length: mesh.vertices.count * MemoryLayout<Vertex>.stride)!
        let ib = device.makeBuffer(bytes: mesh.indices,
                                   length: mesh.indices.count * MemoryLayout<UInt16>.stride)!
        return GPUMesh(vertexBuffer: vb, indexBuffer: ib, indexCount: mesh.indices.count, mesh: mesh)
    }

    private func beamConeMesh() -> GPUMesh {
        if let cone = beamCone { return cone }
        // Apex i origo, ring r=1 ved z=-1 (32 segmenter), ingen bunn-kappe.
        var verts: [Vertex] = [Vertex(.zero, [0, 0, 1])]
        var idx: [UInt16] = []
        let segments = 32
        for i in 0...segments {
            let a = Float(i) / Float(segments) * 2 * .pi
            verts.append(Vertex([cos(a), sin(a), -1], [cos(a), sin(a), 0]))
        }
        for i in 0..<segments {
            idx += [0, UInt16(i + 1), UInt16(i + 2)]
        }
        let gpu = makeGPUMesh(Mesh(vertices: verts, indices: idx))
        beamCone = gpu
        return gpu
    }

    /// World-space AABB for picking og gizmo.
    func worldBounds(of node: Node) -> (min: SIMD3<Float>, max: SIMD3<Float>) {
        let m = MeshFactory.mesh(forNodeKind: node.kind, params: node.params)
        return StageOne.worldBounds(mesh: m, transform: node.transform)
    }

    private func gridMesh() -> MTLBuffer {
        if let buffer = gridBuffer { return buffer }
        var verts: [Vertex] = []
        let extent: Float = 6
        for i in stride(from: -extent, through: extent, by: 0.5) {
            verts.append(Vertex([i, 0.001, -extent], [0, 1, 0]))
            verts.append(Vertex([i, 0.001, extent], [0, 1, 0]))
            verts.append(Vertex([-extent, 0.001, i], [0, 1, 0]))
            verts.append(Vertex([extent, 0.001, i], [0, 1, 0]))
        }
        gridVertexCount = verts.count
        let buffer = device.makeBuffer(bytes: verts, length: verts.count * MemoryLayout<Vertex>.stride)!
        gridBuffer = buffer
        return buffer
    }

    /// Kamera-frustum + lys-retningslinjer (ikke for noden vi ser gjennom).
    private func helperLines(scene: SceneData, excluding excludedId: String?) -> [Vertex] {
        var lines: [Vertex] = []
        let up = SIMD3<Float>(0, 1, 0)
        func addLine(_ a: SIMD3<Float>, _ b: SIMD3<Float>) {
            lines.append(Vertex(a, up))
            lines.append(Vertex(b, up))
        }
        for node in scene.nodes where node.enabled && node.id != excludedId {
            switch node.params {
            case .camera:
                let cam = RenderCamera.from(node: node)
                let m = float4x4.model(node.transform)
                let fwd = simd_normalize(cam.target - cam.position)
                let right = simd_normalize(SIMD3<Float>(m.columns.0.x, m.columns.0.y, m.columns.0.z))
                let camUp = simd_cross(right, fwd) * -1
                let d: Float = 1.1
                let hh = tan(cam.fovYRadians / 2) * d
                let hw = hh * 16 / 9
                let center = cam.position + fwd * d
                let corners = [
                    center + right * hw + camUp * hh, center - right * hw + camUp * hh,
                    center - right * hw - camUp * hh, center + right * hw - camUp * hh,
                ]
                for c in corners { addLine(cam.position, c) }
                for i in 0..<4 { addLine(corners[i], corners[(i + 1) % 4]) }
            case .light:
                let m = float4x4.model(node.transform)
                let fwd = simd_normalize(SIMD3<Float>(-m.columns.2.x, -m.columns.2.y, -m.columns.2.z))
                addLine(node.transform.position, node.transform.position + fwd * 0.6)
            default:
                break
            }
        }
        return lines
    }

    static func baseColor(for node: Node) -> SIMD3<Float> {
        switch node.params {
        case .light: return [1.0, 0.9, 0.6]
        case .camera: return [0.30, 0.30, 0.36]
        case .talent: return [0.72, 0.58, 0.50]
        case .prop(let p):
            switch p.material {
            case "Matte Charcoal": return [0.14, 0.14, 0.16]
            case "LED · 1.9mm pitch": return [0.22, 0.18, 0.38]
            case "Riser · Carpet": return [0.17, 0.16, 0.20]
            case "Void Black": return [0.05, 0.05, 0.07]
            case "Slate Bouclé": return [0.36, 0.38, 0.44]
            case "Walnut": return [0.36, 0.25, 0.16]
            default: return [0.4, 0.4, 0.45]
            }
        }
    }
}

/// World-space AABB av en mesh under en transform (8 hjørner → ny AABB).
func worldBounds(mesh: Mesh, transform: Transform) -> (min: SIMD3<Float>, max: SIMD3<Float>) {
    let m = float4x4.model(transform)
    var mn = SIMD3<Float>(repeating: .greatestFiniteMagnitude)
    var mx = -mn
    for corner in 0..<8 {
        let p = SIMD3<Float>(
            (corner & 1) == 0 ? mesh.boundsMin.x : mesh.boundsMax.x,
            (corner & 2) == 0 ? mesh.boundsMin.y : mesh.boundsMax.y,
            (corner & 4) == 0 ? mesh.boundsMin.z : mesh.boundsMax.z
        )
        let w = m * SIMD4<Float>(p, 1)
        mn = simd_min(mn, SIMD3<Float>(w.x, w.y, w.z))
        mx = simd_max(mx, SIMD3<Float>(w.x, w.y, w.z))
    }
    return (mn, mx)
}
