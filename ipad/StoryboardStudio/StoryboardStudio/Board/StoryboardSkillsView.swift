import SwiftUI

enum StoryboardSkillID: String, CaseIterable, Identifiable, Codable, Sendable {
    case planSceneCoverage = "plan_scene_coverage"
    case auditVisualContinuity = "audit_visual_continuity"
    case designShotVariants = "design_shot_variants"
    case translateArtistMarks = "translate_artist_marks"
    case auditBoardReadability = "audit_board_readability"
    case buildAnimaticPass = "build_animatic_pass"
    case auditProductionFeasibility = "audit_production_feasibility"
    case reconcileStoryboardRevision = "reconcile_storyboard_revision"

    var id: String { rawValue }
    var title: String {
        switch self {
        case .planSceneCoverage: return "Coverage"
        case .auditVisualContinuity: return "Kontinuitet"
        case .designShotVariants: return "Shotalternativer"
        case .translateArtistMarks: return "Artistmerker"
        case .auditBoardReadability: return "Lesbarhet"
        case .buildAnimaticPass: return "Animatic"
        case .auditProductionFeasibility: return "Gjennomføring"
        case .reconcileStoryboardRevision: return "Revisjonsvakt"
        }
    }
    var detail: String {
        switch self {
        case .planSceneCoverage: return "Finn manglende beats og klippepunkter."
        case .auditVisualContinuity: return "Kontroller akse, retning og naboshots."
        case .designShotVariants: return "Sammenlign geografi, nærhet og energi."
        case .translateArtistMarks: return "Gjør typed Pencil-merker til produksjonsnotater."
        case .auditBoardReadability: return "Sjekk fokus, dybde og sekvensvariasjon."
        case .buildAnimaticPass: return "Foreslå varighet og overganger."
        case .auditProductionFeasibility: return "Flagg rigg, stunt, vær og VFX."
        case .reconcileStoryboardRevision: return "Avstem shots mot en låst review-revisjon."
        }
    }
    var icon: String {
        switch self {
        case .planSceneCoverage: return "rectangle.3.group"
        case .auditVisualContinuity: return "arrow.left.and.right"
        case .designShotVariants: return "square.grid.3x1.below.line.grid.1x2"
        case .translateArtistMarks: return "applepencil.and.scribble"
        case .auditBoardReadability: return "eye"
        case .buildAnimaticPass: return "play.rectangle"
        case .auditProductionFeasibility: return "checklist.checked"
        case .reconcileStoryboardRevision: return "arrow.triangle.2.circlepath"
        }
    }
    var requiresFrame: Bool {
        self == .designShotVariants || self == .translateArtistMarks
    }
}

struct StoryboardSkillDefinitionDTO: Decodable, Identifiable, Sendable {
    let id: StoryboardSkillID
    let version: String
    let title: String
    let shortTitle: String
    let description: String
}

struct StoryboardSkillSuggestionDTO: Decodable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let status: String
    let agentName: String
    let modelVersion: String
    let createdAt: String
    let payload: StoryboardSkillResultDTO
}

struct StoryboardSkillResultDTO: Decodable, Sendable {
    let contractVersion: String
    let skillId: StoryboardSkillID
    let skillVersion: String
    let title: String
    let summary: String
    let rationale: String
    let confidence: Double
    let severity: String
    let contextFingerprint: String
    let evidence: [StoryboardSkillEvidenceDTO]
    let recommendedChanges: [StoryboardSkillChangeDTO]
    let alternatives: [StoryboardSkillAlternativeDTO]
    let warnings: [String]
    let cost: StoryboardSkillCostDTO
}

struct StoryboardSkillEvidenceDTO: Decodable, Identifiable, Sendable {
    let id: String
    let label: String
    let detail: String
    let frameIds: [String]?
}

struct StoryboardSkillAlternativeDTO: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let tradeoff: String
    let changes: [StoryboardSkillChangeDTO]
}

