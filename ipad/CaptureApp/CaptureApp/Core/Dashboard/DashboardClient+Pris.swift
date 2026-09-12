import Foundation

/// Price-administration endpoints for ``DashboardClient`` — the native
/// "Pris" surface. Talks to `/api/price-administration/*` on the same
/// Express backend with the same Bearer auth. Every list endpoint returns
/// a *top-level JSON array* (not wrapped), so `getJSON<[T]>` decodes it
/// directly; mutations re-fetch the list rather than parse the ack.
///
/// All these endpoints scope by `?userId=` even with a Bearer present, so
/// we append the signed-in photographer id to the GET paths.
extension DashboardClient {
    /// Empty body for DELETEs — `send(...)` always encodes a body.
    private struct EmptyBody: Encodable {}

    private func userIdQuery() -> String {
        guard let userId, !userId.isEmpty else { return "" }
        let escaped = userId.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed,
        ) ?? userId
        return "?userId=\(escaped)"
    }

    // MARK: - Pricing structures

    func listPricing() async throws -> [PricingStructure] {
        try await getJSON(path: "/api/price-administration/pricing\(userIdQuery())")
    }

    func createPricing(
        name: String,
        type: String?,
        profession: String?,
        hourlyRate: Double?,
        fullDayRate: Double?,
        basePrice: Double?,
    ) async throws {
        struct Body: Encodable {
            let userId: String?
            let name: String
            let type: String?
            let profession: String?
            let hourlyRate: Double?
            let fullDayRate: Double?
            let basePrice: Double?
        }
        try await send(
            path: "/api/price-administration/pricing",
            method: "POST",
            body: Body(
                userId: userId,
                name: name,
                type: type,
                profession: profession,
                hourlyRate: hourlyRate,
                fullDayRate: fullDayRate,
                basePrice: basePrice,
            ),
        )
    }

    func deletePricing(id: String) async throws {
        try await send(
            path: "/api/price-administration/pricing/\(id)",
            method: "DELETE",
            body: EmptyBody(),
        )
    }

    // MARK: - Additional costs

    func listAdditionalCosts() async throws -> [AdditionalCost] {
        try await getJSON(path: "/api/price-administration/additional-costs\(userIdQuery())")
    }

    func createAdditionalCost(
        name: String,
        description: String?,
        type: String?,
        amount: Double?,
        isBillable: Bool,
    ) async throws {
        struct Body: Encodable {
            let userId: String?
            let name: String
            let description: String?
            let type: String?
            let amount: Double?
            let isBillable: Bool
        }
        try await send(
            path: "/api/price-administration/additional-costs",
            method: "POST",
            body: Body(
                userId: userId,
                name: name,
                description: description,
                type: type,
                amount: amount,
                isBillable: isBillable,
            ),
        )
    }

    func deleteAdditionalCost(id: String) async throws {
        try await send(
            path: "/api/price-administration/additional-costs/\(id)",
            method: "DELETE",
            body: EmptyBody(),
        )
    }

    // MARK: - Discounts

    func listDiscounts() async throws -> [Discount] {
        try await getJSON(path: "/api/price-administration/discounts\(userIdQuery())")
    }

    func createDiscount(
        name: String,
        discountCode: String?,
        discountValue: Double?,
        isPercentage: Bool,
    ) async throws {
        struct Body: Encodable {
            let userId: String?
            let name: String
            let discountCode: String?
            let discountValue: Double?
            let isPercentage: Bool
        }
        try await send(
            path: "/api/price-administration/discounts",
            method: "POST",
            body: Body(
                userId: userId,
                name: name,
                discountCode: discountCode,
                discountValue: discountValue,
                isPercentage: isPercentage,
            ),
        )
    }

    func deleteDiscount(id: String) async throws {
        try await send(
            path: "/api/price-administration/discounts/\(id)",
            method: "DELETE",
            body: EmptyBody(),
        )
    }
}
