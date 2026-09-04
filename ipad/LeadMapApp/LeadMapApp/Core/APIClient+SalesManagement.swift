import Foundation

struct SalesManagementWorkspace: Decodable, Sendable {
    let organizationId: String
    let canManage: Bool
    let generatedAt: String
    let summary: Summary
    let commissionConfig: CommissionConfig
    let team: [TeamMember]
    let templates: [Template]
    let prizeCatalog: [Prize]
    let contests: [Contest]
    let awards: [Award]
    let approvals: [Approval]
    let coaching: [Coaching]
    let mileage: [Mileage]
    let routes: [Route]

    struct Summary: Decodable, Sendable {
        let teamMembers: Int
        let wonDeals: Double
        let wonRevenueNok: Double
        let pipelineValueNok: Double
        let pendingApprovals: Int
        let scheduledCoaching: Int
        let pendingMileage: Int
        let activeContests: Int
        let activeRoutes: Int
    }

    struct CommissionConfig: Decodable, Sendable {
        let preset: String
        let activeModels: [String]
        let config: JSONValue
        let updatedAt: String?
        let isDefault: Bool

        var baseRate: Double {
            guard case .object(let root) = config,
                  case .object(let base) = root["base_percentage"],
                  case .number(let rate) = base["rate"] else { return 0.10 }
            let normalized = rate > 1 ? rate / 100 : rate
            return min(1, max(0, normalized))
        }
    }

    struct TeamMember: Decodable, Identifiable, Sendable {
        var id: String { userId }
        let userId: String
        let name: String
        let email: String?
        let role: String
        let leads: Double
        let wonDeals: Double
        let wonRevenueNok: Double
        let pipelineValueNok: Double
        let activityTrendPct: Int
        let commission: Commission
        let goal: Goal?
    }

    struct Commission: Decodable, Sendable {
        let commissionNok: Double
        let effectiveRate: Double
        let modelsApplied: [String]
        let modelsIgnored: [String]
        let components: [String: Double]
    }

    struct Goal: Decodable, Sendable {
        let yearMonth: String
        let targetNok: Double
        let targetWonDeals: Double?
        let targetMeetingsBooked: Double?
    }

    struct Template: Decodable, Identifiable, Sendable {
        var id: String { templateType }
        let templateType: String
        let label: String
        let description: String
        let defaultKpi: String
        let enabled: Bool
        let defaults: JSONValue
        let updatedAt: String?
    }

    struct Prize: Decodable, Identifiable, Sendable {
        let id: String
        let title: String
        let description: String
        let category: String
        let estimatedValueNok: Double
        let fulfillmentType: String
        let imageUrl: String?
        let metadata: JSONValue
    }

    struct Contest: Decodable, Identifiable, Sendable {
        let id: String
        let name: String
        let templateType: String
        let kpi: String
        let status: String
        let startsAt: String?
        let endsAt: String?
        let closedAt: String?
        let prizes: [ContestPrize]
        let participants: [Participant]
    }

    struct ContestPrize: Decodable, Sendable {
        let id: String
        let rank: Double
        let productSnapshot: JSONValue
        let title: String
        let estimatedValueNok: Double
        let fulfillmentType: String
    }

    struct Participant: Decodable, Identifiable, Sendable {
        var id: String { userId }
        let userId: String
        let userName: String?
        let score: Double
        let rank: Double?
        let lastUpdatedAt: String?
    }

    struct Award: Decodable, Identifiable, Sendable {
        let id: String
        let contestId: String
        let prizeId: String
        let winnerUserId: String
        let winnerName: String?
        let rank: Double
        let productTitle: String
        let productCategory: String
        let fulfillmentType: String
        let status: String
        let trackingNumber: String?
        let notes: String?
        let createdAt: String?
    }

    struct Approval: Decodable, Identifiable, Sendable {
        let id: Int
        let kind: String
        let title: String
        let sellerUserId: String?
        let sellerName: String?
        let customerName: String?
        let amountNok: Double
        let rationale: String?
        let status: String
        let comment: String?
        let sourceType: String?
        let sourceId: String?
        let createdAt: String?
    }

