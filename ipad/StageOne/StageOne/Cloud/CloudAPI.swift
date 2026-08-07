import Foundation
import UIKit

/// Klient mot creatorhub-backend: pairing-exchange + StageOne scene-CRUD.
/// NB: URL-er bygges med string-konkat — appendingPathComponent prosentkoder
/// og har gitt 404-feller i LeadMapApp før.
struct CloudAPI: Sendable {
    static let baseURLString = "https://creatorhub-backend-rtbl.onrender.com"
    var baseURLString = CloudAPI.baseURLString
    var token: String?

    enum APIError: Error, LocalizedError {
        case badResponse
        case http(Int, String?)
        var errorDescription: String? {
            switch self {
            case .badResponse: "Uventet svar fra serveren."
            case .http(let status, let code):
                switch code {
                case "ukjent_kode": "Koden er ikke gyldig. Sjekk at du skrev den riktig."
                case "kode_allerede_brukt": "Koden er allerede brukt. Generer en ny i web."
                case "kode_utlopt": "Koden utløp. Generer en ny i web."
                case "auth_required": "Ikke innlogget — logg inn på nytt."
                default: "HTTP \(status)\(code.map { " (\($0))" } ?? "")."
                }
            }
        }
    }

    struct PairedUser: Codable { let id: String; let email: String? }
    struct ExchangeResponse: Codable { let bearer: String; let user: PairedUser }
    struct RemoteSceneMeta: Codable, Identifiable { let id: String; let name: String; let updatedAt: String }
    struct SceneListResponse: Codable { let scenes: [RemoteSceneMeta] }
    struct RemoteScene: Codable { let id: String; let name: String; let data: SceneData; let updatedAt: String }
    struct PutResponse: Codable { let ok: Bool; let updatedAt: String }

    /// Testbar request-bygger.
    static func request(baseURLString: String, path: String, method: String,
                        token: String?, body: Data?) -> URLRequest {
        var req = URLRequest(url: URL(string: baseURLString + path)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = body
        return req
    }

    /// Postgres-timestamps kommer som ISO8601 m/ eller uten brøkdels-sekunder.
    static func parseDate(_ s: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fractional.date(from: s) { return d }
        return ISO8601DateFormatter().date(from: s)
    }

    // MARK: - Pairing

    @MainActor
    func exchange(shortCode: String) async throws -> ExchangeResponse {
        let cleaned = shortCode.uppercased()
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
        let formatted = cleaned.count == 8 ? "\(cleaned.prefix(4))-\(cleaned.suffix(4))" : cleaned
        let device = UIDevice.current
        let bundle = Bundle.main
        let body: [String: Any] = [
            "shortCode": formatted,
            "deviceInfo": [
                "model": device.model,
                "name": device.name,
                "osVersion": "\(device.systemName) \(device.systemVersion)",
                "appVersion": "StageOne \((bundle.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "?")",
            ],
        ]
        return try await send(path: "/api/ipad-tokens/exchange", method: "POST",
                              body: try JSONSerialization.data(withJSONObject: body))
    }

    // MARK: - Scener

    func listScenes() async throws -> [RemoteSceneMeta] {
        let response: SceneListResponse = try await send(path: "/api/stageone/scenes", method: "GET", body: nil)
        return response.scenes
    }

    func fetchScene(id: String) async throws -> RemoteScene {
        try await send(path: "/api/stageone/scenes/\(id)", method: "GET", body: nil)
    }

    func putScene(id: String, name: String, scene: SceneData) async throws -> PutResponse {
        struct Body: Encodable { let name: String; let data: SceneData }
        let body = try JSONEncoder().encode(Body(name: name, data: scene))
        return try await send(path: "/api/stageone/scenes/\(id)", method: "PUT", body: body)
    }

    // MARK: - Transport

    private func send<T: Decodable>(path: String, method: String, body: Data?) async throws -> T {
        let req = Self.request(baseURLString: baseURLString, path: path, method: method,
                               token: token, body: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["error"] as? String }
            throw APIError.http(http.statusCode, code)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
