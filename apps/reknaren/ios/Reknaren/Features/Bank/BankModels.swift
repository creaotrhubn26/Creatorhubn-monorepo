import Foundation

struct CategorySuggestion: Decodable, Hashable, Sendable {
    let key: String
    let label: String
    let account: String
    let reason: String
    let explanation: String
}

struct BankTx: Decodable, Identifiable, Sendable {
    let id: String
    let bookedDate: String
    let amount: Money
    let description: String
    let counterparty: String?
    let kid: String?
    let status: String
    let suggestion: CategorySuggestion?
    let guidance: String?

    var isIncoming: Bool { amount.minor >= 0 }
    var isUnmatched: Bool { status == "unmatched" }

    enum CodingKeys: String, CodingKey {
        case id
        case bookedDate = "booked_date"
        case amount = "amount_minor"
        case description, counterparty, kid, status, suggestion, guidance
    }
}
