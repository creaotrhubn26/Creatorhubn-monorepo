// EnrichmentModel.swift — BRREG-berikkelse

import Foundation

enum CompanyStatus: String, Codable {
    case active
    case inLiquidation = "in_liquidation"
    case bankrupt

    var label: String {
        switch self {
        case .active: return "Aktivt"
        case .inLiquidation: return "Under avvikling"
        case .bankrupt: return "Konkurs"
        }
    }
}

struct EnrichmentCompany: Codable, Hashable {
    let name: String
    let orgNr: String
    let orgForm: String?
    let registeredAt: String?
    let naceCode: String?
    let naceDescription: String?
    let employees: Int?
    let address: String?
    let postalCode: String?
    let city: String?
    let municipality: String?
    let website: String?
    let isBankrupt: Bool
    let isInLiquidation: Bool
    let status: CompanyStatus
}

struct EnrichmentContact: Codable, Hashable {
    let role: String
    let name: String
}

struct EnrichmentModel: Codable, Hashable {
    let found: Bool
    let orgNr: String?
    let source: String
    let fetchedAt: String
    let company: EnrichmentCompany?
    let contacts: [EnrichmentContact]?
}
