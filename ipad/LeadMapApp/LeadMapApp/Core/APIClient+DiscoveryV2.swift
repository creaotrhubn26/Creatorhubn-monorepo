// APIClient+DiscoveryV2.swift

import Foundation

enum DiscoveryV2APIContract {
    static let resumableRunStatuses = ["active", "review_ready", "partial"]
}

struct DiscoveryV2DecisionResult: Decodable, Sendable {
    let candidateId: String
    let runId: String
    let decision: String
    let candidateStatus: String
    let leadId: String?
    let feedbackId: String?
    let replayed: Bool

    enum CodingKeys: String, CodingKey {
        case decision, replayed
        case candidateId = "candidate_id"
        case runId = "run_id"
        case candidateStatus = "candidate_status"
        case leadId = "lead_id"
        case feedbackId = "feedback_id"
    }
}

extension APIClient {
    private func discoveryBase(_ projectId: String) -> String {
        let encoded = projectId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? projectId
        return "/api/leadgrid/projects/\(encoded)/discovery"
    }

    private func discoveryEncode<T: Encodable>(_ value: T) throws -> Data {
        try JSONEncoder().encode(value)
    }

    private func discoveryDecode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        try JSONDecoder().decode(type, from: data)
    }

    func previewDiscovery(projectId: String, brief: DiscoveryV2Brief) async throws -> DiscoveryV2Preview {
        struct Body: Encodable { let brief: DiscoveryV2Brief }
        let data = try await executeRaw(
            method: "POST", path: discoveryBase(projectId) + "/preview",
            body: try discoveryEncode(Body(brief: brief.normalized)))
        return try discoveryDecode(DiscoveryV2Preview.self, from: data)
    }

    func createDiscoveryRun(
        projectId: String,
        brief: DiscoveryV2Brief,
        planHash: String,
        idempotencyKey: String,
        startImmediately: Bool = false,
        profileId: String? = nil,
        expectedProfileVersion: Int? = nil
    ) async throws -> DiscoveryV2Run {
        struct Body: Encodable {
            let profileId: String?
            let expectedProfileVersion: Int?
            let brief: DiscoveryV2Brief
            let startImmediately: Bool
            let planHash: String
            enum CodingKeys: String, CodingKey {
                case brief
                case profileId = "profile_id"
                case expectedProfileVersion = "expected_profile_version"
                case startImmediately = "start_immediately"
                case planHash = "plan_hash"
            }
        }
        struct Envelope: Decodable { let run: DiscoveryV2Run }
        let data = try await executeRaw(
            method: "POST", path: discoveryBase(projectId) + "/runs",
            body: try discoveryEncode(Body(
                profileId: profileId,
                expectedProfileVersion: expectedProfileVersion,
                brief: brief.normalized,
                startImmediately: startImmediately,
                planHash: planHash)),
            headers: ["Idempotency-Key": idempotencyKey])
        return try discoveryDecode(Envelope.self, from: data).run
    }

    func listDiscoveryRuns(
        projectId: String,
        statuses: [String] = DiscoveryV2APIContract.resumableRunStatuses
    ) async throws -> [DiscoveryV2Run] {
        struct Envelope: Decodable { let runs: [DiscoveryV2Run] }
        let raw = statuses.joined(separator: ",")
        let status = raw.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? raw
        let data = try await executeRaw(
            method: "GET", path: discoveryBase(projectId) + "/runs?status=\(status)", body: nil)
        return try discoveryDecode(Envelope.self, from: data).runs
    }

    func fetchDiscoveryRun(projectId: String, runId: String) async throws -> DiscoveryV2Run {
        let data = try await executeRaw(
            method: "GET", path: discoveryBase(projectId) + "/runs/\(runId)", body: nil)
        return try discoveryDecode(DiscoveryV2Run.self, from: data)
    }

    func confirmDiscoveryRun(projectId: String, runId: String) async throws -> DiscoveryV2Run {
        struct Envelope: Decodable { let run: DiscoveryV2Run }
        let data = try await executeRaw(
            method: "POST", path: discoveryBase(projectId) + "/runs/\(runId)/confirm",
            body: Data("{}".utf8))
        return try discoveryDecode(Envelope.self, from: data).run
    }

    func cancelDiscoveryRun(projectId: String, runId: String) async throws -> DiscoveryV2Run {
        struct Envelope: Decodable { let run: DiscoveryV2Run }
        let data = try await executeRaw(
            method: "POST", path: discoveryBase(projectId) + "/runs/\(runId)/cancel",
            body: Data("{}".utf8))
        return try discoveryDecode(Envelope.self, from: data).run
    }

    func fetchDiscoveryCandidates(
        projectId: String,
        runId: String,
        cursor: String? = nil,
        disposition: String = "pending",
        limit: Int = 50
    ) async throws -> (items: [DiscoveryV2Candidate], nextCursor: String?) {
        struct Envelope: Decodable {
            let items: [DiscoveryV2Candidate]
            let nextCursor: String?
            enum CodingKeys: String, CodingKey {
                case items
                case nextCursor = "next_cursor"
            }
        }
        var query = "?disposition=\(disposition)&sort=score_desc&limit=\(min(100, max(1, limit)))"
        if let cursor, let encoded = cursor.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            query += "&cursor=\(encoded)"
        }
        let data = try await executeRaw(
            method: "GET",
            path: discoveryBase(projectId) + "/runs/\(runId)/candidates\(query)", body: nil)
        let envelope = try discoveryDecode(Envelope.self, from: data)
        return (envelope.items, envelope.nextCursor)
    }
    func fetchDiscoveryPlaceDetails(
        projectId: String,
        runId: String,
        candidateId: String
    ) async throws -> DiscoveryV2PlaceDetailsResponse {
        let data = try await executeRaw(
            method: "POST",
            path: discoveryBase(projectId)
                + "/runs/\(runId)/candidates/\(candidateId)/place-details",
            body: Data("{}".utf8),
            headers: ["Cache-Control": "no-store"])
        return try discoveryDecode(DiscoveryV2PlaceDetailsResponse.self, from: data)
    }


    func decideDiscoveryCandidate(
        projectId: String,
        runId: String,
        candidateId: String,
        request: DiscoveryV2DecisionRequest,
        idempotencyKey: String
    ) async throws -> DiscoveryV2DecisionResult {
        let data = try await executeRaw(
            method: "POST",
            path: discoveryBase(projectId) + "/runs/\(runId)/candidates/\(candidateId)/decision",
            body: try discoveryEncode(request),
            headers: ["Idempotency-Key": idempotencyKey])
        return try discoveryDecode(DiscoveryV2DecisionResult.self, from: data)
    }

    func listDiscoveryProfiles(projectId: String) async throws -> [DiscoveryV2Profile] {
        struct Envelope: Decodable { let profiles: [DiscoveryV2Profile] }
        let data = try await executeRaw(
            method: "GET", path: discoveryBase(projectId) + "/profiles", body: nil)
        return try discoveryDecode(Envelope.self, from: data).profiles
    }

    func createDiscoveryProfile(
        projectId: String,
        request: DiscoveryV2ProfileWrite
    ) async throws -> DiscoveryV2Profile {
        struct Envelope: Decodable { let profile: DiscoveryV2Profile }
        let data = try await executeRaw(
            method: "POST", path: discoveryBase(projectId) + "/profiles",
            body: try discoveryEncode(request))
        return try discoveryDecode(Envelope.self, from: data).profile
    }

    func updateDiscoveryProfile(
        projectId: String,
        profileId: String,
        request: DiscoveryV2ProfileWrite
    ) async throws -> DiscoveryV2Profile {
        struct Envelope: Decodable { let profile: DiscoveryV2Profile }
        let data = try await executeRaw(
            method: "PATCH", path: discoveryBase(projectId) + "/profiles/\(profileId)",
            body: try discoveryEncode(request))
        return try discoveryDecode(Envelope.self, from: data).profile
    }
}
