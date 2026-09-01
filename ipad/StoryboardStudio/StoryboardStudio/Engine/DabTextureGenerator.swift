import Metal
import Foundation
import UIKit

// Prosedural dab-tekstur-generator — samme oppskrifter som web
// (stampEngine buildPencilGraphite/buildCharcoalTooth/...): r8-alpha-masker
// 128×128, generert ved init. Ingen disk-assets.

enum DabTextureGenerator {
    static let size = 128

    private static func productionAtlasName(for preset: DabPreset) -> String? {
        switch preset {
        case .crowdStamp: return "StampCrowdAtlas"
        case .treeStamp: return "StampTreeAtlas"
        case .windowStamp: return "StampWindowAtlas"
        case .carStamp: return "StampCarAtlas"
        case .chairStamp: return "StampChairAtlas"
        case .faceExpressionStamp: return "StampFaceAtlas"
        case .handPoseStamp: return "StampHandAtlas"
        case .cameraRigStamp: return "StampCameraRigAtlas"
        case .characterPoseStamp: return "StampCharacterPoseAtlas"
        case .doorStamp: return "StampDoorAtlas"
        case .tableStamp: return "StampTableAtlas"
        case .sofaStamp: return "StampSofaAtlas"
        case .buildingStamp: return "StampBuildingAtlas"
        case .streetLightStamp: return "StampStreetLightAtlas"
        case .boomMicStamp: return "StampBoomMicAtlas"
        case .filmLightStamp: return "StampFilmLightAtlas"
        case .bedStamp: return "StampBedAtlas"
        case .staircaseStamp: return "StampStaircaseAtlas"
        case .counterStamp: return "StampCounterAtlas"
        case .workstationStamp: return "StampWorkstationAtlas"
        case .communicationStamp: return "StampCommunicationAtlas"
        case .luggageStamp: return "StampLuggageAtlas"
        case .publicTransportStamp: return "StampPublicTransportAtlas"
        case .animalStamp: return "StampAnimalAtlas"
        case .rockTerrainStamp: return "StampRockTerrainAtlas"
        case .waterStamp: return "StampWaterAtlas"
        case .fireSmokeStamp: return "StampFireSmokeAtlas"
        case .weatherFXStamp: return "StampWeatherFXAtlas"
        default: return nil
        }
    }

    /// Leser én av fire atlasruter som en ren R8-blekkmaske. Nesten-hvitt
    /// papir blir transparent, mens grafittets naturlige tonevariasjon beholdes.
    /// Resultatet er fortsatt fargebart, transformerbart og viskbart av Metal-
    /// motoren; atlaset er formkilde, ikke et låst bakgrunnsbilde.
    private static func productionAtlasMask(
        preset: DabPreset, variant: Int, size: Int,
        stampInstance: ProductionStampInstance?
    ) -> [UInt8]? {
        guard let name = productionAtlasName(for: preset),
              let image = UIImage(named: name)?.cgImage else { return nil }
        let cellWidth = image.width / 2
        let cellHeight = image.height / 2
        guard cellWidth > 0, cellHeight > 0 else { return nil }
        let normalizedVariant = ((variant % 4) + 4) % 4
        let column = normalizedVariant % 2
        let row = normalizedVariant / 2
        guard let crop = image.cropping(to: CGRect(
            x: column * cellWidth, y: row * cellHeight,
            width: cellWidth, height: cellHeight)) else { return nil }

        var rgba = [UInt8](repeating: 255, count: size * size * 4)
        guard let context = CGContext(
            data: &rgba, width: size, height: size,
            bitsPerComponent: 8, bytesPerRow: size * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.interpolationQuality = .high
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        context.draw(crop, in: CGRect(x: 0, y: 0, width: size, height: size))

        let style = stampInstance?.styleProfileId.lowercased()
            ?? "trr-story-pencil"
        let exponent: Double = if style.contains("clean") || style.contains("ink") {
            0.82
        } else if style.contains("charcoal") || style.contains("rough") {
            0.56
        } else if style.contains("noir") {
            0.5
        } else {
            0.68
        }
        let styleGain: Double = style.contains("noir") ? 1.16
            : (style.contains("clean") ? 1.06 : 1)
        let depthGain: Double = switch stampInstance?.depth ?? .midground {
        case .background: 0.86
        case .midground: 0.94
        case .foreground: 1
        }
        let skew = stampInstance?.perspectiveSkew ?? 0
        let poseLean = Double(stampInstance?.parameters["poseLean"] ?? "0") ?? 0
        let totalSkew = min(0.45, max(-0.45, skew + poseLean * 0.18))
        var mask = [UInt8](repeating: 0, count: size * size)
        for y in 0..<size {
            let vertical = Double(y) / Double(max(1, size - 1)) - 0.5
            let shift = Int((vertical * Double(size) * totalSkew).rounded())
            for x in 0..<size {
                let sourceX = x - shift
                guard sourceX >= 0, sourceX < size else { continue }
                let source = (y * size + sourceX) * 4
                let red = Double(rgba[source])
                let green = Double(rgba[source + 1])
                let blue = Double(rgba[source + 2])
                let sourceAlpha = Double(rgba[source + 3]) / 255
                let luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
                // 249 gir transparent papir, men beholder lette
                // konstruksjonslinjer som vanlig terskling ville fjernet.
                let darkness = max(0, min(1, (249 - luminance) / 249))
                let ink = pow(darkness, exponent) * sourceAlpha
                    * styleGain * depthGain
                mask[y * size + x] = UInt8(min(255, max(0, ink * 255)))
            }
        }
        return mask
    }

    static func makeTexture(device: MTLDevice, preset: DabPreset,
                            variant: Int = 0, seed: UInt32 = 0,
                            stampInstance: ProductionStampInstance? = nil) -> MTLTexture? {
        // Production stamps trenger større kildemaske enn en løpende dab:
        // 512² holder flerpass-konturer skarpe også etter 4× skalering.
        let size = preset.isProductionStamp ? 512 : Self.size
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .r8Unorm, width: size, height: size, mipmapped: false)
        descriptor.usage = [.shaderRead]
        guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }

