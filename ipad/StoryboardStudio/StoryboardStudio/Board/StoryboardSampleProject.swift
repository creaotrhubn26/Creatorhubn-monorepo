import Foundation

/// Deterministic, private-data-free production used by simulator screenshots
/// and UI tests. It exercises the real board/document/render path without
/// requiring Role Room credentials or provider calls.
enum StoryboardSampleProject {
    static var isEnabled: Bool {
        ProcessInfo.processInfo.environment["SB_UI_TEST_SAMPLE_BOARD"] == "1"
    }

    static let manuscript = ManuscriptSummary(
        id: "sample-manuscript", title: "THE ROLE ROOM · 90 SEC")

    static let scenes: [SceneSummary] = [
        scene(
            id: "sample-scene-1", number: 1,
            heading: "INT. WRITER'S STUDIO — MORNING",
            location: "Writer's studio", timeOfDay: "Day",
            description: "En manusforfatter går fra idé til et faktisk produksjonsteam.",
            characters: ["Maya", "Jonas"],
            frames: [
                frame("1A", shot: "WS", lens: 24, movement: "Static",
                      beat: "ESTABLISHING", action: "Maya sitter alene med manuset.",
                      intensity: 0.2, variant: 0),
                frame("1B", shot: "CU", lens: 50, movement: "Push In",
                      beat: "TENSION", action: "Hun markerer den manglende rollen.",
                      intensity: 0.52, variant: 1),
                frame("1C", shot: "OTS", lens: 35, movement: "Pan",
                      beat: "BEAT", action: "The Role Room åpnes over manuset.",
                      intensity: 0.58, variant: 2),
            ]),
        scene(
            id: "sample-scene-2", number: 2,
            heading: "INT. PRODUCTION ROOM — DAY",
            location: "Production room", timeOfDay: "Day",
            description: "De rette menneskene samles rundt det samme produksjonsbildet.",
            characters: ["Maya", "Jonas", "Lea", "Omar"],
            frames: [
                frame("2A", shot: "MS", lens: 35, movement: "Tracking",
                      beat: "ACTION", action: "Regissør, DP og produsent kobles til prosjektet.",
                      intensity: 0.62, variant: 3),
                frame("2B", shot: "POV", lens: 28, movement: "Static",
                      beat: "DIALOGUE", action: "Det ekte board-grensesnittet blir arbeidsflaten.",
                      intensity: 0.7, variant: 4),
                frame("2C", shot: "CU", lens: 85, movement: "Handheld",
                      beat: "TENSION", action: "Continuity-avvik oppdages før opptak.",
                      intensity: 0.86, variant: 5, weather: "Rain"),
            ]),
        scene(
            id: "sample-scene-3", number: 3,
            heading: "EXT. SET — BLUE HOUR",
            location: "Film set", timeOfDay: "Dusk",
            description: "Planen går fra storyboard til opptak og godkjent sekvens.",
            characters: ["Crew"],
            frames: [
                frame("3A", shot: "EWS", lens: 18, movement: "Crane",
                      beat: "ACTION", action: "Hele teamet står klart på sett.",
                      intensity: 0.74, variant: 6, timeOfDay: "Dusk"),
                frame("3B", shot: "MCU", lens: 50, movement: "Push In",
                      beat: "RESOLUTION",
                      action: "Hver god fortelling starter med de rette menneskene i de rette rollene.",
                      intensity: 0.92, variant: 7, timeOfDay: "Dusk"),
            ]),
    ]

    private static func scene(
        id: String, number: Int, heading: String, location: String,
        timeOfDay: String, description: String, characters: [String],
        frames: [FrameSummary]
    ) -> SceneSummary {
        SceneSummary(
            id: id, heading: heading, frames: frames,
            presentationConcept: "Hver god fortelling starter med de rette menneskene i de rette rollene.",
            presentationFooter: nil, hubTasks: nil, hubNotes: nil, hubQuote: nil,
            hubMoodboard: nil, hubMapPositions: nil, hubMapNotes: nil,
            hubTeam: nil, hubInfo: nil, hubAssetFolders: nil, hubAssetColors: nil,
            sceneNumber: number, intExt: heading.hasPrefix("EXT") ? "EXT" : "INT",
            location: location, timeOfDay: timeOfDay,
            descriptionText: description, characters: characters,
            scenarioPackId: "film-production", scenarioPackVersion: "1",
            scenarioSubdomainId: "production-team", scenarioZoneId: location.lowercased(),
            scenarioRoleIds: characters, scenarioPropTypeIds: ["script", "camera"],
            scenarioActionIds: ["collaborate"], scenarioStateIds: ["planned"],
            scenarioContinuityLockIds: ["identity", "wardrobe", "location"])
    }

