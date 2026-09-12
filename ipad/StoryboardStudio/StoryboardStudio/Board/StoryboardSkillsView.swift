import SwiftUI

enum StoryboardSkillID: String, CaseIterable, Identifiable, Codable, Sendable {
    case planSceneCoverage = "plan_scene_coverage"
    case auditVisualContinuity = "audit_visual_continuity"
    case designShotVariants = "design_shot_variants"
    case translateArtistMarks = "translate_artist_marks"
    case auditBoardReadability = "audit_board_readability"
    case buildAnimaticPass = "build_animatic_pass"
    case auditProductionFeasibility = "audit_production_feasibility"

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
    }
}

struct StoryboardSkillsView: View {
    @ObservedObject var board: BoardState
    let projectId: String

    @State private var selectedSkill: StoryboardSkillID = .planSceneCoverage
    @State private var definitions: [StoryboardSkillDefinitionDTO] = []
    @State private var suggestion: StoryboardSkillSuggestionDTO?
    @State private var isRunning = false
    @State private var isReviewing = false
    @State private var retryChanges: [StoryboardSkillChangeDTO] = []
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                Group {
                    if proxy.size.width >= 800 {
                        HStack(spacing: 0) {
                            skillList.frame(width: 300)
                            Divider()
                            resultPane
                        }
                    } else {
                        VStack(spacing: 0) {
                            skillPicker
                            Divider()
                            resultPane
                        }
                    }
                }
                .background(BoardBrand.chrome)
            }
            .navigationTitle("Storyboard Skills")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(BoardBrand.panel, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Label("Forslag — aldri autoendring", systemImage: "hand.raised")
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

    private var skillList: some View {
        List {
            ForEach(StoryboardSkillID.allCases) { skill in
                Button {
                    selectedSkill = skill
                    suggestion = nil
                    errorMessage = nil
                    successMessage = nil
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: skill.icon)
                            .frame(width: 28).foregroundStyle(BoardBrand.accent)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(remoteDefinition(for: skill)?.shortTitle ?? skill.title)
                                .font(.subheadline.weight(.semibold))
                            Text(remoteDefinition(for: skill)?.description ?? skill.detail)
                                .font(.caption).foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(selectedSkill == skill
                    ? BoardBrand.accent.opacity(0.16) : BoardBrand.panel)
                .accessibilityIdentifier("storyboard.skills.select.\(skill.rawValue)")
            }
        }
        .scrollContentBackground(.hidden)
        .background(BoardBrand.panel)
    }

    private var skillPicker: some View {
        Picker("Skill", selection: $selectedSkill) {
            ForEach(StoryboardSkillID.allCases) { skill in
                Text(skill.title).tag(skill)
            }
        }
        .pickerStyle(.menu)
        .padding()
        .onChange(of: selectedSkill) {
            suggestion = nil; errorMessage = nil; successMessage = nil
        }
    }

    private var resultPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: selectedSkill.icon)
                        .font(.title2).foregroundStyle(BoardBrand.accent)
                        .frame(width: 44, height: 44)
                        .background(BoardBrand.accent.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(remoteDefinition(for: selectedSkill)?.title ?? selectedSkill.title)
                            .font(.title3.bold()).foregroundStyle(.white)
                        Text(remoteDefinition(for: selectedSkill)?.description ?? selectedSkill.detail)
                            .font(.subheadline).foregroundStyle(BoardBrand.dim)
                    }
                    Spacer()
                    Text("0 USD").font(.caption.bold()).foregroundStyle(.green)
                }

                Button { runSelectedSkill() } label: {
                    if isRunning {
                        ProgressView().tint(.white)
                    } else {
                        Label("Kjør skill", systemImage: "play.fill")
                    }
                }
                .buttonStyle(.borderedProminent).tint(BoardBrand.accent)
                .disabled(isRunning || isReviewing || (selectedSkill.requiresFrame && board.frame == nil))
                .accessibilityIdentifier("storyboard.skills.run")

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
            Text(result.summary).foregroundStyle(.white)
            Text(result.rationale).font(.caption).foregroundStyle(BoardBrand.dim)

            ForEach(result.evidence) { item in
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.label).font(.caption.bold()).foregroundStyle(.white)
                    Text(item.detail).font(.caption).foregroundStyle(BoardBrand.dim)
                }
                .padding(.leading, 10)
                .overlay(alignment: .leading) {
                    Rectangle().fill(BoardBrand.accent).frame(width: 2)
                }
            }

            ForEach(result.alternatives) { alternative in
                VStack(alignment: .leading, spacing: 6) {
                    Text(alternative.title).font(.subheadline.bold()).foregroundStyle(.white)
                    Text(alternative.tradeoff).font(.caption).foregroundStyle(BoardBrand.dim)
                    if suggestion.status == "pending" {
                        Button("Velg og bruk") { accept(changes: alternative.changes) }
                            .buttonStyle(.bordered).tint(BoardBrand.accent)
                            .disabled(isReviewing)
                            .accessibilityIdentifier("storyboard.skills.alternative.\(alternative.id)")
                    }
                }
                .padding(12).background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
            }

            if suggestion.status == "pending" && !result.alternatives.isEmpty {
                Button("Avvis alle alternativer", role: .destructive) { reject() }
                    .disabled(isReviewing)
                    .accessibilityIdentifier("storyboard.skills.reject")
            }

            ForEach(result.warnings, id: \.self) { warning in
                Label(warning, systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(.orange)
            }

            if suggestion.status == "pending" && result.alternatives.isEmpty {
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
            }

            if suggestion.status == "accepted" && !retryChanges.isEmpty {
                Button("Prøv å bruke godkjent forslag igjen") { retryApply() }
                    .buttonStyle(.bordered).tint(.orange)
                    .disabled(isReviewing)
                    .accessibilityIdentifier("storyboard.skills.retryApply")
            }

            Text("Fingerprint \(String(result.contextFingerprint.prefix(12))) · \(result.skillVersion)")
                .font(.caption2.monospaced()).foregroundStyle(BoardBrand.label)
        }
        .padding(16)
        .background(BoardBrand.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(BoardBrand.border))
        .accessibilityIdentifier("storyboard.skills.result")
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
                try await apply(changes: changes)
                await board.reload()
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
                try await apply(changes: changes)
                await board.reload()
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

    private func apply(changes: [StoryboardSkillChangeDTO]) async throws {
        guard let scene = board.scene else { return }
        for change in changes {
            if change.operation == "update-frame", let frameId = change.frameId {
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id,
                    frameId: frameId,
                    fields: change.patch.fields)
            } else if change.operation == "create-frame" {
                let frameId = try await RoleRoomAPIClient.shared.addFrame(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id)
                try await RoleRoomAPIClient.shared.saveFramePatch(
                    manuscriptId: board.manuscript.id,
                    sceneId: scene.id,
                    frameId: frameId,
                    fields: change.patch.fields)
            }
        }
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
