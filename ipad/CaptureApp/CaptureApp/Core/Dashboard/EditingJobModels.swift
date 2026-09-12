import Foundation
import SwiftUI

/// An editing job the photographer sent to an external editor. Decoded from the
/// raw `editing_jobs` row (snake_case) returned by `/api/editing/jobs`.
struct EditingJob: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var projectId: String?
    var projectTitle: String?
    var vendorName: String?
    var status: String
    var requestedServices: [String]
    var brief: String?
    var amountCents: Int
    var currency: String
    var paymentStatus: String?
    var paymentMethod: String?
    var invoiceUrl: String?
    var maxRevisions: Int
    var revisionsUsed: Int
    var galleryId: String?
    var requestedAt: String?
    var deliveredAt: String?
    var approvedAt: String?
    var createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case projectTitle = "project_title"
        case vendorName = "vendor_name"
        case status
        case requestedServices = "requested_services"
        case brief
        case amountCents = "amount_cents"
        case currency
        case paymentStatus = "payment_status"
        case paymentMethod = "payment_method"
        case invoiceUrl = "invoice_url"
        case maxRevisions = "max_revisions"
        case revisionsUsed = "revisions_used"
        case galleryId = "gallery_id"
        case requestedAt = "requested_at"
        case deliveredAt = "delivered_at"
        case approvedAt = "approved_at"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        projectId = c.firstString([.projectId])
        projectTitle = c.firstString([.projectTitle])
        vendorName = c.firstString([.vendorName])
        status = c.firstString([.status]) ?? "requested"
        // requested_services is a JSONB array of strings; tolerate absence.
        requestedServices = (try? c.decodeIfPresent([String].self, forKey: .requestedServices)) ?? []
        brief = c.firstString([.brief])
        amountCents = c.firstInt([.amountCents]) ?? 0
        currency = c.firstString([.currency]) ?? "NOK"
        paymentStatus = c.firstString([.paymentStatus])
        paymentMethod = c.firstString([.paymentMethod])
        invoiceUrl = c.firstString([.invoiceUrl])
        maxRevisions = c.firstInt([.maxRevisions]) ?? 2
        revisionsUsed = c.firstInt([.revisionsUsed]) ?? 0
        galleryId = c.firstString([.galleryId])
        requestedAt = c.firstString([.requestedAt])
        deliveredAt = c.firstString([.deliveredAt])
        approvedAt = c.firstString([.approvedAt])
        createdAt = c.firstString([.createdAt])
    }

    var amountKr: Int { amountCents / 100 }
    var canRequestRevision: Bool { status == "delivered" && revisionsUsed < maxRevisions }
    var canApprove: Bool { status == "delivered" }
    var needsPayment: Bool { amountCents > 0 && paymentStatus != "held" && paymentStatus != "released" }
    var isOpen: Bool { !["approved", "cancelled", "declined", "delivered_to_client"].contains(status) }
}

/// Display metadata for a job status — label, colour, and pipeline position.
enum JobStatusUI {
    static let pipeline = ["requested", "in_progress", "delivered", "approved"]

    static func label(_ status: String) -> String {
        switch status {
        case "draft": return "Utkast"
        case "requested": return "Sendt"
        case "accepted", "in_progress": return "Pågår"
        case "delivered": return "Levert"
        case "approved": return "Godkjent"
        case "delivered_to_client": return "Levert til kunde"
        case "declined": return "Avslått"
        case "cancelled": return "Avbrutt"
        default: return status.capitalized
        }
    }

    static func color(_ status: String) -> Color {
        switch status {
        case "requested": return CHTheme.accentSoft
        case "accepted", "in_progress": return CHTheme.accent
        case "delivered": return CHTheme.warning
        case "approved", "delivered_to_client": return CHTheme.success
        case "declined", "cancelled": return .red
        default: return CHTheme.textMuted
        }
    }

    /// Index in the happy-path pipeline (accepted folds into in_progress).
    static func pipelineIndex(_ status: String) -> Int {
        switch status {
        case "draft", "requested": return 0
        case "accepted", "in_progress": return 1
        case "delivered": return 2
        case "approved", "delivered_to_client": return 3
        default: return -1
        }
    }
}

struct EditingJobFileRef: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var fileName: String?
    var fileRole: String?
    var transferStatus: String?
    var sizeBytes: Int?
    var contentType: String?
    var uploadedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case fileName = "file_name"
        case fileRole = "file_role"
        case transferStatus = "transfer_status"
        case sizeBytes = "size_bytes"
        case contentType = "content_type"
        case uploadedAt = "uploaded_at"
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        fileName = c.firstString([.fileName])
        fileRole = c.firstString([.fileRole])
        transferStatus = c.firstString([.transferStatus])
        sizeBytes = c.firstInt([.sizeBytes])
        contentType = c.firstString([.contentType])
        uploadedAt = c.firstString([.uploadedAt])
    }
    var isSource: Bool { fileRole == "source" }
}

struct EditingJobEvent: Decodable, Sendable, Identifiable, Hashable {
    var id: String { (eventType ?? "") + (createdAt ?? "") }
    var eventType: String?
    var actorRole: String?
    var createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case eventType = "event_type"
        case actorRole = "actor_role"
        case createdAt = "created_at"
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        eventType = c.firstString([.eventType])
        actorRole = c.firstString([.actorRole])
        createdAt = c.firstString([.createdAt])
    }
}

struct JobMessage: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var senderRole: String?
    var body: String?
    var createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case senderRole = "sender_role"
        case body
        case createdAt = "created_at"
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        senderRole = c.firstString([.senderRole])
        body = c.firstString([.body])
        createdAt = c.firstString([.createdAt])
    }
    var fromPhotographer: Bool { senderRole == "photographer" }
}

struct EditingJobDetail: Decodable, Sendable {
    let job: EditingJob
    var role: String?
    var files: [EditingJobFileRef]
    var events: [EditingJobEvent]

    private enum CodingKeys: String, CodingKey { case job, role, files, events }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        job = try c.decode(EditingJob.self, forKey: .job)
        role = try? c.decodeIfPresent(String.self, forKey: .role)
        files = (try? c.decodeIfPresent([EditingJobFileRef].self, forKey: .files)) ?? []
        events = (try? c.decodeIfPresent([EditingJobEvent].self, forKey: .events)) ?? []
    }
}

/// Shared short-date formatting for the ISO8601 timestamps these rows carry —
/// delegates to DashboardDate's (Swift 6-safe) parser.
enum JobDate {
    static func short(_ s: String?) -> String {
        guard let d = DashboardDate.parse(s) else { return "" }
        return d.formatted(date: .abbreviated, time: .shortened)
    }
}
