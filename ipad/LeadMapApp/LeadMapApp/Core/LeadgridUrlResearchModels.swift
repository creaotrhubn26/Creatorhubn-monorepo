// LeadgridUrlResearchModels.swift
//
// Decode-typer for /api/leadgrid/url-research/* (mig 328).
// URL → draft-lead → Role Room Agent research → pin på kartet.
//
// Følger samme Codable-mønster som LeadgridImportModels/LeadgridResearch:
// snake_case håndteres av APIClient.decoder (.convertFromSnakeCase) — så
// her bruker vi camelCase felter.

import Foundation

// MARK: - Lokasjons-konfidens (driver UI-badge i preview)

enum LocationConfidence: String, Codable, Sendable, CaseIterable {
    case exact
    case geocoded
    case approximate
    case unknown

    /// Lilla-grønn-oransje-rød i preview-UI.
    var color: String {
        switch self {
        case .exact:       return "green"
        case .geocoded:    return "yellow"
        case .approximate: return "orange"
        case .unknown:     return "red"
        }
    }

    var label: String {
        switch self {
        case .exact:       return "Eksakt fra Google Places"
        case .geocoded:    return "Geokodet fra Brreg-adresse"
        case .approximate: return "By-sentroid — sett manuelt"
        case .unknown:     return "Ingen lokasjon funnet — sett manuelt"
        }
    }

    /// Sant når brukeren bør verifisere/forflytte pinnen før commit.
    var requiresManualVerification: Bool {
        switch self {
        case .exact, .geocoded: return false
        case .approximate, .unknown: return true
        }
    }
}

// MARK: - /start respons

struct UrlResearchStartResponse: Codable, Sendable {
    let draftLeadId: String
    let researchJobId: String
    let url: String
}

// MARK: - Research-resultat (synthesis fra orchestrator)

struct UrlResearchResolvedLocation: Codable, Sendable {
    let latitude: Double?
    let longitude: Double?
    let confidence: LocationConfidence
    let source: String?
    let address: String?
    let postalCode: String?
    let city: String?
    let country: String?
}

struct UrlResearchCompanyProfile: Codable, Sendable {
    let name: String?
    let company: String?
    let email: String?
    let phone: String?
    let website: String?
    let industry: String?
    let organizationNumber: String?
    let summary: String?
    let logoUrl: String?
    let socials: UrlResearchSocials
    let estimatedValueOere: Int?
    let aiOpportunityScore: Int?
}

struct UrlResearchSocials: Codable, Sendable {
    let instagram: String?
    let linkedin: String?
    let facebook: String?
}

/// Forsiktig partial-decode — vi vil ikke kollapse hele responsen
/// hvis backend legger til nye felter i synthesis.
struct UrlResearchResult: Codable, Sendable {
    let companyProfile: UrlResearchCompanyProfile
    let location: UrlResearchResolvedLocation
}

// MARK: - Draft-lead shape
//
// Vi kan ikke gjenbruke LeadModel direkte fordi LeadModel krever
// `latitude: Double` (ikke optional), og en draft m/ konfidens=unknown
// kan ha null. Når lat/lng er populert kan UI mappe drafted → LeadModel
// før vi pusher inn i AppState.leads.

struct UrlResearchDraftLead: Codable, Sendable, Identifiable {
    let id: String
    let name: String?
    let company: String?
    let status: String?
    let address: String?
    let postalCode: String?
    let city: String?
    let country: String?
    let latitude: Double?
    let longitude: Double?
    let phone: String?
    let email: String?
    let websiteUrl: String?
    let instagramUrl: String?
    let linkedinUrl: String?
    let logoUrl: String?
    let aiOpportunityScore: Int?
    let estimatedValue: Double?
    let leadSource: String?
    let locationConfidence: LocationConfidence?
    let draftStatus: String?
    let createdAt: Date?
    let updatedAt: Date?
}

extension UrlResearchDraftLead {
    /// Bygg LeadModel for direkte injeksjon i AppState.leads slik at
    /// MapScreen kan tegne pinnen UTEN å vente på refreshAll. Returnerer
    /// nil hvis lat/lng mangler (UI viser manuell kart-velger først).
    func toLeadModelForMap() -> LeadModel? {
        guard let lat = latitude, let lng = longitude else { return nil }
        let parsedStatus =
            LeadStatus(rawValue: status ?? "unvisited") ?? .unvisited
        return LeadModel(
            id: id,
            name: name ?? "Uten navn",
            company: company,
            category: nil,
            status: parsedStatus,
            address: address,
            postalCode: postalCode,
            city: city,
            country: country,
            latitude: lat,
            longitude: lng,
            phone: phone,
            email: email,
            websiteUrl: websiteUrl,
            instagramUrl: instagramUrl,
            linkedinUrl: linkedinUrl,
            googleRating: nil,
            googlePlaceId: nil,
            logoUrl: logoUrl,
            aiOpportunityScore: aiOpportunityScore,
            estimatedValue: estimatedValue,
            leadSource: leadSource,
            assignedUserId: nil,
            assignedUserName: nil,
            assignedUserEmail: nil,
            projectId: nil,
            lastVisitAt: nil,
            nextFollowUpAt: nil,
            nextAction: nil,
            tags: nil,
            notes: nil,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date(),
            leadTemperature: nil,
            pipelineStage: nil,
            leadScore: nil,
        )
    }
}

// MARK: - /run respons

struct UrlResearchRunResponse: Codable, Sendable {
    let draftLeadId: String
    let lead: UrlResearchDraftLead?
    let locationConfidence: LocationConfidence
    let locationSource: String?
    let researchResult: UrlResearchResult
}

// MARK: - /preview respons (les draft + cached research)

struct UrlResearchPreviewResponse: Codable, Sendable {
    let draftLeadId: String
    let lead: UrlResearchDraftLead?
    let locationConfidence: LocationConfidence
    let draftStatus: String?
}

// MARK: - /commit respons

struct UrlResearchCommitResponse: Codable, Sendable {
    let ok: Bool
    let lead: UrlResearchDraftLead?
    /// True når lat/lng IKKE ble satt; UI bør be brukeren plassere pin.
    let requiresManualPin: Bool?
    /// Når kommandoen var `accept: false` — leadet ble slettet.
    let deleted: Bool?
}

// MARK: - Overrides bruker kan sende ved commit

struct UrlResearchOverrides: Sendable {
    var latitude: Double?
    var longitude: Double?
    var locationConfidence: LocationConfidence?
    var name: String?
    var city: String?
    var address: String?
    var phone: String?
    var email: String?
    var websiteUrl: String?
    var notes: String?
    var leadStatus: String?

    func toDict() -> [String: Any] {
        var d: [String: Any] = [:]
        if let v = latitude  { d["latitude"]  = v }
        if let v = longitude { d["longitude"] = v }
        if let v = locationConfidence?.rawValue { d["location_confidence"] = v }
        if let v = name      { d["name"]    = v }
        if let v = city      { d["city"]    = v }
        if let v = address   { d["address"] = v }
        if let v = phone     { d["phone"]   = v }
        if let v = email     { d["email"]   = v }
        if let v = websiteUrl { d["website_url"] = v }
        if let v = notes     { d["notes"]   = v }
        if let v = leadStatus { d["lead_status"] = v }
        return d
    }
}

// MARK: - /refresh-section respons (delvis sub-set av /run)

struct UrlResearchRefreshResponse: Codable, Sendable {
    let ok: Bool
    let section: String
    let lead: UrlResearchDraftLead?
    let locationConfidence: LocationConfidence
    let researchResult: UrlResearchResult
}
