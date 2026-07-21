// APIClient+LeadgridPricing.swift
//
// Super-admin lesing/skriving av Leadgrid offentlig pris-config.
//   GET  /api/leadgrid/pricing-config   (offentlig)
//   PUT  /api/leadgrid/pricing-config   (super-admin)
//
// Én sannhetskilde: super-admin redigerer her → landing (leadgrid.no) og
// web-admin-dashboardet leser samme config. Speiler PricingConfig i
// backend/server/leadgrid-pricing-config-routes.ts.
//
// 🔑 Configen bruker camelCase-nøkler (priceNote, priceSoloPro, priceAgency).
// De delte _get/_put bruker .convertToSnakeCase på encoderen — det ville
// sendt price_note/price_solo_pro og feilet backend-valideringen (400).
// Derfor egne coders UTEN key-strategi via `_request` direkte.

import Foundation

// MARK: - DTO-er

struct LeadgridPricingTier: Codable, Identifiable, Hashable {
    var key: String
    var name: String
    var price: Int
    var tagline: String
    var priceNote: String
    var popular: Bool
    var cta: String
    var features: [String]

    var id: String { key }
}

struct LeadgridPricingModule: Codable, Identifiable, Hashable {
    var key: String
    var title: String
    var desc: String
    var priceSoloPro: Int
    var priceAgency: Int
    var accent: String
    var active: Bool

    var id: String { key }
}

struct LeadgridPricingBundle: Codable, Hashable {
    var active: Bool
    var priceAgency: Int
    var label: String
}

struct LeadgridPricingConfig: Codable, Hashable {
    var tiers: [LeadgridPricingTier]
    var modules: [LeadgridPricingModule]
    var bundle: LeadgridPricingBundle
}

// MARK: - APIClient

extension APIClient {
    /// Rene coders uten .convert*SnakeCase — camelCase-nøklene i configen
    /// må bevares 1:1 mot backend.
    private static let _lgPricingDecoder = JSONDecoder()
    private static let _lgPricingEncoder = JSONEncoder()

    func fetchLeadgridPricingConfig() async throws -> LeadgridPricingConfig {
        let data = try await _request("/api/leadgrid/pricing-config", method: "GET")
        return try Self._lgPricingDecoder.decode(LeadgridPricingConfig.self, from: data)
    }

    func saveLeadgridPricingConfig(_ config: LeadgridPricingConfig) async throws {
        struct Wrapper: Encodable { let config: LeadgridPricingConfig }
        let payload = try Self._lgPricingEncoder.encode(Wrapper(config: config))
        _ = try await _request("/api/leadgrid/pricing-config", method: "PUT", body: payload)
    }
}
