// PitchPreMeetingBriefView.swift
//
// Pre-møte-brief som vises FØR presentasjonen starter — fra lead-
// detail-kortet via "Presenter pitch"-knappen. Claude har lest
// pitch-decket + lead-konteksten (industri, størrelse, siste samtaler)
// og leverer:
//
//   1. ANBEFALTE SLIDES — typisk 5–7 av 11. Selger kan tappe på en
//      slide-rad for å forhåndsvise innholdet før møtet.
//   2. TALKING POINTS — én setning per anbefalt slide, tilpasset
//      denne leaden. Selger leser dette mens hen sveiper.
//   3. FORVENTEDE INNVENDINGER — 3 typiske spørsmål kunden kan stille
//      + et utkast til svar.
//
// Bevisst nøktern UX: ingen "AI-magic"-effekter. Brief vises som en
// helsides liste, selger kan trykke "Start presentasjon" (= bruker
// anbefalte slides) eller "Bruk full pitch" (= override brief'en).

import SwiftUI

struct PitchPreMeetingBriefView: View {
    let bundle: PitchDeckBundle
    let leadId: String
    let leadName: String

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var isLoading = true
    @State private var brief: PitchBrief?
    @State private var leadContext: PitchLeadContext?
    @State private var error: String?
    @State private var startedPresentation: PitchPresentation?
    @State private var useFullDeck = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Forbered møte")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
                .task { await load() }
                .fullScreenCover(item: $startedPresentation) { pres in
                    PitchDeckPresentView(
                        bundle: bundle,
                        presentation: pres,
                        preMeetingBrief: useFullDeck ? nil : brief,
                        orgName: ""  // org-navn kommer via AppState i seinere iterasjon
                    )
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            VStack(spacing: 16) {
                ProgressView().controlSize(.large)
                Text("Leser hva vi vet om \(leadName)…")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let brief = brief {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    contextHeader
                    recommendedSection(brief: brief)
                    talkingPointsSection(brief: brief)
                    objectionsSection(brief: brief)
                }
                .padding(20)
                .padding(.bottom, 80) // plass til bunn-CTA
            }
        } else {
            ContentUnavailableView(
                "Brief mislyktes",
                systemImage: "exclamationmark.triangle",
                description: Text(error ?? "Kunne ikke hente brief. Du kan presentere likevel.")
            )
        }
    }

    // MARK: - Context

    @ViewBuilder
    private var contextHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(leadName)
                .font(.title3.weight(.semibold))
            if let ctx = leadContext {
                HStack(spacing: 6) {
                    if let i = ctx.industry { tag(i) }
                    if let s = ctx.sizeHint { tag(s) }
                    if let c = ctx.city { tag(c) }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.secondary.opacity(0.12),
                        in: Capsule())
    }

    // MARK: - Anbefalte slides

    private func recommendedSection(brief: PitchBrief) -> some View {
        let allSlides = bundle.slides.filter { $0.isIncluded }
        let allowed = Set(brief.recommendedSlideIds)
        let recommended = allSlides.filter { allowed.contains($0.id) }
        return VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Anbefalte slides", count: recommended.count)
            ForEach(Array(recommended.enumerated()), id: \.element.id) { idx, slide in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: slide.iconName)
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .frame(width: 30)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(idx + 1). \(slide.slideType.uppercased())")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)
                        Text(slide.titleMd.isEmpty ? "(uten tittel)" : slide.titleMd)
                            .font(.subheadline.weight(.semibold))
                        if let tp = brief.talkingPoints[slide.id], !tp.isEmpty {
                            Text(tp)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.top, 2)
                        }
                    }
                    Spacer()
                }
                .padding(14)
                .background(Color.secondary.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func talkingPointsSection(brief: PitchBrief) -> some View {
        let hasPoints = !brief.talkingPoints.isEmpty
        return Group {
            if hasPoints {
                VStack(alignment: .leading, spacing: 12) {
                    sectionHeader("Talking points",
                                  count: brief.talkingPoints.count)
                    Text("Vises også inline på hver slide under presentasjon.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func objectionsSection(brief: PitchBrief) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Forventede innvendinger", count: brief.objections.count)
            if brief.objections.isEmpty {
                Text("Ingen spesifikke innvendinger forventes for denne leaden.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(brief.objections.enumerated()), id: \.offset) { _, obj in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "questionmark.circle")
                                .foregroundStyle(.orange)
                            Text(obj.q)
                                .font(.subheadline.weight(.semibold))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "checkmark.circle")
                                .foregroundStyle(.green)
                            Text(obj.a)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(14)
                    .background(Color.secondary.opacity(0.06),
                                in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .font(.headline)
            Spacer()
            Text("\(count)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Lukk") { dismiss() }
        }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button {
                    useFullDeck = false
                    Task { await startPresentation() }
                } label: {
                    Label("Anbefalt utvalg", systemImage: "list.bullet")
                }
                .disabled(brief?.recommendedSlideIds.isEmpty ?? true)
                Button {
                    useFullDeck = true
                    Task { await startPresentation() }
                } label: {
                    Label("Full pitch", systemImage: "rectangle.stack")
                }
            } label: {
                Label("Start", systemImage: "play.fill")
            }
            .disabled(isLoading)
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let api = appState.api else {
            error = "Mangler API-klient"
            isLoading = false
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let resp = try await api.fetchPitchBrief(
                deckId: bundle.deck.id, leadId: leadId
            )
            brief = resp.brief
            leadContext = resp.leadContext
        } catch {
            self.error = String(describing: error)
        }
    }

    private func startPresentation() async {
        guard let api = appState.api else { return }
        do {
            let resp = try await api.startPitchPresentation(
                deckId: bundle.deck.id, leadId: leadId
            )
            startedPresentation = resp.presentation
        } catch {
            self.error = String(describing: error)
        }
    }
}