struct StoryboardSkillChangeDTO: Decodable, Identifiable, Sendable {
    let id: String
    let operation: String
    let frameId: String?
    let afterFrameId: String?
    let label: String
    let reason: String
    let patch: StoryboardSkillFramePatchDTO
}

struct StoryboardSkillFramePatchDTO: Decodable, Sendable {
    let description: String?
    let notes: String?
    let shotType: String?
    let cameraAngle: String?
    let movement: String?
    let lensMm: Int?
    let duration: Double?
    let transition: String?
    let focusDepth: String?
    let location: String?
    let timeOfDay: String?
    let weather: String?
    let screenDirection: String?
    let beatTag: String?
    let continuityNotes: String?
    let productionNotes: String?
    let vfxNotes: String?
    let tags: [String]?
    let revisionStatus: String?
    let revisionReason: String?

    var fields: [String: any Sendable] {
        var result: [String: any Sendable] = [:]
        if let description { result["description"] = description }
        if let notes { result["notes"] = notes }
        if let shotType { result["shotType"] = shotType }
        if let cameraAngle { result["cameraAngle"] = cameraAngle }
        if let movement { result["cameraMovement"] = movement }
        if let lensMm { result["lensMm"] = lensMm }
        if let duration { result["duration"] = duration }
        if let transition { result["transition"] = transition }
        if let focusDepth { result["focusDepth"] = focusDepth }
        if let location { result["location"] = location }
        if let timeOfDay { result["timeOfDay"] = timeOfDay }
        if let weather { result["weather"] = weather }
        if let screenDirection { result["screenDirection"] = screenDirection }
        if let beatTag { result["beatTag"] = beatTag }
        if let continuityNotes { result["continuityNotes"] = continuityNotes }
        if let productionNotes { result["productionNotes"] = productionNotes }
        if let vfxNotes { result["vfxNotes"] = vfxNotes }
        if let tags { result["tags"] = tags }
        if let revisionStatus { result["revisionStatus"] = revisionStatus }
        if let revisionReason { result["revisionReason"] = revisionReason }
        return result
    }
}

struct StoryboardSkillCostDTO: Decodable, Sendable {
    let provider: String
    let estimatedUsd: Double
}

extension StoryboardSkillFramePatchDTO {
    init() {
        description = nil; notes = nil; shotType = nil; cameraAngle = nil
        movement = nil; lensMm = nil; duration = nil; transition = nil
        focusDepth = nil; location = nil; timeOfDay = nil; weather = nil
        screenDirection = nil; beatTag = nil; continuityNotes = nil
        productionNotes = nil; vfxNotes = nil; tags = nil
        revisionStatus = nil; revisionReason = nil
    }
}

private struct StoryboardAssistantUndoPatch {
    let sceneId: String
    let frameId: String
    let fields: [String: any Sendable]
}

private struct StoryboardAssistantUndoBatch {
    let patches: [StoryboardAssistantUndoPatch]
    let createdFrameIds: [(sceneId: String, frameId: String)]

    var isEmpty: Bool { patches.isEmpty && createdFrameIds.isEmpty }
}

struct StoryboardSkillsView: View {
    @ObservedObject var board: BoardState
    let projectId: String

