import SwiftUI

/// Brand-tokens fra brand-spec.md — OKLch konvertert til sRGB.
enum Theme {
    static let bg      = Color(red: 0.0530, green: 0.0482, blue: 0.0704) // oklch(0.16 0.012 295)
    static let surface = Color(red: 0.0863, green: 0.0818, blue: 0.1113) // oklch(0.20 0.015 292)
    static let raise   = Color(red: 0.1318, green: 0.1261, blue: 0.1636) // oklch(0.25 0.018 292)
    static let fg      = Color(red: 0.9339, green: 0.9325, blue: 0.9501) // oklch(0.95 0.006 290)
    static let muted   = Color(red: 0.5574, green: 0.5548, blue: 0.6081) // oklch(0.65 0.02 288)
    static let border  = Color.white.opacity(0.09)                       // oklch(1 0 0 / 0.09)
    static let accent  = Color(red: 0.5528, green: 0.3572, blue: 0.9307) // oklch(0.60 0.21 295)

    static let hairline: CGFloat = 1

    static func mono(_ size: CGFloat) -> Font { .system(size: size, design: .monospaced) }

    /// Accent som SIMD for rendereren (selection-tint).
    static let accentRGB = SIMD3<Float>(0.5528, 0.3572, 0.9307)
}
