// MiniPlayerBar.swift
//
// Miniavspiller over tab baren når avspilleren er lukket (del 6). Egen fil
// fordi PlayerView.swift er nær SwiftLint sin file_length-grense.

import SwiftUI

struct MiniPlayerBar: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let player = env.player
        HStack(spacing: AppSpacing.m) {
            Button {
                player.isPresented = true
            } label: {
                HStack(spacing: AppSpacing.m) {
                    RemoteImage(url: player.chapter?.imageUrl ?? player.poi?.heroImageUrl)
                        .frame(width: 40, height: 40)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(player.poi?.title ?? "")
                            .font(AppFont.cardTitle)
                            .foregroundStyle(AppColor.textPrimary)
                            .lineLimit(1)
                        Text(player.chapter?.title ?? "")
                            .font(.caption)
                            .foregroundStyle(contrast.textSecondary)
                            .lineLimit(2)
                    }
                    AudioLevelBars(isPlaying: player.isPlaying, barCount: 3)
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("player.openMini"))
            Button {
                player.togglePlayPause()
            } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(AppColor.onAccent)
                    .frame(width: 44, height: 44)
                    .background(AppColor.accent, in: Circle())
                    .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                    .animation(reduceMotion ? nil : .default, value: player.isPlaying)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text(player.isPlaying ? "player.pause" : "player.play"))
            Button {
                player.stopAndClear()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppColor.textPrimary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.stop"))
        }
        .padding(.horizontal, AppSpacing.screenMargin)
        .frame(minHeight: 56)
        .background(AppColor.bgSurface)
        .overlay(alignment: .top) { Rectangle().fill(contrast.border).frame(height: 0.5) }
    }
}
