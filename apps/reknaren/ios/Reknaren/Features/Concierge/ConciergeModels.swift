import Foundation

struct DocCandidate: Decodable, Identifiable, Sendable {
    let documentId: String
    let vendor: String?
    let dateText: String?
    let grossMinor: Money
    let score: Int
    let reasons: [String]
    var id: String { documentId }
}

struct PaymentGap: Decodable, Identifiable, Sendable {
    let transactionId: String
    let bookedDate: String
    let amountMinor: Money
    let description: String
    let counterparty: String?
    let candidates: [DocCandidate]
    var id: String { transactionId }
    var topCandidate: DocCandidate? { candidates.first }
}

struct DocumentHunt: Decodable, Sendable {
    let asOf: String
    let paymentsMissingDoc: Int
    let gapsWithCandidates: Int
    let gaps: [PaymentGap]
}
