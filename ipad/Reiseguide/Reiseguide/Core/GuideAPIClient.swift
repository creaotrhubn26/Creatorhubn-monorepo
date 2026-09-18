// GuideAPIClient.swift
//
// Tynn klient mot de offentlige rutene i backend/server/reiseguide-routes.ts.
// Ingen innlogging: appen har kun anonym enhets-ID (POC-skisse 17.09.2026),
// som brukes når en stjernerangering sendes inn og, med samtykke, når
// besøksloggen speiles til serveren (headeren X-SenseAid-Device, aldri i URL-en).
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

actor GuideAPIClient: VisitSyncTransport {
    static let productionBaseURL = "https://creatorhub-backend-rtbl.onrender.com"
    static let deviceHeader = "X-SenseAid-Device"

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

    /// Sender (eller oppdaterer) stjernerangeringen fra denne enheten.
    func submitRating(poiIdOrSlug: String, deviceId: String, stars: Int, lang: String) async throws -> RatingResponse {
        struct Body: Encodable {
            let deviceId: String
            let stars: Int
            let lang: String
        }
        let body = try JSONEncoder().encode(Body(deviceId: deviceId, stars: stars, lang: lang))
        return try await send(
            RatingResponse.self,
            method: "POST",
            path: "/api/guide/pois/\(poiIdOrSlug)/rating",
            query: [],
            body: body
        )
    }

    // MARK: - Besøkslogg på serveren (samtykke, GDPR)

    /// Speiler besøk til serveren. Bare sted, tid, stjerner og quiz-resultat
    /// sendes (ikke tittel), og samme besøk kan sendes flere ganger (upsert).
    func syncVisits(deviceId: String, visits: [VisitEntry]) async throws -> VisitSyncResponse {
        let body = try Self.syncPayload(for: visits)
        return try await send(
            VisitSyncResponse.self,
            method: "PUT",
            path: "/api/guide/device/visits",
            query: [],
            body: body,
            deviceId: deviceId
        )
    }

    /// Kroppen til PUT /api/guide/device/visits: kun feltene serveren lagrer
    /// (dataminimering), datoer som ISO 8601. Testet i VisitSyncTests.
    nonisolated static func syncPayload(for visits: [VisitEntry]) throws -> Data {
        struct Item: Encodable {
            let id: String
            let poiId: String
            let startedAt: Date
            let completedAt: Date?
            let stars: Int?
            let quizCorrect: Int?
            let quizTotal: Int?
        }
        struct Body: Encodable {
            let visits: [Item]
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        let items = visits.map {
            Item(
                id: $0.id, poiId: $0.poiId, startedAt: $0.startedAt, completedAt: $0.completedAt,
                stars: $0.stars, quizCorrect: $0.quizCorrect, quizTotal: $0.quizTotal
            )
        }
        return try encoder.encode(Body(visits: items))
    }

    func deleteVisit(deviceId: String, id: String) async throws {
        _ = try await send(
            DeviceDeletionResponse.self, method: "DELETE", path: "/api/guide/device/visits/\(id)",
            query: [], body: nil, deviceId: deviceId
        )
    }

    /// Hele loggen på serveren (når brukeren slår av synk). Vurderinger beholdes.
    func deleteVisits(deviceId: String) async throws {
        _ = try await send(
            DeviceDeletionResponse.self, method: "DELETE", path: "/api/guide/device/visits",
            query: [], body: nil, deviceId: deviceId
        )
    }

    /// Retten til sletting: alt om enheten, også vurderinger.
    func deleteDeviceData(deviceId: String) async throws -> DeviceDeletionResponse {
        try await send(
            DeviceDeletionResponse.self, method: "DELETE", path: "/api/guide/device/data",
            query: [], body: nil, deviceId: deviceId
        )
    }

    private func get<T: Decodable>(_ type: T.Type, path: String, query: [URLQueryItem]) async throws -> T {
        try await send(type, method: "GET", path: path, query: query, body: nil)
    }

    private func send<T: Decodable>(
        _ type: T.Type, method: String, path: String, query: [URLQueryItem], body: Data?, deviceId: String? = nil
    ) async throws -> T {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw GuideAPIError.invalidURL
        }
        let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        components.path = basePath + path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw GuideAPIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let deviceId {
            request.setValue(deviceId, forHTTPHeaderField: Self.deviceHeader)
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
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
