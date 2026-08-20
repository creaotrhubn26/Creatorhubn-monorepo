import Foundation

struct PayableInvoice: Decodable, Identifiable, Sendable {
    let documentId: String
    let vendorName: String?
    let bankAccount: String?
    let kid: String?
    let invoiceNumber: String?
    let amountMinor: Money
    let currency: String
    let invoiceDate: String?
    let dueDate: String?
    let payable: Bool
    var id: String { documentId }
}

struct Vendor: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let orgNumber: String?
    var autoApprove: Bool
}
