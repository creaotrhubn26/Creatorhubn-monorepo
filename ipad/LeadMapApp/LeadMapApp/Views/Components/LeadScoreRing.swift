// LeadScoreRing.swift
//
// Stor sirkulær score-ring m/ valgfri delta. Tidligere definert inni
// gamle OversiktView.swift; ekstrahert til egen fil i Components/ slik at
// både ny OversiktView, LeadDetailSheet og LeadgridCustomerDetailView kan
// gjenbruke samme ring uten å duplisere geometrien.

import SwiftUI

struct LeadScoreRing: View {
    let score: Int
    let delta: Int?
    var diameter: CGFloat = 96

    private var pct: Double { min(1, max(0, Double(score) / 100.0)) }

    private var color: Color {
        switch score {
        case 90...: return Color(red: 0.66, green: 0.32, blue: 0.99) // hot lilla
        case 70...: return Color(red: 0.46, green: 0.44, blue: 0.99) // lilla-blå
        case 50...: return Color(red: 0.98, green: 0.75, blue: 0.14) // gul
        default:    return Color(red: 0.55, green: 0.60, blue: 0.68) // grå
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.18), lineWidth: diameter / 12)
            Circle()
                .trim(from: 0, to: pct)
                .stroke(
                    LinearGradient(
                        colors: [color, color.opacity(0.75)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: diameter / 12, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(.system(size: diameter / 2.6, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(color)
                if let d = delta, d != 0 {
                    Text((d > 0 ? "↑" : "↓") + "\(abs(d))")
                        .font(.system(size: diameter / 7, weight: .bold))
                        .foregroundStyle(d > 0
                                          ? Color(red: 0.20, green: 0.78, blue: 0.45)
                                          : Color(red: 0.95, green: 0.40, blue: 0.40))
                }
            }
        }
        .frame(width: diameter, height: diameter)
        .accessibilityLabel("Score \(score)")
    }
}
