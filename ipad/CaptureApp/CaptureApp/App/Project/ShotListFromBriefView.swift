// ShotListFromBriefView.swift
//
// #9 Shot-list/call-sheet fra klient-brief eller bryllups-timeline. Lim inn /
// hent → Foundation Models (on-device, norsk) genererer en konkret shot-list
// → rediger/slett/legg til → lagre (erstatt eller legg til). Mater auto-huk.
//
// Design: CreatorHub-mørk (CHTheme) med hero, stylet brief-editor, nummererte
// shot-kort og prominente CTA-er.

import SwiftUI

struct ShotListFromBriefView: View {
    /// Lagre de (redigerte) scenene til prosjektet. Kaster ved feil.
    let onSave: ([String]) async throws -> Void
    /// Hent en brief fra prosjektets bryllups-timeline (dagsplan). nil hvis
    /// ingen timeline. Utelates → knappen vises ikke.
    var fetchTimeline: (() async -> String?)? = nil
    /// Etikett på lagre-knappen — «Legg til i shot-listen» ved append.
    var saveLabel: String = "Lagre til prosjektet"
    /// Bygg en DESIGNET call-sheet-URL (Infographic-motor) fra de gitte
    /// scenene. Utelates → «Se call-sheet»-knappen vises ikke.
    var callSheetURL: (([String]) -> URL?)? = nil
    /// Demo-hekter (--demo-brief): forhåndsutfyll briefen + auto-generer.
    var initialBrief: String = ""
    var autoGenerate: Bool = false

    @Environment(\.dismiss) private var dismiss
    @FocusState private var briefFocused: Bool
    @State private var brief = ""
    @State private var scenes: [String] = []
    @State private var generating = false
    @State private var loadingTimeline = false
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var unavailableMessage: String?
    @State private var showCallSheet = false
    @State private var callSheetImageURL: URL?

