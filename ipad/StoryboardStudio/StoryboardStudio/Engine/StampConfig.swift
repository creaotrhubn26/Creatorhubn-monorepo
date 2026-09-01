import Foundation

// Stamp-semantikk i paritet med web stampEngine.ts (STAMP_CONFIG_BY_BRUSH):
// spacing i % av penselstørrelse, scatter, vinkel-jitter, tilt-rotasjon,
// trykk→størrelse/alpha, flow. Samme tall = samme strøk-karakter.

enum DabPreset: String, Sendable {
    case pencilGraphite
    case charcoalTooth
    case inkRound
    case markerChisel
    // Rendering-klassen (foto-referanse-nivå)
    case softRound      // gaussisk falloff — ren myk tone (airbrush)
    case halftoneDot    // hard sirkel — screen tone-raster
    case skinPore       // porøs hud-mikrotekstur
    case rockGrit       // kantete stein/gjørme-grus
    // Originale prosedurale produksjonsstempler.
    case crowdStamp, treeStamp, windowStamp, carStamp, chairStamp
    case faceExpressionStamp, handPoseStamp, cameraRigStamp
    case characterPoseStamp, doorStamp, tableStamp, sofaStamp
    case buildingStamp, streetLightStamp, boomMicStamp, filmLightStamp
    case bedStamp, staircaseStamp, counterStamp, workstationStamp
    case communicationStamp, luggageStamp, publicTransportStamp, animalStamp
    case rockTerrainStamp, waterStamp, fireSmokeStamp, weatherFXStamp
}

extension DabPreset {
    var isProductionStamp: Bool {
        switch self {
        case .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
             .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
             .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp:
            return true
        default:
            return false
        }
    }
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
    // Speed lines: merkene følger strøkretningen i stedet for fast vinkel,
    // og kryss-laget slås aldri på.
    var followDirection: Bool = false
    var allowCross: Bool = true
}

// Prosedural miljøtekstur-modus (spec §56–§66).
enum EnvironmentalMode: Sendable {
    case forest, debris, organic, fur
    case wethair   // lange kurvede strå med heng (rendering-klassen)
    case spikes    // pigg/skjell-rader (troll-pels, bark, rustning)
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
    // Wet mix (Procreate-inspirert, forenklet): pigmentet «brukes opp»
    // langs strøket (falloff), samler seg ved slutten (edge) og drar
    // underliggende farge via et svakt smudge-etterpass (pull).
    var wetFalloffLength: Double = 0     // px; 0 = av
    var wetEdge: Double = 0              // alpha-boost i taper-sonen
    var wetPull: Double = 0              // 0..1 smudge-styrke etter dabs
    // Fyll: lukket omriss scanline-fylles med dabs (SBP «auto fill»).
    var fillInterior: Bool = false
    // Halftone: dabs snappes til verdens-grid, dot-størrelse ∝ trykk.
    var halftoneGrid: Bool = false

