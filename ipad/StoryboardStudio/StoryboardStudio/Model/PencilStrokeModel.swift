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
