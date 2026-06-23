import Foundation
import UIKit

/// Full enhancement recipe sent to `POST /api/photo-enhancer/enhance`.
/// camelCase to match the backend exactly. All fields default to the server's
/// own defaults so a bare instance is a no-op-ish enhance.
struct EnhanceSettings: Codable, Sendable, Equatable {
    var brightness = 0
    var contrast = 0
    var saturation = 0
    var sharpness = 0
    var denoising = 50
    var faceEnhancement = 75
    var modelPreference = "auto"   // auto|sharp|gfpgan|codeformer|realesrgan|swinir|bsrgan|diffbir
    var gfpganQuality = 75
    var codeformerFidelity = 65
    var realesrganScale = 2        // 2|3|4
    var swinir = false
    var bsrgan = false
    var diffbir = false
    var skinTextureGuard = 70
    var teethWhiteness = 0
    var eyeBrightness = 0
    var eyeWhiteness = 0
    var blemishRemoval = 0
    var subject = ""               // portrait|group_portrait|food|landscape|product|...
    var subjectLookStrength = 0
    var lut = Lut()

    struct Lut: Codable, Sendable, Equatable {
        var name: String?    // neutral|warm_soft|cool_soft|user_xxx|nil
        var strength = 0           // 0…100
    }
}

/// A LUT from `GET /luts`.
struct EnhancerLut: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var displayName: String?
    var description: String?
    var userUploaded: Bool

    private enum CodingKeys: String, CodingKey { case id, displayName, description, userUploaded }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? "neutral"
        displayName = try? c.decodeIfPresent(String.self, forKey: .displayName)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        userUploaded = (try? c.decodeIfPresent(Bool.self, forKey: .userUploaded)) ?? false
    }
}

/// Client for the CreatorHub Photo Enhancer (`/api/photo-enhancer/*`). Hits the
/// same backend as DashboardClient; auth via the shared session headers.
struct PhotoEnhancerClient: Sendable {
    let baseURL: URL
    let authHeaders: [String: String]
    private let session: URLSession = .shared

    @MainActor
    static func make() -> PhotoEnhancerClient? {
        guard let stored = SignInService.shared.session,
              let url = URL(string: "/api/photo-enhancer/", relativeTo: stored.backendBaseURL) else { return nil }
        return PhotoEnhancerClient(baseURL: url, authHeaders: SignInService.shared.authHeaders)
    }

    enum EnhancerError: Error, LocalizedError {
        case transport(String), http(Int, String?), decode(String), noImage
        var errorDescription: String? {
            switch self {
            case .transport(let m): return "Nettverksfeil: \(m)"
            case .http(let c, let b): return "Serverfeil \(c): \(b ?? "")"
            case .decode(let m): return "Kunne ikke tolke svar: \(m)"
            case .noImage: return "Fikk ikke noe bilde tilbake."
            }
        }
    }

    // MARK: - Enhance

    struct EnhanceResult: Sendable {
        let image: UIImage
        let jpegData: Data
        let modelUsed: String?
        let inferenceMode: String?
    }

    /// Run the full server enhance (RAW ok, <150 MB) and return the result.
    func enhance(imageData: Data, fileName: String, mime: String,
                 preset: String, settings: EnhanceSettings) async throws -> EnhanceResult {
        let settingsJSON = String(data: try JSONEncoder().encode(settings), encoding: .utf8) ?? "{}"
        var form = MultipartForm()
        form.addFile(name: "image", fileName: fileName, mime: mime, data: imageData)
        form.addText(name: "preset", value: preset)
        form.addText(name: "settings", value: settingsJSON)
        let (data, _) = try await post("enhance", form: form, timeout: 240)
        struct Resp: Decodable {
            let success: Bool?
            let enhancedImageUrl: String?
            let imageUrl: String?
            let outputUrl: String?
            let modelUsed: String?
            let inferenceMode: String?
            let error: String?
        }
        let resp = try decode(Resp.self, from: data)
        let urlStr = resp.enhancedImageUrl ?? resp.imageUrl ?? resp.outputUrl
        guard let urlStr, let comma = urlStr.firstIndex(of: ","),
              let bytes = Data(base64Encoded: String(urlStr[urlStr.index(after: comma)...])),
              let img = UIImage(data: bytes) else { throw EnhancerError.noImage }
        return EnhanceResult(image: img, jpegData: bytes, modelUsed: resp.modelUsed, inferenceMode: resp.inferenceMode)
    }

    // MARK: - Supporting

    func listLuts(owner: String?) async throws -> [EnhancerLut] {
        var path = "luts"
        if let owner, !owner.isEmpty { path += "?owner=\(owner.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? owner)" }
        let (data, _) = try await get(path)
        struct Resp: Decodable { let luts: [EnhancerLut]? }
        return (try decode(Resp.self, from: data).luts) ?? []
    }