        var pixels = [UInt8](repeating: 0, count: size * size)
        var rng = SeededRandom(seedKey: "dab-\(preset.rawValue)-\(variant)-\(seed)")
        let center = Double(size) / 2
        let radius = Double(size) * 0.45
        let designScale = preset.isProductionStamp ? Double(size) / 128 : 1

        func plot(_ x: Double, _ y: Double, _ alpha: Double, _ dotRadius: Double) {
            let r = Int(dotRadius.rounded(.up))
            let xi = Int(x), yi = Int(y)
            for dy in -r...r {
                for dx in -r...r {
                    let px = xi + dx, py = yi + dy
                    guard px >= 0, px < size, py >= 0, py < size else { continue }
                    let dist = (Double(dx * dx + dy * dy)).squareRoot()
                    guard dist <= dotRadius else { continue }
                    let value = alpha * (1 - dist / max(dotRadius, 0.001) * 0.5)
                    let idx = py * size + px
                    pixels[idx] = max(pixels[idx], UInt8(min(255, value * 255)))
                }
            }
        }

        func radialBase(innerAlpha: Double, midAlpha: Double, midStop: Double) {
            for y in 0..<size {
                for x in 0..<size {
                    let dx = Double(x) - center, dy = Double(y) - center
                    let dist = (dx * dx + dy * dy).squareRoot() / radius
                    guard dist <= 1 else { continue }
                    let alpha: Double
                    if dist < midStop {
                        alpha = innerAlpha + (midAlpha - innerAlpha) * (dist / midStop)
                    } else {
                        alpha = midAlpha * (1 - (dist - midStop) / (1 - midStop))
                    }
                    pixels[y * size + x] = UInt8(min(255, alpha * 255))
                }
            }
        }

        // Små vektorprimitive som rasteriseres til den samme r8-masken som
        // resten av motoren. Dobbel, svakt ujevn kontur gir storyboardpreg
        // uten å bake inn tredjeparts-PNG-er.
        func line(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double,
                  alpha: Double = 0.9, width: Double = 1.15) {
            let sx1 = x1 * designScale, sy1 = y1 * designScale
            let sx2 = x2 * designScale, sy2 = y2 * designScale
            let scaledWidth = width * designScale
            let length = max(abs(sx2 - sx1), abs(sy2 - sy1))
            let steps = max(1, Int((length * 1.8).rounded(.up)))
            for step in 0...steps {
                let t = Double(step) / Double(steps)
                plot(sx1 + (sx2 - sx1) * t, sy1 + (sy2 - sy1) * t,
                     alpha, scaledWidth)
            }
        }

        func stampPlot(_ x: Double, _ y: Double, _ alpha: Double,
                       _ dotRadius: Double) {
            plot(x * designScale, y * designScale, alpha,
                 dotRadius * designScale)
        }

        func roughLine(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double,
                       alpha: Double = 0.86, width: Double = 1.05) {
            line(x1, y1, x2, y2, alpha: alpha, width: width)
            let dx = (rng.next() - 0.5) * 1.5
            let dy = (rng.next() - 0.5) * 1.5
            line(x1 + dx, y1 + dy, x2 + dx * 0.45, y2 + dy * 0.45,
                 alpha: alpha * 0.48, width: width * 0.72)
        }

