import Foundation

// Datamodell i 1:1-paritet med web-editoren (useApplePencil.ts /
// AdvancedBrushEngine.tsx). JSON herfra kan skrives rett inn i
// scene.storyboardFrames.drawingData.strokes (som JSON-STRENG — web-parseren
// parseStoredStrokes krever streng, ikke array).

struct StrokePoint: Codable, Sendable, Equatable {
    var x: Double
    var y: Double
    var pressure: Double
    // PointerEvent-konvensjon: GRADER −90..90 (web-motoren forventer dette).
    var tiltX: Double
    var tiltY: Double
    var timestamp: Double
}

enum BrushType: String, Codable, Sendable, CaseIterable {
    case pencil, graphite, charcoal, conte, pen, marker, brush
    case watercolor, ink, highlighter, smudge, eraser
    // Story Brush Engine (storyboard-brush-engine.md §32/§55)
    case layout        // Story Layout Pencil — lys H/HB, konstruksjon
    case heavy         // Story Pencil Heavy — 2B/3B, konturer/silhuetter
    case detail        // Story Detail Pencil — liten, skarp, kontrollert
    case hatch         // Story Hatch — prosedural skravering
    case crosshatch    // Story Cross Hatch — to lag, 35°/112°
    case shade         // Story Shade — bred grafittside, tilt-oval
    case graintex      // Story Grain — dry graphite scatter
    case kneaded       // Story Kneaded Eraser — teksturert grafitt-løft
    case lightlift     // Story Light Lift — atmosfærisk lys
    // Fase 2: Environmental (spec §55–§66)
    case forest        // Story Forest Brush — prosedural gran/skogsmasse
    case debris        // Story Ground Debris — kvister/stein/skogbunn
    case organictex    // Story Organic Texture — bark/skjell/shards
    case fur           // Story Fur — tapered strands i klynger
    // Funnet i praksis-test mot referanse-storyboards:
    case toneblock     // Solid mørk tonemasse (referansens nesten-svarte flater)
    case speedlines    // Lange energilinjer langs strøkretningen (regn/fart)
    // Rendering-klassen (foto-referanse: full tone, våt glans, dybde)
    case airbrush      // Myk gaussisk tone — kontinuerlige graderinger
    case wethair       // Lange kurvede hårstrå med heng og tonevariasjon
    case softfocus     // Dybde-uskarphet: svak bred smudge (bakgrunnsseparasjon)
    case skintex       // Porøs hud-mikrotekstur
    case rocktex       // Stein/gjørme-grus
    case gloss         // Glans/highlights — hvit ink m/ taper (dråper, våt hud)
}

// Spec-defaults per pensel (size px / opacity) — settes når penselen velges
// så hvert verktøy starter med riktig fysisk karakter (§8–§11, §34–§40, §67).
enum BrushDefaults {
    /// Farge-hint: pensler med en naturlig standardfarge (Glans = hvit).
    static func colorHint(for type: BrushType) -> String? {
        type == .gloss ? "#ffffff" : nil
    }

    static func sizeAndOpacity(for type: BrushType) -> (size: Double, opacity: Double)? {
        switch type {
        case .pencil: return (3.2, 0.48)       // Story Pencil
        case .layout: return (2.4, 0.28)
        case .heavy: return (4.2, 0.62)
        case .detail: return (1.35, 0.78)
        case .ink: return (2.4, 0.94)          // Story Ink
        case .hatch: return (34, 0.32)
        case .crosshatch: return (34, 0.36)
        case .shade: return (42, 0.16)
        case .graintex: return (72, 0.08)
        case .kneaded: return (48, 0.24)
        case .lightlift: return (96, 0.11)
        case .forest: return (60, 0.6)
        case .debris: return (30, 0.5)
        case .organictex: return (18, 0.5)
        case .fur: return (24, 0.45)
        case .toneblock: return (36, 0.85)
        case .speedlines: return (40, 0.5)
        case .airbrush: return (80, 0.35)
        case .wethair: return (30, 0.6)
        case .softfocus: return (70, 0.5)
        case .skintex: return (40, 0.4)
        case .rocktex: return (44, 0.45)
        case .gloss: return (2.4, 0.9)
        default: return nil
        }
    }
}

struct BrushSpec: Codable, Sendable, Equatable {
    var type: BrushType
    var size: Double
    var color: String
    var opacity: Double
    var hardness: Double
    var flow: Double
    var wetness: Double
    var grain: Double
    var tiltSensitivity: Double
    var pressureSensitivity: Double

