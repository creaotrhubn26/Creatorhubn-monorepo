import Foundation

// DTOs for the Universal CRM context layer that backs the in-chat CRM
// panel (`/api/universal-crm/context/*`). These mirror the JSON the
// Express backend returns when resolving the CRM relationship for a
// single chat conversation: who the customer is, the active deal,
// commercial docs (quote/contract), recent activity, open tasks, and a
// short summary.
//
// Decoding is deliberately tolerant (mirrors ``DashboardModels``): every
// field is optional and numbers that may arrive as either a JSON number
// or a string (Postgres `numeric` casts) go through ``CRMNumber``.
// Dates stay as raw ISO-ish strings — render them via ``DashboardDate``.
//
// All types are `Sendable` so they cross the ``DashboardClient`` actor
// boundary into `@MainActor` view models cleanly.

// MARK: - Number coercion

/// Decodes a JSON value that may be a number, a numeric string, or null.
/// Postgres `numeric`/`money` columns frequently serialize as strings.
enum CRMNumber {
    static func double(_ container: KeyedDecodingContainer<AnyKey>, _ key: AnyKey) -> Double? {
        if let d = try? container.decodeIfPresent(Double.self, forKey: key) { return d }
        if let s = try? container.decodeIfPresent(String.self, forKey: key) {
            let cleaned = s.replacingOccurrences(of: " ", with: "")
                .replacingOccurrences(of: ",", with: ".")
            return Double(cleaned)
        }
        if let i = try? container.decodeIfPresent(Int.self, forKey: key) { return Double(i) }
        return nil
    }
}

/// String-keyed coding key so the tolerant helpers can address any field
/// without a hand-written enum per type.
struct AnyKey: CodingKey {
    var stringValue: String
    var intValue: Int?
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { self.intValue = intValue; self.stringValue = String(intValue) }
    init(_ s: String) { self.stringValue = s }
}

private extension KeyedDecodingContainer where Key == AnyKey {
    func str(_ name: String) -> String? {
        try? decodeIfPresent(String.self, forKey: AnyKey(name))
    }
    func int(_ name: String) -> Int? {
        if let i = try? decodeIfPresent(Int.self, forKey: AnyKey(name)) { return i }
        if let s = try? decodeIfPresent(String.self, forKey: AnyKey(name)) { return Int(s) }
        return nil
    }
    func bool(_ name: String) -> Bool? {
        if let b = try? decodeIfPresent(Bool.self, forKey: AnyKey(name)) { return b }
        if let i = try? decodeIfPresent(Int.self, forKey: AnyKey(name)) { return i != 0 }
        return nil
    }
    func dbl(_ name: String) -> Double? {
        CRMNumber.double(self, AnyKey(name))
    }
}

// MARK: - Context

struct CRMContext: Codable, Sendable {
    var provider: String?
    var conversationId: String?
    /// "linked" | "match_available" | "unlinked"
    var relationshipState: String?
    var customer: CRMCustomer?
    var recommendedCustomer: CRMCustomer?
    var suggestedCustomers: [CRMCustomer]?
    var activeDeal: CRMDeal?
    var recentActivities: [CRMActivity]?
    var openTasks: [CRMTask]?
    var summary: CRMSummary?
    var commercial: CRMCommercial?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        provider = c.str("provider")
        conversationId = c.str("conversationId")
        relationshipState = c.str("relationshipState")
        customer = try? c.decodeIfPresent(CRMCustomer.self, forKey: AnyKey("customer"))
        recommendedCustomer = try? c.decodeIfPresent(CRMCustomer.self, forKey: AnyKey("recommendedCustomer"))
        suggestedCustomers = try? c.decodeIfPresent([CRMCustomer].self, forKey: AnyKey("suggestedCustomers"))
        activeDeal = try? c.decodeIfPresent(CRMDeal.self, forKey: AnyKey("activeDeal"))
        recentActivities = try? c.decodeIfPresent([CRMActivity].self, forKey: AnyKey("recentActivities"))
        openTasks = try? c.decodeIfPresent([CRMTask].self, forKey: AnyKey("openTasks"))
        summary = try? c.decodeIfPresent(CRMSummary.self, forKey: AnyKey("summary"))
        commercial = try? c.decodeIfPresent(CRMCommercial.self, forKey: AnyKey("commercial"))
    }

    init() {}

    // We never encode CRMContext back to the server.
    func encode(to encoder: Encoder) throws {}

    var state: RelationshipState { RelationshipState(rawValue: relationshipState) }
}

/// Convenience enum over the raw relationship string.
enum RelationshipState: Equatable, Sendable {
    case linked
    case matchAvailable
    case unlinked
    case unknown

    init(rawValue: String?) {
        switch (rawValue ?? "").lowercased() {
        case "linked": self = .linked
        case "match_available": self = .matchAvailable
        case "unlinked": self = .unlinked
        default: self = .unknown
        }
    }
}

// MARK: - Customer

