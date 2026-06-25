// LeadgridImportModels.swift
//
// Decode-typer for /api/leadgrid/import/* (mig 328). Brukes av
// LeadgridImportSheet på iPad. Følger eksisterende Codable-mønster fra
// LeadgridMomentumModels.swift / LeadgridForecastingModels.swift.

import Foundation

// MARK: - CSV preview-respons

struct LeadgridImportPreview: Codable, Sendable {
    let fileToken: String
    let fileName: String
    let columns: [String]
    let rows: [[String: String]]   // første 20 rader
    let totalRows: Int
}

// MARK: - Commit-respons (felles for CSV + URL)

struct LeadgridImportCommit: Codable, Sendable {
    let batchId: String
    let imported: Int
    let skippedDuplicates: Int
    let errorsCount: Int
}

// MARK: - URL scrape-respons

struct LeadgridImportScrape: Codable, Sendable {
    let results: [LeadgridImportScrapeItem]
}

struct LeadgridImportScrapeItem: Codable, Sendable, Identifiable {
    let url: String
    let lead: LeadgridImportScrapedLead?
    let error: String?

    var id: String { url }
}

struct LeadgridImportScrapedLead: Codable, Sendable, Hashable {
    var name: String?
    var email: String?
    var phone: String?
    var city: String?
    var address: String?
    var company: String?
    var websiteUrl: String?
    var industry: String?
    var country: String?
    var linkedinUrl: String?
    var instagramUrl: String?
    var facebookUrl: String?
    var notes: String?
    var employeeCountEstimate: Int?
    var leadQualityScore: Int?

    /// Konverter til JSON-payload som backend forventer på /url/commit.
    /// Camel→snake for keys.
    func toCommitDict() -> [String: Any] {
        var d: [String: Any] = [:]
        if let v = name { d["name"] = v }
        if let v = email { d["email"] = v }
        if let v = phone { d["phone"] = v }
        if let v = city { d["city"] = v }
        if let v = address { d["address"] = v }
        if let v = company { d["company"] = v }
        if let v = websiteUrl { d["website_url"] = v }
        if let v = industry { d["industry"] = v }
        if let v = country { d["country"] = v }
        if let v = linkedinUrl { d["linkedin_url"] = v }
        if let v = instagramUrl { d["instagram_url"] = v }
        if let v = facebookUrl { d["facebook_url"] = v }
        if let v = notes { d["notes"] = v }
        if let v = employeeCountEstimate { d["employee_count_estimate"] = v }
        if let v = leadQualityScore { d["lead_quality_score"] = v }
        return d
    }
}
