// LeadgridFullIntelligenceModels.swift
//
// Modeller for Role Room Agent Bridge — Full Intelligence Report (PR #859).
// Backend orkestrerer 7 moduler parallelt og cacher 24h:
//   brreg + website + competitors + merch + threat + swot + outreach
//
// Endepunkter (alle på `/api/leadgrid/leads/:id/full-intelligence`):
//   POST                          → generer (eller returner cachet)
//   GET                           → cachet rapport
//   POST   /refresh               → tving re-generering
//
// Decoding: APIClient bruker `.convertFromSnakeCase` globalt, så
// camelCase her mapper automatisk til snake_case-feltene som backend
// sender. Fritt-skjema seksjoner (brreg/website/swot/outreach) decoder
// vi via AnyJSONValue så vi kan vise underliggende strukturer dynamisk
// uten å låse oss til en stiv shape som backend kan justere.

import Foundation

// MARK: - Type-erased JSON value

/// Type-erased Codable verdi for fritt-skjema JSON-felter
/// (brreg/website/swot/outreach). Lar oss decode dem uten å definere
/// en stiv shape, og fortsatt traverse `value as? [String: Any]` for
/// visning. Encoding er en no-op — disse feltene rendres kun.
struct AnyJSONValue: Codable, @unchecked Sendable {
    let value: Any?

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self.value = nil
            return
        }
        if let v = try? c.decode(Bool.self) {
            self.value = v
            return
        }
        if let v = try? c.decode(Int.self) {
            self.value = v
            return
        }
        if let v = try? c.decode(Double.self) {
            self.value = v
            return
        }
        if let v = try? c.decode(String.self) {
            self.value = v
            return
        }
        if let v = try? c.decode([AnyJSONValue].self) {
            self.value = v.map { $0.value as Any }
            return
        }
        if let v = try? c.decode([String: AnyJSONValue].self) {
            self.value = v.mapValues { $0.value as Any }
            return
        }
        self.value = nil
    }

    func encode(to encoder: Encoder) throws {
        // Read-only for visning — vi sender aldri disse feltene tilbake.
    }
}

// MARK: - Typed sections

struct LeadgridCompetitor: Codable, Hashable, Identifiable, Sendable {
    let name: String
    let domain: String?
    let threatLevel: String          // "low" | "medium" | "high"
    let marketPosition: String?
    let differentiators: [String]?
    let weaknesses: [String]?

    var id: String { name }
}

struct LeadgridMerchFit: Codable, Hashable, Sendable {
    let fitsVideo: Bool
    let fitsPhoto: Bool
    let fitsBrand: Bool
    let fitsStrategy: Bool
    let reasoning: String?
}

struct LeadgridThreatAssessment: Codable, Hashable, Sendable {
    let marketThreats: [String]
    let marketOpportunities: [String]
    let urgency: String              // "low" | "medium" | "high"
}

// MARK: - Full report

/// 7-modulers Claude-orkestrert rapport.
struct LeadgridFullIntelligence: Codable, Sendable {
    let leadId: String
    let generatedAt: String
    let modulesRun: [String]

    // Typed (har en stabil shape)
    let competitors: [LeadgridCompetitor]?
    let merchFit: LeadgridMerchFit?
    let threatAssessment: LeadgridThreatAssessment?

    // Fritt-skjema (decodes som AnyJSONValue, traverses ved visning)
    let brreg: AnyJSONValue?
    let website: AnyJSONValue?
    let swot: AnyJSONValue?
    let outreach: AnyJSONValue?

    let overallConfidence: Double?
    let errors: [String: String]?
}

// MARK: - Response envelope

/// Backend pakker rapporten i `{ report: {...}, cached?: bool }`.
struct FullIntelligenceResponse: Codable, Sendable {
    let report: LeadgridFullIntelligence?
    let cached: Bool?
}
