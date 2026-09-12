// APIClient+LeadgridTestimonial.swift
//
// Kunde sender inn en omtale fra appen («Hva synes du om Leadgrid?»).
//   POST /api/leadgrid/testimonials   (offentlig; godkjennes av super-admin
//   før den vises på leadgrid.no)
//
// 🔑 Feltet `submitterOrg` er camelCase — backend leser nøyaktig det. De delte
// _get/_put konverterer til snake_case, så vi bruker `_request` direkte med en
// ren JSONEncoder (samme mønster som APIClient+LeadgridPricing).

import Foundation

extension APIClient {
    private static let _lgTestimonialEncoder = JSONEncoder()

    struct LeadgridTestimonialInput: Encodable {
        var quote: String
        var rating: Int
        var name: String
        var role: String
        var submitterOrg: String
    }

    func submitLeadgridTestimonial(_ input: LeadgridTestimonialInput) async throws {
        let payload = try Self._lgTestimonialEncoder.encode(input)
        _ = try await _request("/api/leadgrid/testimonials", method: "POST", body: payload)
    }
}
