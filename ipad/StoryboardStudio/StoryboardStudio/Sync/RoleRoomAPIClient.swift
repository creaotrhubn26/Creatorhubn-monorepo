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

struct ReviewComment: Identifiable, Sendable {
    let id: String
    let role: String     // Director / DP / Producer / Editor / Artist
    let author: String
    let text: String
    let at: String       // ISO
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
    // drawingData.width/height — koordinatrommet strøkene er lagret i.
    let drawingWidth: Double
    let drawingHeight: Double
    // Review (web-paritet): planned / in_review / needs_work / done + kommentarer
    let frameStatus: String?
    let comments: [ReviewComment]
    // Konfliktdeteksjon (samme-frame-merge): serverens updatedAt ved lasting
    let updatedAt: String?
    // Referanse-underlag (kun visning i canvas — aldri i eksport)
    let underlayDataURL: String?
    let underlayOpacity: Double?
}

struct SceneSummary: Identifiable, Sendable {
    let id: String
    let heading: String
    let frames: [FrameSummary]
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

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server og token er ikke satt."
        case .http(let code): return "Serverfeil (\(code))."
        case .unauthenticated: return "Token er ugyldig eller utløpt."
        case .malformed(let what): return "Uventet svar: \(what)."
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
                var drawingData = (frames[frameIndex]["drawingData"] as? [String: Any]) ?? [:]
                // Samme-frame-konflikt (spec: siste-vinner er datatap): har
                // serveren en NYERE versjon enn den vi bygget på, unions-
                // merges strokene på id — serverens beholdes, våre nye
                // legges til. Append-dominert tegning gjør dette trygt.
                var effectiveStrokes = strokesJSON
                if let base = baseUpdatedAt,
                   let serverUpdated = frames[frameIndex]["updatedAt"] as? String,
                   serverUpdated != base,
                   let serverJSON = drawingData["strokes"] as? String,
                   let merged = StrokeMerge.union(serverJSON: serverJSON, oursJSON: strokesJSON) {
                    effectiveStrokes = merged
                }
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
                }
                return
            }
        }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
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
                        at: (dict["at"] as? String) ?? "")
                },
                updatedAt: frame["updatedAt"] as? String,
                underlayDataURL: frame["underlayDataURL"] as? String,
                underlayOpacity: (frame["underlayOpacity"] as? Double)
                    ?? (frame["underlayOpacity"] as? Int).map(Double.init)
            )
        }
        return SceneSummary(
            id: id, heading: heading, frames: frames,
            sceneNumber: (scene["sceneNumber"] as? Int) ?? Int(scene["sceneNumber"] as? String ?? ""),
            intExt: (scene["intExt"] as? String) ?? (scene["int_ext"] as? String),
            location: (scene["locationName"] as? String) ?? (scene["location"] as? String),
            timeOfDay: (scene["timeOfDay"] as? String) ?? (scene["time_of_day"] as? String),
            descriptionText: scene["description"] as? String,
            characters: (scene["characters"] as? [String])
                ?? ((scene["characters"] as? [[String: Any]])?.compactMap { $0["name"] as? String })
                ?? [])
    }
}
