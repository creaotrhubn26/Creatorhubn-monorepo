// PlayerView.swift
//
// Avspiller (UI-spesifikasjon 6.4), redesignet som en fullskjerms «Nå spilles»
// (eieren: «avspilleren bør fullskjerm»): kapittelbildet øverst (ca. 40 % av
// høyden) med toppfelt (lukk, teksting av/på, del) over, tittel/kapittel-
// tittel/kilde som overlapper bunnen av bildet. Fremdrift, transportkontroller
// (5.14) og teksting (5.16) står rett under, alltid synlige uten scrolling ved
// vanlig tekststørrelse. Resten (spørsmål underveis, variantvelger, avslutt,
// spør guiden, synstolkingskort) er under, i en egen scroll. Ved
// tilgjengelighetstekststørrelser (8.2) scroller alt som én kolonne, så
// ingenting klippes. VoiceOver-rekkefølge og -oppførsel etter 8.4.
// Pakke 3: spørsmål underveis under tekstingen og «Spør guiden».

import SwiftUI

struct PlayerView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Andel av skjermhøyden kapittelbildet får øverst (del 6.4-redesign).
    private static let photoHeightFraction: CGFloat = 0.4
    private static let minPhotoHeight: CGFloat = 220

    private var player: PlayerViewModel { env.player }
    private var locale: Locale { env.settings.locale }
    private var uiLang: String { env.settings.uiLanguage }

    var body: some View {
        GeometryReader { proxy in
            Group {
                // Ved accessibility3 og over scroller alt som én kolonne, så
                // ingenting klippes (8.2). Under det er fremdrift, kontroller
                // og teksting alltid synlige, med resten under i egen scroll.
                if dynamicTypeSize >= .accessibility3 {
                    ScrollView {
                        VStack(spacing: 0) {
                            photoSection(proxy: proxy)
                            controlsSection
                            secondaryContent
                        }
                    }
                } else {
                    VStack(spacing: 0) {
                        photoSection(proxy: proxy)
                        controlsSection
                        ScrollView { secondaryContent }
                            .scrollBounceBehavior(.basedOnSize)
                    }
                }
            }
            .ignoresSafeArea(edges: .top)
        }
        .background(AppColor.bgBase)
        .preferredColorScheme(.dark)
        .sheet(item: Bindable(env.player).finishedVisit) { visit in
            AfterVisitView(entryId: visit.entryId, poi: visit.poi) { related in
                env.player.finishedVisit = nil
                env.player.stopAndClear()
                env.open(poi: related)
            }
        }
        .onChange(of: player.pendingChapterAnnouncement) { _, title in
            guard let title else { return }
            let message = L10n.string("player.newChapter", lang: uiLang).replacingOccurrences(of: "%@", with: title)
            AccessibilityNotification.Announcement(message).post()
            player.pendingChapterAnnouncement = nil
        }
        // Kapittelbytte (pakke 1, punkt 2): egen haptikk utenom kapittel-
        // annonseringen over, styrt av «Vibrasjon».
        .sensoryFeedback(trigger: player.chapterIndex) { _, _ in
            AppHaptics.feedback(.selection, enabled: env.settings.hapticsEnabled)
        }
    }

    // MARK: - Deler

    /// Kapittelbildet øverst med scrim, toppfelt og tittelblokken som
    /// overlapper bunnen. Med «Reduser gjennomsiktighet» vises bildet fortsatt
    /// som sin egen blokk, men teksten står på en heldekkende bunn i stedet
    /// for et gradient-scrim (ingen tekst over foto).
    private func photoSection(proxy: GeometryProxy) -> some View {
        let height = max(Self.minPhotoHeight, proxy.size.height * Self.photoHeightFraction)
        return ZStack(alignment: .top) {
            RemoteImage(url: player.chapter?.imageUrl ?? player.poi?.heroImageUrl)
                .frame(height: height)
                .frame(maxWidth: .infinity)
                .clipped()
                .accessibilityHidden(true)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: player.chapterIndex)
                .overlay(alignment: .bottom) {
                    if !reduceTransparency {
                        ScrimOverlay()
                    }
                }
            topBar
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.top, proxy.safeAreaInsets.top + AppSpacing.s)
        }
        .frame(height: height)
        .overlay(alignment: .bottom) {
            titleBlock
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.vertical, AppSpacing.m)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(reduceTransparency ? AppColor.bgBase : Color.clear)
        }
    }

    /// Fremdrift, transportkontroller og teksting: alltid synlige uten
    /// scrolling ved vanlig tekststørrelse (kravet «avspilleren bør fullskjerm»).
    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.l) {
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
        }
        .padding(.horizontal, AppSpacing.screenMargin)
        .padding(.top, AppSpacing.l)
    }

    /// Spørsmål underveis, variantvelger, avslutt/spør guiden og
    /// synstolkingskortet: under kontrollene, i egen scroll.
    private var secondaryContent: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xl) {
            ChapterPromptSlot()
            variantPicker
            SecondaryButton(title: "player.finish", systemImage: "checkmark.circle") {
                player.finishVisit()
            }
            .accessibilityHint(Text("player.finishHint"))
            AskGuideButton(poi: player.poi, pausesPlayer: true)
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
        .padding(.top, AppSpacing.xl)
        .padding(.bottom, AppSpacing.xl)
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
                ShareLinkButton(url: poi.shareURL, fallbackText: poi.title, subject: poi.title, message: poi.title) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.textPrimary)
                        .frame(width: 44, height: 44)
                        .background(AppColor.bgOverlay, in: Circle())
                }
            }
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
            PlaybackSourceLabel(isReadByPhone: player.isReadByPhone, isSimulated: player.isSimulated)
            AudioLevelBars(isPlaying: player.isPlaying)
                .padding(.top, AppSpacing.xs)
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
