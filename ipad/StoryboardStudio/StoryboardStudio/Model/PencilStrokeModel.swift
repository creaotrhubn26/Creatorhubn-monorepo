import Foundation

enum BrushEngineVersion {
    static let current = 2
}

enum BrushTipModel: String, Codable, Sendable {
    case stamp, ribbon, filament, particle, region, wet
}

enum BrushMaterial: String, Codable, Sendable {
    case graphite, charcoal, chalk, ink, marker, watercolor, gouache, oil
    case eraser, blender, utility
}

enum PaperProfile: String, Codable, Sendable, CaseIterable {
    case smooth, storyboard, rough, absorbent
}

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
    // Rå Pencil-pose og samplingmetadata. De avledede tiltX/tiltY-feltene
    // beholdes for web-paritet, mens disse gjør strøket re-renderbart uten tap.
    var altitudeAngle: Double?
    var azimuthAngle: Double?
    var velocity: Double?
    var estimationUpdateIndex: Int?
    var estimatedProperties: Int?

    init(x: Double, y: Double, pressure: Double,
         tiltX: Double, tiltY: Double, timestamp: Double,
         rollAngle: Double? = nil, altitudeAngle: Double? = nil,
         azimuthAngle: Double? = nil, velocity: Double? = nil,
         estimationUpdateIndex: Int? = nil, estimatedProperties: Int? = nil) {
        self.x = x
        self.y = y
        self.pressure = pressure
        self.tiltX = tiltX
        self.tiltY = tiltY
        self.timestamp = timestamp
        self.rollAngle = rollAngle
        self.altitudeAngle = altitudeAngle
        self.azimuthAngle = azimuthAngle
        self.velocity = velocity
        self.estimationUpdateIndex = estimationUpdateIndex
        self.estimatedProperties = estimatedProperties
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
    // Brush Engine 2: produksjonsverktøy og materialspesifikke varianter.
    case bluepencil, redpencil, mechanical, dryink, tonemarker
    case tortillon, vinyl, pastel, stipple, sumi, gouache, oil
    // Role Room Traditional Studio — originale clean-room-pensler.
    case sketchHB, sketch6B, sketchTilt
    case colorHard, colorSoft, colorShade
    case studio2H, studioHB, studio4B
    case vineCharcoal, blockCharcoal, softPastel
    case nibFine, nibRough, nibBrush
    case toneDots, toneLines, toneCross
    case comicFlat, comicShade
    case stippleFine, stippleRough, stippleFill
    // Production Intelligence — hvert strøk bærer maskinlesbar regi-intensjon.
    case gestureBrush, silhouetteBrush, focusBrush, depthBrush
    case perspectiveBrush, cameraBrush, motionBrush, lightBrush
    case emotionBrush, negativeSpaceBrush, eyeLineBrush, stagingBrush
    case continuityBrush, storyBeatBrush
    // Material- og miljøpensler — originalstrøkene forblir fullt redigerbare.
    case concreteTexture, woodGrain, fabricTexture, brushedMetal
    case glassReflection, groundGravel, skinOrganic, filmGrain
    case dustSmoke, rainWetSurface, foliageTexture, crowdTexture
    case architectureFill, shadowTexture, lightTexture
    // Presisjonsverktøy for lesbare storyboarddetaljer.
    case faceDetail, hairDetail, clothingDetail, handDetail, objectDetail
    case architectureDetail, vehicleDetail, surfaceDetail, techDetail
    case foodDetail, natureDetail, microShadow, edgeDetail
    // Innebygde production stamps — prosedurale spisser, ett redigerbart
    // PencilStroke per tap (ingen lisensierte eller rasterbakte assets).
    case crowdStamp, treeStamp, windowStamp, carStamp, chairStamp
    case faceExpressionStamp, handPoseStamp, cameraRigStamp
    case characterPoseStamp, doorStamp, tableStamp, sofaStamp
    case buildingStamp, streetLightStamp, boomMicStamp, filmLightStamp
    case bedStamp, staircaseStamp, counterStamp, workstationStamp
    case communicationStamp, luggageStamp, publicTransportStamp, animalStamp
    case rockTerrainStamp, waterStamp, fireSmokeStamp, weatherFXStamp
}

extension BrushType {
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

enum BrushCategory: String, Codable, Sendable, CaseIterable {
    case pencils, ink, tone, eraseBlend, wetMedia, production, texture, effects
    case sketchbook, colorPencil, studioGraphite, drawingBox
    case dryNib, printTone, comicColor, precisionStipple
    case productionGrammar, productionStamps, materials, details
}

enum ProductionMarkChannel: String, Codable, Sendable, CaseIterable {
    case direction, material, detail
}

/// Stabilt, provider-uavhengig vokabular som Prompt Engine kan kompilere til
/// modellspesifikke regler. Verdien lagres på BrushSpec, aldri kun i UI-navnet.
enum ProductionMarkKind: String, Codable, Sendable, CaseIterable {
    case gesture, silhouette, focus, depth, perspective, camera, motion, light
    case emotion, negativeSpace, eyeLine, staging, continuity, storyBeat
    case concrete, woodGrain, fabric, brushedMetal, glassReflection
    case groundGravel, skinOrganic, filmGrain, dustSmoke, rainWetSurface
    case foliage, crowd, architectureFill, shadowTexture, lightTexture
    case faceDetail, hairDetail, clothingDetail, handDetail, objectDetail
    case architectureDetail, vehicleDetail, surfaceDetail, techDetail
    case foodDetail, natureDetail, microShadow, edgeDetail
}

struct ProductionMarkProfile: Sendable, Equatable {
    let kind: ProductionMarkKind
    let channel: ProductionMarkChannel
    let displayName: String
    let help: String
    let aiInstruction: String
}

enum ProductionStampDepth: String, Codable, Sendable, CaseIterable {
    case foreground, midground, background

    var displayName: String {
        switch self {
        case .foreground: return "Forgrunn"
        case .midground: return "Mellomgrunn"
        case .background: return "Bakgrunn"
        }
    }

    /// Dybde er visuell regi, ikke bare en prompt-tag. Samme stamp blir
    /// enklere og lysere i bakgrunnen uten et nettverkskall.
    var renderScale: Double {
        switch self {
        case .foreground: return 1.18
        case .midground: return 1
        case .background: return 0.72
        }
    }

    var opacityMultiplier: Double {
        switch self {
        case .foreground: return 1
        case .midground: return 0.86
        case .background: return 0.62
        }
    }
}

enum ProductionStampRenderLayer: String, Codable, Sendable, CaseIterable {
    case artwork
    case productionOverlay
}

struct ProductionStampVariant: Sendable, Equatable, Identifiable {
    let id: Int
    let name: String
    let parameters: [String: String]
}

struct ProductionStampStyleOption: Sendable, Equatable, Identifiable {
    let id: String
    let name: String
}

enum ProductionStampStyleCatalog {
    static let options: [ProductionStampStyleOption] = [
        .init(id: "trr-story-pencil", name: "Story Pencil"),
        .init(id: "rough-graphite", name: "Rough Graphite"),
        .init(id: "charcoal-board", name: "Charcoal Board"),
        .init(id: "clean-production", name: "Clean Production"),
        .init(id: "noir-hatch", name: "Noir Hatch"),
        .init(id: "color-pencil", name: "Color Pencil"),
    ]
}

/// Rollene er både visuelle og redigerbare. En compound stamp kan rendres som
/// ett GPU-objekt, men frigis senere som separate Story Pencil-strøk med samme
/// rollefordeling.
enum ProductionStampPathRole: String, Codable, Sendable, CaseIterable {
    case construction
    case contour
    case detail
    case shadow

    var displayName: String {
        switch self {
        case .construction: return "Konstruksjon"
        case .contour: return "Hovedkontur"
        case .detail: return "Detalj"
        case .shadow: return "Skygge"
        }
    }
}

struct ProductionStampVectorPoint: Codable, Sendable, Equatable {
    var x: Double
    var y: Double
}

struct ProductionStampVectorPath: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var role: ProductionStampPathRole
    var points: [ProductionStampVectorPoint]
    var closed: Bool
    var lineWidth: Double
    var opacity: Double
}

/// Designrommet er alltid 128×128. Det gjør geometrien uavhengig av canvas-
/// størrelse og lar Metal-rasterisering og frigjorte PencilStroke-objekter
/// bruke nøyaktig samme kilde.
struct ProductionStampCompoundGeometry: Codable, Sendable, Equatable {
    static let currentVersion = "trr-compound-stamp-geometry-v1"

    var version: String
    var designSize: Double
    var paths: [ProductionStampVectorPath]

    init(paths: [ProductionStampVectorPath], designSize: Double = 128,
         version: String = currentVersion) {
        self.version = version
        self.designSize = designSize
        self.paths = paths
    }
}