    /// AI recipe suggestion (JPEG/PNG/WebP only).
    func suggestRecipe(imageData: Data, mime: String, preset: String, instruction: String?) async throws -> EnhanceSettings {
        var form = MultipartForm()
        form.addFile(name: "image", fileName: "preview.jpg", mime: mime, data: imageData)
        form.addText(name: "preset", value: preset)
        if let instruction, !instruction.isEmpty { form.addText(name: "instruction", value: instruction) }
        let (data, _) = try await post("suggest-recipe", form: form, timeout: 120)
        struct Resp: Decodable { let recipe: EnhanceSettings? }
        return (try decode(Resp.self, from: data).recipe) ?? EnhanceSettings()
    }

    /// Faces detected (JPEG/PNG/WebP). Returns count.
    func faceCount(imageData: Data, mime: String) async throws -> Int {
        var form = MultipartForm()
        form.addFile(name: "image", fileName: "preview.jpg", mime: mime, data: imageData)
        let (data, _) = try await post("faces", form: form, timeout: 90)
        struct Resp: Decodable { let faceCount: Int? }
        return (try decode(Resp.self, from: data).faceCount) ?? 0
    }

    /// Stamp copyright/artist/keywords into a JPEG/PNG/WebP. Returns stamped bytes.
    func stampMetadata(imageData: Data, mime: String, copyright: String?, artist: String?, keywords: [String]) async throws -> Data {
        var form = MultipartForm()
        form.addFile(name: "image", fileName: "export.jpg", mime: mime, data: imageData)
        if let copyright, !copyright.isEmpty { form.addText(name: "copyright", value: copyright) }
        if let artist, !artist.isEmpty { form.addText(name: "artist", value: artist) }
        if !keywords.isEmpty { form.addText(name: "keywords", value: keywords.joined(separator: ",")) }
        let (data, _) = try await post("export/stamp-metadata", form: form, timeout: 60)
        return data
    }

    /// Teach the personalisation model what the photographer actually shipped.
    func submitFeedback(suggested: EnhanceSettings, final: EnhanceSettings) async {
        guard let body = try? JSONEncoder().encode(["suggested": suggested, "final": final]) else { return }
        _ = try? await postJSON("feedback", body: body)
    }

    // MARK: - Async enhance (B2 source + job queue)

    /// One async enhance: upload the source to B2, enqueue a job, poll to
    /// completion, fetch the result. Non-blocking (short requests + polling),
    /// honours Task cancellation, reports progress 0…1. Keeps the source on B2
    /// (same provider as the rest of the photographer pipeline — no R2).
    func enhanceAsync(imageData: Data, fileName: String, mime: String,
                      preset: String, settings: EnhanceSettings,
                      projectId: String? = nil,
                      onProgress: @MainActor @escaping (Double, String) -> Void) async throws -> EnhanceResult {
        // 1. presign + upload to B2
        await onProgress(0.05, "Laster opp til B2…")
        let target = try await b2Presign(fileName: fileName, contentType: mime, projectId: projectId)
        try await putToURL(target.uploadUrl, data: imageData, contentType: mime)
        try Task.checkCancellation()

        // 2. enqueue the job
        await onProgress(0.2, "Setter i kø…")
        let jobId = try await createEnhanceJob(bucket: target.bucket, key: target.key,
                                               fileName: fileName, mime: mime, size: imageData.count,
                                               preset: preset, settings: settings, projectId: projectId)

        // 3. poll to completion
        for _ in 0..<200 {
            try Task.checkCancellation()
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            let s = try await jobStatus(jobId: jobId)
            await onProgress(0.2 + 0.7 * (Double(s.progress) / 100.0), "Forbedrer (\(s.progress)%)…")
            switch s.status {
            case "completed":
                guard let urlStr = s.enhancedImageUrl else { throw EnhancerError.noImage }
                await onProgress(0.95, "Henter resultat…")
                let (bytes, img) = try await fetchResultImage(urlStr)
                return EnhanceResult(image: img, jpegData: bytes, modelUsed: s.modelUsed, inferenceMode: "queue")
            case "failed", "cancelled":
                throw EnhancerError.http(0, s.failureReason ?? s.status)
            default:
                continue
            }
        }
        throw EnhancerError.transport("timed out waiting for enhance job")
    }

    struct B2PresignTarget: Decodable, Sendable { let bucket: String; let key: String; let uploadUrl: String }

    func b2Presign(fileName: String, contentType: String, projectId: String?) async throws -> B2PresignTarget {
        struct Body: Encodable { let fileName: String; let contentType: String; let projectId: String? }
        let (data, _) = try await postJSONReturning("uploads/b2-presign",
            body: try JSONEncoder().encode(Body(fileName: fileName, contentType: contentType, projectId: projectId)))
        return try decode(B2PresignTarget.self, from: data)
    }

