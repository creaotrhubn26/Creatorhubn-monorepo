// APIClient+LeadgridManualInvoice.swift
//
// Manuell faktura for org uten Stripe (super-admin org-detalj → «Send manuell
// faktura»). Backend: leadgrid-manual-invoice-routes.ts (mig 0407).
//
// 🔑 camelCase-sikker: request-body encodes UTEN key-strategi via `_request`
// direkte + private plain JSONEncoder/-Decoder (samme mønster som
// APIClient+LeadgridMileage). De delte _get/_post ville snake_case-et body-en.

import Foundation

struct LeadgridManualInvoice: Decodable, Identifiable, Hashable {
    let id: Int
    let invoiceNumber: String?
    let recipientEmail: String
    let amountNok: Double
    let status: String        // sent | draft | failed
}

private struct LeadgridManualInvoiceResponse: Decodable {
    let invoice: LeadgridManualInvoice
}

private struct LeadgridManualInvoicePayload: Encodable {
    let recipientEmail: String
    let amountNok: Double
    let description: String?
    let orgLabel: String?
    let organizationId: String?
}

extension APIClient {
    private static let _lgInvoiceDecoder = JSONDecoder()
    private static let _lgInvoiceEncoder = JSONEncoder()

    /// Super-admin: opprett + send manuell faktura. Returnerer fakturaen
    /// (med generert fakturanr) fra backend.
    @discardableResult
    func sendLeadgridManualInvoice(
        recipientEmail: String,
        amountNok: Double,
        description: String?,
        orgLabel: String?,
        organizationId: String?
    ) async throws -> LeadgridManualInvoice {
        let payload = LeadgridManualInvoicePayload(
            recipientEmail: recipientEmail,
            amountNok: amountNok,
            description: description,
            orgLabel: orgLabel,
            organizationId: organizationId
        )
        let body = try Self._lgInvoiceEncoder.encode(payload)
        let data = try await _request("/api/leadgrid/manual-invoice", method: "POST", body: body)
        return try Self._lgInvoiceDecoder.decode(LeadgridManualInvoiceResponse.self, from: data).invoice
    }
}
