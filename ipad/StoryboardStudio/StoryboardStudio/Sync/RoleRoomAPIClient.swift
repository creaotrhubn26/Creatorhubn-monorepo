import Foundation
import UIKit

// Fase 2: sync mot The Role Room. Bruker NØYAKTIG samme HTTP-flate som
// web-klienten (manuscriptService/settingsService):
//   GET  /api/auth/user                                  → valider token + userId
//   GET  /api/casting/projects                           → prosjektliste
//   GET  /api/casting/manuscripts?projectId=…            → manus per prosjekt
//   GET  /api/casting/manuscripts/:manuscriptId/scenes → scener m/ storyboardFrames
//   POST /api/casting/scenes { …scene }               → upsert på scene.id
//   (settings-namespacet er kun web-klientens offline-cache — ikke sannheten)
//
// Scenene holdes som RÅ JSON ([String: Any]) internt i actoren så ukjente
// felter bevares tapsfritt ved skriving — UI får kun Sendable summaries.

struct ProjectSummary: Identifiable, Sendable {
    let id: String
    let name: String
}

struct ManuscriptSummary: Identifiable, Sendable {
    let id: String
    let title: String
}

struct ReviewComment: Identifiable, Sendable {
    let id: String
    let role: String     // Director / DP / Producer / Editor / Artist
    let author: String
    let text: String
    let at: String       // ISO
    // Pin på bildet (normalisert 0–1) — mockupens nummererte markører.
    let x: Double?
    let y: Double?
    // Tråder + reaksjoner
    let parentId: String?
    let likes: Int?
    // Pin-lederlinje: valgfritt målpunkt (normalisert) linjen peker på
    let targetX: Double?
    let targetY: Double?
}

/// En AI-generert bildeversjon som hører til ett storyboard-shot. Versjonene
/// lagres sammen med framen slik at Retry ikke overskriver tidligere valg.
struct AIImageVersion: Identifiable, Sendable, Equatable {
    let id: String
    let imageURL: String
    let prompt: String
    let styleID: String
    let generatedAt: String
    let revisedPrompt: String?

    init?(dictionary: [String: Any]) {
        guard let id = dictionary["id"] as? String,
              let imageURL = (dictionary["imageURL"] as? String)
                ?? (dictionary["imageUrl"] as? String) else { return nil }
        self.id = id
        self.imageURL = imageURL
        self.prompt = (dictionary["prompt"] as? String) ?? ""
        self.styleID = (dictionary["styleID"] as? String)
            ?? (dictionary["styleId"] as? String) ?? "story-pencil"
        self.generatedAt = (dictionary["generatedAt"] as? String) ?? ""
        self.revisedPrompt = dictionary["revisedPrompt"] as? String
    }

    init(id: String, imageURL: String, prompt: String, styleID: String,
         generatedAt: String, revisedPrompt: String?) {
        self.id = id
        self.imageURL = imageURL
        self.prompt = prompt
        self.styleID = styleID
        self.generatedAt = generatedAt
        self.revisedPrompt = revisedPrompt
    }

    var dictionary: [String: String] {
        var value = [
            "id": id, "imageURL": imageURL, "prompt": prompt,
            "styleID": styleID, "generatedAt": generatedAt,
        ]
        if let revisedPrompt { value["revisedPrompt"] = revisedPrompt }
        return value
    }
}

/// Permanent referanse til en ferdig AI-video. Selve avspillings-URL-en
/// persisteres ikke fordi B2-signaturen utløper; jobId gir en fersk URL.
struct AIVideoVersion: Identifiable, Sendable, Equatable {
    let id: String
    let modelID: String
    let provider: String
    let label: String
    let prompt: String
    let duration: Int
    let generatedAt: String

    init?(dictionary: [String: Any]) {
        guard let id = dictionary["id"] as? String,
              let modelID = (dictionary["modelID"] as? String)
                ?? (dictionary["modelId"] as? String) else { return nil }
        self.id = id
        self.modelID = modelID
        self.provider = (dictionary["provider"] as? String) ?? "AI"
        self.label = (dictionary["label"] as? String) ?? provider
        self.prompt = (dictionary["prompt"] as? String) ?? ""
        self.duration = (dictionary["duration"] as? Int)
            ?? (dictionary["duration"] as? NSNumber)?.intValue
            ?? Int(dictionary["duration"] as? String ?? "") ?? 4
        self.generatedAt = (dictionary["generatedAt"] as? String) ?? ""
    }

    init(id: String, modelID: String, provider: String, label: String,
         prompt: String, duration: Int, generatedAt: String) {
        self.id = id
        self.modelID = modelID
        self.provider = provider
        self.label = label
        self.prompt = prompt
        self.duration = duration
        self.generatedAt = generatedAt
    }

    var dictionary: [String: String] {
        [
            "id": id, "modelID": modelID, "provider": provider,
            "label": label, "prompt": prompt, "duration": String(duration),
            "generatedAt": generatedAt,
        ]
    }
}

struct StoryboardVideoModelOption: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let provider: String
    let gateway: String
    let costPerSecondUSD: Double
    let configured: Bool
}

struct StoryboardVideoConfig: Sendable, Equatable {
    let enabled: Bool
    let allowed: Bool
    let imageConfigured: Bool
    let billingMode: String
    let billingMultiplier: Double
    let imageStandardChargeUSD: Double
    let imageHDChargeUSD: Double
    let consented: Bool
    let defaultModel: String?
    let models: [StoryboardVideoModelOption]
}

struct StoryboardVideoJob: Sendable, Equatable {
    let jobId: String
    let status: String
    let model: String
    let provider: String
    let duration: Int
    let estimatedCostUSD: Double
    let prompt: String
    let videoURL: URL?
    let error: String?
}

enum StoryboardRecordLookup {
    static func existingID(in payload: [String: Any], frameId: String) -> String? {
        guard let records = payload["data"] as? [[String: Any]] else { return nil }
        return records.first(where: { record in
            let recordFrameID = (record["frameId"] as? String)
                ?? (record["frame_id"] as? String)
            return recordFrameID == frameId
        })?["id"] as? String
    }
}

enum StorageDownloadPath {
    /// Godtar kun appens eksakte Role Room-format, ikke tilfeldige URL-er.
    static func fileID(from path: String?) -> String? {
        guard let path else { return nil }
        let cleanPath: String
        if let url = URL(string: path), url.scheme != nil {
            cleanPath = url.path
        } else {
            cleanPath = path.split(separator: "?", maxSplits: 1).first.map(String.init) ?? path
        }
        let components = cleanPath.split(separator: "/").map(String.init)
        guard components.count == 6,
              components[0] == "api",
              components[1] == "role-room",
              components[2] == "storage",
              components[3] == "files",
              components[5] == "download",
              UUID(uuidString: components[4]) != nil else { return nil }
        return components[4]
    }
}

struct GeneratedStoryboardImage: Sendable {
    let imageDataURL: String
    let composedPrompt: String
    let revisedPrompt: String?
    let contextFingerprint: String?
    let animationPrompt: String?
    let promptEngine: StoryboardPromptEngineResult?
}

struct StoryboardReferenceAsset: Identifiable, Sendable, Equatable {
    let id: String
    let packID: String
    let packVersion: String
    let entityType: String
    let entityID: String
    let sceneIDs: [String]
    let name: String
    let description: String
    let approvalStatus: String
    let locked: Bool
    let imageURL: String
    let updatedAt: String

    init(dictionary: [String: Any]) throws {
        guard let id = dictionary["id"] as? String,
              let name = dictionary["name"] as? String,
              let imageURL = dictionary["imageUrl"] as? String else {
            throw SyncError.malformed("storyboard-reference")
        }
        self.id = id
        self.packID = (dictionary["packId"] as? String) ?? "project"
        self.packVersion = (dictionary["packVersion"] as? String) ?? "v1"
        self.entityType = (dictionary["entityType"] as? String) ?? "storyboard"
        self.entityID = (dictionary["entityId"] as? String) ?? ""
        self.sceneIDs = (dictionary["sceneIds"] as? [String]) ?? []
        self.name = name
        self.description = (dictionary["description"] as? String) ?? ""
        self.approvalStatus = (dictionary["approvalStatus"] as? String) ?? "draft"
        self.locked = (dictionary["locked"] as? Bool) ?? false
        self.imageURL = imageURL
        self.updatedAt = (dictionary["updatedAt"] as? String) ?? ""
    }
}

struct StoryboardPromptConstraint: Identifiable, Sendable, Equatable {
    let id: String
    let text: String
    let source: String
    let locked: Bool
}

struct StoryboardPromptModule: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let constraints: [StoryboardPromptConstraint]
}

struct StoryboardPromptValidationIssue: Identifiable, Sendable, Equatable {
    let id: String
    let severity: String
    let message: String
    let module: String?
}

