import Metal
import QuartzCore
import simd
import Foundation

// Fase 1-motor: instanced dab-rendering på GPU.
//
// Arkitektur (samme logikk som web-motoren etter cache-fiksen):
//   • committedTexture — akkumulator for ferdige strøk (append-only;
//     full rebuild kun ved undo/clear)
//   • per frame: komposit committed → drawable, deretter aktive +
//     predicted dabs rett i drawable (transient — forkastes neste frame)
//
// ponytail: hele motoren på @MainActor i fase 1; dedikert render-tråd
// når profilering krever det.

struct DabInstanceData {
    var position: SIMD2<Float>
    var size: Float
    var rotation: Float
    var alpha: Float
    var color: SIMD3<Float>
}

@MainActor
final class MetalStrokeRenderer {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    // To varianter — pipeline-format MÅ matche render-target:
    // akkumulator er rgba8, skjerm-drawable er bgra8.
    private let dabPipelineAccumulator: MTLRenderPipelineState
    private let dabPipelineScreen: MTLRenderPipelineState
    private let blitPipeline: MTLRenderPipelineState
    private var dabTextures: [DabPreset: MTLTexture] = [:]
    private(set) var committedTexture: MTLTexture?
    private var canvasSize = SIMD2<Float>(0, 0)
    var paperColor = SIMD3<Float>(0.961, 0.949, 0.918) // #f5f2ea

    init?() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = try? device.makeDefaultLibrary(bundle: .main) else { return nil }
        self.device = device
        self.queue = queue

        func pipeline(vertex: String, fragment: String, format: MTLPixelFormat,
                      blend: Bool) -> MTLRenderPipelineState? {
            let descriptor = MTLRenderPipelineDescriptor()
            descriptor.vertexFunction = library.makeFunction(name: vertex)
            descriptor.fragmentFunction = library.makeFunction(name: fragment)
            descriptor.colorAttachments[0].pixelFormat = format
            if blend {
                let attachment = descriptor.colorAttachments[0]!
                attachment.isBlendingEnabled = true
                // premultiplied: one / oneMinusSourceAlpha
                attachment.sourceRGBBlendFactor = .one
                attachment.sourceAlphaBlendFactor = .one
                attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
                attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            }
            return try? device.makeRenderPipelineState(descriptor: descriptor)
        }

        guard let dabAccumulator = pipeline(vertex: "dab_vertex", fragment: "dab_fragment",
                                            format: .rgba8Unorm, blend: true),
              let dabScreen = pipeline(vertex: "dab_vertex", fragment: "dab_fragment",
                                       format: .bgra8Unorm, blend: true),
              let blit = pipeline(vertex: "blit_vertex", fragment: "blit_fragment",
                                  format: .bgra8Unorm, blend: false) else { return nil }
        dabPipelineAccumulator = dabAccumulator
        dabPipelineScreen = dabScreen
        blitPipeline = blit

