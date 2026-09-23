// Haptics.swift
//
// Liten samlepunkt-hjelper for haptisk tilbakemelding. Ingen «Vibrasjon»-
// innstilling finnes i AppSettings ennå (et parallelt spor legger den til i
// pakke 2); når den kommer, gates alt her ETT sted, f.eks.
// `guard settings.hapticsEnabled else { return }` i toppen av hver
// funksjon, i stedet for på hvert kallsted i appen.

import UIKit

enum Haptics {
    @MainActor private static let lightImpact = UIImpactFeedbackGenerator(style: .light)
    @MainActor private static let notification = UINotificationFeedbackGenerator()

    /// Lett dult, f.eks. når veiviseren peker mot målet.
    @MainActor static func lightTick() {
        lightImpact.prepare()
        lightImpact.impactOccurred()
    }

    /// Suksess, f.eks. ankomst til et sted.
    @MainActor static func success() {
        notification.prepare()
        notification.notificationOccurred(.success)
    }
}
