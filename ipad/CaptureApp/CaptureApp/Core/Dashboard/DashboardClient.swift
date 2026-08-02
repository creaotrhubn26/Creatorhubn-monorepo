import Foundation
import NetworkingKit

/// HTTP client for the native photographer dashboard surfaces. Talks to
/// the same Express backend as ``BackendClient`` (`session.backendBaseURL`)
/// with the same Bearer auth, but covers the admin REST surface the iPad
/// rebuilds natively: galleries, quotes, pricing, contracts, messages.
///
/// Mirrors ``BackendClient``'s conventions — actor-isolated, auth headers
/// injected per request, errors mapped to ``DashboardError`` so views can
/// show a readable message + retry.
actor DashboardClient {
    /// Røret. Timeout og retry-på-idempotente-kall ligger der. Se NetworkingKit.
    let transport: HTTPTransport
    let baseURL: URL
    /// Beholdes for kallsteder som bygger absolutte URL-er selv.
    private var authHeaders: [String: String]
    /// Signed-in photographer id — several dashboard endpoints scope by
    /// `?userId=` even with a Bearer present.
    let userId: String?

    init(
        baseURL: URL,
        session: URLSession = .shared,
        authHeaders: [String: String] = [:],
        userId: String? = nil,
    ) {
        self.baseURL = baseURL
        self.authHeaders = authHeaders
        self.userId = userId
        self.transport = HTTPTransport(
            baseURL: baseURL,
            session: session,
            authHeaders: authHeaders,
        )
    }

    /// Build from the signed-in session (nil when signed out).
    @MainActor
    static func make() -> DashboardClient? {
        guard let stored = SignInService.shared.session else { return nil }
        return DashboardClient(
            baseURL: stored.backendBaseURL,
            authHeaders: SignInService.shared.authHeaders,
            userId: stored.userId,
        )
    }

    // MARK: - Galleri

    func listGalleries() async throws -> [GallerySummary] {
        let resp: GalleryListResponse = try await getJSON(path: "/api/photographer/galleries")
        return resp.galleries
    }

    func galleryDetail(id: String) async throws -> GalleryDetailResponse {
        try await getJSON(path: "/api/photographer/galleries/\(id)")
    }

    func galleryActivity(id: String) async throws -> GalleryActivityResponse {
        try await getJSON(path: "/api/photographer/galleries/\(id)/activity")
    }

    /// Mark a client comment resolved + optionally attach a photographer reply.
    func respondToComment(
        galleryId: String,
        commentId: String,
        status: String = "resolved",
        response: String?,
    ) async throws {
        struct Body: Encodable { let status: String; let photographerResponse: String? }
        try await send(
            path: "/api/photographer/galleries/\(galleryId)/comments/\(commentId)",
            method: "PATCH",
            body: Body(status: status, photographerResponse: response),
        )
    }

    /// Mark the gallery complete (auto-notifies the client on the backend).
    func markGalleryComplete(galleryId: String) async throws {
        struct Empty: Encodable {}
        try await send(
            path: "/api/photographer/galleries/\(galleryId)/mark-complete",
            method: "POST",
            body: Empty(),
        )
    }

    func setAuthHeaders(_ headers: [String: String]) async {
        authHeaders = headers
        await transport.setAuthHeaders(headers)
    }

    // MARK: - Internals

    func getJSON<Response: Decodable & Sendable>(path: String) async throws -> Response {
        do { return try await transport.get(path) }
        catch let error as HTTPError { throw Self.asDashboardError(error) }
    }

    /// POST/PATCH med JSON-body; 2xx med body ignorert.
    func send<Body: Encodable & Sendable>(path: String, method: String, body: Body) async throws {
        do {
            switch method.uppercased() {
            case "PATCH": try await transport.patchIgnoringResponse(path, body: body)
            default:      try await transport.postIgnoringResponse(path, body: body)
            }
        } catch let error as HTTPError { throw Self.asDashboardError(error) }
    }

    func postJSON<Body: Encodable & Sendable, Response: Decodable & Sendable>(path: String, body: Body) async throws -> Response {
        do { return try await transport.post(path, body: body) }
        catch let error as HTTPError { throw Self.asDashboardError(error) }
    }

    /// Oversetter transportens feil til dashboardets vokabular.
    ///
    /// `DashboardError` er `LocalizedError` med norske meldinger som vises
    /// direkte i UI-et — den er en del av flatens API, ikke en
    /// implementasjonsdetalj. `signedOut` finnes ikke i transporten og settes
    /// bare av kallsteder som vet at økten mangler.
    private static func asDashboardError(_ error: HTTPError) -> DashboardError {
        switch error {
        case .unauthorized:               return .unauthorized
        case .notFound:                   return .notFound
        case let .httpStatus(code, body): return .httpStatus(code, body: body)
        case let .decode(message):        return .decode(message)
        case let .transport(message):     return .transport(message)
        case .notConfigured:              return .signedOut
        }
    }

    func applyAuth(_ request: inout URLRequest) {
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
    }

    func check(_ response: URLResponse, _ data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw DashboardError.transport("not HTTPURLResponse")
        }
        if http.statusCode == 401 || http.statusCode == 403 { throw DashboardError.unauthorized }
        if http.statusCode == 404 { throw DashboardError.notFound }
        guard (200..<300).contains(http.statusCode) else {
            throw DashboardError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
    }

}

enum DashboardError: Error, LocalizedError, Sendable {
    case unauthorized
    case notFound
    case httpStatus(Int, body: String?)
    case decode(String)
    case transport(String)
    case signedOut

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Økten er utløpt. Logg inn på nytt."
        case .notFound: return "Fant ikke ressursen."
        case .httpStatus(429, _): return "For mange forespørsler — vent litt og prøv igjen."
        case let .httpStatus(code, _) where (500...599).contains(code): return "Serveren har et problem (HTTP \(code)). Prøv igjen om litt."
        case let .httpStatus(code, _): return "Serverfeil (HTTP \(code)). Prøv igjen."
        case .decode: return "Klarte ikke å lese svaret fra serveren."
        case let .transport(detail): return "Nettverksfeil (\(detail))."
        case .signedOut: return "Du er ikke logget inn."
        }
    }
}
