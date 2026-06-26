// TrendArrow.swift
//
// Liten universell trend-indikator for KPI-cards. Speiler mockenes
// «↑18% vs forrige periode»-rad. Brukes på alle KPI-flater.
//
// Inngang: delta (signed double, ofte i prosent — men også rene tall)
// Utgang : pil + label, fargekodet (grønn ↑, rød ↓, grå →).

import SwiftUI

struct TrendArrow: View {
    /// Signed delta. -100..100 ved prosent, men kan også være rene tall.
    let delta: Double
    /// Periodebeskrivelse, f.eks. "vs forrige uke".
    let period: String?
    /// Hvis true vises delta som prosent (med `%`-suffix). Default true.
    var asPercent: Bool = true
    /// Vis kun pilen + tall (kompakt-modus, for tabeller).
    var compact: Bool = false

    private var direction: Direction {
        if abs(delta) < 0.05 { return .flat }
        return delta > 0 ? .up : .down
    }

    private enum Direction {
        case up, down, flat
    }

    private var color: Color {
        switch direction {
        case .up:   return Color(red: 0.20, green: 0.78, blue: 0.45) // grønn
        case .down: return Color(red: 0.95, green: 0.40, blue: 0.40) // rød
        case .flat: return Color(red: 0.60, green: 0.62, blue: 0.68) // nøytral grå
        }
    }

    private var icon: String {
        switch direction {
        case .up:   return "arrow.up.right"
        case .down: return "arrow.down.right"
        case .flat: return "arrow.right"
        }
    }

    private var formatted: String {
        if direction == .flat { return "ingen endring" }
        let abs = abs(delta)
        if asPercent {
            // Heltall hvis nær heltall, 1 desimal ellers.
            if abs >= 10 { return "\(Int(abs.rounded()))%" }
            return String(format: "%.1f%%", abs)
        }
        if abs >= 100 { return String(Int(abs.rounded())) }
        return String(format: "%.1f", abs)
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption.bold())
            Text(formatted)
                .font(.caption.bold())
                .monospacedDigit()
            if !compact, let period, direction != .flat {
                Text(period)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(direction == .flat ? Color.secondary : color)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        switch direction {
        case .up:   return "Opp \(formatted)\(period.map { " " + $0 } ?? "")"
        case .down: return "Ned \(formatted)\(period.map { " " + $0 } ?? "")"
        case .flat: return "Ingen endring"
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 12) {
        TrendArrow(delta: 18, period: "vs forrige periode")
        TrendArrow(delta: 24, period: "siste 7 dager")
        TrendArrow(delta: -8, period: "vs forrige uke")
        TrendArrow(delta: 0, period: "vs forrige uke")
        TrendArrow(delta: 12, period: nil, compact: true)
    }
    .padding()
    .preferredColorScheme(.dark)
}
