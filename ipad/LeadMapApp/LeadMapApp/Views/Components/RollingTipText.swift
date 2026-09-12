// RollingTipText.swift
//
// "Visste du at …?" — rullerende tips som dukker opp etter 30s i lang-
// kjørende progresjoner (Finn leads). Reduserer "har det hengt seg"-
// følelsen ved å vise at backend faktisk jobber (Brreg er tregt, Claude
// analyserer, cache varmes opp osv.) Skifter tip hvert 8. sek med en mild
// fade-transition slik at det ikke distraherer.
//
// Standalone — ingen state utenom self. Eier sin egen Task som ticker
// indeksen oppover modulo tips-arrayen.

import SwiftUI

struct RollingTipText: View {
    let tips: [String]
    /// Sekunder mellom tip-bytter.
    var interval: Double = 8

    @State private var index: Int = 0

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "lightbulb.fill")
                .font(.caption)
                .foregroundStyle(.yellow)
                .padding(.top, 2)
            Text(currentTip)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .id(index)
                .transition(.opacity.combined(with: .move(edge: .top)))
        }
        .animation(.easeInOut(duration: 0.4), value: index)
        .task(id: tips.count) {
            // Kjør så lenge view-en lever; modulo over tips-listen.
            guard tips.count > 1 else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                if !Task.isCancelled {
                    index = (index + 1) % tips.count
                }
            }
        }
    }

    private var currentTip: String {
        guard !tips.isEmpty else { return "" }
        return tips[index % tips.count]
    }
}

#Preview {
    RollingTipText(
        tips: [
            "Brreg-API er ofte tregest — 10-20 sek per oppslag.",
            "Google Places gir oss adresse + telefon på sekunder.",
            "Claude analyserer hver nettside for bransje-context.",
            "Vi cacher resultatene — neste gang går det fortere.",
        ],
        interval: 2,
    )
    .padding()
}
