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

// Prosedural skravering (spec §10/§37): parametre for hatch-merkene.
struct HatchParams: Sendable {
    var lineLength: Double      // px i innholdsrom (skaleres med size/34)
    var lineSpacing: Double     // avstand mellom merker
    var lineWidth: Double
    var angle: Double           // radianer (35°)
    var angleJitter: Double
    var crossAngle: Double      // 112° — bevisst ikke 90° fra primær
    var positionJitter: Double
    var lengthJitter: Double
}

// Prosedural miljøtekstur-modus (spec §56–§66).
enum EnvironmentalMode: Sendable {
    case forest, debris, organic, fur
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
    // Story Brush Engine-dynamikk (spec §8–§15). Defaults = nøytral
    // (eksisterende pensler uendret).
    var pressureCurve: Double = 1        // pow-eksponent på pressure
    var velocityToSize: Double = 0       // negativ = raskere → tynnere
    var velocityToOpacity: Double = 0
    var wobble: Double = 0               // lavfrekvent smooth noise, px
    var taperDistance: Double = 0        // px inn/ut-taper (Ink)
    var tiltOval: Double = 0             // 0..1: tilt → bred/flat oval (Shade)
    var sizeJitter: Double = 0           // per-dab størrelsesvariasjon (Grain)
    var directionTexture: Double = 0     // mikrolinjer i strøkretning (Shade 2.0)
    var hatch: HatchParams? = nil
    // Fase 2 (spec §56): prosedural miljøtekstur — mange strukturer per sample.
    var environmental: EnvironmentalMode? = nil

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
                               flow: 1.0, sizeMultiplier: 1.0,
                               pressureCurve: 0.75, velocityToSize: -0.18,
                               taperDistance: 12)
        case .ink:
            // Story Ink (spec §9): taper inn/ut, pressure → bredde primært.
            return StampConfig(preset: .inkRound, spacing: 0.045, scatter: 0.02,
                               jitterAngleDeg: 4, tiltRotation: false,
                               pressureToSize: 0.92, pressureToOpacity: 0.12,
                               flow: 1.0, sizeMultiplier: 1.0,
                               pressureCurve: 0.75, velocityToSize: -0.18,
                               taperDistance: 12)
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
        // ── Story Brush Engine (spec §8, §34–§40, §67) ──
        case .layout:
            return StampConfig(preset: .pencilGraphite, spacing: 0.09, scatter: 0.08,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.58, pressureToOpacity: 0.52,
                               flow: 0.55, sizeMultiplier: 1.0,
                               pressureCurve: 0.65,
                               velocityToSize: -0.08, velocityToOpacity: -0.18,
                               wobble: 0.14)
        case .heavy:
            return StampConfig(preset: .pencilGraphite, spacing: 0.08, scatter: 0.10,
                               jitterAngleDeg: 14, tiltRotation: true,
                               pressureToSize: 0.78, pressureToOpacity: 0.72,
                               flow: 0.8, sizeMultiplier: 1.15,
                               pressureCurve: 0.65,
                               velocityToSize: -0.12, velocityToOpacity: -0.24,
                               wobble: 0.16)
        case .detail:
            return StampConfig(preset: .inkRound, spacing: 0.045, scatter: 0.025,
                               jitterAngleDeg: 5, tiltRotation: false,
                               pressureToSize: 0.88, pressureToOpacity: 0.38,
                               flow: 0.85, sizeMultiplier: 1.0,
                               pressureCurve: 0.7,
                               velocityToSize: -0.10, velocityToOpacity: -0.10,
                               wobble: 0.05, taperDistance: 6)
        case .hatch:
            return StampConfig(preset: .inkRound, spacing: 0.14, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.4,
                               flow: 0.9, sizeMultiplier: 1.0,
                               pressureCurve: 0.75,
                               hatch: HatchParams(lineLength: 15, lineSpacing: 5,
                                                  lineWidth: 0.85,
                                                  angle: 35 * .pi / 180, angleJitter: 0.06,
                                                  crossAngle: 112 * .pi / 180,
                                                  positionJitter: 1.2, lengthJitter: 0.15))
        case .crosshatch:
            return StampConfig(preset: .inkRound, spacing: 0.14, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.4,
                               flow: 0.9, sizeMultiplier: 1.0,
                               pressureCurve: 0.75,
                               hatch: HatchParams(lineLength: 15, lineSpacing: 5,
                                                  lineWidth: 0.85,
                                                  angle: 35 * .pi / 180, angleJitter: 0.06,
                                                  crossAngle: 112 * .pi / 180,
                                                  positionJitter: 1.2, lengthJitter: 0.15))
        case .shade:
            // Siden av grafittblyanten: oval, tilt-styrt, build-up (§11/§38).
            return StampConfig(preset: .charcoalTooth, spacing: 0.075, scatter: 0.04,
                               jitterAngleDeg: 6, tiltRotation: true,
                               pressureToSize: 0.40, pressureToOpacity: 0.70,
                               flow: 0.5, sizeMultiplier: 1.0,
                               pressureCurve: 0.8,
                               velocityToOpacity: -0.18,
                               wobble: 0.3, tiltOval: 0.9, sizeJitter: 0.13,
                               directionTexture: 0.55)
        case .graintex:
            // Dry graphite scatter (§39): ujevn, aldri airbrush-jevn.
            return StampConfig(preset: .charcoalTooth, spacing: 0.18, scatter: 0.72,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.56,
                               flow: 0.6, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, sizeJitter: 0.42)
        case .kneaded:
            // Teksturert grafitt-løft (§40): destination-out m/ grain-alpha.
            return StampConfig(preset: .charcoalTooth, spacing: 0.08, scatter: 0.05,
                               jitterAngleDeg: 20, tiltRotation: false,
                               pressureToSize: 0.3, pressureToOpacity: 0.72,
                               flow: 0.6, sizeMultiplier: 1.0,
                               pressureCurve: 0.72)
        case .lightlift:
            // Atmosfærisk lys (§67): svært lav flow, myk, gradvis.
            return StampConfig(preset: .inkRound, spacing: 0.06, scatter: 0.1,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.58,
                               flow: 0.35, sizeMultiplier: 1.0,
                               pressureCurve: 0.55)
        case .forest:
            return StampConfig(preset: .inkRound, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.46, pressureToOpacity: 0.4,
                               flow: 0.85, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .forest)
        case .debris:
            return StampConfig(preset: .inkRound, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.38, pressureToOpacity: 0.4,
                               flow: 0.8, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .debris)
        case .organictex:
            return StampConfig(preset: .charcoalTooth, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.4, pressureToOpacity: 0.74,
                               flow: 0.75, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .organic)
        case .fur:
            return StampConfig(preset: .inkRound, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.4, pressureToOpacity: 0.4,
                               flow: 0.75, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .fur)
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
        // Story Brush Engine (spec §6)
        case .layout: return 0.28
        case .detail: return 0.35
        case .hatch, .crosshatch: return 0.3
        case .shade: return 0.16
        case .heavy: return 0.16
        case .graintex, .kneaded, .lightlift: return 0.15
        case .forest, .debris, .organictex, .fur: return 0.2
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

/// Lavfrekvent smooth noise for menneskelig wobble (spec §15) —
/// deterministisk funksjon av avstand langs strøket.
enum WobbleNoise {
    static func sample(_ t: Double) -> Double {
        sin(t * 1.13) * 0.5 + sin(t * 0.47) * 0.3 + sin(t * 2.17) * 0.2
    }
}
