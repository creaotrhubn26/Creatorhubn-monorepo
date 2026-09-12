// IndustryBadge.swift
//
// Liten badge som viser bransje-icon + navn for et lead. Brukes på
// LeadCards, OversiktView-tabell, og pin-info-sheet.
//
// Variants:
//   - .compact: bare ikon + 1 linje
//   - .pill:    ikon + navn i pill med bransje-farge

import SwiftUI

struct IndustryBadge: View {
    let industry: Industry
    let style: Style

    enum Style { case compact, pill, icon }

    var body: some View {
        switch style {
        case .icon:
            Image(systemName: industry.sfSymbol)
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(industry.color, in: Circle())

        case .compact:
            HStack(spacing: 4) {
                Image(systemName: industry.sfSymbol)
                    .font(.caption2)
                    .foregroundStyle(industry.color)
                Text(industry.nameNo)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

        case .pill:
            HStack(spacing: 6) {
                Image(systemName: industry.sfSymbol)
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                Text(industry.nameNo)
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(industry.color, in: Capsule())
        }
    }
}