/// Én kuratert, provider-uavhengig variantkatalog. Variantene styrer både
/// lokal prosedural geometri og den typed meningen Prompt Engine mottar.
enum ProductionStampCatalog {
    static func variants(for type: BrushType) -> [ProductionStampVariant] {
        func variant(_ id: Int, _ name: String,
                     _ parameters: [String: String]) -> ProductionStampVariant {
            .init(id: id, name: name, parameters: parameters)
        }
        switch type {
        case .crowdStamp:
            return [
                variant(0, "Bakgrunnsgruppe", ["density": "sparse", "activity": "standing"]),
                variant(1, "I bevegelse", ["density": "medium", "activity": "moving-right"]),
                variant(2, "Tett folkemengde", ["density": "dense", "activity": "gathered"]),
                variant(3, "Forgrunnsreaksjon", ["density": "medium", "activity": "reacting"]),
            ]
        case .treeStamp:
            return [
                variant(0, "Løvtre", ["species": "deciduous", "season": "summer"]),
                variant(1, "Furu", ["species": "conifer", "season": "evergreen"]),
                variant(2, "Vindtre", ["species": "deciduous", "wind": "strong-right"]),
                variant(3, "Vintertre", ["species": "deciduous", "season": "winter"]),
            ]
        case .windowStamp:
            return [
                variant(0, "Kryssvindu", ["windowType": "four-pane", "state": "closed"]),
                variant(1, "Høyt vindu", ["windowType": "tall", "state": "closed"]),
                variant(2, "Åpent vindu", ["windowType": "casement", "state": "open"]),
                variant(3, "Industrivindu", ["windowType": "industrial-grid", "state": "closed"]),
            ]
        case .carStamp:
            return [
                variant(0, "Sedan", ["vehicleType": "sedan", "view": "side"]),
                variant(1, "SUV", ["vehicleType": "suv", "view": "three-quarter"]),
                variant(2, "Varebil", ["vehicleType": "van", "view": "side"]),
                variant(3, "Politibil", ["vehicleType": "police-car", "view": "three-quarter"]),
            ]
        case .chairStamp:
            return [
                variant(0, "Kjøkkenstol", ["chairType": "dining", "state": "empty"]),
                variant(1, "Kontorstol", ["chairType": "office", "state": "empty"]),
                variant(2, "Lenestol", ["chairType": "armchair", "state": "empty"]),
                variant(3, "Regissørstol", ["chairType": "director", "state": "empty"]),
            ]
        case .faceExpressionStamp:
            return [
                variant(0, "Overrasket", ["emotion": "surprised", "intensity": "high"]),
                variant(1, "Glad", ["emotion": "happy", "intensity": "medium"]),
                variant(2, "Bekymret", ["emotion": "worried", "intensity": "medium"]),
                variant(3, "Sint", ["emotion": "angry", "intensity": "high"]),
            ]
        case .handPoseStamp:
            return [
                variant(0, "Åpen hånd", ["pose": "open-palm", "interaction": "none"]),
                variant(1, "Peker", ["pose": "pointing", "interaction": "directing"]),
                variant(2, "Knyttet hånd", ["pose": "fist", "interaction": "none"]),
                variant(3, "Grep", ["pose": "grip", "interaction": "holding-prop"]),
            ]
        case .cameraRigStamp:
            return [
                variant(0, "Stativ", ["rigType": "tripod", "movement": "static"]),
                variant(1, "Håndholdt", ["rigType": "handheld", "movement": "handheld"]),
                variant(2, "Dolly", ["rigType": "dolly", "movement": "track"]),
                variant(3, "Kran", ["rigType": "crane", "movement": "crane"]),
            ]
        case .characterPoseStamp:
            return [
                variant(0, "Nøytral stående", ["pose": "neutral-standing", "energy": "calm"]),
                variant(1, "Løper", ["pose": "running", "energy": "high", "direction": "right"]),
                variant(2, "Lav huk", ["pose": "low-crouch", "energy": "ready"]),
                variant(3, "Peker", ["pose": "reaching-pointing", "energy": "directing"]),
            ]
        case .doorStamp:
            return [
                variant(0, "Lukket paneldør", ["doorType": "residential-panel", "state": "closed"]),
                variant(1, "Åpen dør", ["doorType": "residential-panel", "state": "open-45"]),
                variant(2, "Industridør", ["doorType": "industrial-metal", "state": "closed"]),
                variant(3, "Glassdører", ["doorType": "double-glass", "state": "closed"]),
            ]
        case .tableStamp:
            return [
                variant(0, "Spisebord", ["tableType": "dining", "shape": "rectangular"]),
                variant(1, "Skrivebord", ["tableType": "office-desk", "storage": "drawers"]),
                variant(2, "Kafébord", ["tableType": "cafe", "shape": "round"]),
                variant(3, "Produksjonsbord", ["tableType": "folding", "state": "open"]),
            ]
        case .sofaStamp:
            return [
                variant(0, "Toseter", ["sofaType": "two-seat", "condition": "clean"]),
                variant(1, "Treseter", ["sofaType": "three-seat", "condition": "clean"]),
                variant(2, "Hjørnesofa", ["sofaType": "sectional", "orientation": "right-chaise"]),
                variant(3, "Slitt sofa", ["sofaType": "vintage", "condition": "worn"]),
            ]
        case .buildingStamp:
            return [
                variant(0, "Enebolig", ["buildingType": "detached-house", "scale": "small"]),
                variant(1, "Leiegård", ["buildingType": "apartment-block", "scale": "mid-rise"]),
                variant(2, "Butikklokale", ["buildingType": "storefront", "scale": "street-level"]),
                variant(3, "Lager / studio", ["buildingType": "warehouse-soundstage", "scale": "large"]),
            ]
        case .streetLightStamp:
            return [
                variant(0, "Klassisk gatelykt", ["fixtureType": "heritage-lamp", "mount": "pole"]),
                variant(1, "Moderne gatelykt", ["fixtureType": "urban-led", "mount": "curved-pole"]),
                variant(2, "Dobbel veilampe", ["fixtureType": "dual-highway", "mount": "pole"]),
                variant(3, "Vegglampe", ["fixtureType": "exterior-wall", "mount": "wall"]),
            ]
        case .boomMicStamp:
            return [
                variant(0, "Overhead boom", ["soundRig": "overhead-boom", "support": "stand"]),
                variant(1, "Håndholdt boom", ["soundRig": "handheld-boom", "support": "operator"]),
                variant(2, "Boom på C-stand", ["soundRig": "c-stand-boom", "support": "counterweight"]),
                variant(3, "Plantemikrofon", ["soundRig": "boundary-mic", "support": "surface"]),
            ]
        case .filmLightStamp:
            return [
                variant(0, "Fresnel", ["lightType": "fresnel", "modifier": "barn-doors"]),
                variant(1, "LED-panel", ["lightType": "led-panel", "modifier": "none"]),
                variant(2, "Softbox", ["lightType": "softbox", "modifier": "diffusion"]),
                variant(3, "Tubelys", ["lightType": "tube-light", "modifier": "none"]),
            ]
        case .bedStamp:
            return [
                variant(0, "Enkeltseng", ["bedType": "single", "setting": "bedroom"]),
                variant(1, "Dobbeltseng", ["bedType": "double", "setting": "bedroom-hotel"]),
                variant(2, "Køyeseng", ["bedType": "bunk", "levels": "two"]),
                variant(3, "Sykehusseng", ["bedType": "hospital", "state": "adjustable"]),
            ]
        case .staircaseStamp:
            return [
                variant(0, "Rett trapp", ["stairType": "straight-interior", "landings": "zero"]),
                variant(1, "L-trapp", ["stairType": "l-shaped", "landings": "one"]),
                variant(2, "Spiraltrapp", ["stairType": "spiral", "material": "metal"]),
                variant(3, "Branntrapp", ["stairType": "fire-escape", "setting": "exterior"]),
            ]
        case .counterStamp:
            return [
                variant(0, "Kjøkkenbenk", ["counterType": "kitchen-sink", "setting": "domestic"]),
                variant(1, "Kjøkkenøy", ["counterType": "island", "setting": "domestic"]),
                variant(2, "Serveringsdisk", ["counterType": "cafe-bar", "setting": "hospitality"]),
                variant(3, "Resepsjon", ["counterType": "reception", "setting": "public"]),
            ]
        case .workstationStamp:
            return [
                variant(0, "Kontorpult", ["workstationType": "office-desktop", "screens": "one"]),
                variant(1, "Laptop-plass", ["workstationType": "laptop", "screens": "one"]),
                variant(2, "Klippesuite", ["workstationType": "editing-suite", "screens": "two"]),
                variant(3, "Kontrollkonsoll", ["workstationType": "control-console", "screens": "multiple"]),
            ]
        case .communicationStamp:
            return [
                variant(0, "Smarttelefon", ["deviceType": "smartphone", "state": "blank-screen"]),
                variant(1, "Bordtelefon", ["deviceType": "corded-phone", "state": "idle"]),
                variant(2, "Walkie-talkie", ["deviceType": "two-way-radio", "state": "ready"]),
                variant(3, "Kommunikasjonshodesett", ["deviceType": "headset", "microphone": "boom"]),
            ]
        case .luggageStamp:
            return [
                variant(0, "Trillekoffert", ["luggageType": "rolling-suitcase", "state": "upright"]),
                variant(1, "Duffelbag", ["luggageType": "duffel", "state": "resting"]),
                variant(2, "Ryggsekk", ["luggageType": "backpack", "state": "upright"]),
                variant(3, "Flightcase", ["luggageType": "equipment-case", "state": "wheeled"]),
            ]
        case .publicTransportStamp:
            return [
                variant(0, "Bybuss", ["transportType": "city-bus", "view": "three-quarter"]),
                variant(1, "Trikk", ["transportType": "tram", "view": "three-quarter"]),
                variant(2, "T-bane", ["transportType": "subway", "view": "three-quarter"]),
                variant(3, "Passasjertog", ["transportType": "intercity-train", "view": "three-quarter"]),
            ]
        case .animalStamp:
            return [
                variant(0, "Hund", ["animalType": "dog", "pose": "alert-standing"]),
                variant(1, "Katt", ["animalType": "cat", "pose": "seated"]),
                variant(2, "Hest", ["animalType": "horse", "pose": "standing-profile"]),
                variant(3, "Fugleflokk", ["animalType": "birds", "pose": "taking-flight"]),
            ]
        case .rockTerrainStamp:
            return [
                variant(0, "Steinblokk", ["terrainType": "boulder", "scale": "large"]),
                variant(1, "Fjellknaus", ["terrainType": "rocky-outcrop", "scale": "low"]),
                variant(2, "Klippevegg", ["terrainType": "cliff-face", "scale": "large"]),
                variant(3, "Rasmasser", ["terrainType": "rubble-pile", "condition": "broken"]),
            ]
        case .waterStamp:
            return [
                variant(0, "Regnpytt", ["waterType": "puddle", "surface": "ripples"]),
                variant(1, "Elvebredd", ["waterType": "riverbank", "flow": "gentle"]),
                variant(2, "Tjernkant", ["waterType": "pond-edge", "vegetation": "reeds"]),
                variant(3, "Havbølge", ["waterType": "ocean-wave", "state": "curling"]),
            ]
        case .fireSmokeStamp:
            return [
                variant(0, "Liten flamme", ["effectType": "flame", "intensity": "low"]),
                variant(1, "Bål", ["effectType": "campfire", "intensity": "medium"]),
                variant(2, "Røyksøyle", ["effectType": "smoke-plume", "intensity": "medium"]),
                variant(3, "Nedslagsky", ["effectType": "impact-cloud", "intensity": "high"]),
            ]
        case .weatherFXStamp:
            return [
                variant(0, "Regnfelt", ["weatherType": "rain", "direction": "diagonal"]),
                variant(1, "Snøfall", ["weatherType": "snow", "intensity": "medium"]),
                variant(2, "Vindkast", ["weatherType": "wind", "debris": "leaves"]),
                variant(3, "Tåkebanke", ["weatherType": "fog", "height": "low"]),
            ]
        default:
            return []
        }
    }

    static func normalizedVariant(_ variant: Int, for type: BrushType) -> Int {
        let count = max(1, variants(for: type).count)
        return ((variant % count) + count) % count
    }

    static func variant(_ index: Int, for type: BrushType) -> ProductionStampVariant? {
        let variants = variants(for: type)
        guard !variants.isEmpty else { return nil }
        return variants[normalizedVariant(index, for: type)]
    }

    /// FNV-1a 32-bit gir samme seed på tvers av prosess, enhet og Swift-
    /// versjon. hashValue kan ikke brukes fordi den randomiseres per prosess.
    static func stableSeed(for key: String) -> UInt32 {
        key.utf8.reduce(UInt32(2_166_136_261)) { hash, byte in
            (hash ^ UInt32(byte)) &* 16_777_619
        }
    }
}

struct ProductionStampInstance: Codable, Sendable, Equatable {
    static let currentVersion = "trr-production-stamp-v3"

    var version: String
    var variant: Int
    var variantName: String
    var seed: UInt32
    var scale: Double
    var rotationDegrees: Double
    var flipX: Bool
    var depth: ProductionStampDepth
    var styleProfileId: String
    var continuityId: String?
    var renderLayer: ProductionStampRenderLayer
    var parameters: [String: String]
    // Optional holder Stamp Engine 2.0-dokumenter gyldige. Nye stempler
    // persisterer sin faktiske vektorgeometri og perspektivdeformasjon.
    var compoundGeometry: ProductionStampCompoundGeometry?
    var perspectiveSkew: Double?

