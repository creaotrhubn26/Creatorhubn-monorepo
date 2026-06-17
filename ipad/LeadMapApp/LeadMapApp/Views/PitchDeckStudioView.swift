// PitchDeckStudioView.swift
//
// Hovedflaten i Pitch Deck-modulen. Vertikal liste m/ slide-thumbnails;
// tap åpner editor som lar deg redigere title_md/body_md eller
// regenerere én slide via Claude m/ valgfri justeringsinstruks.
//
// RBAC:
//   - pitch_deck.access: kreves for å nå denne viewen
//   - pitch_deck.edit:   skjuler editor-knapper hvis fraværende
//   - pitch_deck.export: skjuler "Eksportér PDF"-knapp hvis fraværende
//
// Habit-anker: en topp-banner som forteller "sist brukt for X dager
// siden" eller "ikke brukt enda" — pisker brukeren til å bruke decket
// faktisk. Pluss en stor "Start presentasjon"-CTA som er det mest
// vanlige neste-skritt.

import SwiftUI

struct PitchDeckStudioView: View {
    let organizationId: String
    let permissions: Set<String>

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var bundle: PitchDeckBundle?
    @State private var isLoading = false
    @State private var error: String?
    @State private var showOnboarding = false
    @State private var editingSlide: PitchSlide?
    @State private var startedPresentation: PitchPresentation?
    @State private var exportInProgress = false
    @State private var exportResult: PitchExport?
    // Slett/angre/papirkurv
    @State private var pendingUndo: UndoSnapshot?
    @State private var trashShown = false
    @State private var trashSlides: [PitchSlide] = []

    private struct UndoSnapshot: Equatable {
        let slide: PitchSlide
        let expiresAt: Date
    }

