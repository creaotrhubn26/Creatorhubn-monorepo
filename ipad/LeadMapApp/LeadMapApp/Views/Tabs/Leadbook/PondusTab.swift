// PondusTab.swift — Pondus-fane inne i Leadbook (2026-06-30)
//
// Layout matcher mockup (1366×1024 iPad landscape, men responsiv):
//   Header-strip (Pondus tittel + subtittel + Ny mal/Eksporter/Publiser)
//   Hovedrad: Pondus-maler (venstre, 280pt) | Mal-editor (midten, flex) | Pondus-analyse (høyre, 340pt)
//   Bunnrad: Teamets bruk (venstre, 60%) | Anbefalt språk (høyre, 40%)
//
// Pondus = "salgsvekt" + autoritet + klarhet + troverdighet + trygghet + fremdrift.

import SwiftUI

// MARK: - PondusTabView (hoved)

struct PondusTabView: View {
    @Environment(AppState.self) private var appState
    @Binding var selected: PondusTemplate
    @State private var editorMode: EditorMode = .rediger
    @State private var period: String = "Siste 30 dager"
    @State private var expandedStepIDs: Set<UUID> = []
    @State private var showNewMal = false
    @State private var showExport = false
    @State private var showPublish = false
    @State private var malSearch: String = ""
    @State private var favorited: Bool = true
    @State private var toast: String?

    /// Brukerredigert innhold pr step.id. Tom = bruk original.
    @State private var stepEdits: [UUID: String] = [:]
    /// Lagrede edits (etter "Lagre") — det vi sammenligner mot for å vise unsaved-state.
    @State private var savedEdits: [UUID: String] = [:]
    /// AI-jobb i gang (per step.id)
    @State private var aiBusyStepID: UUID?
    @FocusState private var focusedStepID: UUID?

    // Akademi
    @State private var academyWatched: Set<UUID> = []
    @State private var academyCurrent: PondusChapter? = nil
    @State private var showAcademy = false

    // Teamets bruk modal
    @State private var showTeamUsage = false

    // Anbefalt kommunikasjon (cheat-note fra høyre)
    @State private var showCheatNote = false

    /// Standard variabel-pool som kan settes inn med ett trykk
    private let variablePool: [String] = [
        "{navn}", "{ditt navn}", "{din bedrift}", "{selskap}",
        "{målgruppe}", "{kjerneverdi}", "{kunde}", "{kundetyper}",
        "{konkret resultat}", "{resultat/besparelse}", "{område}", "{tema}", "{hovedutfordring}"
    ]

    private func content(for step: PondusStep) -> String {
        stepEdits[step.id] ?? step.content
    }

    private func isModified(_ step: PondusStep) -> Bool {
        let current = content(for: step)
        let baseline = savedEdits[step.id] ?? step.content
        return current != baseline
    }

    private var modifiedCount: Int {
        selected.steps.filter { isModified($0) }.count
    }

    /// Naïv live-score: starter på baseline + bonus for at innhold ligger nær (men ikke over) charLimit.
    private var liveScore: Int {
        let base = selected.analysis.score
        guard !stepEdits.isEmpty else { return base }
        var delta = 0
        for step in selected.steps {
            let c = content(for: step)
            if let limit = step.charLimit {
                let ratio = Double(c.count) / Double(limit)
                if ratio > 1.0 { delta -= 4 }                  // over grensa = svakere
                else if ratio >= 0.5 && ratio <= 0.95 { delta += 1 }  // god lengde
            }
            // bonus for å bruke minst én variabel
            if variablePool.contains(where: { c.contains($0) }) { delta += 1 }
        }
        return max(0, min(100, base + delta))
    }

    private var liveScoreLabel: String {
        switch liveScore {
        case 90...: return "Eksepsjonell pondus"
        case 80...: return "Sterk pondus"
        case 70...: return "God pondus"
        case 60...: return "Brukbar pondus"
        default:    return "Trenger arbeid"
        }
    }

    enum EditorMode: String, CaseIterable, Identifiable {
        case rediger = "Rediger"
        case forhandsvis = "Forhåndsvis"
        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 14) {
            pondusHeader
            PondusAcademyBanner(
                watched: $academyWatched,
                currentChapter: $academyCurrent,
                onOpen: { showAcademy = true }
            )
            mainRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topTrailing) {
            // Cheat-note glir inn over høyre del — åpnes via «Cheat note»-CTA i Pondus-headeren.
            if showCheatNote {
                CommunicationCheatNote(onClose: { withAnimation { showCheatNote = false } })
                    .adaptiveControlWidth(460)   // iPhone: maxWidth i stedet for fast 460pt
                    .transition(.move(edge: .trailing))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: showCheatNote)
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(isPresented: $showNewMal) { PondusTemplateEditor(store: appState.pondusStore) }
        .sheet(isPresented: $showExport) { PondusExportSheet(template: selected) }
        .sheet(isPresented: $showPublish) { PondusPublishSheet(template: selected) }
        .fullScreenCover(isPresented: $showAcademy) {
            PondusAkademiSheet(
                watched: $academyWatched,
                current: academyCurrent ?? PondusAcademyData.chapters[0],
                chapters: PondusAcademyData.chapters
            )
        }
        .fullScreenCover(isPresented: $showTeamUsage) { PondusTeamUsageModal() }
        // Leadgrid Academy (mig 0368): last kurs + progresjon fra backend og
        // flett serverens sett-status inn i lokal state. Mock er fallback.
        .task {
            AcademyLiveStore.shared.attach(api: appState.api)
            await AcademyLiveStore.shared.load()
            academyWatched.formUnion(AcademyLiveStore.shared.serverWatched)
        }
        // Persister nye «sett»-kapitler (spilleren auto-markerer ved fullført
        // avspilling — eneste kilde til nye ids i settet).
        .onChange(of: academyWatched) { old, new in
            for id in new.subtracting(old) {
                AcademyLiveStore.shared.logWatched(id)
            }
        }
    }

    // MARK: Header

