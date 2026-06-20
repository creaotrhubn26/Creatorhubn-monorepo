// MarketingDirectorBackdropModifier.swift
//
// Fase 28: ViewModifier for å applikere riktig backdrop på markedssjef-
// (Leadgrid CRM) sub-views. Tema-mappet basert på hva flaten gjør, så
// markedssjefen får visuell hjelp til å forstå "hvor er jeg" på et blunk.

import SwiftUI

/// Tematisk gruppering av markedssjef-views → riktig backdrop.
enum MarketingDirectorTheme {
    case crmHome        // Backdrop9  — CRM-hjem (Hub-toppen, lead-portefølje)
    case wonLost        // Backdrop10 — KPI/vinn-tap-dashboard, status-flow
    case customerJourney // Backdrop11 — lead → kunde-reise, communication-touchpoints
    case reports        // Backdrop12 — schedulerte rapporter, CSV-export
    case notifications  // Backdrop18 — varsler-stream, channel-onboarding

    var backdrop: LeadgridBackdrop {
        switch self {
        case .crmHome: return .backdrop9
        case .wonLost: return .backdrop10
        case .customerJourney: return .backdrop11
        case .reports: return .backdrop12
        case .notifications: return .backdrop18
        }
    }
}

struct MarketingDirectorBackdropModifier: ViewModifier {
    let theme: MarketingDirectorTheme

    func body(content: Content) -> some View {
        content
            .background(
                BrandedHeroBackground(theme.backdrop, darkenFrom: 0.55, darkenTo: 0.95)
                    .ignoresSafeArea()
            )
            .scrollContentBackground(.hidden)
    }
}

extension View {
    /// Apply a thematic Marketing Director (markedssjef-Leadgrid) backdrop.
    /// Gir markedssjefen visuell forståelse av "hvor er jeg" i CRM-en.
    func marketingDirectorBackdrop(_ theme: MarketingDirectorTheme) -> some View {
        modifier(MarketingDirectorBackdropModifier(theme: theme))
    }
}