    init(variant: Int, variantName: String, seed: UInt32,
         scale: Double = 1, rotationDegrees: Double = 0,
         flipX: Bool = false, depth: ProductionStampDepth = .midground,
         styleProfileId: String = "trr-story-pencil",
         continuityId: String? = nil,
         renderLayer: ProductionStampRenderLayer = .artwork,
         parameters: [String: String] = [:],
         compoundGeometry: ProductionStampCompoundGeometry? = nil,
         perspectiveSkew: Double? = nil,
         version: String = currentVersion) {
        self.version = version
        self.variant = variant
        self.variantName = variantName
        self.seed = seed
        self.scale = min(8, max(0.1, scale))
        self.rotationDegrees = rotationDegrees
        self.flipX = flipX
        self.depth = depth
        self.styleProfileId = styleProfileId
        self.continuityId = continuityId
        self.renderLayer = renderLayer
        self.parameters = parameters
        self.compoundGeometry = compoundGeometry
        self.perspectiveSkew = perspectiveSkew.map { min(0.45, max(-0.45, $0)) }
    }
}

/// Bevarer den semantiske stamp-identiteten når brukeren frigjør objektet til
/// vanlige penselstrøk. Kun første komponent bærer konteksten, så Prompt Engine
/// får nøyaktig ett markør-objekt og ikke én duplikat per detaljlinje.
struct ReleasedProductionStampContext: Codable, Sendable, Equatable {
    var originalStrokeId: String
    var kind: ProductionMarkKind
    var centerX: Double
    var centerY: Double
    var baseSize: Double
    var stamp: ProductionStampInstance
}

enum ProductionMarkCatalog {
    static let productionBrushes: [BrushType] = [
        .gestureBrush, .silhouetteBrush, .focusBrush, .depthBrush,
        .perspectiveBrush, .cameraBrush, .motionBrush, .lightBrush,
        .emotionBrush, .negativeSpaceBrush, .eyeLineBrush, .stagingBrush,
        .continuityBrush, .storyBeatBrush,
    ]

    static let materialBrushes: [BrushType] = [
        .concreteTexture, .woodGrain, .fabricTexture, .brushedMetal,
        .glassReflection, .groundGravel, .skinOrganic, .filmGrain,
        .dustSmoke, .rainWetSurface, .foliageTexture, .crowdTexture,
        .architectureFill, .shadowTexture, .lightTexture,
    ]

    static let detailBrushes: [BrushType] = [
        .faceDetail, .hairDetail, .clothingDetail, .handDetail, .objectDetail,
        .architectureDetail, .vehicleDetail, .surfaceDetail, .techDetail,
        .foodDetail, .natureDetail, .microShadow, .edgeDetail,
    ]

    static let stampBrushes: [BrushType] = [
        .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
        .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
        .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
        .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
        .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
        .communicationStamp, .luggageStamp, .publicTransportStamp, .animalStamp,
        .rockTerrainStamp, .waterStamp, .fireSmokeStamp, .weatherFXStamp,
    ]

    /// Scenario-aware ordering, not hiding: specialists see every stamp, while
    /// the relevant production vocabulary moves to the front of the palette.
    static func recommendedStamps(packId: String?, subdomainId: String?) -> [BrushType] {
        switch packId {
        case "medical.healthcare":
            var values: [BrushType] = [
                .bedStamp, .workstationStamp, .communicationStamp,
                .characterPoseStamp, .handPoseStamp, .faceExpressionStamp,
                .chairStamp, .doorStamp,
            ]
            if subdomainId == "ambulance" { values.insert(.carStamp, at: 0) }
            if subdomainId == "emergency-department" { values.append(.publicTransportStamp) }
            return values
        case "restaurant.food-service":
            var values: [BrushType] = [
                .counterStamp, .tableStamp, .chairStamp, .characterPoseStamp,
                .handPoseStamp, .communicationStamp, .doorStamp, .windowStamp,
            ]
            if subdomainId == "food-truck" { values.insert(.carStamp, at: 0) }
            return values
        case "police.security":
            return [.carStamp, .communicationStamp, .crowdStamp, .characterPoseStamp,
                    .handPoseStamp, .doorStamp, .workstationStamp]
        case "fire.rescue":
            return [.carStamp, .fireSmokeStamp, .weatherFXStamp, .communicationStamp,
                    .characterPoseStamp, .bedStamp, .buildingStamp]
        case "education.school":
            return [.tableStamp, .chairStamp, .workstationStamp, .crowdStamp,
                    .characterPoseStamp, .communicationStamp]
        case "hospitality.hotel":
            return [.luggageStamp, .counterStamp, .bedStamp, .chairStamp,
                    .doorStamp, .workstationStamp]
        case "office.production":
            return [.workstationStamp, .tableStamp, .chairStamp, .cameraRigStamp,
                    .boomMicStamp, .filmLightStamp, .characterPoseStamp]
        case "retail.shop":
            return [.counterStamp, .tableStamp, .chairStamp, .crowdStamp,
                    .workstationStamp, .doorStamp]
        case "airport.travel":
            return [.luggageStamp, .publicTransportStamp, .crowdStamp, .counterStamp,
                    .communicationStamp, .characterPoseStamp]
        case "construction.site":
            return [.buildingStamp, .rockTerrainStamp, .carStamp, .staircaseStamp,
                    .communicationStamp, .characterPoseStamp]
        case "industrial.workshop":
            return [.workstationStamp, .counterStamp, .carStamp, .communicationStamp,
                    .characterPoseStamp, .doorStamp]
        case "residential.domestic":
            return [.sofaStamp, .bedStamp, .tableStamp, .chairStamp, .doorStamp,
                    .windowStamp, .characterPoseStamp]
        case "sports.fitness":
            return [.crowdStamp, .characterPoseStamp, .handPoseStamp, .chairStamp,
                    .communicationStamp, .weatherFXStamp]
        case "event.entertainment":
            return [.crowdStamp, .cameraRigStamp, .boomMicStamp, .filmLightStamp,
                    .luggageStamp, .characterPoseStamp]
        default:
            return []
        }
    }

    static var allBrushes: [BrushType] {
        productionBrushes + materialBrushes + detailBrushes + stampBrushes
    }

