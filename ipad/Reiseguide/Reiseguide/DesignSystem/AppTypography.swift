// AppTypography.swift
//
// Typografiroller fra UI-spesifikasjon del 3. Alt er Dynamic Type-stiler;
// ingen faste punktstørrelser. Tall som endrer seg bruker monospacedDigit.

import SwiftUI

enum AppFont {
    static let heroTitle: Font = .largeTitle.bold()
    static let screenTitle: Font = .title.bold()
    static let playerTitle: Font = .title2.weight(.semibold)
    static let cardTitle: Font = .headline
    static let button: Font = .headline
    static let body: Font = .body
    static let subtitle: Font = .subheadline
    static let chip: Font = .subheadline.weight(.medium)
    static let meta: Font = .footnote.monospacedDigit()
    static let iconLabel: Font = .caption.weight(.medium)
}

extension View {
    /// Overskrifter som VoiceOver skal kunne hoppe mellom.
    func asHeader() -> some View {
        accessibilityAddTraits(.isHeader)
    }
}
