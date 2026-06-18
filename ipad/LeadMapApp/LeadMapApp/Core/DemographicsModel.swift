// DemographicsModel.swift — SSB

import Foundation

struct DemographicsModel: Codable, Hashable {
    let found: Bool
    let city: String?
    let kommuneNr: String?
    let population: Int?
    let marketPotential: Int?
    let fetchedAt: String
}
