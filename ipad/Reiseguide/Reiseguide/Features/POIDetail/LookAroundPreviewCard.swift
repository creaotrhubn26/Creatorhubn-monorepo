// LookAroundPreviewCard.swift
//
// Look Around-forhåndsvisning på detaljsiden (pakke 2, item 7, Daniel-
// godkjent): vises kun når Apple faktisk har en scene for stedet (mange
// severdigheter utenfor storbyer har ingen) — ingen plassholder mens den
// sjekkes, så innholdet under ikke hopper når scenen viser seg å mangle.
// Trykk på selve forhåndsvisningen åpner MapKits egen fullskjerms
// Look Around-opplevelse — fortsatt inne i appen, aldri en annen app
// (Daniel: «alt skal skje i samme app»).
//
// Tilgjengelighet: en levende 360°-visning kan ikke meningsfullt beskrives
// for VoiceOver, så selve forhåndsvisningen er `accessibilityHidden`. I
// stedet får VoiceOver-brukere en egen, fokuserbar knapp som sier ærlig at
// dette er en visuell forhåndsvisning (i stedet for enten å late som den er
// tilgjengelig, eller la den forsvinne helt).

import MapKit
import SwiftUI

struct LookAroundPreviewCard: View {
    let poi: GuidePOI

    @State private var scene: MKLookAroundScene?

    var body: some View {
        Group {
            if let scene {
                VStack(alignment: .leading, spacing: AppSpacing.s) {
                    Text("detail.lookAround.title")
                        .font(AppFont.cardTitle)
                        .foregroundStyle(AppColor.textPrimary)
                        .accessibilityHidden(true)
                    LookAroundPreview(initialScene: scene)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
                        .accessibilityHidden(true)
                    accessibleAlternative
                }
            }
        }
        .task(id: poi.id) {
            await loadScene()
        }
    }

    /// Fokuserbar for VoiceOver i stedet for den skjulte 3D-visningen:
    /// forklarer hva den er, later ikke som om den kan brukes uten syn.
    private var accessibleAlternative: some View {
        Label("detail.lookAround.accessibleLabel", systemImage: "binoculars")
            .font(AppFont.chip)
            .foregroundStyle(AppColor.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: AppSpacing.minTapTarget)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("detail.lookAround.accessibleLabel"))
            .accessibilityHint(Text("detail.lookAround.accessibleHint"))
    }

    private func loadScene() async {
        scene = nil
        let request = MKLookAroundSceneRequest(coordinate: poi.coordinate.clCoordinate)
        scene = try? await request.scene
    }
}
