// SalesHierarchyBackdropModifier.swift
//
// Fase 29: ViewModifier for salgshierarki-views (teamleder, salgskonsulent,
// promotør, research). Hver rolle får sin egen visuelle identitet slik at
// brukeren ser «min rolle, mitt univers» på et blunk.

import SwiftUI

/// Tematisk gruppering av salgshierarki-views → riktig backdrop.
enum SalesHierarchyTheme {
    case teamLeader      // Backdrop19 — teamleder ser team-leaderboard + delegere
    case salesRep        // Backdrop20 — salgskonsulent i felt m/ lead-detalj + besøk
    case promotor        // Backdrop21 — promotør gjør første kontakt + mark-seen
    case research        // Backdrop22 — Claude-AI-research per lead

    var backdrop: LeadgridBackdrop {
        switch self {
        case .teamLeader: return .backdrop19
        case .salesRep: return .backdrop20
        case .promotor: return .backdrop21
        case .research: return .backdrop22
        }
    }
}

struct SalesHierarchyBackdropModifier: ViewModifier {
    let theme: SalesHierarchyTheme

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
    /// Apply a thematic Sales Hierarchy backdrop. Brukes på teamleder-/
    /// salgskonsulent-/promotør-/research-views.
    func salesHierarchyBackdrop(_ theme: SalesHierarchyTheme) -> some View {
        modifier(SalesHierarchyBackdropModifier(theme: theme))
    }
}
