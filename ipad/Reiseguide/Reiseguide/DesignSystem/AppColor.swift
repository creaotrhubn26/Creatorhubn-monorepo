// AppColor.swift
//
// Fargetokens fra UI-spesifikasjon Konsept 2 «Dark Mode / Premium» (del 2).
// Verdiene ligger i Assets.xcassets som Color Sets med samme navn; her får de
// semantiske navn og «Øk kontrast»-varianter (del 8.6).

import SwiftUI

enum AppColor {
    static let bgBase = Color("bgBase")
    static let bgSurface = Color("bgSurface")
    static let bgElevated = Color("bgElevated")
    static let bgOverlay = Color("bgOverlay")
    static let border = Color("border")
    static let borderStrong = Color("borderStrong")
    static let accent = Color("accent")
    static let accentMuted = Color("accentMuted")
    static let onAccent = Color("onAccent")
    static let rating = Color("rating")
    static let textPrimary = Color("textPrimary")
    static let textSecondary = Color("textSecondary")
    static let textTertiary = Color("textTertiary")
    static let textPlaceholder = Color("textPlaceholder")
    static let error = Color("error")

    /// Scrim-tak: bakgrunnen bak tekst på foto skal aldri være lysere enn dette.
    static let scrimFloor = Color(red: 0x1E / 255, green: 0x26 / 255, blue: 0x32 / 255)
}

/// «Øk kontrast»: border → borderStrong, textSecondary → textPrimary,
/// textTertiary → textSecondary (UI-spesifikasjon 8.6).
struct ContrastAwareColors {
    let increased: Bool

    var border: Color { increased ? AppColor.borderStrong : AppColor.border }
    var textSecondary: Color { increased ? AppColor.textPrimary : AppColor.textSecondary }
    var textTertiary: Color { increased ? AppColor.textSecondary : AppColor.textTertiary }
}

extension EnvironmentValues {
    var contrastColors: ContrastAwareColors {
        ContrastAwareColors(increased: colorSchemeContrast == .increased)
    }
}