    func putToURL(_ urlString: String, data: Data, contentType: String) async throws {
        guard let url = URL(string: urlString) else { throw EnhancerError.transport("invalid upload url") }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.timeoutInterval = 300
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.httpBody = data
        let (_, resp) = try await session.data(for: req)
        if let http = resp as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw EnhancerError.http(http.statusCode, "B2 upload failed")
        }
    }

    func createEnhanceJob(bucket: String, key: String, fileName: String, mime: String, size: Int,
                          preset: String, settings: EnhanceSettings, projectId: String?) async throws -> String {
        struct Source: Encodable { let bucket, key, storage, fileName, mimeType: String; let size: Int }
        struct Body: Encodable { let source: Source; let preset: String; let settings: EnhanceSettings; let projectId: String? }
        let body = Body(source: Source(bucket: bucket, key: key, storage: "b2", fileName: fileName, mimeType: mime, size: size),
                        preset: preset, settings: settings, projectId: projectId)
        let (data, _) = try await postJSONReturning("jobs", body: try JSONEncoder().encode(body))
        struct Resp: Decodable { struct JobRef: Decodable { let id: String? }; let job: JobRef? }
        guard let id = (try decode(Resp.self, from: data)).job?.id else { throw EnhancerError.decode("no job id") }
        return id
    }

    struct JobStatus: Sendable {
        let status: String; let progress: Int
        let enhancedImageUrl: String?; let modelUsed: String?; let failureReason: String?
    }

    func jobStatus(jobId: String) async throws -> JobStatus {
        let (data, _) = try await get("jobs/\(jobId)")
        struct Resp: Decodable {
            struct Result: Decodable { let enhancedImageUrl: String?; let modelUsed: String? }
            struct JobRef: Decodable { let status: String?; let progress: Int?; let failureReason: String?; let result: Result? }
            let job: JobRef?
        }
        let r = try decode(Resp.self, from: data).job
        return JobStatus(status: r?.status ?? "unknown", progress: r?.progress ?? 0,
                         enhancedImageUrl: r?.result?.enhancedImageUrl, modelUsed: r?.result?.modelUsed,
                         failureReason: r?.failureReason)
    }

    /// Fetch the enhanced image — handles a data: URL, an absolute http URL, or
    /// a backend-relative path (e.g. /api/photo-enhancer/files/:id/download).
    private func fetchResultImage(_ urlString: String) async throws -> (Data, UIImage) {
        let bytes: Data
        if urlString.hasPrefix("data:"), let comma = urlString.firstIndex(of: ","),
           let d = Data(base64Encoded: String(urlString[urlString.index(after: comma)...])) {
            bytes = d
        } else {
            let url: URL
            if urlString.hasPrefix("http") { url = URL(string: urlString)! } else if let stored = await SignInService.shared.session,
                    let u = URL(string: urlString, relativeTo: stored.backendBaseURL) { url = u } else { throw EnhancerError.transport("invalid result url") }
            var req = URLRequest(url: url); req.timeoutInterval = 120; apply(&req)
            let (d, resp) = try await session.data(for: req)
            if let http = resp as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                throw EnhancerError.http(http.statusCode, "result download failed")
            }
            bytes = d
        }
        guard let img = UIImage(data: bytes) else { throw EnhancerError.noImage }
        return (bytes, img)
    }

    private func postJSONReturning(_ path: String, body: Data) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: try resolve(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        apply(&req)
        req.httpBody = body
        return try await run(req)
    }

    // MARK: - HTTP plumbing

    private func resolve(_ path: String) throws -> URL {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw EnhancerError.transport("invalid path \(path)")
        }
        return url
    }

    private func get(_ path: String) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: try resolve(path))
        apply(&req)
        return try await run(req)
    }

    private func post(_ path: String, form: MultipartForm, timeout: TimeInterval) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: try resolve(path))
        req.httpMethod = "POST"
        req.timeoutInterval = timeout
        req.setValue("multipart/form-data; boundary=\(form.boundary)", forHTTPHeaderField: "Content-Type")
        apply(&req)
        req.httpBody = form.finished()
        return try await run(req)
    }

    private func postJSON(_ path: String, body: Data) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: try resolve(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        apply(&req)
        req.httpBody = body
        return try await run(req)
    }

    private func apply(_ req: inout URLRequest) {
        for (k, v) in authHeaders { req.setValue(v, forHTTPHeaderField: k) }
    }

    private func run(_ req: URLRequest) async throws -> (Data, URLResponse) {
        let (data, resp): (Data, URLResponse)
        do { (data, resp) = try await session.data(for: req) } catch { throw EnhancerError.transport(error.localizedDescription) }
        if let http = resp as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw EnhancerError.http(http.statusCode, String(data: data, encoding: .utf8)?.prefix(200).description)
        }
        return (data, resp)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) } catch { throw EnhancerError.decode(String(describing: error)) }
    }
}

/// Minimal multipart/form-data builder.
struct MultipartForm {
    let boundary = "Boundary-\(UUID().uuidString)"
    private var body = Data()

    mutating func addText(name: String, value: String) {
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        body.append("\(value)\r\n")
    }
    mutating func addFile(name: String, fileName: String, mime: String, data: Data) {
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(fileName)\"\r\n")
        body.append("Content-Type: \(mime)\r\n\r\n")
        body.append(data)
        body.append("\r\n")
    }
    func finished() -> Data {
        var b = body
        b.append("--\(boundary)--\r\n")
        return b
    }
}

private extension Data {
    mutating func append(_ s: String) { if let d = s.data(using: .utf8) { append(d) } }
}
