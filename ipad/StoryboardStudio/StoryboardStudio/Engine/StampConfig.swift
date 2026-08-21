import Foundation

// Stamp-semantikk i paritet med web stampEngine.ts (STAMP_CONFIG_BY_BRUSH):
// spacing i % av penselstørrelse, scatter, vinkel-jitter, tilt-rotasjon,
// trykk→størrelse/alpha, flow. Samme tall = samme strøk-karakter.

enum DabPreset: String, Sendable {
    case pencilGraphite
    case charcoalTooth
    case inkRound
    case markerChisel
}

struct StampConfig: Sendable {
    var preset: DabPreset
    var spacing: Double
    var scatter: Double
    var jitterAngleDeg: Double
    var tiltRotation: Bool
    var pressureToSize: Double
    var pressureToOpacity: Double
    var flow: Double
    var sizeMultiplier: Double

    static func forBrush(_ type: BrushType) -> StampConfig? {
        switch type {
        case .pencil:
            return StampConfig(preset: .pencilGraphite, spacing: 0.10, scatter: 0.06,
                               jitterAngleDeg: 18, tiltRotation: true,
                               pressureToSize: 0.75, pressureToOpacity: 0.55,
                               flow: 0.85, sizeMultiplier: 1.0)
        case .graphite:
            return StampConfig(preset: .pencilGraphite, spacing: 0.08, scatter: 0.05,
                               jitterAngleDeg: 12, tiltRotation: true,
                               pressureToSize: 0.6, pressureToOpacity: 0.6,
                               flow: 0.9, sizeMultiplier: 1.35)
        case .charcoal:
            return StampConfig(preset: .charcoalTooth, spacing: 0.12, scatter: 0.12,
                               jitterAngleDeg: 30, tiltRotation: true,
                               pressureToSize: 0.7, pressureToOpacity: 0.7,
                               flow: 0.8, sizeMultiplier: 1.6)
        case .conte:
            return StampConfig(preset: .charcoalTooth, spacing: 0.10, scatter: 0.07,
                               jitterAngleDeg: 16, tiltRotation: true,
                               pressureToSize: 0.65, pressureToOpacity: 0.55,
                               flow: 0.88, sizeMultiplier: 1.2)
        case .pen:
            return StampConfig(preset: .inkRound, spacing: 0.05, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.5, pressureToOpacity: 0.15,
                               flow: 1.0, sizeMultiplier: 1.0)
        case .ink:
            return StampConfig(preset: .inkRound, spacing: 0.05, scatter: 0.02,
                               jitterAngleDeg: 4, tiltRotation: false,
                               pressureToSize: 0.65, pressureToOpacity: 0.3,
                               flow: 1.0, sizeMultiplier: 1.0)
        case .marker:
            return StampConfig(preset: .markerChisel, spacing: 0.07, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: true,
                               pressureToSize: 0.3, pressureToOpacity: 0.2,
                               flow: 0.55, sizeMultiplier: 2.0)
        case .highlighter:
            // Bred, jevn, halvtransparent — flow gjør at overlapp ikke
            // mørkner mye (web: multiply-følelse approksimert).
            return StampConfig(preset: .markerChisel, spacing: 0.05, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.15, pressureToOpacity: 0.1,
                               flow: 0.22, sizeMultiplier: 3.0)
        case .eraser:
            // Piksel-viskelær: myk rund dab, rendres med destination-out-
            // blending i Metal (egen pipeline) — web-paritet.
            return StampConfig(preset: .inkRound, spacing: 0.06, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.6, pressureToOpacity: 0.3,
                               flow: 1.0, sizeMultiplier: 2.2)
        default:
            return nil
        }
    }
}

/// StreamLine-styrke per pensel — samme verdier som web STREAMLINE_BY_TYPE.
enum Streamline {
    static func amount(for type: BrushType) -> Double {
        switch type {
        case .pen: return 0.45
        case .ink: return 0.5
        case .marker, .highlighter: return 0.3
        case .smudge, .eraser: return 0.15
        default: return 0.2
        }
    }
}

/// mulberry32 — samme seedede rng som web (deterministisk per strøk-id).
struct SeededRandom {
    private var state: UInt32

    init(seedKey: String) {
        var h: UInt32 = 2_166_136_261
        for byte in seedKey.utf8 {
            h ^= UInt32(byte)
            h = h &* 16_777_619
        }
        state = h
    }

    mutating func next() -> Double {
        state = state &+ 0x6D2B_79F5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296.0
    }
}

/// Canvas-låst papirtann — to-oktav value-noise, samme formel som web
/// (stampEngine paperTooth) så grain-karakteren matcher.
enum PaperTooth {
    private static func valueNoise(_ x: Double, _ y: Double) -> Double {
        let n = sin(x * 12.9898 + y * 78.233) * 43758.5453
        return n - n.rounded(.down)
    }

    private static func smoothNoise(_ x: Double, _ y: Double) -> Double {
        let ix = x.rounded(.down), iy = y.rounded(.down)
        let fx = x - ix, fy = y - iy
        let ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
        let a = valueNoise(ix, iy)
        let b = valueNoise(ix + 1, iy)
        let c = valueNoise(ix, iy + 1)
        let d = valueNoise(ix + 1, iy + 1)
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
    }

    static func sample(_ x: Double, _ y: Double) -> Double {
        0.65 * smoothNoise(x, y) + 0.35 * smoothNoise(x * 2.7 + 11.3, y * 2.7 + 5.1)
    }
}