struct CRMCustomer: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var company: String?
    var profession: String?
    var projectType: String?
    var status: String?
    var notes: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        // id may be missing on some payloads; fall back to a synthesized id
        // so a malformed row never crashes the whole list.
        id = c.str("id") ?? c.str("customerId") ?? UUID().uuidString
        name = c.str("name")
        email = c.str("email")
        phone = c.str("phone")
        company = c.str("company")
        profession = c.str("profession")
        projectType = c.str("projectType") ?? c.str("project_type")
        status = c.str("status")
        notes = c.str("notes")
    }

    func encode(to encoder: Encoder) throws {}

    var displayName: String {
        if let n = name, !n.isEmpty { return n }
        if let co = company, !co.isEmpty { return co }
        if let e = email, !e.isEmpty { return e }
        return "Ukjent kunde"
    }
}

// MARK: - Deal

struct CRMDeal: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var value: Double?
    var currency: String?
    var stage: String?
    var probability: Double?
    var expectedCloseDate: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id") ?? UUID().uuidString
        title = c.str("title")
        value = c.dbl("value")
        currency = c.str("currency")
        stage = c.str("stage")
        probability = c.dbl("probability")
        expectedCloseDate = c.str("expectedCloseDate") ?? c.str("expected_close_date")
    }

    func encode(to encoder: Encoder) throws {}
}

// MARK: - Activity

struct CRMActivity: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var type: String?
    var subject: String?
    var description: String?
    var direction: String?
    var outcome: String?
    var createdAt: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id") ?? UUID().uuidString
        type = c.str("type")
        subject = c.str("subject")
        description = c.str("description")
        direction = c.str("direction")
        outcome = c.str("outcome")
        createdAt = c.str("createdAt") ?? c.str("created_at")
    }

    func encode(to encoder: Encoder) throws {}
}

// MARK: - Task

struct CRMTask: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var priority: String?
    var status: String?
    var dueDate: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id") ?? UUID().uuidString
        title = c.str("title")
        priority = c.str("priority")
        status = c.str("status")
        dueDate = c.str("dueDate") ?? c.str("due_date")
    }

    func encode(to encoder: Encoder) throws {}
}

// MARK: - Summary

struct CRMSummary: Codable, Sendable {
    var nextFollowUp: String?
    var openTaskCount: Int?
    var recentActivityCount: Int?
    var pendingReplyHint: Bool?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        nextFollowUp = c.str("nextFollowUp") ?? c.str("next_follow_up")
        openTaskCount = c.int("openTaskCount") ?? c.int("open_task_count")
        recentActivityCount = c.int("recentActivityCount") ?? c.int("recent_activity_count")
        pendingReplyHint = c.bool("pendingReplyHint") ?? c.bool("pending_reply_hint")
    }

    func encode(to encoder: Encoder) throws {}
}

// MARK: - Commercial (quote + contract)

struct CRMCommercial: Codable, Sendable {
    var quote: CRMQuote?
    var contract: CRMContract?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        quote = try? c.decodeIfPresent(CRMQuote.self, forKey: AnyKey("quote"))
        contract = try? c.decodeIfPresent(CRMContract.self, forKey: AnyKey("contract"))
    }

    func encode(to encoder: Encoder) throws {}

    var isEmpty: Bool { quote == nil && contract == nil }
}

struct CRMQuote: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var quoteNumber: String?
    var title: String?
    var totalAmount: Double?
    var currency: String?
    var status: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id") ?? UUID().uuidString
        quoteNumber = c.str("quoteNumber") ?? c.str("quote_number")
        title = c.str("title")
        totalAmount = c.dbl("totalAmount") ?? c.dbl("total_amount")
        currency = c.str("currency")
        status = c.str("status")
    }

    func encode(to encoder: Encoder) throws {}
}

struct CRMContract: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var contractNumber: String?
    var title: String?
    var status: String?
    var signatureStatus: String?
    var totalAmount: Double?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id") ?? UUID().uuidString
        contractNumber = c.str("contractNumber") ?? c.str("contract_number")
        title = c.str("title") ?? c.str("contractTitle") ?? c.str("contract_title")
        status = c.str("status")
        signatureStatus = c.str("signatureStatus") ?? c.str("signature_status")
        totalAmount = c.dbl("totalAmount") ?? c.dbl("total_amount")
    }

    func encode(to encoder: Encoder) throws {}
}

// MARK: - Mutation responses

/// Envelope for endpoints that return `{ context: ... }`. The decoder also
/// accepts a bare ``CRMContext`` at the top level.
struct CRMContextEnvelope: Codable, Sendable {
    let context: CRMContext

    init(from decoder: Decoder) throws {
        if let keyed = try? decoder.container(keyedBy: AnyKey.self),
           let ctx = try? keyed.decode(CRMContext.self, forKey: AnyKey("context")) {
            context = ctx
        } else {
            context = try CRMContext(from: decoder)
        }
    }

    func encode(to encoder: Encoder) throws {}
}

/// Envelope for customer search: accepts a bare array or `{ customers: [] }`.
struct CRMCustomerSearchResponse: Codable, Sendable {
    let customers: [CRMCustomer]

    init(from decoder: Decoder) throws {
        if let arr = try? decoder.singleValueContainer().decode([CRMCustomer].self) {
            customers = arr
        } else if let keyed = try? decoder.container(keyedBy: AnyKey.self),
                  let arr = try? keyed.decode([CRMCustomer].self, forKey: AnyKey("customers")) {
            customers = arr
        } else {
            customers = []
        }
    }

    func encode(to encoder: Encoder) throws {}
}
