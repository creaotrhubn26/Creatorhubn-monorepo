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
    // Oval-skalering (x=bredde, y=høyde) — Shade-tilt; (1,1) = rund.
    // Ligger i det som var padding før float3 — stride er fortsatt 48.
    var stretch: SIMD2<Float> = SIMD2(1, 1)
    var color: SIMD3<Float>
}

@MainActor
final class MetalStrokeRenderer {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    // Pipeline-format MÅ matche render-target: akkumulator rgba8, drawable
    // bgra8. Eraser har egen blending (destination-out: zero /
    // oneMinusSourceAlpha) mot akkumulatoren.
    private let dabPipelineAccumulator: MTLRenderPipelineState
    private let dabPipelineScreen: MTLRenderPipelineState
    private let dabPipelineEraser: MTLRenderPipelineState
    private let smudgePipeline: MTLRenderPipelineState
    private let blitPipeline: MTLRenderPipelineState
    private var smudgeRegionTexture: MTLTexture?
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

        enum BlendMode { case none, premultiplied, destinationOut }
        func pipeline(vertex: String, fragment: String, format: MTLPixelFormat,
                      blend: BlendMode) -> MTLRenderPipelineState? {
            let descriptor = MTLRenderPipelineDescriptor()
            descriptor.vertexFunction = library.makeFunction(name: vertex)
            descriptor.fragmentFunction = library.makeFunction(name: fragment)
            descriptor.colorAttachments[0].pixelFormat = format
            if blend != .none {
                let attachment = descriptor.colorAttachments[0]!
                attachment.isBlendingEnabled = true
                switch blend {
                case .premultiplied:
                    attachment.sourceRGBBlendFactor = .one
                    attachment.sourceAlphaBlendFactor = .one
                    attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
                    attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
                case .destinationOut:
                    attachment.sourceRGBBlendFactor = .zero
                    attachment.sourceAlphaBlendFactor = .zero
                    attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
                    attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
                case .none:
                    break
                }
            }
            return try? device.makeRenderPipelineState(descriptor: descriptor)
        }

        guard let dabAccumulator = pipeline(vertex: "dab_vertex", fragment: "dab_fragment",
                                            format: .rgba8Unorm, blend: .premultiplied),
              let dabScreen = pipeline(vertex: "dab_vertex", fragment: "dab_fragment",
                                       format: .bgra8Unorm, blend: .premultiplied),
              let dabEraser = pipeline(vertex: "dab_vertex", fragment: "dab_fragment",
                                       format: .rgba8Unorm, blend: .destinationOut),
              let smudge = pipeline(vertex: "dab_vertex", fragment: "smudge_fragment",
                                    format: .rgba8Unorm, blend: .premultiplied),
              let blit = pipeline(vertex: "blit_vertex", fragment: "blit_fragment",
                                  format: .bgra8Unorm, blend: .none) else { return nil }
        dabPipelineAccumulator = dabAccumulator
        dabPipelineScreen = dabScreen
        dabPipelineEraser = dabEraser
        smudgePipeline = smudge
        blitPipeline = blit

