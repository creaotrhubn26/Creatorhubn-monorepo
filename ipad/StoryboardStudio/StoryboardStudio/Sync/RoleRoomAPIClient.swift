import Foundation

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

struct FrameSummary: Identifiable, Sendable {
    let id: String
    let shotNumber: String
    let detail: String
    let strokesJSON: String?
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
}

struct SceneSummary: Identifiable, Sendable {
    let id: String
    let heading: String
    let frames: [FrameSummary]
}

enum SyncError: LocalizedError {
    case notConfigured
    case http(Int)
    case unauthenticated
    case malformed(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server og token er ikke satt."
        case .http(let code): return "Serverfeil (\(code))."
        case .unauthenticated: return "Token er ugyldig eller utløpt."
        case .malformed(let what): return "Uventet svar: \(what)."
        }
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

    // MARK: Lesing

    func fetchProjects() async throws -> [ProjectSummary] {
        let payload = try await getJSON(path: "/api/casting/projects", query: [:])
        guard let projects = payload["projects"] as? [[String: Any]] else {
            throw SyncError.malformed("projects")
        }
        return projects.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return ProjectSummary(id: id, name: (entry["name"] as? String) ?? id)
        }
    }

    func fetchManuscripts(projectId: String) async throws -> [ManuscriptSummary] {
        // Prod kan returnere bare array ELLER objekt-innpakning — tåler begge.
        let (data, response) = try await URLSession.shared.data(
            for: request(path: "/api/casting/manuscripts", query: ["projectId": projectId]))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        let payload = try JSONSerialization.jsonObject(with: data)
        let list = (payload as? [[String: Any]])
            ?? ((payload as? [String: Any]).flatMap {
                ($0["manuscripts"] ?? $0["data"]) as? [[String: Any]]
            })
            ?? []
        return list.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            let title = (entry["title"] as? String) ?? (entry["name"] as? String) ?? id
            return ManuscriptSummary(id: id, title: title)
        }
    }

    func fetchScenes(manuscriptId: String) async throws -> [SceneSummary] {
        let scenes = try await getJSONArray(path: "/api/casting/manuscripts/\(manuscriptId)/scenes")
        rawScenes[manuscriptId] = scenes
        return scenes.compactMap(Self.summarize(scene:))
    }

    // MARK: Skriving

    /// Skriv strokes (web-JSON-STRENG — parseStoredStrokes-krav) tilbake på
    /// én frame og PUT hele scenelisten (samme granularitet som web).
    func saveFrameStrokes(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        strokesJSON: String
    ) async throws {
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var found = false
        for sceneIndex in scenes.indices {
            guard scenes[sceneIndex]["id"] as? String == sceneId else { continue }
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                var drawingData = (frames[frameIndex]["drawingData"] as? [String: Any]) ?? [:]
                drawingData["strokes"] = strokesJSON
                drawingData["updatedAt"] = now
                if drawingData["createdAt"] == nil { drawingData["createdAt"] = now }
                if drawingData["width"] == nil { drawingData["width"] = 1920 }
                if drawingData["height"] == nil { drawingData["height"] = 1080 }
                frames[frameIndex]["drawingData"] = drawingData
                frames[frameIndex]["imageSource"] = "drawn"
                // Web genererer thumbnail automatisk fra strokes ved visning;
                // nullstill stale thumb så den regenereres.
                frames[frameIndex]["thumbnailUrl"] = nil
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
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
    }

    /// Patch vilkårlige felter på én frame (Inspector) og upsert scenen.
    func saveFramePatch(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        fields: [String: any Sendable]
    ) async throws {
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
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
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
            return FrameSummary(
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
                thumbnailDataURL: frame["thumbnailUrl"] as? String
            )
        }
        return SceneSummary(id: id, heading: heading, frames: frames)
    }
}
