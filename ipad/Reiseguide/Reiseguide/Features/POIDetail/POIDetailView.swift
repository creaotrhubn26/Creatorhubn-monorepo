// POIDetailView.swift
//
// Detaljside (UI-spesifikasjon 6.3): hero-bilde med scrim og ikonknapper,
// innholdspanel med tittel, sted, mock-vurdering, segmentfaner
// Om / Opplevelse / Praktisk, og fast bunnfelt med «Start opplevelsen» og
// «Legg til i mine steder». Låst POI åpner mock-paywall.

import SwiftUI

struct POIDetailView: View {
    let poiId: String
    @Binding var path: NavigationPath

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    @State private var tab: DetailTab = .about
    @State private var showPaywall = false

    enum DetailTab: Int, CaseIterable, Identifiable {
        case about, experience, practical
        var id: Int { rawValue }
        var titleKey: LocalizedStringKey {
            switch self {
            case .about: return "detail.tab.about"
            case .experience: return "detail.tab.experience"
            case .practical: return "detail.tab.practical"
            }
        }
    }

    private var poi: GuidePOI? { env.store.poi(id: poiId) }
    private var locale: Locale { env.settings.locale }

    var body: some View {
        Group {
            if let poi {
                content(poi)
            } else {
                Text("detail.notFound")
                    .foregroundStyle(AppColor.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppColor.bgBase)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func content(_ poi: GuidePOI) -> some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    heroHeader(poi, proxy: proxy)
                    detailCard(poi)
                }
            }
            .background(AppColor.bgBase)
            .ignoresSafeArea(edges: .top)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar(poi, locked: env.isLocked(poi))
        }
        .sheet(isPresented: $showPaywall) {
            MockPaywallSheet(areaId: poi.areaId)
        }
    }

    /// Heltebilde med scrim og knappene tilbake / favoritt / del.
    private func heroHeader(_ poi: GuidePOI, proxy: GeometryProxy) -> some View {
        ZStack(alignment: .top) {
            RemoteImage(url: poi.heroImageUrl)
                .frame(height: proxy.size.height * 0.46)
                .frame(maxWidth: .infinity)
                .clipped()
                .overlay(ScrimOverlay())
                .accessibilityLabel(Text(poi.heroImageAlt ?? poi.title))
            HStack {
                IconCircleButton(systemImage: "chevron.left", label: "action.back") {
                    if path.isEmpty { dismiss() } else { path.removeLast() }
                }
                Spacer()
                IconCircleButton(
                    systemImage: env.settings.isFavorite(poiId: poi.id) ? "heart.fill" : "heart",
                    label: env.settings.isFavorite(poiId: poi.id) ? "action.removeFavorite" : "action.addFavorite",
                    tint: env.settings.isFavorite(poiId: poi.id) ? AppColor.accent : AppColor.textPrimary
                ) {
                    env.settings.toggleFavorite(poiId: poi.id)
                }
                ShareLink(item: shareText(poi)) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.textPrimary)
                        .frame(width: 44, height: 44)
                        .background(AppColor.bgOverlay, in: Circle())
                }
                .accessibilityLabel(Text("action.share"))
            }
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.top, proxy.safeAreaInsets.top + AppSpacing.s)
        }
    }

    /// Kortet med tittel, sted, vurdering, språkvarsel og fanene.
    private func detailCard(_ poi: GuidePOI) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(poi.title)
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            if let location = poi.locationLabel {
                Text(location)
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
                    .padding(.top, AppSpacing.xs)
            }
            if let rating = DemoData.rating(forSlug: poi.slug) {
                ratingRow(rating)
                    .padding(.top, AppSpacing.s)
            }
            if poi.lang.fallbackUsed || poi.lang.autoTranslated {
                languageNotice(poi)
                    .padding(.top, AppSpacing.m)
            }
            SegmentTabs(selection: $tab, reduceMotion: reduceMotion)
                .padding(.top, AppSpacing.screenMargin)
            tabContent(poi)
                .padding(.top, AppSpacing.l)
                .padding(.bottom, AppSpacing.xl)
        }
        .padding(AppSpacing.screenMargin)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.bgBase)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: AppRadius.sheet, topTrailingRadius: AppRadius.sheet))
        .offset(y: -AppSpacing.xl)
    }

    /// Fast bunnfelt med primær- og sekundærknapp (UI-spesifikasjon 6.3).
    private func bottomBar(_ poi: GuidePOI, locked: Bool) -> some View {
        VStack(spacing: AppSpacing.m) {
            PrimaryButton(
                title: locked ? "detail.unlockToStart" : "detail.startExperience",
                systemImage: locked ? "lock.fill" : "play.fill",
                isEnabled: poi.primaryVariant != nil,
                disabledHint: "detail.noContentHint"
            ) {
                if locked {
                    showPaywall = true
                } else {
                    env.player.start(poi: poi)
                }
            }
            SecondaryButton(
                title: env.settings.isFavorite(poiId: poi.id) ? "detail.addedToMyPlaces" : "detail.addToMyPlaces",
                systemImage: env.settings.isFavorite(poiId: poi.id) ? "bookmark.fill" : "bookmark",
                isSelected: env.settings.isFavorite(poiId: poi.id)
            ) {
                env.settings.toggleFavorite(poiId: poi.id)
            }
        }
        .padding(AppSpacing.screenMargin)
        .background(AppColor.bgBase)
        .overlay(alignment: .top) { Rectangle().fill(contrast.border).frame(height: 0.5) }
    }

    private func ratingRow(_ rating: DemoData.Rating) -> some View {
        HStack(spacing: AppSpacing.xs) {
            Image(systemName: "star.fill").foregroundStyle(AppColor.rating)
            Text(rating.value, format: .number.precision(.fractionLength(1)))
                .foregroundStyle(AppColor.textPrimary)
            Text("(\(rating.count.formatted(.number.notation(.compactName).locale(locale))))")
                .foregroundStyle(contrast.textSecondary)
        }
        .font(AppFont.subtitle)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(
            L10n.string("rating.spoken", lang: env.settings.uiLanguage)
                .replacingOccurrences(of: "%1$@", with: rating.value.formatted(.number.precision(.fractionLength(1)).locale(locale)))
                .replacingOccurrences(of: "%2$@", with: rating.count.formatted(.number.locale(locale)))
        ))
    }

    private func languageNotice(_ poi: GuidePOI) -> some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: "globe").foregroundStyle(contrast.textSecondary)
            Text(poi.lang.fallbackUsed ? "detail.languageFallback" : "detail.autoTranslated")
                .font(.caption)
                .foregroundStyle(contrast.textSecondary)
        }
    }

    @ViewBuilder
    private func tabContent(_ poi: GuidePOI) -> some View {
        switch tab {
        case .about:
            VStack(alignment: .leading, spacing: AppSpacing.xl) {
                Text(poi.summary ?? poi.subtitle ?? "")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
                InfoIconRow(
                    durationText: poi.totalDurationS.map { L10n.shortDuration(seconds: $0, locale: locale) },
                    hasAudio: poi.primaryVariant?.hasAudio ?? false,
                    hasCaptions: poi.hasCaptions,
                    hasAudioDescription: poi.hasAudioDescription,
                    spokenSummary: infoSummary(poi)
                )
            }
        case .experience:
            VStack(alignment: .leading, spacing: AppSpacing.l) {
                if let variant = poi.variants.narration {
                    ForEach(variant.chapters) { chapter in
                        ChapterRow(chapter: chapter, locale: locale)
                    }
                } else {
                    Text("detail.noNarration")
                        .font(AppFont.body)
                        .foregroundStyle(contrast.textSecondary)
                }
            }
        case .practical:
            VStack(alignment: .leading, spacing: AppSpacing.l) {
                if poi.practicalInfo.isEmpty {
                    Text("detail.noPractical")
                        .font(AppFont.body)
                        .foregroundStyle(contrast.textSecondary)
                }
                ForEach(poi.practicalInfo, id: \.self) { item in
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text(item.label)
                            .font(AppFont.cardTitle)
                            .foregroundStyle(AppColor.textPrimary)
                        Text(item.value)
                            .font(AppFont.body)
                            .foregroundStyle(contrast.textSecondary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func infoSummary(_ poi: GuidePOI) -> String {
        let lang = env.settings.uiLanguage
        var parts: [String] = []
        if let duration = poi.totalDurationS {
            parts.append(L10n.string("info.durationSpoken", lang: lang)
                .replacingOccurrences(of: "%@", with: L10n.spokenDuration(seconds: duration, locale: locale)))
        }
        var features: [String] = []
        if poi.primaryVariant?.hasAudio == true { features.append(L10n.string("info.audio", lang: lang)) }
        if poi.hasCaptions { features.append(L10n.string("info.captions", lang: lang)) }
        if poi.hasAudioDescription { features.append(L10n.string("info.audioDescription", lang: lang)) }
        if !features.isEmpty {
            parts.append(L10n.string("info.hasFeatures", lang: lang)
                .replacingOccurrences(of: "%@", with: features.joined(separator: ", ")))
        }
        return parts.joined(separator: ". ")
    }

    private func shareText(_ poi: GuidePOI) -> String {
        [poi.title, poi.subtitle, poi.locationLabel].compactMap { $0 }.joined(separator: " – ")
    }
}

/// Kapittelrad under «Opplevelse»: tittel, varighet og lesbar transkripsjon
/// (5.16: full tekst også på detaljsiden).
struct ChapterRow: View {
    let chapter: GuideChapter
    let locale: Locale

    @Environment(\.contrastColors) private var contrast
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            Button {
                expanded.toggle()
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(chapter.title ?? "")
                            .font(AppFont.cardTitle)
                            .foregroundStyle(AppColor.textPrimary)
                        Text(L10n.shortDuration(seconds: chapter.playbackDurationS, locale: locale))
                            .font(AppFont.meta)
                            .foregroundStyle(contrast.textTertiary)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(contrast.textSecondary)
                }
                .frame(minHeight: AppSpacing.minTapTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(Text(expanded ? "chapter.collapseHint" : "chapter.expandHint"))
            if expanded {
                Text(chapter.scriptText)
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
            }
        }
        .padding(AppSpacing.l)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
    }
}

/// Segmentfaner (5.11): egne knapper med isSelected, understrek i accentMuted,
/// matchedGeometryEffect (av ved «Reduser bevegelse»), annonsering ved bytte.
struct SegmentTabs: View {
    @Binding var selection: POIDetailView.DetailTab
    let reduceMotion: Bool

    @Namespace private var underline
    @Environment(\.contrastColors) private var contrast
    @Environment(\.locale) private var locale

    var body: some View {
        HStack(spacing: 0) {
            ForEach(POIDetailView.DetailTab.allCases) { tab in
                Button {
                    if reduceMotion {
                        selection = tab
                    } else {
                        withAnimation(.snappy) { selection = tab }
                    }
                    AccessibilityNotification.Announcement(
                        L10n.string(announcementKey(tab), lang: locale.identifier)
                    ).post()
                } label: {
                    VStack(spacing: AppSpacing.s) {
                        Text(tab.titleKey)
                            .font(AppFont.chip)
                            .foregroundStyle(selection == tab ? AppColor.accentMuted : contrast.textSecondary)
                            .multilineTextAlignment(.center)
                        ZStack {
                            Rectangle().fill(Color.clear).frame(height: 2)
                            if selection == tab {
                                Rectangle()
                                    .fill(AppColor.accentMuted)
                                    .frame(height: 2)
                                    .matchedGeometryEffect(id: "underline", in: underline)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == tab ? [.isButton, .isSelected] : .isButton)
            }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(contrast.border).frame(height: 0.5) }
    }

    private func announcementKey(_ tab: POIDetailView.DetailTab) -> String {
        switch tab {
        case .about: return "detail.tab.about"
        case .experience: return "detail.tab.experience"
        case .practical: return "detail.tab.practical"
        }
    }
}