    static func forBrush(_ type: BrushType) -> StampConfig? {
        func productionStamp(_ preset: DabPreset) -> StampConfig {
            StampConfig(preset: preset, spacing: 2.5, scatter: 0,
                        jitterAngleDeg: 0, tiltRotation: false,
                        pressureToSize: 0.28, pressureToOpacity: 0.12,
                        flow: 0.94, sizeMultiplier: 1,
                        pressureCurve: 0.82, sizeJitter: 0)
        }
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
        case .bluepencil, .redpencil:
            return StampConfig(preset: .pencilGraphite, spacing: 0.09, scatter: 0.07,
                               jitterAngleDeg: 9, tiltRotation: true,
                               pressureToSize: 0.58, pressureToOpacity: 0.5,
                               flow: 0.58, sizeMultiplier: 1.0,
                               pressureCurve: 0.68, velocityToOpacity: -0.16,
                               wobble: 0.12)
        case .mechanical:
            return StampConfig(preset: .inkRound, spacing: 0.04, scatter: 0.01,
                               jitterAngleDeg: 2, tiltRotation: false,
                               pressureToSize: 0.28, pressureToOpacity: 0.5,
                               flow: 0.9, sizeMultiplier: 0.9,
                               pressureCurve: 0.72, velocityToOpacity: -0.08,
                               taperDistance: 3)
        case .dryink:
            return StampConfig(preset: .charcoalTooth, spacing: 0.075, scatter: 0.08,
                               jitterAngleDeg: 7, tiltRotation: true,
                               pressureToSize: 0.8, pressureToOpacity: 0.7,
                               flow: 0.74, sizeMultiplier: 1.35,
                               pressureCurve: 0.72, velocityToOpacity: -0.26,
                               taperDistance: 9, sizeJitter: 0.16,
                               directionTexture: 0.7)
        case .tonemarker:
            return StampConfig(preset: .markerChisel, spacing: 0.045, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: true,
                               pressureToSize: 0.15, pressureToOpacity: 0.18,
                               flow: 0.34, sizeMultiplier: 2.2,
                               pressureCurve: 0.9, tiltOval: 0.35)
        case .tortillon:
            return StampConfig(preset: .charcoalTooth, spacing: 0.055, scatter: 0.02,
                               jitterAngleDeg: 4, tiltRotation: true,
                               pressureToSize: 0.46, pressureToOpacity: 0.62,
                               flow: 0.32, sizeMultiplier: 1.2,
                               pressureCurve: 0.7, tiltOval: 0.35)
        case .vinyl:
            return StampConfig(preset: .inkRound, spacing: 0.04, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.72, pressureToOpacity: 0.2,
                               flow: 1, sizeMultiplier: 1.35,
                               pressureCurve: 0.72)
        case .pastel:
            return StampConfig(preset: .charcoalTooth, spacing: 0.09, scatter: 0.2,
                               jitterAngleDeg: 28, tiltRotation: true,
                               pressureToSize: 0.7, pressureToOpacity: 0.74,
                               flow: 0.42, sizeMultiplier: 1.7,
                               pressureCurve: 0.72, tiltOval: 0.55,
                               sizeJitter: 0.3)
        case .stipple:
            return StampConfig(preset: .halftoneDot, spacing: 0.18, scatter: 0.75,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.82, pressureToOpacity: 0.35,
                               flow: 0.72, sizeMultiplier: 0.45,
                               pressureCurve: 0.74, sizeJitter: 0.45)
        case .sumi:
            return StampConfig(preset: .charcoalTooth, spacing: 0.055, scatter: 0.035,
                               jitterAngleDeg: 5, tiltRotation: true,
                               pressureToSize: 0.94, pressureToOpacity: 0.72,
                               flow: 0.66, sizeMultiplier: 1.8,
                               pressureCurve: 0.62, velocityToSize: -0.15,
                               velocityToOpacity: -0.24, taperDistance: 18,
                               wetFalloffLength: 520, wetEdge: 0.42, wetPull: 0.2)
        case .gouache:
            return StampConfig(preset: .markerChisel, spacing: 0.045, scatter: 0.03,
                               jitterAngleDeg: 6, tiltRotation: true,
                               pressureToSize: 0.52, pressureToOpacity: 0.34,
                               flow: 0.82, sizeMultiplier: 1.6,
                               pressureCurve: 0.72, wobble: 0.08, tiltOval: 0.42,
                               wetFalloffLength: 1_100, wetEdge: 0.22, wetPull: 0.08)
        case .oil:
            return StampConfig(preset: .charcoalTooth, spacing: 0.05, scatter: 0.025,
                               jitterAngleDeg: 5, tiltRotation: true,
                               pressureToSize: 0.78, pressureToOpacity: 0.3,
                               flow: 0.84, sizeMultiplier: 1.55,
                               pressureCurve: 0.7, velocityToOpacity: -0.12,
                               taperDistance: 10, directionTexture: 0.85,
                               wetFalloffLength: 1_400, wetEdge: 0.14, wetPull: 0.05)
        // ── Role Room Traditional Studio (clean-room) ──────────────
        case .sketchHB:
            return StampConfig(preset: .pencilGraphite, spacing: 0.09, scatter: 0.09,
                               jitterAngleDeg: 13, tiltRotation: true,
                               pressureToSize: 0.62, pressureToOpacity: 0.58,
                               flow: 0.62, sizeMultiplier: 1,
                               pressureCurve: 0.68, velocityToOpacity: -0.2,
                               wobble: 0.17, sizeJitter: 0.08)
        case .sketch6B:
            return StampConfig(preset: .charcoalTooth, spacing: 0.075, scatter: 0.1,
                               jitterAngleDeg: 16, tiltRotation: true,
                               pressureToSize: 0.8, pressureToOpacity: 0.76,
                               flow: 0.82, sizeMultiplier: 1.25,
                               pressureCurve: 0.62, velocityToOpacity: -0.22,
                               wobble: 0.18, sizeJitter: 0.12)
        case .sketchTilt:
            return StampConfig(preset: .charcoalTooth, spacing: 0.075, scatter: 0.06,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.42, pressureToOpacity: 0.68,
                               flow: 0.48, sizeMultiplier: 1.15,
                               pressureCurve: 0.78, velocityToOpacity: -0.16,
                               wobble: 0.24, tiltOval: 0.94, sizeJitter: 0.12,
                               directionTexture: 0.72)
        case .colorHard:
            return StampConfig(preset: .pencilGraphite, spacing: 0.065, scatter: 0.035,
                               jitterAngleDeg: 5, tiltRotation: true,
                               pressureToSize: 0.46, pressureToOpacity: 0.66,
                               flow: 0.72, sizeMultiplier: 0.9,
                               pressureCurve: 0.72, velocityToOpacity: -0.1,
                               taperDistance: 4, sizeJitter: 0.04)
        case .colorSoft:
            return StampConfig(preset: .pencilGraphite, spacing: 0.075, scatter: 0.08,
                               jitterAngleDeg: 12, tiltRotation: true,
                               pressureToSize: 0.72, pressureToOpacity: 0.7,
                               flow: 0.68, sizeMultiplier: 1.2,
                               pressureCurve: 0.68, velocityToOpacity: -0.16,
                               wobble: 0.1, sizeJitter: 0.1)
        case .colorShade:
            return StampConfig(preset: .charcoalTooth, spacing: 0.07, scatter: 0.045,
                               jitterAngleDeg: 7, tiltRotation: true,
                               pressureToSize: 0.46, pressureToOpacity: 0.74,
                               flow: 0.52, sizeMultiplier: 1.2,
                               pressureCurve: 0.74, velocityToOpacity: -0.14,
                               tiltOval: 0.9, sizeJitter: 0.1,
                               directionTexture: 0.72)
        case .studio2H:
            return StampConfig(preset: .pencilGraphite, spacing: 0.07, scatter: 0.025,
                               jitterAngleDeg: 4, tiltRotation: true,
                               pressureToSize: 0.38, pressureToOpacity: 0.46,
                               flow: 0.48, sizeMultiplier: 0.82,
                               pressureCurve: 0.76, velocityToOpacity: -0.1,
                               taperDistance: 4, sizeJitter: 0.03)
        case .studioHB:
            return StampConfig(preset: .pencilGraphite, spacing: 0.075, scatter: 0.05,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.64, pressureToOpacity: 0.62,
                               flow: 0.68, sizeMultiplier: 1,
                               pressureCurve: 0.7, velocityToOpacity: -0.14,
                               wobble: 0.07, sizeJitter: 0.06)
        case .studio4B:
            return StampConfig(preset: .charcoalTooth, spacing: 0.07, scatter: 0.08,
                               jitterAngleDeg: 12, tiltRotation: true,
                               pressureToSize: 0.82, pressureToOpacity: 0.78,
                               flow: 0.86, sizeMultiplier: 1.3,
                               pressureCurve: 0.62, velocityToOpacity: -0.2,
                               wobble: 0.1, sizeJitter: 0.1)
        case .vineCharcoal:
            return StampConfig(preset: .charcoalTooth, spacing: 0.12, scatter: 0.22,
                               jitterAngleDeg: 34, tiltRotation: true,
                               pressureToSize: 0.78, pressureToOpacity: 0.72,
                               flow: 0.4, sizeMultiplier: 1.55,
                               pressureCurve: 0.68, velocityToOpacity: -0.28,
                               tiltOval: 0.4, sizeJitter: 0.36)
        case .blockCharcoal:
            return StampConfig(preset: .charcoalTooth, spacing: 0.075, scatter: 0.14,
                               jitterAngleDeg: 18, tiltRotation: true,
                               pressureToSize: 0.62, pressureToOpacity: 0.82,
                               flow: 0.62, sizeMultiplier: 1.75,
                               pressureCurve: 0.7, velocityToOpacity: -0.2,
                               tiltOval: 0.78, sizeJitter: 0.22,
                               directionTexture: 0.58)
        case .softPastel:
            return StampConfig(preset: .charcoalTooth, spacing: 0.085, scatter: 0.24,
                               jitterAngleDeg: 32, tiltRotation: true,
                               pressureToSize: 0.74, pressureToOpacity: 0.76,
                               flow: 0.46, sizeMultiplier: 1.8,
                               pressureCurve: 0.7, tiltOval: 0.6,
                               sizeJitter: 0.34)
        case .nibFine:
            return StampConfig(preset: .inkRound, spacing: 0.045, scatter: 0.018,
                               jitterAngleDeg: 3, tiltRotation: false,
                               pressureToSize: 0.68, pressureToOpacity: 0.4,
                               flow: 0.9, sizeMultiplier: 0.9,
                               pressureCurve: 0.72, velocityToSize: -0.16,
                               velocityToOpacity: -0.12, wobble: 0.04,
                               taperDistance: 10, sizeJitter: 0.05)
        case .nibRough:
            return StampConfig(preset: .charcoalTooth, spacing: 0.08, scatter: 0.1,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.84, pressureToOpacity: 0.74,
                               flow: 0.7, sizeMultiplier: 1.3,
                               pressureCurve: 0.7, velocityToOpacity: -0.3,
                               taperDistance: 10, sizeJitter: 0.2,
                               directionTexture: 0.78)
        case .nibBrush:
            return StampConfig(preset: .charcoalTooth, spacing: 0.065, scatter: 0.12,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.94, pressureToOpacity: 0.78,
                               flow: 0.64, sizeMultiplier: 1.65,
                               pressureCurve: 0.62, velocityToSize: -0.14,
                               velocityToOpacity: -0.34, taperDistance: 16,
                               sizeJitter: 0.24, directionTexture: 0.88)
        case .toneDots:
            return StampConfig(preset: .halftoneDot, spacing: 0.2, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.9, pressureToOpacity: 0.08,
                               flow: 0.92, sizeMultiplier: 0.92,
                               pressureCurve: 0.72, halftoneGrid: true)
        case .toneLines:
            return StampConfig(preset: .inkRound, spacing: 0.15, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.12, pressureToOpacity: 0.34,
                               flow: 0.86, sizeMultiplier: 1,
                               pressureCurve: 0.78,
                               hatch: HatchParams(lineLength: 18, lineSpacing: 4.8,
                                                  lineWidth: 0.72,
                                                  angle: 32 * .pi / 180,
                                                  angleJitter: 0.025,
                                                  crossAngle: 122 * .pi / 180,
                                                  positionJitter: 0.55,
                                                  lengthJitter: 0.08,
                                                  allowCross: false))
        case .toneCross:
            return StampConfig(preset: .inkRound, spacing: 0.15, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.12, pressureToOpacity: 0.34,
                               flow: 0.86, sizeMultiplier: 1,
                               pressureCurve: 0.78,
                               hatch: HatchParams(lineLength: 18, lineSpacing: 5.2,
                                                  lineWidth: 0.72,
                                                  angle: 32 * .pi / 180,
                                                  angleJitter: 0.025,
                                                  crossAngle: 122 * .pi / 180,
                                                  positionJitter: 0.55,
                                                  lengthJitter: 0.08))
        case .comicFlat:
            return StampConfig(preset: .markerChisel, spacing: 0.04, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: true,
                               pressureToSize: 0.18, pressureToOpacity: 0.12,
                               flow: 0.9, sizeMultiplier: 2.1,
                               pressureCurve: 0.9, tiltOval: 0.28)
        case .comicShade:
            return StampConfig(preset: .halftoneDot, spacing: 0.2, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.86, pressureToOpacity: 0.12,
                               flow: 0.86, sizeMultiplier: 0.86,
                               pressureCurve: 0.72, halftoneGrid: true)
        case .stippleFine:
            return StampConfig(preset: .halftoneDot, spacing: 0.19, scatter: 0.66,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.46, pressureToOpacity: 0.3,
                               flow: 0.74, sizeMultiplier: 0.22,
                               pressureCurve: 0.78, sizeJitter: 0.16)
        case .stippleRough:
            return StampConfig(preset: .halftoneDot, spacing: 0.18, scatter: 0.8,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.74, pressureToOpacity: 0.4,
                               flow: 0.68, sizeMultiplier: 0.42,
                               pressureCurve: 0.72, sizeJitter: 0.48)
        case .stippleFill:
            return StampConfig(preset: .halftoneDot, spacing: 0.11, scatter: 0.88,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.62, pressureToOpacity: 0.32,
                               flow: 0.58, sizeMultiplier: 0.3,
                               pressureCurve: 0.68, sizeJitter: 0.34)
        // ── Production Intelligence: semantiske regimerker ────────
        case .gestureBrush:
            return StampConfig(preset: .pencilGraphite, spacing: 0.09, scatter: 0.08,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.7, pressureToOpacity: 0.56,
                               flow: 0.66, sizeMultiplier: 1.1,
                               pressureCurve: 0.66, velocityToSize: -0.14,
                               velocityToOpacity: -0.2, wobble: 0.22)
        case .silhouetteBrush, .stagingBrush:
            return StampConfig(preset: .markerChisel, spacing: 0.045, scatter: 0.015,
                               jitterAngleDeg: 4, tiltRotation: true,
                               pressureToSize: 0.34, pressureToOpacity: 0.24,
                               flow: 0.86, sizeMultiplier: 1.8,
                               pressureCurve: 0.84, wobble: 0.06, tiltOval: 0.35)
        case .focusBrush, .depthBrush, .lightBrush, .negativeSpaceBrush:
            return StampConfig(preset: .softRound, spacing: 0.055, scatter: 0.02,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.28, pressureToOpacity: 0.62,
                               flow: 0.34, sizeMultiplier: 1.55,
                               pressureCurve: 0.72, tiltOval: 0.35,
                               sizeJitter: 0.08)
        case .perspectiveBrush, .cameraBrush, .eyeLineBrush,
             .continuityBrush, .storyBeatBrush:
            return StampConfig(preset: .inkRound, spacing: 0.045, scatter: 0.01,
                               jitterAngleDeg: 2, tiltRotation: false,
                               pressureToSize: 0.48, pressureToOpacity: 0.34,
                               flow: 0.9, sizeMultiplier: 1,
                               pressureCurve: 0.74, velocityToSize: -0.08,
                               taperDistance: 5)
        case .emotionBrush:
            return StampConfig(preset: .pencilGraphite, spacing: 0.075, scatter: 0.06,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.74, pressureToOpacity: 0.64,
                               flow: 0.72, sizeMultiplier: 1.1,
                               pressureCurve: 0.66, wobble: 0.12,
                               sizeJitter: 0.08)
        case .motionBrush:
            return StampConfig(preset: .inkRound, spacing: 0.3, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.28, pressureToOpacity: 0.4,
                               flow: 0.82, sizeMultiplier: 1,
                               pressureCurve: 0.76,
                               hatch: HatchParams(lineLength: 52, lineSpacing: 8,
                                                  lineWidth: 0.8, angle: 0,
                                                  angleJitter: 0.04, crossAngle: 0,
                                                  positionJitter: 1.8, lengthJitter: 0.32,
                                                  followDirection: true, allowCross: false))
        // ── Materialer og miljø ────────────────────────────────────
        case .concreteTexture, .groundGravel:
            return StampConfig(preset: .rockGrit, spacing: 0.12, scatter: 0.32,
                               jitterAngleDeg: 80, tiltRotation: true,
                               pressureToSize: 0.5, pressureToOpacity: 0.62,
                               flow: 0.62, sizeMultiplier: 1.35,
                               pressureCurve: 0.72, sizeJitter: 0.46)
        case .woodGrain:
            return StampConfig(preset: .charcoalTooth, spacing: 0.11, scatter: 0.06,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.34, pressureToOpacity: 0.5,
                               flow: 0.54, sizeMultiplier: 1.1,
                               pressureCurve: 0.76, wobble: 0.28,
                               sizeJitter: 0.14, directionTexture: 0.94,
                               hatch: HatchParams(lineLength: 34, lineSpacing: 6.4,
                                                  lineWidth: 0.62, angle: 0,
                                                  angleJitter: 0.1, crossAngle: 0,
                                                  positionJitter: 1.4, lengthJitter: 0.48,
                                                  followDirection: true, allowCross: false))
        case .fabricTexture:
            return StampConfig(preset: .inkRound, spacing: 0.16, scatter: 0.02,
                               jitterAngleDeg: 2, tiltRotation: false,
                               pressureToSize: 0.18, pressureToOpacity: 0.38,
                               flow: 0.68, sizeMultiplier: 0.9,
                               pressureCurve: 0.78,
                               hatch: HatchParams(lineLength: 12, lineSpacing: 5.5,
                                                  lineWidth: 0.52,
                                                  angle: 45 * .pi / 180,
                                                  angleJitter: 0.035,
                                                  crossAngle: 135 * .pi / 180,
                                                  positionJitter: 0.55,
                                                  lengthJitter: 0.12))
        case .brushedMetal:
            return StampConfig(preset: .markerChisel, spacing: 0.07, scatter: 0.025,
                               jitterAngleDeg: 3, tiltRotation: true,
                               pressureToSize: 0.2, pressureToOpacity: 0.44,
                               flow: 0.42, sizeMultiplier: 1.35,
                               pressureCurve: 0.82, tiltOval: 0.7,
                               sizeJitter: 0.08, directionTexture: 1)
        case .glassReflection:
            return StampConfig(preset: .inkRound, spacing: 0.055, scatter: 0.015,
                               jitterAngleDeg: 3, tiltRotation: true,
                               pressureToSize: 0.66, pressureToOpacity: 0.34,
                               flow: 0.54, sizeMultiplier: 1.15,
                               pressureCurve: 0.66, velocityToSize: -0.12,
                               taperDistance: 12)
        case .skinOrganic:
            return StampConfig(preset: .skinPore, spacing: 0.11, scatter: 0.18,
                               jitterAngleDeg: 50, tiltRotation: true,
                               pressureToSize: 0.36, pressureToOpacity: 0.56,
                               flow: 0.44, sizeMultiplier: 1.15,
                               pressureCurve: 0.76, sizeJitter: 0.28)
        case .filmGrain:
            return StampConfig(preset: .charcoalTooth, spacing: 0.2, scatter: 0.92,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.42,
                               flow: 0.5, sizeMultiplier: 0.55,
                               pressureCurve: 0.82, sizeJitter: 0.5)
        case .dustSmoke:
            return StampConfig(preset: .softRound, spacing: 0.12, scatter: 0.75,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.42, pressureToOpacity: 0.58,
                               flow: 0.28, sizeMultiplier: 1.5,
                               pressureCurve: 0.72, wobble: 0.4,
                               sizeJitter: 0.62)
        case .rainWetSurface:
            return StampConfig(preset: .inkRound, spacing: 0.26, scatter: 0.08,
                               jitterAngleDeg: 3, tiltRotation: false,
                               pressureToSize: 0.24, pressureToOpacity: 0.42,
                               flow: 0.74, sizeMultiplier: 0.9,
                               pressureCurve: 0.78,
                               hatch: HatchParams(lineLength: 58, lineSpacing: 8.5,
                                                  lineWidth: 0.64, angle: 0,
                                                  angleJitter: 0.05, crossAngle: 0,
                                                  positionJitter: 2.6, lengthJitter: 0.46,
                                                  followDirection: true, allowCross: false))
        case .foliageTexture:
            return StampConfig(preset: .charcoalTooth, spacing: 0.15, scatter: 0.64,
                               jitterAngleDeg: 180, tiltRotation: true,
                               pressureToSize: 0.52, pressureToOpacity: 0.64,
                               flow: 0.58, sizeMultiplier: 1.25,
                               pressureCurve: 0.7, sizeJitter: 0.56)
        case .crowdTexture:
            return StampConfig(preset: .halftoneDot, spacing: 0.18, scatter: 0.62,
                               jitterAngleDeg: 180, tiltRotation: false,
                               pressureToSize: 0.62, pressureToOpacity: 0.5,
                               flow: 0.68, sizeMultiplier: 0.48,
                               pressureCurve: 0.72, sizeJitter: 0.34)
        case .architectureFill:
            return StampConfig(preset: .inkRound, spacing: 0.16, scatter: 0.015,
                               jitterAngleDeg: 1, tiltRotation: false,
                               pressureToSize: 0.16, pressureToOpacity: 0.38,
                               flow: 0.72, sizeMultiplier: 0.95,
                               pressureCurve: 0.8,
                               hatch: HatchParams(lineLength: 22, lineSpacing: 7,
                                                  lineWidth: 0.7, angle: 0,
                                                  angleJitter: 0.01,
                                                  crossAngle: 90 * .pi / 180,
                                                  positionJitter: 0.3,
                                                  lengthJitter: 0.03))
        case .shadowTexture:
            return StampConfig(preset: .charcoalTooth, spacing: 0.08, scatter: 0.12,
                               jitterAngleDeg: 18, tiltRotation: true,
                               pressureToSize: 0.44, pressureToOpacity: 0.7,
                               flow: 0.48, sizeMultiplier: 1.4,
                               pressureCurve: 0.7, tiltOval: 0.7,
                               sizeJitter: 0.24, directionTexture: 0.74)
        case .lightTexture:
            return StampConfig(preset: .softRound, spacing: 0.09, scatter: 0.28,
                               jitterAngleDeg: 24, tiltRotation: true,
                               pressureToSize: 0.28, pressureToOpacity: 0.62,
                               flow: 0.32, sizeMultiplier: 1.7,
                               pressureCurve: 0.72, tiltOval: 0.42,
                               sizeJitter: 0.36)
        // ── Detaljverktøy ──────────────────────────────────────────
        case .faceDetail, .handDetail, .objectDetail, .architectureDetail,
             .vehicleDetail, .techDetail, .edgeDetail:
            return StampConfig(preset: .inkRound, spacing: 0.04, scatter: 0.012,
                               jitterAngleDeg: 2, tiltRotation: false,
                               pressureToSize: 0.78, pressureToOpacity: 0.44,
                               flow: 0.86, sizeMultiplier: 0.9,
                               pressureCurve: 0.68, velocityToSize: -0.14,
                               velocityToOpacity: -0.08, wobble: 0.035,
                               taperDistance: 7)
        case .hairDetail, .clothingDetail, .natureDetail:
            return StampConfig(preset: .pencilGraphite, spacing: 0.07, scatter: 0.05,
                               jitterAngleDeg: 7, tiltRotation: true,
                               pressureToSize: 0.8, pressureToOpacity: 0.62,
                               flow: 0.7, sizeMultiplier: 1,
                               pressureCurve: 0.66, velocityToSize: -0.12,
                               velocityToOpacity: -0.14, wobble: 0.1,
                               taperDistance: 9, sizeJitter: 0.08)
        case .surfaceDetail, .foodDetail:
            return StampConfig(preset: .rockGrit, spacing: 0.1, scatter: 0.22,
                               jitterAngleDeg: 60, tiltRotation: true,
                               pressureToSize: 0.58, pressureToOpacity: 0.6,
                               flow: 0.56, sizeMultiplier: 1,
                               pressureCurve: 0.7, sizeJitter: 0.38)
        case .microShadow:
            return StampConfig(preset: .charcoalTooth, spacing: 0.065, scatter: 0.06,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.58, pressureToOpacity: 0.72,
                               flow: 0.48, sizeMultiplier: 1.05,
                               pressureCurve: 0.68, tiltOval: 0.56,
                               sizeJitter: 0.14, directionTexture: 0.54)
        case .crowdStamp: return productionStamp(.crowdStamp)
        case .treeStamp: return productionStamp(.treeStamp)
        case .windowStamp: return productionStamp(.windowStamp)
        case .carStamp: return productionStamp(.carStamp)
        case .chairStamp: return productionStamp(.chairStamp)
        case .faceExpressionStamp: return productionStamp(.faceExpressionStamp)
        case .handPoseStamp: return productionStamp(.handPoseStamp)
        case .cameraRigStamp: return productionStamp(.cameraRigStamp)
        case .characterPoseStamp: return productionStamp(.characterPoseStamp)
        case .doorStamp: return productionStamp(.doorStamp)
        case .tableStamp: return productionStamp(.tableStamp)
        case .sofaStamp: return productionStamp(.sofaStamp)
        case .buildingStamp: return productionStamp(.buildingStamp)
        case .streetLightStamp: return productionStamp(.streetLightStamp)
        case .boomMicStamp: return productionStamp(.boomMicStamp)
        case .filmLightStamp: return productionStamp(.filmLightStamp)
        case .bedStamp: return productionStamp(.bedStamp)
        case .staircaseStamp: return productionStamp(.staircaseStamp)
        case .counterStamp: return productionStamp(.counterStamp)
        case .workstationStamp: return productionStamp(.workstationStamp)
        case .communicationStamp: return productionStamp(.communicationStamp)
        case .luggageStamp: return productionStamp(.luggageStamp)
        case .publicTransportStamp: return productionStamp(.publicTransportStamp)
        case .animalStamp: return productionStamp(.animalStamp)
        case .rockTerrainStamp: return productionStamp(.rockTerrainStamp)
        case .waterStamp: return productionStamp(.waterStamp)
        case .fireSmokeStamp: return productionStamp(.fireSmokeStamp)
        case .weatherFXStamp: return productionStamp(.weatherFXStamp)
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
                               flow: 1.0, sizeMultiplier: 1.3,
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
                               wobble: 0.3, tiltOval: 0.9, sizeJitter: 0.1,
                               directionTexture: 0.8)
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
        case .toneblock:
            // Solid tonemasse: tett, høy dekning, kantete — det referansens
            // mørke flater trenger (shade er bevisst myk build-up).
            return StampConfig(preset: .markerChisel, spacing: 0.045, scatter: 0.015,
                               jitterAngleDeg: 6, tiltRotation: true,
                               pressureToSize: 0.3, pressureToOpacity: 0.35,
                               flow: 0.95, sizeMultiplier: 1.4,
                               pressureCurve: 0.8, wobble: 0.08)
        case .speedlines:
            return StampConfig(preset: .inkRound, spacing: 0.3, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.25, pressureToOpacity: 0.45,
                               flow: 0.85, sizeMultiplier: 1.0,
                               pressureCurve: 0.8,
                               hatch: HatchParams(lineLength: 64, lineSpacing: 9,
                                                  lineWidth: 0.7,
                                                  angle: 0, angleJitter: 0.03,
                                                  crossAngle: 0,
                                                  positionJitter: 2.2, lengthJitter: 0.4,
                                                  followDirection: true, allowCross: false))
        case .airbrush:
            // Ren myk tone: gaussisk dab, tett spacing, lav flow — bygger
            // kontinuerlige graderinger uten korn.
            return StampConfig(preset: .softRound, spacing: 0.06, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.25, pressureToOpacity: 0.75,
                               flow: 0.5, sizeMultiplier: 1.2,
                               pressureCurve: 0.6, tiltOval: 0.3)
        case .wethair:
            return StampConfig(preset: .inkRound, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.4, pressureToOpacity: 0.5,
                               flow: 0.8, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .wethair)
        case .softfocus:
            // Rutes til smudge-pipeline med dempet styrke/stor radius
            // (poor-man's dybdeuskarphet) — se commitStroke.
            return StampConfig(preset: .softRound, spacing: 0.08, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.2, pressureToOpacity: 0.5,
                               flow: 0.3, sizeMultiplier: 1.6,
                               pressureCurve: 0.6)
        case .skintex:
            return StampConfig(preset: .skinPore, spacing: 0.10, scatter: 0.06,
                               jitterAngleDeg: 40, tiltRotation: true,
                               pressureToSize: 0.35, pressureToOpacity: 0.6,
                               flow: 0.5, sizeMultiplier: 1.3,
                               pressureCurve: 0.75, sizeJitter: 0.2)
        case .rocktex:
            return StampConfig(preset: .rockGrit, spacing: 0.12, scatter: 0.08,
                               jitterAngleDeg: 60, tiltRotation: true,
                               pressureToSize: 0.4, pressureToOpacity: 0.6,
                               flow: 0.6, sizeMultiplier: 1.3,
                               pressureCurve: 0.75, sizeJitter: 0.3)
        case .wash:
            // Lavering: bred flat halvtransparent — bygger tonelag med
            // papirkant-grain; tilt flater ovalen (som å legge penselen ned).
            return StampConfig(preset: .markerChisel, spacing: 0.05, scatter: 0.02,
                               jitterAngleDeg: 8, tiltRotation: true,
                               pressureToSize: 0.25, pressureToOpacity: 0.6,
                               flow: 0.3, sizeMultiplier: 1.6,
                               pressureCurve: 0.7, wobble: 0.12, tiltOval: 0.5,
                               wetFalloffLength: 900, wetEdge: 0.6, wetPull: 0.15)
        case .spikes:
            return StampConfig(preset: .inkRound, spacing: 0.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.5, pressureToOpacity: 0.45,
                               flow: 0.85, sizeMultiplier: 1.0,
                               pressureCurve: 0.8, environmental: .spikes)
        // Web-paritet for klassiske web-pensler som manglet native config
        // (strøk tegnet med dem på web var USYNLIGE på iPad):
        case .watercolor:
            return StampConfig(preset: .softRound, spacing: 0.10, scatter: 0.06,
                               jitterAngleDeg: 18, tiltRotation: true,
                               pressureToSize: 0.5, pressureToOpacity: 0.4,
                               flow: 0.25, sizeMultiplier: 2.2,
                               pressureCurve: 0.8, tiltOval: 0.3,
                               wetFalloffLength: 700, wetEdge: 0.5, wetPull: 0.12)
        case .fill:
            // Fyll: tegn omrisset — lukkes det, scanline-fylles interiøret.
            return StampConfig(preset: .inkRound, spacing: 0.3, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.1, pressureToOpacity: 0.2,
                               flow: 0.9, sizeMultiplier: 1.0,
                               fillInterior: true)
        case .halftone:
            return StampConfig(preset: .halftoneDot, spacing: 0.2, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.9, pressureToOpacity: 0.1,
                               flow: 0.95, sizeMultiplier: 1.0,
                               halftoneGrid: true)
        case .stamp:
            // Enkeltavtrykk: stor spacing = ett stempel per tap/kort strøk.
            return StampConfig(preset: .softRound, spacing: 2.5, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.3, pressureToOpacity: 0.1,
                               flow: 1.0, sizeMultiplier: 3.0)
        case .custom:
            // Egen penselspiss (PNG) med vanlig strøk-oppførsel (ABR-verdien
            // uten ABR-formatet).
            return StampConfig(preset: .pencilGraphite, spacing: 0.12, scatter: 0.04,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.6, pressureToOpacity: 0.5,
                               flow: 0.85, sizeMultiplier: 1.4)
        case .brush:
            return StampConfig(preset: .charcoalTooth, spacing: 0.07, scatter: 0.02,
                               jitterAngleDeg: 10, tiltRotation: true,
                               pressureToSize: 0.7, pressureToOpacity: 0.45,
                               flow: 0.55, sizeMultiplier: 1.6,
                               pressureCurve: 0.85)
        case .gloss:
            // Hvit highlight-ink: skarp, taper — dråper og våt glans.
            return StampConfig(preset: .inkRound, spacing: 0.045, scatter: 0,
                               jitterAngleDeg: 0, tiltRotation: false,
                               pressureToSize: 0.85, pressureToOpacity: 0.2,
                               flow: 1.0, sizeMultiplier: 1.0,
                               pressureCurve: 0.75, velocityToSize: -0.15,
                               taperDistance: 8)
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
        case .marker, .highlighter, .tonemarker: return 0.3
        case .smudge, .eraser, .vinyl, .tortillon: return 0.15
        // Story Brush Engine (spec §6)
        case .layout, .bluepencil, .redpencil, .sketchHB, .studio2H: return 0.28
        case .detail, .mechanical, .colorHard, .studioHB, .nibFine: return 0.35
        case .hatch, .crosshatch, .stipple, .toneLines, .toneCross,
             .stippleFine, .stippleRough, .stippleFill: return 0.3
        case .shade, .sketchTilt, .colorShade: return 0.16
        case .heavy, .sketch6B, .studio4B: return 0.16
        case .graintex, .kneaded, .lightlift, .pastel, .colorSoft,
             .vineCharcoal, .blockCharcoal, .softPastel: return 0.15
        case .forest, .debris, .organictex, .fur: return 0.2
        case .toneblock: return 0.2
        case .speedlines: return 0.4
        case .airbrush, .softfocus: return 0.15
        case .wethair: return 0.3
        case .skintex, .rocktex: return 0.2
        case .gloss: return 0.4
        case .wash, .sumi, .gouache, .oil, .dryink, .nibRough, .nibBrush: return 0.18
        case .toneDots, .comicFlat, .comicShade: return 0.2
        case .spikes: return 0.25
        case .gestureBrush, .emotionBrush: return 0.22
        case .perspectiveBrush, .cameraBrush, .motionBrush, .eyeLineBrush,
             .continuityBrush, .storyBeatBrush: return 0.42
        case .silhouetteBrush, .focusBrush, .depthBrush, .lightBrush,
             .negativeSpaceBrush, .stagingBrush: return 0.2
        case .concreteTexture, .woodGrain, .fabricTexture, .brushedMetal,
             .glassReflection, .groundGravel, .skinOrganic, .filmGrain,
             .dustSmoke, .rainWetSurface, .foliageTexture, .crowdTexture,
             .architectureFill, .shadowTexture, .lightTexture: return 0.16
        case .faceDetail, .hairDetail, .clothingDetail, .handDetail, .objectDetail,
             .architectureDetail, .vehicleDetail, .surfaceDetail, .techDetail,
             .foodDetail, .natureDetail, .microShadow, .edgeDetail: return 0.38
        case .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
             .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
             .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp: return 0
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