    static func profile(for type: BrushType) -> ProductionMarkProfile? {
        func mark(_ kind: ProductionMarkKind, _ channel: ProductionMarkChannel,
                  _ name: String, _ help: String,
                  _ instruction: String) -> ProductionMarkProfile {
            .init(kind: kind, channel: channel, displayName: name,
                  help: help, aiInstruction: instruction)
        }
        switch type {
        case .gestureBrush:
            return mark(.gesture, .direction, "Gesture", "Raske kroppsformer for pose, retning og energi.", "Treat this mark as the character pose, body direction, energy and primary action.")
        case .silhouetteBrush:
            return mark(.silhouette, .direction, "Silhouette", "Bygg karakteren som en lesbar mørk masse.", "Preserve the marked character mass as a clear silhouette and blocking boundary.")
        case .focusBrush:
            return mark(.focus, .direction, "Focus", "Marker området publikum skal se først.", "Make the marked region the audience's primary visual focus.")
        case .depthBrush:
            return mark(.depth, .direction, "Depth", "Marker forgrunn, mellomgrunn og bakgrunn.", "Use the marked region to reinforce foreground, midground and background hierarchy.")
        case .perspectiveBrush:
            return mark(.perspective, .direction, "Perspective", "Tegn horisont og perspektivlinjer.", "Infer horizon, vanishing direction and camera perspective from this guide.")
        case .cameraBrush:
            return mark(.camera, .direction, "Camera", "Tegn ønsket ramme, crop og utsnitt.", "Treat this boundary as the intended shot framing and crop.")
        case .motionBrush:
            return mark(.motion, .direction, "Motion", "Vis hvem eller hva som beveger seg, og hvor.", "Preserve the marked subject's movement direction and energy.")
        case .lightBrush:
            return mark(.light, .direction, "Light", "Blokker lys, skygge og key-light-retning.", "Use this mark as a lighting zone and key-light direction cue.")
        case .emotionBrush:
            return mark(.emotion, .direction, "Emotion", "Marker uttrykk og emosjonell intensjon.", "Preserve the marked performance and emotional intention.")
        case .negativeSpaceBrush:
            return mark(.negativeSpace, .direction, "Negative Space", "Reserver kompositorisk pusterom.", "Keep the marked area intentionally empty as negative space.")
        case .eyeLineBrush:
            return mark(.eyeLine, .direction, "Eye-Line", "Tegn blikkretning mellom karakterer og mål.", "Preserve the marked eyeline direction and subject-to-target relationship.")
        case .stagingBrush:
            return mark(.staging, .direction, "Staging", "Blokker karakterer, objekter og sceneposisjoner.", "Treat these masses as locked scene staging and subject placement.")
        case .continuityBrush:
            return mark(.continuity, .direction, "Continuity", "Marker elementer som må være like mellom shots.", "Lock the marked identity, object, costume or position across adjacent shots.")
        case .storyBeatBrush:
            return mark(.storyBeat, .direction, "Story Beat", "Marker reveal, reaksjon, konflikt eller payoff.", "Make the marked moment the shot's dramatic story beat.")
        case .concreteTexture:
            return mark(.concrete, .material, "Concrete / Rough Wall", "Ru mur, betong og slitte flater.", "Render the marked surface as rough concrete or masonry with irregular pores and wear.")
        case .woodGrain:
            return mark(.woodGrain, .material, "Wood Grain", "Retningsstyrt treverk og årringer.", "Render the marked surface as directional wood grain following the stroke flow.")
        case .fabricTexture:
            return mark(.fabric, .material, "Fabric / Cloth", "Vev, klær, sofa og gardiner.", "Render the marked surface as woven fabric with readable folds and cloth scale.")
        case .brushedMetal:
            return mark(.brushedMetal, .material, "Metal / Brushed", "Metall med retningsstyrt slip og glans.", "Render the marked surface as brushed metal with directional highlights.")
        case .glassReflection:
            return mark(.glassReflection, .material, "Glass / Reflection", "Vinduer, skjermer, speil og refleksjoner.", "Render the marked plane as glass with controlled reflection and transparency cues.")
        case .groundGravel:
            return mark(.groundGravel, .material, "Ground / Gravel", "Asfalt, jord, grus og skogbunn.", "Render the marked ground as irregular gravel, asphalt or soil at scene scale.")
        case .skinOrganic:
            return mark(.skinOrganic, .material, "Skin / Organic", "Myk organisk overflate og hudtekstur.", "Render the marked surface as subtle organic or skin texture without over-detailing.")
        case .filmGrain:
            return mark(.filmGrain, .material, "Noise / Film Grain", "Atmosfærisk korn, grit og stemning.", "Apply controlled film grain and atmospheric grit to the marked region.")
        case .dustSmoke:
            return mark(.dustSmoke, .material, "Dust / Smoke", "Luftpartikler, tåke, støv og røyk.", "Add volumetric dust or smoke particles that reinforce depth in the marked region.")
        case .rainWetSurface:
            return mark(.rainWetSurface, .material, "Rain / Wet Surface", "Regnretning, våte flater og refleksjoner.", "Render rain direction, wet reflections and surface sheen in the marked region.")
        case .foliageTexture:
            return mark(.foliage, .material, "Foliage", "Antyd trær, gress, blader og busker.", "Render grouped foliage masses with readable leaf and grass rhythm.")
        case .crowdTexture:
            return mark(.crowd, .material, "Crowd Texture", "Antyd en folkemengde uten å tegne alle.", "Populate the marked mass as a readable crowd without individual portrait detail.")
        case .architectureFill:
            return mark(.architectureFill, .material, "Architecture Fill", "Murstein, panel, fliser og fasaderytme.", "Fill the marked architecture with consistent masonry, panel or tile rhythm.")
        case .shadowTexture:
            return mark(.shadowTexture, .material, "Shadow Texture", "Strukturert, håndtegnet skyggelegging.", "Treat this region as textured shadow while preserving readable silhouettes.")
        case .lightTexture:
            return mark(.lightTexture, .material, "Light Texture", "Persienner, neon, dappled og volumetrisk lys.", "Treat this region as patterned or volumetric light with a clear source direction.")
        case .faceDetail:
            return mark(.faceDetail, .detail, "Face Detail", "Øyne, nese, munn, bryn og små uttrykk.", "Preserve the marked facial features and subtle expression as intentional detail.")
        case .hairDetail:
            return mark(.hairDetail, .detail, "Hair Detail", "Hårstrå, lokker, skjegg og tekstur.", "Preserve the marked hair flow, locks, beard and strand rhythm.")
        case .clothingDetail:
            return mark(.clothingDetail, .detail, "Clothing Detail", "Sømmer, folder, knapper, lommer og glidelås.", "Preserve the marked garment seams, folds, closures and pocket details.")
        case .handDetail:
            return mark(.handDetail, .detail, "Hand Detail", "Fingre, knoker, negler og grep.", "Preserve the marked hand anatomy, finger placement and object grip.")
        case .objectDetail:
            return mark(.objectDetail, .detail, "Object Detail", "Skruer, knotter, brytere, håndtak og kanter.", "Preserve the marked object's functional controls, fasteners and edges.")
        case .architectureDetail:
            return mark(.architectureDetail, .detail, "Architecture Detail", "Vinduer, murfuger, panel, fliser og ventilasjon.", "Preserve the marked architectural rhythm, joints, windows and vents.")
        case .vehicleDetail:
            return mark(.vehicleDetail, .detail, "Vehicle Detail", "Grill, panel-linjer, hjul og lys.", "Preserve the marked vehicle panel lines, wheels, grille and lights.")
        case .surfaceDetail:
            return mark(.surfaceDetail, .detail, "Surface Detail", "Riper, sprekker, slitasje og smuss.", "Preserve the marked scratches, cracks, wear and dirt pattern.")
        case .techDetail:
            return mark(.techDetail, .detail, "Tech Detail", "Knapper, skjermer, kabler og indikatorlys.", "Preserve the marked interface controls, screens, cables and status lights.")
        case .foodDetail:
            return mark(.foodDetail, .detail, "Food Detail", "Skorpe, topping, damp, saus og tekstur.", "Preserve the marked food texture, toppings, steam and sauce detail.")
        case .natureDetail:
            return mark(.natureDetail, .detail, "Nature Detail", "Blader, bark, gress, stein og kvister.", "Preserve the marked natural micro-detail and organic edge rhythm.")
        case .microShadow:
            return mark(.microShadow, .detail, "Micro Shadow", "Små kontaktskygger som gjør formen lesbar.", "Use these marks as small contact shadows that clarify form and attachment.")
        case .edgeDetail:
            return mark(.edgeDetail, .detail, "Edge Detail", "Små høylys og kantmarkeringer.", "Use these marks as controlled edge accents and highlights.")
        case .crowdStamp:
            return mark(.crowd, .material, "Crowd Stamp", "Plasser en lesbar gruppe mennesker med ett tap.", "Treat this stamped group as locked crowd placement, scale and density.")
        case .treeStamp:
            return mark(.foliage, .material, "Tree Stamp", "Plasser et håndtegnet tre med ett tap.", "Treat this stamped tree as intentional foliage placement, silhouette and scale.")
        case .windowStamp:
            return mark(.architectureDetail, .detail, "Window Stamp", "Plasser et vindu med karm og sprosser.", "Preserve this stamped window position, frame, panes and architectural scale.")
        case .carStamp:
            return mark(.vehicleDetail, .detail, "Car Stamp", "Plasser en enkel bilsilhuett i scenen.", "Preserve this stamped vehicle placement, orientation, type and scale.")
        case .chairStamp:
            return mark(.objectDetail, .detail, "Chair Stamp", "Plasser en stol som blocking- eller propmarkør.", "Preserve this stamped chair as a prop with locked placement, orientation and scale.")
        case .faceExpressionStamp:
            return mark(.faceDetail, .detail, "Face Expression Stamp", "Plasser et tydelig ansiktsuttrykk for performance.", "Preserve this stamped facial expression as the character's performance intention.")
        case .handPoseStamp:
            return mark(.handDetail, .detail, "Hand Pose Stamp", "Plasser en lesbar åpen håndpose.", "Preserve this stamped hand pose, finger spread, gesture and interaction intent.")
        case .cameraRigStamp:
            return mark(.camera, .direction, "Camera Rig Stamp", "Plasser kamera og rigg i blocking-diagrammet.", "Treat this stamped camera rig as the intended camera position, orientation and support setup.")
        case .characterPoseStamp:
            return mark(.gesture, .direction, "Character Pose Stamp", "Plasser en lesbar helfigur med valgt positur.", "Preserve this full-body character pose, action line, facing and staging intention.")
        case .doorStamp:
            return mark(.architectureDetail, .detail, "Door Stamp", "Plasser en dør med tydelig åpningstilstand og perspektiv.", "Preserve this door type, open state, frame, swing direction and architectural scale.")
        case .tableStamp:
            return mark(.objectDetail, .detail, "Table Stamp", "Plasser bord eller skrivebord som prop og blockingflate.", "Preserve this table type, top plane, orientation and prop scale.")
        case .sofaStamp:
            return mark(.objectDetail, .detail, "Sofa Stamp", "Plasser en sofa med lesbar sittekapasitet og retning.", "Preserve this sofa type, seating capacity, orientation and continuity.")
        case .buildingStamp:
            return mark(.architectureDetail, .detail, "Building Stamp", "Plasser en lesbar bygning eller fasade i establishing shots.", "Preserve this building type, façade rhythm, perspective, scale and location continuity.")
        case .streetLightStamp:
            return mark(.light, .direction, "Street Light Stamp", "Plasser praktisk utebelysning med tydelig høyde og retning.", "Treat this fixture as locked practical lighting with preserved mount, scale and direction.")
        case .boomMicStamp:
            return mark(.objectDetail, .detail, "Boom Mic Stamp", "Plasser lydriggen i produksjonsblocking uten å forveksle den med scenografi.", "Treat this boom microphone setup as production sound placement, support and pickup direction.")
        case .filmLightStamp:
            return mark(.light, .direction, "Film Light Stamp", "Plasser filmlys og modifier i lysdiagrammet.", "Treat this film light as intended fixture type, support position, modifier and lighting direction.")
        case .bedStamp:
            return mark(.objectDetail, .detail, "Bed Stamp", "Plasser seng, sengetøy og medisinsk variant med lesbar skala.", "Preserve the selected bed type, bedding, orientation and scene function.")
        case .staircaseStamp:
            return mark(.architectureDetail, .detail, "Staircase Stamp", "Plasser høydeforskjell, landing og rekkverk for blocking.", "Preserve stair type, rise direction, landing, railing and architectural access.")
        case .counterStamp:
            return mark(.architectureDetail, .detail, "Counter Stamp", "Etabler kjøkken, servicepunkt eller resepsjon med riktig funksjon.", "Preserve the counter type, working side, fixtures and interaction surface.")
        case .workstationStamp:
            return mark(.techDetail, .detail, "Workstation Stamp", "Plasser arbeidsstasjon og skjermoppsett som handlingen kan bruke.", "Preserve workstation purpose, screen count, controls, chair and interaction side.")
        case .communicationStamp:
            return mark(.techDetail, .detail, "Communication Prop Stamp", "Plasser kommunikasjonsutstyr som et tydelig story prop.", "Preserve the selected communication device, state, handling and story function.")
        case .luggageStamp:
            return mark(.objectDetail, .detail, "Luggage Stamp", "Plasser bagasje eller utstyrskasse med lesbar type og retning.", "Preserve luggage type, orientation, handles, wheels and production or travel purpose.")
        case .publicTransportStamp:
            return mark(.vehicleDetail, .detail, "Public Transport Stamp", "Etabler kollektivtransport med tydelig kjøretøytype og reiseretning.", "Preserve transport type, view, travel direction, doors and passenger scale.")
        case .animalStamp:
            return mark(.natureDetail, .detail, "Animal Stamp", "Plasser dyr med lesbar art, pose og handlingsretning.", "Preserve animal type, pose, gaze, movement and scale relative to characters.")
        case .rockTerrainStamp:
            return mark(.natureDetail, .detail, "Rock Terrain Stamp", "Bygg lesbart terreng, dekning, klippekant eller rasmasser.", "Preserve rock formation type, scale, silhouette, surface planes and terrain function.")
        case .waterStamp:
            return mark(.natureDetail, .detail, "Water Stamp", "Plasser vannflate, kant, strøm eller bølge med tydelig retning.", "Preserve water type, edge shape, flow direction, reflections and surface state.")
        case .fireSmokeStamp:
            return mark(.dustSmoke, .material, "Fire / Smoke FX Stamp", "Plasser flamme, røyk eller nedslag med kontrollert intensitet.", "Preserve effect type, origin, intensity, spread direction and atmospheric depth.")
        case .weatherFXStamp:
            return mark(.rainWetSurface, .material, "Weather FX Stamp", "Legg vær som en regissert effekt med retning og intensitet.", "Preserve weather type, direction, density, depth layer and continuity across shots.")
        default:
            return nil
        }
    }

    static func profile(for kind: ProductionMarkKind) -> ProductionMarkProfile? {
        allBrushes.lazy.compactMap { profile(for: $0) }.first { $0.kind == kind }
    }
}

struct BrushCatalogSection: Sendable, Equatable {
    let category: BrushCategory
    let title: String
    let brushes: [BrushType]
}