    private var pondusHeader: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 9) {
                    Text("Leadbook — Pondus")
                        .font(.appScaled(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    Button { favorited.toggle() } label: {
                        Image(systemName: favorited ? "star.fill" : "star")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(favorited ? LBrand.yellow : LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
                Text("Pondus hjelper teamet med å bygge sterkere autoritet, selvtillit, tillit og salgsvekt i all utadrettet kommunikasjon og møter.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 12)
            HStack(spacing: 8) {
                Button { withAnimation { showCheatNote = true } } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "doc.text.fill").font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Color(red: 0.98, green: 0.78, blue: 0.20))
                        Text("Cheat note").font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.98, green: 0.78, blue: 0.20).opacity(0.35), lineWidth: 1))
                }.buttonStyle(.plain)
                Button { showTeamUsage = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "person.3.fill").font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(LBrand.green)
                        Text("Teamets bruk").font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button { showNewMal = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                        Text("Ny mal").font(.appScaled(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button { showExport = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "square.and.arrow.down").font(.appScaled(size: 11, weight: .bold))
                        Text("Eksporter").font(.appScaled(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button { showPublish = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "paperplane.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Publiser").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                }.buttonStyle(.plain)
            }
        }
        .padding(.bottom, 4)
    }

    // MARK: Hovedrad

    private var mainRow: some View {
        HStack(alignment: .top, spacing: 14) {
            pondusMalerColumn
                .frame(width: 280)
            pondusEditorColumn
                .frame(maxWidth: .infinity)
            pondusAnalyseColumn
                .frame(width: 340)
        }
    }

    // MARK: VENSTRE — Pondus-maler

    private var pondusMalerColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("Pondus-maler")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                // Søk- og filter-ikonknappene fjernet 2026-07-17: var døde
                // knapper — mal-listen har ingen søk/filter-flate.
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 12)

            VStack(spacing: 10) {
                ForEach(PondusData.templates) { t in
                    pondusMalCard(t)
                }
                Button { showNewMal = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus").font(.appScaled(size: 12, weight: .bold))
                        Text("Ny mal").font(.appScaled(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(LBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(
                        RoundedRectangle(cornerRadius: 11)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                            .foregroundStyle(LBrand.stroke)
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func pondusMalCard(_ t: PondusTemplate) -> some View {
        let isSelected = selected.id == t.id
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                selected = t
                expandedStepIDs.removeAll()
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    Text(t.name)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(t.score)")
                        .font(.appScaled(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(LBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(LBrand.purpleLight.opacity(0.35), lineWidth: 1))
                }
                HStack(spacing: 5) {
                    Image(systemName: t.channel.icon)
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(t.channel.color)
                    Text(t.channel.rawValue)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(t.channel.color.opacity(0.12), in: Capsule())
                .overlay(Capsule().stroke(t.channel.color.opacity(0.3), lineWidth: 1))
                Text(t.summary)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isSelected ? LBrand.purple.opacity(0.13) : LBrand.cardHi.opacity(0.55),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? LBrand.purpleLight.opacity(0.55) : LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: MIDTEN — Mal-editor

    private var pondusEditorColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text(selected.name)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(liveScore)")
                    .font(.appScaled(size: 11, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purpleLight.opacity(0.35), lineWidth: 1))
                if modifiedCount > 0 {
                    HStack(spacing: 5) {
                        Circle().fill(LBrand.orange).frame(width: 6, height: 6)
                        Text("\(modifiedCount) usavnet")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(LBrand.orange)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(LBrand.orange.opacity(0.14), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.orange.opacity(0.35), lineWidth: 1))
                }
                Spacer()
                if modifiedCount > 0 {
                    Button { saveAllEdits() } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "checkmark").font(.appScaled(size: 10, weight: .black))
                            Text("Lagre").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(LBrand.green, in: Capsule())
                    }.buttonStyle(.plain)
                }
                editorModeToggle
                Menu {
                    // «Dupliser» fjernet 2026-07-17: var død knapp — copyMal()
                    // viste kun toast, ingen kopi ble opprettet.
                    // «Del lenke» + «Eksporter PDF» + «Arkiver mal» fjernet
                    // 2026-07-17: var døde knapper (tomme closures) — ingen
                    // dele-/eksport-/arkiv-flate for Pondus-maler.
                    Button { resetAllEdits() } label: { Label("Tilbakestill alt", systemImage: "arrow.uturn.backward") }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(LBrand.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 12)

            VStack(spacing: 8) {
                ForEach(selected.steps) { step in
                    stepRow(step)
                }
            }
            .padding(.horizontal, 14).padding(.bottom, 14)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var editorModeToggle: some View {
        HStack(spacing: 4) {
            ForEach(EditorMode.allCases) { mode in
                Button { editorMode = mode } label: {
                    Text(mode.rawValue)
                        .font(.appScaled(size: 11, weight: editorMode == mode ? .bold : .semibold))
                        .foregroundStyle(editorMode == mode ? LBrand.purpleLight : LBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(
                            editorMode == mode ? LBrand.purple.opacity(0.18) : .clear,
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(LBrand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
    }

    private func stepRow(_ step: PondusStep) -> some View {
        let isExpanded = expandedStepIDs.contains(step.id)
        let currentContent = content(for: step)
        let modified = isModified(step)
        return VStack(alignment: .leading, spacing: 0) {
            // Always-shown header
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    if isExpanded { expandedStepIDs.remove(step.id); focusedStepID = nil }
                    else { expandedStepIDs.insert(step.id); focusedStepID = step.id }
                }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "line.3.horizontal")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.top, 14)
                    ZStack {
                        RoundedRectangle(cornerRadius: 9).fill(step.iconColor.opacity(0.22))
                        Image(systemName: step.icon)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(step.iconColor)
                    }
                    .frame(width: 32, height: 32)
                    .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(step.label)
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                            if modified {
                                Text("ENDRET")
                                    .font(.appScaled(size: 8, weight: .black))
                                    .foregroundStyle(LBrand.orange)
                                    .padding(.horizontal, 5).padding(.vertical, 1)
                                    .background(LBrand.orange.opacity(0.18), in: Capsule())
                                    .tracking(0.5)
                            }
                        }
                        Text(currentContent)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.textSecondary)
                            .lineLimit(isExpanded ? nil : 2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(alignment: .trailing, spacing: 8) {
                        if let limit = step.charLimit {
                            Text("\(currentContent.count)/\(limit)")
                                .font(.appScaled(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(currentContent.count > limit ? LBrand.red : LBrand.textTertiary)
                                .monospacedDigit()
                        }
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                }
                .padding(12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // Editor — only when expanded
            if isExpanded && editorMode == .rediger {
                stepEditor(for: step, currentContent: currentContent, modified: modified)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else if isExpanded && editorMode == .forhandsvis {
                stepPreview(for: step, currentContent: currentContent)
                    .transition(.opacity)
            }
        }
        .background(LBrand.cardHi.opacity(0.55), in: RoundedRectangle(cornerRadius: 11))
        .overlay(
            RoundedRectangle(cornerRadius: 11)
                .stroke(
                    isExpanded ? LBrand.purple.opacity(0.35)
                        : modified ? LBrand.orange.opacity(0.4) : LBrand.stroke,
                    lineWidth: 1
                )
        )
    }

    private func stepEditor(for step: PondusStep, currentContent: String, modified: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider().overlay(LBrand.stroke).padding(.horizontal, 12)

            // TextEditor m/ live char-count
            ZStack(alignment: .topLeading) {
                if currentContent.isEmpty {
                    Text("Skriv mal-innholdet her…")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 14).padding(.top, 14)
                }
                TextEditor(text: Binding(
                    get: { currentContent },
                    set: { stepEdits[step.id] = $0 }
                ))
                .font(.appScaled(size: 13))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .focused($focusedStepID, equals: step.id)
                .frame(minHeight: 90, maxHeight: 220)
                .padding(.horizontal, 8).padding(.vertical, 6)
            }
            .background(LBrand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
            .padding(.horizontal, 12)

            // Variabel-chips
            VStack(alignment: .leading, spacing: 6) {
                Text("SETT INN VARIABEL")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(variablePool, id: \.self) { v in
                            Button {
                                insertVariable(v, for: step)
                            } label: {
                                Text(v)
                                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(LBrand.purpleLight)
                                    .padding(.horizontal, 9).padding(.vertical, 5)
                                    .background(LBrand.purple.opacity(0.15), in: Capsule())
                                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)

            // Action-rad
            HStack(spacing: 8) {
                Button {
                    aiSuggest(for: step)
                } label: {
                    HStack(spacing: 5) {
                        if aiBusyStepID == step.id {
                            ProgressView().tint(.white).scaleEffect(0.7)
                        } else {
                            Image(systemName: "sparkles").font(.appScaled(size: 11, weight: .bold))
                        }
                        Text(aiBusyStepID == step.id ? "Foreslår…" : "AI-foreslå sterkere")
                            .font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                .disabled(aiBusyStepID != nil)

                Button {
                    resetStep(step)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.uturn.backward").font(.appScaled(size: 10, weight: .bold))
                        Text("Tilbakestill").font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(modified ? LBrand.orange : LBrand.textTertiary)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(modified ? LBrand.orange.opacity(0.15) : LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(modified ? LBrand.orange.opacity(0.4) : LBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(!modified)

                Spacer()

                Button {
                    saveStep(step)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark").font(.appScaled(size: 10, weight: .black))
                        Text("Lagre").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(modified ? LBrand.green : LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(modified ? LBrand.green.opacity(0.6) : LBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(!modified)
            }
            .padding(.horizontal, 12).padding(.bottom, 12)
        }
    }

    private func stepPreview(for step: PondusStep, currentContent: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().overlay(LBrand.stroke).padding(.horizontal, 12)
            HStack(spacing: 8) {
                Image(systemName: "eye.fill")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.blue)
                Text("KUNDEVENNLIG FORHÅNDSVISNING")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            }
            .padding(.horizontal, 12)

            // Replace variables w/ realistic stub-values
            Text(previewSubstituted(currentContent))
                .font(.appScaled(size: 13))
                .foregroundStyle(.white)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LBrand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.blue.opacity(0.25), lineWidth: 1))
                .padding(.horizontal, 12).padding(.bottom, 12)
        }
    }

    private func previewSubstituted(_ raw: String) -> String {
        var s = raw
        let stub: [(String, String)] = [
            ("{navn}", "Marit"),
            ("{ditt navn}", "Lars Kristensen"),
            ("{din bedrift}", "Leadgrid"),
            ("{selskap}", "Acme AS"),
            ("{målgruppe}", "B2B-salgsteam"),
            ("{kjerneverdi}", "kortere salgssykluser"),
            ("{kunde}", "Skanska"),
            ("{kundetyper}", "ledende norske entreprenører"),
            ("{konkret resultat}", "økt møterate med 28 %"),
            ("{resultat/besparelse}", "12 % bedre konvertering"),
            ("{område}", "salgsproduktivitet"),
            ("{tema}", "intern salgsopplæring"),
            ("{hovedutfordring}", "for lav respons-rate")
        ]
        for (key, val) in stub { s = s.replacingOccurrences(of: key, with: val) }
        return s
    }

    // MARK: Editor actions

    private func insertVariable(_ v: String, for step: PondusStep) {
        let current = content(for: step)
        let needsSpace = !current.isEmpty && !current.hasSuffix(" ") && !current.hasSuffix("\n")
        stepEdits[step.id] = current + (needsSpace ? " " : "") + v
    }

    private func resetStep(_ step: PondusStep) {
        stepEdits[step.id] = savedEdits[step.id] ?? step.content
        flashToast("«\(step.label)» tilbakestilt")
    }

    private func saveStep(_ step: PondusStep) {
        savedEdits[step.id] = content(for: step)
        flashToast("«\(step.label)» lagret")
    }

    private func saveAllEdits() {
        for step in selected.steps where isModified(step) {
            savedEdits[step.id] = content(for: step)
        }
        flashToast("\(modifiedCount) endringer lagret")
    }

    private func resetAllEdits() {
        stepEdits.removeAll()
        savedEdits.removeAll()
        flashToast("Alle endringer tilbakestilt")
    }

    private func aiSuggest(for step: PondusStep) {
        aiBusyStepID = step.id
        // Simulert AI-jobb — bytter ut svake formuleringer mot sterkere.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            let current = content(for: step)
            stepEdits[step.id] = strengthen(current)
            aiBusyStepID = nil
            flashToast("AI foreslo sterkere formulering")
        }
    }

    private func strengthen(_ raw: String) -> String {
        var s = raw
        let pairs: [(String, String)] = [
            ("for å høre om dere er interessert", "fordi vi kan hjelpe dere"),
            ("Kunne vi", "Gir det mening om vi"),
            ("hatt et møte en gang", "tar en kort prat denne uken"),
            ("Hva er grunnen til at dette ikke er aktuelt nå?", "Hva må være på plass for at dette skulle vært aktuelt?"),
            ("mye erfaring og gode løsninger", "hjulpet {kunde} med å oppnå {konkret resultat}"),
            ("Jeg ringer", "Jeg tar kontakt fordi vi kan"),
            ("Kanskje", "Vi vet at"),
            ("vi kan kanskje", "vi kommer til å"),
            ("vi tror", "vi har dokumentert at"),
        ]
        for (weak, strong) in pairs {
            s = s.replacingOccurrences(of: weak, with: strong, options: .caseInsensitive)
        }
        return s
    }

    private func flashToast(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            if toast == text { toast = nil }
        }
    }

    // MARK: HØYRE — Pondus-analyse

    private var pondusAnalyseColumn: some View {
        VStack(spacing: 12) {
            scoreCard
            tipsCard
        }
    }

    private var scoreCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Text("Pondus-analyse")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Image(systemName: "info.circle")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
                Spacer()
            }
            VStack(spacing: 6) {
                Text("Pondus score")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                ZStack {
                    Circle()
                        .stroke(LBrand.cardHi, style: StrokeStyle(lineWidth: 8))
                        .frame(width: 130, height: 130)
                    Circle()
                        .trim(from: 0, to: CGFloat(liveScore) / 100)
                        .stroke(
                            AngularGradient(
                                colors: [LBrand.purple, LBrand.purpleLight, LBrand.pink, LBrand.purple],
                                center: .center),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .frame(width: 130, height: 130)
                        .animation(.easeInOut(duration: 0.4), value: liveScore)
                    VStack(spacing: 2) {
                        Text("\(liveScore)")
                            .font(.appScaled(size: 36, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                            .contentTransition(.numericText())
                            .animation(.easeInOut(duration: 0.3), value: liveScore)
                        Text(liveScoreLabel)
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
                .padding(.top, 4)
            }
            VStack(spacing: 8) {
                scoreRow(icon: "person.fill",          label: "Autoritet",   value: selected.analysis.autoritet)
                scoreRow(icon: "scope",                label: "Klarhet",     value: selected.analysis.klarhet)
                scoreRow(icon: "checkmark.seal.fill",  label: "Troverdighet",value: selected.analysis.troverdighet)
                scoreRow(icon: "shield.fill",          label: "Trygghet",    value: selected.analysis.trygghet)
                scoreRow(icon: "arrow.right.circle.fill", label: "Fremdrift", value: selected.analysis.fremdrift)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func scoreRow(icon: String, label: String, value: Int) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(LBrand.purpleLight)
                .frame(width: 14)
            Text(label)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 86, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(LBrand.cardHi).frame(height: 5)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [LBrand.purple, LBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(6, geo.size.width * Double(value) / 100), height: 5)
                }
            }
            .frame(height: 5)
            Text("\(value)")
                .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .frame(width: 24, alignment: .trailing)
        }
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Hva gir mer pondus?")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(selected.analysis.tips, id: \.self) { tip in
                    HStack(alignment: .top, spacing: 9) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.purpleLight)
                        Text(tip)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white)
                        Spacer()
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: BUNNRAD

    /// Stor floating sticky-tab på høyre kant — føles som en bokmerke-fane.
    /// Z-indexes over alt innhold, alltid klar til å åpnes.
    private var cheatNoteStickyTab: some View {
        VStack {
            Spacer()
            Button { withAnimation { showCheatNote = true } } label: {
                HStack(spacing: 9) {
                    Image(systemName: "doc.text.fill")
                        .font(.appScaled(size: 16, weight: .heavy))
                        .foregroundStyle(LBrand.bg)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("CHEAT NOTE")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(LBrand.bg.opacity(0.7))
                            .tracking(0.8)
                        Text("Anbefalt kommunikasjon")
                            .font(.appScaled(size: 12, weight: .heavy))
                            .foregroundStyle(LBrand.bg)
                    }
                    Image(systemName: "chevron.left")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.bg.opacity(0.7))
                }
                .padding(.vertical, 14).padding(.horizontal, 16)
                .background(
                    UnevenRoundedRectangle(
                        topLeadingRadius: 14,
                        bottomLeadingRadius: 14,
                        bottomTrailingRadius: 0,
                        topTrailingRadius: 0
                    )
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 1.0, green: 0.90, blue: 0.40), Color(red: 0.98, green: 0.78, blue: 0.20)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                )
                .overlay(
                    // Vannrette linjer som om det var et bokmerke
                    HStack(spacing: 0) {
                        Rectangle().fill(Color(red: 0.85, green: 0.25, blue: 0.20).opacity(0.4)).frame(width: 1)
                            .padding(.leading, 7)
                        Spacer()
                    }
                )
                .shadow(color: .black.opacity(0.55), radius: 14, x: -4, y: 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .zIndex(99)
    }

    private var teamsBrukCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("Teamets bruk")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Image(systemName: "info.circle")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textTertiary)
                Spacer()
                Menu {
                    Button("Siste 7 dager") { period = "Siste 7 dager" }
                    Button("Siste 30 dager") { period = "Siste 30 dager" }
                    Button("Siste 90 dager") { period = "Siste 90 dager" }
                } label: {
                    HStack(spacing: 5) {
                        Text(period).font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
                }
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 12)

            HStack(spacing: 0) {
                Text("MAL").frame(maxWidth: .infinity, alignment: .leading)
                Text("BRUK").frame(width: 70, alignment: .trailing)
                Text("SVARRATE").frame(width: 110, alignment: .trailing)
                Text("MØTE-RATE").frame(width: 110, alignment: .trailing)
                Text("KONVERTERING").frame(width: 130, alignment: .trailing)
            }
            .font(.appScaled(size: 9, weight: .black))
            .tracking(0.5)
            .foregroundStyle(LBrand.textTertiary)
            .padding(.horizontal, 14).padding(.bottom, 8)

            VStack(spacing: 6) {
                ForEach(PondusData.templates) { t in usageRow(t) }
            }
            .padding(.horizontal, 14)

            // «Se full rapport» fjernet 2026-07-17: var død knapp — ingen
            // rapport-flate å navigere til herfra.
            Color.clear.frame(height: 13)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func usageRow(_ t: PondusTemplate) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: t.channel.icon)
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(t.channel.color)
                    .frame(width: 16)
                Text(t.name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(t.usage.brukt)")
                .font(.appScaled(size: 12, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .frame(width: 70, alignment: .trailing)
            deltaCell(value: t.usage.svarrate, delta: t.usage.svarrateDelta).frame(width: 110, alignment: .trailing)
            deltaCell(value: t.usage.moeterate, delta: t.usage.moerateDelta).frame(width: 110, alignment: .trailing)
            deltaCell(value: t.usage.konvertering, delta: t.usage.konverteringDelta).frame(width: 130, alignment: .trailing)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 6)
        .background(LBrand.cardHi.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
    }

    private func deltaCell(value: Double, delta: Double) -> some View {
        HStack(spacing: 5) {
            Text(percentFormat(value))
                .font(.appScaled(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            HStack(spacing: 2) {
                Image(systemName: "arrow.up")
                    .font(.appScaled(size: 8, weight: .black))
                Text(percentFormat(delta))
                    .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
            .foregroundStyle(LBrand.green)
        }
    }

    private func percentFormat(_ v: Double) -> String {
        let p = v * 100
        if p.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(p)) %"
        }
        return String(format: "%.1f %%", p).replacingOccurrences(of: ".", with: ",")
    }

    private var anbefaltSprakCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("Anbefalt språk")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Image(systemName: "info.circle")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textTertiary)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 12)

            HStack(spacing: 14) {
                Label {
                    Text("Sterkere formulering").font(.appScaled(size: 11, weight: .black))
                } icon: {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(LBrand.green)
                }
                .foregroundStyle(LBrand.green)
                .tracking(0.5)
                .frame(maxWidth: .infinity, alignment: .leading)
                Label {
                    Text("Svakere formulering").font(.appScaled(size: 11, weight: .black))
                } icon: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(LBrand.red)
                }
                .foregroundStyle(LBrand.red)
                .tracking(0.5)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14).padding(.bottom, 10)

            VStack(spacing: 8) {
                let pairs = selected.suggestions.isEmpty ? PondusData.templates[0].suggestions : selected.suggestions
                ForEach(pairs) { pair in
                    HStack(alignment: .top, spacing: 12) {
                        Text(pair.stronger)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(LBrand.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.green.opacity(0.28), lineWidth: 1))
                        Text(pair.weaker)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.textSecondary)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(LBrand.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.red.opacity(0.25), lineWidth: 1))
                    }
                }
            }
            .padding(.horizontal, 14).padding(.bottom, 14)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Actions

    // copyMal() fjernet 2026-07-17 sammen med «Dupliser»-knappen — var kun
    // toast uten reell kopiering.
}

// MARK: - PondusExportSheet
struct PondusExportSheet: View {
    let template: PondusTemplate
    @Environment(\.dismiss) private var dismiss
    @State private var format: ExportFormat = .pdf
    @State private var includeAnalysis = true
    @State private var includeUsage = true
    @State private var includeSuggestions = true

    enum ExportFormat: String, CaseIterable, Identifiable {
        case pdf = "PDF"
        case docx = "Word (.docx)"
        case csv = "CSV (rådata)"
        case json = "JSON (mal-fil)"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .pdf: return "doc.fill"
            case .docx: return "doc.text.fill"
            case .csv: return "tablecells.fill"
            case .json: return "curlybraces"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("EKSPORTER").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Text(template.name).font(.appScaled(size: 22, weight: .heavy)).foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("FORMAT").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(ExportFormat.allCases) { f in
                                    Button { format = f } label: {
                                        VStack(spacing: 8) {
                                            Image(systemName: f.icon)
                                                .font(.appScaled(size: 22, weight: .bold))
                                                .foregroundStyle(format == f ? LBrand.purpleLight : LBrand.textSecondary)
                                            Text(f.rawValue).font(.appScaled(size: 12, weight: .semibold))
                                                .foregroundStyle(format == f ? .white : LBrand.textSecondary)
                                        }
                                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                                        .background(
                                            format == f ? LBrand.purple.opacity(0.18) : LBrand.card,
                                            in: RoundedRectangle(cornerRadius: 11)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 11)
                                                .stroke(format == f ? LBrand.purple.opacity(0.5) : LBrand.stroke, lineWidth: 1)
                                        )
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("INKLUDÉR").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Toggle("Pondus-analyse + score", isOn: $includeAnalysis).tint(LBrand.purpleLight)
                            Toggle("Teamets bruk (siste 30 d)", isOn: $includeUsage).tint(LBrand.purpleLight)
                            Toggle("Anbefalt språk-par", isOn: $includeSuggestions).tint(LBrand.purpleLight)
                        }
                        .foregroundStyle(.white)
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Eksporter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: {
                        Text("Eksporter").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                }
            }
        }
    }
}

// MARK: - PondusPublishSheet
struct PondusPublishSheet: View {
    let template: PondusTemplate
    @Environment(\.dismiss) private var dismiss
    @State private var scope: Scope = .heleTeamet
    @State private var notifyTeam = true
    @State private var requireApproval = true
    @State private var releaseNotes: String = ""

    enum Scope: String, CaseIterable, Identifiable {
        case meg = "Bare meg"
        case heleTeamet = "Hele teamet"
        case rolle = "Spesifikk rolle"
        case region = "Spesifikk region"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .meg: return "person.fill"
            case .heleTeamet: return "person.3.fill"
            case .rolle: return "person.badge.shield.checkmark.fill"
            case .region: return "map.fill"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("PUBLISER").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Text(template.name).font(.appScaled(size: 22, weight: .heavy)).foregroundStyle(.white)
                            Text("Pondus-score \(template.analysis.score) — \(template.analysis.scoreLabel)")
                                .font(.appScaled(size: 12)).foregroundStyle(LBrand.purpleLight)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ROLL UT TIL").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            ForEach(Scope.allCases) { s in
                                Button { scope = s } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: s.icon)
                                            .font(.appScaled(size: 13, weight: .bold))
                                            .foregroundStyle(scope == s ? LBrand.purpleLight : LBrand.textSecondary)
                                            .frame(width: 26)
                                        Text(s.rawValue)
                                            .font(.appScaled(size: 13, weight: .semibold))
                                            .foregroundStyle(scope == s ? .white : LBrand.textSecondary)
                                        Spacer()
                                        Image(systemName: scope == s ? "largecircle.fill.circle" : "circle")
                                            .font(.appScaled(size: 16))
                                            .foregroundStyle(scope == s ? LBrand.purpleLight : LBrand.textTertiary)
                                    }
                                    .padding(12)
                                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(scope == s ? LBrand.purple.opacity(0.4) : LBrand.stroke, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("RELEASE NOTES").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            TextEditor(text: $releaseNotes)
                                .foregroundStyle(.white)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 120)
                                .padding(8)
                                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Toggle("Varsle teamet ved publisering", isOn: $notifyTeam).tint(LBrand.purpleLight)
                            Toggle("Krever godkjenning fra salgssjef", isOn: $requireApproval).tint(LBrand.purpleLight)
                        }
                        .foregroundStyle(.white)
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Publiser")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "paperplane.fill")
                            Text(requireApproval ? "Send til godkjenning" : "Publiser nå")
                        }
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                    }
                }
            }
        }
    }
}

// MARK: - TemplateLibraryModalEmbedded (used by "Maler" sub-tab)

struct TemplateLibraryModalEmbedded: View {
    @Binding var selected: LeadbookTemplate
    var body: some View {
        // Re-use TemplateLibraryModal's body content inline (without NavigationStack).
        // For now we keep simple: list cards in a stack.
        VStack(spacing: 10) {
            ForEach(LeadbookData.templates) { t in
                Button { selected = t } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10).fill(t.channel.color.opacity(0.22))
                            Image(systemName: t.channel.icon)
                                .font(.appScaled(size: 14, weight: .bold))
                                .foregroundStyle(t.channel.color)
                        }
                        .frame(width: 38, height: 38)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(t.name)
                                .font(.appScaled(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                            HStack(spacing: 6) {
                                Text(t.channel.rawValue).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                                Text("·").foregroundStyle(LBrand.textTertiary)
                                Text("Steg \(t.step)/\(t.stepTotal)").font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                                Text("·").foregroundStyle(LBrand.textTertiary)
                                Text("Brukt \(t.used)").font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                            }
                        }
                        Spacer()
                        Text("\(Int(t.conversion * 100))%")
                            .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(LBrand.green)
                        Image(systemName: "chevron.right")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    .padding(12)
                    .background(
                        selected.id == t.id ? LBrand.purple.opacity(0.13) : LBrand.card,
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected.id == t.id ? LBrand.purple.opacity(0.5) : LBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - CommunicationCheatNote
// Slide-in panel fra høyre — føles som en lærer-stor post-it som man kikker på under samtale.

struct CommunicationCheatNote: View {
    var onClose: () -> Void
    @State private var search: String = ""
    @State private var category: Category = .all
    @State private var pinned: Set<UUID> = []
    @State private var copiedID: UUID?

    // Note-papir-tema
    private let paper = Color(red: 0.99, green: 0.96, blue: 0.78)
    private let paperLine = Color(red: 0.95, green: 0.85, blue: 0.45).opacity(0.45)
    private let ink = Color(red: 0.20, green: 0.16, blue: 0.06)
    private let inkLight = Color(red: 0.40, green: 0.32, blue: 0.10)
    private let strong = Color(red: 0.12, green: 0.50, blue: 0.28)
    private let weak = Color(red: 0.65, green: 0.18, blue: 0.18)
    private let tape = Color(red: 1.0, green: 0.95, blue: 0.55).opacity(0.7)

    enum Category: String, CaseIterable, Identifiable {
        case all = "Alle"
        case opening = "Åpning"
        case discovery = "Discovery"
        case objection = "Innvending"
        case price = "Pris"
        case closing = "Avslutning"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .all: return "tray.full.fill"
            case .opening: return "bubble.left.fill"
            case .discovery: return "questionmark.circle.fill"
            case .objection: return "exclamationmark.shield.fill"
            case .price: return "creditcard.fill"
            case .closing: return "checkmark.circle.fill"
            }
        }
    }

    private var filtered: [Tip] {
        var list = Tip.all
        if category != .all { list = list.filter { $0.category == category } }
        if !search.isEmpty {
            let q = search.lowercased()
            list = list.filter {
                $0.strong.lowercased().contains(q) || $0.weak.lowercased().contains(q)
            }
        }
        return list
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            filterStrip
            ScrollView {
                VStack(spacing: 0) {
                    // Lined paper background med tips på toppen
                    VStack(spacing: 14) {
                        legend
                        ForEach(filtered) { tip in tipRow(tip) }
                        if filtered.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "magnifyingglass")
                                    .font(.appScaled(size: 22)).foregroundStyle(inkLight)
                                Text("Ingen tips matcher")
                                    .font(.appScaled(size: 12, design: .serif))
                                    .foregroundStyle(ink)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 30)
                        }
                        proTipsCard
                        Color.clear.frame(height: 24)
                    }
                    .padding(.horizontal, 22).padding(.top, 18)
                }
            }
        }
        .background(paperBackground)
        .overlay(alignment: .topLeading) { tapeStrip.rotationEffect(.degrees(-12)).offset(x: 30, y: -10) }
        .overlay(alignment: .topTrailing) { tapeStrip.rotationEffect(.degrees(15)).offset(x: -30, y: -10) }
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .shadow(color: .black.opacity(0.6), radius: 24, x: -4, y: 0)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            // Marit-avatar — kuratoren av cheat-noten
            SmartPortrait(assetName: "portrait-marit")
                .frame(width: 48, height: 48)
                .overlay(Circle().stroke(ink.opacity(0.3), lineWidth: 1.5))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Image(systemName: "doc.text.fill").foregroundStyle(ink)
                    Text("CHEAT NOTE · KURATERT AV MARIT").font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(ink).tracking(0.8)
                }
                Text("Anbefalt kommunikasjon")
                    .font(.appScaled(size: 22, weight: .heavy, design: .serif))
                    .foregroundStyle(ink)
                Text("Hold meg åpen mens du snakker. Bytt en svak formulering med en sterk på sekunder.")
                    .font(.appScaled(size: 11, design: .serif))
                    .foregroundStyle(inkLight)
                    .italic()
                    .lineLimit(2)
            }
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(ink)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle().fill(paper).overlay(Circle().stroke(ink.opacity(0.3), lineWidth: 1))
                    )
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 22).padding(.top, 30).padding(.bottom, 14)
    }

    private var filterStrip: some View {
        VStack(spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass").foregroundStyle(inkLight)
                TextField("Søk formulering…", text: $search)
                    .foregroundStyle(ink).textFieldStyle(.plain)
                    .font(.appScaled(size: 12, design: .serif))
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(inkLight)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 11).padding(.vertical, 8)
            .background(paper.opacity(0.6), in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(ink.opacity(0.25), lineWidth: 1))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Category.allCases) { c in
                        Button { category = c } label: {
                            HStack(spacing: 4) {
                                Image(systemName: c.icon).font(.appScaled(size: 9, weight: .bold))
                                Text(c.rawValue).font(.appScaled(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(category == c ? paper : ink)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(category == c ? ink : paper.opacity(0.5), in: Capsule())
                            .overlay(Capsule().stroke(ink.opacity(0.3), lineWidth: 1))
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, 22).padding(.bottom, 10)
    }

    private var legend: some View {
        HStack(spacing: 14) {
            Label {
                Text("STERK").font(.appScaled(size: 10, weight: .black)).tracking(0.6)
            } icon: {
                Image(systemName: "checkmark.circle.fill")
            }
            .foregroundStyle(strong)
            Label {
                Text("SVAK").font(.appScaled(size: 10, weight: .black)).tracking(0.6)
            } icon: {
                Image(systemName: "xmark.circle.fill")
            }
            .foregroundStyle(weak)
            Spacer()
            Text("\(filtered.count) tips")
                .font(.appScaled(size: 10, design: .monospaced))
                .foregroundStyle(inkLight)
        }
        .padding(.bottom, 4)
    }

    private func tipRow(_ tip: Tip) -> some View {
        let isPinned = pinned.contains(tip.id)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: tip.category.icon)
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(inkLight)
                Text(tip.category.rawValue.uppercased())
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(inkLight).tracking(0.6)
                Spacer()
                Button {
                    if isPinned { pinned.remove(tip.id) } else { pinned.insert(tip.id) }
                } label: {
                    Image(systemName: isPinned ? "pin.fill" : "pin")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(isPinned ? Color(red: 0.85, green: 0.2, blue: 0.2) : inkLight)
                        .rotationEffect(.degrees(isPinned ? 0 : -30))
                }.buttonStyle(.plain)
            }
            // STERK
            Button { copyTip(tip.strong, id: tip.id) } label: {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 13)).foregroundStyle(strong).padding(.top, 1)
                    Text(tip.strong)
                        .font(.appScaled(size: 13, design: .serif))
                        .foregroundStyle(ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if copiedID == tip.id {
                        Text("KOPIERT")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(strong).tracking(0.6)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(strong.opacity(0.15), in: Capsule())
                    } else {
                        Image(systemName: "doc.on.doc")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(inkLight)
                    }
                }
                .padding(10)
                .background(strong.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(strong.opacity(0.3), lineWidth: 1))
            }.buttonStyle(.plain)
            // SVAK
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 13)).foregroundStyle(weak).padding(.top, 1)
                Text(tip.weak)
                    .font(.appScaled(size: 12, design: .serif))
                    .italic()
                    .foregroundStyle(inkLight)
                    .strikethrough(true, color: weak.opacity(0.5))
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            if let why = tip.why {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(Color(red: 0.85, green: 0.6, blue: 0.1))
                    Text(why)
                        .font(.appScaled(size: 10, design: .serif))
                        .italic()
                        .foregroundStyle(inkLight)
                    Spacer()
                }
                .padding(.horizontal, 10)
            }
        }
        .padding(.vertical, 10)
        .overlay(
            Rectangle().fill(paperLine).frame(height: 1),
            alignment: .bottom
        )
    }

    private var proTipsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").foregroundStyle(Color(red: 0.85, green: 0.55, blue: 0.1))
                Text("HÅNDSKREVNE NOTATER FRA LARS")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(ink).tracking(0.8)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text("• Pust gjennom nesen før du svarer på en innvending.")
                Text("• 4-sekunders pause = de snakker først.")
                Text("• «Skjønner» — så stille. Ikke ord etter.")
                Text("• Aldri «kanskje». Bytt med «vi vet at».")
                Text("• Bekreft alltid neste steg med DATO + TID.")
            }
            .font(.appScaled(size: 11, design: .serif))
            .italic()
            .foregroundStyle(ink)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(red: 0.95, green: 0.86, blue: 0.55).opacity(0.4))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .foregroundStyle(ink.opacity(0.3))
        )
    }

    // MARK: Paper-background med horisontale linjer
    private var paperBackground: some View {
        ZStack {
            paper
            VStack(spacing: 22) {
                ForEach(0..<40, id: \.self) { _ in
                    Rectangle().fill(paperLine).frame(height: 0.6)
                }
            }
            .padding(.top, 90)
            // Venstre rød margin-strek
            HStack {
                Rectangle()
                    .fill(Color(red: 0.85, green: 0.25, blue: 0.20).opacity(0.5))
                    .frame(width: 1.2)
                    .padding(.leading, 12)
                Spacer()
            }
        }
    }

    private var tapeStrip: some View {
        Rectangle()
            .fill(tape)
            .frame(width: 80, height: 18)
            .overlay(
                Rectangle().stroke(.white.opacity(0.5), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
    }

    private func copyTip(_ text: String, id: UUID) {
        UIPasteboard.general.string = text
        copiedID = id
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if copiedID == id { copiedID = nil }
        }
    }

    // MARK: Data

    struct Tip: Identifiable, Hashable {
        let id = UUID()
        let category: Category
        let strong: String
        let weak: String
        let why: String?

        static let all: [Tip] = [
            Tip(category: .opening,
                strong: "Hei {navn}, jeg tar kontakt fordi vi kan hjelpe dere med {kjerneverdi}.",
                weak: "Jeg ringer for å høre om dere er interessert i våre tjenester.",
                why: "Konkret verdi-anker fra første sekund — ikke en spørrende bønn om lov."),
            Tip(category: .opening,
                strong: "Hei {navn}, har du 2 minutter til ett konkret spørsmål?",
                weak: "Forstyrrer jeg? Er det dårlig timing?",
                why: "«Beklager at jeg forstyrrer» = bønn om avvisning."),
            Tip(category: .discovery,
                strong: "Hva er det viktigste å få til i år innen {område}?",
                weak: "Hva er utfordringene deres?",
                why: "Spesifikt + tidsbundet > generisk «utfordringer»."),
            Tip(category: .discovery,
                strong: "Når du sier {kundens ord} — mener du A eller B?",
                weak: "Hvorfor er det viktig?",
                why: "Speil kundens egne ord. Det viser at du hører."),
            Tip(category: .discovery,
                strong: "Hva er konsekvensen at dere ikke har løst dette ennå?",
                weak: "Hva slags konsekvenser har det?",
                why: "Pålegg fremtidsverdi — gjør kostnaden ved status quo tydelig."),
            Tip(category: .objection,
                strong: "Skjønner. Hva må være på plass for at dette skulle vært aktuelt?",
                weak: "Hvorfor er det ikke aktuelt nå?",
                why: "Reframe innvending som lukket-spørsmål → svar gir deg veien tilbake."),
            Tip(category: .objection,
                strong: "Vanlig — vi har sett {konkret tall} hos {lignende kunde}.",
                weak: "Vi har gode løsninger og mye erfaring.",
                why: "Bevis > påstand. Tall + navn > adjektiver."),
            Tip(category: .price,
                strong: "Når du sier dyrt — hva sammenligner du oss med?",
                weak: "Skjønner, det er en investering vi snakker om.",
                why: "Avklar referansepunktet før du forsvarer prisen."),
            Tip(category: .price,
                strong: "Hva vil det koste dere å ikke løse dette i 6 mnd til?",
                weak: "Vi er ikke de billigste, men vi er kvalitet.",
                why: "Pålegg fremtidsverdi — ikke forsvar prisen."),
            Tip(category: .closing,
                strong: "Gir det mening om vi tar en kort prat torsdag kl 10?",
                weak: "Kunne vi hatt et møte en gang?",
                why: "Konkret tid → konkret svar. Vag tid → vag «kanskje»."),
            Tip(category: .closing,
                strong: "Hva er neste konkrete steg fra din side?",
                weak: "Vi tar kontakt om noen dager.",
                why: "Gi kunden eierskap til hva som skal skje neste — ikke deg.")
        ]
    }
}

