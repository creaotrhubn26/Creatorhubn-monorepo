import Foundation

/// One asset's auto-cull verdict from the backend classifier
/// (`GET /api/capture/sessions/:id/cull-suggestions`).
struct CullVerdict: Decodable, Sendable, Hashable {
    let assetId: String
    let bucket: String          // reject | weak | keep | hero
    let score: Double
    let reasons: [String]

    private enum CodingKeys: String, CodingKey { case assetId, bucket, score, reasons }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        assetId = (try? c.decode(String.self, forKey: .assetId)) ?? ""
        bucket = c.firstString([.bucket]) ?? "keep"
        score = c.firstDouble([.score]) ?? 0
        reasons = (try? c.decodeIfPresent([String].self, forKey: .reasons)) ?? []
    }
}

/// The four buckets for a session, keyed by asset id for quick lookup.
struct CullSuggestions: Decodable, Sendable {
    let total: Int
    let strictness: String
    let verdicts: [String: CullVerdict]   // assetId (lowercased) -> verdict

    private enum CodingKeys: String, CodingKey {
        case total, strictness, hero, keep, weak, reject
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        total = c.firstInt([.total]) ?? 0
        strictness = c.firstString([.strictness]) ?? "balanced"
        var map: [String: CullVerdict] = [:]
        for key: CodingKeys in [.hero, .keep, .weak, .reject] {
            let list = (try? c.decodeIfPresent([CullVerdict].self, forKey: key)) ?? []
            for v in list { map[v.assetId.lowercased()] = v }
        }
        verdicts = map
    }

    /// Buckets the classifier considers keepers.
    static let keepBuckets: Set<String> = ["hero", "keep"]
}

extension DashboardClient {
    /// Auto-cull suggestions for a capture session. `strictness` is
    /// conservative | balanced | aggressive.
    func cullSuggestions(sessionId: String, strictness: String) async throws -> CullSuggestions {
        try await getJSON(path: "/api/capture/sessions/\(sessionId)/cull-suggestions?strictness=\(strictness)")
    }
}