    struct Coaching: Decodable, Identifiable, Sendable {
        let id: Int
        let memberUserId: String?
        let memberName: String
        let scheduledAt: String?
        let focus: String?
        let status: String
        let createdAt: String?
    }

    struct Mileage: Decodable, Identifiable, Sendable {
        let id: Int
        let sellerUserId: String
        let sellerName: String?
        let tripDate: String?
        let routeText: String?
        let km: Double
        let rateNokPerKm: Double
        let amountNok: Double
        let status: String
        let note: String?
        let approvedBy: String?
        let approvedAt: String?
        let createdAt: String?
    }

    struct Route: Decodable, Identifiable, Sendable {
        let id: String
        let name: String
        let stops: [Stop]
        let status: String
        let assignedUserId: String?
        let sellerName: String?
        let createdAt: String?
        let updatedAt: String?

        struct Stop: Decodable, Identifiable, Sendable {
            let id: String
            let name: String
            let address: String
            let lat: Double
            let lon: Double
            let ankerTid: String?
        }
    }
}

struct SalesManagementContestRequest: Encodable, Sendable {
    struct Prize: Encodable, Sendable {
        let rank: Int
        let productSnapshot: SalesManagementPrizeRequest
    }
    let name: String
    let templateType: String
    let kpi: String
    let startsAt: String
    let endsAt: String
    let prizes: [Prize]
}

struct SalesManagementPrizeRequest: Codable, Sendable {
    var id: String?
    let title: String
    let description: String
    let category: String
    let estimatedValueNok: Int
    let fulfillmentType: String
    let imageUrl: String?
    let metadata: [String: String]
}

private struct SalesManagementWorkspaceEnvelope: Decodable {
    let contest: SalesManagementWorkspace.Contest?
    let product: SalesManagementWorkspace.Prize?
}

extension APIClient {
    private static let salesManagementEncoder = JSONEncoder()
    private static let salesManagementDecoder = JSONDecoder()

    private func salesManagementRequest<B: Encodable, R: Decodable>(
        _ path: String,
        method: String,
        body: B,
        headers: [String: String] = [:]
    ) async throws -> R {
        let payload = try Self.salesManagementEncoder.encode(body)
        let data = try await _request(path, method: method, body: payload, headers: headers)
        return try Self.salesManagementDecoder.decode(R.self, from: data)
    }

    func fetchSalesManagementWorkspace() async throws -> SalesManagementWorkspace {
        let data = try await _request("/api/leadgrid/sales-management/workspace")
        return try Self.salesManagementDecoder.decode(SalesManagementWorkspace.self, from: data)
    }