        func polyline(_ points: [(Double, Double)], closed: Bool = false,
                      alpha: Double = 0.88, width: Double = 1.1) {
            guard points.count > 1 else { return }
            for index in 1..<points.count {
                roughLine(points[index - 1].0, points[index - 1].1,
                          points[index].0, points[index].1,
                          alpha: alpha, width: width)
            }
            if closed, let first = points.first, let last = points.last {
                roughLine(last.0, last.1, first.0, first.1,
                          alpha: alpha, width: width)
            }
        }

        func ellipse(_ cx: Double, _ cy: Double, _ rx: Double, _ ry: Double,
                     alpha: Double = 0.9, width: Double = 1.05,
                     start: Double = 0, end: Double = .pi * 2) {
            let steps = max(18, Int(max(rx, ry) * abs(end - start) * 1.4))
            var previous = (cx + cos(start) * rx, cy + sin(start) * ry)
            for step in 1...steps {
                let t = Double(step) / Double(steps)
                let angle = start + (end - start) * t
                let next = (cx + cos(angle) * rx, cy + sin(angle) * ry)
                line(previous.0, previous.1, next.0, next.1,
                     alpha: alpha, width: width)
                previous = next
            }
        }

        func rectangle(_ left: Double, _ top: Double,
                       _ right: Double, _ bottom: Double,
                       alpha: Double = 0.88, width: Double = 1.1) {
            polyline([(left, top), (right, top), (right, bottom), (left, bottom)],
                     closed: true, alpha: alpha, width: width)
        }

        // Stamp Engine 4.0: kuraterte high-fidelity atlas er normalbanen.
        // Underliggende compound-geometri beholdes for gamle dokumenter,
        // semantikk og «Frigjør til penselstrøk».
        if preset.isProductionStamp,
           let atlas = productionAtlasMask(
                preset: preset, variant: variant, size: size,
                stampInstance: stampInstance) {
            atlas.withUnsafeBytes { raw in
                texture.replace(region: MTLRegionMake2D(0, 0, size, size),
                                mipmapLevel: 0,
                                withBytes: raw.baseAddress!, bytesPerRow: size)
            }
            return texture
        }

        // Stamp Engine 3.0: alle production stamps rendres fra den samme
        // persisterte vektorgeometrien som kan frigjøres til PencilStroke.
        // De gamle switch-oppskriftene under beholdes som dekodingsfallback,
        // men nye/eldre stamps får denne skarpere flerpass-renderingen.
        if preset.isProductionStamp,
           let type = ProductionStampGeometryCatalog.brushType(for: preset) {
            let depth = stampInstance?.depth ?? .midground
            let style = stampInstance?.styleProfileId.lowercased()
                ?? "trr-story-pencil"
            let geometry = stampInstance?.compoundGeometry
                ?? ProductionStampGeometryCatalog.geometry(
                    for: type, variant: variant, seed: seed)
            let designSize = max(1, geometry.designSize)
            let skew = stampInstance?.perspectiveSkew ?? 0
            let isCharcoal = style.contains("charcoal") || style.contains("rough")
            let isClean = style.contains("clean") || style.contains("ink")
            let isNoir = style.contains("noir")
            let widthMultiplier = isCharcoal ? 1.34 : (isClean ? 0.9 : 1.08)
            let secondaryPasses = isClean ? 0 : (isCharcoal ? 2 : 1)

            for path in geometry.paths {
                let roleOpacity = ProductionStampGeometryCatalog.roleOpacity(
                    path.role, depth: depth)
                guard roleOpacity > 0, path.points.count > 1 else { continue }
                let alpha = min(1, path.opacity * roleOpacity
                    * (isNoir && path.role == .shadow ? 1.28 : 1))
                let width = path.lineWidth * widthMultiplier
                let points = path.points.map {
                    ProductionStampGeometryCatalog.skewed(
                        $0, designSize: designSize, skew: skew)
                }
                let segmentCount = path.closed ? points.count : points.count - 1
                for index in 0..<segmentCount {
                    let from = points[index]
                    let to = points[(index + 1) % points.count]
                    line(from.x, from.y, to.x, to.y,
                         alpha: alpha, width: width)
                    guard path.role != .construction else { continue }
                    for pass in 0..<secondaryPasses {
                        let amount = isCharcoal ? 1.15 : 0.62
                        let dx = (rng.next() - 0.5) * amount
                            * Double(pass + 1)
                        let dy = (rng.next() - 0.5) * amount
                            * Double(pass + 1)
                        line(from.x + dx, from.y + dy,
                             to.x + dx * 0.55, to.y + dy * 0.55,
                             alpha: alpha * (isCharcoal ? 0.34 : 0.24),
                             width: width * 0.72)
                    }
                }
            }

            // Grafitt-tann bryter opp den perfekte digitale masken uten å
            // endre silhuetten. Clean Production beholder nesten ren linje.
            let grainAmount = isClean ? 0.035 : (isCharcoal ? 0.22 : 0.11)
            if grainAmount > 0 {
                for index in pixels.indices where pixels[index] > 0 {
                    let tooth = 1 - grainAmount * rng.next()
                    pixels[index] = UInt8(Double(pixels[index]) * tooth)
                }
            }
            pixels.withUnsafeBytes { raw in
                texture.replace(region: MTLRegionMake2D(0, 0, size, size),
                                mipmapLevel: 0,
                                withBytes: raw.baseAddress!, bytesPerRow: size)
            }
            return texture
        }

