// LeadTemperatureBadge.swift
//
// Konsistent pill-badge for lead-temperatur. Brukes overalt der vi viser
// «hot/warm/lukewarm/cold» — list-views, oversikt-tabell, lead-detail,
// lead-cards. Speiler det visuelle systemet i marketing-mocken (lilla
// brand-palett + tilbehør-farger).
//
// Tre stiler:
//   .pill   — full bredde-pill med ikon + tekst (default)
//   .compact— mindre, ingen ikon (for tabeller m/ smale kolonner)
//   .badge  — bare farget prikk + tekst (for lister)

import SwiftUI

/// Logisk temperatur fra backend (`lead_temperature`-feltet). Mappes til
/// farge + ikon + label på ett sted så vi ikke har 7 forskjellige varianter
/// spredt i view-koden.
enum LeadTemperature: String, Hashable, CaseIterable {
    case hot
    case warm
    case lukewarm   // mappes til "ready" eller andre milde varianter
    case cold

    /// Parse fra backend-string. Ukjente verdier → .cold (tryggeste default).
    static func parse(_ raw: String?) -> LeadTemperature? {
        guard let raw = raw?.lowercased(), !raw.isEmpty else { return nil }
        switch raw {
        case "hot", "ready": return .hot
        case "warm":         return .warm
        case "lukewarm", "cool": return .lukewarm
        case "cold":         return .cold
        default:             return nil
        }
    }

    var label: String {
        switch self {
        case .hot:      return "Hot lead"
        case .warm:     return "Varm lead"
        case .lukewarm: return "Lunken lead"
        case .cold:     return "Kald lead"
        }
    }

    /// Bakgrunns-farge for pill. Matcher Leadgrid brand-palett.
    var background: Color {
        switch self {
        case .hot:      return Color(red: 0.66, green: 0.32, blue: 0.99)  // brand-lilla
        case .warm:     return Color(red: 0.98, green: 0.75, blue: 0.14)  // varm gul
        case .lukewarm: return Color(red: 0.38, green: 0.55, blue: 0.98)  // kjølig blå
        case .cold:     return Color(red: 0.55, green: 0.60, blue: 0.68)  // nøytral grå
        }
    }

    /// Tekst-farge på pillen — gul trenger mørk tekst for kontrast (WCAG).
    var foreground: Color {
        switch self {
        case .warm: return Color(red: 0.20, green: 0.13, blue: 0.02)
        default:    return .white
        }
    }

    /// SF Symbol for ikon-varianten.
    var icon: String {
        switch self {
        case .hot:      return "flame.fill"
        case .warm:     return "sun.max.fill"
        case .lukewarm: return "cloud.sun.fill"
        case .cold:     return "snowflake"
        }
    }
}

struct LeadTemperatureBadge: View {
    enum Style { case pill, compact, badge }

    let temperature: LeadTemperature
    var style: Style = .pill

    var body: some View {
        switch style {
        case .pill:
            HStack(spacing: 4) {
                Image(systemName: temperature.icon).font(.caption2.bold())
                Text(temperature.label).font(.caption.bold())
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .foregroundStyle(temperature.foreground)
            .background(temperature.background, in: Capsule())
            .accessibilityLabel(temperature.label)

        case .compact:
            Text(temperature.label)
                .font(.caption2.bold())
                .padding(.horizontal, 8).padding(.vertical, 2)
                .foregroundStyle(temperature.foreground)
                .background(temperature.background, in: Capsule())
                .accessibilityLabel(temperature.label)

        case .badge:
            HStack(spacing: 4) {
                Circle()
                    .fill(temperature.background)
                    .frame(width: 8, height: 8)
                Text(temperature.label)
                    .font(.caption)
                    .foregroundStyle(.primary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(temperature.label)
        }
    }
}

/// Konvenens — bygg badge direkte fra en LeadModel hvis temperatur finnes.
extension LeadTemperatureBadge {
    init?(lead: LeadModel, style: Style = .pill) {
        guard let temp = LeadTemperature.parse(lead.leadTemperature) else { return nil }
        self.temperature = temp
        self.style = style
    }
}

#Preview {
    VStack(spacing: 16) {
        ForEach(LeadTemperature.allCases, id: \.self) { t in
            HStack(spacing: 12) {
                LeadTemperatureBadge(temperature: t, style: .pill)
                LeadTemperatureBadge(temperature: t, style: .compact)
                LeadTemperatureBadge(temperature: t, style: .badge)
            }
        }
    }
    .padding()
    .preferredColorScheme(.dark)
}
