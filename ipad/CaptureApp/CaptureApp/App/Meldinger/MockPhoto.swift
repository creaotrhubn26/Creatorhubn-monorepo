// MockPhoto.swift
//
// Komponerte «fiktive foto»-scener for demoene (--demo-messages). Rene
// gradient-fyll leste ikke som ekte bilder; disse legger lag på lag
// (bakgrunn → mykt lys → motiv-silhuett → vignett) så de føles som ekte
// produkt-/livsstilsfoto både som liten thumbnail og i fullskjerm-galleriet.
// Ingen bundlede bilde-assets nødvendig.

import SwiftUI

enum MockScene: String, CaseIterable, Equatable {
    case lifestyle    // produkt i vinduslys på marmor
    case texture      // makro krem-tekstur
    case group        // team i motlys (golden hour)
    case packaging    // emballasje-hero

    fileprivate var bg: [Color] {
        switch self {
        case .lifestyle: return [Color(hex: 0xF7F2EA), Color(hex: 0xE4D6C1)]
        case .texture:   return [Color(hex: 0xF2E7D6), Color(hex: 0xE3C4A6)]
        case .group:     return [Color(hex: 0xEBCBA4), Color(hex: 0xB77E56)]
        case .packaging: return [Color(hex: 0xEDE7DD), Color(hex: 0xC9BCA8)]
        }
    }
}

struct MockPhotoView: View {
    let scene: MockScene

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                LinearGradient(colors: scene.bg, startPoint: .topLeading, endPoint: .bottomTrailing)

                // Mykt hovedlys (vindu / bokeh).
                RadialGradient(
                    colors: [Color.white.opacity(0.55), .clear],
                    center: .init(x: 0.28, y: 0.22),
                    startRadius: 0, endRadius: max(w, h) * 0.75)
                    .blendMode(.softLight)

                subject(w: w, h: h)

                // Vignett for dybde.
                RadialGradient(
                    colors: [.clear, Color.black.opacity(0.34)],
                    center: .center, startRadius: min(w, h) * 0.35, endRadius: max(w, h) * 0.72)
            }
            .clipped()
        }
    }

    @ViewBuilder
    private func subject(w: CGFloat, h: CGFloat) -> some View {
        switch scene {
        case .lifestyle:
            // Serumflaske sentrert, med myk skygge.
            ZStack {
                Ellipse()
                    .fill(Color.black.opacity(0.16))
                    .frame(width: w * 0.42, height: h * 0.08)
                    .blur(radius: 3)
                    .offset(y: h * 0.30)
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: w * 0.03)
                        .fill(Color(hex: 0x6E5238))
                        .frame(width: w * 0.10, height: h * 0.14)   // pipette-topp
                    RoundedRectangle(cornerRadius: w * 0.06)
                        .fill(LinearGradient(colors: [Color(hex: 0xC98E5A), Color(hex: 0x9A6B3E)],
                                             startPoint: .top, endPoint: .bottom))
                        .frame(width: w * 0.26, height: h * 0.42)
                        .overlay(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.28))
                                .frame(width: w * 0.03, height: h * 0.30).padding(.leading, w * 0.05)
                        }
                }
                .offset(y: -h * 0.02)
            }
        case .texture:
            // Overlappende myke krem-klatter.
            ZStack {
                ForEach(0..<5, id: \.self) { i in
                    Circle()
                        .fill(Color(hex: i % 2 == 0 ? 0xFBF3E7 : 0xEAD3B6).opacity(0.9))
                        .frame(width: w * (0.34 + CGFloat(i) * 0.04))
                        .offset(x: w * (CGFloat(i) * 0.11 - 0.22),
                                y: h * (CGFloat((i % 3)) * 0.14 - 0.14))
                        .blur(radius: 1.5)
                }
            }
        case .group:
            // Tre silhuetter i motlys.
            HStack(alignment: .bottom, spacing: w * 0.04) {
                ForEach(0..<3, id: \.self) { i in
                    VStack(spacing: -h * 0.01) {
                        Circle().fill(Color(hex: 0x3A2A1E).opacity(0.82))
                            .frame(width: w * 0.14, height: w * 0.14)
                        Capsule().fill(Color(hex: 0x3A2A1E).opacity(0.82))
                            .frame(width: w * 0.20, height: h * (0.30 + CGFloat(i % 2) * 0.06))
                    }
                    .offset(y: h * 0.16)
                }
            }
        case .packaging:
            ZStack {
                Ellipse().fill(Color.black.opacity(0.15))
                    .frame(width: w * 0.5, height: h * 0.08).blur(radius: 3).offset(y: h * 0.28)
                RoundedRectangle(cornerRadius: w * 0.05)
                    .fill(LinearGradient(colors: [Color(hex: 0xF3ECE0), Color(hex: 0xD8CBB6)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: w * 0.42, height: h * 0.44)
                    .overlay(
                        RoundedRectangle(cornerRadius: w * 0.05).stroke(Color.black.opacity(0.06)))
                    .overlay(alignment: .top) {
                        Rectangle().fill(Color(hex: 0xC98E5A).opacity(0.55))
                            .frame(height: h * 0.05).padding(.top, h * 0.14)
                    }
            }
        }
    }
}
