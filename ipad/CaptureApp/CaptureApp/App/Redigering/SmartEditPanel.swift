import SwiftUI

// MARK: - Smart Edit panel

struct SmartEditPanel: View {
    @Bindable var model: RedigeringModel
    @State private var showSavePreset = false
    @State private var presetDraft = ""
    @State private var showSky = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Smart Edit", systemImage: "sparkles").font(.headline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Image(systemName: "ellipsis").foregroundStyle(CHTheme.textMuted)
            }
            Menu {
                ForEach(RedigeringModel.presets, id: \.0) { name, r in
                    Button(name) { model.applyPreset(name, r) }
                }
            } label: {
                HStack {
                    Text("Preset: \(model.presetName)").foregroundStyle(CHTheme.textPrimary)
                    Spacer(); Image(systemName: "chevron.down").foregroundStyle(CHTheme.textMuted)
                }
                .padding(10).background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
            }

            let learnedActive = model.learnedStyleAuto || model.learnedStyleIndex != nil
            if learnedActive {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile").font(.caption2)
                    Text("Grunnjustering styrt av Min stil (lært)").font(.caption2)
                    Spacer()
                }
                .foregroundStyle(CHTheme.accent)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(CHTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            }
            // Server-gradet base: justeringene ville dobbelt-gradere → deaktivert.
            // Ærlig banner + handling (rediger originalen) i stedet for stille inerte
            // slidere.
            if model.serverGraded { serverGradedBanner }
            let adjustmentsOff = learnedActive || model.serverGraded
            VStack(alignment: .leading, spacing: 14) {
                slider("Eksponering", systemImage: "sun.max", value: $model.exposureEV, range: -2...2, unit: .ev)
                slider("Kontrast", systemImage: "circle.lefthalf.filled", value: $model.recipe.contrast, range: -1...1, unit: .signedPercent)
                slider("Skarphet", systemImage: "triangle", value: $model.recipe.texture, range: 0...1, unit: .percent)
                slider("Metning", systemImage: "drop", value: $model.recipe.saturation, range: -1...1, unit: .signedPercent)
                warmthRow
            }
            .disabled(adjustmentsOff)
            .opacity(adjustmentsOff ? 0.45 : 1)
            toggleRow("Rett opp horisont", systemImage: "level", isOn: $model.recipe.autoStraighten)
                .onChange(of: model.recipe.autoStraighten) { _, _ in model.recipeChanged() }
            Divider().overlay(CHTheme.border)

            // Ærlig tilstand: bryterne er INNSTILLINGER for AI-retusjen (kjøres når
            // du trykker «Kjør AI-retusj»), ikke noe som alt er utført.
            aiRetouchHeader
            toggleRow("Støvfjerning", systemImage: "sparkle", isOn: $model.dustRemoval)
            toggleRow("Bakgrunnsrydd", systemImage: "scissors", isOn: $model.backgroundClean)
            toggleRow("Fjern refleks", systemImage: "circle.dashed", isOn: $model.reflectionRemoval)
                .onChange(of: model.reflectionRemoval) { _, _ in model.recipeChanged() }
            if model.hasLearnedStyle {
                learnedStylePicker
            }

            aiAction("Kjør AI-retusj", subtitle: "Fjern støv, distraksjoner + rydd bakgrunn (valgene over)",
                     systemImage: "wand.and.stars.inverse", prominent: false, busy: model.working) {
                Task { await model.runAIRetouch() }
            }
            if let msg = model.statusMessage {
                Text(msg).font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
            aiAction("AI-forbedring (sky)", subtitle: "Høyoppløst rekonstruksjon + støyreduksjon (server)",
                     systemImage: "cloud.bolt", prominent: false, busy: false,
                     disabled: model.selected == nil) { showSky = true }
            aiAction("Bruk på serie", subtitle: "Bruk disse justeringene på alle \(model.assets.count) bildene i økten",
                     systemImage: "sparkles", prominent: true, busy: false) { model.applyToSeries() }
            aiAction("Lagre som preset", subtitle: nil,
                     systemImage: "bookmark", prominent: false, busy: false) { showSavePreset = true }

            HStack(spacing: 5) {
                Image(systemName: "lock.rotation").font(.caption2)
                Text("Endringer lagres automatisk · originalfilen røres ikke")
                    .font(.caption2)
            }
            .foregroundStyle(CHTheme.textMuted).padding(.top, 2)
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 16))
        .alert("Lagre preset", isPresented: $showSavePreset) {
            TextField("Navn", text: $presetDraft)
            Button("Lagre") { if !presetDraft.isEmpty { model.saveAsPreset(presetDraft); presetDraft = "" } }
            Button("Avbryt", role: .cancel) {}
        }
        .sheet(isPresented: $showSky) {
            if let asset = model.selected {
                SkyEnhanceView(asset: asset) { Task { await model.refreshSelected() } }
            }
        }
    }

    /// Standardiserte verdi-enheter (fotografene forventer EV/prosent, ikke
    /// interne modell-tall). `.ev` = ±X.XX EV · `.signedPercent` = ±100 ·
    /// `.percent` = 0–100 %.
    enum SliderUnit { case ev, signedPercent, percent }

    private func slider(_ title: String, systemImage: String, value: Binding<Double>, range: ClosedRange<Double>, unit: SliderUnit) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(displayValue(value.wrappedValue, unit: unit))
                    .font(.caption.monospacedDigit()).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: value, in: range) { editing in
                if editing { model.beginEdit() } else { model.recipeChanged() }
            }
            .tint(CHTheme.accent)
        }
    }

    private func displayValue(_ v: Double, unit: SliderUnit) -> String {
        switch unit {
        case .ev: return String(format: "%+.2f EV", v)
        case .signedPercent: return String(format: "%+.0f", v * 100)
        case .percent: return "\(Int(v * 100)) %"
        }
    }

    /// Banner når basen er server-forbedret: forklarer hvorfor justeringene er
    /// av, med en handling for å redigere originalen i stedet.
    private var serverGradedBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "cloud.bolt.fill").font(.caption2)
                Text("Justeringer deaktivert — bildet er server-forbedret.")
                    .font(.caption2)
                Spacer()
            }
            Button {
                model.toggleEditOriginal()
            } label: {
                Label("Rediger originalen i stedet", systemImage: "arrow.uturn.backward")
                    .font(.caption2.weight(.semibold))
            }
            .buttonStyle(.bordered).controlSize(.small).tint(.orange)
        }
        .foregroundStyle(.orange)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }

    private var warmthRow: some View {
        HStack {
            Label("Fargebalanse", systemImage: "thermometer.medium").font(.subheadline).foregroundStyle(CHTheme.textPrimary)
            Spacer()
            Menu {
                Button("Kald") { model.beginEdit(); model.recipe.warmth = -0.25; model.recipeChanged() }
                Button("Nøytral") { model.beginEdit(); model.recipe.warmth = 0; model.recipeChanged() }
                Button("Varm") { model.beginEdit(); model.recipe.warmth = 0.25; model.recipeChanged() }
            } label: {
                Text(model.recipe.warmth > 0.05 ? "Varm" : (model.recipe.warmth < -0.05 ? "Kald" : "Nøytral"))
                    .foregroundStyle(CHTheme.accentSoft)
                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    private func toggleRow(_ title: String, systemImage: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
        }
        .tint(CHTheme.accent)
    }

    /// Ærlig AI-retusj-tilstand: ikke kjørt / kjører / N fjernet.
    private var aiRetouchStatus: (text: String, color: Color) {
        if model.working { return ("kjører …", CHTheme.accent) }
        if model.selected?.autoCleanedKey != nil {
            let c = model.selected?.autoCleanedDetectionCount ?? 0
            return (c > 0 ? "\(c) fjernet" : "ingen funn", Color(hex: 0x2FD27A))
        }
        return ("ikke kjørt", CHTheme.textMuted)
    }

    private var aiRetouchHeader: some View {
        HStack {
            Label("AI-RETUSJ", systemImage: "wand.and.stars.inverse")
                .font(.caption2.weight(.bold)).foregroundStyle(CHTheme.textSecondary)
            Spacer()
            Text(aiRetouchStatus.text).font(.caption2.weight(.semibold))
                .foregroundStyle(aiRetouchStatus.color)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(aiRetouchStatus.color.opacity(0.15), in: Capsule())
        }
    }

    /// AI-handling med forklarende undertekst (hva den faktisk gjør).
    @ViewBuilder
    private func aiAction(_ title: String, subtitle: String?, systemImage: String,
                          prominent: Bool, busy: Bool, disabled: Bool = false,
                          action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Group {
                if prominent {
                    Button(action: action) { aiActionLabel(title, systemImage, busy) }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button(action: action) { aiActionLabel(title, systemImage, busy) }
                        .buttonStyle(.bordered)
                }
            }
            .controlSize(.large).tint(CHTheme.accent).disabled(busy || disabled)
            if let subtitle {
                Text(subtitle).font(.caption2).foregroundStyle(CHTheme.textMuted)
                    .padding(.leading, 2)
            }
        }
    }
    private func aiActionLabel(_ title: String, _ systemImage: String, _ busy: Bool) -> some View {
        HStack {
            if busy { ProgressView().controlSize(.small) }
            Label(title, systemImage: systemImage)
        }.frame(maxWidth: .infinity)
    }

    /// «Min stil (lært)» — velg blant fotografens arkiv-lærte, navngitte looker
    /// (fler-stil-profil), eller «Av». Påføres on-device oppå nøytral base.
    private var learnedStylePicker: some View {
        let names = model.learnedStyleNames
        let current: String = model.learnedStyleAuto
            ? "Auto"
            : (model.learnedStyleIndex.flatMap { names.indices.contains($0) ? names[$0] : nil } ?? "Av")
        let isOn = model.learnedStyleAuto || model.learnedStyleIndex != nil
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Min stil (lært)", systemImage: "brain.head.profile")
                    .font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Menu {
                    Button("Av") { model.learnedStyleIndex = nil; model.learnedStyleAuto = false; model.recipeChanged() }
                    Button("Auto (per bilde)") { model.learnedStyleAuto = true; model.learnedStyleIndex = nil; model.recipeChanged() }
                    ForEach(Array(names.enumerated()), id: \.offset) { i, name in
                        Button(name) { model.learnedStyleIndex = i; model.learnedStyleAuto = false; model.recipeChanged() }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(current).font(.subheadline.weight(.semibold))
                        Image(systemName: "chevron.up.chevron.down").font(.caption2)
                    }
                    .foregroundStyle(isOn ? CHTheme.accent : CHTheme.textMuted)
                }
            }
            // Pro motiv-maske (server BiRefNet/U²-Net) — driver den subjekt-beskyttede
            // løvverk-dempingen med en piksel-nøyaktig matte i stedet for on-device
            // Vision. Kun relevant når en lært stil er aktiv.
            if isOn {
                HStack {
                    Label("Pro motiv-maske (server)", systemImage: "person.crop.rectangle.badge.plus")
                        .font(.caption).foregroundStyle(CHTheme.textMuted)
                    Spacer()
                    if model.fetchingServerMatte {
                        ProgressView().controlSize(.small)
                    } else if model.useServerSubjectMatte && model.hasServerSubjectMatte {
                        Button("På ✓") { model.clearServerSubjectMatte() }
                            .font(.caption.weight(.semibold)).foregroundStyle(CHTheme.accent)
                    } else {
                        Button("Hent") { Task { await model.fetchServerSubjectMatte() } }
                            .font(.caption.weight(.semibold)).foregroundStyle(CHTheme.accent)
                    }
                }
            }
        }
    }
}