    static func preset(_ type: BrushType, size: Double, color: String, opacity: Double) -> BrushSpec {
        // Samme presets som web BRUSH_PRESETS.
        switch type {
        case .pencil:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.6, flow: 0.8, wetness: 0, grain: 0.7,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.9)
        case .graphite:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.55, flow: 0.9, wetness: 0, grain: 0.55,
                             tiltSensitivity: 0.85, pressureSensitivity: 0.95)
        case .charcoal:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.25, flow: 0.85, wetness: 0, grain: 0.85,
                             tiltSensitivity: 0.55, pressureSensitivity: 1.0)
        case .conte:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.5, flow: 0.85, wetness: 0, grain: 0.7,
                             tiltSensitivity: 0.4, pressureSensitivity: 0.9)
        case .ink:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 0.9, wetness: 0.3, grain: 0,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.8)
        case .marker:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.3, flow: 0.9, wetness: 0, grain: 0.1,
                             tiltSensitivity: 0.8, pressureSensitivity: 0.8)
        // Story Brush Engine (grain/flow fra spec §8–§11, §34–§40, §67)
        case .layout:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.6, flow: 0.22, wetness: 0, grain: 0.28,
                             tiltSensitivity: 0.4, pressureSensitivity: 0.58)
        case .heavy:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.5, flow: 0.38, wetness: 0, grain: 0.46,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.78)
        case .detail:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.75, flow: 0.6, wetness: 0, grain: 0.22,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.88)
        case .hatch, .crosshatch:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 0.4, wetness: 0, grain: 0.25,
                             tiltSensitivity: 0.2, pressureSensitivity: 0.7)
        case .shade:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.3, flow: 0.08, wetness: 0, grain: 0.72,
                             tiltSensitivity: 0.9, pressureSensitivity: 0.7)
        case .graintex:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.4, flow: 0.06, wetness: 0, grain: 0.88,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.56)
        case .kneaded:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.4, flow: 0.12, wetness: 0, grain: 0.48,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.72)
        case .lightlift:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.2, flow: 0.045, wetness: 0, grain: 0.32,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.58)
        case .forest, .debris, .organictex, .fur:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.6, flow: 0.7, wetness: 0, grain: 0.3,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.8)
        case .toneblock:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 1.0, wetness: 0, grain: 0.18,
                             tiltSensitivity: 0.6, pressureSensitivity: 0.6)
        case .speedlines:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 0.8, wetness: 0, grain: 0.15,
                             tiltSensitivity: 0.2, pressureSensitivity: 0.6)
        case .airbrush:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.1, flow: 0.14, wetness: 0, grain: 0,
                             tiltSensitivity: 0.4, pressureSensitivity: 0.7)
        case .wethair:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.6, flow: 0.75, wetness: 0.3, grain: 0.2,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.8)
        case .softfocus:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.1, flow: 0.3, wetness: 0.8, grain: 0,
                             tiltSensitivity: 0.2, pressureSensitivity: 0.5)
        case .skintex:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.5, flow: 0.5, wetness: 0, grain: 0.55,
                             tiltSensitivity: 0.4, pressureSensitivity: 0.7)
        case .rocktex:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 0.55, wetness: 0, grain: 0.6,
                             tiltSensitivity: 0.4, pressureSensitivity: 0.7)
        case .gloss:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.8, flow: 0.95, wetness: 0.2, grain: 0,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.85)
        default:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.8, flow: 1, wetness: 0, grain: 0.3,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.8)
        }
    }
}

struct PencilStroke: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var points: [StrokePoint]
    var inputType: String   // 'pencil' | 'touch' | 'mouse' — web-konvensjon
    var color: String
    var width: Double
    var opacity: Double
    var brush: BrushSpec?
    // Board Pro-felter (web-paritet): lag-tag + tekst-annotasjon («PUSH IN»).
    // Optional → utelates i JSON når nil, og web-strøk med disse feltene
    // overlever native rundtur tapsfritt.
    var boardLayer: String?
    var textAnnotation: String?
}

// Web BOARD_LAYERS-rekkefølge — strøk uten boardLayer regnes som Drawing.
enum BoardLayers {
    static let all = ["Drawing", "Camera / Arrows", "Dialog", "Notes"]
    static func index(of layer: String?) -> Int {
        all.firstIndex(of: layer ?? "Drawing") ?? 0
    }
}

// Tolerant decode: web-strøk kan mangle felter (eldre motorversjoner lagret
// f.eks. brush uten pressureSensitivity) — strict decode ville forkastet hele
// framen. Defaults matcher web-motorens fallbacks. init(from:) i extension
// bevarer memberwise-init for preset().
extension StrokePoint {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        x = try container.decode(Double.self, forKey: .x)
        y = try container.decode(Double.self, forKey: .y)
        pressure = try container.decodeIfPresent(Double.self, forKey: .pressure) ?? 0.5
        tiltX = try container.decodeIfPresent(Double.self, forKey: .tiltX) ?? 0
        tiltY = try container.decodeIfPresent(Double.self, forKey: .tiltY) ?? 0
        timestamp = try container.decodeIfPresent(Double.self, forKey: .timestamp) ?? 0
    }
}

extension BrushSpec {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawType = try container.decodeIfPresent(String.self, forKey: .type) ?? "pencil"
        type = BrushType(rawValue: rawType) ?? .pencil
        size = try container.decodeIfPresent(Double.self, forKey: .size) ?? 6
        color = try container.decodeIfPresent(String.self, forKey: .color) ?? "#26282e"
        opacity = try container.decodeIfPresent(Double.self, forKey: .opacity) ?? 1
        hardness = try container.decodeIfPresent(Double.self, forKey: .hardness) ?? 0.6
        flow = try container.decodeIfPresent(Double.self, forKey: .flow) ?? 0.85
        wetness = try container.decodeIfPresent(Double.self, forKey: .wetness) ?? 0
        grain = try container.decodeIfPresent(Double.self, forKey: .grain) ?? 0.3
        tiltSensitivity = try container.decodeIfPresent(Double.self, forKey: .tiltSensitivity) ?? 0.5
        pressureSensitivity = try container.decodeIfPresent(Double.self, forKey: .pressureSensitivity) ?? 0.85
    }
}

enum StrokeSerialization {
    /// JSON-streng-format web-parseren (parseStoredStrokes) forventer.
    static func encodeToWebJSON(_ strokes: [PencilStroke]) throws -> String {
        let encoder = JSONEncoder()
        let data = try encoder.encode(strokes)
        guard let text = String(data: data, encoding: .utf8) else {
            throw CocoaError(.coderInvalidValue)
        }
        return text
    }

    static func decodeFromWebJSON(_ text: String) throws -> [PencilStroke] {
        let decoder = JSONDecoder()
        return try decoder.decode([PencilStroke].self, from: Data(text.utf8))
    }
}
