// PlaybackSourceLabel.swift
//
// Liten, ærlig merking under kapitteltittelen om hvor lyden kommer fra:
//   - Opplest av telefonen (SpeechNarrator): «Opplest av telefonen».
//   - Stille, simulert tidslinje (tomt manus): «Lyden er ikke klar ennå …»
//     som før.
//   - Ekte lydfil: ingenting, som før.
// Egen fil fordi PlayerView.swift er nær SwiftLint sin file_length-grense.

import SwiftUI

struct PlaybackSourceLabel: View {
    let isReadByPhone: Bool
    let isSimulated: Bool

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        if isReadByPhone {
            Label {
                Text("player.readByPhone")
            } icon: {
                Image(systemName: "iphone.radiowaves.left.and.right")
                    .accessibilityHidden(true)
            }
            .font(.caption)
            .foregroundStyle(contrast.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, AppSpacing.xs)
            .accessibilityElement(children: .combine)
        } else if isSimulated {
            Text("player.noAudioYet")
                .font(.caption)
                .foregroundStyle(contrast.textTertiary)
                .padding(.top, AppSpacing.xs)
        }
    }
}
