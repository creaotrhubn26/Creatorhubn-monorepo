import Foundation

/// HTTP client for the native photographer dashboard surfaces. Talks to
/// the same Express backend as ``BackendClient`` (`session.backendBaseURL`)
/// with the same Bearer auth, but covers the admin REST surface the iPad
/// rebuilds natively: galleries, quotes, pricing, contracts, messages.
///
/// Mirrors ``BackendClient``'s conventions — actor-isolated, auth headers
/// injected per request, errors mapped to ``DashboardError`` so views can
/// show a readable message + retry.
actor DashboardClient {
    let baseURL: URL
    private let session: URLSession
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
        self.session = session
        self.authHeaders = authHeaders
        self.userId = userId
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

    func setAuthHeaders(_ headers: [String: String]) { self.authHeaders = headers }

    // MARK: - Internals

    func getJSON<Response: Decodable>(path: String) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw DashboardError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(&request)
        let (data, response) = try await data(for: request)
        try check(response, data)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw DashboardError.decode(String(describing: error))
        }
    }

    /// POST/PATCH a JSON body; 2xx with body ignored. Used for mutations
    /// where we re-fetch the list afterwards rather than parse the ack.
    func send<Body: Encodable>(path: String, method: String, body: Body) async throws {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw DashboardError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(&request)
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await data(for: request)
        try check(response, data)
    }

    /// POST a JSON body and decode the response — for mutations whose ack
    /// carries data we need (e.g. a Google Meet join link).
    func postJSON<Body: Encodable, Response: Decodable>(path: String, body: Body) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw DashboardError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(&request)
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await data(for: request)
        try check(response, data)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw DashboardError.decode(String(describing: error))
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

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let urlError as URLError {
            throw DashboardError.transport(String(describing: urlError.code))
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
        case let .httpStatus(code, _): return "Serverfeil (HTTP \(code)). Prøv igjen."
        case .decode: return "Klarte ikke å lese svaret fra serveren."
        case let .transport(detail): return "Nettverksfeil (\(detail))."
        case .signedOut: return "Du er ikke logget inn."
        }
    }
}