// MARK: - PondusTeamUsageModal — full team-bruk modal

struct PondusTeamUsageModal: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var period: Period = .d30
    @State private var search: String = ""
    @State private var sort: SortField = .conversion
    @State private var selectedTemplate: PondusTemplateDTO?
    @State private var usageStats: PondusUsageStatsDTO?
    @State private var isLoadingStats = false

    enum Period: String, CaseIterable, Identifiable {
        case d7 = "7 dager"
        case d30 = "30 dager"
        case d90 = "90 dager"
        case ytd = "Hittil i år"
        var id: String { rawValue }
        var apiValue: String {
            switch self {
            case .d7: return "7d"
            case .d30: return "30d"
            case .d90: return "90d"
            case .ytd: return "ytd"
            }
        }
    }

    enum SortField: String, CaseIterable, Identifiable {
        case brukt = "Mest brukt"
        case svarrate = "Best svarrate"
        case moeterate = "Best møterate"
        case conversion = "Best konvertering"
        case name = "A–Å"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .brukt: return "person.2.fill"
            case .svarrate: return "arrow.uturn.left.circle.fill"
            case .moeterate: return "calendar.badge.checkmark"
            case .conversion: return "chart.line.uptrend.xyaxis"
            case .name: return "textformat"
            }
        }
    }

    // MARK: - Ekte data (2026-08-16) — PondusStore-maler + usage/stats(period:)
    // erstatter PondusData.templates-mocken. Ingen forrige-periode-delta:
    // backend sammenligner ikke mot forrige vindu, så trend-pilene fra
    // mockup-en er droppet i stedet for oppdiktet.

    private var statsByTemplate: [String: PondusTemplateUsageStatDTO] {
        Dictionary(uniqueKeysWithValues: (usageStats?.templates ?? []).map { ($0.templateId.lowercased(), $0) })
    }

    private func stat(for t: PondusTemplateDTO) -> PondusTemplateUsageStatDTO? {
        statsByTemplate[t.id.uuidString.lowercased()]
    }

    private var sortedTemplates: [PondusTemplateDTO] {
        let base = appState.pondusStore.templates
        let f = search.isEmpty ? base : base.filter { $0.name.localizedCaseInsensitiveContains(search) }
        switch sort {
        case .brukt:      return f.sorted { (stat(for: $0)?.usedTotal ?? 0) > (stat(for: $1)?.usedTotal ?? 0) }
        case .svarrate:   return f.sorted { (stat(for: $0)?.responseRate ?? 0) > (stat(for: $1)?.responseRate ?? 0) }
        case .moeterate:  return f.sorted { (stat(for: $0)?.meetingRate ?? 0) > (stat(for: $1)?.meetingRate ?? 0) }
        case .conversion: return f.sorted { (stat(for: $0)?.conversionRate ?? 0) > (stat(for: $1)?.conversionRate ?? 0) }
        case .name:       return f.sorted { $0.name < $1.name }
        }
    }

    /// Kun maler med logget bruk i perioden — snitt over 0-brukte ville
    /// dratt tallene urettferdig ned.
    private var usedTemplates: [(PondusTemplateDTO, PondusTemplateUsageStatDTO)] {
        appState.pondusStore.templates.compactMap { t in stat(for: t).map { (t, $0) } }.filter { $0.1.usedTotal > 0 }
    }

    private var totalUse: Int { usedTemplates.map(\.1.usedTotal).reduce(0, +) }
    private var avgResponse: Double {
        usedTemplates.isEmpty ? 0 : usedTemplates.map(\.1.responseRate).reduce(0, +) / Double(usedTemplates.count)
    }
    private var avgMeeting: Double {
        usedTemplates.isEmpty ? 0 : usedTemplates.map(\.1.meetingRate).reduce(0, +) / Double(usedTemplates.count)
    }
    private var avgConv: Double {
        usedTemplates.isEmpty ? 0 : usedTemplates.map(\.1.conversionRate).reduce(0, +) / Double(usedTemplates.count)
    }
    private var best: (PondusTemplateDTO, PondusTemplateUsageStatDTO)? {
        usedTemplates.max { $0.1.conversionRate < $1.1.conversionRate }
    }
    private var worst: (PondusTemplateDTO, PondusTemplateUsageStatDTO)? {
        usedTemplates.min { $0.1.conversionRate < $1.1.conversionRate }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        kpiRow
                        filterBar
                        if isLoadingStats && usageStats == nil {
                            ProgressView().tint(LBrand.purpleLight)
                                .frame(maxWidth: .infinity).padding(.vertical, 40)
                        } else {
                            tableHeader
                            VStack(spacing: 7) {
                                ForEach(sortedTemplates) { t in
                                    Button { selectedTemplate = t } label: { usageRow(t) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                        aiInsight
                        Color.clear.frame(height: 16)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Teamets bruk")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                // Eksport-menyen (CSV/PDF/Del rapport) fjernet 2026-07-17:
                // var døde knapper — ingen eksport-flate for bruksrapporten.
            }
            .task {
                await appState.pondusStore.load(
                    api: appState.api,
                    organizationId: appState.activeOrganizationId
                )
            }
            .task(id: period) { await loadStats() }
            .sheet(item: $selectedTemplate) { t in
                PondusDrillDownSheet(template: t, stat: stat(for: t))
            }
        }
    }

    private func loadStats() async {
        isLoadingStats = true
        defer { isLoadingStats = false }
        usageStats = try? await appState.api?.pondusUsageStats(period: period.apiValue)
    }

    private var kpiRow: some View {
        HStack(spacing: 12) {
            kpiTile("Total bruk", value: "\(totalUse)", icon: "person.2.fill", tint: LBrand.purpleLight)
            kpiTile("Gj. svarrate", value: percent(avgResponse), icon: "arrow.uturn.left.circle.fill", tint: LBrand.blue)
            kpiTile("Gj. møterate", value: percent(avgMeeting), icon: "calendar.badge.checkmark", tint: LBrand.orange)
            kpiTile("Gj. konv.", value: percent(avgConv), icon: "chart.line.uptrend.xyaxis", tint: LBrand.green)
        }
    }

    private func kpiTile(_ label: String, value: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 15, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(1).fixedSize()
                Text(value)
                    .font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.7).monospacedDigit()
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var filterBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk mal…", text: $search)
                    .foregroundStyle(.white).textFieldStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Menu {
                ForEach(SortField.allCases) { s in
                    Button { sort = s } label: { Label(s.rawValue, systemImage: s.icon) }
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: sort.icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.purpleLight)
                    Text(sort.rawValue).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
            Menu {
                ForEach(Period.allCases) { p in
                    Button { period = p } label: { Text(p.rawValue) }
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "calendar").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.orange)
                    Text(period.rawValue).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var tableHeader: some View {
        HStack(spacing: 0) {
            Text("MAL").frame(maxWidth: .infinity, alignment: .leading)
            Text("BRUK").frame(width: 70, alignment: .trailing)
            Text("SVARRATE").frame(width: 110, alignment: .trailing)
            Text("MØTERATE").frame(width: 110, alignment: .trailing)
            Text("KONV.").frame(width: 100, alignment: .trailing)
            Color.clear.frame(width: 14)
        }
        .font(.appScaled(size: 9, weight: .black)).tracking(0.5)
        .foregroundStyle(LBrand.textTertiary)
        .padding(.horizontal, 14).padding(.bottom, 2)
    }

    private func kindIcon(_ kind: String) -> String {
        switch PondusKind(rawValue: kind) {
        case .telephone: return "phone.fill"
        case .video: return "video.fill"
        case .email: return "envelope.fill"
        case .meeting: return "person.2.fill"
        case .field: return "figure.walk"
        case nil: return "doc.text.fill"
        }
    }

    private func usageRow(_ t: PondusTemplateDTO) -> some View {
        let s = stat(for: t)
        return HStack(spacing: 0) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(LBrand.purpleLight.opacity(0.22))
                    Image(systemName: kindIcon(t.kind))
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.name)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text("Score \(t.score)")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(LBrand.purpleLight)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(t.kind.capitalized)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(LBrand.textSecondary)
                    }
                    .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(s?.usedTotal ?? 0)")
                .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .frame(width: 70, alignment: .trailing)
            metricCell(s?.responseRate ?? 0).frame(width: 110, alignment: .trailing)
            metricCell(s?.meetingRate ?? 0).frame(width: 110, alignment: .trailing)
            metricCell(s?.conversionRate ?? 0).frame(width: 100, alignment: .trailing)
            Image(systemName: "chevron.right")
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(LBrand.textTertiary)
                .frame(width: 14)
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    /// Ingen trend-piler — backend sammenligner ikke mot forrige periode
    /// (se kommentar over `statsByTemplate`). Kun rå rate for perioden.
    private func metricCell(_ value: Double) -> some View {
        Text(percent(value))
            .font(.appScaled(size: 12, weight: .bold, design: .rounded))
            .foregroundStyle(.white).monospacedDigit()
            .lineLimit(1).fixedSize()
    }

    private var aiInsight: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "sparkles").foregroundStyle(LBrand.purpleLight)
                Text("AI-INSIKT").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                Spacer()
            }
            if let best, let worst, best.0.id != worst.0.id {
                (Text("Best presterende: ").foregroundStyle(LBrand.textSecondary)
                 + Text("\(best.0.name) ").foregroundStyle(.white).bold()
                 + Text("(\(percent(best.1.conversionRate)) konv.). ").foregroundStyle(LBrand.green)
                 + Text("Lavest: ").foregroundStyle(LBrand.textSecondary)
                 + Text(worst.0.name).foregroundStyle(.white).bold()
                 + Text(" — vurder å forsterke åpningsreplikken med kundecase-tall.").foregroundStyle(LBrand.textSecondary)
                )
                .font(.appScaled(size: 13))
            } else {
                Text("Ikke nok bruk logget i perioden ennå til å sammenligne maler.")
                    .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
            }
        }
        .padding(14)
        .background(LBrand.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
    }

    private func percent(_ v: Double) -> String {
        let p = v * 100
        if p.truncatingRemainder(dividingBy: 1) == 0 { return "\(Int(p)) %" }
        return String(format: "%.1f %%", p).replacingOccurrences(of: ".", with: ",")
    }
}

