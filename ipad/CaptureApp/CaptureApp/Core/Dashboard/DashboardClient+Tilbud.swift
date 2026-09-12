import Foundation

/// "Tilbud" (quotes) endpoints on the shared ``DashboardClient`` actor.
/// Talks to the same Express backend (`/api/quotes/*`) as the web admin,
/// reusing the actor's `getJSON`/`send` helpers + Bearer auth. Several
/// routes scope by `?userId=` even with a Bearer present, so we append
/// `self.userId` when known.
extension DashboardClient {
    /// GET /api/quotes/all?userId=<id> → { quotes: [Quote] }
    func listQuotes() async throws -> [Quote] {
        let resp: QuoteListResponse = try await getJSON(path: "/api/quotes/all\(userIdQuery())")
        return resp.quotes
    }

    /// GET /api/quotes/:id → { data: Quote }
    func quote(id: String) async throws -> Quote {
        let resp: QuoteDetailResponse = try await getJSON(path: "/api/quotes/\(encode(id))")
        return resp.data
    }

    /// POST /api/quotes/create. Callers re-fetch the list afterwards, so
    /// we don't parse the (route-varying) ack body — just confirm 2xx.
    func createQuote(
        clientName: String,
        clientEmail: String,
        title: String,
        description: String,
        services: [QuoteService],
        totalAmount: Double,
        status: String = "draft",
    ) async throws {
        struct ServiceBody: Encodable {
            let description: String
            let quantity: Double
            let unitPrice: Double
            let totalPrice: Double
        }
        struct Body: Encodable {
            let clientName: String
            let clientEmail: String
            let title: String
            let description: String
            let services: [ServiceBody]
            let totalAmount: Double
            let status: String
            let userId: String?
        }
        let body = Body(
            clientName: clientName,
            clientEmail: clientEmail,
            title: title,
            description: description,
            services: services.map {
                ServiceBody(
                    description: $0.description,
                    quantity: $0.quantity,
                    unitPrice: $0.unitPrice,
                    totalPrice: $0.totalPrice,
                )
            },
            totalAmount: totalAmount,
            status: status,
            userId: userId,
        )
        try await send(path: "/api/quotes/create", method: "POST", body: body)
    }

    /// PUT /api/quotes/:id/status { status }
    func setQuoteStatus(id: String, status: String) async throws {
        struct Body: Encodable { let status: String }
        try await send(
            path: "/api/quotes/\(encode(id))/status",
            method: "PUT",
            body: Body(status: status),
        )
    }

    /// POST /api/quotes/:id/send-email {}
    func sendQuote(id: String) async throws {
        struct Empty: Encodable {}
        try await send(
            path: "/api/quotes/\(encode(id))/send-email",
            method: "POST",
            body: Empty(),
        )
    }

    // MARK: - Helpers

    /// `?userId=<id>` when signed-in id is known, else empty.
    private func userIdQuery() -> String {
        guard let userId, !userId.isEmpty else { return "" }
        let encoded = userId.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? userId
        return "?userId=\(encoded)"
    }

    private func encode(_ segment: String) -> String {
        segment.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? segment
    }
}

private extension CharacterSet {
    /// URL-query-value-safe set (drops `&` `=` `+` from the allowed set).
    static let urlQueryValueAllowed: CharacterSet = {
        var set = CharacterSet.urlQueryAllowed
        set.remove(charactersIn: "&=+?")
        return set
    }()
}
