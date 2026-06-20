import SwiftUI

/// CreatorHub dark brand palette for the native iPad surfaces — the single
/// source of truth so Galleri/Admin/Tilbud/Pris/Meldinger all read as one
/// branded product, not default iOS chrome. Mirrors the web brand
/// (`creatorHubTheme.ts` primary #FF6B35) in its dark/"cinematic"
/// expression: warm near-black backdrops, cream text, amber accent.
enum CHTheme {
    // Accent — CreatorHub amber/orange (matches web primary.main).
    static let accent = Color(hex: 0xFF6B35)
    static let accentSoft = Color(hex: 0xFF8F5C)
    static let accentDark = Color(hex: 0xE85A24)

    // Backdrops — warm neutral black (no blue undertone).
    static let bg = Color(hex: 0x0B0B0C)
    static let bgDeep = Color(hex: 0x070707)

    // Surfaces (cards, rows, sheets).
    static let surface = Color(hex: 0x141416)
    static let surfaceElevated = Color(hex: 0x1B1B1F)

    // Hairlines.
    static let border = Color.white.opacity(0.08)
    static let borderStrong = Color.white.opacity(0.14)

    // Text — warm off-white / cream.
    static let textPrimary = Color(hex: 0xF5F2EA)
    static let textSecondary = Color.white.opacity(0.68)
    static let textMuted = Color.white.opacity(0.42)

    // Muted status colors (never neon).
    static let success = Color(hex: 0x10B981)
    static let danger = Color(hex: 0xE0606A)
    static let warning = Color(hex: 0xE0A955)
    static let info = Color(hex: 0x6366F1)
}

extension Color {
    /// 0xRRGGBB literal → Color (sRGB).
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

extension View {
    /// Brand the whole subtree: amber tint + forced dark scheme so the
    /// CreatorHub One shell reads consistently regardless of device
    /// appearance.
    func chBranded() -> some View {
        self.tint(CHTheme.accent).preferredColorScheme(.dark)
    }

    /// Warm CreatorHub backdrop behind a screen's content.
    func chScreenBackground() -> some View {
        self.background(CHTheme.bg.ignoresSafeArea())
    }
}
