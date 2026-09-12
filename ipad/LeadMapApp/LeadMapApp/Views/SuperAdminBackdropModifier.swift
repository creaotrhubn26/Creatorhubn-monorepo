// SuperAdminBackdropModifier.swift
//
// Fase 27: ViewModifier for å applikere riktig backdrop på super-admin-sub-views.
// Tema-mappet basert på hvilken seksjon view-en hører til.

import SwiftUI

/// Tematisk gruppering av SuperAdmin-views → riktig backdrop.
enum SuperAdminTheme {
    case command       // Backdrop13 — hub-toppen (default)
    case b2bFunnel     // Backdrop14 — markedssjef-leads/funnel/CS/cockpit
    case marketing     // Backdrop15 — PR/journalister/webinars/LinkedIn/newsletter
    case adTech        // Backdrop16 — Ads-configs/approvals
    case platform      // Backdrop17 — platform-status/integrations/API/observability/B2/migrations

    var backdrop: LeadgridBackdrop {
        switch self {
        case .command: return .backdrop13
        case .b2bFunnel: return .backdrop14
        case .marketing: return .backdrop15
        case .adTech: return .backdrop16
        case .platform: return .backdrop17
        }
    }
}

struct SuperAdminBackdropModifier: ViewModifier {
    let theme: SuperAdminTheme

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
    /// Apply a thematic super-admin backdrop. Brukes i alle SuperAdmin-sub-views
    /// for å gi visuell konsistens og bedre forståelse av hva flaten gjør.
    func superAdminBackdrop(_ theme: SuperAdminTheme) -> some View {
        modifier(SuperAdminBackdropModifier(theme: theme))
    }
}
