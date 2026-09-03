// VisitModel.swift

import Foundation

enum VisitType: String, Codable, CaseIterable {
    case physical
    case phone
    case email
    case onlineMeeting = "online_meeting"
    case research

    var label: String {
        switch self {
        case .physical: return "Fysisk besøk"
        case .phone: return "Telefon"
        case .email: return "E-post"
        case .onlineMeeting: return "Online-møte"
        case .research: return "Research"
        }
    }
}

struct VisitModel: Identifiable, Codable, Hashable {
    let id: String
    let customerId: String
    let userId: String
    let visitType: VisitType
    let visitDatetime: Date
    let previousStatus: String?
    let newStatus: String?
    let contactPerson: String?
    let conversationSummary: String?
    let objectionReason: String?
    let notes: String?
    let nextAction: String?
    let nextFollowUpAt: Date?
    var activityKind: String? = nil
    var outcome: String? = nil
    var durationMinutes: Int? = nil
}

struct LeadStoredFileModel: Identifiable, Codable, Hashable {
    let id: String
    let displayName: String
    let sizeBytes: Int
    let contentType: String?
    let uploadedAt: Date
    var description: String? = nil
    var tags: [String]? = nil
    var uploaderUserId: String? = nil
    var uploaderName: String? = nil
}

struct LeadNoteModel: Identifiable, Codable, Hashable {
    let id: String
    let leadId: String
    let authorUserId: String?
    let authorName: String
    let body: String
    let pinned: Bool
    let createdAt: Date
    let updatedAt: Date
}

struct VisitDraft {
    var type: VisitType = .physical
    var contactPerson: String = ""
    var conversationSummary: String = ""
    var objectionReason: String = ""
    var notes: String = ""
    var newStatus: LeadStatus?
    var nextAction: String = ""
    var nextFollowUpAt: Date?
    var latitude: Double?
    var longitude: Double?

    func toJSON() -> [String: Any] {
        var json: [String: Any] = ["visitType": type.rawValue]
        if !contactPerson.isEmpty { json["contactPerson"] = contactPerson }
        if !conversationSummary.isEmpty { json["conversationSummary"] = conversationSummary }
        if !objectionReason.isEmpty { json["objectionReason"] = objectionReason }
        if !notes.isEmpty { json["notes"] = notes }
        if let newStatus { json["newStatus"] = newStatus.rawValue }
        if !nextAction.isEmpty { json["nextAction"] = nextAction }
        if let nextFollowUpAt {
            let f = ISO8601DateFormatter()
            json["nextFollowUpAt"] = f.string(from: nextFollowUpAt)
        }
        if let latitude { json["visitLatitude"] = latitude }
        if let longitude { json["visitLongitude"] = longitude }
        return json
    }
}
