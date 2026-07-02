// PondusCoachSpace.swift
//
// ImmersiveSpace-innhold for Vision Pro. Floating score-ring i midten,
// steg-kort som svevende paneler rundt brukeren.
//
// Vi bruker `Model3D`/`Sphere()`-approksimasjon for enkelhet — hele
// oppsettet er render-lett så det ikke krasjer på Vision-sim med
// begrenset GPU. RealityKit `Entity`-tre kan legges til senere når
// vi vil ha per-akse-gradient-teksturer.

import SwiftUI
import RealityKit

struct PondusCoachSpace: View {
    @Environment(VisionPondusStore.self) private var store

    var body: some View {
        RealityView { content in
            // Rot-entitet — vi legger til én score-ring pluss ett tekst-panel
            // for hvert steg.
            let root = Entity()
            content.add(root)

            if let template = store.activeTemplate {
                // Score-ring (torus-approksimasjon m/ MeshResource.generateSphere).
                // Full torus krever RealityKit-mesh-descriptor som er tyngre;
                // sphere-shell er nok for konseptet.
                let scoreOrb = makeScoreOrb(score: template.score)
                scoreOrb.position = [0, 1.4, -1.5]
                root.addChild(scoreOrb)

                // Steg-kort — rund plassering rundt score-ringen.
                let steps = template.orderedSteps.prefix(6)
                let radius: Float = 1.2
                let stepCount = steps.count
                for (i, step) in steps.enumerated() {
                    let angle = Float(i) / Float(max(1, stepCount)) * 2 * .pi
                    let x = radius * cos(angle)
                    let z = -radius * sin(angle) - 1.5
                    let card = makeStepCard(title: step.title)
                    card.position = [x, 1.4, z]
                    // Roter kortet mot brukeren (approks).
                    card.orientation = simd_quatf(angle: angle, axis: [0, 1, 0])
                    root.addChild(card)
                }
            }
        }
    }

    // MARK: - Entity-fabrikker

    /// Score-orb — en sfære fylt med score-farge. Enkelt konsept-bygg;
    /// erstattes senere av gradient-torus når vi legger til per-akse-viz.
    private func makeScoreOrb(score: Int) -> Entity {
        let orb = ModelEntity(
            mesh: .generateSphere(radius: 0.18),
            materials: [SimpleMaterial(
                color: uiColorForScore(score),
                roughness: 0.3,
                isMetallic: true
            )]
        )
        return orb
    }

    /// Steg-kort — flat plate m/ steg-tittel. Vi bruker MeshResource.generatePlane
    /// + tekst-tekstur (senere) — for nå bare tint-plate for å konseptualisere
    /// posisjonering.
    private func makeStepCard(title: String) -> Entity {
        let plane = ModelEntity(
            mesh: .generatePlane(width: 0.35, height: 0.20, cornerRadius: 0.02),
            materials: [SimpleMaterial(
                color: UIColor(white: 0.95, alpha: 0.85),
                roughness: 0.7,
                isMetallic: false
            )]
        )
        plane.name = "step:\(title)"
        return plane
    }

    private func uiColorForScore(_ s: Int) -> UIColor {
        if s >= 85 { return UIColor.systemGreen }
        if s >= 70 { return UIColor.systemOrange }
        return UIColor.systemYellow
    }
}