    private var canEdit: Bool { permissions.contains("pitch_deck.edit") }
    private var canExport: Bool { permissions.contains("pitch_deck.export") }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(bundle?.deck.name ?? "Pitch Deck Studio")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
                .task { await load() }
                .refreshable { await load() }
                .sheet(isPresented: $showOnboarding) {
                    PitchDeckOnboardingView(organizationId: organizationId) { newBundle in
                        bundle = newBundle
                    }
                }
                .sheet(item: $editingSlide) { slide in
                    PitchSlideEditorSheet(
                        slide: slide,
                        canEdit: canEdit,
                        onUpdate: { updated in
                            applyLocalSlide(updated)
                        }
                    )
                }
                .fullScreenCover(item: $startedPresentation) { pres in
                    if let bundle {
                        PitchDeckPresentView(
                            bundle: bundle,
                            presentation: pres
                        )
                    }
                }
                .sheet(item: $exportResult) { result in
                    PitchExportShareSheet(export: result)
                }
                .sheet(isPresented: $trashShown) {
                    PitchTrashSheet(
                        slides: trashSlides,
                        onRestore: { slide in
                            Task { await restoreSlide(slide) }
                        }
                    )
                }
                .overlay(alignment: .bottom) {
                    if let snap = pendingUndo {
                        undoSnackbar(snap: snap)
                    }
                }
        }
    }

    @ViewBuilder
    private func undoSnackbar(snap: UndoSnapshot) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "trash")
                .foregroundStyle(.white.opacity(0.8))
            Text("Slide slettet")
                .foregroundStyle(.white)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Button("Angre") {
                Task { await restoreSlide(snap.slide); pendingUndo = nil }
            }
            .foregroundStyle(.yellow)
            .font(.subheadline.weight(.bold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.black.opacity(0.88),
                    in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .task {
            // Auto-dismiss etter 5 sek
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if pendingUndo == snap { pendingUndo = nil }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if let bundle {
            slideList(bundle: bundle)
        } else if isLoading {
            ProgressView().padding()
        } else {
            emptyState
        }
    }

    private var emptyState: some View {
        VStack(spacing: 24) {
            Image(systemName: "doc.append")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("Ingen pitch deck ennå")
                .font(.title2.weight(.semibold))
            Text("Lag organisasjonens master-pitch. Claude bygger ni slides fra det dere selger. Tar 5 minutter — og kan endres senere.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 48)
            if canEdit {
                Button {
                    showOnboarding = true
                } label: {
                    Label("Start oppsett", systemImage: "arrow.right.circle.fill")
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            } else {
                Text("Ikke tillatt å lage deck — be en med salgssjef-tilgang om å starte oppsettet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 48)
            }
        }
    }

    private func slideList(bundle: PitchDeckBundle) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                habitBanner(bundle.deck)

                if canExport && bundle.deck.status == "ready" {
                    Button {
                        Task { await exportDeck() }
                    } label: {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Eksportér PDF og del med kunde")
                            Spacer()
                            if exportInProgress { ProgressView() }
                        }
                        .padding()
                        .background(Color.secondary.opacity(0.08),
                                    in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .disabled(exportInProgress)
                }

                ForEach(Array(bundle.slides.enumerated()), id: \.element.id) { idx, slide in
                    slideRow(idx: idx, slide: slide, total: bundle.slides.count)
                }
            }
            .padding()
        }
    }

    // MARK: - Habit-banner

    private func habitBanner(_ deck: PitchDeck) -> some View {
        let dotColor: Color = deck.lastUsedAt == nil ? .orange : .green
        let message: String = {
            if deck.lastUsedAt == nil {
                return "Ikke brukt enda. Start en presentasjon — selv mot deg selv — for å lære slidene."
            }
            return "Sist brukt \(deck.lastUsedAt ?? "")."
        }()
        return HStack(spacing: 12) {
            Circle().fill(dotColor).frame(width: 8, height: 8)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                Task { await startPresentation(leadId: nil) }
            } label: {
                Label("Start presentasjon", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Slide-rad

    private func slideRow(idx: Int, slide: PitchSlide, total: Int) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 4) {
                Image(systemName: slide.iconName)
                    .font(.title3)
                    .foregroundStyle(.tint)
                Text("\(idx + 1)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .frame(width: 44)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(slide.slideType.uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                    if slide.isLocked {
                        Image(systemName: "lock.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if !slide.isIncluded {
                        Text("SKJULT")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.15),
                                        in: Capsule())
                    }
                    Spacer()
                    if canEdit {
                        Menu {
                            Button {
                                editingSlide = slide
                            } label: {
                                Label("Rediger", systemImage: "pencil")
                            }
                            Button {
                                Task { await regenerate(slide: slide) }
                            } label: {
                                Label("Regenerér", systemImage: "arrow.clockwise.circle")
                            }
                            Button {
                                Task { await toggleInclusion(slide: slide) }
                            } label: {
                                Label(
                                    slide.isIncluded ? "Skjul fra presentasjon" : "Vis igjen",
                                    systemImage: slide.isIncluded ? "eye.slash" : "eye"
                                )
                            }
                            Button {
                                Task { await toggleLock(slide: slide) }
                            } label: {
                                Label(
                                    slide.isLocked ? "Lås opp" : "Lås mot regen",
                                    systemImage: slide.isLocked ? "lock.open" : "lock"
                                )
                            }
                            Divider()
                            Button(role: .destructive) {
                                Task { await deleteSlide(slide) }
                            } label: {
                                Label("Slett", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Text(slide.titleMd.isEmpty ? "(uten tittel)" : slide.titleMd)
                    .font(.title3.weight(.semibold))
                    .lineLimit(2)
                Text(slide.bodyMd)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.secondary.opacity(0.05),
                        in: RoundedRectangle(cornerRadius: 14))
        }
        .accessibilityElement(children: .combine)
        .opacity(slide.isIncluded ? 1.0 : 0.55)
        .onTapGesture {
            if canEdit { editingSlide = slide }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Lukk") { dismiss() }
        }
        if canEdit, let bundle, bundle.deck.status == "ready" {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    Task { await openTrash() }
                } label: {
                    Image(systemName: "trash")
                }
                .accessibilityLabel("Slettede slides")
            }
        }
        if let bundle, bundle.deck.status == "ready" {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await startPresentation(leadId: nil) }
                } label: {
                    Label("Presenter", systemImage: "play.fill")
                }
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let api = appState.api else {
            error = "Mangler API-klient"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let list = try await api.listPitchDecks(orgId: organizationId)
            if let first = list.decks.first {
                self.bundle = try await api.loadPitchDeck(deckId: first.id)
            } else {
                self.bundle = nil
            }
        } catch {
            self.error = String(describing: error)
        }
    }

    private func startPresentation(leadId: String?) async {
        guard let api = appState.api, let bundle else { return }
        do {
            let resp = try await api.startPitchPresentation(
                deckId: bundle.deck.id, leadId: leadId
            )
            startedPresentation = resp.presentation
        } catch {
            self.error = String(describing: error)
        }
    }

    private func regenerate(slide: PitchSlide) async {
        guard let api = appState.api else { return }
        do {
            let resp = try await api.regeneratePitchSlide(
                slideId: slide.id, instructions: nil
            )
            applyLocalSlide(resp.slide)
        } catch {
            self.error = String(describing: error)
        }
    }

    private func toggleLock(slide: PitchSlide) async {
        guard let api = appState.api else { return }
        do {
            try await api.lockPitchSlide(slideId: slide.id, locked: !slide.isLocked)
            await load()
        } catch {
            self.error = String(describing: error)
        }
    }

    private func toggleInclusion(slide: PitchSlide) async {
        guard let api = appState.api else { return }
        do {
            let resp = try await api.setPitchSlideInclusion(
                slideId: slide.id, included: !slide.isIncluded
            )
            applyLocalSlide(resp.slide)
        } catch {
            self.error = String(describing: error)
        }
    }

    private func deleteSlide(_ slide: PitchSlide) async {
        guard let api = appState.api else { return }
        do {
            try await api.softDeletePitchSlide(slideId: slide.id)
            // Fjern lokalt + vis angre-snackbar
            if var b = bundle {
                b = PitchDeckBundle(
                    deck: b.deck,
                    slides: b.slides.filter { $0.id != slide.id }
                )
                bundle = b
            }
            withAnimation {
                pendingUndo = UndoSnapshot(
                    slide: slide,
                    expiresAt: Date().addingTimeInterval(5)
                )
            }
        } catch {
            self.error = String(describing: error)
        }
    }

    private func restoreSlide(_ slide: PitchSlide) async {
        guard let api = appState.api else { return }
        do {
            let resp = try await api.restorePitchSlide(slideId: slide.id)
            // Sett slide tilbake i listen på rett position
            if var b = bundle {
                var newSlides = b.slides
                newSlides.append(resp.slide)
                newSlides.sort { $0.position < $1.position }
                b = PitchDeckBundle(deck: b.deck, slides: newSlides)
                bundle = b
            }
            // Fjern fra papirkurv-cachen hvis åpen
            trashSlides.removeAll { $0.id == slide.id }
        } catch {
            self.error = String(describing: error)
        }
    }

    private func openTrash() async {
        guard let api = appState.api, let deckId = bundle?.deck.id else { return }
        do {
            let resp = try await api.fetchPitchTrash(deckId: deckId)
            trashSlides = resp.slides
            trashShown = true
        } catch {
            self.error = String(describing: error)
        }
    }

    private func applyLocalSlide(_ updated: PitchSlide) {
        guard var b = bundle else { return }
        if let idx = b.slides.firstIndex(where: { $0.id == updated.id }) {
            var newSlides = b.slides
            newSlides[idx] = updated
            b = PitchDeckBundle(deck: b.deck, slides: newSlides)
            bundle = b
        }
    }

    private func exportDeck() async {
        guard let api = appState.api, let bundle else { return }
        exportInProgress = true
        defer { exportInProgress = false }
        do {
            let resp = try await api.exportPitchDeck(
                deckId: bundle.deck.id, leadId: nil
            )
            exportResult = resp.export
        } catch {
            self.error = String(describing: error)
        }
    }
}

// MARK: - Slide-editor

private struct PitchSlideEditorSheet: View {
    let slide: PitchSlide
    let canEdit: Bool
    let onUpdate: (PitchSlide) -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var titleMd: String
    @State private var bodyMd: String
    @State private var isSaving = false
    @State private var error: String?

    init(slide: PitchSlide, canEdit: Bool, onUpdate: @escaping (PitchSlide) -> Void) {
        self.slide = slide
        self.canEdit = canEdit
        self.onUpdate = onUpdate
        _titleMd = State(initialValue: slide.titleMd)
        _bodyMd = State(initialValue: slide.bodyMd)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Tittel") {
                    TextField("Tittel", text: $titleMd, axis: .vertical)
                        .lineLimit(2...4)
                        .disabled(!canEdit)
                }
                Section("Brødtekst") {
                    TextField("Brødtekst", text: $bodyMd, axis: .vertical)
                        .lineLimit(5...20)
                        .disabled(!canEdit)
                }
                Section {
                    Label("Slide-type: \(slide.slideType)", systemImage: slide.iconName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Slide \(slide.position / 10)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                if canEdit {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lagre") {
                            Task { await save() }
                        }
                        .disabled(isSaving || !hasChanges)
                    }
                }
            }
            .alert("Lagring feilet", isPresented: errorBinding) {
                Button("OK") { error = nil }
            } message: { Text(error ?? "") }
        }
    }

    private var hasChanges: Bool {
        titleMd != slide.titleMd || bodyMd != slide.bodyMd
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    private func save() async {
        guard let api = appState.api else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let resp = try await api.updatePitchSlide(
                slideId: slide.id,
                titleMd: titleMd != slide.titleMd ? titleMd : nil,
                bodyMd: bodyMd != slide.bodyMd ? bodyMd : nil
            )
            onUpdate(resp.slide)
            dismiss()
        } catch {
            self.error = String(describing: error)
        }
    }
}

