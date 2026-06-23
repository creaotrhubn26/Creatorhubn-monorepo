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
