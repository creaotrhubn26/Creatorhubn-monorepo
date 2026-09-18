// GuideAPIClient.swift
//
// Tynn klient mot de offentlige leserutene i backend/server/reiseguide-routes.ts.
// Ingen innlogging: appen har kun anonym enhets-ID (POC-skisse 17.09.2026).
// Base-URL: Info.plist (GuideAPIBaseURL fra project.yml), overstyrbar i DEBUG
// med miljøvariabelen REISEGUIDE_API_BASE_URL (samme mønster som Lead Map).

import Foundation

enum GuideAPIError: LocalizedError, Sendable {
    case invalidURL
    case httpStatus(Int)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Ugyldig adresse til tjenesten."
        case let .httpStatus(code): return "Tjenesten svarte med feilkode \(code)."
        case let .decoding(detail): return "Kunne ikke lese svaret fra tjenesten (\(detail))."
        }
    }
}

actor GuideAPIClient {
    static let productionBaseURL = "https://creatorhub-backend-rtbl.onrender.com"

    static let baseURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["REISEGUIDE_API_BASE_URL"],
           let url = URL(string: override.trimmingCharacters(in: .whitespacesAndNewlines)),
           url.scheme?.hasPrefix("http") == true {
            return url
        }
        #endif
        if let configured = Bundle.main.object(forInfoDictionaryKey: "GuideAPIBaseURL") as? String,
           let url = URL(string: configured.trimmingCharacters(in: .whitespacesAndNewlines)),
           url.scheme?.hasPrefix("http") == true {
            return url
        }
        // swiftlint:disable:next force_unwrapping
        return URL(string: productionBaseURL)!
    }()

    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL = GuideAPIClient.baseURL, session: URLSession? = nil) {
        self.baseURL = baseURL
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 20
            config.waitsForConnectivity = true
            self.session = URLSession(configuration: config)
        }
    }

    func areas() async throws -> [GuideArea] {
        try await get(AreasResponse.self, path: "/api/guide/areas", query: []).areas
    }

    func area(idOrSlug: String, lang: String) async throws -> AreaResponse {
        try await get(
            AreaResponse.self,
            path: "/api/guide/areas/\(idOrSlug)",
            query: [URLQueryItem(name: "lang", value: lang)]
        )
    }

    func poi(idOrSlug: String, lang: String) async throws -> GuidePOI {
        try await get(
            POIResponse.self,
            path: "/api/guide/pois/\(idOrSlug)",
            query: [URLQueryItem(name: "lang", value: lang)]
        ).poi
    }

    private func get<T: Decodable>(_ type: T.Type, path: String, query: [URLQueryItem]) async throws -> T {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw GuideAPIError.invalidURL
        }
        let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        components.path = basePath + path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw GuideAPIError.invalidURL }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200 ..< 300).contains(http.statusCode) {
            throw GuideAPIError.httpStatus(http.statusCode)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw GuideAPIError.decoding(String(describing: error))
        }
    }
}