struct StoryboardPromptEngineResult: Sendable, Equatable {
    let version: String
    let contextFingerprint: String
    let intentKind: String
    let compiledPrompt: String
    let modules: [StoryboardPromptModule]
    let validationValid: Bool
    let validationIssues: [StoryboardPromptValidationIssue]
    let inheritedConstraintCount: Int
    let characterCount: Int
    let characterReferenceCount: Int
    let locationReferenceCount: Int
    let styleProfileLabel: String
    let lockedProperties: [String]
    let modelID: String
    let modelLabel: String
    let modelProvider: String
    let userIntent: String

    init(dictionary: [String: Any]) throws {
        guard let version = dictionary["version"] as? String,
              let fingerprint = dictionary["contextFingerprint"] as? String,
              let intentKind = dictionary["intentKind"] as? String,
              let compiledPrompt = dictionary["compiledPrompt"] as? String,
              let inspector = dictionary["inspector"] as? [String: Any],
              let validation = dictionary["validation"] as? [String: Any],
              let model = inspector["model"] as? [String: Any] else {
            throw SyncError.malformed("prompt-engine")
        }
        self.version = version
        self.contextFingerprint = fingerprint
        self.intentKind = intentKind
        self.compiledPrompt = compiledPrompt
        self.validationValid = (validation["valid"] as? Bool) ?? false
        self.inheritedConstraintCount = (inspector["inheritedConstraintCount"] as? NSNumber)?.intValue ?? 0
        self.characterCount = (inspector["characterCount"] as? NSNumber)?.intValue ?? 0
        self.characterReferenceCount = (inspector["characterReferenceCount"] as? NSNumber)?.intValue ?? 0
        self.locationReferenceCount = (inspector["locationReferenceCount"] as? NSNumber)?.intValue ?? 0
        self.styleProfileLabel = (inspector["styleProfileLabel"] as? String) ?? "Storyboard"
        self.lockedProperties = (inspector["lockedProperties"] as? [String]) ?? []
        let decodedModelID = (model["id"] as? String) ?? "AI"
        self.modelID = decodedModelID
        self.modelLabel = (model["label"] as? String) ?? decodedModelID
        self.modelProvider = (model["provider"] as? String) ?? "AI"
        self.userIntent = (inspector["intent"] as? String) ?? ""
        self.modules = ((dictionary["modules"] as? [[String: Any]]) ?? []).compactMap { item -> StoryboardPromptModule? in
            guard let id = item["id"] as? String,
                  let label = item["label"] as? String else { return nil }
            let constraints = ((item["constraints"] as? [[String: Any]]) ?? []).compactMap { value -> StoryboardPromptConstraint? in
                guard let constraintID = value["id"] as? String,
                      let text = value["text"] as? String else { return nil }
                return StoryboardPromptConstraint(
                    id: constraintID,
                    text: text,
                    source: (value["source"] as? String) ?? "context",
                    locked: (value["locked"] as? Bool) ?? false)
            }
            return StoryboardPromptModule(id: id, label: label, constraints: constraints)
        }
        self.validationIssues = ((validation["issues"] as? [[String: Any]]) ?? []).compactMap { issue -> StoryboardPromptValidationIssue? in
            guard let code = issue["code"] as? String,
                  let message = issue["message"] as? String else { return nil }
            return StoryboardPromptValidationIssue(
                id: code,
                severity: (issue["severity"] as? String) ?? "warning",
                message: message,
                module: issue["module"] as? String)
        }
    }
}

struct StoryboardAIShotNeighbour: Equatable, Sendable {
    let shotNumber: String
    let description: String

    var dictionary: [String: Any] {
        ["shotNumber": shotNumber, "description": description]
    }
}

enum StoryboardCharacterName {
    /// Role Room kan lagre scene-cast som stabile role-ID-er. AI og UI skal ha
    /// menneskenavnet, ikke f.eks. `troll-1780071501773-role-nora`.
    static func display(_ rawValue: String) -> String {
        let raw = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let lowered = raw.lowercased()
        let token = "-role-"
        guard let range = lowered.range(of: token, options: .backwards) else {
            return raw
        }
        let slug = String(raw[range.upperBound...])
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return slug.isEmpty ? raw : slug.capitalized
    }
}

/// Provider-uavhengig manus-snapshot for ett shot. Samme objekt sendes til
/// både bilde- og video-ruten, slik at animasjonen arver dramaturgi, kamera og
/// kontinuitet i stedet for å tolke bare et stillbilde og en løs prompt.
struct StoryboardAIShotContext: Equatable, Sendable {
    static let currentVersion = "storyboard-shot-v1"

    let manuscriptTitle: String
    let sceneId: String
    let sceneNumber: Int?
    let sceneHeading: String
    let intExt: String
    let location: String
    let sceneTimeOfDay: String
    let sceneAction: String
    let characters: [String]
    let shotId: String
    let shotNumber: String
    let shotDescription: String
    let shotNotes: String
    let shotType: String
    let lensMm: Int?
    let movement: String
    let durationSec: Double
    let transition: String
    let focusDepth: String
    let shotTimeOfDay: String
    let weather: String
    let beat: String
    let tags: [String]
    let previous: StoryboardAIShotNeighbour?
    let next: StoryboardAIShotNeighbour?
    let directorNote: String
    let visualStyle: String
    var styleProfileId: String = "story-pencil"
    var cameraAngle: String = ""
    var lighting: String = ""

    static func build(
        manuscriptTitle: String,
        scene: SceneSummary,
        frame: FrameSummary,
        directorNote: String,
        styleProfileId: String = "story-pencil",
        visualStyle: String
    ) -> StoryboardAIShotContext {
        let index = scene.frames.firstIndex { $0.id == frame.id }
        let previousFrame = index.flatMap { $0 > 0 ? scene.frames[$0 - 1] : nil }
        let nextFrame = index.flatMap { $0 + 1 < scene.frames.count ? scene.frames[$0 + 1] : nil }
        return StoryboardAIShotContext(
            manuscriptTitle: clean(manuscriptTitle, limit: 300),
            sceneId: clean(scene.id, limit: 200),
            sceneNumber: scene.sceneNumber,
            sceneHeading: clean(scene.heading, limit: 500),
            intExt: clean(scene.intExt, limit: 40),
            location: clean(frame.setLocation ?? scene.location, limit: 500),
            sceneTimeOfDay: clean(scene.timeOfDay, limit: 100),
            sceneAction: clean(scene.descriptionText, limit: 4_000),
            characters: Array(scene.characters
                .map(StoryboardCharacterName.display)
                .map { clean($0, limit: 200) }
                .filter { !$0.isEmpty }.prefix(40)),
            shotId: clean(frame.id, limit: 200),
            shotNumber: clean(frame.shotNumber, limit: 40),
            shotDescription: clean(frame.description, limit: 2_000),
            shotNotes: clean(frame.notes, limit: 1_200),
            shotType: clean(frame.shotType, limit: 120),
            lensMm: frame.lensMm,
            movement: clean(frame.movement, limit: 160),
            durationSec: frame.durationSec,
            transition: clean(frame.transition, limit: 160),
            focusDepth: clean(frame.focusDepth, limit: 160),
            shotTimeOfDay: clean(frame.timeOfDay ?? scene.timeOfDay, limit: 100),
            weather: clean(frame.weather, limit: 160),
            beat: clean(frame.beatTag, limit: 240),
            tags: Array(frame.tags.map { clean($0, limit: 100) }
                .filter { !$0.isEmpty }.prefix(30)),
            previous: previousFrame.map {
                StoryboardAIShotNeighbour(
                    shotNumber: clean($0.shotNumber, limit: 40),
                    description: clean($0.description, limit: 1_200))
            },
            next: nextFrame.map {
                StoryboardAIShotNeighbour(
                    shotNumber: clean($0.shotNumber, limit: 40),
                    description: clean($0.description, limit: 1_200))
            },
            directorNote: clean(directorNote, limit: 1_200),
            visualStyle: clean(visualStyle, limit: 1_000),
            styleProfileId: clean(styleProfileId, limit: 100),
            cameraAngle: clean(frame.cameraAngle, limit: 80),
            lighting: clean(frame.lighting, limit: 500))
    }

    var dictionary: [String: Any] {
        [
            "version": Self.currentVersion,
            "manuscriptTitle": manuscriptTitle,
            "project": [
                "styleProfileId": styleProfileId,
                "creativeDirection": visualStyle,
            ],
            "production": [
                "characters": characters.map {
                    ["name": $0, "referenceImageIds": [], "locked": true] as [String: Any]
                },
                "wardrobe": [],
                "locations": [],
                "props": [],
            ],
            "scene": [
                "id": sceneId,
                "number": sceneNumber as Any? ?? NSNull(),
                "heading": sceneHeading,
                "intExt": intExt,
                "location": location,
                "timeOfDay": sceneTimeOfDay,
                "action": sceneAction,
                "characters": characters,
            ],
            "shot": [
                "id": shotId,
                "number": shotNumber,
                "description": shotDescription,
                "notes": shotNotes,
                "shotType": shotType,
                "angle": cameraAngle,
                "lensMm": lensMm as Any? ?? NSNull(),
                "movement": movement,
                "lighting": lighting,
                "durationSec": durationSec,
                "transition": transition,
                "focusDepth": focusDepth,
                "timeOfDay": shotTimeOfDay,
                "weather": weather,
                "beat": beat,
                "tags": tags,
            ],
            "continuity": [
                "previous": previous?.dictionary as Any? ?? NSNull(),
                "next": next?.dictionary as Any? ?? NSNull(),
            ],
            "directorNote": directorNote,
            "visualStyle": visualStyle,
        ]
    }

