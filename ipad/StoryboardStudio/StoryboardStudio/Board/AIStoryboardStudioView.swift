import SwiftUI
import UIKit
import AVKit

/// Artist-first AI-flate for aktivt shot. AI lager et nytt bildeunderlag;
/// Pencil-strøkene ligger fortsatt urørt over bildet i den eksisterende
/// Metal-canvasen.
enum StoryboardAIStyle: String, CaseIterable, Identifiable {
    case storyPencil = "story-pencil"
    case cinematic
    case noir
    case watercolor
    case graphicNovel = "graphic-novel"
    case photoreal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .storyPencil: return "Story Pencil"
        case .cinematic: return "Cinematic"
        case .noir: return "Noir"
        case .watercolor: return "Watercolor"
        case .graphicNovel: return "Graphic Novel"
        case .photoreal: return "Photoreal"
        }
    }

    var icon: String {
        switch self {
        case .storyPencil: return "pencil.and.scribble"
        case .cinematic: return "film.stack"
        case .noir: return "circle.lefthalf.filled"
        case .watercolor: return "paintpalette"
        case .graphicNovel: return "text.bubble"
        case .photoreal: return "camera.aperture"
        }
    }

    var accent: Color {
        switch self {
        case .storyPencil: return .purple
        case .cinematic: return .indigo
        case .noir: return .gray
        case .watercolor: return .cyan
        case .graphicNovel: return .orange
        case .photoreal: return .blue
        }
    }

    var promptNote: String {
        switch self {
        case .storyPencil:
            return "hand-drawn storyboard pencil sketch, confident graphite lines, grayscale value blocking, production storyboard, no text"
        case .cinematic:
            return "cinematic concept art, motivated lighting, filmic composition, realistic depth, production design detail, no text"
        case .noir:
            return "film noir storyboard, high contrast black and white, hard shadows, expressive silhouettes, dramatic practical light, no text"
        case .watercolor:
            return "expressive watercolor storyboard, visible paper texture, loose confident washes, selective detail, no text"
        case .graphicNovel:
            return "graphic novel storyboard, bold ink contours, controlled halftone shading, dynamic composition, no text, no captions"
        case .photoreal:
            return "photoreal cinematic film still, natural skin and materials, physically plausible lighting, restrained color grade, no text"
        }
    }
}

struct AIStoryboardStudioView: View {
    @ObservedObject var board: BoardState
    let projectId: String
    let sceneId: String
    let frameId: String

    @State private var directorNote: String
    @State private var selectedStyle: StoryboardAIStyle = .storyPencil
    @State private var highDefinition = false
    @State private var isGenerating = false
    @State private var selectingVersionID: String?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var videoConfig: StoryboardVideoConfig?
    @State private var selectedVideoModelID = "auto"
    @State private var videoDuration = 4
    @State private var isGeneratingVideo = false
    @State private var isSavingConsent = false
    @State private var videoStatusMessage: String?
    @State private var videoPlayer: AVPlayer?
    @State private var openingVideoVersionID: String?
    @State private var useManuscriptContext = true
    @State private var showContextDetails = true
    @State private var showPromptInspector = false
    @State private var showReferenceLibrary = false
    @Environment(\.dismiss) private var dismiss

    init(board: BoardState, projectId: String, sceneId: String, frameId: String,
         initialPrompt: String) {
        self.board = board
        self.projectId = projectId
        self.sceneId = sceneId
        self.frameId = frameId
        _directorNote = State(initialValue: initialPrompt)
    }

    private var scene: SceneSummary? {
        board.scenes.first { $0.id == sceneId }
    }

    private var frame: FrameSummary? {
        scene?.frames.first { $0.id == frameId }
    }

