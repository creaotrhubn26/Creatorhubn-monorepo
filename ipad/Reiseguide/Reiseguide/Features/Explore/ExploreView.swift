// ExploreView.swift
//
// Forside (UI-spesifikasjon 6.1): bakgrunnsbilde med scrim, språkvelger,
// hero-tittel på valgt språk, ingress, søk, «Bruk posisjonen min» og
// destinasjonsfliser for de tre demo-severdighetene. Områdeknappen (AreaPill)
// ved språkvelgeren viser valgt område og åpner områdevelgeren.

import SwiftUI

struct ExploreView: View {
    @Binding var path: NavigationPath
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.contrastColors) private var contrast

    @State private var searchText = ""
    @State private var showLanguageSheet = false
    @State private var showAreaSheet = false

    /// De tre flisene i Oslo: Akershus festning, Kvadraturen (Christiania torv), Operaen.
    private static let featuredSlugs = ["akershus-festning", "christiania-torv", "operaen"]

    /// Oslo-flisene når de finnes, ellers de tre første stedene i ruta (andre områder).
    private var featured: [GuidePOI] {
        let oslo = Self.featuredSlugs.compactMap { slug in env.store.pois.first { $0.slug == slug } }
        return oslo.isEmpty ? Array(TourProgress.orderedRoute(env.store.pois).prefix(3)) : oslo
    }

    private var heroPoi: GuidePOI? {
        env.store.pois.first { $0.slug == "akershus-festning" }
            ?? TourProgress.orderedRoute(env.store.pois).first { $0.heroImageUrl != nil }
    }

    /// Navnet på området som vises, også mens det nye området lastes.
    private var areaName: String? {
        env.store.area?.name ?? env.store.areas.first { $0.slug == env.store.slug }?.name
    }

    /// Områdeknapp og språkvelger side om side, under hverandre ved store tekststørrelser.
    private var pillLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: AppSpacing.s))
            : AnyLayout(HStackLayout(alignment: .top, spacing: AppSpacing.s))
    }

    /// Turprogresjon (pakke 1, punkt 3): stedene i området og fullførte besøk i loggen.
    private var tourProgress: TourProgress {
        TourProgress.compute(pois: env.store.pois, completedPoiIds: env.visits.completedPoiIds)
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                ZStack(alignment: .top) {
                    RemoteImage(url: heroPoi?.heroImageUrl)
                        .frame(height: proxy.size.height * 0.62)
                        .frame(maxWidth: .infinity)
                        .clipped()
                        .overlay(ScrimOverlay())
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 0) {
                        pillLayout {
                            AreaPill(areaName: areaName) { showAreaSheet = true }
                            if !dynamicTypeSize.isAccessibilitySize {
                                Spacer(minLength: 0)
                            }
                            LanguagePill(languageName: L10n.languageName(env.settings.guideLanguage)) {
                                showLanguageSheet = true
                            }
                        }
                        // ScrollView-en ligger under statuslinjen, så knappene
                        // må flyttes ned forbi den (som i stedsdetaljen).
                        .padding(.top, proxy.safeAreaInsets.top + AppSpacing.s)

                        Spacer(minLength: proxy.size.height * 0.30)

                        Text("explore.heroTitle")
                            .font(AppFont.heroTitle)
                            .foregroundStyle(AppColor.textPrimary)
                            .lineSpacing(-2)
                            .asHeader()
                        Text("explore.lead")
                            .font(AppFont.body)
                            .foregroundStyle(contrast.textSecondary)
                            .padding(.top, AppSpacing.l)

                        if tourProgress.total > 0 {
                            TourProgressRing(progress: tourProgress, locale: env.settings.locale)
                                .padding(.top, AppSpacing.m)
                        }

                        SearchField(placeholder: "explore.searchPlaceholder", text: $searchText) {
                            path.append(Route.map)
                        }
                        .padding(.top, AppSpacing.xl)

                        PrimaryButton(title: "explore.useMyLocation", systemImage: "location.fill") {
                            env.location.requestAndStart()
                            path.append(Route.map)
                        }
                        .padding(.top, AppSpacing.m)

                        Text("explore.orExplore")
                            .font(AppFont.subtitle)
                            .foregroundStyle(contrast.textTertiary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, AppSpacing.xl)

                        tiles
                            .padding(.top, AppSpacing.m)
                            .padding(.bottom, AppSpacing.xl)
                    }
                    .padding(.horizontal, AppSpacing.screenMargin)
                }
            }
            .background(AppColor.bgBase)
            .ignoresSafeArea(edges: .top)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showLanguageSheet) {
            LanguageSheet()
        }
        .sheet(isPresented: $showAreaSheet) {
            NavigationStack {
                AreaPickerView(showsCloseButton: true)
            }
            .presentationDetents([.medium, .large])
        }
    }

    @ViewBuilder
    private var tiles: some View {
        if env.store.pois.isEmpty {
            switch env.store.state {
            case let .failed(message):
                ErrorStripe(message: message)
            default:
                HStack(spacing: AppSpacing.s) {
                    ForEach(0 ..< 3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous)
                            .fill(AppColor.bgSurface)
                            .frame(width: 104, height: 104)
                    }
                }
                .redacted(reason: .placeholder)
                .accessibilityLabel(Text("state.loading"))
            }
        } else if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: AppSpacing.s) {
                ForEach(featured) { poi in
                    DestinationTile(poi: poi) { path.append(Route.poi(poi.id)) }
                }
            }
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.s) {
                    ForEach(featured) { poi in
                        DestinationTile(poi: poi) { path.append(Route.poi(poi.id)) }
                    }
                }
            }
            .padding(.horizontal, -AppSpacing.screenMargin)
            .contentMargins(.horizontal, AppSpacing.screenMargin, for: .scrollContent)
        }
    }
}

/// Feilmelding i bgSurface med error-ikon (6.1 og 6.2).
struct ErrorStripe: View {
    let message: String
    var actionTitle: LocalizedStringKey?
    var action: (() -> Void)?

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(AppColor.error)
            Text(message)
                .font(AppFont.subtitle)
                .foregroundStyle(AppColor.textPrimary)
            Spacer(minLength: 0)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(AppFont.chip)
                    .foregroundStyle(AppColor.accent)
                    .minTapTarget()
            }
        }
        .padding(AppSpacing.m)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
    }
}

/// Språkliste som sheet med checkmark, ikke Menu, så VoiceOver får full liste (5.1).
struct LanguageSheet: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss

    /// Språk med innhold i området (fra backend), ellers appens UI-språk.
    private var languages: [String] {
        let fromArea = env.store.area?.languages ?? []
        let merged = Array(Set(fromArea + AppSettings.uiLanguages))
        return merged.sorted { L10n.languageName($0) < L10n.languageName($1) }
    }

    var body: some View {
        NavigationStack {
            List(languages, id: \.self) { code in
                Button {
                    env.settings.guideLanguage = code
                    dismiss()
                } label: {
                    HStack {
                        Text(L10n.languageName(code))
                            .foregroundStyle(AppColor.textPrimary)
                        Spacer()
                        if code == env.settings.guideLanguage {
                            Image(systemName: "checkmark").foregroundStyle(AppColor.accent)
                        }
                    }
                    .frame(minHeight: AppSpacing.minTapTarget)
                }
                .accessibilityAddTraits(code == env.settings.guideLanguage ? .isSelected : [])
                .listRowBackground(AppColor.bgSurface)
            }
            .scrollContentBackground(.hidden)
            .background(AppColor.bgBase)
            .navigationTitle("language.label")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}
