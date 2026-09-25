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

/// Transportkontroller (5.14): tilbake 15, spill/pause 72 pt (midt på), frem 15, hastighet.
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
        // Spill/pause skal stå midt på skjermen. Hastighetsknappen ligger i en
        // egen kolonne til høyre, og en like bred tom kolonne til venstre
        // balanserer den, så den ikke skyver de tre hovedknappene mot venstre.
        HStack(spacing: 0) {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: 1)
                .accessibilityHidden(true)
            HStack(spacing: AppSpacing.xl) {
                skipButton(systemImage: "gobackward.15", label: "player.back15", action: onBack)
                playPauseButton
                skipButton(systemImage: "goforward.15", label: "player.forward15", action: onForward)
            }
            rateButton
                .frame(maxWidth: .infinity)
        }
    }

    private func skipButton(systemImage: String, label: LocalizedStringKey, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 32))
                .foregroundStyle(AppColor.textPrimary)
                .frame(width: 56, height: 56)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text(label))
    }

    private var playPauseButton: some View {
        Button(action: onToggle) {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 30))
                .foregroundStyle(AppColor.onAccent)
                // Trekanten ser venstreforskjøvet ut når den er geometrisk
                // sentrert; flyttes litt til høyre (optisk sentrering).
                .offset(x: isPlaying ? 0 : 2)
                .frame(width: 72, height: 72)
                .background(AppColor.accent, in: Circle())
                .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                .animation(reduceMotion ? nil : .default, value: isPlaying)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text(isPlaying ? "player.pause" : "player.play"))
    }

    private var rateButton: some View {
        Button(action: onRate) {
            Text(rateLabel)
                .font(.footnote.weight(.semibold).monospacedDigit())
                .foregroundStyle(AppColor.textPrimary)
                .underline()
                // minWidth i stedet for fast bredde: teksten («1.25×») får
                // vokse med Dynamic Type i stedet for å bli klippet (8.2).
                .frame(minWidth: AppSpacing.minTapTarget, minHeight: AppSpacing.minTapTarget)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text("player.rate"))
        .accessibilityValue(Text(rateSpoken))
    }

    private var rateLabel: String {
        "\(rate.formatted(.number.precision(.fractionLength(0 ... 2)).locale(locale)))×"
    }

    private var rateSpoken: String {
        L10n.string("player.rateValue", lang: locale.identifier)
            .replacingOccurrences(of: "%@", with: rate.formatted(.number.precision(.fractionLength(0 ... 2)).locale(locale)))
    }
}