// MARK: - PondusDrillDownSheet (per-mal drill-down, 2026-08-16)

/// Erstatter EmptyView-placeholderen i PondusTeamUsageModal. Viser
/// utfalls-fordeling + per-selger + siste 20 logger for én mal, hentet
/// fra GET /pondus/templates/:id/usage-detail.
struct PondusDrillDownSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    let template: PondusTemplateDTO
    /// Fra samme usage/stats-kall PondusTeamUsageModal allerede gjorde —
    /// unngår å vente på et ekstra kall for tallene som allerede vises i
    /// tabellraden.
    let stat: PondusTemplateUsageStatDTO?

    @State private var detail: PondusTemplateUsageDetailDTO?
    @State private var isLoading = false
    @State private var loadError: String?

    private static let outcomeOrder = ["used", "meeting_booked", "proposal_sent", "won", "lost", "no_answer"]

    private func outcomeLabel(_ o: String) -> String {
        switch o {
        case "used": return "Brukt"
        case "meeting_booked": return "Møte booket"
        case "proposal_sent": return "Tilbud sendt"
        case "won": return "Vunnet"
        case "lost": return "Tapt"
        case "no_answer": return "Ikke svar"
        default: return o.capitalized
        }
    }

    private func outcomeColor(_ o: String) -> Color {
        switch o {
        case "won": return LBrand.green
        case "lost": return LBrand.red
        case "meeting_booked", "proposal_sent": return LBrand.blue
        case "no_answer": return LBrand.textTertiary
        default: return LBrand.purpleLight
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                if isLoading {
                    ProgressView().tint(LBrand.purpleLight)
                } else if let loadError {
                    VStack(spacing: 10) {
                        Text(loadError).font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                        Button("Prøv igjen") { Task { await load() } }
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(LBrand.purple, in: Capsule())
                    }
                } else if let detail {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            headerStats
                            outcomeSection(detail)
                            if !detail.bySeller.isEmpty { sellerSection(detail) }
                            if !detail.recent.isEmpty { recentSection(detail) }
                        }
                        .padding(20)
                    }
                } else {
                    Text("Ingen bruk logget for denne malen ennå.")
                        .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                }
            }
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        guard let result = await appState.pondusStore.usageDetail(templateId: template.id, api: appState.api) else {
            loadError = appState.pondusStore.lastError ?? "Kunne ikke hente detaljer."
            return
        }
        detail = result
    }

    private var headerStats: some View {
        HStack(spacing: 12) {
            statTile("Brukt", "\(stat?.usedTotal ?? 0)", LBrand.purpleLight)
            statTile("Svarrate", percentText(stat?.responseRate), LBrand.blue)
            statTile("Møterate", percentText(stat?.meetingRate), LBrand.orange)
            statTile("Konvertering", percentText(stat?.conversionRate), LBrand.green)
        }
    }

    private func statTile(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.appScaled(size: 16, weight: .black, design: .rounded)).foregroundStyle(tint)
            Text(label).font(.appScaled(size: 9)).foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }

    private func outcomeSection(_ d: PondusTemplateUsageDetailDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("UTFALLS-FORDELING")
            let total = max(1, d.outcomes.values.reduce(0, +))
            VStack(spacing: 6) {
                ForEach(Self.outcomeOrder.filter { (d.outcomes[$0] ?? 0) > 0 }, id: \.self) { o in
                    let n = d.outcomes[o] ?? 0
                    HStack {
                        Circle().fill(outcomeColor(o)).frame(width: 8, height: 8)
                        Text(outcomeLabel(o)).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                        Spacer()
                        Text("\(n) (\(Int(Double(n) / Double(total) * 100)) %)")
                            .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                    .padding(10).background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
    }

    private func sellerSection(_ d: PondusTemplateUsageDetailDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("PER SELGER")
            VStack(spacing: 6) {
                ForEach(d.bySeller) { row in
                    HStack {
                        Text(row.name).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        Spacer()
                        Text("\(row.used) brukt · \(row.meetings) møter")
                            .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                    .padding(10).background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
    }

    private func recentSection(_ d: PondusTemplateUsageDetailDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("SISTE LOGGER")
            VStack(spacing: 6) {
                ForEach(d.recent) { row in
                    HStack {
                        Circle().fill(outcomeColor(row.outcome)).frame(width: 7, height: 7)
                        Text(row.userName).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                        Spacer()
                        Text(outcomeLabel(row.outcome)).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                    .padding(10).background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
    }

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(.appScaled(size: 11, weight: .black)).foregroundStyle(LBrand.purpleLight).tracking(0.8)
    }

    private func percentText(_ v: Double?) -> String {
        guard let v else { return "—" }
        let p = v * 100
        return p.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(p)) %" : String(format: "%.1f %%", p)
    }
}