    var summary: String {
        let sceneLabel = [sceneNumber.map { "Scene \($0)" }, sceneHeading]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        let camera = [shotType, cameraAngle, lensMm.map { "\($0) mm" } ?? "", movement]
            .filter { !$0.isEmpty }.joined(separator: " · ")
        return [sceneLabel, "Shot \(shotNumber)", camera, characters.joined(separator: ", ")]
            .filter { !$0.isEmpty }.joined(separator: " | ")
    }

    /// Fallback for dagens produksjons-backend, som ennå bare leser ett
    /// sceneDescription-felt. Viktigste shot-data står først før 2000-grensen.
    var legacySceneDescription: String {
        let camera = [shotType, cameraAngle, lensMm.map { "\($0) mm" } ?? "", movement]
            .filter { !$0.isEmpty }.joined(separator: ", ")
        let parts = [
            "CURRENT SHOT \(shotNumber): \(shotDescription)",
            camera.isEmpty ? "" : "CAMERA: \(camera)",
            characters.isEmpty ? "" : "CHARACTERS: \(characters.joined(separator: ", "))",
            [intExt, location, shotTimeOfDay].filter { !$0.isEmpty }.joined(separator: " · "),
            sceneAction.isEmpty ? "" : "FULL SCENE ACTION: \(sceneAction)",
            previous.map { "PREVIOUS SHOT \($0.shotNumber): \($0.description)" } ?? "",
            next.map { "NEXT SHOT \($0.shotNumber): \($0.description)" } ?? "",
            beat.isEmpty ? "" : "DRAMATIC BEAT: \(beat)",
        ].filter { !$0.isEmpty }.joined(separator: "\n")
        return String(parts.prefix(2_000))
    }

    var serializedJSON: String? {
        guard JSONSerialization.isValidJSONObject(dictionary),
              let data = try? JSONSerialization.data(
                withJSONObject: dictionary, options: [.sortedKeys]) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func clean(_ value: String?, limit: Int) -> String {
        let compact = (value ?? "")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(compact.prefix(limit))
    }
}

enum StorageUploadFilename {
    static func sanitized(_ value: String) -> String {
        let punctuation = CharacterSet(charactersIn: "._- ")
        let characters = value.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) || punctuation.contains(scalar) {
                return Character(String(scalar))
            }
            return "-"
        }
        let clipped = String(String(characters).prefix(180))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return clipped.isEmpty ? "storyboard-frame.jpg" : clipped
    }
}

struct FrameSummary: Identifiable, Sendable {
    let id: String
    let shotNumber: String
    let detail: String
    var strokesJSON: String?
    // Intensjonslaget (native Board) — samme felter som web-Inspector
    let description: String
    let notes: String?
    let shotType: String?
    let lensMm: Int?
    let movement: String?
    let durationSec: Double
    let transition: String?
    let focusDepth: String?
    let timeOfDay: String?
    let weather: String?
    let beatTag: String?
    let tags: [String]
    let thumbnailDataURL: String?
    // drawingData.width/height — koordinatrommet strøkene er lagret i.
    let drawingWidth: Double
    let drawingHeight: Double
    // Review (web-paritet): planned / in_review / needs_work / done + kommentarer
    let frameStatus: String?
    let comments: [ReviewComment]
    // Konfliktdeteksjon (samme-frame-merge): serverens updatedAt ved lasting
    var updatedAt: String?
    // Referanse-underlag (kun visning i canvas — aldri i eksport)
    let underlayDataURL: String?
    let underlayOpacity: Double?
    // Perspektiv-hjelpelinjer (persistert per frame; kun visning)
    let perspectiveMode: Int?
    let vanishingPoints: [[Double]]?
    // Voiceover (m4a base64) — synkes så animatic-lyd følger prosjektet
    let voiceoverDataURL: String?
    // Bilde-frame (importert/AI): statisk bildeinnhold som VISES og
    // EKSPORTERES (i motsetning til underlag). dataURL støttes native.
    let imageUrl: String?
    // Review-flaten: prioritet/frist/godkjenning
    let reviewPriority: String?
    let reviewDueAt: String?
    let reviewApprovedBy: String?
    let reviewApprovedAt: String?
    let reviewStarred: Bool?
    let reviewAssignee: String?
    let reviewColorLabel: String?
    let reviewSnoozedUntil: String?
    // Produksjonsdetaljer (mockup-paritet) — defaults så eksisterende
    // init-kall ikke må endres.
    var setLocation: String? = nil
    var stageUnit: String? = nil
    var reviewFollowers: [String]? = nil
    var imageSource: String? = nil
    var aiImageVersions: [AIImageVersion] = []
    var aiVideoVersions: [AIVideoVersion] = []
    var cameraAngle: String? = nil
    var lighting: String? = nil
}

struct SceneSummary: Identifiable, Sendable {
    let id: String
    let heading: String
    var frames: [FrameSummary]
    // Presentasjonsmetadata (pitch-formatet): konsept-linje + footer-
    // seksjoner (JSON [{title, items[]}]) — lagres på første scene.
    let presentationConcept: String?
    let presentationFooter: String?
    // Hub-metadata (prosjektoversikten): oppgaver/notater/moodboard/sitat.
    let hubTasks: String?
    let hubNotes: String?
    let hubQuote: String?
    let hubMoodboard: String?
    let hubMapPositions: String?
    let hubMapNotes: String?
    let hubTeam: String?
    let hubInfo: String?
    let hubAssetFolders: String?
    let hubAssetColors: String?
    // Manusfelter (Script-fanen)
    let sceneNumber: Int?
    let intExt: String?
    let location: String?
    let timeOfDay: String?
    let descriptionText: String?
    let characters: [String]
}

enum SyncError: LocalizedError {
    case notConfigured
    case http(Int)
    case unauthenticated
    case malformed(String)
    case remote(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server og token er ikke satt."
        case .http(let code): return "Serverfeil (\(code))."
        case .unauthenticated: return "Token er ugyldig eller utløpt."
        case .malformed(let what): return "Uventet svar: \(what)."
        case .remote(let message): return message
        }
    }
}

// Konflikt-merge (samme frame redigert fra to enheter): union på stroke-id.
// Serverens strøk beholdes i sin rekkefølge; våre nye appendes. Tegning er
// append-dominert, så union taper aldri data (sletting på vår side i
// konflikt-tilfellet overlever ikke — akseptert trade-off).
enum StrokeMerge {
    static func union(serverJSON: String, oursJSON: String) -> String? {
        guard let serverData = serverJSON.data(using: .utf8),
              let ourData = oursJSON.data(using: .utf8),
              let serverList = (try? JSONSerialization.jsonObject(with: serverData)) as? [[String: Any]],
              let ourList = (try? JSONSerialization.jsonObject(with: ourData)) as? [[String: Any]] else {
            return nil
        }
        let serverIds = Set(serverList.compactMap { $0["id"] as? String })
        let newOnes = ourList.filter { stroke in
            guard let id = stroke["id"] as? String else { return false }
            return !serverIds.contains(id)
        }
        guard let mergedData = try? JSONSerialization.data(withJSONObject: serverList + newOnes) else {
            return nil
        }
        return String(data: mergedData, encoding: .utf8)
    }
}