    private var cleanPrompt: String {
        directorNote.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var generationPrompt: String {
        if !cleanPrompt.isEmpty { return cleanPrompt }
        guard useManuscriptContext else { return "" }
        return frame?.description.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private var activeContext: StoryboardAIShotContext? {
        guard useManuscriptContext, let scene, let frame else { return nil }
        return StoryboardAIShotContext.build(
            manuscriptTitle: board.manuscript.title,
            scene: scene,
            frame: frame,
            directorNote: generationPrompt,
            styleProfileId: selectedStyle.id,
            visualStyle: "")
    }

    private var versions: [AIImageVersion] {
        frame?.aiImageVersions.sorted { $0.generatedAt > $1.generatedAt } ?? []
    }

    private var videoVersions: [AIVideoVersion] {
        frame?.aiVideoVersions.sorted { $0.generatedAt > $1.generatedAt } ?? []
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ScrollView {
                    VStack(spacing: 22) {
                        if isSimulatorDemo {
                            videoPanel
                        }
                        contextPanel
                        Group {
                            if proxy.size.width >= 860 {
                                HStack(alignment: .top, spacing: 22) {
                                    previewPanel.frame(maxWidth: .infinity)
                                    controlsPanel.frame(width: min(420, proxy.size.width * 0.4))
                                }
                            } else {
                                VStack(spacing: 22) {
                                    previewPanel
                                    controlsPanel
                                }
                            }
                        }
                        if !isSimulatorDemo {
                            videoPanel
                        }
                    }
                    .padding(24)
                }
                .background(BoardBrand.chrome)
            }
            .navigationTitle("AI Studio · Shot \(frame?.shotNumber ?? "")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Label("Artist-first", systemImage: "applepencil.and.scribble")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(BoardBrand.dim)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                        .foregroundStyle(.white)
                        .disabled(isGenerating || isGeneratingVideo)
                }
            }
        }
        .interactiveDismissDisabled(isGenerating || isGeneratingVideo)
        .task { await loadVideoConfig() }
        .onDisappear { videoPlayer?.pause() }
        .sheet(isPresented: $showPromptInspector) {
            if let scene, let frame, let context = activeContext {
                StoryboardPromptInspectorView(
                    projectId: projectId,
                    scene: scene,
                    frame: frame,
                    context: context,
                    userAction: generationPrompt,
                    videoModelID: activeVideoModel?.id
                        ?? videoConfig?.defaultModel
                        ?? "longcat-video-i2v")
            }
        }
        .sheet(isPresented: $showReferenceLibrary) {
            StoryboardReferenceLibraryView(
                projectId: projectId,
                activeSceneID: sceneId)
        }
        #if DEBUG
        .onAppear {
            if ProcessInfo.processInfo.environment["SB_PROMPT_INSPECTOR_DEMO"] == "1" {
                showPromptInspector = true
            }
            if ProcessInfo.processInfo.environment["SB_REFERENCE_LIBRARY_DEMO"] == "1" {
                showReferenceLibrary = true
            }
        }
        #endif
    }

    private var contextPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(BoardBrand.accent.opacity(0.18))
                    Image(systemName: "doc.text.magnifyingglass")
                        .foregroundStyle(BoardBrand.accent)
                }
                .frame(width: 42, height: 42)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("MANUSKONTEKST")
                            .font(.caption2.bold()).kerning(1.1)
                            .foregroundStyle(BoardBrand.label)
                        Text("SHOT CONTEXT V1")
                            .font(.caption2.bold())
                            .foregroundStyle(BoardBrand.accent)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(BoardBrand.accent.opacity(0.13), in: Capsule())
                    }
                    Text("Én kontekst for bilde og animasjon")
                        .font(.headline).foregroundStyle(.white)
                    Text("Scenehandling, karakterer, shotplan og naboshots følger samme versjon fra bilde til animasjon.")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
                Spacer()
                Toggle("", isOn: $useManuscriptContext)
                    .labelsHidden()
                    .tint(BoardBrand.accent)
                    .accessibilityLabel("Bruk manuskontekst")
                    .accessibilityIdentifier("storyboard.ai.context.toggle")
            }

            if useManuscriptContext, let context = activeContext {
                HStack(spacing: 8) {
                    Label("Koblet til bilde", systemImage: "photo.fill")
                    Label("Koblet til animasjon", systemImage: "play.rectangle.fill")
                    Spacer()
                    Button {
                        showPromptInspector = true
                    } label: {
                        Label("Prompt Inspector", systemImage: "slider.horizontal.3")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("storyboard.ai.prompt-inspector")
                    Button {
                        showReferenceLibrary = true
                    } label: {
                        Label("Referanser", systemImage: "square.grid.2x2")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("storyboard.ai.reference-library")
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            showContextDetails.toggle()
                        }
                    } label: {
                        Label(showContextDetails ? "Skjul" : "Vis kontekst",
                              systemImage: showContextDetails ? "chevron.up" : "chevron.down")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("storyboard.ai.context.details")
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(BoardBrand.dim)

                if showContextDetails {
                    Divider().overlay(BoardBrand.border)
                    LazyVGrid(
                        columns: [GridItem(.flexible()), GridItem(.flexible())],
                        alignment: .leading,
                        spacing: 12
                    ) {
                        contextDetail(
                            "SCENE",
                            value: context.sceneHeading,
                            secondary: [context.intExt, context.location, context.shotTimeOfDay]
                                .filter { !$0.isEmpty }.joined(separator: " · "),
                            icon: "film")
                        contextDetail(
                            "KARAKTERER",
                            value: context.characters.isEmpty
                                ? "Ingen markert" : context.characters.joined(separator: ", "),
                            secondary: "Identitet og garderobe skal holdes konsistent",
                            icon: "person.2.fill")
                        contextDetail(
                            "AKTIVT SHOT \(context.shotNumber)",
                            value: context.shotDescription,
                            secondary: [context.shotType,
                                        context.cameraAngle,
                                        context.lensMm.map { "\($0) mm" } ?? "",
                                        context.movement]
                                .filter { !$0.isEmpty }.joined(separator: " · "),
                            icon: "camera.fill")
                        contextDetail(
                            "KONTINUITET",
                            value: continuityLine(context),
                            secondary: "Forrige → aktivt → neste",
                            icon: "arrow.left.and.right")
                    }
                    Text(context.sceneAction.isEmpty
                         ? "Scenen mangler handlingsbeskrivelse i manuset. Shot-beskrivelsen brukes som hovedkontekst."
                         : context.sceneAction)
                        .font(.caption)
                        .foregroundStyle(BoardBrand.dim)
                        .lineLimit(3)
                        .padding(11)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 9))
                        .accessibilityIdentifier("storyboard.ai.context.action")
                }
            } else {
                Label("Av: full manuskontekst og naboshots utelates; regissørnotatet brukes som hovedprompt.",
                      systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(.orange)
            }
        }
        .padding(18)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(
            useManuscriptContext ? BoardBrand.accent.opacity(0.35) : BoardBrand.border))
        .accessibilityIdentifier("storyboard.ai.context.panel")
    }

    private func contextDetail(
        _ label: String,
        value: String,
        secondary: String,
        icon: String
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(BoardBrand.accent)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.caption2.bold()).kerning(0.7)
                    .foregroundStyle(BoardBrand.label)
                Text(value.isEmpty ? "Ikke satt" : value)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .lineLimit(2)
                if !secondary.isEmpty {
                    Text(secondary).font(.caption2).foregroundStyle(BoardBrand.dim)
                        .lineLimit(2)
                }
            }
        }
    }

    private func continuityLine(_ context: StoryboardAIShotContext) -> String {
        let previous = context.previous.map { "\($0.shotNumber): \($0.description)" }
            ?? "Start på scenen"
        let next = context.next.map { "\($0.shotNumber): \($0.description)" }
            ?? "Slutt på scenen"
        return "\(previous)  →  \(next)"
    }

    private var previewPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(scene?.heading ?? "Aktiv scene")
                        .font(.headline).foregroundStyle(.white)
                    Text(frameContextLine)
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
                Spacer()
                if frame?.imageSource == "ai-generated" {
                    Label("AI-underlag", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(BoardBrand.accent)
                }
            }

            ZStack {
                RoundedRectangle(cornerRadius: 14)
                    .fill(BoardBrand.sheet)
                AIStoredImageView(imageURL: frame?.imageUrl)
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(6)
                if frame?.imageUrl == nil {
                    VStack(spacing: 10) {
                        Image(systemName: "rectangle.dashed")
                            .font(.system(size: 34, weight: .light))
                        Text("Generer et underlag, og tegn videre med Pencil")
                            .font(.subheadline.weight(.medium))
                    }
                    .foregroundStyle(BoardBrand.inkOnSheet.opacity(0.55))
                }
                if isGenerating {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.black.opacity(0.58))
                    VStack(spacing: 12) {
                        ProgressView().tint(.white).controlSize(.large)
                        Text("Bygger storyboard-framen …")
                            .font(.headline).foregroundStyle(.white)
                        Text("Scene, shot og stil sendes sikkert via prosjektets backend.")
                            .font(.caption).foregroundStyle(.white.opacity(0.68))
                    }
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(BoardBrand.border))

            HStack(spacing: 8) {
                contextChip(frame?.shotType, icon: "camera")
                contextChip(frame?.lensMm.map { "\($0) mm" }, icon: "camera.aperture")
                contextChip(frame?.movement, icon: "arrow.triangle.2.circlepath")
                contextChip(activeContext?.characters.isEmpty == false
                    ? activeContext?.characters.joined(separator: ", ") : nil,
                    icon: "person.2")
            }

            if !versions.isEmpty {
                Divider().overlay(BoardBrand.border)
                HStack {
                    Text("VERSJONER")
                        .font(.caption2.bold()).kerning(1.1)
                        .foregroundStyle(BoardBrand.label)
                    Spacer()
                    Text("\(versions.count) lagret")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(versions) { version in
                            versionButton(version)
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(BoardBrand.border))
    }

    private var controlsPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Label("Regissørens intensjon", systemImage: "text.quote")
                    .font(.headline).foregroundStyle(.white)
                Text("Beskriv handling, komposisjon, lys og følelsen i akkurat dette shotet.")
                    .font(.caption).foregroundStyle(BoardBrand.dim)
                TextEditor(text: $directorNote)
                    .font(.system(size: 15))
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .padding(10)
                    .frame(minHeight: 132)
                    .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(BoardBrand.border))
                    .onChange(of: directorNote) {
                        if directorNote.count > 1_200 {
                            directorNote = String(directorNote.prefix(1_200))
                        }
                    }
                HStack {
                    Spacer()
                    Text("\(directorNote.count)/1200")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(BoardBrand.label)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Label("Visuell stil", systemImage: "paintpalette")
                    .font(.headline).foregroundStyle(.white)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                    ForEach(StoryboardAIStyle.allCases) { style in
                        styleButton(style)
                    }
                }
            }

            Toggle(isOn: $highDefinition) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("HD-kvalitet").font(.subheadline.weight(.semibold))
                    Text("Mer detalj, men høyere genereringskostnad")
                        .font(.caption2).foregroundStyle(BoardBrand.dim)
                }
                .foregroundStyle(.white)
            }
            .tint(BoardBrand.accent)

            imageAccessPanel

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption).foregroundStyle(.red)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            }
            if let successMessage {
                Label(successMessage, systemImage: "checkmark.circle.fill")
                    .font(.caption).foregroundStyle(.green)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            }

            Button { generate() } label: {
                HStack {
                    if isGenerating { ProgressView().tint(.white) }
                    Image(systemName: versions.isEmpty ? "sparkles" : "arrow.clockwise")
                    Text(versions.isEmpty ? "Generer storyboard-bilde" : "Lag ny versjon")
                        .fontWeight(.bold)
                    Spacer()
                    Text(imageChargeLabel)
                        .font(.caption2.bold()).kerning(0.7)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16).padding(.vertical, 14)
                .background(
                    LinearGradient(colors: [BoardBrand.accent, .indigo],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(!canGenerateImage)
            .opacity(canGenerateImage ? 1 : 0.48)

            Label("Bildet blir underlaget i den aktive framen. Eksisterende Pencil-strøk, kommentarer og shot-metadata beholdes.",
                  systemImage: "layers")
                .font(.caption).foregroundStyle(BoardBrand.dim)
        }
        .padding(18)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(BoardBrand.border))
    }

    private var activeVideoModel: StoryboardVideoModelOption? {
        guard let videoConfig else { return nil }
        let key = selectedVideoModelID == "auto"
            ? videoConfig.defaultModel : selectedVideoModelID
        return videoConfig.models.first { $0.id == key && $0.configured }
    }

    private var estimatedVideoCost: Double {
        Double(videoDuration) * (activeVideoModel?.costPerSecondUSD ?? 0)
            * (videoConfig?.billingMultiplier ?? 1)
    }

    private var isSimulatorDemo: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["SB_AI_VIDEO_DEMO"] == "1"
        #else
        false
        #endif
    }

    private var hasStoredSourceImage: Bool {
        isSimulatorDemo || StorageDownloadPath.fileID(from: frame?.imageUrl) != nil
    }

    private var canGenerateImage: Bool {
        guard let videoConfig else { return false }
        return videoConfig.enabled && videoConfig.allowed
            && videoConfig.imageConfigured && videoConfig.consented
            && !generationPrompt.isEmpty && !isGenerating && !isGeneratingVideo
    }

    private var imageChargeLabel: String {
        guard let videoConfig else { return highDefinition ? "HD" : "STANDARD" }
        if videoConfig.billingMultiplier == 0 {
            return highDefinition ? "HD · INKLUDERT" : "STANDARD · INKLUDERT"
        }
        let charge = highDefinition
            ? videoConfig.imageHDChargeUSD : videoConfig.imageStandardChargeUSD
        return String(format: "%@ · ≤ $%.2f", highDefinition ? "HD" : "STANDARD", charge)
    }

    @ViewBuilder
    private var imageAccessPanel: some View {
        if let videoConfig {
            if !videoConfig.enabled || !videoConfig.allowed {
                Label("AI-bilder er ikke aktivert for denne kontoen.", systemImage: "lock.fill")
                    .font(.caption).foregroundStyle(BoardBrand.dim)
            } else if !videoConfig.imageConfigured {
                Label("Bildeleverandøren er ikke konfigurert på serveren.",
                      systemImage: "externaldrive.badge.exclamationmark")
                    .font(.caption).foregroundStyle(BoardBrand.dim)
            } else if !videoConfig.consented {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "hand.raised.fill").foregroundStyle(.orange)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Samtykke kreves").font(.subheadline.weight(.semibold))
                        Text("Konteksten som vises over sendes til OpenAI GPT‑Image‑2. For animasjon sendes bildet og samme avgrensede kontekst til valgt videoleverandør. Andre prosjektfiler deles ikke.")
                            .font(.caption).foregroundStyle(BoardBrand.dim)
                    }
                    Spacer()
                    Button(isSavingConsent ? "Lagrer …" : "Godta") { grantAIConsent() }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)
                        .disabled(isSavingConsent)
                }
                .foregroundStyle(.white)
                .padding(12)
                .background(Color.orange.opacity(0.09), in: RoundedRectangle(cornerRadius: 10))
            }
        } else {
            HStack(spacing: 10) {
                ProgressView().tint(.white)
                Text("Henter AI-tilgang og kostnadsvern …")
                    .font(.caption).foregroundStyle(BoardBrand.dim)
            }
        }
    }

    private var canGenerateVideo: Bool {
        guard let videoConfig else { return false }
        return videoConfig.enabled && videoConfig.allowed && videoConfig.consented
            && activeVideoModel != nil && hasStoredSourceImage
            && !generationPrompt.isEmpty && !isGenerating && !isGeneratingVideo
    }

    private var videoPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Animer shot", systemImage: "play.rectangle.fill")
                        .font(.headline).foregroundStyle(.white)
                    Text("Lag en kort 720p-bevegelsestest med shotets manuskontekst.")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
                Spacer()
                if activeVideoModel != nil {
                    Text(videoConfig?.billingMultiplier == 0
                         ? "Inkludert"
                         : String(format: "belastning ca. $%.2f", estimatedVideoCost))
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(BoardBrand.accent)
                }
            }

            if let videoPlayer {
                VideoPlayer(player: videoPlayer)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(BoardBrand.border))
            }

            if !videoVersions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("VIDEO-VERSJONER")
                        .font(.caption2.bold()).kerning(1.1)
                        .foregroundStyle(BoardBrand.label)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(videoVersions) { version in
                                Button { openVideo(version) } label: {
                                    HStack(spacing: 7) {
                                        if openingVideoVersionID == version.id {
                                            ProgressView().tint(.white)
                                        } else {
                                            Image(systemName: "play.fill")
                                        }
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(version.label).lineLimit(1)
                                            Text("\(version.duration) s · \(version.provider)")
                                                .font(.caption2).foregroundStyle(BoardBrand.dim)
                                        }
                                    }
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 11).padding(.vertical, 9)
                                    .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 9))
                                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(BoardBrand.border))
                                }
                                .buttonStyle(.plain)
                                .disabled(isGeneratingVideo || openingVideoVersionID != nil)
                            }
                        }
                    }
                }
            }

            Divider().overlay(BoardBrand.border)

            if let videoConfig {
                if !videoConfig.enabled || !videoConfig.allowed {
                    Label("AI-video er ikke aktivert for denne kontoen ennå.",
                          systemImage: "lock.fill")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                } else {
                    HStack(spacing: 14) {
                        Picker("Modell", selection: $selectedVideoModelID) {
                            Text("Auto · billigst").tag("auto")
                            ForEach(videoConfig.models.filter(\.configured)) { model in
                                Text(model.label).tag(model.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.white)

                        Picker("Lengde", selection: $videoDuration) {
                            ForEach([4, 6, 8], id: \.self) { seconds in
                                Text("\(seconds) sek").tag(seconds)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 280)
                    }

                    if !videoConfig.consented {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "hand.raised.fill")
                                .foregroundStyle(.orange)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Samtykke kreves").font(.subheadline.weight(.semibold))
                                Text("Shot-bildet og den viste manuskonteksten sendes til valgt ekstern AI-modell. Andre prosjektfiler deles ikke.")
                                    .font(.caption).foregroundStyle(BoardBrand.dim)
                            }
                            Spacer()
                            Button(isSavingConsent ? "Lagrer …" : "Godta") { grantAIConsent() }
                                .buttonStyle(.borderedProminent)
                                .tint(.orange)
                                .disabled(isSavingConsent)
                        }
                        .foregroundStyle(.white)
                        .padding(12)
                        .background(Color.orange.opacity(0.09), in: RoundedRectangle(cornerRadius: 10))
                    }

                    if !hasStoredSourceImage {
                        Label("Generer eller last opp bildet først. Video krever at kildebildet er lagret på dette shotet.",
                              systemImage: "externaldrive.badge.exclamationmark")
                            .font(.caption).foregroundStyle(BoardBrand.dim)
                    }

                    Button { generateVideo() } label: {
                        HStack {
                            if isGeneratingVideo { ProgressView().tint(.white) }
                            Image(systemName: "wand.and.stars")
                            Text(isGeneratingVideo ? "Animerer shot …"
                                 : selectedVideoModelID == "auto"
                                    ? "Animer med billigste modell"
                                    : "Animer med valgt modell")
                                .fontWeight(.bold)
                            Spacer()
                            Text("\(videoDuration) S")
                                .font(.caption2.bold()).kerning(0.7)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 14)
                        .background(
                            LinearGradient(colors: [.indigo, BoardBrand.accent],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canGenerateVideo)
                    .opacity(canGenerateVideo ? 1 : 0.48)
                }
            } else {
                HStack(spacing: 10) {
                    ProgressView().tint(.white)
                    Text("Henter tilgjengelige videomodeller …")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
            }

            if let videoStatusMessage {
                Label(videoStatusMessage,
                      systemImage: isGeneratingVideo ? "clock.arrow.circlepath" : "film")
                    .font(.caption).foregroundStyle(BoardBrand.dim)
            }
        }
        .padding(18)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(BoardBrand.border))
    }

    @MainActor
    private func loadVideoConfig(openLatest: Bool = true) async {
        if isSimulatorDemo {
            videoConfig = StoryboardVideoConfig(
                enabled: true,
                allowed: true,
                imageConfigured: true,
                billingMode: "free_whitelist",
                billingMultiplier: 0,
                imageStandardChargeUSD: 0,
                imageHDChargeUSD: 0,
                consented: true,
                defaultModel: "longcat-video-i2v",
                models: [
                    StoryboardVideoModelOption(
                        id: "longcat-video-i2v",
                        label: "LongCat 720p · rimelig",
                        provider: "longcat", gateway: "fal.ai",
                        costPerSecondUSD: 0.04, configured: true),
                    StoryboardVideoModelOption(
                        id: "seedance-2-i2v",
                        label: "Seedance 2 Fast · kvalitet",
                        provider: "bytedance", gateway: "fal.ai",
                        costPerSecondUSD: 0.2419, configured: true),
                    StoryboardVideoModelOption(
                        id: "higgsfield-dop-i2v",
                        label: "Higgsfield DoP · kinematisk",
                        provider: "higgsfield", gateway: "higgsfield",
                        costPerSecondUSD: 0.10, configured: false),
                ])
            return
        }
        do {
            let config = try await RoleRoomAPIClient.shared
                .fetchStoryboardVideoConfig(projectId: projectId)
            videoConfig = config
            if openLatest, videoPlayer == nil, let latest = videoVersions.first {
                await openVideoNow(latest)
            }
        } catch {
            videoStatusMessage = "AI-oppsettet kunne ikke lastes: \(error.localizedDescription)"
        }
    }

    private func grantAIConsent() {
        guard !isSavingConsent else { return }
        isSavingConsent = true
        Task {
            do {
                try await RoleRoomAPIClient.shared
                    .setStoryboardAIConsent(projectId: projectId, consented: true)
                await loadVideoConfig(openLatest: false)
                videoStatusMessage = "Samtykke lagret for prosjektet."
            } catch {
                errorMessage = error.localizedDescription
            }
            isSavingConsent = false
        }
    }

    private func generateVideo() {
        guard let scene, let frame, let imagePath = frame.imageUrl,
              canGenerateVideo else { return }
        isGeneratingVideo = true
        errorMessage = nil
        successMessage = nil
        videoStatusMessage = "Sender shotet til \(activeVideoModel?.label ?? "valgt modell") …"
        let requestedModel = selectedVideoModelID
        let requestedDuration = videoDuration
        let prompt = generationPrompt
        let context = activeContext
        Task {
            do {
                var job = try await RoleRoomAPIClient.shared.generateStoryboardVideo(
                    projectId: projectId,
                    sceneId: scene.id,
                    frameId: frame.id,
                    title: "\(scene.heading) · Shot \(frame.shotNumber)",
                    sourceImagePath: imagePath,
                    prompt: prompt,
                    model: requestedModel,
                    duration: requestedDuration,
                    context: context)
                // Lagre jobbreferansen med én gang. Hvis appen lukkes mens
                // provideren jobber, kan versjonen åpnes og pollingen fortsette.
                let modelLabel = videoConfig?.models.first { $0.id == job.model }?.label ?? job.model
                let version = AIVideoVersion(
                    id: job.jobId,
                    modelID: job.model,
                    provider: job.provider,
                    label: modelLabel,
                    prompt: job.prompt,
                    duration: job.duration,
                    generatedAt: ISO8601DateFormatter().string(from: Date()))
                var allVersions = Array(frame.aiVideoVersions
                    .filter { $0.id != version.id }.suffix(11))
                allVersions.append(version)
                try await board.patchFrameNow(frameId: frame.id, fields: [
                    "aiVideoVersions": allVersions.map(\.dictionary),
                    "activeAIVideoVersionId": version.id,
                ])
                videoStatusMessage = "Jobben kjører hos \(job.provider). Dette kan ta noen minutter."
                for _ in 0..<60 where job.status != "completed" && job.status != "failed" {
                    try await Task.sleep(nanoseconds: 5_000_000_000)
                    try Task.checkCancellation()
                    job = try await RoleRoomAPIClient.shared.pollStoryboardVideoJob(
                        projectId: projectId, jobId: job.jobId)
                }
                if job.status == "failed" {
                    throw SyncError.remote(job.error ?? "AI-videoen feilet hos leverandøren.")
                }
                guard job.status == "completed", let url = job.videoURL else {
                    throw SyncError.remote("Videoen bruker lengre tid enn ventet. Åpne videoversjonen igjen om litt.")
                }
                let player = AVPlayer(url: url)
                videoPlayer = player
                player.play()
                if videoConfig?.billingMultiplier == 0 {
                    videoStatusMessage = "Video lagret · \(job.duration) s · inkludert"
                } else {
                    let charge = Double(job.duration)
                        * (activeVideoModel?.costPerSecondUSD ?? 0)
                        * (videoConfig?.billingMultiplier ?? 1)
                    videoStatusMessage = "Video lagret · \(job.duration) s · belastning ca. $\(String(format: "%.2f", charge))"
                }
                successMessage = "Ny videoversjon er lagret på shot \(frame.shotNumber)."
            } catch is CancellationError {
                videoStatusMessage = "Videogenereringen ble avbrutt."
            } catch {
                errorMessage = error.localizedDescription
                videoStatusMessage = nil
            }
            isGeneratingVideo = false
        }
    }

    private func openVideo(_ version: AIVideoVersion) {
        guard openingVideoVersionID == nil else { return }
        Task { await openVideoNow(version) }
    }

    @MainActor
    private func openVideoNow(_ version: AIVideoVersion) async {
        openingVideoVersionID = version.id
        do {
            let job = try await RoleRoomAPIClient.shared.pollStoryboardVideoJob(
                projectId: projectId, jobId: version.id)
            if job.status == "running" || job.status == "queued" {
                videoStatusMessage = "\(version.label) jobber fortsatt. Prøv igjen om litt."
                openingVideoVersionID = nil
                return
            }
            guard job.status == "completed", let url = job.videoURL else {
                throw SyncError.remote(job.error ?? "Videoversjonen er ikke klar ennå.")
            }
            let player = AVPlayer(url: url)
            videoPlayer = player
            player.play()
            videoStatusMessage = "Spiller \(version.label) · \(version.duration) s"
        } catch {
            errorMessage = error.localizedDescription
        }
        openingVideoVersionID = nil
    }

    private var frameContextLine: String {
        let parts = [
            scene?.intExt,
            scene?.location,
            frame?.timeOfDay ?? scene?.timeOfDay,
            frame?.shotType,
        ].compactMap { value in
            value?.trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Shot-kontekst følger framen" : parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func contextChip(_ value: String?, icon: String) -> some View {
        if let value, !value.isEmpty {
            Label(value, systemImage: icon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(BoardBrand.dim)
                .lineLimit(1)
                .padding(.horizontal, 9).padding(.vertical, 6)
                .background(Color.white.opacity(0.05), in: Capsule())
        }
    }

    private func styleButton(_ style: StoryboardAIStyle) -> some View {
        let selected = selectedStyle == style
        return Button { selectedStyle = style } label: {
            HStack(spacing: 8) {
                Image(systemName: style.icon)
                    .frame(width: 17)
                    .foregroundStyle(selected ? .white : style.accent)
                Text(style.title).lineLimit(1)
                Spacer(minLength: 0)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(selected ? .white : BoardBrand.dim)
            .padding(.horizontal, 10).padding(.vertical, 10)
            .background(selected ? style.accent.opacity(0.72) : Color.white.opacity(0.04),
                        in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(selected ? style.accent : BoardBrand.border))
        }
        .buttonStyle(.plain)
    }

    private func versionButton(_ version: AIImageVersion) -> some View {
        let active = frame?.imageUrl == version.imageURL
        return Button { activate(version) } label: {
            VStack(alignment: .leading, spacing: 6) {
                AIStoredImageView(imageURL: version.imageURL)
                    .scaledToFill()
                    .frame(width: 142, height: 80)
                    .clipped()
                    .overlay {
                        if selectingVersionID == version.id {
                            Color.black.opacity(0.48).overlay(ProgressView().tint(.white))
                        }
                    }
                HStack {
                    Text(StoryboardAIStyle(rawValue: version.styleID)?.title ?? "AI")
                        .lineLimit(1)
                    Spacer()
                    if active { Image(systemName: "checkmark.circle.fill") }
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(active ? BoardBrand.accent : BoardBrand.dim)
                .padding(.horizontal, 4)
            }
            .padding(5)
            .background(Color.white.opacity(active ? 0.08 : 0.035),
                        in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(active ? BoardBrand.accent : BoardBrand.border,
                        lineWidth: active ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .disabled(isGenerating || selectingVersionID != nil || active)
        .accessibilityLabel(active ? "Aktiv bildeversjon" : "Bruk denne bildeversjonen")
    }

    private func generate() {
        guard let scene, let frame, canGenerateImage else { return }
        isGenerating = true
        errorMessage = nil
        successMessage = nil
        let style = selectedStyle
        let prompt = generationPrompt
        let context = activeContext
        Task {
            do {
                let generated = try await RoleRoomAPIClient.shared.generateStoryboardImage(
                    projectId: projectId,
                    sceneId: scene.id,
                    frameId: frame.id,
                    title: "\(scene.heading) · Shot \(frame.shotNumber)",
                    prompt: prompt,
                    sceneDescription: useManuscriptContext
                        ? (context?.legacySceneDescription
                            ?? String((scene.descriptionText ?? frame.description).prefix(2_000)))
                        : "",
                    intExt: useManuscriptContext ? scene.intExt : nil,
                    timeOfDay: useManuscriptContext ? (frame.timeOfDay ?? scene.timeOfDay) : nil,
                    locationName: useManuscriptContext ? (frame.setLocation ?? scene.location) : nil,
                    shotType: useManuscriptContext ? frame.shotType : nil,
                    styleNote: style.promptNote,
                    quality: highDefinition ? "hd" : "standard",
                    context: context)
                guard let image = decodeDataURL(generated.imageDataURL),
                      let jpegDataURL = NativeBoardView.jpegDataURL(
                        image, maxSide: 1792, quality: highDefinition ? 0.9 : 0.82) else {
                    throw SyncError.malformed("bildeformat")
                }
                let storedURL = await NativeBoardView.uploadOrInline(
                    dataURL: jpegDataURL,
                    name: "\(board.manuscript.title)-scene-\(scene.id)-shot-\(frame.shotNumber)-ai.jpg",
                    board: board,
                    sceneId: scene.id,
                    entityType: "storyboard_frame",
                    entityId: frame.id,
                    note: "AI Studio · \(style.title)")
                let version = AIImageVersion(
                    id: UUID().uuidString,
                    imageURL: storedURL,
                    prompt: generated.composedPrompt,
                    styleID: style.id,
                    generatedAt: ISO8601DateFormatter().string(from: Date()),
                    revisedPrompt: generated.revisedPrompt)
                var allVersions = Array(frame.aiImageVersions.suffix(11))
                allVersions.append(version)
                var fields: [String: any Sendable] = [
                    "imageUrl": storedURL,
                    "imageSource": "ai-generated",
                    "aiImageVersions": allVersions.map(\.dictionary),
                    "activeAIImageVersionId": version.id,
                    "aiPrompt": generated.composedPrompt,
                    "aiGeneratedAt": version.generatedAt,
                ]
                if let revisedPrompt = generated.revisedPrompt {
                    fields["aiRevisedPrompt"] = revisedPrompt
                }
                if let context {
                    fields["aiContextVersion"] = StoryboardAIShotContext.currentVersion
                    fields["aiContextSummary"] = context.summary
                    if let snapshot = context.serializedJSON {
                        fields["aiContextSnapshot"] = snapshot
                    }
                }
                if let fingerprint = generated.contextFingerprint {
                    fields["aiContextFingerprint"] = fingerprint
                }
                if let animationPrompt = generated.animationPrompt {
                    fields["aiAnimationPrompt"] = animationPrompt
                }
                try await board.patchFrameNow(frameId: frame.id, fields: fields)
                FrameImageCache.images[storedURL] = image
                successMessage = "Ny versjon er lagret på shot \(frame.shotNumber). Tegn videre i Board."
            } catch {
                errorMessage = error.localizedDescription
            }
            isGenerating = false
        }
    }

    private func activate(_ version: AIImageVersion) {
        guard selectingVersionID == nil else { return }
        selectingVersionID = version.id
        errorMessage = nil
        Task {
            do {
                try await board.patchFrameNow(frameId: frameId, fields: [
                    "imageUrl": version.imageURL,
                    "imageSource": "ai-generated",
                    "activeAIImageVersionId": version.id,
                ])
                successMessage = "Valgt versjon er aktiv på shotet."
            } catch {
                errorMessage = error.localizedDescription
            }
            selectingVersionID = nil
        }
    }
}

private struct StoryboardPromptInspectorView: View {
    let projectId: String
    let scene: SceneSummary
    let frame: FrameSummary
    let context: StoryboardAIShotContext
    let userAction: String
    let videoModelID: String

    @State private var mode = "storyboard-image"
    @State private var result: StoryboardPromptEngineResult?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    private var selectedModelID: String {
        mode == "storyboard-image" ? "gpt-image-2" : videoModelID
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Picker("Output", selection: $mode) {
                        Text("Bilde").tag("storyboard-image")
                        Text("Animasjon").tag("storyboard-video")
                    }
                    .pickerStyle(.segmented)

                    if isLoading {
                        HStack(spacing: 10) {
                            ProgressView().tint(.white)
                            Text("Kompilerer produksjonskontekst …")
                        }
                        .foregroundStyle(BoardBrand.dim)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    } else if let result {
                        inspectorSummary(result)
                        moduleList(result)
                        compiledPrompt(result)
                    }
                }
                .padding(22)
            }
            .background(BoardBrand.chrome)
            .navigationTitle("Prompt Inspector")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Label("PROMPT ENGINE V1", systemImage: "cpu")
                        .font(.caption2.bold())
                        .foregroundStyle(BoardBrand.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }.foregroundStyle(.white)
                }
            }
        }
        .task(id: mode) { await compile() }
        .accessibilityIdentifier("storyboard.ai.prompt-inspector.sheet")
    }

    private func inspectorSummary(_ value: StoryboardPromptEngineResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            inspectorRow("User intent", value.userIntent, "cursorarrow.click")
            inspectorRow("Inherited context", "\(value.inheritedConstraintCount) constraints", "shippingbox")
            inspectorRow(
                "Character references",
                "\(value.characterReferenceCount) · \(value.characterCount) characters",
                "person.crop.rectangle.stack")
            inspectorRow("Location references", "\(value.locationReferenceCount)", "map")
            inspectorRow("Style", value.styleProfileLabel, "paintbrush")
            inspectorRow(
                "Locked properties",
                value.lockedProperties.isEmpty ? "None" : value.lockedProperties.joined(separator: " · "),
                "lock.fill")
            inspectorRow(
                "Model",
                "\(value.modelLabel) · \(value.modelProvider)",
                "cpu")
            HStack(spacing: 8) {
                Image(systemName: value.validationValid ? "checkmark.seal.fill" : "exclamationmark.octagon.fill")
                Text(value.validationValid ? "Preflight valid" : "Preflight needs attention")
                Spacer()
                Text(value.contextFingerprint).font(.caption2.monospaced())
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(value.validationValid ? .green : .orange)
            if !value.validationIssues.isEmpty {
                ForEach(value.validationIssues) { issue in
                    Text("• \(issue.message)")
                        .font(.caption)
                        .foregroundStyle(issue.severity == "error" ? .red : .orange)
                }
            }
        }
        .padding(16)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(BoardBrand.border))
    }

    private func inspectorRow(_ label: String, _ value: String, _ icon: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(BoardBrand.accent)
                .frame(width: 20)
            Text(label).foregroundStyle(BoardBrand.label).frame(width: 150, alignment: .leading)
            Text(value.isEmpty ? "Not set" : value)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.caption)
    }

    private func moduleList(_ value: StoryboardPromptEngineResult) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("COMPOSED MODULES")
                .font(.caption2.bold()).kerning(1)
                .foregroundStyle(BoardBrand.label)
            ForEach(value.modules.filter { !$0.constraints.isEmpty }) { module in
                DisclosureGroup {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(module.constraints) { constraint in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: constraint.locked ? "lock.fill" : "circle")
                                    .font(.caption2)
                                    .foregroundStyle(constraint.locked ? BoardBrand.accent : BoardBrand.dim)
                                Text(constraint.text)
                                    .font(.caption)
                                    .foregroundStyle(BoardBrand.dim)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                    .padding(.top, 10)
                } label: {
                    HStack {
                        Text(module.label).font(.caption.weight(.semibold))
                        Spacer()
                        Text("\(module.constraints.count)").font(.caption2.monospacedDigit())
                    }
                    .foregroundStyle(.white)
                }
                .padding(12)
                .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 11))
            }
        }
    }

    private func compiledPrompt(_ value: StoryboardPromptEngineResult) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("FINAL COMPILED PROMPT")
                    .font(.caption2.bold()).kerning(1)
                    .foregroundStyle(BoardBrand.label)
                Spacer()
                Text("\(value.compiledPrompt.count) chars")
                    .font(.caption2.monospacedDigit()).foregroundStyle(BoardBrand.dim)
            }
            Text(value.compiledPrompt)
                .font(.caption.monospaced())
                .foregroundStyle(.white.opacity(0.88))
                .textSelection(.enabled)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.24), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    @MainActor
    private func compile() async {
        isLoading = true
        errorMessage = nil
        #if DEBUG
        if ProcessInfo.processInfo.environment["SB_AI_VIDEO_DEMO"] == "1" {
            result = try? StoryboardPromptEngineResult(dictionary: demoPayload())
            isLoading = false
            return
        }
        #endif
        do {
            result = try await RoleRoomAPIClient.shared.compileStoryboardPrompt(
                projectId: projectId,
                sceneId: scene.id,
                frameId: frame.id,
                title: "\(scene.heading) · Shot \(frame.shotNumber)",
                kind: mode,
                model: selectedModelID,
                userAction: userAction,
                context: context)
        } catch {
            result = nil
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    #if DEBUG
    private func demoPayload() -> [String: Any] {
        let moduleData: [(String, String, [String])] = [
            ("base-cinematography", "BASE CINEMATOGRAPHY", ["One readable dramatic moment with strong silhouettes and intentional blocking."]),
            ("project-style", "PROJECT STYLE", ["monochrome production storyboard drawing", "confident graphite construction lines", "selective cross-hatching", "minimal tonal rendering", "no polished concept-art finish"]),
            ("character", "CHARACTER", ["Nora — identity and performance continuity locked"]),
            ("wardrobe", "WARDROBE", ["Nora's dark wool coat remains unchanged"]),
            ("location", "LOCATION", ["Scene 3 · INT. TOG — NATT · Dovrefjell"]),
            ("prop", "PROP", ["The pulsing route display remains screen-left"]),
            ("shot", "SHOT", ["Shot 3B — Et mørkt troll-omriss speiles i vinduet bak Nora."]),
            ("camera", "CAMERA", ["medium close-up", "low-angle camera", "50 mm lens", "slow motivated push-in"]),
            ("lighting", "LIGHTING", ["Varm skjermglød mot kald vindusrefleksjon"]),
            ("continuity", "CONTINUITY", ["Preserve eyelines, screen direction and train geography"]),
            ("user-intent", "USER INTENT", [userAction]),
            ("model-rules", "MODEL-SPECIFIC RULES", ["No lettering, captions, UI, logos or watermarks"]),
        ]
        let modules: [[String: Any]] = moduleData.map { id, label, constraints in
            [
                "id": id,
                "label": label,
                "constraints": constraints.enumerated().map { index, text in
                    [
                        "id": "\(id)-\(index)", "text": text,
                        "source": id == "user-intent" ? "user" : "production",
                        "locked": id != "user-intent",
                    ] as [String: Any]
                },
            ]
        }
        let compiled = modules.compactMap { module -> String? in
            guard let label = module["label"] as? String,
                  let constraints = module["constraints"] as? [[String: Any]] else { return nil }
            return "[\(label) — production data]\n" + constraints.compactMap {
                ($0["text"] as? String).map { "- \($0)" }
            }.joined(separator: "\n")
        }.joined(separator: "\n\n")
        return [
            "version": "trr-prompt-engine-v1",
            "contextFingerprint": "troll-3b-demo",
            "intentKind": mode,
            "compiledPrompt": compiled,
            "modules": modules,
            "validation": ["valid": true, "issues": []],
            "inspector": [
                "intent": userAction,
                "inheritedConstraintCount": 24,
                "characterCount": 1,
                "characterReferenceCount": 3,
                "locationReferenceCount": 1,
                "styleProfileLabel": "TRR Story Pencil",
                "lockedProperties": ["Identity", "Costume", "Lighting", "Location"],
                "model": [
                    "id": selectedModelID,
                    "label": mode == "storyboard-image" ? "GPT Image 2" : "LongCat 720p",
                    "provider": mode == "storyboard-image" ? "OpenAI" : "fal.ai / LongCat",
                ],
            ],
        ]
    }
    #endif
}

private struct StoryboardReferenceLibraryView: View {
    let projectId: String
    let activeSceneID: String

    @Environment(\.dismiss) private var dismiss
    @State private var assets: [StoryboardReferenceAsset] = []
    @State private var isLoading = true
    @State private var reviewingAssetID: String?
    @State private var errorMessage: String?

    private let columns = [GridItem(.adaptive(minimum: 320), spacing: 16)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if isLoading {
                        ProgressView("Henter produksjonsreferanser …")
                            .tint(BoardBrand.accent)
                            .frame(maxWidth: .infinity, minHeight: 240)
                    } else if assets.isEmpty {
                        ContentUnavailableView(
                            "Ingen referansepakke",
                            systemImage: "photo.stack",
                            description: Text("TROLL-pakken installeres av prosjektets backend-migrasjon."))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 300)
                    } else {
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                            ForEach(assets) { asset in
                                referenceCard(asset)
                            }
                        }
                    }
                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(22)
            }
            .background(BoardBrand.chrome)
            .navigationTitle("Produksjonsreferanser")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { Task { await load() } } label: {
                        Label("Oppdater", systemImage: "arrow.clockwise")
                    }
                    .disabled(isLoading || reviewingAssetID != nil)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
        }
        .task { await load() }
        .accessibilityIdentifier("storyboard.reference-library")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("TROLL · PRODUCTION BIBLE V1", systemImage: "lock.shield.fill")
                    .font(.caption.bold()).kerning(0.7)
                    .foregroundStyle(BoardBrand.accent)
                Spacer()
                Text("\(approvedCount)/\(assets.count) låst")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(BoardBrand.dim)
            }
            Text("Velg hva AI-en faktisk får arve")
                .font(.title3.bold()).foregroundStyle(.white)
            Text("Kun Godkjent + låst brukes i Prompt Engine og sendes som bildeinngang til modellen. Utkast kan forhåndsvises uten å påvirke nye storyboard-ruter.")
                .font(.subheadline).foregroundStyle(BoardBrand.dim)
        }
        .padding(16)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(BoardBrand.border))
    }

    private var approvedCount: Int {
        assets.filter { $0.approvalStatus == "approved" && $0.locked }.count
    }

    private func referenceCard(_ asset: StoryboardReferenceAsset) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            StoryboardReferenceImage(path: asset.imageURL)
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(alignment: .topLeading) {
                    statusPill(asset)
                        .padding(10)
                }
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(asset.name)
                        .font(.headline).foregroundStyle(.white)
                    Spacer()
                    if asset.sceneIDs.contains(activeSceneID) {
                        Text("AKTIV SCENE")
                            .font(.caption2.bold())
                            .foregroundStyle(BoardBrand.accent)
                    }
                }
                Text(asset.description)
                    .font(.caption).foregroundStyle(BoardBrand.dim)
                    .lineLimit(3)
                Text("\(entityLabel(asset.entityType)) · \(asset.packVersion.uppercased())")
                    .font(.caption2.bold()).kerning(0.5)
                    .foregroundStyle(BoardBrand.label)
            }
            HStack(spacing: 10) {
                Button {
                    Task { await review(asset, status: "approved") }
                } label: {
                    Label(asset.approvalStatus == "approved" ? "Godkjent" : "Godkjenn",
                          systemImage: asset.approvalStatus == "approved" ? "lock.fill" : "checkmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(reviewingAssetID != nil || asset.approvalStatus == "approved")
                .accessibilityIdentifier("storyboard.reference.approve.\(asset.id)")

                Button {
                    Task { await review(asset, status: "rejected") }
                } label: {
                    Label("Avvis", systemImage: "xmark.circle")
                }
                .buttonStyle(.bordered)
                .tint(.orange)
                .disabled(reviewingAssetID != nil || asset.approvalStatus == "rejected")
                .accessibilityIdentifier("storyboard.reference.reject.\(asset.id)")
            }
            if reviewingAssetID == asset.id {
                ProgressView().tint(BoardBrand.accent)
            }
        }
        .padding(14)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(
            asset.sceneIDs.contains(activeSceneID) ? BoardBrand.accent.opacity(0.55) : BoardBrand.border))
        .accessibilityIdentifier("storyboard.reference.card.\(asset.id)")
    }

    private func statusPill(_ asset: StoryboardReferenceAsset) -> some View {
        let approved = asset.approvalStatus == "approved" && asset.locked
        let rejected = asset.approvalStatus == "rejected"
        return Label(
            approved ? "GODKJENT + LÅST" : (rejected ? "AVVIST" : "UTKAST"),
            systemImage: approved ? "lock.fill" : (rejected ? "xmark" : "pencil"))
            .font(.caption2.bold()).kerning(0.4)
            .foregroundStyle(.white)
            .padding(.horizontal, 9).padding(.vertical, 6)
            .background(approved ? Color.green.opacity(0.9) : (rejected ? Color.orange.opacity(0.9) : Color.black.opacity(0.72)), in: Capsule())
    }

    private func entityLabel(_ type: String) -> String {
        switch type {
        case "character": return "KARAKTER"
        case "wardrobe": return "GARDEROBE"
        case "location": return "LOCATION"
        case "prop": return "REKVISITT"
        default: return "STORYBOARD"
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        errorMessage = nil
        #if DEBUG
        if ProcessInfo.processInfo.environment["SB_REFERENCE_LIBRARY_DEMO"] == "1" {
            assets = Self.demoAssets()
            isLoading = false
            return
        }
        #endif
        do {
            assets = try await RoleRoomAPIClient.shared.fetchStoryboardReferences(projectId: projectId)
        } catch {
            assets = []
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    private func review(_ asset: StoryboardReferenceAsset, status: String) async {
        reviewingAssetID = asset.id
        errorMessage = nil
        #if DEBUG
        if ProcessInfo.processInfo.environment["SB_REFERENCE_LIBRARY_DEMO"] == "1" {
            if let index = assets.firstIndex(where: { $0.id == asset.id }) {
                let row: [String: Any] = [
                    "id": asset.id, "packId": asset.packID,
                    "packVersion": asset.packVersion, "entityType": asset.entityType,
                    "entityId": asset.entityID, "sceneIds": asset.sceneIDs,
                    "name": asset.name, "description": asset.description,
                    "approvalStatus": status, "locked": status == "approved",
                    "imageUrl": asset.imageURL, "updatedAt": asset.updatedAt,
                ]
                assets[index] = (try? StoryboardReferenceAsset(dictionary: row)) ?? asset
            }
            reviewingAssetID = nil
            return
        }
        #endif
        do {
            let updated = try await RoleRoomAPIClient.shared.reviewStoryboardReference(
                projectId: projectId,
                assetID: asset.id,
                approvalStatus: status)
            if let index = assets.firstIndex(where: { $0.id == updated.id }) {
                assets[index] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        reviewingAssetID = nil
    }

    #if DEBUG
    private static func demoAssets() -> [StoryboardReferenceAsset] {
        let rows: [[String: Any]] = [
            [
                "id": "ref-troll-nora-v1", "packId": "troll-production-bible",
                "packVersion": "v1", "entityType": "character", "entityId": "role-nora",
                "sceneIds": ["demo-scene", "scene-3", "scene-5", "scene-9"],
                "name": "Nora Tidemann — karakter og garderobe",
                "description": "Originalt fiktivt karakterdesign med fast identitet, feltjakke, notatbok og feltutstyr. Ingen skuespillerlikhet.",
                "approvalStatus": "approved", "locked": true,
                "imageUrl": "demo://nora-character-wardrobe-draft-v1.png", "updatedAt": "demo",
            ],
            [
                "id": "ref-troll-creature-v1", "packId": "troll-production-bible",
                "packVersion": "v1", "entityType": "character", "entityId": "trollet",
                "sceneIds": ["demo-scene", "scene-8"],
                "name": "Trollet — skapning og skala",
                "description": "Et 40 meter høyt, sørgmodig fjelltroll med stabil granitt-, rot-, lav- og frostanatomi.",
                "approvalStatus": "draft", "locked": false,
                "imageUrl": "demo://troll-creature-scale-draft-v1.png", "updatedAt": "demo",
            ],
            [
                "id": "ref-troll-dovrefjell-v1", "packId": "troll-production-bible",
                "packVersion": "v1", "entityType": "location", "entityId": "loc-dovre",
                "sceneIds": ["demo-scene", "scene-5", "scene-8", "scene-9"],
                "name": "Dovrefjell — location og lyskontinuitet",
                "description": "Samme åskam, vei, steinur og snøgeografi ved skumring, natt og daggry i Story Pencil + Story Hatch.",
                "approvalStatus": "approved", "locked": true,
                "imageUrl": "demo://dovrefjell-location-draft-v1.png", "updatedAt": "demo",
            ],
            [
                "id": "ref-troll-scene-8-sequence-v1", "packId": "troll-production-bible",
                "packVersion": "v1", "entityType": "storyboard", "entityId": "scene-8",
                "sceneIds": ["demo-scene", "scene-8"],
                "name": "Scene 8 — trollet på vandring",
                "description": "Tre sammenhengende ruter: 24 mm extreme wide, 18 mm low angle og 85 mm emosjonelt nærbilde.",
                "approvalStatus": "draft", "locked": false,
                "imageUrl": "demo://scene-8-storyboard-sequence-draft-v1.png", "updatedAt": "demo",
            ],
        ]
        return rows.reversed().compactMap { try? StoryboardReferenceAsset(dictionary: $0) }
    }
    #endif
}

private struct StoryboardReferenceImage: View {
    let path: String
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Rectangle().fill(Color.white.opacity(0.035))
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                ProgressView().tint(BoardBrand.accent)
            }
        }
        .task(id: path) {
            #if DEBUG
            if path.hasPrefix("demo://") {
                let filename = String(path.dropFirst("demo://".count))
                if let url = Bundle.main.url(forResource: filename, withExtension: nil),
                   let data = try? Data(contentsOf: url) {
                    image = UIImage(data: data)
                }
                return
            }
            #endif
            guard let data = await RoleRoomAPIClient.shared.fetchRemoteImageData(path: path) else { return }
            image = UIImage(data: data)
        }
    }
}

private struct AIStoredImageView: View {
    let imageURL: String?
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable()
            } else {
                Rectangle()
                    .fill(Color.white.opacity(0.035))
                    .overlay(ProgressView().tint(BoardBrand.dim))
            }
        }
        .task(id: imageURL) { await load() }
    }

    @MainActor
    private func load() async {
        guard let imageURL else { image = nil; return }
        if let cached = FrameImageCache.image(for: imageURL) {
            image = cached
            return
        }
        guard let data = await RoleRoomAPIClient.shared.fetchRemoteImageData(path: imageURL),
              let downloaded = UIImage(data: data) else { return }
        FrameImageCache.images[imageURL] = downloaded
        image = downloaded
    }
}
