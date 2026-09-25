// TourModeButton.swift
//
// «Start tur» / «Fortsett turen» (pakke 2, item 3): sekundærknapp på
// Utforsk-forsiden (hovedinngangen) og en liten variant i kartets header
// (MapOverlayControls-familien) for å plukke opp igjen en tur som allerede
// er i gang. Egen fil, brukt fra begge steder.

import SwiftUI

struct TourModeButton: View {
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        SecondaryButton(
            title: isActive ? "tour.resume" : "tour.start",
            systemImage: isActive ? "figure.walk.motion" : "figure.walk",
            isSelected: isActive,
            action: action
        )
        .accessibilityHint(Text(isActive ? "tour.resumeHint" : "tour.startHint"))
    }
}