// MARK: - Export share sheet

private struct PitchExportShareSheet: View {
    let export: PitchExport
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                Text("PDF klar")
                    .font(.title2.weight(.semibold))
                Text("Send lenken til kunden. Du får varsel første gang den åpnes.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 32)
                ShareLink(item: URL(string: export.shareUrl) ?? URL(string: "https://example.com")!) {
                    Label("Del lenke", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 24)
                Spacer()
            }
            .padding(.top, 32)
            .navigationTitle("Eksport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
    }
}

// PitchExport må være Identifiable for sheet(item:)
extension PitchExport: Identifiable {
    public var id: String { viewToken }
}

// MARK: - Slettede slides (papirkurv)

private struct PitchTrashSheet: View {
    let slides: [PitchSlide]
    let onRestore: (PitchSlide) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if slides.isEmpty {
                    ContentUnavailableView(
                        "Ingen slettede slides",
                        systemImage: "trash",
                        description: Text("Slettede slides vises her i 30 dager før de purges permanent.")
                    )
                } else {
                    List(slides, id: \.id) { slide in
                        HStack(spacing: 12) {
                            Image(systemName: slide.iconName)
                                .foregroundStyle(.secondary)
                                .frame(width: 32)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(slide.slideType.uppercased())
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.secondary)
                                Text(slide.titleMd.isEmpty ? "(uten tittel)" : slide.titleMd)
                                    .font(.subheadline.weight(.semibold))
                                    .lineLimit(2)
                            }
                            Spacer()
                            Button("Gjenopprett") {
                                onRestore(slide)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Slettede slides")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }
}
