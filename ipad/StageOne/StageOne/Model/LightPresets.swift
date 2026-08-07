import Foundation

/// Lys-presets fra prototypen (`virtual-studio-lights.html`): setter intensitet
/// (+ ev. temperatur) på key/fill/back-light i ÉN mutasjon.
struct LightPreset: Identifiable, Sendable {
    var id: String
    var name: String
    var summary: String
    var key: (intensity: Double, tempK: Double?)
    var fill: (intensity: Double, tempK: Double?)
    var back: (intensity: Double, tempK: Double?)
}

enum LightPresets {
    static let all: [LightPreset] = [
        LightPreset(id: "interview", name: "Interview 3-Point", summary: "85 · 45 · 60",
                    key: (85, 5600), fill: (45, 6200), back: (60, nil)),
        LightPreset(id: "moody", name: "Moody Single Key", summary: "70 · 10 · 20",
                    key: (70, 3400), fill: (10, 6500), back: (20, nil)),
        LightPreset(id: "broadcast", name: "Broadcast Flat", summary: "90 · 80 · 70",
                    key: (90, 6300), fill: (80, 6300), back: (70, nil)),
        LightPreset(id: "golden", name: "Golden Hour", summary: "65 · 30 · 40",
                    key: (65, 3200), fill: (30, 3600), back: (40, nil)),
    ]

    @MainActor
    static func apply(_ preset: LightPreset, to document: SceneDocument) {
        let targets: [(String, (intensity: Double, tempK: Double?))] = [
            ("key-light", preset.key), ("fill-light", preset.fill), ("back-light", preset.back),
        ]
        document.mutate { scene in
            for (id, values) in targets {
                guard let i = scene.nodes.firstIndex(where: { $0.id == id }),
                      case .light(var p) = scene.nodes[i].params else { continue }
                p.intensity = values.intensity
                if let temp = values.tempK { p.temperatureK = temp }
                scene.nodes[i].params = .light(p)
            }
        }
    }
}
