// StageHeader.swift
//
// Standard "ikon + tittel + underforklaring"-header brukt øverst i
// DiscoveryProgressView. Holdes som egen komponent slik at stages
// kan rendres uniformt, og fordi vi sannsynligvis vil gjenbruke
// mønsteret i andre lang-kjørende flyter (Brand scan, Markedsskann).

import SwiftUI

struct StageHeader: View {
    let icon: String
    let title: String
    let subtitle: String?
    let tint: Color

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(tint.opacity(0.15))
                    .frame(width: 34, height: 34)
                Image(systemName: icon)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(tint)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                if let sub = subtitle, !sub.isEmpty {
                    Text(sub)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        StageHeader(
            icon: "magnifyingglass",
            title: "Søker etter fotograf i Oslo …",
            subtitle: "Vi spør Google Places om bedrifter som matcher 'fotograf i Oslo' innenfor 10 km.",
            tint: .purple,
        )
        StageHeader(
            icon: "checkmark.circle.fill",
            title: "Fant 10 kandidater",
            subtitle: "Starter research på hver av dem — Brreg, nettside, kontaktinfo.",
            tint: .purple,
        )
    }
    .padding()
}