        switch preset {
        case .pencilGraphite:
            radialBase(innerAlpha: 0.55, midAlpha: 0.35, midStop: 0.6)
            for _ in 0..<220 {
                let angle = rng.next() * .pi * 2
                let r = rng.next().squareRoot() * radius * 0.95
                let fade = 1 - r / radius
                plot(center + cos(angle) * r, center + sin(angle) * r,
                     0.18 + rng.next() * 0.5 * fade, 0.4 + rng.next() * 1.1)
            }
        case .charcoalTooth:
            radialBase(innerAlpha: 0.7, midAlpha: 0.18, midStop: 0.7)
            for _ in 0..<90 {
                let angle = rng.next() * .pi * 2
                let r = pow(rng.next(), 0.7) * radius
                plot(center + cos(angle) * r, center + sin(angle) * r,
                     0.05 + rng.next() * 0.55, 0.6 + rng.next() * 3.2)
            }
        case .inkRound:
            // Hard rund kjerne med kort myk kant.
            for y in 0..<size {
                for x in 0..<size {
                    let dx = Double(x) - center, dy = Double(y) - center
                    let dist = (dx * dx + dy * dy).squareRoot() / radius
                    guard dist <= 1 else { continue }
                    let alpha = dist < 0.82 ? 1.0 : max(0, 1 - (dist - 0.82) / 0.18)
                    pixels[y * size + x] = UInt8(min(255, alpha * 255))
                }
            }
        case .softRound:
            // Gaussisk falloff — kontinuerlig myk tone uten kant.
            for y in 0..<size {
                for x in 0..<size {
                    let dx = (Double(x) - center) / radius
                    let dy = (Double(y) - center) / radius
                    let dist2 = dx * dx + dy * dy
                    guard dist2 <= 1 else { continue }
                    let alpha = exp(-dist2 * 3.2)
                    pixels[y * size + x] = UInt8(min(255, alpha * 255))
                }
            }
        case .halftoneDot:
            // Hard sirkel med minimal antialiasing — screen tone-raster.
            for y in 0..<size {
                for x in 0..<size {
                    let dx = (Double(x) - center) / radius
                    let dy = (Double(y) - center) / radius
                    let dist = (dx * dx + dy * dy).squareRoot()
                    guard dist <= 1 else { continue }
                    let alpha = dist < 0.9 ? 1.0 : max(0, 1 - (dist - 0.9) / 0.1)
                    pixels[y * size + x] = UInt8(min(255, alpha * 255))
                }
            }
        case .skinPore:
            // Porøs hud: svak myk base + tett felt av små porer (mørke
            // prikker med lysere ringer rundt — plot legger max, så vi
            // legger base lav og prikker over).
            radialBase(innerAlpha: 0.30, midAlpha: 0.16, midStop: 0.55)
            for _ in 0..<160 {
                let angle = rng.next() * .pi * 2
                let r = rng.next().squareRoot() * radius * 0.92
                let fade = 1 - r / radius * 0.6
                plot(center + cos(angle) * r, center + sin(angle) * r,
                     0.25 + rng.next() * 0.45 * fade, 0.7 + rng.next() * 1.6)
            }
            // Noen dypere porer
            for _ in 0..<26 {
                let angle = rng.next() * .pi * 2
                let r = rng.next().squareRoot() * radius * 0.8
                plot(center + cos(angle) * r, center + sin(angle) * r,
                     0.7 + rng.next() * 0.3, 1.4 + rng.next() * 1.4)
            }
        case .rockGrit:
            // Kantete grus: harde småflekker og korte skarpe streker,
            // ingen myk base — brutt, mineralsk karakter.
            for _ in 0..<70 {
                let angle = rng.next() * .pi * 2
                let r = rng.next().squareRoot() * radius * 0.9
                let cx = center + cos(angle) * r
                let cy = center + sin(angle) * r
                let strokeAngle = rng.next() * .pi * 2
                let length = 2 + rng.next() * 7
                let steps = Int(length)
                let alpha = 0.45 + rng.next() * 0.55
                for step in 0...steps {
                    let t = Double(step) / Double(max(1, steps))
                    plot(cx + cos(strokeAngle) * length * t,
                         cy + sin(strokeAngle) * length * t,
                         alpha, 0.8 + rng.next() * 0.9)
                }
            }
        case .markerChisel:
            // Bred flat meisel: ellipse, jevn dekning, myk kortside.
            for y in 0..<size {
                for x in 0..<size {
                    let dx = (Double(x) - center) / (radius * 1.0)
                    let dy = (Double(y) - center) / (radius * 0.45)
                    let dist = (dx * dx + dy * dy).squareRoot()
                    guard dist <= 1 else { continue }
                    let alpha = dist < 0.75 ? 0.85 : 0.85 * (1 - (dist - 0.75) / 0.25)
                    pixels[y * size + x] = UInt8(min(255, alpha * 255))
                }
            }
        case .crowdStamp:
            let v = ((variant % 4) + 4) % 4
            let count = [5, 7, 12, 7][v]
            let columns = v == 2 ? 5 : 4
            for index in 0..<count {
                let row = index / columns, column = index % columns
                let rowCount = min(columns, count - row * columns)
                let spacing = 82.0 / Double(max(1, rowCount - 1))
                let x = 23 + Double(column) * spacing
                    + (rng.next() - 0.5) * (v == 2 ? 7 : 11)
                let y = 39 + Double(row) * 28 + (rng.next() - 0.5) * 7
                let head = (v == 3 && row == 0 ? 9.5 : 6.2)
                    + rng.next() * 2.4
                let lean = v == 1 ? 7.0 : (rng.next() - 0.5) * 5
                ellipse(x, y, head, head * 1.08, alpha: 0.88, width: 1.05)
                let shoulderY = y + head + 5
                let baseY = min(112, shoulderY + 22 + rng.next() * 9)
                polyline([(x - head, shoulderY), (x + head, shoulderY + 1),
                          (x + head * 1.15 + lean, baseY),
                          (x - head * 1.05 + lean, baseY)],
                         closed: true, alpha: 0.72, width: 1.05)
                if v == 1 {
                    roughLine(x - 2, baseY, x + 7, min(114, baseY + 12),
                              alpha: 0.62, width: 0.9)
                    roughLine(x + 4, baseY, x + 16, min(111, baseY + 8),
                              alpha: 0.62, width: 0.9)
                } else if v == 3 && index < 3 {
                    roughLine(x - head, shoulderY + 4, x - head - 8, shoulderY - 7,
                              alpha: 0.7, width: 1)
                    roughLine(x + head, shoulderY + 4, x + head + 8, shoulderY - 5,
                              alpha: 0.7, width: 1)
                }
            }
            roughLine(14, 114, 114, 114, alpha: 0.38, width: 0.8)
        case .treeStamp:
            let v = ((variant % 4) + 4) % 4
            if v == 1 {
                // Furu: tydelig trekantet rytme og en synlig stamme.
                roughLine(64, 20, 64, 114, alpha: 0.82, width: 1.35)
                for level in 0..<7 {
                    let y = 28 + Double(level) * 11
                    let half = 12 + Double(level) * 4.5
                    polyline([(64, y - 12), (64 - half, y + 11),
                              (64, y + 5), (64 + half, y + 11)],
                             alpha: 0.84, width: 1.1)
                }
            } else if v == 3 {
                // Vintertre: åpen silhuett, ingen løvmasse.
                polyline([(58, 114), (61, 73), (58, 48), (64, 20),
                          (69, 48), (67, 75), (73, 114)],
                         closed: true, alpha: 0.9, width: 1.3)
                let branches: [(Double, Double, Double, Double)] = [
                    (62, 80, 31, 58), (66, 72, 98, 48), (61, 60, 38, 36),
                    (67, 55, 86, 28), (63, 43, 54, 24), (49, 48, 27, 43),
                    (83, 39, 105, 34),
                ]
                for branch in branches {
                    roughLine(branch.0, branch.1, branch.2, branch.3,
                              alpha: 0.76, width: 1)
                }
            } else {
                let wind = v == 2 ? 15.0 : 0
                polyline([(55, 114), (59, 73), (55, 57), (63, 46),
                          (70, 57), (68, 76), (75, 114)],
                         closed: true, alpha: 0.88, width: 1.35)
                roughLine(62, 76, 38 + wind, 55, alpha: 0.68, width: 1)
                roughLine(67, 69, 93 + wind, 48, alpha: 0.68, width: 1)
                polyline([(20 + wind, 65), (28 + wind, 44), (43 + wind, 37),
                          (47 + wind, 23), (64 + wind, 18), (77 + wind, 27),
                          (92 + wind, 31), (107 + wind, 49), (102 + wind, 68),
                          (87 + wind, 77), (69 + wind, 73), (55 + wind, 82),
                          (38 + wind, 73)],
                         closed: true, alpha: 0.88, width: 1.2)
                for _ in 0..<6 {
                    let cx = 38 + wind + rng.next() * 55
                    let cy = 38 + rng.next() * 30
                    ellipse(cx, cy, 9 + rng.next() * 7, 7 + rng.next() * 5,
                            alpha: 0.34, width: 0.7)
                }
            }
            roughLine(38, 115, 91, 115, alpha: 0.44, width: 0.8)
        case .windowStamp:
            let v = ((variant % 4) + 4) % 4
            let outer: [(Double, Double)] = v == 1
                ? [(38, 12), (91, 15), (89, 115), (40, 112)]
                : [(23, 20), (104, 23), (101, 109), (27, 106)]
            polyline(outer, closed: true, alpha: 0.92, width: 1.4)
            if v == 2 {
                polyline([(31, 28), (63, 29), (63, 101), (34, 98)],
                         closed: true, alpha: 0.76, width: 0.95)
                polyline([(66, 29), (95, 31), (111, 91), (67, 101)],
                         closed: true, alpha: 0.9, width: 1.2)
                roughLine(97, 61, 106, 61, alpha: 0.72, width: 1)
            } else if v == 3 {
                for column in 1...3 {
                    let x = 24 + Double(column) * 20
                    roughLine(x, 22, x + 2, 108, alpha: 0.72, width: 0.9)
                }
                for row in 1...2 {
                    let y = 21 + Double(row) * 29
                    roughLine(25, y, 102, y + 2, alpha: 0.72, width: 0.9)
                }
            } else {
                let middleX = v == 1 ? 64.5 : 64
                roughLine(middleX, 18, middleX, 108, alpha: 0.76, width: 1)
                roughLine(27, 64, 101, 65, alpha: 0.76, width: 1)
            }
            roughLine(34, 30, 56, 57, alpha: 0.32, width: 0.65)
            roughLine(70, 71, 92, 98, alpha: 0.32, width: 0.65)
        case .carStamp:
            let v = ((variant % 4) + 4) % 4
            let roofTop = v == 1 ? 31.0 : (v == 2 ? 27 : 39)
            let roofBack = v == 2 ? 34.0 : 48
            let roofFront = v == 2 ? 92.0 : 79
            let hoodY = v == 1 ? 56.0 : 61
            polyline([(13, 79), (21, 62), (roofBack - 10, 57),
                      (roofBack, roofTop), (roofFront, roofTop + (v == 1 ? 2 : 0)),
                      (96, hoodY), (111, 65), (115, 83), (106, 91),
                      (21, 91), (13, 86)],
                     closed: true, alpha: 0.92, width: 1.35)
            polyline([(roofBack - 3, 57), (roofBack + 5, roofTop + 5),
                      (roofFront - 5, roofTop + 5), (91, 59)],
                     alpha: 0.72, width: 0.9)
            roughLine(67, roofTop + 4, 68, 59, alpha: 0.56, width: 0.8)
            let wheelY = 90.0
            for wheelX in [36.0, 93.0] {
                ellipse(wheelX, wheelY, 11, 11, alpha: 0.94, width: 1.65)
                ellipse(wheelX, wheelY, 4, 4, alpha: 0.62, width: 0.9)
            }
            if v == 3 {
                rectangle(57, roofTop - 7, 72, roofTop, alpha: 0.84, width: 1)
                roughLine(60, roofTop - 8, 67, roofTop - 11, alpha: 0.62, width: 0.8)
                roughLine(69, roofTop - 11, 74, roofTop - 7, alpha: 0.62, width: 0.8)
            }
            if v == 1 { roughLine(21, 70, 109, 72, alpha: 0.38, width: 0.7) }
            if v == 2 { rectangle(74, 34, 91, 57, alpha: 0.46, width: 0.7) }
        case .chairStamp:
            let v = ((variant % 4) + 4) % 4
            if v == 1 {
                ellipse(64, 58, 31, 25, alpha: 0.9, width: 1.3,
                        start: .pi, end: .pi * 2)
                polyline([(34, 54), (94, 55), (88, 77), (40, 75)],
                         closed: true, alpha: 0.9, width: 1.25)
                roughLine(64, 76, 64, 101, alpha: 0.86, width: 1.4)
                polyline([(64, 99), (42, 111), (64, 104), (86, 112)],
                         alpha: 0.78, width: 1.1)
                ellipse(42, 112, 3, 3, alpha: 0.72, width: 0.8)
                ellipse(86, 112, 3, 3, alpha: 0.72, width: 0.8)
            } else if v == 2 {
                polyline([(30, 36), (42, 24), (86, 25), (98, 38),
                          (94, 82), (82, 91), (45, 90), (33, 81)],
                         closed: true, alpha: 0.9, width: 1.4)
                polyline([(36, 65), (92, 65), (86, 84), (42, 84)],
                         closed: true, alpha: 0.72, width: 0.9)
                roughLine(43, 88, 38, 111, alpha: 0.84, width: 1.25)
                roughLine(84, 89, 90, 111, alpha: 0.84, width: 1.25)
            } else if v == 3 {
                polyline([(37, 34), (50, 61), (78, 61), (91, 34)],
                         closed: true, alpha: 0.9, width: 1.25)
                polyline([(35, 68), (92, 68), (81, 82), (46, 82)],
                         closed: true, alpha: 0.9, width: 1.25)
                roughLine(41, 82, 34, 112, alpha: 0.86, width: 1.3)
                roughLine(86, 82, 94, 112, alpha: 0.86, width: 1.3)
                roughLine(38, 43, 91, 43, alpha: 0.5, width: 0.8)
            } else {
                polyline([(38, 23), (83, 25), (80, 67), (41, 65)],
                         closed: true, alpha: 0.9, width: 1.3)
                roughLine(43, 35, 79, 36, alpha: 0.46, width: 0.75)
                roughLine(42, 49, 79, 50, alpha: 0.46, width: 0.75)
                polyline([(35, 69), (87, 70), (78, 84), (42, 82)],
                         closed: true, alpha: 0.9, width: 1.35)
                roughLine(43, 82, 36, 112, alpha: 0.86, width: 1.4)
                roughLine(77, 84, 84, 112, alpha: 0.86, width: 1.4)
            }
            roughLine(29, 114, 99, 114, alpha: 0.35, width: 0.7)
        case .faceExpressionStamp:
            let v = ((variant % 4) + 4) % 4
            ellipse(64, 64, 43, 50, alpha: 0.88, width: 1.3)
            if v == 0 {
                roughLine(35, 44, 51, 39, alpha: 0.86, width: 1.25)
                roughLine(77, 39, 93, 44, alpha: 0.86, width: 1.25)
                ellipse(44, 54, 7, 9, alpha: 0.86, width: 1.1)
                ellipse(84, 54, 7, 9, alpha: 0.86, width: 1.1)
                ellipse(64, 89, 11, 15, alpha: 0.9, width: 1.25)
            } else if v == 1 {
                ellipse(44, 54, 9, 6, alpha: 0.84, width: 1.15,
                        start: 0, end: .pi)
                ellipse(84, 54, 9, 6, alpha: 0.84, width: 1.15,
                        start: 0, end: .pi)
                ellipse(64, 78, 22, 18, alpha: 0.9, width: 1.3,
                        start: 0.12, end: .pi - 0.12)
            } else if v == 2 {
                roughLine(34, 42, 52, 47, alpha: 0.84, width: 1.2)
                roughLine(76, 47, 94, 42, alpha: 0.84, width: 1.2)
                ellipse(44, 55, 7, 6, alpha: 0.82, width: 1)
                ellipse(84, 55, 7, 6, alpha: 0.82, width: 1)
                ellipse(64, 98, 18, 13, alpha: 0.88, width: 1.2,
                        start: .pi + 0.15, end: .pi * 2 - 0.15)
            } else {
                roughLine(34, 40, 53, 48, alpha: 0.9, width: 1.35)
                roughLine(75, 48, 94, 40, alpha: 0.9, width: 1.35)
                roughLine(37, 56, 51, 54, alpha: 0.82, width: 1.1)
                roughLine(77, 54, 91, 56, alpha: 0.82, width: 1.1)
                roughLine(48, 91, 64, 86, alpha: 0.88, width: 1.25)
                roughLine(64, 86, 80, 91, alpha: 0.88, width: 1.25)
            }
            stampPlot(44, 55, 0.86, 2.1)
            stampPlot(84, 55, 0.86, 2.1)
            polyline([(64, 57), (59, 72), (66, 74)],
                     alpha: 0.6, width: 0.85)
        case .handPoseStamp:
            let v = ((variant % 4) + 4) % 4
            if v == 1 {
                // Peker: lang pekefinger og samlet grep.
                polyline([(40, 112), (39, 79), (47, 65), (50, 37),
                          (58, 35), (60, 68), (88, 62), (105, 65),
                          (105, 72), (77, 78), (88, 85), (84, 96),
                          (72, 112)],
                         closed: true, alpha: 0.92, width: 1.3)
                roughLine(59, 70, 96, 68, alpha: 0.46, width: 0.75)
            } else if v == 2 {
                // Knyttet hånd: overlappende knoker og kompakt masse.
                polyline([(39, 109), (35, 72), (42, 50), (53, 43),
                          (83, 45), (96, 58), (94, 82), (78, 101),
                          (72, 113)],
                         closed: true, alpha: 0.92, width: 1.35)
                for index in 0..<4 {
                    let x = 48 + Double(index) * 12
                    ellipse(x, 57 + Double(index % 2), 7, 10,
                            alpha: 0.68, width: 0.9, start: .pi, end: .pi * 2)
                }
                roughLine(43, 78, 79, 82, alpha: 0.52, width: 0.8)
            } else if v == 3 {
                // Grep rundt en usynlig prop-akse.
                polyline([(40, 113), (38, 82), (44, 59), (51, 43),
                          (58, 45), (55, 69), (64, 49), (71, 51),
                          (67, 72), (78, 56), (85, 60), (78, 79),
                          (91, 72), (97, 78), (82, 98), (72, 113)],
                         closed: true, alpha: 0.92, width: 1.3)
                ellipse(69, 76, 17, 21, alpha: 0.42, width: 0.75,
                        start: .pi * 0.1, end: .pi * 0.95)
                roughLine(60, 49, 61, 94, alpha: 0.3, width: 0.65)
            } else {
                polyline([(47, 113), (43, 83), (34, 71), (29, 57), (35, 53),
                          (46, 68), (42, 36), (49, 33), (56, 64), (55, 22),
                          (63, 20), (66, 62), (72, 29), (79, 30), (77, 66),
                          (88, 43), (95, 47), (85, 78), (80, 96), (72, 113)],
                         closed: true, alpha: 0.92, width: 1.3)
                roughLine(51, 77, 69, 93, alpha: 0.4, width: 0.7)
                roughLine(46, 88, 64, 103, alpha: 0.34, width: 0.65)
            }
        case .cameraRigStamp:
            let v = ((variant % 4) + 4) % 4
            rectangle(32, 43, 87, 78, alpha: 0.92, width: 1.35)
            polyline([(87, 51), (105, 46), (112, 52), (112, 70),
                      (105, 76), (87, 70)],
                     closed: true, alpha: 0.9, width: 1.2)
            ellipse(57, 60, 13, 13, alpha: 0.84, width: 1.05)
            if v == 0 {
                roughLine(59, 78, 47, 113, alpha: 0.88, width: 1.3)
                roughLine(60, 78, 73, 113, alpha: 0.88, width: 1.3)
                roughLine(60, 78, 60, 113, alpha: 0.68, width: 1)
            } else if v == 1 {
                polyline([(34, 78), (25, 92), (34, 97), (48, 79)],
                         alpha: 0.78, width: 1.1)
                roughLine(78, 78, 91, 94, alpha: 0.78, width: 1.1)
                roughLine(91, 94, 103, 89, alpha: 0.58, width: 0.85)
            } else if v == 2 {
                roughLine(20, 91, 108, 91, alpha: 0.82, width: 1.2)
                roughLine(25, 99, 104, 99, alpha: 0.58, width: 0.9)
                for wheelX in [27.0, 101.0] {
                    ellipse(wheelX, 103, 5, 5, alpha: 0.76, width: 0.9)
                }
                roughLine(57, 78, 57, 91, alpha: 0.82, width: 1.1)
            } else {
                roughLine(20, 108, 107, 108, alpha: 0.7, width: 1.05)
                roughLine(33, 108, 43, 28, alpha: 0.86, width: 1.25)
                roughLine(43, 28, 100, 24, alpha: 0.86, width: 1.25)
                roughLine(90, 25, 77, 43, alpha: 0.72, width: 1)
                ellipse(31, 110, 5, 5, alpha: 0.72, width: 0.9)
                ellipse(104, 110, 5, 5, alpha: 0.72, width: 0.9)
            }
            // Lens cone: viser kameraets retning i blocking-diagrammet.
            polyline([(112, 55), (124, 48), (124, 78), (112, 68)],
                     alpha: 0.45, width: 0.8)
        case .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp:
            // Normalbanen returnerer tidligere fra high-fidelity-atlas eller
            // compound-geometri. Denne nødsilhuetten holder teksturen gyldig
            // dersom et fremtidig dokument mangler begge kildene.
            rectangle(24, 22, 104, 106, alpha: 0.82, width: 1.2)
            roughLine(24, 22, 104, 106, alpha: 0.34, width: 0.7)
            roughLine(104, 22, 24, 106, alpha: 0.34, width: 0.7)
        }

        pixels.withUnsafeBytes { raw in
            texture.replace(region: MTLRegionMake2D(0, 0, size, size),
                            mipmapLevel: 0,
                            withBytes: raw.baseAddress!,
                            bytesPerRow: size)
        }
        return texture
    }
}