        for preset in [DabPreset.pencilGraphite, .charcoalTooth, .inkRound, .markerChisel] {
            dabTextures[preset] = DabTextureGenerator.makeTexture(device: device, preset: preset)
        }
    }

    func resizeCanvas(width: Int, height: Int) {
        guard width > 0, height > 0 else { return }
        canvasSize = SIMD2<Float>(Float(width), Float(height))
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm, width: width, height: height, mipmapped: false)
        descriptor.usage = [.renderTarget, .shaderRead]
        committedTexture = device.makeTexture(descriptor: descriptor)
        clearCommitted()
    }

    func clearCommitted() {
        guard let target = committedTexture,
              let buffer = queue.makeCommandBuffer() else { return }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        pass.colorAttachments[0].storeAction = .store
        buffer.makeRenderCommandEncoder(descriptor: pass)?.endEncoding()
        buffer.commit()
    }

    // MARK: Dab-generering (CPU — samme semantikk som web stampSegment)

    func dabsForStroke(_ stroke: PencilStroke, scale: Double) -> [DabInstanceData] {
        guard let brush = stroke.brush,
              let config = StampConfig.forBrush(brush.type),
              stroke.points.count >= 1 else { return [] }
        var rng = SeededRandom(seedKey: stroke.id)
        var dabs: [DabInstanceData] = []
        let rgb = Self.parseHex(brush.color)
        let baseSize = max(2, brush.size * config.sizeMultiplier) * scale
        let spacing = max(0.5, baseSize * config.spacing)
        var carry = 0.0

        func emit(at point: StrokePoint, direction: SIMD2<Double>) {
            let pressure = max(0.05, point.pressure)
            let sizeFactor = 1 - config.pressureToSize + pressure * config.pressureToSize
            let size = baseSize * sizeFactor * (0.6 + brush.pressureSensitivity * 0.4)
            let alphaFactor = 1 - config.pressureToOpacity + pressure * config.pressureToOpacity
            var alpha = brush.opacity * config.flow * alphaFactor

            // Canvas-låst papirtann (Procreate «Texturized» / Krita multiply)
            let grain = min(1, max(0, brush.grain))
            if grain > 0 {
                let tooth = PaperTooth.sample(point.x * 0.22, point.y * 0.22)
                alpha *= (1 - grain * (1 - tooth) * 0.85)
                alpha *= (1 - grain * 0.12 + rng.next() * grain * 0.24)
            }

            var x = point.x * scale
            var y = point.y * scale
            let scatter = config.scatter * (1 + grain * 0.6)
            if scatter > 0 {
                let magnitude = rng.next() * scatter * baseSize
                let angle = rng.next() * .pi * 2
                x += cos(angle) * magnitude
                y += sin(angle) * magnitude
            }

            var rotation: Double
            if config.tiltRotation, point.tiltX != 0 || point.tiltY != 0 {
                rotation = atan2(point.tiltY, point.tiltX)
            } else {
                rotation = atan2(direction.y, direction.x)
            }
            if config.jitterAngleDeg > 0 {
                rotation += (rng.next() * 2 - 1) * config.jitterAngleDeg * .pi / 180
            }

            dabs.append(DabInstanceData(
                position: SIMD2<Float>(Float(x), Float(y)),
                size: Float(size),
                rotation: Float(rotation),
                alpha: Float(min(1, alpha)),
                color: rgb))
        }

        if stroke.points.count == 1 {
            emit(at: stroke.points[0], direction: SIMD2(1, 0))
            return dabs
        }
        for i in 1..<stroke.points.count {
            let from = stroke.points[i - 1]
            let to = stroke.points[i]
            let dx = to.x - from.x, dy = to.y - from.y
            let dist = (dx * dx + dy * dy).squareRoot() * scale
            guard dist > 0.001 else { continue }
            var traveled = -carry
            while traveled + spacing <= dist {
                traveled += spacing
                let t = traveled / dist
                let sample = StrokePoint(
                    x: from.x + (to.x - from.x) * t,
                    y: from.y + (to.y - from.y) * t,
                    pressure: from.pressure + (to.pressure - from.pressure) * t,
                    tiltX: from.tiltX + (to.tiltX - from.tiltX) * t,
                    tiltY: from.tiltY + (to.tiltY - from.tiltY) * t,
                    timestamp: from.timestamp)
                emit(at: sample, direction: SIMD2(dx, dy))
            }
            carry = dist - traveled
        }
        return dabs
    }

    // MARK: Render-passes

    private func encodeDabs(_ dabs: [DabInstanceData], preset: DabPreset,
                            into encoder: MTLRenderCommandEncoder,
                            pipeline: MTLRenderPipelineState) {
        guard !dabs.isEmpty, let texture = dabTextures[preset] else { return }
        encoder.setRenderPipelineState(pipeline)
        var viewport = canvasSize
        // ponytail: setVertexBytes tåler ~4KB; store strokes chunkes.
        let chunkSize = 120
        var start = 0
        while start < dabs.count {
            let chunk = Array(dabs[start..<min(start + chunkSize, dabs.count)])
            chunk.withUnsafeBytes { raw in
                encoder.setVertexBytes(raw.baseAddress!, length: raw.count, index: 0)
            }
            encoder.setVertexBytes(&viewport, length: MemoryLayout<SIMD2<Float>>.size, index: 1)
            encoder.setFragmentTexture(texture, index: 0)
            encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0,
                                   vertexCount: 4, instanceCount: chunk.count)
            start += chunkSize
        }
    }

    /// Append ferdig strøk til committed-akkumulator (inkrementelt).
    func commitStroke(_ stroke: PencilStroke, scale: Double) {
        guard let target = committedTexture,
              let brush = stroke.brush,
              let config = StampConfig.forBrush(brush.type),
              let buffer = queue.makeCommandBuffer() else { return }
        let dabs = dabsForStroke(stroke, scale: scale)
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .load
        pass.colorAttachments[0].storeAction = .store
        guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        encodeDabs(dabs, preset: config.preset, into: encoder, pipeline: dabPipelineAccumulator)
        encoder.endEncoding()
        buffer.commit()
    }

    /// Full rebuild (undo/clear/last inn dokument).
    func rebuild(strokes: [PencilStroke], scale: Double) {
        clearCommitted()
        for stroke in strokes {
            commitStroke(stroke, scale: scale)
        }
    }

    /// Presenter: papir + committed + aktive/predicted dabs → drawable.
    func present(drawable: CAMetalDrawable,
                 activeStroke: PencilStroke?,
                 predictedStroke: PencilStroke?,
                 scale: Double) {
        guard let committed = committedTexture,
              let buffer = queue.makeCommandBuffer() else { return }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = drawable.texture
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0.961, green: 0.949, blue: 0.918, alpha: 1)
        pass.colorAttachments[0].storeAction = .store
        guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }

        encoder.setRenderPipelineState(blitPipeline)
        var paper = paperColor
        encoder.setFragmentBytes(&paper, length: MemoryLayout<SIMD3<Float>>.size, index: 0)
        encoder.setFragmentTexture(committed, index: 0)
        encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)

        for candidate in [activeStroke, predictedStroke] {
            if let stroke = candidate,
               let brush = stroke.brush,
               let config = StampConfig.forBrush(brush.type) {
                encodeDabs(dabsForStroke(stroke, scale: scale),
                           preset: config.preset, into: encoder,
                           pipeline: dabPipelineScreen)
            }
        }
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }

    static func parseHex(_ hex: String) -> SIMD3<Float> {
        var value: UInt64 = 0
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard cleaned.count == 6, Scanner(string: cleaned).scanHexInt64(&value) else {
            return SIMD3<Float>(0.15, 0.16, 0.18)
        }
        return SIMD3<Float>(
            Float((value >> 16) & 0xFF) / 255,
            Float((value >> 8) & 0xFF) / 255,
            Float(value & 0xFF) / 255)
    }
}
