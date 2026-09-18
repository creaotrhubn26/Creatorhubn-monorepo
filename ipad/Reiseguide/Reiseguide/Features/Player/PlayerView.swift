// PlayerView.swift
//
// Avspiller (UI-spesifikasjon 6.4): bakgrunnsbilde fra kapittelet med kraftig
// scrim, toppfelt (lukk, teksting av/på, del), tittel og kapittel, tid og
// fremdriftslinje (5.13), transportkontroller (5.14), tekstingsvisning (5.16)
// og synstolkingskort (5.15). VoiceOver-rekkefølge og -oppførsel etter 8.4.

import SwiftUI

struct PlayerView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var player: PlayerViewModel { env.player }
    private var locale: Locale { env.settings.locale }
    private var uiLang: String { env.settings.uiLanguage }

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, AppSpacing.screenMargin)
                    .padding(.top, AppSpacing.s)
                Spacer(minLength: AppSpacing.xl)
                mainContent
            }
        }
        .background(AppColor.bgBase)
        .preferredColorScheme(.dark)
        .onChange(of: player.pendingChapterAnnouncement) { _, title in
            guard let title else { return }
            let message = L10n.string("player.newChapter", lang: uiLang).replacingOccurrences(of: "%@", with: title)
            AccessibilityNotification.Announcement(message).post()
            player.pendingChapterAnnouncement = nil
        }
    }

    // MARK: - Deler

    private var background: some View {
        ZStack {
            AppColor.bgBase
            if !reduceTransparency {
                RemoteImage(url: player.chapter?.imageUrl ?? player.poi?.heroImageUrl)
                    .ignoresSafeArea()
                    .accessibilityHidden(true)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: player.chapterIndex)
                LinearGradient(
                    stops: [
                        .init(color: AppColor.bgBase.opacity(0.2), location: 0),
                        .init(color: AppColor.bgBase.opacity(0.92), location: 0.4),
                        .init(color: AppColor.bgBase.opacity(0.98), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: AppSpacing.m) {
            IconCircleButton(systemImage: "chevron.down", label: "action.close") {
                player.close()
            }
            Spacer()
            Button {
                player.toggleCaptions()
            } label: {
                Image(systemName: player.captionsEnabled ? "captions.bubble.fill" : "captions.bubble")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(player.captionsEnabled ? AppColor.accent : AppColor.textPrimary)
                    .frame(width: 44, height: 44)
                    .background(AppColor.bgOverlay, in: Circle())
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("captions.label"))
            .accessibilityValue(Text(player.captionsEnabled ? "state.on" : "state.off"))
            .accessibilityAddTraits(.isToggle)
            if let poi = player.poi {
                ShareLink(item: poi.title) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.textPrimary)
                        .frame(width: 44, height: 44)
                        .background(AppColor.bgOverlay, in: Circle())
                }
                .accessibilityLabel(Text("action.share"))
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        let inner = VStack(alignment: .leading, spacing: AppSpacing.xl) {
            titleBlock
            progressBlock
            TransportControls(
                isPlaying: player.isPlaying,
                rate: player.rate,
                locale: locale,
                onBack: { player.skip(by: -15) },
                onToggle: { player.togglePlayPause() },
                onForward: { player.skip(by: 15) },
                onRate: { player.cycleRate() }
            )
            .frame(maxWidth: .infinity)
            if player.captionsEnabled {
                VStack(spacing: AppSpacing.xs) {
                    CaptionView(text: player.currentCaption)
                    if player.captionsAreEstimated {
                        Text("captions.estimated")
                            .font(.caption)
                            .foregroundStyle(contrast.textTertiary)
                    }
                }
            }
            variantPicker
            if let text = player.audioDescriptionText {
                AudioDescriptionCard(
                    statusText: "audioDescription.now",
                    text: text,
                    imageUrl: player.audioDescriptionImageUrl,
                    isExpanded: Bindable(env.player).audioDescriptionExpanded
                )
            }
        }
        .padding(.horizontal, AppSpacing.screenMargin)
        .padding(.bottom, AppSpacing.xl)

        // Ved accessibility3 og over legges alt under en ScrollView så
        // kontrollene aldri skyves ut av skjermen (8.2).
        if dynamicTypeSize >= .accessibility3 {
            ScrollView { inner }
        } else {
            ScrollView { inner }
                .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(player.poi?.title ?? "")
                .font(AppFont.playerTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            if let chapterTitle = player.chapter?.title {
                Text(chapterTitle)
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
            }
            if player.isSimulated {
                Text("player.noAudioYet")
                    .font(.caption)
                    .foregroundStyle(contrast.textTertiary)
                    .padding(.top, AppSpacing.xs)
            }
        }
    }

    private var progressBlock: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            Text("\(L10n.clock(seconds: player.positionS)) / \(L10n.clock(seconds: player.durationS))")
                .font(AppFont.meta)
                .foregroundStyle(contrast.textTertiary)
                .accessibilityHidden(true)
            ProgressSlider(
                position: player.positionS,
                duration: player.durationS,
                locale: locale,
                onSeek: { player.seek(to: $0) }
            )
        }
    }

    private var variantPicker: some View {
        HStack(spacing: AppSpacing.s) {
            FilterChip(label: L10n.string("player.variant.narration", lang: uiLang), isSelected: player.variantKind == .narration) {
                player.selectVariant(.narration)
            }
            .disabled(player.poi?.variants.narration == nil)
            FilterChip(label: L10n.string("player.variant.audioDescription", lang: uiLang), isSelected: player.variantKind == .audioDescription) {
                player.selectVariant(.audioDescription)
            }
            .disabled(player.poi?.variants.audioDescription == nil)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("player.variant.label"))
    }
}

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
                    .frame(width: 56, height: 44)
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

/// Miniavspiller over tab baren når avspilleren er lukket (del 6).
struct MiniPlayerBar: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

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
                            .lineLimit(1)
                    }
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