enum BrushCatalog {
    /// Én kuratert kilde for verktøyvelger, long-press-meny og dekningstester.
    static let sections: [BrushCatalogSection] = [
        .init(category: .pencils, title: "Blyant", brushes: [
            .layout, .bluepencil, .redpencil, .pencil, .detail, .mechanical,
            .heavy, .graphite, .shade, .charcoal, .conte, .pastel
        ]),
        .init(category: .sketchbook, title: "Sketchbook", brushes: [
            .sketchHB, .sketch6B, .sketchTilt
        ]),
        .init(category: .colorPencil, title: "Fargeblyant", brushes: [
            .colorHard, .colorSoft, .colorShade
        ]),
        .init(category: .studioGraphite, title: "Studio Graphite", brushes: [
            .studio2H, .studioHB, .studio4B
        ]),
        .init(category: .drawingBox, title: "Tegnekasse", brushes: [
            .vineCharcoal, .blockCharcoal, .softPastel
        ]),
        .init(category: .ink, title: "Tusj", brushes: [
            .pen, .ink, .dryink, .brush, .sumi, .marker, .tonemarker, .highlighter
        ]),
        .init(category: .dryNib, title: "Dry Nib", brushes: [
            .nibFine, .nibRough, .nibBrush
        ]),
        .init(category: .tone, title: "Tone", brushes: [
            .hatch, .crosshatch, .stipple, .halftone, .toneblock, .graintex, .airbrush
        ]),
        .init(category: .printTone, title: "Print Tones", brushes: [
            .toneDots, .toneLines, .toneCross
        ]),
        .init(category: .comicColor, title: "Comic Color", brushes: [
            .comicFlat, .comicShade
        ]),
        .init(category: .precisionStipple, title: "Precision Stipple", brushes: [
            .stippleFine, .stippleRough, .stippleFill
        ]),
        .init(category: .productionGrammar, title: "AI-produksjon", brushes:
            ProductionMarkCatalog.productionBrushes),
        .init(category: .productionStamps, title: "Produksjonsstempler", brushes:
            ProductionMarkCatalog.stampBrushes),
        .init(category: .materials, title: "Materialer", brushes:
            ProductionMarkCatalog.materialBrushes),
        .init(category: .details, title: "Detaljer", brushes:
            ProductionMarkCatalog.detailBrushes),
        .init(category: .eraseBlend, title: "Visk og bland", brushes: [
            .eraser, .vinyl, .kneaded, .lightlift, .tortillon, .smudge
        ]),
        .init(category: .wetMedia, title: "Våte medier", brushes: [
            .watercolor, .wash, .gouache, .oil
        ]),
        .init(category: .production, title: "Produksjon", brushes: [
            .fill, .speedlines, .stamp, .custom
        ]),
        .init(category: .texture, title: "Miljø og tekstur", brushes: [
            .forest, .debris, .organictex, .fur, .wethair, .spikes, .skintex, .rocktex
        ]),
        .init(category: .effects, title: "Effekter", brushes: [
            .softfocus, .gloss
        ])
    ]

    static let core: [BrushType] = [
        .layout, .pencil, .heavy, .detail, .ink, .marker,
        .hatch, .shade, .eraser, .kneaded, .tortillon, .watercolor
    ]

    static var all: [BrushType] { sections.flatMap(\.brushes) }

    static func displayName(_ type: BrushType) -> String {
        if let profile = ProductionMarkCatalog.profile(for: type) {
            return profile.displayName
        }
        switch type {
        case .bluepencil: return "Blå layout"
        case .redpencil: return "Rød layout"
        case .mechanical: return "Mekanisk"
        case .dryink: return "Tørr tusj"
        case .tonemarker: return "Tonemarker"
        case .tortillon: return "Tortillon"
        case .vinyl: return "Hard vinyl"
        case .stipple: return "Stipple"
        case .sumi: return "Sumi"
        case .gouache: return "Gouache"
        case .oil: return "Olje"
        case .sketchHB: return "Sketch HB"
        case .sketch6B: return "Sketch 6B"
        case .sketchTilt: return "Sketch Side"
        case .colorHard: return "Color Hard"
        case .colorSoft: return "Color Soft"
        case .colorShade: return "Color Shade"
        case .studio2H: return "Studio 2H"
        case .studioHB: return "Studio HB"
        case .studio4B: return "Studio 4B"
        case .vineCharcoal: return "Vine Charcoal"
        case .blockCharcoal: return "Block Charcoal"
        case .softPastel: return "Soft Pastel"
        case .nibFine: return "Fine Nib"
        case .nibRough: return "Rough Nib"
        case .nibBrush: return "Dry Brush"
        case .toneDots: return "Dot Tone"
        case .toneLines: return "Line Tone"
        case .toneCross: return "Cross Tone"
        case .comicFlat: return "Comic Flat"
        case .comicShade: return "Comic Shade"
        case .stippleFine: return "Stipple Fine"
        case .stippleRough: return "Stipple Rough"
        case .stippleFill: return "Stipple Fill"
        case .pencil: return "Blyant"
        case .graphite: return "Grafitt"
        case .charcoal: return "Kull"
        case .conte: return "Conté"
        case .detail: return "Detalj"
        case .pen: return "Penn"
        case .ink: return "Tusj"
        case .brush: return "Pensel"
        case .marker: return "Marker"
        case .highlighter: return "Highlighter"
        case .hatch: return "Skraver"
        case .crosshatch: return "Kryss"
        case .shade: return "Skygge"
        case .graintex: return "Korn"
        case .eraser: return "Viskelær"
        case .kneaded: return "Knagummi"
        case .lightlift: return "Lysløft"
        case .smudge: return "Smudge"
        case .watercolor: return "Akvarell"
        case .wash: return "Vask"
        case .pastel: return "Pastell"
        case .airbrush: return "Luft"
        case .halftone: return "Raster"
        case .toneblock: return "Toneblokk"
        case .fill: return "Fyll"
        case .speedlines: return "Fartslinjer"
        case .stamp: return "Stempel"
        case .custom: return "Egen"
        case .forest: return "Skog"
        case .debris: return "Bunn"
        case .organictex: return "Bark"
        case .fur: return "Pels"
        case .wethair: return "Vått hår"
        case .spikes: return "Pigger"
        case .skintex: return "Hud"
        case .rocktex: return "Stein"
        case .softfocus: return "Myk fokus"
        case .gloss: return "Glans"
        default: return type.rawValue.capitalized
        }
    }
}

struct BrushPhysicsProfile: Sendable, Equatable {
    var tipModel: BrushTipModel
    var material: BrushMaterial
    var paper: PaperProfile
    var pigmentDepletion: Double
    var bleed: Double
    var bristleCount: Int
}

enum BrushPhysicsCatalog {
    static func profile(for type: BrushType) -> BrushPhysicsProfile {
        switch type {
        case .pencil, .layout, .bluepencil, .redpencil, .detail, .mechanical, .heavy,
             .sketchHB, .sketch6B, .colorHard, .colorSoft,
             .studio2H, .studioHB, .studio4B:
            return .init(tipModel: .stamp, material: .graphite, paper: .storyboard,
                         pigmentDepletion: 0.08, bleed: 0, bristleCount: 1)
        case .graphite, .shade, .sketchTilt, .colorShade:
            return .init(tipModel: .ribbon, material: .graphite, paper: .rough,
                         pigmentDepletion: 0.14, bleed: 0, bristleCount: 1)
        case .charcoal, .vineCharcoal, .blockCharcoal:
            return .init(tipModel: .particle, material: .charcoal, paper: .rough,
                         pigmentDepletion: 0.22, bleed: 0, bristleCount: 1)
        case .conte, .pastel, .softPastel:
            return .init(tipModel: .particle, material: .chalk, paper: .rough,
                         pigmentDepletion: 0.16, bleed: 0, bristleCount: 1)
        case .pen, .ink, .gloss:
            return .init(tipModel: .ribbon, material: .ink, paper: .smooth,
                         pigmentDepletion: 0.04, bleed: 0.03, bristleCount: 1)
        case .dryink, .nibRough:
            return .init(tipModel: .filament, material: .ink, paper: .rough,
                         pigmentDepletion: 0.36, bleed: 0, bristleCount: 5)
        case .nibFine:
            return .init(tipModel: .filament, material: .ink, paper: .rough,
                         pigmentDepletion: 0.18, bleed: 0, bristleCount: 1)
        case .nibBrush:
            return .init(tipModel: .filament, material: .ink, paper: .rough,
                         pigmentDepletion: 0.44, bleed: 0.02, bristleCount: 9)
        case .brush, .sumi:
            return .init(tipModel: .filament, material: .ink, paper: .absorbent,
                         pigmentDepletion: type == .sumi ? 0.32 : 0.18,
                         bleed: type == .sumi ? 0.25 : 0.12, bristleCount: 7)
        case .marker, .tonemarker, .highlighter, .comicFlat, .comicShade:
            return .init(tipModel: .ribbon, material: .marker, paper: .smooth,
                         pigmentDepletion: 0.05, bleed: 0.05, bristleCount: 1)
        case .watercolor, .wash:
            return .init(tipModel: .wet, material: .watercolor, paper: .absorbent,
                         pigmentDepletion: 0.08, bleed: 0.58, bristleCount: 9)
        case .gouache:
            return .init(tipModel: .wet, material: .gouache, paper: .storyboard,
                         pigmentDepletion: 0.18, bleed: 0.18, bristleCount: 9)
        case .oil:
            return .init(tipModel: .filament, material: .oil, paper: .rough,
                         pigmentDepletion: 0.24, bleed: 0.04, bristleCount: 11)
        case .eraser, .vinyl, .kneaded, .lightlift:
            return .init(tipModel: .region, material: .eraser, paper: .storyboard,
                         pigmentDepletion: 0, bleed: 0, bristleCount: 1)
        case .smudge, .tortillon, .softfocus:
            return .init(tipModel: .region, material: .blender, paper: .storyboard,
                         pigmentDepletion: 0, bleed: 0, bristleCount: 1)
        case .graintex, .stipple, .halftone, .debris, .organictex, .skintex, .rocktex,
             .toneDots, .toneLines, .toneCross,
             .stippleFine, .stippleRough, .stippleFill:
            return .init(tipModel: .particle, material: .utility, paper: .storyboard,
                         pigmentDepletion: 0.12, bleed: 0, bristleCount: 1)
        case .gestureBrush, .perspectiveBrush, .cameraBrush, .motionBrush,
             .emotionBrush, .eyeLineBrush, .continuityBrush, .storyBeatBrush,
             .faceDetail, .hairDetail, .clothingDetail, .handDetail, .natureDetail:
            return .init(tipModel: .stamp, material: .graphite, paper: .storyboard,
                         pigmentDepletion: 0.08, bleed: 0, bristleCount: 1)
        case .silhouetteBrush, .focusBrush, .depthBrush, .lightBrush,
             .negativeSpaceBrush, .stagingBrush:
            return .init(tipModel: .ribbon, material: .marker, paper: .smooth,
                         pigmentDepletion: 0.04, bleed: 0.02, bristleCount: 1)
        case .concreteTexture, .woodGrain, .fabricTexture, .brushedMetal,
             .glassReflection, .groundGravel, .skinOrganic, .filmGrain,
             .dustSmoke, .rainWetSurface, .foliageTexture, .crowdTexture,
             .architectureFill, .shadowTexture, .lightTexture,
             .surfaceDetail, .microShadow:
            return .init(tipModel: .particle, material: .utility, paper: .storyboard,
                         pigmentDepletion: 0.12, bleed: 0, bristleCount: 1)
        case .objectDetail, .architectureDetail, .vehicleDetail, .techDetail,
             .foodDetail, .edgeDetail:
            return .init(tipModel: .filament, material: .ink, paper: .storyboard,
                         pigmentDepletion: 0.08, bleed: 0.01, bristleCount: 1)
        case .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
             .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
             .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp:
            return .init(tipModel: .stamp, material: .utility, paper: .storyboard,
                         pigmentDepletion: 0, bleed: 0, bristleCount: 1)
        default:
            return .init(tipModel: .stamp, material: .utility, paper: .storyboard,
                         pigmentDepletion: 0.06, bleed: 0, bristleCount: 1)
        }
    }
}