        for preset in [DabPreset.pencilGraphite, .charcoalTooth, .inkRound, .markerChisel,
                       .softRound, .skinPore, .rockGrit] {
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

        // Total lengde (for taper inn/ut) + fartsberegning per segment.
        var totalLength = 0.0
        if stroke.points.count > 1 {
            for i in 1..<stroke.points.count {
                let dx = stroke.points[i].x - stroke.points[i - 1].x
                let dy = stroke.points[i].y - stroke.points[i - 1].y
                totalLength += (dx * dx + dy * dy).squareRoot()
            }
        }
        totalLength *= scale

        func emit(at point: StrokePoint, direction: SIMD2<Double>,
                  traveledTotal: Double, velocity: Double) {
            // Pressure curve (spec §8: pow 0.65 for blyant — ikke lineær)
            let pressure = pow(max(0.05, point.pressure), config.pressureCurve)
            var sizeFactor = 1 - config.pressureToSize + pressure * config.pressureToSize
            // Velocity-dynamikk (px/ms; ~1.0 er rask strek)
            if config.velocityToSize != 0 {
                sizeFactor *= max(0.6, 1 + config.velocityToSize * min(velocity, 2))
            }
            var size = baseSize * sizeFactor * (0.6 + brush.pressureSensitivity * 0.4)
            if config.sizeJitter > 0 {
                size *= 1 + (rng.next() - 0.5) * 2 * config.sizeJitter
            }
            let alphaFactor = 1 - config.pressureToOpacity + pressure * config.pressureToOpacity
            var alpha = brush.opacity * config.flow * alphaFactor
            if config.velocityToOpacity != 0 {
                alpha *= max(0.5, 1 + config.velocityToOpacity * min(velocity, 2))
            }
            // Taper inn/ut (spec §9 — Ink)
            if config.taperDistance > 0, totalLength > 0 {
                let taper = min(1, min(traveledTotal, totalLength - traveledTotal)
                    / (config.taperDistance * scale))
                size *= max(0.15, taper)
            }

            // Canvas-låst papirtann (Procreate «Texturized» / Krita multiply)
            let grain = min(1, max(0, brush.grain))
            if grain > 0 {
                let tooth = PaperTooth.sample(point.x * 0.22, point.y * 0.22)
                alpha *= (1 - grain * (1 - tooth) * 0.85)
                alpha *= (1 - grain * 0.12 + rng.next() * grain * 0.24)
            }

            var x = point.x * scale
            var y = point.y * scale
            // Menneskelig wobble (spec §15): lavfrekvent noise vinkelrett
            // på strøkretningen, deterministisk på avstand.
            if config.wobble > 0 {
                let wobble = WobbleNoise.sample(traveledTotal / scale * 0.05)
                    * config.wobble * baseSize * 0.35
                let dirLen = max(0.0001, (direction.x * direction.x + direction.y * direction.y).squareRoot())
                x += -direction.y / dirLen * wobble
                y += direction.x / dirLen * wobble
            }
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

            // Tilt-oval (spec §12): flat stylus → bred og flat grafittside.
            var stretch = SIMD2<Float>(1, 1)
            if config.tiltOval > 0 {
                let tilt = min(1, (point.tiltX * point.tiltX + point.tiltY * point.tiltY).squareRoot() / 90)
                stretch = SIMD2(Float(1 + tilt * 2.5 * config.tiltOval),
                                Float(max(0.3, 1 - tilt * 0.55 * config.tiltOval)))
            }
            dabs.append(DabInstanceData(
                position: SIMD2<Float>(Float(x), Float(y)),
                size: Float(size),
                rotation: Float(rotation),
                alpha: Float(min(1, alpha)),
                stretch: stretch,
                color: rgb))
            // Shade 2.0 (spec §38): mikrolinjer i strøkretningen — små
            // ekstra dabs foran/bak som simulerer grafittsidens striper.
            if config.directionTexture > 0, rng.next() < config.directionTexture {
                let dirLen = max(0.0001, (direction.x * direction.x + direction.y * direction.y).squareRoot())
                let ux = direction.x / dirLen, uy = direction.y / dirLen
                let offset = (rng.next() - 0.5) * size * 0.8
                let lift = (rng.next() - 0.5) * size * 0.5
                dabs.append(DabInstanceData(
                    position: SIMD2<Float>(Float(x + ux * offset - uy * lift),
                                           Float(y + uy * offset + ux * lift)),
                    size: Float(size * 0.18),
                    rotation: Float(atan2(uy, ux)),
                    alpha: Float(min(1, alpha * 0.8)),
                    stretch: SIMD2(3.5, 0.5),
                    color: rgb))
            }
        }

        // Prosedural skravering (spec §10/§37): egen generator.
        if let hatchParams = config.hatch {
            return hatchDabs(stroke, scale: scale, brush: brush, config: config,
                             params: hatchParams, rng: &rng)
        }
        // Prosedural miljøtekstur (spec §56–§66): klynger av strukturer.
        if let mode = config.environmental {
            return environmentalDabs(stroke, scale: scale, brush: brush,
                                     config: config, mode: mode, rng: &rng)
        }

        if stroke.points.count == 1 {
            emit(at: stroke.points[0], direction: SIMD2(1, 0), traveledTotal: 0, velocity: 0)
            return dabs
        }
        var accumulated = 0.0
        for i in 1..<stroke.points.count {
            let from = stroke.points[i - 1]
            let to = stroke.points[i]
            let dx = to.x - from.x, dy = to.y - from.y
            let dist = (dx * dx + dy * dy).squareRoot() * scale
            guard dist > 0.001 else { continue }
            // Fart i px/ms fra timestamps (spec §5)
            let dt = max(1, to.timestamp - from.timestamp)
            let velocity = dist / scale / dt
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
                emit(at: sample, direction: SIMD2(dx, dy),
                     traveledTotal: accumulated + traveled, velocity: velocity)
            }
            carry = dist - traveled
            accumulated += dist
        }
        return dabs
    }

    /// Story Hatch / Cross Hatch: genererer korte parallelle streker
    /// (organiske, 5 segmenter) langs strøkbanen. Trykk styrer tetthet og
    /// om kryss-laget legges (spec §37): <0.35 glissent, ≥0.7 kryss.
    private func hatchDabs(_ stroke: PencilStroke, scale: Double, brush: BrushSpec,
                           config: StampConfig, params: HatchParams,
                           rng: inout SeededRandom) -> [DabInstanceData] {
        var dabs: [DabInstanceData] = []
        let rgb = Self.parseHex(brush.color)
        let region = max(8, brush.size) * scale           // penselens dekkbredde
        let sizeRatio = max(0.4, brush.size / 34)          // spec-preset er 34 px
        let markLength = params.lineLength * sizeRatio * scale
        let markWidth = max(1, params.lineWidth * 1.6 * scale)
        let markSpacing = params.lineSpacing * sizeRatio * scale
        let alwaysCross = stroke.brush?.type == .crosshatch

        func mark(at cx: Double, _ cy: Double, angle: Double, alpha: Double) {
            let length = markLength * (1 + (rng.next() - 0.5) * params.lengthJitter)
            let markAngle = angle + (rng.next() - 0.5) * params.angleJitter * 2
            // Organisk strek: 5 segmenter med sideveis avvik (spec §10),
            // hvert segment tegnes som tette små dabs.
            let segments = 5
            var previous = SIMD2<Double>(cx - cos(markAngle) * length / 2,
                                         cy - sin(markAngle) * length / 2)
            for i in 1...segments {
                let t = Double(i) / Double(segments)
                let wobbleOffset = (rng.next() - 0.5) * 0.9 * scale
                let px = cx + cos(markAngle) * (t - 0.5) * length - sin(markAngle) * wobbleOffset
                let py = cy + sin(markAngle) * (t - 0.5) * length + cos(markAngle) * wobbleOffset
                let segLen = ((px - previous.x) * (px - previous.x)
                    + (py - previous.y) * (py - previous.y)).squareRoot()
                let steps = max(1, Int(segLen / (markWidth * 0.6)))
                for step in 0...steps {
                    let st = Double(step) / Double(steps)
                    dabs.append(DabInstanceData(
                        position: SIMD2<Float>(Float(previous.x + (px - previous.x) * st),
                                               Float(previous.y + (py - previous.y) * st)),
                        size: Float(markWidth),
                        rotation: 0,
                        alpha: Float(alpha),
                        color: rgb))
                }
                previous = SIMD2(px, py)
            }
        }

        var carry = 0.0
        let points = stroke.points
        guard let first = points.first else { return dabs }
        // Ett punkt: én klynge.
        func cluster(at point: StrokePoint, direction: SIMD2<Double>) {
            let pressure = pow(max(0.05, point.pressure), config.pressureCurve)
            // Trykk → tetthet + kryss (spec §37)
            let density: Double = pressure < 0.35 ? 0.3 : (pressure < 0.7 ? 0.65 : 1.0)
            let cross = params.allowCross && (alwaysCross || pressure >= 0.7)
            let alpha = min(1, brush.opacity * (0.7 + pressure * 0.5))
            let rows = max(1, Int(region / markSpacing * density))
            // Speed lines: merkene følger strøkretningen.
            let baseAngle = params.followDirection
                ? atan2(direction.y, direction.x) : params.angle
            for _ in 0..<rows {
                let ox = (rng.next() - 0.5) * region
                let oy = (rng.next() - 0.5) * region
                let jx = (rng.next() - 0.5) * params.positionJitter * scale
                let jy = (rng.next() - 0.5) * params.positionJitter * scale
                mark(at: point.x * scale + ox + jx, point.y * scale + oy + jy,
                     angle: baseAngle, alpha: alpha)
                if cross {
                    mark(at: point.x * scale + ox - jx, point.y * scale + oy - jy,
                         angle: params.crossAngle, alpha: alpha * 0.85)
                }
            }
        }
        if points.count == 1 {
            cluster(at: first, direction: SIMD2(1, 0))
            return dabs
        }
        // Klynger med regionsavstand langs banen (unngå dobbeltdekning).
        let clusterSpacing = region * 0.55
        for i in 1..<points.count {
            let from = points[i - 1], to = points[i]
            let dx = to.x - from.x, dy = to.y - from.y
            let dist = (dx * dx + dy * dy).squareRoot() * scale
            guard dist > 0.001 else { continue }
            var traveled = -carry
            while traveled + clusterSpacing <= dist {
                traveled += clusterSpacing
                let t = traveled / dist
                cluster(at: StrokePoint(
                    x: from.x + dx * t, y: from.y + dy * t,
                    pressure: from.pressure + (to.pressure - from.pressure) * t,
                    tiltX: 0, tiltY: 0, timestamp: from.timestamp),
                    direction: SIMD2(dx, dy))
            }
            carry = dist - traveled
        }
        return dabs
    }

    /// Miljøpensler (spec §57–§66): én brukerbevegelse genererer mange små
    /// strukturer (trær/kvister/shards/hårstrå). Alt tegnes som dab-fylte
    /// polylinjer — gjenbruker stamp-pipelinen, deterministisk per strøk-id.
    private func environmentalDabs(_ stroke: PencilStroke, scale: Double, brush: BrushSpec,
                                   config: StampConfig, mode: EnvironmentalMode,
                                   rng: inout SeededRandom) -> [DabInstanceData] {
        var dabs: [DabInstanceData] = []
        let rgb = Self.parseHex(brush.color)
        let unit = max(6, brush.size) * scale

        // Dab-fylt linje — byggeklossen for alle strukturene.
        func line(_ x0: Double, _ y0: Double, _ x1: Double, _ y1: Double,
                  width: Double, alpha: Double) {
            let length = ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)).squareRoot()
            let steps = max(1, Int(length / max(1, width * 0.6)))
            for step in 0...steps {
                let t = Double(step) / Double(steps)
                dabs.append(DabInstanceData(
                    position: SIMD2<Float>(Float(x0 + (x1 - x0) * t), Float(y0 + (y1 - y0) * t)),
                    size: Float(width),
                    rotation: 0,
                    alpha: Float(min(1, alpha)),
                    color: rgb))
            }
        }

        // Tapered strå (fur/gress): bredde krymper mot tuppen.
        func strand(_ x: Double, _ y: Double, angle: Double, length: Double,
                    baseWidth: Double, alpha: Double) {
            let steps = 6
            for step in 0..<steps {
                let t0 = Double(step) / Double(steps)
                let t1 = Double(step + 1) / Double(steps)
                let width = max(0.8, baseWidth * (1 - t0 * 0.85))
                line(x + cos(angle) * length * t0, y + sin(angle) * length * t0,
                     x + cos(angle) * length * t1, y + sin(angle) * length * t1,
                     width: width, alpha: alpha)
            }
        }

        // Gran (spec §60): stamme + fallende grennivåer.
        func conifer(_ x: Double, _ y: Double, height: Double, alpha: Double) {
            let top = y - height
            line(x, y, x, top, width: max(1.2, height * 0.02), alpha: alpha)
            let levels = max(5, Int(height / (8 * scale)))
            for level in 0..<levels {
                let t = Double(level) / Double(max(1, levels - 1))
                let py = top + t * height
                let widthAtLevel = height * 0.24 * t
                guard widthAtLevel > 1 else { continue }
                let drop = widthAtLevel * 0.68
                line(x, py, x - widthAtLevel, py + drop, width: 1.1 * scale, alpha: alpha)
                line(x, py, x + widthAtLevel, py + drop, width: 1.1 * scale, alpha: alpha)
            }
        }

        func cluster(at point: StrokePoint, direction: SIMD2<Double>) {
            let pressure = pow(max(0.05, point.pressure), config.pressureCurve)
            let alpha = min(1, brush.opacity * (0.6 + pressure * 0.6))
            let px = point.x * scale, py = point.y * scale
            let dirAngle = atan2(direction.y, direction.x)
            switch mode {
            case .forest:
                // Trykk → tetthet + høyde (spec §58)
                let count = max(1, Int(2 + pressure * 0.82 * 5))
                for _ in 0..<count {
                    let h = unit * (0.75 + pressure * 0.46) * (1 + (rng.next() - 0.5) * 0.28)
                    conifer(px + (rng.next() - 0.5) * unit * 1.4,
                            py + (rng.next() - 0.5) * unit * 0.3,
                            height: h, alpha: alpha)
                }
            case .debris:
                // Tetthet først, så størrelse (spec §62)
                let count = max(1, Int(8 * (0.25 + pressure * 0.86)))
                for _ in 0..<count {
                    let radius = rng.next() * unit
                    let clusterAngle = rng.next() * .pi * 2
                    let cx = px + cos(clusterAngle) * radius
                    let cy = py + sin(clusterAngle) * radius
                    let length = (unit * 0.2 + rng.next() * unit * 0.7)
                        * (1 + pressure * 0.38)
                    if rng.next() < 0.18 {
                        // Stein: liten uregelmessig klump
                        for _ in 0..<4 {
                            line(cx + (rng.next() - 0.5) * length * 0.4,
                                 cy + (rng.next() - 0.5) * length * 0.3,
                                 cx + (rng.next() - 0.5) * length * 0.4,
                                 cy + (rng.next() - 0.5) * length * 0.3,
                                 width: 2.2 * scale, alpha: alpha * 0.9)
                        }
                    } else {
                        let angle = dirAngle + (rng.next() - 0.5) * .pi
                        line(cx - cos(angle) * length / 2, cy - sin(angle) * length / 2,
                             cx + cos(angle) * length / 2, cy + sin(angle) * length / 2,
                             width: (0.45 + rng.next() * 1.15) * scale * 1.6, alpha: alpha)
                    }
                }
            case .organic:
                // Shard-klynger (spec §64–§66)
                let count = max(1, Int(7 * (0.3 + pressure * 0.84)))
                for _ in 0..<count {
                    let offsetAngle = rng.next() * .pi * 2
                    let radius = rng.next() * unit
                    let cx = px + cos(offsetAngle) * radius
                    let cy = py + sin(offsetAngle) * radius
                    let angle = dirAngle * 0.64 + (rng.next() - 0.5) * 0.42 * 2
                    let shardScale = 1 + (rng.next() - 0.5) * 0.46
                    let length = unit * 0.6 * shardScale
                    let width = unit * 0.22 * shardScale
                    // /\-form: to skrå linjer
                    line(cx - cos(angle) * length / 2, cy - sin(angle) * length / 2,
                         cx, cy - width, width: 1.3 * scale, alpha: alpha)
                    line(cx, cy - width,
                         cx + cos(angle) * length / 2, cy + sin(angle) * length / 2,
                         width: 1.3 * scale, alpha: alpha)
                }
            case .fur:
                // Klynger av tapered strå (spec §44–§45)
                let count = max(1, Int(6 * (0.25 + pressure * 0.8)))
                for _ in 0..<count {
                    let angle = dirAngle * 0.7 + (rng.next() - 0.5) * 0.8
                    let length = unit * (0.5 + rng.next() * 0.6)
                    strand(px + (rng.next() - 0.5) * unit * 0.8,
                           py + (rng.next() - 0.5) * unit * 0.8,
                           angle: angle, length: length,
                           baseWidth: 1.8 * scale,
                           alpha: alpha * (0.7 + rng.next() * 0.3))
                }
            case .wethair:
                // Lange kurvede strå med heng (kvadratisk kurve mot tyngde) —
                // vått hår klumper: par av nesten-parallelle strå + stor
                // tonevariasjon (mørk masse med enkelte lysere strå).
                let count = max(1, Int(4 * (0.3 + pressure * 0.8)))
                for _ in 0..<count {
                    let rootX = px + (rng.next() - 0.5) * unit
                    let rootY = py + (rng.next() - 0.5) * unit * 0.5
                    let angle = dirAngle + (rng.next() - 0.5) * 0.5
                    let length = unit * (1.8 + rng.next() * 1.4)
                    let sag = length * (0.25 + rng.next() * 0.35)   // heng
                    let curve = (rng.next() - 0.5) * length * 0.4
                    let strandAlpha = alpha * (0.35 + rng.next() * 0.65)
                    let clumps = rng.next() < 0.4 ? 2 : 1
                    for clump in 0..<clumps {
                        let offset = Double(clump) * 2.4 * scale
                        // Kvadratisk bezier: rot → kontroll (retning+kurve) → tupp (heng)
                        let p0 = SIMD2<Double>(rootX + offset, rootY)
                        let p1 = SIMD2<Double>(
                            rootX + cos(angle) * length * 0.55 - sin(angle) * curve + offset,
                            rootY + sin(angle) * length * 0.55 + cos(angle) * curve)
                        let p2 = SIMD2<Double>(
                            rootX + cos(angle) * length + offset,
                            rootY + sin(angle) * length + sag)
                        let segments = 9
                        var previous = p0
                        for seg in 1...segments {
                            let t = Double(seg) / Double(segments)
                            let mt = 1 - t
                            let bx = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x
                            let by = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
                            let width = max(0.8, 2.2 * scale * (1 - t * 0.8))
                            line(previous.x, previous.y, bx, by,
                                 width: width, alpha: strandAlpha)
                            previous = SIMD2(bx, by)
                        }
                    }
                }
            }
        }

        let points = stroke.points
        guard let first = points.first else { return dabs }
        if points.count == 1 {
            cluster(at: first, direction: SIMD2(1, 0))
            return dabs
        }
        let clusterSpacing = unit * 0.9
        var carry = 0.0
        for i in 1..<points.count {
            let from = points[i - 1], to = points[i]
            let dx = to.x - from.x, dy = to.y - from.y
            let dist = (dx * dx + dy * dy).squareRoot() * scale
            guard dist > 0.001 else { continue }
            var traveled = -carry
            while traveled + clusterSpacing <= dist {
                traveled += clusterSpacing
                let t = traveled / dist
                cluster(at: StrokePoint(
                    x: from.x + dx * t, y: from.y + dy * t,
                    pressure: from.pressure + (to.pressure - from.pressure) * t,
                    tiltX: 0, tiltY: 0, timestamp: from.timestamp),
                    direction: SIMD2(dx, dy))
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

    // Dab-cache: dabsForStroke er deterministisk per (strøk, scale, opacity)
    // — full rebuild ved lag-toggle/undo gjenbruker CPU-arbeidet. Nøkkel per
    // stroke-id; opacity i nøkkelen fordi lag-opacity bakes inn i strøket.
    private var dabCache: [String: (scale: Double, opacity: Double, dabs: [DabInstanceData])] = [:]

    private func cachedDabs(for stroke: PencilStroke, scale: Double) -> [DabInstanceData] {
        if let hit = dabCache[stroke.id], hit.scale == scale, hit.opacity == stroke.opacity {
            return hit.dabs
        }
        let dabs = dabsForStroke(stroke, scale: scale)
        if dabCache.count > 3000 { dabCache.removeAll(keepingCapacity: true) }
        dabCache[stroke.id] = (scale, stroke.opacity, dabs)
        return dabs
    }

    /// Append ferdig strøk til committed-akkumulator (inkrementelt).
    /// Eraser rendres destination-out (piksel-viskelær — web-paritet).
    func commitStroke(_ stroke: PencilStroke, scale: Double) {
        if stroke.brush?.type == .smudge || stroke.brush?.type == .softfocus {
            smudgeStroke(stroke, scale: scale)
            return
        }
        guard let target = committedTexture,
              let brush = stroke.brush,
              let config = StampConfig.forBrush(brush.type),
              let buffer = queue.makeCommandBuffer() else { return }
        let dabs = cachedDabs(for: stroke, scale: scale)
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .load
        pass.colorAttachments[0].storeAction = .store
        guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        let isErase = brush.type == .eraser || brush.type == .kneaded || brush.type == .lightlift
        let pipeline = isErase ? dabPipelineEraser : dabPipelineAccumulator
        encodeDabs(dabs, preset: config.preset, into: encoder, pipeline: pipeline)
        encoder.endEncoding()
        buffer.commit()
    }

    /// Smudge (Krita «Smearing mode», web-paritet): kopier region rundt
    /// forrige posisjon fra akkumulatoren, stemple tilbake på ny posisjon
    /// med trykkstyrt styrke. Deterministisk — ingen random. Region-kopi
    /// via blit til temp-tekstur unngår les+skriv på samme tekstur.
    func smudgeStroke(_ stroke: PencilStroke, scale: Double) {
        guard let committed = committedTexture,
              stroke.points.count >= 2,
              let buffer = queue.makeCommandBuffer() else { return }
        let brushSize = stroke.brush?.size ?? 8
        // Soft focus: mye større region, mye svakere drag — jevner ut i
        // stedet for å dra (poor-man's dybdeuskarphet).
        let isSoftFocus = stroke.brush?.type == .softfocus
        let radius = max(6.0, brushSize * (isSoftFocus ? 1.1 : 1.5)) * scale
        let regionSide = Int((radius * 2).rounded(.up))
        if smudgeRegionTexture == nil || smudgeRegionTexture!.width < regionSide {
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(
                pixelFormat: .rgba8Unorm, width: regionSide, height: regionSide, mipmapped: false)
            descriptor.usage = [.shaderRead, .renderTarget]
            smudgeRegionTexture = device.makeTexture(descriptor: descriptor)
        }
        guard let region = smudgeRegionTexture else { return }

        var previous = stroke.points[0]
        for point in stroke.points.dropFirst() {
            let dx = (point.x - previous.x) * scale
            let dy = (point.y - previous.y) * scale
            guard (dx * dx + dy * dy).squareRoot() >= radius * 0.25 else { continue }

            // 1) Kopier region rundt FORRIGE posisjon (klampet til tekstur)
            let sourceX = max(0, min(committed.width - regionSide, Int(previous.x * scale - radius)))
            let sourceY = max(0, min(committed.height - regionSide, Int(previous.y * scale - radius)))
            guard let blitEncoder = buffer.makeBlitCommandEncoder() else { break }
            blitEncoder.copy(from: committed, sourceSlice: 0, sourceLevel: 0,
                             sourceOrigin: MTLOrigin(x: sourceX, y: sourceY, z: 0),
                             sourceSize: MTLSize(width: regionSide, height: regionSide, depth: 1),
                             to: region, destinationSlice: 0, destinationLevel: 0,
                             destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0))
            blitEncoder.endEncoding()

            // 2) Stemple regionen på NY posisjon med trykkstyrt styrke
            var strength = min(0.85, (0.2 + 0.5 * max(0.05, point.pressure)) * (stroke.brush?.opacity ?? 1))
            if isSoftFocus { strength *= 0.35 }
            let pass = MTLRenderPassDescriptor()
            pass.colorAttachments[0].texture = committed
            pass.colorAttachments[0].loadAction = .load
            pass.colorAttachments[0].storeAction = .store
            guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { break }
            encoder.setRenderPipelineState(smudgePipeline)
            var instance = DabInstanceData(
                position: SIMD2<Float>(Float(point.x * scale), Float(point.y * scale)),
                size: Float(regionSide),
                rotation: 0,
                alpha: Float(strength),
                color: SIMD3<Float>(1, 1, 1))
            withUnsafeBytes(of: &instance) { raw in
                encoder.setVertexBytes(raw.baseAddress!, length: raw.count, index: 0)
            }
            var viewport = canvasSize
            encoder.setVertexBytes(&viewport, length: MemoryLayout<SIMD2<Float>>.size, index: 1)
            encoder.setFragmentTexture(region, index: 0)
            encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4, instanceCount: 1)
            encoder.endEncoding()

            previous = point
        }
        buffer.commit()
    }

    /// Full rebuild (undo/clear/last inn dokument).
    func rebuild(strokes: [PencilStroke], scale: Double) {
        clearCommitted()
        // Én command-buffer per strøk metter command-køen (~64 in-flight) —
        // makeCommandBuffer() gir da nil og resten av strøkene droppes
        // stille. Batch: sammenhengende ikke-smudge-strøk encodes i ÉN
        // buffer/pass (pipeline byttes per strøk — rekkefølgen bevares);
        // smudge må fortsatt gå alene (leser committed via blit).
        guard let target = committedTexture else { return }
        var batch: [(dabs: [DabInstanceData], preset: DabPreset, erase: Bool)] = []

        func flushBatch() {
            guard !batch.isEmpty else { return }
            defer { batch = [] }
            guard let buffer = queue.makeCommandBuffer() else { return }
            let pass = MTLRenderPassDescriptor()
            pass.colorAttachments[0].texture = target
            pass.colorAttachments[0].loadAction = .load
            pass.colorAttachments[0].storeAction = .store
            guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
            for entry in batch {
                encodeDabs(entry.dabs, preset: entry.preset, into: encoder,
                           pipeline: entry.erase ? dabPipelineEraser : dabPipelineAccumulator)
            }
            encoder.endEncoding()
            buffer.commit()
        }

        for stroke in strokes {
            guard let brush = stroke.brush else { continue }
            if brush.type == .smudge || brush.type == .softfocus {
                flushBatch()
                smudgeStroke(stroke, scale: scale)
                continue
            }
            guard StampConfig.forBrush(brush.type) != nil else { continue }
            let isErase = brush.type == .eraser || brush.type == .kneaded || brush.type == .lightlift
            let preset = StampConfig.forBrush(brush.type)!.preset
            batch.append((cachedDabs(for: stroke, scale: scale), preset, isErase))
            // Hold batchen håndterlig (GPU-encode er billig; minne er poenget)
            if batch.count >= 40 { flushBatch() }
        }
        flushBatch()
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
                // Aktiv eraser kan ikke destination-out'e drawablen (papiret
                // ligger der) — ghost i papirfarge er visuelt ekvivalent
                // siden viskingen committes ekte ved stroke-end.
                var dabs = dabsForStroke(stroke, scale: scale)
                if brush.type == .eraser {
                    for index in dabs.indices {
                        dabs[index].color = paperColor
                        dabs[index].alpha = min(1, dabs[index].alpha + 0.25)
                    }
                }
                encodeDabs(dabs, preset: config.preset, into: encoder,
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

// Thumbnail: les akkumulatoren (rgba8 premultiplied), komposittér på hvit
// og gi web-kompatibel PNG-dataURL (lagres i frame.thumbnailUrl så
// SCENES-kolonnen/minimap viser native tegninger uten web-runde).
import UIKit

extension MetalStrokeRenderer {
    func thumbnailDataURL(maxWidth: CGFloat = 280) -> String? {
        guard let texture = committedTexture else { return nil }
        let width = texture.width, height = texture.height
        guard width > 0, height > 0 else { return nil }
        let bytesPerRow = width * 4
        var pixels = [UInt8](repeating: 0, count: bytesPerRow * height)
        texture.getBytes(&pixels, bytesPerRow: bytesPerRow,
                         from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let provider = CGDataProvider(data: Data(pixels) as CFData),
              let image = CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: bytesPerRow, space: colorSpace,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider, decode: nil, shouldInterpolate: true,
                intent: .defaultIntent) else { return nil }
        let scale = min(1, maxWidth / CGFloat(width))
        let outSize = CGSize(width: CGFloat(width) * scale, height: CGFloat(height) * scale)
        let renderer = UIGraphicsImageRenderer(size: outSize,
                                               format: {
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            return format
        }())
        let composited = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: outSize))
            UIImage(cgImage: image).draw(in: CGRect(origin: .zero, size: outSize))
        }
        // JPEG (hvit bakgrunn komposittert — ingen alpha å miste): ~1/3 av
        // PNG-størrelsen; hele scenen POSTes ved hver synk, så payload teller.
        guard let jpeg = composited.jpegData(compressionQuality: 0.7) else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }
}
