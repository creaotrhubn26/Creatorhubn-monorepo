// BrandedHeroBackground.swift
//
// Gjenbrukbar hero-bakgrunn som applyerer en backdrop (Backdrop1..17)
// med gradient-overlay slik at innhold over den er lesbart.
//
// Bruk:
//   var body: some View {
//       ScrollView { ... }
//           .background(BrandedHeroBackground(.backdrop1).ignoresSafeArea())
//   }
//
// Designvalg:
//   - Top 30% av skjermen viser backdrop'en sterkt (lett gradient over)
//   - Resten gradient-overgår til solid mørk lilla #0b0518 (matcher
//     landing-siden + warm-dark-tema)
//   - Backdrop-bilde i .scaledToFill() med top-anchored — pin-konstellasjoner
//     beholder sitt visuelle tyngdepunkt øverst
//   - .preferredColorScheme(.dark) sikrer at content-tekst er hvit

import SwiftUI

enum LeadgridBackdrop: String, CaseIterable {
    case backdrop1 = "Backdrop1"   // Kart-pin-konstellasjon (horisontal)
    case backdrop2 = "Backdrop2"   // Lilla scene m/ purple-glow
    case backdrop3 = "Backdrop3"   // Vertikal pin-path (signaturen)
    case backdrop4 = "Backdrop4"   // Sci-fi grid isometric pin
    case backdrop5 = "Backdrop5"   // Cityscape m/ pin-overlay
    case backdrop6 = "Backdrop6"   // Mac+iPad-mockup (mer detaljert)
    case backdrop7 = "Backdrop7"   // Pencil-path m/ pin
    case backdrop8 = "Backdrop8"   // Isometric workspace

    // ── Super Admin-serien (fase 27) ────────────────────────────
    case backdrop13 = "Backdrop13"  // Command Center — silhouette m/ 3 hologramskjermer (kart/graf/hub)
    case backdrop14 = "Backdrop14"  // B2B Funnel — 3 transparente plater → green pin/bar-chart
    case backdrop15 = "Backdrop15"  // Marketing Cockpit — 4 hexagonale moduler (people/news/video/refresh)
    case backdrop16 = "Backdrop16"  // Ad-Tech Stack — 4 stablete plater m/ earth/sphere
    case backdrop17 = "Backdrop17"  // Platform Health — server-racks m/ waveform pulse
}

struct BrandedHeroBackground: View {
    let backdrop: LeadgridBackdrop
    /// Hvor sterkt content over backdrop'en skal mørkes ned.
    /// 0.0 = se backdrop helt klart, 1.0 = nesten svart.
    var darkenFrom: Double = 0.35
    var darkenTo: Double = 0.92

    init(_ backdrop: LeadgridBackdrop,
         darkenFrom: Double = 0.35, darkenTo: Double = 0.92) {
        self.backdrop = backdrop
        self.darkenFrom = darkenFrom
        self.darkenTo = darkenTo
    }

    var body: some View {
        ZStack(alignment: .top) {
            // Solid mørk-lilla bunn — matcher landing-side-bg
            Color(red: 0.043, green: 0.020, blue: 0.094)

            // Backdrop øverst, scaledToFill m/ top-anchor
            Image(backdrop.rawValue)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, alignment: .top)
                .clipped()

            // Gradient overlay — gradvis mørkere mot bunnen
            LinearGradient(
                colors: [
                    .black.opacity(darkenFrom),
                    Color(red: 0.043, green: 0.020, blue: 0.094).opacity(darkenTo),
                ],
                startPoint: .top, endPoint: .bottom
            )
        }
    }
}