// Spec-defaults per pensel (size px / opacity) — settes når penselen velges
// så hvert verktøy starter med riktig fysisk karakter (§8–§11, §34–§40, §67).
enum BrushDefaults {
    /// Farge-hint: pensler med en naturlig standardfarge (Glans = hvit).
    /// Én-linjes onboarding per pensel (vises i long-press-menyen).
    static func describe(_ type: BrushType) -> String {
        switch type {
        case .layout: return "Lys H/HB-konstruksjon — skisser først, tegn over etterpå."
        case .bluepencil: return "Blå layoutblyant — ikke-destruktiv konstruksjon og blocking."
        case .redpencil: return "Rød layoutblyant — revisjon, timing og korrigering."
        case .pencil: return "Standard blyant — allsidig linje med trykkrespons."
        case .mechanical: return "Mekanisk blyant — jevn, skarp detalj uten sidelegging."
        case .graphite: return "Bred grafitt — sidelagt blyant for raske flater."
        case .charcoal: return "Kull — grov tekstur, dype mørke."
        case .conte: return "Conté — tørr kritt-linje med tann."
        case .heavy: return "Tung mørk linje — silhuetter og tyngdepunkt."
        case .detail: return "Tynn detaljlinje — ansikter, hender, presisjon."
        case .pen: return "Penn — jevn tusjlinje med lett taper."
        case .ink: return "Tusj — dekkende svart med spiss taper."
        case .dryink: return "Tørr tusj — oppsplittede filamenter som følger papirstrukturen."
        case .marker: return "Marker — bred chisel-tupp, følger roll/tilt."
        case .tonemarker: return "Tonemarker — transparent, flat verdi for rask lyssetting."
        case .brush: return "Pensel — myk våt linje med trykk-svell."
        case .sumi: return "Sumi — absorberende blekk, tørr kant og pigmentuttømming."
        case .watercolor: return "Akvarell — transparent lag som bygger seg opp."
        case .highlighter: return "Highlighter — flat markering over tegningen."
        case .smudge: return "Smudge — drar og blander eksisterende toner."
        case .tortillon: return "Tortillon — kontrollert grafittblanding med smal spiss."
        case .eraser: return "Viskelær — piksel-visking; saksen sletter hele strøk."
        case .vinyl: return "Hard vinyl — presis, helt ren visking med skarp kant."
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
        case .stipple: return "Stipple — organisk punktering; trykk styrer tetthet og størrelse."
        case .pastel: return "Pastell — myke krittpartikler som bygger seg opp i papirtannen."
        case .gouache: return "Gouache — dekkende våtmaling med svak kantblødning."
        case .oil: return "Olje — synlige bustspor og tykk, langsom pigmentavsetning."
        case .stamp: return "Stamp — enkeltavtrykk fra eget PNG-bilde (figurer, kamera-symboler)."
        case .custom: return "Egen spiss — importert PNG som penselspiss med vanlig strøk."
        case .sketchHB: return "Sketch HB — løs, rask linje med synlig papirtann."
        case .sketch6B: return "Sketch 6B — mørk og myk skisseblyant for raske silhuetter."
        case .sketchTilt: return "Sketch Side — tilt legger grafitten bredt over papiret."
        case .colorHard: return "Color Hard — skarp fargeblyant for kontur og detaljer."
        case .colorSoft: return "Color Soft — mykere voksaktig farge som bygger lag."
        case .colorShade: return "Color Shade — bred, tiltstyrt fargelegging med papirgjennomslag."
        case .studio2H: return "Studio 2H — hard, lys konstruksjonsblyant."
        case .studioHB: return "Studio HB — balansert grafitt for ferdig tegning."
        case .studio4B: return "Studio 4B — mørk grafitt med rik trykkrespons."
        case .vineCharcoal: return "Vine Charcoal — luftig kull med sprø papirbrudd."
        case .blockCharcoal: return "Block Charcoal — bred kullblokk for tone og masse."
        case .softPastel: return "Soft Pastel — tørr, myk farge som fester seg i papirtannen."
        case .nibFine: return "Fine Nib — presis tørr penn med subtilt blekkbrudd."
        case .nibRough: return "Rough Nib — grov split-tupp med fem ujevne spor."
        case .nibBrush: return "Dry Brush — ni tørre bustspor for ekspressiv tusj."
        case .toneDots: return "Dot Tone — lerretslåst raster med trykkstyrte prikker."
        case .toneLines: return "Line Tone — parallelle trykklinjer for grafisk tone."
        case .toneCross: return "Cross Tone — to låste linjeraster for dypere verdi."
        case .comicFlat: return "Comic Flat — ren, jevn fargelegging som eget redigerbart strøk."
        case .comicShade: return "Comic Shade — farget rastertone for tegneserieskygger."
        case .stippleFine: return "Stipple Fine — små presise prikker for detaljer og kanter."
        case .stippleRough: return "Stipple Rough — organiske prikker med kontrollert variasjon."
        case .stippleFill: return "Stipple Fill — tett stipling for store gradienter og flater."
        case .gestureBrush, .silhouetteBrush, .focusBrush, .depthBrush,
             .perspectiveBrush, .cameraBrush, .motionBrush, .lightBrush,
             .emotionBrush, .negativeSpaceBrush, .eyeLineBrush, .stagingBrush,
             .continuityBrush, .storyBeatBrush,
             .concreteTexture, .woodGrain, .fabricTexture, .brushedMetal,
             .glassReflection, .groundGravel, .skinOrganic, .filmGrain,
             .dustSmoke, .rainWetSurface, .foliageTexture, .crowdTexture,
             .architectureFill, .shadowTexture, .lightTexture,
             .faceDetail, .hairDetail, .clothingDetail, .handDetail, .objectDetail,
             .architectureDetail, .vehicleDetail, .surfaceDetail, .techDetail,
             .foodDetail, .natureDetail, .microShadow, .edgeDetail,
             .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
             .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
             .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp:
            let help = ProductionMarkCatalog.profile(for: type)?.help ?? "Produksjonsmarkering."
            return "\(help) AI-meningen lagres med originalstrøket."
        }
    }

    static func colorHint(for type: BrushType) -> String? {
        switch type {
        case .gloss: return "#ffffff"
        case .bluepencil: return "#4f86c6"
        case .redpencil: return "#c95757"
        case .gestureBrush: return "#277da1"
        case .silhouetteBrush: return "#252936"
        case .focusBrush: return "#e08a16"
        case .depthBrush: return "#5b5fb5"
        case .perspectiveBrush: return "#2f80ed"
        case .cameraBrush: return "#20242d"
        case .motionBrush: return "#e05a3f"
        case .lightBrush: return "#d5a000"
        case .emotionBrush: return "#c2415d"
        case .negativeSpaceBrush: return "#4f9d96"
        case .eyeLineBrush: return "#7c3aed"
        case .stagingBrush: return "#3f7f5f"
        case .continuityBrush: return "#9856a8"
        case .storyBeatBrush: return "#e34a33"
        default: return nil
        }
    }

