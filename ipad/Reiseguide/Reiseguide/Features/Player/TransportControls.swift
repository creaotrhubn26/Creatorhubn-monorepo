// TransportControls.swift
//
// Fremdriftslinje (5.13) og transportkontroller (5.14). Egen fil (flyttet ut
// av PlayerView.swift, som nærmet seg SwiftLint sin file_length-grense).

import SwiftUI

/// Fremdriftslinje (5.13): Slider-basert, adjustable ±5 s for VoiceOver.
struct ProgressSlider: View {
    let position: Double
    let duration: Double
    let locale: Locale
    let onSeek: (Double) -> Void

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        GeometryReader { proxy in
            let fraction = duration > 0 ? min(1, max(0, position / duration)) : 0
            ZStack(alignment: .leading) {
                Capsule().fill(contrast.border).frame(height: 4)
                Capsule().fill(AppColor.accent).frame(width: proxy.size.width * fraction, height: 4)
                Circle()
                    .fill(AppColor.accent)
                    .frame(width: 16, height: 16)
                    .offset(x: max(0, proxy.size.width * fraction - 8))
            }
            .frame(height: AppSpacing.minTapTarget)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let f = min(1, max(0, value.location.x / max(1, proxy.size.width)))
                        onSeek(f * duration)
                    }
            )
        }
        .frame(height: AppSpacing.minTapTarget)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("player.progress"))
        .accessibilityValue(Text(spokenValue))
        .accessibilityAddTraits(.updatesFrequently)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSeek(position + 5)
            case .decrement: onSeek(position - 5)
            @unknown default: break
            }
        }
    }

    private var spokenValue: String {
        L10n.string("player.progressValue", lang: locale.identifier)
            .replacingOccurrences(of: "%1$@", with: L10n.spokenDuration(seconds: position, locale: locale))
            .replacingOccurrences(of: "%2$@", with: L10n.spokenDuration(seconds: duration, locale: locale))
    }
}

/// Transportkontroller (5.14): tilbake 15, spill/pause 72 pt, frem 15, hastighet.
struct TransportControls: View {
    let isPlaying: Bool
    let rate: Double
    let locale: Locale
    let onBack: () -> Void
    let onToggle: () -> Void
    let onForward: () -> Void
    let onRate: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: AppSpacing.xxl) {
            Button(action: onBack) {
                Image(systemName: "gobackward.15")
                    .font(.system(size: 32))
                    .foregroundStyle(AppColor.textPrimary)
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.back15"))

            Button(action: onToggle) {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(AppColor.onAccent)
                    .frame(width: 72, height: 72)
                    .background(AppColor.accent, in: Circle())
                    .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                    .animation(reduceMotion ? nil : .default, value: isPlaying)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text(isPlaying ? "player.pause" : "player.play"))

            Button(action: onForward) {
                Image(systemName: "goforward.15")
                    .font(.system(size: 32))
                    .foregroundStyle(AppColor.textPrimary)
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.forward15"))

            Button(action: onRate) {
                Text(rateLabel)
                    .font(.footnote.weight(.semibold).monospacedDigit())
                    .foregroundStyle(AppColor.textPrimary)
                    .underline()
                    // minWidth i stedet for fast bredde: teksten («1.25×») får
                    // vokse med Dynamic Type i stedet for å bli klippet mot
                    // knappene ved siden av (8.2).
                    .frame(minWidth: 56, minHeight: AppSpacing.minTapTarget)
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.rate"))
            .accessibilityValue(Text(rateSpoken))
        }
    }

    private var rateLabel: String {
        "\(rate.formatted(.number.precision(.fractionLength(0 ... 2)).locale(locale)))×"
    }

    private var rateSpoken: String {
        L10n.string("player.rateValue", lang: locale.identifier)
            .replacingOccurrences(of: "%@", with: rate.formatted(.number.precision(.fractionLength(0 ... 2)).locale(locale)))
    }
}
