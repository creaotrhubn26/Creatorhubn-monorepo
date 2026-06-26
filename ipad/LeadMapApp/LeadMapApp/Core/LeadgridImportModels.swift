// LeadgridImportModels.swift
//
// Decode-typer for /api/leadgrid/import/csv/* (mig 328). Brukes av
// LeadgridImportSheet på iPad. Følger eksisterende Codable-mønster fra
// LeadgridMomentumModels.swift / LeadgridForecastingModels.swift.
//
// URL Research-typer lever i LeadgridUrlResearchModels.swift.

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
