// LeadgridVisionApp.swift
//
// visionOS entry-point. «Pondus overalt» trinn 4 (2026-07-01).
//
// 2 scener:
//   • WindowGroup "main" — 2D-vindu med template-picker og score-oversikt.
//   • ImmersiveSpace "PondusCoach" — spatial 3D-visning med score-ring
//     som floating hologram + steg-kort svevende rundt brukeren.
//
// Brukeren kan enten fungere i «panel-modus» (2D-vindu) eller starte
// ImmersiveSpace fra en knapp for full spatial coaching.
//
// visionOS-target har egen kopi av Pondus-modell-strukturer (siden
// target ikke deler kompileringsenhet med iPad). Backend + auth deles
// via nettverkskall — vi vil vil senere hooke inn samme APIClient via
// et delt Sources-fragment; for nå bruker vi seed-data slik at bygget
// er grønt uten backend-avhengighet.

import SwiftUI

@main
struct LeadgridVisionApp: App {
    @State private var pondusStore = VisionPondusStore.shared

    var body: some Scene {
        // Hovedvindu: 2D-panel med template-picker.
        WindowGroup(id: "leadgrid-main") {
            PondusVisionWindow()
                .environment(pondusStore)
        }
        .windowStyle(.plain)

        // ImmersiveSpace: spatial pondus-coach med floating score-ring.
        ImmersiveSpace(id: "PondusCoach") {
            PondusCoachSpace()
                .environment(pondusStore)
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
    }
}
