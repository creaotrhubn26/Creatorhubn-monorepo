// LeadgridDiscoveryTheme.swift

import SwiftUI

enum LeadgridDiscoveryTheme {
    static let background = Color(red: 0.045, green: 0.035, blue: 0.085)
    static let surface = Color(red: 0.095, green: 0.075, blue: 0.145)
    static let surfaceRaised = Color(red: 0.135, green: 0.105, blue: 0.205)
    static let accent = Color(red: 0.67, green: 0.34, blue: 0.99)
    static let accentSoft = Color(red: 0.77, green: 0.55, blue: 1.0)
    static let success = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let warning = Color(red: 0.98, green: 0.67, blue: 0.18)
    static let danger = Color(red: 0.96, green: 0.32, blue: 0.35)
    static let secondaryText = Color.white.opacity(0.68)
    static let stroke = Color.white.opacity(0.10)
    static let cornerRadius: CGFloat = 16
}

struct DiscoverySurfaceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(LeadgridDiscoveryTheme.surface, in: RoundedRectangle(cornerRadius: LeadgridDiscoveryTheme.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: LeadgridDiscoveryTheme.cornerRadius)
                .stroke(LeadgridDiscoveryTheme.stroke, lineWidth: 1))
    }
}

extension View {
    func discoverySurface() -> some View { modifier(DiscoverySurfaceModifier()) }
}