    func saveSalesManagementCommission(rate: Double, activeModels: [String]) async throws {
        struct Body: Encodable {
            let preset: String
            let activeModels: [String]
            let config: [String: [String: Double]]
        }
        struct Response: Decodable { let commissionConfig: SalesManagementWorkspace.CommissionConfig }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/commission-config",
            method: "PUT",
            body: Body(preset: "custom", activeModels: activeModels,
                       config: ["base_percentage": ["rate": rate]])
        )
    }

    func saveSalesManagementGoal(
        userId: String,
        yearMonth: String,
        targetNok: Double,
        targetWonDeals: Int?,
        targetMeetings: Int?
    ) async throws {
        struct Body: Encodable {
            let targetNok: Double
            let targetWonDeals: Int?
            let targetMeetingsBooked: Int?
        }
        struct Response: Decodable { let goal: JSONValue }
        let escapedUser = userId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userId
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/goals/\(escapedUser)/\(yearMonth)",
            method: "PUT",
            body: Body(targetNok: targetNok, targetWonDeals: targetWonDeals,
                       targetMeetingsBooked: targetMeetings)
        )
    }

    func createSalesManagementPrize(
        _ prize: SalesManagementPrizeRequest,
        idempotencyKey: String
    ) async throws {
        let _: SalesManagementWorkspaceEnvelope = try await salesManagementRequest(
            "/api/leadgrid/sales-management/prize-catalog", method: "POST", body: prize,
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }

    func archiveSalesManagementPrize(id: String) async throws {
        _ = try await _request("/api/leadgrid/sales-management/prize-catalog/\(id)", method: "DELETE")
    }

    func createSalesManagementContest(
        _ contest: SalesManagementContestRequest,
        idempotencyKey: String
    ) async throws {
        let _: SalesManagementWorkspaceEnvelope = try await salesManagementRequest(
            "/api/leadgrid/sales-management/contests", method: "POST", body: contest,
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }

    func refreshSalesManagementContest(id: String) async throws {
        _ = try await _request("/api/leadgrid/sales-management/contests/\(id)/refresh", method: "POST")
    }

    func closeSalesManagementContest(id: String) async throws {
        _ = try await _request("/api/leadgrid/sales-management/contests/\(id)/close", method: "POST")
    }

    func archiveSalesManagementContest(id: String) async throws {
        _ = try await _request("/api/leadgrid/sales-management/contests/\(id)", method: "DELETE")
    }

    func requestSalesManagementApproval(
        kind: String,
        title: String,
        customerName: String?,
        amountNok: Double,
        rationale: String?,
        sourceType: String?,
        sourceId: String?,
        idempotencyKey: String
    ) async throws {
        struct Body: Encodable {
            let kind: String
            let title: String
            let customerName: String?
            let amountNok: Double
            let rationale: String?
            let sourceType: String?
            let sourceId: String?
        }
        struct Response: Decodable { let approval: SalesManagementWorkspace.Approval }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/approvals", method: "POST",
            body: Body(kind: kind, title: title, customerName: customerName,
                       amountNok: amountNok, rationale: rationale,
                       sourceType: sourceType, sourceId: sourceId),
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }

    func decideSalesManagementApproval(id: Int, approve: Bool, comment: String?) async throws {
        struct Body: Encodable { let approve: Bool; let comment: String? }
        struct Response: Decodable { let approval: SalesManagementWorkspace.Approval }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/approvals/\(id)/decision", method: "POST",
            body: Body(approve: approve, comment: comment)
        )
    }

    func createSalesManagementCoaching(
        memberUserId: String,
        memberName: String,
        scheduledAt: Date,
        focus: String?,
        idempotencyKey: String
    ) async throws {
        struct Body: Encodable {
            let memberUserId: String
            let memberName: String
            let scheduledAt: String
            let focus: String?
        }
        struct Response: Decodable { let session: SalesManagementWorkspace.Coaching }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/coaching", method: "POST",
            body: Body(
                memberUserId: memberUserId,
                memberName: memberName,
                scheduledAt: ISO8601DateFormatter().string(from: scheduledAt),
                focus: focus
            ),
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }
    func updateSalesManagementCoaching(id: Int, status: String) async throws {
        struct Body: Encodable { let status: String }
        struct Response: Decodable { let session: SalesManagementWorkspace.Coaching }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/coaching/\(id)/status", method: "PATCH",
            body: Body(status: status)
        )
    }

    func updateSalesManagementMileage(id: Int, status: String) async throws {
        struct Body: Encodable { let status: String }
        struct Response: Decodable { let claim: SalesManagementWorkspace.Mileage }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/mileage/\(id)/status", method: "POST",
            body: Body(status: status)
        )
    }

    func updateSalesManagementAward(id: String, status: String, trackingNumber: String?) async throws {
        struct Body: Encodable { let status: String; let trackingNumber: String? }
        struct Response: Decodable { let award: SalesManagementWorkspace.Award }
        let _: Response = try await salesManagementRequest(
            "/api/leadgrid/sales-management/awards/\(id)/status", method: "POST",
            body: Body(status: status, trackingNumber: trackingNumber)
        )
    }
}
