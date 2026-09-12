import Foundation

// DTOs for the native "Admin" surface — the photographer's contracts hub,
// rebuilt native against the Express `/api/contracts/*` REST surface.
//
// Like ``DashboardModels``, decoding is deliberately tolerant: every
// optional field defaults to nil so a single missing/renamed column never
// fails the whole list. The backend (`mapContractRecord`) emits camelCase
// keys but is itself sloppy about shape — `totalAmount` arrives as a number
// most of the time but can come back as a string, and the list vs. single
// endpoints differ subtly. We absorb all of that here.
//
// Dates stay as raw ISO strings — render via ``DashboardDate``.
//
// All types are `Sendable` so they cross the actor boundary from
// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Contract
//
// NB: named ``ContractSummary`` (not ``Contract``) to avoid colliding with
// the GRDB-backed ``Contract`` model in `Core/Models/Contract.swift`. This
// is the dashboard REST DTO — the on-device persisted contract is separate.

struct ContractSummary: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var contractNumber: String?
    /// Backend sends `title` and `contractTitle` (often identical). We
    /// prefer `title`, falling back to `contractTitle`.
    var title: String?
    var clientName: String?
    var clientEmail: String?
    var status: String?
    var signatureStatus: String?
    /// Arrives as a JSON number normally, but tolerate a numeric string too.
    var totalAmount: Double?
    var createdAt: String?
    var signedAt: String?
    var signerName: String?
    var sections: [ContractSection]?

    private enum CodingKeys: String, CodingKey {
        case id
        case contractNumber
        case title
        case contractTitle
        case clientName
        case clientEmail
        case status
        case signatureStatus
        case totalAmount
        case createdAt
        case signedAt
        case signerName
        case sections
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        contractNumber = try c.decodeIfPresent(String.self, forKey: .contractNumber)
        // Prefer `title`, accept `contractTitle` as the documented alias.
        title = (try? c.decodeIfPresent(String.self, forKey: .title))
            ?? (try? c.decodeIfPresent(String.self, forKey: .contractTitle))
            ?? nil
        clientName = try c.decodeIfPresent(String.self, forKey: .clientName)
        clientEmail = try c.decodeIfPresent(String.self, forKey: .clientEmail)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        signatureStatus = try c.decodeIfPresent(String.self, forKey: .signatureStatus)
        totalAmount = ContractSummary.decodeFlexibleDouble(c, forKey: .totalAmount)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        signedAt = try c.decodeIfPresent(String.self, forKey: .signedAt)
        signerName = try c.decodeIfPresent(String.self, forKey: .signerName)
        sections = try c.decodeIfPresent([ContractSection].self, forKey: .sections)
    }

    /// Accept a JSON number *or* a numeric string for amount fields — the
    /// backend's `toNumericValue` helper is loose about which it emits.
    private static func decodeFlexibleDouble(
        _ c: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys,
    ) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
        if let s = try? c.decodeIfPresent(String.self, forKey: key) {
            return Double(s.replacingOccurrences(of: ",", with: "."))
        }
        return nil
    }
}

struct ContractSection: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var content: String?
    var type: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, content, type
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Sections can lack a stable id in older rows — synthesize one so
        // the list stays Identifiable.
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        title = try c.decodeIfPresent(String.self, forKey: .title)
        content = try c.decodeIfPresent(String.self, forKey: .content)
        type = try c.decodeIfPresent(String.self, forKey: .type)
    }
}

// MARK: - Responses

/// `GET /api/contracts` → `{ contracts: [...] }`.
struct ContractListResponse: Decodable, Sendable {
    let contracts: [ContractSummary]
}
