import SwiftUI

// MARK: - Smart Edit panel

struct SmartEditPanel: View {
    @Bindable var model: RedigeringModel
    @State private var showSavePreset = false
    @State private var presetDraft = ""
    @State private var showSky = false
    @State private var toneOpen = true
    @State private var portraitOpen = true
    @State private var retouchOpen = true

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Label("Rediger", systemImage: "slider.horizontal.3")
                        .font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Text("Ikke-destruktivt · lagres automatisk")
                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
                Spacer()
                Button {
                    model.resetSelectedEdit()
                } label: {
                    Label("Nullstill", systemImage: "arrow.counterclockwise")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered).controlSize(.small).tint(CHTheme.textSecondary)
                .accessibilityIdentifier("redigering-reset")
            }
            VStack(alignment: .leading, spacing: 6) {
                Menu {
                    ForEach(model.availableCameraColorProfiles) { profile in
                        Button {
                            model.applyCameraColorProfile(profile.id)
                        } label: {
                            if profile.id == model.activeCameraColorProfile.id {
                                Label(profile.displayName, systemImage: "checkmark")
                            } else {
                                Text(profile.displayName)
                            }
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "camera.aperture")
                            .foregroundStyle(CHTheme.accent)
                        Text("Kameraprofil: \(model.activeCameraColorProfile.displayName)")
                            .foregroundStyle(CHTheme.textPrimary)
                        if model.activeCameraColorProfile.isBeta {
                            Text("BETA")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(CHTheme.accent)
                        }
                        Spacer()
                        Image(systemName: "chevron.down").foregroundStyle(CHTheme.textMuted)
                    }
                    .padding(10)
                    .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10))
                }
                .accessibilityIdentifier("redigering-camera-profile")

                Text(model.activeCameraColorProfile.detail)
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)

                if let camera = model.exif?.camera,
                   model.availableCameraColorProfiles.count == 1,
                   model.selected?.rawKey != nil {
                    Text("\(camera) er ikke kalibrert for CreatorHub matching ennå. Apple-profilen brukes trygt.")
                        .font(.caption2)
                        .foregroundStyle(CHTheme.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }
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
            DisclosureGroup(isExpanded: $toneOpen) {
                VStack(alignment: .leading, spacing: 13) {
                    slider("Eksponering", systemImage: "sun.max", value: $model.exposureEV, range: -2...2, unit: .ev)
                    slider("Høylys", systemImage: "sun.max.trianglebadge.exclamationmark", value: $model.recipe.highlightRecovery, range: 0...1, unit: .percent, inverted: true)
                    slider("Skygger", systemImage: "circle.bottomhalf.filled", value: $model.recipe.shadowLift, range: 0...1, unit: .percent)
                    slider("Kontrast", systemImage: "circle.lefthalf.filled", value: $model.recipe.contrast, range: -1...1, unit: .signedPercent)
                    slider("Fargetemperatur", systemImage: "thermometer.medium", value: $model.recipe.warmth, range: -1...1, unit: .signedPercent)
                    slider("Tint", systemImage: "slider.horizontal.below.square.filled.and.square", value: $model.recipe.tint, range: -1...1, unit: .signedPercent)
                    slider("Glød", systemImage: "drop.degreesign", value: $model.recipe.vibrance, range: -1...1, unit: .signedPercent)
                    slider("Metning", systemImage: "drop", value: $model.recipe.saturation, range: -1...1, unit: .signedPercent)
                    slider("Lilla kantfjerning", systemImage: "wand.and.rays", value: $model.recipe.defringe, range: 0...1, unit: .percent)
                    slider("Grønnkontroll", systemImage: "leaf", value: $model.recipe.greenControl, range: 0...1, unit: .percent)
                    slider("Tekstur", systemImage: "triangle", value: $model.recipe.texture, range: 0...1, unit: .percent)
                    toggleRow("Rett opp horisont", systemImage: "level", isOn: $model.recipe.autoStraighten)
                        .onChange(of: model.recipe.autoStraighten) { _, _ in model.recipeChanged() }
                }
                .padding(.top, 10)
            } label: {
                sectionLabel("Lys og farge", systemImage: "camera.filters")
            }
            .disabled(adjustmentsOff)
            .opacity(adjustmentsOff ? 0.45 : 1)

            DisclosureGroup(isExpanded: $portraitOpen) {
                VStack(alignment: .leading, spacing: 13) {
                    subjectTypeRow
                    Text("Bevarer identitet og tekstur. Alle effekter er reversible og maskeres til ansikt/hud.")
                        .font(.caption2).foregroundStyle(CHTheme.textMuted)
                    Button {
                        model.applyAdaptivePortraitTone()
                    } label: {
                        Label("Tilpass tone til motiv", systemImage: "person.crop.circle.badge.checkmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).tint(CHTheme.accent)
                    .disabled(model.selectedAnalysis?.hasFaces != true)
                    .accessibilityHint("Bruker målt ansiktslys, høylys og hudfarge og kan angres")
                    slider("Hudtone / fine linjer", systemImage: "aqi.medium", value: $model.recipe.skinLowFreq, range: -1...1, unit: .signedPercent)
                    slider("Porer og huddetalj", systemImage: "camera.macro", value: $model.recipe.skinHighFreq, range: -1...1, unit: .signedPercent)
                    slider("Små urenheter", systemImage: "bandage", value: $model.recipe.blemishCleanup, range: 0...1, unit: .percent)
                    slider("Dodge & burn", systemImage: "circle.lefthalf.filled", value: $model.recipe.dodgeBurn, range: 0...1, unit: .percent)
                    slider("Glans i hud", systemImage: "sun.max.trianglebadge.exclamationmark", value: $model.recipe.shineControl, range: 0...1, unit: .percent, inverted: true)
                    slider("Under øyne", systemImage: "eye.trianglebadge.exclamationmark", value: $model.recipe.underEyeLift, range: 0...1, unit: .percent)
                    slider("Naturlig hudfarge", systemImage: "shield.lefthalf.filled", value: $model.recipe.skinGuard, range: 0...1, unit: .percent)
                    slider("Ansikt og hals/kropp", systemImage: "person.crop.rectangle", value: $model.recipe.skinUnify, range: 0...1, unit: .percent)
                    slider("Motivseparasjon", systemImage: "person.crop.rectangle", value: $model.recipe.subjectSeparation, range: 0...1, unit: .percent)
                    slider("Beskytt makeup", systemImage: "paintpalette", value: $model.recipe.makeupProtection, range: 0...1, unit: .percent)
                    slider("Øyedetalj", systemImage: "eye", value: $model.recipe.eyeSharpen, range: 0...1, unit: .percent)
                    slider("Lys i øyne", systemImage: "sparkle", value: $model.recipe.eyeCatchlight, range: 0...1, unit: .percent)
                    slider("Tenner", systemImage: "mouth", value: $model.recipe.teethWhiten, range: 0...1, unit: .percent)
                    slider("Hår, klær og struktur", systemImage: "textile", value: $model.recipe.texture, range: 0...1, unit: .percent)
                    HStack(spacing: 7) {
                        Image(systemName: "person.crop.circle.badge.checkmark")
                        Text("Velg Personer i topplinjen for lys og varme per ansikt.")
                    }
                    .font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
                .padding(.top, 10)
            } label: {
                sectionLabel("Portrett", systemImage: "person.crop.circle")
                    .accessibilityLabel("Portrettinnstillinger")
            }
            .disabled(adjustmentsOff)
            .opacity(adjustmentsOff ? 0.45 : 1)

            Divider().overlay(CHTheme.border)

            // Ærlig tilstand: bryterne er INNSTILLINGER for AI-retusjen (kjøres når
            // du trykker «Kjør AI-retusj»), ikke noe som alt er utført.
            DisclosureGroup(isExpanded: $retouchOpen) {
                VStack(alignment: .leading, spacing: 12) {
                    aiRetouchHeader
                    toggleRow("Støvfjerning", systemImage: "sparkle", isOn: $model.dustRemoval)
                    toggleRow("Bakgrunnsrydd", systemImage: "scissors", isOn: $model.backgroundClean)
                    toggleRow("Fjern refleks", systemImage: "circle.dashed", isOn: $model.reflectionRemoval)
                        .onChange(of: model.reflectionRemoval) { _, _ in model.recipeChanged() }

                    aiAction("Kjør AI-retusj", subtitle: "Fjerner bare valgte distraksjoner. Originalen beholdes.",
                             systemImage: "wand.and.stars.inverse", prominent: false, busy: model.working) {
                        Task { await model.runAIRetouch() }
                    }
                    aiAction("AI-forbedring (sky)", subtitle: "Høyoppløst rekonstruksjon + støyreduksjon (server)",
                             systemImage: "cloud.bolt", prominent: false, busy: false,
                             disabled: model.selected == nil) { showSky = true }
                }
                .padding(.top, 10)
            } label: {
                sectionLabel("AI-retusj", systemImage: "wand.and.stars")
            }
            if model.hasLearnedStyle {
                learnedStylePicker
            }

            if let msg = model.statusMessage {
                Text(msg).font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
            aiAction("Lagre ferdig versjon", subtitle: "Rendrer valgt bilde i full oppløsning med samme lokale justeringer som preview.",
                     systemImage: "checkmark.circle", prominent: true, busy: model.working,
                     disabled: model.selected == nil) { Task { await model.persistSelected() } }
            aiAction("Bruk på serie", subtitle: "Bruk disse justeringene på alle \(model.assets.count) bildene i økten",
                     systemImage: "rectangle.on.rectangle", prominent: false, busy: model.working) { model.applyToSeries() }
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

    private func slider(
        _ title: String,
        systemImage: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        unit: SliderUnit,
        inverted: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label(title, systemImage: systemImage).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(displayValue(value.wrappedValue, unit: unit, inverted: inverted))
                    .font(.caption.monospacedDigit()).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: value, in: range) { editing in
                if editing { model.beginEdit() } else { model.recipeChanged() }
            }
            .tint(CHTheme.accent)
            .accessibilityIdentifier("redigering-slider-\(title.lowercased())")
        }
    }

    private func displayValue(_ v: Double, unit: SliderUnit, inverted: Bool = false) -> String {
        switch unit {
        case .ev: return String(format: "%+.2f EV", v)
        case .signedPercent: return String(format: "%+.0f", v * 100)
        case .percent:
            let amount = Int(v * 100)
            return inverted && amount > 0 ? "−\(amount) %" : "\(amount) %"
        }
    }

    private func sectionLabel(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CHTheme.textPrimary)
    }

    private var subjectTypeRow: some View {
        HStack {
            Label("Motiv", systemImage: "person.2").font(.subheadline).foregroundStyle(CHTheme.textPrimary)
            Spacer()
            Menu {
                Button("Automatisk") { setSubjectType(.none) }
                Button("Mann") { setSubjectType(.male) }
                Button("Kvinne") { setSubjectType(.female) }
                Button("Barn") { setSubjectType(.child) }
                Button("Eldre") { setSubjectType(.elderly) }
            } label: {
                Text(subjectTypeLabel).foregroundStyle(CHTheme.accentSoft)
                Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    private var subjectTypeLabel: String {
        switch model.recipe.subjectType {
        case .none: "Automatisk"
        case .male: "Mann"
        case .female: "Kvinne"
        case .child: "Barn"
        case .elderly: "Eldre"
        }
    }

    private func setSubjectType(_ type: MagicRecipe.SubjectType) {
        model.beginEdit()
        model.recipe.subjectType = type
        model.recipeChanged()
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
        return HStack {
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