// MARK: - Queue thumb / step flow / info card

struct QueueThumb: View {
    let asset: Asset
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .bottomLeading) {
                Group {
                    if let path = asset.displayPreviewKey, let ui = UIImage(contentsOfFile: path) {
                        Image(uiImage: ui).resizable().scaledToFill()
                    } else {
                        ZStack { CHTheme.surfaceElevated; Image(systemName: "photo").foregroundStyle(CHTheme.textMuted) }
                    }
                }
                .frame(width: 92, height: 92).clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(selected ? CHTheme.accent : .clear, lineWidth: 2))

                if asset.signals.faceCount ?? 0 > 0 {
                    Text("AI").font(.system(size: 8, weight: .bold)).padding(.horizontal, 4).padding(.vertical, 1)
                        .background(CHTheme.accent.opacity(0.85), in: Capsule()).foregroundStyle(.white).padding(4)
                }
            }
            .overlay(alignment: .topTrailing) {
                if asset.rating >= 4 || asset.flaggedForClient {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(CHTheme.success)
                        .background(Circle().fill(.black.opacity(0.4))).padding(4)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct StepFlow: View {
    /// Steg 4 (Kvalitetssjekk) er fullført → flytt aktivt steg til Eksporter.
    var qualityDone = false
    /// Trykk på Kvalitetssjekk-steget → åpne review-listen.
    var onTapQuality: () -> Void = {}

    private let steps = ["Cull", "Preset", "AI Retusj", "Kvalitetssjekk", "Eksporter"]
    private let qualityStep = 3
    /// Aktivt steg: AI Retusj til kvalitetssjekk er kjørt, deretter Eksporter.
    private var current: Int { qualityDone ? 4 : 2 }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.offset) { idx, label in
                HStack(spacing: 6) {
                    if idx < current {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(CHTheme.success)
                    } else if idx == current {
                        Text("\(idx + 1)").font(.caption.weight(.bold)).foregroundStyle(.white)
                            .frame(width: 20, height: 20).background(Circle().fill(CHTheme.accent))
                    } else {
                        Text("\(idx + 1)").font(.caption).foregroundStyle(CHTheme.textMuted)
                            .frame(width: 20, height: 20).overlay(Circle().strokeBorder(CHTheme.border))
                    }
                    Text(label).font(.caption).foregroundStyle(idx <= current ? CHTheme.textPrimary : CHTheme.textMuted)
                }
                // Kvalitetssjekk-steget er en snarvei inn i review-listen.
                .contentShape(Rectangle())
                .onTapGesture { if idx == qualityStep { onTapQuality() } }
                if idx < steps.count - 1 { Image(systemName: "chevron.right").font(.caption2).foregroundStyle(CHTheme.textMuted).frame(maxWidth: .infinity) }
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }
}

struct InfoCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }
}
