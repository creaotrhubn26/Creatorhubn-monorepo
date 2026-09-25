// AfterVisitView.swift
//
// «Etter besøket» (Daniel 18.09.2026): arket som åpnes når fortellingen er
// ferdig, når brukeren trykker «Avslutt besøket», eller fra loggen.
//   1. Stjernerangering (sendes anonymt til backend, lagres i loggen)
//   2. Kort quiz om stedet (QuizCardView; spørsmålene kommer fra backend)
//   3. Tips til liknende severdigheter i nærheten (samme kategori, kortest vei)
//   4. Anbefal/del: delingslenke med Open Graph fra backend
// Besøket er allerede logget med tid og dato av avspilleren (VisitLogStore).

import SwiftUI

struct AfterVisitView: View {
    let entryId: String
    let poi: GuidePOI
    /// Brukeren valgte et av tipsene; verten lukker arket og åpner stedet.
    let onOpenRelated: (GuidePOI) -> Void

    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contrastColors) private var contrast

    @State private var ratingState: RatingState = .idle
    @State private var ratingSummary: RatingSummary?

    enum RatingState: Equatable {
        case idle, sending, sent, failed
    }

    init(entryId: String, poi: GuidePOI, onOpenRelated: @escaping (GuidePOI) -> Void) {
        self.entryId = entryId
        self.poi = poi
        self.onOpenRelated = onOpenRelated
        _ratingSummary = State(initialValue: poi.rating)
    }

    private var entry: VisitEntry? { env.visits.entry(id: entryId) }
    private var locale: Locale { env.settings.locale }
    private var uiLang: String { env.settings.uiLanguage }

    private var related: [RelatedPlaces.Suggestion] {
        RelatedPlaces.suggest(for: poi, among: env.store.pois)
    }

    /// «Gå til neste stopp» (avspiller-redesignet, punkt 2): samme handling
    /// som avslutningskortet i spilleren, tilgjengelig herfra også (arket
    /// åpnes også direkte fra detaljsiden, uten at spilleren nødvendigvis
    /// har vært innom).
    private var nextStopPoi: GuidePOI? {
        env.nextStop(after: poi.id)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.xl) {
                    header
                    ratingCard
                    QuizCardView(questions: poi.quizQuestions) { correct, total in
                        env.visits.setQuizResult(entryId: entryId, correct: correct, total: total)
                    }
                    nextStopCard
                    relatedCard
                    shareCard
                }
                .padding(AppSpacing.screenMargin)
                .padding(.bottom, AppSpacing.xxl)
            }
            .background(AppColor.bgBase)
            .navigationTitle("afterVisit.title")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AppColor.bgBase, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("action.done") { dismiss() }
                        .foregroundStyle(AppColor.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Deler

    private var header: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(L10n.string("afterVisit.heading", lang: uiLang).replacingOccurrences(of: "%@", with: poi.title))
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            if let entry {
                Text(L10n.string("afterVisit.visitedOn", lang: uiLang)
                    .replacingOccurrences(of: "%@", with: Self.visitDate(entry.displayDate, locale: locale)))
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
            }
        }
    }

    private var ratingCard: some View {
        SectionCard(title: "rating.title") {
            StarRatingControl(stars: entry?.stars ?? 0, locale: locale) { stars in
                submitRating(stars)
            }
            ratingStatus
        }
    }

    @ViewBuilder
    private var ratingStatus: some View {
        switch ratingState {
        case .idle:
            if let summary = ratingSummary {
                Text(Self.summaryText(summary, uiLang: uiLang, locale: locale))
                    .font(.caption)
                    .foregroundStyle(contrast.textTertiary)
            }
        case .sending:
            Text("rating.sending")
                .font(.caption)
                .foregroundStyle(contrast.textTertiary)
        case .sent:
            Text("rating.sent")
                .font(AppFont.subtitle)
                .foregroundStyle(AppColor.textPrimary)
            if let summary = ratingSummary {
                Text(Self.summaryText(summary, uiLang: uiLang, locale: locale))
                    .font(.caption)
                    .foregroundStyle(contrast.textTertiary)
            }
        case .failed:
            Text("rating.failed")
                .font(.caption)
                .foregroundStyle(AppColor.error)
        }
    }

    @ViewBuilder
    private var nextStopCard: some View {
        if let nextStopPoi {
            SectionCard(title: "visit.nextStop.cardTitle") {
                SecondaryButton(title: "visit.nextStop", systemImage: "arrow.forward.circle") {
                    dismiss()
                    env.openVeiviser(to: nextStopPoi)
                }
                .accessibilityLabel(Text("\(L10n.string("visit.nextStop", lang: uiLang)), \(nextStopPoi.title)"))
                .accessibilityHint(Text("visit.nextStopHint"))
            }
        }
    }

    private var relatedCard: some View {
        SectionCard(title: "related.title") {
            if related.isEmpty {
                Text("related.none")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
            }
            ForEach(related) { suggestion in
                NearbyCard(
                    poi: suggestion.poi,
                    distanceM: suggestion.distanceM,
                    isLocked: env.isLocked(suggestion.poi),
                    locale: locale,
                    badge: suggestion.sameCategory ? L10n.string("related.sameCategory", lang: uiLang) : nil
                ) {
                    onOpenRelated(suggestion.poi)
                }
            }
        }
    }

    private var shareCard: some View {
        SectionCard(title: "share.recommend") {
            Text("share.lead")
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
            ShareLinkButton(url: poi.shareURL, fallbackText: poi.title, subject: poi.title, message: shareMessage) {
                HStack(spacing: AppSpacing.s) {
                    Image(systemName: "square.and.arrow.up")
                    Text("share.recommend")
                }
                .font(AppFont.button)
                .foregroundStyle(AppColor.onAccent)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(AppColor.accent, in: Capsule())
                .contentShape(Capsule())
            }
        }
    }

    private var shareMessage: String {
        L10n.string("share.message", lang: uiLang).replacingOccurrences(of: "%@", with: poi.title)
    }

    // MARK: - Handlinger

    private func submitRating(_ stars: Int) {
        env.visits.setStars(entryId: entryId, stars: stars)
        ratingState = .sending
        let api = env.api
        let deviceId = env.settings.deviceId
        let lang = env.settings.guideLanguage
        let slug = poi.slug
        Task {
            do {
                let response = try await api.submitRating(poiIdOrSlug: slug, deviceId: deviceId, stars: stars, lang: lang)
                ratingSummary = response.rating
                ratingState = .sent
            } catch {
                ratingState = .failed
            }
        }
    }

    // MARK: - Formatering

    /// «18. september 2026 kl. 11:20» etter locale.
    static func visitDate(_ date: Date, locale: Locale) -> String {
        date.formatted(Date.FormatStyle(date: .long, time: .shortened).locale(locale))
    }

    /// «4,5 av 5 (12 vurderinger)» via samme streng som VoiceOver bruker.
    static func summaryText(_ summary: RatingSummary, uiLang: String, locale: Locale) -> String {
        L10n.string("rating.spoken", lang: uiLang)
            .replacingOccurrences(of: "%1$@", with: summary.average.formatted(.number.precision(.fractionLength(1)).locale(locale)))
            .replacingOccurrences(of: "%2$@", with: summary.count.formatted(.number.locale(locale)))
    }
}

/// Kort med overskrift (VoiceOver-header) og innhold i bgSurface.
struct SectionCard<Content: View>: View {
    let title: LocalizedStringKey
    @ViewBuilder let content: Content

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            Text(title)
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            content
        }
        .padding(AppSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
    }
}