actor RoleRoomAPIClient {
    static let shared = RoleRoomAPIClient()
    static let scenesNamespace = "virtualStudio_manuscriptScenes"

    private var baseURL: URL?
    private var token: String?
    private var userId: String?
    private var userName: String?
    // Rå sceneliste per manuscriptId — bevares tapsfritt for PUT.
    private var rawScenes: [String: [[String: Any]]] = [:]

    // MARK: Konfigurasjon

    func configure(server: String, token: String) async throws -> String {
        guard let url = URL(string: server.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.hasPrefix("http") == true else {
            throw SyncError.notConfigured
        }
        self.baseURL = url
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = try await getJSON(path: "/api/auth/user", query: [:])
        guard let user = payload["user"] as? [String: Any],
              let id = user["id"] as? String else {
            self.token = nil
            throw SyncError.unauthenticated
        }
        self.userId = id
        let name = (user["displayName"] as? String) ?? (user["name"] as? String) ?? id
        self.userName = name
        return name
    }

    var isConfigured: Bool { baseURL != nil && token != nil && userId != nil }
    var userDisplayName: String? { userName }

    // MARK: Offline-cache (siste vellykkede svar per nøkkel — boardet skal
    // kunne åpnes uten nett; skriving synkes når nettet er tilbake)

    private static var cacheDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("api-cache", isDirectory: true)
    }

    private func cacheWrite(_ object: Any, key: String) {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        try? FileManager.default.createDirectory(at: Self.cacheDirectory, withIntermediateDirectories: true)
        try? data.write(to: Self.cacheDirectory.appendingPathComponent("\(key).json"))
    }

    private func cacheRead(key: String) -> Any? {
        guard let data = try? Data(contentsOf: Self.cacheDirectory.appendingPathComponent("\(key).json")) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    // MARK: Lesing

    func fetchProjects() async throws -> [ProjectSummary] {
        var projects: [[String: Any]]
        do {
            let payload = try await getJSON(path: "/api/casting/projects", query: [:])
            guard let list = payload["projects"] as? [[String: Any]] else {
                throw SyncError.malformed("projects")
            }
            projects = list
            cacheWrite(list, key: "projects")
        } catch {
            guard let cached = cacheRead(key: "projects") as? [[String: Any]] else { throw error }
            projects = cached
        }
        return projects.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return ProjectSummary(id: id, name: (entry["name"] as? String) ?? id)
        }
    }

    func fetchManuscripts(projectId: String) async throws -> [ManuscriptSummary] {
        var list: [[String: Any]]
        do {
            // Prod kan returnere bare array ELLER objekt-innpakning — tåler begge.
            let (data, response) = try await URLSession.shared.data(
                for: request(path: "/api/casting/manuscripts", query: ["projectId": projectId]))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
            }
            let payload = try JSONSerialization.jsonObject(with: data)
            list = (payload as? [[String: Any]])
                ?? ((payload as? [String: Any]).flatMap {
                    ($0["manuscripts"] ?? $0["data"]) as? [[String: Any]]
                })
                ?? []
            cacheWrite(list, key: "manuscripts-\(projectId)")
        } catch {
            guard let cached = cacheRead(key: "manuscripts-\(projectId)") as? [[String: Any]] else { throw error }
            list = cached
        }
        return list.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            let title = (entry["title"] as? String) ?? (entry["name"] as? String) ?? id
            return ManuscriptSummary(id: id, title: title)
        }
    }

    // ETag per manuskript (svarer serverens scenes-version): polling og
    // refresh koster 304-tomt-svar i stedet for hele scenelisten (thumbs +
    // underlag) når ingenting er endret.
    private var scenesETag: [String: String] = [:]

    /// Hent scener med If-None-Match. nil = 304 (uendret — rawScenes gjelder).
    private func fetchScenesRaw(manuscriptId: String) async throws -> [[String: Any]]? {
        var request = try request(path: "/api/casting/manuscripts/\(manuscriptId)/scenes", query: [:])
        // URLCache må ikke besvare betinget GET selv — vi styrer 304 manuelt.
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let etag = scenesETag[manuscriptId], rawScenes[manuscriptId] != nil {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
            // Netlify-proxyen stripper If-None-Match — custom header går gjennom.
            request.setValue(etag, forHTTPHeaderField: "X-If-None-Match")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        if status == 304 { return nil }
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        if let etag = http?.value(forHTTPHeaderField: "ETag") {
            scenesETag[manuscriptId] = etag
        }
        let payload = try JSONSerialization.jsonObject(with: data)
        if let list = payload as? [[String: Any]] { return list }
        if let object = payload as? [String: Any],
           let list = (object["scenes"] ?? object["data"]) as? [[String: Any]] {
            return list
        }
        throw SyncError.malformed("scenes")
    }

    func fetchScenes(manuscriptId: String) async throws -> [SceneSummary] {
        do {
            if let fresh = try await fetchScenesRaw(manuscriptId: manuscriptId) {
                rawScenes[manuscriptId] = fresh
                cacheWrite(fresh, key: "scenes-\(manuscriptId)")
            }
        } catch {
            if rawScenes[manuscriptId] == nil {
                guard let cached = cacheRead(key: "scenes-\(manuscriptId)") as? [[String: Any]] else { throw error }
                rawScenes[manuscriptId] = cached
            }
        }
        return (rawScenes[manuscriptId] ?? []).compactMap(Self.summarize(scene:))
    }

    /// Opprett/finn serverens storyboard-record for et native frame.
    private func ensureStoryboardRecord(
        projectId: String,
        sceneId: String,
        frameId: String,
        title: String
    ) async throws -> String {
        // Prompt Inspector krever bare lesetilgang. Gjenbruk derfor en
        // eksisterende record før vi eventuelt forsøker manage-beskyttet
        // upsert; ellers fikk view-only-artister 403 selv når shotet fantes.
        let existingPayload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards",
            query: ["sceneId": sceneId])
        if let storyboardId = StoryboardRecordLookup.existingID(
            in: existingPayload,
            frameId: frameId) {
            return storyboardId
        }

        let storyboardPayload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards",
            method: "POST",
            body: [
                "sceneId": sceneId,
                "frameId": frameId,
                "title": title,
                "width": 1792,
                "height": 1024,
                "workflowLevel": "idea",
                "metadata": ["source": "storyboard-room-ipad"],
            ])
        guard let storyboardData = storyboardPayload["data"] as? [String: Any],
              let storyboardId = storyboardData["id"] as? String else {
            throw SyncError.malformed("storyboard-id")
        }
        return storyboardId
    }

    /// Kompilerer og inspiserer prompten uten å kontakte en AI-leverandør.
    func compileStoryboardPrompt(
        projectId: String,
        sceneId: String,
        frameId: String,
        title: String,
        kind: String,
        model: String,
        userAction: String,
        context: StoryboardAIShotContext
    ) async throws -> StoryboardPromptEngineResult {
        let storyboardId = try await ensureStoryboardRecord(
            projectId: projectId,
            sceneId: sceneId,
            frameId: frameId,
            title: title)
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/compile-ai-prompt",
            method: "POST",
            body: [
                "kind": kind,
                "model": model,
                "userAction": userAction,
                "context": context.dictionary,
            ])
        guard let data = payload["data"] as? [String: Any] else {
            throw SyncError.malformed("prompt-engine")
        }
        return try StoryboardPromptEngineResult(dictionary: data)
    }

    /// Generer et bilde via den samme prosjektbeskyttede ruten som Storyboard
    /// Room på web.
    func generateStoryboardImage(
        projectId: String,
        sceneId: String,
        frameId: String,
        title: String,
        prompt: String,
        sceneDescription: String,
        intExt: String?,
        timeOfDay: String?,
        locationName: String?,
        shotType: String?,
        styleNote: String,
        quality: String,
        context: StoryboardAIShotContext? = nil
    ) async throws -> GeneratedStoryboardImage {
        let storyboardId = try await ensureStoryboardRecord(
            projectId: projectId,
            sceneId: sceneId,
            frameId: frameId,
            title: title)

        var generationBody: [String: Any] = [
            "prompt": prompt,
            "sceneDescription": sceneDescription,
            "cinematicFormat": "cinematic storyboard frame, 16:9",
            "styleNote": styleNote,
            "quality": quality,
            "aspectRatio": "1792x1024",
        ]
        generationBody["intExt"] = intExt ?? ""
        generationBody["timeOfDay"] = timeOfDay ?? ""
        generationBody["locationName"] = locationName ?? ""
        generationBody["shotType"] = shotType ?? ""
        if let context {
            generationBody["context"] = context.dictionary
        }

        let generated = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/generate-ai-image",
            method: "POST",
            body: generationBody)
        guard let data = generated["data"] as? [String: Any],
              let imageData = data["imageData"] as? String,
              imageData.hasPrefix("data:image") else {
            throw SyncError.malformed("generert bilde")
        }
        return GeneratedStoryboardImage(
            imageDataURL: imageData,
            composedPrompt: (generated["composedPrompt"] as? String) ?? prompt,
            revisedPrompt: generated["revisedPrompt"] as? String,
            contextFingerprint: generated["contextFingerprint"] as? String,
            animationPrompt: generated["animationPrompt"] as? String,
            promptEngine: (generated["promptEngine"] as? [String: Any])
                .flatMap { try? StoryboardPromptEngineResult(dictionary: $0) })
    }

    func fetchStoryboardReferences(projectId: String) async throws -> [StoryboardReferenceAsset] {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboard-references",
            query: [:])
        guard let rows = payload["data"] as? [[String: Any]] else {
            throw SyncError.malformed("storyboard-references")
        }
        return rows.compactMap { try? StoryboardReferenceAsset(dictionary: $0) }
    }

    func reviewStoryboardReference(
        projectId: String,
        assetID: String,
        approvalStatus: String
    ) async throws -> StoryboardReferenceAsset {
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboard-references/\(assetID)",
            method: "PATCH",
            body: [
                "approvalStatus": approvalStatus,
                "locked": approvalStatus == "approved",
            ])
        guard let row = payload["data"] as? [String: Any] else {
            throw SyncError.malformed("storyboard-reference-review")
        }
        return try StoryboardReferenceAsset(dictionary: row)
    }

    func fetchStoryboardVideoConfig(projectId: String) async throws -> StoryboardVideoConfig {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards/ai/video-config",
            query: [:])
        guard let data = payload["data"] as? [String: Any] else {
            throw SyncError.malformed("video-config")
        }
        let models = ((data["models"] as? [[String: Any]]) ?? []).compactMap { model -> StoryboardVideoModelOption? in
            guard let key = model["key"] as? String,
                  let label = model["label"] as? String else { return nil }
            return StoryboardVideoModelOption(
                id: key,
                label: label,
                provider: (model["provider"] as? String) ?? "AI",
                gateway: (model["gateway"] as? String) ?? "fal",
                costPerSecondUSD: (model["costPerSecondUsd"] as? NSNumber)?.doubleValue ?? 0,
                configured: (model["configured"] as? Bool) ?? false)
        }
        let consent = data["consent"] as? [String: Any]
        let imageCharge = data["imageEstimatedChargeUsd"] as? [String: Any]
        return StoryboardVideoConfig(
            enabled: (data["enabled"] as? Bool) ?? false,
            allowed: (data["allowed"] as? Bool) ?? false,
            imageConfigured: (data["imageConfigured"] as? Bool) ?? false,
            billingMode: (data["billingMode"] as? String) ?? "unknown",
            billingMultiplier: (data["billingMultiplier"] as? NSNumber)?.doubleValue ?? 1,
            imageStandardChargeUSD: (imageCharge?["standard"] as? NSNumber)?.doubleValue ?? 0.06,
            imageHDChargeUSD: (imageCharge?["hd"] as? NSNumber)?.doubleValue ?? 0.22,
            consented: (consent?["consented"] as? Bool) ?? false,
            defaultModel: data["defaultModel"] as? String,
            models: models)
    }

    func setStoryboardAIConsent(projectId: String, consented: Bool) async throws {
        _ = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/ai/consent",
            method: "PUT",
            body: ["consented": consented])
    }

    func generateStoryboardVideo(
        projectId: String,
        sceneId: String,
        frameId: String,
        title: String,
        sourceImagePath: String,
        prompt: String,
        model: String,
        duration: Int,
        context: StoryboardAIShotContext? = nil
    ) async throws -> StoryboardVideoJob {
        guard let sourceFileId = StorageDownloadPath.fileID(from: sourceImagePath) else {
            throw SyncError.remote("Kildebildet må være lagret i prosjektet før det kan animeres.")
        }
        let storyboardId = try await ensureStoryboardRecord(
            projectId: projectId,
            sceneId: sceneId,
            frameId: frameId,
            title: title)
        var generationBody: [String: Any] = [
            "sourceFileId": sourceFileId,
            "prompt": prompt,
            "model": model,
            "duration": duration,
        ]
        if let context {
            generationBody["context"] = context.dictionary
        }
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/generate-ai-video",
            method: "POST",
            body: generationBody)
        return try Self.decodeStoryboardVideoJob(payload)
    }

    func pollStoryboardVideoJob(projectId: String, jobId: String) async throws -> StoryboardVideoJob {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards/ai/video-jobs/\(jobId)",
            query: [:])
        return try Self.decodeStoryboardVideoJob(payload)
    }

    private static func decodeStoryboardVideoJob(_ payload: [String: Any]) throws -> StoryboardVideoJob {
        guard let data = payload["data"] as? [String: Any],
              let jobId = data["jobId"] as? String,
              let status = data["status"] as? String else {
            throw SyncError.malformed("video-job")
        }
        let rawVideoURL = data["videoUrl"] as? String
        return StoryboardVideoJob(
            jobId: jobId,
            status: status,
            model: (data["model"] as? String) ?? "AI",
            provider: (data["provider"] as? String) ?? "AI",
            duration: (data["duration"] as? NSNumber)?.intValue ?? 4,
            estimatedCostUSD: (data["estCostUsd"] as? NSNumber)?.doubleValue ?? 0,
            prompt: (data["prompt"] as? String) ?? "",
            videoURL: rawVideoURL.flatMap(URL.init(string:)),
            error: data["error"] as? String)
    }

    /// Live-polling fra boardet: har serveren en nyere sceneliste?
    /// (Billig 304 ved uendret.) true = rawScenes ble oppdatert.
    func pollScenesChanged(manuscriptId: String) async -> Bool {
        guard let fresh = try? await fetchScenesRaw(manuscriptId: manuscriptId) else { return false }
        rawScenes[manuscriptId] = fresh
        lastRefresh[manuscriptId] = Date()
        cacheWrite(fresh, key: "scenes-\(manuscriptId)")
        return true
    }

    // MARK: Skriving

    /// Konfliktvern: hent fersk sceneliste rett før hver skriving så vår
    /// POST bygger på serverens nyeste versjon (frame-nivå-merge — andre
    /// enheters endringer på andre frames bevares). Feiler henting (offline)
    /// brukes cachen — bedre å skrive gammelt enn å miste tegningen.
    private var lastRefresh: [String: Date] = [:]

    private func refreshScenes(manuscriptId: String) async {
        // Throttle: autosynk-serier på samme frame trenger ikke fersk kopi
        // hver gang — 15 s-vindu balanserer konfliktvern mot trafikk.
        if let last = lastRefresh[manuscriptId], Date().timeIntervalSince(last) < 15 { return }
        if let fresh = try? await fetchScenesRaw(manuscriptId: manuscriptId) {
            rawScenes[manuscriptId] = fresh
            cacheWrite(fresh, key: "scenes-\(manuscriptId)")
        }
        // 304 teller også som fersk — serveren bekreftet at vår kopi gjelder.
        lastRefresh[manuscriptId] = Date()
    }

    /// Skriv strokes (web-JSON-STRENG — parseStoredStrokes-krav) tilbake på
    /// én frame og PUT hele scenelisten (samme granularitet som web).
    /// thumbnailDataURL settes når native har rendret en thumb (ellers
    /// nullstilles den så web regenererer).
    func saveFrameStrokes(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        strokesJSON: String,
        thumbnailDataURL: String? = nil,
        baseUpdatedAt: String? = nil
    ) async throws -> (updatedAt: String?, merged: Bool) {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var found = false
        var mergedAny = false
        for sceneIndex in scenes.indices {
            guard scenes[sceneIndex]["id"] as? String == sceneId else { continue }
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                var drawingData = (frames[frameIndex]["drawingData"] as? [String: Any]) ?? [:]
                // Samme-frame-konflikt (spec: siste-vinner er datatap): har
                // serveren en NYERE versjon enn den vi bygget på, unions-
                // merges strokene på id — serverens beholdes, våre nye
                // legges til. Append-dominert tegning gjør dette trygt.
                var effectiveStrokes = strokesJSON
                var didMerge = false
                if let base = baseUpdatedAt,
                   let serverUpdated = frames[frameIndex]["updatedAt"] as? String,
                   serverUpdated != base,
                   let serverJSON = drawingData["strokes"] as? String,
                   let merged = StrokeMerge.union(serverJSON: serverJSON, oursJSON: strokesJSON) {
                    effectiveStrokes = merged
                    didMerge = merged != strokesJSON
                }
                mergedAny = mergedAny || didMerge
                drawingData["strokes"] = effectiveStrokes
                drawingData["updatedAt"] = now
                if drawingData["createdAt"] == nil { drawingData["createdAt"] = now }
                if drawingData["width"] == nil { drawingData["width"] = 1920 }
                if drawingData["height"] == nil { drawingData["height"] = 1080 }
                frames[frameIndex]["drawingData"] = drawingData
                frames[frameIndex]["imageSource"] = "drawn"
                if let thumbnailDataURL {
                    frames[frameIndex]["thumbnailUrl"] = thumbnailDataURL
                } else {
                    // Web genererer thumbnail automatisk fra strokes ved
                    // visning; nullstill stale thumb så den regenereres.
                    frames[frameIndex]["thumbnailUrl"] = nil
                }
                frames[frameIndex]["updatedAt"] = now
                found = true
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        guard found else { throw SyncError.malformed("frame \(frameId) ikke funnet") }
        rawScenes[manuscriptId] = scenes

        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        // Per-frame PATCH (kun endrede felter — hele scenen med alle thumbs/
        // underlag POSTes ikke lenger per strøk-lagring). Legacy-fallback
        // mot eldre backend.
        if let frames = scene["storyboardFrames"] as? [[String: Any]],
           let frame = frames.first(where: { $0["id"] as? String == frameId }) {
            var fields: [String: Any] = [
                "drawingData": frame["drawingData"] ?? [:],
                "imageSource": "drawn",
            ]
            fields["thumbnailUrl"] = frame["thumbnailUrl"] ?? NSNull()
            if let serverUpdatedAt = try await patchFrameRemote(
                manuscriptId: manuscriptId, sceneId: sceneId,
                frameId: frameId, fields: fields) {
                if !serverUpdatedAt.isEmpty {
                    applyLocalFrameUpdatedAt(manuscriptId: manuscriptId, sceneId: sceneId,
                                             frameId: frameId, updatedAt: serverUpdatedAt)
                    return (serverUpdatedAt, mergedAny)
                }
                return (now, mergedAny)
            }
        }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        return (now, mergedAny)
    }

    /// Skriv serverens autoritative updatedAt inn i lokal rå-scene så
    /// neste konfliktsjekk sammenligner mot riktig verdi.
    private func applyLocalFrameUpdatedAt(
        manuscriptId: String, sceneId: String, frameId: String, updatedAt: String
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                frames[frameIndex]["updatedAt"] = updatedAt
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    /// Patch vilkårlige felter på én frame (Inspector) og upsert scenen.
    func saveFramePatch(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        fields: [String: any Sendable]
    ) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var found = false
        for sceneIndex in scenes.indices {
            guard scenes[sceneIndex]["id"] as? String == sceneId else { continue }
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                for (key, value) in fields {
                    frames[frameIndex][key] = value
                }
                frames[frameIndex]["updatedAt"] = now
                found = true
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        guard found else { throw SyncError.malformed("frame \(frameId) ikke funnet") }
        rawScenes[manuscriptId] = scenes
        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        // Kun endrede felter over nettet — klobber ikke andres samtidige
        // frame-endringer i samme scene (felt-nivå granularitet).
        if let serverUpdatedAt = try await patchFrameRemote(
            manuscriptId: manuscriptId, sceneId: sceneId, frameId: frameId,
            fields: fields as [String: Any]) {
            if !serverUpdatedAt.isEmpty {
                applyLocalFrameUpdatedAt(manuscriptId: manuscriptId, sceneId: sceneId,
                                         frameId: frameId, updatedAt: serverUpdatedAt)
            }
            return
        }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
    }

    /// ADD SHOT: ny tom frame etter siste i scenen (shotNumber = neste
    /// bokstav i samme tallserie, «1A» → «1B»; tom scene → «1A»), upsert.
    func addFrame(manuscriptId: String, sceneId: String) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var newFrameId: String?
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            let lastShot = (frames.last?["shotNumber"] as? String) ?? ""
            let nextShot: String
            if let letter = lastShot.last, letter.isLetter, letter < "Z",
               let next = letter.unicodeScalars.first.flatMap({ UnicodeScalar($0.value + 1) }) {
                nextShot = String(lastShot.dropLast()) + String(Character(next))
            } else if lastShot.isEmpty {
                nextShot = "1A"
            } else {
                nextShot = lastShot + "A"
            }
            let frameId = "frame-\(Int(Date().timeIntervalSince1970 * 1000))"
            frames.append([
                "id": frameId,
                "shotNumber": nextShot,
                "description": "",
                "duration": 2,
                "imageSource": "placeholder",
                "drawingData": ["strokes": "[]", "width": 1920, "height": 1080,
                                "createdAt": now, "updatedAt": now],
                "createdAt": now,
                "updatedAt": now,
            ])
            scenes[sceneIndex]["storyboardFrames"] = frames
            scenes[sceneIndex]["updatedAt"] = now
            newFrameId = frameId
        }
        guard let frameId = newFrameId,
              let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        return frameId
    }

    /// Felles mønster for frame-mutasjoner: fersk scene → muter → upsert.
    private func mutateSceneFrames(
        manuscriptId: String, sceneId: String,
        _ mutate: (inout [[String: Any]]) -> Void
    ) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            mutate(&frames)
            scenes[sceneIndex]["storyboardFrames"] = frames
            scenes[sceneIndex]["updatedAt"] = now
        }
        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
    }

    private static func nextShotNumber(after last: String) -> String {
        if let letter = last.last, letter.isLetter, letter < "Z",
           let next = letter.unicodeScalars.first.flatMap({ UnicodeScalar($0.value + 1) }) {
            return String(last.dropLast()) + String(Character(next))
        }
        return last.isEmpty ? "1A" : last + "A"
    }

    func deleteFrame(manuscriptId: String, sceneId: String, frameId: String) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            frames.removeAll { $0["id"] as? String == frameId }
        }
    }

    func duplicateFrame(manuscriptId: String, sceneId: String, frameId: String) async throws -> String {
        let newId = "frame-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard let index = frames.firstIndex(where: { $0["id"] as? String == frameId }) else { return }
            var copy = frames[index]
            copy["id"] = newId
            copy["shotNumber"] = Self.nextShotNumber(
                after: (frames.last?["shotNumber"] as? String) ?? "")
            copy["updatedAt"] = ISO8601DateFormatter().string(from: Date())
            frames.insert(copy, at: index + 1)
        }
        return newId
    }

    /// Flytt frame ett hakk (offset ±1) i scenens rekkefølge.
    func moveFrame(manuscriptId: String, sceneId: String, frameId: String, offset: Int) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard let index = frames.firstIndex(where: { $0["id"] as? String == frameId }) else { return }
            let target = index + offset
            guard frames.indices.contains(target) else { return }
            frames.swapAt(index, target)
        }
    }

    /// Ny scene i manuset — arver prosjekt-/manusfelter fra eksisterende
    /// scene (upsert-endepunktet oppretter ved ny id).
    func addScene(manuscriptId: String, title: String, projectId: String? = nil) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        var scenes = rawScenes[manuscriptId] ?? []
        let template = scenes.first
        let now = ISO8601DateFormatter().string(from: Date())
        let maxNumber = scenes.compactMap { $0["sceneNumber"] as? Int }.max() ?? scenes.count
        let sceneId = "scene-\(Int(Date().timeIntervalSince1970 * 1000))"
        var scene: [String: Any] = [
            "id": sceneId,
            "title": title,
            "sceneHeading": title,
            "sceneNumber": maxNumber + 1,
            "storyboardFrames": [[String: Any]](),
            "createdAt": now,
            "updatedAt": now,
        ]
        for key in ["manuscriptId", "manuscript_id", "projectId", "project_id", "act_id"] {
            scene[key] = template?[key]
        }
        // Tomt manus: ingen mal å arve fra — bruk kjente id-er direkte.
        if scene["manuscriptId"] == nil { scene["manuscriptId"] = manuscriptId }
        if scene["projectId"] == nil, let projectId { scene["projectId"] = projectId }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        scenes.append(scene)
        rawScenes[manuscriptId] = scenes
        return sceneId
    }

    /// Slett én scene (nytt backend-endepunkt; ingen legacy-fallback —
    /// eldre backend gir 404 og operasjonen feiler synlig).
    func deleteScene(manuscriptId: String, sceneId: String) async throws {
        var request = try request(path: "/api/casting/scenes/\(sceneId)",
                                  query: ["manuscriptId": manuscriptId])
        request.httpMethod = "DELETE"
        let (_, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        lastDeletedScene = rawScenes[manuscriptId]?
            .first { $0["id"] as? String == sceneId }
            .map { (manuscriptId, $0) }
        rawScenes[manuscriptId]?.removeAll { $0["id"] as? String == sceneId }
    }

    /// Dupliser scene: kopi med nye scene-/frame-id-er, «(kopi)»-tittel.
    func duplicateScene(manuscriptId: String, sceneId: String) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId],
              let source = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        var copy = source
        let newId = "scene-\(stamp)"
        copy["id"] = newId
        let title = (source["title"] as? String) ?? (source["sceneHeading"] as? String) ?? "Scene"
        copy["title"] = title + " (kopi)"
        copy["sceneHeading"] = title + " (kopi)"
        copy["sceneNumber"] = (scenes.compactMap { $0["sceneNumber"] as? Int }.max() ?? scenes.count) + 1
        copy["createdAt"] = now
        copy["updatedAt"] = now
        var frames = (source["storyboardFrames"] as? [[String: Any]]) ?? []
        for index in frames.indices {
            frames[index]["id"] = "frame-\(stamp)-\(index)"
        }
        copy["storyboardFrames"] = frames
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: copy)
        scenes.append(copy)
        rawScenes[manuscriptId] = scenes
        return newId
    }

    /// Omdøp scene (upsert av hele scenen — sjelden operasjon).
    func renameScene(manuscriptId: String, sceneId: String, title: String) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId],
              let index = scenes.firstIndex(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        scenes[index]["title"] = title
        scenes[index]["sceneHeading"] = title
        scenes[index]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[index])
    }

    /// Presentasjonsmetadata (konsept + footer-seksjoner) lagres på
    /// FØRSTE scene (kjent lagringsvei; web ignorerer feltene).
    func setPresentationMeta(manuscriptId: String, concept: String,
                             footerJSON: String) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId], !scenes.isEmpty else {
            throw SyncError.malformed("scener ikke lastet")
        }
        scenes[0]["presentationConcept"] = concept
        scenes[0]["presentationFooter"] = footerJSON
        scenes[0]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[0])
    }

    /// Hub-metadata (generisk variant av presentasjons-mønsteret):
    /// vilkårlige felter på FØRSTE scene.
    func setHubMeta(manuscriptId: String, fields: [String: any Sendable]) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId], !scenes.isEmpty else {
            throw SyncError.malformed("scener ikke lastet")
        }
        for (key, value) in fields { scenes[0][key] = value }
        scenes[0]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[0])
    }

    /// Renummerer shots i rekkefølge: prefiks (tall-delen av første shot,
    /// ellers sceneNumber) + A, B, …, Z, AA.
    func renumberFrames(manuscriptId: String, sceneId: String) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard !frames.isEmpty else { return }
            let firstShot = (frames[0]["shotNumber"] as? String) ?? ""
            let digits = firstShot.prefix { $0.isNumber }
            let prefix = digits.isEmpty ? "1" : String(digits)
            for index in frames.indices {
                var letters = ""
                var value = index
                repeat {
                    letters = String(UnicodeScalar(UInt8(65 + value % 26))) + letters
                    value = value / 26 - 1
                } while value >= 0
                frames[index]["shotNumber"] = prefix + letters
            }
        }
    }

    /// Presence: meld tilstedeværelse og få andre aktive (visningsnavn).
    func reportPresence(manuscriptId: String) async -> [String] {
        guard let name = userName else { return [] }
        var request = (try? request(path: "/api/casting/manuscripts/\(manuscriptId)/presence",
                                    query: [:]))
        request?.httpMethod = "POST"
        request?.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request?.httpBody = try? JSONSerialization.data(withJSONObject: ["displayName": name])
        guard let request,
              let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let others = payload["presence"] as? [[String: Any]] else { return [] }
        return others.compactMap { ($0["displayName"] as? String) ?? ($0["userId"] as? String) }
    }

    /// Tegne-historikk for én frame (server bevarer 3 siste versjoner).
    func frameHistory(manuscriptId: String, sceneId: String,
                      frameId: String) async -> [(updatedAt: String, strokes: String)] {
        await refreshScenes(manuscriptId: manuscriptId)
        guard let scenes = rawScenes[manuscriptId],
              let scene = scenes.first(where: { $0["id"] as? String == sceneId }),
              let frames = scene["storyboardFrames"] as? [[String: Any]],
              let frame = frames.first(where: { $0["id"] as? String == frameId }),
              let history = frame["drawingHistory"] as? [[String: Any]] else { return [] }
        return history.compactMap { entry in
            guard let strokes = entry["strokes"] as? String else { return nil }
            return ((entry["updatedAt"] as? String) ?? "", strokes)
        }
    }

    // Slett-angre: siste slettede scene holdes i minnet til re-upsert.
    private var lastDeletedScene: (manuscriptId: String, scene: [String: Any])?

    func undoLastSceneDelete() async throws {
        guard let deleted = lastDeletedScene else { return }
        lastDeletedScene = nil
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: deleted.scene)
        var scenes = rawScenes[deleted.manuscriptId] ?? []
        scenes.append(deleted.scene)
        rawScenes[deleted.manuscriptId] = scenes
    }

    /// Last opp panel-bilde til B2 (bruker-bucket m/ kvote). Returnerer
    /// download-stien som blir frame.imageUrl (web-img med cookies og
    /// native fetch med Bearer følger 302 til signert B2-URL).
    func uploadStorageImage(jpegData: Data, name: String,
                            projectId: String? = nil,
                            sceneId: String? = nil,
                            attachedToEntityType: String? = nil,
                            attachedToEntityId: String? = nil,
                            attachmentNote: String? = nil) async throws -> String {
        var request = try request(path: "/api/role-room/storage/upload", query: [:])
        request.httpMethod = "POST"
        let boundary = "sb-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)",
                         forHTTPHeaderField: "Content-Type")
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("sourceModule", "storyboard")
        if let projectId { field("projectId", projectId) }
        if let sceneId { field("sceneId", sceneId) }
        if let attachedToEntityType { field("attachedToEntityType", attachedToEntityType) }
        if let attachedToEntityId { field("attachedToEntityId", attachedToEntityId) }
        if let attachmentNote { field("attachmentNote", attachmentNote) }
        let safeName = StorageUploadFilename.sanitized(name)
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(safeName)\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
        body.append(jpegData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200,
              let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let file = payload["file"] as? [String: Any],
              let fileId = file["id"] as? String else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        return "/api/role-room/storage/files/\(fileId)/download"
    }

    struct StorageFileSummary: Identifiable, Sendable {
        let id: String
        let displayName: String
        let sizeBytes: Int
        let contentType: String?
        let uploadedAt: String
        let entityType: String?
        var downloadPath: String { "/api/role-room/storage/files/\(id)/download" }
        var isImage: Bool { (contentType ?? "").hasPrefix("image/") }
    }

    /// Omdøp fil i Role Room-lagringen.
    func renameStorageFile(fileId: String, displayName: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)",
                                         query: [:]) else { return false }
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["displayName": displayName])
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Papirkurven (soft-slettede filer).
    func listTrash() async -> [StorageFileSummary] {
        guard let payload = try? await getJSON(path: "/api/role-room/storage/trash", query: [:]),
              let files = payload["files"] as? [[String: Any]] else { return [] }
        return files.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return StorageFileSummary(
                id: id,
                displayName: (entry["displayName"] as? String) ?? id,
                sizeBytes: (entry["sizeBytes"] as? Int) ?? 0,
                contentType: entry["contentType"] as? String,
                uploadedAt: (entry["uploadedAt"] as? String) ?? "",
                entityType: entry["attachedToEntityType"] as? String)
        }
    }

    /// Gjenopprett fra papirkurven (reserverer kvoten igjen).
    func restoreStorageFile(fileId: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)/restore",
                                         query: [:]) else { return false }
        request.httpMethod = "POST"
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Soft delete (papirkurv) — frigjør kvote.
    func deleteStorageFile(fileId: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)",
                                         query: [:]) else { return false }
        request.httpMethod = "DELETE"
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Lagringsstatus (kvote-måleren i hubben).
    func fetchStorageStats() async -> (used: Int, quota: Int?)? {
        guard let payload = try? await getJSON(path: "/api/role-room/storage/stats", query: [:]) else {
            return nil
        }
        let stats = (payload["stats"] as? [String: Any]) ?? payload
        guard let used = stats["usedBytes"] as? Int else { return nil }
        return (used, stats["quotaBytes"] as? Int)
    }

    /// Prosjektets filer i Role Room-lagringen (Assets-seksjonen i hubben).
    func listStorageFiles(projectId: String) async -> [StorageFileSummary] {
        guard let payload = try? await getJSON(
            path: "/api/role-room/storage/files",
            query: ["projectId": projectId, "limit": "60"]),
              let files = payload["files"] as? [[String: Any]] else { return [] }
        return files.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return StorageFileSummary(
                id: id,
                displayName: (entry["displayName"] as? String) ?? id,
                sizeBytes: (entry["sizeBytes"] as? Int) ?? 0,
                contentType: entry["contentType"] as? String,
                uploadedAt: (entry["uploadedAt"] as? String) ?? "",
                entityType: entry["attachedToEntityType"] as? String)
        }
    }

    /// Hent remote panel-bilde (Bearer + 302-følging), disk-cachet.
    func fetchRemoteImageData(path: String) async -> Data? {
        let key = "img-\(path.hashValue)"
        if let cached = try? Data(contentsOf: Self.cacheDirectory.appendingPathComponent("\(key).bin")) {
            return cached
        }
        guard let request = try? request(path: path, query: [:]),
              let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        try? FileManager.default.createDirectory(at: Self.cacheDirectory,
                                                 withIntermediateDirectories: true)
        try? data.write(to: Self.cacheDirectory.appendingPathComponent("\(key).bin"))
        return data
    }

    /// Ark-import: legg N bilde-frames (dataURL-er) bakerst i scenen i én
    /// mutasjon (presentasjons-board → paneler).
    func importImageFrames(manuscriptId: String, sceneId: String,
                           imageURLs imageDataURLs: [String]) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            for (index, dataURL) in imageDataURLs.enumerated() {
                let lastShot = (frames.last?["shotNumber"] as? String) ?? ""
                let digits = lastShot.prefix { $0.isNumber }
                let prefix = digits.isEmpty ? "1" : String(digits)
                var letters = ""
                var value = frames.count
                repeat {
                    letters = String(UnicodeScalar(UInt8(65 + value % 26))) + letters
                    value = value / 26 - 1
                } while value >= 0
                frames.append([
                    "id": "frame-\(stamp)-imp\(index)",
                    "shotNumber": prefix + letters,
                    "description": "",
                    "imageUrl": dataURL,
                    "imageSource": "imported",
                    "durationSec": 3,
                    "tags": [String](),
                ])
            }
        }
    }

    // MARK: HTTP

    private func request(path: String, query: [String: String]) throws -> URLRequest {
        guard let baseURL, let token else { throw SyncError.notConfigured }
        var components = URLComponents(url: baseURL.appendingPathComponent(path),
                                       resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    // ── @mention-varsler + APNs-token ──
    func fetchUnreadMentions(name: String) async -> Int {
        guard let result = try? await getJSON(
            path: "/api/casting/storyboard-mentions",
            query: ["name": name, "unread": "1"]) else { return 0 }
        return (result["mentions"] as? [[String: Any]])?.count ?? 0
    }

    func markMentionsRead(name: String) async {
        try? await sendJSON(path: "/api/casting/storyboard-mentions/read",
                            method: "POST", body: ["name": name])
    }

    func registerDeviceToken(_ token: String) async {
        try? await sendJSON(path: "/api/role-room/storyboard/device-token",
                            method: "POST",
                            body: ["token": token,
                                   "deviceName": UIDevice.current.name])
    }

    private func getJSON(path: String, query: [String: String]) async throws -> [String: Any] {
        let (data, response) = try await URLSession.shared.data(for: request(path: path, query: query))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SyncError.malformed(path)
        }
        return payload
    }

    private func getJSONArray(path: String) async throws -> [[String: Any]] {
        let (data, response) = try await URLSession.shared.data(for: request(path: path, query: [:]))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        let payload = try JSONSerialization.jsonObject(with: data)
        if let list = payload as? [[String: Any]] { return list }
        if let object = payload as? [String: Any],
           let list = (object["scenes"] ?? object["data"]) as? [[String: Any]] {
            return list
        }
        throw SyncError.malformed(path)
    }

    // Per-frame PATCH (payload-kutt): husker om backend har endepunktet
    // så eldre backend faller tilbake til hele-scene-POST uten ekstra
    // rundtur hver gang.
    private var frameEndpointAvailable: Bool?

    /// PATCH /api/casting/frames. true = håndtert; false = endepunkt
    /// finnes ikke (kaller bruker legacy-POST). Kaster ved andre feil.
    private func patchFrameRemote(
        manuscriptId: String, sceneId: String, frameId: String,
        fields: [String: Any]
    ) async throws -> String? {
        if frameEndpointAvailable == false { return nil }
        var request = try request(path: "/api/casting/frames", query: [:])
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "manuscriptId": manuscriptId, "sceneId": sceneId,
            "frameId": frameId, "fields": fields,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if (200...299).contains(status) {
            frameEndpointAvailable = true
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            return (payload?["updatedAt"] as? String) ?? ""
        }
        if status == 404 || status == 405 {
            // 404 kan også bety frame ikke funnet på ny backend — legacy-
            // POST upserter uansett riktig, så fallback er trygt begge veier.
            frameEndpointAvailable = nil
            return nil
        }
        throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
    }

    private func sendJSON(path: String, method: String, body: [String: Any]) async throws {
        var request = try request(path: path, query: [:])
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
    }

    private func sendJSONResponse(
        path: String, method: String, body: [String: Any]
    ) async throws -> [String: Any] {
        var request = try request(path: path, query: [:])
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            if status == 401 { throw SyncError.unauthenticated }
            if let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = (payload["detail"] as? String) ?? (payload["error"] as? String) {
                throw SyncError.remote(message)
            }
            throw SyncError.http(status)
        }
        guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SyncError.malformed(path)
        }
        return payload
    }

    // MARK: Mapping

    private static func summarize(scene: [String: Any]) -> SceneSummary? {
        guard let id = scene["id"] as? String else { return nil }
        let heading = (scene["heading"] as? String)
            ?? (scene["sceneName"] as? String)
            ?? (scene["title"] as? String)
            ?? id
        let frames = ((scene["storyboardFrames"] as? [[String: Any]]) ?? []).compactMap { frame -> FrameSummary? in
            guard let frameId = frame["id"] as? String else { return nil }
            let shot = (frame["shotNumber"] as? String) ?? "?"
            let description = (frame["description"] as? String) ?? ""
            let shotType = (frame["shotType"] as? String) ?? (frame["cameraAngle"] as? String)
            let drawingData = frame["drawingData"] as? [String: Any]
            let strokes = drawingData?["strokes"] as? String
            let duration = (frame["duration"] as? Double) ?? Double(frame["duration"] as? Int ?? 2)
            let lens = (frame["lensMm"] as? Int) ?? (frame["lensMm"] as? Double).map(Int.init)
            var summary = FrameSummary(
                id: frameId,
                shotNumber: shot,
                detail: [shotType ?? "", description].filter { !$0.isEmpty }.joined(separator: " · "),
                strokesJSON: strokes,
                description: description,
                notes: frame["notes"] as? String,
                shotType: shotType,
                lensMm: lens,
                movement: frame["movement"] as? String,
                durationSec: duration,
                transition: frame["transition"] as? String,
                focusDepth: frame["focusDepth"] as? String,
                timeOfDay: frame["timeOfDay"] as? String,
                weather: frame["weather"] as? String,
                beatTag: frame["beatTag"] as? String,
                tags: (frame["tags"] as? [String]) ?? [],
                thumbnailDataURL: frame["thumbnailUrl"] as? String,
                drawingWidth: (drawingData?["width"] as? Double)
                    ?? Double(drawingData?["width"] as? Int ?? 1920),
                drawingHeight: (drawingData?["height"] as? Double)
                    ?? Double(drawingData?["height"] as? Int ?? 1080),
                frameStatus: frame["frameStatus"] as? String,
                comments: ((frame["frameComments"] as? [[String: Any]]) ?? []).map { dict in
                    ReviewComment(
                        id: (dict["id"] as? String) ?? UUID().uuidString,
                        role: (dict["role"] as? String) ?? "?",
                        author: (dict["author"] as? String) ?? "",
                        text: (dict["text"] as? String) ?? "",
                        at: (dict["at"] as? String) ?? "",
                        x: dict["x"] as? Double,
                        y: dict["y"] as? Double,
                        parentId: dict["parentId"] as? String,
                        likes: dict["likes"] as? Int,
                        targetX: dict["targetX"] as? Double,
                        targetY: dict["targetY"] as? Double)
                },
                updatedAt: frame["updatedAt"] as? String,
                underlayDataURL: frame["underlayDataURL"] as? String,
                underlayOpacity: (frame["underlayOpacity"] as? Double)
                    ?? (frame["underlayOpacity"] as? Int).map(Double.init),
                perspectiveMode: frame["perspectiveMode"] as? Int,
                vanishingPoints: frame["vanishingPoints"] as? [[Double]],
                voiceoverDataURL: frame["voiceoverDataURL"] as? String,
                imageUrl: frame["imageUrl"] as? String,
                reviewPriority: frame["reviewPriority"] as? String,
                reviewDueAt: frame["reviewDueAt"] as? String,
                reviewApprovedBy: frame["reviewApprovedBy"] as? String,
                reviewApprovedAt: frame["reviewApprovedAt"] as? String,
                reviewStarred: (frame["reviewStarred"] as? Bool)
                    ?? (frame["reviewStarred"] as? Int).map { $0 != 0 },
                reviewAssignee: frame["reviewAssignee"] as? String,
                reviewColorLabel: frame["reviewColorLabel"] as? String,
                reviewSnoozedUntil: frame["reviewSnoozedUntil"] as? String,
                setLocation: frame["setLocation"] as? String,
                stageUnit: frame["stageUnit"] as? String,
                reviewFollowers: frame["reviewFollowers"] as? [String]
            )
            summary.imageSource = frame["imageSource"] as? String
            summary.aiImageVersions = ((frame["aiImageVersions"] as? [[String: Any]]) ?? [])
                .compactMap(AIImageVersion.init(dictionary:))
            summary.aiVideoVersions = ((frame["aiVideoVersions"] as? [[String: Any]]) ?? [])
                .compactMap(AIVideoVersion.init(dictionary:))
            summary.cameraAngle = frame["cameraAngle"] as? String
            summary.lighting = frame["lighting"] as? String
            return summary
        }
        return SceneSummary(
            id: id, heading: heading, frames: frames,
            presentationConcept: scene["presentationConcept"] as? String,
            presentationFooter: scene["presentationFooter"] as? String,
            hubTasks: scene["hubTasks"] as? String,
            hubNotes: scene["hubNotes"] as? String,
            hubQuote: scene["hubQuote"] as? String,
            hubMoodboard: scene["hubMoodboard"] as? String,
            hubMapPositions: scene["hubMapPositions"] as? String,
            hubMapNotes: scene["hubMapNotes"] as? String,
            hubTeam: scene["hubTeam"] as? String,
            hubInfo: scene["hubInfo"] as? String,
            hubAssetFolders: scene["hubAssetFolders"] as? String,
            hubAssetColors: scene["hubAssetColors"] as? String,
            sceneNumber: (scene["sceneNumber"] as? Int) ?? Int(scene["sceneNumber"] as? String ?? ""),
            intExt: (scene["intExt"] as? String) ?? (scene["int_ext"] as? String),
            location: (scene["locationName"] as? String) ?? (scene["location"] as? String),
            timeOfDay: (scene["timeOfDay"] as? String) ?? (scene["time_of_day"] as? String),
            descriptionText: scene["description"] as? String,
            characters: ((scene["characters"] as? [String])
                ?? ((scene["characters"] as? [[String: Any]])?.compactMap { $0["name"] as? String })
                ?? []).map(StoryboardCharacterName.display))
    }
}
