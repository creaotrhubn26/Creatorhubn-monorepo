import Metal
import Foundation

// Prosedural dab-tekstur-generator — samme oppskrifter som web
// (stampEngine buildPencilGraphite/buildCharcoalTooth/...): r8-alpha-masker
// 128×128, generert ved init. Ingen disk-assets.

enum DabTextureGenerator {
    static let size = 128

    static func makeTexture(device: MTLDevice, preset: DabPreset) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .r8Unorm, width: size, height: size, mipmapped: false)
        descriptor.usage = [.shaderRead]
        guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }

        var pixels = [UInt8](repeating: 0, count: size * size)
        var rng = SeededRandom(seedKey: "dab-\(preset.rawValue)")
        let center = Double(size) / 2
        let radius = Double(size) * 0.45

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
