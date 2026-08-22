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
    // Pencil Pro barrel-roll (GRADER, iOS 17.5+) — optional så web-strøk
    // og eldre data dekoder uendret; utelates i JSON når nil.
    var rollAngle: Double?

    init(x: Double, y: Double, pressure: Double,
         tiltX: Double, tiltY: Double, timestamp: Double,
         rollAngle: Double? = nil) {
        self.x = x
        self.y = y
        self.pressure = pressure
        self.tiltX = tiltX
        self.tiltY = tiltY
        self.timestamp = timestamp
        self.rollAngle = rollAngle
    }
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
    // Wash-klassen (blyant+lavering-referansen)
    case wash          // Lavering: bred flat halvtransparent tone m/ papirkant
    case spikes        // Pigg/skjell-pels i retningsfølgende rader (troll-pels)
    // Research-runden: fyll, screen tone, stamps, egen penselspiss
    case fill          // lukket omriss auto-fylles (SBP-paritet)
    case halftone      // raster-tone (manga screen tone)
    case stamp         // enkeltavtrykk fra egen PNG
    case custom        // egen penselspiss (PNG) med vanlig strøk
}

// Spec-defaults per pensel (size px / opacity) — settes når penselen velges
// så hvert verktøy starter med riktig fysisk karakter (§8–§11, §34–§40, §67).
enum BrushDefaults {
    /// Farge-hint: pensler med en naturlig standardfarge (Glans = hvit).
    /// Én-linjes onboarding per pensel (vises i long-press-menyen).
    static func describe(_ type: BrushType) -> String {
        switch type {
        case .layout: return "Lys H/HB-konstruksjon — skisser først, tegn over etterpå."
        case .pencil: return "Standard blyant — allsidig linje med trykkrespons."
        case .graphite: return "Bred grafitt — sidelagt blyant for raske flater."
        case .charcoal: return "Kull — grov tekstur, dype mørke."
        case .conte: return "Conté — tørr kritt-linje med tann."
        case .heavy: return "Tung mørk linje — silhuetter og tyngdepunkt."
        case .detail: return "Tynn detaljlinje — ansikter, hender, presisjon."
        case .pen: return "Penn — jevn tusjlinje med lett taper."
        case .ink: return "Tusj — dekkende svart med spiss taper."
        case .marker: return "Marker — bred chisel-tupp, følger roll/tilt."
        case .brush: return "Pensel — myk våt linje med trykk-svell."
        case .watercolor: return "Akvarell — transparent lag som bygger seg opp."
        case .highlighter: return "Highlighter — flat markering over tegningen."
        case .smudge: return "Smudge — drar og blander eksisterende toner."
        case .eraser: return "Viskelær — piksel-visking; saksen sletter hele strøk."
        case .kneaded: return "Knagummi — løfter tone forsiktig uten hard kant."
        case .lightlift: return "Lysløft — svakt løft for høylys og tåke."
        case .hatch: return "Skravering — parallelle linjer, trykk styrer tetthet."
        case .crosshatch: return "Kryss-skravering — to lag (35°/112°) for tone."
        case .shade: return "Skygge — flat grafittside med retningstekstur."
        case .graintex: return "Korn — spredt tekstur for asfalt, sand, støy."
        case .toneblock: return "Toneblokk — solid mørk masse; overlapp strøkene tett."
        case .speedlines: return "Fartslinjer — retningsfølgende streker for bevegelse."
        case .forest: return "Skog — prosedural gran-silhuett langs strøket."
        case .debris: return "Bunnrusk — småstein og kvist langs linjen."
        case .organictex: return "Bark — organiske skår for trestammer og stein."
        case .fur: return "Pels — korte strå på tvers av strøkretningen."
        case .wethair: return "Vått hår — hengende, klumpede strå med tonevariasjon."
        case .spikes: return "Pigger — trekanter vinkelrett på strøket (pels/bark)."
        case .airbrush: return "Luft — myk gauss-sky for gradienter og dis."
        case .softfocus: return "Myk fokus — smudge i stor radius = dybdeskarphet."
        case .skintex: return "Hud — porete tekstur for ansikter i nærbilde."
        case .rocktex: return "Stein — grov mineral-tekstur for fjell og mur."
        case .gloss: return "Glans — hvite høylys med taper (øyne, metall, vått)."
        case .wash: return "Vask — lavering i brede bånd; dybdelag og tåke."
        case .fill: return "Fyll — tegn et lukket omriss, interiøret fylles automatisk."
        case .halftone: return "Halftone — raster-tone (screen tone); trykk styrer dot-størrelse."
        case .stamp: return "Stamp — enkeltavtrykk fra eget PNG-bilde (figurer, kamera-symboler)."
        case .custom: return "Egen spiss — importert PNG som penselspiss med vanlig strøk."
        }
    }

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
        case .wash: return (64, 0.3)
        case .spikes: return (26, 0.6)
        case .watercolor: return (46, 0.35)
        case .fill: return (6, 0.85)
        case .halftone: return (34, 0.85)
        case .stamp: return (120, 0.95)
        case .custom: return (12, 0.85)
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
    // Editor-parametre (§48) — optionals følger strøket (encodeIfPresent →
    // utelates når nil; deterministisk re-rendering med samme verdier).
    var hatchAngleDeg: Double?     // hatch/crosshatch: primærvinkel
    var hatchDensity: Double?      // multiplikator på merketetthet
    var hatchLength: Double?       // multiplikator på merkelengde
    var envDensity: Double?        // miljøpensler: klynge-tetthet
    var envScale: Double?          // miljøpensler: struktur-størrelse
    // Egen penselspiss/stamp: PNG som dataURL — bakes inn i strøket så
    // dokumentet rendrer likt på alle enheter (web ignorerer feltet).
    var stampDataURL: String?
    // Fargevariasjon (color dynamics): 0..1 hue-jitter per dab.
    var hueJitter: Double?

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
        case .wash:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.25, flow: 0.16, wetness: 0.6, grain: 0.22,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.6)
        case .spikes:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.65, flow: 0.8, wetness: 0, grain: 0.3,
                             tiltSensitivity: 0.3, pressureSensitivity: 0.8)
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
    // Annotasjonsform (presentasjons-boards): nil = ren tekst,
    // "note" = post-it, "bubble" = snakkeboble. Optional → web-tolerant.
    var annotationStyle: String?

    init(id: String, points: [StrokePoint], inputType: String, color: String,
         width: Double, opacity: Double, brush: BrushSpec? = nil,
         boardLayer: String? = nil, textAnnotation: String? = nil,
         annotationStyle: String? = nil) {
        self.id = id
        self.points = points
        self.inputType = inputType
        self.color = color
        self.width = width
        self.opacity = opacity
        self.brush = brush
        self.boardLayer = boardLayer
        self.textAnnotation = textAnnotation
        self.annotationStyle = annotationStyle
    }
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
        hatchAngleDeg = try container.decodeIfPresent(Double.self, forKey: .hatchAngleDeg)
        hatchDensity = try container.decodeIfPresent(Double.self, forKey: .hatchDensity)
        hatchLength = try container.decodeIfPresent(Double.self, forKey: .hatchLength)
        envDensity = try container.decodeIfPresent(Double.self, forKey: .envDensity)
        envScale = try container.decodeIfPresent(Double.self, forKey: .envScale)
        stampDataURL = try container.decodeIfPresent(String.self, forKey: .stampDataURL)
        hueJitter = try container.decodeIfPresent(Double.self, forKey: .hueJitter)
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
