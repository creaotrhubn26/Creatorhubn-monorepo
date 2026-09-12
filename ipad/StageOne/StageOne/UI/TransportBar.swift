import SwiftUI

struct TransportBar: View {
    let document: SceneDocument
    let player: ShotPlayer
    let onSelectShot: (Int) -> Void

    var body: some View {
        HStack(spacing: 14) {
            Button {
                player.isPlaying ? player.pause() : player.play()
            } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.fg)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Theme.raise))
                    .overlay(Circle().stroke(Theme.border, lineWidth: Theme.hairline))
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.space, modifiers: [])

            Text(player.timecode)
                .font(Theme.mono(13))
                .foregroundStyle(Theme.fg)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(document.data.shots.enumerated()), id: \.element.id) { index, shot in
                        shotCard(shot, index: index, active: player.currentShotIndex == index)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Theme.surface)
    }

    private func shotCard(_ shot: Shot, index: Int, active: Bool) -> some View {
        Button {
            onSelectShot(index)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(shot.name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(active ? Theme.fg : Theme.muted)
                    .lineLimit(1)
                Text("\(document.data.node(shot.cameraNodeId)?.name ?? "?") · \(Int(shot.durationSec))s")
                    .font(Theme.mono(9))
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(active ? Theme.accent.opacity(0.18) : Theme.raise))
            .overlay(RoundedRectangle(cornerRadius: 8)
                .stroke(active ? Theme.accent : Theme.border, lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
    }
}
