// BulkUrlResearchModels.swift
//
// Decode-typer for /api/leadgrid/url-research/batch[es]/* (mig 0351).
// Selger limer inn N URLer; backend kjører dem gjennom samme research-
// pipeline som enkelt-URL-flyten og rapporterer live progress.
//
// Live-counter "X / Y leads lagt til på kartet" drives av
// `BulkUrlBatchProgress` som vi poller hvert 2. sek mens batchen kjører.

import Foundation

// MARK: - /batch (start) respons

struct BulkUrlBatchStartResponse: Codable, Sendable {
    let batchId: String
    let totalUrls: Int
    let acceptedUrls: Int
    let rejectedUrls: [String]?
}

// MARK: - /poll (lett-vekt progress)

struct BulkUrlBatchProgress: Codable, Sendable {
    let batchId: String
    let status: BulkUrlBatchStatus
    let progress: BulkUrlBatchProgressNumbers
    let etaSeconds: Int?
    let startedAt: String?
    let finishedAt: String?
}

struct BulkUrlBatchProgressNumbers: Codable, Sendable {
    let completed: Int
    let failed: Int
    let pinned: Int
    let total: Int

    /// Antall som fortsatt skal prosesseres (pending + running).
    var remaining: Int { max(0, total - completed - failed) }

    /// Andel ferdig (0.0-1.0) for ProgressView-binding.
    var fraction: Double {
        guard total > 0 else { return 0 }
        return Double(completed + failed) / Double(total)
    }
}

enum BulkUrlBatchStatus: String, Codable, Sendable {
    case pending
    case running
    case completed
    case failed
    case partial
    case cancelled

    /// Sant når processoren fortsatt jobber — UI fortsetter polling.
    var isActive: Bool {
        switch self {
        case .pending, .running: return true
        case .completed, .failed, .partial, .cancelled: return false
        }
    }
}

// MARK: - /batches/:id (full detail)

struct BulkUrlBatchDetail: Codable, Sendable {
    let batch: BulkUrlBatchInfo
    let items: [BulkUrlBatchItem]
    let summary: BulkUrlBatchSummary
}

struct BulkUrlBatchInfo: Codable, Sendable, Identifiable {
    let id: String
    let organizationId: String?
    let createdBy: String
    let totalUrls: Int
    let completedUrls: Int
    let failedUrls: Int
    let pinnedLeads: Int
    let status: BulkUrlBatchStatus
    let startedAt: String?
    let finishedAt: String?
    let createdAt: String
}

struct BulkUrlBatchItem: Codable, Sendable, Identifiable {
    let id: String
    let url: String
    let orderIndex: Int
    let status: BulkUrlItemStatus
    let draftLeadId: String?
    let hasPin: Bool
    let locationConfidence: LocationConfidence?
    let errorMessage: String?
    let researchResult: BulkUrlItemResearchResult?
}

/// Light-version av research_result som lagres på item-raden (companyProfile + location).
/// Vi har ikke full synthesis/brreg her — bruk fetchUrlResearchPreview hvis du trenger detaljene.
struct BulkUrlItemResearchResult: Codable, Sendable {
    let companyProfile: UrlResearchCompanyProfile?
    let location: UrlResearchResolvedLocation?
}

enum BulkUrlItemStatus: String, Codable, Sendable {
    case pending
    case running
    case completed
    case failed
    case skipped
}

struct BulkUrlBatchSummary: Codable, Sendable {
    let total: Int
    let completed: Int
    let failed: Int
    let pinned: Int
    let pending: Int
}

// MARK: - /commit-all respons

struct BulkUrlCommitAllResponse: Codable, Sendable {
    let ok: Bool
    let batchId: String
    let committed: Int
    let skipped: Int
    let filter: [LocationConfidence]?
}

// MARK: - Aggregated counters for UI

extension BulkUrlBatchDetail {
    /// Breakdown brukt i success-banner:
    ///   "X med eksakt lokasjon (Places-treff)"
    ///   "Y geokodet (Brreg-adresse)"
    ///   "Z med by-sentroid"
    ///   "W feilet"
    var confidenceBreakdown: (
        exact: Int, geocoded: Int, approximate: Int, unknown: Int, failed: Int
    ) {
        var exact = 0, geocoded = 0, approximate = 0, unknown = 0, failed = 0
        for item in items {
            if item.status == .failed || item.status == .skipped {
                failed += 1
                continue
            }
            switch item.locationConfidence {
            case .exact: exact += 1
            case .geocoded: geocoded += 1
            case .approximate: approximate += 1
            case .unknown: unknown += 1
            case .none: unknown += 1
            }
        }
        return (exact, geocoded, approximate, unknown, failed)
    }
}