    static func sizeAndOpacity(for type: BrushType) -> (size: Double, opacity: Double)? {
        switch type {
        case .pencil: return (3.2, 0.48)       // Story Pencil
        case .layout: return (2.4, 0.28)
        case .bluepencil, .redpencil: return (2.4, 0.3)
        case .heavy: return (4.2, 0.62)
        case .detail: return (1.35, 0.78)
        case .mechanical: return (1.05, 0.82)
        case .ink: return (2.4, 0.94)          // Story Ink
        case .dryink: return (7.0, 0.72)
        case .tonemarker: return (28, 0.24)
        case .tortillon: return (22, 0.38)
        case .vinyl: return (18, 0.9)
        case .pastel: return (18, 0.42)
        case .stipple: return (32, 0.48)
        case .sumi: return (24, 0.72)
        case .gouache: return (34, 0.74)
        case .oil: return (30, 0.82)
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
        case .sketchHB: return (2.6, 0.42)
        case .sketch6B: return (4.8, 0.62)
        case .sketchTilt: return (34, 0.2)
        case .colorHard: return (2.0, 0.72)
        case .colorSoft: return (4.2, 0.52)
        case .colorShade: return (30, 0.24)
        case .studio2H: return (1.6, 0.34)
        case .studioHB: return (2.8, 0.5)
        case .studio4B: return (5.2, 0.68)
        case .vineCharcoal: return (12, 0.38)
        case .blockCharcoal: return (32, 0.56)
        case .softPastel: return (22, 0.44)
        case .nibFine: return (1.8, 0.88)
        case .nibRough: return (7.5, 0.76)
        case .nibBrush: return (18, 0.68)
        case .toneDots: return (34, 0.72)
        case .toneLines: return (40, 0.46)
        case .toneCross: return (40, 0.5)
        case .comicFlat: return (42, 0.72)
        case .comicShade: return (36, 0.68)
        case .stippleFine: return (20, 0.5)
        case .stippleRough: return (30, 0.48)
        case .stippleFill: return (54, 0.42)
        case .gestureBrush: return (5, 0.58)
        case .silhouetteBrush: return (44, 0.72)
        case .focusBrush: return (52, 0.26)
        case .depthBrush: return (64, 0.22)
        case .perspectiveBrush: return (2.2, 0.66)
        case .cameraBrush: return (3.4, 0.82)
        case .motionBrush: return (14, 0.52)
        case .lightBrush: return (70, 0.24)
        case .emotionBrush: return (4, 0.62)
        case .negativeSpaceBrush: return (62, 0.18)
        case .eyeLineBrush: return (3, 0.7)
        case .stagingBrush: return (50, 0.3)
        case .continuityBrush: return (7, 0.62)
        case .storyBeatBrush: return (11, 0.66)
        case .concreteTexture: return (48, 0.42)
        case .woodGrain: return (28, 0.4)
        case .fabricTexture: return (32, 0.34)
        case .brushedMetal: return (38, 0.3)
        case .glassReflection: return (18, 0.34)
        case .groundGravel: return (52, 0.44)
        case .skinOrganic: return (34, 0.3)
        case .filmGrain: return (72, 0.12)
        case .dustSmoke: return (90, 0.14)
        case .rainWetSurface: return (34, 0.42)
        case .foliageTexture: return (50, 0.48)
        case .crowdTexture: return (42, 0.46)
        case .architectureFill: return (38, 0.4)
        case .shadowTexture: return (58, 0.28)
        case .lightTexture: return (68, 0.2)
        case .faceDetail: return (1.3, 0.76)
        case .hairDetail: return (2.2, 0.66)
        case .clothingDetail: return (2.4, 0.68)
        case .handDetail: return (1.25, 0.78)
        case .objectDetail: return (1.6, 0.8)
        case .architectureDetail: return (1.8, 0.78)
        case .vehicleDetail: return (1.9, 0.8)
        case .surfaceDetail: return (5, 0.42)
        case .techDetail: return (1.45, 0.84)
        case .foodDetail: return (2.4, 0.68)
        case .natureDetail: return (2.8, 0.62)
        case .microShadow: return (7, 0.28)
        case .edgeDetail: return (1.2, 0.86)
        case .crowdStamp: return (210, 0.84)
        case .treeStamp: return (205, 0.82)
        case .windowStamp: return (170, 0.84)
        case .carStamp: return (235, 0.86)
        case .chairStamp: return (175, 0.84)
        case .faceExpressionStamp: return (160, 0.88)
        case .handPoseStamp: return (155, 0.86)
        case .cameraRigStamp: return (220, 0.88)
        case .characterPoseStamp: return (190, 0.86)
        case .doorStamp: return (190, 0.86)
        case .tableStamp: return (205, 0.84)
        case .sofaStamp: return (220, 0.84)
        case .buildingStamp: return (245, 0.84)
        case .streetLightStamp: return (205, 0.86)
        case .boomMicStamp: return (220, 0.88)
        case .filmLightStamp: return (210, 0.88)
        case .bedStamp: return (225, 0.84)
        case .staircaseStamp: return (235, 0.84)
        case .counterStamp: return (225, 0.84)
        case .workstationStamp: return (225, 0.86)
        case .communicationStamp: return (165, 0.88)
        case .luggageStamp: return (185, 0.86)
        case .publicTransportStamp: return (250, 0.84)
        case .animalStamp: return (205, 0.86)
        case .rockTerrainStamp: return (225, 0.82)
        case .waterStamp: return (235, 0.76)
        case .fireSmokeStamp: return (225, 0.72)
        case .weatherFXStamp: return (245, 0.62)
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
    // Snapshot av motor- og materialkontrakten. Optional holder eldre web/native
    // dokumenter gyldige; nye strøk fylles av preset()-kompilatoren.
    var engineVersion: Int?
    var tipModel: BrushTipModel?
    var material: BrushMaterial?
    var paperProfile: PaperProfile?
    var pigmentDepletion: Double?
    var bleed: Double?
    var bristleCount: Int?
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
    // Maskinlesbar produksjonsmening. Optional holder eldre/web-dokumenter
    // gyldige, mens nye Production Intelligence-strøk alltid får en verdi.
    var productionMark: ProductionMarkKind?

    static func preset(_ type: BrushType, size: Double, color: String, opacity: Double) -> BrushSpec {
        var spec = legacyPreset(type, size: size, color: color, opacity: opacity)
        let physics = BrushPhysicsCatalog.profile(for: type)
        spec.engineVersion = BrushEngineVersion.current
        spec.tipModel = physics.tipModel
        spec.material = physics.material
        spec.paperProfile = physics.paper
        spec.pigmentDepletion = physics.pigmentDepletion
        spec.bleed = physics.bleed
        spec.bristleCount = physics.bristleCount
        spec.productionMark = ProductionMarkCatalog.profile(for: type)?.kind
        return spec
    }

    private static func legacyPreset(_ type: BrushType, size: Double,
                                     color: String, opacity: Double) -> BrushSpec {
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
        case .brush:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.4, flow: 0.7, wetness: 0.18, grain: 0.4,
                             tiltSensitivity: 0.7, pressureSensitivity: 1)
        case .watercolor:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.1, flow: 0.5, wetness: 0.8, grain: 0.2,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.7)
        case .bluepencil, .redpencil:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.62, flow: 0.24, wetness: 0, grain: 0.3,
                             tiltSensitivity: 0.42, pressureSensitivity: 0.62)
        case .mechanical:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.9, flow: 0.68, wetness: 0, grain: 0.14,
                             tiltSensitivity: 0.08, pressureSensitivity: 0.72)
        case .dryink:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.74, flow: 0.54, wetness: 0.04, grain: 0.76,
                             tiltSensitivity: 0.52, pressureSensitivity: 0.86)
        case .tonemarker:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.55, flow: 0.34, wetness: 0, grain: 0.05,
                             tiltSensitivity: 0.92, pressureSensitivity: 0.3)
        case .tortillon:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.46, flow: 0.25, wetness: 0, grain: 0.2,
                             tiltSensitivity: 0.45, pressureSensitivity: 0.8)
        case .vinyl:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.96, flow: 1, wetness: 0, grain: 0,
                             tiltSensitivity: 0.12, pressureSensitivity: 0.82)
        case .pastel:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.22, flow: 0.3, wetness: 0, grain: 0.82,
                             tiltSensitivity: 0.7, pressureSensitivity: 0.88)
        case .stipple:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.84, flow: 0.42, wetness: 0, grain: 0.44,
                             tiltSensitivity: 0.1, pressureSensitivity: 0.7)
        case .sumi:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.38, flow: 0.48, wetness: 0.72, grain: 0.56,
                             tiltSensitivity: 0.8, pressureSensitivity: 0.95)
        case .gouache:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.5, flow: 0.72, wetness: 0.44, grain: 0.26,
                             tiltSensitivity: 0.62, pressureSensitivity: 0.78)
        case .oil:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.66, flow: 0.74, wetness: 0.22, grain: 0.34,
                             tiltSensitivity: 0.74, pressureSensitivity: 0.86)
        case .sketchHB:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.58, flow: 0.48, wetness: 0, grain: 0.58,
                             tiltSensitivity: 0.5, pressureSensitivity: 0.78)
        case .sketch6B:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.36, flow: 0.66, wetness: 0, grain: 0.72,
                             tiltSensitivity: 0.68, pressureSensitivity: 0.94)
        case .sketchTilt:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.24, flow: 0.24, wetness: 0, grain: 0.82,
                             tiltSensitivity: 0.96, pressureSensitivity: 0.72)
        case .colorHard:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.78, flow: 0.56, wetness: 0, grain: 0.48,
                             tiltSensitivity: 0.42, pressureSensitivity: 0.78)
        case .colorSoft:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.5, flow: 0.5, wetness: 0, grain: 0.62,
                             tiltSensitivity: 0.64, pressureSensitivity: 0.9)
        case .colorShade:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.28, flow: 0.28, wetness: 0, grain: 0.76,
                             tiltSensitivity: 0.94, pressureSensitivity: 0.78)
        case .studio2H:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.84, flow: 0.38, wetness: 0, grain: 0.42,
                             tiltSensitivity: 0.34, pressureSensitivity: 0.68)
        case .studioHB:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.62, flow: 0.56, wetness: 0, grain: 0.56,
                             tiltSensitivity: 0.56, pressureSensitivity: 0.82)
        case .studio4B:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.38, flow: 0.7, wetness: 0, grain: 0.7,
                             tiltSensitivity: 0.72, pressureSensitivity: 0.96)
        case .vineCharcoal:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.2, flow: 0.32, wetness: 0, grain: 0.92,
                             tiltSensitivity: 0.72, pressureSensitivity: 0.92)
        case .blockCharcoal:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.28, flow: 0.5, wetness: 0, grain: 0.88,
                             tiltSensitivity: 0.88, pressureSensitivity: 0.94)
        case .softPastel:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.18, flow: 0.34, wetness: 0, grain: 0.86,
                             tiltSensitivity: 0.74, pressureSensitivity: 0.9)
        case .nibFine:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.9, flow: 0.76, wetness: 0.02, grain: 0.42,
                             tiltSensitivity: 0.18, pressureSensitivity: 0.84)
        case .nibRough:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.7, flow: 0.54, wetness: 0.02, grain: 0.8,
                             tiltSensitivity: 0.56, pressureSensitivity: 0.9)
        case .nibBrush:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.48, flow: 0.48, wetness: 0.04, grain: 0.88,
                             tiltSensitivity: 0.78, pressureSensitivity: 0.96)
        case .toneDots:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.96, flow: 0.88, wetness: 0, grain: 0,
                             tiltSensitivity: 0, pressureSensitivity: 0.9)
        case .toneLines, .toneCross:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.9, flow: 0.64, wetness: 0, grain: 0.08,
                             tiltSensitivity: 0, pressureSensitivity: 0.72)
        case .comicFlat:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.68, flow: 0.9, wetness: 0, grain: 0.04,
                             tiltSensitivity: 0.82, pressureSensitivity: 0.28)
        case .comicShade:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.94, flow: 0.84, wetness: 0, grain: 0.04,
                             tiltSensitivity: 0, pressureSensitivity: 0.88)
        case .stippleFine:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.96, flow: 0.48, wetness: 0, grain: 0.24,
                             tiltSensitivity: 0.08, pressureSensitivity: 0.7)
        case .stippleRough:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.82, flow: 0.44, wetness: 0, grain: 0.58,
                             tiltSensitivity: 0.1, pressureSensitivity: 0.8)
        case .stippleFill:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.88, flow: 0.38, wetness: 0, grain: 0.46,
                             tiltSensitivity: 0.08, pressureSensitivity: 0.82)
        case .gestureBrush, .perspectiveBrush, .cameraBrush, .motionBrush,
             .emotionBrush, .eyeLineBrush, .continuityBrush, .storyBeatBrush,
             .faceDetail, .hairDetail, .clothingDetail, .handDetail,
             .objectDetail, .architectureDetail, .vehicleDetail, .techDetail,
             .foodDetail, .natureDetail, .edgeDetail:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.78, flow: 0.62, wetness: 0, grain: 0.34,
                             tiltSensitivity: 0.38, pressureSensitivity: 0.86)
        case .silhouetteBrush, .focusBrush, .depthBrush, .lightBrush,
             .negativeSpaceBrush, .stagingBrush, .glassReflection, .lightTexture:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.34, flow: 0.3, wetness: 0, grain: 0.16,
                             tiltSensitivity: 0.76, pressureSensitivity: 0.5)
        case .concreteTexture, .woodGrain, .fabricTexture, .brushedMetal,
             .groundGravel, .skinOrganic, .filmGrain, .dustSmoke,
             .rainWetSurface, .foliageTexture, .crowdTexture,
             .architectureFill, .shadowTexture, .surfaceDetail, .microShadow:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.48, flow: 0.36, wetness: 0, grain: 0.76,
                             tiltSensitivity: 0.58, pressureSensitivity: 0.76)
        case .crowdStamp, .treeStamp, .windowStamp, .carStamp, .chairStamp,
             .faceExpressionStamp, .handPoseStamp, .cameraRigStamp,
             .characterPoseStamp, .doorStamp, .tableStamp, .sofaStamp,
             .buildingStamp, .streetLightStamp, .boomMicStamp, .filmLightStamp,
             .bedStamp, .staircaseStamp, .counterStamp, .workstationStamp,
             .communicationStamp, .luggageStamp, .publicTransportStamp,
             .animalStamp, .rockTerrainStamp, .waterStamp, .fireSmokeStamp,
             .weatherFXStamp:
            return BrushSpec(type: type, size: size, color: color, opacity: opacity,
                             hardness: 0.86, flow: 0.94, wetness: 0, grain: 0.12,
                             tiltSensitivity: 0, pressureSensitivity: 0.34)
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
    var engineVersion: Int?
    // Board Pro-felter (web-paritet): lag-tag + tekst-annotasjon («PUSH IN»).
    // Optional → utelates i JSON når nil, og web-strøk med disse feltene
    // overlever native rundtur tapsfritt.
    var boardLayer: String?
    var textAnnotation: String?
    // Annotasjonsform (presentasjons-boards): nil = ren tekst,
    // "note" = post-it, "bubble" = snakkeboble. Optional → web-tolerant.
    var annotationStyle: String?
    // Stamp Engine 2.0. Optional holder alle eldre web/native-dokumenter
    // gyldige; nye production stamps lagrer deterministisk objektkontekst.
    var stampInstance: ProductionStampInstance?
    // Stamp Engine 3.0: frigjorte komponenter er ordinære strøk, men kan
    // spores tilbake til compound-objektet og beholde typed AI-kontekst.
    var stampGroupId: String?
    var stampComponentRole: ProductionStampPathRole?
    var releasedStampContext: ReleasedProductionStampContext?

    init(id: String, points: [StrokePoint], inputType: String, color: String,
         width: Double, opacity: Double, brush: BrushSpec? = nil,
         engineVersion: Int? = BrushEngineVersion.current,
         boardLayer: String? = nil, textAnnotation: String? = nil,
         annotationStyle: String? = nil,
         stampInstance: ProductionStampInstance? = nil,
         stampGroupId: String? = nil,
         stampComponentRole: ProductionStampPathRole? = nil,
         releasedStampContext: ReleasedProductionStampContext? = nil) {
        self.id = id
        self.points = points
        self.inputType = inputType
        self.color = color
        self.width = width
        self.opacity = opacity
        self.brush = brush
        self.engineVersion = engineVersion
        self.boardLayer = boardLayer
        self.textAnnotation = textAnnotation
        self.annotationStyle = annotationStyle
        self.stampInstance = stampInstance
        self.stampGroupId = stampGroupId
        self.stampComponentRole = stampComponentRole
        self.releasedStampContext = releasedStampContext
    }
}