    private static func frame(
        _ shotNumber: String, shot: String, lens: Int, movement: String,
        beat: String, action: String, intensity: Double, variant: Int,
        timeOfDay: String = "Day", weather: String = "Clear"
    ) -> FrameSummary {
        let strokes = drawing(variant: variant, intensity: intensity)
        return FrameSummary(
            id: "sample-frame-\(shotNumber)", shotNumber: shotNumber,
            detail: "\(shot) · \(action)",
            strokesJSON: try? StrokeSerialization.encodeToWebJSON(strokes),
            description: action, notes: "Production demo · real Storyboard Room UI",
            shotType: shot, lensMm: lens, movement: movement,
            durationSec: variant == 7 ? 4 : 2.5,
            transition: variant == 7 ? "Fade" : "Cut", focusDepth: lens >= 50 ? "Shallow" : "Deep",
            timeOfDay: timeOfDay, weather: weather, beatTag: beat,
            tags: ["THE ROLE ROOM", variant < 3 ? "WRITER" : "TEAM"],
            thumbnailDataURL: nil, drawingWidth: 1920, drawingHeight: 1080,
            frameStatus: variant < 6 ? "in_review" : "planned", comments: [],
            updatedAt: "sample-v1", underlayDataURL: nil, underlayOpacity: nil,
            perspectiveMode: 2, vanishingPoints: [[0.16, 0.48], [0.84, 0.48]],
            voiceoverDataURL: nil, imageUrl: nil,
            reviewPriority: variant == 5 ? "high" : "normal", reviewDueAt: nil,
            reviewApprovedBy: nil, reviewApprovedAt: nil,
            reviewStarred: variant == 7, reviewAssignee: "Production team",
            reviewColorLabel: nil, reviewSnoozedUntil: nil,
            setLocation: variant < 3 ? "Writer's studio" : "Production room",
            stageUnit: "Main unit", reviewFollowers: ["Director", "DP"],
            scenarioPackId: "film-production", scenarioPackVersion: "1",
            scenarioSubdomainId: "production-team", scenarioZoneId: "working-space",
            scenarioRoleIds: ["director", "writer", "dp"],
            scenarioPropTypeIds: ["script", "camera"],
            scenarioActionIds: ["collaborate"], scenarioStateIds: ["planned"],
            scenarioContinuityLockIds: variant == 5 ? ["identity"]
                : ["identity", "wardrobe", "location"],
            layerState: BoardLayerState(
                opacity: ["Color": 0.72], blendModes: ["Color": .multiply]),
            angle: variant.isMultiple(of: 3) ? "Low" : "Eye level")
    }

    private static func drawing(variant: Int, intensity: Double) -> [PencilStroke] {
        let ink = "#2b2c31"
        let accent = variant.isMultiple(of: 2) ? "#6756a8" : "#8b6848"
        var result: [PencilStroke] = []
        func add(_ points: [(Double, Double)], width: Double = 7,
                 color: String = ink, layer: String = "Drawing") {
            let brush = BrushSpec.preset(.pencil, size: width, color: color, opacity: 0.9)
            result.append(PencilStroke(
                id: "sample-\(variant)-\(result.count)",
                points: points.enumerated().map { index, point in
                    StrokePoint(x: point.0, y: point.1,
                                pressure: 0.42 + 0.18 * sin(Double(index)),
                                tiltX: 24, tiltY: 12, timestamp: Double(index * 12))
                }, inputType: "pencil", color: color, width: width,
                opacity: 0.9, brush: brush, boardLayer: layer))
        }

        // Room perspective and production table.
        add([(120, 790), (960, 510), (1800, 790)], width: 5)
        add([(180, 820), (1740, 820)], width: 6)
        add([(520, 690), (1400, 690), (1510, 860), (420, 860), (520, 690)], width: 8)
        // Main character silhouette/gesture.
        let x = 620.0 + Double((variant % 3) * 230)
        add([(x, 300), (x - 45, 345), (x, 400), (x + 45, 345), (x, 300)], width: 12)
        add([(x, 400), (x, 610), (x - 90, 760)], width: 15)
        add([(x, 610), (x + 105, 760)], width: 15)
        add([(x, 455), (x - 150, 545)], width: 13)
        add([(x, 455), (x + 165, 520)], width: 13)
        // Screen/camera as the real interface focus.
        add([(1040, 260), (1560, 260), (1560, 610), (1040, 610), (1040, 260)], width: 9)
        for row in 0..<3 {
            add([(1090, 330 + Double(row * 82)), (1480, 330 + Double(row * 82))], width: 4)
        }
        add([(1120, 650), (1480, 650)], width: 24 * max(0.35, intensity),
            color: accent, layer: "Color")
        // Movement cue retained as production context, not final artwork.
        add([(260, 250), (420 + Double(variant * 24), 250),
             (385 + Double(variant * 24), 220), (420 + Double(variant * 24), 250),
             (385 + Double(variant * 24), 280)], width: 7,
            color: "#7c3aed", layer: "Camera / Arrows")
        return result
    }
}
