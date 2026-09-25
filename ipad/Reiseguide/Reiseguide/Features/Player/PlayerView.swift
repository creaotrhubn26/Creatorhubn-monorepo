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

    /// Kapittellisten (item 4): eget ark, se PlayerChapterList.swift.
    @State private var showChapterList = false

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
                            endOfVisitSection
                            secondaryContent
                        }
                    }
                } else {
                    VStack(spacing: 0) {
                        photoSection(proxy: proxy)
                        controlsSection
                        // Avslutningskortet (item 1) står utenfor scrollen, rett
                        // under kontrollene, så det alltid er synlig uten
                        // scrolling ved vanlig tekststørrelse.
                        endOfVisitSection
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
        .sheet(isPresented: $showChapterList) {
            PlayerChapterListSheet(
                chapters: player.variant?.chapters ?? [],
                currentChapterNo: player.chapter?.no,
                completedChapterNos: completedChapterNos,
                locale: locale,
                uiLang: uiLang,
                onSelect: { player.jump(toChapter: $0) }
            )
        }
        .onChange(of: player.pendingChapterAnnouncement) { _, title in
            guard let title else { return }
            let message = L10n.string("player.newChapter", lang: uiLang).replacingOccurrences(of: "%@", with: title)
            AccessibilityNotification.Announcement(message).post()
            player.pendingChapterAnnouncement = nil
        }
        // Avslutningskortet dukker opp (item 1): annonseres én gang, som
        // kapittelbyttet over. VoiceOver-fokus flyttes av kortet selv
        // (EndOfVisitCard.onAppear), samme mønster som ArrivalCardView.
        .onChange(of: player.pendingVisitEndedAnnouncement) { _, message in
            guard let message else { return }
            AccessibilityNotification.Announcement(message).post()
            player.pendingVisitEndedAnnouncement = nil
        }
        // Kapittelbytte (pakke 1, punkt 2): egen haptikk utenom kapittel-
        // annonseringen over, styrt av «Vibrasjon».
        .sensoryFeedback(trigger: player.chapterIndex) { _, _ in
            AppHaptics.feedback(.selection, enabled: env.settings.hapticsEnabled)
        }
    }

    /// Kapitler brukeren allerede har hørt i denne avspillingsøkten: alle
    /// før det som spilles nå (item 4-listen har ingen annen kilde til
    /// «hørt» per kapittel).
    private var completedChapterNos: Set<Int> {
        guard let currentNo = player.chapter?.no else { return [] }
        return Set((player.variant?.chapters ?? []).map(\.no).filter { $0 < currentNo })
    }

    /// «Rolig slutt på besøket» (item 1): vises når fortellingen har tatt
    /// slutt av seg selv. «Gå til neste stopp» skjules når ruten er tom for
    /// ubesøkte stopp (item 2).
    @ViewBuilder
    private var endOfVisitSection: some View {
        if let visit = player.narrationEndedVisit {
            EndOfVisitCard(
                nextStopTitle: env.nextStop(after: visit.poi.id)?.title,
                uiLang: uiLang,
                onTakeQuiz: { player.openAfterVisitFromEndCard() },
                onNextStop: {
                    guard let next = env.nextStop(after: visit.poi.id) else { return }
                    env.openVeiviser(to: next)
                },
                onReplay: { player.replayVisit() }
            )
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.top, AppSpacing.l)
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
            PlayerTopBar(
                poi: player.poi,
                captionsEnabled: player.captionsEnabled,
                onClose: { player.close() },
                onToggleCaptions: { player.toggleCaptions() }
            )
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.top, proxy.safeAreaInsets.top + AppSpacing.s)
        }
        .frame(height: height)
        .overlay(alignment: .bottom) {
            PlayerTitleBlock(
                title: player.poi?.title ?? "",
                chapterTitle: player.chapter?.title,
                isReadByPhone: player.isReadByPhone,
                isSimulated: player.isSimulated,
                isPlaying: player.isPlaying
            )
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
            resumeHintSection
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
            // Kapitler (item 4): forrige/neste og kapittelliste, skjult ved ett kapittel.
            if player.hasMultipleChapters, let chapterNo = player.chapter?.no {
                ChapterNavRow(
                    currentChapterNo: chapterNo,
                    totalChapters: player.variant?.chapters.count ?? 1,
                    uiLang: uiLang,
                    onPrevious: { player.previousChapter() },
                    onNext: { player.nextChapter() },
                    onShowList: { showChapterList = true }
                )
            }
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

    /// «Fortsett der du slapp» (item 3): vises rett etter `start(poi:)` har
    /// hoppet til en lagret posisjon.
    @ViewBuilder
    private var resumeHintSection: some View {
        if let hint = player.resumeHint {
            ResumeHintBar(
                savedPositionS: hint.savedPositionS,
                uiLang: uiLang,
                onRestart: { player.restartFromBeginning() },
                onDismiss: { player.dismissResumeHint() }
            )
        }
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
