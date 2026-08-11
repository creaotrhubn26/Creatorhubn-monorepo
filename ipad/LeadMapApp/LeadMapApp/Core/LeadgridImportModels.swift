// LeadgridImportModels.swift
//
// Decode-typer for /api/leadgrid/import/* (mig 328). Brukes av
// LeadgridImportSheet på iPad. Følger eksisterende Codable-mønster fra
// LeadgridMomentumModels.swift / LeadgridForecastingModels.swift.
//
// URL-research-flyten gjenbruker eksisterende Role Room Agent-stack
// (runBrandScan → BrandKit + createMarketScan). Vi har ingen Claude-
// orchestration her — iPad-klienten viser bare det Brand Kit / Market
// Scan-pipelinen produserer.

import Foundation

// MARK: - CSV preview-respons

struct LeadgridImportPreview: Codable, Sendable {
    let fileToken: String
    let fileName: String
    let columns: [String]
    let rows: [[String: String]]   // første 20 rader
    let totalRows: Int
}

// MARK: - Commit-respons (CSV)

struct LeadgridImportCommit: Codable, Sendable {
    let batchId: String
    let imported: Int
    let skippedDuplicates: Int
    let errorsCount: Int
}

// MARK: - URL-research-flyt (draft → preview → commit)

/// Resultat fra POST /api/leadgrid/import/url/research.
/// `brandKit` kan være nil hvis runBrandScan feilet (status='failed').
struct LeadgridUrlResearchResult: Codable, Sendable {
    let draftLeadId: String
    let brandKit: LeadgridImportBrandKit?
    let marketScanId: String?
    /// 'completed' | 'partial' | 'failed'.
    let status: String
    let error: String?
}

/// Resultat fra GET /api/leadgrid/import/url/preview/:draft_lead_id.
/// Sammenstilt preview brukeren kan lese før accept/reject.
struct LeadgridUrlImportPreview: Codable, Sendable {
    let draftLeadId: String
    let draftStatus: String?
    let leadSnapshot: LeadgridImportLeadSnapshot
    let brandKit: LeadgridImportBrandKit?
    let marketScan: LeadgridImportMarketScanSummary?
}

struct LeadgridImportLeadSnapshot: Codable, Sendable {
    let name: String?
    let websiteUrl: String?
    let city: String?
    let country: String?
    let industry: String?
}

struct LeadgridImportMarketScanSummary: Codable, Sendable, Hashable {
    let id: String
    let name: String
    let status: String
    let marketQuery: String
}

/// Brand Kit-utdrag som backend leverer i preview. Matcher BrandKitSummary
/// i leadgrid-import-routes.ts.
struct LeadgridImportBrandKit: Codable, Sendable, Hashable {
    let id: String
    let sourceUrl: String
    let businessName: String?
    let tagline: String?
    let description: String?
    let industry: String?
    let targetAudience: String?
    let toneOfVoice: String?
    let usps: [String]
    let primaryCta: String?
    let logoUrl: String?
    let colors: LeadgridImportBrandColors
    let socialLinks: LeadgridImportBrandSocialLinks
    let lastScannedAt: String?
}

struct LeadgridImportBrandColors: Codable, Sendable, Hashable {
    let primary: String?
    let accent: String?
    let secondary: String?
}

struct LeadgridImportBrandSocialLinks: Codable, Sendable, Hashable {
    let linkedin: String?
    let instagram: String?
    let facebook: String?
}

/// Commit-respons (URL-flyt). Vi får tilbake hvilken status leaden
/// endte med — 'lead' eller 'rejected'.
struct LeadgridUrlCommitResult: Codable, Sendable {
    let ok: Bool
    let leadId: String
    let status: String
}

/// Brukerens overrides ved accept. Send kun feltene som er endret;
/// resten beholdes fra Brand Kit-resultatet.
struct LeadgridUrlCommitOverrides: Sendable {
    var name: String?
    var email: String?
    var phone: String?
    var city: String?
    var address: String?
    var industry: String?
    var notes: String?

    func toDict() -> [String: Any] {
        var d: [String: Any] = [:]
        if let v = name { d["name"] = v }
        if let v = email { d["email"] = v }
        if let v = phone { d["phone"] = v }
        if let v = city { d["city"] = v }
        if let v = address { d["address"] = v }
        if let v = industry { d["industry"] = v }
        if let v = notes { d["notes"] = v }
        return d
    }
}
