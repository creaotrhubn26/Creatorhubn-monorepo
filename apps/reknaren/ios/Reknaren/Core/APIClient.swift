import Foundation

struct APIError: LocalizedError {
    let status: Int
    let code: String?
    let message: String
    var errorDescription: String? { message }
}

/// Tynn URLSession-wrapper mot samme REST-API som web-appen. Bearer-token settes av
/// `Session`. All forretningslogikk bor server-side → app og web kan ikke divergere.
actor APIClient {
    static let shared = APIClient()

    private let base = AppConfig.apiBase
    private var token: String?
    private let session: URLSession

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 25
        cfg.waitsForConnectivity = true
        session = URLSession(configuration: cfg)
    }

    func setToken(_ t: String?) { token = t }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(path, method: "GET", body: Optional<Empty>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send(path, method: "POST", body: body)
    }

    private func send<T: Decodable, B: Encodable>(_ path: String, method: String, body: B?) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, resp) = try await session.data(for: req)
        let http = resp as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let err = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
            throw APIError(status: status, code: err?.error.code,
                           message: err?.error.message ?? "Noe gikk galt (HTTP \(status)).")
        }
        if T.self == Empty.self { return Empty() as! T }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

/// Tom body/respons.
struct Empty: Codable, Sendable {}

private struct ErrorEnvelope: Decodable {
    struct E: Decodable { let code: String?; let message: String? }
    let error: E
}