struct ProductionMarkPoint: Codable, Sendable, Equatable {
    let x: Double
    let y: Double
}

struct ProductionMarkBounds: Codable, Sendable, Equatable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct ProductionMarkVector: Codable, Sendable, Equatable {
    let dx: Double
    let dy: Double
    let angleDegrees: Double
}

struct CompiledProductionMark: Codable, Sendable, Equatable {
    let strokeId: String
    let channel: ProductionMarkChannel
    let kind: ProductionMarkKind
    let interpretation: String
    let center: ProductionMarkPoint
    let bounds: ProductionMarkBounds
    let direction: ProductionMarkVector?
    let averagePressure: Double
    let pointCount: Int
    let stamp: CompiledProductionStamp?
}

struct CompiledProductionStamp: Codable, Sendable, Equatable {
    let variant: Int
    let variantName: String
    let seed: UInt32
    let scale: Double
    let rotationDegrees: Double
    let flipX: Bool
    let depth: ProductionStampDepth
    let styleProfileId: String
    let continuityId: String?
    let renderLayer: ProductionStampRenderLayer
    let parameters: [String: String]
    let perspectiveSkew: Double?
}

struct ProductionMarkPayload: Codable, Sendable, Equatable {
    let version: String
    let canvasWidth: Double
    let canvasHeight: Double
    let marks: [CompiledProductionMark]
}

/// Kompilerer redigerbare strøk til provider-uavhengig produksjonskontekst.
/// Koordinater normaliseres 0...1 slik at samme regi overlever annen oppløsning,
/// eksport og senere modellbytte.
enum ProductionMarkCompiler {
    static let version = "trr-production-marks-v3"

    static func compile(strokes: [PencilStroke], canvasWidth: Double,
                        canvasHeight: Double) -> ProductionMarkPayload {
        let safeWidth = max(1, canvasWidth)
        let safeHeight = max(1, canvasHeight)
        let marks = strokes.compactMap { stroke -> CompiledProductionMark? in
            guard let brush = stroke.brush, !stroke.points.isEmpty else { return nil }
            let released = stroke.releasedStampContext
            guard let kind = released?.kind
                    ?? brush.productionMark
                    ?? ProductionMarkCatalog.profile(for: brush.type)?.kind,
                  let profile = ProductionMarkCatalog.profile(for: kind),
                  !stroke.points.isEmpty else { return nil }

            let xs = stroke.points.map(\.x)
            let ys = stroke.points.map(\.y)
            let semanticStamp = released?.stamp ?? stroke.stampInstance
            let stampScale = semanticStamp.map {
                $0.scale * $0.depth.renderScale
            } ?? 1
            let radius = max(0.5,
                released.map { $0.baseSize * 0.5 }
                    ?? (stroke.width * stampScale * 0.5))
            let centerX = released?.centerX
                ?? (stroke.points.reduce(0) { $0 + $1.x }
                    / Double(stroke.points.count))
            let centerY = released?.centerY
                ?? (stroke.points.reduce(0) { $0 + $1.y }
                    / Double(stroke.points.count))
            let minX = released == nil ? (xs.min() ?? 0) - radius : centerX - radius
            let maxX = released == nil ? (xs.max() ?? 0) + radius : centerX + radius
            let minY = released == nil ? (ys.min() ?? 0) - radius : centerY - radius
            let maxY = released == nil ? (ys.max() ?? 0) + radius : centerY + radius
            let averagePressure = stroke.points.reduce(0) { $0 + $1.pressure }
                / Double(stroke.points.count)
            let direction: ProductionMarkVector? = {
                if let stamp = semanticStamp {
                    let radians = stamp.rotationDegrees * .pi / 180
                    return .init(dx: cos(radians), dy: sin(radians),
                                 angleDegrees: stamp.rotationDegrees)
                }
                guard let first = stroke.points.first,
                      let last = stroke.points.last else { return nil }
                let dx = (last.x - first.x) / safeWidth
                let dy = (last.y - first.y) / safeHeight
                guard hypot(dx, dy) > 0.000_1 else { return nil }
                return .init(dx: dx, dy: dy,
                             angleDegrees: atan2(dy, dx) * 180 / .pi)
            }()

            return .init(
                strokeId: released?.originalStrokeId ?? stroke.id,
                channel: profile.channel,
                kind: kind,
                interpretation: profile.aiInstruction,
                center: .init(x: normalized(centerX, extent: safeWidth),
                              y: normalized(centerY, extent: safeHeight)),
                bounds: .init(
                    x: normalized(minX, extent: safeWidth),
                    y: normalized(minY, extent: safeHeight),
                    width: normalized(maxX, extent: safeWidth)
                        - normalized(minX, extent: safeWidth),
                    height: normalized(maxY, extent: safeHeight)
                        - normalized(minY, extent: safeHeight)),
                direction: direction,
                averagePressure: min(1, max(0, averagePressure)),
                pointCount: stroke.points.count,
                stamp: semanticStamp.map {
                    .init(variant: $0.variant, variantName: $0.variantName,
                          seed: $0.seed, scale: $0.scale,
                          rotationDegrees: $0.rotationDegrees,
                          flipX: $0.flipX, depth: $0.depth,
                          styleProfileId: $0.styleProfileId,
                          continuityId: $0.continuityId,
                          renderLayer: $0.renderLayer,
                          parameters: $0.parameters,
                          perspectiveSkew: $0.perspectiveSkew)
                })
        }
        return .init(version: version, canvasWidth: safeWidth,
                     canvasHeight: safeHeight, marks: marks)
    }

    static func encodeJSON(strokes: [PencilStroke], canvasWidth: Double,
                           canvasHeight: Double) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let payload = compile(strokes: strokes, canvasWidth: canvasWidth,
                              canvasHeight: canvasHeight)
        let data = try encoder.encode(payload)
        guard let value = String(data: data, encoding: .utf8) else {
            throw CocoaError(.coderInvalidValue)
        }
        return value
    }

    private static func normalized(_ value: Double, extent: Double) -> Double {
        min(1, max(0, value / extent))
    }
}

/// Produksjonssteg som kan fryses til ett autoritativt startbilde før
/// bilde→video. Strokes forblir redigerbare; bare den valgte visningen
/// rasteriseres for leverandøren.
enum StoryboardAnimationSourceStage: String, CaseIterable, Identifiable, Sendable {
    case pencil
    case color
    case atmosphere

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pencil: return "Pencil"
        case .color: return "Pencil + Color"
        case .atmosphere: return "Pencil + Color + Atmosphere"
        }
    }

    var includedBoardLayers: Set<String> {
        switch self {
        case .pencil: return ["Drawing"]
        case .color: return ["Drawing", "Color"]
        case .atmosphere: return ["Drawing", "Color", "Atmosphere"]
        }
    }

    var styleProfileId: String {
        self == .pencil ? "story-pencil" : "story-pencil-color"
    }

    var creativeDirection: String {
        switch self {
        case .pencil:
            return "Hand-drawn monochrome production storyboard"
        case .color:
            return "Hand-colored graphite production storyboard; preserve the original line drawing"
        case .atmosphere:
            return "Hand-colored graphite production storyboard with controlled light, weather and atmospheric depth"
        }
    }
}

// Board-lag. Visningsrekkefølgen holder tegningen øverst i UI-et, mens
// render-rekkefølgen legger farge og atmosfære under grafittlinjene.
enum BoardLayers {
    static let defaultOrder = ["Drawing", "Color", "Atmosphere", "Camera / Arrows", "Dialog", "Notes"]
    // Compatibility for existing UI/tests. New document code should prefer
    // CanvasState.layerOrder because custom layers are first-class in v2.
    static let all = defaultOrder
    private static let renderOrder = [
        "Color", "Atmosphere", "Drawing", "Camera / Arrows", "Dialog", "Notes",
    ]
    static func index(of layer: String?) -> Int {
        renderOrder.firstIndex(of: layer ?? "Drawing") ?? renderOrder.count
    }

    static func index(of layer: String?, in order: [String]) -> Int {
        // UI order lists Drawing first, while production compositing keeps
        // Color/Atmosphere beneath graphite for the standard stack.
        let name = layer ?? "Drawing"
        if Set(order) == Set(defaultOrder), let standard = renderOrder.firstIndex(of: name) {
            return standard
        }
        return order.firstIndex(of: name) ?? order.count
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
        rollAngle = try container.decodeIfPresent(Double.self, forKey: .rollAngle)
        altitudeAngle = try container.decodeIfPresent(Double.self, forKey: .altitudeAngle)
        azimuthAngle = try container.decodeIfPresent(Double.self, forKey: .azimuthAngle)
        velocity = try container.decodeIfPresent(Double.self, forKey: .velocity)
        estimationUpdateIndex = try container.decodeIfPresent(Int.self, forKey: .estimationUpdateIndex)
        estimatedProperties = try container.decodeIfPresent(Int.self, forKey: .estimatedProperties)
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
        engineVersion = try container.decodeIfPresent(Int.self, forKey: .engineVersion)
        tipModel = try container.decodeIfPresent(BrushTipModel.self, forKey: .tipModel)
        material = try container.decodeIfPresent(BrushMaterial.self, forKey: .material)
        paperProfile = try container.decodeIfPresent(PaperProfile.self, forKey: .paperProfile)
        pigmentDepletion = try container.decodeIfPresent(Double.self, forKey: .pigmentDepletion)
        bleed = try container.decodeIfPresent(Double.self, forKey: .bleed)
        bristleCount = try container.decodeIfPresent(Int.self, forKey: .bristleCount)
        hatchAngleDeg = try container.decodeIfPresent(Double.self, forKey: .hatchAngleDeg)
        hatchDensity = try container.decodeIfPresent(Double.self, forKey: .hatchDensity)
        hatchLength = try container.decodeIfPresent(Double.self, forKey: .hatchLength)
        envDensity = try container.decodeIfPresent(Double.self, forKey: .envDensity)
        envScale = try container.decodeIfPresent(Double.self, forKey: .envScale)
        stampDataURL = try container.decodeIfPresent(String.self, forKey: .stampDataURL)
        hueJitter = try container.decodeIfPresent(Double.self, forKey: .hueJitter)
        if let rawMark = try container.decodeIfPresent(String.self, forKey: .productionMark) {
            productionMark = ProductionMarkKind(rawValue: rawMark)
        } else {
            // Backfill for tidlige native dokumenter der typen fantes før
            // semantikkfeltet ble skrevet inn i strøket.
            productionMark = ProductionMarkCatalog.profile(for: type)?.kind
        }
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
