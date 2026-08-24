// Theme.swift — AeroSpot design tokens. Ingen hardkodede farger i views.

import SwiftUI

enum Theme {
    static let background = Color(hex: 0x050B14)
    static let surface = Color(hex: 0x0B1522)
    static let surfaceElevated = Color(hex: 0x111E2D)
    static let primary = Color(hex: 0x268CFF)
    static let primaryBright = Color(hex: 0x4DA3FF)
    static let textPrimary = Color(hex: 0xF6F8FB)
    static let textSecondary = Color(hex: 0x91A0B4)
    static let textTertiary = Color(hex: 0x5C6B80)
    static let success = Color(hex: 0x42D392)
    static let warning = Color(hex: 0xFFB84D)
    static let danger = Color(hex: 0xFF5A67)
    static let gold = Color(hex: 0xF5C518)

    static let radiusSm: CGFloat = 8
    static let radiusMd: CGFloat = 12
    static let radiusLg: CGFloat = 16

    static let spacingXS: CGFloat = 4
    static let spacingSM: CGFloat = 8
    static let spacingMD: CGFloat = 12
    static let spacingLG: CGFloat = 16
    static let spacingXL: CGFloat = 24
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Standard card-bakgrunn
struct CardBackground: ViewModifier {
    var elevated = false
    func body(content: Content) -> some View {
        content
            .padding(Theme.spacingLG)
            .background(elevated ? Theme.surfaceElevated : Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLg)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
    }
}

extension View {
    func card(elevated: Bool = false) -> some View {
        modifier(CardBackground(elevated: elevated))
    }
}
