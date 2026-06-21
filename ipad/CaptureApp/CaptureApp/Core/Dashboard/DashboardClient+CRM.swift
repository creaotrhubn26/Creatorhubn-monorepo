import Foundation

/// Universal CRM context layer for the in-chat CRM panel. These talk to
/// the same Express backend as the rest of ``DashboardClient`` and reuse
/// its internal `getJSON(path:)` / `send(path:method:body:)` plumbing
/// (same Bearer auth, same ``DashboardError`` mapping).
///
/// Endpoints — `/api/universal-crm/context/*`:
/// - GET  context/by-conversation     — resolve the CRM relationship for a chat
/// - POST context/link                — link an existing customer to a chat
/// - POST context/create-customer-link — create a customer + link in one call
/// - POST context/log-activity        — log a call/email/meeting/note
/// - GET  /api/universal-crm/customers — search customers to link
extension DashboardClient {
    /// Resolve the CRM context (customer/deal/commercial/activity/tasks)
    /// for a single chat conversation. `hintName`/`hintEmail` help the
    /// backend surface a match when the chat isn't linked yet.
    func crmContext(
        conversationId: String,
        provider: String,
        hintName: String? = nil,
        hintEmail: String? = nil,
    ) async throws -> CRMContext {
        var items = [
            URLQueryItem(name: "conversationId", value: conversationId),
            URLQueryItem(name: "provider", value: provider),
        ]
        if let hintName, !hintName.isEmpty {
            items.append(URLQueryItem(name: "hintName", value: hintName))
        }
        if let hintEmail, !hintEmail.isEmpty {
            items.append(URLQueryItem(name: "hintEmail", value: hintEmail))
        }
        let query = encodeQuery(items)
        return try await getJSON(path: "/api/universal-crm/context/by-conversation?\(query)")
    }

    /// Link an existing customer to this conversation (manual match).
    func linkCustomer(
        conversationId: String,
        customerId: String,
        provider: String,
    ) async throws {
        struct Body: Encodable {
            let conversationId: String
            let customerId: String
            let provider: String
            let matchedBy: String
        }
        try await send(
            path: "/api/universal-crm/context/link",
            method: "POST",
            body: Body(
                conversationId: conversationId,
                customerId: customerId,
                provider: provider,
                matchedBy: "manual",
            ),
        )
    }

    /// Create a new customer and link it to the conversation in one call.
    /// The endpoint returns `{ context }` (or a bare context); we POST it
    /// and then re-resolve the conversation context so callers always get
    /// a fully-hydrated ``CRMContext`` back regardless of how much the
    /// create endpoint chooses to echo.
    func createCustomerLink(
        conversationId: String,
        name: String,
        email: String? = nil,
        phone: String? = nil,
        provider: String,
    ) async throws -> CRMContext {
        struct Body: Encodable {
            let conversationId: String
            let name: String
            let email: String?
            let phone: String?
            let provider: String
        }
        // `send` validates the 2xx status but discards the body (the
        // private base URL/session aren't reachable from an extension, so
        // a body-returning POST can't be reconstructed here). Re-fetch the
        // context — this is also more robust than trusting the create
        // endpoint's echoed shape, and still honours the tolerant
        // "{ context } or bare context" contract on the read side.
        try await send(
            path: "/api/universal-crm/context/create-customer-link",
            method: "POST",
            body: Body(
                conversationId: conversationId,
                name: name,
                email: email,
                phone: phone,
                provider: provider,
            ),
        )
        return try await crmContext(
            conversationId: conversationId,
            provider: provider,
            hintName: name,
            hintEmail: email,
        )
    }

    /// Log a CRM activity (call/email/meeting/note) against the chat.
    func logActivity(
        conversationId: String,
        type: String,
        subject: String,
        description: String? = nil,
        direction: String? = nil,
        provider: String,
    ) async throws {
        struct Body: Encodable {
            let conversationId: String
            let type: String
            let subject: String
            let description: String?
            let direction: String?
            let provider: String
        }
        try await send(
            path: "/api/universal-crm/context/log-activity",
            method: "POST",
            body: Body(
                conversationId: conversationId,
                type: type,
                subject: subject,
                description: description,
                direction: direction,
                provider: provider,
            ),
        )
    }

    /// Search customers to link to a conversation. Accepts a bare array
    /// or `{ customers: [...] }`.
    func searchCustomers(query: String) async throws -> [CRMCustomer] {
        let q = encodeQuery([URLQueryItem(name: "search", value: query)])
        let resp: CRMCustomerSearchResponse = try await getJSON(
            path: "/api/universal-crm/customers?\(q)",
        )
        return resp.customers
    }

    // MARK: - Internals

    /// Encode query items with proper percent-encoding via URLComponents.
    private nonisolated func encodeQuery(_ items: [URLQueryItem]) -> String {
        var comps = URLComponents()
        comps.queryItems = items
        return comps.percentEncodedQuery ?? ""
    }
}