    @State private var selectedSkill: StoryboardSkillID = .planSceneCoverage
    @State private var selectedAssistant: StoryboardAssistant? = .sceneDirector
    @State private var definitions: [StoryboardSkillDefinitionDTO] = []
    @State private var suggestion: StoryboardSkillSuggestionDTO?
    @State private var isRunning = false
    @State private var isReviewing = false
    @State private var retryChanges: [StoryboardSkillChangeDTO] = []
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var lastUndo: StoryboardAssistantUndoBatch?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                Group {
                    if proxy.size.width >= 800 {
                        HStack(spacing: 0) {
                            assistantList.frame(width: 310)
                            Divider()
                            resultPane
                        }
                    } else {
                        VStack(spacing: 0) {
                            assistantPicker
                            Divider()
                            resultPane
                        }
                    }
                }
                .background(BoardBrand.chrome)
            }
            .navigationTitle("Scenehjelpere")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Label("Du godkjenner alltid før noe endres", systemImage: "hand.raised")
                        .font(.caption).foregroundStyle(BoardBrand.dim)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                        .disabled(isRunning || isReviewing)
                }
            }
        }
        .task {
            definitions = (try? await RoleRoomAPIClient.shared
                .fetchStoryboardSkillCatalog(projectId: projectId)) ?? []
        }
    }

    private var assistantList: some View {
        List {
            Section("HJELPERE") {
                ForEach(StoryboardAssistant.allCases) { assistant in
                    assistantButton(assistant)
                }
            }
            Section("INNDATA") {
                Button { selectArtistMarks() } label: {
                    HStack(spacing: 12) {
                        Image(systemName: StoryboardSkillID.translateArtistMarks.icon)
                            .font(.system(size: 18))
                            .frame(width: 32, height: StoryboardExperienceMetrics.minimumTouchTarget)
                            .foregroundStyle(BoardBrand.accent)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Tolk artistmerker").font(.subheadline.weight(.semibold))
                            Text("Bruk Pencil-merker som kontekst for en konkret produksjonsnote.")
                                .font(.caption).foregroundStyle(.secondary).lineLimit(3)
                        }
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(selectedAssistant == nil
                    ? BoardBrand.accent.opacity(0.16) : BoardBrand.panel)
                .accessibilityIdentifier("storyboard.assistants.artistMarks")
            }
        }
        .scrollContentBackground(.hidden)
        .background(BoardBrand.panel)
    }

    private func assistantButton(_ assistant: StoryboardAssistant) -> some View {
        Button { select(assistant) } label: {
            HStack(spacing: 12) {
                Image(systemName: assistant.icon)
                    .font(.system(size: 18))
                    .frame(width: 32, height: StoryboardExperienceMetrics.minimumTouchTarget)
                    .foregroundStyle(BoardBrand.accent)
                VStack(alignment: .leading, spacing: 4) {
                    Text(assistant.title).font(.subheadline.weight(.semibold))
                    Text(assistant.detail).font(.caption).foregroundStyle(.secondary).lineLimit(3)
                }
            }
        }
        .buttonStyle(.plain)
        .listRowBackground(selectedAssistant == assistant
            ? BoardBrand.accent.opacity(0.16) : BoardBrand.panel)
        .accessibilityIdentifier("storyboard.assistants.select.\(assistant.rawValue)")
    }

    private var assistantPicker: some View {
        Menu {
            ForEach(StoryboardAssistant.allCases) { assistant in
                Button(assistant.title) { select(assistant) }
            }
            Divider()
            Button("Tolk artistmerker") { selectArtistMarks() }
        } label: {
            Label(selectedAssistant?.title ?? "Tolk artistmerker",
                  systemImage: selectedAssistant?.icon ?? StoryboardSkillID.translateArtistMarks.icon)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity,
                       minHeight: StoryboardExperienceMetrics.minimumTouchTarget,
                       alignment: .leading)
        }
        .padding()
    }

    private var resultPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: selectedAssistant?.icon ?? selectedSkill.icon)
                        .font(.title2).foregroundStyle(BoardBrand.accent)
                        .frame(width: 44, height: 44)
                        .background(BoardBrand.accent.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedAssistant?.title ?? "Tolk artistmerker")
                            .font(.title3.bold()).foregroundStyle(.white)
                        Text(selectedAssistant?.detail ?? selectedSkill.detail)
                            .font(.subheadline).foregroundStyle(BoardBrand.dim)
                    }
                    Spacer()
                    Text("0 USD").font(.caption.bold()).foregroundStyle(.green)
                }

                if let assistant = selectedAssistant {
                    capabilityPicker(assistant)
                }

                Button { runSelectedSkill() } label: {
                    if isRunning {
                        ProgressView().tint(.white)
                    } else {
                        Label(selectedAssistant == nil ? "Tolk markeringene" : "Analyser scenen",
                              systemImage: "sparkles")
                    }
                }
                .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                .disabled(isRunning || isReviewing || (selectedSkill.requiresFrame && board.frame == nil))
                .accessibilityIdentifier("storyboard.assistants.run")

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red).font(.subheadline)
                }
                if let successMessage {
                    Label(successMessage, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green).font(.subheadline)
                }
                if let suggestion { suggestionCard(suggestion) }
            }
            .padding(24)
        }
    }

    private func capabilityPicker(_ assistant: StoryboardAssistant) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("HVA SKAL UNDERSØKES?")
                .font(.caption.weight(.bold)).tracking(0.8)
                .foregroundStyle(BoardBrand.label)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(assistant.capabilities) { capability in
                        Button {
                            selectedSkill = capability
                            clearResult()
                        } label: {
                            Label(remoteDefinition(for: capability)?.shortTitle ?? capability.title,
                                  systemImage: capability.icon)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(selectedSkill == capability ? .white : BoardBrand.dim)
                                .padding(.horizontal, 12)
                                .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                                .background(selectedSkill == capability
                                            ? BoardBrand.accent.opacity(0.55)
                                            : Color.white.opacity(0.05), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("storyboard.assistants.capability.\(capability.rawValue)")
                    }
                }
            }
        }
    }

    private func select(_ assistant: StoryboardAssistant) {
        selectedAssistant = assistant
        selectedSkill = assistant.defaultCapability
        clearResult()
    }

    private func selectArtistMarks() {
        selectedAssistant = nil
        selectedSkill = .translateArtistMarks
        clearResult()
    }

    private func clearResult() {
        suggestion = nil
        errorMessage = nil
        successMessage = nil
        retryChanges = []
    }

    private func suggestionCard(_ suggestion: StoryboardSkillSuggestionDTO) -> some View {
        let result = suggestion.payload
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(result.title).font(.headline).foregroundStyle(.white)
                Spacer()
                Text("\(Int(result.confidence * 100)) %")
                    .font(.caption.bold()).foregroundStyle(BoardBrand.accent)
                Text(result.severity.uppercased())
                    .font(.caption2.bold()).foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(result.severity == "blocking" ? Color.red : Color.orange,
                                in: Capsule())
            }

            suggestionSection("Hvorfor", icon: "questionmark.circle") {
                Text(result.rationale).font(.subheadline).foregroundStyle(BoardBrand.dim)
            }

            suggestionSection("Evidens", icon: "scope") {
                if result.evidence.isEmpty {
                    Text("Ingen direkte evidens funnet i valgt scene.")
                        .font(.subheadline).foregroundStyle(BoardBrand.dim)
                }
                ForEach(result.evidence) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.label).font(.subheadline.bold()).foregroundStyle(.white)
                        Text(item.detail).font(.subheadline).foregroundStyle(BoardBrand.dim)
                    }
                    .padding(.leading, 10)
                    .overlay(alignment: .leading) {
                        Rectangle().fill(BoardBrand.accent).frame(width: 2)
                    }
                }
            }

            suggestionSection("Før / etter", icon: "rectangle.2.swap") {
                Text(result.summary).font(.body.weight(.semibold)).foregroundStyle(.white)
                ForEach(result.recommendedChanges) { change in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "arrow.right.circle.fill")
                            .foregroundStyle(BoardBrand.accent)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(change.label).font(.subheadline.bold()).foregroundStyle(.white)
                            Text(change.reason).font(.subheadline).foregroundStyle(BoardBrand.dim)
                        }
                    }
                }
                if result.recommendedChanges.isEmpty && result.alternatives.isEmpty {
                    Text("Analysen foreslår ingen dataendring.")
                        .font(.subheadline).foregroundStyle(BoardBrand.dim)
                }
            }

            suggestionSection("Konsekvens", icon: "point.3.connected.trianglepath.dotted") {
                ForEach(result.alternatives) { alternative in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(alternative.title).font(.subheadline.bold()).foregroundStyle(.white)
                        Text(alternative.tradeoff).font(.subheadline).foregroundStyle(BoardBrand.dim)
                        if suggestion.status == "pending" {
                            Button("Godkjenn dette alternativet") {
                                accept(changes: alternative.changes)
                            }
                            .buttonStyle(.bordered).tint(BoardBrand.accent)
                            .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                            .disabled(isReviewing)
                            .accessibilityIdentifier("storyboard.skills.alternative.\(alternative.id)")
                        }
                    }
                    .padding(12)
                    .background(Color.white.opacity(0.04),
                                in: RoundedRectangle(cornerRadius: 10))
                }
                ForEach(result.warnings, id: \.self) { warning in
                    Label(warning, systemImage: "exclamationmark.triangle")
                        .font(.subheadline).foregroundStyle(.orange)
                }
            }

            suggestionSection("Kostnad", icon: "creditcard") {
                Text(result.cost.estimatedUsd == 0
                     ? "Ingen beregnet leverandørkostnad"
                     : String(format: "Estimert %.3f USD via %@",
                              result.cost.estimatedUsd, result.cost.provider))
                    .font(.subheadline).foregroundStyle(.green)
            }

            if suggestion.status == "pending" {
                HStack {
                    Button(result.recommendedChanges.isEmpty ? "Godkjenn analyse" : "Godkjenn og bruk") {
                        accept(changes: result.recommendedChanges)
                    }
                    .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                    .disabled(isReviewing)
                    .accessibilityIdentifier("storyboard.skills.accept")
                    Button("Avvis", role: .destructive) { reject() }
                        .disabled(isReviewing)
                        .accessibilityIdentifier("storyboard.skills.reject")
                }
                Text("Endringer utføres først etter godkjenning og kan spores i historikken.")
                    .font(.caption).foregroundStyle(BoardBrand.label)
            }

            if suggestion.status == "accepted" && !retryChanges.isEmpty {
                Button("Prøv å bruke godkjent forslag igjen") { retryApply() }
                    .buttonStyle(.bordered).tint(.orange)
                    .disabled(isReviewing)
                    .accessibilityIdentifier("storyboard.skills.retryApply")
            }

            if suggestion.status == "accepted", lastUndo != nil {
                Button {
                    undoLastAcceptedChange()
                } label: {
                    Label("Angre godkjent endring", systemImage: "arrow.uturn.backward.circle")
                        .frame(minHeight: StoryboardExperienceMetrics.minimumTouchTarget)
                }
                .buttonStyle(.bordered).tint(.orange)
                .disabled(isReviewing)
                .accessibilityIdentifier("storyboard.assistants.undo")
            }

            Text("Fingerprint \(String(result.contextFingerprint.prefix(12))) · \(result.skillVersion)")
                .font(.caption2.monospaced()).foregroundStyle(BoardBrand.label)
        }
        .padding(16)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(BoardBrand.border))
        .accessibilityIdentifier("storyboard.skills.result")
    }

    private func suggestionSection<Content: View>(
        _ title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.bold)).textCase(.uppercase)
                .foregroundStyle(BoardBrand.label)
            content()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
    }

    private func remoteDefinition(for skill: StoryboardSkillID) -> StoryboardSkillDefinitionDTO? {
        definitions.first { $0.id == skill }
    }

    private func runSelectedSkill() {
        guard let scene = board.scene else { return }
        let requestBody: Data
        do {
            requestBody = try Self.contextRequestBodyData(
                projectId: projectId,
                projectTitle: board.manuscript.title,
                scene: scene,
                activeFrameId: board.frame?.id)
        } catch {
            errorMessage = "Kunne ikke klargjøre storyboard-konteksten."
            return
        }
        isRunning = true
        errorMessage = nil
        successMessage = nil
        retryChanges = []
        lastUndo = nil
        Task {
            do {
                suggestion = try await RoleRoomAPIClient.shared.runStoryboardSkill(
                    projectId: projectId,
                    skillId: selectedSkill,
                    requestBody: requestBody)
            } catch {
                errorMessage = error.localizedDescription
            }
            isRunning = false
        }
    }

    private func accept(changes: [StoryboardSkillChangeDTO]) {
        guard let suggestion else { return }
        isReviewing = true
        errorMessage = nil
        Task {
            var reviewPersisted = false
            do {
                self.suggestion = try await RoleRoomAPIClient.shared.reviewStoryboardSkillSuggestion(
                    projectId: projectId,
                    suggestionId: suggestion.id,
                    action: "accept")
                reviewPersisted = true
                retryChanges = changes
                let undo = try await apply(changes: changes)
                await board.reload()
                lastUndo = undo.isEmpty ? nil : undo
                retryChanges = []
                successMessage = changes.isEmpty
                    ? "Analysen er godkjent. Ingen storyboarddata ble endret."
                    : "Forslaget er godkjent og synket. Historikken bevarer tidligere versjon."
            } catch {
                errorMessage = reviewPersisted
                    ? "Forslaget er godkjent, men ble ikke brukt: \(error.localizedDescription)"
                    : error.localizedDescription
            }
            isReviewing = false
        }
    }

    private func retryApply() {
        guard !retryChanges.isEmpty else { return }
        let changes = retryChanges
        isReviewing = true
        errorMessage = nil
        Task {
            do {
                let undo = try await apply(changes: changes)
                await board.reload()
                lastUndo = undo.isEmpty ? nil : undo
                retryChanges = []
                successMessage = "Det godkjente forslaget er nå brukt og synket."
            } catch {
                errorMessage = error.localizedDescription
            }
            isReviewing = false
        }
    }

    private func reject() {
        guard let suggestion else { return }
        isReviewing = true
        errorMessage = nil
        Task {
            do {
                self.suggestion = try await RoleRoomAPIClient.shared.reviewStoryboardSkillSuggestion(
                    projectId: projectId,
                    suggestionId: suggestion.id,
                    action: "reject")
                successMessage = "Forslaget er avvist. Storyboardet ble ikke endret."
            } catch {
                errorMessage = error.localizedDescription
            }
            isReviewing = false
        }
    }

    private func apply(changes: [StoryboardSkillChangeDTO]) async throws -> StoryboardAssistantUndoBatch {
        guard let scene = board.scene else {
            return StoryboardAssistantUndoBatch(patches: [], createdFrameIds: [])
        }
        var inversePatches: [StoryboardAssistantUndoPatch] = []
        var createdFrameIds: [(sceneId: String, frameId: String)] = []
        for change in changes {
            if change.operation == "update-frame", let frameId = change.frameId {
                if let frame = scene.frames.first(where: { $0.id == frameId }) {
                    let inverse = inverseFields(for: frame, changedKeys: Set(change.patch.fields.keys))
                    if !inverse.isEmpty {
                        inversePatches.append(StoryboardAssistantUndoPatch(
                            sceneId: scene.id, frameId: frameId, fields: inverse))
                    }
                }
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id,
                    frameId: frameId,
                    fields: change.patch.fields)
            } else if change.operation == "create-frame" {
                let frameId = try await RoleRoomAPIClient.shared.addFrame(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id)
                createdFrameIds.append((scene.id, frameId))
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id,
                    frameId: frameId,
                    fields: change.patch.fields)
            }
        }
        return StoryboardAssistantUndoBatch(
            patches: inversePatches, createdFrameIds: createdFrameIds)
    }

    private func undoLastAcceptedChange() {
        guard let undo = lastUndo else { return }
        isReviewing = true
        errorMessage = nil
        Task {
            do {
                for patch in undo.patches.reversed() {
                    try await RoleRoomAPIClient.shared.saveFramePatch(
                        manuscriptId: board.manuscript.id,
                        sceneId: patch.sceneId,
                        frameId: patch.frameId,
                        fields: patch.fields)
                }
                for created in undo.createdFrameIds.reversed() {
                    try await RoleRoomAPIClient.shared.deleteFrame(
                        manuscriptId: board.manuscript.id,
                        sceneId: created.sceneId,
                        frameId: created.frameId)
                }
                await board.reload()
                lastUndo = nil
                successMessage = "Den godkjente endringen er angret og synket."
            } catch {
                errorMessage = "Kunne ikke angre hele endringen: \(error.localizedDescription)"
            }
            isReviewing = false
        }
    }

    private func inverseFields(
        for frame: FrameSummary,
        changedKeys: Set<String>
    ) -> [String: any Sendable] {
        var values: [String: any Sendable] = [:]
        func nullable(_ value: String?) -> any Sendable { value ?? NSNull() }
        func nullableInt(_ value: Int?) -> any Sendable { value ?? NSNull() }
        for key in changedKeys {
            switch key {
            case "description": values[key] = frame.description
            case "notes": values[key] = nullable(frame.notes)
            case "shotType": values[key] = nullable(frame.shotType)
            case "cameraAngle": values[key] = nullable(frame.cameraAngle)
            case "cameraMovement": values[key] = nullable(frame.movement)
            case "lensMm": values[key] = nullableInt(frame.lensMm)
            case "duration": values[key] = frame.durationSec
            case "transition": values[key] = nullable(frame.transition)
            case "focusDepth": values[key] = nullable(frame.focusDepth)
            case "location": values[key] = nullable(frame.productionLocation)
            case "timeOfDay": values[key] = nullable(frame.timeOfDay)
            case "weather": values[key] = nullable(frame.weather)
            case "screenDirection": values[key] = nullable(frame.screenDirection)
            case "beatTag": values[key] = nullable(frame.beatTag)
            case "continuityNotes": values[key] = nullable(frame.continuityNotes)
            case "productionNotes": values[key] = nullable(frame.productionNotes)
            case "vfxNotes": values[key] = nullable(frame.vfxNotes)
            case "tags": values[key] = frame.tags
            case "revisionStatus": values[key] = nullable(frame.revisionStatus)
            case "revisionReason": values[key] = nullable(frame.revisionReason)
            default: break
            }
        }
        return values
    }

    static func contextDictionary(
        projectId: String,
        projectTitle: String,
        scene: SceneSummary,
        activeFrameId: String?
    ) -> [String: Any] {
        let frames: [[String: Any]] = scene.frames.map { frame in
            var value: [String: Any] = [
                "id": frame.id,
                "shotNumber": frame.shotNumber,
                "description": frame.description,
                "duration": frame.durationSec,
                "tags": frame.tags,
            ]
            value["notes"] = frame.notes
            value["shotType"] = frame.shotType
            value["movement"] = frame.movement
            value["lensMm"] = frame.lensMm
            value["transition"] = frame.transition
            value["focusDepth"] = frame.focusDepth
            value["timeOfDay"] = frame.timeOfDay
            value["weather"] = frame.weather
            value["beatTag"] = frame.beatTag
            value["imageUrl"] = frame.imageUrl
            return value
        }
        var sceneValue: [String: Any] = [
            "id": scene.id,
            "heading": scene.heading,
            "characters": scene.characters,
            "dialogue": [[String: Any]](),
        ]
        sceneValue["action"] = scene.descriptionText
        sceneValue["intExt"] = scene.intExt
        sceneValue["location"] = scene.location
        sceneValue["timeOfDay"] = scene.timeOfDay
        var context: [String: Any] = [
            "project": ["id": projectId, "title": projectTitle],
            "scene": sceneValue,
            "frames": frames,
        ]
        context["activeFrameId"] = activeFrameId
        return context
    }

    static func contextRequestBodyData(
        projectId: String,
        projectTitle: String,
        scene: SceneSummary,
        activeFrameId: String?
    ) throws -> Data {
        let body = ["context": contextDictionary(
            projectId: projectId,
            projectTitle: projectTitle,
            scene: scene,
            activeFrameId: activeFrameId)]
        guard JSONSerialization.isValidJSONObject(body) else {
            throw SyncError.malformed("storyboard-skill context")
        }
        return try JSONSerialization.data(withJSONObject: body)
    }
}
