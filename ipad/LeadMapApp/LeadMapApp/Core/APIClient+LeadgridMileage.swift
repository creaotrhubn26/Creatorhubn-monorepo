// APIClient+LeadgridMileage.swift
//
// Kjøregodtgjørelse-godkjenning (Salgssjef-cockpit → «Kjøregodtgjørelse»).
// Backend: leadgrid-mileage-approval-routes.ts (mig 0405). Erstatter
// MileageMockData med ekte, persistert data.
//
// 🔑 Backend-DTO er allerede camelCase → egen plain JSONDecoder UTEN
// key-strategi via `_request` direkte (samme mønster som APIClient+LeadgridPricing;
// de delte _get/_post ville rørt snake_case-konvertering).

import Foundation

struct LeadgridMileageClaim: Decodable, Identifiable, Hashable {
    let id: Int
    let sellerUserId: String
    let sellerName: String?
    let tripDate: String
    let routeText: String?
    let km: Double
    let amountNok: Double
    let status: String        // pending | approved | paid | rejected
    let approvedBy: String?
    let approvedAt: String?
    let note: String?
}

private struct LeadgridMileageListResponse: Decodable {
    let claims: [LeadgridMileageClaim]
}
private struct LeadgridMileageApproveAllResponse: Decodable {
    let approved: Int
}

extension APIClient {
    private static let _lgMileageDecoder = JSONDecoder()

    /// Leder: org-ens ventende krav.
    /// Kostnad→besøk (#73): logg kjøregodtgjørelsen som krav i
    /// godkjennings-flyten, attribuert til leaden via routeText/note.
    func submitLeadgridMileageClaim(km: Int, routeText: String, note: String?,
                                    idempotencyKey: String) async throws {
        struct Body: Encodable {
            let km: Int
            let routeText: String
            let note: String?
        }
        let data = try JSONEncoder().encode(Body(
            km: km, routeText: routeText, note: note))
        _ = try await _request("/api/leadgrid/sales-management/mileage",
                               method: "POST", body: data,
                               headers: ["Idempotency-Key": idempotencyKey])
    }

    func fetchLeadgridMileagePending() async throws -> [LeadgridMileageClaim] {
        let data = try await _request("/api/leadgrid/mileage/pending", method: "GET")
        return try Self._lgMileageDecoder.decode(LeadgridMileageListResponse.self, from: data).claims
    }

    /// Leder: org-ens godkjente/utbetalte (historikk).
    func fetchLeadgridMileageRecent() async throws -> [LeadgridMileageClaim] {
        let data = try await _request("/api/leadgrid/mileage/recent", method: "GET")
        return try Self._lgMileageDecoder.decode(LeadgridMileageListResponse.self, from: data).claims
    }

    /// Leder: godkjenn ett krav.
    func approveLeadgridMileage(id: Int) async throws {
        _ = try await _request("/api/leadgrid/mileage/claims/\(id)/approve", method: "POST")
    }

    /// Leder: godkjenn alle ventende. Returnerer antall godkjent.
    @discardableResult
    func approveAllLeadgridMileage() async throws -> Int {
        let data = try await _request("/api/leadgrid/mileage/approve-all", method: "POST")
        return try Self._lgMileageDecoder.decode(LeadgridMileageApproveAllResponse.self, from: data).approved
    }
}
