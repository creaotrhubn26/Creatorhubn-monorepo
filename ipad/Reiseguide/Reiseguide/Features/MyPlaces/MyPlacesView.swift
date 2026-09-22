// MyPlacesView.swift
//
// «Mine steder»: favoritter (AppSettings.favoritePoiIds) og den personlige
// loggen over besøkte steder med tid og dato (VisitLogStore på telefonen,
// speilet til serveren bare når brukeren har slått det på i Personvern).
// Et loggoppslag åpner etter-besøket-arket på nytt (quiz, vurdering, tips).

import SwiftUI

struct MyPlacesView: View {
    enum Segment: Hashable {
        case favorites, log
    }

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @State private var segment: Segment = .favorites
    @State private var selectedPoiId: String?
    @State private var selectedVisit: VisitEntry?

    private var favorites: [GuidePOI] {
        env.store.pois.filter { env.settings.isFavorite(poiId: $0.id) }
    }

    private var locale: Locale { env.settings.locale }

    var body: some View {
        VStack(spacing: 0) {
            Picker("myPlaces.sections", selection: $segment) {
                Text("myPlaces.favorites").tag(Segment.favorites)
                Text("myPlaces.log").tag(Segment.log)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.vertical, AppSpacing.s)
            switch segment {
            case .favorites:
                favoritesList
            case .log:
                logList
            }
        }
        .background(AppColor.bgBase)
        .navigationTitle("tab.myPlaces")
        .toolbarBackground(AppColor.bgBase, for: .navigationBar)
        .navigationDestination(item: $selectedPoiId) { id in
            POIDetailStandalone(poiId: id)
        }
        .sheet(item: $selectedVisit) { entry in
            if let poi = env.store.poi(id: entry.poiId) {
                AfterVisitView(entryId: entry.id, poi: poi) { related in
                    selectedVisit = nil
                    selectedPoiId = related.id
                }
            } else {
                Text("detail.notFound")
                    .foregroundStyle(AppColor.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppColor.bgBase)
                    .presentationDetents([.medium])
            }
        }
    }

    private var favoritesList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if favorites.isEmpty {
                    EmptyState(systemImage: "heart", text: "myPlaces.empty")
                }
                ForEach(favorites) { poi in
                    NearbyCard(poi: poi, distanceM: nil, isLocked: env.isLocked(poi), locale: locale) {
                        selectedPoiId = poi.id
                    }
                }
            }
            .padding(AppSpacing.screenMargin)
        }
    }

    @ViewBuilder
    private var logList: some View {
        if env.visits.entries.isEmpty {
            ScrollView {
                EmptyState(systemImage: "clock.arrow.circlepath", text: "log.empty")
                    .padding(AppSpacing.screenMargin)
            }
        } else {
            List {
                Section {
                    ForEach(env.visits.entries) { entry in
                        Button {
                            selectedVisit = entry
                        } label: {
                            VisitRow(entry: entry, locale: locale, uiLang: env.settings.uiLanguage)
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint(Text("log.rowHint"))
                        .accessibilityAction(named: Text("log.delete")) {
                            env.visits.remove(entryId: entry.id)
                        }
                        .contextMenu {
                            Button(role: .destructive) {
                                env.visits.remove(entryId: entry.id)
                            } label: {
                                Label("log.delete", systemImage: "trash")
                            }
                        }
                        .listRowBackground(AppColor.bgSurface)
                        .listRowSeparatorTint(contrast.border)
                    }
                    .onDelete { offsets in
                        let ids = offsets.map { env.visits.entries[$0].id }
                        for id in ids {
                            env.visits.remove(entryId: id)
                        }
                    }
                } footer: {
                    Text(env.settings.syncVisitsToServer ? LocalizedStringKey("log.syncOn") : LocalizedStringKey("log.syncOff"))
                        .foregroundStyle(contrast.textSecondary)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(AppColor.bgBase)
            .accessibilityLabel(Text("myPlaces.log"))
            // Synlig slett-vei for dem som ikke sveiper (Switch Control, AssistiveTouch).
            .toolbar { EditButton() }
        }
    }
}

/// Én linje i loggen: tittel, dato og klokkeslett, stjerner og quiz-resultat.
struct VisitRow: View {
    let entry: VisitEntry
    let locale: Locale
    let uiLang: String

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: entry.isCompleted ? "checkmark.circle.fill" : "play.circle")
                .font(.title2)
                .foregroundStyle(entry.isCompleted ? AppColor.accent : contrast.textTertiary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(entry.title)
                    .font(AppFont.cardTitle)
                    .foregroundStyle(AppColor.textPrimary)
                Text(AfterVisitView.visitDate(entry.displayDate, locale: locale))
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
                HStack(spacing: AppSpacing.m) {
                    if let stars = entry.stars {
                        HStack(spacing: 2) {
                            ForEach(1 ... 5, id: \.self) { value in
                                Image(systemName: value <= stars ? "star.fill" : "star")
                                    .font(.caption)
                                    .foregroundStyle(value <= stars ? AppColor.rating : contrast.textTertiary)
                            }
                        }
                    }
                    if let correct = entry.quizCorrect, let total = entry.quizTotal {
                        Label(quizText(correct: correct, total: total), systemImage: "questionmark.circle")
                            .font(.caption)
                            .foregroundStyle(contrast.textSecondary)
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .foregroundStyle(contrast.textSecondary)
        }
        .padding(.vertical, AppSpacing.xs)
        .frame(minHeight: AppSpacing.minTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(spokenSummary))
        .accessibilityAddTraits(.isButton)
    }

    private func quizText(correct: Int, total: Int) -> String {
        L10n.string("log.quizScore", lang: uiLang)
            .replacingOccurrences(of: "%1$@", with: String(correct))
            .replacingOccurrences(of: "%2$@", with: String(total))
    }

    private var spokenSummary: String {
        var parts = [
            entry.title,
            L10n.string(entry.isCompleted ? "log.completed" : "log.started", lang: uiLang),
            AfterVisitView.visitDate(entry.displayDate, locale: locale)
        ]
        if let stars = entry.stars {
            parts.append(L10n.string("rating.star", lang: uiLang).replacingOccurrences(of: "%@", with: String(stars)))
        }
        if let correct = entry.quizCorrect, let total = entry.quizTotal {
            parts.append(quizText(correct: correct, total: total))
        }
        return parts.joined(separator: ", ")
    }
}

/// Tom tilstand med ikon og forklaring, sentrert.
struct EmptyState: View {
    let systemImage: String
    let text: LocalizedStringKey

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundStyle(contrast.textTertiary)
                .accessibilityHidden(true)
            Text(text)
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, AppSpacing.xxl)
    }
}

/// Detaljside åpnet utenfor Utforsk-stacken (fra Mine steder). Tom
/// NavigationPath: tilbake-knappen i POIDetailView faller da til dismiss.
struct POIDetailStandalone: View {
    let poiId: String
    @State private var path = NavigationPath()

    var body: some View {
        POIDetailView(poiId: poiId, path: $path)
    }
}
