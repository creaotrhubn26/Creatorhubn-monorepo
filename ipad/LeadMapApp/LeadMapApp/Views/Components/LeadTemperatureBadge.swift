// LeadTemperatureBadge.swift
//
// Konsistent pill-badge for lead-temperatur. Brukes overalt der vi viser
// «cold/warm/hot/ready» — list-views, oversikt-tabell, lead-detail,
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
    case cold
    case warm
    case hot
    case ready

    /// Parse fra backend-string. Eldre `lukewarm`/`cool` beholdes som
    /// bakoverkompatible alias for den nye, eksplisitte «klar»-verdien.
    static func parse(_ raw: String?) -> LeadTemperature? {
        guard let raw = raw?.lowercased(), !raw.isEmpty else { return nil }
        switch raw {
        case "cold": return .cold
        case "warm": return .warm
        case "hot": return .hot
        case "ready", "lukewarm", "cool": return .ready
        default: return nil
        }
    }

    var label: String {
        switch self {
        case .cold: return "Kald"
        case .warm: return "Varm"
        case .hot: return "Hot"
        case .ready: return "Klar"
        }
    }

    /// Bakgrunns-farge for pill. Matcher Leadgrid brand-palett.
    var background: Color {
        switch self {
        case .cold: return Color(red: 0.38, green: 0.55, blue: 0.98)  // kjølig blå
        case .warm: return Color(red: 0.98, green: 0.55, blue: 0.10)  // varm oransje
        case .hot: return Color(red: 0.94, green: 0.20, blue: 0.25)  // høy prioritet
        case .ready: return Color(red: 0.20, green: 0.75, blue: 0.52)  // klar for handling
        }
    }

    /// Tekst-farge på pillen — gul trenger mørk tekst for kontrast (WCAG).
    var foreground: Color {
        switch self {
        case .warm: return Color(red: 0.20, green: 0.10, blue: 0.01)
        default:    return .white
        }
    }

    /// SF Symbol for ikon-varianten.
    var icon: String {
        switch self {
        case .cold: return "snowflake"
        case .warm: return "sun.max.fill"
        case .hot: return "flame.fill"
        case .ready: return "checkmark.seal.fill"
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
