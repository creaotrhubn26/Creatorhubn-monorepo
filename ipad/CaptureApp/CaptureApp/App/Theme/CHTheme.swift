import SwiftUI

/// CreatorHub dark brand palette for the native iPad surfaces — the single
/// source of truth so Galleri/Admin/Tilbud/Pris/Meldinger all read as one
/// branded product, not default iOS chrome. These values mirror the canonical
/// `WorkspaceShell.tsx` / `workspaceTheme.ts` fallbacks on web.
enum CHTheme {
    // Accent — CreatorHub orange.
    static let accent = Color(hex: 0xFF8C00)
    static let accentSoft = Color(hex: 0xFF8C00)
    static let accentDark = Color(hex: 0xE67E00)
    static let accentFill = accent.opacity(0.14)
    static let accentBorder = accent.opacity(0.42)
    static let accentContrast = Color(hex: 0x150D05)

    // Backdrops — the same deep navy family as WorkspaceShell.
    static let bg = Color(hex: 0x0A0F1A)
    static let bgDeep = Color(hex: 0x0B1120)

    // Surfaces (cards, rows, sheets).
    static let surface = Color(hex: 0x0F1729).opacity(0.72)
    static let surfaceSolid = Color(hex: 0x0F1729)
    static let surfaceElevated = Color(hex: 0x111C30)
    static let input = Color.white.opacity(0.04)

    // Hairlines.
    static let border = Color.white.opacity(0.12)
    static let borderSoft = Color.white.opacity(0.07)
    static let borderStrong = Color.white.opacity(0.18)

    // Text.
    static let textPrimary = Color.white.opacity(0.95)
    static let textSecondary = Color.white.opacity(0.62)
    static let textMuted = Color.white.opacity(0.40)

    // WorkspaceShell status colors.
    static let success = Color(hex: 0x34D399)
    static let danger = Color(hex: 0xF87171)
    static let warning = Color(hex: 0xFBBF24)
    static let info = Color(hex: 0x60A5FA)
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
    /// Brand the whole subtree: orange tint + forced dark scheme so the
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
