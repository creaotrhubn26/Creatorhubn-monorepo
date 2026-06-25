import Foundation

/// Admin (contracts hub) endpoints for ``DashboardClient``. Talks to the
/// Express `/api/contracts/*` REST surface with the same Bearer auth as the
/// rest of the dashboard. Reuses the actor's internal ``getJSON(path:)`` /
/// ``send(path:method:body:)`` so auth + error mapping stay identical to
/// Galleri/Tilbud/etc.
extension DashboardClient {
    /// `GET /api/contracts?userId=…` → `{ contracts: [Contract] }`.
    /// Several contract endpoints scope by `?userId=` even with a Bearer
    /// present, so we forward the signed-in id when we have one.
    func listContracts() async throws -> [ContractSummary] {
        var path = "/api/contracts"
        if let userId, !userId.isEmpty {
            let encoded = userId.addingPercentEncoding(
                withAllowedCharacters: .urlQueryAllowed,
            ) ?? userId
            path += "?userId=\(encoded)"
        }
        let resp: ContractListResponse = try await getJSON(path: path)
        return resp.contracts
    }

    /// `GET /api/contracts/:id` — returns the bare contract object (the
    /// backend spreads it into the response root), so decode it directly.
    func contract(id: String) async throws -> ContractSummary {
        try await getJSON(path: "/api/contracts/\(id)")
    }

    /// `POST /api/contracts/:id/sign` — stamps the handwritten signature.
    /// `signatureData` is a base64 PNG of the captured signature.
    func signContract(
        id: String,
        signerName: String,
        signerEmail: String,
        signatureDataBase64: String,
    ) async throws {
        struct Body: Encodable {
            let signerName: String
            let signerEmail: String
            let signatureData: String
        }
        try await send(
            path: "/api/contracts/\(id)/sign",
            method: "POST",
            body: Body(
                signerName: signerName,
                signerEmail: signerEmail,
                signatureData: signatureDataBase64,
            ),
        )
    }

    /// `PUT /api/contracts/:id/status` — move a contract through its
    /// lifecycle (draft → pending_signatures → signed → …).
    func setContractStatus(id: String, status: String) async throws {
        struct Body: Encodable { let status: String }
        try await send(
            path: "/api/contracts/\(id)/status",
            method: "PUT",
            body: Body(status: status),
        )
    }

    /// `POST /api/contracts/send-email` — emails the contract to the client
    /// for review/signature. The contract id travels in the body.
    func sendContract(id: String) async throws {
        struct Body: Encodable { let contractId: String }
        try await send(
            path: "/api/contracts/send-email",
            method: "POST",
            body: Body(contractId: id),
        )
    }
}
