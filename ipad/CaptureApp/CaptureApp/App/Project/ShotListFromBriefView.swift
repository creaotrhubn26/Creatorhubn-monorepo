// ShotListFromBriefView.swift
//
// #9 Shot-list/call-sheet fra klient-brief. Lim inn briefen → Foundation
// Models (on-device, norsk) genererer en konkret shot-list → rediger/slett →
// lagre til prosjektet. Listen mater auto-huk-funksjonen (samme shot_lists).

import SwiftUI

struct ShotListFromBriefView: View {
    /// Lagre de (redigerte) scenene til prosjektet. Kaster ved feil.
    let onSave: ([String]) async throws -> Void
    /// #9 Hent en brief fra prosjektets bryllups-timeline (dagsplan). nil hvis
    /// prosjektet ikke har en timeline. Utelates → knappen vises ikke.
    var fetchTimeline: (() async -> String?)? = nil
    /// Etikett på lagre-knappen — «Legg til i shot-listen» ved append.
    var saveLabel: String = "Lagre til prosjektet"
    /// Demo-hekter (--demo-brief): forhåndsutfyll briefen + auto-generer.
    var initialBrief: String = ""
    var autoGenerate: Bool = false

    @Environment(\.dismiss) private var dismiss
    @State private var brief = ""
    @State private var scenes: [String] = []
    @State private var generating = false
    @State private var loadingTimeline = false
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var unavailableMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                if scenes.isEmpty {
                    if let fetchTimeline {
                        Section {
                            Button {
                                Task {
                                    loadingTimeline = true; errorMessage = nil
                                    if let b = await fetchTimeline(), !b.isEmpty { brief = b }
                                    else { errorMessage = "Fant ingen bryllups-timeline for dette prosjektet." }
                                    loadingTimeline = false
                                }
                            } label: {
                                HStack {
                                    if loadingTimeline { ProgressView().padding(.trailing, 4) }
                                    Label("Hent fra bryllups-timeline", systemImage: "calendar.badge.clock")
                                }
                            }
                            .disabled(loadingTimeline)
                        } footer: {
                            Text("Fyller briefen fra dagsplanen (vielse, first look, middag, dans …).")
                        }
                    }
                    Section("Klient-brief") {
                        TextEditor(text: $brief)
                            .frame(minHeight: 170)
                            .overlay(alignment: .topLeading) {
                                if brief.isEmpty {
                                    Text("Lim inn briefen — ønsker, stemning, must-haves, lokasjoner, antrekk…")
                                        .foregroundStyle(.secondary)
                                        .padding(.top, 8).padding(.leading, 5)
                                        .allowsHitTesting(false)
                                }
                            }
                    }
                    Section {
                        Button {
                            Task { await generate() }
                        } label: {
                            HStack {
                                if generating { ProgressView().padding(.trailing, 4) }
                                Label(generating ? "Genererer…" : "Generer shot-list",
                                      systemImage: "sparkles")
                            }
                        }
                        .disabled(brief.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 || generating)
                    } footer: {
                        Text("Skrevet på enheten (Apple Intelligence) — briefen forlater aldri iPad-en.")
                    }
                    if let unavailableMessage {
                        Section { Text(unavailableMessage).font(.footnote).foregroundStyle(.secondary) }
                    }
                } else {
                    Section {
                        ForEach(scenes.indices, id: \.self) { i in
                            TextField("Scene", text: $scenes[i], axis: .vertical)
                        }
                        .onDelete { scenes.remove(atOffsets: $0) }
                        Button {
                            scenes.append("")
                        } label: { Label("Legg til shot", systemImage: "plus.circle") }
                    } header: {
                        Text("\(scenes.count) foreslåtte shots — rediger eller slett")
                    }
                    Section {
                        Button {
                            Task { await save() }
                        } label: {
                            HStack {
                                if saving { ProgressView().padding(.trailing, 4) }
                                Label(saveLabel, systemImage: "checklist")
                            }
                        }
                        .disabled(saving || scenes.allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty })
                        Button("Start på nytt", role: .destructive) { scenes = [] }
                    }
                }
                if let errorMessage {
                    Section { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Shot-list fra brief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
        .task {
            if brief.isEmpty { brief = initialBrief }
            if autoGenerate && scenes.isEmpty && !brief.isEmpty { await generate() }
        }
    }

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
                scenes = parsed
            }
        } catch {
            errorMessage = "Kunne ikke generere: \(String(describing: error))"
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
