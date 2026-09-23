// Haptics.swift
//
// Imperativ haptikk for kode utenfor SwiftUI-visninger (veiviseren). Visninger
// bruker `.sensoryFeedback` via AppHaptics. Begge følger «Vibrasjon»
// (`AppSettings.hapticsEnabled`) gjennom `enabled`-parameteren.

import UIKit

enum Haptics {
    @MainActor private static let lightImpact = UIImpactFeedbackGenerator(style: .light)

    /// Lett dult, f.eks. når veiviseren peker mot målet.
    @MainActor static func lightTick(enabled: Bool) {
        guard enabled else { return }
        lightImpact.prepare()
        lightImpact.impactOccurred()
    }
}