    var body: some View {
        NavigationStack {
            ZStack {
                CHTheme.bg.ignoresSafeArea()
                if scenes.isEmpty { inputState } else { resultState }
            }
            .navigationTitle("Shot-list fra brief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(CHTheme.accent)
        .task {
            if brief.isEmpty { brief = initialBrief }
            if autoGenerate && scenes.isEmpty && !brief.isEmpty { await generate() }
        }
    }

    // MARK: - Brief-input

    private var inputState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                if let fetchTimeline { timelineButton(fetchTimeline) }
                briefEditor
                if let unavailableMessage { note(unavailableMessage, color: CHTheme.textSecondary, icon: "info.circle") }
                if let errorMessage { note(errorMessage, color: CHTheme.danger, icon: "exclamationmark.triangle.fill") }
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom) { generateBar }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [CHTheme.success, CHTheme.success.opacity(0.7)],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: "sparkles").font(.title3.weight(.semibold)).foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text("Fra brief til shot-list")
                    .font(.headline).foregroundStyle(CHTheme.textPrimary)
                Text("Apple Intelligence lager en konkret shot-list på enheten — briefen forlater aldri iPad-en.")
                    .font(.caption).foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    private func timelineButton(_ fetch: @escaping () async -> String?) -> some View {
        Button {
            Task {
                loadingTimeline = true; errorMessage = nil
                if let b = await fetch(), !b.isEmpty { brief = b }
                else { errorMessage = "Fant ingen bryllups-timeline for dette prosjektet." }
                loadingTimeline = false
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "calendar.badge.clock")
                    .font(.body.weight(.semibold)).foregroundStyle(CHTheme.accent)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Hent fra bryllups-timeline").font(.subheadline.weight(.semibold))
                        .foregroundStyle(CHTheme.textPrimary)
                    Text("Fyller briefen fra dagsplanen (vielse, first look, middag …)")
                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
                Spacer(minLength: 0)
                if loadingTimeline { ProgressView() } else {
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
            }
            .padding(14)
            .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CHTheme.accent.opacity(0.25)))
        }
        .buttonStyle(.plain)
        .disabled(loadingTimeline)
    }

    private var briefEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("KLIENT-BRIEF").font(.caption2.weight(.bold)).foregroundStyle(CHTheme.textMuted)
            TextEditor(text: $brief)
                .focused($briefFocused)
                .scrollContentBackground(.hidden)
                .font(.body)
                .foregroundStyle(CHTheme.textPrimary)
                .padding(12)
                .frame(minHeight: 190)
                .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(briefFocused ? CHTheme.accent.opacity(0.6) : CHTheme.border))
                .overlay(alignment: .topLeading) {
                    if brief.isEmpty {
                        Text("Lim inn briefen — ønsker, stemning, must-haves, lokasjoner, antrekk …")
                            .font(.body).foregroundStyle(CHTheme.textMuted)
                            .padding(.top, 20).padding(.leading, 17).allowsHitTesting(false)
                    }
                }
        }
    }

    private var generateBar: some View {
        VStack(spacing: 6) {
            Button {
                briefFocused = false
                Task { await generate() }
            } label: {
                HStack(spacing: 8) {
                    if generating { ProgressView().tint(.white) }
                    Image(systemName: "sparkles")
                    Text(generating ? "Genererer …" : "Generer shot-list")
                }
                .font(.body.weight(.bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(canGenerate ? CHTheme.accent : CHTheme.surfaceElevated,
                            in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .foregroundStyle(canGenerate ? Color.white : CHTheme.textMuted)
            }
            .buttonStyle(.plain)
            .disabled(!canGenerate)
        }
        .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    private var canGenerate: Bool {
        !generating && brief.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10
    }

    // MARK: - Resultat

    private var resultState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(scenes.count) shots")
                            .font(.title3.weight(.bold)).foregroundStyle(CHTheme.textPrimary)
                        Text("Rediger, slett eller legg til før du lagrer")
                            .font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                    Spacer()
                    Button("Start på nytt") { withAnimation { scenes = [] } }
                        .font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.accent)
                }
                if callSheetURL != nil { callSheetButton }
                shotsCard
                if let errorMessage { note(errorMessage, color: CHTheme.danger, icon: "exclamationmark.triangle.fill") }
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom) { saveBar }
        .fullScreenCover(isPresented: $showCallSheet) { callSheetViewer }
    }

    /// Sekundær CTA: rendre shot-listen som en designet call-sheet (Infographic-
    /// motoren, orange→lilla på-brand) — kan deles/lastes ned.
    private var callSheetButton: some View {
        Button {
            let cleaned = scenes.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            callSheetImageURL = callSheetURL?(cleaned)
            showCallSheet = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "doc.richtext")
                Text("Se designet call-sheet")
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.caption)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CHTheme.textPrimary)
            .padding(.vertical, 12).padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(LinearGradient(colors: [Color(hex: 0xFF8C5D).opacity(0.22), Color(hex: 0xA855F7).opacity(0.22)],
                                         startPoint: .leading, endPoint: .trailing)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color(hex: 0xA855F7).opacity(0.4)))
        }
        .buttonStyle(.plain)
    }

    private var callSheetViewer: some View {
        NavigationStack {
            ZStack {
                CHTheme.bgDeep.ignoresSafeArea()
                if let url = callSheetImageURL {
                    ScrollView {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFit()
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            } else if phase.error != nil {
                                ContentUnavailableView("Kunne ikke rendre", systemImage: "photo.badge.exclamationmark")
                            } else {
                                VStack(spacing: 12) {
                                    ProgressView().tint(.white)
                                    Text("Designer call-sheet …").font(.caption).foregroundStyle(CHTheme.textMuted)
                                }.padding(.top, 80)
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Call-sheet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let url = callSheetImageURL {
                        ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { showCallSheet = false }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var shotsCard: some View {
        VStack(spacing: 0) {
            ForEach(scenes.indices, id: \.self) { i in
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(CHTheme.accent.opacity(0.15))
                        Text("\(i + 1)").font(.caption.weight(.bold).monospacedDigit())
                            .foregroundStyle(CHTheme.accent)
                    }
                    .frame(width: 26, height: 26)
                    TextField("Scene", text: $scenes[i], axis: .vertical)
                        .font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                    Button {
                        withAnimation { scenes.remove(atOffsets: IndexSet(integer: i)) }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .foregroundStyle(CHTheme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 11).padding(.horizontal, 14)
                if i < scenes.count - 1 {
                    Divider().overlay(CHTheme.border).padding(.leading, 52)
                }
            }
            Divider().overlay(CHTheme.border).padding(.leading, 52)
            Button {
                withAnimation { scenes.append("") }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "plus.circle.fill").foregroundStyle(CHTheme.success)
                    Text("Legg til shot").font(.subheadline.weight(.medium)).foregroundStyle(CHTheme.textSecondary)
                    Spacer()
                }
                .padding(.vertical, 12).padding(.horizontal, 14)
            }
            .buttonStyle(.plain)
        }
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(CHTheme.surfaceElevated))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(CHTheme.border))
    }

    private var saveBar: some View {
        Button {
            Task { await save() }
        } label: {
            HStack(spacing: 8) {
                if saving { ProgressView().tint(.white) }
                Image(systemName: "checklist")
                Text(saveLabel)
            }
            .font(.body.weight(.bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(canSave ? CHTheme.accent : CHTheme.surfaceElevated,
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(canSave ? Color.white : CHTheme.textMuted)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    private var canSave: Bool {
        !saving && scenes.contains { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func note(_ text: String, color: Color, icon: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon).font(.caption).foregroundStyle(color)
            Text(text).font(.caption).foregroundStyle(color)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(color.opacity(0.10)))
    }

    // MARK: - Handlinger

    @MainActor
    private func generate() async {
        generating = true; defer { generating = false }
        errorMessage = nil; unavailableMessage = nil
        let gen = TextGenerationIntelligenceFactory.make()
        guard gen.isAvailable else {
            unavailableMessage = "Krever Apple Intelligence (iOS 26+, kompatibel enhet). "
                + "Du kan fortsatt legge til shots manuelt i shot-list-panelet."
            return
        }
        do {
            let raw = try await gen.generate(.shotListFromBrief(brief: brief))
            let parsed = ShotListBriefParser.scenes(from: raw)
            if parsed.isEmpty {
                errorMessage = "Fikk ingen shots ut av briefen — prøv en mer detaljert beskrivelse."
            } else {
                withAnimation { scenes = parsed }
            }
        } catch {
            errorMessage = "Kunne ikke generere shot-listen. Prøv igjen."
        }
    }

    @MainActor
    private func save() async {
        saving = true; defer { saving = false }
        errorMessage = nil
        let cleaned = scenes.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !cleaned.isEmpty else { return }
        do {
            try await onSave(cleaned)
            dismiss()
        } catch {
            errorMessage = "Kunne ikke lagre til prosjektet. Sjekk innlogging + nett."
        }
    }
}
